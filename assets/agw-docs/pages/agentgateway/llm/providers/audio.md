Configure self-hosted audio models like [Voxtral Small](https://huggingface.co/mistralai/Voxtral-Small-24B-2507) through {{< reuse "agw-docs/snippets/agentgateway.md" >}}. Audio models expose endpoints like `/v1/audio/transcriptions` and `/v1/models` that are handled via `Passthrough` routing — agentgateway forwards the request and response without parsing or modifying the payload.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up and expose your audio model

{{% steps %}}

### Step 1: Deploy the audio model (self-hosted)

Deploy the audio model inside your cluster (e.g., Voxtral Small via vLLM) and expose it via a Service.

> [!WARNING]
> **Voxtral Small requires a Docker environment with NVIDIA GPU support (`nvidia-container-toolkit`).**

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

Verify that the model is responding by listing the models that it serves. The `voxtral-service` Service is a ClusterIP Service, so send the request from a pod inside the cluster.

```sh
kubectl run curl-audio --rm -i --restart=Never \
  -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --image=curlimages/curl -- \
  curl -s http://voxtral-service.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:80/v1/models
```

You should see a JSON response listing the model.

### Step 3: Create the LLM backend with Passthrough routes

Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource with `policies.ai.routes` to forward audio endpoints via `Passthrough` processing.

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

> [!NOTE]
> The `Passthrough` route type applies no LLM policies at all. To keep token-based rate limiting and telemetry for audio traffic, set the audio paths to `Detect` instead. `Detect` also forwards the payload unchanged, but makes a best effort to extract the model and token counts. For more information about the available route types, see [Multiple endpoints]({{< link-hextra path="/llm/providers/multiple-endpoints/" >}}).

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
      filters:
        - type: URLRewrite
          urlRewrite:
            path:
              type: ReplacePrefixMatch
              replacePrefixMatch: /
      backendRefs:
        - name: voxtral-audio
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
          group: {{< reuse "agw-docs/snippets/group.md" >}}
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

| Setting | Description |
|---------|-------------|
| `matches.path` | Matches requests along the `/audio` path prefix. |
| `filters.urlRewrite` | Strips the `/audio` prefix before the request is forwarded, so that the audio model receives the `/v1/audio/transcriptions` path that it serves. Without this filter, the model receives `/audio/v1/audio/transcriptions` and returns a 404 response. |
| `backendRefs` | Forwards matching requests to the `voxtral-audio` {{< reuse "agw-docs/snippets/backend.md" >}} resource that you created in the previous step. |

### Step 5: Send audio transcription requests

Create a sample WAV file to transcribe. If you already have an audio file, use its path in the following requests instead.

```sh
mkdir -p testdata
python3 -c "
import wave
w = wave.open('testdata/sample-audio.wav', 'wb')
w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
w.writeframes(b'\x00\x00' * 16000)
w.close()
"
```

Then, send a transcription request to the audio model through the gateway.

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
```sh
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

curl --request POST \
  --url "http://${INGRESS_GW_ADDRESS}:80/audio/v1/audio/transcriptions" \
  --header 'Content-Type: multipart/form-data' \
  --form model=voxtral-small-24b-2507 \
  --form 'file=@./testdata/sample-audio.wav' | jq
```
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
  --form 'file=@./testdata/sample-audio.wav' | jq
```
{{% /tab %}}
{{< /tabs >}}

> [!NOTE]
> **Supported audio formats:** WAV, FLAC, OGG and AU (via [libsndfile](https://github.com/libsndfile/libsndfile)). These formats are natively supported by the vLLM audio processing pipeline.

{{% /steps %}}

## Supported audio endpoints

The table below lists the audio-specific endpoints that can be configured via `Passthrough` routing.

| API path | Route type | Description |
|----------|------------|-------------|
| `/v1/audio/transcriptions` | `Passthrough` | Transcribes audio files to text. Agentgateway forwards the `multipart/form-data` payload and the JSON response without modification. |
| `/v1/models` | `Passthrough` | Lists available models. |

> [!NOTE]
> When a route is set to `Passthrough`, agentgateway does not apply any LLM-specific policies (such as cost tracking, rate limiting, or prompt guards) to those requests. The requests are forwarded exactly as received.


## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```shell
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} voxtral-audio -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute voxtral-audio-route -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete svc voxtral-service -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete deployment voxtral-vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
