---
title: Audio models
weight: 60
description: Serve self-hosted audio models such as Voxtral with an AgentgatewayModel, and record the usage and cost of transcription requests.
---

Serve self-hosted audio models like [Voxtral Small](https://huggingface.co/mistralai/Voxtral-Small-24B-2507) through {{< reuse "agw-docs/snippets/agentgateway.md" >}} with an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` resource.

## About

An `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` declares one client-facing model and attaches it to a Gateway listener. The listener recognizes the OpenAI-compatible audio endpoints. It reads the model from each request, routes the request to the matching model, and records the operation, usage, and cost. You do not create an {{< reuse "agw-docs/snippets/backend.md" >}} or an HTTPRoute.

| API path | `gen_ai.operation.name` | Usage and cost |
|----------|-------------------------|----------------|
| `/v1/audio/transcriptions` | `transcription` | The audio duration is read from the `usage.seconds`, `usage.prompt_audio_seconds`, or top-level `duration` field of the response. |
| `/v1/audio/translations` | `transcription` | Same as transcriptions. |
| `/v1/audio/speech` | `speech` | None. The response is binary audio with no usage fields, so the request has no usage and no cost. |

Transcription and translation requests send the audio file as multipart form data. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} reads the `model` form field, and rewrites it when a model transformation maps it to a different upstream name. The other form fields, such as the uploaded file, are forwarded unchanged.

For more information about the {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} API, see [Serve a model]({{< link-hextra path="/documentation/llm/models/serve/" >}}).

### Usage and cost {#usage-and-cost}

The audio duration is available as `llm.audioSeconds` in CEL expressions and as `gen_ai.usage.audio_seconds` in access logs and traces. To price it, set a `perAudioMinute` rate in USD per minute for the model in the model cost catalog. The audio cost is the duration in minutes multiplied by the rate.

The built-in catalog includes per-minute rates for some OpenAI transcription models, such as `whisper-1`. For a self-hosted model such as Voxtral, add your own rate. Key the rate by the provider id and the model name that clients request. For example, the following catalog entry prices the Voxtral model in this guide at `$0.004` per minute of audio.

```json
{
  "providers": {
    "openai": {
      "models": {
        "mistralai/Voxtral-Small-24B-2507": {
          "rates": { "perAudioMinute": "0.004" }
        }
      }
    }
  }
}
```

For how to load a catalog into the proxy, see [Configure a catalog as a ConfigMap]({{< link-hextra path="/documentation/llm/cost-controls/costs/#step-2-configure-a-catalog-as-a-configmap" >}}). With this rate, a transcription that reports `usage.seconds: 90` costs `$0.006`. The access log entry includes the following fields.

```console
gen_ai.operation.name=transcription gen_ai.provider.name=openai gen_ai.request.model=mistralai/Voxtral-Small-24B-2507 agw.ai.usage.cost.total=0.006 gen_ai.usage.audio_seconds=90
```

### Alternative: Route audio on an {{< reuse "agw-docs/snippets/backend.md" >}} {#backend-alternative}

You can also route the audio paths through an HTTPRoute to an {{< reuse "agw-docs/snippets/backend.md" >}} that maps each path to a route type in `policies.ai.routes`. Prefer an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` for new configurations, because it recognizes the audio endpoints without a routes map, URL rewrites, or an HTTPRoute.

On an {{< reuse "agw-docs/snippets/backend.md" >}}, set the audio paths to `Detect` to record the same operation, usage, and cost. The `Passthrough` route type forwards the request and response without parsing them, so it records no usage or cost and applies no LLM policies. For more information about route types, see [Multiple endpoints]({{< link-hextra path="/integrations/llm/providers/multiple-endpoints/" >}}).

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Verify that the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` API is enabled. The API is enabled by default. For the steps, see [Verify the AgentgatewayModel feature]({{< link-hextra path="/documentation/llm/models/serve/#verify-the-agentgatewaymodel-feature" >}}).
3. Make sure that your cluster has a node with an NVIDIA GPU and the NVIDIA device plugin or GPU Operator, so that `nvidia.com/gpu` is schedulable. The Voxtral Small example in this guide requests one GPU. Without one, the pod stays `Pending`, and the wait in step 1 times out.

## Set up and expose your audio model

{{% steps %}}

### Step 1: Deploy the audio model (self-hosted)

Deploy the audio model inside your cluster (e.g., Voxtral Small via vLLM) and expose it via a Service.

1. Deploy Voxtral Small using the official vLLM OpenAI-compatible image.

   ```yaml
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

In the output, you see a JSON response listing the model.

### Step 3: Enable LLM serving on a listener

Add the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` route kind to the `http` listener on the `agentgateway-proxy` Gateway, and verify that the listener supports it. Follow the steps in [Enable LLM serving on a listener]({{< link-hextra path="/documentation/llm/models/serve/#enable-llm-serving-on-a-listener" >}}). The gateway then serves both LLM models and ordinary `HTTPRoute` traffic on the same port. The model in the next step references the `http` listener name in `parentRefs.sectionName`.

### Step 4: Create the AgentgatewayModel

Create an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` that serves the Voxtral model on the `http` listener.

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
metadata:
  name: voxtral-small
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    sectionName: http
  match:
    model: mistralai/Voxtral-Small-24B-2507
  provider: OpenAI
  baseURL: http://voxtral-service.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local/v1
EOF
```

Example output:

```console
agentgatewaymodel.agentgateway.dev/voxtral-small created
```

{{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

| Setting | Description |
|---------|-------------|
| `parentRefs` | Attaches the model to the `http` listener of the `agentgateway-proxy` Gateway. |
| `match.model` | The model name that clients send. vLLM serves the model under its Hugging Face name, so clients request `mistralai/Voxtral-Small-24B-2507`. Without `match`, the model matches `metadata.name`, which cannot contain `/` or uppercase letters. |
| `provider` | `OpenAI`, because vLLM exposes OpenAI-compatible audio APIs. |
| `baseURL` | The in-cluster address of the Voxtral Service. The path replaces the OpenAI `/v1` base path, so keep `/v1` to send transcriptions to the `/v1/audio/transcriptions` path that vLLM serves. |

### Step 5: Send audio transcription requests

1. Create a sample WAV file to transcribe. If you already have an audio file, use its path in the following requests instead.

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

2. Save the gateway address in an environment variable.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   In one terminal, start a port-forward to the gateway.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
   ```

   In a second terminal, point the requests in this guide at the forwarded port.

   ```sh
   export INGRESS_GW_ADDRESS=localhost:8080
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Send a transcription request through the gateway.

   ```sh
   curl http://$INGRESS_GW_ADDRESS/v1/audio/transcriptions \
     -F model=mistralai/Voxtral-Small-24B-2507 \
     -F file=@./testdata/sample-audio.wav | jq
   ```

   Example output. The sample file is one second of silence, so the text is empty. vLLM reports the audio duration in `usage.seconds`.

   ```json
   {
     "text": "",
     "usage": {
       "type": "duration",
       "seconds": 1
     }
   }
   ```

4. Check the proxy access log. The entry records the `transcription` operation and the audio duration. The entry includes a cost only if your model catalog has a `perAudioMinute` rate for the model, as described in [Usage and cost](#usage-and-cost).

   ```sh
   kubectl logs deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} | grep audio/transcriptions | tail -1
   ```

   Example output:

   ```console
   info	request gateway={{< reuse "agw-docs/snippets/namespace.md" >}}/agentgateway-proxy listener=http ... http.method=POST http.path=/v1/audio/transcriptions http.status=200 protocol=llm gen_ai.operation.name=transcription gen_ai.provider.name=openai gen_ai.request.model=mistralai/Voxtral-Small-24B-2507 gen_ai.usage.audio_seconds=1 ...
   ```

> [!NOTE]
> **Supported audio formats:** WAV, FLAC, OGG and AU (via [libsndfile](https://github.com/libsndfile/libsndfile)). These formats are natively supported by the vLLM audio processing pipeline.

{{% /steps %}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```shell
kubectl delete agentgatewaymodel voxtral-small -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete svc voxtral-service -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete deployment voxtral-vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

To stop the listener from serving LLM traffic, remove the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` entry from `allowedRoutes.kinds`. Do not delete the `agentgateway-proxy` Gateway, because other guides use it.

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
