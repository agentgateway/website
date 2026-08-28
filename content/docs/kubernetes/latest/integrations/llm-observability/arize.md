---
title: Arize AX
weight: 5
description: Export agentgateway LLM traces to Arize AX over OTLP/HTTP or OTLP/gRPC.
test: skip
---

[Arize AX](https://arize.com/docs/ax) is an AI observability platform that accepts OpenTelemetry traces and displays LLM inputs, outputs, models, and token usage. Agentgateway can export directly to Arize AX over OTLP/HTTP or OTLP/gRPC without a separate OpenTelemetry Collector.

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/quickstart/install/" >}}) in your Kubernetes cluster.
2. [Set up an agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
3. Set up an [LLM provider]({{< link-hextra path="/llm/providers/" >}}) and route in agentgateway.
4. **Arize account**: Sign up for an [Arize account](https://app.arize.com/auth/join).
5. **Arize API key and Space ID**: Obtain an API key and Space ID from the Arize platform.

## Get your Arize API key and Space ID

1. Log in to the [Arize dashboard](https://app.arize.com/).
2. Go to **Settings** > **API Keys** > **Service Keys**, and click **New Service Key**.
3. For **Account Role**, select **Member**. Add an organization, and then add the spaces that the service key can access.
4. Create the service key and copy the API service key, such as `ak-5245b124-1ef5-5514-...`.
5. Copy the base64 Space ID for the space that receives the traces, such as `U3BhY2U6TbN4WkU6wshdaf==`. The Space ID is different from the space name and organization ID.
6. Save the credentials in environment variables. Do not commit these values to source control.
   ```sh
   export ARIZE_API_KEY="<your-api-key>"
   export ARIZE_SPACE_ID="<your-space-id>"
   ```
7. Create a Kubernetes Secret in the same namespace as the agentgateway proxy.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: arize-credentials
     namespace: agentgateway-system
   type: Opaque
   stringData:
     api-key: "${ARIZE_API_KEY}"
     space-id: "${ARIZE_SPACE_ID}"
   EOF
   ```

Agentgateway reads the API key and Space ID from the Secret and sends them as request headers to Arize AX.

## Choose an Arize endpoint

Use the collector host for your Arize AX region.

| Region | Collector host |
|--------|----------------|
| US | `otlp.arize.com` |
| US regional | `otlp.us-central-1a.arize.com` |
| EU | `otlp.eu-west-1a.arize.com` |
| Canada | `otlp.ca-central-1a.arize.com` |

The following examples use the US collector. Replace `spec.static.host` with the collector host for your region.

## Configure trace export

Choose either OTLP/HTTP or OTLP/gRPC. Each option creates the following resources.

- An `AgentgatewayBackend` that connects to Arize AX over TLS and reads the authentication headers from the `arize-credentials` Secret.
- An `AgentgatewayPolicy` that exports traces from the `agentgateway-proxy` Gateway and maps agentgateway LLM fields to OpenInference attributes.

The authentication header names differ by protocol.

{{< tabs >}}
{{% tab name="OTLP/HTTP" %}}

For OTLP/HTTP, use the `arize-api-key` and `arize-space-id` headers.

```yaml
kubectl apply -f- <<'EOF'
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: arize-otlp
  namespace: agentgateway-system
spec:
  static:
    host: otlp.arize.com
    port: 443
  policies:
    tls: {}
    auth:
      credentials:
      - location:
          header:
            name: arize-api-key
        secretRef:
          name: arize-credentials
          key: api-key
      - location:
          header:
            name: arize-space-id
        secretRef:
          name: arize-credentials
          key: space-id
---
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: arize-tracing
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
        name: arize-otlp
        port: 443
      protocol: HTTP
      randomSampling: "true"
      clientSampling: "true"
      resources:
      - name: service.name
        expression: '"agentgateway"'
      - name: openinference.project.name
        expression: '"agentgateway"'
      attributes:
        add:
        - name: span.name
          expression: '"openai.chat"'
        - name: openinference.span.kind
          expression: '"LLM"'
        - name: llm.system
          expression: llm.provider
        - name: llm.model_name
          expression: coalesce(llm.responseModel, llm.requestModel)
        - name: llm.input_messages
          expression: 'flattenRecursive(llm.prompt.map(c, {"message": c}))'
        - name: llm.output_messages
          expression: 'flattenRecursive(llm.completion.map(c, {"role": "assistant", "content": c}))'
        - name: llm.token_count.prompt
          expression: llm.inputTokens
        - name: llm.token_count.completion
          expression: llm.outputTokens
        - name: llm.token_count.total
          expression: llm.totalTokens
EOF
```

{{% /tab %}}
{{% tab name="OTLP/gRPC" %}}

For OTLP/gRPC, use the `api_key` and `space_id` metadata headers.

```yaml
kubectl apply -f- <<'EOF'
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: arize-otlp
  namespace: agentgateway-system
spec:
  static:
    host: otlp.arize.com
    port: 443
  policies:
    tls: {}
    auth:
      credentials:
      - location:
          header:
            name: api_key
        secretRef:
          name: arize-credentials
          key: api-key
      - location:
          header:
            name: space_id
        secretRef:
          name: arize-credentials
          key: space-id
---
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: arize-tracing
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
        name: arize-otlp
        port: 443
      protocol: GRPC
      randomSampling: "true"
      clientSampling: "true"
      resources:
      - name: service.name
        expression: '"agentgateway"'
      - name: openinference.project.name
        expression: '"agentgateway"'
      attributes:
        add:
        - name: span.name
          expression: '"openai.chat"'
        - name: openinference.span.kind
          expression: '"LLM"'
        - name: llm.system
          expression: llm.provider
        - name: llm.model_name
          expression: coalesce(llm.responseModel, llm.requestModel)
        - name: llm.input_messages
          expression: 'flattenRecursive(llm.prompt.map(c, {"message": c}))'
        - name: llm.output_messages
          expression: 'flattenRecursive(llm.completion.map(c, {"role": "assistant", "content": c}))'
        - name: llm.token_count.prompt
          expression: llm.inputTokens
        - name: llm.token_count.completion
          expression: llm.outputTokens
        - name: llm.token_count.total
          expression: llm.totalTokens
EOF
```

{{% /tab %}}
{{< /tabs >}}

The values under `resources` and `attributes` are CEL expressions. The extra quotes around static values, such as `'"agentgateway"'`, make the CEL expression evaluate to a string.

Change `openinference.project.name` if you want traces to appear in a different Arize project. Arize creates the project when it receives the first trace.

## Optional: Add resource attributes

Agentgateway supports custom OpenTelemetry resource attributes through `spec.frontend.tracing.resources`. Resource attributes are added to every exported span and can help you filter and group traces in Arize AX.

Add attributes such as `model_id`, `model_version`, or `deployment.environment.name` to the `resources` list in the `AgentgatewayPolicy` for your selected transport.

```yaml
spec:
  frontend:
    tracing:
      resources:
      - name: service.name
        expression: '"agentgateway"'
      - name: openinference.project.name
        expression: '"agentgateway"'
      - name: model_id
        expression: '"gpt-4o-production"'
      - name: model_version
        expression: '"2026-08-27"'
      - name: deployment.environment.name
        expression: '"production"'
```

Resource values are static CEL expressions that are initialized with the tracer and apply to every request. If agentgateway routes requests to multiple models, use the `llm.model_name` span attribute from the main configuration to record the model for each request instead of setting a single `model_id` resource value.

For more information, see [Add span and resource attributes]({{< link-hextra path="/observability/tracing/#set-up-tracing" >}}).

## Verify the integration

1. Verify that Kubernetes accepted the backend and attached the policy to the Gateway.
   ```sh
   kubectl get agentgatewaybackend arize-otlp -n agentgateway-system
   kubectl get agentgatewaypolicy arize-tracing -n agentgateway-system
   ```

   Both resources should report `ACCEPTED=True`, and the policy should also report `ATTACHED=True`.

2. If you run a local cluster such as Kind, port-forward the agentgateway proxy.
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n agentgateway-system 8080:80
   ```
3. In a separate terminal, send an LLM request through agentgateway. The following example assumes that the proxy is available on local port `8080` and has an OpenAI-compatible provider and the `gpt-3.5-turbo` model configured.
   ```sh
   curl http://localhost:8080/v1/chat/completions \
     -H 'content-type: application/json' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Reply with exactly: Arize tracing works"
         }
       ]
     }'
   ```
4. Find the request in the agentgateway proxy logs and copy its `trace.id` value.
   ```sh
   kubectl logs deployment/agentgateway-proxy -n agentgateway-system \
     | grep 'protocol=llm' \
     | tail -1
   ```
5. In Arize AX, open **Tracing Projects**, select the project from `openinference.project.name`, and search for the trace ID. Trace export is batched, so allow several seconds for the trace to appear.

{{< reuse-image src="img/arize-ax-agentgateway-trace.png" srcDark="img/arize-ax-agentgateway-trace.png" alt="Arize AX showing an agentgateway openai.chat trace with its input, output, latency, cost, and token count" caption="An agentgateway LLM trace in Arize AX." >}}

## Troubleshoot trace export

- Use the header names that correspond to your selected protocol: hyphenated headers for OTLP/HTTP and underscore headers for OTLP/gRPC.
- Confirm that the `arize-credentials` Secret is in the same namespace as the `arize-otlp` backend and contains the `api-key` and `space-id` keys.
- Confirm that the collector host matches your Arize region and that `openinference.project.name` is set.
- Check the `ACCEPTED` and `ATTACHED` status columns for the backend and policy.
- Set `randomSampling: "true"` while testing so that agentgateway starts a trace for every request.
- Check the proxy logs for OpenTelemetry exporter errors.
  ```sh
  kubectl logs deployment/agentgateway-proxy -n agentgateway-system \
    | grep -i opentelemetry
  ```

For more information about Arize authentication and OpenTelemetry export, see the [Arize AX manual instrumentation documentation](https://arize.com/docs/ax/instrument/manual-instrumentation).
