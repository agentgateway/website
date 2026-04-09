---
title: Multi-layered guardrails
weight: 60
description: Run prompt guards in sequence, creating defense-in-depth protection.
---

You can configure multiple prompt guards that run in sequence, creating defense-in-depth protection. Guards are evaluated in the order they appear in the configuration.

Example configuration that uses all three layers:

```yaml
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: content-safety-layered
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: openai
  backend:
    ai:
      promptGuard:
        request:
        # Layer 1: Fast regex check for known patterns
        - regex:
            builtins:
            - Ssn
            - CreditCard
            - Email
            action: Reject
          response:
            message: "Request contains PII and cannot be processed"
        # Layer 2: OpenAI moderation for harmful content
        - openAIModeration:
            policies:
              auth:
                secretRef:
                  name: openai-secret
            model: omni-moderation-latest
          response:
            message: "Content blocked by moderation policy"
        # Layer 3: Custom webhook for domain-specific checks
        - webhook:
            backendRef:
              kind: Service
              name: content-safety-webhook
              port: 8000
        response:
        # Response guards run in same order
        - regex:
            builtins:
            - Ssn
            - CreditCard
            action: Mask
        - webhook:
            backendRef:
              kind: Service
              name: content-safety-webhook
              port: 8000
EOF
```
