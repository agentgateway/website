---
title: Authentication & identity
weight: 40
description: Integrate agentgateway with identity providers and authentication systems
test: skip
---

Agentgateway supports multiple authentication methods and integrates with popular identity providers.

{{< cards >}}
  {{< card link="oauth2-proxy" title="OAuth2 Proxy" subtitle="GitHub, Google, Azure AD authentication" >}}
  {{< card link="keycloak" title="Keycloak" subtitle="Open source identity management" >}}
  {{< card link="auth0" title="Auth0" subtitle="Identity platform" >}}
  {{< card link="tailscale" title="Tailscale" subtitle="Zero-trust network authentication" >}}
  {{< card link="okta" title="Okta" subtitle="Enterprise identity management" >}}
{{< /cards >}}

## Authentication methods

Agentgateway supports several authentication approaches.

| Method | Use Case | Reference |
|--------|----------|-----------|
| JWT validation | API authentication | [MCP Authentication]({{< link-hextra path="/tutorials/mcp-authentication" >}}) |
| OIDC browser auth | Browser-based user authentication | [OIDC browser authentication]({{< link-hextra path="/configuration/security/oidc" >}}) |
| OAuth2/OIDC (external) | User authentication via proxy | [OAuth2 Proxy]({{< link-hextra path="/tutorials/oauth2-proxy" >}}) |
| External authz | Custom auth services | [Authorization]({{< link-hextra path="/tutorials/authorization" >}}) |
| Tailscale | Zero-trust networks | [Tailscale Auth]({{< link-hextra path="/tutorials/tailscale-auth" >}}) |

{{< callout type="info" >}}
For browser-based OIDC, agentgateway includes a [built-in OIDC policy]({{< link-hextra path="/configuration/security/oidc" >}}) that handles the full login flow natively, without requiring an external proxy like oauth2-proxy.
{{< /callout >}}
