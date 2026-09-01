---
title: Authentication & identity
weight: 10
description: Integrate agentgateway with identity providers and authentication systems
test: skip
icon: key
---

Agentgateway supports multiple authentication methods and integrates with popular identity providers.

## Authentication methods

Agentgateway supports several authentication approaches.

| Method | Use Case | Reference |
|--------|----------|-----------|
| JWT validation | API authentication | [JWT authentication]({{< link-hextra path="/documentation/configuration/security/jwt-authn" >}}) |
| MCP authentication | OAuth protection for MCP servers | [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}}) |
| OIDC browser auth | Browser-based user authentication | [OIDC browser authentication]({{< link-hextra path="/documentation/configuration/security/oidc" >}}) |
| OAuth2/OIDC (external) | User authentication via proxy | [OAuth2 Proxy]({{< link-hextra path="/integrations/auth/oauth2-proxy" >}}) |
| External authz | Custom auth services | [External authorization]({{< link-hextra path="/documentation/configuration/security/external-authz" >}}) |
| Tailscale | Zero-trust networks | [Tailscale]({{< link-hextra path="/integrations/auth/tailscale" >}}) |

## Identity providers

Agentgateway includes native MCP authentication providers for the following identity providers. Each provider adapts agentgateway to the OAuth behaviors of that authorization server, such as where it publishes signing keys and whether it supports Dynamic Client Registration.
