Apply local and global rate limits to HTTP traffic to protect your backend services from overload.

## About

Rate limiting in agentgateway protects your services from being overwhelmed by excessive traffic. A runaway automation script, a misconfigured retry loop, or a deliberate flood can exhaust your upstream's capacity in seconds. Rate limiting gives you precise control over how much traffic reaches any route or the entire gateway — without any changes to the backend.

Rate limiting in agentgateway is expressed through {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resources. A policy attaches to a Gateway or HTTPRoute target, and defines limits in the `spec.traffic.rateLimit` field. Gateway-level policies act as a hard ceiling on total traffic, while route-level policies provide finer-grained control.

Additionally, you can set up local or global rate limiting, depending on whether you want limits shared across Gateway instances.

| Mode | Where limits are enforced | Use case |
|------|-----------------|----------|
| Local | In-process, per proxy replica | Simple per-route or gateway-wide limits |
| Global | External rate limit service | Shared limits across multiple proxy replicas |

For AI-specific use cases, see:
- [Rate limiting for LLMs]({{< link-hextra path="/llm/rate-limit" >}})
- [Rate limiting for MCP]({{< link-hextra path="/mcp/rate-limit" >}})

### Gateway-level global DoS protection

Target your `Gateway` resource to apply a limit across all routes. This acts as a hard ceiling on total gateway throughput regardless of which route is hit.

{{< details title="Example gateway policy" >}}
```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: gateway-rate-limit
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  traffic:
    rateLimit:
      local:
      - requests: 5000
        unit: Minutes
        burst: 1000
EOF
```
{{< /details >}}

### Route-level rate limit

Route-level policies take precedence over gateway-level ones for their specific traffic.

{{< details title="Example route policy" >}}

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: httpbin-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      local:
      - requests: 3
        unit: Seconds
        burst: 3
EOF
```
{{< /details >}}

### Inheritance

Policies apply at the attachment point with a clear precedence order:

```
Gateway → Listener → Route → Route Rule → Backend
```

More specific policies win. A route-level limit overrides a gateway-level limit for traffic on that route.

With both policies in place, traffic to `www.example.com` is subject to the route limit (3 req/s), while all other routes are bounded only by the gateway limit (5000 req/min).

### Response headers

{{< reuse "agw-docs/snippets/ratelimit-headers.md" >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-x-channel.md" >}}

## Local rate limiting {#local}

Local rate limiting runs entirely inside the agentgateway proxy — no external service needed. The following steps show how to apply request-based limits to your HTTP traffic.

1. Apply a rate limit to the httpbin HTTPRoute.

   ```yaml {paths="local-rate-limit"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: httpbin-rate-limit
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     traffic:
       rateLimit:
         local:
         - requests: 3
           unit: Seconds
           burst: 3
   EOF
   ```

   {{< doc-test paths="local-rate-limit" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for httpbin rate limit policy to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: httpbin
           name: httpbin-rate-limit
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 2
   EOF
   {{< /doc-test >}}

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Field | Required | Description |
   |-------|----------|-------------|
   | `requests` | Yes | Number of requests allowed per `unit`. |
   | `unit` | Yes | `Seconds`, `Minutes`, or `Hours`. |
   | `burst` | No | Extra requests allowed above the base rate in a short burst. The `burst` field implements a token bucket on top of the base rate. With `requests: 3, burst: 3`, you get up to 6 requests in one burst (3 base + 3 burst capacity), then the bucket refills at 3 per second. This absorbs short traffic spikes without rejecting requests. This setting only works with `requests`, not with `token` rate limits.|

2. Verify that the policy is attached.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} httpbin-rate-limit -n httpbin \
     -o jsonpath='{.status.ancestors[0].conditions}' | jq .
   ```

   A healthy policy reports both `Accepted` and `Attached` as `True`:

   ```json
   [
     {
       "type": "Accepted",
       "status": "True",
       "message": "Policy accepted"
     },
     {
       "type": "Attached",
       "status": "True",
       "message": "Attached to all targets"
     }
   ]
   ```

   If `Attached` is `False`, the policy's `targetRef` points to a resource that doesn't exist. Check the `message` field for the exact resource name that's missing.

3. Fire 10 rapid requests to test the rate limit.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   for i in $(seq 1 10); do
     STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
       http://$INGRESS_GW_ADDRESS:80/headers -H "host: www.example.com")
     echo "Request $i: HTTP $STATUS"
   done
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   for i in $(seq 1 10); do
     STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
       localhost:8080/headers -H "host: www.example.com")
     echo "Request $i: HTTP $STATUS"
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   Request 1: HTTP 200
   Request 2: HTTP 200
   Request 3: HTTP 200
   Request 4: HTTP 200
   Request 5: HTTP 200
   Request 6: HTTP 200
   Request 7: HTTP 429
   Request 8: HTTP 429
   Request 9: HTTP 429
   Request 10: HTTP 429
   ```

   The first 6 succeed (3 base + 3 burst), then requests are rejected until the bucket refills. Inspect a 429 response to see the rate limit headers:

   ```
   HTTP/1.1 429 Too Many Requests
   x-ratelimit-limit: 6
   x-ratelimit-remaining: 0
   x-ratelimit-reset: 0
   content-type: text/plain
   content-length: 19

   rate limit exceeded
   ```

4. After 1 second the bucket refills and requests succeed again.

   ```sh
   sleep 1 && curl -o /dev/null -w "%{http_code}\n" \
     localhost:8080/headers -H "host: www.example.com"
   # 200
   ```

   {{< doc-test paths="local-rate-limit" >}}
   # Test rate limiting by sending requests in rapid succession
   for i in $(seq 1 6); do
     curl -s -o /dev/null http://${INGRESS_GW_ADDRESS}:80/anything -H "host: www.example.com" &
   done
   wait

   # Now verify the rate limit is active
   YAMLTest -f - <<'EOF'
   - name: Verify rate limit kicks in after burst
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything"
       method: GET
       headers:
         host: www.example.com
     source:
       type: local
     expect:
       statusCode: 429
     retries:
       maxAttempts: 3
       intervalSeconds: 0
   EOF
   {{< /doc-test >}}

## Global rate limiting {#global}

Local rate limiting runs independently on each proxy replica. If you run multiple agentgateway replicas and need a shared quota across the fleet, use global rate limiting backed by an external service such as [Envoy's rate limit service](https://github.com/envoyproxy/ratelimit).

For detailed instructions on setting up global rate limiting with descriptors and an external rate limit service, see the [Global rate limiting guide]({{< link-hextra path="/security/rate-limit-global" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="local-rate-limit"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} httpbin-rate-limit -n httpbin
```
