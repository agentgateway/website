Configure [Ollama](https://ollama.ai/) to serve local models through agentgateway. Ollama runs models locally on your machine and exposes an OpenAI-compatible API that agentgateway can route to.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

2. Install [Ollama](https://ollama.ai/download).

3. Make sure that you have at least one model pulled locally.
   
   ```sh
   ollama list
   ```

   If not, pull a model.
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

Send a request to verify that agentgateway routes to Ollama. The model name in the request must match a model you have pulled with `ollama pull`.

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

Example output:
```json
{"model":"llama3.2","usage":{"prompt_tokens":14,"completion_tokens":323,"total_tokens":337},"choices":[{"message":{"content":"<think>\nOkay, user just asked for a one-sentence explanation of Ollama. That's pretty concise and specific—no fluff allowed here. They're probably either testing my knowledge or genuinely need a quick definition without jargon overload.\n\nHmm, judging by the tone, they might be evaluating if I can give crisp technical explanations. Since they didn't specify their familiarity level, a neutral layman-to-engineer explanation would work best. \n\nOllama is known for being a wrapper around LLMs that handles infrastructure stuff invisibly to end users. But how to phrase it in one sentence without sounding like \"magic\"? Need to balance clarity and technical accuracy...\n\n*Brainstorming:*\nOption 1: Focus on what it does (local, multi-model inference) + benefit aspect\nOption 2: Contrast with alternatives (\"handles all the heavy lifting\")\nOption 3: Mention its approach-to-problem innovation\n\nGoing with Option 1 feels safest since non-engineers might struggle with \"wrapper\" terminology. Also emphasizing accessibility (\"you\") helps bridge technical and casual users. Should keep it under 50 characters for social media-readiness.\n\n...wait, is this going to feel too basic? No—simple beats vague when someone asks explicitly. Final polish: add asterisk as signal that I can expand explanation if they want more depth.\n</think>\nOllama lets you run large language models (LLMs) like Llama and Mistral on your device by handling all the infrastructure work for local multi-model inference.\n\n*(Let me know if you'd like a longer explanation!)*","role":"assistant"},"index":0,"finish_reason":"stop"}],"id":"chatcmpl-738","object":"chat.completion","created":1773934551,"system_fingerprint":"fp_ollama"}
```

## Troubleshooting

### Rate limit exceeded (429)

**What's happening:**

The request returns `rate limit exceeded` and logs show `endpoint=api.openai.com:443`.

**Why it's happening:**

The `hostOverride` setting is not being applied, so agentgateway is sending requests to the default OpenAI host (`api.openai.com`) instead of your local Ollama. Without a valid OpenAI API key or within rate limits, that API returns a 429 response.

**How to fix it:**

1. Ensure agentgateway is started with your config file explicitly.
   ```sh
   agentgateway -f /path/to/your/config.yaml
   ```

2. In the config file, put `hostOverride` under `params` with correct indentation and use a string value.
   ```yaml
   llm:
     port: 3000
     models:
     - name: "*"
       provider: openAI
       params:
         hostOverride: "localhost:11434"
   ```

After a successful fix, the agentgateway logs show `endpoint=localhost:11434` (or your override) instead of `api.openai.com:443`.

### Connection refused

**What's happening:**

Requests to agentgateway return a 503 error or connection refused.

**Why it's happening:**

Ollama is not running or is not listening on the expected port.

**How to fix it:**

1. Verify Ollama is running.
   ```sh
   curl http://localhost:11434/api/version
   ```

   Example output:
   ```json
   {"version":"0.11.8"}
   ```

2. If Ollama is not running, start it.
   ```sh
   ollama serve
   ```

### Model not found

**What's happening:**

The response returns a model not found error.

**Why it's happening:**

The requested model has not been pulled to your local Ollama instance.

**How to fix it:**

1. List available models.
   ```sh
   ollama list
   ```
2. Pull the missing model.
   ```sh
   ollama pull llama3.2
   ```
