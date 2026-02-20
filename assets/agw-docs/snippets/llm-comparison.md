Review the following table to compare agentgateway's support of different LLM provider APIs.

- **Native**: Agentgateway supports the API natively, mostly via passthrough. As such, even if you use extra fields or new models, the proxying likely works.
- **Translation**: Agentgateway translates from one API to another. As such, agentgateway only supports fields that it aware of. New models or LLM APIs require code changes that can impact functionality. For example, Opus 4.6 added adaptive thinking, which required updates to agentgateway's support of Amazon Bedrock. In the interim, using the Opus 4.6 model on Bedrock was not supported.
- **Not supported**: Agentgateway does not currently support the API.

| API | OpenAI | Anthropic | Amazon Bedrock | Azure OpenAI | Google Gemini | Google Vertex AI |
|-----|:------:|:---------:|:--------------:|:------------:|:-------------:|:----------------:|
| Completions | ✅ Native | ✅ Translation | ✅ Translation| ✅ Native | ✅ Native (via compatibility endpoint)| ✅ Native (via translation to Anthropic) | 
| Streaming | ✅ Native | ✅ Native | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| Responses | ✅ Native  | ❌ Not supported |  ✅ Translation| ✅ Native| ❌ Not supported | ❌ Not supported |
| Messages |  | ❌ Not supported  | ✅ Native |  ✅ Translation | ❌ Not supported | ❌ Not supported | ✅ Native (via translation to Anthropic)
| Embeddings | ✅ Native | ❌ Not supported |  ✅ Translation | ✅ Native | ❌ Not supported | ✅ Translation |
| Realtime| ✅ Native  | ❌ Not supported | ❌ Not supported | ❌ Not supported | ❌ Not supported | ❌ Not supported |
| Token Count | ❌ Not supported | ✅ Native|  ✅ Translation | ❌ Not supported| ❌ Not supported | ✅ Translation |