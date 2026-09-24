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
   2. Under **Redirect URI**, select the **Mobile and desktop applications** platform and add a loopback redirect URI for each MCP client that you plan to connect. For the MCP inspector that you use later in this guide, add both `http://localhost/oauth/callback` and `http://localhost/oauth/callback/debug`. For Claude Code, add `http://localhost/callback`. For other clients, check the callback path in the client's documentation.

      Entra ignores the port of a loopback redirect URI, so one entry matches whatever port the client picks at runtime. However, Entra matches the path exactly. If you register `http://localhost` without the client's callback path, sign-in fails with an `AADSTS50011` redirect URI mismatch error.

      Do not register the redirect URI under the **Web** platform. Web redirect URIs make the app registration a confidential client, and Entra then requires a client secret that MCP clients do not have.

3. From the app's **Overview** page, note the **Directory (tenant) ID** and the **Application (client) ID**, and save them as environment variables.
      
   ```bash
   export ENTRA_TENANT_ID=<your-tenant-id>
   export ENTRA_CLIENT_ID=<your-application-client-id>
   ```

4. Select **Expose an API**. 
   
   1. Next to **Application ID URI**, click **Set** and accept the default value of `api://${ENTRA_CLIENT_ID}`. 
   2. Click **Add a scope**, enter a scope name such as `mcp_access`, set **Who can consent** to **Admins and users**, and click **Add scope**.

5. Select **Manifest** and set the access token version to `2`. Then, save the manifest.

   ```json
   "api": {
     "requestedAccessTokenVersion": 2
   }
   ```

   By default, Entra issues v1 access tokens for your API, with an issuer of `https://sts.windows.net/<tenant-id>/`. The policy in this guide validates the v2 issuer, `https://login.microsoftonline.com/<tenant-id>/v2.0`, so v1 tokens fail issuer validation with a 401 HTTP response code even after a successful sign-in. In the older Azure AD Graph manifest format, the equivalent setting is `"accessTokenAcceptedVersion": 2`.

6. Select **App roles** and click **Create app role**. Enter a display name and set the **Value** to `mcp.admin`. Then, assign the role to the users or groups that need access to your MCP server. You use this role in the authorization rule that you configure later.

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
           # Do not set resource or authorizationServers. The gateway derives
           # the resource from the request URL and advertises itself as the
           # authorization server, which is what makes the Entra bridge work.
           resourceMetadata:
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
   | `providers[].issuer` | The Entra token issuer URL, which must match the `iss` claim in the token. Because you set `requestedAccessTokenVersion` to `2` in [Set up Entra ID](#set-up-entra-id), use `https://login.microsoftonline.com/<tenant-id>/v2.0`. If your app registration issues v1 tokens instead, use `https://sts.windows.net/<tenant-id>/`. |
   | `providers[].audiences` | The accepted audiences. List both `api://<client-id>` and the bare `<client-id>` to accept the `aud` claim formats that Entra mints for v1 and v2 tokens. |
   | `providers[].jwks.remote.backendRef` | The `entra-jwks` backend that points to `login.microsoftonline.com`. |
   | `providers[].jwks.remote.jwksPath` | The path to Entra's JWKS endpoint for your tenant. |
   | `mcp.provider` | The identity provider. Set to `Entra` to enable the native Entra bridging behavior. |
   | `mcp.clientId` | The Application (client) ID of your Entra app registration. Because Entra has no Dynamic Client Registration, agentgateway answers registration requests with this value. |
   | `mcp.resourceMetadata` | MCP OAuth resource metadata for discovery. In this example, the supported scopes and bearer token methods. Do not set `resource`. When `resource` is unset, the gateway derives the resource identifier from the request URL, so the metadata stays correct whether clients reach the gateway through a load balancer, a port-forward, or a different MCP route. If you set `resource`, every route advertises that one value. Do not set `authorizationServers` either. The gateway advertises itself as the authorization server. If you point clients at Entra instead, they bypass the bridge and fail as described in [Troubleshooting](#troubleshooting). |
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

   The gateway serves the discovery documents and the bridged `authorize`, `token`, and `client-registration` endpoints before it validates JWTs, even with the `Strict` policy on the route, because MCP clients need them to learn how to authenticate. You do not need a separate route or policy to exempt them. However, the gateway serves these paths only when the HTTPRoute matches them. If you leave out a discovery path, the `WWW-Authenticate` challenge still points clients to it, and the client fails when the path returns a 404 HTTP response code.

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

## Verify MCP discovery

Before you sign in, check that the gateway serves the discovery documents that MCP clients need. These checks do not require a browser, so they are a quick way to rule out routing and policy problems.

1. Get the address of the agentgateway proxy.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
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

3. Get the protected resource metadata. Verify that `authorization_servers` points to the gateway, not to `login.microsoftonline.com`.
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
     "scopes_supported": ["api://<client-id>/mcp_access"],
     "bearer_methods_supported": ["header"]
   }
   ```

4. Get the bridged authorization server metadata. Verify that the `authorize`, `token`, and `client-registration` endpoints point back to the gateway, and that PKCE with `S256` is advertised.
   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/.well-known/oauth-authorization-server/mcp \
     | jq '{authorization_endpoint, token_endpoint, registration_endpoint, code_challenge_methods_supported}'
   ```

   Example output:
   ```json
   {
     "authorization_endpoint": "http://localhost:8080/.well-known/oauth-authorization-server/mcp/authorize",
     "token_endpoint": "http://localhost:8080/.well-known/oauth-authorization-server/mcp/token",
     "registration_endpoint": "http://localhost:8080/.well-known/oauth-authorization-server/mcp/client-registration",
     "code_challenge_methods_supported": ["S256"]
   }
   ```

5. Register a test client. Verify that the response returns your Entra application (client) ID and no client secret.
   ```sh
   curl -s -X POST http://$INGRESS_GW_ADDRESS:80/.well-known/oauth-authorization-server/mcp/client-registration \
     -H "Content-Type: application/json" \
     -d '{"client_name":"test","redirect_uris":["http://localhost:8080/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}' | jq
   ```

   Example output:
   ```json
   {
     "client_id": "<client-id>",
     "client_id_issued_at": 0,
     "token_endpoint_auth_method": "none",
     "grant_types": ["authorization_code"],
     "response_types": ["code"],
     "redirect_uris": ["http://localhost:8080/callback"]
   }
   ```

{{< doc-test paths="setup-entra" >}}
# WHAT THIS TEST VALIDATES:
#   * With no `resource` configured in mcp.resourceMetadata, the gateway derives
#     the advertised resource from the request URL, so it carries the gateway
#     address that the client used instead of a fixed value.
#   * Client registration is short-circuited: the gateway answers with the
#     pre-registered clientId as a public client, without calling Entra.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The bridged authorization server metadata, because the gateway builds it
#     from Entra's live OIDC discovery document at request time, which would make
#     the test depend on login.microsoftonline.com availability.
YAMLTest -f - <<EOF
- name: protected resource metadata derives the resource from the request URL
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
        value: "${INGRESS_GW_ADDRESS}"
  retries: 3
- name: client registration returns the pre-registered Entra client ID
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/.well-known/oauth-authorization-server/mcp/client-registration"
    method: POST
    headers:
      content-type: application/json
    body: |
      {"client_name":"test","redirect_uris":["http://localhost:8080/callback"],"grant_types":["authorization_code"],"response_types":["code"],"token_endpoint_auth_method":"none"}
  source:
    type: local
  expect:
    statusCode: 201
    bodyJsonPath:
      - path: "\$.client_id"
        comparator: equals
        value: "${ENTRA_CLIENT_ID}"
      - path: "\$.token_endpoint_auth_method"
        comparator: equals
        value: "none"
  retries: 3
EOF
{{< /doc-test >}}

## Verify MCP auth

Verify the sign-in flow with the [MCP inspector](https://github.com/modelcontextprotocol/inspector). Because the flow redirects you to Microsoft to sign in, this verification is interactive and requires a live Entra tenant.

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

## Connect an MCP client

Configure your MCP client with the gateway's MCP endpoint URL only, such as `http://localhost:8080/mcp`. Do not configure a client ID, client secret, or authorization server URL in the client. The client discovers the gateway as its authorization server, registers against your pre-registered application (client) ID, and redirects the user to Microsoft to sign in. Make sure that the client's callback path is registered as a redirect URI in your Entra app registration, as described in [Set up Entra ID](#set-up-entra-id).

## Role-based authorization

The policy that you created gates the MCP endpoint on the `mcp.admin` app role, which Entra puts in the `roles` claim of tokens that it issues to the users and groups that you assigned the role to. Authentication alone is not enough: any caller that Entra issues a token to for your app registration passes JWT validation, including daemon apps that use the client credentials flow to authorize themselves rather than a user. The authorization rule denies those tokens with a 403 HTTP response code.

Because MCP authentication runs at the route level, every claim in the verified token is also available to other route-level policies, such as rate limiting and transformations. For more information about the rules that you can write, see [Authorization]({{< link-hextra path="/documentation/security/authorization/" >}}).

To authorize individual tools instead of the whole MCP endpoint, use an MCP authorization policy. For more information, see [Tool access]({{< link-hextra path="/documentation/mcp/tool-access/" >}}).

## Troubleshooting

Review the following common errors and what to check for each.

| Error | What to check |
| -- | -- |
| `Dynamic Client Registration rejected (HTTP 404)` | The HTTPRoute does not match the `/.well-known/oauth-authorization-server/mcp` path. Add the path as a `PathPrefix` match, as shown in [Configure MCP auth](#configure-mcp-auth). |
| `Incompatible auth server: does not support dynamic client registration` | The client is contacting Entra directly instead of the gateway. Remove `authorizationServers` from `mcp.resourceMetadata`, and check that the HTTPRoute matches both discovery paths. |
| `AADSTS9010010: The resource parameter provided in the request doesn't match with the requested scopes` | Same cause as the previous error. The client reached Entra without going through the gateway, which strips the `resource` parameter. |
| `AADSTS50011: The redirect URI ... does not match the redirect URIs configured for the application` | The redirect URI in the app registration is missing the client's callback path, or is registered under the **Web** platform instead of **Mobile and desktop applications**. |
| `AADSTS7000218: The request body must contain the following parameter: 'client_assertion' or 'client_secret'` | The app registration is treated as a confidential client. Move the redirect URI to the **Mobile and desktop applications** platform. |
| A 401 HTTP response code without a `WWW-Authenticate` header | The `mcp` section is missing from the `jwtAuthentication` policy. |
| Sign-in succeeds, but MCP requests return a 401 HTTP response code | Decode the access token and compare its `iss` and `aud` claims with `providers[].issuer` and `providers[].audiences`. An issuer of `https://sts.windows.net/<tenant-id>/` means that the app registration issues v1 tokens. Set the access token version to `2` in the manifest, as described in [Set up Entra ID](#set-up-entra-id). |
| Sign-in succeeds, but MCP requests return a 403 HTTP response code | The token is valid but does not carry the `mcp.admin` app role. Assign the role to the user or group, then sign in again to get a new token. |

## Clean up

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-entra-authn
kubectl delete backendtlspolicy entra-jwks
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} entra-jwks
kubectl delete httproute mcp
```
