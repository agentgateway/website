### MCP vs JWT authentication

When exposing MCP servers, use MCP authentication. MCP authentication extends basic JWT authentication and facilitates the flow for the MCP server. Following [MCP auth](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), the MCP authentication feature fills in the gaps of IdP providers that are not compliant with the MCP spec for OAuth. It is especially useful for dynamic clients that need to register themselves with the IdP to get a Client ID, such as tools like MCP Inspector, VS Code, or Claude Code.

However, JWT authentication makes sense for cases where you do not want the MCP auth spec. For example, you might have service-to-service for an agent or a set of static users that you can use basic JWT authentication for. For more complex scenarios, you can authorize access to specific tools based on custom claims within the JWT. For example, you might allow "Alice" but deny "Bob" based on a `sub`or `team` claim.

Review the following table to help you decide which authentication method to use.

| **Feature** | **MCP Auth** | **JWT Auth** |
| :---- | :---- | :---- |
| Goal | Facilitate MCP Authentication | Validate existing tokens on requests |
| Discovery | Supports `/.well-known/oauth-protected-resource` | None |
| Registration | Handles dynamic client registration with IdP | None |
| Target Ref | Usually `AgentgatewayBackend` | Usually `Gateway` or `HTTPRoute` |
