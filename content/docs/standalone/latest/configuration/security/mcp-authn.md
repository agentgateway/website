---
title: MCP authentication
weight: 30
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

MCP authentication enables OAuth 2.0 protection for MCP servers, helping to implement the [MCP Authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization). Agentgateway can act as a resource server, validating JWT tokens and exposing protected resource metadata.

MCP authentication is configured at the route level under `policies.mcpAuthentication`. Because the policy runs at the route level, you can use JWT claims from MCP auth in other route-level policies, such as authorization, rate limiting, and transformations.

MCP authentication uses a connect-time model: the OAuth flow happens once when the client first connects, not on each tool call. After the initial authentication, the access token is reused for all subsequent requests within the session.

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

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
routes:
- backends:
  - mcp:
      targets:
      - name: tools
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
  matches:
  - path:
      exact: /mcp
  - path:
      exact: /.well-known/oauth-protected-resource/mcp
  - path:
      exact: /.well-known/oauth-authorization-server/mcp
  - path:
      exact: /.well-known/oauth-authorization-server/mcp/client-registration
  policies:
    mcpAuthentication:
      issuer: http://localhost:7080/realms/mcp
      jwks:
        url: http://localhost:7080/realms/mcp/protocol/openid-connect/certs
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
routes:
- backends:
  - mcp:
      targets:
      - name: tools
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
  matches:
  - path:
      exact: /mcp
  - path:
      exact: /.well-known/oauth-protected-resource/mcp
  policies:
    mcpAuthentication:
      issuer: http://localhost:9000
      jwks:
        url: http://localhost:9000/.well-known/jwks.json
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
        - body
        - query
```

## Authentication mode

You can control how agentgateway handles requests that lack valid credentials by setting the `mode` field. The following modes are supported:

| Mode | Behavior |
|------|----------|
| `strict` (default) | A valid token issued by a configured issuer must be present. Requests without a valid token are rejected with `401 Unauthorized`. |
| `optional` | If a token is present, it is validated. Requests without a token are permitted. |
| `permissive` | Requests are never rejected based on authentication. |

The following example sets the mode to `permissive`:

```yaml
policies:
  mcpAuthentication:
    mode: permissive
    issuer: http://localhost:9000
    jwks:
      url: http://localhost:9000/.well-known/jwks.json
    resourceMetadata:
      resource: http://localhost:3000/mcp
      scopesSupported:
      - read:all
```

## Passthrough

When the MCP server already implements OAuth authentication, no additional configuration is needed. Agentgateway passes requests through without modification.
