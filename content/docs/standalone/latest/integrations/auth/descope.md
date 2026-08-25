---
title: Descope
weight: 40
description: Protect MCP servers with Descope as the authorization server.
test:
  descope-mcp-authn:
  - path: descope-mcp-authn
---

[Descope](https://www.descope.com/) is an authentication and user management platform. Agentgateway includes a native `descope` MCP authentication provider so that you can use a Descope [MCP Server](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) as the authorization server for your MCP servers.

In this guide, you create a project and an MCP Server in Descope, protect a sample MCP server with the `descope` provider, and verify that agentgateway rejects unauthenticated requests and admits tokens that Descope issues.

## Why the Descope provider is needed {#why}

Descope publishes signing keys at the project level rather than under the agentic issuer that your MCP Server exposes, and its Dynamic Client Registration (DCR) endpoint sits on a separate management path.

When you set `provider.descope`, agentgateway bridges these gaps as follows:

- Rewrites an agentic issuer of the form `https://api.descope.com/v1/apps/agentic/<project-id>/<server-id>` to the project-level JWKS URL `https://api.descope.com/<project-id>/.well-known/jwks.json`.
- Serves authorization server metadata from Descope's OpenID Connect discovery document, because Descope does not support the [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414.html) path-based issuer format.
- Proxies Dynamic Client Registration through the gateway, deriving the management endpoint from the agentic issuer. You verify this in [Step 3](#verify).

Descope supports [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html) resource indicators, so no audience workaround is needed.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Before you begin {#before-you-begin}

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).
2. Install [Node.js](https://nodejs.org/) so that `npx` can run the sample MCP server.
3. Make sure that you have access to the [Descope Console](https://app.descope.com/) and permission to create an MCP Server and a Client.

{{< doc-test paths="descope-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * Step 2: the config on this page loads and runs, including the ${...}
#     environment variable references, which agentgateway expands at load time.
#   * Step 3: an unauthenticated MCP initialize returns 401 with the documented
#     WWW-Authenticate resource_metadata pointer; the protected resource metadata
#     is served; the registration_endpoint is rewritten to the gateway; and
#     registration through that endpoint is answered with the pre-registered
#     clientId rather than being forwarded to Descope's management API.
#   * Step 4: a token is accepted and the MCP server responds 200, against keys
#     fetched over the network from the project-level JWKS path.
#   * Step 5: the authorization rule admits a token carrying the Tenant Admin
#     role and denies an otherwise-valid token without it (403).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That Descope itself behaves this way. External dependency not stood up: the
#     test points the issuer at a local mock authorization server that serves the
#     same discovery and JWKS endpoints Descope does, so it exercises
#     agentgateway's provider behavior rather than Descope's.
#   * The rewrite of the agentic issuer to the project-level JWKS URL. That
#     derivation keeps only the host and drops the port, so it cannot reach a
#     mock on a non-standard port; the test sets jwks explicitly instead. Real
#     Descope is always on api.descope.com:443, where the port is implicit.
#   * The Descope Console steps in Step 1. UI-only: creating the project, the
#     MCP Server, and the Client has no scriptable equivalent here.
#   * The interactive authorization code flow with PKCE and the Descope User
#     Consent Flow. UI-only: they require a browser.
#   * CIMD registration, which is the alternative to setting clientId.
#     Display-only: this guide configures the clientId short-circuit instead.
{{< /doc-test >}}

{{< doc-test paths="descope-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Step 1: Set up Descope {#register}

Create a project and an MCP Server in Descope, then collect the values that agentgateway needs.

1. Create a project in the [Descope Console](https://app.descope.com/), and note your **Project ID** from **Project Settings**. The project ID appears in both your issuer URL and your JWKS URL.

2. Create an [MCP Server](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) to represent your MCP gateway. Set the **MCP Server URL** to the public URL that agentgateway exposes, typically ending with `/mcp`. For this guide, use `http://localhost:3000/mcp`. Define the scopes that your server enforces, such as `read:all`.

   The MCP Server includes a built-in [User Consent Flow](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/settings#user-consent-flow) for interactive, user-delegated access. Customize it under **Server Settings** if you need a different login or consent experience.

3. Copy the **Issuer URL** and the **Token Endpoint** from the MCP Server's **Connection Information** section.

4. Create a [Client](https://docs.descope.com/agentic-identity-hub/core-components/clients#creating-a-client) and note the generated **Client ID**. Enable the [**Client Credentials** grant type](https://docs.descope.com/agentic-identity-hub/core-components/clients#client-credentials) on it and note the **Client Secret**. You use this Client to request a token from the command line in [Step 4](#token), which keeps the verification steps scriptable.

5. Assign the `Tenant Admin` role to the Client. You use this role in [Step 5](#authorization).

6. Save the values that the rest of this guide uses.

   ```sh {paths="descope-mcp-authn"}
   export DESCOPE_PROJECT_ID='<your-project-id>'
   export DESCOPE_SERVER_ID='<your-mcp-server-id>'
   export DESCOPE_ISSUER="https://api.descope.com/v1/apps/agentic/${DESCOPE_PROJECT_ID}/${DESCOPE_SERVER_ID}"
   export DESCOPE_TOKEN_ENDPOINT='<your-token-endpoint>'
   export DESCOPE_CLIENT_ID='<your-client-id>'
   export DESCOPE_CLIENT_SECRET='<your-client-secret>'
   export DESCOPE_MCP_URL='http://localhost:3000/mcp'
   ```

   | Variable | Where to find it |
   | -------- | ---------------- |
   | `DESCOPE_PROJECT_ID` | **Project Settings** in the Descope Console. |
   | `DESCOPE_SERVER_ID` | The last path segment of the **Issuer URL** in **Connection Information**. |
   | `DESCOPE_ISSUER` | Derived from the two IDs. It must match the **Issuer URL** shown in **Connection Information**. |
   | `DESCOPE_TOKEN_ENDPOINT` | **Connection Information** on your MCP Server. |
   | `DESCOPE_CLIENT_ID` and `DESCOPE_CLIENT_SECRET` | The Client that you created in step 4. |
   | `DESCOPE_MCP_URL` | Your MCP Server URL. Tokens carry it in the `aud` claim, so it must match what you set in step 2. |

   Agentgateway expands `${...}` references when it loads a configuration file, so the same variables also fill in the `config.yaml` that you create next. If a variable is unset, agentgateway exits with `environment variable not found` rather than starting with a broken configuration.

{{< doc-test paths="descope-mcp-authn" >}}
# Point the guide's variables at a local mock authorization server instead of a
# real Descope project. It serves the same discovery and JWKS endpoints, and it
# answers the project-level JWKS path that the descope provider derives from the
# agentic issuer, so that rewrite is exercised unchanged.
export DESCOPE_PROJECT_ID="P2test"
export DESCOPE_SERVER_ID="mcp-server"
export DESCOPE_ISSUER="http://localhost:9097/v1/apps/agentic/${DESCOPE_PROJECT_ID}/${DESCOPE_SERVER_ID}"
export DESCOPE_TOKEN_ENDPOINT="${DESCOPE_ISSUER}/oauth/token"
export DESCOPE_CLIENT_ID="mcp-test-client"
export DESCOPE_CLIENT_SECRET="mcp-test-secret"
export DESCOPE_MCP_URL="http://localhost:3000/mcp"
# The descope provider derives the project-level JWKS URL from the agentic
# issuer, but that derivation keeps only the host and drops the port, so a mock
# on a non-standard port cannot be reached that way. Real Descope is always on
# api.descope.com:443, where this does not apply. Override jwks for the test.
export DESCOPE_JWKS_URL="http://localhost:9097/${DESCOPE_PROJECT_ID}/.well-known/jwks.json"
export MOCK_IDP_PORT=9097
export MOCK_IDP_ISSUER="${DESCOPE_ISSUER}"
export MOCK_IDP_CLAIMS='{"roles":["Tenant Admin"]}'
{{< /doc-test >}}

{{< doc-test paths="descope-mcp-authn" >}}
{{< reuse "agw-docs/snippets/doc-test-mock-oidc.md" >}}
{{< /doc-test >}}

## Step 2: Configure and start agentgateway {#configure}

1. Create a `config.yaml` file that exposes a sample MCP server on port 3000 and protects it with the `descope` provider.

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
         issuer: ${DESCOPE_ISSUER}
         audiences:
         - ${DESCOPE_MCP_URL}
         provider:
           descope: {}
         clientId: ${DESCOPE_CLIENT_ID}
         resourceMetadata:
           resource: ${DESCOPE_MCP_URL}
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

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   | ------- | ----------- |
   | `issuer` | The full issuer URL from the **Connection Information** section of your MCP Server. Descope agentic issuers take the form `https://api.descope.com/v1/apps/agentic/<project-id>/<server-id>`. |
   | `audiences` | Your MCP server's public URL. This value must match the `aud` claim in Descope-issued tokens, which equals your MCP server's resource URL. |
   | `provider.descope` | Enables the Descope-specific behavior described in [Why the Descope provider is needed](#why). Takes no fields. |
   | `clientId` | A pre-registered [Client](https://docs.descope.com/agentic-identity-hub/core-components/clients) ID. Descope's Dynamic Client Registration endpoint requires a management key that MCP clients do not have, so agentgateway answers registration requests with this pre-registered client instead. To let clients register dynamically through Descope, omit `clientId` and use [CIMD](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/registration-methods#client-id-metadata-documents-cimd) instead. |
   | `resourceMetadata` | The protected resource metadata that agentgateway serves to MCP clients, which you inspect in [Step 3](#verify). |
   | `jwks` | Optional. Because `provider.descope` is set, agentgateway rewrites the agentic issuer to the project-level JWKS URL. To fetch keys from somewhere else, set `jwks` explicitly to override the derived URL. |

   {{< doc-test paths="descope-mcp-authn" >}}
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
         issuer: ${DESCOPE_ISSUER}
         audiences:
         - ${DESCOPE_MCP_URL}
         provider:
           descope: {}
         clientId: ${DESCOPE_CLIENT_ID}
         jwks:
           url: ${DESCOPE_JWKS_URL}
         resourceMetadata:
           resource: ${DESCOPE_MCP_URL}
           scopesSupported:
             - read:all
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

   {{< doc-test paths="descope-mcp-authn" >}}
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

   ```sh {paths="descope-mcp-authn"}
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

   ```sh {paths="descope-mcp-authn"}
   curl -s http://localhost:3000/.well-known/oauth-protected-resource/mcp
   ```

   Example output:

   ```json
   {"resource":"http://localhost:3000/mcp","authorization_servers":["http://localhost:3000/mcp"],"mcp_protocol_version":"2025-06-18","resource_type":"mcp-server","bearer_methods_supported":["header"],"scopes_supported":["read:all"]}
   ```

3. Confirm that agentgateway advertises its own registration endpoint rather than Descope's management path.

   ```sh {paths="descope-mcp-authn"}
   curl -s http://localhost:3000/.well-known/oauth-authorization-server
   ```

   The `registration_endpoint` points back at the gateway, while the other endpoints point at Descope.

   ```json
   ...
   "registration_endpoint": "http://localhost:3000/.well-known/oauth-authorization-server/client-registration",
   "token_endpoint": "https://api.descope.com/oauth2/v1/apps/token",
   ```

4. Register a client through that endpoint. Because `clientId` is set, agentgateway answers with your pre-registered Client instead of calling Descope's management API, which would require a management key that MCP clients do not have.

   ```sh {paths="descope-mcp-authn"}
   curl -s -X POST http://localhost:3000/.well-known/oauth-authorization-server/client-registration \
     -H 'content-type: application/json' \
     -d '{"client_name":"mcp-inspector","redirect_uris":["http://localhost:6274/oauth/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}'
   ```

   The response carries the `clientId` from your configuration.

   ```json
   ...
   "client_id":"<your-client-id>","token_endpoint_auth_method":"none"
   ```

{{< doc-test paths="descope-mcp-authn" >}}
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
      - path: "$.scopes_supported[0]"
        comparator: contains
        value: "read:all"
- name: The descope provider rewrites the registration endpoint to the gateway
  http:
    url: "http://localhost:3000"
    path: /.well-known/oauth-authorization-server
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.registration_endpoint"
        comparator: contains
        value: "http://localhost:3000/.well-known/oauth-authorization-server/client-registration"
- name: Registration is answered with the pre-registered clientId
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
if [ "${REGISTERED_CLIENT_ID}" != "${DESCOPE_CLIENT_ID}" ]; then
  echo "expected client_id ${DESCOPE_CLIENT_ID}, got ${REGISTERED_CLIENT_ID}"
  exit 1
fi
echo "registration returned the pre-registered client ID"
{{< /doc-test >}}

## Step 4: Call the MCP server with a token {#token}

How a client gets a token depends on whether it acts for a user or on its own behalf.

Interactive MCP clients such as Claude or Cursor handle this automatically with the OAuth 2.1 authorization code flow and PKCE. The client discovers your MCP Server's OAuth endpoints, registers through CIMD or DCR, and redirects the user through Descope's User Consent Flow to approve scopes. No manual token request is needed.

For backend agents, scripts, or testing without an interactive client, exchange Client credentials directly for a token with the [client credentials flow](https://docs.descope.com/agentic-identity-hub/auth-patterns#autonomous-access).

1. Request a token. The `resource` parameter is Descope's [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html) resource indicator, which targets the token's `aud` claim at your MCP server.

   ```sh {paths="descope-mcp-authn"}
   export TOKEN="$(curl -s -X POST "${DESCOPE_TOKEN_ENDPOINT}" \
     -H 'content-type: application/x-www-form-urlencoded' \
     -d grant_type=client_credentials \
     -d "client_id=${DESCOPE_CLIENT_ID}" \
     -d "client_secret=${DESCOPE_CLIENT_SECRET}" \
     -d "scope=openid read:all" \
     -d "resource=${DESCOPE_MCP_URL}" \
     | jq -r .access_token)"
   ```

2. Send the token as a bearer token.

   ```sh {paths="descope-mcp-authn"}
   curl -i -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   Agentgateway resolves the project-level JWKS URL from your agentic issuer, validates the token, and returns the MCP server's response.

   ```
   HTTP/1.1 200 OK
   content-type: text/event-stream
   mcp-session-id: 0511047b-3f97-4dcf-9fec-4457b4c3c229

   event: message
   data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05", ... ,"serverInfo":{"name":"mcp-servers/everything","title":"Everything Reference Server","version":"2.0.0"}}}
   ```

{{< doc-test paths="descope-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: A Descope-issued token is accepted and the MCP server responds
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

## Step 5: Restrict access by role {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Descope token in an [authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}) policy.

1. Add an `authorization` policy alongside `mcpAuthentication` in your `config.yaml` that requires the `Tenant Admin` role.

   ```yaml
     policies:
       mcpAuthentication:
         mode: strict
         issuer: ${DESCOPE_ISSUER}
         audiences:
         - ${DESCOPE_MCP_URL}
         provider:
           descope: {}
         clientId: ${DESCOPE_CLIENT_ID}
         resourceMetadata:
           resource: ${DESCOPE_MCP_URL}
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
   > Where the roles claim appears depends on your [Authorization Claims Configuration](https://docs.descope.com/management/token/jwt-templates#authorization-claims-configuration). With the default Descope JWT, roles are in `jwt.tenants["<YOUR TENANT ID>"].roles`. With the No Tenant Reference claim format, roles are in `jwt.roles`, which is what this rule uses.

2. Restart agentgateway to apply the policy. Because the Client holds the `Tenant Admin` role, the request from [Step 4](#token) still succeeds.

   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="descope-mcp-authn" >}}
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
         issuer: ${DESCOPE_ISSUER}
         audiences:
         - ${DESCOPE_MCP_URL}
         provider:
           descope: {}
         clientId: ${DESCOPE_CLIENT_ID}
         jwks:
           url: ${DESCOPE_JWKS_URL}
         resourceMetadata:
           resource: ${DESCOPE_MCP_URL}
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

3. To confirm that the rule is enforced, create another Client in Descope without the `Tenant Admin` role. Save its credentials.

   ```sh {paths="descope-mcp-authn"}
   export DESCOPE_UNAUTHORIZED_CLIENT_ID='<second-client-id>'
   export DESCOPE_UNAUTHORIZED_CLIENT_SECRET='<second-client-secret>'
   ```

   {{< doc-test paths="descope-mcp-authn" >}}
   # The mock authorization server omits the configured claims for any client ID
   # that ends in -norole, which stands in for a Client without the role.
   export DESCOPE_UNAUTHORIZED_CLIENT_ID="mcp-test-client-norole"
   export DESCOPE_UNAUTHORIZED_CLIENT_SECRET="mcp-test-secret"
   {{< /doc-test >}}

4. Request a token with that Client and repeat the request.

   ```sh {paths="descope-mcp-authn"}
   export NO_ROLE_TOKEN="$(curl -s -X POST "${DESCOPE_TOKEN_ENDPOINT}" \
     -H 'content-type: application/x-www-form-urlencoded' \
     -d grant_type=client_credentials \
     -d "client_id=${DESCOPE_UNAUTHORIZED_CLIENT_ID}" \
     -d "client_secret=${DESCOPE_UNAUTHORIZED_CLIENT_SECRET}" \
     -d "scope=openid read:all" \
     -d "resource=${DESCOPE_MCP_URL}" \
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

{{< doc-test paths="descope-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: A token carrying the Tenant Admin role is still allowed
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
- name: A valid token without the Tenant Admin role is denied by the authorization rule
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

## Connect an MCP client {#connect}

Point your MCP client at the gateway's MCP endpoint, `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway, registers against the pre-registered client in `clientId` as you verified in [Step 3](#verify), and redirects the user to Descope to log in and consent.

## Learn more

- [Descope MCP Servers](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers)
- [Descope Clients](https://docs.descope.com/agentic-identity-hub/core-components/clients)
- [Descope MCP authorization](https://docs.descope.com/mcp)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}})
