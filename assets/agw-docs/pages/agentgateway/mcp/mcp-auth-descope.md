Secure your Model Context Protocol (MCP) servers with OAuth 2.0 authentication by using agentgateway and [Descope](https://www.descope.com/) as the identity provider.

## About this guide

In this guide, you configure the agentgateway proxy to protect a static MCP server with MCP auth by using a Descope [MCP Server](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) as the authorization server. Agentgateway includes a native `Descope` provider that adapts to Descope's agentic identity endpoints. When you set `provider: Descope`, agentgateway does the following:

- Serves authorization server metadata from Descope's OpenID Connect discovery document.
- Rewrites your agentic issuer to the project-level JWKS URL, because Descope publishes signing keys per project rather than per MCP server.
- Proxies Dynamic Client Registration through the gateway, so that browser-based MCP clients are not blocked by cross-origin restrictions.

Unlike Auth0 and Okta, Descope supports [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators, so agentgateway does not need to work around the missing `resource` parameter.

For more information about MCP auth, see the [About MCP auth]({{< link-hextra path="/mcp/auth/about/" >}}) page.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Follow the steps to set up an [MCP server with a fetch tool]({{< link-hextra path="/mcp/static-mcp/" >}}).
3. Install the experimental channel Gateway API.
   ```sh {paths="setup-descope"}
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```
4. Create an MCP Server and a client in Descope, and collect the values that agentgateway needs.
   1. Create a project in the [Descope Console](https://app.descope.com/). Note your **Project ID** from **Project Settings**.
   2. Create an [MCP Server](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) to represent your MCP gateway. Set the **MCP Server URL** to the public URL that agentgateway exposes, typically ending with `/mcp`, and define the scopes that your server enforces.
   3. From the MCP Server's **Connection Information** section, copy the **Issuer URL**. Descope agentic issuers take the form `https://api.descope.com/v1/apps/agentic/<project-id>/<server-id>`. Note the server ID from the end of that URL.
   4. Create a [Client](https://docs.descope.com/agentic-identity-hub/core-components/clients#creating-a-client) for the MCP clients that connect through the gateway, and note its **Client ID**.
   5. Save the values as environment variables.
      ```bash
      export DESCOPE_PROJECT_ID=<your-project-id>
      export DESCOPE_SERVER_ID=<your-mcp-server-id>
      export DESCOPE_CLIENT_ID=<your-client-id>
      export DESCOPE_MCP_SERVER_URL=https://mcp.example.com/mcp
      ```

      | Variable | Description |
      | -- | -- |
      | `DESCOPE_PROJECT_ID` | Your Descope **Project ID**, found under **Project Settings**. Descope publishes signing keys at the project level, so this value determines the JWKS path. |
      | `DESCOPE_SERVER_ID` | The MCP server ID from the end of your issuer URL. |
      | `DESCOPE_CLIENT_ID` | The **Client ID** of the Descope Client that you created. |
      | `DESCOPE_MCP_SERVER_URL` | Your MCP server's public URL, which must match the **MCP Server URL** in Descope. Descope sets the `aud` claim of its tokens to this value. |

{{< doc-test paths="setup-descope" >}}
# Descope has no public sample project that serves a JWKS, so this test cannot
# resolve real keys. The values below are placeholders that let the resources
# render and validate against the Kubernetes API server. Replace them with your
# real project, MCP server, client, and MCP server URL when you follow the guide.
export DESCOPE_PROJECT_ID="${DESCOPE_PROJECT_ID:-P2placeholderprojectid}"
export DESCOPE_SERVER_ID="${DESCOPE_SERVER_ID:-placeholder-mcp-server}"
export DESCOPE_CLIENT_ID="${DESCOPE_CLIENT_ID:-placeholder-client-id}"
export DESCOPE_MCP_SERVER_URL="${DESCOPE_MCP_SERVER_URL:-https://mcp.example.com/mcp}"
{{< /doc-test >}}

## Create the JWKS backend

Create an {{< reuse "agw-docs/snippets/backend.md" >}} that points to the Descope API, and a BackendTLSPolicy that originates a TLS connection to it. The JWT authentication policy uses this backend to fetch Descope's public keys for token signature validation.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the Descope API endpoint.
   ```yaml {paths="setup-descope"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: descope-jwks
   spec:
     static:
       host: api.descope.com
       port: 443
   EOF
   ```

2. Create a BackendTLSPolicy that originates a TLS connection to the `descope-jwks` backend by using well-known trusted CA certificates.
   ```yaml {paths="setup-descope"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: BackendTLSPolicy
   metadata:
     name: descope-jwks
   spec:
     targetRefs:
       - name: descope-jwks
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         group: agentgateway.dev
     validation:
       hostname: api.descope.com
       wellKnownCACertificates: System
   EOF
   ```

## Configure MCP auth

With your MCP backend configured, create an {{< reuse "agw-docs/snippets/policy.md" >}} that enforces Descope authentication for the MCP backend.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with the `Descope` provider.
   ```yaml {paths="setup-descope"}
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: mcp-descope-authn
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
           # The Descope agentic issuer for your MCP server
         - issuer: "https://api.descope.com/v1/apps/agentic/${DESCOPE_PROJECT_ID}/${DESCOPE_SERVER_ID}"
           # Descope sets the aud claim to your MCP server URL
           audiences:
           - "${DESCOPE_MCP_SERVER_URL}"
           jwks:
             remote:
               backendRef:
                 name: descope-jwks
                 kind: {{< reuse "agw-docs/snippets/backend.md" >}}
                 group: agentgateway.dev
                 port: 443
               # Descope publishes keys per project, not per MCP server
               jwksPath: "/${DESCOPE_PROJECT_ID}/.well-known/jwks.json"
         mcp:
           # Use the native Descope provider
           provider: Descope
           # Short-circuit Dynamic Client Registration with a pre-registered client
           clientId: "${DESCOPE_CLIENT_ID}"
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
   | `providers[].issuer` | The Descope agentic issuer URL for your MCP server. This value must match the `iss` claim in the token. |
   | `providers[].audiences` | Your MCP server URL, which must match the `aud` claim that Descope mints. |
   | `providers[].jwks.remote.backendRef` | The `descope-jwks` backend that points to `api.descope.com`. |
   | `providers[].jwks.remote.jwksPath` | The project-level JWKS path. Descope publishes keys at `/<project-id>/.well-known/jwks.json` rather than under the agentic issuer. |
   | `mcp.provider` | The identity provider. Set to `Descope` to enable the native Descope behavior. |
   | `mcp.clientId` | The Client ID of your Descope Client. Agentgateway answers Dynamic Client Registration requests with this value instead of proxying them to Descope. |
   | `mcp.resourceMetadata` | MCP OAuth resource metadata for discovery. Includes the resource identifier, supported scopes, and bearer token methods. |

   > [!NOTE]
   > Setting `clientId` is recommended for Descope. Descope's Dynamic Client Registration endpoint requires a management key that MCP clients do not have, so registration requests that the gateway proxies to Descope fail. If you prefer to let clients register dynamically, use [CIMD](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/registration-methods#client-id-metadata-documents-cimd) instead.

2. Verify that the policy was accepted.
   ```sh {paths="setup-descope"}
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} mcp-descope-authn -o yaml
   ```

   In the `status` section, confirm that the `Accepted` and `Attached` conditions are `True`.

   > [!NOTE]
   > The control plane fetches the JWKS when it translates the policy. If your project ID is wrong, the policy is accepted but the control plane logs `jwks keyset ... isn't available` and the policy does not program on the data plane. Check the control plane logs if authentication does not take effect.

3. Update the HTTPRoute that routes incoming traffic to the MCP server to include the OAuth discovery paths. This way, the agentgateway proxy can serve the resource and authorization server metadata during the MCP auth flow.
   ```yaml {paths="setup-descope"}
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
       # gateway-proxied client registration endpoint
       - path:
           type: PathPrefix
           value: /.well-known/oauth-authorization-server/mcp
   EOF
   ```

## Verify MCP auth

1. Port-forward the agentgateway proxy.
   ```sh
   kubectl port-forward -n agentgateway-system svc/agentgateway-proxy 8080:80 &
   sleep 5
   ```

2. Send an unauthenticated request to the MCP endpoint. Verify that the request is rejected with a 401 HTTP response code and a `WWW-Authenticate` header that points MCP clients to the protected resource metadata.
   ```sh
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
   ```sh
   curl -s http://localhost:8080/.well-known/oauth-protected-resource/mcp | jq
   ```

4. Verify that the gateway serves Descope's authorization server metadata, and that the registration endpoint points back at the gateway.
   ```sh
   curl -s http://localhost:8080/.well-known/oauth-authorization-server/mcp \
     | jq '{issuer, jwks_uri, authorization_endpoint, registration_endpoint}'
   ```

## Connect an MCP client

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:8080/mcp`. The client discovers the authorization server through the gateway, registers against the pre-registered client, and redirects the user through Descope's consent flow.

## Role-based authorization

Descope includes role information in its tokens according to your [Authorization Claims Configuration](https://docs.descope.com/management/token/jwt-templates#authorization-claims-configuration). With the default Descope JWT, roles appear in `tenants["<tenant-id>"].roles`. With the No Tenant Reference format, they appear in `roles`. You can use those claims to restrict which MCP tools a caller can invoke. For more information, see [Tool access]({{< link-hextra path="/mcp/tool-access/" >}}).

## Clean up

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-descope-authn
kubectl delete backendtlspolicy descope-jwks
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} descope-jwks
```

{{< doc-test paths="setup-descope" >}}
# WHAT THIS TEST VALIDATES:
#   * The descope-jwks backend and BackendTLSPolicy, the mcp-descope-authn
#     AgentgatewayPolicy with provider: Descope, the project-level JWKS path, and
#     clientId, and the updated HTTPRoute are all accepted by the Kubernetes API
#     server and by the agentgateway control plane.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the policy programs on the data plane, the 401 challenge, the proxied
#     authorization-server metadata, the proxied client registration endpoint, and
#     runtime token verification. Descope has no public sample project that serves
#     a JWKS, so the control plane cannot resolve keys for the placeholder project
#     and the policy never reaches the proxy. Set DESCOPE_PROJECT_ID,
#     DESCOPE_SERVER_ID, DESCOPE_CLIENT_ID, and DESCOPE_MCP_SERVER_URL to a real
#     Descope project to exercise the full flow.
YAMLTest -f - <<'EOF'
- name: wait for descope-jwks BackendTLSPolicy to be accepted
  wait:
    target:
      kind: BackendTLSPolicy
      metadata:
        namespace: default
        name: descope-jwks
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for mcp-descope-authn policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-descope-authn
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
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

{{< doc-test paths="setup-descope" >}}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-descope-authn --ignore-not-found
kubectl delete backendtlspolicy descope-jwks --ignore-not-found
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} descope-jwks --ignore-not-found
{{< /doc-test >}}
