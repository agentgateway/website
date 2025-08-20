---
title: MCP Policies
weight: 14
description: 
---

Agentgateway has support for a variety of policies specifically for [MCP](https://modelcontextprotocol.io/) traffic.
Note that all standard HTTP policies also apply to MCP traffic.

## MCP Authorization

The MCP authorization policy works similarly to [HTTP authorization](/docs/configuration/security-policies/#http-authorization), but runs in the context of an MCP request.

Instead of running against an HTTP request, MCP authorization policies run against specific MCP method invocations such as `list_tools` and `call_tools`.

If a tool, or other resource, is not allowed it will automatically be filtered in the `list` request.

```yaml
mcpAuthorization:
  rules:
  # Allow anyone to call 'echo'
  - 'mcp.tool.name == "echo"'
  # Only the test-user can call 'add'
  - 'jwt.sub == "test-user" && mcp.tool.name == "add"'
  # Any authenticated user with the claim `nested.key == value` can access 'printEnv'
  - 'mcp.tool.name == "printEnv" && jwt.nested.key == "value"'
```

Refer to the [CEL reference](/docs/operations/cel) for allowed variables.

## MCP Authentication

MCP authentication enables OAuth 2.0 protection for MCP servers, helping to implement the [MCP Authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization).
Agentgateway can act as a resource server, validating JWT tokens and exposing protected resource metadata.

There are three deployment scenarios.

### Authorization Server Proxy

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

### Resource Server Only

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

### Passthrough

When the MCP server already implements OAuth authentication, no additional configuration is needed. Agentgateway will pass requests through without modification.
