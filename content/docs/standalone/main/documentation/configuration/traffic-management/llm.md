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
|`routes`| Control the type of LLM request, such as OpenAI Completions, Anthropic Messages, or Embeddings. |
|`promptGuard`| Authorize requests based on their prompts.                                                         |
|`modelAliases`| Configure aliases for model names.                                                                 |
|`promptCaching`| Configure automatic caching controls in requests.                                                  |

## Model resolution order {#llm-model-resolution-standalone}

The model that reaches the provider is resolved before provider-specific routes, request formats, token-count behavior, and response conversion are selected. Resolution starts with the client request model. If you set the provider `model` field, such as `provider.openAI.model`, that value replaces it. Then the `defaults`, `overrides`, and `transformations` policies apply, followed by `modelAliases`. The final resolved model is used for provider-specific behavior, such as Azure Foundry Claude routing, Bedrock endpoint selection, and Vertex Gemini path selection.

Access logs and traces can show both sides of model resolution. The `gen_ai.request.model` attribute records the resolved model that reaches the provider. When the client request model differs, the `agw.ai.original_model` attribute records the original model name that the client sent.

A request must have a model after resolution. If the client request omits `model`, set the provider `model` field, or supply one with a `defaults`, `overrides`, or `transformations` policy.

> [!NOTE]
> This order applies to AI backends. With the simplified `llm.models` configuration, the request must include `model`, because agentgateway uses it to select the model. A request without `model` fails with a `400` and the `missing_model` error code, even when the model sets `params.model`.
