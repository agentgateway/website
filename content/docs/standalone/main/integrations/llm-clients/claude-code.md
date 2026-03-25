---
title: Claude Code
weight: 5
description: Configure Claude Code CLI to use agentgateway
test:
  claude-code-validate:
  - file: content/docs/standalone/main/integrations/llm-clients/claude-code.md
    path: claude-code-validate
---

{{< doc-test paths="claude-code-validate" >}}
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/patch-dev.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/claude-code.md" >}}
