---
title: Braintrust
weight: 25
description: Export agentgateway LLM traces to Braintrust over OTLP/HTTP.
---

[Braintrust](https://www.braintrust.dev/) is an LLM observability and evaluation platform that accepts OpenTelemetry traces. Agentgateway can export LLM traces directly to Braintrust over OTLP/HTTP, including model, token usage, latency, and optional prompt and response content.

## Before you begin

1. [Complete the LLM quickstart]({{< link-hextra path="/quickstart/llm/" >}}).
2. Create a Braintrust account and a project for agentgateway traces.
3. Create a Braintrust API key that can write to the project.
4. Install `curl` for the verification step.

## Prepare Braintrust credentials

1. Open the [Braintrust dashboard](https://www.braintrust.dev/app/~/logs), create or select a project, and copy its project ID or exact project name.
2. Create an API key from the Braintrust organization settings. Keep the key private and grant only the access needed to write traces.
3. Set the credentials in the shell that starts agentgateway. Do not commit them to the configuration file or source control.

   ```sh
   export BRAINTRUST_API_KEY="<your-api-key>"
   export BRAINTRUST_PARENT="project_name:<your-project-name>"
   ```

   Use `project_id:<your-project-id>` instead when you prefer to address the project by ID. The `x-bt-parent` header determines where Braintrust stores the trace.

## Choose a Braintrust data plane

Use the API URL for your Braintrust organization. The path in the agentgateway configuration is the OTLP trace endpoint.

| Data plane | API host | OTLP trace path |
|------------|----------|-----------------|
| US hosted | `api.braintrust.dev:443` | `/otel/v1/traces` |
| EU hosted | `api-eu.braintrust.dev:443` | `/otel/v1/traces` |
| Self-hosted | Your Braintrust API host | `/otel/v1/traces` |

For a self-hosted deployment, replace the host with the Universal API URL for that data plane. Braintrust's base OTLP endpoint is `/otel`; agentgateway uses the signal-specific `/otel/v1/traces` path below.

## Configure trace export

Add a tracing policy to the agentgateway configuration. Braintrust accepts OTLP/HTTP and requires TLS, a bearer token, and an `x-bt-parent` header.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: api.braintrust.dev:443
    protocol: http
    path: /otel/v1/traces
    randomSampling: true
    clientSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: "Bearer ${BRAINTRUST_API_KEY}"
          x-bt-parent: "${BRAINTRUST_PARENT}"
    resources:
      service.name: '"agentgateway"'
```

Replace `host` with `api-eu.braintrust.dev:443` for the EU data plane, or with your self-hosted API host. The values under `resources` are CEL expressions; the authentication headers are regular header values expanded from the process environment.

Agentgateway emits standard `gen_ai.*` span attributes for LLM operation, provider, model, and token usage. Braintrust maps these attributes to the corresponding fields in a trace.

### Capture prompt and response content

Prompt and response bodies can contain sensitive data. Add these attributes only when your data handling policy allows Braintrust to store message content.

```yaml
frontendPolicies:
  tracing:
    attributes:
      llm.input_messages: >-
        flattenRecursive(llm.prompt.map(c, {"message": c}))
      llm.output_messages: >-
        flattenRecursive(llm.completion.map(c, {
          "role": "assistant",
          "content": c
        }))
```

Referencing `llm.prompt` or `llm.completion` makes agentgateway inspect request and response bodies. Omit this block when you need metadata and token counts without message content.

## Run agentgateway with the configuration

Start agentgateway with the updated file. For Docker, pass the credentials into the container without writing them into the image.

```sh
agentgateway -f config.yaml
```

```sh
docker run --rm \
  -p 4000:4000 \
  -v "$PWD/config.yaml:/config.yaml:ro" \
  -e BRAINTRUST_API_KEY \
  -e BRAINTRUST_PARENT \
  {{< reuse "agw-docs/standalone/image-ref.md" >}}:latest \
  -f /config.yaml
```

## Verify the integration

1. Send a request through the LLM listener. The example assumes an OpenAI-compatible provider and a listener on port `4000`.

   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {"role": "user", "content": "Reply with exactly: Braintrust tracing works"}
       ]
     }'
   ```

2. Copy the `trace.id` value from the agentgateway request log. A successful LLM request includes `http.status=200`, `protocol=llm`, and a `trace.id`.

3. Open the [Braintrust Logs view](https://www.braintrust.dev/app/~/logs), select the project named by `BRAINTRUST_PARENT`, and wait a few seconds for batched export.

4. Open the new root trace and verify the model, provider, token usage, latency, and the trace ID. If you enabled the optional attributes, verify that the input and output messages appear in the structured input and output fields.

Braintrust's Logs view shows root spans. Export the root span for each request; sending only child spans does not create a row in the Logs view.

## Troubleshoot trace export

- A `403` response usually means the API key cannot write to the project selected by `x-bt-parent`. Check the key scope and the exact project name or ID.
- If no traces appear, confirm that the API host matches your organization's data plane and that `path` is `/otel/v1/traces`.
- Set `randomSampling: true` while testing. The default is to start no new traces when the request has no incoming trace context.
- Keep prompt and response attributes disabled when the request body contains data that should not leave the proxy.
- Braintrust limits a single OTLP trace request to 10 MB. The tracing policy has no batch size setting, so if the exporter reports HTTP `413`, drop the message content attributes or lower `randomSampling` so that fewer spans are exported.

For more information, see the [Braintrust OpenTelemetry integration](https://www.braintrust.dev/docs/integrations/sdk-integrations/opentelemetry) and [OpenTelemetry trace setup]({{< link-hextra path="/observability/traces/setup/" >}}).
