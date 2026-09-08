Secure your Model Context Protocol (MCP) servers with OAuth 2.0 authentication by using agentgateway and Microsoft Entra ID (formerly Azure Active Directory) as the identity provider.

## About this guide

In this guide, you configure the agentgateway proxy to protect a static MCP server with MCP auth by using Microsoft Entra ID as the authorization server. Because Entra does not fully implement the OAuth behaviors that the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) assumes, agentgateway includes a native `Entra` provider that bridges the gaps. When you set `provider: Entra`, agentgateway serves RFC 8414 authorization server metadata from Entra's OIDC discovery document, strips the RFC 8707 `resource` parameter that Entra rejects, and short-circuits Dynamic Client Registration with your pre-registered application (client) ID.

> [!WARNING]
> This guide configures Entra app registrations that are **public clients** using PKCE, such as local MCP clients. Confidential clients (app registrations under the Entra **Web** platform) require a client secret at the token endpoint. On Kubernetes, injecting that secret through the recommended `jwtAuthentication.mcp` traffic policy is not yet supported. If you need confidential-client support today, use agentgateway in standalone mode, which accepts a `clientSecret` field on the MCP authentication policy.

For more information about MCP auth, see the [About MCP auth]({{< link-hextra path="/documentation/mcp/auth/about/" >}}) page.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
2. Follow the steps to set up an [MCP server with a fetch tool]({{< link-hextra path="/documentation/mcp/static-mcp/" >}}).
3. Install the experimental channel Gateway API.
   ```sh {paths="setup-entra"}
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```

## Set up Entra ID

Register an application in Microsoft Entra ID, and collect the values that agentgateway needs.

1. Make sure that you have access to a [Microsoft Entra ID tenant](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-create-new-tenant). If you do not have one, you can create a free tenant for development purposes.

2. [Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) in the Microsoft Entra admin center. 
   
   1. For **Supported account types**, choose the option that fits your organization. 
   2. Under **Redirect URI**, select the **Mobile and desktop applications** platform and add the callback URLs of the MCP clients that you plan to connect.

3. From the app's **Overview** page, note the **Directory (tenant) ID** and the **Application (client) ID**, and save them as environment variables.
      
   ```bash
   export ENTRA_TENANT_ID=<your-tenant-id>
   export ENTRA_CLIENT_ID=<your-application-client-id>
   ```

4. Select **Expose an API**. 
   
   1. Next to **Application ID URI**, click **Set** and accept the default value of `api://${ENTRA_CLIENT_ID}`. 
   2. Click **Add a scope**, enter a scope name such as `mcp_access`, set **Who can consent** to **Admins and users**, and click **Add scope**.

5. Select **App roles** and click **Create app role**. Enter a display name and set the **Value** to `mcp.admin`. Then, assign the role to the users or groups that need access to your MCP server. You use this role in the authorization rule that you configure later.

{{< doc-test paths="setup-entra" >}}
# The controller fetches the provider's remote JWKS when it translates the policy,
# so the test uses Microsoft's real multi-tenant `common` endpoint
# (https://login.microsoftonline.com/common/discovery/v2.0/keys) to resolve keys
# without a dedicated tenant. The client ID is a placeholder; it is not validated
# for the unauthenticated requests the test makes. Replace both with your real
# tenant and app registration IDs when you follow the guide.
export ENTRA_TENANT_ID="${ENTRA_TENANT_ID:-common}"
export ENTRA_CLIENT_ID="${ENTRA_CLIENT_ID:-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee}"
{{< /doc-test >}}

## Create the JWKS backend

Create a {{< reuse "agw-docs/snippets/backend.md" >}} that points to the Microsoft login endpoint, and a BackendTLSPolicy that originates a TLS connection to it. The JWT authentication policy uses this backend to fetch Entra's public keys for token signature validation.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the Microsoft login endpoint.
   ```yaml {paths="setup-entra"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: entra-jwks
   spec:
     static:
       host: login.microsoftonline.com
       port: 443
   EOF
   ```

2. Create a BackendTLSPolicy that originates a TLS connection to the `entra-jwks` backend by using well-known trusted CA certificates.
   ```yaml {paths="setup-entra"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: BackendTLSPolicy
   metadata:
     name: entra-jwks
   spec:
     targetRefs:
       - name: entra-jwks
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         group: agentgateway.dev
     validation:
       hostname: login.microsoftonline.com
       wellKnownCACertificates: System
   EOF
   ```

## Configure MCP auth

With your MCP backend configured, create an {{< reuse "agw-docs/snippets/policy.md" >}} that enforces Entra authentication and authorization for the MCP backend.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with MCP authentication and authorization configuration. MCP authentication is configured at the route level by using `traffic.jwtAuthentication` with the `mcp` extension field. The route-level placement aligns MCP auth with standard JWT authentication and lets you use JWT claims in other route-level policies, such as authorization, rate limiting, and transformations. In this example, a Common Expression Language (CEL) rule requires the `mcp.admin` app role.
   ```yaml {paths="setup-entra"}
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: mcp-entra-authn
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
           # v2 issuer form. The v1 form https://sts.windows.net/<tenant-id>/ is
           # also supported; use it when the app registration mints v1 tokens.
         - issuer: "https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0"
           # List both the api://<client-id> and bare <client-id> audience
           # formats to accept the aud claim that Entra mints for v1 and v2 tokens.
           audiences:
           - "api://${ENTRA_CLIENT_ID}"
           - "${ENTRA_CLIENT_ID}"
           jwks:
             remote:
               backendRef:
                 name: entra-jwks
                 kind: {{< reuse "agw-docs/snippets/backend.md" >}}
                 group: agentgateway.dev
                 port: 443
               jwksPath: "/${ENTRA_TENANT_ID}/discovery/v2.0/keys"
         mcp:
           # Use the native Entra provider to bridge Entra's OAuth behaviors
           provider: Entra
           # Entra has no Dynamic Client Registration, so the gateway answers
           # registration requests with this pre-registered client ID.
           clientId: "${ENTRA_CLIENT_ID}"
           resourceMetadata:
             resource: http://localhost:8080/mcp
             scopesSupported:
             - "api://${ENTRA_CLIENT_ID}/mcp_access"
             bearerMethodsSupported:
             - header
       # Allow only tokens that carry the mcp.admin app role
       authorization:
         action: Allow
         policy:
           matchExpressions:
           - '"mcp.admin" in jwt.roles'
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information about the `traffic.jwtAuthentication` field, see the [API docs]({{< link-hextra path="/reference/api/#jwtauthentication" >}}).

   | Setting | Description |
   | -- | -- |
   | `providers[].issuer` | The Entra token issuer URL. Use the v2 form `https://login.microsoftonline.com/<tenant-id>/v2.0` or the v1 form `https://sts.windows.net/<tenant-id>/`, depending on which version your app registration mints. This value must match the `iss` claim in the token. |
   | `providers[].audiences` | The accepted audiences. List both `api://<client-id>` and the bare `<client-id>` to accept the `aud` claim formats that Entra mints for v1 and v2 tokens. |
   | `providers[].jwks.remote.backendRef` | The `entra-jwks` backend that points to `login.microsoftonline.com`. |
   | `providers[].jwks.remote.jwksPath` | The path to Entra's JWKS endpoint for your tenant. |
   | `mcp.provider` | The identity provider. Set to `Entra` to enable the native Entra bridging behavior. |
   | `mcp.clientId` | The Application (client) ID of your Entra app registration. Because Entra has no Dynamic Client Registration, agentgateway answers registration requests with this value. |
   | `mcp.resourceMetadata` | MCP OAuth resource metadata for discovery. Includes the resource identifier, supported scopes, and bearer token methods. |
   | `authorization.policy.matchExpressions` | CEL rules that authorize the claims in the verified JWT. Entra puts the app roles that you assign in the `roles` claim, so this example requires the `mcp.admin` app role. Requests that present a valid token without that role are denied with a 403 HTTP response code. |

2. Verify that the policy was accepted.
   ```sh {paths="setup-entra"}
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} mcp-entra-authn -o yaml
   ```

{{< doc-test paths="setup-entra" >}}
YAMLTest -f - <<'EOF'
- name: wait for entra-jwks BackendTLSPolicy to be accepted
  wait:
    target:
      kind: BackendTLSPolicy
      metadata:
        namespace: default
        name: entra-jwks
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
- name: wait for mcp-entra-authn policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-entra-authn
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF
{{< /doc-test >}}

3. Update the HTTPRoute that routes incoming traffic to the MCP server to include the discovery paths for the MCP resource and authorization server. This way, the agentgateway proxy can retrieve the resource and authorization server metadata during the MCP auth flow. The authorization server path uses a prefix match so that the proxy can serve the bridged Entra metadata and proxy the `authorize` and `token` endpoints under it.
   ```yaml {paths="setup-entra"}
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
       # Path to access the bridged authorization server metadata and proxied endpoints
       - path:
           type: PathPrefix
           value: /.well-known/oauth-authorization-server/mcp
   EOF
   ```

{{< doc-test paths="setup-entra" >}}
# WHAT THIS TEST VALIDATES:
#   * The Entra MCP auth resources (entra-jwks backend + BackendTLSPolicy, the
#     mcp-entra-authn AgentgatewayPolicy with provider: Entra, clientId, and the
#     app role authorization rule, and the updated HTTPRoute) are accepted, and
#     the provider's JWKS resolves from the Entra `common` endpoint so the policy
#     programs on the data plane.
#   * The gateway enforces the connect-time 401 challenge and serves the
#     protected-resource metadata. The discovery endpoints stay reachable with the
#     authorization rule in place, because the rule applies only after a token is
#     verified.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The full interactive OAuth sign-in flow and the 403 that the authorization
#     rule returns for a token without the mcp.admin app role. Both require a real
#     user signing in to a configured Entra app registration, which an automated
#     test cannot perform.
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

Verify the auth flow with the [MCP inspector](https://github.com/modelcontextprotocol/inspector). Because the flow redirects you to Microsoft to sign in, this verification is interactive and requires a live Entra tenant.

1. Open the MCP inspector.
   ```sh
   npx @modelcontextprotocol/inspector@{{% reuse "agw-docs/versions/mcp-inspector.md" %}}
   ```

2. From the MCP Inspector menu, connect to your agentgateway address:
   * **Transport Type**: Select `Streamable HTTP`.
   * **URL**: Enter the agentgateway address and the `/mcp` path. For a LoadBalancer, use `http://${INGRESS_GW_ADDRESS}/mcp`. For a port-forwarded proxy, use `http://localhost:8080/mcp`.
   * Click **Connect**. Verify that the connection fails because authentication is required.

3. Click **Open Auth Settings** and run through the OAuth flow. During the flow, the MCP inspector discovers the bridged authorization server metadata, registers with your pre-configured `clientId`, and redirects you to Microsoft to sign in. After you sign in and the token is issued, agentgateway validates the Entra token and completes the connection.

4. Verify that tool calls work without re-authentication. From the **Tools** tab, click **List Tools**, select the `fetch` tool, enter a URL such as `https://example.com/`, and click **Run Tool**. The call succeeds because the token from the initial connection is reused for all tool calls within the session.

## Role-based authorization

The policy that you created gates the MCP endpoint on the `mcp.admin` app role, which Entra puts in the `roles` claim of tokens that it issues to the users and groups that you assigned the role to. Authentication alone is not enough: any caller that Entra issues a token to for your app registration passes JWT validation, including daemon apps that use the client credentials flow to authorize themselves rather than a user. The authorization rule denies those tokens with a 403 HTTP response code.

Because MCP authentication runs at the route level, every claim in the verified token is also available to other route-level policies, such as rate limiting and transformations. For more information about the rules that you can write, see [Authorization]({{< link-hextra path="/documentation/security/authorization/" >}}).

To authorize individual tools instead of the whole MCP endpoint, use an MCP authorization policy. For more information, see [Tool access]({{< link-hextra path="/documentation/mcp/tool-access/" >}}).

## Clean up

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-entra-authn
kubectl delete backendtlspolicy entra-jwks
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} entra-jwks
kubectl delete httproute mcp
```
