Control MCP tool call rates to prevent overload and ensure fair access to expensive tools.

## About

Rate limiting for MCP traffic helps you protect tool servers from abuse and control costs for expensive operations. Every MCP operation — whether it's `tools/list`, `tools/call`, `resources/read`, or any other JSON-RPC method — is a single HTTP POST to the MCP endpoint. From the gateway's perspective, there is no distinction between listing tools and actually running one.

### How tool calls map to HTTP requests

Before adding limits, it helps to understand what agentgateway is counting. A typical MCP client session looks like this:

| Client action | HTTP requests to `/mcp` |
|---------------|------------------------|
| Connect to server | `initialize` → 1 POST |
| List available tools | `tools/list` → 1 POST |
| Call a tool once | `tools/call` → 1 POST |
| **Total per tool call session** | **~3–5 POSTs** |

This means a `requests: 5` per-second limit doesn't allow 5 tool calls per second — it allows roughly **1 tool call session per second** (5 requests ÷ ~5 per session). Size your limits accordingly: think in sessions, not raw HTTP requests.

If you need to differentiate between tool calls and other MCP operations (e.g., allow unlimited `tools/list` but cap `tools/call`), use [global rate limiting with CEL descriptors](#global-per-tool) to inspect the JSON-RPC method body.

### Response headers

{{< reuse "agw-docs/snippets/ratelimit-headers.md" >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You also need an MCP server deployed and routed through agentgateway. For setup instructions, see [Route to a static MCP server]({{< link-hextra path="/mcp/static" >}}).

## Local rate limiting {#local}

### Per-route tool call limit

Apply a rate limit directly to the MCP HTTPRoute.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: mcp-rate-limit
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: mcp
  traffic:
    rateLimit:
      local:
      - requests: 5
        unit: Seconds
        burst: 10
EOF
```

This allows 5 tool calls per second with a burst of up to 15 (5 base + 10 burst) before the 429 kicks in. The burst headroom is important for MCP clients: during session initialization, an agent typically fires `initialize` → `tools/list` → several `tools/call` requests back-to-back. Without burst capacity, it would hit the limit before doing any real work.

### Verify the policy attached

```sh
kubectl get {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} mcp-rate-limit -n default \
  -o jsonpath='{.status.ancestors[0].conditions}' | jq .
```

Both `Accepted` and `Attached` must be `True`:

```json
[
  { "type": "Accepted", "status": "True", "message": "Policy accepted" },
  { "type": "Attached", "status": "True", "message": "Attached to all targets" }
]
```

### Test the rate limit

Use an MCP client to call tools in a tight loop. The following example assumes you have the MCP Inspector CLI installed.

{{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}
```sh
for i in $(seq 1 20); do
  npx @modelcontextprotocol/inspector \
    --cli "http://$INGRESS_GW_ADDRESS/mcp" \
    --transport http \
    --method tools/call \
    --tool-name echo \
    --tool-arg message='Hello World!'
done
```
{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}
```sh
for i in $(seq 1 20); do
  npx @modelcontextprotocol/inspector \
    --cli "http://localhost:8080/mcp" \
    --transport http \
    --method tools/call \
    --tool-name echo \
    --tool-arg message='Hello World!'
done
```
{{% /tab %}}
{{< /tabs >}}

Example output:

```
{
  "content": [{ "type": "text", "text": "Echo: Hello World!" }]
}
{
  "content": [{ "type": "text", "text": "Echo: Hello World!" }]
}
{
  "content": [{ "type": "text", "text": "Echo: Hello World!" }]
}
{
  "content": [{ "type": "text", "text": "Echo: Hello World!" }]
}
{
  "content": [{ "type": "text", "text": "Echo: Hello World!" }]
}
Failed to call tool echo: Failed to list tools: Streamable HTTP error: Error POSTing to endpoint: rate limit exceeded
Failed with exit code: 1
Failed to connect to MCP server: Streamable HTTP error: Error POSTing to endpoint: rate limit exceeded
Failed with exit code: 1
...
```

Each `npx @modelcontextprotocol/inspector --cli` invocation doesn't send a single HTTP request — it opens a full MCP session:

| MCP operation | HTTP requests |
|---------------|--------------|
| `initialize` handshake | 1 POST to `/mcp` |
| `tools/list` (inspector lists tools before calling) | 1 POST to `/mcp` |
| `tools/call echo` | 1 POST to `/mcp` |

That's **3 HTTP requests per tool call sequence**. With 15 total capacity (5 base + 10 burst): `15 ÷ 3 = 5 complete sequences` before the bucket empties.

This is the key insight for sizing MCP rate limits: **count sessions, not raw requests**. If your client makes 5 HTTP round-trips per tool call, a limit of `requests: 5` per second effectively allows only ~3 tool call sequences in the initial burst, not 15.

## Gateway-level vs Route-level policies {#gateway-route}

### Gateway-level: fleet-wide ceiling

Add a gateway-level policy as a hard backstop across all traffic — HTTP, MCP, and LLM routes alike.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: gateway-ceiling
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  traffic:
    rateLimit:
      local:
      - requests: 10000
        unit: Minutes
        burst: 5
EOF
```

### Route-level: MCP-specific limit

With both in place, the MCP route is subject to its own tighter limit (5 req/s), while the gateway ceiling protects against any single client flooding a different route:

```
Client → Gateway (10000 req/min) → MCP route (5 req/s) → mcp-server
```

The more-specific policy always wins for the traffic it matches.

## Per-tool rate limits with CEL descriptors {#global-per-tool}

Local rate limiting treats every POST to `/mcp` identically. But some tools are more expensive than others — they deserve tighter limits. Global rate limiting with CEL descriptors lets you look inside the MCP request body and apply different ceilings per tool name.

### Deploy the rate limit infrastructure

Global rate limiting requires an external [Envoy Rate Limit service](https://github.com/envoyproxy/ratelimit) backed by Redis. For a complete guide on global rate limiting architecture and setup, see the [Global rate limiting guide]({{< link-hextra path="/security/rate-limit-global" >}}). The following example shows an MCP-specific configuration that applies different limits to different tools.

```yaml
kubectl apply -f- <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: ratelimit-config
  namespace: default
data:
  config.yaml: |
    domain: mcp-tools
    descriptors:
      - key: mcp_method
        value: tools/call
        descriptors:
          # Expensive tools: 3 calls/min
          - key: tool_name
            value: trigger-long-running-operation
            rate_limit:
              unit: minute
              requests_per_unit: 3
          - key: tool_name
            value: sampleLLMCall
            rate_limit:
              unit: minute
              requests_per_unit: 3
          # All other tool calls: 10/min
          - key: tool_name
            rate_limit:
              unit: minute
              requests_per_unit: 10
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: default
spec:
  selector:
    app: redis
  ports:
    - port: 6379
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ratelimit
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ratelimit
  template:
    metadata:
      labels:
        app: ratelimit
    spec:
      containers:
        - name: ratelimit
          image: envoyproxy/ratelimit:master
          command: ["/bin/ratelimit"]
          env:
            - name: REDIS_SOCKET_TYPE
              value: tcp
            - name: REDIS_URL
              value: redis:6379
            - name: RUNTIME_ROOT
              value: /data
            - name: RUNTIME_SUBDIRECTORY
              value: ratelimit
            - name: RUNTIME_WATCH_ROOT
              value: "false"
            - name: USE_STATSD
              value: "false"
          ports:
            - containerPort: 8081   # gRPC
          volumeMounts:
            - name: config
              mountPath: /data/ratelimit/config/config.yaml
              subPath: config.yaml
      volumes:
        - name: config
          configMap:
            name: ratelimit-config
---
apiVersion: v1
kind: Service
metadata:
  name: ratelimit
  namespace: default
spec:
  selector:
    app: ratelimit
  ports:
    - name: grpc
      port: 8081
      targetPort: 8081
EOF
```

### Apply the policy with CEL descriptors

Two CEL expressions inspect the JSON-RPC body on every request: one to identify `tools/call` traffic, and one to extract the tool name so each tool gets its own counter bucket.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: mcp-tool-ratelimit
  namespace: default
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      name: mcp
  traffic:
    rateLimit:
      global:
        backendRef:
          kind: Service
          name: ratelimit
          port: 8081
        domain: mcp-tools
        descriptors:
          - entries:
              # Identify tool calls vs other MCP operations (initialize, tools/list, …)
              - name: mcp_method
                expression: |
                  json(request.body).with(body,
                    body.method == "tools/call" ? "tools/call" : "other"
                  )
              # Extract the tool name so each tool gets its own counter bucket
              - name: tool_name
                expression: |
                  json(request.body).with(body,
                    body.method == "tools/call" ? string(body.params.name) : "none"
                  )
EOF
```

The `mcp_method` expression returns `"tools/call"` only when the JSON-RPC `method` field matches exactly. For every other MCP operation — `initialize`, `tools/list`, `notifications/initialized` — it returns `"other"`, which has no configured limit in the `ratelimit-config` ConfigMap so those requests are never throttled.

The `tool_name` expression reaches into `params.name` to get the tool being invoked. Combined with `mcp_method`, the rate limit service receives a two-key descriptor like `mcp_method=tools/call, tool_name=trigger-long-running-operation` and looks up the matching rule.

### Verify the policy attached

```sh
kubectl get {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} mcp-tool-ratelimit -n default \
  -o jsonpath='{.status.ancestors[0].conditions}' | jq .
```

Both `Accepted` and `Attached` must be `True`.

### Test per-tool limits

Send multiple requests to different tools and verify that each tool has its own independent rate limit.

{{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}
```sh
# trigger-long-running-operation: 3/min limit — hits 429 on the 4th call
for i in $(seq 1 5); do
  npx @modelcontextprotocol/inspector \
    --cli "http://$INGRESS_GW_ADDRESS/mcp" \
    --transport http \
    --method tools/call \
    --tool-name trigger-long-running-operation \
    --tool-arg duration=1 \
    --tool-arg steps=1
done

# echo: 10/min limit — all 5 pass through
for i in $(seq 1 5); do
  npx @modelcontextprotocol/inspector \
    --cli "http://$INGRESS_GW_ADDRESS/mcp" \
    --transport http \
    --method tools/call \
    --tool-name echo \
    --tool-arg message='Hello World!'
done
```
{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}
```sh
# trigger-long-running-operation: 3/min limit — hits 429 on the 4th call
for i in $(seq 1 5); do
  npx @modelcontextprotocol/inspector \
    --cli "http://localhost:8080/mcp" \
    --transport http \
    --method tools/call \
    --tool-name trigger-long-running-operation \
    --tool-arg duration=1 \
    --tool-arg steps=1
done

# echo: 10/min limit — all 5 pass through
for i in $(seq 1 5); do
  npx @modelcontextprotocol/inspector \
    --cli "http://localhost:8080/mcp" \
    --transport http \
    --method tools/call \
    --tool-name echo \
    --tool-arg message='Hello World!'
done
```
{{% /tab %}}
{{< /tabs >}}

Each tool maintains an independent counter in Redis. Exhausting `trigger-long-running-operation`'s budget has no effect on `echo` — the descriptor key `tool_name` ensures the counters never collide.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} mcp-rate-limit -n default
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} mcp-tool-ratelimit -n default
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} gateway-ceiling -n {{< reuse "agw-docs/snippets/namespace.md" >}}

# Remove the rate limit infrastructure
kubectl delete deployment ratelimit redis -n default
kubectl delete service ratelimit redis -n default
kubectl delete configmap ratelimit-config -n default
```

## Summary

| What you want | How to configure it |
|--------------|---------------------|
| Cap tool call sessions per second | {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} on `HTTPRoute`, `local[].requests` — remember ~5 HTTP requests per session |
| Allow burst for session initialization | Add `burst` — each session needs several requests before the first tool call runs |
| Hard ceiling across all gateway traffic | {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} on `Gateway`, `local[].requests` |
| Per-tool rate limits (e.g. tighter for expensive tools) | Global rate limit + CEL descriptors extracting `body.method` and `body.params.name` |
| Combine auth + rate limiting | Apply both `mcp.authentication` and `traffic.rateLimit` in the same {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} or use separate policies |

For LLM-specific rate limiting by token spend, see the [LLM rate limiting guide]({{< link-hextra path="/llm/rate-limit" >}}). For HTTP rate limiting, see the [HTTP rate limiting guide]({{< link-hextra path="/security/rate-limit-http" >}}).
