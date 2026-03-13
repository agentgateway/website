---
title: Content safety and PII protection
weight: 85
description: Protect LLM requests and responses from sensitive data exposure and harmful content using layered content safety controls (PII detection, DLP).
test:
  content-safety-regex-masking:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/main/llm/content-safety.md
    path: content-safety-regex
---

{{< reuse "agw-docs/pages/agentgateway/llm/content-safety.md" >}}
