---
title: AI (LLM) Policies
weight: 19
---

Agentgateway has a number of policies that can be used to control the behavior of the AI (LLM) model.
For more information on connecting to LLMs, see [LLM consumption](/docs/llm).

**[Supported attachment points](/docs/configuration/policies/):** Backend (AI Backends only).

|Policy| Details                                                                                            |
|---|----------------------------------------------------------------------------------------------------|
|`defaults`| Configure default values for settings in the request. For example, `temperature: 0.7`.             |
|`overrides`| Configure override values for settings in the request.                                             |
|`prompts`| Append or prepend additional prompts to requests.                                                  |
|`routes`| Control the type of LLM request (such as OpenAI Completions, Anthropic Messages, Embeddings, etc). |
|`promptGuard`| Authorize requests based on their prompts.                                                         |
|`modelAliases`| Configure aliases for model names.                                                                 |
|`promptCaching`| Configure automatic caching controls in requests.                                                  |