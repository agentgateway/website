---
title: Prompt Enrichment
weight: 9
description: Inject context at the gateway layer to improve LLM output accuracy on Kubernetes
---

Improve LLM output accuracy by injecting system and user prompts at the gateway layer using {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resources on Kubernetes. This centralizes prompt management so every request gets the right context without changing application code.

## What you'll build

In this tutorial, you will:

1. Set up a local Kubernetes cluster with agentgateway and an LLM backend
2. Send a request without prompt enrichment and observe the raw response
3. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to automatically prepend system prompts to every request
4. See how gateway-injected prompts transform unstructured text into structured CSV format
5. Override the gateway prompt on a per-request basis

## Before you begin

Make sure you have the following tools installed:
- [Docker](https://www.docker.com/products/docker-desktop/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [kind](https://kind.sigs.k8s.io/)
- [Helm](https://helm.sh/docs/intro/install/)
- An API key for one of the supported LLM providers (OpenAI or Anthropic)

For detailed installation instructions, see the [LLM Gateway tutorial](../llm-gateway/).

---

## Why prompt enrichment?

LLMs produce better, more consistent results when given clear context. Instead of relying on every client to include the right system prompt, you can inject prompts at the gateway layer:

- **Consistency** — Every request gets the same baseline instructions, regardless of client
- **Centralized management** — Update prompts in one place instead of in every app
- **Separation of concerns** — App developers focus on user content; platform teams manage prompt policies
- **Per-route customization** — Different routes can have different prompt policies

```
┌──────────────┐      ┌──────────────────────────────┐      ┌─────────────────┐
│   Client      │      │  agentgateway                │      │  LLM Provider    │
│   (no system  │ ──── │  + prepends system prompt     │ ──── │  (receives full  │
│    prompt)    │      │  from AgentgatewayPolicy      │      │   context)       │
└──────────────┘      └──────────────────────────────┘      └─────────────────┘
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

## Step 4: Set up the LLM backend

Choose your LLM provider and set your API key:

{{< tabs items="OpenAI,Anthropic" >}}

{{% tab tabName="OpenAI" %}}
```bash
export API_KEY=<insert your OpenAI API key>

kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: llm-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: $API_KEY
---
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: llm
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
spec:
  ai:
    provider:
      openai:
        model: gpt-4.1-nano
  policies:
    auth:
      secretRef:
        name: llm-secret
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: llm
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
      - name: llm
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```
{{% /tab %}}

{{% tab tabName="Anthropic" %}}
```bash
export API_KEY=<insert your Anthropic API key>

kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: llm-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: $API_KEY
---
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: llm
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
spec:
  ai:
    provider:
      anthropic:
        model: claude-sonnet-4-5-20250929
  policies:
    auth:
      secretRef:
        name: llm-secret
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: llm
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
      - name: llm
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```
{{% /tab %}}

{{< /tabs >}}

---

## Step 5: Test without prompt enrichment

Set up port-forwarding:

```bash
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
```

Send a request with unstructured text and no system prompt:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Seattle, Los Angeles, and Chicago are cities in North America. London, Paris, and Berlin are cities in Europe."
      }
    ]
  }' | jq -r '.choices[].message.content'
```

Without a system prompt, the LLM treats this as a conversational input. You'll get a freeform response — maybe a summary, maybe a question, maybe a list. The output is **unpredictable** because the model has no instructions on what format to use.

---

## Step 6: Add prompt enrichment with an AgentgatewayPolicy

Now create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that automatically prepends a system prompt to every request on the `llm` HTTPRoute. This tells the LLM to parse unstructured text into CSV format.

```bash
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: prompt-enrichment
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: llm
  backend:
    ai:
      prompt:
        prepend:
        - role: system
          content: "Parse the unstructured text into CSV format."
EOF
```

This policy:
- **Targets** the `llm` HTTPRoute (not the Gateway, enabling per-route customization)
- **Prepends** a system prompt before the user's message
- **Applies automatically** to every request on that route

---

## Step 7: Test with prompt enrichment

Send the exact same request as before — no system prompt in the request itself:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Seattle, Los Angeles, and Chicago are cities in North America. London, Paris, and Berlin are cities in Europe."
      }
    ]
  }' | jq -r '.choices[].message.content'
```

This time, the response is structured CSV:

```
City,Continent
Seattle,North America
Los Angeles,North America
Chicago,North America
London,Europe
Paris,Europe
Berlin,Europe
```

The system prompt was automatically injected by the gateway before the request reached the LLM.

### Try another request

Send different unstructured text. The gateway-injected CSV instruction applies to every request:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "The recipe called for eggs, flour and sugar. The price was $5, $3, and $2."
      }
    ]
  }' | jq -r '.choices[].message.content'
```

Expected output:

```
Item,Price
Eggs,$5
Flour,$3
Sugar,$2
```

---

## Step 8: Override the prompt per-request

What if a client needs a different output format? Including a system prompt in the request overrides the gateway-injected prompt:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "system",
        "content": "Parse the unstructured content and return a JSON array of objects."
      },
      {
        "role": "user",
        "content": "The recipe called for eggs, flour and sugar. The price was $5, $3, and $2."
      }
    ]
  }' | jq -r '.choices[].message.content'
```

Now the response comes back as JSON instead of CSV:

```json
[
  {"ingredient": "eggs", "price": "$5"},
  {"ingredient": "flour", "price": "$3"},
  {"ingredient": "sugar", "price": "$2"}
]
```

Send the same request without the system prompt, and it falls back to the gateway's CSV policy:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "The recipe called for eggs, flour and sugar. The price was $5, $3, and $2."
      }
    ]
  }' | jq -r '.choices[].message.content'
```

---

## Advanced: User-level prompt enrichment

You can also prepend user-level prompts. This is useful for adding behavioral constraints like "be concise" or "always ask for confirmation":

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: prompt-enrichment
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: llm
  backend:
    ai:
      prompt:
        prepend:
        - role: system
          content: "You are a senior software engineering assistant with deep expertise in Kubernetes and cloud-native systems."
        - role: user
          content: "Always explain things concisely and include practical examples."
EOF
```

Now every request gets both a system persona and a behavioral instruction before the user's actual message.

---

## Real-world use cases

| Use Case | System Prompt | Effect |
|----------|--------------|--------|
| **Customer support** | "You are a helpful support agent. Always be polite and end by asking for a rating." | Consistent tone across all agents |
| **Code review** | "You are a code reviewer. Focus on security, performance, and Go best practices." | Specialized expertise per route |
| **Data parsing** | "Parse unstructured text into the requested format (CSV, JSON, or XML)." | Structured output by default |
| **Compliance** | "Never reveal internal system details. Redact any PII in responses." | Enforced guardrails |

---

## Cleanup

```bash
kill %1 2>/dev/null
kind delete cluster --name agentgateway
```

---

## Next steps

{{< cards >}}
  {{< card link="/docs/kubernetes/latest/llm/prompt-enrichment" title="Prompt Enrichment Reference" subtitle="Complete configuration options" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/ai-prompt-guard" title="AI Prompt Guard" subtitle="Block sensitive data in requests" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/llm-gateway" title="LLM Gateway" subtitle="Route to multiple providers" >}}
{{< /cards >}}
