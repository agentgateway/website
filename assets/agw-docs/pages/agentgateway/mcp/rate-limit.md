Control MCP tool call rates to prevent overload and ensure fair access to expensive tools.

## About

Rate limiting for MCP traffic helps you protect tool servers from abuse and control costs for expensive operations. Every MCP operation — whether it's `tools/list`, `tools/call`, `resources/read`, or any other JSON-RPC method — is a single HTTP POST to the MCP endpoint. From the gateway's perspective, there is no distinction between listing tools and actually running one.

### How tool calls map to HTTP requests

Before adding limits, it helps to understand what agentgateway is counting. A typical MCP client session looks like the posts in the following table.

| Client action | HTTP requests to `/mcp` |
|---------------|------------------------|
| Connect to server | `initialize` → 1 POST |
| List available tools | `tools/list` → 1 POST |
| Call a tool once | `tools/call` → 1 POST |
| **Total per tool call session** | **~3–5 POSTs** |

This means a `requests: 5` per-second limit doesn't allow 5 tool calls per second. Instead, the limit allows roughly 1 tool call session per second (5 requests ÷ ~5 per session). Size your limits accordingly: think in sessions, not raw HTTP requests.

Each `npx @modelcontextprotocol/inspector --cli` invocation sends a full MCP session sequence: `initialize` handshake → `tools/list` → `tools/call`. That's **3 HTTP requests per tool call sequence**. With 15 total capacity (5 base + 10 burst), you get `15 ÷ 3 = 5 complete sequences` before the bucket empties.

This is the key insight for sizing MCP rate limits: **count sessions, not raw requests**. If your client makes 5 HTTP round-trips per tool call, a limit of `requests: 5` per second effectively allows only ~3 tool call sequences in the initial burst, not 15.

If you need to differentiate between tool calls and other MCP operations (such as to allow unlimited `tools/list` requests but cap `tools/call` requests), use [global rate limiting with CEL descriptors](#global-per-tool) to inspect the JSON-RPC method body.

### Response headers

{{< reuse "agw-docs/snippets/ratelimit-headers.md" >}}

### Gateway-level vs Route-level policies {#gateway-route}

You can apply rate limits at different levels to implement layered protection. Gateway-level policies act as a hard backstop across all traffic, while route-level policies provide finer-grained control.

When both a gateway-level policy and a route-level policy are defined, the route-level policy takes precedence for traffic matching that route.

**Gateway-level ceiling**

Add a gateway-level policy as a hard backstop across all traffic: HTTP, MCP, and LLM routes alike.

{{< details title="Example gateway-level policy" >}}
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
{{< /details >}}

**Route-level, MCP-specific limits**

With both policies in place, the MCP route uses its own tighter limit (5 req/s), while the gateway ceiling applies to all other routes.

### Use cases

Review the following table for example use cases and configuration guidance.

| What you want | How to configure it |
|--------------|---------------------|
| Cap tool call sessions per second | {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} on `HTTPRoute`, `local[].requests`. Remember ~5 HTTP requests per session. |
| Allow burst for session initialization | Add `burst` because each session needs several requests before the first tool call runs. |
| Hard ceiling across all gateway traffic | {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} on `Gateway`, `local[].requests`. |
| Per-tool rate limits (e.g. tighter for expensive tools) | Global rate limit + CEL descriptors extracting `body.method` and `body.params.name`. |
| Combine auth + rate limiting | Apply both `mcp.authentication` and `traffic.rateLimit` in the same {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} or use separate policies. |

Also, check out the rate limiting guides for other use cases:

- [LLM rate limiting by token expenses]({{< link-hextra path="/llm/rate-limit" >}}).
- [HTTP rate limiting]({{< link-hextra path="/security/rate-limit-http" >}}).

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Deploy and route to an MCP server through agentgateway. For setup instructions, see [Route to a static MCP server]({{< link-hextra path="/mcp/static-mcp/" >}}).

## Local rate limiting {#local}

Local rate limiting runs in-process on each agentgateway proxy replica. The following steps show how to apply a per-route rate limit and verify its behavior with rapid tool call sessions.

1. Apply a rate limit directly to the MCP HTTPRoute. The following example allows 5 tool calls per second with a burst of up to 15 (5 base + 10 burst) before the request is rate limited and a 429 HTTP response is returned. The burst headroom is important for MCP clients: during session initialization, an agent typically fires `initialize` → `tools/list` → several `tools/call` requests back-to-back. Without burst capacity, the MCP server would hit the limit before doing any real work.

   ```yaml {paths="mcp-local-rate-limit"}
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

   {{< doc-test paths="mcp-local-rate-limit" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for mcp-rate-limit policy to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: default
           name: mcp-rate-limit
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 2
   EOF
   {{< /doc-test >}}

2. Verify that the policy is attached.

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

3. Use an MCP client to call tools in a tight loop.

   The following example assumes you have the MCP Inspector CLI installed. If prompted, install the MCP Inspector packages.

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

   The first 5 complete tool call sequences succeed before the rate limit is reached. After that, subsequent requests are rate limited.

## Per-tool rate limits with CEL descriptors {#global-per-tool}

Local rate limiting treats every POST to `/mcp` identically. But some tools are more expensive than others, and so they deserve tighter limits. Global rate limiting with CEL descriptors lets you look inside the MCP request body and apply different ceilings per tool name.

{{< callout >}}
Global rate limiting requires an external [Envoy Rate Limit service](https://github.com/envoyproxy/ratelimit) backed by Redis. For a complete guide on global rate limiting architecture and setup, see the [Global rate limiting guide]({{< link-hextra path="/security/rate-limit-global" >}}).
{{< /callout >}}

The following steps show how to set up global rate limiting infrastructure and configure per-tool rate limits using CEL expressions.

1. Deploy the rate limit service. The following example shows an MCP-specific configuration that applies different limits to different tools. The tool calls are identified by descriptors that are divided into two categories: expensive ones that are 3 calls per minute (`trigger-long-running-operation` and `sampleLLMCall`) and all other tool calls that are 10 calls per minute.

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

2. Apply the global rate limiting policy with CEL descriptors. The following example configuration includes two CEL expressions that inspect the JSON-RPC body on every request. 

   * **Identify `tools/call` traffic**. The `mcp_method` expression returns `"tools/call"` only when the JSON-RPC `method` field matches exactly. For every other MCP operation, such as `initialize`, `tools/list`, `notifications/initialized`, it returns `"other"`, which has no configured limit in the `ratelimit-config` ConfigMap. Because of that, these types of requests are never throttled.
   * **Extract the tool name so each tool gets its own counter bucket**. The `tool_name` expression checks the `params.name` field to find the tool that is invoked. Combined with `mcp_method`, the rate limit service receives a two-key descriptor like `mcp_method=tools/call, tool_name=trigger-long-running-operation` and looks up the matching rule.

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

3. Verify that the policy is attached. Both `Accepted` and `Attached` must be `True`.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} mcp-tool-ratelimit -n default \
     -o jsonpath='{.status.ancestors[0].conditions}' | jq .
   ```

4. Send multiple requests to different tools and verify that each tool has its own independent rate limit.

   Each tool maintains an independent counter in Redis. Exhausting the budget for `trigger-long-running-operation` tool call (3 requests per minute) has no effect on the `echo` tool call (10 requests per minute) because they have separate rate limit counters.

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

   Example output:

   ```
   # trigger-long-running-operation calls (3/min limit)
   {
     "content": [{ "type": "text", "text": "Operation started..." }]
   }
   {
     "content": [{ "type": "text", "text": "Operation started..." }]
   }
   {
     "content": [{ "type": "text", "text": "Operation started..." }]
   }
   Failed to call tool trigger-long-running-operation: Failed to list tools: Streamable HTTP error: Error POSTing to endpoint: rate limit exceeded
   Failed with exit code: 1

   # echo calls (10/min limit) - all succeed
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
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="mcp-local-rate-limit"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} mcp-rate-limit -n default
```
