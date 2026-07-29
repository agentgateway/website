---
title: Keycloak
weight: 20
description: Integrate agentgateway with Keycloak for identity management
test:
  keycloak-mcp-authn:
  - file: ${versionRoot}/integrations/auth/keycloak.md
    path: keycloak-mcp-authn
---

[Keycloak](https://www.keycloak.org/) is an open-source identity and access management solution. Agentgateway includes a native `keycloak` MCP authentication provider so that you can use Keycloak as the authorization server for your MCP servers.

Keycloak does not serve keys or metadata at the standard OAuth locations. Set `provider.keycloak` and agentgateway adapts to Keycloak for you:

- Fetches keys from `{issuer}/protocol/openid-connect/certs`, the non-standard endpoint that Keycloak uses instead of `{issuer}/.well-known/jwks.json`.
- Serves authorization server metadata from Keycloak's OpenID Connect discovery document, because Keycloak does not implement [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414).
- Proxies Dynamic Client Registration through the gateway, because Keycloak does not send CORS headers on its registration endpoint ([keycloak#39629](https://github.com/keycloak/keycloak/issues/39629)).

## Why use Keycloak with agentgateway?

- **Open source** - Self-hosted identity management
- **Standards-based** - OAuth2, OIDC, SAML support
- **Enterprise features** - User federation, SSO, MFA
- **Fine-grained authorization** - Role and attribute-based access

## Configuration

Configure agentgateway to validate Keycloak JWTs:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - mcp:
      targets:
      - name: my-server
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
  policies:
    mcpAuthentication:
      mode: strict
      issuer: https://keycloak.example.com/realms/myrealm
      audiences:
      - agentgateway
      provider:
        keycloak: {}
      resourceMetadata:
        resource: agentgateway
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
```

Because `provider.keycloak` is set, agentgateway derives the JWKS URL from the issuer and you do not need to configure `jwks`. To fetch keys from somewhere else, such as a local file or an internal mirror, set `jwks` explicitly to override the derived URL.

> [!NOTE]
> Keycloak does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators ([keycloak#10169](https://github.com/keycloak/keycloak/issues/10169)), and agentgateway has no workaround for this. Set `audiences` to the audience that your Keycloak realm issues.

## Docker Compose example

```yaml
version: '3'
services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/etc/agentgateway/config.yaml
    depends_on:
      - keycloak

  keycloak:
    image: quay.io/keycloak/keycloak:latest
    ports:
      - "8080:8080"
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=admin
    command: start-dev

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=keycloak
      - POSTGRES_USER=keycloak
      - POSTGRES_PASSWORD=keycloak
```

## Keycloak setup

1. Create a realm (e.g., `myrealm`)
2. Create a client for agentgateway:
   - Client ID: `agentgateway`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential` or `public`
3. Create users and assign roles

## Role-based authorization

Combine Keycloak roles with agentgateway authorization:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: https://keycloak.example.com/realms/myrealm
    audiences: [agentgateway]
    provider:
      keycloak: {}
    resourceMetadata:
      resource: agentgateway
      scopesSupported:
      - read:all
      bearerMethodsSupported:
      - header
  authorization:
    rules:
    # Check for admin role in token
    - '"admin" in jwt.realm_access.roles'
```

## Learn more

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})

{{< doc-test paths="keycloak-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="keycloak-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The Keycloak mcpAuthentication examples on this page (issuer, audiences,
#     the keycloak provider, and resourceMetadata) are accepted by agentgateway,
#     including the role-based authorization variant.
#   * The test points jwks at a local file instead of letting agentgateway derive
#     the Keycloak certs URL, so it runs without a live Keycloak instance.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Resolution of the derived JWKS URL, the proxied authorization-server
#     metadata, and runtime token verification. Each of these requires a live
#     Keycloak realm and a signed JWT that this page does not stand up.
mkdir -p manifests/jwt
cat <<'EOF' > manifests/jwt/pub-key
{"keys": [{"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256", "n": "teXe4sfDoHQR5YUos3nsY_Ax6J2xrgXnIfUziaTWJ4nljejLVyg8m0g6SK9zrSaCvLm9GxAhpaJ_48RalwqDt4spBPQ8uvr-54jHrECboAbTxhy2T-oXP80Duz0xauSDVlyA_xenoCA24MFJ1rgHppy1F1eYTD-CQ-IxhXLNm5mE3rJufP_pdnMy0q6acXSfPtEzMJY3BYNV5umqimkOgH9PqQWd1RAgYdE7z5fvdCb4T4K667rRRT75PqRB4GJgSY-zQrC4CEVCw_ql7bfdouFcxXwsyh7AfImIEamA1LMODvMXVZWkZ8V0w_VEK6NHqr-BGOBVAUfRqYAEPxfaIw", "e": "AQAB"}]}
EOF
cat <<'EOF' > config-keycloak.yaml
gateways:
  default:
    port: 3000
routes:
- backends:
  - mcp:
      targets:
      - name: my-server
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
  policies:
    mcpAuthentication:
      mode: strict
      issuer: https://keycloak.example.com/realms/myrealm
      audiences:
      - agentgateway
      provider:
        keycloak: {}
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: agentgateway
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
    authorization:
      rules:
      - '"admin" in jwt.realm_access.roles'
EOF
agentgateway -f config-keycloak.yaml --validate-only
{{< /doc-test >}}
