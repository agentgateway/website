---
title: Virtual keys
weight: 10
description: Issue API keys with per-key token budgets and cost tracking (also known as virtual keys).
test:
  virtual-keys-auth:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: ${versionRoot}/documentation/llm/cost-controls/virtual-keys.md
    path: virtual-keys
  - file: ${versionRoot}/documentation/llm/cost-controls/virtual-keys.md
    path: virtual-keys-httpbun-test
  virtual-keys-ratelimit:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: ${versionRoot}/documentation/security/rate-limit-global.md
    path: deploy-rate-limit-server
  - file: ${versionRoot}/documentation/llm/cost-controls/virtual-keys.md
    path: virtual-keys
  - file: ${versionRoot}/documentation/llm/cost-controls/virtual-keys.md
    path: virtual-keys-with-ratelimit
  - file: ${versionRoot}/documentation/llm/cost-controls/virtual-keys.md
    path: virtual-keys-ratelimit-test
---

{{< reuse "agw-docs/pages/agentgateway/llm/virtual-keys.md" >}}
