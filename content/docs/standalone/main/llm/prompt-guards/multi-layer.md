---
title: Multi-layered guardrails
weight: 60
description: Run prompt guards in sequence, creating defense-in-depth protection.
---

You can configure multiple prompt guards that run in sequence, creating defense-in-depth protection. Guards are evaluated in the order they appear in the configuration.

Example configuration that uses all three layers:

```yaml
cat <<EOF > config.yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-3.5-turbo
      policies:
        ai:
          promptGuard:
            request:
            # Layer 1: Fast regex check for known patterns
            - regex:
                action: reject
                rules:
                - builtin: ssn
                - builtin: creditCard
                - builtin: email
              rejection:
                body: "Request contains PII and cannot be processed"
            # Layer 2: OpenAI moderation for harmful content
            - openAIModeration:
                model: omni-moderation-latest
                policies:
                  backendAuth:
                    key: "$OPENAI_API_KEY"
              rejection:
                body: "Content blocked by moderation policy"
            # Layer 3: Custom webhook for domain-specific checks
            - webhook:
                target:
                  host: content-safety-webhook.example.com:8000
            response:
            # Response guards run in same order
            - regex:
                action: mask
                rules:
                - builtin: ssn
                - builtin: creditCard
            - webhook:
                target:
                  host: content-safety-webhook.example.com:8000
EOF
```
