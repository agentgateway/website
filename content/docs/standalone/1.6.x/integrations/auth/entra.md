---
title: Microsoft Entra ID
weight: 60
description: Protect MCP servers with Microsoft Entra ID (Azure AD) as the authorization server.
test:
  entra-mcp-authn:
  - path: entra-mcp-authn
---

[Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/) is Microsoft's cloud identity platform. Agentgateway includes a native `entra` MCP authentication provider so that you can use Entra as the authorization server for your MCP servers, even though Entra does not fully implement the OAuth behaviors that the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) assumes.

In this guide, you register an application in Entra, protect a sample MCP server with the `entra` provider, and verify that agentgateway rejects unauthenticated requests and admits tokens that Entra issues.

## Why the Entra provider is needed {#why}

MCP clients such as Claude follow the MCP authorization spec, which relies on OAuth features that Entra handles differently. Without the `entra` provider, you would need to run a separate adapter proxy in front of agentgateway to bridge these gaps.

Entra deviates from the MCP spec in three main ways:

- **It rejects the RFC 8707 `resource` parameter.** MCP clients are required to send `resource`, but Entra's v2.0 endpoints reject it alongside v2-style scopes with `AADSTS9010010: invalid_target`.
- **No Dynamic Client Registration (RFC 7591).** Entra has no client registration endpoint.
- **No RFC 8414 authorization server metadata.** Entra serves only OIDC discovery (`openid-configuration`), not the `oauth-authorization-server` metadata that MCP clients discover through the gateway.

When you set `provider.entra`, agentgateway bridges these gaps as follows:

- Fetches the tenant's v2.0 `openid-configuration` and serves it as RFC 8414 authorization server metadata, injecting `code_challenge_methods_supported: ["S256"]` because Entra supports PKCE but omits it from its discovery document.
- Advertises gateway-proxied `authorize` and `token` endpoints, and strips the `resource` parameter before forwarding requests to Entra.
- Short-circuits Dynamic Client Registration by returning your pre-registered `clientId`. You verify this in [Step 3](#verify).
- Injects a `clientSecret` into proxied token requests for confidential (Web platform) app registrations.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}}).

## Before you begin {#before-you-begin}

1. [Install the agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/" >}}).
2. Install [Node.js](https://nodejs.org/) so that `npx` can run the sample MCP server.
3. Make sure that you have access to a [Microsoft Entra ID tenant](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-create-new-tenant) and permission to register an application in the Microsoft Entra admin center. A free tenant is sufficient for development.

{{< doc-test paths="entra-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * Step 2: the config on this page loads and runs, including
#     the ${...} environment variable references, which agentgateway expands at
#     load time.
#   * Step 3: an unauthenticated MCP initialize returns 401 with the documented
#     WWW-Authenticate resource_metadata pointer; the protected resource metadata
#     is served; and Dynamic Client Registration is short-circuited with the
#     pre-registered clientId, which is the only registration path Entra has.
#   * Step 4: an Entra-shaped token (v2 issuer, api://<client-id> audience) is
#     accepted and the MCP server responds 200.
#   * Step 5: the authorization rule admits a token carrying the mcp.admin app
#     role and denies an otherwise-valid token without it (403).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That Entra itself behaves this way. External dependency not stood up: the
#     test mints Entra-shaped tokens from a local mock signing key rather than
#     from a real tenant.
#   * The bridged authorization server metadata, the proxied authorize and token
#     endpoints, and the stripped resource parameter. Each requires agentgateway
#     to fetch the tenant's openid-configuration from login.microsoftonline.com;
#     the endpoints the entra provider derives are always https on the default
#     port, so they cannot be pointed at a local mock.
#   * The Microsoft Entra admin center steps in Step 1. UI-only: registering the
#     app, exposing the API, and creating the secret have no scriptable
#     equivalent here.
#   * The confidential (Web platform) clientSecret injection described in
#     "Public vs. confidential clients". It only applies on the proxied token
#     endpoint, which this test cannot exercise.
{{< /doc-test >}}

{{< doc-test paths="entra-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Step 1: Register an app in Entra ID {#register}

Register an application in Microsoft Entra ID and collect the values that agentgateway needs.

1. [Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) in the Microsoft Entra admin center. During registration:
   - For **Supported account types**, choose the option that fits your organization. For testing, **Accounts in this organizational directory only** is sufficient.
   - Under **Redirect URI**, add the callback URLs of the MCP clients that you plan to connect. Choose the platform based on the client type:
     - **Mobile and desktop applications** for public clients that use PKCE, such as local MCP clients. Public clients do not require a client secret.
     - **Web** for confidential clients. Entra requires a client secret at the token endpoint for Web-platform apps.

     > [!WARNING]
     > Do not use the **Single-page application (SPA)** platform. Entra redeems SPA-issued authorization codes only through browser cross-origin requests (`AADSTS9002327`), which does not work behind the gateway's token proxy.

2. Expose an API so that tokens can be issued for this app.
   1. Go to your app registration and select **Expose an API**.
   2. Next to **Application ID URI**, click **Set** and accept the default value of `api://<client-id>`.
   3. Click **Add a scope**. Enter a scope name such as `mcp_access`, set **Who can consent** to **Admins and users**, fill in the display name and description, and click **Add scope**. You reference this scope in the `resourceMetadata.scopesSupported` field of your agentgateway config.

3. Add an app role named `mcp.admin` under **App roles**, and assign it to the users or groups that need access. You use this role in [Step 5](#authorization).

4. Save the values that the rest of this guide uses.

   ```sh {paths="entra-mcp-authn"}
   export ENTRA_TENANT_ID='<your-tenant-id>'
   export ENTRA_CLIENT_ID='<your-application-client-id>'
   export ENTRA_CLIENT_SECRET='<your-client-secret-value>'
   export ENTRA_ISSUER="https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0"
   export ENTRA_TOKEN_ENDPOINT="https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/token"
   ```

   | Variable | Where to find it |
   | -------- | ---------------- |
   | `ENTRA_TENANT_ID` | **Overview** > **Directory (tenant) ID**. Agentgateway derives the Entra endpoints from this value. |
   | `ENTRA_CLIENT_ID` | **Overview** > **Application (client) ID**. Tokens issued for this app carry the ID as the audience (`aud`) claim, in the `api://<client-id>` or bare `<client-id>` format. |
   | `ENTRA_CLIENT_SECRET` | **Certificates & secrets** > **Client secrets** > **New client secret**. Save the secret **Value**, not the Secret ID; you cannot retrieve it later. The client credentials request in [Step 4](#token) needs it, and confidential app registrations also need it in the config. See [Public vs. confidential clients](#client-secret). |
   | `ENTRA_ISSUER` | The v2 issuer form. The v1 form `https://sts.windows.net/<tenant-id>/` is also supported; use it when the app registration mints v1 access tokens. |
   | `ENTRA_TOKEN_ENDPOINT` | Derived from the tenant ID. Used to request a token by hand in [Step 4](#token). |

   Agentgateway expands `${...}` references when it loads a configuration file, so the same variables also fill in the `config.yaml` that you create next. If a variable is unset, agentgateway exits with `environment variable not found` rather than starting with a broken configuration.

{{< doc-test paths="entra-mcp-authn" >}}
# The entra provider always derives its endpoints as https on the default port,
# so unlike the other hosted-IdP guides the tenant cannot be replaced with a
# local mock. Keep the documented Entra issuer, which is what lands in the token
# and what the gateway validates against, and point only the signing keys and
# the token endpoint at a local mock that mints Entra-shaped tokens.
export ENTRA_TENANT_ID="11111111-2222-3333-4444-555555555555"
export ENTRA_CLIENT_ID="66666666-7777-8888-9999-000000000000"
export ENTRA_CLIENT_SECRET="mcp-test-secret"
export ENTRA_ISSUER="https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0"
export ENTRA_TOKEN_ENDPOINT="http://localhost:9096/oauth/token"
export ENTRA_JWKS_URL="http://localhost:9096/.well-known/jwks.json"
export MOCK_IDP_PORT=9096
export MOCK_IDP_ISSUER="${ENTRA_ISSUER}"
export MOCK_IDP_CLAIMS='{"roles":["mcp.admin"]}'
{{< /doc-test >}}

{{< doc-test paths="entra-mcp-authn" >}}
{{< reuse "agw-docs/snippets/doc-test-mock-oidc.md" >}}
{{< /doc-test >}}

## Step 2: Configure and start agentgateway {#configure}

1. Create a `config.yaml` file that exposes a sample MCP server on port 3000 and protects it with the `entra` provider.

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
         issuer: ${ENTRA_ISSUER}
         audiences:
         - api://${ENTRA_CLIENT_ID}
         - ${ENTRA_CLIENT_ID}
         provider:
           entra: {}
         clientId: ${ENTRA_CLIENT_ID}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - api://${ENTRA_CLIENT_ID}/mcp_access
           bearerMethodsSupported:
           - header
     targets:
     - name: everything
       stdio:
         cmd: npx
         args: ["@modelcontextprotocol/server-everything"]
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   | ------- | ----------- |
   | `issuer` | The v2 issuer for your tenant. This value must match the `iss` claim in the token. Use the v1 form `https://sts.windows.net/<tenant-id>/` when your app registration mints v1 access tokens. |
   | `audiences` | Both the `api://<client-id>` and bare `<client-id>` formats, so that the `aud` claim matches whether Entra mints a v1 or a v2 token. |
   | `provider.entra` | Enables the Entra-specific behavior described in [Why the Entra provider is needed](#why). Takes no fields. |
   | `clientId` | Your app registration's Application (client) ID. Entra has no Dynamic Client Registration, so agentgateway answers registration requests with this ID. |
   | `clientSecret` | Required only for confidential (Web platform) app registrations. See [Public vs. confidential clients](#client-secret). |
   | `resourceMetadata` | The protected resource metadata that agentgateway serves to MCP clients, which you inspect in [Step 3](#verify). |
   | `jwks` | Optional. When omitted, agentgateway defaults to `https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys`. |

   {{< doc-test paths="entra-mcp-authn" >}}
   # The config from the block above, with jwks pointed at the
   # local mock's keys because the tenant in this test does not exist.
   cat <<'EOF' > config.yaml
   mcp:
     port: 3000
     policies:
       cors:
         allowOrigins: ["*"]
         allowHeaders: ["*"]
         exposeHeaders: ["Mcp-Session-Id"]
       mcpAuthentication:
         mode: strict
         issuer: ${ENTRA_ISSUER}
         audiences:
         - api://${ENTRA_CLIENT_ID}
         - ${ENTRA_CLIENT_ID}
         provider:
           entra: {}
         clientId: ${ENTRA_CLIENT_ID}
         jwks:
           url: ${ENTRA_JWKS_URL}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - api://${ENTRA_CLIENT_ID}/mcp_access
           bearerMethodsSupported:
           - header
     targets:
     - name: everything
       stdio:
         cmd: npx
         args: ["@modelcontextprotocol/server-everything"]
   EOF
   {{< /doc-test >}}

2. Start agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

   Example output:

   ```
   info  state_manager  loaded config from File("config.yaml")
   info  app            serving UI at http://localhost:15000/ui
   info  proxy::gateway started bind  bind="bind/3000"
   ```

   {{< doc-test paths="entra-mcp-authn" >}}
   agentgateway -f config.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID $MOCK_IDP_PID 2>/dev/null || true' EXIT
   for i in $(seq 1 30); do
     if curl -s -o /dev/null http://localhost:3000/.well-known/oauth-protected-resource/mcp; then
       break
     fi
     sleep 1
   done
   {{< /doc-test >}}

## Step 3: Verify that unauthenticated requests are rejected {#verify}

Agentgateway runs in the foreground, so run the following commands in another terminal.

1. Send an MCP `initialize` request without a token.

   ```sh {paths="entra-mcp-authn"}
   curl -i -X POST http://localhost:3000/mcp \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   Agentgateway returns `401` with a `WWW-Authenticate` header that points MCP clients at the protected resource metadata.

   ```
   HTTP/1.1 401 Unauthorized
   www-authenticate: Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"

   {"error":"unauthorized","error_description":"JWT token required"}
   ```

2. Follow that pointer to see the metadata that the gateway serves.

   ```sh {paths="entra-mcp-authn"}
   curl -s http://localhost:3000/.well-known/oauth-protected-resource/mcp
   ```

   Example output:

   ```json
   {"resource":"http://localhost:3000/mcp","authorization_servers":["http://localhost:3000/mcp"],"mcp_protocol_version":"2025-06-18","resource_type":"mcp-server","bearer_methods_supported":["header"],"scopes_supported":["api://<client-id>/mcp_access"]}
   ```

3. Register a client through the gateway. Entra has no registration endpoint at all, so agentgateway answers with your pre-registered `clientId` rather than forwarding the request.

   ```sh {paths="entra-mcp-authn"}
   curl -s -X POST http://localhost:3000/.well-known/oauth-authorization-server/client-registration \
     -H 'content-type: application/json' \
     -d '{"client_name":"mcp-inspector","redirect_uris":["http://localhost:6274/oauth/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}'
   ```

   The response carries the `clientId` from your configuration. Agentgateway advertises `token_endpoint_auth_method: none` so that MCP clients stay public clients that use PKCE, even when your app registration is confidential.

   ```json
   ...
   "client_id":"<your-application-client-id>","token_endpoint_auth_method":"none"
   ```

{{< doc-test paths="entra-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: Unauthenticated MCP initialize is rejected with a resource_metadata pointer
  http:
    url: "http://localhost:3000"
    path: /mcp
    method: POST
    headers:
      content-type: application/json
      accept: "application/json, text/event-stream"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 401
    headers:
      - name: www-authenticate
        comparator: contains
        value: 'resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"'
- name: Protected resource metadata is served for the MCP route
  http:
    url: "http://localhost:3000"
    path: /.well-known/oauth-protected-resource/mcp
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.resource"
        comparator: contains
        value: "http://localhost:3000/mcp"
- name: Registration is short-circuited with the pre-registered clientId
  http:
    url: "http://localhost:3000"
    path: /.well-known/oauth-authorization-server/client-registration
    method: POST
    headers:
      content-type: application/json
    body: |
      {"client_name":"yamltest-client","redirect_uris":["http://localhost:6274/oauth/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}
  source:
    type: local
  expect:
    statusCode: 201
    bodyJsonPath:
      - path: "$.token_endpoint_auth_method"
        comparator: contains
        value: "none"
EOF
# The registered client_id must equal the configured clientId. YAMLTest does not
# expand environment variables inside expectation values, so assert it here.
REGISTERED_CLIENT_ID="$(curl -s -X POST http://localhost:3000/.well-known/oauth-authorization-server/client-registration \
  -H 'content-type: application/json' \
  -d '{"client_name":"shell-check","redirect_uris":["http://localhost:6274/oauth/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}' \
  | jq -r .client_id)"
if [ "${REGISTERED_CLIENT_ID}" != "${ENTRA_CLIENT_ID}" ]; then
  echo "expected client_id ${ENTRA_CLIENT_ID}, got ${REGISTERED_CLIENT_ID}"
  exit 1
fi
echo "registration returned the pre-registered client ID"
{{< /doc-test >}}

## Step 4: Call the MCP server with a token {#token}

MCP clients complete the OAuth flow themselves. To get a token by hand, use the client credentials flow with your app registration.

1. Request a token for your own API. The `scope` uses the `.default` suffix, which is how Entra requests all statically configured permissions for an application.

   ```sh {paths="entra-mcp-authn"}
   export TOKEN="$(curl -s -X POST "${ENTRA_TOKEN_ENDPOINT}" \
     -H 'content-type: application/x-www-form-urlencoded' \
     -d grant_type=client_credentials \
     -d "client_id=${ENTRA_CLIENT_ID}" \
     -d "client_secret=${ENTRA_CLIENT_SECRET}" \
     -d "audience=api://${ENTRA_CLIENT_ID}" \
     -d "scope=api://${ENTRA_CLIENT_ID}/.default" \
     | jq -r .access_token)"
   ```

2. Send the token as a bearer token.

   ```sh {paths="entra-mcp-authn"}
   curl -i -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   Agentgateway validates the token against your tenant's keys and returns the MCP server's response.

   ```
   HTTP/1.1 200 OK
   content-type: text/event-stream
   mcp-session-id: 0511047b-3f97-4dcf-9fec-4457b4c3c229

   event: message
   data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05", ... ,"serverInfo":{"name":"mcp-servers/everything","title":"Everything Reference Server","version":"2.0.0"}}}
   ```

   > [!TIP]
   > The client credentials flow is a convenience for this guide. Real MCP clients use the authorization code flow with PKCE through the gateway-proxied `authorize` and `token` endpoints.

{{< doc-test paths="entra-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: An Entra-issued token is accepted and the MCP server responds
  http:
    url: "http://localhost:3000"
    path: /mcp
    method: POST
    headers:
      authorization: "Bearer ${TOKEN}"
      content-type: application/json
      accept: "application/json, text/event-stream"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

## Step 5: Restrict access by app role {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Entra token in an [authorization]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}}) policy. Entra puts the app roles that you assign in the `roles` claim.

1. Add an `authorization` policy alongside `mcpAuthentication` in your `config.yaml` that requires the `mcp.admin` app role.

   ```yaml
       mcpAuthentication:
         mode: strict
         issuer: ${ENTRA_ISSUER}
         audiences:
         - api://${ENTRA_CLIENT_ID}
         - ${ENTRA_CLIENT_ID}
         provider:
           entra: {}
         clientId: ${ENTRA_CLIENT_ID}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - api://${ENTRA_CLIENT_ID}/mcp_access
           bearerMethodsSupported:
           - header
       authorization:
         rules:
         # Check for an app role assigned in Entra ID
         - '"mcp.admin" in jwt.roles'
   ```

2. Restart agentgateway to apply the policy. Because your app registration holds the `mcp.admin` role, the request from [Step 4](#token) still succeeds.

   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="entra-mcp-authn" >}}
   # Rewrite config.yaml with the authorization policy from the block above, then
   # restart the gateway the same way a reader would.
   cat <<'EOF' > config.yaml
   mcp:
     port: 3000
     policies:
       cors:
         allowOrigins: ["*"]
         allowHeaders: ["*"]
         exposeHeaders: ["Mcp-Session-Id"]
       mcpAuthentication:
         mode: strict
         issuer: ${ENTRA_ISSUER}
         audiences:
         - api://${ENTRA_CLIENT_ID}
         - ${ENTRA_CLIENT_ID}
         provider:
           entra: {}
         clientId: ${ENTRA_CLIENT_ID}
         jwks:
           url: ${ENTRA_JWKS_URL}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - api://${ENTRA_CLIENT_ID}/mcp_access
           bearerMethodsSupported:
           - header
       authorization:
         rules:
         - '"mcp.admin" in jwt.roles'
     targets:
     - name: everything
       stdio:
         cmd: npx
         args: ["@modelcontextprotocol/server-everything"]
   EOF
   kill $AGW_PID 2>/dev/null || true
   sleep 2
   agentgateway -f config.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID $MOCK_IDP_PID 2>/dev/null || true' EXIT
   for i in $(seq 1 30); do
     if curl -s -o /dev/null http://localhost:3000/.well-known/oauth-protected-resource/mcp; then
       break
     fi
     sleep 1
   done
   {{< /doc-test >}}

3. To confirm that the rule is enforced, register a second application in Entra without the `mcp.admin` role assignment. Save its credentials.

   ```sh {paths="entra-mcp-authn"}
   export ENTRA_UNAUTHORIZED_CLIENT_ID='<second-application-client-id>'
   export ENTRA_UNAUTHORIZED_CLIENT_SECRET='<second-client-secret-value>'
   ```

   {{< doc-test paths="entra-mcp-authn" >}}
   # The mock signer omits the configured claims for any client ID that ends in
   # -norole, which stands in for an app without the role assignment.
   export ENTRA_UNAUTHORIZED_CLIENT_ID="mcp-test-client-norole"
   export ENTRA_UNAUTHORIZED_CLIENT_SECRET="mcp-test-secret"
   {{< /doc-test >}}

4. Request a token with that application and repeat the request.

   ```sh {paths="entra-mcp-authn"}
   export NO_ROLE_TOKEN="$(curl -s -X POST "${ENTRA_TOKEN_ENDPOINT}" \
     -H 'content-type: application/x-www-form-urlencoded' \
     -d grant_type=client_credentials \
     -d "client_id=${ENTRA_UNAUTHORIZED_CLIENT_ID}" \
     -d "client_secret=${ENTRA_UNAUTHORIZED_CLIENT_SECRET}" \
     -d "audience=api://${ENTRA_CLIENT_ID}" \
     -d "scope=api://${ENTRA_CLIENT_ID}/.default" \
     | jq -r .access_token)"

   curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${NO_ROLE_TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   The token is valid, so authentication succeeds, but the authorization rule denies the request with `403`.

   ```
   403
   ```

{{< doc-test paths="entra-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: A token carrying the mcp.admin app role is still allowed
  http:
    url: "http://localhost:3000"
    path: /mcp
    method: POST
    headers:
      authorization: "Bearer ${TOKEN}"
      content-type: application/json
      accept: "application/json, text/event-stream"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 200
- name: A valid token without the mcp.admin app role is denied by the authorization rule
  http:
    url: "http://localhost:3000"
    path: /mcp
    method: POST
    headers:
      authorization: "Bearer ${NO_ROLE_TOKEN}"
      content-type: application/json
      accept: "application/json, text/event-stream"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 403
EOF
{{< /doc-test >}}

## Public vs. confidential clients {#client-secret}

Whether you need a `clientSecret` depends on the platform of your Entra app registration:

- **Public clients** (**Mobile and desktop applications** platform with public client flows enabled) authenticate with PKCE only. Omit `clientSecret`, as the configuration in [Step 2](#configure) does. The flow is pure PKCE end to end.
- **Confidential clients** (**Web** platform) require client authentication at the token endpoint in addition to PKCE (`AADSTS7000218` otherwise). Add the `ENTRA_CLIENT_SECRET` that you saved in [Step 1](#register) to your configuration.

  ```yaml
       mcpAuthentication:
         mode: strict
         issuer: ${ENTRA_ISSUER}
         provider:
           entra: {}
         clientId: ${ENTRA_CLIENT_ID}
         clientSecret: ${ENTRA_CLIENT_SECRET}
  ```

  Agentgateway attaches the secret server-side, only to `authorization_code` and `refresh_token` requests for the configured `clientId`.

> [!NOTE]
> `clientSecret` is the credential of your own app registration, not a credential that MCP clients supply. MCP clients always remain public clients that use PKCE: the gateway advertises `token_endpoint_auth_method: none` in the registration response, as you saw in [Step 3](#verify).

## Connect an MCP client {#connect}

Point your MCP client at the gateway's MCP endpoint, `http://localhost:3000/mcp`. The client discovers the bridged authorization server metadata, registers with your pre-configured `clientId`, and completes the OAuth 2.1 authorization code flow with PKCE through Entra. After the user signs in, agentgateway validates the Entra-issued token on each request and enforces any additional route policies.

## Learn more

- [Microsoft identity platform documentation](https://learn.microsoft.com/en-us/entra/identity-platform/)
- [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}})
