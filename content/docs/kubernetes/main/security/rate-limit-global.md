---
title: Global rate limiting
weight: 45
description: Apply distributed rate limits across multiple agentgateway replicas using an external rate limit service.
test:
  global-rate-limit-by-ip:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/security/rate-limit-global.md
    path: global-rate-limit-by-ip
---

{{< reuse "agw-docs/pages/security/rate-limit-global.md" >}}

## Compute a limit per request {#limit-override}

By default, a descriptor carries only the values that identify the caller, and the rate limit service decides which limit to apply. To let the request decide the limit instead, set `limitOverride` on the descriptor. Agentgateway evaluates the CEL expression for each request and forwards the result to the rate limit service, which applies it in place of the limit in its own configuration.

Use this field when the limit belongs to the caller rather than to the route, such as a per-tenant quota that arrives in a JWT claim or a header.

The expression must return an object with a `unit` and a `requestsPerUnit` field.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: tenant-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      global:
        backendRef:
          name: ratelimit
          namespace: ratelimit
          port: 8081
        domain: agentgateway
        descriptors:
        - entries:
          - name: tenant
            expression: 'request.headers["x-tenant-id"]'
          limitOverride: '{"unit": "minute", "requestsPerUnit": 5}'
EOF
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Required | Description |
|-------|----------|-------------|
| `descriptors[].limitOverride` | No | CEL expression that returns the limit to apply to this descriptor. The expression must evaluate to an object that has a `unit` field and a `requestsPerUnit` field, such as `{"unit": "minute", "requestsPerUnit": 5}`. Valid `unit` values are `second`, `minute`, `hour`, `day`, `month`, and `year`. |

The following example reads the limit from a JWT claim, so that each tenant carries its own quota.

```yaml
        descriptors:
        - entries:
          - name: tenant
            expression: jwt.tenant
          limitOverride: '{"unit": "minute", "requestsPerUnit": int(jwt.rate_limit)}'
```

> [!WARNING]
> Agentgateway validates the expression when you apply the policy, but it evaluates the expression for each request. If the expression fails at request time, such as when it reads a claim that a token omits, agentgateway skips the whole descriptor. The descriptor is not sent to the rate limit service, so no limit is enforced for that request. Guard a claim that might be absent with the `has()` function, and keep a descriptor that does not depend on a claim so that a request is still counted. For more information about the available variables, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}).

