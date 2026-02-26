# curl

Test and interact with agentgateway using curl, the command-line HTTP client.

## Overview

Using curl is the simplest way to test agentgateway's OpenAI-compatible API. This is useful for:
- Verifying gateway configuration.
- Testing backend connectivity.
- Debugging request/response payloads.
- Scripting and automation.

## Before you begin

- agentgateway running (e.g., `http://localhost:3000`).
- curl installed (pre-installed on macOS/Linux, [download for Windows](https://curl.se/download.html)).

## Basic chat completion

Send a simple chat completion request:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'
```

**Response:**

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
        "content": "Hello! I'm doing well, thank you for asking. How can I assist you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 13,
    "completion_tokens": 17,
    "total_tokens": 30
  }
}
```

## Streaming responses

Stream responses for real-time output:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "Write a haiku about code"
      }
    ],
    "stream": true
  }'
```

The `-N` flag disables curl's output buffering for streaming.

**Streamed response:**

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Code"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":" flows"},"finish_reason":null}]}

...

data: [DONE]
```

## Authentication

If agentgateway requires authentication, provide an API key:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

If gateway has no authentication configured, omit the Authorization header or use a placeholder.

## Advanced parameters

### Temperature and sampling

Control response randomness and creativity:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ],
    "temperature": 0.7,
    "max_tokens": 500,
    "top_p": 0.9,
    "frequency_penalty": 0.0,
    "presence_penalty": 0.0
  }'
```

| Parameter | Description | Range | Default |
|-----------|-------------|-------|---------|
| `temperature` | Randomness (higher = more creative) | 0.0 - 2.0 | 1.0 |
| `max_tokens` | Maximum response length | 1 - model limit | Unlimited |
| `top_p` | Nucleus sampling threshold | 0.0 - 1.0 | 1.0 |
| `frequency_penalty` | Penalize repeated tokens | -2.0 - 2.0 | 0.0 |
| `presence_penalty` | Penalize new topics | -2.0 - 2.0 | 0.0 |

### System prompts

Add a system message to guide the assistant's behavior:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful Python programming expert."
      },
      {
        "role": "user",
        "content": "How do I read a CSV file?"
      }
    ]
  }'
```

### Multi-turn conversations

Include conversation history:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is the capital of France?"},
      {"role": "assistant", "content": "The capital of France is Paris."},
      {"role": "user", "content": "What is its population?"}
    ]
  }'
```

## Function calling

Request function calls from the model:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "What is the weather in Boston?"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get current weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "City name"
              }
            },
            "required": ["location"]
          }
        }
      }
    ]
  }'
```

**Response with function call:**

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\": \"Boston\"}"
            }
          }
        ]
      }
    }
  ]
}
```

## Embeddings

Generate text embeddings:

```bash
curl http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "The quick brown fox jumps over the lazy dog"
  }'
```

**Response:**

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [
        0.0023064255,
        -0.009327292,
        ...
      ],
      "index": 0
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

## Debugging

### Verbose output

See full HTTP request/response headers:

```bash
curl -v http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Pretty-print JSON

Pipe output through `jq` for formatted JSON:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }' | jq
```

### Save response

Write response to a file:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }' -o response.json
```

### Timing information

Measure request time:

```bash
curl -w "\nTime: %{time_total}s\n" \
  http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Example agentgateway configuration

Here's a minimal gateway configuration for curl testing:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        backendAuth:
          key: $OPENAI_API_KEY
      backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-4o-mini
```

## Troubleshooting

### Connection refused

```bash
curl: (7) Failed to connect to localhost port 3000: Connection refused
```

**Solution:** Verify agentgateway is running:
```bash
ps aux | grep agentgateway
# or
docker ps | grep agentgateway
```

### Model not found

```json
{
  "error": {
    "message": "Model not found",
    "type": "invalid_request_error"
  }
}
```

**Solution:** Verify the model name matches your agentgateway backend configuration. Check logs:
```bash
# Standalone
journalctl -u agentgateway -f

# Docker
docker logs -f agentgateway
```

### Authentication errors

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error"
  }
}
```

**Solution:**
- If gateway has no auth, omit the `Authorization` header.
- If using `backendAuth`, ensure gateway has valid provider credentials.
- Check agentgateway configuration and logs.

### Timeout

```bash
curl: (28) Operation timed out after 30000 milliseconds
```

**Solution:**
- Increase curl timeout: `curl --max-time 60 ...`.
- Check backend provider latency in agentgateway logs.
- Verify backend provider credentials and quota.

## Scripting examples

### Bash script for batch requests

```bash
#!/bin/bash

for prompt in "Hello" "Goodbye" "How are you?"; do
  echo "Prompt: $prompt"
  curl -s http://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"gpt-4o-mini\",
      \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}]
    }" | jq -r '.choices[0].message.content'
  echo ""
done
```

### Python wrapper

```python
import subprocess
import json

def query_gateway(prompt, model="gpt-4o-mini"):
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}]
    })

    result = subprocess.run(
        ["curl", "-s", "http://localhost:3000/v1/chat/completions",
         "-H", "Content-Type: application/json",
         "-d", payload],
        capture_output=True,
        text=True
    )

    response = json.loads(result.stdout)
    return response["choices"][0]["message"]["content"]

print(query_gateway("What is 2+2?"))
```

## Related documentation

- [curl Documentation](https://curl.se/docs/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [agentgateway LLM Configuration]({{< link-hextra path="/llm/" >}})
- [Backend Authentication]({{< link-hextra path="/security/policies/backend-auth/" >}})
