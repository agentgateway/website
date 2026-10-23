---
title: View and customize logs
weight: 10
description: Configure per-request structured access logs with CEL-based filtering, field enrichment, and OTLP export.
test: skip
---

Agentgateway writes a structured access log line to stdout for every request it processes. Access logs are separate from [debug/system logs]({{< link-hextra path="/documentation/operations/debug/#debug-logs" >}}), which control agentgateway's own operational output.

## Access log format

By default, access logs are written in a structured key=value format as shown in the following example. 

```console
2025-12-12T21:56:02.809082Z	info	request gateway=agentgateway listener=http route=openai endpoint=api.openai.com:443
src.addr=127.0.0.1:60862 http.method=POST http.host=localhost http.path=/openai http.version=HTTP/1.1
http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai
gen_ai.request.model=gpt-4o gen_ai.response.model=gpt-4o-2024-08-06
gen_ai.usage.input_tokens=68 gen_ai.usage.output_tokens=298 duration=2488ms
```

For LLM traffic, the log line automatically includes `gen_ai.*` fields. When the LLM request format cannot be inferred, such as for passthrough traffic, the `gen_ai.operation.name` value is `unknown`. For MCP traffic, the log line includes `mcp.*` fields.

For requests that the `llm.models` configuration or a virtual model serves, `agw.ai.original_model` records the model name that the client sent, and `gen_ai.request.model` records the model that reaches the provider after routing, such as the target that a virtual model selected.

You can change the default log format to JSON by setting the `config.logging.format` field. 

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  logging:
    format: json
```

### Use OpenTelemetry field names {#preset}

The field names in the previous example are short and human-oriented. To rename the built-in HTTP fields to their [OpenTelemetry semantic convention](https://opentelemetry.io/docs/specs/semconv/http/http-spans/) equivalents, such as `url.path` instead of `http.path`, set `preset: otel` on the access log policy.

You can set the preset in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).

1. Open the **Settings** > **Observability** page, such as [http://localhost:15000/ui/settings/observability](http://localhost:15000/ui/settings/observability).
2. Click the **Access logs** card.
3. In the **Log fields** section, select **OpenTelemetry** from the **Stdout preset** dropdown.

   {{< reuse-image src="img/ui-access-logs-preset.png" srcDark="img/ui-access-logs-preset-dark.png" alt="Access logs drawer with OpenTelemetry selected as the stdout preset" >}}

4. Click **Save policy**. The **Access logs** card shows **enabled**.

The UI saves the policy under `frontendPolicies.accessLog` in your configuration.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    preset: otel
```
{{% /tab %}}
{{< /tabs >}}

Use this preset when you ship stdout logs to a pipeline that already expects semantic convention attribute names, so that you do not have to rename the fields downstream.

The preset renames the following built-in fields.

| Default field | Field with `preset: otel` |
| -- | -- |
| `src.addr` | `client.address`. The value is the client IP address without the port. |
| `http.method` | `http.request.method` |
| `http.host` | `server.address` |
| `http.path` | `url.path`. The value is the path only. Any query string moves to a separate `url.query` field instead of staying on the path. |
| `http.version` | `network.protocol.version`. The value is the bare version, such as `1.1` instead of `HTTP/1.1`. |
| `http.status` | `http.response.status_code` |

The preset also adds `url.scheme`, and it adds `server.port` and `url.query` when the request supplies them. These added fields are appended to the end of the log line, after `duration`, rather than placed next to the other HTTP fields. With the preset set, the earlier example is logged as follows.

```console
2025-12-12T21:56:02.809082Z	info	request gateway=agentgateway listener=http route=openai endpoint=api.openai.com:443
client.address=127.0.0.1 http.request.method=POST server.address=localhost url.path=/openai
network.protocol.version=1.1 http.response.status_code=200 protocol=llm
gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-4o
gen_ai.response.model=gpt-4o-2024-08-06 gen_ai.usage.input_tokens=68
gen_ai.usage.output_tokens=298 duration=2488ms url.scheme=http
```

Only the built-in HTTP field set is renamed. The `gen_ai.*` and `mcp.*` fields already use semantic convention names, and fields that are not part of the HTTP set, such as `gateway`, `route`, and `duration`, keep their names. Fields that you [add yourself](#add-custom-fields-to-logs) are not renamed, so choose semantic convention names for them if you want the whole line to be consistent.

> [!NOTE]
> The preset changes only the stdout access log, and only for HTTP traffic. A TCP listener has no HTTP field set to rename, so the preset has no effect there. An OTLP export already uses semantic convention attribute names, so it is unaffected. For more information, see [Export logs over OTLP]({{< link-hextra path="/documentation/observability/access-logs/export/" >}}).

## View access logs in the UI

The agentgateway UI includes a **Logs** page that you can use to review the access logs that were captured by your proxy. 

To view access logs in the UI: 

1. Open the [agentgateway UI](http://localhost:15000/ui). This address is the copy of the UI on the admin interface, which works from the host that runs the proxy. If you serve the UI on a gateway, use that gateway's port instead. 
2. Go to **Logs** and review the access logs that agentgateway captured for your previous requests. Use the filter options to limit the number of access logs that are shown to you. For example, you can filter logs by model, providers, or users. Note that in order to filter logs by user, you must configure authentication in agentgateway. Each filter lists the values from recorded traffic. To find a value in a long list, type part of it in the search box at the top of the filter, and then select the value. Typing alone does not change the logs that are shown. 

   {{< reuse-image src="img/agentgateway-ui-logs.png" srcDark="img/agentgateway-ui-logs-dark.png" >}}

3. Optional: Enable richer access logging for LLM and MCP-specific requests by going to the log **Settings** and toggling **Include prompts and completions in logs**. For every request that you sent through agentgateway, the following additional information is captured: 
   - **Trajectory**: Review the steps that your request took, including tool calls, and how many tokens were spent in each step. Each step is represented as a line. The longer the line is, the more tokens were used in that step.
   - **Conversation view**: See the details of your conversation with the LLM provider, such as the prompt that you sent and the reply that you got from the LLM. 

4. Select a log entry to open it and review its trajectory and conversation.

   {{< reuse-image src="img/agentgateway-ui-log-detail.png" srcDark="img/agentgateway-ui-log-detail-dark.png" >}}

## View LLM request logs with agctl {#cli}

Use `agctl standalone logs` to inspect recorded LLM requests without the UI or a database client. Before you begin, [install agctl and connect it to your gateway]({{< link-hextra path="/documentation/operations/config-resources/#connect" >}}), and [configure a request-log database]({{< link-hextra path="/documentation/observability/access-logs/database/" >}}).

The command reads the records in the database, not the output of the gateway process. Agentgateway records only LLM requests in the database. For startup errors, configuration reloads, and the access logs of HTTP or MCP traffic, use the logs of the gateway process or container. To change the log level of the process, use `agctl proxy log`.

1. List recent requests. By default, the command shows the 20 most recent records, oldest first. Each record shows the status, duration, provider, model, tokens, cost, and request ID.

   ```sh
   agctl standalone logs --limit 10
   ```

   Example output:

   ```text
   TIME                 STATUS  DURATION  PROVIDER  MODEL        TOKENS(IN/OUT)  COST       ID
   2026-10-20 15:58:05  200     2ms       openai    gpt-4o-mini  1/250           $0.000150  01a15ae4-7924-7147-89b4-8dde2ae7404b
   2026-10-20 15:58:05  200     0ms       openai    gpt-4o-mini  1/120           $0.000072  01a15ae4-792f-75d8-a1ec-598d1614d6ad
   2026-10-20 15:58:05  200     0ms       openai    gpt-4o       1/300           $0.003002  01a15ae4-7939-72dd-b477-2f5648b31f3a
   ```

2. Filter the requests by time, HTTP status, provider, or requested model. The first example shows the requests that returned a `429` or a `500` status.

   ```sh
   agctl standalone logs --since 1h --status 429 --status 500
   agctl standalone logs --provider openai --model gpt-4o
   ```

   To filter by the model in the provider response, use `--response-model`. To find the requests of a recorded trace, use `--trace-id`. The `--since` flag takes durations such as `5m` and `24h`.

3. Follow new requests as they complete. To stop following, press `Ctrl+C`.

   ```sh
   agctl standalone logs -f --model gpt-4o
   ```

4. Inspect one request with an ID from the list. By default, the details are in YAML format. For JSON, add `-o json`.

   ```sh
   agctl standalone logs <request-id>
   ```

   Example output, shortened:

   ```yaml
   attributes:
     agentgateway.user: alice
     agw.ai.usage.cost.total: 0.003002
     gen_ai.provider.name: openai
     gen_ai.request.model: gpt-4o
     http.path: /v1/chat/completions
     http.status: 200
     # ...
   cost: 0.003002
   durationMs: 0
   hasPayload: false
   httpStatus: 200
   id: 01a15ae4-7939-72dd-b477-2f5648b31f3a
   payload:
     requestPrompt: null
     responseCompletion: null
   usage:
     inputTokens: 1
     outputTokens: 300
     totalTokens: 301
   ```

   The `payload` fields contain the prompt and completion only if payload capture was on for the request. To capture payloads for later requests, set `frontendPolicies.accessLog.database.llm` to `full`, as described in [Access log data storage]({{< link-hextra path="/documentation/observability/access-logs/database/#access-log-data-storage" >}}). Payload capture does not add content to older records.

5. Include custom database attributes in structured output.

   ```sh
   agctl standalone logs --since 1h --attributes -o json
   ```

   Configure custom attributes in `frontendPolicies.accessLog.database.add`. Fields that you add only to the stdout access log with `accessLog.add` do not appear in these records.

The `--limit` flag accepts up to 500 records. In JSON format, the list output has a `logs` array, and `logs -f -o json` streams one JSON record per line. For request counts, token usage, and cost, use [CLI analytics]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/#cli" >}}). For all flags, see the [`logs` reference]({{< link-hextra path="/reference/agctl/agctl-standalone-logs/" >}}).

## Filter requests

Use a [CEL]({{< link-hextra path="/reference/cel/" >}}) expression to log only a subset of requests. Requests that do not match the expression are not logged. The following example produces access logs only for requests with a response code of 400 or greater.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open the **Settings** > **Observability** page, and click the **Access logs** card.
2. In the **Log fields** section, enter `response.code >= 400` in the **Filter** field.
3. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: 'response.code >= 400'
```
{{% /tab %}}
{{< /tabs >}}

## Add custom fields to logs

You can add custom fields to every access log line by using CEL expressions that are evaluated against the request and response context.

The following example adds 3 fields to every access log entry:
- `user_id`: Extracts the value of the `x-user-id` request header.
- `env`: Adds a static string of `production`.
- `cost`: Converts the LLM request cost to a string and logs it.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open the **Settings** > **Observability** page, and click the **Access logs** card.
2. In the **Log fields** section, add each field under **Add fields**. For each field, enter the name and the CEL expression, and click **Add**.
   1. `user_id` with the value `request.headers["x-user-id"]`
   2. `env` with the value `"production"`. Keep the double quotes, because the value is a CEL string.
   3. `cost` with the value `string(llm.cost)`

   {{< reuse-image src="img/ui-access-logs-add-fields.png" srcDark="img/ui-access-logs-add-fields-dark.png" alt="Access logs drawer with the user_id, env, and cost fields added" >}}

3. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      user_id: 'request.headers["x-user-id"]'
      env: '"production"'
      cost: 'string(llm.cost)'
```
{{% /tab %}}
{{< /tabs >}}

For the full list of available fields, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}). 

### Log the agent session {#agent-session}

Add `request.agent.session` to correlate requests from the same agent session. This example records an empty string when no session is available.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      agent_session: 'has(request.agent.session) ? request.agent.session : ""'
```

Agentgateway detects sessions from recognized agent headers. To override detection, use `config.standardAttributes.session`. For details, see [Agent sessions]({{< link-hextra path="/reference/cel/variables/#agent-sessions" >}}).

### Log the selected backend endpoint {#backend-endpoint}

Use `backend.endpoint` to record the resolved destination of a directly addressed backend, such as a static hostname, including its port for a network endpoint. This complements `backend.name`, which identifies the configured backend. Service backends leave `backend.endpoint` unset because their workload endpoints are selected separately. The endpoint is available only after the target is resolved, so guard the lookup for Service backends and requests rejected earlier in processing.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open the **Settings** > **Observability** page, and click the **Access logs** card.
2. Under **Add fields**, enter `backend_endpoint` as the name and `has(backend.endpoint) ? backend.endpoint : ""` as the value, and click **Add**.
3. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      backend_endpoint: 'has(backend.endpoint) ? backend.endpoint : ""'
```
{{% /tab %}}
{{< /tabs >}}

### Log guardrail results {#guardrails}

Prompt guards record their evaluation results under the `guardrails` variable, including `allow` when content is accepted. Add the variable to a log field to record which guards ran and their outcomes.

When a request guard rejects an LLM request before the provider call, the access log still includes the request-side LLM metadata and the `guardrails` entry. Provider response fields are absent because the request never reaches the LLM provider.

The following filter includes all requests with guardrail results, even when every guard allows the content.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open the **Settings** > **Observability** page, and click the **Access logs** card.
2. In the **Log fields** section, enter `guardrails.size() > 0` in the **Filter** field.
3. Under **Add fields**, add each field, and click **Add** after each one.
   1. `guardrails` with the value `guardrails`
   2. `guardrail_action` with the value `guardrails[0].action`

   {{< reuse-image src="img/ui-access-logs-guardrails.png" srcDark="img/ui-access-logs-guardrails-dark.png" alt="Access logs drawer with the guardrails.size() > 0 filter and the guardrails and guardrail_action fields" >}}

4. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: guardrails.size() > 0
    add:
      guardrails: 'guardrails'
      guardrail_action: 'guardrails[0].action'
```
{{% /tab %}}
{{< /tabs >}}

The `frontendPolicies.accessLog.filter` field takes a boolean CEL expression that selects which requests to log. In this example, `guardrails.size() > 0` counts the results and logs requests with at least one result. The expressions under `frontendPolicies.accessLog.add` separately choose the values recorded in each log field.

To log only requests with an intervention, change `frontendPolicies.accessLog.filter` to `guardrails.exists(g, g.action != "allow")`. The `exists` macro checks each result, called `g` in this expression, and returns `true` if any result has an action other than `allow`. Both `exists` and `size()` are CEL operations on the list, not properties of a result.

Each entry carries `phase` (`request` or `response`), `guard` (the guard kind, such as `regex` or `bedrockGuardrails`), `action` (`allow`, `mask`, `reject`, `audit`, or `failOpen`), `guardrailId`, `guardrailVersion`, `actionReason`, and `assessments`. The `assessments` field holds provider metadata only, so a log never records the content that the guardrail matched.

> [!NOTE]
> Only CEL that runs after the request completes, such as a log field or a metric field, receives the `guardrails` variable. An authorization or transformation expression that runs mid-request never sees it.

### Log MCP guardrail metadata {#mcp-guardrails}

An ExtMCP request-phase guardrail can return dynamic metadata with a `Pass` or mutated result. After the MCP request completes, access-log CEL can read that metadata from the `mcpGuardrails` variable. Access-log CEL can also read the metadata for requests that resume a stateful MCP session. Use `mcpGuardrails` to record policy-server decisions that are not part of the default MCP log fields.

The metadata keys depend on the ExtMCP server response. The following example records the `decision` key when the policy server returns metadata such as `{"decision":"allow"}`.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open the **Settings** > **Observability** page, and click the **Access logs** card.
2. Under **Add fields**, enter `mcp_guardrail_decision` as the name and `mcpGuardrails != null ? string(mcpGuardrails.decision) : ""` as the value, and click **Add**.
3. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      mcp_guardrail_decision: 'mcpGuardrails != null ? string(mcpGuardrails.decision) : ""'
```
{{% /tab %}}
{{< /tabs >}}

## Remove fields from logs

Remove fields from access log lines. The following example removes the source address and HTTP path that are included by default. 

{{< tabs >}}
{{% tab name="UI" %}}
1. Open the **Settings** > **Observability** page, and click the **Access logs** card.
2. In the **Log fields** section, add each field to **Remove fields**.
   1. Enter `src.addr`, and click **Add**.
   2. Enter `http.path`, and click **Add**.
3. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    remove:
      - src.addr
      - http.path
```
{{% /tab %}}
{{< /tabs >}}
