Configure [vLLM](https://github.com/vllm-project/vllm), a high-performance LLM serving engine, through {{< reuse "agw-docs/snippets/agw-kgw.md" >}}. This guide covers two deployment patterns.

- **External vLLM**: Connect to a vLLM server running outside your Kubernetes cluster on dedicated GPU hardware.
- **In-cluster vLLM**: Deploy vLLM as a workload inside your Kubernetes cluster.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up vLLM

Choose your deployment option and follow the corresponding steps to set up the vLLM server and create the required Kubernetes resources.

### Option 1: External vLLM

1. Install vLLM on a GPU-enabled machine. See the [vLLM installation guide](https://docs.vllm.ai/en/latest/getting_started/installation.html).

2. Start the vLLM OpenAI-compatible server.

   ```sh
   vllm serve meta-llama/Llama-3.1-8B-Instruct \
     --host 0.0.0.0 \
     --port 8000 \
     --dtype auto
   ```

3. Verify the server is accessible.

   ```sh
   curl http://<VLLM_SERVER_IP>:8000/v1/models
   ```

4. Create a headless Service and EndpointSlice that point to the external vLLM server. Replace `<VLLM_SERVER_IP>` with the actual IP address.

   ```yaml {paths="vllm-provider-setup"}
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

### Option 2: Deploy vLLM in Kubernetes cluster

Use this option to deploy vLLM directly in your Kubernetes cluster alongside agentgateway.

Before you begin, make sure that your cluster has:

- GPU nodes (NVIDIA GPUs with CUDA support).
- NVIDIA GPU Operator or device plugin installed.
- Sufficient GPU memory for your chosen model.

Example steps:

1. Create a vLLM Deployment with GPU resources.

   {{< callout type="note" >}}
   For gated models such as Llama, create a Hugging Face token secret before deploying.
   ```sh
   kubectl create secret generic hf-token \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=token=<your-hf-token>
   ```
   {{< /callout >}}


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

2. Wait for the vLLM pod to be ready.

   {{< callout type="note" >}}
   vLLM downloads model weights on first startup, which can take several minutes depending on model size and network speed. Monitor progress with the following command.
   ```sh
   kubectl logs -f deployment/vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
   {{< /callout >}}

   ```sh
   kubectl wait --for=condition=ready pod \
     -l app=vllm \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --timeout=300s
   ```

{{< doc-test paths="vllm-provider-setup" >}}
kubectl apply -f- <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbun-vllm
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: httpbun-vllm
spec:
  replicas: 1
  selector:
    matchLabels:
      app: httpbun-vllm
  template:
    metadata:
      labels:
        app: httpbun-vllm
    spec:
      containers:
      - name: httpbun
        image: sharat87/httpbun
        env:
        - name: HTTPBUN_BIND
          value: "0.0.0.0:3090"
        ports:
        - containerPort: 3090
---
apiVersion: v1
kind: Service
metadata:
  name: httpbun-vllm
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  selector:
    app: httpbun-vllm
  ports:
  - protocol: TCP
    port: 3090
    targetPort: 3090
EOF

YAMLTest -f - <<'EOF'
- name: wait for httpbun-vllm deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: httpbun-vllm
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
EOF

HTTPBUN_VLLM_POD_IP=$(kubectl get pod -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l app=httpbun-vllm -o jsonpath='{.items[0].status.podIP}')
kubectl patch endpoints vllm-external -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type merge -p "{\"subsets\":[{\"addresses\":[{\"ip\":\"${HTTPBUN_VLLM_POD_IP}\"}],\"ports\":[{\"port\":3090,\"protocol\":\"TCP\"}]}]}"
kubectl patch {{< reuse "agw-docs/snippets/backend.md" >}} vllm -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type merge -p '{"spec":{"ai":{"provider":{"openai":{"model":"gpt-4"},"port":3090,"path":"/llm/chat/completions"}}}}'

YAMLTest -f - <<'EOF'
- name: wait for vllm HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: vllm
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
- name: wait for vllm HTTPRoute refs to be resolved
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: vllm
    jsonPath: "$.status.parents[0].conditions[?(@.type=='ResolvedRefs')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway-system agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

YAMLTest -f - <<'EOF'
- name: verify vllm route serves OpenAI-compatible responses
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/vllm"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "model": "gpt-4",
        "messages": [
          {
            "role": "user",
            "content": "Respond with the word hello."
          }
        ],
        "httpbun": {
          "content": "vllm provider route is working"
        }
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.choices[0].message.content"
        comparator: contains
        value: "vllm provider route is working"
EOF
{{< /doc-test >}}

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

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer, Port-forward for local testing" >}}
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
   In one terminal, start a port-forward to the gateway.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
   ```

   In a second terminal, send a request.

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
