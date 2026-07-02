Route [Goose](https://github.com/aaif-goose/goose) LLM traffic through agentgateway running in Kubernetes to centralize credentials and capture audit logs for every agent call.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Install Goose

Install Goose by following the [Goose installation guide](https://goose-docs.ai/docs/getting-started/installation/).

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Set up the OpenAI backend

1. Export your OpenAI API key.

   ```bash
   export OPENAI_API_KEY="sk-your-key-here"
   ```

2. Create a Kubernetes Secret for your API key.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: openai-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $OPENAI_API_KEY
   EOF
   ```

3. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for OpenAI.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: openai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai: {}
     policies:
       auth:
         secretRef:
           name: openai-secret
   EOF
   ```

4. Create an HTTPRoute to forward traffic to the backend.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: openai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - matches:
         - path:
             type: PathPrefix
             value: /
         backendRefs:
         - name: openai
           namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
           group: {{< reuse "agw-docs/snippets/group.md" >}}
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

## Configure Goose

Point Goose at the agentgateway ingress address using environment variables.

{{< tabs >}}

{{% tab name="LoadBalancer" %}}
```bash
export GOOSE_PROVIDER=openai
export GOOSE_MODEL=gpt-4o
export OPENAI_HOST=http://$INGRESS_GW_ADDRESS
export OPENAI_API_KEY=placeholder
```
{{% /tab %}}

{{% tab name="Port-forward" %}}
```bash
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80 &

export GOOSE_PROVIDER=openai
export GOOSE_MODEL=gpt-4o
export OPENAI_HOST=http://localhost:8080
export OPENAI_API_KEY=placeholder
```
{{% /tab %}}

{{< /tabs >}}

The following table describes each environment variable:

| Variable | Description |
|---|---|
| `GOOSE_PROVIDER` | The LLM provider Goose uses. Set to `openai` so Goose speaks the OpenAI-compatible API. |
| `GOOSE_MODEL` | The model to use. Must be set — Goose will not start without a model configured. |
| `OPENAI_HOST` | The base URL of the agentgateway proxy. |
| `OPENAI_API_KEY` | Must be non-empty for Goose to start, but it is not used to call OpenAI — agentgateway holds the real key. |

## Verify the connection

1. Send a one-shot prompt to confirm requests flow through agentgateway.

   ```bash
   goose run --text "say hello"
   ```

2. Check the agentgateway proxy logs to confirm the request was routed through the gateway.

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
   ```

   You should see a log entry showing the request was forwarded to the OpenAI endpoint with the configured model:

   ```
   info  request gateway=agentgateway-system/agentgateway-proxy listener=http route=agentgateway-system/openai endpoint=api.openai.com:443 http.method=POST http.path=/v1/chat/completions http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-4o gen_ai.usage.input_tokens=4569 gen_ai.usage.output_tokens=10 duration=2242ms
   ```

## Next steps

{{< cards >}}
  {{< card path="/llm/budget-limits/" title="Control spending" subtitle="Apply rate limits to LLM and tool traffic." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs." >}}
{{< /cards >}}
