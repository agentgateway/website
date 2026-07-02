---
title: Embeddings
weight: 35
description: Send embedding requests through agentgateway using the OpenAI-compatible Embeddings API.
test: skip
---

The Embeddings API (`/v1/embeddings`) creates vector representations of text that you can use for search, retrieval, clustering, and other semantic workflows.

## About

Agentgateway supports the OpenAI-compatible Embeddings API. Requests to `/v1/embeddings` are routed to your configured provider while agentgateway applies the same routing, authentication, observability, and policy framework that you use for other LLM traffic.

## Route type configuration

In the simplified `llm` configuration, agentgateway automatically maps `/v1/embeddings` requests to the `embeddings` route type, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

To configure the route type explicitly, use the `binds/listeners/routes` format and set the `embeddings` route type in the `policies.ai.routes` map.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 4000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI: {}
      policies:
        ai:
          routes:
            "/v1/embeddings": "embeddings"
        backendAuth:
          key: "$OPENAI_API_KEY"
```

{{< callout type="info" >}}
For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/llm/about/" >}}).
{{< /callout >}}

## Using the API

Send a request to the `/v1/embeddings` endpoint. The response includes an embedding vector for each input item.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl 'http://localhost:4000/v1/embeddings' \
--header 'Content-Type: application/json' \
--data '{
  "model": "text-embedding-3-small",
  "input": [
    "agentgateway routes LLM traffic",
    "embeddings turn text into vectors"
  ]
}'
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations](/docs/standalone/main/integrations/llm-clients/).

{{% /tab %}}
{{< /tabs >}}
