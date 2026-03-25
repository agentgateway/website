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

   {{< tabs tabTotal="3" items="Anthropic v1/messages, OpenAI-compatible v1/chat/completions, Custom route" >}}
   {{% tab tabName="Anthropic v1/messages" %}}
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
   {{% tab tabName="OpenAI-compatible v1/chat/completions" %}}
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
   {{% tab tabName="Custom route" %}}
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
   
   {{< tabs tabTotal="3" items="Anthropic v1/messages, OpenAI-compatible v1/chat/completions, Custom route" >}}
   {{% tab tabName="Anthropic v1/messages" %}}
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
   {{% tab tabName="OpenAI-compatible v1/chat/completions" %}}
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
   {{% tab tabName="Custom route" %}}
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

{{< version include-if="1.0.x" >}}

## Extended thinking and reasoing

Extended thinking and reasoning lets Claude reason through complex problems before generating a response. You can opt in to extended thinking and reasoning by adding specific parameters to your request. 

{{< callout type="info" >}}
Extended thinking and reasoning requires a Claude model that supports these, such as `claude-opus-4-6`.
{{< /callout >}}

{{< tabs tabTotal="2" items="Anthropic v1/messages, OpenAI-compatible v1/chat/completions" >}}
{{% tab tabName="Anthropic v1/messages" %}}

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
{{% tab tabName="OpenAI-compatible v1/chat/completions" %}}

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

{{< tabs tabTotal="2" items="Anthropic v1/messages, OpenAI-compatible v1/chat/completions" >}}
{{% tab tabName="Anthropic v1/messages" %}}

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
{{% tab tabName="OpenAI-compatible v1/chat/completions" %}}

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

{{< /version >}}

## Connect to Claude CLI

Configure your {{< reuse "agw-docs/snippets/backend.md" >}} resource to allow connections to the Claude Code CLI.

Keep the following things in mind: 
* **Model selection**: If you specify a specific model in the {{< reuse "agw-docs/snippets/backend.md" >}} resource and then use a different model in the Claude Code CLI, you get a 400 HTTP response with an error message similar to `thinking mode isn't enabled`. To use any model, remove the `spec.ai.provider.anthropic.model` field and replace it with `{}`. 
* **Routes**: To use the Claude Code CLI, you must explicitly set the routes that you want to allow. By default, the Claude Code CLI sends requests to the `/v1/messages` API endpoint. However, it might send requests to other endpoints, such as `/v1/models`. To ensure that the Claude Code CLI forwards these requests to Anthropic accordingly without using the `/v1/messages` API, add a `*` passthrough route to your {{< reuse "agw-docs/snippets/backend.md" >}} resource as shown in this guide. 

1. Update your {{< reuse "agw-docs/snippets/backend.md" >}} resource to allow connections to the Claude Code CLI. The following example sets the default `/v1/messages` and a catch-all passthrough API endpoints, and allows you to use any model via the Claude Code CLI. 
   
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
         anthropic: {}
     policies:
       ai: 
         routes:
           '/v1/messages': Messages
           '*': Passthrough
       auth:
         secretRef:
           name: anthropic-secret
   EOF
   ```

2. Test the connection via the Claude Code CLI by sending a prompt. 
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Local host" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}

   Run the Claude Code CLI with a prompt: 
   ```sh
   ANTHROPIC_BASE_URL="http://$INGRESS_GW_ADDRESS:80" claude -p "What is a credit card"
   ```

   Start the Claude Code CLI terminal and start prompting it: 
   ```sh
   ANTHROPIC_BASE_URL="http://$INGRESS_GW_ADDRESS:80" claude
   ```
   {{% /tab %}}
   {{% tab tabName="Local host" %}}

   Run the Claude Code CLI with a prompt: 
   ```sh
   ANTHROPIC_BASE_URL="http://localhost:8080" claude -p "What is a credit card"
   ```

   Start the Claude Code CLI terminal and start prompting it: 
   ```sh
   ANTHROPIC_BASE_URL="http://localhost:8080" claude
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```console
   A credit card is a payment card issued by a financial institution (typically a bank) that allows the cardholder to borrow funds to pay for goods and services, with the agreement to repay the borrowed amount, usually with interest.

   ## Key characteristics:

   **How it works:**
   - The issuer extends a **credit limit** — the maximum you can spend
   - You make purchases on credit (borrowed money)
   - You receive a monthly statement
   - You can pay the full balance or a minimum payment

   **Costs:**
   - **APR (Annual Percentage Rate):** Interest charged on unpaid balances, typically 15-30%
   - **Annual fee:** Some cards charge a yearly fee
   - **Late fees:** Charged if you miss payment deadlines

   **Benefits:**
   - Build credit history/score
   - Purchase protections and fraud liability limits
   - Rewards (cashback, points, miles)
   - Emergency purchasing power

   **Key difference from a debit card:**
   - Debit cards draw directly from your bank account (your money)
   - Credit cards use borrowed money you repay later

   **Risks:**
   - Debt accumulation if balances aren't paid in full
   - High interest charges
   - Potential negative impact on credit score if mismanaged

   In short: a credit card is a short-term loan instrument that, when used responsibly, offers convenience and benefits, but can become costly if balances carry over month-to-month.
   ```

<!--

3. Add a prompt guard to your {{< reuse "agw-docs/snippets/backend.md" >}} resource. The following example rejects prompts that contain `credit card` with a custom message. 
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
         anthropic: {}
     policies:
       ai: 
         routes:
           '/v1/messages': Messages
           '*': Passthrough
         promptGuard:
           request:
           - response:
               message: "Rejected due to inappropriate content"
             regex:
               action: Reject
               matches:
               - "credit card"
       auth:
         secretRef:
           name: anthropic-secret    
   EOF
   ```

4. Repeat the same request. 
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Local host" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   ANTHROPIC_BASE_URL="http://$INGRESS_GW_ADDRESS:80" claude -p "What is a credit card"
   ```
   {{% /tab %}}
   {{% tab tabName="Local host" %}}

   Include a prompt: 
   ```sh
   ANTHROPIC_BASE_URL="http://localhost:8080" claude -p "What is a credit card"
   ```

   {{% /tab %}}
   {{< /tabs >}}

-->

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
