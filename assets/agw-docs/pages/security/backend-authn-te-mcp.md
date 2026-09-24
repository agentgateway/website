Exchange the incoming token for a backend-scoped token before the gateway forwards a request to an MCP server.

## About

MCP servers are a common target for token exchange. The client that calls the gateway authenticates as a user or an agent, but the MCP server behind the gateway expects a token that is scoped to itself, issued by an authorization server that the server trusts. Token exchange lets the gateway make that swap, so the MCP server never sees the incoming token, and the caller never holds a credential for the MCP server.

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

   ```yaml {paths="te-mcp"}
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
           args: ["--oauth-enabled", "false"]
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
       appProtocol: agentgateway.dev/mcp
   EOF
   ```

2. Create an {{< reuse "agw-docs/snippets/backend.md" >}} that targets the `echo` server. This backend sets no backend-level authentication, so the policy that you apply later is the only place that token exchange happens.

   ```yaml {paths="te-mcp"}
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

   ```yaml {paths="te-mcp"}
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

   ```sh {paths="te-mcp"}
   kubectl -n httpbin get httproute mcp-echo -o jsonpath='{.status.parents[*].conditions[*].type}={.status.parents[*].conditions[*].status}{"\n"}'
   ```

   Example output:

   ```
   Accepted ResolvedRefs=True True
   ```

## Configure token exchange

Configure agentgateway to exchange the incoming token before it reaches the MCP server.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the token endpoint, pointing at the in-cluster Keycloak Service.

   ```yaml {paths="te-mcp"}
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

   ```yaml {paths="te-mcp"}
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

   ```yaml {paths="te-mcp"}
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

## Verify the exchange {#verify-the-exchange}

Call the `echo` tool through the gateway and confirm that the `Authorization` header the MCP server received carries the exchanged token, not the one you sent.

1. Port-forward the Keycloak Service and the gateway proxy.

   ```sh
   kubectl port-forward -n httpbin svc/keycloak 8080:8080 &
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8888:80 &
   ```

2. Mint the incoming token as `initial-client`. The gateway sends this as the `subject_token`. Tokens expire, so re-mint if you come back later.

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

4. Copy the exchanged token from that `authorization` header, and save it to an environment variable.

   ```sh
   export FORWARDED_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI...
   ```

5. Decode both tokens to confirm the exchange.

   ```sh
   for t in "$INBOUND_TOKEN" "$FORWARDED_TOKEN"; do
     echo "$t" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | {iss, aud, azp}'
   done
   ```

   The inbound token was issued to `initial-client` for the `requester-client` audience. The exchanged token was issued for the `target-client` audience, with the gateway's own client (`requester-client`) as the authorized party.

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

{{< doc-test paths="te-mcp" >}}
# WHAT THIS TEST VALIDATES:
#   * The echo MCP server, the MCP AgentgatewayBackend, and the HTTPRoute apply and become ready.
#   * The oauthTokenExchange policy is accepted when targetRefs names an AgentgatewayBackend rather
#     than a Service -- the one thing this guide does differently from the other two.
#   * End to end: an MCP tools/call reaches the echo server carrying an *exchanged* token, issued for
#     target-client with requester-client as the authorized party, not the token the caller sent.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The MCP Inspector CLI in the visible steps -- it needs npx and a network fetch, so the hidden
#     test speaks the same streamable HTTP protocol with curl instead. Same requests, no toolchain.

# Expose the Keycloak token endpoint through the gateway so the token can be minted without a
# port-forward.
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: keycloak
  namespace: httpbin
spec:
  parentRefs:
  - name: agentgateway-proxy
    namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  hostnames:
  - "keycloak.local"
  rules:
  - backendRefs:
    - name: keycloak
      port: 8080
EOF
{{< /doc-test >}}

{{< doc-test paths="te-mcp" >}}
YAMLTest -f - <<'EOF'
- name: wait for the mcp token exchange policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: httpbin
        name: mcp-token-exchange
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="te-mcp" >}}
# Mint the incoming token. Keycloak readiness and data plane programming both lag the rollout, and
# an unready upstream answers 503, so retry until a real token comes back.
INBOUND_TOKEN=""
for i in $(seq 1 60); do
  INBOUND_TOKEN=$(curl -s --max-time 10 "http://${INGRESS_GW_ADDRESS}:80/realms/backend-oauth/protocol/openid-connect/token" -H "host: keycloak.local" -u initial-client:initial-secret -d grant_type=password -d username=testuser -d password=testpass | jq -r '.access_token // empty' 2>/dev/null || true)
  [ -n "$INBOUND_TOKEN" ] && break
  sleep 2
done
test -n "$INBOUND_TOKEN" || { echo "FAILED: could not mint the incoming token"; exit 1; }

# Speak MCP streamable HTTP directly, so the test needs no npx. Open a session, complete the
# handshake, then call the echo tool asking it to reflect the headers the MCP server received.
MCP_URL="http://${INGRESS_GW_ADDRESS}:80/mcp"
ACCEPT='application/json, text/event-stream'
AZP=""
BODY=""
for i in $(seq 1 30); do
  SID=$(curl -sD- -o /dev/null --max-time 15 -X POST "$MCP_URL" \
    -H 'content-type: application/json' -H "accept: $ACCEPT" \
    -H "authorization: Bearer $INBOUND_TOKEN" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"doc-test","version":"1"}}}' \
    | grep -i '^mcp-session-id:' | tr -d '\r' | cut -d' ' -f2- || true)
  if [ -n "$SID" ]; then
    curl -s --max-time 15 -o /dev/null -X POST "$MCP_URL" \
      -H 'content-type: application/json' -H "accept: $ACCEPT" \
      -H "authorization: Bearer $INBOUND_TOKEN" -H "mcp-session-id: $SID" \
      -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' || true
    BODY=$(curl -s --max-time 15 -X POST "$MCP_URL" \
      -H 'content-type: application/json' -H "accept: $ACCEPT" \
      -H "authorization: Bearer $INBOUND_TOKEN" -H "mcp-session-id: $SID" \
      -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo","arguments":{"input":"test","includeHttpHeaders":true}}}' || true)
    AZP=$(printf '%s' "$BODY" | python3 -c '
import sys,json,base64,re
try:
    raw=sys.stdin.read()
    line=[l for l in raw.splitlines() if l.startswith("data: ")][-1][6:]
    items=json.loads(line)["result"]["content"]
    req=json.loads(items[1]["text"])
    tok=req["headers"]["authorization"].split()[1]
    seg=tok.split(".")[1]
    print(json.loads(base64.urlsafe_b64decode(seg+"="*(-len(seg)%4)))["azp"])
except Exception:
    pass')
  fi
  [ "$AZP" = "requester-client" ] && break
  sleep 2
done
if [ "$AZP" != "requester-client" ]; then
  echo "FAILED: expected the token the MCP server received to have azp=requester-client, got '$AZP'"
  echo "last response (first 500 chars): $(printf '%s' "$BODY" | head -c 500)"
  exit 1
fi
echo "mcp token exchange verified (token reaching the MCP server has azp=$AZP)"
{{< /doc-test >}}

## Next steps

* **Validate the incoming token at the edge.** The exchange forwards the incoming token to the authorization server as received, without validating it first. Pair the policy with a route-level [JWT authentication]({{< link-hextra path="/documentation/security/jwt/" >}}) or [MCP authentication]({{< link-hextra path="/documentation/security/jwt/mcp/" >}}) policy so that invalid tokens are rejected before any call to the token endpoint. Set `preserveToken: true` on it, or the exchange finds no `subject_token`; for a worked example, see [Validate the incoming token at the edge]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/#edge-validation" >}}).
* **Scope the exchanged token per MCP server.** Attach a separate policy to each MCP {{< reuse "agw-docs/snippets/backend.md" >}}, each with its own `audiences`, so every server receives a token that is valid only for itself.
* **Restrict which tools each caller may reach.** Token exchange decides which token the gateway sends, not who is allowed through. Add an [MCP authorization]({{< link-hextra path="/documentation/security/authorization/" >}}) policy alongside it.

## Cleanup

Stop the port-forwards that you started in [Verify the exchange](#verify-the-exchange).

```sh
kill %1 %2
```

Then delete the resources.

```sh {paths="te-mcp"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-token-exchange -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} mcp-backend-echo keycloak-token-endpoint -n httpbin
kubectl delete httproute mcp-echo -n httpbin
kubectl delete secret oauth-client -n httpbin
kubectl delete deployment echo keycloak -n httpbin
kubectl delete service echo keycloak -n httpbin
kubectl delete configmap backend-oauth-realm -n httpbin
```

{{< doc-test paths="te-mcp" >}}
kubectl delete httproute keycloak -n httpbin --ignore-not-found
{{< /doc-test >}}
