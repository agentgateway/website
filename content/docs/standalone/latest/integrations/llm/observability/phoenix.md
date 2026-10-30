---
title: Arize Phoenix
weight: 30
description: Integrate agentgateway with Arize Phoenix for LLM tracing and evaluation
---

[Arize Phoenix](https://arize.com/phoenix/) is an open-source LLM observability platform for tracing, evaluation, and debugging.

## Features

- **LLM tracing** - Trace all LLM calls with full context
- **Evaluation** - Built-in LLM evaluators for quality assessment
- **Embedding analysis** - Visualize and debug embeddings
- **Dataset management** - Create and manage evaluation datasets
- **Open source** - Self-host or use Arize cloud

## Quick start

Phoenix 21.0 and later turn on authentication by default, and then reject traces that do not carry an API key. The following local quick start turns authentication off with the `PHOENIX_ENABLE_AUTH=false` environment variable, so you can try the integration without an API key. For a shared or production Phoenix, keep authentication on and [send an API key with your traces](#authentication).

Run Phoenix locally:

```bash
pip install arize-phoenix
PHOENIX_ENABLE_AUTH=false phoenix serve
```

Or with Docker. Publish port 4317 too, because agentgateway sends traces to Phoenix's gRPC port.

```bash
docker run -e PHOENIX_ENABLE_AUTH=false -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:latest
```

Access Phoenix at [http://localhost:6006](http://localhost:6006).

## Configuration

Phoenix accepts OpenTelemetry traces natively on port 4317 (gRPC) and port 6006 (HTTP), so agentgateway can export traces directly to Phoenix without an intermediate OpenTelemetry Collector.

Configure agentgateway to send traces directly to Phoenix.

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
   1. **Host**: Keep `localhost:4317`.
   2. **Protocol**: Keep **gRPC**. The UI does not write the default `protocol: grpc` value to your configuration.
   3. **Random sampling**: Enter `true`.

   {{< reuse-image src="img/ui-tracing-enable.png" srcDark="img/ui-tracing-enable-dark.png" alt="Tracing drawer scrolled to the export and sampling settings, with the gRPC protocol, random sampling enabled, and the default localhost:4317 host" >}}

4. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: localhost:4317
    protocol: grpc
    randomSampling: true
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

## Send traces with an API key {#authentication}

If your Phoenix keeps authentication on, agentgateway must send a Phoenix API key with every trace export. Otherwise, Phoenix rejects the traces.

1. Start Phoenix. Phoenix 21.0 and later turn on authentication by default, so you do not need extra settings.
   ```bash
   docker run -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:latest
   ```
2. Open Phoenix at [http://localhost:6006](http://localhost:6006), and log in as the default admin, `admin@localhost` with the password `admin`. Phoenix asks you to change the password on first login.
3. Go to **Settings** > **API Keys**, and create a key in the **System API Keys** section. A system key belongs to Phoenix instead of a user account, so it keeps working if that user leaves.
4. Save the key in an environment variable.
   ```sh
   export PHOENIX_API_KEY=<your-api-key>
   ```
5. Add the key to the tracing policy with `backendAuth`. Agentgateway sends the key in the `Authorization: Bearer <key>` header, which is the header that Phoenix checks.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     tracing:
       host: localhost:4317
       protocol: grpc
       randomSampling: true
       policies:
         backendAuth:
           key: "$PHOENIX_API_KEY"
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
6. Start agentgateway with the updated configuration, and send a request through it. The trace appears in the `default` project in Phoenix. If the key is missing or wrong, Phoenix rejects the export, and the agentgateway logs show a `BatchSpanProcessor.ExportError` error.

## Docker Compose example

Agentgateway exports traces directly to Phoenix without needing an OTel Collector:

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

  phoenix:
    image: arizephoenix/phoenix:latest
    environment:
      - PHOENIX_ENABLE_AUTH=false
    ports:
      - "6006:6006"
      - "4317:4317"
```

When using Docker Compose, update your config.yaml to use the Phoenix service name:

```yaml
frontendPolicies:
  tracing:
    host: phoenix:4317
    protocol: grpc
    randomSampling: true
```

## Learn more

- [Phoenix Documentation](https://arize.com/docs/phoenix)
- [OpenTelemetry Integration]({{< link-hextra path="/documentation/observability/traces/setup/" >}})
