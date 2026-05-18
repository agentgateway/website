Deploy [LibreChat](https://github.com/danny-avila/LibreChat) in Kubernetes and route its LLM traffic through agentgateway to centralize credentials and apply policies across all chats.

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
         openai: {}
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

## Deploy LibreChat

LibreChat requires MongoDB. Deploy both with a ConfigMap that points LibreChat at agentgateway.

1. Create the LibreChat configuration. Set `fetch: false` and list models explicitly. When agentgateway is configured with a wildcard (`*`) model, the `/v1/models` endpoint returns only the wildcard entry, which LibreChat cannot use to populate its model list.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: librechat-config
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   data:
     librechat.yaml: |
       version: 1.2.1
       cache: true
       endpoints:
         custom:
           - name: "agentgateway"
             apiKey: "placeholder"
             baseURL: "http://agentgateway-proxy.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local/v1"
             models:
               default: ["gpt-4o", "gpt-4o-mini"]
               fetch: false
             titleConvo: true
             titleModel: "gpt-4o-mini"
             modelDisplayLabel: "agentgateway"
   EOF
   ```

2. Deploy MongoDB.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: mongodb
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: mongodb
     template:
       metadata:
         labels:
           app: mongodb
       spec:
         containers:
         - name: mongodb
           image: mongo:8.0.20
           ports:
           - containerPort: 27017
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: mongodb
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     selector:
       app: mongodb
     ports:
     - port: 27017
       targetPort: 27017
   EOF
   ```

3. Deploy LibreChat.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: librechat
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: librechat
     template:
       metadata:
         labels:
           app: librechat
       spec:
         containers:
         - name: librechat
           image: registry.librechat.ai/danny-avila/librechat-dev:latest
           ports:
           - containerPort: 3080
           env:
           - name: MONGO_URI
             value: "mongodb://mongodb.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:27017/LibreChat"
           - name: DOMAIN_CLIENT
             value: "http://localhost:3080"
           - name: DOMAIN_SERVER
             value: "http://localhost:3080"
           - name: NO_INDEX
             value: "true"
           - name: ALLOW_REGISTRATION
             value: "true"
           - name: OPENAI_API_KEY
             value: "user_provided"
           - name: JWT_SECRET
             value: "change-this-to-a-secure-random-value"
           - name: JWT_REFRESH_SECRET
             value: "change-this-to-a-secure-random-value"
           - name: CREDS_KEY
             value: "<generate-a-64-char-hex-string>"
           - name: CREDS_IV
             value: "<generate-a-32-char-hex-string>"
           volumeMounts:
           - name: librechat-config
             mountPath: /app/librechat.yaml
             subPath: librechat.yaml
         volumes:
         - name: librechat-config
           configMap:
             name: librechat-config
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: librechat
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     selector:
       app: librechat
     ports:
     - port: 3080
       targetPort: 3080
   EOF
   ```

{{< callout type="warning" >}}
Replace `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CREDS_KEY`, and `CREDS_IV` with unique, secure random values before deploying to a shared or production environment. You can generate these with `openssl rand -hex 32` (for 64-char keys) or `openssl rand -hex 16` (for 32-char IVs). Use a Kubernetes Secret rather than plain env vars for production deployments.
{{< /callout >}}

The following table describes the relevant environment variable:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Must be set for LibreChat to start, but it is not used to call OpenAI — agentgateway holds the real key. |

## Verify the connection

1. Port-forward to LibreChat.

   ```bash
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/librechat 3080:3080
   ```

2. Open `http://localhost:3080`, register an account, select the **agentgateway** endpoint, and send a message.

3. Confirm the request appears in the agentgateway proxy logs.

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
   ```

   You should see a log entry showing the request was forwarded to the OpenAI endpoint with the configured model:

   ```
   info  request gateway=agentgateway-system/agentgateway-proxy listener=http route=agentgateway-system/openai endpoint=api.openai.com:443 http.method=POST http.path=/v1/chat/completions http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-4o gen_ai.usage.input_tokens=4569 gen_ai.usage.output_tokens=10 duration=2242ms
   ```

## Next steps

{{< cards >}}
  {{< card path="/llm/spending/" title="Control spending" subtitle="Apply rate limits and token budgets across providers." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs for every LLM call." >}}
{{< /cards >}}
