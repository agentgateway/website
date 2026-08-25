A tag is a freeform string on a model entry that describes the model rather than prices it. Tags let one catalog carry model attributes next to cost data, so you can change how {{< reuse "agw-docs/snippets/agentgateway.md" >}} treats a model by editing the catalog instead of the gateway configuration.

Because tags are independent of pricing, a model entry can carry tags and no rates.

```json
{
  "providers": {
    "copilot": {
      "models": {
        "grok-2": {
          "tags": ["openai_completions"]
        }
      }
    }
  }
}
```

### Chat format tags

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} interprets one family of tag values today: the request formats that a GitHub Copilot model accepts. Copilot exposes different endpoints for different models, so {{< reuse "agw-docs/snippets/agentgateway.md" >}} keeps a built-in list per model and converts the client's request into a format on that list. Tag a model to replace the built-in list, for example when GitHub changes which endpoints a model serves.

| Tag | Request format |
|-----|----------------|
| `openai_completions` | OpenAI Chat Completions |
| `openai_responses` | OpenAI Responses |
| `anthropic_messages` | Anthropic Messages |
| `bedrock_converse` | Amazon Bedrock Converse |
| `vertex_gemini` | Google Vertex AI Gemini |

The tags apply as follows.

- A model entry that carries at least one tag from this table replaces the built-in list for that model. Only the formats that you tag are accepted, so list every format that the model serves.
- A model entry with no tags, or with only tags outside this table, keeps the built-in list.
- {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} lowercases the requested model name before it looks up tags. Write model names in the catalog in lowercase, otherwise the lookup misses and the built-in list applies.
- A client request in a format that the model does not accept fails with an unsupported conversion error that lists the accepted formats.

These tags apply only to the `copilot` provider, which is available in standalone mode. Tag values outside this table are stored and merged, but {{< reuse "agw-docs/snippets/agentgateway.md" >}} does not act on them yet.

### How tags merge

Catalog sources are merged in order. Tags merge differently from the pricing fields, so a later source can add a tag without restating the earlier source's costs.

| Field | Merge behavior |
|-------|----------------|
| `rates` | Field by field. A later source overrides only the rates that it sets. |
| `tiers` | Whole list. A later source that sets `tiers` replaces the earlier list. |
| `tags` | Union. A later source adds to the earlier tags. |

Because tags union, you cannot remove a tag in a later source. To change a model's tags, edit the source that sets them.

> [!WARNING]
> Tag lookup is by model name only, and it ignores the provider. If two providers in your catalog define the same model name and both set tags, only one of the two tag sets is used. Keep tagged model names unique across the providers in your catalog.
