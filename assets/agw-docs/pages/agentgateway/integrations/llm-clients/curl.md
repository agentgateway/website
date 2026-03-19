Test and interact with agentgateway using curl.

## Before you begin

- Agentgateway running at `http://localhost:3000` with a configured LLM backend.
- curl installed (pre-installed on macOS and Linux).

## Example agentgateway configuration

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

## Send a request

```sh
curl http://localhost:3000/v1/chat/completions \
  -H "content-type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
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
        "content": "I'm doing well, thank you! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 13,
    "completion_tokens": 16,
    "total_tokens": 29
  }
}
```

## Authentication

If agentgateway requires authentication, include an `Authorization` header.

```sh
curl http://localhost:3000/v1/chat/completions \
  -H "content-type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }' | jq
```

## Streaming responses

Use the `-N` flag to disable output buffering for streaming.

```sh
curl http://localhost:3000/v1/chat/completions \
  -N \
  -H "content-type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Write a haiku about the cloud"}],
    "stream": true
  }'
```
