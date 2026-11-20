---
title: Example configs
weight: 30
description: Review example configurations for different agentgateway deployment scenarios.
---

{{< reuse "agw-docs/pages/setup/customize-examples.md" >}}

## Custom xDS request headers {#xds-headers}

The proxy reads its configuration from the control plane over xDS. To attach operator-defined headers to those outbound xDS requests, set one or more `XDS_HEADER_*` environment variables on the proxy. Use them when something between the proxy and the control plane routes on a header, such as a revision selector or a tenant identifier.

Agentgateway derives the header name from the part of the variable name after the `XDS_HEADER_` prefix, lowercased, with each underscore replaced by a hyphen. For example, `XDS_HEADER_X_ISTIO_REVISION` sends the `x-istio-revision` header.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  env:
    - name: XDS_HEADER_X_ISTIO_REVISION
      value: "canary"
    - name: XDS_HEADER_X_TENANT
      value: "team-a"
EOF
```

Agentgateway validates the headers when the proxy starts. A variable whose name or value cannot form a valid HTTP header stops startup with an error, rather than being dropped silently.

## Istio CA address defaults {#istio-ca-address}

When Istio integration is enabled, you can omit `spec.istio.caAddress` to let the control plane choose the Istio certificate authority (CA) endpoint. The control plane first uses the controller-wide `istio.caAddress` setting. If that setting is empty, the default revision uses `https://istiod.<istio namespace>.svc:15012`. A non-default `istio.revision` value changes the service name to `istiod-<revision>`.

For example, if `istio.revision` is `1-30` and the Istio namespace is omitted, the gateway uses `https://istiod-1-30.istio-system.svc:15012`. Set `spec.istio.caAddress` only when the gateway must use a different CA service name, namespace, scheme, or port.

