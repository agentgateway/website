
> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

MCP authentication enables OAuth 2.0 protection for MCP servers, helping to implement the [MCP Authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization). Agentgateway can act as a resource server, validating JWT tokens and exposing protected resource metadata.

## About

MCP authentication uses a connect-time model: the OAuth flow happens once when the client first connects, not on each tool call. This type of connection is sometimes called "eager auth." After the initial authentication, the access token is reused for all subsequent requests within the session.

### Supported IdPs for MCP Auth {#idp}

Agentgateway currently includes built-in support for Keycloak and Auth0 as identity providers. Other IdPs that fully comply with the OAuth 2.0 specs might also work but are not tested. For more information, see [Supported identity providers]({{< link-hextra path="/mcp/about/#supported-idps" >}}).

Adding support for a new provider requires minimal code changes. To contribute support for your IdP, see the [`McpIDP` enum in the agentgateway source](https://github.com/agentgateway/agentgateway/blob/main/crates/agentgateway/src/types/agent.rs).

## Authorization Server Proxy

Agentgateway can adapt traffic for authorization servers that don't fully comply with OAuth standards.
For example, Keycloak exposes certificates at a non-standard endpoint.

In this mode, agentgateway:
- Exposes protected resource metadata on behalf of the MCP server
- Proxies authorization server metadata and client registration
- Validates tokens using the authorization server's JWKS
- Returns `401 Unauthorized` with appropriate `WWW-Authenticate` headers for unauthenticated requests

The following examples show how to configure the authorization server proxy mode with Keycloak and Auth0.

{{< tabs items="Keycloak,Auth0" >}}
{{% tab tabName="Keycloak" %}}
```yaml
mcpAuthentication:
  issuer: http://localhost:7080/realms/mcp
  jwks:
    url: http://localhost:7080/protocol/openid-connect/certs
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
{{% /tab %}}
{{% tab tabName="Auth0" %}}
```yaml
mcpAuthentication:
  issuer: https://<your-auth0-domain>/
  jwks:
    url: https://<your-auth0-domain>/.well-known/jwks.json
  provider:
    auth0: {}
  resourceMetadata:
    resource: http://localhost:3000/mcp
    scopesSupported:
    - read:all
    bearerMethodsSupported:
    - header
    - body
    - query
```
{{% /tab %}}
{{< /tabs >}}

## Resource Server Only

Agentgateway acts solely as a resource server, validating tokens issued by an external authorization server.

```yaml
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

## JWT claim validation

By default, agentgateway requires the `exp` (expiration) claim to be present in every JWT token. You can customize the claims that you require in a JWT by using the `jwtValidationOptions.requiredClaims` field.

The following RFC 7519 registered claims are supported: `exp`, `nbf`, `aud`, `iss`, `sub`.

> [!NOTE]
> The `requiredClaims` field checks if a claim is present in the JWT. If a claim is present, its value is always validated, regardless where you added this claim in the `requiredClaims` field. For example, if `exp` is present, the token is still rejected if it is expired, even if `exp` is not listed in `requiredClaims`.

**Use case: IDPs that omit the `exp` claim**

Some enterprise identity providers issue tokens without an `exp` claim. In this case, set `requiredClaims` to an empty list to allow such tokens through:

```yaml
mcpAuthentication:
  issuer: http://localhost:9000
  jwks:
    url: http://localhost:9000/.well-known/jwks.json
  jwtValidationOptions:
    requiredClaims: []
```

**Use case: Require additional claims**

To enforce that tokens include specific claims such as `aud` (audience) and `sub` (subject) in addition to `exp`:

```yaml
mcpAuthentication:
  issuer: http://localhost:9000
  jwks:
    url: http://localhost:9000/.well-known/jwks.json
  jwtValidationOptions:
    requiredClaims:
      - exp
      - aud
      - sub
```

## Authentication mode

You can control how agentgateway handles requests that lack valid credentials by setting the `mode` field. The following modes are supported:

| Mode | Behavior |
|------|----------|
| `strict` (default) | A valid token issued by a configured issuer must be present. Requests without a valid token are rejected with `401 Unauthorized`. |
| `optional` | If a token is present, it is validated. Requests without a token are allowed through. |
| `permissive` | Requests are never rejected based on authentication. |

The following example sets the mode to `permissive`:

```yaml
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

When the MCP server already implements OAuth authentication, no additional configuration is needed. Agentgateway will pass requests through without modification.
