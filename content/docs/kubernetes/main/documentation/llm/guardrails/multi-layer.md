---
title: Multi-layered guardrails
weight: 60
description: Run prompt guards in sequence, creating defense-in-depth protection.
---

You can configure multiple prompt guards that run in sequence, creating defense-in-depth protection. Guards are evaluated in the order they appear in the configuration.

Example configuration that uses all three layers:

```yaml
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
            model: omni-moderation-latest
          policies:
            auth:
              secretRef:
                name: openai-secret
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

The moderation guard sets `policies` on the prompt guard entry, next to `openAIModeration`. The `openAIModeration.policies` field is deprecated in favor of this guard-level field. For the connection and authentication options, see [OpenAI moderation]({{< link-hextra path="/documentation/llm/guardrails/moderation/#backend-connection-and-authentication-policies" >}}).
