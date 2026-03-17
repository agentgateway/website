Configure [Ollama](https://ollama.com/) to serve local models through {{< reuse "agw-docs/snippets/agw-kgw.md" >}}. Ollama runs on a machine outside your cluster, and agentgateway routes requests to it over the network.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You also need:
- [Ollama](https://ollama.com/download) installed and running on a machine accessible from your Kubernetes cluster.
- The IP address of the machine running Ollama.

## Set up Ollama

1. Pull a model to serve.

   ```sh
   ollama pull llama3.2
   ```

2. By default, Ollama only listens on `localhost`. Configure it to accept external connections by setting the `OLLAMA_HOST` environment variable, then restart Ollama.

   ```sh
   export OLLAMA_HOST=0.0.0.0:11434
   ```

   {{< callout type="warning" >}}
   Binding Ollama to `0.0.0.0` exposes it on all network interfaces. Use firewall rules to restrict access to your Kubernetes cluster nodes only.
   {{< /callout >}}

3. Verify Ollama is accessible from the machine's network address.

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

   ```yaml
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

   ```yaml
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

   ```yaml
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

5. Send a request to verify agentgateway can route to Ollama.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
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
   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
   ```

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
