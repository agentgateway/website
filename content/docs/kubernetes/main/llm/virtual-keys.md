---
title: Virtual keys
weight: 30
description: Issue API keys with per-key token budgets and cost tracking (also known as virtual keys).
test:
  virtual-keys-auth:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - path: virtual-keys
  - path: virtual-keys-httpbun-test
  virtual-keys-ratelimit:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: ${versionRoot}/security/rate-limit-global.md
    path: deploy-rate-limit-server
  - path: virtual-keys
  - path: virtual-keys-with-ratelimit
  - path: virtual-keys-ratelimit-test
---

{{< reuse "agw-docs/pages/agentgateway/llm/virtual-keys.md" >}}
