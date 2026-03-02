---
title: Ollama
weight: 15
description: Configure Agentgateway to route LLM traffic to Ollama for local model inference
---

[Ollama](https://ollama.ai/) enables you to run large language models locally on your machine. Agentgateway can route requests to your local Ollama instance, providing a unified interface for both local and cloud-based LLMs.

## Use cases

- **Local development**: Test and develop without cloud API costs.
- **Privacy**: Keep sensitive data on your machine.
- **Offline usage**: Run models without internet connectivity.
- **Cost optimization**: Avoid per-token charges during development.
- **Custom models**: Use fine-tuned or specialized local models.

## Before you begin

1. **Install Ollama**: Download and install from [ollama.ai](https://ollama.ai/download).
2. **Pull a model**: Download at least one model.
   ```bash
   ollama pull llama3.2
   ```
3. **Verify Ollama is running**: Check that Ollama is serving on port 11434.
   ```bash
   curl http://localhost:11434/api/version
   ```

## Basic configuration

Configure Agentgateway to route to your local Ollama instance:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: localhost:11434
      backends:
      - ai:
          name: ollama
          hostOverride: localhost:11434
          provider:
            openAI:
              model: llama3.2  # Default model
```

{{< callout type="info" >}}
**No TLS configuration needed**: Ollama runs on localhost over HTTP by default. The `backendTLS` policy is not required.
{{< /callout >}}

### Test the configuration

```bash
curl 'http://localhost:3000/v1/chat/completions' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "llama3.2",
    "messages": [
      {
        "role": "user",
        "content": "Hello! Tell me about Ollama in one sentence."
      }
    ]
  }'
```

## Model configuration

### List available models

See which models you have pulled locally:

```bash
ollama list
```

Example output:
```
NAME                    ID              SIZE      MODIFIED
llama3.2:latest         a80c4f17acd5    2.0 GB    2 weeks ago
mistral:latest          f974a74358d6    4.1 GB    3 weeks ago
codellama:latest        8fdf8f752f6e    3.8 GB    1 month ago
```

### Pull additional models

Download models from the [Ollama library](https://ollama.ai/library):

```bash
# Pull a specific model
ollama pull mistral

# Pull a specific tag/size
ollama pull llama3.2:70b
```

### Specify model in requests

You can override the default model in each request:

```bash
curl 'http://localhost:3000/v1/chat/completions' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "mistral",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

{{< callout type="note" >}}
If you omit the `model` field in the backend configuration, clients **must** specify the model in each request.
{{< /callout >}}

## Advanced configuration

### Multiple Ollama instances

Route to different Ollama instances (e.g., different machines or ports):

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    # Route to local Ollama
    - policies:
        urlRewrite:
          authority:
            full: localhost:11434
      backends:
      - ai:
          name: ollama-local
          hostOverride: localhost:11434
          provider:
            openAI:
              model: llama3.2

    # Route to remote Ollama instance
    - policies:
        urlRewrite:
          authority:
            full: 192.168.1.100:11434
      backends:
      - ai:
          name: ollama-remote
          hostOverride: 192.168.1.100:11434
          provider:
            openAI:
              model: mistral
```

### Custom port

If you're running Ollama on a non-default port:

```bash
# Start Ollama on custom port
OLLAMA_HOST=0.0.0.0:8080 ollama serve
```

Update your configuration:

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: localhost:8080
      backends:
      - ai:
          name: ollama
          hostOverride: localhost:8080
          provider:
            openAI:
              model: llama3.2
```

### Model parameters

Control generation parameters:

```bash
curl 'http://localhost:3000/v1/chat/completions' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Write a poem"}],
    "temperature": 0.7,
    "max_tokens": 500,
    "top_p": 0.9
  }'
```

## Embeddings with Ollama

Ollama supports embedding models for semantic search and RAG applications.

### Pull an embedding model

```bash
ollama pull nomic-embed-text
```

### Configure for embeddings

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: localhost:11434
      backends:
      - ai:
          name: ollama-embeddings
          hostOverride: localhost:11434
          provider:
            openAI:
              model: nomic-embed-text
```

### Generate embeddings

```bash
curl 'http://localhost:3000/v1/embeddings' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "nomic-embed-text",
    "input": "The quick brown fox jumps over the lazy dog"
  }'
```

### Popular embedding models

| Model | Size | Use Case |
|-------|------|----------|
| `nomic-embed-text` | 274 MB | General purpose, high quality |
| `mxbai-embed-large` | 669 MB | Long context, high accuracy |
| `all-minilm` | 45 MB | Fast, lightweight |

## Production considerations

### Performance tuning

**GPU acceleration**: Ollama automatically uses GPU if available. Check with:
```bash
ollama ps  # Shows GPU utilization
```

**Model loading**: First request may be slow as the model loads into memory. Keep frequently-used models loaded:
```bash
ollama run llama3.2  # Keeps model in memory
```

**Concurrent requests**: Ollama handles multiple concurrent requests. Monitor with:
```bash
ollama ps  # Shows active model and memory usage
```

### Resource requirements

| Model Size | RAM Required | GPU VRAM (if using GPU) |
|------------|--------------|------------------------|
| 3B params | 8 GB | 4 GB |
| 7B params | 16 GB | 8 GB |
| 13B params | 32 GB | 16 GB |
| 70B params | 64+ GB | 40+ GB |

{{< callout type="warning" >}}
**Memory usage**: Ollama loads the entire model into RAM/VRAM. Ensure you have sufficient memory before pulling large models.
{{< /callout >}}

### When NOT to use Ollama

Ollama is great for development but may not be ideal for:
- **Production at scale**: Cloud providers offer better reliability and scaling.
- **Low-resource environments**: Large models require significant RAM/GPU.
- **Latest models**: Cloud providers often have newer/larger models.
- **High availability**: Ollama runs on a single machine without built-in redundancy.

## Troubleshooting

### Connection refused

**What's happening:**

`curl: (7) Failed to connect to localhost port 11434: Connection refused`

**Why it's happening:**

Ollama is not running or is not bound to port 11434.

**How to fix it:**

1. Check Ollama is running.
   ```bash
   ps aux | grep ollama
   ```
2. Start Ollama if not running.
   ```bash
   ollama serve
   ```
3. Check port binding.
   ```bash
   lsof -i :11434
   ```

### Model not found

**What's happening:**

`{"error":"model 'llama3.2' not found"}`

**Why it's happening:**

The requested model has not been pulled to your local Ollama instance.

**How to fix it:**

1. List pulled models.
   ```bash
   ollama list
   ```
2. Pull the model.
   ```bash
   ollama pull llama3.2
   ```
3. Use exact model name from `ollama list` output.

### Slow performance

**What's happening:**

Responses are very slow.

**Why it's happening:**

The model may be too large for your hardware, running on CPU instead of GPU, or other models are consuming resources.

**How to fix it:**

1. **Use smaller models**: Try `llama3.2:3b` instead of `llama3.2:70b`.
2. **Check GPU usage**:
   ```bash
   ollama ps  # Should show GPU if available
   ```
3. **Reduce context window**:
   ```bash
   # Use max_tokens to limit response length
   curl ... --data '{"model": "llama3.2", "max_tokens": 100, ...}'
   ```
4. **Unload unused models**:
   ```bash
   ollama stop <model-name>
   ```

### Out of memory

**What's happening:**

Ollama crashes or fails to load model.

**Why it's happening:**

Your system does not have enough RAM or VRAM to load the model.

**How to fix it:**

1. Use a smaller model variant.
   ```bash
   ollama pull llama3.2:3b  # Instead of 70b
   ```
2. Check available memory.
   ```bash
   # macOS
   vm_stat

   # Linux
   free -h
   ```
3. Close other applications to free memory.
4. Use model quantization (Ollama automatically uses Q4 quantization).

## Next steps

- [Configure multiple LLM providers]({{< ref "/docs/standalone/latest/llm/providers/multiple-llms" >}}) for fallback
- [Set up API keys]({{< ref "/docs/standalone/latest/llm/api-keys" >}}) to control access
- [Enable observability]({{< ref "/docs/standalone/latest/llm/observability" >}}) to track token usage

## Related resources

- [Ollama Official Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Ollama Model Library](https://ollama.ai/library)
- [OpenAI-compatible providers]({{< ref "/docs/standalone/latest/llm/providers/openai-compatible" >}})
