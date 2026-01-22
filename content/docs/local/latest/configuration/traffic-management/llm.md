---
title: AI (LLM) Policies
weight: 19
---

Attach to:
{{< badge content="Backend" link="/docs/configuration/backends/">}} (AI Backends only)

Agentgateway has a number of policies that can be used to control the behavior of the AI (LLM) model.
For more information on connecting to LLM providers, see [LLM consumption](/docs/llm).

|Policy| Details                                                                                            |
|---|----------------------------------------------------------------------------------------------------|
|`defaults`| Configure default values for settings in the request. For example, `temperature: 0.7`.             |
|`overrides`| Configure override values for settings in the request.                                             |
|`prompts`| Append or prepend additional prompts to requests.                                                  |
|`routes`| Control the type of LLM request, such as OpenAI Completions, Anthropic Messages, or Embeddings. |
|`promptGuard`| Authorize requests based on their prompts.                                                         |
|`modelAliases`| Configure aliases for model names.                                                                 |
|`promptCaching`| Configure automatic caching controls in requests.                                                  |