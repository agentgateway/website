---
title: Honeycomb
weight: 40
description: Export agentgateway traces to Honeycomb by using its OTLP ingestion endpoint.
---

[Honeycomb](https://www.honeycomb.io/) is an observability platform. You can send traces directly to Honeycomb by setting your API key as a header on every export request.

For traces, access logs, metrics, and verification, use the [Honeycomb observability guide]({{< link-hextra path="/integrations/llm/observability/honeycomb/" >}}). The sample below exports traces only.

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

Add the following tracing configuration to your `config.yaml`. Replace `<your-honeycomb-api-key>` with your Honeycomb API key.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
frontendPolicies:
  tracing:
    host: api.honeycomb.io:443
    protocol: grpc
    randomSampling: true
    resources:
      service.name: '"agentgateway"'
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
      resources:
        service.name: '"agentgateway"'
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
> Current Honeycomb Environments name the trace dataset from the `service.name` resource attribute. This sample sets it to `agentgateway`. Add an `x-honeycomb-dataset` header beside `x-honeycomb-team` when your team uses Honeycomb Classic, which selects the dataset from that header. Use an [Ingest key](https://docs.honeycomb.io/configure/environments/manage-api-keys/) as `x-honeycomb-team`. The UI returns the complete key value, which is the Key ID and secret concatenated with no separator.
