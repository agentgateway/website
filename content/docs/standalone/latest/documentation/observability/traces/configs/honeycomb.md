---
title: Honeycomb
weight: 40
description: Export agentgateway traces to Honeycomb by using its OTLP ingestion endpoint.
test: skip
---

[Honeycomb](https://www.honeycomb.io/) is an observability platform. You can send traces directly to Honeycomb by setting your API key as a header on every export request.

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

Add the following tracing configuration to your `config.yaml`. Replace `<your-honeycomb-api-key>` with your Honeycomb API key.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: api.honeycomb.io:443
    protocol: grpc
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          x-honeycomb-team: "<your-honeycomb-api-key>"
```

{{% /tab %}}
{{% tab name="Kubernetes (Helm)" %}}

Add the following to your agentgateway `values.yaml`. Replace `<your-honeycomb-api-key>` with your Honeycomb API key.

```yaml
config:
  frontendPolicies:
    tracing:
      host: api.honeycomb.io:443
      protocol: grpc
      randomSampling: true
      policies:
        backendTLS: {}
        requestHeaderModifier:
          set:
            x-honeycomb-team: "<your-honeycomb-api-key>"
```

Apply the change with a Helm upgrade.

{{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

{{% /tab %}}
{{< /tabs >}}

> [!NOTE]
> To send traces to a specific Honeycomb dataset, add an `x-honeycomb-dataset` header alongside `x-honeycomb-team`.
