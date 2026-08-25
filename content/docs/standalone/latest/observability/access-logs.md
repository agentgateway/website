---
title: Access logs
weight: 30
description: Configure per-request structured access logs with CEL-based filtering, field enrichment, and OTLP export.
---

Agentgateway writes a structured access log line to stdout for every request it processes. Access logs are separate from [debug/system logs]({{< link-hextra path="/operations/debug/#debug-logs" >}}), which control agentgateway's own operational output.

## Default log format

By default, access logs are written in a structured key=value format:

```
2025-12-12T21:56:02.809082Z	info	request gateway=agentgateway listener=http route=openai endpoint=api.openai.com:443
src.addr=127.0.0.1:60862 http.method=POST http.host=localhost http.path=/openai http.version=HTTP/1.1
http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai
gen_ai.request.model=gpt-4o gen_ai.response.model=gpt-4o-2024-08-06
gen_ai.usage.input_tokens=68 gen_ai.usage.output_tokens=298 duration=2488ms
```

For LLM traffic, the log line automatically includes `gen_ai.*` fields. For MCP traffic, it includes `mcp.*` fields.

Switch to JSON format by setting `config.logging.format`:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  logging:
    format: json
```

## Configure access log content

Use `frontendPolicies.accessLog` to filter, add, or remove fields from access log lines.

### Filter which requests are logged

Use a [CEL]({{< link-hextra path="/reference/cel/" >}}) expression to log only a subset of requests. Requests that do not match the expression are not logged.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: 'response.code >= 400'
```

### Add custom fields

Add fields to every log line using CEL expressions evaluated against the request and response context:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      user_id: 'request.headers["x-user-id"]'
      env: '"production"'
      cost: 'string(llm.cost)'
```

See the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}) for the full list of available fields, including `llm.*`, `mcp.*`, and `jwt.*` context.

### Remove fields

Remove fields from log lines — for example, to redact sensitive headers:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    remove:
      - 'request.headers["authorization"]'
      - 'request.headers["x-api-key"]'
```

### Combining filter, add, and remove

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    filter: 'response.code != 200 || llm.inputTokens > 1000'
    add:
      user_id: 'request.headers["x-user-id"]'
    remove:
      - 'request.headers["authorization"]'
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

For long-term storage and querying, agentgateway can write access logs to a database. See [Database access logs]({{< link-hextra path="/integrations/observability/database/" >}}).

## Learn more

{{< cards >}}
  {{< card path="/observability/traces/" title="Traces" subtitle="Correlate access logs with distributed traces" >}}
  {{< card path="/reference/cel/variables/" title="CEL variables" subtitle="Full list of fields available in CEL expressions" >}}
  {{< card path="/integrations/observability/database/" title="Database access logs" subtitle="Store access logs in a database for long-term querying" >}}
{{< /cards >}}
