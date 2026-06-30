---
title: Ollama
weight: 15
icon: /integrations/providers/bw/ollama.svg
description: Configure agentgateway to route LLM traffic to Ollama for local model inference
test:
  ollama-standalone-validate:
  - file: ${versionRoot}/llm/providers/ollama.md
    path: ollama-standalone-validate
---

{{< reuse "agw-docs/pages/agentgateway/llm/providers/ollama-standalone.md" >}}

{{< callout type="info" >}}
Local providers like Ollama usually run over HTTP and do not require `llm.models[].auth` or `llm.models[].tls`. If your Ollama endpoint is behind HTTPS or requires authentication, configure `llm.models[].tls` and `llm.models[].auth` like any other upstream provider.
{{< /callout >}}

{{< doc-test paths="ollama-standalone-validate" >}}
# Install agentgateway binary for testing
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# Write and validate the ollama config from the guide
cat > /tmp/test-ollama-standalone.yaml << 'EOF'
llm:
  models:
  - name: "*"
    provider: ollama
    params:
      model: llama3.2
EOF
agentgateway -f /tmp/test-ollama-standalone.yaml --validate-only
{{< /doc-test >}}
