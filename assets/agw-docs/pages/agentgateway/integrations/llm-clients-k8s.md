# LLM Client Configuration for Kubernetes

Configure AI coding tools and applications to use agentgateway running in Kubernetes.

## Overview

When agentgateway is deployed in Kubernetes, clients connect to the Gateway's ingress or service endpoint. This guide shows how to get your gateway URL and configure popular AI tools to use it.

## Get your gateway URL

Before configuring clients, you need to determine your agentgateway endpoint URL.

### Option 1: Load Balancer (Cloud deployments)

If you deployed agentgateway with a LoadBalancer service, get the external IP:

```sh
export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway agentgateway-proxy \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Gateway URL: http://$INGRESS_GW_ADDRESS"
```

For cloud providers that use hostname instead of IP:

```sh
export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway agentgateway-proxy \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Gateway URL: http://$INGRESS_GW_ADDRESS"
```

### Option 2: Port-forward (Local testing)

For local development or testing:

```sh
kubectl port-forward -n agentgateway svc/agentgateway-proxy 8080:80
```

Gateway URL: `http://localhost:8080`

### Option 3: Ingress (Production)

If using an Ingress controller with a custom domain:

```sh
kubectl get ingress -n agentgateway agentgateway-ingress -o jsonpath='{.spec.rules[0].host}'
```

Gateway URL: `https://gateway.example.com` (or your configured domain)

## Configure clients

Once you have your gateway URL, configure your AI clients. The base URL for OpenAI-compatible endpoints is:

**Format**: `<GATEWAY_URL>/<ROUTE_PATH>`

Where `<ROUTE_PATH>` is the path you configured in your HTTPRoute resource (e.g., `/openai`, `/anthropic`, `/ollama`).

### Cursor

1. Open Cursor Settings → Models.
2. Add custom model:
   - **API Base URL**: `http://$INGRESS_GW_ADDRESS/openai` (replace with your route path).
   - **API Key**: Gateway API key if auth is configured, or `anything`.
   - **Model Name**: Model from your AIBackend (e.g., `gpt-4o-mini`).

Or via settings JSON:

```json
{
  "cursor.models": [
    {
      "name": "k8s-gateway",
      "apiBase": "http://your-gateway-ip/openai",
      "apiKey": "anything",
      "model": "gpt-4o-mini"
    }
  ]
}
```

### VS Code Continue

Edit `~/.continue/config.json`:

```json
{
  "models": [
    {
      "title": "Kubernetes Gateway",
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiBase": "http://your-gateway-ip/openai",
      "apiKey": "anything"
    }
  ]
}
```

### OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://your-gateway-ip/openai",  # Your Gateway URL + route path
    api_key="anything",  # Or your gateway API key
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello from Kubernetes!"}]
)

print(response.choices[0].message.content)
```

### OpenAI SDK (Node.js)

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://your-gateway-ip/openai",  // Your Gateway URL + route path
  apiKey: "anything",  // Or your gateway API key
});

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello from Kubernetes!" }]
});

console.log(response.choices[0].message.content);
```

### curl

```bash
curl "http://your-gateway-ip/openai" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello from Kubernetes!"}
    ]
  }' | jq
```

## Authentication

If you configured authentication policies on your Gateway:

### API Key authentication

Include the API key in requests:

```bash
# curl
curl "http://your-gateway-ip/openai" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model": "gpt-4o-mini", "messages": [...]}'
```

```python
# Python SDK
client = OpenAI(
    base_url="http://your-gateway-ip/openai",
    api_key="YOUR_API_KEY"
)
```

### JWT authentication

If using JWT tokens, include them in the Authorization header:

```bash
curl "http://your-gateway-ip/openai" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"model": "gpt-4o-mini", "messages": [...]}'
```

## TLS/HTTPS

For production deployments with TLS:

1. Configure an Ingress with TLS:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agentgateway-ingress
  namespace: agentgateway
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - gateway.example.com
    secretName: agentgateway-tls
  rules:
  - host: gateway.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: agentgateway-proxy
            port:
              number: 80
```

2. Update client URLs to use HTTPS:

```python
client = OpenAI(
    base_url="https://gateway.example.com/openai",
    api_key="YOUR_API_KEY"
)
```

## Network considerations

### Same cluster

If your client application runs in the same Kubernetes cluster, use the internal Service DNS name:

```python
client = OpenAI(
    base_url="http://agentgateway-proxy.agentgateway.svc.cluster.local/openai",
    api_key="anything"
)
```

### Network policies

If using Network Policies, ensure they allow traffic from client pods/machines to the agentgateway namespace:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-gateway-traffic
  namespace: agentgateway
spec:
  podSelector:
    matchLabels:
      app: agentgateway
  ingress:
  - from:
    - namespaceSelector: {}  # Allow from all namespaces
    ports:
    - protocol: TCP
      port: 80
```

## Troubleshooting

### Cannot connect to gateway

**What's happening:**

Client applications cannot reach the agentgateway endpoint.

**Why it's happening:**

The gateway service may not be running, the LoadBalancer IP may not be assigned, or there are network connectivity issues.

**How to fix it:**

1. Verify the gateway service is running:
   ```sh
   kubectl get svc -n agentgateway agentgateway-proxy
   ```

2. Check LoadBalancer has external IP assigned:
   ```sh
   kubectl get svc -n agentgateway agentgateway-proxy -w
   ```

3. Test connectivity from local machine:
   ```sh
   curl http://$INGRESS_GW_ADDRESS/openai -v
   ```

### 404 Not Found

**What's happening:**

Requests return a 404 Not Found error.

**Why it's happening:**

Route path doesn't match HTTPRoute configuration.

**How to fix it:**

1. Verify your HTTPRoute paths:

   ```sh
   kubectl get httproute -n agentgateway -o yaml | grep -A 5 "path:"
   ```

2. Ensure client URL matches the route path (e.g., `/openai`, not `/v1/chat/completions`).

### Connection timeout

**What's happening:**

Requests time out without receiving a response.

**Why it's happening:**

Gateway pods may not be ready, network policies may be blocking traffic, or cloud provider firewall rules may be preventing access.

**How to fix it:**

1. Check pod status:
   ```sh
   kubectl get pods -n agentgateway
   ```

2. Check pod logs:
   ```sh
   kubectl logs -n agentgateway -l app=agentgateway --tail=100
   ```

3. Describe service for events:
   ```sh
   kubectl describe svc -n agentgateway agentgateway-proxy
   ```

## Example: Complete setup

Here's a complete example setting up OpenAI access through agentgateway in Kubernetes:

1. Create the backend and route:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: openai-secret
  namespace: agentgateway
stringData:
  Authorization: $OPENAI_API_KEY
---
apiVersion: agentgateway.dev/v1alpha1
kind: AIBackend
metadata:
  name: openai
  namespace: agentgateway
spec:
  ai:
    provider:
      openai:
        model: gpt-4o-mini
  policies:
    auth:
      secretRef:
        name: openai-secret
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: agentgateway
spec:
  parentRefs:
  - name: agentgateway-proxy
    namespace: agentgateway
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /openai
    backendRefs:
    - name: openai
      namespace: agentgateway
      group: agentgateway.dev
      kind: AIBackend
```

2. Get gateway URL:

```sh
export GATEWAY_URL=$(kubectl get svc -n agentgateway agentgateway-proxy \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
```

3. Configure client:

```python
from openai import OpenAI

client = OpenAI(
    base_url=f"http://{GATEWAY_URL}/openai",
    api_key="anything"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Related documentation

- [Gateway API HTTPRoute](https://gateway-api.sigs.k8s.io/api-types/httproute/).
- [Kubernetes Services](https://kubernetes.io/docs/concepts/services-networking/service/).
- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/).
