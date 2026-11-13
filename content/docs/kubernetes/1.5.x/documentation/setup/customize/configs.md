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

