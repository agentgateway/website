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

The model that reaches the provider is resolved before provider-specific routes, request formats, token-count behavior, and response conversion are selected. Resolution starts with the client request model, uses a provider `params.model` value when you set one, then applies LLM request transformations and `modelAliases`. The final resolved model is used for provider-specific behavior, such as Azure Foundry Claude routing, Bedrock endpoint selection, and Vertex Gemini path selection.

A request must have a model after resolution. If the client request omits `model`, set a provider `params.model` value or a transformation that supplies one.