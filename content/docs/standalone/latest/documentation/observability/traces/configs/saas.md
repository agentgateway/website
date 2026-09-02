---
title: SaaS platform
weight: 60
description: Export agentgateway traces to a cloud-hosted SaaS observability platform such as Langfuse over HTTPS.
---

Cloud-hosted observability platforms accept OTLP traces over HTTPS and authenticate requests with an `Authorization` header. The steps below use [Langfuse](https://langfuse.com/) as an example, but the same pattern applies to any OTLP-over-HTTP SaaS backend. Swap in your platform's endpoint and credentials.

> [!NOTE]
> For platforms that collect full prompt and response data (request/response logging, cost tracking, evals), see the [LLM Observability integrations]({{< link-hextra path="/integrations/llm/observability/" >}}) instead.

## Before you begin

Create a Langfuse account at [https://cloud.langfuse.com](https://cloud.langfuse.com) and create a project. In the dashboard, go to **Settings → API Keys** and create a key pair. Then base64-encode `<public-key>:<secret-key>`.

```sh
echo -n "<public-key>:<secret-key>" | base64
```

Keep the encoded string — you will use it as the `Authorization` header value.

## Configure tracing

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

Add the following tracing configuration to your `config.yaml`. Replace `<base64-encoded-credentials>` with the string you generated above.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: us.cloud.langfuse.com:443
    protocol: http/protobuf
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: "Basic <base64-encoded-credentials>"
```

Use `eu.cloud.langfuse.com` if your project is in the EU region.

{{% /tab %}}
{{% tab name="Kubernetes (Helm)" %}}

Add the following to your agentgateway `values.yaml`. Replace `<base64-encoded-credentials>` with the string you generated above.

```yaml
config:
  frontendPolicies:
    tracing:
      host: us.cloud.langfuse.com:443
      protocol: http/protobuf
      randomSampling: true
      policies:
        backendTLS: {}
        requestHeaderModifier:
          set:
            Authorization: "Basic <base64-encoded-credentials>"
```

Apply the change with a Helm upgrade.

{{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

{{% /tab %}}
{{< /tabs >}}

## Verify

Send a request through agentgateway and then check **Traces** in the Langfuse dashboard. Traces typically appear within a few seconds.

## Other SaaS backends

The same pattern works for other OTLP-over-HTTPS backends — adjust `host`, `protocol`, and the auth header to match your platform.

| Platform | Host | Protocol | Auth header |
|----------|------|----------|-------------|
| Langfuse (US) | `us.cloud.langfuse.com:443` | `http/protobuf` | `Authorization: Basic <base64>` |
| Langfuse (EU) | `eu.cloud.langfuse.com:443` | `http/protobuf` | `Authorization: Basic <base64>` |
| Grafana Cloud Tempo | `<your-instance>.grafana.net:443` | `http/protobuf` | `Authorization: Basic <base64>` |
