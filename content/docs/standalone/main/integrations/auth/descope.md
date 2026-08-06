---
title: Descope
weight: 40
description: Protect MCP servers with Descope as the authorization server.
test:
  descope-mcp-authn:
  - file: ${versionRoot}/integrations/auth/descope.md
    path: descope-mcp-authn
---

[Descope](https://www.descope.com/) is an authentication and user management platform. Agentgateway includes a native `descope` MCP authentication provider so that you can use a Descope [MCP Server](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) as the authorization server for your MCP servers.

## Why the Descope provider is needed {#why}

Descope publishes signing keys at the project level rather than under the agentic issuer that your MCP Server exposes, and its Dynamic Client Registration (DCR) endpoint sits on a separate management path.

When you set `provider.descope`, agentgateway bridges these gaps as follows:

- Rewrites an agentic issuer of the form `https://api.descope.com/v1/apps/agentic/<project-id>/<server-id>` to the project-level JWKS URL `https://api.descope.com/<project-id>/.well-known/jwks.json`.
- Serves authorization server metadata from Descope's OpenID Connect discovery document, because Descope does not support the [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) path-based issuer format.
- Proxies Dynamic Client Registration through the gateway, deriving the management endpoint from the agentic issuer.

Descope supports [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators, so no audience workaround is needed.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Why use Descope with agentgateway? {#why-descope}

- **MCP-native OAuth 2.1 compliance**: [MCP Servers](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) let you protect your MCP gateway with a fully OAuth 2.1 compliant provider. Descope supports both [Client ID Metadata Documents (CIMD)](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/registration-methods#client-id-metadata-documents-cimd) and [Dynamic Client Registration (DCR)](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/registration-methods#dynamic-client-registration-dcr) as registration methods.
- **Agent Directory**: View all of your [agentic identities](https://docs.descope.com/agentic-identity-hub/core-components/agents) within one centralized identity and access management (IAM) platform.
- **Machine-to-machine access**: The [client credentials flow](https://docs.descope.com/agentic-identity-hub/core-components/clients#client-credentials) covers agents and backends that need unattended access.
- **Policies**: Enforce [policy](https://docs.descope.com/policies) rules for agent access to downstream services, together with agentgateway authorization rules that use JWT `roles` claims.
- **User consent for agents**: [Visual consent flows](https://docs.descope.com/flows) let users approve which MCP scopes and tools an agent can access.

## Before you begin {#before-you-begin}

- [Install agentgateway]({{< link-hextra path="/deployment/binary" >}}).
- A project in the [Descope Console](https://app.descope.com/).
- Permission to create an MCP Server and a Client in Descope.

## Set up Descope {#register}

Create a project and an MCP Server in Descope, and collect the values that agentgateway needs.

1. Create a project in the [Descope Console](https://app.descope.com/).

2. Note your **Project ID** from **Project Settings**. The project ID appears in both your issuer URL and your JWKS URL.

3. Create an [MCP Server](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) in the Descope Console to represent your MCP gateway. Set the **MCP Server URL** to match the public URL that agentgateway exposes, typically ending with `/mcp`, and define the scopes that your server enforces. The MCP Server includes a built-in [User Consent Flow](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/settings#user-consent-flow) for interactive, user-delegated access. Customize it under **Server Settings** if you need a different login or consent experience.

4. Copy the **Issuer URL** from the MCP Server **Connection Information** section. Use this value for `mcpAuthentication.issuer`.

5. Create a [Client](https://docs.descope.com/agentic-identity-hub/core-components/clients#creating-a-client) and note the generated **Client ID**. Use this value for `clientId`.

6. For machine-to-machine access, such as backend agents or automated testing, enable the [**Client Credentials** grant type](https://docs.descope.com/agentic-identity-hub/core-components/clients#client-credentials) on the Client and note the **Client Secret**.

## Configure agentgateway {#configure}

Configure the `mcpAuthentication` policy with the `descope` provider.

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
      issuer: https://api.descope.com/v1/apps/agentic/<YOUR_PROJECT_ID>/<YOUR_SERVER_ID>
      audiences: [<YOUR_MCP_SERVER_URL>]
      provider:
        descope: {}
      clientId: <YOUR_CLIENT_ID>
      resourceMetadata:
        resource: <YOUR_MCP_SERVER_URL>
        scopesSupported:
          - read:all
        bearerMethodsSupported:
          - header
  targets:
    - name: everything
      stdio:
        cmd: npx
        args: ["@modelcontextprotocol/server-everything"]
```

Review the following configuration details:

- `issuer`: Copy the full issuer URL from the **Connection Information** section of your MCP Server configuration. Descope agentic issuers take the form `https://api.descope.com/v1/apps/agentic/<project-id>/<server-id>`, where the project ID is also listed under **Project Settings**.
- `audiences`: Your MCP server's public URL, typically ending with `/mcp`. This value must match the `aud` claim in Descope-issued tokens, which equals your MCP server's resource URL.
- `clientId`: A pre-registered [Client](https://docs.descope.com/agentic-identity-hub/core-components/clients) ID. Descope's Dynamic Client Registration endpoint requires a management key that MCP clients do not have, so agentgateway answers registration requests with this pre-registered client instead. To let clients register dynamically through Descope, omit `clientId` and use [CIMD](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/registration-methods#client-id-metadata-documents-cimd) instead.
- `jwks`: Optional. Because `provider.descope` is set, agentgateway rewrites the agentic issuer to the project-level JWKS URL. To fetch keys from somewhere else, set `jwks` explicitly to override the derived URL.

## Get a token {#token}

How a client gets a token depends on whether it acts for a user or on its own behalf.

### Interactive clients (user-delegated)

MCP clients such as Claude, Cursor, or a custom client that you build handle this automatically with the OAuth 2.1 authorization code flow and PKCE. The client discovers your MCP Server's OAuth endpoints, registers through CIMD or DCR, and redirects the user through Descope's User Consent Flow to approve scopes. Point the client at your MCP Server URL. No manual token request is needed. For more information, see [MCP Servers](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers).

### Machine-to-machine (testing and automated agents)

For backend agents, scripts, or testing without an interactive client, exchange Client credentials directly for a token with the [client credentials flow](https://docs.descope.com/agentic-identity-hub/auth-patterns#autonomous-access).

1. Set the values that the following commands use.
   ```bash
   export DESCOPE_TOKEN_ENDPOINT=<YOUR_TOKEN_ENDPOINT>
   export DESCOPE_CLIENT_ID=<YOUR_CLIENT_ID>
   export DESCOPE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
   export MCP_SERVER_URL=<YOUR_MCP_SERVER_URL>
   ```

   | Variable | Description |
   | -- | -- |
   | `DESCOPE_TOKEN_ENDPOINT` | Copy from the **Connection Information** section of your MCP Server configuration. |
   | `DESCOPE_CLIENT_ID` and `DESCOPE_CLIENT_SECRET` | From the [Client](https://docs.descope.com/agentic-identity-hub/core-components/clients) that you created with the Client Credentials grant type enabled. |
   | `MCP_SERVER_URL` | Must match your MCP Server URL, so that the token's `aud` claim targets your server. |

2. Request a token.
   ```bash
   curl -X POST "$DESCOPE_TOKEN_ENDPOINT" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials" \
     -d "client_id=$DESCOPE_CLIENT_ID" \
     -d "client_secret=$DESCOPE_CLIENT_SECRET" \
     -d "scope=openid read:all" \
     -d "resource=$MCP_SERVER_URL"
   ```

3. Copy the `access_token` from the response, then send it as a bearer token.
   ```bash
   export ACCESS_TOKEN=<TOKEN_FROM_PREVIOUS_RESPONSE>

   curl "$MCP_SERVER_URL" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'
   ```

## Connect an MCP client {#connect}

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway, registers against the pre-registered client in `clientId`, and redirects the user to Descope to log in and consent.

## Role-based authorization {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Descope token in an [authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}) policy. For example, check for a Descope role such as `Tenant Admin`:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: https://api.descope.com/v1/apps/agentic/<YOUR_PROJECT_ID>/<YOUR_SERVER_ID>
    audiences: [<YOUR_MCP_SERVER_URL>]
    provider:
      descope: {}
    resourceMetadata:
      resource: <YOUR_MCP_SERVER_URL>
      scopesSupported:
      - read:all
      bearerMethodsSupported:
      - header
  authorization:
    rules:
    # Check for a specific Descope role
    - '"Tenant Admin" in jwt.roles'
```

> [!NOTE]
> Where the roles claim appears depends on your [Authorization Claims Configuration](https://docs.descope.com/management/token/jwt-templates#authorization-claims-configuration). With the default Descope JWT, roles are in `jwt.tenants["<YOUR TENANT ID>"].roles`. With the No Tenant Reference claim format, roles are in `jwt.roles`.

## Learn more

- [Descope MCP Servers](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers)
- [Descope Clients](https://docs.descope.com/agentic-identity-hub/core-components/clients)
- [Descope MCP authorization](https://docs.descope.com/mcp)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}})

{{< doc-test paths="descope-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="descope-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The Descope mcpAuthentication examples on this page (an agentic issuer,
#     audiences, the descope provider, clientId, and resourceMetadata) are
#     accepted by agentgateway, including the role-based authorization variant.
#   * The test points jwks at a local file instead of letting agentgateway derive
#     the project-level Descope JWKS URL, so it runs without a live Descope project.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The rewrite of the agentic issuer to the project-level JWKS URL, the proxied
#     client registration endpoint, and runtime token verification. Each of these
#     requires a live Descope project and a signed JWT that this page does not
#     stand up.
mkdir -p manifests/jwt
cat <<'EOF' > manifests/jwt/pub-key
{"keys": [{"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256", "n": "teXe4sfDoHQR5YUos3nsY_Ax6J2xrgXnIfUziaTWJ4nljejLVyg8m0g6SK9zrSaCvLm9GxAhpaJ_48RalwqDt4spBPQ8uvr-54jHrECboAbTxhy2T-oXP80Duz0xauSDVlyA_xenoCA24MFJ1rgHppy1F1eYTD-CQ-IxhXLNm5mE3rJufP_pdnMy0q6acXSfPtEzMJY3BYNV5umqimkOgH9PqQWd1RAgYdE7z5fvdCb4T4K667rRRT75PqRB4GJgSY-zQrC4CEVCw_ql7bfdouFcxXwsyh7AfImIEamA1LMODvMXVZWkZ8V0w_VEK6NHqr-BGOBVAUfRqYAEPxfaIw", "e": "AQAB"}]}
EOF
cat <<'EOF' > config-descope.yaml
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins: ["*"]
      allowHeaders: ["*"]
      exposeHeaders: ["Mcp-Session-Id"]
    mcpAuthentication:
      mode: strict
      issuer: https://api.descope.com/v1/apps/agentic/P2abc123/mcp-server
      audiences: [https://mcp.example.com/mcp]
      provider:
        descope: {}
      clientId: my-client-id
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: https://mcp.example.com/mcp
        scopesSupported:
          - read:all
        bearerMethodsSupported:
          - header
    authorization:
      rules:
      - '"Tenant Admin" in jwt.roles'
  targets:
    - name: everything
      stdio:
        cmd: npx
        args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-descope.yaml --validate-only
{{< /doc-test >}}
