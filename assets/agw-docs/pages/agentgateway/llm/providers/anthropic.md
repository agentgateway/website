Configure [Anthropic (Claude)](https://claude.ai/login) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Anthropic

1. Get an API key to access the [Anthropic API](https://platform.claude.com/). 

2. Save the API key in an environment variable.
   
   ```sh
   export ANTHROPIC_API_KEY=<insert your API key>
   ```

3. Create a Kubernetes secret to store your Anthropic API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: anthropic-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $ANTHROPIC_API_KEY
   EOF
   ```
 
4. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource to configure your LLM provider that references the Anthropic API key secret.
   
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: anthropic
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         anthropic:
           model: "claude-opus-4-6"
     policies:
       auth:
         secretRef:
           name: anthropic-secret
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#agentgatewaybackend" >}}).

   | Setting     | Description |
   |-------------|-------------|
   | `ai.provider.anthropic` | Define the LLM provider that you want to use. The example uses Anthropic. |
   | `anthropic.model`     | The model to use to generate responses. In this example, you use the `claude-opus-4-6` model. |
   | `policies.auth` | Provide the credentials to use to access the Anthropic API. The example refers to the secret that you previously created. The token is automatically sent in the `x-api-key` header.|

5. Create an HTTPRoute resource that routes incoming traffic to the {{< reuse "agw-docs/snippets/backend.md" >}}. The following example sets up a route on the `/anthropic` path. Note that {{< reuse "agw-docs/snippets/kgateway.md" >}} automatically rewrites the endpoint to the Anthropic `/v1/messages` endpoint.

   {{< tabs >}}
   {{% tab name="Anthropic v1/messages" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: anthropic
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - backendRefs:
       - name: anthropic
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```
   {{% /tab %}}
   {{% tab name="OpenAI-compatible v1/chat/completions" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: anthropic
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
       - name: anthropic
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
     name: anthropic
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /anthropic
       backendRefs:
       - name: anthropic
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

6. Send a request to the LLM provider API along the route that you previously created. Verify that the request succeeds and that you get back a response from the API.
   
   {{< tabs >}}
   {{% tab name="Anthropic v1/messages" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/messages" -H content-type:application/json  -d '{
      "model": "",
      "messages": [
        {
          "role": "user",
          "content": "Explain how AI works in simple terms."
        }
      ]
    }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/v1/messages" -H content-type:application/json  -d '{
      "model": "",
      "messages": [
        {
          "role": "user",
          "content": "Explain how AI works in simple terms."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{% tab name="OpenAI-compatible v1/chat/completions" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json  -d '{
      "model": "",
      "messages": [
        {
          "role": "user",
          "content": "Explain how AI works in simple terms."
        }
      ]
    }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/v1/chat/completions" -H content-type:application/json  -d '{
      "model": "",
      "messages": [
        {
          "role": "user",
          "content": "Explain how AI works in simple terms."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Custom route" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/anthropic" -H content-type:application/json  -d '{
      "model": "",
      "messages": [
        {
          "role": "user",
          "content": "Explain how AI works in simple terms."
        }
      ]
    }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/anthropic" -H content-type:application/json  -d '{
      "model": "",
      "messages": [
        {
          "role": "user",
          "content": "Explain how AI works in simple terms."
        }
      ]
    }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```json
   {
     "model": "claude-opus-4-6",
     "usage": {
       "prompt_tokens": 16,
       "completion_tokens": 318,
       "total_tokens": 334
     },
     "choices": [
       {
         "message": {
           "content": "Artificial Intelligence (AI) is a field of computer science that focuses on creating machines that can perform tasks that typically require human intelligence, such as visual perception, speech recognition, decision-making, and language translation. Here's a simple explanation of how AI works:\n\n1. Data input: AI systems require data to learn and make decisions. This data can be in the form of images, text, numbers, or any other format.\n\n2. Training: The AI system is trained using this data. During training, the system learns to recognize patterns, relationships, and make predictions based on the input data.\n\n3. Algorithms: AI uses various algorithms, which are sets of instructions or rules, to process and analyze the data. These algorithms can be simple or complex, depending on the task at hand.\n\n4. Machine Learning: A subset of AI, machine learning, enables the system to automatically learn and improve from experience without being explicitly programmed. As the AI system is exposed to more data, it can refine its algorithms and become more accurate over time.\n\n5. Output: Once the AI system has processed the data, it generates an output. This output can be a prediction, a decision, or an action, depending on the purpose of the AI system.\n\nAI can be categorized into narrow (weak) AI and general (strong) AI. Narrow AI is designed to perform a specific task, such as playing chess or recognizing speech, while general AI aims to have human-like intelligence that can perform any intellectual task.",
           "role": "assistant"
         },
         "index": 0,
         "finish_reason": "stop"
       }
     ],
     "id": "msg_01PbaJfDHnjEBG4BueJNR2ff",
     "created": 1764627002,
     "object": "chat.completion"
   }
   ```

## Extended thinking and reasoing

Extended thinking and reasoning lets Claude reason through complex problems before generating a response. You can opt in to extended thinking and reasoning by adding specific parameters to your request. 

{{< callout type="info" >}}
Extended thinking and reasoning requires a Claude model that supports these, such as `claude-opus-4-6`.
{{< /callout >}}

{{< tabs >}}
{{% tab name="Anthropic v1/messages" %}}

To opt in to extended thinking, include the `thinking.type` field in your request. You can also set the `output_config.effort` field to control how much reasoning the model applies.

The following values are supported: 

**`thinking` field**
| `type` value | Additional fields | Behavior |
|---|---|---|
| `adaptive` | `output_config.effort` | The model decides whether to think and how much. Requires `output_config.effort` to be set. |
| `enabled` | `budget_tokens: <number>` | Explicitly enables thinking with a fixed token budget. Works standalone without `output_config`. |
| `disabled` | none | Explicitly disables thinking. |

**`output_config` field**

`output_config` has two independent sub-fields. You can use either or both.

| Sub-field | Description |
|---|---|
| `effort` | Controls the reasoning effort level. Accepted values: `low`, `medium`, `high`, `max`. |
| `format` | Constrains the response to a JSON schema. Set `type` to `json_schema` and provide a `schema` object. For more information, see [Structured outputs](#structured-outputs). |


The following example request uses adaptive extended thinking. Note that this setting requires the `output_config.effort` field to be set too. 

**Cloud Provider LoadBalancer**:
```sh
curl "$INGRESS_GW_ADDRESS/v1/messages" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 1024,
  "thinking": {
    "type": "adaptive"
  },
  "output_config": {
    "effort": "high"
  },
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
curl "localhost:8080/v1/messages" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 1024,
  "thinking": {
    "type": "adaptive"
  },
  "output_config": {
    "effort": "high"
  },
  "messages": [
    {
      "role": "user",
      "content": "Explain the trade-offs between consistency and availability in distributed systems."
    }
  ]
}' | jq
```

Example output:
```console
{
  "id": "msg_01HVEzWf4NJrsKyVeEUDnHNW",
  "type": "message",
  "role": "assistant",
  "model": "claude-opus-4-6",
  "content": [
    {
      "type": "thinking",
      "thinking": "Let me think through the trade-offs between consistency and availability..."
    },
    {
      "type": "text",
      "text": "# Consistency vs. Availability in Distributed Systems\n\n..."
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 21,
    "output_tokens": 1024
  }
}
```

{{% /tab %}}
{{% tab name="OpenAI-compatible v1/chat/completions" %}}

Use the `reasoning_effort` field in your request to enable extended thinking. The value that you set is automatically mapped to a specific thinking budget as shown in the following table.

| `reasoning_effort` value | Thinking budget |
|---|---|
| `minimal` or `low` | 1,024 tokens |
| `medium` | 2,048 tokens |
| `high` or `xhigh` | 4,096 tokens |

Note that the `max_tokens` value must be greater than the tokens in the thinking budget for the request to succeed. 

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

Example output: 
```console
{
  "model": "claude-opus-4-6",
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 2549,
    "total_tokens": 2599,
    "prompt_tokens_details": {
      "cached_tokens": 0
    },
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0
  },
  "choices": [
    {
      "message": {
        "content": "# Consistency vs. Availability in Distributed ..."
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "id": "msg_01CVnXAQYeWkUjeaDceBRk3e",
  "created": 1773251049,
  "object": "chat.completion"
}
```

{{% /tab %}}
{{< /tabs >}}

## Structured outputs

Structured outputs constrain the model to respond with a specific JSON schema. You must provide the schema definition in your request. 

{{< tabs >}}
{{% tab name="Anthropic v1/messages" %}}

Provide the JSON schema definition in the `output_config.format` field. 

**Cloud Provider LoadBalancer**:
```sh
curl "$INGRESS_GW_ADDRESS/v1/messages" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 256,
  "output_config": {
    "format": {
      "type": "json_schema",
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
curl "localhost:8080/v1/messages" -H content-type:application/json -d '{
  "model": "",
  "max_tokens": 256,
  "output_config": {
    "format": {
      "type": "json_schema",
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

Example output:
```console
{
  "id": "msg_01PsCxtLN1vftAKZgvWXhCan",
  "type": "message",
  "role": "assistant",
  "model": "claude-opus-4-6",
  "content": [
    {
      "type": "text",
      "text": "{\"answer\":\"Yes, the sky is blue during clear daytime conditions.\",\"confidence\":0.98}"
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 29,
    "output_tokens": 28
  }
}
```

{{% /tab %}}
{{% tab name="OpenAI-compatible v1/chat/completions" %}}

Provide the schema definition in the `response_format` field. 

**Cloud Provider LoadBalancer**:
```sh
curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json -d '{
  "model": "",
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

Example output: 
```console
{
  "model": "claude-opus-4-6",
  "usage": {
    "prompt_tokens": 192,
    "completion_tokens": 68,
    "total_tokens": 260,
    "prompt_tokens_details": {
      "cached_tokens": 0
    },
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0
  },
  "choices": [
    {
      "message": {
        "content": "{\"answer\":\"Yes, the sky is blue...",
        "role": "assistant"
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "id": "msg_01BLohqXbvfZHQnnXxmviCcg",
  "created": 1773251560,
  "object": "chat.completion"
}
```

{{% /tab %}}
{{< /tabs >}}

## Use Claude Platform on AWS

[Claude Platform on AWS](https://docs.aws.amazon.com/claude-platform/latest/userguide/welcome.html) hosts Anthropic's native Messages API on AWS infrastructure at `aws-external-anthropic.{region}.api.aws`. Because the API is the same Anthropic Messages API, you point the `anthropic` provider at the AWS endpoint and choose either API-key or AWS SigV4 authentication.

<!--TODO 1.3 release -->
{{< callout type="info" >}}
Before you begin, [install agentgateway with the nightly build]({{< link-hextra path="/quickstart/install/">}}).
{{< /callout >}}

{{< tabs >}}
{{% tab name="API key" %}}

1. Create a Kubernetes secret that contains your Anthropic-on-AWS API key.

   ```sh
   export ANTHROPIC_AWS_API_KEY=<insert your API key>
   ```

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: anthropic-aws-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $ANTHROPIC_AWS_API_KEY
   EOF
   ```

2. Create a {{< reuse "agw-docs/snippets/backend.md" >}} that points the `anthropic` provider at the Claude Platform endpoint and references the API key secret.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: anthropic-aws
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         anthropic: {}
         host: aws-external-anthropic.us-west-2.api.aws
         port: 443
         pathPrefix: /v1
     policies:
       auth:
         secretRef:
           name: anthropic-aws-secret
   EOF
   ```

   | Setting | Description |
   |---------|-------------|
   | `provider.anthropic` | Marks the provider as Anthropic. No model override is required, so the field is left empty. |
   | `provider.host` | The Claude Platform endpoint hostname. Use the form `aws-external-anthropic.{region}.api.aws`. |
   | `provider.port` | The HTTPS port for Claude Platform, set to `443`. |
   | `provider.pathPrefix` | The Anthropic API path prefix on Claude Platform, set to `/v1`. |
   | `policies.auth.secretRef` | References the secret that holds the API key. The token is automatically sent in the `x-api-key` header. |

{{% /tab %}}
{{% tab name="AWS SigV4" %}}

1. Make sure the agentgateway proxy pod has access to AWS credentials, for example through [IRSA](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html) or a Kubernetes secret with `accessKey`, `secretKey`, and optional `sessionToken`. For the secret-based approach:

   ```yaml
   kubectl create secret generic anthropic-aws-creds \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=accessKey="$AWS_ACCESS_KEY_ID" \
     --from-literal=secretKey="$AWS_SECRET_ACCESS_KEY" \
     --from-literal=sessionToken="$AWS_SESSION_TOKEN" \
     --type=Opaque \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

2. Create a {{< reuse "agw-docs/snippets/backend.md" >}} that points the `anthropic` provider at the Claude Platform endpoint and uses AWS SigV4 authentication with the `aws-external-anthropic` service name.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: anthropic-aws
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         anthropic: {}
         host: aws-external-anthropic.us-west-2.api.aws
         port: 443
         pathPrefix: /v1
     policies:
       auth:
         aws:
           serviceName: aws-external-anthropic
           secretRef:
             name: anthropic-aws-creds
   EOF
   ```

   | Setting | Description |
   |---------|-------------|
   | `provider.anthropic` | Marks the provider as Anthropic. No model override is required, so the field is left empty. |
   | `provider.host` | The Claude Platform endpoint hostname. Use the form `aws-external-anthropic.{region}.api.aws`. |
   | `provider.port` | The HTTPS port for Claude Platform, set to `443`. |
   | `provider.pathPrefix` | The Anthropic API path prefix on Claude Platform, set to `/v1`. |
   | `policies.auth.aws.serviceName` | The SigV4 service name. Claude Platform requires `aws-external-anthropic`. |
   | `policies.auth.aws.secretRef` | References the secret with AWS credentials. To use implicit credentials from the workload environment (for example IRSA), omit `secretRef`. |

{{% /tab %}}
{{< /tabs >}}

3. Create an HTTPRoute that routes traffic to the {{< reuse "agw-docs/snippets/backend.md" >}}. The example also injects the `anthropic-workspace-id` header that Claude Platform requires. Replace `wrkspc_XXXXX` with your Anthropic workspace ID.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: anthropic-aws
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - filters:
       - type: RequestHeaderModifier
         requestHeaderModifier:
           set:
           - name: anthropic-workspace-id
             value: wrkspc_XXXXX
       backendRefs:
       - name: anthropic-aws
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

## Connect to Claude Code

{{% conditional-text include-if="kubernetes,standalone" %}}To route Claude Code CLI traffic through agentgateway, see the [Claude Code integration guide]({{< link-hextra path="/integrations/llm-clients/claude-code" >}}).{{% /conditional-text %}}{{% conditional-text include-if="kubernetes" %}} For a full tutorial with prompt guards and observability, see the [Claude Code CLI proxy tutorial]({{< link-hextra path="/tutorials/claude-code-proxy" >}}).{{% /conditional-text %}}

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
