Review the following table to compare agentgateway's support of different LLM provider APIs.

| API | OpenAI | Anthropic | Amazon Bedrock | Azure OpenAI | Google Gemini | Google Vertex AI |
|-----|:------:|:---------:|:--------------:|:------------:|:-------------:|:----------------:|
| Completions<br>`/v1/chat/completions` | ✅ Native | ✅ Translation | ✅ Translation| ✅ Native | ✅ Native`*`| ✅ Native`†` | 
| Responses<br>`/v1/responses` | ✅ Native  | ❌ No |  ✅ Translation| ✅ Native| ❌ No | ❌ No |
| Messages<br>`/v1/messages` |  ❌ No  | ✅ Native |  ✅ Translation | ❌ No | ❌ No | ✅ Native`†` |
| Embeddings<br>`/v1/embeddings` | ✅ Native | ❌ No |  ✅ Translation | ✅ Native | ❌ No | ✅ Translation |
| Realtime<br>`/v1/realtime` | ✅ Native  | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| Token Count<br>`/v1/messages/count_tokens` | ❌ No | ✅ Native|  ✅ Translation | ❌ No| ❌ No | ✅ Translation |

**Notes**:
- **✅ Native**: Agentgateway has complete support for the API, and the provider supports the API natively. This allows Agentgateway to passthrough unknown fields without change. As such, even if you use extra fields or new models, the proxying likely works.
- **✅ Translation**: Agentgateway translates from one API to another. As such, agentgateway only supports fields that it aware of. New models or LLM APIs require code changes that can impact functionality. For example, Opus 4.6 added adaptive thinking, which required updates to agentgateway's support of Amazon Bedrock. In the interim, using the Opus 4.6 model on Bedrock was not supported.
- **❌ No**: Agentgateway does not currently support the API for this provider.
- `*`: Agentgateway supports the API natively via a compatibility endpoint. Note that Google Gemini does a translation for their Completions API support.
- `†`: Agentgateway supports the API natively via translation to Anthropic. Support in Vertex AI differs depending on the model type.
- Both streaming and non-streaming options for the Completions, Responses, and Messages APIs are supported.
