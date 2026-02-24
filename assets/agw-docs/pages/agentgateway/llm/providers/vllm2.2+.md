Configure [vLLM](https://github.com/vllm-project/vllm), the high-performance LLM serving engine, to serve self-hosted models through {{< reuse "agw-docs/snippets/agw-kgw.md" >}}.

## Overview

vLLM is a fast and memory-efficient inference engine for large language models. It's designed for high-throughput serving and is commonly deployed in Kubernetes clusters for production workloads.

This guide shows two deployment patterns:
- **External vLLM**: Connect to a vLLM instance running outside your Kubernetes cluster
- **In-cluster vLLM**: Deploy vLLM within your Kubernetes cluster

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Option 1: Connect to external vLLM instance

Use this option if vLLM is already deployed on dedicated GPU infrastructure outside your Kubernetes cluster.

### Set up external vLLM

1. Install and run vLLM on a machine with GPU access. Follow the [vLLM installation guide](https://docs.vllm.ai/en/latest/getting_started/installation.html).

2. Start the vLLM OpenAI-compatible server:

   ```sh
   vllm serve meta-llama/Llama-3.1-8B-Instruct \
     --host 0.0.0.0 \
     --port 8000 \
     --dtype auto
   ```

3. Verify vLLM is accessible:

   ```sh
   curl http://<vllm-server-ip>:8000/v1/models
   ```

### Configure Kubernetes to connect to external vLLM

1. Get the IP address of your vLLM server.

2. Create a headless Service and Endpoints pointing to the external vLLM instance:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: vllm-external
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     type: ClusterIP
     clusterIP: None  # Headless service
     ports:
     - port: 8000
       targetPort: 8000
       protocol: TCP
   ---
   apiVersion: v1
   kind: Endpoints
   metadata:
     name: vllm-external
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   subsets:
   - addresses:
     - ip: 10.0.1.50  # Replace with your vLLM server IP
     ports:
     - port: 8000
       protocol: TCP
   EOF
   ```

3. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: vllm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Llama-3.1-8B-Instruct
         host: vllm-external.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
         port: 8000
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | `ai.provider.openai` | Use OpenAI-compatible provider for vLLM. |
   | `openai.model` | The model served by vLLM (must match the model vLLM is serving). |
   | `openai.host` | Kubernetes Service DNS name for the external vLLM instance. |
   | `openai.port` | vLLM API port (default: `8000`). |

4. Create an HTTPRoute:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: vllm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /vllm
       backendRefs:
       - name: vllm
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

5. Test the setup:

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/vllm" -H content-type:application/json  -d '{
      "model": "meta-llama/Llama-3.1-8B-Instruct",
      "messages": [
        {
          "role": "user",
          "content": "Explain the benefits of vLLM."
        }
      ]
    }' | jq
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/vllm" -H content-type:application/json  -d '{
      "model": "meta-llama/Llama-3.1-8B-Instruct",
      "messages": [
        {
          "role": "user",
          "content": "Explain the benefits of vLLM."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Option 2: Deploy vLLM in Kubernetes cluster

Use this option to deploy vLLM directly in your Kubernetes cluster alongside agentgateway.

### Prerequisites

- Kubernetes cluster with GPU nodes (NVIDIA GPUs with CUDA support)
- NVIDIA GPU Operator or device plugin installed
- Sufficient GPU memory for your chosen model

### Deploy vLLM in the cluster

1. Create a vLLM Deployment with GPU resources:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: vllm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: vllm
     template:
       metadata:
         labels:
           app: vllm
       spec:
         containers:
         - name: vllm
           image: vllm/vllm-openai:latest
           args:
             - "--model"
             - "meta-llama/Llama-3.1-8B-Instruct"
             - "--host"
             - "0.0.0.0"
             - "--port"
             - "8000"
             - "--dtype"
             - "auto"
           ports:
           - containerPort: 8000
             name: http
           resources:
             requests:
               nvidia.com/gpu: 1  # Request 1 GPU
             limits:
               nvidia.com/gpu: 1  # Limit to 1 GPU
           env:
           - name: HUGGING_FACE_HUB_TOKEN
             valueFrom:
               secretKeyRef:
                 name: hf-token  # Create this secret if accessing gated models
                 key: token
                 optional: true
   EOF
   ```

   {{< callout type="info" >}}
   **Model access**: For gated models (like Llama), create a Hugging Face token secret:
   ```sh
   kubectl create secret generic hf-token \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=token=<your-hf-token>
   ```
   {{< /callout >}}

2. Create a Service for the vLLM deployment:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: vllm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     selector:
       app: vllm
     ports:
     - port: 8000
       targetPort: 8000
       protocol: TCP
   EOF
   ```

3. Wait for vLLM to be ready:

   ```sh
   kubectl wait --for=condition=ready pod \
     -l app=vllm \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --timeout=300s
   ```

   {{< callout type="note" >}}
   **Initial startup**: vLLM needs to download the model weights on first launch, which can take several minutes depending on model size and network speed. Monitor the logs:
   ```sh
   kubectl logs -f deployment/vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
   {{< /callout >}}

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: vllm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Llama-3.1-8B-Instruct
         host: vllm.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
         port: 8000
   EOF
   ```

5. Create an HTTPRoute (same as Option 1 step 4 above).

## vLLM configuration options

### Quantization

Reduce memory usage with quantization:

```yaml
args:
  - "--model"
  - "meta-llama/Llama-3.1-8B-Instruct"
  - "--quantization"
  - "awq"  # or "gptq", "squeezellm"
```

### Tensor parallelism

Distribute model across multiple GPUs:

```yaml
args:
  - "--model"
  - "meta-llama/Llama-3.1-70B-Instruct"
  - "--tensor-parallel-size"
  - "4"  # Use 4 GPUs
resources:
  requests:
    nvidia.com/gpu: 4
  limits:
    nvidia.com/gpu: 4
```

### Engine arguments

Tune performance parameters:

```yaml
args:
  - "--model"
  - "meta-llama/Llama-3.1-8B-Instruct"
  - "--max-model-len"
  - "4096"  # Maximum sequence length
  - "--gpu-memory-utilization"
  - "0.9"  # Use 90% of GPU memory
  - "--max-num-seqs"
  - "256"  # Maximum number of sequences to process in parallel
```

## Scaling and high availability

### Horizontal scaling

Scale vLLM for higher throughput:

```sh
kubectl scale deployment vllm \
  -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --replicas=3
```

Kubernetes will load balance requests across vLLM replicas through the Service.

### Resource limits

Set appropriate resource requests and limits:

```yaml
resources:
  requests:
    memory: "16Gi"
    nvidia.com/gpu: 1
  limits:
    memory: "32Gi"
    nvidia.com/gpu: 1
```

### Node affinity

Pin vLLM to GPU nodes:

```yaml
spec:
  template:
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: nvidia.com/gpu.present
                operator: In
                values:
                - "true"
```

## Monitoring

vLLM exposes Prometheus metrics at `/metrics`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: vllm-metrics
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: vllm
spec:
  selector:
    app: vllm
  ports:
  - port: 8000
    targetPort: 8000
    name: metrics
```

Key metrics to monitor:
- `vllm_request_duration_seconds` - Request latency
- `vllm_num_requests_running` - Active requests
- `vllm_gpu_cache_usage_perc` - GPU memory utilization

## Troubleshooting

### Pod stuck in Pending state

**Symptom**: vLLM pod doesn't start, shows `Pending` status.

**Cause**: No GPU nodes available or insufficient GPU memory.

**Solution**:
```sh
# Check GPU availability
kubectl describe nodes | grep -A 5 "nvidia.com/gpu"

# Check pod events
kubectl describe pod -l app=vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

### Out of memory errors

**Symptom**: vLLM crashes with CUDA out-of-memory errors.

**Solutions**:
1. Use a smaller model or quantized variant
2. Reduce `--max-model-len`
3. Lower `--gpu-memory-utilization` (try `0.8` or `0.7`)
4. Enable tensor parallelism across more GPUs

### Slow inference

**Symptom**: High latency on requests.

**Possible causes**:
- Model too large for available GPU memory (swapping to CPU)
- Insufficient `--max-num-seqs` for concurrent requests
- CPU bottleneck in preprocessing

**Solutions**:
- Increase GPU memory or use smaller model
- Tune `--max-num-seqs` and `--max-model-len`
- Use faster CPUs or increase CPU requests

### Connection refused from agentgateway

**Symptom**: agentgateway cannot reach vLLM service.

**Solutions**:
1. Verify vLLM Service exists and has endpoints:
   ```sh
   kubectl get svc vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl get endpoints vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Test connectivity from another pod:
   ```sh
   kubectl run -it --rm debug --image=curlimages/curl --restart=Never \
     -- curl http://vllm.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:8000/v1/models
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
