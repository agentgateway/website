---
title: Datadog
weight: 30
description: Export agentgateway traces to Datadog by using the Datadog OTLP ingestion endpoint.
test: skip
---

[Datadog](https://www.datadoghq.com/) is a cloud-based observability platform. You can send traces directly to the Datadog OTLP ingestion endpoint by setting a `DD-API-KEY` header on every export request.

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

Add the following tracing configuration to your `config.yaml`. Replace `<your-datadog-api-key>` with your Datadog API key and adjust the `host` to match your Datadog region if needed.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: otlp.datadoghq.com:443
    protocol: grpc
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          DD-API-KEY: "<your-datadog-api-key>"
```

{{% /tab %}}
{{% tab name="Kubernetes (Helm)" %}}

Add the following to your agentgateway `values.yaml`. Replace `<your-datadog-api-key>` with your Datadog API key and adjust the `host` to match your Datadog region if needed.

```yaml
config:
  frontendPolicies:
    tracing:
      host: otlp.datadoghq.com:443
      protocol: grpc
      randomSampling: true
      policies:
        backendTLS: {}
        requestHeaderModifier:
          set:
            DD-API-KEY: "<your-datadog-api-key>"
```

Apply the change with a Helm upgrade.

{{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

{{% /tab %}}
{{< /tabs >}}

> [!NOTE]
> For the EU region, use `otlp.datadoghq.eu:443` instead.
