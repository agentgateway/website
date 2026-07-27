---
title: Docker
weight: 20
description: Run agentgateway as a Docker container
test:
  docker-provider-configs:
  - file: content/docs/standalone/main/integrations/platforms/docker.md
    path: docker-provider-configs
---

Run agentgateway as a Docker container for local development or small deployments.

## Quick start

Get started in under a minute with your preferred LLM provider.

{{< tabs >}}

{{% tab name="OpenAI" %}}

```bash
# Set your API key
export OPENAI_API_KEY=your-api-key

# Create config for OpenAI
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: $OPENAI_API_KEY
EOF

# Run agentgateway
docker run -v "$PWD/config.yaml:/config.yaml" -p 3000:3000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab name="Anthropic" %}}

```bash
# Set your API key
export ANTHROPIC_API_KEY=your-api-key

# Create config for Anthropic
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: anthropic
    params:
      apiKey: $ANTHROPIC_API_KEY
EOF

# Run agentgateway
docker run -v "$PWD/config.yaml:/config.yaml" -p 3000:3000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab name="xAI (Grok)" %}}

```bash
# Set your xAI API key
export XAI_API_KEY=your-api-key

# Create config for xAI
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: $XAI_API_KEY
      baseUrl: "https://api.x.ai"
EOF

# Run agentgateway
docker run -v "$PWD/config.yaml:/config.yaml" -p 3000:3000 \
  -e XAI_API_KEY=$XAI_API_KEY \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-2-latest","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab name="Ollama" %}}

```bash
# Start Ollama (if not already running)
ollama serve &

# Pull a model
ollama pull llama3.2

# Create config for Ollama
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      baseUrl: "http://host.docker.internal:11434"
EOF

# Run agentgateway (use host.docker.internal to reach Ollama on the host)
docker run -v "$PWD/config.yaml:/config.yaml" -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab name="Azure OpenAI" %}}

```bash
# Set your Azure OpenAI credentials
export AZURE_OPENAI_API_KEY=your-api-key
export AZURE_DEPLOYMENT=your-deployment-name
export AZURE_RESOURCE_NAME=your-resource-name

# Create config for Azure OpenAI
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: azure
    params:
      model: $AZURE_DEPLOYMENT
      azureResourceName: $AZURE_RESOURCE_NAME
      azureResourceType: openAI
      apiKey: $AZURE_OPENAI_API_KEY
EOF

# Run agentgateway
docker run -v "$PWD/config.yaml:/config.yaml" -p 3000:3000 \
  -e AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY \
  -e AZURE_DEPLOYMENT=$AZURE_DEPLOYMENT \
  -e AZURE_RESOURCE_NAME=$AZURE_RESOURCE_NAME \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab name="Amazon Bedrock" %}}

```bash
# Set your AWS credentials
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1

# Create config for Amazon Bedrock
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: $AWS_REGION
EOF

# Run agentgateway
docker run -v "$PWD/config.yaml:/config.yaml" -p 3000:3000 \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION=$AWS_REGION \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} -f /config.yaml

# Test with a chat completion
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"anthropic.claude-3-5-sonnet-20241022-v2:0","messages":[{"role":"user","content":"Hello!"}]}'
```

{{% /tab %}}

{{% tab name="Google Gemini" %}}

```bash
# Set your API key
export GEMINI_API_KEY=your-api-key

# Create config for Google Gemini
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: gemini
    params:
      apiKey: $GEMINI_API_KEY
EOF

# Run agentgateway
docker run -v "$PWD/config.yaml:/config.yaml" -p 3000:3000 \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} -f /config.yaml

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
docker run -v "$PWD/config.yaml:/config.yaml" -p 3000:3000 \
  -p 127.0.0.1:15000:15000 -e ADMIN_ADDR=0.0.0.0:15000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} -f /config.yaml
```

Then open [http://localhost:15000/ui/](http://localhost:15000/ui/) in your browser.

## Docker Compose

For more complex setups, use Docker Compose:

```yaml
services:
  agentgateway:
    container_name: agentgateway
    restart: unless-stopped
    image: cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}}
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

{{< doc-test paths="docker-provider-configs" >}}
# WHAT THIS TEST VALIDATES:
#   * Each LLM provider config shown in the Quick start tabs is schema-valid
#     (agentgateway --validate-only): OpenAI, Anthropic, xAI, Ollama,
#     Amazon Bedrock, Google Gemini, and Azure OpenAI. This guards against
#     field-name regressions like the Bedrock `region` -> `awsRegion` fix
#     (issue #428) and the Azure `azureEndpoint`/`azureApiKey` fix.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The `docker run ...` commands and `curl` chat completions in each tab
#     — External dependency: each needs a real provider API key/credentials
#     and a live LLM endpoint, which the test cannot stand up.
#   * The "Access the Admin UI" and "Docker Compose" sections — Display-only:
#     no scriptable assertion without a running container and a real key.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="docker-provider-configs" >}}
# Dummy values let shellexpand resolve the $VARs in each config. --validate-only
# only checks schema, so the values themselves are never used for a real call.
export OPENAI_API_KEY="test"
export ANTHROPIC_API_KEY="test"
export XAI_API_KEY="test"
export GEMINI_API_KEY="test"
export AWS_REGION="us-east-1"
export AZURE_OPENAI_API_KEY="test"
export AZURE_DEPLOYMENT="gpt-4o"
export AZURE_RESOURCE_NAME="test-resource"

# OpenAI (Quick start > OpenAI tab)
cat <<'EOF' > /tmp/docker-openai.yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: $OPENAI_API_KEY
EOF
agentgateway -f /tmp/docker-openai.yaml --validate-only

# Anthropic (Quick start > Anthropic tab)
cat <<'EOF' > /tmp/docker-anthropic.yaml
llm:
  models:
  - name: "*"
    provider: anthropic
    params:
      apiKey: $ANTHROPIC_API_KEY
EOF
agentgateway -f /tmp/docker-anthropic.yaml --validate-only

# xAI / Grok (Quick start > xAI (Grok) tab)
cat <<'EOF' > /tmp/docker-xai.yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: $XAI_API_KEY
      baseUrl: "https://api.x.ai"
EOF
agentgateway -f /tmp/docker-xai.yaml --validate-only

# Ollama (Quick start > Ollama tab)
cat <<'EOF' > /tmp/docker-ollama.yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      baseUrl: "http://host.docker.internal:11434"
EOF
agentgateway -f /tmp/docker-ollama.yaml --validate-only

# Amazon Bedrock (Quick start > Amazon Bedrock tab)
cat <<'EOF' > /tmp/docker-bedrock.yaml
llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: $AWS_REGION
EOF
agentgateway -f /tmp/docker-bedrock.yaml --validate-only

# Google Gemini (Quick start > Google Gemini tab)
cat <<'EOF' > /tmp/docker-gemini.yaml
llm:
  models:
  - name: "*"
    provider: gemini
    params:
      apiKey: $GEMINI_API_KEY
EOF
agentgateway -f /tmp/docker-gemini.yaml --validate-only

# Azure OpenAI (Quick start > Azure OpenAI tab)
cat <<'EOF' > /tmp/docker-azure.yaml
llm:
  models:
  - name: "*"
    provider: azure
    params:
      model: $AZURE_DEPLOYMENT
      azureResourceName: $AZURE_RESOURCE_NAME
      azureResourceType: openAI
      apiKey: $AZURE_OPENAI_API_KEY
EOF
agentgateway -f /tmp/docker-azure.yaml --validate-only
{{< /doc-test >}}
