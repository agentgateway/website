Review the following table to compare agentgateway's support of different LLM provider APIs.

| Provider | Chat Completions | Responses | Messages | Embeddings | Realtime | Count Tokens | Rerank |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| <img class="provider-icon-invert-dark" src="/integrations/providers/openai.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> OpenAI | ✅ | ✅ | ✅¹ | ✅ | ✅ | ✅² | ⚠️³ |
| <img class="provider-icon-invert-dark" src="/integrations/providers/anthropic.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Anthropic | ✅¹ | ◇ | ✅ | - | - | ✅ | - |
| <img src="/integrations/providers/bedrock.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Bedrock | ✅⁴ | ✅⁴ | ✅⁴ | ✅¹ | - | ✅⁴ | ✅¹ |
| <img src="/integrations/providers/azure.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Azure | ✅⁴ | ✅⁴ | ✅⁴ | ✅ | - | ✅⁴ | ⚠️³ |
| <img src="/integrations/providers/gemini.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Gemini | ✅¹ | ✅¹ | ✅¹ | ✅ | - | ✅² | - |
| <img src="/integrations/providers/vertex.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Vertex AI | ✅⁴ | ✅⁴ | ✅⁴ | ✅¹ | - | ✅⁴ | ✅¹ |
| <img class="provider-icon-invert-dark" src="/integrations/providers/copilot.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Copilot | ✅⁴ | ✅⁴ | ✅⁴ | ✅{{< version include-if="1.7.x" >}}⁵{{< /version >}} | - | ✅² | ⚠️³ |
| <img src="/integrations/providers/cohere.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Cohere | ✅ | ✅¹ | ✅¹ | ✅ | - | ✅² | ✅ |
| <img class="provider-icon-invert-dark" src="/integrations/providers/ollama.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Ollama | ✅ | ✅ | ✅¹ | ✅ | - | ✅² | - |
| <img class="provider-icon-invert-dark" src="/integrations/providers/baseten.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Baseten | ✅ | ✅¹ | ✅ | - | - | ✅² | - |
| <img src="/integrations/providers/cerebras.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Cerebras | ✅ | ✅¹ | ✅¹ | - | - | ✅² | - |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}}
| <img src="/integrations/providers/coreweave.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> CoreWeave Serverless Inference | ✅ | ✅¹ | ✅¹ | - | - | ✅² | - |{{< /version >}}
| <img src="/integrations/providers/deepinfra.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Deepinfra | ✅ | ✅¹ | ✅ | ✅ | - | ✅² | - |
| <img src="/integrations/providers/deepseek.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> DeepSeek | ✅ | ✅ | ✅ | - | - | ✅² | - |
| <img src="/integrations/providers/groq.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Groq | ✅ | ✅ | ✅¹ | - | - | ✅² | - |
| <img src="/integrations/providers/huggingface.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Hugging Face | ✅ | ✅ | ✅¹ | - | - | ✅² | - |
| <img src="/integrations/providers/mistral.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Mistral | ✅ | ✅¹ | ✅¹ | ✅ | - | ✅² | - |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}}
| <img class="provider-icon-invert-dark" src="/integrations/providers/nebius.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Nebius Token Factory | ✅ | ✅¹ | ✅¹ | ✅ | - | ✅² | - |{{< /version >}}
| <img class="provider-icon-invert-dark" src="/integrations/providers/openrouter.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> OpenRouter | ✅ | ✅ | ✅ | ✅ | - | ✅² | ✅ |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
| <img src="/integrations/providers/perplexity.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Perplexity | ◇ | ✅ | ✅¹ | - | - | ✅² | - |{{< /version >}}
| <img class="provider-icon-invert-dark" src="/integrations/providers/togetherai.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Together AI | ✅ | ✅¹ | ✅¹ | ✅ | - | ✅² | ✅ |
| <img class="provider-icon-invert-dark" src="/integrations/providers/xai.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> xAI | ✅ | ✅ | ✅¹ | - | ✅ | ✅² | - |
| <img src="/integrations/providers/fireworks.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Fireworks | ✅ | ✅ | ✅ | ✅ | - | ✅² | ✅ |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
| <img src="/integrations/providers/meta.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:0.4rem;"> Meta | ✅ | ✅ | ✅ | ◇ | ◇ | ✅² | ◇ |{{< /version >}}

Legend:

| Symbol | Meaning                                                                        |
|--------|--------------------------------------------------------------------------------|
| ✅      | Supported natively                                                             |
| ✅¹     | Supported via Agentgateway translation                                         |
| ✅²     | Supported by a local estimate by Agentgateway                                  |
| ⚠️³    | Passthrough/provider-dependent; works only with a compatible upstream endpoint |
| ✅⁴     | Supported, but behavior depends on model family or provider route              |{{< version include-if="1.7.x" >}}
| ✅⁵     | Supported only when `input` is an array of strings                             |{{< /version >}}
| ◇      | Not currently implemented in Agentgateway                                      |
| -      | Provider does not offer this capability                                        |

{{% version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" %}}
For the providers that accept OpenAI Decisions and TypeSafe SystemOne requests, and how agentgateway translates between the two formats, see [Decisions]({{< link-hextra path="/documentation/llm/api-types/decisions/#supported-providers" >}}).
{{% /version %}}
