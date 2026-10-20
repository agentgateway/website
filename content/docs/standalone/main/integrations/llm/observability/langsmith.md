---
title: LangSmith
weight: 20
description: Integrate agentgateway with LangSmith for LLM debugging and monitoring
---

[LangSmith](https://smith.langchain.com/) is LangChain's platform for debugging, testing, evaluating, and monitoring LLM applications.

## Features

- **Trace logging** - Detailed request/response logging
- **Debugging** - Step-through debugging of LLM calls
- **Evaluation** - Automated testing and evaluation
- **Monitoring** - Production monitoring and alerting
- **Datasets** - Build and manage evaluation datasets

## Setup

1. Sign up at [smith.langchain.com](https://smith.langchain.com/)
2. Create a project and get your API key

## Configuration

LangSmith accepts OpenTelemetry traces directly. Configure agentgateway to export traces directly to LangSmith.

You can configure tracing in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).

1. Set the API key that the tracing policy sends in the `x-api-key` header. Export the variable in the environment that starts agentgateway. The UI checks environment variable references when you save, so the save fails if agentgateway does not have the variable.
   ```bash
   export LANGSMITH_API_KEY="<your-langsmith-api-key>"
   ```
2. Create a configuration that routes LLM traffic, and start agentgateway.
   ```yaml
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - ai:
         name: openai
         provider:
           openAI:
             model: gpt-4o-mini
     policies:
       backendAuth:
         key: "$OPENAI_API_KEY"
   EOF
   ```
   ```sh
   agentgateway -f config.yaml
   ```
3. Open the **Settings** > **Observability** page, such as [http://localhost:15000/ui/settings/observability](http://localhost:15000/ui/settings/observability), and click the **Tracing** card.
4. In the **Tracing** drawer, configure the following fields.
   1. **Host**: Enter `api.smith.langchain.com:443`.
   2. **Backend policies**: Enter the following YAML to enable TLS and set the API key header.
      ```yaml
      backendTLS: {}
      requestHeaderModifier:
        set:
          x-api-key: "${LANGSMITH_API_KEY}"
      ```
   3. **Protocol**: Select **HTTP**, and enter `/otel/v1/traces` for the **Path**.
   4. **Random sampling**: Enter `true`.
5. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: api.smith.langchain.com:443
    protocol: http
    path: /otel/v1/traces
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          x-api-key: "${LANGSMITH_API_KEY}"
gateways:
  default:
    port: 3000
routes:
- backends:
  - ai:
      name: openai
      provider:
        openAI:
          model: gpt-4o-mini
  policies:
    backendAuth:
      key: "$OPENAI_API_KEY"
```
{{% /tab %}}
{{< /tabs >}}

### Authentication

Set the API key that the tracing policy sends in the `x-api-key` header. The policy selects OTLP over HTTP, enables backend TLS, and uses the full trace ingestion path from the [LangSmith OpenTelemetry guide](https://docs.langchain.com/langsmith/trace-with-opentelemetry).

```bash
export LANGSMITH_API_KEY="<your-langsmith-api-key>"
```

## Docker Compose example

Agentgateway exports traces directly to LangSmith without needing an OTel Collector:

```yaml
version: '3'
services:
  agentgateway:
    image: {{< reuse "agw-docs/standalone/image-ref.md" >}}:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/config.yaml:ro
    command: ["-f", "/config.yaml"]
    environment:
      - LANGSMITH_API_KEY=${LANGSMITH_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

## Learn more

- [LangSmith Documentation](https://docs.langchain.com/langsmith/observability)
- [OpenTelemetry Integration]({{< link-hextra path="/documentation/observability/traces/setup/" >}})
