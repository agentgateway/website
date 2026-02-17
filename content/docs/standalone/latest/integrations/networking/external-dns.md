---
title: External DNS
weight: 20
description: Automatic DNS management for agentgateway
---

[External DNS](https://github.com/kubernetes-sigs/external-dns) automatically manages DNS records for Kubernetes resources. Use it to automatically create DNS records for agentgateway endpoints.

## Why use External DNS with agentgateway?

- **Automatic DNS** - DNS records created automatically from Gateway/Service resources
- **Multiple providers** - AWS Route53, Google Cloud DNS, Cloudflare, Azure DNS, and more
- **Sync on change** - Records updated when resources change
- **TTL management** - Configurable DNS TTL

## Before you begin

Install External DNS for your cloud provider. Example for AWS Route53:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: external-dns
spec:
  selector:
    matchLabels:
      app: external-dns
  template:
    metadata:
      labels:
        app: external-dns
    spec:
      serviceAccountName: external-dns
      containers:
      - name: external-dns
        image: registry.k8s.io/external-dns/external-dns:v0.14.0
        args:
        - --source=gateway-httproute
        - --provider=aws
        - --aws-zone-type=public
        - --registry=txt
        - --txt-owner-id=my-cluster
```

## Gateway API integration

External DNS can read hostnames from Gateway resources:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway
spec:
  gatewayClassName: agentgateway
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    hostname: "ai.example.com"  # External DNS creates this record
```

External DNS automatically:
1. Watches for Gateway resources
2. Extracts the hostname
3. Creates/updates DNS records pointing to the Gateway's external IP

## HTTPRoute hostnames

External DNS also reads hostnames from HTTPRoute:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: ai-api
  annotations:
    external-dns.alpha.kubernetes.io/hostname: api.example.com
spec:
  parentRefs:
  - name: agentgateway
  hostnames:
  - "api.example.com"
  rules:
  - backendRefs:
    - name: agentgateway
      port: 3000
```

## Annotations

Control External DNS behavior with annotations:

```yaml
metadata:
  annotations:
    # Set specific hostname
    external-dns.alpha.kubernetes.io/hostname: ai.example.com
    # Set TTL
    external-dns.alpha.kubernetes.io/ttl: "300"
    # Use specific target
    external-dns.alpha.kubernetes.io/target: 1.2.3.4
```

## Provider examples

### Cloudflare

```yaml
args:
- --source=gateway-httproute
- --provider=cloudflare
- --cloudflare-proxied  # Enable Cloudflare proxy
env:
- name: CF_API_TOKEN
  valueFrom:
    secretKeyRef:
      name: cloudflare-credentials
      key: api-token
```

### Google Cloud DNS

```yaml
args:
- --source=gateway-httproute
- --provider=google
- --google-project=my-project
```

### Azure DNS

```yaml
args:
- --source=gateway-httproute
- --provider=azure
- --azure-resource-group=my-rg
- --azure-subscription-id=my-sub-id
```

## Learn more

- [External DNS Documentation](https://github.com/kubernetes-sigs/external-dns)
- [cert-manager Integration](../../networking/cert-manager)
- [Kubernetes Deployment]({{< link-hextra path="/integrations/platforms/kubernetes" >}})
