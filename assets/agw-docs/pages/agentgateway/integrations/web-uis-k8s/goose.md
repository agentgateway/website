Route [Goose](https://github.com/block/goose) LLM traffic through agentgateway running in Kubernetes to centralize credentials and capture audit logs for every agent call.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

2. [Install Goose](https://github.com/block/goose/releases/latest) — download the CLI binary for your platform from the latest release.

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

3. Create an AgentgatewayBackend for OpenAI.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
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
           group: agentgateway.dev
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

## Configure Goose

Point Goose at the agentgateway ingress address using environment variables. `GOOSE_MODEL` must be set; Goose will not start without a model configured.

{{< tabs items="LoadBalancer,Port-forward" >}}

{{% tab tabName="LoadBalancer" %}}
```bash
export GOOSE_PROVIDER=openai
export GOOSE_MODEL=gpt-4o
export OPENAI_HOST=http://$INGRESS_GW_ADDRESS
export OPENAI_API_KEY=placeholder
```
{{% /tab %}}

{{% tab tabName="Port-forward" %}}
```bash
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80 &

export GOOSE_PROVIDER=openai
export GOOSE_MODEL=gpt-4o
export OPENAI_HOST=http://localhost:8080
export OPENAI_API_KEY=placeholder
```
{{% /tab %}}

{{< /tabs >}}

`OPENAI_API_KEY` must be set for Goose to start, but it is not used to call OpenAI — agentgateway holds the real key.

## Verify the connection

Send a one-shot prompt to confirm requests flow through agentgateway.

```bash
goose run --text "say hello"
```

Then check the agentgateway proxy logs.

```bash
kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
```

## Next steps

{{< cards >}}
  {{< card path="/llm/spending/" title="Control spending" subtitle="Apply rate limits to LLM and tool traffic." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs." >}}
{{< /cards >}}
