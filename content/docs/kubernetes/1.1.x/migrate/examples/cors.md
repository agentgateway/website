---
title: "CORS"
weight: 40
---

CORS annotations on an Ingress are projected by the agentgateway emitter into an **AgentgatewayPolicy** with `spec.traffic.cors` settings. The policy targets the generated HTTPRoute.

## Before: Ingress with CORS

```bash
cat <<'EOF' > cors-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cors-demo
  annotations:
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://example.com, https://app.example.com"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Authorization, Content-Type"
    nginx.ingress.kubernetes.io/cors-max-age: "3600"
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
  --input-file cors-ingress.yaml > cors-agentgateway.yaml
```

## After: AgentgatewayPolicy with CORS

```bash
cat cors-agentgateway.yaml
```

The tool generates a Gateway, HTTPRoute(s), and an **AgentgatewayPolicy** named after the Ingress. CORS is under `spec.traffic.cors`:

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: cors-demo
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: cors-demo-api-example-com
  traffic:
    cors:
      allowOrigins:
      - https://example.com
      - https://app.example.com
      allowMethods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
      allowHeaders:
      - Authorization
      - Content-Type
      maxAge: 3600
```

## Apply

```bash
kubectl apply -f cors-agentgateway.yaml
```
