Configure [Ollama](https://ollama.com/) to serve local models through {{< reuse "agw-docs/snippets/kgateway.md" >}}. Ollama runs on a machine outside your cluster, and agentgateway routes requests to it over the network.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

2. Install and run [Ollama](https://ollama.ai/download) on a machine accessible from your Kubernetes cluster.

3. Get the IP address of the machine running Ollama.

## Set up Ollama

1. From the cluster where you installed Ollama, make sure that you have at least one model pulled.
   
   ```sh
   ollama list
   ```

   If not, pull a model.
   ```sh
   ollama pull llama3.2
   ```

2. Configure Ollama to accept external connections. By default, Ollama only listens on `localhost`. You can change this setting with the `OLLAMA_HOST` environment variable. 

   ```sh
   export OLLAMA_HOST=0.0.0.0:11434
   ```

   {{< callout type="warning" >}}
   Binding Ollama to `0.0.0.0` exposes it on all network interfaces. Use firewall rules to restrict access to your Kubernetes cluster nodes only.
   {{< /callout >}}

3. Restart Ollama to apply the new setting.

4. Verify Ollama is accessible from the machine's network address.

   ```sh
   curl http://<OLLAMA_IP>:11434/v1/models
   ```

## Configure agentgateway to reach Ollama

Because Ollama runs outside your Kubernetes cluster, you need a headless Service and EndpointSlice to give it a stable in-cluster DNS name.

1. Get the IP address of the machine running Ollama.

   ```sh
   # macOS
   ipconfig getifaddr en0

   # Linux
   hostname -I | awk '{print $1}'
   ```

2. Create a headless Service and EndpointSlice that point to the external Ollama instance. Replace `<OLLAMA_IP>` with the actual IP address.

   ```yaml {paths="ollama-provider-setup"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: ollama
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     type: ClusterIP
     clusterIP: None
     ports:
     - port: 11434
       targetPort: 11434
       protocol: TCP
   ---
   apiVersion: discovery.k8s.io/v1
   kind: EndpointSlice
   metadata:
     name: ollama
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       kubernetes.io/service-name: ollama
   addressType: IPv4
   endpoints:
   - addresses:
     - <OLLAMA_IP>
   ports:
   - port: 11434
     protocol: TCP
   EOF
   ```

3. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource. The `openai` provider type is used because Ollama exposes an OpenAI-compatible API. The `host` and `port` fields point to the headless Service DNS name.

   ```yaml {paths="ollama-provider-setup"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: ollama
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: llama3.2
         host: ollama.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
         port: 11434
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#agentgatewaybackend" >}}).

   | Setting | Description |
   |---------|-------------|
   | `ai.provider.openai` | The OpenAI-compatible provider type. Ollama exposes an OpenAI-compatible API, so the `openai` type is used here. |
   | `openai.model` | The Ollama model to use. This must match a model you pulled with `ollama pull`. |
   | `host` | The in-cluster DNS name of the headless Service pointing to the external Ollama instance. |
   | `port` | The port Ollama listens on. The default is `11434`. |

4. Create an HTTPRoute to expose the Ollama backend through the gateway.

   ```yaml {paths="ollama-provider-setup"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: ollama
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - backendRefs:
       - name: ollama
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

{{< doc-test paths="ollama-provider-setup" >}}
kubectl apply -f- <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbun-ollama
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: httpbun-ollama
spec:
  replicas: 1
  selector:
    matchLabels:
      app: httpbun-ollama
  template:
    metadata:
      labels:
        app: httpbun-ollama
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
  name: httpbun-ollama
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  selector:
    app: httpbun-ollama
  ports:
  - protocol: TCP
    port: 3090
    targetPort: 3090
EOF

YAMLTest -f - <<'EOF'
- name: wait for httpbun-ollama deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: httpbun-ollama
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
EOF

HTTPBUN_OLLAMA_POD_IP=$(kubectl get pod -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l app=httpbun-ollama -o jsonpath='{.items[0].status.podIP}')
kubectl patch endpoints ollama-external -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type merge -p "{\"subsets\":[{\"addresses\":[{\"ip\":\"${HTTPBUN_OLLAMA_POD_IP}\"}],\"ports\":[{\"port\":3090,\"protocol\":\"TCP\"}]}]}"
kubectl patch {{< reuse "agw-docs/snippets/backend.md" >}} ollama -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type merge -p '{"spec":{"ai":{"provider":{"openai":{"model":"gpt-4"},"port":3090,"path":"/llm/chat/completions"}}}}'

YAMLTest -f - <<'EOF'
- name: wait for ollama HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: ollama
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
- name: wait for ollama HTTPRoute refs to be resolved
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: ollama
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
- name: verify ollama route serves OpenAI-compatible responses
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/ollama"
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
          "content": "ollama provider route is working"
        }
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.choices[0].message.content"
        comparator: contains
        value: "ollama provider route is working"
EOF
{{< /doc-test >}}

5. Send a request to verify the setup.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer, Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS" \
     -H "content-type: application/json" \
     -d '{
       "model": "llama3.2",
       "messages": [
         {
           "role": "user",
           "content": "Explain the benefits of running models locally."
         }
       ]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   In one terminal, start a port-forward to the gateway:

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
   ```

   In a second terminal, send a request:

   ```sh
   curl "localhost:8080" \
     -H "content-type: application/json" \
     -d '{
       "model": "llama3.2",
       "messages": [
         {
           "role": "user",
           "content": "Explain the benefits of running models locally."
         }
       ]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```json
   {
     "id": "chatcmpl-123",
     "object": "chat.completion",
     "created": 1727967462,
     "model": "llama3.2",
     "choices": [
       {
         "index": 0,
         "message": {
           "role": "assistant",
           "content": "Running models locally provides complete data privacy, no API costs or rate limits, and consistent low latency without network dependencies."
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 15,
       "completion_tokens": 32,
       "total_tokens": 47
     }
   }
   ```

## Troubleshooting

### Connection refused or 503 response

**What's happening:**

Requests fail with a connection error or the gateway returns a 503 response.

**Why it's happening:**

The Kubernetes cluster cannot reach the Ollama instance. This is usually caused by an incorrect IP in the EndpointSlice, a firewall blocking port 11434, or Ollama not configured to accept external connections.

**How to fix it:**

1. Verify Ollama is reachable from the machine's network address:
   ```sh
   curl http://<OLLAMA_IP>:11434/v1/models
   ```

2. Check that the EndpointSlice contains the correct IP:
   ```sh
   kubectl get endpointslice ollama -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
   ```

3. Test connectivity from inside the cluster:
   ```sh
   kubectl run -it --rm debug --image=curlimages/curl --restart=Never \
     -- curl http://ollama.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:11434/v1/models
   ```

### Model not found

**What's happening:**

The request returns an error indicating the model is not available.

**Why it's happening:**

The model specified in the request or the {{< reuse "agw-docs/snippets/backend.md" >}} resource has not been pulled in Ollama.

**How to fix it:**

1. List models available in Ollama:
   ```sh
   ollama list
   ```

2. Pull the model if it is missing:
   ```sh
   ollama pull llama3.2
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
