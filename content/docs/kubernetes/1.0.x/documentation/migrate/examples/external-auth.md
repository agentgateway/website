---
title: "External Auth"
weight: 60
---

If you use NGINX's `auth-url` to call an in-cluster authentication service, the agentgateway emitter projects this into an **AgentgatewayPolicy** with `spec.traffic.extAuth`. Only in-cluster auth URLs that resolve to a Kubernetes Service (`*.svc`) are supported.

## Before: Ingress with external auth

```bash
cat <<'EOF' > external-auth-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ext-auth-demo
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://auth-service.auth.svc.cluster.local/verify"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-User-ID, X-User-Email"
spec:
  ingressClassName: agentgateway
  rules:
  - host: app.example.com
    http:
      paths:
      - backend:
          service:
            name: protected-app
            port:
              number: 8080
        path: /
        pathType: Prefix
EOF
```

## Convert

```bash
ingress2gateway print --providers=ingress-nginx --emitter=agentgateway \
  --input-file external-auth-ingress.yaml > external-auth-agentgateway.yaml
```

## After: AgentgatewayPolicy with ext auth

```bash
cat external-auth-agentgateway.yaml
```

The tool creates an **AgentgatewayPolicy** that configures the external auth service via `spec.traffic.extAuth`:

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: ext-auth-demo
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: ext-auth-demo-app-example-com
  traffic:
    extAuth:
      backendRef:
        name: auth-service
        namespace: auth
        port: 80
      http:
        path: '"/verify"'
        allowedResponseHeaders:
        - X-User-ID
        - X-User-Email
```

The `path` value is a CEL string literal (the inner quotes are part of the expression). If the auth URL path is `/` or empty, the emitter omits `http.path`.

## Apply

```bash
kubectl apply -f external-auth-agentgateway.yaml
```
