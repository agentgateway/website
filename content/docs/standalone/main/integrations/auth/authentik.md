---
title: authentik
weight: 55
description: Integrate agentgateway with authentik for identity management
test:
  authentik-mcp-authn:
  - path: authentik-mcp-authn
---

[authentik](https://goauthentik.io/) is an open-source identity provider. Agentgateway includes a native `authentik` MCP authentication provider so that you can use authentik as the authorization server for your MCP servers.

In this guide, you run authentik locally, create an OAuth provider and application for MCP clients, protect a sample MCP server with the `authentik` provider, and verify that agentgateway rejects unauthenticated requests and admits tokens that authentik issues.

## Why the authentik provider is needed {#why}

MCP clients follow the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization), which relies on OAuth features that authentik handles differently. When you set `provider.authentik`, agentgateway bridges these gaps as follows:

- **Non-standard JWKS path.** authentik serves signing keys at `{issuer}/jwks/` instead of `{issuer}/.well-known/jwks.json`. Agentgateway derives the correct URL from your issuer.
- **Metadata discovery.** Agentgateway fetches authentik's OpenID Connect discovery document at `{issuer}/.well-known/openid-configuration` and serves it to MCP clients as authorization server metadata.
- **No Dynamic Client Registration in open source authentik.** authentik does not implement [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591.html) in its open source builds, so its discovery document reports `registration_endpoint: null`. Agentgateway injects one that points back at the gateway and answers registration requests with the client that you pre-register in `clientId`. authentik 2026.8.0 adds a registration endpoint ([authentik#8751](https://github.com/goauthentik/authentik/issues/8751)), but only as an enterprise feature, so `clientId` remains the path for open source deployments.

> [!IMPORTANT]
> Setting `clientId` is required for open source authentik. Because those builds do not support Dynamic Client Registration, the pre-registered client in `clientId` is the only way for MCP clients to complete registration. If you omit it, registration requests fail.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}}).

## Before you begin {#before-you-begin}

1. [Install the agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/" >}}).
2. Install [Docker](https://docs.docker.com/get-started/get-docker/) to run authentik locally.
3. Install [Node.js](https://nodejs.org/) so that `npx` can run the sample MCP server.
4. Install [jq](https://jqlang.org/) to read values out of authentik's API responses.

The steps use a local authentik instance so that you can complete the guide end to end. To use an existing authentik instance instead, skip to [Step 2](#register) and replace `http://localhost:9000` with your authentik URL throughout.

{{< doc-test paths="authentik-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The full guide runs end to end against a live authentik 2026.5.6 stack: the
#     Compose file in Step 1, the API calls that create the OAuth provider and
#     application in Step 2, the service account in Step 3, and the config in
#     Step 4.
#   * Step 5: an unauthenticated MCP initialize returns 401 with the documented
#     WWW-Authenticate resource_metadata pointer; the gateway derives the
#     {issuer}/jwks/ URL; it injects a registration_endpoint that authentik does
#     not publish; and that endpoint answers with the pre-registered clientId.
#   * Step 6: a token minted by authentik is accepted and the MCP server responds
#     200, proving the derived JWKS URL and the client-ID audience both work.
#   * Step 7: the group rule admits a token carrying the mcp-agent group and
#     denies one that does not (403).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The authorization code flow with PKCE that real MCP clients use, and the
#     "Connect an MCP client" section. UI-only step: it requires a browser to
#     complete the authentik login and consent redirect.
#   * The authentik admin interface at localhost:9000. UI-only, with no
#     scriptable equivalent; every step here uses the API instead.
#   * Enterprise authentik's own Dynamic Client Registration endpoint added in
#     2026.8.0. External dependency: it requires an enterprise license.
{{< /doc-test >}}

{{< doc-test paths="authentik-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="authentik-mcp-authn" >}}
# Start from a clean slate so a rerun does not hit "name already in use".
docker compose down -v >/dev/null 2>&1 || true
{{< /doc-test >}}

## Step 1: Run authentik {#install}

authentik needs PostgreSQL and Redis alongside its server and worker, so run the stack with Docker Compose.

1. Create a `docker-compose.yaml`. The `AUTHENTIK_BOOTSTRAP_*` values create the admin account and an API token on first start, which lets you configure authentik entirely from the API.

   ```yaml
   services:
     postgresql:
       image: docker.io/library/postgres:16-alpine
       container_name: authentik-postgresql
       environment:
         POSTGRES_USER: authentik
         POSTGRES_DB: authentik
         POSTGRES_PASSWORD: authentik-docs-pg
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -d authentik -U authentik"]
         interval: 5s
         timeout: 5s
         retries: 10

     redis:
       image: docker.io/library/redis:alpine
       container_name: authentik-redis

     server:
       image: ghcr.io/goauthentik/server:2026.5.6
       container_name: authentik-server
       command: server
       environment: &ak-env
         AUTHENTIK_POSTGRESQL__HOST: postgresql
         AUTHENTIK_POSTGRESQL__USER: authentik
         AUTHENTIK_POSTGRESQL__NAME: authentik
         AUTHENTIK_POSTGRESQL__PASSWORD: authentik-docs-pg
         AUTHENTIK_REDIS__HOST: redis
         AUTHENTIK_SECRET_KEY: docs-only-secret-key-not-for-production
         AUTHENTIK_BOOTSTRAP_PASSWORD: Admin123!docs
         AUTHENTIK_BOOTSTRAP_TOKEN: docs-bootstrap-token-0123456789
         AUTHENTIK_BOOTSTRAP_EMAIL: admin@example.com
         AUTHENTIK_ERROR_REPORTING__ENABLED: "false"
       ports:
         - "9000:9000"
       depends_on:
         postgresql:
           condition: service_healthy
         redis:
           condition: service_started

     worker:
       image: ghcr.io/goauthentik/server:2026.5.6
       container_name: authentik-worker
       command: worker
       environment: *ak-env
       depends_on:
         postgresql:
           condition: service_healthy
         redis:
           condition: service_started
   ```

   > [!WARNING]
   > These credentials are fixed so that the guide is reproducible. Generate strong values and store them in a secret manager for anything other than local testing.

   {{< doc-test paths="authentik-mcp-authn" >}}
   cat <<'EOF' > docker-compose.yaml
   services:
     postgresql:
       image: docker.io/library/postgres:16-alpine
       container_name: authentik-postgresql
       environment:
         POSTGRES_USER: authentik
         POSTGRES_DB: authentik
         POSTGRES_PASSWORD: authentik-docs-pg
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -d authentik -U authentik"]
         interval: 5s
         timeout: 5s
         retries: 10

     redis:
       image: docker.io/library/redis:alpine
       container_name: authentik-redis

     server:
       image: ghcr.io/goauthentik/server:2026.5.6
       container_name: authentik-server
       command: server
       environment: &ak-env
         AUTHENTIK_POSTGRESQL__HOST: postgresql
         AUTHENTIK_POSTGRESQL__USER: authentik
         AUTHENTIK_POSTGRESQL__NAME: authentik
         AUTHENTIK_POSTGRESQL__PASSWORD: authentik-docs-pg
         AUTHENTIK_REDIS__HOST: redis
         AUTHENTIK_SECRET_KEY: docs-only-secret-key-not-for-production
         AUTHENTIK_BOOTSTRAP_PASSWORD: Admin123!docs
         AUTHENTIK_BOOTSTRAP_TOKEN: docs-bootstrap-token-0123456789
         AUTHENTIK_BOOTSTRAP_EMAIL: admin@example.com
         AUTHENTIK_ERROR_REPORTING__ENABLED: "false"
       ports:
         - "9000:9000"
       depends_on:
         postgresql:
           condition: service_healthy
         redis:
           condition: service_started

     worker:
       image: ghcr.io/goauthentik/server:2026.5.6
       container_name: authentik-worker
       command: worker
       environment: *ak-env
       depends_on:
         postgresql:
           condition: service_healthy
         redis:
           condition: service_started
   EOF
   {{< /doc-test >}}

2. Start the stack.

   ```sh {paths="authentik-mcp-authn"}
   docker compose up -d
   ```

3. Wait for authentik to answer API requests. The server migrates its database on first start, so this takes longer than the containers take to come up.

   ```sh {paths="authentik-mcp-authn"}
   for i in $(seq 1 90); do
     if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:9000/-/health/ready/)" = "200" ]; then
       echo "authentik is ready"
       break
     fi
     sleep 4
   done
   ```

## Step 2: Create an OAuth provider and application {#register}

Create an OAuth2 provider and an application in authentik, and capture the client ID that agentgateway uses. The following steps use the API so that every value you need lands in a shell variable.

1. Set the API base URL and the bootstrap token as an authorization header.

   ```sh {paths="authentik-mcp-authn"}
   export AUTHENTIK_API=http://localhost:9000/api/v3
   export AK_AUTH_HEADER="Authorization: Bearer docs-bootstrap-token-0123456789"
   ```

2. Look up the flow, signing key, and scope IDs that the provider requires. authentik references these objects by primary key rather than by name, and its worker creates them shortly after the server starts answering requests, so retry until all four lookups return a value.

   ```sh {paths="authentik-mcp-authn"}
   for i in $(seq 1 90); do
     export AK_FLOW=$(curl -s -H "${AK_AUTH_HEADER}" \
       "${AUTHENTIK_API}/flows/instances/?slug=default-provider-authorization-implicit-consent" \
       | jq -r '.results[0].pk // empty')

     export AK_INVALIDATION_FLOW=$(curl -s -H "${AK_AUTH_HEADER}" \
       "${AUTHENTIK_API}/flows/instances/?slug=default-invalidation-flow" \
       | jq -r '.results[0].pk // empty')

     export AK_SIGNING_KEY=$(curl -s -H "${AK_AUTH_HEADER}" \
       "${AUTHENTIK_API}/crypto/certificatekeypairs/?has_key=true" \
       | jq -r '.results[0].pk // empty')

     export AK_SCOPES=$(curl -s -H "${AK_AUTH_HEADER}" \
       "${AUTHENTIK_API}/propertymappings/provider/scope/" \
       | jq -c '[.results[] | select(.scope_name=="openid" or .scope_name=="profile" or .scope_name=="email") | .pk]')

     if [ -n "${AK_FLOW}" ] && [ -n "${AK_INVALIDATION_FLOW}" ] \
       && [ -n "${AK_SIGNING_KEY}" ] && [ "$(echo "${AK_SCOPES}" | jq 'length')" -eq 3 ]; then
       echo "authentik finished bootstrapping"
       break
     fi
     sleep 2
   done
   ```

   > [!IMPORTANT]
   > Do not replace this loop with a single pass. `/-/health/ready/` starts returning `200` several seconds before the worker finishes creating the default flows and scope mappings. If the lookups run too early, one of them comes back empty, the provider in the next step fails validation, and `Client ID` prints as `null`.

3. Create a public OAuth2 provider. MCP clients are public clients that use PKCE, because they cannot keep a client secret.

   ```sh {paths="authentik-mcp-authn"}
   export AUTHENTIK_CLIENT_ID=$(curl -s -X POST -H "${AK_AUTH_HEADER}" \
     -H "Content-Type: application/json" "${AUTHENTIK_API}/providers/oauth2/" -d "{
       \"name\": \"agentgateway-mcp\",
       \"authorization_flow\": \"${AK_FLOW}\",
       \"invalidation_flow\": \"${AK_INVALIDATION_FLOW}\",
       \"client_type\": \"public\",
       \"signing_key\": \"${AK_SIGNING_KEY}\",
       \"property_mappings\": ${AK_SCOPES},
       \"grant_types\": [\"authorization_code\", \"refresh_token\", \"client_credentials\"],
       \"redirect_uris\": [{\"matching_mode\": \"regex\", \"url\": \".*\"}],
       \"sub_mode\": \"user_username\",
       \"include_claims_in_id_token\": true
     }" | jq -r '.client_id')

   echo "Client ID: ${AUTHENTIK_CLIENT_ID}"
   ```

   If the client ID prints as `null`, the provider was not created. Re-run the request without the `| jq -r '.client_id'` filter to see the validation error that authentik returned.

   {{< doc-test paths="authentik-mcp-authn" >}}
   # Fail loudly here rather than letting an empty client ID flow into the policy
   # below. An authentik application can be created with no provider, so a failed
   # provider create otherwise stays hidden until token validation fails.
   if [ -z "${AUTHENTIK_CLIENT_ID}" ] || [ "${AUTHENTIK_CLIENT_ID}" = "null" ]; then
     echo "Provider creation failed. Provider list:"
     curl -s -H "${AK_AUTH_HEADER}" "${AUTHENTIK_API}/providers/oauth2/" | jq .
     exit 1
   fi
   {{< /doc-test >}}

   The following table describes the settings that matter for MCP.

   | Setting | Description |
   | ------- | ----------- |
   | `client_type` | Must be `public`. MCP clients cannot keep a client secret, so they authenticate with PKCE instead. |
   | `grant_types` | authentik rejects any grant that is not listed here with `invalid_grant`. `client_credentials` is what lets you mint a token from the command line in [Step 3](#service-account); MCP clients themselves use `authorization_code`. |
   | `property_mappings` | The scopes the provider can issue. The `profile` scope is what puts the `groups` claim in the token, which the rule in [Step 7](#authorization) reads. |
   | `sub_mode` | Sets the `sub` claim to the username, which makes tokens easier to read while testing. |

   > [!WARNING]
   > The `.*` redirect URI matcher accepts **any** callback URL, so that you can connect different MCP clients while you test. Do not use it outside a test environment. An authorization server that accepts any redirect URI lets an attacker intercept authorization codes by sending a victim through a crafted callback. In production, list only the callback URLs of the MCP clients that you allow.

4. Create an application that uses the provider. The application slug appears in the issuer URL.

   ```sh {paths="authentik-mcp-authn"}
   export AK_PROVIDER_PK=$(curl -s -H "${AK_AUTH_HEADER}" \
     "${AUTHENTIK_API}/providers/oauth2/?name=agentgateway-mcp" | jq -r '.results[0].pk')

   curl -s -X POST -H "${AK_AUTH_HEADER}" -H "Content-Type: application/json" \
     "${AUTHENTIK_API}/core/applications/" -d "{
       \"name\": \"agentgateway MCP\",
       \"slug\": \"agentgateway-mcp\",
       \"provider\": ${AK_PROVIDER_PK}
     }" | jq -r '.slug'
   ```

5. Confirm the issuer that authentik now serves. Note the trailing slash, which the `iss` claim also carries.

   ```sh {paths="authentik-mcp-authn"}
   curl -s http://localhost:9000/application/o/agentgateway-mcp/.well-known/openid-configuration \
     | jq '{issuer, jwks_uri, registration_endpoint}'
   ```

   Example output. `registration_endpoint` is `null` because authentik publishes no Dynamic Client Registration endpoint; agentgateway injects one in [Step 5](#verify).

   ```json
   {
     "issuer": "http://localhost:9000/application/o/agentgateway-mcp/",
     "jwks_uri": "http://localhost:9000/application/o/agentgateway-mcp/jwks/",
     "registration_endpoint": null
   }
   ```

## Step 3: Create a service account for testing {#service-account}

Real MCP clients get a token by sending the user through a browser login. To keep the verification steps in this guide scriptable, create a service account and use the `client_credentials` grant instead.

1. Create the service account. Setting `create_group` puts it in a group of the same name, which [Step 7](#authorization) uses for authorization.

   ```sh {paths="authentik-mcp-authn"}
   export AK_SERVICE_ACCOUNT=$(curl -s -X POST -H "${AK_AUTH_HEADER}" \
     -H "Content-Type: application/json" "${AUTHENTIK_API}/core/users/service_account/" \
     -d '{"name": "mcp-agent", "create_group": true, "expiring": false}')

   export AK_SA_USERNAME=$(echo "${AK_SERVICE_ACCOUNT}" | jq -r '.username')
   export AK_SA_PASSWORD=$(echo "${AK_SERVICE_ACCOUNT}" | jq -r '.token')

   echo "Service account: ${AK_SA_USERNAME}"
   ```

   > [!NOTE]
   > authentik returns the service account token only in this response. If you lose it, issue a new app password from **Directory > Tokens** rather than reading the old one back.

## Step 4: Configure and start agentgateway {#configure}

1. Create a `config.yaml` that exposes a sample MCP server on port 3000 and protects it with the `authentik` provider. Substitute the client ID from [Step 2](#register) for `<YOUR_CLIENT_ID>`.

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
         issuer: http://localhost:9000/application/o/agentgateway-mcp/
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

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   | ------- | ----------- |
   | `issuer` | The authentik issuer URL, including the trailing slash. Keep the trailing slash, because this value must match the `iss` claim in the token, and authentik mints that claim with one. Agentgateway derives the JWKS URL as `{issuer}/jwks/` and normalizes any trailing slash first, so you do not need to configure `jwks`. |
   | `audiences` | The OAuth client ID. authentik sets the `aud` claim of its tokens to the client ID rather than to a separate API identifier, so this value must match `clientId`. |
   | `clientId` | The client ID of the public client that you created in authentik. Agentgateway returns this client to MCP clients that attempt Dynamic Client Registration. |

   > [!NOTE]
   > authentik does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html) resource indicators, and unlike Auth0 and Okta, it has no `audience` query parameter workaround. This is why `audiences` must be set to the client ID that authentik puts in the `aud` claim.

   {{< doc-test paths="authentik-mcp-authn" >}}
   cat <<EOF > config.yaml
   mcp:
     port: 3000
     policies:
       cors:
         allowOrigins: ["*"]
         allowHeaders: ["*"]
         exposeHeaders: ["Mcp-Session-Id"]
       mcpAuthentication:
         mode: strict
         issuer: http://localhost:9000/application/o/agentgateway-mcp/
         audiences:
         - ${AUTHENTIK_CLIENT_ID}
         provider:
           authentik: {}
         clientId: ${AUTHENTIK_CLIENT_ID}
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
   EOF
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

2. Start agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="authentik-mcp-authn" >}}
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

   ```sh {paths="authentik-mcp-authn"}
   curl -i -X POST http://localhost:3000/mcp \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   Agentgateway returns `401` with a `WWW-Authenticate` header that points MCP clients at the protected resource metadata.

   ```
   HTTP/1.1 401 Unauthorized
   www-authenticate: Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"
   ```

2. Inspect the authorization server metadata that the gateway serves.

   ```sh {paths="authentik-mcp-authn"}
   curl -s http://localhost:3000/.well-known/oauth-authorization-server \
     | jq '{issuer, jwks_uri, registration_endpoint}'
   ```

   Two of the three adaptations from [Why the authentik provider is needed](#why) are visible here. `jwks_uri` is the derived `{issuer}/jwks/` path, and `registration_endpoint` now points at the gateway even though authentik reported `null` for it in [Step 2](#register).

   ```json
   {
     "issuer": "http://localhost:9000/application/o/agentgateway-mcp/",
     "jwks_uri": "http://localhost:9000/application/o/agentgateway-mcp/jwks/",
     "registration_endpoint": "http://localhost:3000/.well-known/oauth-authorization-server/client-registration"
   }
   ```

3. Register a client against that injected endpoint.

   ```sh {paths="authentik-mcp-authn"}
   curl -s -X POST http://localhost:3000/.well-known/oauth-authorization-server/client-registration \
     -H 'content-type: application/json' \
     -d '{"client_name":"mcp-inspector","redirect_uris":["http://localhost:6274/oauth/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}' \
     | jq '{client_id, token_endpoint_auth_method}'
   ```

   The gateway answers with the client you configured in `clientId` rather than creating a new one in authentik. This is what lets MCP clients that insist on registering themselves complete the flow.

   {{< doc-test paths="authentik-mcp-authn" >}}
   # Assert the returned client_id in the shell rather than in YAMLTest: shell
   # variables are interpolated into YAMLTest urls and request headers, but not
   # into expectation values, so ${AUTHENTIK_CLIENT_ID} would be compared
   # literally.
   AK_REGISTERED_ID=$(curl -s -X POST \
     http://localhost:3000/.well-known/oauth-authorization-server/client-registration \
     -H 'content-type: application/json' \
     -d '{"client_name":"assert-client","redirect_uris":["http://localhost:6274/oauth/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}' \
     | jq -r '.client_id')
   if [ "${AK_REGISTERED_ID}" != "${AUTHENTIK_CLIENT_ID}" ]; then
     echo "registration returned '${AK_REGISTERED_ID}', expected '${AUTHENTIK_CLIENT_ID}'"
     exit 1
   fi
   echo "registration returned the pre-registered client ID"
   {{< /doc-test >}}

## Step 6: Call the MCP server with a token {#token}

1. Request a token for the service account. Include the `profile` scope so that authentik adds the `groups` claim, which [Step 7](#authorization) needs.

   ```sh {paths="authentik-mcp-authn"}
   export TOKEN="$(curl -s -X POST http://localhost:9000/application/o/token/ \
     -d grant_type=client_credentials \
     -d "client_id=${AUTHENTIK_CLIENT_ID}" \
     -d "username=${AK_SA_USERNAME}" \
     -d "password=${AK_SA_PASSWORD}" \
     --data-urlencode 'scope=openid profile' | jq -r .access_token)"
   ```

2. Send the token as a bearer token.

   ```sh {paths="authentik-mcp-authn"}
   curl -i -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   Agentgateway fetches authentik's keys from the derived `{issuer}/jwks/` URL, validates the token, and returns the MCP server's response.

   ```
   HTTP/1.1 200 OK
   content-type: text/event-stream
   mcp-session-id: 05f98776-8671-4f74-a848-fadef397477c

   event: message
   data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05", ... ,"serverInfo":{"name":"mcp-servers/everything","title":"Everything Reference Server","version":"2.0.0"}}}
   ```

   > [!TIP]
   > The `client_credentials` grant is a convenience for this guide. Real MCP clients use the authorization code flow with PKCE, which the gateway advertises through the metadata that you inspected in [Step 5](#verify).

{{< doc-test paths="authentik-mcp-authn" >}}
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
- name: Metadata carries the derived jwks path and an injected registration endpoint
  http:
    url: "http://localhost:3000"
    path: /.well-known/oauth-authorization-server
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.jwks_uri"
        comparator: contains
        value: "/application/o/agentgateway-mcp/jwks/"
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
- name: An authentik-issued token is accepted and the MCP server responds
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

## Step 7: Restrict access by group {#authorization}

authentik includes the user's groups in the token when the request asks for the `profile` scope. Combine those claims with agentgateway [authorization]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}}) rules.

1. Add an `authorization` policy alongside `mcpAuthentication` in your `config.yaml` that requires the `mcp-agent` group.

   ```yaml
     policies:
       mcpAuthentication:
         mode: strict
         issuer: http://localhost:9000/application/o/agentgateway-mcp/
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
       authorization:
         rules:
         # Check for authentik group membership
         - '"mcp-agent" in jwt.groups'
   ```

2. Restart agentgateway to apply the policy. Because the service account is in the `mcp-agent` group, the request from [Step 6](#token) still succeeds.

   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="authentik-mcp-authn" >}}
   # Rewrite config.yaml with the authorization policy from the block above, then
   # restart the gateway the same way a reader would.
   cat <<EOF > config.yaml
   mcp:
     port: 3000
     policies:
       cors:
         allowOrigins: ["*"]
         allowHeaders: ["*"]
         exposeHeaders: ["Mcp-Session-Id"]
       mcpAuthentication:
         mode: strict
         issuer: http://localhost:9000/application/o/agentgateway-mcp/
         audiences:
         - ${AUTHENTIK_CLIENT_ID}
         provider:
           authentik: {}
         clientId: ${AUTHENTIK_CLIENT_ID}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - openid
           - profile
           bearerMethodsSupported:
           - header
       authorization:
         rules:
         - '"mcp-agent" in jwt.groups'
     targets:
     - name: everything
       stdio:
         cmd: npx
         args: ["@modelcontextprotocol/server-everything"]
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

3. To confirm that the rule is enforced, create a second service account in a different group and repeat the request with its token.

   ```sh {paths="authentik-mcp-authn"}
   export AK_GUEST=$(curl -s -X POST -H "${AK_AUTH_HEADER}" \
     -H "Content-Type: application/json" "${AUTHENTIK_API}/core/users/service_account/" \
     -d '{"name": "mcp-guest", "create_group": true, "expiring": false}')

   export GUEST_TOKEN="$(curl -s -X POST http://localhost:9000/application/o/token/ \
     -d grant_type=client_credentials \
     -d "client_id=${AUTHENTIK_CLIENT_ID}" \
     -d "username=$(echo "${AK_GUEST}" | jq -r '.username')" \
     -d "password=$(echo "${AK_GUEST}" | jq -r '.token')" \
     --data-urlencode 'scope=openid profile' | jq -r .access_token)"

   curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${GUEST_TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   The token is valid, so authentication succeeds, but the authorization rule denies the request with `403`.

{{< doc-test paths="authentik-mcp-authn" >}}
YAMLTest -f - <<'EOF'
- name: A token carrying the mcp-agent group is allowed
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
- name: A valid token without the mcp-agent group is denied by the authorization rule
  http:
    url: "http://localhost:3000"
    path: /mcp
    method: POST
    headers:
      authorization: "Bearer ${GUEST_TOKEN}"
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

Point your MCP client at the gateway's MCP endpoint, `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway, registers against the injected endpoint that you verified in [Step 5](#verify), and redirects the user to authentik to log in and consent.

## Clean up {#cleanup}

Remove the authentik stack and stop agentgateway.

```sh {paths="authentik-mcp-authn"}
docker compose down -v
```

## Learn more

- [authentik documentation](https://docs.goauthentik.io/)
- [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}})
