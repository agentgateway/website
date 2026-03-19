Test your agentgateway Kubernetes deployment using curl.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

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
