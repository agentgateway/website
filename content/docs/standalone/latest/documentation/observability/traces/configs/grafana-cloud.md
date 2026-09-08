---
title: Grafana Cloud
weight: 50
description: Export agentgateway traces to Grafana Cloud by using its OTLP ingestion endpoint.
test: skip
---

[Grafana Cloud](https://grafana.com/products/cloud/) is a managed observability platform. You can send traces directly to your Grafana Cloud OTLP endpoint by setting a Base64-encoded `Authorization` header on every export request.

Find your OTLP endpoint and instance credentials in Grafana Cloud under **Connections** → **OpenTelemetry**.

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

Add the following tracing configuration to your `config.yaml`. Replace the `host` with your Grafana Cloud OTLP endpoint and the `Authorization` value with your Base64-encoded `instance-id:api-token`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: <your-grafana-otlp-endpoint>:443
    protocol: grpc
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: "Basic <base64-encoded-instance-id:api-token>"
```

{{% /tab %}}
{{% tab name="Kubernetes (Helm)" %}}

Add the following to your agentgateway `values.yaml`. Replace the `host` with your Grafana Cloud OTLP endpoint and the `Authorization` value with your Base64-encoded `instance-id:api-token`.

```yaml
config:
  frontendPolicies:
    tracing:
      host: <your-grafana-otlp-endpoint>:443
      protocol: grpc
      randomSampling: true
      policies:
        backendTLS: {}
        requestHeaderModifier:
          set:
            Authorization: "Basic <base64-encoded-instance-id:api-token>"
```

Apply the change with a Helm upgrade.

{{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

{{% /tab %}}
{{< /tabs >}}

> [!TIP]
> To generate the Base64-encoded token, run: `echo -n "<instance-id>:<api-token>" | base64`
