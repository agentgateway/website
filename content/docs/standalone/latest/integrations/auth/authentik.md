---
title: authentik
weight: 55
description: Integrate agentgateway with authentik for identity management
test:
  authentik-mcp-authn:
  - file: ${versionRoot}/integrations/auth/authentik.md
    path: authentik-mcp-authn
---

[authentik](https://goauthentik.io/) is an open-source identity provider. Agentgateway includes a native `authentik` MCP authentication provider so that you can use authentik as the authorization server for your MCP servers.

## Why the authentik provider is needed {#why}

MCP clients follow the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization), which relies on OAuth features that authentik handles differently. When you set `provider.authentik`, agentgateway bridges these gaps as follows:

- **Non-standard JWKS path.** authentik serves signing keys at `{issuer}/jwks/` instead of `{issuer}/.well-known/jwks.json`. Agentgateway derives the correct URL from your issuer.
- **Metadata discovery.** Agentgateway fetches authentik's OpenID Connect discovery document at `{issuer}/.well-known/openid-configuration` and serves it to MCP clients as authorization server metadata.
- **No Dynamic Client Registration.** authentik does not implement [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591) ([authentik#8751](https://github.com/goauthentik/authentik/issues/8751)), so its discovery document has no `registration_endpoint` at all. Agentgateway injects one that points back at the gateway and answers registration requests with the client that you pre-register in `clientId`.

> [!IMPORTANT]
> Setting `clientId` is required for authentik. Because authentik does not support Dynamic Client Registration, the pre-registered client in `clientId` is the only way for MCP clients to complete registration. If you omit it, registration requests fail.

## Before you begin {#before-you-begin}

- An authentik instance that agentgateway can reach.
- Permission to create an application and provider in authentik.

## Create an OAuth provider and application in authentik {#register}

1. Log in to the authentik admin interface and go to **Applications > Providers**.

2. Create a provider with the following settings:
   - **Type**: OAuth2/OpenID Provider
   - **Name**: A name such as `agentgateway-mcp`
   - **Client type**: Public. MCP clients are public clients that use PKCE, because they cannot keep a client secret.
   - **Redirect URIs**: The callback URLs of the MCP clients that you plan to use. Claude and other MCP clients register their own callback URLs, so include the ones that your clients report.

3. Note the **Client ID** that authentik generates. You use this value for both `clientId` and `audiences` in agentgateway.

4. Go to **Applications > Applications** and create an application that uses the provider you just created. Note the application **Slug**, which appears in the issuer URL.

5. Copy the issuer URL from the provider's setup URLs. authentik issuers take the form `https://<authentik-host>/application/o/<app-slug>/`, including the trailing slash.

## Configure agentgateway {#configure}

Configure the `mcpAuthentication` policy with the `authentik` provider:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins: ["*"]
      allowHeaders: ["*"]
      exposeHeaders: ["Mcp-Session-Id"]
    mcpAuthentication:
      mode: strict
      issuer: https://authentik.example.com/application/o/agentgateway-mcp/
      audiences:
      - <YOUR_CLIENT_ID>
      provider:
        authentik: {}
      clientId: <YOUR_CLIENT_ID>
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - openid
        - profile
        bearerMethodsSupported:
        - header
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```

Review the following configuration details:

- `issuer`: The authentik issuer URL, including the trailing slash. Agentgateway derives the JWKS URL by appending `jwks/` to this value, so you do not need to configure `jwks`. To fetch keys from somewhere else, such as a local file, set `jwks` explicitly to override the derived URL.
- `audiences`: The OAuth client ID. authentik sets the `aud` claim of its tokens to the client ID rather than to a separate API identifier, so this value must match `clientId`.
- `clientId`: The client ID of the public client that you created in authentik. Agentgateway returns this client to MCP clients that attempt Dynamic Client Registration.

> [!NOTE]
> authentik does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators, and unlike Auth0 and Okta, it has no `audience` query parameter workaround. This is why `audiences` must be set to the client ID that authentik puts in the `aud` claim.

## Connect an MCP client {#connect}

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway, registers against the pre-registered client, and redirects the user to authentik to log in and consent.

## Group-based authorization {#authorization}

authentik includes the user's groups in the token when the provider's scopes include the group claim. Combine those claims with agentgateway authorization rules:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: https://authentik.example.com/application/o/agentgateway-mcp/
    audiences: [<YOUR_CLIENT_ID>]
    provider:
      authentik: {}
    clientId: <YOUR_CLIENT_ID>
    resourceMetadata:
      resource: http://localhost:3000/mcp
      scopesSupported:
      - openid
      bearerMethodsSupported:
      - header
  authorization:
    rules:
    # Check for authentik group membership
    - '"ai-users" in jwt.groups'
```

## Learn more

- [authentik documentation](https://docs.goauthentik.io/)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}})

{{< doc-test paths="authentik-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="authentik-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The authentik mcpAuthentication examples on this page (an issuer with the
#     required trailing slash, audiences set to the client ID, the authentik
#     provider, clientId, and resourceMetadata) are accepted by agentgateway,
#     including the group-based authorization variant.
#   * The test points jwks at a local file instead of letting agentgateway derive
#     {issuer}/jwks/, so it runs without a live authentik instance.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Resolution of the derived {issuer}/jwks/ URL, the injected client
#     registration endpoint, and runtime token verification. Each of these
#     requires a live authentik instance and a signed JWT that this page does not
#     stand up. The Kubernetes authentik guide covers the injected registration
#     endpoint against a real authentik deployment.
mkdir -p manifests/jwt
cat <<'EOF' > manifests/jwt/pub-key
{"keys": [{"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256", "n": "teXe4sfDoHQR5YUos3nsY_Ax6J2xrgXnIfUziaTWJ4nljejLVyg8m0g6SK9zrSaCvLm9GxAhpaJ_48RalwqDt4spBPQ8uvr-54jHrECboAbTxhy2T-oXP80Duz0xauSDVlyA_xenoCA24MFJ1rgHppy1F1eYTD-CQ-IxhXLNm5mE3rJufP_pdnMy0q6acXSfPtEzMJY3BYNV5umqimkOgH9PqQWd1RAgYdE7z5fvdCb4T4K667rRRT75PqRB4GJgSY-zQrC4CEVCw_ql7bfdouFcxXwsyh7AfImIEamA1LMODvMXVZWkZ8V0w_VEK6NHqr-BGOBVAUfRqYAEPxfaIw", "e": "AQAB"}]}
EOF
cat <<'EOF' > config-authentik.yaml
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins: ["*"]
      allowHeaders: ["*"]
      exposeHeaders: ["Mcp-Session-Id"]
    mcpAuthentication:
      mode: strict
      issuer: https://authentik.example.com/application/o/agentgateway-mcp/
      audiences:
      - my-client-id
      provider:
        authentik: {}
      clientId: my-client-id
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - openid
        - profile
        bearerMethodsSupported:
        - header
    authorization:
      rules:
      - '"ai-users" in jwt.groups'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-authentik.yaml --validate-only
{{< /doc-test >}}
