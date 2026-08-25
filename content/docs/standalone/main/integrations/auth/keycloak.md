---
title: Keycloak
weight: 20
description: Protect MCP servers with Keycloak as the authorization server.
test:
  keycloak-mcp-authn:
  - path: keycloak-mcp-authn
---

[Keycloak](https://www.keycloak.org/) is an open source identity and access management solution. Agentgateway includes a native `keycloak` MCP authentication provider so that you can use Keycloak as the authorization server for your MCP servers.

In this guide, you run Keycloak locally, configure a realm for MCP clients, protect a sample MCP server with the `keycloak` provider, and verify that agentgateway rejects unauthenticated requests and admits tokens that Keycloak issues.

## Why the Keycloak provider is needed {#why}

MCP clients follow the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization), which relies on OAuth behaviors that Keycloak implements differently. When you set `provider.keycloak`, agentgateway bridges these gaps as follows:

- Fetches keys from `{issuer}/protocol/openid-connect/certs`, the non-standard endpoint that Keycloak uses instead of `{issuer}/.well-known/jwks.json`.
- Serves authorization server metadata from Keycloak's OpenID Connect discovery document, which works across Keycloak versions. Keycloak 26.4.0 and later also serve RFC 8414 metadata at `/.well-known/oauth-authorization-server/realms/<realm>`.
- Proxies Dynamic Client Registration through the gateway. Keycloak 26.5.0 added CORS support on its registration endpoint ([keycloak#8863](https://github.com/keycloak/keycloak/issues/8863)), but it is off by default: you must list the MCP client's origin in the realm's **Allowed Registration Web Origins** client registration policy, or supply web origins with an initial access token. Proxying through the gateway avoids that realm configuration and also works on earlier Keycloak versions.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Before you begin {#before-you-begin}

1. [Install the agentgateway binary]({{< link-hextra path="/setup/install/binary/" >}}).
2. Install [Docker](https://docs.docker.com/get-started/get-docker/) to run Keycloak locally.
3. Install [Node.js](https://nodejs.org/) so that `npx` can run the sample MCP server.

The steps use a local Keycloak instance so that you can complete the guide end to end. To use an existing Keycloak instance instead, skip to [Step 2](#realm) and replace `http://localhost:8080` with your Keycloak URL throughout.

{{< doc-test paths="keycloak-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The full guide runs end to end against a live Keycloak 26.7 container: the
#     kcadm realm, client, audience mapper, role, and user commands in Step 2;
#     the Trusted Hosts policy update in Step 3; and the config in Step 4.
#   * Step 5: an unauthenticated MCP initialize returns 401 with the documented
#     WWW-Authenticate resource_metadata pointer; the protected resource metadata
#     is served; the authorization server metadata rewrites registration_endpoint
#     to the gateway; and Dynamic Client Registration through that endpoint
#     succeeds (which only works if Step 3 was applied).
#   * Step 6: a token minted by Keycloak is accepted and the MCP server responds
#     200, proving the derived JWKS URL and the audience mapper both work.
#   * Step 7: the authorization rule admits the user holding mcp-admin and denies
#     a user without it (403).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The authorization code flow with PKCE that real MCP clients use, and the
#     "Connect an MCP client" section. UI-only step: it requires a browser to
#     complete the Keycloak login and consent redirect.
#   * The Allowed Registration Web Origins policy for browser-based clients.
#     Requires a browser origin and a CORS preflight that curl does not model.
#   * The Docker Compose section. Display-only block: it is an alternative
#     deployment shape, and its issuer differs from the one the steps configure.
#   * The agentgateway UI at localhost:15000 shown in the Step 4 example output.
#     UI-only, with no scriptable equivalent.
{{< /doc-test >}}

{{< doc-test paths="keycloak-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="keycloak-mcp-authn" >}}
# Start from a clean slate so a rerun does not hit "realm already exists".
docker rm -f keycloak >/dev/null 2>&1 || true
{{< /doc-test >}}

## Step 1: Run Keycloak {#keycloak}

1. Start Keycloak in development mode. The `start-dev` command uses an embedded database, which is suitable for testing but not for production.

   ```sh {paths="keycloak-mcp-authn"}
   docker run -d --name keycloak -p 8080:8080 \
     -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
     -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
     quay.io/keycloak/keycloak:{{< reuse "agw-docs/versions/keycloak.md" >}} start-dev
   ```

2. Wait for Keycloak to accept requests.

   ```sh {paths="keycloak-mcp-authn"}
   for i in $(seq 1 60); do
     if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/realms/master)" = "200" ]; then
       echo "Keycloak is ready"
       break
     fi
     sleep 2
   done
   ```

## Step 2: Create the realm, client, and user {#realm}

The following steps use `kcadm.sh`, the Keycloak admin CLI, which ships inside the container.

1. Define a helper so that each command is shorter, then log in.

   ```sh {paths="keycloak-mcp-authn"}
   kcadm() { docker exec keycloak /opt/keycloak/bin/kcadm.sh "$@"; }

   kcadm config credentials --server http://localhost:8080 --realm master \
     --user admin --password admin
   ```

2. Create a realm named `mcp`. The realm name appears in the issuer URL, which takes the form `http://<keycloak-host>/realms/<realm>`.

   ```sh {paths="keycloak-mcp-authn"}
   kcadm create realms -s realm=mcp -s enabled=true -s sslRequired=NONE
   ```

   > [!IMPORTANT]
   > `sslRequired=NONE` is required for this local setup. Keycloak's default of `external` rejects requests that do not arrive over HTTPS or from a local address, and a container reached through a published port does not count as local. Without this setting, every OIDC endpoint returns `403` with `{"error":"invalid_request","error_description":"HTTPS required"}`. Do not use this setting in production.

3. Create a public client for your MCP clients. MCP clients are public clients that use PKCE, because they cannot keep a client secret. The `directAccessGrantsEnabled` setting lets you request a token with a username and password in [Step 6](#token), which keeps the verification steps scriptable.

   ```sh {paths="keycloak-mcp-authn"}
   kcadm create clients -r mcp \
     -s clientId=agentgateway \
     -s publicClient=true \
     -s standardFlowEnabled=true \
     -s directAccessGrantsEnabled=true \
     -s 'redirectUris=["http://localhost:*","http://127.0.0.1:*"]'
   ```

4. Add an audience mapper to the client so that the tokens Keycloak mints carry `agentgateway` in the `aud` claim.

   ```sh {paths="keycloak-mcp-authn"}
   CLIENT_UUID=$(kcadm get clients -r mcp -q clientId=agentgateway \
     --fields id --format csv --noquotes)

   kcadm create "clients/${CLIENT_UUID}/protocol-mappers/models" -r mcp \
     -s name=agentgateway-audience \
     -s protocol=openid-connect \
     -s protocolMapper=oidc-audience-mapper \
     -s 'config."included.client.audience"=agentgateway' \
     -s 'config."access.token.claim"=true'
   ```

   > [!IMPORTANT]
   > The audience mapper is required. By default, Keycloak sets `aud` to `account` and records the client only in the `azp` claim, so the `audiences` value that you configure in [Step 4](#configure) never matches and every request fails validation.

5. Create a realm role and a user to assign it to. You use this role in [Step 7](#authorization).

   ```sh {paths="keycloak-mcp-authn"}
   kcadm create roles -r mcp -s name=mcp-admin

   kcadm create users -r mcp \
     -s username=mcpuser -s enabled=true -s emailVerified=true \
     -s email=mcpuser@example.com -s firstName=MCP -s lastName=User

   kcadm set-password -r mcp --username mcpuser --new-password mcppassword

   kcadm add-roles -r mcp --uusername mcpuser --rolename mcp-admin
   ```

   > [!NOTE]
   > Set the email and name fields when you create the user. Keycloak's default user profile requires them, and a user that is missing them cannot get a token: the token endpoint returns `invalid_grant` with `Account is not fully set up`.

## Step 3: Allow Dynamic Client Registration {#dcr}

MCP clients register themselves with the authorization server instead of using a client ID that you configure by hand. Keycloak's default **Trusted Hosts** policy rejects anonymous registration from every host, so allow the local addresses that your MCP clients use.

1. Get the ID of the realm's **Trusted Hosts** client registration policy.

   ```sh {paths="keycloak-mcp-authn"}
   TRUSTED_HOSTS_ID=$(kcadm get components -r mcp -q name="Trusted Hosts" \
     --fields id --format csv --noquotes)
   ```

2. Update the policy to trust the local addresses.

   ```sh {paths="keycloak-mcp-authn"}
   kcadm update "components/${TRUSTED_HOSTS_ID}" -r mcp \
     -s 'config."trusted-hosts"=["localhost","127.0.0.1"]' \
     -s 'config."host-sending-registration-request-must-match"=["false"]' \
     -s 'config."client-uris-must-match"=["true"]'
   ```

   The following table describes each setting.

   | Setting | Description |
   | ------- | ----------- |
   | `trusted-hosts` | The hosts that may register clients. `client-uris-must-match` also validates redirect URIs against this list, so it must cover the callback addresses that your MCP clients use. |
   | `host-sending-registration-request-must-match` | Must be `false`. Agentgateway proxies registration requests, so Keycloak sees the gateway's address rather than the MCP client's, and the check never matches. |
   | `client-uris-must-match` | Keep `true` so that Keycloak still validates the redirect URIs in each registration request against `trusted-hosts`. |

   If you skip this step, registration through the gateway returns `403` with `Policy 'Trusted Hosts' rejected request to client-registration service`.

## Step 4: Configure and start agentgateway {#configure}

1. Create a `config.yaml` that exposes a sample MCP server on port 3000 and protects it with the `keycloak` provider.

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
         issuer: http://localhost:8080/realms/mcp
         audiences:
         - agentgateway
         provider:
           keycloak: {}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - openid
           bearerMethodsSupported:
           - header
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   | ------- | ----------- |
   | `issuer` | The realm URL, in the form `http://<keycloak-host>/realms/<realm>`. This value must match the `iss` claim in the token. |
   | `audiences` | The audience that your Keycloak realm issues, which is the value that the audience mapper in [Step 2](#realm) adds. Keycloak does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators ([keycloak#10169](https://github.com/keycloak/keycloak/issues/10169)), and agentgateway has no workaround for this, so you must set the audience that the realm already mints. |
   | `provider.keycloak` | Enables the Keycloak-specific behavior described in [Why the Keycloak provider is needed](#why). Takes no fields. |
   | `jwks` | Optional. Because `provider.keycloak` is set, agentgateway derives the JWKS URL from the issuer. To fetch keys from somewhere else, such as a local file or an internal mirror, set `jwks` explicitly to override the derived URL. |

   {{< doc-test paths="keycloak-mcp-authn" >}}
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
         issuer: http://localhost:8080/realms/mcp
         audiences:
         - agentgateway
         provider:
           keycloak: {}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - openid
           bearerMethodsSupported:
           - header
   EOF
   agentgateway -f config.yaml --validate-only
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

   {{< doc-test paths="keycloak-mcp-authn" >}}
   agentgateway -f config.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID 2>/dev/null || true' EXIT
   for i in $(seq 1 30); do
     if curl -s -o /dev/null http://localhost:3000/.well-known/oauth-protected-resource/mcp; then
       break
     fi
     sleep 1
   done
   {{< /doc-test >}}

## Step 5: Verify that unauthenticated requests are rejected {#verify}

Agentgateway runs in the foreground, so run the following commands in another terminal.

1. Send an MCP `initialize` request without a token.

   ```sh {paths="keycloak-mcp-authn"}
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

   ```sh {paths="keycloak-mcp-authn"}
   curl -s http://localhost:3000/.well-known/oauth-protected-resource/mcp
   ```

   Example output:

   ```json
   {"resource":"http://localhost:3000/mcp","authorization_servers":["http://localhost:3000/mcp"],"mcp_protocol_version":"2025-06-18","resource_type":"mcp-server","bearer_methods_supported":["header"],"scopes_supported":["openid"]}
   ```

3. Confirm that agentgateway advertises its own registration endpoint rather than Keycloak's, which is how it proxies Dynamic Client Registration.

   ```sh {paths="keycloak-mcp-authn"}
   curl -s http://localhost:3000/.well-known/oauth-authorization-server
   ```

   The `registration_endpoint` points back at the gateway, while the other endpoints point at Keycloak.

   ```json
   ...
   "registration_endpoint": "http://localhost:3000/.well-known/oauth-authorization-server/client-registration",
   "authorization_endpoint": "http://localhost:8080/realms/mcp/protocol/openid-connect/auth",
   ```

4. Register a client through that endpoint to confirm that the proxy and the policy from [Step 3](#dcr) work together.

   ```sh {paths="keycloak-mcp-authn"}
   curl -s -X POST http://localhost:3000/.well-known/oauth-authorization-server/client-registration \
     -H 'content-type: application/json' \
     -d '{"client_name":"mcp-inspector","redirect_uris":["http://localhost:6274/oauth/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}'
   ```

   Keycloak returns the registered client, including a generated `client_id`.

   ```json
   ...
   "client_id":"42b59ad1-..."
   ```

{{< doc-test paths="keycloak-mcp-authn" >}}
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
- name: Authorization server metadata advertises the gateway registration endpoint
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
      - path: "$.authorization_endpoint"
        comparator: contains
        value: "http://localhost:8080/realms/mcp"
- name: Dynamic Client Registration through the gateway registers a client
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

## Step 6: Call the MCP server with a token {#token}

1. Request a token for `mcpuser`.

   ```sh {paths="keycloak-mcp-authn"}
   export TOKEN="$(curl -s -X POST \
     http://localhost:8080/realms/mcp/protocol/openid-connect/token \
     -d grant_type=password -d client_id=agentgateway \
     -d username=mcpuser -d password=mcppassword -d scope=openid \
     | jq -r .access_token)"
   ```

2. Send the token as a bearer token.

   ```sh {paths="keycloak-mcp-authn"}
   curl -i -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   Agentgateway validates the token against Keycloak's keys and returns the MCP server's response.

   ```
   HTTP/1.1 200 OK
   content-type: text/event-stream
   mcp-session-id: f4d2e962-ae16-4aa4-9199-7db1ed05fba9

   event: message
   data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05", ... ,"serverInfo":{"name":"mcp-servers/everything","title":"Everything Reference Server","version":"2.0.0"}}}
   ```

   > [!TIP]
   > The password grant is a convenience for this guide. Real MCP clients use the authorization code flow with PKCE, which the gateway advertises through the metadata that you inspected in [Step 5](#verify).

{{< doc-test paths="keycloak-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: A Keycloak-issued token is accepted and the MCP server responds
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

## Step 7: Restrict access by realm role {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Keycloak token in an [authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}) policy.

1. Add an `authorization` policy alongside `mcpAuthentication` in your `config.yaml` that requires the `mcp-admin` realm role.

   ```yaml
     policies:
       mcpAuthentication:
         mode: strict
         issuer: http://localhost:8080/realms/mcp
         audiences:
         - agentgateway
         provider:
           keycloak: {}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - openid
           bearerMethodsSupported:
           - header
       authorization:
         rules:
         # Check for the mcp-admin realm role in the token
         - '"mcp-admin" in jwt.realm_access.roles'
   ```

2. Restart agentgateway to apply the policy. Because `mcpuser` has the `mcp-admin` role, the request from [Step 6](#token) still succeeds.

   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="keycloak-mcp-authn" >}}
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
         issuer: http://localhost:8080/realms/mcp
         audiences:
         - agentgateway
         provider:
           keycloak: {}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - openid
           bearerMethodsSupported:
           - header
       authorization:
         rules:
         - '"mcp-admin" in jwt.realm_access.roles'
   EOF
   agentgateway -f config.yaml --validate-only
   kill $AGW_PID 2>/dev/null || true
   sleep 2
   agentgateway -f config.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID 2>/dev/null || true' EXIT
   for i in $(seq 1 30); do
     if curl -s -o /dev/null http://localhost:3000/.well-known/oauth-protected-resource/mcp; then
       break
     fi
     sleep 1
   done
   {{< /doc-test >}}

3. To confirm that the rule is enforced, create a user without the role and repeat the request.

   ```sh {paths="keycloak-mcp-authn"}
   kcadm create users -r mcp \
     -s username=noroleuser -s enabled=true -s emailVerified=true \
     -s email=noroleuser@example.com -s firstName=No -s lastName=Role

   kcadm set-password -r mcp --username noroleuser --new-password mcppassword

   export NO_ROLE_TOKEN="$(curl -s -X POST \
     http://localhost:8080/realms/mcp/protocol/openid-connect/token \
     -d grant_type=password -d client_id=agentgateway \
     -d username=noroleuser -d password=mcppassword -d scope=openid \
     | jq -r .access_token)"

   curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${NO_ROLE_TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   The token is valid, so authentication succeeds, but the authorization rule denies the request with `403`.

   ```
   Created new user with id '3487ca67-...'
   403
   ```

{{< doc-test paths="keycloak-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: The mcp-admin role holder is still allowed
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
- name: A valid token without the mcp-admin role is denied by the authorization rule
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

Point your MCP client at the gateway's MCP endpoint, `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway, registers through the gateway-proxied registration endpoint that you verified in [Step 5](#verify), and redirects the user to Keycloak to log in and consent.

If your MCP client runs in a browser, also add its origin to the realm's **Allowed Registration Web Origins** client registration policy. Keycloak 26.5.0 and later send CORS headers on the registration endpoint only for origins listed in that policy.

## Run agentgateway and Keycloak with Docker Compose {#docker-compose}

To run both as containers instead of running the agentgateway binary on your host, use the following Compose file with the `config.yaml` from [Step 4](#configure) next to it. Set `issuer` to `http://keycloak:8080/realms/mcp` so that agentgateway resolves Keycloak by its service name.

```yaml
services:
  agentgateway:
    image: cr.agentgateway.dev/agentgateway:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/config.yaml:ro
    command: ["-f", "/config.yaml"]
    depends_on:
      - keycloak

  keycloak:
    image: quay.io/keycloak/keycloak:{{< reuse "agw-docs/versions/keycloak.md" >}}
    ports:
      - "8080:8080"
    environment:
      - KC_BOOTSTRAP_ADMIN_USERNAME=admin
      - KC_BOOTSTRAP_ADMIN_PASSWORD=admin
    command: start-dev
```

Because the issuer hostname differs inside and outside the Compose network, tokens that you request from `http://localhost:8080` carry an `iss` claim that does not match. Request tokens from `http://keycloak:8080` instead, such as from another container on the same network.

## Clean up {#cleanup}

Remove the Keycloak container and stop agentgateway.

```sh {paths="keycloak-mcp-authn"}
docker rm -f keycloak
```

## Learn more

- [Keycloak documentation](https://www.keycloak.org/documentation)
- [Keycloak as an MCP authorization server](https://www.keycloak.org/securing-apps/mcp-authz-server)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}})
