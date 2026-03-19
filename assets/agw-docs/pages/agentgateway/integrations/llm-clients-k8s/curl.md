Test your agentgateway Kubernetes deployment using curl.

## Before you begin

- [Get the gateway URL]({{< link-hextra path="/integrations/llm-clients/" >}}).
- Identify the route path from your HTTPRoute, such as `/openai`.

## Send a request

Replace `<route-path>` with the path configured in your HTTPRoute (for example, `/openai`).

```sh
curl "http://$INGRESS_GW_ADDRESS/<route-path>" \
  -H "content-type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello from Kubernetes!"}
    ]
  }' | jq
```

Example output:

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 11,
    "completion_tokens": 10,
    "total_tokens": 21
  }
}
```

## Authentication

If agentgateway requires authentication, include an `Authorization` header.

```sh
curl "http://$INGRESS_GW_ADDRESS/<route-path>" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }' | jq
```

## Troubleshooting

### 404 Not Found

**What's happening:**

The request returns a 404 response.

**Why it's happening:**

The route path in the URL does not match any HTTPRoute configured in agentgateway.

**How to fix it:**

1. Check your HTTPRoute path configuration.

   ```sh
   kubectl get httproute -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml | grep -A 5 "path:"
   ```

### 503 Service Unavailable

**What's happening:**

The gateway returns a 503 response.

**Why it's happening:**

The gateway cannot connect to the backend. The {{< reuse "agw-docs/snippets/backend.md" >}} might not be accepted, or the backend service might not be reachable.

**How to fix it:**

1. Check the {{< reuse "agw-docs/snippets/backend.md" >}} status:
   ```sh
   kubectl get agentgatewaybackend -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
2. Check that backend pods are running (for in-cluster backends):
   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
