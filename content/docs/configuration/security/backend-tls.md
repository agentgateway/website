---
title: Backend TLS
weight: 10
---

By default, requests to backends will use HTTP.
To use HTTPS, a backend TLS policy can be configured.

**[Supported attachment points](/docs/configuration/policies/):** Backend.

```yaml
backendTLS:
  # A file containing the root certificate to verify.
  # If unset, the system trust bundle will be used.
  root: ./certs/root-cert.pem
  # For mutual TLS, the client certificate to use
  cert: ./certs/cert.pem
  # For mutual TLS, the client certificate key to use.
  key: ./certs/key.pem
  # If set, hostname verification is disabled
  # insecureHost: true
  # If set, all TLS verification is disabled
  # insecure: true
```