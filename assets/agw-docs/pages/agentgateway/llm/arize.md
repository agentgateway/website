[Arize AX](https://arize.com/docs/ax) is an AI observability platform that accepts OpenTelemetry traces and displays LLM operations, models, and token usage. Agentgateway can export directly to Arize AX over OTLP/HTTP or OTLP/gRPC without a separate OpenTelemetry Collector. You can optionally export LLM inputs and outputs.

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/documentation/quickstart/install/" >}}) in your Kubernetes cluster.
2. [Set up an agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
3. Set up an [LLM provider]({{< link-hextra path="/documentation/llm/providers/" >}}) and route in agentgateway.
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
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
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

Save the collector host for your region in an environment variable. The following examples use the US collector.

```sh
export ARIZE_HOST="otlp.arize.com"
```

## Configure trace export

Choose either OTLP/HTTP or OTLP/gRPC. Each option creates the following resources.

- An `{{< reuse "agw-docs/snippets/backend.md" >}}` that connects to Arize AX over TLS and reads the authentication headers from the `arize-credentials` Secret.
- An `{{< reuse "agw-docs/snippets/policy.md" >}}` that exports sampled LLM traces from the `agentgateway-proxy` Gateway.

The authentication header names differ by protocol.

{{< tabs >}}
{{% tab name="OTLP/HTTP" %}}

For OTLP/HTTP, use the `arize-api-key` and `arize-space-id` headers.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: arize-otlp
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  static:
    host: ${ARIZE_HOST}
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
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: arize-tracing
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    tracing:
      backendRef:
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
        name: arize-otlp
        port: 443
      protocol: HTTP
      randomSampling: "0.1"
      clientSampling: "true"
      filter: 'has(llm)'
      resources:
      - name: openinference.project.name
        expression: '"agentgateway"'
      - name: deployment.environment.name
        expression: '"production"'
EOF
```

{{% /tab %}}
{{% tab name="OTLP/gRPC" %}}

For OTLP/gRPC, use the `api_key` and `space_id` metadata headers.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: arize-otlp
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  static:
    host: ${ARIZE_HOST}
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
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: arize-tracing
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    tracing:
      backendRef:
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
        name: arize-otlp
        port: 443
      protocol: GRPC
      randomSampling: "0.1"
      clientSampling: "true"
      filter: 'has(llm)'
      resources:
      - name: openinference.project.name
        expression: '"agentgateway"'
      - name: deployment.environment.name
        expression: '"production"'
EOF
```

{{% /tab %}}
{{< /tabs >}}

The values under `resources` are CEL expressions. The extra quotes around static values, such as `'"agentgateway"'`, make the CEL expression evaluate to a string.

Change `openinference.project.name` if you want traces to appear in a different Arize project. Arize creates the project when it receives the first trace.

Agentgateway emits model, provider, operation, and token usage attributes that follow the OpenTelemetry GenAI semantic conventions. Arize AX [natively maps these attributes](https://arize.com/blog/arize-ax-opentelemetry-genai-semantic-conventions/) to OpenInference fields.

## Optional: Export LLM inputs and outputs

The default configuration does not export prompt or response content. To display structured input and output messages in Arize AX, add the following attributes to the `{{< reuse "agw-docs/snippets/policy.md" >}}` for your selected transport.

> [!IMPORTANT]
> LLM prompts and responses can contain personally identifiable information (PII), credentials, or other sensitive data. Enabling these attributes sends that content to a third-party SaaS platform. Review your organization's data-handling requirements and configure appropriate guardrails or redaction before enabling them.

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

## Optional: Add resource attributes

Agentgateway supports custom OpenTelemetry resource attributes through `spec.frontend.tracing.resources`. Resource attributes are added to every exported span and can help you filter and group traces in Arize AX.

In Kubernetes mode, agentgateway automatically sets `service.name`, `service.version`, `service.instance.id`, and `service.namespace`. The preceding OTLP/HTTP and OTLP/gRPC configurations explicitly set `deployment.environment.name`. You can add application-specific attributes such as `model_id` or `model_version` to the `resources` list in the `{{< reuse "agw-docs/snippets/policy.md" >}}` for your selected transport.

```yaml
spec:
  frontend:
    tracing:
      resources:
      - name: openinference.project.name
        expression: '"agentgateway"'
      - name: deployment.environment.name
        expression: '"production"'
      - name: model_id
        expression: '"gpt-4o-production"'
      - name: model_version
        expression: '"2026-08-27"'
```

Resource values are static CEL expressions that are initialized with the tracer and apply to every request. Do not set a static `service.instance.id`, which must identify a unique agentgateway replica. If agentgateway routes requests to multiple models, use the default `gen_ai.request.model` and `gen_ai.response.model` span attributes instead of setting a single `model_id` resource value.

For more information, see [Add span and resource attributes]({{< link-hextra path="/documentation/observability/traces/setup/#add-attributes" >}}).

## Get the gateway address

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Verify the integration

1. Verify that Kubernetes accepted the backend and attached the policy to the Gateway.
   ```sh
   kubectl get agentgatewaybackend arize-otlp \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} arize-tracing \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Both resources should report `ACCEPTED=True`, and the policy should also report `ATTACHED=True`.

2. Send an LLM request through agentgateway. The following example assumes that you configured an OpenAI-compatible provider and the `gpt-3.5-turbo` model.
   ```sh
   curl http://$INGRESS_GW_ADDRESS/v1/chat/completions \
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
3. Find the request in the agentgateway proxy logs and copy its `trace.id` value.
   ```sh
   kubectl logs deployment/agentgateway-proxy \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     | grep 'protocol=llm' \
     | tail -1
   ```

   A successful request produces a log entry similar to the following abbreviated example.

   ```console
   info request gateway=agentgateway-system/agentgateway-proxy http.method=POST http.path=/v1/chat/completions http.status=200 trace.id=c4e407d74b582620f42f6fd3382bd63b span.id=f97625410e525bac protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-3.5-turbo gen_ai.response.model=gpt-3.5-turbo
   ```

4. In Arize AX, open **Tracing Projects**, select the project that you set in the `openinference.project.name` resource attribute, and search for the trace ID. Trace export is batched, so allow several seconds for the trace to appear.

{{< reuse-image src="img/arize-ax-agentgateway-trace.png" srcDark="img/arize-ax-agentgateway-trace.png" alt="Arize AX showing an agentgateway openai.chat trace with its input, output, latency, cost, and token count" caption="An agentgateway LLM trace in Arize AX." >}}

## Troubleshoot trace export

- Use the header names that correspond to your selected protocol: hyphenated headers for OTLP/HTTP and underscore headers for OTLP/gRPC.
- Confirm that the `arize-credentials` Secret is in the same namespace as the `arize-otlp` backend and contains the `api-key` and `space-id` keys.
- Confirm that the collector host matches your Arize region and that `openinference.project.name` is set.
- Check the `ACCEPTED` and `ATTACHED` status columns for the backend and policy.
- Set `randomSampling: "true"` while testing so that agentgateway starts a trace for every request.
- Check the proxy logs for OpenTelemetry exporter errors.
  ```sh
  kubectl logs deployment/agentgateway-proxy \
    -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
    | grep -i opentelemetry
  ```

For more information about Arize authentication and OpenTelemetry export, see the [Arize AX manual instrumentation documentation](https://arize.com/docs/ax/instrument/manual-instrumentation).
