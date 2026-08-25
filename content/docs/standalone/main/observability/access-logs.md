---
title: Access logs
weight: 30
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

## Configure access log content

Use the `frontendPolicies.accessLog` section to filter, add, or remove fields from the access log. You can combine any of these settings to configure your access log content. 

### Filter which requests are logged

Use a [CEL]({{< link-hextra path="/reference/cel/" >}}) expression to log only a subset of requests. Requests that do not match the expression are not logged. The following example produces access logs only for requests with a response code of 400 or greater.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: 'response.code >= 400'
```

### Add custom fields

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

### Remove fields

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

You can apply a separate filter specifically for OTLP export — for example, to send only errors to an external backend while still logging everything to stdout:

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
