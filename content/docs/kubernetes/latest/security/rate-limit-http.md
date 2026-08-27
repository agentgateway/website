---
title: Local rate limiting
weight: 40
description: Apply local and global rate limits to HTTP traffic to protect your backend services from overload.
test:
  local-rate-limit:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/security/rate-limit-http.md
    path: local-rate-limit
---

{{< reuse "agw-docs/pages/security/rate-limit-http.md" >}}

## Apply more than one local limit {#multiple-local}

The `local` field takes a list, so one policy can carry several limits. Every entry in the list is enforced, and a request is rejected with a `429` response as soon as any one of them is exhausted.

Use more than one entry to combine a short window that absorbs a burst with a long window that caps sustained volume.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: httpbin-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      local:
      # Short window: smooth out bursts
      - requests: 10
        unit: Seconds
        burst: 5
      # Long window: cap sustained volume
      - requests: 100
        unit: Minutes
EOF
```

In this example, a client can send 10 requests per second, and no more than 100 requests per minute. A client that sends 10 requests per second continuously is rejected once it reaches 100 requests in the minute, even though it never exceeds the per-second limit.

> [!IMPORTANT]
> In version 1.4 and earlier, the Kubernetes controller sent only the first entry of the list to the proxy, so a second and later entry was accepted but never enforced. Version 1.5 enforces every entry. If you already have a policy with more than one entry, review it before you upgrade, because a limit that had no effect starts rejecting traffic. Standalone mode enforced every entry in earlier versions as well.

Each entry is independent, and each keeps its own counter. Local rate limits run per proxy replica, so the effective limit across a deployment is the configured limit multiplied by the replica count. To share counters across replicas, use [global rate limiting]({{< link-hextra path="/security/rate-limit-global/" >}}) instead.

