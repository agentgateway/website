---
title: Claude Code CLI proxy
weight: 11
description: Proxy and secure Claude Code CLI traffic through agentgateway to inspect and govern agentic client requests before they reach Anthropic.
---

Proxy [Claude Code CLI](https://code.claude.com/docs) traffic through agentgateway to intercept, inspect, and secure agentic client requests before they reach Anthropic's API. Unlike the [basic Claude Code integration]({{< link-hextra path="/integrations/llm-clients/claude-code" >}}), this guide configures native Anthropic message routing and adds prompt guards to block sensitive content in CLI prompts.

## Why proxy agentic CLI traffic?

Architecture diagrams typically show agents running in production systems, but the majority of agentic traffic actually originates from developer laptops through tools like Claude Code CLI, Cursor, and GitHub Copilot. This traffic needs the same governance as production workloads. By routing Claude Code CLI through agentgateway, you get:

- **Visibility**: See every prompt and response that flows through the gateway.
- **Security**: Block sensitive data, such as PII or credentials, before it leaves the network.
- **Governance**: Enforce organizational policies on developer AI usage.
- **Auditability**: Log and trace all agentic interactions for compliance.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}) named `agentgateway-proxy`.
2. Install the [Claude Code CLI](https://code.claude.com/docs): `npm install -g @anthropic-ai/claude-code`.
3. Get an Anthropic API key from [platform.claude.com](https://platform.claude.com).

## Step 1: Create the Anthropic secret

Export your Anthropic API key and create a Kubernetes secret.

```bash
export ANTHROPIC_API_KEY=<insert your Anthropic API key>

kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: anthropic-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: $ANTHROPIC_API_KEY
EOF
```

## Step 2: Create the Anthropic backend

Claude Code CLI sends requests to Anthropic's native `/v1/messages` endpoint, not the OpenAI-compatible `/v1/chat/completions` endpoint. Configure the backend with explicit AI route policies so that agentgateway handles the Anthropic message format correctly.

{{< callout type="warning" >}}
**Model selection matters.** If you pin a model in the backend (for example, `claude-sonnet-4-5-20250929`) but Claude Code CLI uses a different model, you might get a `400` error with a misleading message such as "thinking mode isn't enabled." To avoid this, either match the model exactly or omit the model field to allow any model.
{{< /callout >}}

{{< tabs items="Flexible model (recommended),Fixed model" >}}
{{% tab tabName="Flexible model (recommended)" %}}

This configuration allows Claude Code CLI to use any model. The `anthropic: {}` syntax means that no model is pinned.

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: anthropic
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      anthropic: {}
  policies:
    ai:
      routes:
        '/v1/messages': Messages
        '*': Passthrough
    auth:
      secretRef:
        name: anthropic-secret
EOF
```
{{% /tab %}}
{{% tab tabName="Fixed model" %}}

This configuration pins the backend to a specific model. Make sure that the model matches the model that Claude Code CLI is configured to use.

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: anthropic
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      anthropic:
        model: claude-sonnet-4-5-20250929
  policies:
    ai:
      routes:
        '/v1/messages': Messages
        '*': Passthrough
    auth:
      secretRef:
        name: anthropic-secret
EOF
```
{{% /tab %}}
{{< /tabs >}}

The following table describes the key settings in the configuration.

| Setting | Description |
|---------|-------------|
| `anthropic: {}` | Allows any model. Claude Code CLI sends the model in each request. |
| `anthropic.model` | Pins the backend to a specific model, which must match the model that the CLI selects. |
| `routes['/v1/messages']` | Processes requests in Anthropic's native message format, which is required for Claude Code. |
| `routes['*']` | Passes through all other requests, such as `/v1/models`, without LLM processing. |

## Step 3: Create the HTTPRoute

Create an HTTPRoute that routes all traffic from the Gateway to the Anthropic backend. The `/` path prefix match forwards all requests, including `/v1/messages`, `/v1/models`, and any other Claude Code CLI endpoints, to the Anthropic backend.

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: claude
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - matches:
      - path:
          type: PathPrefix
          value: /
      backendRefs:
      - name: anthropic
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

## Step 4: Test with Claude Code CLI

1. Set up port-forwarding to the agentgateway proxy.

   ```bash
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
   ```

2. Send a test prompt through the gateway. You get a normal response from Claude, which confirms that traffic flows through agentgateway.

   ```bash
   ANTHROPIC_BASE_URL="http://localhost:8080" claude -p "What is Kubernetes?"
   ```

3. Optionally, start Claude Code CLI in interactive mode with all traffic routed through the gateway. Every request, including prompts, tool calls, and file reads, flows through agentgateway where it can be inspected, logged, and secured.

   ```bash
   ANTHROPIC_BASE_URL="http://localhost:8080" claude
   ```

## Step 5: Add prompt guards

Now that connectivity is confirmed, add a prompt guard that rejects requests containing specific patterns before they reach Anthropic. Update the backend to add a `promptGuard` policy.

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: anthropic
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      anthropic: {}
  policies:
    ai:
      routes:
        '/v1/messages': Messages
        '*': Passthrough
      promptGuard:
        request:
        - response:
            message: "Rejected due to inappropriate content"
          regex:
            action: Reject
            matches:
            - "credit card"
    auth:
      secretRef:
        name: anthropic-secret
EOF
```

## Step 6: Test the prompt guard

1. Send a prompt that contains the blocked phrase. The request is rejected before it reaches Anthropic, and you get the custom rejection message instead of a response from Claude.

   ```bash
   ANTHROPIC_BASE_URL="http://localhost:8080" claude -p "What is a credit card"
   ```

2. Send a prompt without the blocked phrase. This request goes through normally because it does not match any prompt guard patterns.

   ```bash
   ANTHROPIC_BASE_URL="http://localhost:8080" claude -p "What is Kubernetes?"
   ```

## Extend prompt guards

You can combine custom regex patterns and built-in detectors to enforce broader security policies.

```yaml
promptGuard:
  request:
  - response:
      message: "Request rejected: Contains sensitive information"
    regex:
      action: Reject
      matches:
      - "SSN"
      - "Social Security"
      - "delete all"
      - "drop database"
  - response:
      message: "Request rejected: Contains PII"
    regex:
      action: Reject
      builtins:
      - Email
      - CreditCard
      - SSN
```

| Pattern | What it blocks |
|---------|---------------|
| Custom regex (`matches`) | Any phrase that you define, such as dangerous commands or sensitive terms. |
| `Email` (builtin) | Email addresses in prompts. |
| `CreditCard` (builtin) | Credit card numbers. |
| `SSN` (builtin) | Social Security numbers. |

For more prompt guard options, see the [regex filters guide]({{< link-hextra path="/llm/guardrails/regex" >}}).

## Cleanup

```bash
kubectl delete httproute claude -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} anthropic -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret anthropic-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## Next steps

{{< cards >}}
  {{< card path="/integrations/llm-clients/claude-code" title="Claude Code integration" subtitle="Quick setup without prompt guards" >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/llm/guardrails/regex" title="Regex filters" subtitle="Prompt guard patterns and built-in detectors" >}}
{{< /cards >}}
