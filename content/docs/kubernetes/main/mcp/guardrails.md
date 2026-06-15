---
title: MCP guardrails
weight: 45
description: Gate and mutate MCP method calls with an external ExtMCP policy server.
test:
  mcp-guardrails:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/mcp/guardrails.md
    path: mcp-guardrails
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-guardrails-about.md" >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up MCP guardrails

In this guide, you route `tools/call` and `tools/list` requests through a sample ExtMCP server that denies any tool whose name contains `forbidden` and annotates each tool description in `tools/list` responses.

{{% steps %}}

### Step 1: Deploy an MCP server {#mcp-server}

Deploy an MCP server for agentgateway to proxy traffic to. The following example sets up a simple MCP server with one tool, `fetch`, that retrieves the content of a website URL.

```yaml {paths="mcp-guardrails"}
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-website-fetcher
spec:
  selector:
    matchLabels:
      app: mcp-website-fetcher
  template:
    metadata:
      labels:
        app: mcp-website-fetcher
    spec:
      containers:
      - name: mcp-website-fetcher
        image: ghcr.io/peterj/mcp-website-fetcher:main
        imagePullPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-website-fetcher
  labels:
    app: mcp-website-fetcher
spec:
  selector:
    app: mcp-website-fetcher
  ports:
  - port: 80
    targetPort: 8000
    appProtocol: agentgateway.dev/mcp
EOF
```

### Step 2: Deploy a sample ExtMCP server {#extmcp-server}

Deploy a gRPC ExtMCP policy server. This example uses a prebuilt sample server that denies `tools/call` when the tool name contains `forbidden`, and appends ` [extmcp]` to every tool description in `tools/list` responses.

The Service uses `appProtocol: kubernetes.io/h2c` so that agentgateway connects to the policy server over cleartext HTTP/2 (gRPC).

```yaml {paths="mcp-guardrails"}
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ext-mcp-server
spec:
  selector:
    matchLabels:
      app: ext-mcp-server
  template:
    metadata:
      labels:
        app: ext-mcp-server
    spec:
      securityContext:
        sysctls:
        - name: net.ipv4.ip_unprivileged_port_start
          value: "0"
      containers:
      - name: ext-mcp-server
        image: ghcr.io/agentgateway/testbox:0.0.1
        readinessProbe:
          httpGet:
            path: /
            port: 80
          periodSeconds: 5
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: ext-mcp
  labels:
    app: ext-mcp
spec:
  selector:
    app: ext-mcp-server
  ports:
  - port: 4445
    targetPort: 9001
    protocol: TCP
    appProtocol: kubernetes.io/h2c
EOF
```

{{< doc-test paths="mcp-guardrails" >}}
YAMLTest -f - <<'EOF'
- name: wait for mcp-website-fetcher deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: default
        name: mcp-website-fetcher
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for ext-mcp-server deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: default
        name: ext-mcp-server
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF
{{< /doc-test >}}

### Step 3: Create the backend for the MCP server

Create an {{< reuse "agw-docs/snippets/backend.md" >}} that sets up the agentgateway target details for the MCP server.

```yaml {paths="mcp-guardrails"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: mcp-backend
spec:
  mcp:
    targets:
    - name: mcp-target
      static:
        host: mcp-website-fetcher.default.svc.cluster.local
        port: 80
        protocol: SSE
EOF
```

### Step 4: Route to the backend

Create an HTTPRoute that routes `/mcp` requests to the {{< reuse "agw-docs/snippets/backend.md" >}}.

```yaml {paths="mcp-guardrails"}
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

### Step 5: Apply the guardrails policy

Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that attaches MCP guardrails to the {{< reuse "agw-docs/snippets/backend.md" >}}. The policy sends `tools/call` through the request phase and `tools/list` through the response phase. The `failureMode: FailClosed` setting denies requests if the policy server is unreachable.

```yaml {paths="mcp-guardrails"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: mcp-guardrails
spec:
  targetRefs:
    - group: {{< reuse "agw-docs/snippets/group.md" >}}
      kind: {{< reuse "agw-docs/snippets/backend.md" >}}
      name: mcp-backend
  backend:
    mcp:
      guardrails:
        processors:
        - remote:
            backendRef:
              name: ext-mcp
              port: 4445
            failureMode: FailClosed
          methods:
            tools/call: Request
            tools/list: Response
EOF
```

{{< doc-test paths="mcp-guardrails" >}}
YAMLTest -f - <<'EOF'
- name: wait for mcp-guardrails policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-guardrails
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF
{{< /doc-test >}}

### Step 6: Optional: Set a timeout for the policy server {#timeout}

The guardrails callout has no deadline by default. If the policy server is slow or cold, the request can hang instead of letting `failureMode` engage. To bound the call, set a request timeout on the policy server with a `backend.http.requestTimeout` policy.

A backend policy that targets a `Service` only attaches once that Service is part of the dataplane config graph, which means it must be referenced by a route.

Create an HTTPRoute that references the `ext-mcp` Service so that the timeout policy attaches, then create the timeout policy.

```yaml
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: ext-mcp-route
spec:
  parentRefs:
  - name: agentgateway-proxy
    namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  hostnames:
    - "ext-mcp.internal"
  rules:
    - backendRefs:
      - name: ext-mcp
        port: 4445
---
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: ext-mcp-timeout
spec:
  targetRefs:
    - group: ""
      kind: Service
      name: ext-mcp
  backend:
    http:
      requestTimeout: 5s
EOF
```

{{% /steps %}}

## Verify the guardrails

Verify that the policy server gates `tools/call` and mutates `tools/list` responses.

1. Set the agentgateway address. The following steps use the `MCP_ADDR` variable for the MCP endpoint.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o=jsonpath="{.status.addresses[0].value}")
   export MCP_ADDR=http://$INGRESS_GW_ADDRESS/mcp
   echo $MCP_ADDR
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
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

3. Send the `notifications/initialized` notification to complete the MCP handshake. The MCP server does not answer other requests, such as `tools/list`, until initialization is complete.
   ```sh
   curl -s $MCP_ADDR \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
   ```

4. List the available tools. Verify that the `fetch` tool description ends with ` [extmcp]`, which the policy server added in the response phase.
   ```sh
   curl -s $MCP_ADDR \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
   ```

   Example output:
   ```console
   data: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"fetch","description":"Fetches a website and returns its content [extmcp]","inputSchema":{...}}]}}
   ```

5. Call a tool whose name contains `forbidden`. Verify that the policy server denies the call with a JSON-RPC error.
   ```sh
   curl -s $MCP_ADDR \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"forbidden-tool","arguments":{}}}'
   ```

   Example output:
   ```console
   {"jsonrpc":"2.0","id":3,"error":{"code":-32001,"message":"tool forbidden-tool is not allowed"}}
   ```

6. Call the allowed `fetch` tool. Verify that the call succeeds and returns the fetched content.
   ```sh
   curl -s $MCP_ADDR \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-03-26" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"fetch","arguments":{"url":"https://example.com"}}}'
   ```

   Example output:
   ```console
   data: {"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"<!doctype html><html lang=\"en\">..."}]}}
   ```

{{< doc-test paths="mcp-guardrails" >}}
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

{{< doc-test paths="mcp-guardrails" >}}
# Assert the guardrails behaviors end-to-end: response-phase mutation,
# request-phase deny, and request-phase allow.
MCP_ADDR="http://${INGRESS_GW_ADDRESS}:80/mcp"
HDRS=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "MCP-Protocol-Version: 2025-03-26")

# Retry until the route is programmed and the policy-server connection is warm.
LIST=""
for attempt in $(seq 1 20); do
  SID=$(curl -s --max-time 10 -D - "${HDRS[@]}" "$MCP_ADDR" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
    | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
  if [ -z "$SID" ]; then sleep 5; continue; fi
  curl -s --max-time 10 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
    -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true
  LIST=$(curl -s --max-time 15 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')
  echo "$LIST" | grep -q '\[extmcp\]' && break
  sleep 5
done

# Response phase: the policy server appended " [extmcp]" to tool descriptions.
echo "$LIST" | grep -q '\[extmcp\]' || { echo "FAIL: tools/list was not mutated: $LIST"; exit 1; }

# Request phase: a tool whose name contains "forbidden" is denied.
DENY=$(curl -s --max-time 10 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"forbidden-tool","arguments":{}}}')
echo "$DENY" | grep -q 'is not allowed' || { echo "FAIL: forbidden tool was not denied: $DENY"; exit 1; }

# Request phase: the allowed "fetch" tool passes through and returns a result.
ALLOW=$(curl -s --max-time 15 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"fetch","arguments":{"url":"https://example.com"}}}')
echo "$ALLOW" | grep -q '"result"' || { echo "FAIL: allowed tool did not return a result: $ALLOW"; exit 1; }

echo "PASS: MCP guardrails mutate, deny, and allow behaviors verified"
{{< /doc-test >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} mcp-guardrails
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} ext-mcp-timeout --ignore-not-found
kubectl delete HTTPRoute mcp
kubectl delete HTTPRoute ext-mcp-route --ignore-not-found
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} mcp-backend
kubectl delete Deployment mcp-website-fetcher ext-mcp-server
kubectl delete Service mcp-website-fetcher ext-mcp
```
