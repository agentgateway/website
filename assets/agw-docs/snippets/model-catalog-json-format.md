A model catalog is JSON with the following high-level structure. Field names are camelCase, and unknown fields are rejected.

{{% version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
```json
{
  "providers": {
    "<provider-id>": {
      "models": {
        "<model-name>": {
          "rates": {
            "input": "0.0",
            "output": "0.0",
            "cacheRead": "0.0",
            "cacheWrite": "0.0",
            "reasoning": "0.0",
            "inputAudio": "0.0",
            "outputAudio": "0.0"
          },
          "tiers": [
            {
              "contextOver": 200000,
              "rates": {
                "input": "0.0",
                "output": "0.0"
              }
            }
          ]
        }
      }
    }
  }
}
```
{{% /version %}}

{{% version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
```json
{
  "providers": {
    "<provider-id>": {
      "models": {
        "<model-name>": {
          "rates": {
            "input": "0.0",
            "output": "0.0",
            "cacheRead": "0.0",
            "cacheWrite": "0.0",
            "reasoning": "0.0",
            "inputAudio": "0.0",
            "outputAudio": "0.0"
          },
          "tiers": [
            {
              "contextOver": 200000,
              "rates": {
                "input": "0.0",
                "output": "0.0"
              }
            }
          ],
          "tags": ["<tag>"]
        }
      }
    }
  }
}
```
{{% /version %}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
For page-billed document models, set `perPage` instead of token rates. The following example charges `$0.005` for each page that the Mistral OCR model processes. The provider id must match the provider that serves the model, such as `mistral` for the native Mistral provider.

```json
{
  "providers": {
    "mistral": {
      "models": {
        "mistral-ocr-latest": {
          "rates": { "perPage": "0.005" }
        }
      }
    }
  }
}
```
{{% /version %}}

Key points:

- Lookups are by **provider id** (such as `openai`, `anthropic`, or `gcp.gemini`) and **model name** (such as `gpt-4o-mini`).
- Rates are **strings** (exact decimals), in **USD per 1,000,000 tokens**.
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}- `perPage` is **USD per page** for document or OCR models that report page usage, not USD per 1,000,000 tokens.{{< /version >}}
- If a rate is omitted, that token type is not priced for the model.
- `tiers[]` is optional. Each tier selects alternate `rates` when the request context length is **over** the tier's `contextOver` value. Tiers must be ordered by strictly increasing `contextOver`.
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}- To select rates by the service tier that the provider served, set `serviceTier` to `standard`, `flex`, `priority`, or `reserved`. Omit `serviceTier` to match any served tier. Omit `contextOver` to make the rule apply from zero context tokens. When tiers set `serviceTier`, the `contextOver` ordering applies separately to each group: the tiers for one `serviceTier`, and the tiers that omit `serviceTier`, must each be in strictly increasing `contextOver` order. Tiers in different groups can reuse the same `contextOver` value.{{< /version >}}
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}- To price Anthropic 1-hour cache writes separately, add `cacheWrite1h` beside `cacheWrite` in a model's `rates` or a tier's `rates`. If you omit `cacheWrite1h`, 1-hour cache writes use the `cacheWrite` rate.{{< /version >}}
{{% version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
- `tags[]` is optional. Tags describe a model instead of pricing it, so a model entry can carry tags with no rates at all.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,2.2.x" >}} For more information, see [Model tags](#model-tags).{{< /version >}}
{{% /version %}}
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
- A model entry can also carry descriptive metadata. Use `name` for the display name. Use `status` for `alpha`, `beta`, or `deprecated`. If `status` is omitted, the model is generally available.
- Use `released` for a `YYYY-MM-DD` or `YYYY-MM` release date.
- Use `limits` for token limits and `modalities` for accepted input and output types.
- Use `capabilities` for supported features. In `capabilities`, omitted fields are unknown.
- Use `reasoning` for accepted reasoning controls.

For example, the following model entry carries pricing and descriptive metadata:

```json
{
  "rates": { "input": "1", "output": "5", "cacheRead": "0.1" },
  "name": "Claude Haiku 4.5",
  "released": "2025-10-15",
  "limits": {
    "context": 200000,
    "output": 64000
  },
  "modalities": {
    "input": ["text", "image", "pdf"],
    "output": ["text"]
  },
  "capabilities": {
    "reasoning": true,
    "structuredOutput": true,
    "toolCall": true,
    "temperature": true
  },
  "reasoning": {
    "budgetTokens": {
      "min": 1024
    }
  }
}
```
{{% /version %}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
The following example adds a Flex tier that applies from zero context tokens, plus a second Flex tier for requests over 200,000 context tokens:

```json
{
  "tiers": [
    {
      "serviceTier": "flex",
      "rates": { "input": "1.0", "output": "6", "cacheRead": "0.1" }
    },
    {
      "contextOver": 200000,
      "serviceTier": "flex",
      "rates": { "input": "2.0", "output": "9", "cacheRead": "0.2" }
    }
  ]
}
```
{{% /version %}}

The following minimal example prices two OpenAI models and one tiered Gemini model:

```json
{
  "providers": {
    "openai": {
      "models": {
        "gpt-4o-mini": {
          "rates": { "input": "0.15", "output": "0.6", "cacheRead": "0.075" }
        }
      }
    },
    "gcp.gemini": {
      "models": {
        "gemini-2.5-pro": {
          "rates": { "input": "1.25", "output": "10", "cacheRead": "0.125" },
          "tiers": [
            {
              "contextOver": 200000,
              "rates": { "input": "2.5", "output": "15", "cacheRead": "0.25" }
            }
          ]
        }
      }
    }
  }
}
```
