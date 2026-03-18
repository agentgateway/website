---
title: GitHub Copilot
weight: 25
description: Configure GitHub Copilot to use agentgateway
test:
  copilot-validate:
  - file: content/docs/standalone/latest/integrations/llm-clients/github-copilot.md
    path: copilot-validate
---

{{< doc-test paths="copilot-validate" >}}
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/patch-dev.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/github-copilot.md" >}}
