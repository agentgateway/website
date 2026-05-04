---
title: Authentication & identity
weight: 40
description: Integrate agentgateway with identity providers and authentication systems
test: skip
---

Agentgateway supports multiple authentication methods and integrates with popular identity providers.

## Authentication methods

Agentgateway supports several authentication approaches.

| Method | Use Case | Reference |
|--------|----------|-----------|
| JWT validation | API authentication | [MCP Authentication]({{< link-hextra path="/tutorials/mcp-authentication" >}}) |
| OIDC browser auth | Browser-based user authentication | [OIDC browser authentication]({{< link-hextra path="/configuration/security/oidc" >}}) |
| OAuth2/OIDC (external) | User authentication via proxy | [OAuth2 Proxy]({{< link-hextra path="/tutorials/oauth2-proxy" >}}) |
| External authz | Custom auth services | [Authorization]({{< link-hextra path="/tutorials/authorization" >}}) |
| Tailscale | Zero-trust networks | [Tailscale Auth]({{< link-hextra path="/tutorials/tailscale-auth" >}}) |
