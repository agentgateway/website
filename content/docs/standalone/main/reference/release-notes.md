---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway standalone release.
test: skip
---

Review the release notes for agentgateway standalone.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## 🔥 Breaking changes {#v15-breaking-changes}

### LLM input and total token counts include cache tokens

<!-- ref: https://github.com/agentgateway/agentgateway/pull/2880 -->

LLM providers disagree about whether the input token count in a response includes the tokens that the provider read from or wrote to its prompt cache. Anthropic and Amazon Bedrock exclude cached tokens from the input count. OpenAI, Azure OpenAI, and Google Gemini include them. Agentgateway used to pass each provider's number through unchanged, so the same prompt produced different token counts depending on which provider served it.

Agentgateway now normalizes the counts so that they mean the same thing for every provider.

- `llm.inputTokens` is the total input count, including cache-read and cache-creation tokens.
- `llm.totalTokens` is the normalized input count plus the output count.
- `llm.providerInputTokens` is a new field that reports the input count exactly as the provider sent it.
- `llm.providerTotalTokens` is a new field that reports the total count exactly as the provider sent it.

The `llm.cachedInputTokens` and `llm.cacheCreationInputTokens` fields do not change. Both are now always a subset of `llm.inputTokens`, for every provider.

Only the providers that previously excluded cached tokens report different values. Those providers are Anthropic, Amazon Bedrock, Anthropic models served through Vertex AI or GitHub Copilot, and custom providers that use the `messages` or `anthropicTokenCount` format. Requests that do not use prompt caching are not affected, because the cache-read and cache-creation counts are zero.

The normalized counts reach every feature that reads a token count. This includes the `gen_ai.usage.input_tokens` log and span field, the `agentgateway_gen_ai_client_token_usage` metric, token-based rate limits, and any CEL expression that reads `llm.inputTokens` or `llm.totalTokens`. Cost tracking and the `llm.cost` field do not change, because the model cost catalog already priced cache-read and cache-creation tokens separately.

**Actions to take**: To keep the provider's unmodified value in a CEL expression, custom log field, custom metric, or rate limit descriptor, read `llm.providerInputTokens` or `llm.providerTotalTokens` instead. Review each token-based rate limit that you sized against a provider that excluded cached tokens, because requests now consume the limit sooner. Annotate the upgrade in any dashboard that trends input tokens, so that the step change is not read as a traffic change.

To restore the previous behavior while you migrate, set the `AGENTGATEWAY_LEGACY_LLM_USAGE_TOKEN_SEMANTICS` environment variable to `true` in the environment that the agentgateway process runs in. Agentgateway plans to remove this variable after version 1.5, so treat it as a short-term migration aid and not as a supported configuration.

For guidance on which field to read, see [Token usage fields]({{< link-hextra path="/llm/observability/#token-usage-fields" >}}). For the full list of fields in the CEL context, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).
