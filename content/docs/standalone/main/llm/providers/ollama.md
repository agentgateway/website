---
title: Ollama
weight: 15
description: Configure agentgateway to route LLM traffic to Ollama for local model inference
test:
  ollama-standalone-validate:
  - file: content/docs/standalone/main/llm/providers/ollama.md
    path: ollama-standalone-validate
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/ollama-standalone.md" >}}

{{< doc-test paths="ollama-standalone-validate" >}}
# Install agentgateway binary for testing
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/patch-dev.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"

# Write and validate the ollama config from the guide
cat > /tmp/test-ollama-standalone.yaml << 'EOF'
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      hostOverride: "localhost:11434"
EOF
agentgateway -f /tmp/test-ollama-standalone.yaml --validate-only
{{< /doc-test >}}
