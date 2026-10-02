Secure your Model Context Protocol (MCP) servers with OAuth 2.0 authentication by using agentgateway and [authentik](https://goauthentik.io/) as the identity provider.

## About this guide

In this guide, you configure the agentgateway proxy to protect a static MCP server with MCP auth by using authentik as the authorization server. Because authentik does not fully implement the OAuth behaviors that the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) assumes, agentgateway includes a native `Authentik` provider that bridges the gaps. When you set `provider: Authentik`, agentgateway serves authorization server metadata from authentik's OpenID Connect discovery document. Agentgateway also injects a Dynamic Client Registration (DCR) endpoint that authentik does not provide, and answers registration requests with the client that you pre-register.

> [!IMPORTANT]
> Setting `clientId` is required for open source authentik. Those builds do not implement Dynamic Client Registration ([RFC 7591](https://www.rfc-editor.org/rfc/rfc7591.html)), so the pre-registered client in `clientId` is the only way for MCP clients to complete registration. If you omit it, registration requests fail. authentik 2026.8.0 adds a registration endpoint ([authentik#8751](https://github.com/goauthentik/authentik/issues/8751)), but only as an enterprise feature.

For more information about MCP auth, see the [About MCP auth]({{< link-hextra path="/documentation/mcp/auth/about/" >}}) page.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
2. Follow the steps to set up an [MCP server with a fetch tool]({{< link-hextra path="/documentation/mcp/static-mcp/" >}}).
3. Install the experimental channel Gateway API.
   ```sh {paths="setup-authentik"}
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```

## Install authentik {#install}

Install authentik in your cluster to act as the authorization server. The following steps install a minimal authentik instance that is enough to try out MCP auth. For production installs, sizing guidance, and the full set of Helm values, see the [authentik Kubernetes installation docs](https://docs.goauthentik.io/install-config/install/kubernetes/).

1. Add the authentik Helm repository.
   ```sh {paths="setup-authentik"}
   helm repo add authentik https://charts.goauthentik.io
   helm repo update authentik
   ```

2. Set the credentials that bootstrap the authentik admin account and API token. In a production environment, generate strong values and store them in a secret manager.
   ```sh {paths="setup-authentik"}
   export AUTHENTIK_SECRET_KEY=$(openssl rand -base64 36 | tr -d '\n')
   export AUTHENTIK_BOOTSTRAP_PASSWORD='Admin123!docs'
   export AUTHENTIK_BOOTSTRAP_TOKEN='docs-bootstrap-token-0123456789'
   ```

3. Install authentik with the bundled PostgreSQL and Redis dependencies. The `authentik.postgresql.password` value must match `postgresql.auth.password` so that the authentik server can connect to its database.
   ```sh {paths="setup-authentik"}
   helm upgrade --install authentik authentik/authentik \
     --namespace authentik --create-namespace \
     --version 2026.5.6 \
     --timeout 15m \
     --set authentik.secret_key="${AUTHENTIK_SECRET_KEY}" \
     --set authentik.bootstrap_password="${AUTHENTIK_BOOTSTRAP_PASSWORD}" \
     --set authentik.bootstrap_token="${AUTHENTIK_BOOTSTRAP_TOKEN}" \
     --set authentik.bootstrap_email='admin@example.com' \
     --set authentik.error_reporting.enabled=false \
     --set authentik.postgresql.password='authentik-docs-pg' \
     --set postgresql.enabled=true \
     --set postgresql.auth.password='authentik-docs-pg' \
     --set postgresql.auth.postgresPassword='authentik-docs-pg' \
     --set redis.enabled=true \
     --set redis.auth.enabled=false
   ```

4. Wait for the authentik server to become available. The server does not accept API requests until it finishes migrating its database, which can take several minutes on a first install.
   ```sh {paths="setup-authentik"}
   kubectl wait --for=condition=Available deployment/authentik-server \
     -n authentik --timeout=15m
   ```

5. Verify that the authentik pods are running.
   ```sh {paths="setup-authentik"}
   kubectl get pods -n authentik
   ```

   Example output:
   ```
   NAME                                READY   STATUS    RESTARTS   AGE
   authentik-postgresql-0              1/1     Running   0          2m
   authentik-server-564544fd8d-4lzw8   1/1     Running   0          1m
   authentik-worker-7ccdd7cb6f-bf2qp   1/1     Running   0          1m
   ```

## Create an OAuth provider and application in authentik {#register}

Create an OAuth2 provider and an application in authentik, and capture the client ID that agentgateway uses.

1. Expose the authentik API so that you can administer it from outside the cluster. The Helm chart gives the authentik server a ClusterIP Service, which agentgateway uses from inside the cluster. This extra Service is only for the administrative API calls in the following steps.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh {paths="setup-authentik"}
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: authentik-admin
     namespace: authentik
   spec:
     type: LoadBalancer
     selector:
       app.kubernetes.io/name: authentik
       app.kubernetes.io/instance: authentik
       app.kubernetes.io/component: server
     ports:
     - name: http
       port: 9000
       targetPort: 9000
   EOF
   ```

   > [!NOTE]
   > The Service listens on port 9000 rather than 80 on purpose. A local `kind` cluster publishes each LoadBalancer Service on the matching port of your workstation, so a second Service on port 80 collides with the gateway's own LoadBalancer and never receives an address.

   ```sh {paths="setup-authentik"}
   export AUTHENTIK_ADDRESS=$(kubectl get svc -n authentik authentik-admin \
     -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}"):9000

   echo "authentik address: $AUTHENTIK_ADDRESS"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   If your cluster does not assign LoadBalancer addresses, port-forward the authentik server instead.

   ```sh
   kubectl port-forward -n authentik svc/authentik-server 9000:80 &
   export AUTHENTIK_ADDRESS=localhost:9000
   ```
   {{% /tab %}}
   {{< /tabs >}}

{{< doc-test paths="setup-authentik" >}}
# Wait for the LoadBalancer to assign an address to the authentik-admin Service,
# then poll the API until it answers. A ready Deployment is not enough on its own:
# authentik finishes migrating its database before it serves API requests, and the
# LoadBalancer address is assigned independently of pod readiness.
YAMLTest -f - <<'EOF'
- name: wait for the authentik-admin LoadBalancer address
  wait:
    target:
      kind: Service
      metadata:
        namespace: authentik
        name: authentik-admin
    jsonPath: "$.status.loadBalancer.ingress[0].ip"
    jsonPathExpectation:
      comparator: exists
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF

export AUTHENTIK_ADDRESS=$(kubectl get svc -n authentik authentik-admin \
  -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}"):9000
for i in $(seq 1 90); do
  curl -s --max-time 5 -o /dev/null "http://${AUTHENTIK_ADDRESS}/api/v3/root/config/" && break
  sleep 2
done
{{< /doc-test >}}

2. Look up the flow, signing key, and scope IDs that the provider requires. The authentik worker creates the default flows, scope mappings, and self-signed signing certificate in the background, after the server starts answering API requests. Until that finishes, these lookups return no results, so the following commands retry until every value resolves.
   ```sh {paths="setup-authentik"}
   export AUTHENTIK_API=http://${AUTHENTIK_ADDRESS}/api/v3
   export AK_AUTH_HEADER="Authorization: Bearer ${AUTHENTIK_BOOTSTRAP_TOKEN}"

   for i in $(seq 1 60); do
     export AK_FLOW=$(curl -s -H "${AK_AUTH_HEADER}" \
       "${AUTHENTIK_API}/flows/instances/?slug=default-provider-authorization-implicit-consent" | jq -r '.results[0].pk // empty')
     export AK_INVALIDATION_FLOW=$(curl -s -H "${AK_AUTH_HEADER}" \
       "${AUTHENTIK_API}/flows/instances/?slug=default-invalidation-flow" | jq -r '.results[0].pk // empty')
     export AK_SIGNING_KEY=$(curl -s -H "${AK_AUTH_HEADER}" \
       "${AUTHENTIK_API}/crypto/certificatekeypairs/?has_key=true" | jq -r '.results[0].pk // empty')
     export AK_SCOPES=$(curl -s -H "${AK_AUTH_HEADER}" \
       "${AUTHENTIK_API}/propertymappings/provider/scope/" \
       | jq -c '[.results[] | select(.scope_name=="openid" or .scope_name=="profile" or .scope_name=="email") | .pk]')

     AK_SCOPE_COUNT=$(echo "${AK_SCOPES}" | jq 'length' 2>/dev/null || echo 0)

     if [ -n "${AK_FLOW}" ] && [ -n "${AK_INVALIDATION_FLOW}" ] \
       && [ -n "${AK_SIGNING_KEY}" ] && [ "${AK_SCOPE_COUNT}" -eq 3 ]; then
       echo "authentik finished bootstrapping"
       break
     fi
     sleep 5
   done

   echo "Authorization flow: ${AK_FLOW}"
   echo "Invalidation flow:  ${AK_INVALIDATION_FLOW}"
   echo "Signing key:        ${AK_SIGNING_KEY}"
   echo "Scopes:             ${AK_SCOPES}"
   ```

   > [!IMPORTANT]
   > Do not replace this loop with a single pass. The authentik server answers API requests several seconds before the worker finishes creating the default flows, scope mappings, and signing certificate. If the lookups run too early, one of them comes back empty, the provider in the next step fails validation, and the client ID comes back empty.

   If any of these values are still empty after the loop finishes, check the authentik worker logs with `kubectl logs -n authentik deployment/authentik-worker`, and verify that `AUTHENTIK_BOOTSTRAP_TOKEN` matches the value that you installed authentik with.

{{< doc-test paths="setup-authentik" >}}
# Fail here rather than in the provider request below, so that a slow authentik
# bootstrap is reported as a missing flow, key, or scope instead of an empty client ID.
AK_SCOPE_COUNT=$(echo "${AK_SCOPES:-[]}" | jq 'length' 2>/dev/null || echo 0)
if [ -z "${AK_FLOW:-}" ] || [ -z "${AK_INVALIDATION_FLOW:-}" ] \
  || [ -z "${AK_SIGNING_KEY:-}" ] || [ "${AK_SCOPE_COUNT}" -ne 3 ]; then
  echo "authentik did not finish creating its default objects in time"
  echo "  flow=${AK_FLOW:-} invalidation_flow=${AK_INVALIDATION_FLOW:-} signing_key=${AK_SIGNING_KEY:-} scopes=${AK_SCOPES:-}"
  kubectl logs -n authentik deployment/authentik-worker --tail=50 || true
  exit 1
fi
{{< /doc-test >}}

3. Create a public OAuth2 provider. MCP clients are public clients that use PKCE, because they cannot keep a client secret.
   ```sh {paths="setup-authentik"}
   export AK_PROVIDER_RESPONSE=$(curl -s -X POST -H "${AK_AUTH_HEADER}" -H "Content-Type: application/json" \
     "${AUTHENTIK_API}/providers/oauth2/" -d "{
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
     }")

   export AUTHENTIK_CLIENT_ID=$(echo "${AK_PROVIDER_RESPONSE}" | jq -r '.client_id // empty')

   echo "Client ID: ${AUTHENTIK_CLIENT_ID}"
   ```

   If the client ID is empty, the provider was not created. Print `${AK_PROVIDER_RESPONSE}` to see the error that authentik returned, and check that `AUTHENTIK_ADDRESS` still resolves and that `AUTHENTIK_BOOTSTRAP_TOKEN` matches the value you installed authentik with.

   The following table describes the settings that matter for MCP.

   | Setting | Description |
   | -- | -- |
   | `client_type` | Must be `public`. MCP clients run in places where a client secret cannot be kept confidential, such as a desktop app or a browser, so they prove their identity with PKCE instead of a secret. The client ID is not a secret. It is a public identifier that clients send in plain text on every authorization request, so it is safe to store in an MCP client's configuration. |
   | `property_mappings` | The scopes that the provider can issue. The `profile` scope is what puts the `groups` claim in the token, which the authorization rule reads. |
   | `grant_types` | Must include `authorization_code`, which is the grant that MCP clients use. authentik rejects a request for any grant that is not listed here with `invalid_grant`. |
   | `sub_mode` | Sets the `sub` claim to the username, which makes tokens easier to read while you test. |

   > [!WARNING]
   > The `.*` redirect URI matcher accepts **any** callback URL, so that you can connect different MCP clients while you test. Do not use it outside a test cluster. An authorization server that accepts any redirect URI lets an attacker intercept authorization codes by sending a victim through a crafted callback. In production, list only the callback URLs of the MCP clients that you allow.

4. Create an application that uses the provider. The `slug` field sets the application slug, which is the URL-safe name that authentik uses to build the provider's issuer URL, `http://<authentik-host>/application/o/<app-slug>/`. This example uses the slug `agentgateway-mcp`, so the issuer URL that you save later ends in `/application/o/agentgateway-mcp/`.
   ```sh {paths="setup-authentik"}
   export AK_PROVIDER_PK=$(curl -s -H "${AK_AUTH_HEADER}" \
     "${AUTHENTIK_API}/providers/oauth2/?name=agentgateway-mcp" | jq -r '.results[0].pk // empty')

   curl -s -X POST -H "${AK_AUTH_HEADER}" -H "Content-Type: application/json" \
     "${AUTHENTIK_API}/core/applications/" -d "{
       \"name\": \"agentgateway MCP\",
       \"slug\": \"agentgateway-mcp\",
       \"provider\": ${AK_PROVIDER_PK}
     }" | jq -r '.slug'
   ```

{{< doc-test paths="setup-authentik" >}}
# Fail fast with a clear message if the provider or application was not created,
# rather than letting an empty client ID flow into the policy below.
if [ -z "${AUTHENTIK_CLIENT_ID:-}" ]; then
  echo "AUTHENTIK_CLIENT_ID is empty: the authentik OAuth2 provider was not created"
  echo "authentik response: ${AK_PROVIDER_RESPONSE:-<none>}"
  exit 1
fi
if [ -z "${AK_PROVIDER_PK:-}" ] || [ "${AK_PROVIDER_PK}" = "null" ]; then
  echo "AK_PROVIDER_PK is empty: could not look up the authentik provider"
  exit 1
fi
{{< /doc-test >}}

5. Create a group for the users that can access the MCP server, and add your user to it. When a client requests the `profile` scope, authentik puts the names of the groups that the user belongs to in the `groups` claim of the token. The authorization rule that you configure later reads that claim.
   ```sh {paths="setup-authentik"}
   export AK_GROUP_PK=$(curl -s -X POST -H "${AK_AUTH_HEADER}" -H "Content-Type: application/json" \
     "${AUTHENTIK_API}/core/groups/" -d '{"name": "mcp-agent"}' | jq -r '.pk')

   export AK_USER_PK=$(curl -s -H "${AK_AUTH_HEADER}" \
     "${AUTHENTIK_API}/core/users/?username=akadmin" | jq -r '.results[0].pk')

   curl -s -X POST -H "${AK_AUTH_HEADER}" -H "Content-Type: application/json" \
     "${AUTHENTIK_API}/core/groups/${AK_GROUP_PK}/add_user/" -d "{\"pk\": ${AK_USER_PK}}"

   echo "Group: ${AK_GROUP_PK}"
   ```

   Repeat the `add_user` request for each user that you want to give access to the MCP server.

{{< doc-test paths="setup-authentik" >}}
# Confirm the group exists and that akadmin is a member, because the authorization
# rule in the policy below denies every token that does not carry this group.
if [ -z "${AK_GROUP_PK:-}" ] || [ "${AK_GROUP_PK}" = "null" ]; then
  echo "AK_GROUP_PK is empty: the mcp-agent group was not created"
  exit 1
fi
curl -s -H "${AK_AUTH_HEADER}" "${AUTHENTIK_API}/core/groups/?search=mcp-agent" \
  | jq -e '[.results[] | select(.name == "mcp-agent") | .users_obj[].username] | index("akadmin")' >/dev/null
{{< /doc-test >}}

6. Save the issuer URL. authentik issuers take the form `https://<authentik-host>/application/o/<app-slug>/`, including the trailing slash. Because the agentgateway control plane fetches the JWKS from inside the cluster, use the in-cluster address of the authentik Service.
   ```sh {paths="setup-authentik"}
   export AUTHENTIK_ISSUER="http://authentik-server.authentik.svc.cluster.local/application/o/agentgateway-mcp/"
   export AUTHENTIK_JWKS_PATH="/application/o/agentgateway-mcp/jwks/"
   ```

## Configure MCP auth

With your MCP backend configured, create an {{< reuse "agw-docs/snippets/policy.md" >}} that enforces authentik authentication and authorization for the MCP backend.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with the `Authentik` provider. The policy validates tokens that authentik issues and uses a Common Expression Language (CEL) rule to require the `mcp-agent` group.
   ```yaml {paths="setup-authentik"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: mcp-authentik-authn
   spec:
     # Target the HTTPRoute to apply authentication at the route level
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: mcp
     traffic:
       jwtAuthentication:
         mode: Strict
         providers:
         - # The authentik issuer URL, including the trailing slash
           issuer: "${AUTHENTIK_ISSUER}"
           # authentik sets the 'aud' claim to the OAuth client ID
           audiences:
           - "${AUTHENTIK_CLIENT_ID}"
           jwks:
             remote:
               # Reference the in-cluster authentik Service to fetch public keys
               backendRef:
                 name: authentik-server
                 kind: Service
                 namespace: authentik
                 port: 80
               # authentik serves JWKS at {issuer}/jwks/, not /.well-known/jwks.json
               jwksPath: "${AUTHENTIK_JWKS_PATH}"
         mcp:
           # Use the native authentik provider
           provider: Authentik
           # Required: authentik does not support Dynamic Client Registration
           clientId: "${AUTHENTIK_CLIENT_ID}"
           resourceMetadata:
             resource: http://localhost:8080/mcp
             scopesSupported:
             - openid
             - profile
             bearerMethodsSupported:
             - header
       # Allow only tokens from members of the mcp-agent group
       authorization:
         action: Allow
         policy:
           matchExpressions:
           - '"mcp-agent" in jwt.groups'
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [JwtAuthentication API docs]({{< link-hextra path="/reference/api/#jwtauthentication" >}}).

   | Setting | Description |
   | -- | -- |
   | `providers[].issuer` | The authentik issuer URL, including the trailing slash. This must exactly match the `iss` claim in tokens that authentik issues. |
   | `providers[].audiences` | The OAuth client ID. authentik sets the `aud` claim of its tokens to the client ID rather than to a separate API identifier, so this value must match `clientId`. |
   | `providers[].jwks.remote.backendRef` | The in-cluster authentik Service that the control plane fetches public keys from. |
   | `providers[].jwks.remote.jwksPath` | The path to authentik's JWKS endpoint. authentik serves keys at `{issuer}/jwks/`. |
   | `mcp.provider` | The identity provider to adapt agentgateway's OAuth behavior to. In this example, `Authentik` is used. |
   | `mcp.clientId` | The pre-registered public client that agentgateway returns to MCP clients that attempt Dynamic Client Registration. Required for authentik. |
   | `mcp.resourceMetadata` | MCP OAuth resource metadata for discovery. Includes the resource identifier, supported scopes, and bearer token methods. |
   | `authorization.policy.matchExpressions` | CEL rules that authorize the claims in the verified JWT. This example requires membership in the `mcp-agent` group that you created. Requests that present a valid token without that group are denied with a 403 HTTP response code. |

   > [!NOTE]
   > When the policy is first applied, the control plane might briefly log `jwks keyset ... isn't available` until it completes the first JWKS fetch. This condition resolves on its own.

2. Verify that the policy was accepted.
   ```sh {paths="setup-authentik"}
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} mcp-authentik-authn -o yaml
   ```

   In the `status` section, confirm that the `Accepted` and `Attached` conditions are `True`.

3. Update the HTTPRoute that routes incoming traffic to the MCP server to include the OAuth discovery paths. This way, the agentgateway proxy can serve the resource and authorization server metadata during the MCP auth flow.
   ```yaml {paths="setup-authentik"}
   kubectl apply -f - <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: mcp
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       namespace: agentgateway-system
     rules:
     - filters:
       # Enable CORS for browser-based MCP clients
       - type: CORS
         cors:
           allowCredentials: true
           allowHeaders:
           - Origin
           - Authorization
           - Content-Type
           allowMethods:
           - "*"
           allowOrigins:
           - "*"
           exposeHeaders:
           - Origin
           - Mcp-Session-Id
           maxAge: 86400
       backendRefs:
       - group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         name: mcp-backend
       matches:
       # Main MCP endpoint to connect to the MCP server
       - path:
           type: PathPrefix
           value: /mcp
       # Path to access resource server metadata
       - path:
           type: PathPrefix
           value: /.well-known/oauth-protected-resource/mcp
       # Path to access authorization server metadata, including the
       # gateway-served client registration endpoint
       - path:
           type: PathPrefix
           value: /.well-known/oauth-authorization-server/mcp
   EOF
   ```

## Verify MCP auth

1. Get the address of the agentgateway proxy.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh {paths="setup-authentik"}
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy \
     -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

   echo "Gateway address: $INGRESS_GW_ADDRESS"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   After you port-forward, the gateway is available at `http://localhost:8080`. Use `localhost:8080` wherever the following steps reference `$INGRESS_GW_ADDRESS:80`.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Send an unauthenticated request to the MCP endpoint. Verify that the request is rejected with a 401 HTTP response code and a `WWW-Authenticate` header that points MCP clients to the protected resource metadata.
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/mcp -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'
   ```

   Example output:
   ```
   HTTP/1.1 401 Unauthorized
   www-authenticate: Bearer resource_metadata="http://localhost:8080/.well-known/oauth-protected-resource/mcp"
   ```

3. Verify that the gateway serves the protected resource metadata.
   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/.well-known/oauth-protected-resource/mcp | jq
   ```

   Example output:
   ```json
   {
     "resource": "http://localhost:8080/mcp",
     "authorization_servers": ["http://localhost:8080/mcp"],
     "mcp_protocol_version": "2025-06-18",
     "resource_type": "mcp-server",
     "bearer_methods_supported": ["header"],
     "scopes_supported": ["openid", "profile"]
   }
   ```

4. Verify that the gateway serves authorization server metadata from authentik's discovery document, and that it injected a `registration_endpoint` that points back at the gateway. authentik's own discovery document does not include this field.
   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/.well-known/oauth-authorization-server/mcp \
     | jq '{issuer, jwks_uri, authorization_endpoint, registration_endpoint}'
   ```

   Example output:
   ```json
   {
     "issuer": "http://authentik-server.authentik.svc.cluster.local/application/o/agentgateway-mcp/",
     "jwks_uri": "http://authentik-server.authentik.svc.cluster.local/application/o/agentgateway-mcp/jwks/",
     "authorization_endpoint": "http://authentik-server.authentik.svc.cluster.local/application/o/authorize/",
     "registration_endpoint": "http://localhost:8080/.well-known/oauth-authorization-server/mcp/client-registration"
   }
   ```

5. Verify that the gateway answers Dynamic Client Registration with your pre-registered client, instead of proxying the request to authentik.
   ```sh
   curl -s -X POST http://$INGRESS_GW_ADDRESS:80/.well-known/oauth-authorization-server/mcp/client-registration \
     -H "Content-Type: application/json" \
     -d '{"client_name":"test-mcp-client","redirect_uris":["http://localhost:9999/callback"]}' \
     | jq -r '.client_id'
   ```

   The returned client ID matches the `AUTHENTIK_CLIENT_ID` value that you configured in the policy.

{{< doc-test paths="setup-authentik" >}}
# WHAT THIS TEST VALIDATES:
#   * authentik installs in the cluster and its server becomes ready.
#   * The OAuth2 provider and application are created, and authentik serves JWKS
#     at the derived {issuer}/jwks/ path that the Authentik provider expects.
#   * The mcp-agent group is created and the akadmin user is a member of it.
#   * The mcp-authentik-authn AgentgatewayPolicy (provider: Authentik, clientId,
#     a cross-namespace remote JWKS backendRef, and the group authorization rule)
#     is accepted and attached, and the updated HTTPRoute is accepted.
#   * The gateway enforces the connect-time 401 challenge, serves the protected
#     resource metadata, serves authorization server metadata proxied from
#     authentik, injects a registration_endpoint that authentik does not publish,
#     and answers Dynamic Client Registration with the pre-registered client.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The full interactive OAuth sign-in flow, which requires a real user signing
#     in through a browser that can reach authentik. In this test authentik is
#     only reachable inside the cluster.
#   * That a token from a user in the mcp-agent group is admitted and one from a
#     user outside it is denied with a 403. Minting a token from the command line
#     needs a service account and the client_credentials grant, which is a
#     different flow from the authorization code flow that this guide documents.
YAMLTest -f - <<'EOF'
- name: wait for authentik server to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: authentik
        name: authentik-server
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 600
      intervalSeconds: 10
- name: wait for mcp-authentik-authn policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-authentik-authn
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for mcp-authentik-authn policy to be attached
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-authentik-authn
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Attached')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for mcp HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: default
        name: mcp
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="setup-authentik" >}}
# Assert the MCP auth behaviors that the Authentik provider is responsible for.
# The gateway must challenge unauthenticated requests, and it must inject a
# registration endpoint into authentik's metadata and answer DCR with clientId.
code=$(curl -s -o /dev/null -w '%{http_code}' "http://${INGRESS_GW_ADDRESS}:80/mcp" -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}')
if [ "$code" != "401" ]; then echo "expected 401 from unauthenticated /mcp, got $code"; exit 1; fi

curl -sf "http://${INGRESS_GW_ADDRESS}:80/.well-known/oauth-protected-resource/mcp" >/dev/null

reg=$(curl -sf "http://${INGRESS_GW_ADDRESS}:80/.well-known/oauth-authorization-server/mcp" | jq -r '.registration_endpoint')
case "$reg" in
  */client-registration) ;;
  *) echo "expected an injected client-registration endpoint, got '$reg'"; exit 1 ;;
esac

dcr_client=$(curl -sf -X POST "$reg" -H "Content-Type: application/json" \
  -d '{"client_name":"doc-test-client","redirect_uris":["http://localhost:9999/callback"]}' | jq -r '.client_id')
if [ "$dcr_client" != "${AUTHENTIK_CLIENT_ID}" ]; then
  echo "expected DCR to return the pre-registered client ${AUTHENTIK_CLIENT_ID}, got '$dcr_client'"; exit 1
fi
{{< /doc-test >}}

## Connect an MCP client

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:8080/mcp`. The client discovers the authorization server through the gateway, registers against the pre-registered client, and redirects the user to authentik to log in and consent.

> [!IMPORTANT]
> The authorization and token endpoints that the gateway advertises come from authentik. In this guide, those endpoints use the in-cluster Service address, which a browser outside the cluster cannot reach. To complete an interactive sign-in, expose authentik at an address that both your MCP client and the gateway can resolve, and set `AUTHENTIK_ISSUER` to that address.

## Group-based authorization

The policy that you created gates the MCP endpoint on the `mcp-agent` group, which authentik puts in the `groups` claim of the token when the client requests the `profile` scope. Authentication alone is not enough: any caller that authentik issues a token to for this client passes JWT validation, including service accounts that authorize themselves rather than a user. The authorization rule denies those tokens with a 403 HTTP response code.

Because MCP authentication runs at the route level, every claim in the verified token is also available to other route-level policies, such as rate limiting and transformations. For more information about the rules that you can write, see [Authorization]({{< link-hextra path="/documentation/security/authorization/" >}}).

To authorize individual tools instead of the whole MCP endpoint, use an MCP authorization policy. For more information, see [Tool access]({{< link-hextra path="/documentation/mcp/tool-access/" >}}).

## Clean up

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-authentik-authn
helm uninstall authentik -n authentik
kubectl delete namespace authentik
```

{{< doc-test paths="setup-authentik" >}}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-authentik-authn --ignore-not-found
helm uninstall authentik -n authentik --ignore-not-found || true
kubectl delete namespace authentik --ignore-not-found
{{< /doc-test >}}
