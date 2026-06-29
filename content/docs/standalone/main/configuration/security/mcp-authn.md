---
title: MCP authentication
weight: 30
description: Configure OAuth 2.0 protection for MCP servers with JWT validation.
test:
  mcp-authn:
  - file: content/docs/standalone/main/configuration/security/mcp-authn.md
    path: mcp-authn
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

MCP authentication enables OAuth 2.0 protection for MCP servers, helping to implement the [MCP Authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization). Agentgateway can act as a resource server, validating JWT tokens and exposing protected resource metadata.

MCP authentication is configured at the route level under `policies.mcpAuthentication`. Because the policy runs at the route level, you can use JWT claims from MCP auth in other route-level policies, such as authorization, rate limiting, and transformations.

MCP authentication uses a connect-time model: the OAuth flow happens once when the client first connects, not on each tool call. After the initial authentication, the access token is reused for all subsequent requests within the session.

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

In this mode, agentgateway:
- Exposes protected resource metadata on behalf of the MCP server
- Proxies authorization server metadata and client registration
- Validates tokens using the authorization server's JWKS
- Returns `401 Unauthorized` with appropriate `WWW-Authenticate` headers for unauthenticated requests

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

{{< doc-test paths="mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The Authorization Server Proxy mcpAuthentication example (issuer, audiences,
#     keycloak provider, resourceMetadata, jwks) is accepted by agentgateway in
#     both the simplified MCP (mcp) and routing-based (binds) forms.
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
#     (mcp) and routing-based (binds) forms.
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

## Passthrough

When the MCP server already implements OAuth authentication, no additional configuration is needed. Agentgateway passes requests through without modification.
