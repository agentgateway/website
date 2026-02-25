Configure [Ollama](https://ollama.ai/) to serve local models through {{< reuse "agw-docs/snippets/agw-kgw.md" >}}.

## Overview

Ollama allows you to run open-source LLMs locally on your development machine or a dedicated server. You can configure agentgateway running in Kubernetes to route requests to an external Ollama instance.

This guide shows how to connect agentgateway to an Ollama instance running outside your Kubernetes cluster, such as on a developer's laptop or a separate server.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

**Additional requirements:**
- Ollama installed and running on an accessible machine.
- Network connectivity between your Kubernetes cluster and the Ollama instance.
- Ollama configured to accept external connections.

## Set up Ollama

1. Install Ollama on your local machine or server by following the [Ollama installation guide](https://ollama.ai/download).

2. Pull a model to use with agentgateway.

   ```sh
   ollama pull llama3.2
   ```

3. Verify Ollama is running and accessible.

   ```sh
   curl http://localhost:11434/v1/models
   ```

4. Configure Ollama to accept connections from your Kubernetes cluster. By default, Ollama only listens on `localhost`. Set the `OLLAMA_HOST` environment variable to allow external connections.

   ```sh
   # On macOS/Linux, add to ~/.zshrc or ~/.bashrc
   export OLLAMA_HOST=0.0.0.0:11434

   # Restart Ollama
   ```

   {{< callout type="warning" >}}
   **Security consideration**: Binding Ollama to `0.0.0.0` makes it accessible from any network interface. In production, use firewall rules or network policies to restrict access to your Kubernetes cluster nodes only.
   {{< /callout >}}

## Configure Kubernetes to connect to external Ollama

Since Ollama runs outside the Kubernetes cluster, you need to create a headless Service with manual Endpoints pointing to your Ollama instance.

1. Get the IP address of the machine running Ollama. This should be an IP address reachable from your Kubernetes cluster nodes.

   ```sh
   # On the Ollama machine, get its IP
   # macOS:
   ipconfig getifaddr en0

   # Linux:
   hostname -I | awk '{print $1}'

   # Example output: 192.168.1.100
   ```

2. Create a Service and Endpoints that point to your external Ollama instance.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: ollama-external
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     type: ClusterIP
     clusterIP: None  # Headless service
     ports:
     - port: 11434
       targetPort: 11434
       protocol: TCP
   ---
   apiVersion: v1
   kind: Endpoints
   metadata:
     name: ollama-external
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   subsets:
   - addresses:
     - ip: 192.168.1.100  # Replace with your Ollama machine's IP
     ports:
     - port: 11434
       protocol: TCP
   EOF
   ```

   {{< callout type="info" >}}
   Replace `192.168.1.100` with the actual IP address of your Ollama machine. This IP must be routable from your Kubernetes cluster nodes.
   {{< /callout >}}

3. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource that configures Ollama as an OpenAI-compatible provider.

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
         host: ollama-external.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
         port: 11434
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#aibackend" >}}).

   | Setting | Description |
   |---------|-------------|
   | `ai.provider.openai` | Use the OpenAI-compatible provider type for Ollama. |
   | `openai.model` | The model pulled in Ollama (e.g., `llama3.2`, `mistral`, `codellama`). |
   | `openai.host` | The Kubernetes Service DNS name for the external Ollama instance. |
   | `openai.port` | The port Ollama listens on (default: `11434`). |

   {{< callout type="note" >}}
   No `policies.auth` is required since Ollama does not require authentication by default. No `policies.tls` is needed since Ollama uses HTTP (not HTTPS).
   {{< /callout >}}

4. Create an HTTPRoute resource that routes incoming traffic to the Ollama {{< reuse "agw-docs/snippets/backend.md" >}}.

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
     - matches:
       - path:
           type: PathPrefix
           value: /ollama
       backendRefs:
       - name: ollama
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

5. Send a request to verify the setup.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/ollama" -H content-type:application/json  -d '{
      "model": "llama3.2",
      "messages": [
        {
          "role": "user",
          "content": "Explain the benefits of running models locally."
        }
      ]
    }' | jq
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/ollama" -H content-type:application/json  -d '{
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
           "content": "Running models locally provides several key benefits: complete data privacy since information never leaves your infrastructure, no API costs or rate limits, consistent low latency without network dependencies, and the ability to work offline. This makes it ideal for sensitive data, development environments, and applications requiring guaranteed response times."
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 15,
       "completion_tokens": 58,
       "total_tokens": 73
     }
   }
   ```

## Connecting from a different network

If your Ollama instance and Kubernetes cluster are on different networks (e.g., Ollama on your laptop and cluster in the cloud), you need to expose Ollama through a tunnel or VPN.

### Option 1: Tailscale (recommended)

[Tailscale](https://tailscale.com/) creates a secure mesh network between your laptop and Kubernetes cluster.

1. Install Tailscale on both your Ollama machine and Kubernetes cluster nodes.
2. Use the Tailscale IP address in the Kubernetes Endpoints resource.
3. Configure your {{< reuse "agw-docs/snippets/backend.md" >}} to point to the Tailscale service name.

### Option 2: ngrok or similar tunneling service

Use [ngrok](https://ngrok.com/) to expose your local Ollama instance:

```sh
ngrok http 11434
```

Then configure the {{< reuse "agw-docs/snippets/backend.md" >}} to use the ngrok URL:

```yaml
spec:
  ai:
    provider:
      openai:
        model: llama3.2
      host: abc123.ngrok.io
      port: 443
  policies:
    tls:
      sni: abc123.ngrok.io
```

{{< callout type="warning" >}}
**Security**: Free ngrok tunnels are publicly accessible. Use authentication or ngrok's paid tier with reserved domains and access controls for production use.
{{< /callout >}}

## Model management

### Switching models

To use a different model, pull it with Ollama and update the {{< reuse "agw-docs/snippets/backend.md" >}}:

```sh
# Pull a new model
ollama pull mistral

# Update the backend
kubectl patch {{< reuse "agw-docs/snippets/backend.md" >}} ollama \
  -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --type merge \
  -p '{"spec":{"ai":{"provider":{"openai":{"model":"mistral"}}}}}'
```

### Multiple models

To serve multiple Ollama models simultaneously, create separate {{< reuse "agw-docs/snippets/backend.md" >}} resources and HTTPRoutes:

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: ollama-llama
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: llama3.2
      host: ollama-external.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
      port: 11434
---
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: ollama-mistral
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: mistral
      host: ollama-external.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local
      port: 11434
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: ollama-llama
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /ollama/llama
    backendRefs:
    - name: ollama-llama
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      group: agentgateway.dev
      kind: {{< reuse "agw-docs/snippets/backend.md" >}}
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: ollama-mistral
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /ollama/mistral
    backendRefs:
    - name: ollama-mistral
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      group: agentgateway.dev
      kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

## Troubleshooting

### Connection refused errors

**What's happening:**

Requests fail with connection refused errors.

**Why it's happening:**

The Kubernetes cluster cannot reach the Ollama instance, possibly due to network configuration, firewall rules, or incorrect Endpoints.

**How to fix it:**

1. Verify Ollama is running and bound to the correct interface:
   ```sh
   curl http://<ollama-ip>:11434/v1/models
   ```

2. Check the Kubernetes Endpoints are correctly configured:
   ```sh
   kubectl get endpoints ollama-external -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

3. Verify network connectivity from a pod in your cluster:
   ```sh
   kubectl run -it --rm debug --image=curlimages/curl --restart=Never \
     -- curl http://<ollama-ip>:11434/v1/models
   ```

4. Check firewall rules on the Ollama machine allow traffic on port 11434 from Kubernetes cluster IPs.

### Model not found

**What's happening:**

Error message indicating the model is not available.

**Why it's happening:**

The requested model has not been pulled in Ollama.

**How to fix it:**

1. Verify the model is pulled in Ollama:

   ```sh
   ollama list
   ```

2. If not listed, pull it:

   ```sh
   ollama pull llama3.2
   ```

### Slow response times

**What's happening:**

Requests take longer than expected to complete.

**Why it's happening:**

Network latency, insufficient resources on the Ollama machine, or the model size exceeds available memory.

**How to fix it:**

1. Use a model variant with smaller memory requirements (e.g., `llama3.2:7b` instead of `llama3.2:70b`).
2. Increase resources on the Ollama machine.
3. Consider running Ollama on a machine closer to the cluster (same datacenter/VPC).

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
