---
title: Docker
weight: 20
description: Run agentgateway as a Docker container
---

Run agentgateway as a Docker container for local development or small deployments.

## Quick start

Get started in under a minute with your preferred LLM provider.

{{< tabs items="OpenAI,Anthropic,xAI (Grok),Ollama,Azure OpenAI,Amazon Bedrock,Google Gemini" >}}

{{% tab %}}

```bash
# Set your API key
export OPENAI_API_KEY=your-api-key

# Create config for OpenAI
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-4o-mini
      policies:
        backendAuth:
          key: $OPENAI_API_KEY
EOF

# Run agentgateway
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab %}}

```bash
# Set your API key
export ANTHROPIC_API_KEY=your-api-key

# Create config for Anthropic
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: anthropic
          provider:
            anthropic:
              model: claude-sonnet-4-20250514
      policies:
        backendAuth:
          key: $ANTHROPIC_API_KEY
EOF

# Run agentgateway
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab %}}

```bash
# Set your xAI API key
export XAI_API_KEY=your-api-key

# Create config for xAI
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: api.x.ai
        backendTLS: {}
        backendAuth:
          key: $XAI_API_KEY
      backends:
      - ai:
          name: xai
          hostOverride: api.x.ai:443
          provider:
            openAI:
              model: grok-2-latest
EOF

# Run agentgateway
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  -e XAI_API_KEY=$XAI_API_KEY \
  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-2-latest","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab %}}

```bash
# Start Ollama (if not already running)
ollama serve &

# Pull a model
ollama pull llama3.2

# Create config for Ollama
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: host.docker.internal:11434
      backends:
      - ai:
          name: ollama
          hostOverride: host.docker.internal:11434
          provider:
            openAI:
              model: llama3.2
EOF

# Run agentgateway (use host.docker.internal to reach Ollama on the host)
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab %}}

```bash
# Set your Azure OpenAI credentials
export AZURE_OPENAI_API_KEY=your-api-key
export AZURE_DEPLOYMENT=your-deployment-name
export AZURE_ENDPOINT=your-resource.openai.azure.com

# Create config for Azure OpenAI
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: $AZURE_ENDPOINT
        backendTLS: {}
        backendAuth:
          apiKeyHeader:
            name: api-key
            key: $AZURE_OPENAI_API_KEY
      backends:
      - ai:
          name: azure-openai
          hostOverride: $AZURE_ENDPOINT:443
          provider:
            azureOpenAI:
              deployment: $AZURE_DEPLOYMENT
EOF

# Run agentgateway
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  -e AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY \
  -e AZURE_DEPLOYMENT=$AZURE_DEPLOYMENT \
  -e AZURE_ENDPOINT=$AZURE_ENDPOINT \
  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab %}}

```bash
# Set your AWS credentials
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1

# Create config for Amazon Bedrock
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: bedrock
          provider:
            bedrock:
              region: $AWS_REGION
              model: anthropic.claude-3-5-sonnet-20241022-v2:0
EOF

# Run agentgateway
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION=$AWS_REGION \
  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"anthropic.claude-3-5-sonnet-20241022-v2:0","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab %}}

```bash
# Set your API key
export GEMINI_API_KEY=your-api-key

# Create config for Google Gemini
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: gemini
          provider:
            gemini:
              model: gemini-2.0-flash
      policies:
        backendAuth:
          key: $GEMINI_API_KEY
EOF

# Run agentgateway
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-2.0-flash","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{< /tabs >}}

## Access the Admin UI

By default, the agentgateway admin UI listens on localhost. To access it from your host machine:

```bash
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  -p 127.0.0.1:15000:15000 -e ADMIN_ADDR=0.0.0.0:15000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml
```

Then open [http://localhost:15000/ui/](http://localhost:15000/ui/) in your browser.

## Docker Compose

For more complex setups, use Docker Compose:

```yaml
services:
  agentgateway:
    container_name: agentgateway
    restart: unless-stopped
    image: cr.agentgateway.dev/agentgateway:0.11.1
    ports:
      - "3000:3000"
      - "127.0.0.1:15000:15000"
    volumes:
      - ./config.yaml:/config.yaml
    environment:
      - ADMIN_ADDR=0.0.0.0:15000
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    command: ["-f", "/config.yaml"]
```

Run with:

```bash
docker compose up -d
```

## Learn more

- [Deployment Guide]({{< link-hextra path="/deployment/docker/" >}})
- [Configuration Reference]({{< link-hextra path="/configuration/" >}})
- [LLM Providers]({{< link-hextra path="/llm/providers/" >}})
