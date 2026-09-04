---
title: View and customize logs
weight: 10
description: Configure per-request structured access logs with CEL-based filtering, field enrichment, and OTLP export.
test: skip
---

Agentgateway writes a structured access log line to stdout for every request it processes. Access logs are separate from [debug/system logs]({{< link-hextra path="/operations/debug/#debug-logs" >}}), which control agentgateway's own operational output.

## Access log format

By default, access logs are written in a structured key=value format as shown in the following example. 

```console
2025-12-12T21:56:02.809082Z	info	request gateway=agentgateway listener=http route=openai endpoint=api.openai.com:443
src.addr=127.0.0.1:60862 http.method=POST http.host=localhost http.path=/openai http.version=HTTP/1.1
http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai
gen_ai.request.model=gpt-4o gen_ai.response.model=gpt-4o-2024-08-06
gen_ai.usage.input_tokens=68 gen_ai.usage.output_tokens=298 duration=2488ms
```

For LLM traffic, the log line automatically includes `gen_ai.*` fields. For MCP traffic, it includes `mcp.*` fields.

You can change the default log format to JSON by setting the `config.logging.format` field. 

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  logging:
    format: json
```

### Use OpenTelemetry field names {#preset}

The field names in the previous example are short and human-oriented. To rename the built-in HTTP fields to their [OpenTelemetry semantic convention](https://opentelemetry.io/docs/specs/semconv/http/http-spans/) equivalents, such as `url.path` instead of `http.path`, set `preset: otel` on the access log policy.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    preset: otel
```

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
> The preset changes only the stdout access log, and only for HTTP traffic. A TCP listener has no HTTP field set to rename, so the preset has no effect there. An OTLP export already uses semantic convention attribute names, so it is unaffected. For more information, see [Export logs over OTLP]({{< link-hextra path="/observability/access-logs/export/" >}}).

## View access logs in the UI

The agentgateway UI includes a **Logs** page that you can use to review the access logs that were captured by your proxy. 

To view access logs in the UI: 

1. Open the [agentgateway UI](http://localhost:15000/ui). This address is the copy of the UI on the admin interface, which works from the host that runs the proxy. If you serve the UI on a gateway, use that gateway's port instead. 
2. Go to **Logs** and review the access logs that agentgateway captured for your previous requests. Use the filter options to limit the number of access logs that are shown to you. For example, you can filter logs by model, providers, or users. Note that in order to filter logs by user, you must configure authentication in agentgateway. 

   {{< reuse-image src="img/agentgateway-ui-logs.png" srcDark="img/agentgateway-ui-logs-dark.png" >}}

3. Optional: Enable richer access logging for LLM and MCP-specific requests by going to the log **Settings** and toggling **Include prompts and completions in logs**. For every request that you sent through agentgateway, the following additional information is captured: 
   - **Trajectory**: Review the steps that your request took, including tool calls, and how many tokens were spent in each step. Each step is represented as a line. The longer the line is, the more tokens were used in that step.
   - **Conversation view**: See the details of your conversation with the LLM provider, such as the prompt that you sent and the reply that you got from the LLM. 

4. Select a log entry to open it and review its trajectory and conversation.

   {{< reuse-image src="img/agentgateway-ui-log-detail.png" srcDark="img/agentgateway-ui-log-detail-dark.png" >}}

## Filter requests

Use a [CEL]({{< link-hextra path="/reference/cel/" >}}) expression to log only a subset of requests. Requests that do not match the expression are not logged. The following example produces access logs only for requests with a response code of 400 or greater.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: 'response.code >= 400'
```

## Add custom fields to logs

You can add custom fields to every access log line by using CEL expressions that are evaluated against the request and response context.

The following example adds 3 fields to every access log entry:
- `user_id`: Extracts the value of the `x-user-id` request header.
- `env`: Adds a static string of `production`.
- `cost`: Converts the LLM request cost to a string and logs it.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      user_id: 'request.headers["x-user-id"]'
      env: '"production"'
      cost: 'string(llm.cost)'
```

For the full list of available fields, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}). 

### Log guardrail interventions {#guardrails}

A prompt guard that masks or rejects content records what it did under the `guardrails` variable, with one entry per intervention. Add that variable to a log field to keep an audit trail of every intervention, including which guard acted and why.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: guardrails.size() > 0
    add:
      guardrails: 'guardrails'
      guardrail_action: 'guardrails[0].action'
```

Each entry carries `phase` (`request` or `response`), `guard` (the guard kind, such as `regex` or `bedrockGuardrails`), `action` (`mask`, `reject`, `audit`, or `failOpen`), `guardrailId`, `guardrailVersion`, `actionReason`, and `assessments`. The `assessments` field holds provider metadata only, so a log never records the content that the guardrail matched.

> [!NOTE]
> Only CEL that runs after the request completes, such as a log field or a metric field, receives the `guardrails` variable. An authorization or transformation expression that runs mid-request never sees it.

## Remove fields from logs

Remove fields from access log lines. The following example removes the source address and HTTP path that are included by default. 

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    remove:
      - src.addr
      - http.path
```

