### MCP auth vs JWT auth

You can configure both MCP and JWT auth with an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}. For most MCP cases, choose MCP auth.

* **MCP auth**: Use MCP auth for MCP clients, such as MCP Inspector, VS Code, or Claude Code that need to dynamically discover the auth server and register with your IdP to get a client ID. The agentgateway proxy facilitates the discovery and client registration process between MCP clients and IdPs that do not implement the [MCP OAuth spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization). This way, your MCP clients successfully obtain a client ID to complete the OAuth flow. 

* **JWT auth**: Use basic JWT auth when you have static clients or service-to-service traffic. Clients already have a JWT from your IdP or a static token. You only need the gateway to validate the token and optionally enforce RBAC by claims. For example, you might want to grant access only to JWTs that contain the `sub` or `team` claim. No discovery or client registration is involved.

Review the following table for a quick comparison of MCP auth and JWT auth.

| **Feature** | **MCP Auth** | **JWT Auth** |
| :---- | :---- | :---- |
| Goal | Full MCP OAuth flow (discovery, client registration, token validation) | Validate tokens and optional claim-based RBAC |
| Policy section | `spec.backend.mcp.authentication` | `spec.traffic.jwtAuthentication` |
| Target ref | `AgentgatewayBackend` | `Gateway` or `HTTPRoute` |
| Client registration | Dynamic registration with IdP | None (client has token) |
