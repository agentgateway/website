---
title: AI Prompt Guard
weight: 7
description: Protect LLM requests from prompt injection and sensitive data exposure on Kubernetes
---

Configure agentgateway to inspect and filter LLM requests, blocking sensitive data like PII before it reaches AI models.

## What you'll build

In this tutorial, you will:

1. Set up a local Kubernetes cluster with agentgateway and an LLM backend
2. Configure prompt guard policies to block sensitive data
3. Test that requests containing SSNs and emails are rejected
4. Learn about built-in and custom regex patterns

## Before you begin

Make sure you have the following tools installed:
- [Docker](https://www.docker.com/products/docker-desktop/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [kind](https://kind.sigs.k8s.io/)
- [Helm](https://helm.sh/docs/intro/install/)
- An OpenAI API key (get one at [platform.openai.com](https://platform.openai.com/api-keys))

For detailed installation instructions, see the [LLM Gateway tutorial](../llm-gateway/).

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

---

## Step 3: Create a Gateway

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway-proxy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
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

## Step 4: Set up an LLM backend

```bash
export OPENAI_API_KEY=<insert your API key>

kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: openai-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: $OPENAI_API_KEY
---
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: gpt-4.1-nano
  policies:
    auth:
      secretRef:
        name: openai-secret
    ai:
      promptGuard:
        request:
        - regex:
            action: Reject
            matches:
            - "SSN"
            - "Social Security"
          response:
            message: "Request rejected: Contains sensitive information"
        - regex:
            action: Reject
            builtins:
            - Email
          response:
            message: "Request rejected: Contains email address"
EOF
```

This backend configures:
- An OpenAI LLM provider
- A prompt guard that **rejects** requests containing SSN references or email addresses

---

## Step 5: Create the HTTPRoute

```bash
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
      - name: openai
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

---

## Step 6: Test the prompt guard

Set up port-forwarding:

```bash
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
```

### Test a normal request (should succeed)

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-nano",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }' | jq
```

You should receive a normal response from OpenAI.

### Test with SSN mention (should be blocked)

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-nano",
    "messages": [{"role": "user", "content": "My SSN is 123-45-6789"}]
  }'
```

Expected response: the request is rejected before reaching the LLM.

### Test with an email address (should be blocked)

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-nano",
    "messages": [{"role": "user", "content": "Contact me at test@example.com"}]
  }'
```

Expected response: the request is rejected before reaching the LLM.

---

## Built-in patterns

Agentgateway includes built-in patterns for common PII types:

| Pattern | Description |
|---------|-------------|
| `Email` | Email addresses |
| `Phone` | Phone numbers |
| `SSN` | Social Security Numbers |
| `CreditCard` | Credit card numbers |
| `IPAddress` | IP addresses |

## Response filtering

You can also mask sensitive data in LLM responses:

```yaml
ai:
  promptGuard:
    response:
    - regex:
        action: Mask
        builtins:
        - CreditCard
```

---

## Cleanup

```bash
kill %1 2>/dev/null
kind delete cluster --name agentgateway
```

---

## Next steps

{{< cards >}}
  {{< card link="/docs/kubernetes/latest/llm/prompt-guards" title="Prompt Guards Reference" subtitle="Complete prompt guard configuration" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/telemetry" title="Telemetry" subtitle="Add observability to your deployment" >}}
  {{< card link="/docs/kubernetes/latest/llm/" title="LLM Overview" subtitle="All LLM gateway features" >}}
{{< /cards >}}
