Deploy [Open WebUI](https://github.com/open-webui/open-webui) in Kubernetes and route its LLM traffic through agentgateway to keep API keys server-side and capture audit logs for every chat.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Set up the OpenAI backend

1. Export your OpenAI API key.

   ```bash
   export OPENAI_API_KEY="sk-your-key-here"
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

## Deploy Open WebUI

Deploy Open WebUI and point it at the agentgateway service.

```bash
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: open-webui
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: open-webui
  template:
    metadata:
      labels:
        app: open-webui
    spec:
      containers:
      - name: open-webui
        image: ghcr.io/open-webui/open-webui:main
        ports:
        - containerPort: 8080
        env:
        - name: OPENAI_API_BASE_URL
          value: "http://agentgateway-proxy.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local/v1"
        - name: OPENAI_API_KEY
          value: "placeholder"
        volumeMounts:
        - name: open-webui-data
          mountPath: /app/backend/data
      volumes:
      - name: open-webui-data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: open-webui
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  selector:
    app: open-webui
  ports:
  - port: 8080
    targetPort: 8080
EOF
```

`OPENAI_API_KEY` is required by Open WebUI but is not used to call the upstream provider — agentgateway holds the real key.

## Verify the connection

1. Port-forward to Open WebUI.

   ```bash
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/open-webui 8080:8080
   ```

2. Open `http://localhost:8080`, create the initial admin account, select a model, and send a message.

3. Confirm the request appears in the agentgateway proxy logs.

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
   ```

## Next steps

{{< cards >}}
  {{< card path="/llm/spending/" title="Control spending" subtitle="Apply rate limits and token budgets to LLM traffic." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs for every LLM call." >}}
  {{< card path="/llm/providers/" title="LLM providers" subtitle="Configure additional upstream providers." >}}
{{< /cards >}}
