---
title: Authentication & identity
weight: 10
description: Integrate agentgateway with identity providers and authentication systems
test: skip
---

Agentgateway supports multiple authentication methods and integrates with popular identity providers.

## Authentication methods

Agentgateway supports several authentication approaches.

| Method | Use Case | Reference |
|--------|----------|-----------|
| JWT validation | API authentication | [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn" >}}) |
| OIDC browser auth | Browser-based user authentication | [OIDC browser authentication]({{< link-hextra path="/configuration/security/oidc" >}}) |
| OAuth2 Proxy | Browser authentication via a proxy | [OAuth2 Proxy]({{< link-hextra path="/integrations/auth/oauth2-proxy" >}}) |
| External authz | Custom auth services | [External authorization]({{< link-hextra path="/configuration/security/external-authz" >}}) |
| Tailscale | Zero-trust networks | [Tailscale]({{< link-hextra path="/integrations/auth/tailscale" >}}) |
