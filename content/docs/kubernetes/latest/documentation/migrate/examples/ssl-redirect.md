---
title: "SSL Redirect"
description: Convert NGINX SSL redirect annotations to Gateway API HTTP redirect filters.
weight: 50
---

The `ssl-redirect` annotation tells NGINX to redirect HTTP to HTTPS. In Gateway API, this becomes a `RequestRedirect` filter on the HTTPRoute. The referenced TLS Secret must exist in the same namespace as the generated Gateway.

## Before: Ingress with SSL redirect

```bash
cat <<'EOF' > ssl-redirect-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ssl-redirect-demo
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - secure.example.com
    secretName: secure-example-tls
  rules:
  - host: secure.example.com
    http:
      paths:
      - backend:
          service:
            name: web-app
            port:
              number: 8080
        path: /
        pathType: Prefix
EOF
```

## Convert

```bash
ingress2gateway print --providers=ingress-nginx --emitter=agentgateway \
  --input-file ssl-redirect-ingress.yaml > ssl-redirect-agentgateway.yaml
```

## After: HTTPRoute(s) with redirect

```bash
cat ssl-redirect-agentgateway.yaml
```

In v0.5.0, the provider generates an HTTP redirect route with a `RequestRedirect` filter (308 to HTTPS) and no backends. A separate HTTPS route carries the backend traffic. Shown below is the HTTP redirect route:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: ssl-redirect-demo-secure-example-com-http
spec:
  hostnames:
  - secure.example.com
  parentRefs:
  - name: nginx
    port: 80
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    filters:
    - type: RequestRedirect
      requestRedirect:
        scheme: https
        statusCode: 308
```

> [!NOTE]
> The generated redirect preserves NGINX's default status code of 308.

## Apply

```bash
kubectl apply -f ssl-redirect-agentgateway.yaml
```
