---
title: Auth0
weight: 30
description: Protect MCP servers with Auth0 as the authorization server.
test:
  auth0-mcp-authn:
  - file: ${versionRoot}/integrations/auth/auth0.md
    path: auth0-mcp-authn
---

[Auth0](https://auth0.com/) is an identity platform that provides authentication and authorization services. Agentgateway includes a native `auth0` MCP authentication provider so that you can use Auth0 as the authorization server for your MCP servers.

## Why the Auth0 provider is needed {#why}

MCP clients follow the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization), which relies on OAuth behaviors that Auth0 implements differently. Auth0 does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators, which MCP clients use to request a token for a specific resource. Without a workaround, Auth0 issues an opaque access token that agentgateway cannot validate as a JWT.

When you set `provider.auth0`, agentgateway bridges this gap as follows:

- Appends your first configured audience to Auth0's authorization endpoint as an `audience` query parameter, so that Auth0 issues a JWT for your API rather than an opaque token.
- Fetches keys from `{issuer}/.well-known/jwks.json`, which is where Auth0 publishes them.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Why use Auth0 with agentgateway? {#why-auth0}

- **Managed identity**: No infrastructure to maintain.
- **Social login**: Google, GitHub, Microsoft, and more.
- **Enterprise single sign-on (SSO)**: Security Assertion Markup Language (SAML), Lightweight Directory Access Protocol (LDAP), and Active Directory.
- **Multi-factor authentication (MFA)**: Built in to Auth0.
- **API protection**: Authentication based on JSON Web Tokens (JWTs).

## Before you begin {#before-you-begin}

- [Install agentgateway]({{< link-hextra path="/deployment/binary" >}}).
- An [Auth0 tenant](https://auth0.com/docs/get-started/auth0-overview/create-tenants). A free tenant is sufficient.
- Permission to create an API and an application in the Auth0 Dashboard.

## Set up Auth0 {#register}

Create an API and an application in Auth0, and collect the values that agentgateway needs.

1. Make sure that you have access to an [Auth0 tenant](https://auth0.com/docs/get-started/auth0-overview/create-tenants). If you do not have one, you can create a free tenant.

2. In the Auth0 Dashboard, go to **Applications > APIs** and click **Create API**. Enter a name such as `agentgateway API`, and set the **Identifier** to the resource URL that your MCP clients request, such as `https://api.example.com`. The identifier becomes the `aud` claim of the tokens that Auth0 issues.

3. Go to **Applications > Applications** and click **Create Application**. Choose **Native** for local MCP clients, or **Single Page Application** for browser-based clients. Both are public clients that use PKCE, which is what MCP clients require.

4. On the application's **Settings** tab, note the **Domain** and the **Client ID**. Under **Application URIs**, add the callback URLs of the MCP clients that you plan to connect.

5. To use permission-based [authorization](#authorization), go to the API's **Settings** tab and enable **Add Permissions in the Access Token**. Then define the permissions that your MCP server enforces on the **Permissions** tab.

## Configure agentgateway {#configure}

Configure the `mcpAuthentication` policy with the `auth0` provider.

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

Review the following configuration details:

- `issuer`: Your Auth0 tenant domain, including the trailing slash. Auth0 mints the `iss` claim with a trailing slash, and this value must match it.
- `audiences`: The **Identifier** of your Auth0 API. The first entry is the value that agentgateway sends to Auth0 as the `audience` query parameter, so list your API identifier first.
- `jwks`: Optional. Because `provider.auth0` is set, agentgateway derives the JWKS URL from the issuer. To fetch keys from somewhere else, such as a local file or an internal mirror, set `jwks` explicitly to override the derived URL.

## Get a token {#token}

MCP clients complete the OAuth flow themselves. To get a token by hand for testing, use the client credentials flow with a machine-to-machine application.

1. Request a token from your tenant.
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

2. Send the `access_token` from the response as a bearer token.
   ```bash
   curl http://localhost:3000/mcp \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'
   ```

## Connect an MCP client {#connect}

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway and redirects the user to Auth0 to log in and consent.

## Permission-based authorization {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Auth0 token in an [authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}) policy. Auth0 includes the permissions that you grant to your API in the `permissions` claim when you enable **Add Permissions in the Access Token**.

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

- [Auth0 documentation](https://auth0.com/docs)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}})

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
#     that this page does not stand up. The Kubernetes Auth0 guide asserts the
#     audience query parameter against a running gateway.
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
