---
title: Authentication & Identity
weight: 40
description: Integrate Agent Gateway with identity providers and authentication systems
---

Agent Gateway supports multiple authentication methods and integrates with popular identity providers.

{{< cards >}}
  {{< card link="oauth2-proxy" title="OAuth2 Proxy" subtitle="GitHub, Google, Azure AD authentication" >}}
  {{< card link="keycloak" title="Keycloak" subtitle="Open source identity management" >}}
  {{< card link="auth0" title="Auth0" subtitle="Identity platform" >}}
  {{< card link="tailscale" title="Tailscale" subtitle="Zero-trust network authentication" >}}
  {{< card link="okta" title="Okta" subtitle="Enterprise identity management" >}}
{{< /cards >}}

## Authentication methods

Agent Gateway supports several authentication approaches:

| Method | Use Case | Tutorial |
|--------|----------|----------|
| JWT validation | API authentication | [MCP Authentication]({{< link-hextra path="/tutorials/mcp-authentication" >}}) |
| OAuth2/OIDC | User authentication | [OAuth2 Proxy]({{< link-hextra path="/tutorials/oauth2-proxy" >}}) |
| External authz | Custom auth services | [Authorization]({{< link-hextra path="/tutorials/authorization" >}}) |
| Tailscale | Zero-trust networks | [Tailscale Auth]({{< link-hextra path="/tutorials/tailscale-auth" >}}) |
