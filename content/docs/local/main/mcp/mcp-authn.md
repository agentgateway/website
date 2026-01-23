---
title: MCP authentication
weight: 30
prev: /docs/mcp/connect
---

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

MCP authentication enables OAuth 2.0 protection for MCP servers, helping to implement the [MCP Authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization). Agentgateway can act as a resource server, validating JWT tokens and exposing protected resource metadata.

There are three deployment scenarios.

## Authorization Server Proxy

Agentgateway can adapt traffic for authorization servers that don't fully comply with OAuth standards.
For example, Keycloak exposes certificates at a non-standard endpoint.

In this mode, agentgateway:
- Exposes protected resource metadata on behalf of the MCP server
- Proxies authorization server metadata and client registration
- Validates tokens using the authorization server's JWKS
- Returns `401 Unauthorized` with appropriate `WWW-Authenticate` headers for unauthenticated requests

```yaml
mcpAuthentication:
  issuer: http://localhost:7080/realms/mcp
  jwksUrl: http://localhost:7080/protocol/openid-connect/certs
  provider:
    keycloak: {}
  resourceMetadata:
    resource: http://localhost:3000/mcp
    scopesSupported:
    - read:all
    bearerMethodsSupported:
    - header
    - body
    - query
    resourceDocumentation: http://localhost:3000/stdio/docs
    resourcePolicyUri: http://localhost:3000/stdio/policies
```

## Resource Server Only

Agentgateway acts solely as a resource server, validating tokens issued by an external authorization server.

```yaml
mcpAuthentication:
  issuer: http://localhost:9000
  jwksUrl: http://localhost:9000/.well-known/jwks.json
  resourceMetadata:
    resource: http://localhost:3000/mcp
    scopesSupported:
    - read:all
    bearerMethodsSupported:
    - header
    - body
    - query
```

## Passthrough

When the MCP server already implements OAuth authentication, no additional configuration is needed. Agentgateway will pass requests through without modification.
