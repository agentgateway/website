---
title: Set up CEL guardrails
weight: 20
description: Reject and mask MCP tool calls in-process with CEL expression guardrails.
test:
  mcp-guardrails-cel:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/mcp/guardrails/cel.md
    path: mcp-guardrails-cel
---

Reject and mask Model Context Protocol (MCP) tool calls with Common Expression Language (CEL) expressions inside the agentgateway proxy. CEL guardrails require no external policy server.

For an overview, see [Guardrail processors]({{< link-hextra path="/documentation/mcp/guardrails/processors" >}}). To use an external policy server, see [Set up remote guardrails]({{< link-hextra path="/documentation/mcp/guardrails/setup" >}}).

In this guide, you configure three CEL guardrails for the `echo` tool of a sample MCP server:

* Reject messages containing `DO_NOT_SEND` in the request phase.
* Mask email addresses before sending the request to the MCP server.
* Mask demo secrets in the response before returning it to the client.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up CEL guardrails

{{% steps %}}

### Step 1: Deploy an MCP server {#mcp-server}

Deploy the MCP `everything` reference server. Its `echo` tool returns the message you send.

The Service uses `appProtocol: agentgateway.dev/mcp` so that agentgateway can select it as an MCP target.

```yaml {paths="mcp-guardrails-cel"}
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server-everything
  labels:
    app: mcp-server-everything
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-server-everything
  template:
    metadata:
      labels:
        app: mcp-server-everything
    spec:
      containers:
        - name: mcp-server-everything
          image: node:20-alpine
          command: ["npx"]
          args: ["-y", "@modelcontextprotocol/server-everything", "streamableHttp"]
          ports:
            - containerPort: 3001
          readinessProbe:
            tcpSocket:
              port: 3001
            initialDelaySeconds: 2
            periodSeconds: 2
            failureThreshold: 30
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-server-everything
  labels:
    app: mcp-server-everything
spec:
  selector:
    app: mcp-server-everything
  ports:
    - protocol: TCP
      port: 3001
      targetPort: 3001
      appProtocol: agentgateway.dev/mcp
  type: ClusterIP
EOF
```

{{< doc-test paths="mcp-guardrails-cel" >}}
YAMLTest -f - <<'EOF'
- name: wait for mcp-server-everything deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: default
        name: mcp-server-everything
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
EOF
{{< /doc-test >}}

### Step 2: Create the backend for the MCP server

Create an {{< reuse "agw-docs/snippets/backend.md" >}} that selects the MCP server by its labels.

```yaml {paths="mcp-guardrails-cel"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: mcp-backend
spec:
  mcp:
    targets:
    - name: mcp-server-everything
      selector:
        services:
          matchLabels:
            app: mcp-server-everything
EOF
```

### Step 3: Route to the backend

Create an HTTPRoute that routes `/mcp` requests to the {{< reuse "agw-docs/snippets/backend.md" >}}.

```yaml {paths="mcp-guardrails-cel"}
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp
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
      - name: mcp-backend
        group: {{< reuse "agw-docs/snippets/group.md" >}}
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

### Step 4: Apply the guardrails policy

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that attaches three CEL expression processors to the {{< reuse "agw-docs/snippets/backend.md" >}}.

```yaml {paths="mcp-guardrails-cel"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: mcp-cel-guardrails
spec:
  targetRefs:
    - group: {{< reuse "agw-docs/snippets/group.md" >}}
      kind: {{< reuse "agw-docs/snippets/backend.md" >}}
      name: mcp-backend
  backend:
    mcp:
      guardrails:
        processors:
        # Reject before masking, so this rule sees the original message.
        - methods:
            tools/call: Request
          expression:
            condition: >-
              mcp.params.name == 'echo' &&
              has(mcp.params.arguments) &&
              has(mcp.params.arguments.message) &&
              mcp.params.arguments.message.contains('DO_NOT_SEND')
            reject: "Messages containing DO_NOT_SEND may not be sent upstream"
        # Mask every email address in the message before it reaches the MCP server.
        - methods:
            tools/call: Request
          expression:
            condition: >-
              mcp.params.name == 'echo' &&
              has(mcp.params.arguments) &&
              has(mcp.params.arguments.message)
            transform: >-
              mcp.params.with(p, p.merge({
                'arguments': p.arguments.merge({
                  'message': p.arguments.message.regexReplaceAll(
                    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}',
                    '[EMAIL]'
                  )
                })
              }))
        # Mask demo secrets in every text block that a tool returns.
        - methods:
            tools/call: Response
          expression:
            condition: has(mcp.result.content)
            transform: >-
              mcp.result.with(r, r.merge({
                'content': r.content.map(item,
                  item.type == 'text'
                    ? item.merge({'text': item.text.regexReplaceAll(
                        'demo-secret-[A-Za-z0-9]+', '[SECRET]'
                      )})
                    : item
                )
              }))
EOF
```

Review the following table to understand the policy.

| Setting | Description |
|---------|-------------|
| `methods` | The MCP methods that run through the processor, and the phase for each. `tools/call: Request` runs the processor before the call reaches the MCP server. `tools/call: Response` runs the processor after the MCP server returns a result. |
| `expression.condition` | Optional CEL expression that must be `true` for the processor to act. When the condition is `false`, the processor passes the message through unchanged. |
| `expression.reject` | Rejection message for the client. The first processor checks for `DO_NOT_SEND` before masking changes the message. |
| `expression.transform` | CEL expression that replaces `mcp.params` (request) or `mcp.result` (response). The `merge` function preserves other fields. Use `regexReplaceAll` to mask every match, or `regexReplace` to mask only the first. |

{{< doc-test paths="mcp-guardrails-cel" >}}
YAMLTest -f - <<'EOF'
- name: wait for mcp-cel-guardrails policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-cel-guardrails
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF
{{< /doc-test >}}

{{% /steps %}}

## Verify the guardrails

1. Set the agentgateway address. The following steps use the `MCP_ADDR` variable for the MCP endpoint.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o=jsonpath="{.status.addresses[0].value}")
   export MCP_ADDR=http://$INGRESS_GW_ADDRESS/mcp
   echo $MCP_ADDR
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```

   In another terminal, set the address to the port-forwarded endpoint.
   ```sh
   export MCP_ADDR=http://localhost:8080/mcp
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Initialize an MCP session and save the session ID.
   ```sh
   export MCP_SESSION_ID=$(curl -s -D - $MCP_ADDR \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
     | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
   echo $MCP_SESSION_ID
   ```

3. Send `notifications/initialized` to complete the MCP handshake before calling tools.
   ```sh
   curl -s $MCP_ADDR \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
   ```

4. Call the `echo` tool with a message that contains two email addresses and two demo secrets.
   ```sh
   curl -s $MCP_ADDR \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo","arguments":{"message":"Contact alice@example.com and bob@example.org; tokens demo-secret-abc and demo-secret-xyz"}}}'
   ```

   Verify that the result masks both email addresses and both secrets. The request guardrail masks the addresses; the response guardrail masks the secrets.
   ```console
   data: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"Echo: Contact [EMAIL] and [EMAIL]; tokens [SECRET] and [SECRET]"}]}}
   ```

5. Call the `echo` tool with a message that contains `DO_NOT_SEND`.
   ```sh
   curl -s $MCP_ADDR \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"DO_NOT_SEND alice@example.com"}}}'
   ```

   Verify that the call is rejected before it reaches the MCP server. The tool result contains `isError: true` and the configured rejection message.
   ```console
   {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Messages containing DO_NOT_SEND may not be sent upstream"}],"isError":true}}
   ```

{{< doc-test paths="mcp-guardrails-cel" >}}
YAMLTest -f - <<'EOF'
- name: MCP endpoint accepts initialize request
  retries: 10
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /mcp
    method: POST
    headers:
      content-type: application/json
      accept: "application/json, text/event-stream"
      mcp-protocol-version: "2025-03-26"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

{{< doc-test paths="mcp-guardrails-cel" >}}
# Assert the guardrails behaviors end-to-end: request and response masking,
# and the request-phase reject.
MCP_ADDR="http://${INGRESS_GW_ADDRESS}:80/mcp"
HDRS=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "MCP-Protocol-Version: 2025-03-26")

# Retry until the route is programmed and the policy is applied.
MASKED=""
for attempt in $(seq 1 20); do
  SID=$(curl -s --max-time 10 -D - "${HDRS[@]}" "$MCP_ADDR" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
    | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
  if [ -z "$SID" ]; then sleep 5; continue; fi
  curl -s --max-time 10 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
    -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true
  MASKED=$(curl -s --max-time 15 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo","arguments":{"message":"Contact alice@example.com and bob@example.org; tokens demo-secret-abc and demo-secret-xyz"}}}')
  echo "$MASKED" | grep -q '\[SECRET\]' && break
  sleep 5
done

echo "$MASKED" | grep -q 'Echo: Contact \[EMAIL\] and \[EMAIL\]; tokens \[SECRET\] and \[SECRET\]' \
  || { echo "FAIL: request and response were not masked: $MASKED"; exit 1; }

REJECTED=$(curl -s --max-time 10 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"DO_NOT_SEND alice@example.com"}}}')
echo "$REJECTED" | grep -q '"isError":true' && echo "$REJECTED" | grep -q 'Messages containing DO_NOT_SEND may not be sent upstream' \
  || { echo "FAIL: DO_NOT_SEND call was not rejected: $REJECTED"; exit 1; }

echo "PASS: CEL guardrails mask and reject behaviors verified"
{{< /doc-test >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="mcp-guardrails-cel"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-cel-guardrails
kubectl delete HTTPRoute mcp
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} mcp-backend
kubectl delete Deployment mcp-server-everything
kubectl delete Service mcp-server-everything
```
