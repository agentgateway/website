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
|`promptGuard`| Authorize requests based on their prompts. For personally identifiable information (PII) detection, `promptGuard` treats a number as credit card data only when the number passes the Luhn checksum. |
|`modelAliases`| Configure aliases for model names.                                                                 |
|`promptCaching`| Configure automatic caching controls in requests.                                                  |
