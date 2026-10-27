Configure [Amazon Bedrock](https://aws.amazon.com/bedrock/) as an LLM provider in agentgateway.

{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
> [!NOTE]
> Agentgateway accepts OpenAI-formatted requests (such as the `/v1/chat/completions` request body shape) and returns OpenAI-formatted responses, regardless of the route path that you configure. Agentgateway translates between OpenAI and Bedrock formats internally. Bedrock-native APIs such as the [Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html) request and response shapes are not supported. Usage fields in responses follow the OpenAI shape (`prompt_tokens`, `completion_tokens`, `total_tokens`), not the Bedrock shape (`inputTokens`, `outputTokens`, `totalTokens`).
{{< /version >}}

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
> [!NOTE]
> Bedrock excludes cached tokens from the input count that it reports. The CEL field `llm.inputTokens` adds them back, so telemetry, metrics, and token-based limits count a cache-heavy request higher than the number that Bedrock reports. To read the Bedrock number itself, use `llm.providerInputTokens`. For more information, see [Token usage fields]({{< link-hextra path="/documentation/llm/observability/#token-usage-fields" >}}).
>
> {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}Agentgateway translates between the client API format and Bedrock internally. Bedrock-native request and response shapes, such as the [Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html), are not supported at the client-facing endpoint. Client response bodies use the usage convention for the API format that the client called. A `/v1/messages` response uses Anthropic usage fields. In that response, `usage.input_tokens` excludes prompt-cache tokens and cache counts appear separately. A `/v1/chat/completions` or `/v1/responses` response uses OpenAI usage fields. In those responses, the main input count includes prompt-cache tokens.{{< /version >}}
{{< /version >}}

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}). 
2. Make sure that your [Amazon credentials](https://docs.aws.amazon.com/sdkref/latest/guide/creds-config-files.html) have access to the Bedrock models that you want to use. You can alternatively use an [AWS Bedrock API key](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html).{{< version exclude-if="1.1.x" >}}
3. Optional: You can [configure AWS IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/getting-started.html) to allow single sign-on (SSO) credentials to authenticate to AWS Bedrock. Make sure that you have access to AWS Bedrock and set up your AWS profile to use SSO, such as through the [`aws` CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html). Make sure the workload can use that profile (for example with `AWS_PROFILE`). Later when you create the {{< reuse "agw-docs/snippets/backend.md" >}}, omit `policies.auth` so the proxy uses implicit AWS SSO credentials.{{< /version >}}

## Set up access to Amazon Bedrock {#setup}

1. Store your credentials to access the AWS Bedrock API. 
   {{< tabs >}}
   {{% tab name="AWS credentials" %}}

   {{< reuse "agw-docs/snippets/aws-creds.md" >}}

   1. Log in to the [AWS console](https://console.aws.amazon.com/console/home) and store your access credentials as environment variables.
      ```bash
      export AGW_AWS_ACCESS_KEY_ID="<aws-access-key-id>"
      export AGW_AWS_SECRET_ACCESS_KEY="<aws-secret-access-key>"
      export AGW_AWS_SESSION_TOKEN="<aws-session-token>"
      ```

   2. Create a secret with your Bedrock API key. Optionally provide the session token.
      ```yaml
      kubectl create secret generic bedrock-secret \
        -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
        --from-literal=accessKey="$AGW_AWS_ACCESS_KEY_ID" \
        --from-literal=secretKey="$AGW_AWS_SECRET_ACCESS_KEY" \
        --from-literal=sessionToken="$AGW_AWS_SESSION_TOKEN" \
        --type=Opaque \
        --dry-run=client -o yaml | kubectl apply -f -
      ```
   {{% /tab %}}
   {{% tab name="AWS Bedrock API key" %}}
   1. Save the API key in an environment variable.
      ```sh
      export BEDROCK_API_KEY=<insert your API key>
      ```

   2. Create a Kubernetes secret to store your Amazon Bedrock API key.
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: v1
      kind: Secret
      metadata:
        name: bedrock-secret
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      type: Opaque
      stringData:
        Authorization: $BEDROCK_API_KEY
      EOF
      ```
   {{% /tab %}}
   {{< /tabs >}}



2. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource to configure your LLM provider. Make sure to reference the secret that holds your credentials to access the LLM. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: bedrock
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         bedrock:
           model: "amazon.nova-micro-v1:0"
           region: "us-east-1"
     policies:
       auth:
         aws:
           secretRef:
             name: bedrock-secret
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#aibackend" >}}).

   | Setting     | Description |
   |-------------|-------------|
   | `ai.provider.bedrock` | Define the LLM provider that you want to use. The example uses Amazon Bedrock. |
   | `bedrock.model`     | The model to use to generate responses. In this example, you use the `amazon.nova-micro-v1:0` model. Keep in mind that some models support cross-region inference. These models begin with a `us.` prefix, such as `us.anthropic.claude-sonnet-4-20250514-v1:0`. For more models, see the [AWS Bedrock docs](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html). |
   | `bedrock.region`    | The AWS region where your Bedrock model is deployed. Multiple regions are not supported. |
   | `policies.auth` | Provide the credentials to use to access the Amazon Bedrock API. The example refers to the secret that you previously created. To use implicit credentials from the workload or environment instead (for example IRSA{{< version exclude-if="1.1.x" >}} and AWS IAM Identity Center (SSO) profiles{{< /version >}}), omit the `auth` settings. |

3. Create an HTTPRoute resource to route requests through your agentgateway proxy to the Bedrock {{< reuse "agw-docs/snippets/backend.md" >}}.

   {{< tabs >}}
   {{% tab name="OpenAI-compatible v1/chat/completions" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: bedrock
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
       - name: bedrock
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Custom route" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: bedrock
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /bedrock
       backendRefs:
       - name: bedrock
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}


4. Send a request to the LLM provider API along the route that you previously created, such as `/bedrock` or `/v1/chat/completions` depending on your route configuration. The request body must be in OpenAI chat-completions format. Verify that the request succeeds and that you get back a response from the chat completion API.

   {{< tabs >}}
   {{% tab name="OpenAI-compatible v1/chat/completions" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json -d '{
       "model": "",
       "messages": [
         {
           "role": "user",
           "content": "You are a cloud native solutions architect, skilled in explaining complex technical concepts such as API Gateway, microservices, LLM operations, kubernetes, and advanced networking patterns. Write me a 20-word pitch on why I should use an AI gateway in my Kubernetes cluster."
         }
       ]
     }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/v1/chat/completions" -H content-type:application/json -d '{
       "model": "",
       "messages": [
         {
           "role": "user",
           "content": "You are a cloud native solutions architect, skilled in explaining complex technical concepts such as API Gateway, microservices, LLM operations, kubernetes, and advanced networking patterns. Write me a 20-word pitch on why I should use an AI gateway in my Kubernetes cluster."
         }
       ]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Custom route" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/bedrock" -H content-type:application/json -d '{
       "model": "",
       "messages": [
         {
           "role": "user",
           "content": "You are a cloud native solutions architect, skilled in explaining complex technical concepts such as API Gateway, microservices, LLM operations, kubernetes, and advanced networking patterns. Write me a 20-word pitch on why I should use an AI gateway in my Kubernetes cluster."
         }
       ]
     }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/bedrock" -H content-type:application/json -d '{
       "model": "",
       "messages": [
         {
           "role": "user",
           "content": "You are a cloud native solutions architect, skilled in explaining complex technical concepts such as API Gateway, microservices, LLM operations, kubernetes, and advanced networking patterns. Write me a 20-word pitch on why I should use an AI gateway in my Kubernetes cluster."
         }
       ]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output. Note that agentgateway returns OpenAI-shaped responses, including OpenAI-style usage fields (`prompt_tokens`, `completion_tokens`, `total_tokens`), even though the upstream provider is Bedrock.
   ```json
   {
     "id": "chatcmpl-abc123",
     "object": "chat.completion",
     "created": 1730000000,
     "model": "amazon.nova-micro-v1:0",
     "choices": [
       {
         "index": 0,
         "message": {
           "role": "assistant",
           "content": "An AI gateway in your Kubernetes cluster can enhance performance, scalability, and security while simplifying complex operations. It provides a centralized entry point for AI workloads, automates deployment and management, and ensures high availability."
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 60,
       "completion_tokens": 47,
       "total_tokens": 107
     }
   }
   ```

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
## Bedrock Mantle

Bedrock serves models on two API surfaces: the Runtime endpoint, which carries the Converse and Invoke APIs, and the [Mantle](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-responses-api.html) endpoint, which carries the native OpenAI and Anthropic APIs. Some models are served on only one of the two.

For chat requests, the endpoint is chosen per model from the `runtime` and `mantle` tags in the [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}). The built-in catalog that ships with {{< reuse "agw-docs/snippets/agentgateway.md" >}} already tags the Amazon Bedrock models. To tag models that are newer than your agentgateway version, run `agctl catalog import`. Its default sources include `aws-bedrock-mantle`, which reads the tags from the AWS model cards. A model with neither tag falls back to the preference alone.

Set `spec.ai.provider.bedrock.endpointPreference` on the {{< reuse "agw-docs/snippets/backend.md" >}} resource to choose how the tags are applied. The {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} resource takes the same setting at `spec.bedrock.endpointPreference`.

```yaml
spec:
  ai:
    provider:
      bedrock:
        model: "amazon.nova-micro-v1:0"
        region: "us-east-1"
        endpointPreference: RuntimePreferred
```

| Value | Endpoint selection |
|-------|--------------------|
| `RuntimePreferred` | Use Runtime, except for a model tagged `mantle` but not `runtime`. This value is the default. If `guardrail` is set, Runtime is always used. |
| `MantlePreferred` | Use Mantle, except for a model tagged `runtime` but not `mantle`. The API server rejects this value when `guardrail` is set. |
| `RuntimeOnly` | Always use Runtime, whatever the tags say. |
| `MantleOnly` | Always use Mantle, whatever the tags say. The API server rejects this value when `guardrail` is set. |

The `guardrail` field sets an inline Bedrock guardrail, which only the Runtime endpoint supports. You can set it under `spec.ai.provider.bedrock` or `spec.ai.groups[].providers[].bedrock` on the {{< reuse "agw-docs/snippets/backend.md" >}} resource, or under `spec.bedrock` on the {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} resource. If you set `guardrail` together with `MantlePreferred` or `MantleOnly`, the API server rejects the resource with the message `Bedrock guardrails cannot be used with MantlePreferred or MantleOnly`. With `RuntimePreferred`, a `guardrail` keeps requests on Runtime even when the model tags would choose Mantle. To apply Bedrock Guardrails with either endpoint, use a [Bedrock Guardrails prompt guard]({{< link-hextra path="/documentation/llm/guardrails/bedrock-guardrails/" >}}) in the `backend.ai.promptGuard` field of an {{< reuse "agw-docs/snippets/policy.md" >}} instead.

Standalone mode takes the same four values in lowercase, such as `runtimePreferred`, under `params.bedrockEndpointPreference`. A value that you copy from one mode to the other fails to load.

The preference applies to chat completions, messages, responses, and Anthropic token counting. The other route types ignore it: embeddings, reranking, realtime, Gemini token counting, detection, passthrough, and content generation always take Runtime, and model listing always takes Mantle.

Whether the preference changes the request format that a model accepts depends on the endpoint that it selects. A model that resolves to Runtime accepts the Bedrock Converse format only, and its chat format tags do not apply. A model that resolves to Mantle accepts the formats in its tags, except for `anthropic.claude*` models, which always take the Anthropic Messages format. For more information, see [Chat format tags]({{< link-hextra path="/documentation/llm/cost-controls/costs/#chat-format-tags" >}}).

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
When a `/v1/messages` or `/v1/messages/count_tokens` request reaches Bedrock Mantle in the Anthropic Messages format, the request keeps the client `anthropic-version` header. If the client sends no version header, the request uses the default `2023-06-01` version.
{{< /version >}}

> [!NOTE]
> Requests to the Mantle endpoint are signed for the `bedrock-mantle` service rather than `bedrock`. If you scope an IAM policy by service name, grant both before you switch a route to Mantle.
{{% /version %}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
## Tool choice

When a chat request goes to Bedrock Runtime, the `tool_choice` value from the client request is converted to the Bedrock Converse `toolChoice` field.

| Client `tool_choice` | Bedrock `toolChoice` |
|---|---|
| `auto` | `auto` |
| `required` (Chat Completions, Responses) or `any` (Messages) | `any` |
| A named function or tool | `tool`, with that name |
| `none`, or omitted | Omitted. Bedrock Converse has no `none` option. The tools are still sent, so the model can still call them. |

The Bedrock model decides which values it accepts. If the model rejects forced tool use, such as `any` or a named tool, the client receives the Bedrock error. For example, Anthropic models reject forced tool use when [extended thinking](https://platform.claude.com/docs/en/build-with-claude/thinking#thinking-with-tool-use) is enabled. The tool choice is not changed for requests that use extended thinking.
{{% /version %}}

{{% version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" %}}
## Service tier {#service-tier}

For `/v1/chat/completions` and `/v1/responses` requests to Bedrock Runtime, agentgateway converts OpenAI `service_tier` to Converse `serviceTier`. This selects the Bedrock [service tier](https://docs.aws.amazon.com/bedrock/latest/userguide/service-tiers-inference.html).

| Client `service_tier` | Bedrock `serviceTier` |
|---|---|
| `priority` | `{"type": "priority"}` |
| `default` | `{"type": "default"}` |
| `flex` | `{"type": "flex"}` |
| `auto`, or omitted | Omitted. Bedrock uses its default tier. |
| `scale`, `fast`, or `ultrafast` | Omitted. Bedrock uses its default tier. For `/v1/chat/completions` requests, these values also trigger the warning `service tier is not supported by Bedrock`. |
| Any other value | For `/v1/chat/completions` requests, omitted with the same warning. For `/v1/responses` requests, the request fails with `400` before it reaches Bedrock. For example: ``unknown variant `bogus` ``. |

A `/v1/messages` request does not set a Bedrock service tier.

If the Bedrock model does not support the requested tier, the request fails with `400`. For example: `The provided service tier is not supported for this model`.

Earlier versions omitted the tier and used the standard tier. To keep that behavior, omit `service_tier` or set it to `auto`.

Bedrock reports the served tier in the `x-amzn-bedrock-service-tier` response header. Agentgateway normalizes it as `llm.serviceTier` to select model catalog rates. The built-in catalog has no Bedrock service-tier rates. To price Bedrock tiers differently, add `serviceTier` tiers for your Bedrock models to your own catalog. For more information, see [Service tiers]({{< link-hextra path="/documentation/llm/cost-controls/costs/#service-tiers" >}}).
{{% /version %}}

## Prompt caching

Prompt Caching is a performance, cost-optimization, and cost-reduction feature that allows the model to "remember" frequently used parts of your prompt, including long system instructions, reference documents, or tool definitions. This way, the model does not need to reprocess these parts every time you send a new prompt. 

For example, let's assume you have a 50-page manual and you want to ask your model different questions about the manual. Instead of re-reading the manual for each question, the model can read it once and save it in its internal cache. Then, the model can answer subsequent questions more quickly and more cost efficient. 

Prompt caching is configured by using the `backend.ai.promptCaching` fields in the {{< reuse "agw-docs/snippets/policy.md" >}} resource. 

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
If you omit `promptCaching`, prompt caching is disabled. If you set `promptCaching: {}`, the controller enables prompt caching with the following defaults: `cacheSystem: true`, `cacheMessages: true`, `cacheTools: false`, and `minTokens: 1024`. To override a default, set that field explicitly.
{{% /version %}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
When a client sends prompt-cache markers, Bedrock conversion turns each marker into a Bedrock cache point after the content that the marker is on. In `/v1/messages` requests, the Anthropic `cache_control.ttl` value becomes the TTL of the Bedrock cache point.

Client cache markers take precedence over `backend.ai.promptCaching`. If the converted Bedrock request already contains a cache point, the policy adds no cache points. For Nova models, the policy ignores `cacheTools`, because Nova does not accept cache points on tool definitions. The `minTokens` value applies only to system prompt caching.

The conversion drops some content before sending the request to Bedrock. When dropped content has a cache marker, the marker moves to nearby content that the conversion keeps:

- **Dropped Messages blocks:** Bedrock Converse has no equivalent for the `document`, `search_result`, `server_tool_use`, and `web_search_tool_result` block types, so the conversion drops these blocks. A marker on a dropped block moves to the nearest earlier content that the conversion keeps:

  - When content comes before the dropped block in the same message, the marker moves to the end of that content.
  - When the dropped block is the first block of the message, the marker moves to the end of the closest earlier message that has content.
  - When no earlier message has content, the marker moves to the end of the system prompt.

  If that content already ends with a cache point, no cache point is added.
- **Dropped server tools:** Server tools, such as web search, are dropped from the `tools` list. A marker on a dropped server tool moves to the closest earlier tool definition that the conversion keeps, unless that tool definition already has a marker. When no kept tool definition comes before the server tool, the marker is dropped.
- **Tool results:** Bedrock accepts cache points only between top-level content blocks. A marker on any part inside a tool result moves to after the whole tool result.
- **Blank Chat Completions text:** In `/v1/chat/completions` requests, a text part that contains only whitespace is not sent. The marker on that text part moves to the end of the content before the text part in the same message. When the text part is the first content of the message, the marker is dropped.

Messages that are left empty after the conversion drops unsupported blocks are not sent to Bedrock. The conversion adds at most four cache points to a request, so a marker is dropped when four cache points are already set.

In `/v1/messages` requests, a system message after a user or assistant message stays in place instead of moving into the Bedrock system prompt. Its text is sent as user text wrapped in `<system-reminder>` tags, with its cache markers, so the cached prefix ahead of it does not change. When the system message follows a tool call, its text is sent after the tool results.
{{% /version %}}

> [!NOTE]
> Prompt caching is supported for Bedrock Claude 3+ and Nova models. 

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource with your prompt cache settings. The following example enables caching for system prompts and conversation messages, but disables it for tool definitions. Bedrock requires you to set the minimum token count after which caching is enabled. By default, a minimum of 1024 tokens are required by Bedrock for caching to be effective. This is also referred to as a caching checkpoint. For more information, see the [API reference]({{< link-hextra path="/reference/api/#promptcachingconfig" >}}). 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: bedrock-caching-policy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: bedrock
     backend:
       ai:
         promptCaching:
           cacheSystem: true
           cacheMessages: true
           cacheTools: false
           minTokens: 1024
   EOF
   ```

2. Port-forward the agentgateway proxy on port 15000. 
   ```sh
   kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

3. Get the caching configuration and verify that you see the cache settings. 
   ```sh
   curl -s http://localhost:15000/config_dump | jq '.policies[] |                                    
    select(.name.name == "bedrock-caching-policy" and 
         .policy.backend.aI.promptCaching != null)'
   ```

   Example output: 
   ```console {hl_lines=[20,21,22,23,24]}
   {
      "key": "backend/agentgateway-system/bedrock-caching-policy:ai:agentgateway-system/bedrock",
      "name": {
        "kind": "AgentgatewayPolicy",
        "name": "bedrock-caching-policy",
        "namespace": "agentgateway-system"
      },
      "target": {
        "route": {
          "name": "bedrock",
          "namespace": "agentgateway-system",
          "kind": "HTTPRoute"
        }
      },
      "policy": {
        "backend": {
          "aI": {
            "defaults": {},
            "overrides": {},
            "promptCaching": {
              "cacheSystem": true,
              "cacheMessages": true,
              "cacheTools": false,
              "minTokens": 1024
            }
          }
        }
      }
   }
   ```

## Extended thinking and reasoning

Extended thinking and reasoning lets models reason through complex problems before generating a response. You can opt in to extended thinking and reasoning by adding the OpenAI `reasoning_effort` field to your request. Agentgateway translates this setting to Bedrock's native thinking budget automatically.

**Note**: Extended thinking and reasoning requires a Claude model that supports it, such as `us.anthropic.claude-opus-4-20250514-v1:0`.

Use the `reasoning_effort` field to control how much reasoning the model applies. The value is automatically mapped to a thinking budget.

| `reasoning_effort` value | Thinking budget |
|---|---|
| `minimal` or `low` | 1,024 tokens |
| `medium` | 2,048 tokens |
| `high` | 4,096 tokens |
| `xhigh` | 8,192 tokens in agentgateway 1.4 and later. 4,096 tokens in earlier versions, including 2.2.x. |
| `max` | 16,384 tokens. Supported in agentgateway 1.4 and later. |

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
For Claude models that support adaptive thinking, the request is sent with `thinking.type` set to `adaptive` and the effort level in `output_config.effort`, instead of a thinking budget. The value `minimal` is sent as `low`. Which models take this form depends on the `adaptive_thinking` tag in the [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}). The built-in catalog sets this tag for these models.

`reasoning_effort` also works with the following non-Claude model families. The family is chosen by matching the model ID, and the value is added to the `additionalModelRequestFields` of the Bedrock request.

| Model ID contains | What the Bedrock request receives |
|---|---|
| `gpt-oss` or `deepseek` | `reasoning_effort`, with the value from your request unchanged. |
| `openai.`, other than `gpt-oss` models | `reasoning.effort`, with the value from your request unchanged. |
| `amazon.nova-2-` | `reasoningConfig` with `maxReasoningEffort` set to `low`, `medium`, or `high`. If you set `none` or omit `reasoning_effort`, no reasoning configuration is sent. Any other value is rejected. |

Any other model ID is treated as a Claude model.
{{% /version %}}

**Cloud Provider LoadBalancer**:
```sh
curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 6000,
  "reasoning_effort": "high",
  "messages": [
    {
      "role": "user",
      "content": "Explain the trade-offs between consistency and availability in distributed systems."
    }
  ]
}' | jq
```

**Localhost**:
```sh
curl "localhost:8080/v1/chat/completions" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 6000,
  "reasoning_effort": "high",
  "messages": [
    {
      "role": "user",
      "content": "Explain the trade-offs between consistency and availability in distributed systems."
    }
  ]
}' | jq
```

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
### Encrypted reasoning

Some Bedrock models return encrypted reasoning in a `reasoningContent.redactedContent` block instead of reasoning text. How agentgateway returns encrypted reasoning in a buffered reply depends on the API that the client sends.

| Client API | Encrypted reasoning in the reply | Replay on the next turn |
|---|---|---|
| `/v1/messages` | A `redacted_thinking` block. | Send the block back in the message history. The next Bedrock request includes it as `reasoningContent.redactedContent`. |
| `/v1/responses` | A reasoning item with `encrypted_content`.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}} Treat the value as opaque. It holds the full reasoning block: the reasoning text and its signature, or Bedrock's encrypted payload. The reasoning text is not encrypted, and response guardrails do not mask it.{{< /version >}} | Send the reasoning item back in the input. {{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}The next Bedrock request includes it as `reasoningContent.redactedContent`.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}The next Bedrock request includes signed reasoning as `reasoningContent.reasoningText` with its signature, and encrypted reasoning as `reasoningContent.redactedContent`. Agentgateway needs only `encrypted_content` to replay the item, so a client that sends back only `encrypted_content` still works.{{< /version >}} |
| `/v1/chat/completions` | Omitted, because the Chat Completions format has no field for encrypted reasoning. Signed reasoning text still arrives in `reasoning_content` and `reasoning_signature`. | Not possible. |

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}A streamed reply does not keep the encrypted payload, so streamed encrypted reasoning cannot be replayed. A `/v1/messages` stream shows the encrypted reasoning as a `thinking` block with the text `[REDACTED]`.{{< /version >}}

{{% version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" %}}
Replay streamed encrypted reasoning the same way as buffered reasoning. Stream events depend on the client API.

| Client API | Streamed reasoning |
|---|---|
| `/v1/messages` | Text uses `thinking_delta` events; the signature uses `signature_delta`. Encrypted reasoning arrives as one `redacted_thinking` block after Bedrock finishes the block. |
| `/v1/responses` | Each reasoning block becomes a `reasoning` output item before the `message` item. Text uses `response.reasoning_text.delta` events. The item's `response.output_item.done` event carries `encrypted_content`, the same opaque carrier of the full reasoning as in a buffered reply. |
| `/v1/chat/completions` | Text uses `reasoning_content`; the signature uses `reasoning_signature`. Encrypted reasoning is omitted. |

For `/v1/messages` streams, agentgateway buffers encrypted reasoning until the block ends. If the buffered fragments exceed the LLM buffer limit, the stream emits an `api_error` event with `Stream processing error` and stops. The limit is 32 MiB unless you set `frontend.http.maxBufferSize`. For more information, see [Buffering]({{< link-hextra path="/documentation/traffic-management/buffering/#about-buffer-limits" >}}).
{{% /version %}}
{{% /version %}}

## Structured outputs

Structured outputs constrain the model to respond with a specific JSON schema. Provide the schema definition in the OpenAI `response_format` field of your request. Agentgateway translates this to Bedrock's native format automatically.

**Cloud Provider LoadBalancer**:
```sh
curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 256,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "answer_schema",
      "schema": {
        "type": "object",
        "properties": {
          "answer": { "type": "string" },
          "confidence": { "type": "number" }
        },
        "required": ["answer", "confidence"],
        "additionalProperties": false
      }
    }
  },
  "messages": [
    {
      "role": "user",
      "content": "Is the sky blue? Respond with your answer and a confidence score between 0 and 1."
    }
  ]
}' | jq
```

**Localhost**:
```sh
curl "localhost:8080/v1/chat/completions" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 256,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "answer_schema",
      "schema": {
        "type": "object",
        "properties": {
          "answer": { "type": "string" },
          "confidence": { "type": "number" }
        },
        "required": ["answer", "confidence"],
        "additionalProperties": false
      }
    }
  },
  "messages": [
    {
      "role": "user",
      "content": "Is the sky blue? Respond with your answer and a confidence score between 0 and 1."
    }
  ]
}' | jq
```

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
