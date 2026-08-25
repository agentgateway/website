---
title: Access logs
weight: 10
description: Configure per-request structured access logs with CEL-based filtering, field enrichment, and OTLP export.
---

Agentgateway writes a structured access log line to stdout for every request it processes. Access logs are separate from [debug/system logs]({{< link-hextra path="/operations/debug/#debug-logs" >}}), which control agentgateway's own operational output.

## Access log format

By default, access logs are written in a structured key=value format:

```
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

## View access logs in the UI

The agentgateway UI at [http://localhost:15000/ui](http://localhost:15000/ui) includes a **Logs** page that provides a richer view of access log data than stdout. For each request, the Logs page shows:

- **Trajectory**: The request path from the client through agentgateway to the upstream provider, including any policy callouts if policies are configured.
- **Conversation view**: For LLM traffic, the prompt and response are rendered as a readable conversation.
- **Usage**: Token counts, cost, latency, and other per-request metrics

To view access logs in the UI: 

1. Open the [agentgateway admin UI](http://localhost:15000/ui). 
2. Go to **Logs** and review the access logs that agentgateway captured for previous requests. Use the filter options to limit the number of access logs that are shown to you. For example, you can filter logs by model, providers, or users. Note that in order to filter logs by user, you must configure authentication in agentgateway. 
3. To access richer access logs for LLM and MCP-related requests, such as to see the full conversation with your LLM, model flow, and the tokens that were used, open the logs settings and toggle **Include prompts and completions in logs**. Then, repeat the request to your backend to view the additional data. The following example shows a conversation with an LLM provider. 
  
   {{< reuse-image src="img/main/agw-access-log.png" srcDark="img/main/agw-access-log-dark.png" >}}

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

## Export access logs over OTLP

Export access logs as OpenTelemetry `LogRecord` objects to any OTLP-compatible backend. Logs are exported in addition to stdout output.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    randomSampling: true
  accessLog:
    otlp:
      host: localhost:4317
```

### OTLP-only filtering

You can apply a separate filter to the data that is applied during the OTLP export. For example, you might want to log all requests to stdout, but only send errors to an external OTLP backend. 

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    otlp:
      host: localhost:4317
      filter: 'response.code >= 400'
      add:
        trace_id: 'request.headers["x-trace-id"]'
      remove:
        - 'response.headers["set-cookie"]'
```

## Store access logs in a database

For long-term storage and querying, agentgateway can write access logs to a database. See [Request logs]({{< link-hextra path="/integrations/observability/database/" >}}).
