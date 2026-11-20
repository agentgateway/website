---
title: "Backend TLS"
description: Migrate NGINX backend TLS annotations to agentgateway backend TLS policies.
weight: 80
---

When your backend requires TLS (re-encryption or mTLS), the agentgateway emitter translates NGINX `proxy-ssl-*` annotations into two policies that target the backend Service: an **AgentgatewayPolicy** with `spec.backend.tls`, and a Gateway API **BackendTLSPolicy** with the same name.

## Before: Ingress with backend TLS

```bash
cat <<'EOF' > backend-tls-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: backend-tls-demo
  namespace: default
  annotations:
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
    nginx.ingress.kubernetes.io/proxy-ssl-secret: "default/backend-tls-secret"
    nginx.ingress.kubernetes.io/proxy-ssl-verify: "on"
    nginx.ingress.kubernetes.io/proxy-ssl-name: "internal-api.example.com"
    nginx.ingress.kubernetes.io/proxy-ssl-server-name: "on"
spec:
  ingressClassName: nginx
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

## After: BackendTLSPolicy and AgentgatewayPolicy

```bash
cat backend-tls-agentgateway.yaml
```

The tool generates a Gateway, an HTTPRoute, a Gateway API `BackendTLSPolicy`, and an **AgentgatewayPolicy**. Both policies are named `<service-name>-backend-tls`.

The `BackendTLSPolicy` sets `spec.validation.caCertificateRefs` to a ConfigMap with the same name as the secret. The command prints a warning that the `BackendTLSPolicy` cannot configure mTLS and only verifies the server CA. It also prints a notice that you must create that ConfigMap in the same namespace with the CA certificate under the key `ca.crt`. Creating the ConfigMap enables that server CA verification. It does not enable mTLS.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: BackendTLSPolicy
metadata:
  name: secure-api-backend-tls
  namespace: default
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: secure-api
  validation:
    caCertificateRefs:
    - group: ""
      kind: ConfigMap
      name: backend-tls-secret
    hostname: internal-api.example.com
```

The AgentgatewayPolicy sets `mtlsCertificateRef` to the secret name. With verification enabled (`proxy-ssl-verify: "on"`), it does not set `insecureSkipVerify`:

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

agentgateway reads `tls.crt` and `tls.key` from that Secret and presents them as the client certificate. The AgentgatewayPolicy supplies that client certificate. The ConfigMap supplies the server CA for the BackendTLSPolicy.

To use the AgentgatewayPolicy as the only TLS configuration for the Service, delete the generated BackendTLSPolicy. The [Backend TLS]({{< link-hextra path="/documentation/security/backendtls/#secret-ca" >}}) guide uses the same step when an AgentgatewayPolicy supplies the TLS settings. Until the ConfigMap exists, the BackendTLSPolicy cannot resolve its CA reference.

If you set `proxy-ssl-verify: "off"`, the emitter sets `spec.backend.tls.insecureSkipVerify: All` on the AgentgatewayPolicy.

## Apply

```bash
kubectl apply -f backend-tls-agentgateway.yaml
```
