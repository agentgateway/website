Exchange the caller's credential for a backend-scoped token before the gateway forwards a request to an MCP server.

## About

MCP servers are a common target for token exchange. The client that calls the gateway authenticates as a user or an agent, but the MCP server behind the gateway expects a token that is scoped to itself, issued by an authorization server that the server trusts. Token exchange lets the gateway make that swap, so the MCP server never sees the caller's original credential and the caller never holds a credential for the MCP server.

The configuration is the same `oauthTokenExchange` backend authentication method that the [standard token exchange guide]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/" >}}) covers. What differs is the target: the policy attaches to an MCP {{< reuse "agw-docs/snippets/backend.md" >}} rather than to a plain Service.

This guide uses an `echo` MCP server. Its `echo` tool returns the `input` that you send it, and with `includeHttpHeaders=true` it also returns the HTTP headers that it received, which makes the exchanged token directly observable in the tool response.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Deploy Keycloak

{{< reuse "agw-docs/snippets/keycloak-token-exchange.md" >}}

## Deploy the MCP server

Deploy a sample `echo` MCP server and expose it through the gateway.

The MCP server goes in the same `httpbin` namespace as the Keycloak deployment from the previous section, so that the token endpoint backend and the exchange policy can reference each other without a ReferenceGrant.

1. Deploy the `echo` MCP server.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: echo
     namespace: httpbin
     labels:
       app: echo
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: echo
     template:
       metadata:
         labels:
           app: echo
       spec:
         containers:
         - name: echo
           image: gcr.io/product-excellence-424719/mcp-echo:1.0
           imagePullPolicy: IfNotPresent
           args: ["--server-url", "https://echomcp.is.solo.io", "--oauth-enabled", "false"]
           ports:
           - containerPort: 3002
           readinessProbe:
             httpGet: { path: /healthz, port: 3002 }
             initialDelaySeconds: 10
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: echo
     namespace: httpbin
     labels:
       app: echo
   spec:
     selector:
       app: echo
     ports:
     - port: 3002
       targetPort: 3002
       appProtocol: kgateway.dev/mcp
   EOF
   ```

2. Create an {{< reuse "agw-docs/snippets/backend.md" >}} that targets the `echo` server. This backend sets no backend-level authentication, so the policy that you apply later is the only place that token exchange happens.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: mcp-backend-echo
     namespace: httpbin
   spec:
     {{< reuse "agw-docs/snippets/mcp-spec.md" >}}:
       targets:
       - name: echo-target
         selector:
           services:
             matchLabels:
               app: echo
   EOF
   ```

3. Create an `HTTPRoute` that exposes the MCP backend on the `/mcp` path of your gateway.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: mcp-echo
     namespace: httpbin
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /mcp
       backendRefs:
       - name: mcp-backend-echo
         group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

4. Verify that the route is accepted.

   ```sh
   kubectl -n httpbin get httproute mcp-echo -o jsonpath='{.status.parents[*].conditions[*].type}={.status.parents[*].conditions[*].status}{"\n"}'
   ```

   Example output:

   ```
   Accepted ResolvedRefs=True True
   ```

## Configure token exchange

Configure agentgateway to exchange the caller's token before it reaches the MCP server.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the token endpoint, pointing at the in-cluster Keycloak Service.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: keycloak-token-endpoint
     namespace: httpbin
   spec:
     static:
       host: keycloak.httpbin.svc.cluster.local
       port: 8080
   EOF
   ```

2. Create a Kubernetes Secret with the gateway client's secret. This matches the `requester-client` secret from the imported realm.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: oauth-client
     namespace: httpbin
   type: Opaque
   stringData:
     clientSecret: requester-secret
   EOF
   ```

3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that attaches the `oauthTokenExchange` method to the MCP {{< reuse "agw-docs/snippets/backend.md" >}}. Unlike the Service-targeted policies in the other guides, `targetRefs` names the backend.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: mcp-token-exchange
     namespace: httpbin
   spec:
     targetRefs:
     - group: {{< reuse "agw-docs/snippets/group.md" >}}
       kind: {{< reuse "agw-docs/snippets/backend.md" >}}
       name: mcp-backend-echo
     backend:
       auth:
         oauthTokenExchange:
           backendRef:
             group: {{< reuse "agw-docs/snippets/group.md" >}}
             kind: {{< reuse "agw-docs/snippets/backend.md" >}}
             name: keycloak-token-endpoint
           path: /realms/backend-oauth/protocol/openid-connect/token
           grantType: TokenExchange
           audiences:
           - target-client
           clientAuth:
             clientId: requester-client
             method: ClientSecretBasic
             secretRef:
               name: oauth-client
   EOF
   ```

   {{< reuse "agw-docs/snippets/oauth-token-exchange-fields.md" >}}

## Verify the exchange

Call the `echo` tool through the gateway and confirm that the `Authorization` header the MCP server received carries the exchanged token, not the one you sent.

1. Port-forward the Keycloak Service and the gateway proxy.

   ```sh
   kubectl port-forward -n httpbin svc/keycloak 8080:8080 &
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8888:80 &
   ```

2. Mint the inbound credential as `initial-client`. The gateway sends this as the `subject_token`. Tokens expire, so re-mint if you come back later.

   ```sh
   export INBOUND_TOKEN="$(curl -s http://localhost:8080/realms/backend-oauth/protocol/openid-connect/token \
     -u initial-client:initial-secret -d grant_type=password \
     -d username=testuser -d password=testpass | jq -r .access_token)"
   echo $INBOUND_TOKEN
   ```

3. Call the `echo` tool with `includeHttpHeaders=true`, so that the tool returns the HTTP headers that the MCP server received.

   ```sh
   npx @modelcontextprotocol/inspector@{{< reuse "agw-docs/versions/mcp-inspector.md" >}} \
     --cli http://localhost:8888/mcp \
     --transport http \
     --method tools/call \
     --tool-name echo \
     --tool-arg input=test \
     --tool-arg includeHttpHeaders=true \
     --header "Authorization: Bearer $INBOUND_TOKEN"
   ```

   The second content item of the response is the request that reached the MCP server. Note that its `authorization` header carries a *different* token than the one you sent.

   ```json
   {
     "method": "POST",
     "url": "/mcp",
     "headers": {
       "mcp-session-id": "5cbdbd08-7f27-4adc-a51e-ef0d987f1166",
       "authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI..."
     }
   }
   ```

4. Copy the forwarded token from that `authorization` header, and save it to an environment variable.

   ```sh
   export FORWARDED_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI...
   ```

5. Decode both tokens to confirm the exchange.

   ```sh
   for t in "$INBOUND_TOKEN" "$FORWARDED_TOKEN"; do
     echo "$t" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | {iss, aud, azp}'
   done
   ```

   The inbound token was issued to `initial-client` for the `requester-client` audience. The forwarded token was issued for the `target-client` audience, with the gateway's own client (`requester-client`) as the authorized party.

   ```json
   {
     "iss": "http://keycloak.httpbin.svc.cluster.local:8080/realms/backend-oauth",
     "aud": "requester-client",
     "azp": "initial-client"
   }
   {
     "iss": "http://keycloak.httpbin.svc.cluster.local:8080/realms/backend-oauth",
     "aud": "target-client",
     "azp": "requester-client"
   }
   ```

## Next steps

* **Validate the caller's credential at the edge.** The exchange forwards the caller's token to the authorization server as received, without validating it first. Pair the policy with route-level [JWT authentication]({{< link-hextra path="/documentation/security/jwt/" >}}) or [MCP authentication]({{< link-hextra path="/documentation/security/jwt/mcp/" >}}) so invalid tokens are rejected before any call to the token endpoint.
* **Scope the exchanged token per MCP server.** Attach a separate policy to each MCP {{< reuse "agw-docs/snippets/backend.md" >}}, each with its own `audiences`, so every server receives a token that is valid only for itself.
* **Restrict which tools each caller may reach.** Token exchange decides which credential the gateway sends, not who is allowed through. Add an [MCP authorization]({{< link-hextra path="/documentation/security/authorization/" >}}) policy alongside it.

## Cleanup

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-token-exchange -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} mcp-backend-echo keycloak-token-endpoint -n httpbin
kubectl delete httproute mcp-echo -n httpbin
kubectl delete secret oauth-client -n httpbin
kubectl delete deployment echo keycloak -n httpbin
kubectl delete service echo keycloak -n httpbin
kubectl delete configmap backend-oauth-realm -n httpbin
```
