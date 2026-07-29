---
title: Okta
weight: 50
description: Integrate agentgateway with Okta for enterprise identity management
test:
  okta-mcp-authn:
  - file: ${versionRoot}/integrations/auth/okta.md
    path: okta-mcp-authn
---

[Okta](https://www.okta.com/) is an enterprise identity platform. Agentgateway includes a native `okta` MCP authentication provider so that you can use Okta as the authorization server for your MCP servers.

Set `provider.okta` and agentgateway adapts to Okta for you:

- Serves authorization server metadata from Okta's OpenID Connect discovery document, because Okta does not support the [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) path-based issuer format.
- Appends your first configured audience to Okta's authorization endpoint as an `audience` query parameter, because Okta does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators.
- Proxies Dynamic Client Registration through the gateway, because Okta does not send CORS headers on its registration endpoint. Okta's registration endpoint is relative to your org URL rather than the issuer, so agentgateway rewrites it to `https://your-org.okta.com/oauth2/v1/clients`.

## Why use Okta with agentgateway?

- **Enterprise SSO** - Centralized identity for organizations
- **Directory integration** - Active Directory, LDAP sync
- **Lifecycle management** - Automated provisioning/deprovisioning
- **Compliance** - SOC 2, HIPAA, FedRAMP certified
- **API Access Management** - OAuth2/OIDC for APIs

## Configuration

Configure agentgateway to validate Okta JWTs:

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
      issuer: https://your-org.okta.com/oauth2/default
      audiences:
      - api://agentgateway
      provider:
        okta: {}
      jwks:
        url: https://your-org.okta.com/oauth2/default/v1/keys
      resourceMetadata:
        resource: api://agentgateway
        scopesSupported:
        - agentgateway
        bearerMethodsSupported:
        - header
```

> [!IMPORTANT]
> Unlike the other providers, Okta requires you to set `jwks` explicitly. Okta publishes its keys at `{issuer}/v1/keys`, but agentgateway derives `{issuer}/.well-known/jwks.json` for the `okta` provider, which Okta does not serve. If you omit `jwks`, token validation fails because agentgateway cannot fetch the signing keys.

To confirm the JWKS URL for your authorization server, check the `jwks_uri` field of its metadata document at `{issuer}/.well-known/openid-configuration`.

## Okta setup

1. Create an Authorization Server (or use `default`):
   - Admin Console → Security → API → Authorization Servers

2. Add a custom scope:
   - Name: `agentgateway`
   - Description: Access to agentgateway

3. Create an API Services application:
   - Applications → Create App Integration
   - Sign-in method: API Services
   - Note the Client ID and Client Secret

4. Grant the scope to your application

## Getting a token

```bash
curl -X POST "https://your-org.okta.com/oauth2/default/v1/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=agentgateway"
```

## Group-based authorization

Use Okta groups with agentgateway authorization:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: https://your-org.okta.com/oauth2/default
    audiences: [api://agentgateway]
    provider:
      okta: {}
    jwks:
      url: https://your-org.okta.com/oauth2/default/v1/keys
    resourceMetadata:
      resource: api://agentgateway
      scopesSupported:
      - agentgateway
      bearerMethodsSupported:
      - header
  authorization:
    rules:
    # Check for Okta group membership
    - '"AI-Users" in jwt.groups'
```

## Learn more

- [Okta Developer Documentation](https://developer.okta.com/)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})

{{< doc-test paths="okta-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="okta-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The Okta mcpAuthentication examples on this page (issuer, audiences, the
#     okta provider, an explicit jwks, and resourceMetadata) are accepted by
#     agentgateway, including the group-based authorization variant.
#   * The test points jwks at a local file rather than the Okta keys URL that the
#     page shows, so it runs without a live Okta org.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That Okta serves keys at {issuer}/v1/keys, the audience query parameter
#     that the provider appends to Okta's authorization endpoint, the proxied
#     client registration endpoint, and runtime token verification. Each of these
#     requires a live Okta org and a signed JWT that this page does not stand up.
mkdir -p manifests/jwt
cat <<'EOF' > manifests/jwt/pub-key
{"keys": [{"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256", "n": "teXe4sfDoHQR5YUos3nsY_Ax6J2xrgXnIfUziaTWJ4nljejLVyg8m0g6SK9zrSaCvLm9GxAhpaJ_48RalwqDt4spBPQ8uvr-54jHrECboAbTxhy2T-oXP80Duz0xauSDVlyA_xenoCA24MFJ1rgHppy1F1eYTD-CQ-IxhXLNm5mE3rJufP_pdnMy0q6acXSfPtEzMJY3BYNV5umqimkOgH9PqQWd1RAgYdE7z5fvdCb4T4K667rRRT75PqRB4GJgSY-zQrC4CEVCw_ql7bfdouFcxXwsyh7AfImIEamA1LMODvMXVZWkZ8V0w_VEK6NHqr-BGOBVAUfRqYAEPxfaIw", "e": "AQAB"}]}
EOF
cat <<'EOF' > config-okta.yaml
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
      issuer: https://your-org.okta.com/oauth2/default
      audiences:
      - api://agentgateway
      provider:
        okta: {}
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: api://agentgateway
        scopesSupported:
        - agentgateway
        bearerMethodsSupported:
        - header
    authorization:
      rules:
      - '"AI-Users" in jwt.groups'
EOF
agentgateway -f config-okta.yaml --validate-only
{{< /doc-test >}}
