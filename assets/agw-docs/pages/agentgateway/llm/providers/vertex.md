Configure [Vertex AI](https://cloud.google.com/vertex-ai) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

## Before you begin

Set up an [agentgateway proxy]({{< link-hextra path="/setup" >}}). 

## Set up access to Vertex AI

1. [Set up authentication for Vertex AI](https://docs.cloud.google.com/vertex-ai/docs/authentication). Make sure to have your:
   
   - Google Cloud Project ID
   - Project location, such as `us-central1`
   - API key or service account credentials

2. Save your Vertex AI API key as an environment variable.
   
   ```sh
   export VERTEX_AI_API_KEY=<insert your API key>
   ```

3. Create a Kubernetes secret to store your Vertex AI API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: vertex-ai-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $VERTEX_AI_API_KEY
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource to configure an LLM provider that references the AI API key secret.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: vertex-ai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         vertexai:
           model: gemini-pro
           projectId: "my-gcp-project"
           region: "us-central1"
     policies:
       auth:
         secretRef:
           name: vertex-ai-secret
   EOF
   ```
5. Create an HTTPRoute resource that routes incoming traffic to the {{< reuse "docs/snippets/backend.md" >}}. The following example sets up a route on the `/vertex` path. Note that {{< reuse "docs/snippets/kgateway.md" >}} automatically rewrites the endpoint to the appropriate chat completion endpoint of the LLM provider for you, based on the LLM provider that you set up in the {{< reuse "docs/snippets/backend.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: vertex-ai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /vertex
       backendRefs:
       - name: vertex-ai
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```
   

6. Send a request to the LLM provider API. Verify that the request succeeds and that you get back a response from the API.
   
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/vertex" -H content-type:application/json  -d '{
      "model": "",
      "messages": [
        {
          "role": "user",
          "content": "Write me a short poem about Kubernetes and clouds."
        }
      ]
    }' | jq
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/vertex" -H content-type:application/json  -d '{
      "model": "",
      "messages": [
        {
          "role": "user",
          "content": "Write me a short poem about Kubernetes and clouds."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```json
   {
     "id": "chatcmpl-vertex-12345",
     "object": "chat.completion",
     "created": 1727967462,
     "model": "gemini-pro",
     "choices": [
       {
         "index": 0,
         "message": {
           "role": "assistant",
           "content": "In the cloud, Kubernetes reigns,\nOrchestrating pods with great care,\nContainers float like clouds,\nScaling up and down,\nAutomation everywhere."
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 12,
       "completion_tokens": 28,
       "total_tokens": 40
     }
   }
   ```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
