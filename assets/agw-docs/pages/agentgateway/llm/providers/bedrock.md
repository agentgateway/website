Configure [Amazon Bedrock](https://aws.amazon.com/bedrock/) as an LLM provider in agentgateway.

> [!NOTE]
> Agentgateway accepts OpenAI-formatted requests (such as the `/v1/chat/completions` request body shape) and returns OpenAI-formatted responses, regardless of the route path that you configure. Agentgateway translates between OpenAI and Bedrock formats internally. Bedrock-native APIs such as the [Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html) request and response shapes are not supported. Usage fields in responses follow the OpenAI shape (`prompt_tokens`, `completion_tokens`, `total_tokens`), not the Bedrock shape (`inputTokens`, `outputTokens`, `totalTokens`).

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
> [!NOTE]
> Bedrock excludes cached tokens from the input count that it reports. The CEL field `llm.inputTokens` adds them back, so telemetry, metrics, and token-based limits count a cache-heavy request higher than the number that Bedrock reports. To read the Bedrock number itself, use `llm.providerInputTokens`. Do not confuse these CEL fields with the Bedrock wire fields named in the previous note. For more information, see [Token usage fields]({{< link-hextra path="/documentation/llm/observability/#token-usage-fields" >}}).
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

Bedrock serves models on two API surfaces: the Runtime endpoint, which carries the Converse and Invoke APIs, and the [Mantle](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html) endpoint, which carries the native OpenAI and Anthropic APIs. Some models are served on only one of the two.

For chat requests, the endpoint is chosen per model from the `runtime` and `mantle` tags in your [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}). Run `agctl catalog import` to populate those tags, because the default sources include `aws-bedrock-mantle`, which reads them from the AWS model cards. Without a catalog, no model carries either tag, so every chat request falls back to the preference alone.

Set `spec.ai.provider.bedrock.endpointPreference` on the {{< reuse "agw-docs/snippets/backend.md" >}} resource to choose how the tags are applied. The AgentgatewayModel resource takes the same setting at `spec.bedrock.endpointPreference`.

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
| `RuntimePreferred` | Use Runtime, except for a model tagged `mantle` but not `runtime`. This value is the default. |
| `MantlePreferred` | Use Mantle, except for a model tagged `runtime` but not `mantle`. |
| `RuntimeOnly` | Always use Runtime, whatever the tags say. |
| `MantleOnly` | Always use Mantle, whatever the tags say. |

Standalone mode takes the same four values in lowercase, such as `runtimePreferred`, under `params.bedrockEndpointPreference`. A value that you copy from one mode to the other fails to load.

The preference applies to chat completions, messages, responses, and Anthropic token counting. The other route types ignore it: embeddings, reranking, realtime, Gemini token counting, detection, passthrough, and content generation always take Runtime, and model listing always takes Mantle.

Whether the preference changes the request format that a model accepts depends on the endpoint that it selects. A model that resolves to Runtime accepts the Bedrock Converse format only, and its chat format tags do not apply. A model that resolves to Mantle accepts the formats in its tags, except for `anthropic.claude*` models, which always take the Anthropic Messages format. For more information, see [Chat format tags]({{< link-hextra path="/documentation/llm/cost-controls/costs/#chat-format-tags" >}}).

> [!NOTE]
> Requests to the Mantle endpoint are signed for the `bedrock-mantle` service rather than `bedrock`. If you scope an IAM policy by service name, grant both before you switch a route to Mantle.
{{% /version %}}

## Prompt caching

Prompt Caching is a performance, cost-optimization, and cost-reduction feature that allows the model to "remember" frequently used parts of your prompt, including long system instructions, reference documents, or tool definitions. This way, the model does not need to reprocess these parts every time you send a new prompt. 

For example, let's assume you have a 50-page manual and you want to ask your model different questions about the manual. Instead of re-reading the manual for each question, the model can read it once and save it in its internal cache. Then, the model can answer subsequent questions more quickly and more cost efficient. 

Prompt caching is configured by using the `backend.ai.promptCaching` fields in the {{< reuse "agw-docs/snippets/policy.md" >}} resource. 

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

## Extended thinking and reasoning {#extended-thinking-and-reasoning}

Extended thinking and reasoning lets models reason through complex problems before generating a response. To request Bedrock reasoning for supported models, add the OpenAI `reasoning_effort` field to your request. The proxy translates supported values to Bedrock's native thinking budget.

Claude models that support extended thinking, such as `us.anthropic.claude-opus-4-20250514-v1:0`, use the thinking-budget values in the following table.

Use the `reasoning_effort` field to control how much reasoning the model applies.

| `reasoning_effort` value | Thinking budget |
|---|---|
| `minimal` or `low` | 1,024 tokens |
| `medium` | 2,048 tokens |
| `high` or `xhigh` | 4,096 tokens |

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
For Amazon Nova 2 models, set `reasoning_effort` to `low`, `medium`, or `high`. To send a Nova 2 request without a Bedrock reasoning configuration, omit `reasoning_effort` or set `reasoning_effort` to `none`. The `minimal` and `xhigh` aliases apply to Claude thinking budgets only.
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
