Secure your Model Context Protocol (MCP) servers with OAuth 2.0 authentication by using agentgateway and [Auth0](https://auth0.com/) as the identity provider.

## About this guide

In this guide, you configure the agentgateway proxy to protect a static MCP server with MCP auth by using Auth0 as the authorization server. Agentgateway includes a native `Auth0` provider that adapts to Auth0's OAuth behavior. When you set `provider: Auth0`, agentgateway serves Auth0's [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) authorization server metadata to MCP clients and appends your API identifier to Auth0's authorization endpoint as an `audience` query parameter.

The `audience` parameter matters. Auth0 does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators, which MCP clients use to request a token for a specific resource. Without the parameter, Auth0 issues an opaque access token that agentgateway cannot validate as a JWT.

For more information about MCP auth, see the [About MCP auth]({{< link-hextra path="/mcp/auth/about/" >}}) page.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Follow the steps to set up an [MCP server with a fetch tool]({{< link-hextra path="/mcp/static-mcp/" >}}).
3. Install the experimental channel Gateway API.
   ```sh {paths="setup-auth0"}
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```
4. Create an API and an application in Auth0, and collect the values that agentgateway needs.
   1. Make sure that you have access to an [Auth0 tenant](https://auth0.com/docs/get-started/auth0-overview/create-tenants). If you do not have one, you can create a free tenant.
   2. In the Auth0 Dashboard, go to **Applications > APIs** and click **Create API**. Enter a name such as `agentgateway MCP`, and set the **Identifier** to the resource URL that your MCP clients request, such as `https://mcp.example.com/mcp`. The identifier becomes the `aud` claim of the tokens that Auth0 issues.
   3. Go to **Applications > Applications** and click **Create Application**. Choose **Native** for local MCP clients, or **Single Page Application** for browser-based clients. Both are public clients that use PKCE, which is what MCP clients require.
   4. On the application's **Settings** tab, note the **Domain** and the **Client ID**. Under **Application URIs**, add the callback URLs of the MCP clients that you plan to connect.
   5. Save the values as environment variables.
      ```bash
      export AUTH0_DOMAIN=<your-tenant>.us.auth0.com
      export AUTH0_CLIENT_ID=<your-application-client-id>
      export AUTH0_AUDIENCE=https://mcp.example.com/mcp
      ```

      | Variable | Description |
      | -- | -- |
      | `AUTH0_DOMAIN` | Your Auth0 tenant domain, without a scheme or trailing slash, such as `dev-abc123.us.auth0.com`. Copy it from the application's **Settings** tab. |
      | `AUTH0_CLIENT_ID` | The **Client ID** of the application that you created. |
      | `AUTH0_AUDIENCE` | The **Identifier** of the API that you created. Auth0 sets the `aud` claim of its access tokens to this value. |

{{< doc-test paths="setup-auth0" >}}
# The controller fetches the provider's remote JWKS when it translates the policy,
# so the test defaults to Auth0's public sample tenant
# (https://samples.auth0.com/.well-known/jwks.json) to resolve keys without a
# dedicated tenant. The client ID and audience are placeholders; they are not
# validated for the unauthenticated requests the test makes. Replace all three
# with your real tenant, application, and API values when you follow the guide.
export AUTH0_DOMAIN="${AUTH0_DOMAIN:-samples.auth0.com}"
export AUTH0_CLIENT_ID="${AUTH0_CLIENT_ID:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
export AUTH0_AUDIENCE="${AUTH0_AUDIENCE:-https://mcp.example.com/mcp}"
{{< /doc-test >}}

## Create the JWKS backend

Create an {{< reuse "agw-docs/snippets/backend.md" >}} that points to your Auth0 tenant, and a BackendTLSPolicy that originates a TLS connection to it. The JWT authentication policy uses this backend to fetch Auth0's public keys for token signature validation.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for your Auth0 tenant.
   ```yaml {paths="setup-auth0"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: auth0-jwks
   spec:
     static:
       host: ${AUTH0_DOMAIN}
       port: 443
   EOF
   ```

2. Create a BackendTLSPolicy that originates a TLS connection to the `auth0-jwks` backend by using well-known trusted CA certificates.
   ```yaml {paths="setup-auth0"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: BackendTLSPolicy
   metadata:
     name: auth0-jwks
   spec:
     targetRefs:
       - name: auth0-jwks
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         group: agentgateway.dev
     validation:
       hostname: ${AUTH0_DOMAIN}
       wellKnownCACertificates: System
   EOF
   ```

## Configure MCP auth

With your MCP backend configured, create an {{< reuse "agw-docs/snippets/policy.md" >}} that enforces Auth0 authentication for the MCP backend.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with the `Auth0` provider.
   ```yaml {paths="setup-auth0"}
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: mcp-auth0-authn
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
           # Auth0 issuers include a trailing slash
         - issuer: "https://${AUTH0_DOMAIN}/"
           audiences:
           - "${AUTH0_AUDIENCE}"
           jwks:
             remote:
               backendRef:
                 name: auth0-jwks
                 kind: {{< reuse "agw-docs/snippets/backend.md" >}}
                 group: agentgateway.dev
                 port: 443
               jwksPath: "/.well-known/jwks.json"
         mcp:
           # Use the native Auth0 provider to append the audience query parameter
           provider: Auth0
           # Short-circuit Dynamic Client Registration with a pre-registered client
           clientId: "${AUTH0_CLIENT_ID}"
           resourceMetadata:
             resource: http://localhost:8080/mcp
             scopesSupported:
             - openid
             - profile
             bearerMethodsSupported:
             - header
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information about the `traffic.jwtAuthentication` field, see the [API docs]({{< link-hextra path="/reference/api/#jwtauthentication" >}}).

   | Setting | Description |
   | -- | -- |
   | `providers[].issuer` | The Auth0 token issuer URL, including the trailing slash. This value must match the `iss` claim in the token. |
   | `providers[].audiences` | The Identifier of your Auth0 API. This value must match the `aud` claim in the token. Agentgateway also sends the first audience to Auth0 as the `audience` query parameter. |
   | `providers[].jwks.remote.backendRef` | The `auth0-jwks` backend that points to your Auth0 tenant. |
   | `providers[].jwks.remote.jwksPath` | The path to Auth0's JWKS endpoint. Auth0 serves keys at `/.well-known/jwks.json`. |
   | `mcp.provider` | The identity provider. Set to `Auth0` to append the `audience` query parameter to Auth0's authorization endpoint. |
   | `mcp.clientId` | The Client ID of your Auth0 application. Agentgateway answers Dynamic Client Registration requests with this value instead of proxying them to Auth0. |
   | `mcp.resourceMetadata` | MCP OAuth resource metadata for discovery. Includes the resource identifier, supported scopes, and bearer token methods. |

   > [!NOTE]
   > Setting `clientId` is recommended for Auth0. Auth0 supports Dynamic Client Registration, but only when you enable **Dynamic Application Registration** in your tenant settings. Because agentgateway passes through Auth0's own registration endpoint rather than proxying it, MCP clients register directly with Auth0. Pre-registering a client with `clientId` avoids that dependency.

2. Verify that the policy was accepted.
   ```sh {paths="setup-auth0"}
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} mcp-auth0-authn -o yaml
   ```

   In the `status` section, confirm that the `Accepted` and `Attached` conditions are `True`.

3. Update the HTTPRoute that routes incoming traffic to the MCP server to include the OAuth discovery paths. This way, the agentgateway proxy can serve the resource and authorization server metadata during the MCP auth flow.
   ```yaml {paths="setup-auth0"}
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
       # Path to access authorization server metadata
       - path:
           type: PathPrefix
           value: /.well-known/oauth-authorization-server/mcp
   EOF
   ```

## Verify MCP auth

1. Port-forward the agentgateway proxy.
   ```sh {paths="setup-auth0"}
   kubectl port-forward -n agentgateway-system svc/agentgateway-proxy 8080:80 &
   sleep 5
   ```

2. Send an unauthenticated request to the MCP endpoint. Verify that the request is rejected with a 401 HTTP response code and a `WWW-Authenticate` header that points MCP clients to the protected resource metadata.
   ```sh {paths="setup-auth0"}
   curl -i http://localhost:8080/mcp -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'
   ```

   Example output:
   ```
   HTTP/1.1 401 Unauthorized
   www-authenticate: Bearer resource_metadata="http://localhost:8080/.well-known/oauth-protected-resource/mcp"
   ```

3. Verify that the gateway serves the protected resource metadata.
   ```sh {paths="setup-auth0"}
   curl -s http://localhost:8080/.well-known/oauth-protected-resource/mcp | jq
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

4. Verify that the gateway serves Auth0's authorization server metadata, and that the `audience` query parameter is appended to the authorization endpoint.
   ```sh {paths="setup-auth0"}
   curl -s http://localhost:8080/.well-known/oauth-authorization-server/mcp \
     | jq '{issuer, jwks_uri, authorization_endpoint, registration_endpoint}'
   ```

   Example output. Note the `?audience=` parameter that agentgateway appended, and that `registration_endpoint` is Auth0's own endpoint rather than a gateway-proxied one.
   ```json
   {
     "issuer": "https://your-tenant.us.auth0.com/",
     "jwks_uri": "https://your-tenant.us.auth0.com/.well-known/jwks.json",
     "authorization_endpoint": "https://your-tenant.us.auth0.com/authorize?audience=https://mcp.example.com/mcp",
     "registration_endpoint": "https://your-tenant.us.auth0.com/oidc/register"
   }
   ```

{{< doc-test paths="setup-auth0" >}}
# WHAT THIS TEST VALIDATES:
#   * The auth0-jwks backend and BackendTLSPolicy, the mcp-auth0-authn
#     AgentgatewayPolicy with provider: Auth0 and clientId, and the updated
#     HTTPRoute are all accepted, and the provider's JWKS resolves so the policy
#     programs on the data plane.
#   * The gateway enforces the connect-time 401 challenge and serves the
#     protected-resource metadata.
#   * The gateway serves Auth0's authorization server metadata and appends the
#     audience query parameter to the authorization endpoint.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The full interactive OAuth sign-in flow and runtime token verification.
#     Both require a real user signing in to a configured Auth0 tenant and a
#     signed JWT, which an automated test cannot perform.
YAMLTest -f - <<'EOF'
- name: wait for auth0-jwks BackendTLSPolicy to be accepted
  wait:
    target:
      kind: BackendTLSPolicy
      metadata:
        namespace: default
        name: auth0-jwks
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for mcp-auth0-authn policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-auth0-authn
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for mcp-auth0-authn policy to be attached
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-auth0-authn
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

{{< doc-test paths="setup-auth0" >}}
# Assert the MCP auth behaviors that the Auth0 provider is responsible for: the
# connect-time challenge, the protected-resource metadata, and the audience query
# parameter appended to Auth0's authorization endpoint.
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/mcp -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}')
if [ "$code" != "401" ]; then echo "expected 401 from unauthenticated /mcp, got $code"; exit 1; fi

curl -sf http://localhost:8080/.well-known/oauth-protected-resource/mcp >/dev/null

meta=$(curl -sf http://localhost:8080/.well-known/oauth-authorization-server/mcp)
auth_ep=$(echo "$meta" | jq -r '.authorization_endpoint')
case "$auth_ep" in
  *"audience=${AUTH0_AUDIENCE}"*) ;;
  *) echo "expected the audience query parameter on the authorization endpoint, got '$auth_ep'"; exit 1 ;;
esac
{{< /doc-test >}}

## Connect an MCP client

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:8080/mcp`. The client discovers the authorization server through the gateway and redirects the user to Auth0 to log in and consent.

## Permission-based authorization

Auth0 includes the permissions that you grant to your API in the `permissions` claim when you enable **Add Permissions in the Access Token** on the API's **Settings** tab. You can use those claims to restrict which MCP tools a caller can invoke. For more information, see [Tool access]({{< link-hextra path="/mcp/tool-access/" >}}).

## Clean up

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-auth0-authn
kubectl delete backendtlspolicy auth0-jwks
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} auth0-jwks
```

{{< doc-test paths="setup-auth0" >}}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-auth0-authn --ignore-not-found
kubectl delete backendtlspolicy auth0-jwks --ignore-not-found
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} auth0-jwks --ignore-not-found
{{< /doc-test >}}
