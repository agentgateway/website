---
title: Auth0
weight: 30
description: Integrate agentgateway with Auth0 for identity management
test:
  auth0-mcp-authn:
  - file: ${versionRoot}/integrations/auth/auth0.md
    path: auth0-mcp-authn
---

[Auth0](https://auth0.com/) is an identity platform that provides authentication and authorization services. Agentgateway includes a native `auth0` MCP authentication provider so that you can use Auth0 as the authorization server for your MCP servers.

Set `provider.auth0` and agentgateway adapts to Auth0 for you:

- Fetches keys from `{issuer}/.well-known/jwks.json`.
- Appends your first configured audience to Auth0's authorization endpoint as an `audience` query parameter, because Auth0 does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators. Without this, Auth0 issues opaque tokens instead of JWTs that agentgateway can validate.

## Why use Auth0 with agentgateway?

- **Managed identity** - No infrastructure to maintain
- **Social login** - Google, GitHub, Microsoft, and more
- **Enterprise SSO** - SAML, LDAP, Active Directory
- **MFA** - Built-in multi-factor authentication
- **API protection** - JWT-based API authentication

## Configuration

Configure agentgateway to validate Auth0 JWTs:

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
      issuer: https://your-tenant.auth0.com/
      audiences:
      - https://api.example.com
      provider:
        auth0: {}
      resourceMetadata:
        resource: https://api.example.com
        scopesSupported:
        - read:tools
        bearerMethodsSupported:
        - header
```

Because `provider.auth0` is set, agentgateway derives the JWKS URL from the issuer and you do not need to configure `jwks`. To fetch keys from somewhere else, such as a local file or an internal mirror, set `jwks` explicitly to override the derived URL.

The first entry in `audiences` is the value that agentgateway sends to Auth0 as the `audience` query parameter, so list your API identifier first.

## Auth0 setup

1. Create an API in Auth0 Dashboard:
   - Name: `agentgateway API`
   - Identifier: `https://api.example.com`

2. Create an Application:
   - Type: Single Page Application or Machine to Machine
   - Note the Client ID and Client Secret

3. Configure allowed callbacks and origins

## Getting a token

### Machine-to-machine

```bash
curl -X POST "https://your-tenant.auth0.com/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://api.example.com",
    "grant_type": "client_credentials"
  }'
```

### Using the token

```bash
curl http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize",...}'
```

## Permission-based authorization

Use Auth0 permissions with agentgateway:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: https://your-tenant.auth0.com/
    audiences: [https://api.example.com]
    provider:
      auth0: {}
    resourceMetadata:
      resource: https://api.example.com
      scopesSupported:
      - read:tools
      bearerMethodsSupported:
      - header
  authorization:
    rules:
    # Check for specific permission
    - '"read:tools" in jwt.permissions'
```

## Learn more

- [Auth0 Documentation](https://auth0.com/docs)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})

{{< doc-test paths="auth0-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="auth0-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The Auth0 mcpAuthentication examples on this page (issuer, audiences, the
#     auth0 provider, and resourceMetadata) are accepted by agentgateway,
#     including the permission-based authorization variant.
#   * The test points jwks at a local file instead of letting agentgateway derive
#     the Auth0 JWKS URL, so it runs without a live Auth0 tenant.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Resolution of the derived JWKS URL, the audience query parameter that the
#     provider appends to Auth0's authorization endpoint, and runtime token
#     verification. Each of these requires a live Auth0 tenant and a signed JWT
#     that this page does not stand up.
mkdir -p manifests/jwt
cat <<'EOF' > manifests/jwt/pub-key
{"keys": [{"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256", "n": "teXe4sfDoHQR5YUos3nsY_Ax6J2xrgXnIfUziaTWJ4nljejLVyg8m0g6SK9zrSaCvLm9GxAhpaJ_48RalwqDt4spBPQ8uvr-54jHrECboAbTxhy2T-oXP80Duz0xauSDVlyA_xenoCA24MFJ1rgHppy1F1eYTD-CQ-IxhXLNm5mE3rJufP_pdnMy0q6acXSfPtEzMJY3BYNV5umqimkOgH9PqQWd1RAgYdE7z5fvdCb4T4K667rRRT75PqRB4GJgSY-zQrC4CEVCw_ql7bfdouFcxXwsyh7AfImIEamA1LMODvMXVZWkZ8V0w_VEK6NHqr-BGOBVAUfRqYAEPxfaIw", "e": "AQAB"}]}
EOF
cat <<'EOF' > config-auth0.yaml
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
      issuer: https://your-tenant.auth0.com/
      audiences:
      - https://api.example.com
      provider:
        auth0: {}
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: https://api.example.com
        scopesSupported:
        - read:tools
        bearerMethodsSupported:
        - header
    authorization:
      rules:
      - '"read:tools" in jwt.permissions'
EOF
agentgateway -f config-auth0.yaml --validate-only
{{< /doc-test >}}
