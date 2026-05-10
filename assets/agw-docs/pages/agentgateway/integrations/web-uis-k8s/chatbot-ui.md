Deploy [Chatbot UI](https://github.com/mckaywrigley/chatbot-ui) in Kubernetes and route its LLM traffic through agentgateway to keep API keys server-side.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Set up the OpenAI backend

1. Export your OpenAI API key.

   ```bash
   export OPENAI_API_KEY="your-key-here"
   ```

2. Create a Kubernetes Secret for your API key.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: openai-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $OPENAI_API_KEY
   EOF
   ```

3. Create an AgentgatewayBackend for OpenAI.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: openai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openAI: {}
     policies:
       auth:
         secretRef:
           name: openai-secret
   EOF
   ```

4. Create an HTTPRoute to forward traffic to the backend.

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
       - matches:
         - path:
             type: PathPrefix
             value: /
         backendRefs:
         - name: openai
           namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
           group: agentgateway.dev
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

## Deploy Chatbot UI

Deploy Chatbot UI as a Kubernetes workload and point it at the agentgateway service.

```bash
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chatbot-ui
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: chatbot-ui
  template:
    metadata:
      labels:
        app: chatbot-ui
    spec:
      containers:
      - name: chatbot-ui
        image: ghcr.io/mckaywrigley/chatbot-ui:main
        ports:
        - containerPort: 3000
        env:
        - name: OPENAI_API_KEY
          value: "placeholder"
        - name: OPENAI_API_HOST
          value: "http://agentgateway-proxy.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local"
---
apiVersion: v1
kind: Service
metadata:
  name: chatbot-ui
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  selector:
    app: chatbot-ui
  ports:
  - port: 3000
    targetPort: 3000
EOF
```

`OPENAI_API_KEY` must be non-empty for Chatbot UI to start, but it is not used — agentgateway holds the real key.

## Verify the connection

1. Port-forward to Chatbot UI.

   ```bash
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/chatbot-ui 3000:3000
   ```

2. Open `http://localhost:3000` and send a message.

3. Confirm the request appears in the agentgateway proxy logs.

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
   ```

## Next steps

{{< cards >}}
  {{< card path="/llm/spending/" title="Control spending" subtitle="Apply rate limits and token budgets to LLM traffic." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs for every LLM call." >}}
{{< /cards >}}
