---
title: Okta
weight: 50
description: Protect MCP servers with Okta as the authorization server.
test:
  okta-mcp-authn:
  - file: ${versionRoot}/integrations/auth/okta.md
    path: okta-mcp-authn
---

[Okta](https://www.okta.com/) is an enterprise identity platform. Agentgateway includes a native `okta` MCP authentication provider so that you can use Okta as the authorization server for your MCP servers.

## Why the Okta provider is needed {#why}

MCP clients follow the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization), which relies on OAuth behaviors that Okta implements differently.

When you set `provider.okta`, agentgateway bridges these gaps as follows:

- Serves authorization server metadata from Okta's OpenID Connect discovery document, because Okta does not support the [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) path-based issuer format.
- Appends your first configured audience to Okta's authorization endpoint as an `audience` query parameter, because Okta does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators.
- Proxies Dynamic Client Registration through the gateway, because Okta does not send CORS headers on its registration endpoint. Okta's registration endpoint is relative to your org URL rather than the issuer, so agentgateway rewrites it to `https://<your-org>.okta.com/oauth2/v1/clients`.

> [!IMPORTANT]
> Unlike the other providers, Okta requires you to set `jwks` explicitly. Okta publishes its keys at `{issuer}/v1/keys`, but agentgateway derives `{issuer}/.well-known/jwks.json` for the `okta` provider, which Okta does not serve. If you omit `jwks`, token validation fails because agentgateway cannot fetch the signing keys.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Why use Okta with agentgateway? {#why-okta}

- **Enterprise single sign-on (SSO)**: Centralized identity for organizations.
- **Directory integration**: Active Directory and Lightweight Directory Access Protocol (LDAP) sync.
- **Lifecycle management**: Automated provisioning and deprovisioning.
- **Compliance**: SOC 2, HIPAA, and FedRAMP certified.
- **API access management**: OAuth 2.0 and OpenID Connect (OIDC) for APIs.

## Before you begin {#before-you-begin}

- [Install agentgateway]({{< link-hextra path="/deployment/binary" >}}).
- An [Okta org](https://developer.okta.com/signup/). A free developer org is sufficient.
- Permission to create an authorization server and an app integration in the Okta Admin Console.

## Set up Okta {#register}

Create an authorization server and an app integration in Okta, and collect the values that agentgateway needs.

1. Make sure that you have access to an [Okta org](https://developer.okta.com/signup/). If you do not have one, you can create a free developer org.

2. In the Okta Admin Console, go to **Security > API > Authorization Servers**. Use the built-in `default` server, or add one for your MCP server. Note the **Audience** value on the server's **Settings** tab.

3. On the authorization server's **Scopes** tab, add a scope that your MCP server enforces, such as `agentgateway`.

4. Go to **Applications > Applications** and click **Create App Integration**. Select **OIDC - OpenID Connect**, then select **Native Application** for local MCP clients or **Single-Page Application** for browser-based clients. Both are public clients that use PKCE, which is what MCP clients require.

5. Under **Grant type**, select **Authorization Code** and **Refresh Token**. Under **Sign-in redirect URIs**, add the callback URLs of the MCP clients that you plan to connect. Assign the app to the users or groups that need access, then click **Save**.

6. On the app's **General** tab, note the **Client ID**.

> [!TIP]
> To confirm the issuer and the JWKS URL for your authorization server, open its metadata document at `https://<your-org>.okta.com/oauth2/<auth-server-id>/.well-known/openid-configuration` and check the `issuer` and `jwks_uri` fields.

## Configure agentgateway {#configure}

Configure the `mcpAuthentication` policy with the `okta` provider.

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

Review the following configuration details:

- `issuer`: The authorization server URL, with no trailing slash. This value must match the `iss` claim in the token.
- `audiences`: The **Audience** of your authorization server. The first entry is the value that agentgateway sends to Okta as the `audience` query parameter.
- `jwks.url`: Required for Okta. Set it to `{issuer}/v1/keys`, because the URL that agentgateway derives for the `okta` provider is not a path that Okta serves.

## Get a token {#token}

MCP clients complete the OAuth flow themselves. To get a token by hand for testing, use the client credentials flow with an API Services application.

```bash
curl -X POST "https://your-org.okta.com/oauth2/default/v1/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=agentgateway"
```

## Connect an MCP client {#connect}

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway, registers through the gateway-proxied registration endpoint, and redirects the user to Okta to log in and consent.

## Group-based authorization {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Okta token in an [authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}) policy. Okta includes a user's group memberships in the `groups` claim when you add a groups claim to your authorization server.

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

- [Okta developer documentation](https://developer.okta.com/)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}})

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
