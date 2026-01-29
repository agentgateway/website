---
title: "Rate Limiting"
weight: 30
---

NGINX's `limit-rps`, `limit-rpm`, and `limit-burst-multiplier` annotations are projected by the agentgateway emitter into an **AgentgatewayPolicy** with `spec.traffic.rateLimit.local` (requests, unit, and optional burst).

## Before: Ingress with rate limits

```bash
cat <<'EOF' > ratelimit-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ratelimit-demo
  annotations:
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "2"
spec:
  ingressClassName: agentgateway
  rules:
  - host: api.example.com
    http:
      paths:
      - backend:
          service:
            name: api-service
            port:
              number: 8080
        path: /
        pathType: Prefix
EOF
```

## Convert

```bash
ingress2gateway print --providers=ingress-nginx --emitter=agentgateway \
  --input-file ratelimit-ingress.yaml > ratelimit-agentgateway.yaml
```

## After: AgentgatewayPolicy with local rate limit

```bash
cat ratelimit-agentgateway.yaml
```

The generated **AgentgatewayPolicy** uses agentgateway's `LocalRateLimit` model. With 10 RPS and a 2x burst multiplier, you get `requests: 10`, `unit: Seconds`, and `burst: 20`:

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: ratelimit-demo
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: ratelimit-demo-api-example-com
  traffic:
    rateLimit:
      local:
      - requests: 10
        unit: Seconds
        burst: 20
```

## Apply

```bash
kubectl apply -f ratelimit-agentgateway.yaml
```
