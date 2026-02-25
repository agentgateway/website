---
title: Claude Code CLI Proxy
weight: 10
description: Proxy and secure Claude Code CLI traffic through agentgateway on Kubernetes
---

Proxy Claude Code CLI traffic through agentgateway on Kubernetes to intercept, inspect, and secure agentic client requests before they reach Anthropic's API.

## What you'll build

In this tutorial, you will:

1. Set up a local Kubernetes cluster with agentgateway and an Anthropic backend
2. Configure native Anthropic message routing (not OpenAI translation)
3. Connect Claude Code CLI to route all traffic through the gateway
4. Add prompt guards to block sensitive content in CLI prompts
5. Understand model selection considerations for Claude Code

## Before you begin

Make sure you have the following tools installed:
- [Docker](https://www.docker.com/products/docker-desktop/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [kind](https://kind.sigs.k8s.io/)
- [Helm](https://helm.sh/docs/intro/install/)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`)
- An Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))

For detailed tool installation instructions, see the [LLM Gateway tutorial](../llm-gateway/).

---

## Why proxy agentic CLI traffic?

Architecture diagrams typically show agents running in production systems. But the majority of agentic traffic actually originates from developer laptops — tools like Claude Code CLI, Cursor, and Copilot. This traffic needs the same governance as production workloads.

By routing Claude Code CLI through agentgateway, you get:

- **Visibility** — See every prompt and response flowing through the gateway
- **Security** — Block sensitive data (PII, credentials) before it leaves the network
- **Governance** — Enforce organizational policies on developer AI usage
- **Auditability** — Log and trace all agentic interactions for compliance

```
┌──────────────────┐      ┌──────────────────────────────┐      ┌──────────────────┐
│   Claude Code    │      │  agentgateway                │      │  Anthropic API   │
│   CLI            │ ──── │  + route policies             │ ──── │  (Claude models) │
│   (developer     │      │  + prompt guards              │      │                  │
│    laptop)       │      │  + observability              │      │                  │
└──────────────────┘      └──────────────────────────────┘      └──────────────────┘
```

---

## Step 1: Create a kind cluster

```bash
kind create cluster --name agentgateway
```

---

## Step 2: Install agentgateway

```bash
# Gateway API CRDs
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/standard-install.yaml

# agentgateway CRDs
helm upgrade -i --create-namespace \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} oci://{{< reuse "agw-docs/snippets/helm-path.md" >}}/charts/{{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}}

# Control plane
helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} oci://{{< reuse "agw-docs/snippets/helm-path.md" >}}/charts/{{< reuse "agw-docs/snippets/helm-kgateway.md" >}} \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
```

Verify the control plane is running:

```bash
kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

---

## Step 3: Create a Gateway

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway-proxy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
spec:
  gatewayClassName: {{< reuse "agw-docs/snippets/agw-gatewayclass.md" >}}
  listeners:
  - protocol: HTTP
    port: 80
    name: http
    allowedRoutes:
      namespaces:
        from: All
EOF
```

Wait for the proxy:

```bash
kubectl get deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

---

## Step 4: Create the Anthropic secret

Export your Anthropic API key and create a Kubernetes secret:

```bash
export ANTHROPIC_API_KEY=<insert your Anthropic API key>

kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: anthropic-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
type: Opaque
stringData:
  Authorization: $ANTHROPIC_API_KEY
EOF
```

---

## Step 5: Create the Anthropic backend

This is where the configuration differs from a standard LLM Gateway setup. Claude Code CLI sends requests to Anthropic's native `/v1/messages` endpoint — not the OpenAI-compatible `/v1/chat/completions` endpoint. You must configure the backend with explicit **route policies** so agentgateway handles the Anthropic message format correctly.

{{< callout type="warning" >}}
**Model selection matters.** If you specify a model in the backend (e.g., `claude-sonnet-4-5-20250929`) but Claude Code CLI uses a different model, you may get a `400` error with a misleading message like "thinking mode isn't enabled." To avoid this, either match the model exactly or omit the model field to allow any model.
{{< /callout >}}

{{< tabs items="Flexible model (recommended),Fixed model" >}}

{{% tab tabName="Flexible model (recommended)" %}}

This configuration allows Claude Code CLI to use any model. The `anthropic: {}` syntax means no model is pinned.

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: anthropic
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
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

This configuration pins the backend to a specific model. Make sure the model matches what Claude Code CLI is configured to use.

```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: anthropic
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
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

| Setting | Description |
|---------|-------------|
| `anthropic: {}` | Allow any model — Claude Code CLI sends the model in each request |
| `anthropic.model` | Pin to a specific model — must match the CLI's model selection |
| `routes['/v1/messages']` | Process requests in Anthropic's native message format (required for Claude Code) |
| `routes['*']` | Pass through all other requests (e.g., `/v1/models`) without LLM processing |

---

## Step 6: Create the HTTPRoute

Create an HTTPRoute that routes all traffic from the Gateway to the Anthropic backend:

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: claude
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
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

This route uses a `/` path prefix match so that all requests — including `/v1/messages`, `/v1/models`, and any other Claude Code CLI endpoints — are forwarded to the Anthropic backend.

---

## Step 7: Test with Claude Code CLI

Set up port-forwarding:

```bash
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
```

### Single prompt test

Send a quick test prompt through the gateway:

```bash
ANTHROPIC_BASE_URL="http://localhost:8080" claude -p "What is Kubernetes?"
```

You should receive a normal response from Claude, confirming that traffic is flowing through agentgateway.

### Interactive mode

You can also start Claude Code CLI in interactive mode with all traffic routed through the gateway:

```bash
ANTHROPIC_BASE_URL="http://localhost:8080" claude
```

This opens the full Claude Code CLI experience. Every request — prompts, tool calls, file reads — flows through agentgateway where it can be inspected, logged, and secured.

---

## Step 8: Add prompt guards

Now that connectivity is confirmed, add security by configuring prompt guards. This modifies the backend to reject requests containing specific patterns before they reach Anthropic.

{{< tabs items="Flexible model,Fixed model" >}}

{{% tab tabName="Flexible model" %}}
```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: anthropic
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
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
{{% /tab %}}

{{% tab tabName="Fixed model" %}}
```bash
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: anthropic
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
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
{{% /tab %}}

{{< /tabs >}}

This configuration:
- **Routes** `/v1/messages` requests through Anthropic's native message processing
- **Passes through** all other endpoints without LLM processing
- **Rejects** any prompt containing "credit card" with a custom message

---

## Step 9: Test the prompt guard

Send the same prompt that was working before, but now with blocked content:

```bash
ANTHROPIC_BASE_URL="http://localhost:8080" claude -p "What is a credit card"
```

The request is **rejected before reaching Anthropic**. You'll see the custom rejection message instead of a response from Claude.

Now send a request without the blocked phrase:

```bash
ANTHROPIC_BASE_URL="http://localhost:8080" claude -p "What is Kubernetes?"
```

This request goes through normally because it doesn't match any prompt guard patterns.

---

## Extending prompt guards

You can use built-in patterns and custom regex to enforce broader security policies:

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
      message: "Request rejected: Contains email address"
    regex:
      action: Reject
      builtins:
      - Email
      - CreditCard
```

| Pattern | What it blocks |
|---------|---------------|
| Custom regex (`matches`) | Any phrase you define — dangerous commands, sensitive terms |
| `Email` (builtin) | Email addresses in prompts |
| `CreditCard` (builtin) | Credit card numbers |
| `SSN` (builtin) | Social Security Numbers |

---

## Real-world use cases

| Scenario | Prompt Guard | Effect |
|----------|-------------|--------|
| **Prevent data exfiltration** | Block SSN, credit card, email patterns | PII never leaves the network |
| **Restrict dangerous operations** | Block "delete", "drop", "destroy" patterns | Prevent destructive agent actions |
| **Compliance enforcement** | Block proprietary terms, internal project names | Keep confidential data out of LLM providers |
| **Cost control** | Block overly long prompts (custom regex on length) | Prevent excessive token usage |

---

## Cleanup

```bash
kill %1 2>/dev/null
kind delete cluster --name agentgateway
```

---

## Next steps

{{< cards >}}
  {{< card link="/docs/kubernetes/latest/llm/providers/anthropic" title="Anthropic Reference" subtitle="Complete Anthropic provider configuration" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/ai-prompt-guard" title="AI Prompt Guard" subtitle="Advanced prompt guard patterns" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/prompt-enrichment" title="Prompt Enrichment" subtitle="Inject context at the gateway layer" >}}
{{< /cards >}}
