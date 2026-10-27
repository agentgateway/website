---
title: Langfuse
weight: 10
description: Integrate agentgateway with Langfuse for LLM analytics and prompt management
---

[Langfuse](https://langfuse.com/) is an open-source LLM observability platform that provides prompt management, analytics, and evaluation.

## Features

- **Prompt tracing** - Log all prompts and responses
- **Cost tracking** - Monitor token usage and costs
- **Latency analytics** - Track response times
- **Prompt management** - Version and deploy prompts
- **Evaluation** - Score and evaluate outputs
- **User tracking** - Attribute usage to users

## Setup

### Self-hosted Langfuse

Run Langfuse locally with Docker:

```bash
git clone https://github.com/langfuse/langfuse.git
cd langfuse
docker compose up -d
```

Access Langfuse at [http://localhost:3000](http://localhost:3000).

### Cloud Langfuse

Sign up at [langfuse.com](https://langfuse.com/) and get your API keys.

## Configuration

Langfuse accepts OpenTelemetry traces directly. Configure agentgateway to export traces directly to your Langfuse deployment.

Set the credentials that the tracing policy sends in its `Authorization` header. Export the variable in the environment that starts agentgateway. In `file` storage mode, the UI checks environment variable references when you save, so a save from the UI fails if agentgateway does not have the variable.

```bash
export LANGFUSE_AUTH_HEADER="$(printf '%s' '<your-public-key>:<your-secret-key>' | base64 | tr -d '\n')"
```

You can configure tracing in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).

1. Create a configuration that routes LLM traffic, and start agentgateway.
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
2. Open the **Settings** > **Observability** page, such as [http://localhost:15000/ui/settings/observability](http://localhost:15000/ui/settings/observability), and click the **Tracing** card.
3. In the **Tracing** drawer, configure the following fields.
   1. **Host**: Enter `cloud.langfuse.com:443`. For a self-hosted instance, enter your Langfuse hostname and port.
   2. **Backend policies**: Enter the following YAML to enable TLS and set the authentication header.
      ```yaml
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: "Basic ${LANGFUSE_AUTH_HEADER}"
      ```
      In `hybrid` storage mode, agentgateway stores the policies exactly as you enter them and does not expand environment variable references. If you enter the reference, agentgateway sends the literal text `Basic ${LANGFUSE_AUTH_HEADER}` to Langfuse. Enter the encoded credentials in place of the reference, such as the output of `echo "$LANGFUSE_AUTH_HEADER"`, or configure tracing in your configuration file as shown in the **Config file** tab.
   3. **Protocol**: Select **HTTP**, and enter `/api/public/otel/v1/traces` for the **Path**.
   4. **Random sampling**: Enter `true`.

   {{< reuse-image src="img/ui-tracing-langfuse.png" srcDark="img/ui-tracing-langfuse-dark.png" alt="Tracing drawer with the host cloud.langfuse.com:443, backend policies that set backendTLS and an Authorization header, the HTTP protocol, and the Langfuse traces path" >}}

4. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: cloud.langfuse.com:443
    protocol: http
    path: /api/public/otel/v1/traces
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: "Basic ${LANGFUSE_AUTH_HEADER}"
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

The tracing policy sends the `LANGFUSE_AUTH_HEADER` credentials in its `Authorization` header. The policy selects OTLP over HTTP, enables backend TLS, and uses the full trace ingestion path from the [Langfuse OpenTelemetry guide](https://langfuse.com/integrations/native/opentelemetry).

For a self-hosted instance, replace `host` with your Langfuse hostname and port, and keep the `/api/public/otel/v1/traces` path and authentication header. Remove `backendTLS` only if the destination serves plain HTTP.

## Docker Compose example

For **Langfuse Cloud**, agentgateway exports traces directly without needing an OTel Collector:

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
      - LANGFUSE_AUTH_HEADER=${LANGFUSE_AUTH_HEADER}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

For self-hosted Langfuse, use your existing instance and ensure that the agentgateway container can reach its hostname.

## Learn more

- [Langfuse Documentation](https://langfuse.com/docs)
- [OpenTelemetry Integration]({{< link-hextra path="/documentation/observability/traces/setup/" >}})
