---
title: "Backend TLS"
weight: 80
---

When your backend requires TLS (re-encryption or mTLS), NGINX's `proxy-ssl-*` annotations are translated by the agentgateway emitter into an **AgentgatewayPolicy** with `spec.backend.tls` settings. The policy targets the backend Service.

## Before: Ingress with backend TLS

```bash
cat <<'EOF' > backend-tls-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: backend-tls-demo
  annotations:
    nginx.ingress.kubernetes.io/proxy-ssl-secret: "default/backend-tls-secret"
    nginx.ingress.kubernetes.io/proxy-ssl-verify: "on"
    nginx.ingress.kubernetes.io/proxy-ssl-name: "internal-api.example.com"
spec:
  ingressClassName: agentgateway
  rules:
  - host: app.example.com
    http:
      paths:
      - backend:
          service:
            name: secure-api
            port:
              number: 443
        path: /api
        pathType: Prefix
EOF
```

## Convert

```bash
ingress2gateway print --providers=ingress-nginx --emitter=agentgateway \
  --input-file backend-tls-ingress.yaml > backend-tls-agentgateway.yaml
```

## After: AgentgatewayPolicy with backend TLS

```bash
cat backend-tls-agentgateway.yaml
```

The tool generates a Gateway, HTTPRoute(s), and an **AgentgatewayPolicy** per backend Service. The policy name is `<service-name>-backend-tls`. With verification enabled (`proxy-ssl-verify: "on"`), the emitter configures mTLS via `mtlsCertificateRef` and does not set `insecureSkipVerify`:

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: secure-api-backend-tls
  namespace: default
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: secure-api
  backend:
    tls:
      mtlsCertificateRef:
      - name: backend-tls-secret
      sni: internal-api.example.com
```

If you set `proxy-ssl-verify: "off"`, the emitter would set `spec.backend.tls.insecureSkipVerify: All` instead of mTLS.

## Apply

```bash
kubectl apply -f backend-tls-agentgateway.yaml
```
