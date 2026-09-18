A tag is a freeform string on a model entry that describes the model rather than pricing it. Tags let one catalog carry model attributes next to cost data, so you can change how {{< reuse "agw-docs/snippets/agentgateway.md" >}} treats a model by editing the catalog instead of the gateway configuration.

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

Some providers expose different endpoints for different models, so {{< reuse "agw-docs/snippets/agentgateway.md" >}} keeps a built-in list of accepted request formats per model and converts the client's request into a format on that list. Tags override that list for a single model, which matters when a provider changes which endpoints a model serves.

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
- {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} lowercases the requested model name before it looks up tags. Write model names in the catalog in lowercase; otherwise, the lookup misses, and the built-in list applies.
- A client request in a format that the model does not accept fails with an unsupported conversion error that lists the accepted formats.

{{< version include-if="1.5.x" >}}These tags apply only to the `copilot` provider, which is available in standalone mode. Tag values that are not listed in this table are stored and merged, but {{< reuse "agw-docs/snippets/agentgateway.md" >}} does not act on them yet.{{< /version >}}{{< version exclude-if="1.5.x" >}}These tags apply to the `copilot` provider, which is available in standalone mode, and to the Amazon Bedrock models that the Mantle endpoint serves. The `aws-bedrock-mantle` import source sets them on Bedrock models for you.{{< /version >}}

{{% version exclude-if="1.5.x" %}}
### Bedrock endpoint tags

Two tags record which Amazon Bedrock API surface serves a model. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} reads them when it picks the endpoint for a chat request, together with the endpoint preference on the Bedrock provider.

| Tag | Meaning |
|-----|---------|
| `runtime` | The model is served on the Bedrock Runtime endpoint, which carries the Converse and Invoke APIs. |
| `mantle` | The model is served on the Bedrock Mantle endpoint, which carries the native OpenAI and Anthropic APIs. |

A model can carry both tags, which means that either endpoint serves it. Run `agctl catalog import` with the default sources to populate these tags, because `aws-bedrock-mantle` reads them from the AWS model cards. For the preference setting that consumes them, see [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).

### Other tags

Tag values that are not listed in the tables above are stored and merged, but {{< reuse "agw-docs/snippets/agentgateway.md" >}} does not act on them yet.
{{% /version %}}

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
