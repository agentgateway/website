Secure your Model Context Protocol (MCP) servers with OAuth 2.0 authentication by using agentgateway and [Auth0](https://auth0.com/) as the identity provider.

## About this guide

In this guide, you configure the agentgateway proxy to protect a static MCP server with MCP auth by using Auth0 as the authorization server. Agentgateway includes a native `Auth0` provider that adapts to Auth0's OAuth behavior. When you set `provider: Auth0`, agentgateway serves Auth0's [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414.html) authorization server metadata to MCP clients and appends your API identifier to Auth0's authorization endpoint as an `audience` query parameter.

The `audience` parameter matters. Auth0 does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html) resource indicators, which MCP clients use to request a token for a specific resource. Without the parameter, Auth0 issues an opaque access token that agentgateway cannot validate as a JWT.

For more information about MCP auth, see the [About MCP auth]({{< link-hextra path="/documentation/mcp/auth/about/" >}}) page.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
2. Follow the steps to set up an [MCP server with a fetch tool]({{< link-hextra path="/documentation/mcp/static-mcp/" >}}).
3. Install the experimental channel Gateway API.
   ```sh {paths="setup-auth0"}
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```

## Set up Auth0

Create an API and an application in Auth0, and collect the values that agentgateway needs.

1. Make sure that you have access to an [Auth0 tenant](https://auth0.com/docs/get-started/auth0-overview/create-tenants). If you do not have one, you can create a free tenant.

2. In the Auth0 Dashboard sidebar, expand the **Applications** section and click **APIs**. Then, click **Create API**. Enter a name such as `agentgateway MCP`, and set the **Identifier** to the resource URL that your MCP clients request, such as `https://mcp.example.com/mcp`. The identifier becomes the `aud` claim of the tokens that Auth0 issues.

3. On the API's **Settings** tab, enable **Add Permissions in the Access Token**. Then, on the API's **Permissions** tab, define the permissions that your MCP server enforces, such as `read:tools`, and grant them to the users or applications that need access. You use this permission in the authorization rule that you configure later.

4. In the Auth0 Dashboard sidebar, expand the **Applications** section and click **Applications**. Then, click **Create Application**. Choose **Native** for local MCP clients, or **Single Page Application** for browser-based clients. Both are public clients that use PKCE, which is what MCP clients require.

5. On the application's **Settings** tab, note the **Domain** and the **Client ID**. Under **Application URIs**, add the callback URLs of the MCP clients that you plan to connect.

6. Save the values as environment variables.
   
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

With your MCP backend configured, create an {{< reuse "agw-docs/snippets/policy.md" >}} that enforces Auth0 authentication and authorization for the MCP backend.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with the `Auth0` provider. The policy validates tokens that Auth0 issues and uses a Common Expression Language (CEL) rule to require the `read:tools` permission.
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
       # Allow only tokens that carry the read:tools permission
       authorization:
         action: Allow
         policy:
           matchExpressions:
           - '"read:tools" in jwt.permissions'
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
   | `authorization.policy.matchExpressions` | CEL rules that authorize the claims in the verified JWT. This example requires the `read:tools` permission that you defined on your Auth0 API. Requests that present a valid token without that permission are denied with a 403 HTTP response code. |

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
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
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

1. Get the address of the agentgateway proxy.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh {paths="setup-auth0"}
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

4. Verify that the gateway serves Auth0's authorization server metadata, and that the `audience` query parameter is appended to the authorization endpoint.
   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/.well-known/oauth-authorization-server/mcp \
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
#     AgentgatewayPolicy with provider: Auth0, clientId, and the permissions
#     authorization rule, and the updated HTTPRoute are all accepted, and the
#     provider's JWKS resolves so the policy programs on the data plane.
#   * The gateway enforces the connect-time 401 challenge and serves the
#     protected-resource metadata.
#   * The gateway serves Auth0's authorization server metadata and appends the
#     audience query parameter to the authorization endpoint. The discovery
#     endpoints stay reachable with the authorization rule in place, because the
#     rule applies only after a token is verified.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The full interactive OAuth sign-in flow and runtime token verification,
#     including the 403 that the authorization rule returns for a token without
#     the read:tools permission. All of them require a real user signing in to a
#     configured Auth0 tenant and a signed JWT, which an automated test cannot
#     perform.
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
#
# This heredoc is deliberately unquoted, unlike the other YAMLTest blocks in this
# repo. YAMLTest resolves environment variables in a test's url and request
# headers only, not in expectation values, so asserting the configured audience
# value needs the shell to expand ${AUTH0_AUDIENCE} first. The JSONPath dollar
# signs are escaped for the same reason.
YAMLTest -f - <<EOF
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
- name: resource metadata discovery returns 200
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/.well-known/oauth-protected-resource/mcp"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "\$.resource"
        comparator: contains
        value: "/mcp"
  retries: 3
- name: authorization server metadata carries the appended audience parameter
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/.well-known/oauth-authorization-server/mcp"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "\$.authorization_endpoint"
        comparator: contains
        value: "audience=${AUTH0_AUDIENCE}"
  retries: 3
EOF
{{< /doc-test >}}

## Connect an MCP client

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:8080/mcp`. The client discovers the authorization server through the gateway and redirects the user to Auth0 to log in and consent.

## Permission-based authorization

The policy that you created gates the MCP endpoint on the `read:tools` permission, which Auth0 puts in the `permissions` claim of the access token when you enable **Add Permissions in the Access Token** on the API's **Settings** tab. Authentication alone is not enough: any caller that Auth0 issues a token to for your API passes JWT validation, including machine-to-machine clients that authorize themselves rather than a user. The authorization rule denies those tokens with a 403 HTTP response code.

Because MCP authentication runs at the route level, every claim in the verified token is also available to other route-level policies, such as rate limiting and transformations. For more information about the rules that you can write, see [Authorization]({{< link-hextra path="/documentation/security/authorization/" >}}).

To authorize individual tools instead of the whole MCP endpoint, use an MCP authorization policy. For more information, see [Tool access]({{< link-hextra path="/documentation/mcp/tool-access/" >}}).

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
