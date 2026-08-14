Configure self-hosted audio models like [Voxtral Small](https://huggingface.co/mistralai/Voxtral-Small-24B-2507) through {{< reuse "agw-docs/snippets/agentgateway.md" >}}. Audio models expose endpoints like `/v1/audio/transcriptions` and `/v1/models` that are handled via `Passthrough` routing — agentgateway forwards the request and response without parsing or modifying the payload.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up and expose your audio model

{{% steps %}}

### Step 1: Deploy the audio model (self-hosted)

Deploy the audio model inside your cluster (e.g., Voxtral Small via vLLM) and expose it via a Service.

{{< callout type="warning" >}}
**Voxtral Small requires a Docker environment with NVIDIA GPU support (`nvidia-container-toolkit`).**
{{< /callout >}}

1. Deploy Voxtral Small using the official vLLM OpenAI-compatible image.

   ```yaml {paths="audio-deploy"}
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: voxtral-vllm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: voxtral-vllm
     template:
       metadata:
         labels:
           app: voxtral-vllm
       spec:
         containers:
         - name: voxtral-vllm
           image: vllm/vllm-openai:latest
           args:
           - "vllm"
           - "serve"
           - "mistralai/Voxtral-Small-24B-2507"
           - "--tokenizer_mode"
           - "mistral"
           - "--config_format"
           - "mistral"
           - "--load_format"
           - "mistral"
           - "--tool-call-parser"
           - "mistral"
           - "--enable-auto-tool-choice"
           ports:
           - containerPort: 8000
             name: http
           resources:
             limits:
               nvidia.com/gpu: "1"
             requests:
               nvidia.com/gpu: "1"
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: voxtral-service
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     selector:
       app: voxtral-vllm
     ports:
     - port: 80
       targetPort: 8000
       protocol: TCP
   EOF
   ```

   The deployment uses:
   - `vllm/vllm-openai:latest` — the official vLLM OpenAI-compatible server image
   - `vllm serve mistralai/Voxtral-Small-24B-2507` with Mistral-specific configuration
   - Port `8000` internally (vLLM default) exposed as port `80` on the Service
   - NVIDIA GPU reservation (1 GPU)

2. Wait for the pod to be ready.

   ```sh
   kubectl wait --for=condition=ready pod \
     -l app=voxtral-vllm \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --timeout=300s
   ```

### Step 2: Verify the model is responding

Verify the vLLM model is responding by querying its health endpoint.

```sh
curl --request GET \
  --url "http://$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} voxtral-service -o=jsonpath='{.status.loadBalancer.ingress[0].ip}'):8000/v1/models" \
  2>/dev/null || \
curl --request GET \
  --url "http://$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} voxtral-service -o=jsonpath='{.spec.clusterIP}'):8000/v1/models"
```

You should see a JSON response listing the model.

### Step 3: Create the LLM backend with Passthrough routes

Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource with `ai.routes` to forward audio endpoints via `Passthrough` processing.

```yaml {paths="audio-backend"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: voxtral-audio
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: voxtral-small-24b-2507
      host: voxtral-service.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
      port: 80
  policies:
    ai:
      routes:
        "/v1/audio/transcriptions": "Passthrough"
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
| `policies.ai.routes["*"]` | Catches any unmatched paths and forwards them as `Passthrough`. |

### Step 4: Create an HTTPRoute

Create an HTTPRoute that routes traffic to the audio backend.

```yaml {paths="audio-route"}
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: voxtral-audio-route
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
        - name: voxtral-audio
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

curl --request POST \
  --url "http://${INGRESS_GW_ADDRESS}:80/audio/v1/audio/transcriptions" \
  --header 'Content-Type: multipart/form-data' \
  --form model=voxtral-small-24b-2507 \
  --form 'file=@./testdata/sample-audio.webm' | jq
{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}
In one terminal, start a port-forward to the gateway.

```sh
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
```

In a second terminal, send a request.

```sh
curl --request POST \
  --url "http://localhost:8080/audio/v1/audio/transcriptions" \
  --header 'Content-Type: multipart/form-data' \
  --form model=voxtral-small-24b-2507 \
  --form 'file=@./testdata/sample-audio.webm' | jq
{{% /tab %}}
{{< /tabs >}}

{{< callout type="info" >}}
**Supported audio formats:** WAV, MP3, MKV, WEBM and other formats supported by the underlying model. For Voxtral, recommended formats include WebM and WAV.
{{< /callout >}}

{{< /steps %}}

## Supported audio endpoints

The table below lists the audio-specific endpoints that can be configured via `Passthrough` routing.

| API path | Route type | Description |
|----------|------------|-------------|
| `/v1/audio/transcriptions` | `Passthrough` | Transcribes audio files to text. Agentgateway forwards the `multipart/form-data` payload and the JSON response without modification. |
| `/v1/models` | `Passthrough` | Lists available models. |

{{< callout type="info" >}}
When a route is set to `Passthrough`, agentgateway does not apply any LLM-specific policies (such as cost tracking, rate limiting, or prompt guards) to those requests. The requests are forwarded exactly as received.
{{< /callout >}}


## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```shell
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} voxtral-audio -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute voxtral-audio-route -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete svc voxtral-service -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete deployment voxtral-vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
