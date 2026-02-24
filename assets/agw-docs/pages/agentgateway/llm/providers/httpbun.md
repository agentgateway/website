Install httpbun for a mock LLM API endpoint that is compatible with the OpenAI API for chat completions.

## Why httpbun?

[httpbun](https://httpbun.com) is the LLM-testing equivalent of httpbin. Testing AI gateway policies against a real LLM costs money, requires API keys, and introduces network latency. Instead, you can use httpbun as a drop-in OpenAI-compatible LLM backend in Kubernetes, then route traffic to it through agentgateway.

After you deploy httpbun, you can send standard `POST /v1/chat/completions` requests through agentgateway (including streaming), apply `AgentgatewayPolicy` resources for rate limiting and auth, and build out the rest of your AI gateway configuration without touching a real LLM.

The `/llm` endpoint implements the OpenAI chat completions API in the same request format, same response structure, and same streaming SSE protocol. You can customize the mock response content via an `httpbun` field in the request body, making it useful for testing both the happy path and error cases.

### Example OpenAI-compatible requests

```bash
# Non-streaming
curl -X POST httpbun.com/llm/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'

# Streaming
curl -N httpbun.com/llm/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}], "stream": true}'

# Custom response body
curl -X POST httpbun.com/llm/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [], "httpbun": {"content": "I am a mock LLM!"}}'
```

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}


## Step 1: Deploy httpbun in Kubernetes

httpbun ships as a single Docker image. The default bind port inside the container is `3090` when configured via environment variable.

```bash
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbun
  namespace: default
  labels:
    app: httpbun
spec:
  replicas: 1
  selector:
    matchLabels:
      app: httpbun
  template:
    metadata:
      labels:
        app: httpbun
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
  name: httpbun
  namespace: default
  labels:
    app: httpbun
spec:
  selector:
    app: httpbun
  ports:
    - protocol: TCP
      port: 3090
      targetPort: 3090
  type: ClusterIP
EOF
```

Verify the pod is running:

```bash
kubectl get pods -l app=httpbun
```

Expected output:

```
NAME                      READY   STATUS    RESTARTS   AGE
httpbun-7d9f6b8c4-v8w2p   1/1     Running   0          20s
```

## Step 2: Create the backend

Create an {{< reuse "agw-docs/snippets/backend.md" >}} to configure httpbun as an LLM provider. You set the `openai` provider type, because httpbun implements the OpenAI-compatible API. Then, override the host, port, and path to point at httpbun's `/llm/chat/completions` endpoint.

{{< callout type="info" >}}
**No API key needed**: httpbun accepts requests without authentication, so there is no `policies.auth` block in the following example. This also means that you don't need to manage a Kubernetes Secret: one less prerequisite to set up!
{{< /callout >}}

```bash
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: httpbun-llm
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: gpt-4
      host: httpbun.default.svc.cluster.local
      port: 3090
      path: "/llm/chat/completions"
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Field | Value | Description |
|-------|-------|-------------|
| `ai.provider.host` | `httpbun.default.svc.cluster.local` | Points to the in-cluster httpbun Service. Because the `host` is an in-cluster DNS name (not a public HTTPS endpoint), no TLS configuration is required.|
| `ai.provider.port` | `3090` | Matches the httpbun container port. |
| `ai.provider.path` | `/llm/chat/completions` | httpbun's LLM endpoint (not the default `/v1/chat/completions`). |

## Step 3: Create the HTTPRoute

Route incoming traffic from the gateway to the {{< reuse "agw-docs/snippets/backend.md" >}}. The route exposes the standard OpenAI-compatible path `/v1/chat/completions`, so any OpenAI SDK or client can point at the gateway without modification.

1. Create the HTTPRoute.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbun-llm
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /v1/chat/completions
         backendRefs:
           - name: httpbun-llm
             namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
             group: {{< reuse "agw-docs/snippets/group.md" >}}
             kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

2. Verify the route was accepted. Look for `Accepted: True` and `ResolvedRefs: True` in the status. If `ResolvedRefs` is `False`, double-check that the {{< reuse "agw-docs/snippets/backend.md" >}} name and namespace in the route match exactly what you created in Step 2.

   ```bash
   kubectl describe httproute httpbun-llm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

## Step 4: Verify the connection


{{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}
Get the external address of the gateway and save it in an environment variable.

```bash
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy \
  -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
echo $INGRESS_GW_ADDRESS
```
{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}
Port-forward the gateway proxy `http` pod on port 8080.

```bash
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
```
{{% /tab %}}
{{< /tabs >}}

### Non-streaming request

Send a standard chat completion request.

{{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}
```bash
curl -s http://$INGRESS_GW_ADDRESS/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Explain agentgateway in one sentence."}
    ]
  }' | jq
```
{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}
```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Explain agentgateway in one sentence."}
    ]
  }' | jq
```
{{% /tab %}}
{{< /tabs >}}

Example output:

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1748000000,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "This is a mock response from httpbun."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

### Streaming request

{{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}
```bash
curl -N http://$INGRESS_GW_ADDRESS/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Count to three."}
    ],
    "stream": true
  }'
```
{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}
```bash
curl -N http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Count to three."}
    ],
    "stream": true
  }'
```
{{% /tab %}}
{{< /tabs >}}

Notice the stream of `data:` chunks in server-sent event format, followed by `data: [DONE]`. This output matches the format of an OpenAI streaming response.

```
...

data: {"choices":[{"delta":{"content":"text."},"finish_reason":null,"index":0}],"created":1771885787,"id":"chatcmpl-e2e54892bd932edb9549b442","model":"gpt-4","object":"chat.completion.chunk"}

data: {"choices":[{"delta":{},"finish_reason":"stop","index":0}],"created":1771885787,"id":"chatcmpl-e2e54892bd932edb9549b442","model":"gpt-4","object":"chat.completion.chunk"}

data: [DONE]
```

### Custom response content

Control exactly what the mock LLM returns by including the `httpbun` field in the request body. This is useful for writing deterministic integration tests against policies. You control the response, so you can verify that your gateway transforms, rate limits, or rejects it correctly.

{{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}
```bash
curl -s http://$INGRESS_GW_ADDRESS/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}],
    "httpbun": {"content": "Gateway is working perfectly."}
  }' | jq '.choices[0].message.content'
# "Gateway is working perfectly."
```
{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}
```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}],
    "httpbun": {"content": "Gateway is working perfectly."}
  }' | jq '.choices[0].message.content'
# "Gateway is working perfectly."
```
{{% /tab %}}
{{< /tabs >}}

Example output:

```
"Gateway is working perfectly."
```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```bash
kubectl delete httproute httpbun-llm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} httpbun-llm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete deployment httpbun -n default
kubectl delete service httpbun -n default
```
