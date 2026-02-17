---
title: Helicone
weight: 40
description: Integrate agentgateway with Helicone for LLM monitoring and caching
---

[Helicone](https://helicone.ai/) is an LLM observability platform with built-in caching, rate limiting, and cost tracking.

## Features

- **Request logging** - Log all LLM requests and responses
- **Caching** - Cache responses to reduce costs
- **Rate limiting** - Control request rates per user
- **Cost tracking** - Monitor spending across models
- **User analytics** - Track usage by user or session
- **Prompt templates** - Manage and version prompts

## Configuration

Helicone works as a proxy. Configure agentgateway to route through Helicone:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: oai.helicone.ai
        backendTLS: {}
        requestHeaderModifier:
          add:
            Helicone-Auth: "Bearer $HELICONE_API_KEY"
      backends:
      - ai:
          name: openai
          hostOverride: oai.helicone.ai:443
          provider:
            openAI:
              model: gpt-4o-mini
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
```

## Benefits with agentgateway

Using agentgateway with Helicone provides:

| Feature | agentgateway | Helicone | Combined |
|---------|--------------|----------|----------|
| Request routing | ✅ | ❌ | Route to multiple LLMs via Helicone |
| Caching | ❌ | ✅ | Helicone caches responses |
| Rate limiting | ✅ | ✅ | Layered rate limiting |
| Cost tracking | Basic | ✅ | Detailed cost analytics |
| MCP support | ✅ | ❌ | MCP with LLM monitoring |

## Learn more

- [Helicone Documentation](https://docs.helicone.ai/)
- [LLM Gateway]({{< link-hextra path="/llm/" >}})
