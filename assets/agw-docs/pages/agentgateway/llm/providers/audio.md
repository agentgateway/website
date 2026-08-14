Configure audio models such as [OpenAI Whisper](https://platform.openai.com/docs/guides/speech-to-text) or [Voxtral](https://docs.voxtral.ai/) through {{< reuse "agw-docs/snippets/agentgateway.md" >}}. Audio models expose endpoints like `/v1/audio/transcriptions` and `/v1/audio/speech` that are handled via `Passthrough` routing — agentgateway forwards the request and response without parsing or modifying the payload.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to your audio model

{{% steps %}}

### Step 1: Get an API key

1. Obtain an API key for your audio model provider (e.g., OpenAI, or your own host for self-hosted models like Voxtral).

2. If your provider requires authentication, save the API key in an environment variable.

   ```sh
   export AUDIO_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes secret to store your API key.

   ```yaml {paths="audio-setup"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: audio-model-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $AUDIO_API_KEY
   EOF
   ```

### Step 2: Deploy the audio model (self-hosted)

If you are running the audio model inside your cluster (e.g., Voxtral via vLLM), deploy the model and expose it via a Service.

1. Create a deployment and Service for your audio model.

   ```yaml {paths="audio-deploy"}
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: audio-model
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: audio-model
     template:
       metadata:
         labels:
           app: audio-model
       spec:
         containers:
         - name: audio-model
           image: voxtral/audio-model:latest
           ports:
           - containerPort: 8000
             name: http
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: audio-model-service
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     selector:
       app: audio-model
     ports:
     - port: 80
       targetPort: 8000
       protocol: TCP
   EOF
   ```

2. Wait for the pod to be ready.

   ```sh
   kubectl wait --for=condition=ready pod \
     -l app=audio-model \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --timeout=300s
   ```

### Step 3: Create the LLM backend with Passthrough routes

Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource with `ai.routes` to forward audio endpoints via `Passthrough` processing.

```yaml {paths="audio-backend"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: audio-model
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: my-audio-model
      host: audio-model-service.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
      port: 80
  policies:
    ai:
      routes:
        "/v1/chat/completions": "Completions"
        "/v1/audio/transcriptions": "Passthrough"
        "/v1/audio/speech": "Passthrough"
        "/v1/models": "Passthrough"
        "*": "Passthrough"
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#aibackend" >}}).

| Setting | Description |
|---------|-------------|
| `ai.provider.openai` | Use the `openai` provider type — audio models typically expose OpenAI-compatible APIs. |
| `openai.model` | The audio model name. |
| `host` | The in-cluster DNS name of the Service pointing to the audio model. |
| `port` | The port the audio model listens on. |
| `policies.ai.routes["/v1/audio/transcriptions"]` | Routes audio transcription requests with `Passthrough` processing. Agentgateway forwards the multipart form data and response without modification. |
| `policies.ai.routes["/v1/audio/speech"]` | Routes text-to-speech requests with `Passthrough` processing. |
| `policies.ai.routes["*"]` | Catches any unmatched paths and forwards them as `Passthrough`. |

### Step 4: Create an HTTPRoute

Create an HTTPRoute that routes traffic to the audio backend.

```yaml {paths="audio-route"}
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: audio-model-route
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /audio
      backendRefs:
        - name: audio-model
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
          group: agentgateway.dev
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

### Step 5: Send audio transcription requests

Test the audio model by sending a transcription request.

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
```sh
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

curl "http://${INGRESS_GW_ADDRESS}:80/audio/v1/audio/transcriptions" \
  -H "Authorization: Bearer ${AUDIO_API_KEY}" \
  -F "file=@/path/to/audio.wav" \
  -F "model=my-audio-model" | jq
```
{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}
In one terminal, start a port-forward to the gateway.

```sh
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
```

In a second terminal, send a request.

```sh
curl "http://localhost:8080/audio/v1/audio/transcriptions" \
  -H "Authorization: Bearer ${AUDIO_API_KEY}" \
  -F "file=@/path/to/audio.wav" \
  -F "model=my-audio-model" | jq
```
{{% /tab %}}
{{< /tabs >}}

### Step 6: Send text-to-speech requests

Test the speech generation endpoint.

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
```sh
curl "http://${INGRESS_GW_ADDRESS}:80/audio/v1/audio/speech" \
  -H "Authorization: Bearer ${AUDIO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-audio-model",
    "input": "Hello, this is a test of the text-to-speech endpoint.",
    "voice": "alloy"
  }' --output speech.wav
```
{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}
```sh
curl "http://localhost:8080/audio/v1/audio/speech" \
  -H "Authorization: Bearer ${AUDIO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-audio-model",
    "input": "Hello, this is a test of the text-to-speech endpoint.",
    "voice": "alloy"
  }' --output speech.wav
```
{{% /tab %}}
{{< /tabs >}}

{{< /steps %}}

## Supported audio endpoints

The table below lists the audio-specific endpoints that can be configured via `Passthrough` routing.

| API path | Route type | Description |
|----------|------------|-------------|
| `/v1/audio/transcriptions` | `Passthrough` | Transcribes audio files to text. Agentgateway forwards the `multipart/form-data` payload and the JSON response without modification. |
| `/v1/audio/translations` | `Passthrough` | Translates audio files to English. Similar to transcriptions but outputs English text. |
| `/v1/audio/speech` | `Passthrough` | Generates speech audio from text input. Agentgateway forwards the JSON request and returns the audio binary response as-is. |
| `/v1/models` | `Passthrough` | Lists available models. |

{{< callout type="info" >}}
When a route is set to `Passthrough`, agentgateway does not apply any LLM-specific policies (such as cost tracking, rate limiting, or prompt guards) to those requests. The requests are forwarded exactly as received.
{{< /callout >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```shell
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} audio-model -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute audio-model-route -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete svc audio-model-service -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete deployment audio-model -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret audio-model-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
