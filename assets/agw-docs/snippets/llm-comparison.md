Review the following table to compare agentgateway's support of different LLM provider APIs.

| Provider | Chat Completions | Responses | Messages | Embeddings | Realtime | Count Tokens | Rerank |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| <img src="/integrations/providers/openai.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> OpenAI | ✅ | ✅ | ✅¹ | ✅ | ✅ | ✅² | - |
| <img src="/integrations/providers/anthropic.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Anthropic | ✅¹ | ◇ | ✅ | - | - | ✅ | - |
| <img src="/integrations/providers/bedrock.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Bedrock | ✅¹ | ✅¹ | ✅¹ | ✅¹ | - | ✅⁴ | ✅¹ |
| <img src="/integrations/providers/azure.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Azure | ✅ | ✅ | ✅¹ | ✅ | - | ✅² | ⚠️³ |
| <img src="/integrations/providers/gemini.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Gemini | ✅ | ✅¹ | ✅¹ | ✅ | - | ✅² | - |
| <img src="/integrations/providers/vertex.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Vertex AI | ✅⁴ | ◇ | ✅⁴ | ✅¹ | - | ✅⁴ | ✅¹ |
| <img src="/integrations/providers/copilot.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Copilot | ✅ | ✅ | ✅¹ | ◇ | - | ✅² | ⚠️³ |
| <img src="/integrations/providers/cohere.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Cohere | ✅ | ✅¹ | ✅¹ | ✅ | - | ✅² | ✅ |
| <img src="/integrations/providers/ollama.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Ollama | ✅ | ✅ | ✅¹ | ✅ | - | ✅² | - |
| <img src="/integrations/providers/baseten.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Baseten | ✅ | ✅¹ | ✅ | - | - | ✅² | - |
| <img src="/integrations/providers/cerebras.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Cerebras | ✅ | ✅¹ | ✅¹ | - | - | ✅² | - |
| <img src="/integrations/providers/deepinfra.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Deepinfra | ✅ | ✅¹ | ✅ | ✅ | - | ✅² | - |
| <img src="/integrations/providers/deepseek.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Deepseek | ✅ | ✅¹ | ✅ | - | - | ✅² | - |
| <img src="/integrations/providers/groq.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Groq | ✅ | ✅ | ✅¹ | - | - | ✅² | - |
| <img src="/integrations/providers/huggingface.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Hugging Face | ✅ | ✅ | ✅¹ | - | - | ✅² | - |
| <img src="/integrations/providers/mistral.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Mistral | ✅ | ✅¹ | ✅¹ | ✅ | - | ✅² | - |
| <img src="/integrations/providers/openrouter.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> OpenRouter | ✅ | ✅ | ✅ | ✅ | - | ✅² | ✅ |
| <img src="/integrations/providers/togetherai.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Together AI | ✅ | ✅¹ | ✅¹ | ✅ | - | ✅² | ✅ |
| <img src="/integrations/providers/xai.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> xAI | ✅ | ✅ | ✅¹ | - | ✅ | ✅² | - |
| <img src="/integrations/providers/fireworks.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Fireworks | ✅ | ✅ | ✅ | ✅ | - | ✅² | ✅ |

Legend:

| Symbol | Meaning                                                                        |
|--------|--------------------------------------------------------------------------------|
| ✅      | Supported natively                                                             |
| ✅¹     | Supported via Agentgateway translation                                         |
| ✅²     | Supported by a local estimate by Agentgateway                                  |
| ⚠️³    | Passthrough/provider-dependent; works only with a compatible upstream endpoint |
| ✅⁴     | Supported, but behavior depends on model family or provider route              |
| ◇      | Not currently implemented in Agentgateway                                      |
| -      | Provider does not offer this capability                                        |
