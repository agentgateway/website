---
title: Braintrust
weight: 25
description: Export agentgateway LLM traces to Braintrust over OTLP/HTTP.
test: skip
---

[Braintrust](https://www.braintrust.dev/) is an LLM observability and evaluation platform that accepts OpenTelemetry traces. An agentgateway proxy running in Kubernetes can export LLM traces directly to Braintrust over OTLP/HTTP, including model, token usage, latency, and optional prompt and response content.

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/quickstart/install/" >}}) in your Kubernetes cluster.
2. [Set up an agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
3. Set up an [LLM provider]({{< link-hextra path="/llm/providers/" >}}) and route in agentgateway.
4. Create a Braintrust account, a project, and an API key that can write to that project.
5. Install `kubectl` and `curl`.

## Prepare Braintrust credentials

1. Open the [Braintrust dashboard](https://www.braintrust.dev/app/~/logs), create or select a project, and copy its project ID or exact project name.
2. Create an API key from the Braintrust organization settings. Keep the key private and grant only the access needed to write traces.
3. Set the credentials in your shell. Do not commit them to source control.

   ```sh
   export BRAINTRUST_API_KEY="<your-api-key>"
   export BRAINTRUST_PARENT="project_name:<your-project-name>"
   ```

   Use `project_id:<your-project-id>` instead when you prefer to address the project by ID. The `x-bt-parent` header determines where Braintrust stores the trace.

4. Create a Kubernetes Secret in the same namespace as the agentgateway proxy. The `api-key` value includes the required `Bearer` prefix.

   ```sh
   kubectl create secret generic braintrust-credentials \
     -n agentgateway-system \
     --from-literal=api-key="Bearer ${BRAINTRUST_API_KEY}" \
     --from-literal=parent="${BRAINTRUST_PARENT}" \
     --dry-run=client -o yaml | kubectl apply -f-
   ```

## Choose a Braintrust data plane

Use the API host for your Braintrust organization. The tracing policy below sets the signal-specific OTLP path.

| Data plane | API host |
|------------|----------|
| US hosted | `api.braintrust.dev` |
| EU hosted | `api-eu.braintrust.dev` |
| Self-hosted | Your Braintrust API host |

For a self-hosted deployment, replace `spec.static.host` with the Universal API host for that data plane. Braintrust's base OTLP endpoint is `/otel`; the policy uses `/otel/v1/traces` for traces.

## Configure trace export

Create an `AgentgatewayBackend` that enables TLS and reads the Braintrust headers from the Secret. Then attach an `AgentgatewayPolicy` to the Gateway that serves your LLM route.

```sh
kubectl apply -f- <<'EOF'
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: braintrust-otlp
  namespace: agentgateway-system
spec:
  static:
    host: api.braintrust.dev
    port: 443
  policies:
    tls: {}
    auth:
      credentials:
      - location:
          header:
            name: Authorization
        secretRef:
          name: braintrust-credentials
          key: api-key
      - location:
          header:
            name: x-bt-parent
        secretRef:
          name: braintrust-credentials
          key: parent
---
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: braintrust-tracing
  namespace: agentgateway-system
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    tracing:
      backendRef:
        group: agentgateway.dev
        kind: AgentgatewayBackend
        name: braintrust-otlp
        port: 443
      protocol: HTTP
      path: /otel/v1/traces
      randomSampling: "true"
      clientSampling: "true"
      resources:
      - name: service.name
        expression: '"agentgateway"'
EOF
```

Replace `api.braintrust.dev` with `api-eu.braintrust.dev` for the EU data plane.

Agentgateway emits standard `gen_ai.*` span attributes for LLM operation, provider, model, and token usage. Braintrust maps these attributes to the corresponding fields in a trace.

### Capture prompt and response content

Prompt and response bodies can contain sensitive data. Add the following `attributes` block only when your data handling policy allows Braintrust to store message content.

```yaml
spec:
  frontend:
    tracing:
      attributes:
        add:
        - name: llm.input_messages
          expression: 'flattenRecursive(llm.prompt.map(c, {"message": c}))'
        - name: llm.output_messages
          expression: 'flattenRecursive(llm.completion.map(c, {"role": "assistant", "content": c}))'
```

Referencing `llm.prompt` or `llm.completion` makes agentgateway inspect request and response bodies. Omit this block when you need metadata and token counts without message content.

## Verify the integration

1. Confirm that Kubernetes accepted the backend and attached the policy to the Gateway.

   ```sh
   kubectl get agentgatewaybackend braintrust-otlp -n agentgateway-system
   kubectl get agentgatewaypolicy braintrust-tracing -n agentgateway-system
   ```

   The backend should report `Accepted=True`; the policy should report both `Accepted=True` and `Attached=True` in its status.

2. If you run a local cluster, port-forward the agentgateway proxy.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n agentgateway-system 8080:80
   ```

3. Send an LLM request through the proxy. The example assumes an OpenAI-compatible provider and a listener on port `8080`.

   ```sh
   curl http://localhost:8080/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {"role": "user", "content": "Reply with exactly: Braintrust tracing works"}
       ]
     }'
   ```

4. Copy the `trace.id` value from the proxy log.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n agentgateway-system \
     | grep 'protocol=llm' \
     | tail -1
   ```

5. Open the [Braintrust Logs view](https://www.braintrust.dev/app/~/logs), select the project named by `BRAINTRUST_PARENT`, and wait a few seconds for batched export. Open the new root trace and verify the model, provider, token usage, latency, and trace ID. If you enabled the optional attributes, verify that input and output messages appear in the structured fields.

Braintrust's Logs view shows root spans. Export the root span for each request; sending only child spans does not create a row in the Logs view.

## Troubleshoot trace export

- A `403` response usually means the API key cannot write to the project selected by `x-bt-parent`. Check the key scope and the exact project name or ID.
- If no traces appear, confirm that the host matches your organization's data plane and that the policy path is `/otel/v1/traces`.
- Set `randomSampling: "true"` while testing. The default is to start no new traces when the request has no incoming trace context.
- Check the backend and policy `Accepted` and `Attached` conditions, then inspect proxy logs for OpenTelemetry exporter errors.
- Keep prompt and response attributes disabled when the request body contains data that should not leave the proxy.
- Braintrust limits a single OTLP traces request to 10 MB. Omit message content or reduce the exporter batch size if the exporter reports HTTP `413`.

For more information, see the [Braintrust OpenTelemetry integration](https://www.braintrust.dev/docs/integrations/sdk-integrations/opentelemetry) and [Kubernetes tracing]({{< link-hextra path="/observability/tracing/" >}}).
