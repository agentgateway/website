---
title: AI (LLM) Policies
weight: 19
description: Configure policies to control AI model behavior and prompt handling.
---

Attaches to: {{< badge content="Backend" path="/documentation/configuration/backends/">}} (AI Backends only)

Agentgateway has a number of policies that can be used to control the behavior of the AI (LLM) model.
For more information on connecting to LLM providers, see [LLM consumption]({{< link-hextra path="/documentation/llm" >}}).

|Policy| Details                                                                                            |
|---|----------------------------------------------------------------------------------------------------|
|`defaults`| Configure default values for settings in the request. For example, `temperature: 0.7`.             |
|`overrides`| Configure override values for settings in the request.                                             |
|`prompts`| Append or prepend additional prompts to requests.                                                  |
|`routes`| Control the LLM request type, such as OpenAI Completions, OpenAI Decisions, Anthropic Messages, or Embeddings. |
|`promptGuard`| Authorize requests based on their prompts.                                                         |
|`modelAliases`| Configure aliases for model names.                                                                 |
|`promptCaching`| Add prompt-cache markers to requests automatically. See [Prompt caching](#prompt-caching).          |

## Prompt caching {#prompt-caching}

The `promptCaching` policy adds prompt-cache markers to requests, so that the provider can reuse a cached prompt prefix. It works with Anthropic, with Claude models on Vertex AI, and with Claude 3 and later and Nova models on Amazon Bedrock.

Set `promptCaching` on a model in `llm.models`, or in the `policies.ai` block of a route or AI backend.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "anthropic/*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("anthropic/")
    promptCaching:
      cacheTools: true
```

`promptCaching: {}` uses the defaults: `cacheSystem: true`, `cacheMessages: true`, `cacheTools: false`, and `minTokens: 1024`.

- `cacheSystem` marks the system prompt. `cacheMessages` marks the last message before the current turn. To move that marker further back, set `cacheMessageOffset`. `cacheTools` marks the last tool definition.
- `minTokens` applies only to the system prompt. Agentgateway estimates the token count as the word count times 1.3.
- If a request already has prompt-cache markers, the policy adds none.
- For Bedrock Nova models, the policy ignores `cacheTools`, because Nova does not accept cache points on tool definitions.

## Model resolution order {#llm-model-resolution-standalone}

The model that reaches the provider is resolved before provider-specific routes, request formats, token-count behavior, and response conversion are selected. Resolution starts with the client request model. If you set the provider `model` field, such as `provider.openAI.model`, that value replaces it. Then the `defaults`, `overrides`, and `transformations` policies apply, followed by `modelAliases`. The final resolved model is used for provider-specific behavior, such as Azure Foundry Claude routing, Bedrock endpoint selection, and Vertex Gemini path selection.

A request must have a model after resolution. If the client request omits `model`, set the provider `model` field, or supply one with a `defaults`, `overrides`, or `transformations` policy.

> [!NOTE]
> This order applies to AI backends. With the simplified `llm.models` configuration, the request must include `model`, because agentgateway uses it to select the model. A request without `model` fails with a `400` and the `missing_model` error code, even when the model sets `params.model`.
