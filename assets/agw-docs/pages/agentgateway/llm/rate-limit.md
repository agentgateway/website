Control LLM costs with token-based rate limiting and request-based limits.

## About

Rate limiting for LLM traffic helps you control costs and prevent runaway token consumption. Agentgateway supports both traditional request-based limits and LLM-specific token-based budgets. Token limits let you cap spending on expensive prompts and prevent unexpected bills from prompt injection or misconfigured applications.

### How token counting works

Agentgateway reads the `usage` field from every LLM response to accumulate token counts against the configured budget. Two behaviors are important to understand before applying limits:

**Streaming responses:** Token counts are only known after the full stream completes. The gateway cannot interrupt a response mid-stream. Token-based limits apply to *future* requests — the request that pushes you over the budget completes successfully, and the *next* request gets a 429.

**Counting happens after the fact:** This means token budgets are approximate. With a 1000-token-per-minute limit and a single request that returns 1200 tokens, that request succeeds, you're 200 tokens over budget, and subsequent requests are blocked until the window resets.

This behavior is intentional and matches how real LLM providers implement soft quotas.

### Response headers

{{< reuse "agw-docs/snippets/ratelimit-headers.md" >}}

### Summary

Token budgets degrade gracefully: requests that exceed the budget fail fast with a 429, leaving the backend completely unaffected. After the window resets, the budget is restored and requests succeed again. No manual intervention is required.

Review the following table for example use cases and configuration guidance.

| What you want | How to configure it |
|--------------|---------------------|
| Cap token spend on an LLM route | {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} targeting `HTTPRoute`, `local[].tokens`. |
| Limit requests independently of tokens | Add a second `local[]` entry with `requests`. |
| Streaming-safe token limits | No special config — token limits are always applied post-stream. |
| Hard token ceiling across the gateway | {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} targeting `Gateway`, `local[].tokens`. |
| Per-minute vs per-hour budget | Change `unit` — use `Minutes` for tighter windows, `Hours` for daily-style quotas. |

Also, check out the rate limiting guides for other use cases:

- [Request-based rate limiting on HTTP routes]({{< link-hextra path="/security/rate-limit-http" >}}).
- [MCP tool call limiting]({{< link-hextra path="/mcp/rate-limit" >}}).

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Local token rate limiting {#local-token}

Local token rate limiting runs in-process on each agentgateway proxy replica. The following steps show how to apply a per-route token budget and test it with streaming and non-streaming requests.

1. Apply a token budget to your LLM HTTPRoute.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: llm-token-budget
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: openai
     traffic:
       rateLimit:
         local:
         - tokens: 100
           unit: Minutes
   EOF
   ```

   This limits total token consumption to 100 tokens per minute across all requests hitting this route.

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Field | Required | Description |
   |-------|----------|-------------|
   | `tokens` | Yes (or `requests`) | Number of tokens allowed per `unit` |
   | `unit` | Yes | `Seconds`, `Minutes`, or `Hours` |

   Note: `burst` is not applicable to token limits — token counts are known only after each response completes, so there is no bucket to burst from.

2. Verify the policy attached.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} llm-token-budget -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.status.ancestors[0].conditions}' | jq .
   ```

   Example output:

   ```json
   [
     { "type": "Accepted", "status": "True", "message": "Policy accepted" },
     { "type": "Attached", "status": "True", "message": "Attached to all targets" }
   ]
   ```

3. Send repeated requests and watch the budget drain.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   for i in $(seq 1 10); do
     RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
       http://$INGRESS_GW_ADDRESS/openai \
       -H "Content-Type: application/json" \
       -d '{
         "model": "gpt-4",
         "messages": [{"role": "user", "content": "Say hello in exactly 10 words."}]
       }')
     STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
     TOKENS=$(echo "$RESPONSE" | jq -r '.usage.total_tokens // "blocked"' 2>/dev/null)
     echo "Request $i: HTTP $STATUS — tokens: $TOKENS"
   done
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   for i in $(seq 1 10); do
     RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
       localhost:8080/openai \
       -H "Content-Type: application/json" \
       -d '{
         "model": "gpt-4",
         "messages": [{"role": "user", "content": "Say hello in exactly 10 words."}]
       }')
     STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
     TOKENS=$(echo "$RESPONSE" | jq -r '.usage.total_tokens // "blocked"' 2>/dev/null)
     echo "Request $i: HTTP $STATUS — tokens: $TOKENS"
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   Request 1:  HTTP 200 — tokens: 39
   Request 2:  HTTP 200 — tokens: 39
   Request 3:  HTTP 200 — tokens: 39
   Request 4:  HTTP 429 — tokens: blocked
   ...
   ```

   After the token budget is exhausted, subsequent requests return 429 until the minute window resets.

4. Test with streaming to verify that token limits work the same way with streaming responses.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -N http://$INGRESS_GW_ADDRESS/openai \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4",
       "messages": [{"role": "user", "content": "Count from 1 to 20."}],
       "stream": true
     }'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -N localhost:8080/openai \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4",
       "messages": [{"role": "user", "content": "Count from 1 to 20."}],
       "stream": true
     }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   You'll see the SSE chunks arrive in full:

   ```
   data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"delta":{"content":"1"},...}]}
   data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"delta":{"content":", 2"},...}]}
   ...
   data: [DONE]
   ```

   After the stream ends, agentgateway reads the accumulated token count from the final chunk's `usage` field and updates the budget. The *next* request after this stream will be rejected if the budget is exhausted.

## Combining request and token limits {#combined}

You can apply both request-based and token-based limits to the same route. Both limits are evaluated independently — a request must pass both checks to succeed.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: llm-combined-limit
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: openai
  traffic:
    rateLimit:
      local:
      - requests: 10
        unit: Minutes
        burst: 5
      - tokens: 1000
        unit: Minutes
EOF
```

This configuration enforces:
- Maximum 10 requests per minute (with up to 5 burst)
- Maximum 1000 tokens per minute

Both limits apply to the same traffic. If either limit is exceeded, the request is rejected with a 429 response.

## Gateway-level token limits {#gateway}

Apply a token budget across all LLM routes by targeting the Gateway resource.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: gateway-token-limit
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  traffic:
    rateLimit:
      local:
      - tokens: 10000
        unit: Hours
EOF
```

This acts as a hard ceiling on total token consumption across the entire gateway, regardless of which route is hit.

## Global rate limiting for LLMs {#global}

Local rate limiting runs independently on each proxy replica. For shared token budgets across multiple agentgateway replicas, use global rate limiting with an external rate limit service.

For detailed instructions on setting up global rate limiting with descriptors and an external rate limit service, see the [Global rate limiting guide]({{< link-hextra path="/security/rate-limit-global" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} llm-token-budget -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} llm-combined-limit -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} gateway-token-limit -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
