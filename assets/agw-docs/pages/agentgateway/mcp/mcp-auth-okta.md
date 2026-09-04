Secure your Model Context Protocol (MCP) servers with OAuth 2.0 authentication by using agentgateway and [Okta](https://www.okta.com/) as the identity provider.

## About this guide

In this guide, you configure the agentgateway proxy to protect a static MCP server with MCP auth by using Okta as the authorization server. Because Okta does not fully implement the OAuth behaviors that the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) assumes, agentgateway includes a native `Okta` provider that bridges the gaps. When you set `provider: Okta`, agentgateway does the following:

- Serves authorization server metadata from Okta's OpenID Connect discovery document, because Okta does not support the [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414.html) path-based issuer format.
- Appends your first configured audience to Okta's authorization endpoint as an `audience` query parameter, because Okta does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html) resource indicators.
- Proxies Dynamic Client Registration through the gateway, because Okta does not send CORS headers on its registration endpoint. Okta's registration endpoint is relative to your org URL rather than the issuer, so agentgateway rewrites it to `https://<your-org>.okta.com/oauth2/v1/clients`.

> [!IMPORTANT]
> Set the JWKS path to `/oauth2/<auth-server-id>/v1/keys`. Okta publishes its signing keys there, not at the `/.well-known/jwks.json` path that many other identity providers use. Pointing `jwksPath` at the wrong path means the control plane cannot fetch Okta's keys, and token validation fails.

For more information about MCP auth, see the [About MCP auth]({{< link-hextra path="/mcp/auth/about/" >}}) page.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Follow the steps to set up an [MCP server with a fetch tool]({{< link-hextra path="/mcp/static-mcp/" >}}).
3. Install the experimental channel Gateway API.
   ```sh {paths="setup-okta"}
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```

## Set up Okta

Create an app integration in Okta, and collect the values that agentgateway needs.

1. Make sure that you have access to an [Okta org](https://developer.okta.com/signup/). If you do not have one, you can create a free developer org.

2. In the Okta Admin Console, go to **Applications > Applications** and click **Create App Integration**. Select **OIDC - OpenID Connect** as the sign-in method, and select **Native Application** for local MCP clients or **Single-Page Application** for browser-based clients. Both are public clients that use PKCE, which is what MCP clients require.

3. Under **Grant type**, select **Authorization Code** and **Refresh Token**. Under **Sign-in redirect URIs**, add the callback URLs of the MCP clients that you plan to connect. Assign the app to the users or groups that need access, then click **Save**.

4. On the app's **General** tab, note the **Client ID**.

5. Go to **Security > API > Authorization Servers**. Use the `default` authorization server, or add one for your MCP server. Note the **Audience** value on the server's **Settings** tab, and add a scope on the **Scopes** tab if your MCP server enforces scopes.

6. On the authorization server's **Claims** tab, add a `groups` claim so that a user's group memberships appear in the access token. Then, go to **Directory > Groups**, create a group such as `AI-Users`, and add the users that you want to access the MCP server. You use this group in the authorization rule that you configure later.

7. Save the values as environment variables.
   
   ```bash
   export OKTA_DOMAIN=<your-org>.okta.com
   export OKTA_AUTH_SERVER=default
   export OKTA_CLIENT_ID=<your-app-client-id>
   export OKTA_AUDIENCE=api://default
   ```

   | Variable | Description |
   | -- | -- |
   | `OKTA_DOMAIN` | Your Okta org domain, without a scheme or trailing slash, such as `dev-1234567.okta.com`. |
   | `OKTA_AUTH_SERVER` | The ID of the authorization server to use. The built-in server is `default`. |
   | `OKTA_CLIENT_ID` | The **Client ID** of the app integration that you created. |
   | `OKTA_AUDIENCE` | The **Audience** of the authorization server. For the `default` server, this value is `api://default`. Okta sets the `aud` claim of its access tokens to this value. |

   > [!TIP]
   > To confirm the issuer and JWKS path for your authorization server, open its metadata document at `https://<your-org>.okta.com/oauth2/<auth-server-id>/.well-known/openid-configuration` and check the `issuer` and `jwks_uri` fields.

{{< doc-test paths="setup-okta" >}}
# Okta has no public sample org that serves a JWKS, so this test cannot resolve
# real keys. The values below are placeholders that let the resources render and
# validate against the Kubernetes API server. Replace them with your real org,
# authorization server, app, and audience values when you follow the guide.
export OKTA_DOMAIN="${OKTA_DOMAIN:-dev-1234567.okta.com}"
export OKTA_AUTH_SERVER="${OKTA_AUTH_SERVER:-default}"
export OKTA_CLIENT_ID="${OKTA_CLIENT_ID:-0oa1placeholderclientid}"
export OKTA_AUDIENCE="${OKTA_AUDIENCE:-api://default}"
{{< /doc-test >}}

## Create the JWKS backend

Create an {{< reuse "agw-docs/snippets/backend.md" >}} that points to your Okta org, and a BackendTLSPolicy that originates a TLS connection to it. The JWT authentication policy uses this backend to fetch Okta's public keys for token signature validation.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for your Okta org.
   ```yaml {paths="setup-okta"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: okta-jwks
   spec:
     static:
       host: ${OKTA_DOMAIN}
       port: 443
   EOF
   ```

2. Create a BackendTLSPolicy that originates a TLS connection to the `okta-jwks` backend by using well-known trusted CA certificates.
   ```yaml {paths="setup-okta"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: BackendTLSPolicy
   metadata:
     name: okta-jwks
   spec:
     targetRefs:
       - name: okta-jwks
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         group: agentgateway.dev
     validation:
       hostname: ${OKTA_DOMAIN}
       wellKnownCACertificates: System
   EOF
   ```

## Configure MCP auth

With your MCP backend configured, create an {{< reuse "agw-docs/snippets/policy.md" >}} that enforces Okta authentication and authorization for the MCP backend.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with the `Okta` provider. The policy validates tokens that Okta issues and uses a Common Expression Language (CEL) rule to require the `AI-Users` group.
   ```yaml {paths="setup-okta"}
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: mcp-okta-authn
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
           # The issuer is the authorization server URL, with no trailing slash
         - issuer: "https://${OKTA_DOMAIN}/oauth2/${OKTA_AUTH_SERVER}"
           audiences:
           - "${OKTA_AUDIENCE}"
           jwks:
             remote:
               backendRef:
                 name: okta-jwks
                 kind: {{< reuse "agw-docs/snippets/backend.md" >}}
                 group: agentgateway.dev
                 port: 443
               # Okta serves keys at {issuer}/v1/keys, not /.well-known/jwks.json
               jwksPath: "/oauth2/${OKTA_AUTH_SERVER}/v1/keys"
         mcp:
           # Use the native Okta provider to bridge Okta's OAuth behaviors
           provider: Okta
           # Short-circuit Dynamic Client Registration with a pre-registered client
           clientId: "${OKTA_CLIENT_ID}"
           resourceMetadata:
             resource: http://localhost:8080/mcp
             scopesSupported:
             - openid
             - profile
             bearerMethodsSupported:
             - header
       # Allow only tokens from members of the AI-Users group
       authorization:
         action: Allow
         policy:
           matchExpressions:
           - '"AI-Users" in jwt.groups'
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information about the `traffic.jwtAuthentication` field, see the [API docs]({{< link-hextra path="/reference/api/#jwtauthentication" >}}).

   | Setting | Description |
   | -- | -- |
   | `providers[].issuer` | The Okta authorization server URL, such as `https://dev-1234567.okta.com/oauth2/default`. This value must match the `iss` claim in the token. |
   | `providers[].audiences` | The Audience of your Okta authorization server. This value must match the `aud` claim in the token. Agentgateway also sends the first audience to Okta as the `audience` query parameter. |
   | `providers[].jwks.remote.backendRef` | The `okta-jwks` backend that points to your Okta org. |
   | `providers[].jwks.remote.jwksPath` | The path to Okta's JWKS endpoint. Okta serves keys at `/oauth2/<auth-server-id>/v1/keys`. |
   | `mcp.provider` | The identity provider. Set to `Okta` to enable the native Okta bridging behavior. |
   | `mcp.clientId` | The Client ID of your Okta app integration. Agentgateway answers Dynamic Client Registration requests with this value instead of proxying them to Okta. |
   | `mcp.resourceMetadata` | MCP OAuth resource metadata for discovery. Includes the resource identifier, supported scopes, and bearer token methods. |
   | `authorization.policy.matchExpressions` | CEL rules that authorize the claims in the verified JWT. This example requires membership in the `AI-Users` Okta group. Requests that present a valid token without that group are denied with a 403 HTTP response code. |

   > [!NOTE]
   > Setting `clientId` is recommended for Okta. Okta's Dynamic Client Registration endpoint usually requires an API token that MCP clients do not have, so registration requests that the gateway proxies to Okta fail. A pre-registered client avoids that dependency.

2. Verify that the policy was accepted.
   ```sh {paths="setup-okta"}
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} mcp-okta-authn -o yaml
   ```

   In the `status` section, confirm that the `Accepted` and `Attached` conditions are `True`.

   > [!NOTE]
   > The control plane fetches the JWKS when it translates the policy. If your Okta domain or JWKS path is wrong, the policy is accepted but the control plane logs `jwks keyset ... isn't available` and the policy does not program on the data plane. Check the control plane logs if authentication does not take effect.

3. Update the HTTPRoute that routes incoming traffic to the MCP server to include the OAuth discovery paths. This way, the agentgateway proxy can serve the resource and authorization server metadata during the MCP auth flow.
   ```yaml {paths="setup-okta"}
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

3. Verify that the gateway serves the protected resource metadata.
   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/.well-known/oauth-protected-resource/mcp | jq
   ```

4. Verify that the gateway serves Okta's authorization server metadata, that the `audience` query parameter is appended to the authorization endpoint, and that the registration endpoint points back at the gateway.
   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/.well-known/oauth-authorization-server/mcp \
     | jq '{issuer, jwks_uri, authorization_endpoint, registration_endpoint}'
   ```

   Example output:
   ```json
   {
     "issuer": "https://dev-1234567.okta.com/oauth2/default",
     "jwks_uri": "https://dev-1234567.okta.com/oauth2/default/v1/keys",
     "authorization_endpoint": "https://dev-1234567.okta.com/oauth2/default/v1/authorize?audience=api://default",
     "registration_endpoint": "http://localhost:8080/.well-known/oauth-authorization-server/mcp/client-registration"
   }
   ```

## Connect an MCP client

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:8080/mcp`. The client discovers the authorization server through the gateway, registers against the pre-registered client, and redirects the user to Okta to log in and consent.

## Group-based authorization

The policy that you created gates the MCP endpoint on the `AI-Users` group, which Okta puts in the `groups` claim of the access token when you add the groups claim to your authorization server. Authentication alone is not enough: any caller that Okta issues a token to for your audience passes JWT validation, including tokens that a client obtains for itself rather than for a user. The authorization rule denies those tokens with a 403 HTTP response code.

Because MCP authentication runs at the route level, every claim in the verified token is also available to other route-level policies, such as rate limiting and transformations. For more information about the rules that you can write, see [Authorization]({{< link-hextra path="/security/authorization/" >}}).

To authorize individual tools instead of the whole MCP endpoint, use an MCP authorization policy. For more information, see [Tool access]({{< link-hextra path="/mcp/tool-access/" >}}).

## Clean up

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-okta-authn
kubectl delete backendtlspolicy okta-jwks
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} okta-jwks
```

{{< doc-test paths="setup-okta" >}}
# WHAT THIS TEST VALIDATES:
#   * The okta-jwks backend and BackendTLSPolicy, the mcp-okta-authn
#     AgentgatewayPolicy with provider: Okta, an explicit Okta JWKS path,
#     clientId, and the groups authorization rule, and the updated HTTPRoute are
#     all accepted by the Kubernetes API server and by the agentgateway control
#     plane.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the policy programs on the data plane, the 401 challenge, the proxied
#     authorization-server metadata, the audience query parameter, the proxied
#     client registration endpoint, runtime token verification, and the 403 that
#     the authorization rule returns for a token without the AI-Users group.
#     Okta has no public sample org that serves a JWKS, so the control plane
#     cannot resolve keys for the placeholder domain and the policy never reaches
#     the proxy. Set OKTA_DOMAIN, OKTA_AUTH_SERVER, OKTA_CLIENT_ID, and
#     OKTA_AUDIENCE to a real Okta org to exercise the full flow.
YAMLTest -f - <<'EOF'
- name: wait for okta-jwks BackendTLSPolicy to be accepted
  wait:
    target:
      kind: BackendTLSPolicy
      metadata:
        namespace: default
        name: okta-jwks
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for mcp-okta-authn policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-okta-authn
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

{{< doc-test paths="setup-okta" >}}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-okta-authn --ignore-not-found
kubectl delete backendtlspolicy okta-jwks --ignore-not-found
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} okta-jwks --ignore-not-found
{{< /doc-test >}}
