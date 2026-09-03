---
title: Arize AX
weight: 40
description: Export agentgateway LLM traces to Arize AX over OTLP/HTTP or OTLP/gRPC.
test: skip
---

[Arize AX](https://arize.com/docs/ax) is an AI observability platform that accepts OpenTelemetry traces and displays LLM inputs, outputs, models, and token usage. Agentgateway can export directly to Arize AX over OTLP/HTTP or OTLP/gRPC without a separate OpenTelemetry Collector.

## Before you begin

1. [Complete the LLM quickstart]({{< link-hextra path="/quickstart/llm/" >}}).
2. **Arize account**: Sign up for an [Arize account](https://app.arize.com/auth/join).
3. **Arize API key and Space ID**: Obtain an API key and Space ID from the Arize platform.

## Get your Arize API key and Space ID

1. Log in to the [Arize dashboard](https://app.arize.com/).
2. Go to **Settings** > **API Keys** > **Service Keys**, and click **New Service Key**.
3. For **Account Role**, select **Member**. Add an organization, and then add the spaces that the service key can access.
4. Create the service key and copy the API service key, such as `ak-5245b124-1ef5-5514-...`.
5. Copy the base64 Space ID for the space that receives the traces, such as `U3BhY2U6TbN4WkU6wshdaf==`. The Space ID is different from the space name and organization ID.
6. Set the following environment variables in the environment where agentgateway runs. Do not add the values to your agentgateway configuration file or commit them to source control.
   ```sh
   export ARIZE_API_KEY="<your-api-key>"
   export ARIZE_SPACE_ID="<your-space-id>"
   ```

   Agentgateway sends the API key and Space ID as request headers.

## Choose an Arize endpoint

Use the collector host for your Arize AX region.

| Region | Collector host |
|--------|----------------|
| US | `otlp.arize.com:443` |
| US regional | `otlp.us-central-1a.arize.com:443` |
| EU | `otlp.eu-west-1a.arize.com:443` |
| Canada | `otlp.ca-central-1a.arize.com:443` |

The following examples use the US collector. Replace `host` with the collector host for your region.

## Configure trace export

Choose either OTLP/HTTP or OTLP/gRPC. The authentication header names differ by protocol.

{{< tabs >}}
{{% tab name="OTLP/HTTP" %}}

For OTLP/HTTP, use the `arize-api-key` and `arize-space-id` headers.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: otlp.arize.com:443
    protocol: http
    randomSampling: true
    clientSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          arize-api-key: ${ARIZE_API_KEY}
          arize-space-id: ${ARIZE_SPACE_ID}
    resources:
      service.name: '"agentgateway"'
      openinference.project.name: '"agentgateway"'
    attributes:
      span.name: '"openai.chat"'
      openinference.span.kind: '"LLM"'
      llm.system: "llm.provider"
      llm.model_name: "coalesce(llm.responseModel, llm.requestModel)"
      llm.input_messages: >-
        flattenRecursive(llm.prompt.map(c, {"message": c}))
      llm.output_messages: >-
        flattenRecursive(llm.completion.map(c, {
          "role": "assistant",
          "content": c
        }))
      llm.token_count.prompt: "llm.inputTokens"
      llm.token_count.completion: "llm.outputTokens"
      llm.token_count.total: "llm.totalTokens"
```

{{% /tab %}}
{{% tab name="OTLP/gRPC" %}}

For OTLP/gRPC, use the `api_key` and `space_id` metadata headers.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: otlp.arize.com:443
    protocol: grpc
    randomSampling: true
    clientSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          api_key: ${ARIZE_API_KEY}
          space_id: ${ARIZE_SPACE_ID}
    resources:
      service.name: '"agentgateway"'
      openinference.project.name: '"agentgateway"'
    attributes:
      span.name: '"openai.chat"'
      openinference.span.kind: '"LLM"'
      llm.system: "llm.provider"
      llm.model_name: "coalesce(llm.responseModel, llm.requestModel)"
      llm.input_messages: >-
        flattenRecursive(llm.prompt.map(c, {"message": c}))
      llm.output_messages: >-
        flattenRecursive(llm.completion.map(c, {
          "role": "assistant",
          "content": c
        }))
      llm.token_count.prompt: "llm.inputTokens"
      llm.token_count.completion: "llm.outputTokens"
      llm.token_count.total: "llm.totalTokens"
```

{{% /tab %}}
{{< /tabs >}}

The values under `resources` and `attributes` are CEL expressions. The extra quotes around static values, such as `'"agentgateway"'`, make the CEL expression evaluate to a string. The authentication headers are regular header values and do not require CEL quoting.

Change `openinference.project.name` if you want traces to appear in a different Arize project. Arize creates the project when it receives the first trace.

## Optional: Add resource attributes

Agentgateway supports custom OpenTelemetry resource attributes through `frontendPolicies.tracing.resources`. Resource attributes are added to every exported span and can help you filter and group traces in Arize AX.

Add attributes such as `model_id`, `model_version`, or `deployment.environment.name` to the `resources` section of your OTLP/HTTP or OTLP/gRPC configuration.

```yaml
frontendPolicies:
  tracing:
    resources:
      service.name: '"agentgateway"'
      openinference.project.name: '"agentgateway"'
      model_id: '"gpt-4o-production"'
      model_version: '"2026-08-27"'
      deployment.environment.name: '"production"'
```

Resource values are static CEL expressions that are initialized with the tracer and apply to every request. If agentgateway routes requests to multiple models, use the `llm.model_name` span attribute from the main configuration to record the model for each request instead of setting a single `model_id` resource value.

For more information, see [Add span and resource attributes]({{< link-hextra path="/observability/traces/setup/#add-attributes" >}}).

## Verify the integration

1. Start agentgateway with the updated configuration.
2. Send an LLM request through agentgateway. The following example assumes that agentgateway runs locally on port `4000` and has an OpenAI-compatible provider and the `gpt-3.5-turbo` model configured.
   ```sh
   curl http://localhost:4000/v1/chat/completions \
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
3. Find the request in the agentgateway logs and copy its `trace.id` value. A successful request resembles the following example.
   ```text
   info request gateway=default/default route=internal/llm:request http.status=200 trace.id=4d50f6d1cb4099a1a22e50b6d339d5f2 span.id=a3f2ae9119406264 protocol=llm gen_ai.provider.name=openai
   ```
4. In Arize AX, open **Tracing Projects**, select the project from `openinference.project.name`, and search for the trace ID. Trace export is batched, so allow several seconds for the trace to appear.

{{< reuse-image src="img/arize-ax-agentgateway-trace.png" srcDark="img/arize-ax-agentgateway-trace.png" alt="Arize AX showing an agentgateway openai.chat trace with its input, output, latency, cost, and token count" caption="An agentgateway LLM trace in Arize AX." >}}

## Troubleshoot trace export

- Use the header names that correspond to your selected protocol: hyphenated headers for OTLP/HTTP and underscore headers for OTLP/gRPC.
- Confirm that `ARIZE_API_KEY` and `ARIZE_SPACE_ID` are set in the process environment that starts agentgateway.
- Confirm that the collector host matches your Arize region and that `openinference.project.name` is set.
- Set `randomSampling: true` while testing so that agentgateway starts a trace for every request.

For more information about Arize authentication and OpenTelemetry export, see the [Arize AX manual instrumentation documentation](https://arize.com/docs/ax/instrument/manual-instrumentation).
