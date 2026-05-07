---
title: Backend TLS
weight: 10
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/">}}

By default, requests to backends use HTTP.
To use HTTPS, configure a backend {{< gloss "TLS (Transport Layer Security)" >}}TLS{{< /gloss >}} policy.

```yaml
backendTLS:
  # A file containing the root certificate to verify.
  # If unset, the system trust bundle will be used.
  root: ./certs/root-cert.pem
  # For mutual TLS, the client certificate to use
  cert: ./certs/cert.pem
  # For mutual TLS, the client certificate key to use.
  key: ./certs/key.pem
  # Expected Subject Alternative Names (SANs) for certificate verification.
  # If set, the upstream certificate must contain at least one matching SAN.
  # subjectAltNames:
  # - "spiffe://cluster.local/ns/default/sa/my-service"
  # If set, hostname verification is disabled
  # insecureHost: true
  # If set, all TLS verification is disabled
  # insecure: true
```

## Subject Alternative Names

When connecting to upstream services over TLS, you can specify expected Subject Alternative Names (SANs) to verify. The upstream certificate must contain at least one SAN that matches the configured list.

By default, agentgateway uses the service hostname for verification (the Kubernetes service hostname or backend static hostname). You can override this by configuring the `subjectAltNames` field with specific values to match.

```yaml
backendTLS:
  subjectAltNames:
  - "my-upstream-service.example.com"
  - "another-valid-san.example.com"
```