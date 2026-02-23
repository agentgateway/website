### MCP auth vs JWT auth

You can configure both MCP and JWT auth with {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}. For most MCP cases, choose MCP auth.

* **MCP auth**: Use MCP auth for dynamic MCP clients, such as MCP Inspector, VS Code, or Claude Code that need to discover the auth server and register with your IdP to get a client ID. MCP auth implements the [MCP OAuth spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) and fills gaps for IdPs that do not expose MCP-style discovery and client registration. The client gets a 401, discovers `/.well-known/oauth-protected-resource`, registers, and completes the OAuth flow to obtain a token.

* **JWT auth**: Use basic JWT auth when you have static clients or service-to-service traffic. Clients already have a JWT from your IdP or a static token. You only need the gateway to validate the token and optionally enforce RBAC by claims, such as allow by `sub` or `team`. No discovery or client registration is involved.

Review the following table for a quick comparison of MCP auth and JWT auth.

| **Feature** | **MCP Auth** | **JWT Auth** |
| :---- | :---- | :---- |
| Goal | Full MCP OAuth flow (discovery, client registration, token validation) | Validate tokens and optional claim-based RBAC |
| Policy section | `spec.backend.mcp.authentication` | `spec.traffic.jwtAuthentication` |
| Target ref | `AgentgatewayBackend` | `Gateway` or `HTTPRoute` |
| Discovery | `/.well-known/oauth-protected-resource` | None |
| Client registration | Dynamic registration with IdP | None (client has token) |
