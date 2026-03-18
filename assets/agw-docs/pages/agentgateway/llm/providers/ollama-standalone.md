Configure [Ollama](https://ollama.ai/) to serve local models through agentgateway. Ollama runs models locally on your machine and exposes an OpenAI-compatible API that agentgateway can route to.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You also need the following prerequisites.

- [Ollama](https://ollama.ai/download) installed and running.
- At least one model pulled:
  ```sh
  ollama pull llama3.2
  ```

## Configure agentgateway

Create a configuration file that routes requests to your local Ollama instance.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      hostOverride: "localhost:11434"
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting | Description |
|---------|-------------|
| `provider` | Set to `openAI` because Ollama exposes an OpenAI-compatible API. |
| `params.hostOverride` | Points to the Ollama server address. The default Ollama port is `11434`. |
| `name: "*"` | Matches any model name, so clients can request any model that Ollama has pulled. |

Start agentgateway:

```sh
agentgateway -f config.yaml
```

## Test the configuration

Send a request to verify that agentgateway routes to Ollama.

```sh
curl http://localhost:3000/v1/chat/completions \
  -H "content-type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [
      {"role": "user", "content": "Hello! Tell me about Ollama in one sentence."}
    ]
  }' | jq
```

The model name in the request must match a model you have pulled with `ollama pull`.

## Troubleshooting

### Connection refused

**What's happening:**

Requests to agentgateway return a 503 error or connection refused.

**Why it's happening:**

Ollama is not running or is not listening on the expected port.

**How to fix it:**

1. Verify Ollama is running:
   ```sh
   curl http://localhost:11434/api/version
   ```
2. If Ollama is not running, start it:
   ```sh
   ollama serve
   ```

### Model not found

**What's happening:**

The response returns a model not found error.

**Why it's happening:**

The requested model has not been pulled to your local Ollama instance.

**How to fix it:**

1. List available models:
   ```sh
   ollama list
   ```
2. Pull the missing model:
   ```sh
   ollama pull llama3.2
   ```
