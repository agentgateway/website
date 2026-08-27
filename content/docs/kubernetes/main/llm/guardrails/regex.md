---
title: Regex filters
weight: 10
description: Use custom regex patterns and built-in PII detectors to filter LLM requests and responses.
---

{{< reuse "agw-docs/pages/agentgateway/llm/prompt-guards.md" >}}

## Scan tool calls {#scope}

By default, a request guard inspects the system prompt and the message text, and nothing else. An agent that calls tools moves sensitive data through two places that the default does not cover: the arguments the model sends to a tool, and the results the tool sends back. Set `scope` on a request guard to inspect those as well.

The field takes a list of the content categories to inspect.

| Value | What it covers |
| -- | -- |
| `SystemPrompt` | The system or developer prompt. |
| `Messages` | Regular user and assistant message text. |
| `ToolInput` | Tool call arguments, which the model produces. |
| `ToolOutput` | Tool call results, which the tool produces. |

The following policy masks a Social Security Number wherever it appears, including in a tool result that an agent is about to feed back to the model.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: tool-guard
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: agentgateway.dev
    kind: {{< reuse "agw-docs/snippets/backend.md" >}}
    name: openai
  backend:
    ai:
      promptGuard:
        request:
        - scope:
          - SystemPrompt
          - Messages
          - ToolInput
          - ToolOutput
          regex:
            action: Mask
            builtins:
            - Ssn
EOF
```

Review the following rules before you set the field.

> [!IMPORTANT]
> **The list replaces the default; it does not add to it.** A guard with `scope: [ToolOutput]` inspects tool results *only*, and stops inspecting the system prompt and the messages. To keep the default coverage and add tool calls, list all four values, as the preceding example does.

- **Only a request guard takes `scope`.** The API server rejects the field on a `response` guard. To scan the model's reply, use a response guard, which always inspects the message text.
- **Only `regex` and `bedrockGuardrails` guards support a non-default scope.** A `webhook`, `openAIModeration`, or `googleModelArmor` guard always inspects the system prompt and the messages. Setting `scope` on one of those is rejected at admission with `only regex and bedrockGuardrails guards support a non-default scope`.
- **An empty list is rejected.** Omit the field to use the default rather than setting `scope: []`.

> [!WARNING]
> Some APIs, including Completions, send tool arguments as a single opaque JSON string. A guard that masks `ToolInput` on one of those APIs rewrites that whole string, which can turn the arguments into invalid JSON that the tool then fails to parse. Prefer `action: Reject` for `ToolInput`, or limit masking to `ToolOutput`, unless you have confirmed that the provider API sends the arguments as structured fields.

> [!NOTE]
> The scope values are title case in Kubernetes mode and camel case in standalone mode. A configuration that you copy between modes needs the casing changed, or the value is rejected as unsupported.

