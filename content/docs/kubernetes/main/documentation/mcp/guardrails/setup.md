---
title: Set up remote guardrails
weight: 30
description: Gate and mutate MCP method calls with an external ExtMCP policy server.
---

Inspect, rewrite, or reject Model Context Protocol (MCP) calls with an external ExtMCP policy server.

For an overview, see [Guardrail processors]({{< link-hextra path="/documentation/mcp/guardrails/processors" >}}). To run guardrails inside agentgateway, see [Set up CEL guardrails]({{< link-hextra path="/documentation/mcp/guardrails/cel" >}}).

In this guide, you route `tools/call` and `tools/list` requests through a sample ExtMCP server that denies any tool whose name contains `forbidden` and annotates each tool description in `tools/list` responses.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up remote guardrails

{{% steps %}}

### Step 1: Deploy an MCP server {#mcp-server}

Deploy an MCP server for agentgateway to proxy traffic to. The following example sets up a simple MCP server with one tool, `fetch`, that retrieves the content of a website URL.

```yaml
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

> [!NOTE]
> **Build your own ExtMCP server**: The sample server is for demonstration only. To build your own, implement the `ExtMcp` gRPC service from the [ExtMCP protocol definition](https://github.com/agentgateway/agentgateway/blob/main/crates/protos/proto/ext_mcp.proto). The service has two methods:
>
> * `CheckRequest`: Called in the request phase, before the call reaches the MCP backend. Return the request unchanged, return mutated `params`, or return an `AuthorizationError` to deny the call.
> * `CheckResponse`: Called in the response phase, after the MCP backend returns a result. Return the response unchanged, return a mutated `result`, or return an `AuthorizationError` to deny the call.
>
> Generate gRPC bindings from the proto file and implement both methods. Serve them over cleartext HTTP/2 (h2c) on the port that your Service targets. For more information about the request and response messages, outcomes, and error codes, see [Guardrail processors]({{< link-hextra path="/documentation/mcp/guardrails/processors" >}}).

```yaml
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
        image: gcr.io/solo-public/docs/testbox:latest
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

### Step 3: Create the backend for the MCP server

Create an {{< reuse "agw-docs/snippets/backend.md" >}} that sets up the agentgateway target details for the MCP server.

```yaml
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

```yaml
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

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that attaches MCP guardrails to the {{< reuse "agw-docs/snippets/backend.md" >}}.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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

Review the following table to understand the policy.

| Setting | Description |
|---------|-------------|
| `remote.backendRef` | The ExtMCP policy server that agentgateway calls. This example points to the `ext-mcp` Service from Step 2. |
| `failureMode: FailClosed` | Deny requests if the policy server is unreachable or returns an error. To allow requests instead, set `FailOpen`. |
| `methods` | MCP methods and phases to send to the policy server. `tools/call: Request` checks tool calls before forwarding them. `tools/list: Response` filters or annotates tool lists after the backend responds. See [Methods and phases]({{< link-hextra path="/documentation/mcp/guardrails/processors/#methods" >}}). |

{{% /steps %}}

## Verify the guardrails

Verify that the policy server gates `tools/call` and mutates `tools/list` responses.

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

## Troubleshooting

### MCP requests hang when the policy server is slow or cold

**What's happening:**

A `tools/call` or `tools/list` request hangs instead of returning a result or an error.

**Why it's happening:**

The guardrails callout has no deadline by default. If the ExtMCP server is slow or its connection is cold, the request waits on the callout instead of letting `failureMode` engage.

**How to fix it:**

Apply a request timeout to the ExtMCP server. When the timeout is reached, agentgateway applies the processor's `failureMode` configuration. If `failureMode` is set to `FailClosed`, the client receives a JSON-RPC error. If the mode is set to `FailOpen`, the request proceeds without the guardrail.

The timeout policy must be configured in an {{< reuse "agw-docs/snippets/policy.md" >}} resource that targets the `ext-mcp` Service. A backend policy that targets a `Service` attaches only after the Service becomes part of the proxy data plane configuration, which happens when a route references it. The HTTPRoute in the following example exists only to bring the `ext-mcp` Service into the data plane configuration so that the timeout policy attaches. The `ext-mcp.internal` hostname is a placeholder for the ExtMCP server. The hostname is not used for traffic to your MCP servers, and clients continue to call the gateway on the `/mcp` path from Step 4.

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
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} mcp-guardrails
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} ext-mcp-timeout --ignore-not-found
kubectl delete HTTPRoute mcp
kubectl delete HTTPRoute ext-mcp-route --ignore-not-found
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} mcp-backend
kubectl delete Deployment mcp-website-fetcher ext-mcp-server
kubectl delete Service mcp-website-fetcher ext-mcp
```
