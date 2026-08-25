---
title: Okta
weight: 50
description: Protect MCP servers with Okta as the authorization server.
test:
  okta-mcp-authn:
  - path: okta-mcp-authn
---

[Okta](https://www.okta.com/) is an enterprise identity platform. Agentgateway includes a native `okta` MCP authentication provider so that you can use Okta as the authorization server for your MCP servers.

In this guide, you create an authorization server and app integrations in Okta, protect a sample MCP server with the `okta` provider, and verify that agentgateway rejects unauthenticated requests and admits tokens that Okta issues.

## Why the Okta provider is needed {#why}

MCP clients follow the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization), which relies on OAuth behaviors that Okta implements differently.

When you set `provider.okta`, agentgateway bridges these gaps as follows:

- Serves authorization server metadata from Okta's OpenID Connect discovery document, because Okta does not support the [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) path-based issuer format.
- Appends your first configured audience to Okta's authorization endpoint as an `audience` query parameter, because Okta does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators. You verify this in [Step 3](#verify).
- Proxies Dynamic Client Registration through the gateway, because Okta does not send CORS headers on its registration endpoint. Okta's registration endpoint is relative to your org URL rather than the issuer, so agentgateway rewrites it to `https://<your-org>.okta.com/oauth2/v1/clients`.

> [!IMPORTANT]
> Unlike the other providers, Okta requires you to set `jwks` explicitly. Okta publishes its keys at `{issuer}/v1/keys`, but agentgateway derives `{issuer}/.well-known/jwks.json` for the `okta` provider, which Okta does not serve. If you omit `jwks`, token validation fails because agentgateway cannot fetch the signing keys.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Before you begin {#before-you-begin}

1. [Install the agentgateway binary]({{< link-hextra path="/setup/install/binary/" >}}).
2. Install [Node.js](https://nodejs.org/) so that `npx` can run the sample MCP server.
3. Make sure that you have access to an [Okta org](https://developer.okta.com/signup/) and permission to create an authorization server and app integrations in the Okta Admin Console. A free developer org is sufficient.

{{< doc-test paths="okta-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * Step 2: the config on this page loads and runs, including the ${...}
#     environment variable references, which agentgateway expands at load time,
#     and the explicit jwks.url that the okta provider requires.
#   * Step 3: an unauthenticated MCP initialize returns 401 with the documented
#     WWW-Authenticate resource_metadata pointer; the protected resource metadata
#     is served; the authorization server metadata carries the ?audience= query
#     parameter that the okta provider appends; the registration_endpoint is
#     rewritten to the gateway; and registration through that endpoint reaches
#     the org-relative /oauth2/v1/clients path.
#   * Step 4: a token is accepted and the MCP server responds 200, so the keys
#     really are fetched from the {issuer}/v1/keys URL this page tells you to set.
#   * Step 5: the authorization rule admits a token carrying the AI-Users group
#     and denies an otherwise-valid token without it (403).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That Okta itself behaves this way. External dependency not stood up: the
#     test points the issuer at a local mock authorization server that serves the
#     same discovery, keys, and registration endpoints Okta does, so it exercises
#     agentgateway's provider behavior rather than Okta's.
#   * The Okta Admin Console steps in Step 1. UI-only: creating the
#     authorization server, scopes, and app integrations has no scriptable
#     equivalent here.
#   * The authorization code flow with PKCE that real MCP clients use, and the
#     "Connect an MCP client" section. UI-only: it requires a browser to
#     complete the Okta login and consent redirect.
{{< /doc-test >}}

{{< doc-test paths="okta-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Step 1: Set up Okta {#register}

Create an authorization server and the app integrations that your clients use, then collect the values that agentgateway needs.

1. In the Okta Admin Console, go to **Security > API > Authorization Servers**. Use the built-in `default` server, or add one for your MCP server. Note the **Audience** value on the server's **Settings** tab.

2. On the authorization server's **Scopes** tab, add a scope that your MCP server enforces, such as `agentgateway`.

3. On the authorization server's **Claims** tab, add a `groups` claim so that a user's group memberships appear in the access token. You use this claim in [Step 5](#authorization).

4. Go to **Applications > Applications** and click **Create App Integration**. Select **OIDC - OpenID Connect**, then select **Native Application** for local MCP clients or **Single-Page Application** for browser-based clients. Both are public clients that use PKCE, which is what MCP clients require. Under **Grant type**, select **Authorization Code** and **Refresh Token**. Under **Sign-in redirect URIs**, add the callback URLs of the MCP clients that you plan to connect. Assign the app to the users or groups that need access, then click **Save**.

5. Create a second app integration of type **API Services**, and assign it to a group named `AI-Users`. You use this application to request a token from the command line in [Step 4](#token), which keeps the verification steps scriptable. Note its **Client ID** and **Client Secret**.

6. Save the values that the rest of this guide uses.

   ```sh {paths="okta-mcp-authn"}
   export OKTA_ORG_URL='https://your-org.okta.com'
   export OKTA_ISSUER="${OKTA_ORG_URL}/oauth2/default"
   export OKTA_AUDIENCE='api://agentgateway'
   export OKTA_CLIENT_ID='<your-api-services-client-id>'
   export OKTA_CLIENT_SECRET='<your-api-services-client-secret>'
   ```

   | Variable | Where to find it |
   | -------- | ---------------- |
   | `OKTA_ORG_URL` | Your Okta org URL, including `https://` and with no trailing slash. |
   | `OKTA_ISSUER` | The authorization server URL. Replace `default` if you created your own server. |
   | `OKTA_AUDIENCE` | The **Audience** on the authorization server's **Settings** tab. |
   | `OKTA_CLIENT_ID` and `OKTA_CLIENT_SECRET` | The **General** tab of the API Services application from step 5. |

   Agentgateway expands `${...}` references when it loads a configuration file, so the same variables also fill in the `config.yaml` that you create next. If a variable is unset, agentgateway exits with `environment variable not found` rather than starting with a broken configuration.

   > [!TIP]
   > To confirm the issuer and the JWKS URL for your authorization server, open its metadata document at `${OKTA_ISSUER}/.well-known/openid-configuration` and check the `issuer` and `jwks_uri` fields.

{{< doc-test paths="okta-mcp-authn" >}}
# Point the guide's variables at a local mock authorization server instead of a
# real Okta org. It serves the same discovery, keys, and registration endpoints,
# so agentgateway's okta provider behavior is exercised unchanged.
export OKTA_ORG_URL="http://localhost:9098"
export OKTA_ISSUER="${OKTA_ORG_URL}/oauth2/default"
export OKTA_AUDIENCE="api://agentgateway"
export OKTA_CLIENT_ID="mcp-test-client"
export OKTA_CLIENT_SECRET="mcp-test-secret"
export MOCK_IDP_PORT=9098
export MOCK_IDP_ISSUER="${OKTA_ISSUER}"
export MOCK_IDP_CLAIMS='{"groups":["AI-Users"]}'
{{< /doc-test >}}

{{< doc-test paths="okta-mcp-authn" >}}
{{< reuse "agw-docs/snippets/doc-test-mock-oidc.md" >}}
{{< /doc-test >}}

## Step 2: Configure and start agentgateway {#configure}

1. Create a `config.yaml` file that exposes a sample MCP server on port 3000 and protects it with the `okta` provider.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - mcp:
         targets:
         - name: everything
           stdio:
             cmd: npx
             args: ["@modelcontextprotocol/server-everything"]
     policies:
       mcpAuthentication:
         mode: strict
         issuer: ${OKTA_ISSUER}
         audiences:
         - ${OKTA_AUDIENCE}
         provider:
           okta: {}
         jwks:
           url: ${OKTA_ISSUER}/v1/keys
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - agentgateway
           bearerMethodsSupported:
           - header
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   | ------- | ----------- |
   | `issuer` | The authorization server URL, with no trailing slash. This value must match the `iss` claim in the token. |
   | `audiences` | The **Audience** of your authorization server. The first entry is the value that agentgateway sends to Okta as the `audience` query parameter, so list it first. |
   | `provider.okta` | Enables the Okta-specific behavior described in [Why the Okta provider is needed](#why). Takes no fields. |
   | `jwks.url` | Required for Okta. Set it to `{issuer}/v1/keys`, because the URL that agentgateway derives for the `okta` provider is not a path that Okta serves. |
   | `resourceMetadata` | The protected resource metadata that agentgateway serves to MCP clients, which you inspect in [Step 3](#verify). |

   {{< doc-test paths="okta-mcp-authn" >}}
   cat <<'EOF' > config.yaml
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - mcp:
         targets:
         - name: everything
           stdio:
             cmd: npx
             args: ["@modelcontextprotocol/server-everything"]
     policies:
       mcpAuthentication:
         mode: strict
         issuer: ${OKTA_ISSUER}
         audiences:
         - ${OKTA_AUDIENCE}
         provider:
           okta: {}
         jwks:
           url: ${OKTA_ISSUER}/v1/keys
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - agentgateway
           bearerMethodsSupported:
           - header
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

   {{< doc-test paths="okta-mcp-authn" >}}
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

   ```sh {paths="okta-mcp-authn"}
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

   ```sh {paths="okta-mcp-authn"}
   curl -s http://localhost:3000/.well-known/oauth-protected-resource/mcp
   ```

   Example output:

   ```json
   {"resource":"http://localhost:3000/mcp","authorization_servers":["http://localhost:3000/mcp"],"mcp_protocol_version":"2025-06-18","resource_type":"mcp-server","bearer_methods_supported":["header"],"scopes_supported":["agentgateway"]}
   ```

3. Confirm the two rewrites that the `okta` provider makes to the authorization server metadata.

   ```sh {paths="okta-mcp-authn"}
   curl -s http://localhost:3000/.well-known/oauth-authorization-server
   ```

   The `authorization_endpoint` carries an `audience` query parameter that Okta's own discovery document does not include, and the `registration_endpoint` points back at the gateway rather than at Okta.

   ```json
   ...
   "authorization_endpoint": "https://your-org.okta.com/oauth2/default/v1/authorize?audience=api://agentgateway",
   "registration_endpoint": "http://localhost:3000/.well-known/oauth-authorization-server/client-registration",
   ```

4. Register a client through that endpoint to confirm that the proxy works. Agentgateway forwards the request to your org-relative registration path, `${OKTA_ORG_URL}/oauth2/v1/clients`.

   ```sh {paths="okta-mcp-authn"}
   curl -s -X POST http://localhost:3000/.well-known/oauth-authorization-server/client-registration \
     -H 'content-type: application/json' \
     -d '{"client_name":"mcp-inspector","redirect_uris":["http://localhost:6274/oauth/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}'
   ```

   Okta returns the registered client, including a generated `client_id`.

   ```json
   ...
   "client_id":"0oa1b2c3d4e5f6g7h8i9"
   ```

{{< doc-test paths="okta-mcp-authn" >}}
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
        value: "agentgateway"
- name: The okta provider appends the audience and rewrites the registration endpoint
  http:
    url: "http://localhost:3000"
    path: /.well-known/oauth-authorization-server
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.authorization_endpoint"
        comparator: contains
        value: "?audience=api://agentgateway"
      - path: "$.registration_endpoint"
        comparator: contains
        value: "http://localhost:3000/.well-known/oauth-authorization-server/client-registration"
- name: Dynamic Client Registration through the gateway reaches the org-relative Okta path
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
      - path: "$.client_name"
        comparator: contains
        value: "yamltest-client"
EOF
{{< /doc-test >}}

## Step 4: Call the MCP server with a token {#token}

MCP clients complete the OAuth flow themselves. To get a token by hand, use the client credentials flow with the API Services application from [Step 1](#register).

1. Request a token from your authorization server.

   ```sh {paths="okta-mcp-authn"}
   export TOKEN="$(curl -s -X POST "${OKTA_ISSUER}/v1/token" \
     -H 'content-type: application/x-www-form-urlencoded' \
     -d grant_type=client_credentials \
     -d "client_id=${OKTA_CLIENT_ID}" \
     -d "client_secret=${OKTA_CLIENT_SECRET}" \
     -d "audience=${OKTA_AUDIENCE}" \
     -d scope=agentgateway \
     | jq -r .access_token)"
   ```

2. Send the token as a bearer token.

   ```sh {paths="okta-mcp-authn"}
   curl -i -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   Agentgateway fetches Okta's keys from the `jwks.url` that you configured, validates the token, and returns the MCP server's response.

   ```
   HTTP/1.1 200 OK
   content-type: text/event-stream
   mcp-session-id: 0511047b-3f97-4dcf-9fec-4457b4c3c229

   event: message
   data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05", ... ,"serverInfo":{"name":"mcp-servers/everything","title":"Everything Reference Server","version":"2.0.0"}}}
   ```

   > [!TIP]
   > The client credentials flow is a convenience for this guide. Real MCP clients use the authorization code flow with PKCE, which the gateway advertises through the metadata that you inspected in [Step 3](#verify).

{{< doc-test paths="okta-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: An Okta-issued token is accepted and the MCP server responds
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

## Step 5: Restrict access by group {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Okta token in an [authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}) policy. Okta includes a user's group memberships in the `groups` claim when you add the groups claim to your authorization server, which you did in [Step 1](#register).

1. Add an `authorization` policy alongside `mcpAuthentication` in your `config.yaml` that requires membership in the `AI-Users` group.

   ```yaml
     policies:
       mcpAuthentication:
         mode: strict
         issuer: ${OKTA_ISSUER}
         audiences:
         - ${OKTA_AUDIENCE}
         provider:
           okta: {}
         jwks:
           url: ${OKTA_ISSUER}/v1/keys
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - agentgateway
           bearerMethodsSupported:
           - header
       authorization:
         rules:
         # Check for Okta group membership
         - '"AI-Users" in jwt.groups'
   ```

2. Restart agentgateway to apply the policy. Because the API Services application is assigned to `AI-Users`, the request from [Step 4](#token) still succeeds.

   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="okta-mcp-authn" >}}
   # Rewrite config.yaml with the authorization policy from the block above, then
   # restart the gateway the same way a reader would.
   cat <<'EOF' > config.yaml
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - mcp:
         targets:
         - name: everything
           stdio:
             cmd: npx
             args: ["@modelcontextprotocol/server-everything"]
     policies:
       mcpAuthentication:
         mode: strict
         issuer: ${OKTA_ISSUER}
         audiences:
         - ${OKTA_AUDIENCE}
         provider:
           okta: {}
         jwks:
           url: ${OKTA_ISSUER}/v1/keys
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - agentgateway
           bearerMethodsSupported:
           - header
       authorization:
         rules:
         - '"AI-Users" in jwt.groups'
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

3. To confirm that the rule is enforced, create another **API Services** application that is not assigned to `AI-Users`. Save its credentials.

   ```sh {paths="okta-mcp-authn"}
   export OKTA_UNAUTHORIZED_CLIENT_ID='<second-api-services-client-id>'
   export OKTA_UNAUTHORIZED_CLIENT_SECRET='<second-api-services-client-secret>'
   ```

   {{< doc-test paths="okta-mcp-authn" >}}
   # The mock authorization server omits the configured claims for any client ID
   # that ends in -norole, which stands in for an unassigned application.
   export OKTA_UNAUTHORIZED_CLIENT_ID="mcp-test-client-norole"
   export OKTA_UNAUTHORIZED_CLIENT_SECRET="mcp-test-secret"
   {{< /doc-test >}}

4. Request a token with that application and repeat the request.

   ```sh {paths="okta-mcp-authn"}
   export NO_GROUP_TOKEN="$(curl -s -X POST "${OKTA_ISSUER}/v1/token" \
     -H 'content-type: application/x-www-form-urlencoded' \
     -d grant_type=client_credentials \
     -d "client_id=${OKTA_UNAUTHORIZED_CLIENT_ID}" \
     -d "client_secret=${OKTA_UNAUTHORIZED_CLIENT_SECRET}" \
     -d "audience=${OKTA_AUDIENCE}" \
     -d scope=agentgateway \
     | jq -r .access_token)"

   curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${NO_GROUP_TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   The token is valid, so authentication succeeds, but the authorization rule denies the request with `403`.

   ```
   403
   ```

{{< doc-test paths="okta-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: A token carrying the AI-Users group is still allowed
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
- name: A valid token without the AI-Users group is denied by the authorization rule
  http:
    url: "http://localhost:3000"
    path: /mcp
    method: POST
    headers:
      authorization: "Bearer ${NO_GROUP_TOKEN}"
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

Point your MCP client at the gateway's MCP endpoint, `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway, registers through the gateway-proxied registration endpoint that you verified in [Step 3](#verify), and redirects the user to Okta to log in and consent.

## Learn more

- [Okta developer documentation](https://developer.okta.com/)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}})
