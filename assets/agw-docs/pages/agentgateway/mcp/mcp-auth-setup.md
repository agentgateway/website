Secure your Model Context Protocol (MCP) servers with OAuth 2.0 authentication by using agentgateway and an identity provider like Keycloak.

## About this guide

In this guide, you configure the agentgateway proxy to protect a static MCP server with Keycloak. The MCP client uses dynamic client registration (DCR) with Keycloak and sends the user through the OAuth flow. DCR creates the client registration but does not grant access to the MCP server. Agentgateway validates the token audience and permits only members of the Keycloak `users` group.

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-vs-jwt.md" >}}

For more information, see the [JWT auth docs]({{< link-hextra path="/mcp/mcp-access/">}}).

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Follow the steps to set up an [MCP server with a fetch tool]({{< link-hextra path="/mcp/static-mcp/" >}}).
3. Follow the steps to [set up Keycloak]({{< link-hextra path="/mcp/auth/keycloak/" >}}).
4. Install the experimental channel Gateway API.
   ```sh {paths="mcp-auth-setup"}
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```

## Configure MCP auth

With Keycloak deployed and your MCP backend configured, you can now create an {{< reuse "agw-docs/snippets/policy.md" >}} that enforces authentication for the MCP backend.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with MCP authentication and authorization configuration. The policy validates the resource audience and uses a Common Expression Language (CEL) rule to require the Keycloak `users` group.
   ```yaml {paths="mcp-auth-setup"}
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: mcp-echo-authn
   spec:
     # Target the HTTPRoute to apply authentication at the route level
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: mcp
     # Configure MCP authentication at the traffic (route) level
     traffic:
       jwtAuthentication:
         # Require a valid JWT from one of the configured providers
         mode: Strict
         providers:
         - # Issuer URL - must match the 'iss' claim in JWT tokens
           issuer: "${KEYCLOAK_ISSUER}"
           # Expected audience in JWT tokens
           audiences:
           - "${MCP_RESOURCE}"
           # JWKS configuration for token validation
           jwks:
             remote:
               # Reference to the Keycloak service for fetching public keys
               backendRef:
                 name: keycloak
                 kind: Service
                 namespace: keycloak
                 port: 8080
               # Path to the JWKS endpoint on the issuer
               jwksPath: "${KEYCLOAK_JWKS_PATH}"
         # MCP-specific extensions for OAuth discovery
         mcp:
           # Identity provider type
           provider: Keycloak
           # MCP resource metadata for OAuth discovery
           resourceMetadata:
             # Resource identifier for this MCP server
             resource: "${MCP_RESOURCE}"
             # Scopes supported by this MCP server
             scopesSupported:
             - email
             # Methods for providing bearer tokens
             bearerMethodsSupported:
             - header
             - body
             - query
       # Allow only tokens from members of the Keycloak users group
       authorization:
         action: Allow
         policy:
           matchExpressions:
           - 'has(jwt.groups) && jwt.groups.exists(group, group == "users")'
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `traffic.jwtAuthentication.providers[].issuer` | The OAuth 2.0 issuer URL from your identity provider. This must exactly match the `iss` claim in JWT tokens. Agentgateway validates this claim to ensure tokens come from the expected identity provider. |
   | `traffic.jwtAuthentication.providers[].jwks.remote.backendRef` | The Keycloak service for fetching JWKS public keys. |
   | `traffic.jwtAuthentication.providers[].jwks.remote.jwksPath` | The path to the JWKS endpoint to obtain public keys. |
   | `traffic.jwtAuthentication.providers[].audiences` | The purpose of the JWT token. This value must match the `aud` claim in JWT tokens. |
   | `traffic.jwtAuthentication.mode` | The JWT validation mode. Strict mode requires a valid JWT from one of the configured providers. |
   | `traffic.jwtAuthentication.mcp.provider` | The identity provider that you use. In this example, Keycloak is used. |
   | `traffic.jwtAuthentication.mcp.resourceMetadata` | MCP OAuth resource metadata for discovery. Includes the resource identifier, supported scopes, and bearer token methods. |
   | `traffic.authorization.policy.matchExpressions` | CEL rules that authorize the verified JWT claims. This example requires membership in the Keycloak `users` group. |

2. Verify that the policy was accepted.
   ```sh {paths="mcp-auth-setup"}
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} mcp-echo-authn -o yaml
   ```

{{< doc-test paths="mcp-auth-setup" >}}
YAMLTest -f - <<'EOF'
- name: wait for mcp-echo-authn policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-echo-authn
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF
{{< /doc-test >}}

3. Update the HTTPRoute that routes incoming traffic to the MCP server to include the discovery paths for the MCP resource and authorization server. This way, the agentgateway proxy can retrieve the resource and authorization server metadata during the MCP auth flow.
   ```yaml {paths="mcp-auth-setup"}
   kubectl apply -f - <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: mcp
   spec:
     # Reference the Agentgateway
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
               - X-HTTPRoute-Header
             maxAge: 86400
       # Route to the MCP backend
       backendRefs:
       - group: agentgateway.dev
         kind: AgentgatewayBackend
         name: mcp-backend
       # Match MCP and OAuth discovery paths
       matches:
       # Main MCP endpoint to connect to the MCP server
       - path:
           type: PathPrefix
           value: /mcp
       # Path to access resource server metadata
       - path:
           type: PathPrefix
           value: /.well-known/oauth-protected-resource/mcp
       # Path to access authorization server metadata
       - path:
           type: PathPrefix
           value: /.well-known/oauth-authorization-server/mcp
       # JWKS endpoint for token validation
       - path:
           type: PathPrefix
           value: /realms/master/protocol/openid-connect/certs
   EOF
   ```

{{< doc-test paths="mcp-auth-setup" >}}
DCR_SERVICE_CLIENT=$(curl --fail --silent --show-error \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "DCR service token test",
    "grant_types": ["client_credentials"],
    "token_endpoint_auth_method": "client_secret_basic"
  }' \
  "$KEYCLOAK_URL/realms/master/clients-registrations/openid-connect")

DCR_SERVICE_CLIENT_ID=$(jq -r .client_id <<<"$DCR_SERVICE_CLIENT")
DCR_SERVICE_CLIENT_SECRET=$(jq -r .client_secret <<<"$DCR_SERVICE_CLIENT")
export DCR_SERVICE_TOKEN=$(curl --fail --silent --show-error \
  -u "$DCR_SERVICE_CLIENT_ID:$DCR_SERVICE_CLIENT_SECRET" \
  -d grant_type=client_credentials \
  "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  | jq -r .access_token)

YAMLTest -f - <<'EOF'
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
      timeoutSeconds: 60
      intervalSeconds: 2
- name: unauthenticated MCP request returns 401 (connect-time auth enforced)
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/mcp"
    method: GET
  source:
    type: local
  expect:
    statusCode: 401
    headers:
      - name: www-authenticate
        comparator: contains
        value: resource_metadata
  retries: 3
- name: DCR service token without a user group returns 403
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/mcp"
    method: GET
    headers:
      authorization: "Bearer ${DCR_SERVICE_TOKEN}"
  source:
    type: local
  expect:
    statusCode: 403
  retries: 3
- name: resource metadata discovery returns 200
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/.well-known/oauth-protected-resource/mcp"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.resource"
        comparator: contains
        value: "/mcp"
  retries: 3
EOF
{{< /doc-test >}}

## Verify MCP auth

1. Open the MCP inspector.
   ```sh
   npx @modelcontextprotocol/inspector@{{% reuse "agw-docs/versions/mcp-inspector.md" %}}
   ```

2. From the MCP Inspector menu, connect to your agentgateway address as follows:
   * **Transport Type**: Select `Streamable HTTP`.
   * **URL**: Enter the agentgateway address, port, and the /mcp path. If your agentgateway proxy is exposed with a LoadBalancer server, use `http://${INGRESS_GW_ADDRESS}/mcp`. In local test setups where you port-forwarded the agentgateway proxy on your local machine, use `http://localhost:8080/mcp`.
   * Click **Connect**.

   Verify that the connection fails, because authentication is required to access the MCP server.

   {{< reuse-image-light src="img/mcp-auth-connect-error.png" >}}
   {{< reuse-image-dark srcDark="img/mcp-auth-connect-error-dark.png" >}}

3. Click **Open Auth Settings** to run through the MCP Auth flow that you configured with the agentgateway proxy.

4. Run through the auth flow. You can decide to manually run through the auth flow or select **Quick OAuth Flow** to automatically run through all the auth steps automatically. This guide assumes that you run through the auth flow manually.
   1. In the **OAuth Flow Progress** card, click **Continue** to start the **Metadata Discovery** phase. Verify that the step succeeds and that you see the authorization server metadata. The metadata include information about the location of the authorization server, supported scopes, and ways to provide the bearer token.
      {{< reuse-image-light src="img/oauth-resource-metadata.png" >}}
      {{< reuse-image-dark srcDark="img/oauth-resource-metadata-dark.png" >}}
   2. Click **Continue** to start the **Client registration** phase. Verify that the MCP inspector tool successfully registered as a client in Keycloak and is assigned a client ID.
      {{< reuse-image-light src="img/oauth-client-registration.png" >}}
      {{< reuse-image-dark srcDark="img/oauth-client-registration-dark.png" >}}
   3. Click **Continue** to start the **Preparing Authorization** phase. Verify that you get back a URL to log in to Keycloak with your credentials. Open the link in your browser and log in with the user `user1` and password `password`.
      {{< reuse-image-light src="img/oauth-prepare-auth.png" >}}
      {{< reuse-image-dark srcDark="img/oauth-prepare-auth-dark.png" >}}

      After you log in to Keycloak, an authorization code is displayed. Copy the authorization code and continue with the next step.
   4. Copy the authorization code into the **Authorization Code** field in the MCP inspector. Then, click **Continue** to start the **Request Authorization and acquire authorization code** phase.
      {{< reuse-image-light src="img/oauth-auth-code.png" >}}
      {{< reuse-image-dark srcDark="img/oauth-auth-code-dark.png" >}}
   5. Click **Continue** to start the **Token Request** phase. Verify that the **Authentication Complete** phase returns a token from Keycloak. The access token includes the MCP resource in `aud` and the `users` group in `groups`.
      {{< reuse-image-light src="img/oauth-token.png" >}}
      {{< reuse-image-dark srcDark="img/oauth-token-dark.png" >}}
   6. Connect to your MCP server.
      1. Copy the `access_token` value from the **Authentication Complete** phase.
      2. Open the **Authentication** section in the MCP inspector.
      3. In the **Custom Headers** card, click **Add**.
      4. Add the following values:
         * header name: `Authorization`
         * header value: `Bearer <value of access_token>`
      5. Click **Connect** to connect to your MCP server.
      {{< reuse-image-light src="img/oauth-connect-to-server.png" >}}
      {{< reuse-image-dark srcDark="img/oauth-connect-to-server-dark.png" >}}

5. Verify that tool calls work without re-authentication. Because the client authenticates at connect time, tool calls succeed immediately without any additional login prompts.
   1. From the menu bar, click the **Tools** tab.
   2. Click **List Tools** and select the `fetch` tool.
   3. In the **url** field, enter a website URL, such as `https://example.com/`.
   4. Click **Run Tool**.
   5. Verify that the tool call succeeds and returns the fetched content. No additional authentication is required because the token from the initial connection is reused for all tool calls within the session.

      {{< reuse-image-light src="img/mcp-inspector-fetch.png" >}}
      {{< reuse-image-dark srcDark="img/mcp-inspector-fetch-dark.png" >}}

## Clean up

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-echo-authn
kubectl delete httproute mcp
```
