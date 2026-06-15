---
title: Keycloak
weight: 20
description: Validate Keycloak tokens with agentgateway
---

[Keycloak](https://www.keycloak.org/) is an open-source identity and access management solution. agentgateway can validate tokens issued by Keycloak for MCP and HTTP routes.

## Why use Keycloak with agentgateway?

- **Open source** - Self-hosted identity management
- **Standards-based** - OAuth2, OIDC, SAML support
- **Enterprise features** - User federation, SSO, MFA
- **MCP support** - Use Keycloak as an OAuth authorization server for MCP clients

## MCP authentication

Use `mcpAuthentication` when agentgateway fronts an MCP server. This policy validates Keycloak access tokens and exposes MCP protected resource metadata. Because Keycloak exposes certificates at a non-standard endpoint, set `provider.keycloak` and point `jwks.url` to the realm certificate endpoint.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
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
          issuer: https://keycloak.example.com/realms/myrealm
          jwks:
            url: https://keycloak.example.com/realms/myrealm/protocol/openid-connect/certs
          provider:
            keycloak: {}
          resourceMetadata:
            resource: https://gateway.example.com/mcp
            scopesSupported:
            - read:all
            bearerMethodsSupported:
            - header
```

If you only need agentgateway to validate tokens from Keycloak and do not need authorization-server proxy behavior, omit `provider.keycloak` and configure the standard `issuer`, `jwks`, and `resourceMetadata` fields as described in [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Browser authentication

Use the built-in `oidc` policy when browser users should sign in through Keycloak before reaching an HTTP backend. The gateway handles the authorization code flow with PKCE and validates the ID token.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:18080
      matches:
      - path:
          pathPrefix: /
      policies:
        oidc:
          issuer: https://keycloak.example.com/realms/myrealm
          clientId: agentgateway-browser
          clientSecret: my-client-secret
          redirectURI: https://gateway.example.com/oauth/callback
          scopes:
          - profile
          - email
```

## Keycloak setup

1. Create a realm (e.g., `myrealm`)
2. Create an OpenID Connect client for agentgateway.
3. Configure valid redirect URIs for browser OIDC clients, such as `https://gateway.example.com/oauth/callback`.
4. Request or map only the scopes and claims your gateway policies need.

## Authorization

This page does not define a Keycloak-specific authorization schema. If you use authorization rules after Keycloak authentication, write them against the JWT claims that your realm actually emits and the generic agentgateway policy you attach, such as [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}}) or [MCP authorization]({{< link-hextra path="/mcp/mcp-authz" >}}). Avoid copying Keycloak role claim paths unless you have confirmed those claims are present in your tokens.

## Learn more

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [OIDC browser authentication]({{< link-hextra path="/configuration/security/oidc" >}})
