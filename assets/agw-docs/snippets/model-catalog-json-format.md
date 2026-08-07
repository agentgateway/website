A model cost catalog is JSON with the following high-level structure. Field names are camelCase, and unknown fields are rejected.

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

Key points:

- Lookups are by **provider id** (such as `openai`, `anthropic`, or `gcp.gemini`) and **model name** (such as `gpt-4o-mini`).
- Rates are **strings** (exact decimals), in **USD per 1,000,000 tokens**.
- If a rate is omitted, that token type is not priced for the model.
- `tiers[]` is optional. Each tier selects alternate `rates` when the request context length is **over** the tier's `contextOver` value. Tiers must be ordered by strictly increasing `contextOver`.

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
