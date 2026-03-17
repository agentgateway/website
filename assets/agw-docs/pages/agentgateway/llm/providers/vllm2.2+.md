Configure [vLLM](https://github.com/vllm-project/vllm), a high-performance LLM serving engine, through {{< reuse "agw-docs/snippets/agw-kgw.md" >}}. This guide covers two deployment patterns:

- **External vLLM**: Connect to a vLLM server running outside your Kubernetes cluster on dedicated GPU hardware.
- **In-cluster vLLM**: Deploy vLLM as a workload inside your Kubernetes cluster.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up vLLM

Choose your deployment option and follow the corresponding steps to set up the vLLM server and create the required Kubernetes resources.

{{< tabs tabTotal="2" items="External vLLM,In-cluster vLLM" >}}
{{% tab tabName="External vLLM" %}}

### Configure the external vLLM server

1. Install vLLM on a GPU-enabled machine. See the [vLLM installation guide](https://docs.vllm.ai/en/latest/getting_started/installation.html).

2. Start the vLLM OpenAI-compatible server:

   ```sh
   vllm serve meta-llama/Llama-3.1-8B-Instruct \
     --host 0.0.0.0 \
     --port 8000 \
     --dtype auto
   ```

3. Verify the server is accessible:

   ```sh
   curl http://<VLLM_SERVER_IP>:8000/v1/models
   ```

### Create Kubernetes resources for the external vLLM server

1. Get the IP address of the vLLM server.

2. Create a headless Service and EndpointSlice that point to the external vLLM server. Replace `<VLLM_SERVER_IP>` with the actual IP address.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: vllm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     type: ClusterIP
     clusterIP: None
     ports:
     - port: 8000
       targetPort: 8000
       protocol: TCP
   ---
   apiVersion: discovery.k8s.io/v1
   kind: EndpointSlice
   metadata:
     name: vllm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       kubernetes.io/service-name: vllm
   addressType: IPv4
   endpoints:
   - addresses:
     - <VLLM_SERVER_IP>
   ports:
   - port: 8000
     protocol: TCP
   EOF
   ```

{{% /tab %}}
{{% tab tabName="In-cluster vLLM" %}}

### Deploy vLLM inside the cluster

{{< callout type="info" >}}
Running vLLM in production requires Kubernetes nodes with NVIDIA GPU support. The Deployment below omits GPU resource requests so you can validate the configuration structure in a non-GPU cluster. Add `resources.requests` and `resources.limits` with `nvidia.com/gpu` for production deployments.
{{< /callout >}}

1. Create the vLLM Deployment and Service:

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
           env:
           - name: HUGGING_FACE_HUB_TOKEN
             valueFrom:
               secretKeyRef:
                 name: hf-token
                 key: token
                 optional: true
   ---
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

   {{< callout type="note" >}}
   vLLM downloads model weights on first startup, which can take several minutes depending on model size and network speed. Monitor progress with:
   ```sh
   kubectl logs -f deployment/vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
   For gated models such as Llama, create a Hugging Face token secret before deploying:
   ```sh
   kubectl create secret generic hf-token \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=token=<your-hf-token>
   ```
   {{< /callout >}}

2. Wait for the vLLM pod to be ready:

   ```sh
   kubectl wait --for=condition=ready pod \
     -l app=vllm \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --timeout=300s
   ```

{{% /tab %}}
{{< /tabs >}}

## Create the agentgateway backend resources

These steps are the same for both external and in-cluster vLLM.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource. The `openai` provider type is used because vLLM exposes an OpenAI-compatible API.

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

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#agentgatewaybackend" >}}).

   | Setting | Description |
   |---------|-------------|
   | `ai.provider.openai` | The OpenAI-compatible provider type. vLLM exposes an OpenAI-compatible API, so the `openai` type is used here. |
   | `openai.model` | The model name as served by vLLM. This must match the `--model` argument used when starting vLLM. |
   | `host` | The in-cluster DNS name of the Service pointing to the vLLM instance. |
   | `port` | The port vLLM listens on. The default is `8000`. |

2. Create an HTTPRoute to expose the vLLM backend through the gateway.

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
     - backendRefs:
       - name: vllm
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

3. Send a request to verify agentgateway can route to vLLM.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS" \
     -H "content-type: application/json" \
     -d '{
       "model": "meta-llama/Llama-3.1-8B-Instruct",
       "messages": [
         {
           "role": "user",
           "content": "Explain the benefits of vLLM for serving large language models."
         }
       ]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
   ```

   ```sh
   curl "localhost:8080" \
     -H "content-type: application/json" \
     -d '{
       "model": "meta-llama/Llama-3.1-8B-Instruct",
       "messages": [
         {
           "role": "user",
           "content": "Explain the benefits of vLLM for serving large language models."
         }
       ]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Troubleshooting

### Connection refused or 503 response

**What's happening:**

The gateway returns a 503 response or requests fail with a connection error.

**Why it's happening:**

For external vLLM, the cluster cannot reach the server — check the EndpointSlice IP and firewall rules. For in-cluster vLLM, the pod may still be starting or may have failed to schedule.

**How to fix it:**

1. For external vLLM, verify the server is reachable and the EndpointSlice is correct:
   ```sh
   curl http://<VLLM_SERVER_IP>:8000/v1/models
   kubectl get endpointslice vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
   ```

2. For in-cluster vLLM, check the pod status and logs:
   ```sh
   kubectl get pods -l app=vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl logs deployment/vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

### Pod stuck in Pending state (in-cluster only)

**What's happening:**

The vLLM pod does not start and shows a `Pending` status.

**Why it's happening:**

No GPU nodes are available in the cluster, or the GPU resource requests cannot be satisfied.

**How to fix it:**

1. Check GPU node availability:
   ```sh
   kubectl describe nodes | grep -A 5 "nvidia.com/gpu"
   ```

2. Check the pod events for scheduling errors:
   ```sh
   kubectl describe pod -l app=vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
