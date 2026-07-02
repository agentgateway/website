---
title: Rerank
weight: 45
description: Send rerank requests through agentgateway using the Cohere-compatible Rerank API.
test: skip
---

The Rerank API (`/v2/rerank`) scores a list of documents against a query and returns the most relevant results in ranked order.

## About

Agentgateway supports the Cohere-compatible Rerank API. Use rerank when you already have a candidate set of documents, such as from keyword search or vector search, and want a model to reorder those documents by relevance to a query.

Agentgateway also recognizes `/v1/rerank` as a rerank route, but `/v2/rerank` is the Cohere-compatible endpoint.

## Route type configuration

In the simplified `llm` configuration, agentgateway automatically maps `/v2/rerank` requests to the `rerank` route type, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: cohere
    params:
      apiKey: "$COHERE_API_KEY"
```

To configure the route type explicitly, use the `binds/listeners/routes` format and set the `rerank` route type in the `policies.ai.routes` map.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 4000
  listeners:
  - routes:
    - backends:
      - ai:
          name: cohere
          provider:
            cohere: {}
      policies:
        ai:
          routes:
            "/v2/rerank": "rerank"
        backendAuth:
          key: "$COHERE_API_KEY"
```

{{< callout type="info" >}}
For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/llm/about/" >}}).
{{< /callout >}}

## Using the API

Send a request to the `/v2/rerank` endpoint with a query and candidate documents. The response ranks the documents by relevance.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl 'http://localhost:4000/v2/rerank' \
--header 'Content-Type: application/json' \
--data '{
  "model": "rerank-v3.5",
  "query": "What does agentgateway do?",
  "documents": [
    "agentgateway routes, secures, and observes agent and LLM traffic.",
    "A bicycle drivetrain transfers power from pedals to wheels.",
    "Vector databases store embeddings for semantic search."
  ],
  "top_n": 2
}'
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations](/docs/standalone/main/integrations/llm-clients/).

{{% /tab %}}
{{< /tabs >}}

For more information about configuring Cohere, see the [Cohere provider]({{< link-hextra path="/llm/providers/cohere/" >}}) guide.
