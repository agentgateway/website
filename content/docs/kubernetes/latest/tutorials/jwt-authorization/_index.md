---
title: JWT Authorization
weight: 5
description: Secure agentgateway with JWT authentication and fine-grained access control on Kubernetes
---

Secure your agentgateway LLM endpoints with JWT authentication using TrafficPolicy on Kubernetes.

## What you'll build

In this tutorial, you will:

1. Set up a local Kubernetes cluster with agentgateway and an LLM backend
2. Create a TrafficPolicy with JWT authentication
3. Test that unauthenticated requests are rejected
4. Test that authenticated requests with a valid JWT are allowed

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

Set your API key and create the secret and backend:

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
---
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

## Step 5: Download the test JWT keys

For this tutorial, use pre-generated test keys from the agentgateway repository:

```bash
# Download the JWKS public key
curl -sL https://raw.githubusercontent.com/agentgateway/agentgateway/main/manifests/jwt/pub-key -o pub-key

# Download a pre-generated test JWT token
curl -sL https://raw.githubusercontent.com/agentgateway/agentgateway/main/manifests/jwt/example1.key -o test-token.jwt
```

{{< callout type="warning" >}}
These are **test keys only**. For production, generate your own keys using tools like [step-cli](https://github.com/smallstep/cli).
{{< /callout >}}

The test token contains these claims:

```json
{
  "iss": "solo.io",
  "sub": "alice",
  "exp": 1900650294
}
```

---

## Step 6: Create a JWT TrafficPolicy

Create a TrafficPolicy that enforces JWT authentication on the Gateway. Requests without a valid JWT will be rejected.

```bash
# Read the JWKS into a variable
JWKS=$(cat pub-key)

kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TrafficPolicy
metadata:
  name: jwt-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    jwtAuthentication:
      mode: Strict
      providers:
        - issuer: solo.io
          jwks:
            inline: '$JWKS'
      authorization:
        action: Allow
        policy:
          matchExpressions:
            - 'jwt.sub == "alice"'
EOF
```

This policy:
- **Requires** a valid JWT on every request (`mode: Strict`)
- **Validates** the token against the provided JWKS public key
- **Authorizes** only tokens where `sub` is `alice`

---

## Step 7: Test the JWT authentication

Set up port-forwarding:

```bash
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
```

### Test without a token (should fail)

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4.1-nano", "messages": [{"role": "user", "content": "Hello"}]}'
```

You should receive a `401 Unauthorized` response.

### Test with a valid token (should succeed)

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat test-token.jwt)" \
  -d '{"model": "gpt-4.1-nano", "messages": [{"role": "user", "content": "Hello! What is JWT?"}]}' | jq
```

You should receive a successful response from OpenAI.

---

## Authorization rules

The `matchExpressions` field uses CEL (Common Expression Language) for fine-grained access control:

```yaml
# Allow only a specific user
matchExpressions:
  - 'jwt.sub == "alice"'

# Allow by email domain
matchExpressions:
  - 'jwt.email.endsWith("@company.com")'

# Allow by role claim
matchExpressions:
  - '"admin" in jwt.roles'
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
  {{< card link="/docs/kubernetes/latest/security/jwt/" title="JWT Reference" subtitle="Complete JWT configuration options" >}}
  {{< card link="/docs/kubernetes/latest/mcp/tool-access" title="Tool Access Control" subtitle="Control MCP tool access with JWT claims" >}}
  {{< card link="/docs/kubernetes/latest/tutorials/ai-prompt-guard" title="AI Prompt Guard" subtitle="Block sensitive data in LLM requests" >}}
{{< /cards >}}
