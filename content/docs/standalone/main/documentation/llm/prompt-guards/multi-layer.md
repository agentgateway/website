---
title: Multi-layered guardrails
weight: 60
description: Chain multiple prompt guards so each request passes every check in order, for defense in depth.
---

You can configure multiple prompt guards that run in sequence, creating defense-in-depth protection. Guards are evaluated in the order they appear in the configuration.

Shared guardrails under `llm.policies.guardrails` apply to every model. Model-specific guardrails under `llm.models[].guardrails` are merged in for the selected model, so the effective policy is the shared baseline plus any model-specific checks.

Example configuration that combines shared and model-specific guardrails:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    guardrails:
      request:
      # Shared layer 1: Fast regex check for known patterns
      - regex:
          action: reject
          rules:
          - builtin: ssn
          - builtin: creditCard
          - builtin: email
        rejection:
          body: "Request contains PII and cannot be processed"
      response:
      - regex:
          action: mask
          rules:
          - builtin: ssn
          - builtin: creditCard
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
    guardrails:
      request:
      # Model layer: OpenAI moderation for harmful content
      - openAIModeration:
          model: omni-moderation-latest
          policies:
            backendAuth:
              key: "$OPENAI_API_KEY"
        rejection:
          body: "Content blocked by moderation policy"
      # Model layer: Custom webhook for domain-specific checks
      - webhook:
          target:
            host: content-safety-webhook.example.com:8000
      response:
      - webhook:
          target:
            host: content-safety-webhook.example.com:8000
```

In this example, the shared policy catches obvious PII across every model, while the selected model adds moderation and webhook checks on top. The response-side regex masking from the shared policy still applies to the model.
