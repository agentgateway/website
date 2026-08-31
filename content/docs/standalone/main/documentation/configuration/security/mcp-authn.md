---
title: MCP authentication
weight: 30
description: Configure OAuth 2.0 protection for MCP servers with JWT validation.
test:
  mcp-authn:
  - file: ${versionRoot}/configuration/security/mcp-authn.md
    path: mcp-authn
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

MCP authentication enables OAuth 2.0 protection for MCP servers, helping to implement the [MCP Authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization). Agentgateway can act as a resource server, validating JWT tokens and exposing protected resource metadata.

MCP authentication is configured at the route level under `policies.mcpAuthentication`. Because the policy runs at the route level, you can use JWT claims from MCP auth in other route-level policies, such as authorization, rate limiting, and transformations.

MCP authentication uses a connect-time model, sometimes called *eager auth*: the OAuth flow happens once when the client first connects, not on each tool call. After the initial authentication, the access token is reused for all subsequent requests within the session.

> [!NOTE]
> {{< reuse "agw-docs/snippets/mcp-policy-note.md" >}}

There are three deployment scenarios.

{{< doc-test paths="mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="mcp-authn" >}}
# Create the local JWKS file that the tests reference in place of the IdP URL,
# so they validate the policy structure without a live identity provider.
mkdir -p manifests/jwt
cat <<'EOF' > manifests/jwt/pub-key
{"keys": [{"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256", "n": "teXe4sfDoHQR5YUos3nsY_Ax6J2xrgXnIfUziaTWJ4nljejLVyg8m0g6SK9zrSaCvLm9GxAhpaJ_48RalwqDt4spBPQ8uvr-54jHrECboAbTxhy2T-oXP80Duz0xauSDVlyA_xenoCA24MFJ1rgHppy1F1eYTD-CQ-IxhXLNm5mE3rJufP_pdnMy0q6acXSfPtEzMJY3BYNV5umqimkOgH9PqQWd1RAgYdE7z5fvdCb4T4K667rRRT75PqRB4GJgSY-zQrC4CEVCw_ql7bfdouFcxXwsyh7AfImIEamA1LMODvMXVZWkZ8V0w_VEK6NHqr-BGOBVAUfRqYAEPxfaIw", "e": "AQAB"}]}
EOF
{{< /doc-test >}}

## Authorization Server Proxy

Agentgateway can adapt traffic for authorization servers that don't fully comply with OAuth standards.
For example, Keycloak exposes certificates at a non-standard endpoint.

Set the `provider` field to adapt agentgateway's behavior to a specific authorization server.

In this mode, agentgateway:
- Exposes protected resource metadata on behalf of the MCP server
- Proxies authorization server metadata and client registration
- Validates tokens using the authorization server's JWKS
- Returns `401 Unauthorized` with appropriate `WWW-Authenticate` headers for unauthenticated requests

### Supported providers {#providers}

The `provider` field takes a map with a single provider key, such as `provider: {keycloak: {}}`. Each provider adapts agentgateway to the behavior of that authorization server, including where it publishes signing keys and how it handles Dynamic Client Registration (DCR).

Other identity providers that fully comply with the OAuth 2.0 specifications might also work, but are not tested. For an end-to-end setup guide for each tested provider, see the [Authentication & Identity]({{< link-hextra path="/integrations/auth/" >}}) section.

| `provider` | Derived JWKS URL | Metadata source | Notable behavior |
|------------|------------------|-----------------|------------------|
| [`auth0`]({{< link-hextra path="/integrations/auth/auth0" >}})  | {issuer}/.well-known/jwks.json | RFC 8414 | Appends the first audience to the authorization endpoint, because Auth0 does not support RFC 8707. |
| [`authentik`]({{< link-hextra path="/integrations/auth/authentik" >}}) | {issuer}/jwks/ | OIDC discovery | Injects a DCR endpoint, because open source authentik does not implement RFC 7591. Requires `clientId`. |
| [`descope`]({{< link-hextra path="/integrations/auth/descope" >}}) | https://api.descope.com/{project-id}/.well-known/jwks.json | OIDC discovery | Rewrites agentic issuers to the project-level JWKS URL. `clientId` recommended, because DCR requires a management key. |
| [`entra`]({{< link-hextra path="/integrations/auth/entra" >}}) | Derived from the tenant's v2.0 discovery document | Entra v2.0 discovery | Strips the RFC 8707 `resource` parameter and proxies `authorize` and `token`. Requires `clientId`. |
| [`keycloak`]({{< link-hextra path="/integrations/auth/keycloak" >}}) | {issuer}/protocol/openid-connect/certs | OIDC discovery | Proxies DCR, because Keycloak sends CORS headers on its registration endpoint only for origins that you allow in a realm policy. |
| [`okta`]({{< link-hextra path="/integrations/auth/okta" >}}) `*` | {issuer}/.well-known/jwks.json | OIDC discovery | Appends the first audience to the authorization endpoint and proxies DCR to the org-level endpoint. Set `jwks` explicitly. |
| Not set | {issuer}/.well-known/jwks.json | RFC 8414 | Standards-compliant behavior with no provider-specific adaptations. |

`*` Okta publishes keys at `{issuer}/v1/keys`, not at the `{issuer}/.well-known/jwks.json` URL that agentgateway derives, so always set `jwks` explicitly. For more information, see the [Okta guide]({{< link-hextra path="/integrations/auth/okta" >}}).

### Configuration example

Review the following configuration example and descriptions.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthentication:
      issuer: http://localhost:7080/realms/mcp
      audiences: ["http://localhost:3000/mcp"]
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
  targets:
  - name: tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
      audiences: ["http://localhost:3000/mcp"]
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
{{< /tab >}}
{{< /tabs >}}

| Setting | Description |
| --- | --- |
| resourceMetadata | The metadata source is where agentgateway fetches the authorization server metadata that it serves to MCP clients. `RFC 8414` means the path-based `/.well-known/oauth-authorization-server/{path}` form. `OIDC discovery` means `{issuer}/.well-known/openid-configuration`, which these providers serve instead. Most of them do not implement the RFC 8414 path-based issuer format; Keycloak 26.4.0 and later do, but agentgateway keeps using OIDC discovery for it so that earlier versions work, too. |
| jwks | Set `jwks` to override that URL with a different endpoint, a local file, or an inline key set. If you omit `jwks`, agentgateway fetches keys from the derived URL for your provider.  |
| clientId | Setting `clientId` short-circuits DCR for every provider: agentgateway answers registration requests with that pre-registered client instead of proxying them to the authorization server. For `authentik` and `entra` this is the only way registration can succeed, because Entra has no registration endpoint and open source authentik does not implement RFC 7591. |
| clientSecret | Set `clientSecret` when your pre-registered client is a confidential client that the authorization server requires to authenticate at the token endpoint, such as an Entra app registration under the **Web** platform. Omit it for public, PKCE-only clients. Agentgateway injects the secret server-side into proxied token requests; MCP clients never supply it.
| matches | In routing-based configuration, the route must also match the `/.well-known/oauth-authorization-server/<path>` prefix so that agentgateway can serve the proxied metadata and the `authorize` and `token` endpoints. The simplified `mcp` form sets up those routes for you. |

### Adding an IdP

Adding support for a new provider requires minimal code changes. To contribute support for your identity provider, see the [`McpIDP` enum in the agentgateway source](https://github.com/agentgateway/agentgateway/blob/main/crates/agentgateway/src/types/agent.rs).

{{< doc-test paths="mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The Authorization Server Proxy mcpAuthentication example (issuer, audiences,
#     keycloak provider, resourceMetadata, jwks) is accepted by agentgateway in
#     both the simplified MCP (mcp) and routing-based (gateways) forms.
#   * The test points jwks at a local file instead of the displayed IdP URL so it
#     runs without a live identity provider.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime token verification, the 401/WWW-Authenticate challenge, and the
#     proxied authorization-server metadata — require a real IdP and a signed JWT
#     the page does not stand up.
cat <<'EOF' > proxy-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthentication:
      issuer: http://localhost:7080/realms/mcp
      audiences: ["http://localhost:3000/mcp"]
      jwks:
        file: ./manifests/jwt/pub-key
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
  targets:
  - name: tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f proxy-mcp.yaml --validate-only

cat <<'EOF' > proxy-routing.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
      audiences: ["http://localhost:3000/mcp"]
      jwks:
        file: ./manifests/jwt/pub-key
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
EOF
agentgateway -f proxy-routing.yaml --validate-only
{{< /doc-test >}}

## Resource Server Only

Agentgateway acts solely as a resource server, validating tokens issued by an external authorization server.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthentication:
      issuer: http://localhost:9000
      audiences: ["http://localhost:3000/mcp"]
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
  targets:
  - name: tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
      audiences: ["http://localhost:3000/mcp"]
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
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The Resource Server Only mcpAuthentication example (issuer, audiences, jwks,
#     resourceMetadata) is accepted by agentgateway in both the simplified MCP
#     (mcp) and routing-based (gateways) forms.
#   * The test points jwks at a local file instead of the displayed IdP URL so it
#     runs without a live identity provider.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime token verification and the 401/WWW-Authenticate challenge — require
#     a real authorization server and a signed JWT the page does not stand up.
#   * The permissive-mode snippet below is a focused field-reference fragment, not
#     a standalone config, so it is not tested here.
cat <<'EOF' > rsonly-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthentication:
      issuer: http://localhost:9000
      audiences: ["http://localhost:3000/mcp"]
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
        - body
        - query
  targets:
  - name: tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f rsonly-mcp.yaml --validate-only

cat <<'EOF' > rsonly-routing.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
      audiences: ["http://localhost:3000/mcp"]
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
        - body
        - query
EOF
agentgateway -f rsonly-routing.yaml --validate-only
{{< /doc-test >}}

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
    audiences: ["http://localhost:3000/mcp"]
    jwks:
      url: http://localhost:9000/.well-known/jwks.json
    resourceMetadata:
      resource: http://localhost:3000/mcp
      scopesSupported:
      - read:all
```

## JWT claim validation

By default, agentgateway requires the `exp` (expiration) claim to be present in every JWT. To change which claims are required, set the `jwtValidationOptions.requiredClaims` field. The following RFC 7519 registered claims are supported: `exp`, `nbf`, `aud`, `iss`, and `sub`. Any other claim name that you list, such as `iat` or a custom claim, is ignored and logged as a warning.

> [!NOTE]
> The `requiredClaims` field controls only whether a claim must be present. It does not control whether the claim's value is checked. When one of the `exp`, `nbf`, `aud`, or `iss` claims is present in a token, agentgateway validates its value, whether or not you list the claim in `requiredClaims`. For example, an expired token is rejected because it carries an `exp` claim, even if you omit `exp` from `requiredClaims`. The `sub` claim is checked for presence only, and custom claims are never validated by this field. To enforce the value of a custom claim, use an [authorization policy]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}}) instead.

Some identity providers issue tokens without an `exp` claim. To accept those tokens, set `requiredClaims` to an empty list.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthentication:
      issuer: http://localhost:9000
      audiences: ["http://localhost:3000/mcp"]
      jwks:
        url: http://localhost:9000/.well-known/jwks.json
      jwtValidationOptions:
        requiredClaims: []
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
  targets:
  - name: tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```

To require additional claims, such as `aud` and `sub` alongside `exp`, list each one.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthentication:
      issuer: http://localhost:9000
      audiences: ["http://localhost:3000/mcp"]
      jwks:
        url: http://localhost:9000/.well-known/jwks.json
      jwtValidationOptions:
        requiredClaims:
        - exp
        - aud
        - sub
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
  targets:
  - name: tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```

{{< doc-test paths="mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * Both jwtValidationOptions.requiredClaims examples (the empty list and the
#     explicit exp/aud/sub list) are accepted by agentgateway.
#   * The test points jwks at a local file instead of the displayed IdP URL so it
#     runs without a live identity provider.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That a token missing exp is actually accepted or rejected — requires a real
#     authorization server and signed JWTs the page does not stand up.
cat <<'EOF' > claims-empty.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthentication:
      issuer: http://localhost:9000
      audiences: ["http://localhost:3000/mcp"]
      jwks:
        file: ./manifests/jwt/pub-key
      jwtValidationOptions:
        requiredClaims: []
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
  targets:
  - name: tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f claims-empty.yaml --validate-only

cat <<'EOF' > claims-required.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    mcpAuthentication:
      issuer: http://localhost:9000
      audiences: ["http://localhost:3000/mcp"]
      jwks:
        file: ./manifests/jwt/pub-key
      jwtValidationOptions:
        requiredClaims:
        - exp
        - aud
        - sub
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - read:all
  targets:
  - name: tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f claims-required.yaml --validate-only
{{< /doc-test >}}

## Passthrough

When the MCP server already implements OAuth authentication, no additional configuration is needed. Agentgateway passes requests through without modification.
