---
title: Models
weight: 55
description: List available models through agentgateway using the OpenAI-compatible Models API.
test: skip
---

The Models API (`/v1/models`) lists the models that clients can request through agentgateway.

## About

Agentgateway supports the OpenAI-compatible Models API. Use this endpoint when clients need to discover available model IDs, such as web UIs, SDKs, or developer tools that populate model selectors from `/v1/models`.

## Route type configuration

In the simplified `llm` configuration, agentgateway automatically maps `/v1/models` requests to the `models` route type, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

> [!NOTE]
> For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/documentation/llm/about/" >}}).

## Wildcard expansion {#wildcard-expansion}

Wildcard names in `llm.models`, such as `*` or `openai/*`, expand to matching model IDs in the `/v1/models` response. Agentgateway gets these IDs from the [model catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/#configure-a-model-catalog" >}}) entries for the model's provider. The catalog combines the built-in catalog with any sources that you configure.

For example, the `*` model in the preceding configuration lists every `openai` model in the catalog, such as `gpt-4o` and `gpt-5-mini`.

- **Model transformations**: Agentgateway reverses a `model` transformation to list the names that clients send. For example, `openai/*` with `llmRequest.model.stripPrefix("openai/")` lists names such as `openai/gpt-4o`. Agentgateway can reverse `stripPrefix`, `stripSuffix`, and transformations that add a fixed string before or after the model name.
- **API keys**: Agentgateway filters the list by `allowedModels` for the API key that sends the request.
- **Unexpanded patterns**: Agentgateway lists the pattern itself if the provider has no catalog entries, as with a typical `custom` provider. It also keeps the pattern if the model sets a fixed upstream model or uses a transformation that cannot be reversed.
- **No matches**: If the provider has catalog entries but none match the pattern, agentgateway leaves the model out of the list.

To list the configured names instead, as in version 1.5, set `llm.discovery: disabled`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  discovery: disabled
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

## Using the API

Send a request to `/v1/models` to list the models that agentgateway serves. Agentgateway builds the list from your configuration and the model catalog. It does not call the provider.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl 'http://localhost:4000/v1/models'
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations]({{< link-hextra path="/integrations/llm/clients/" >}}).

{{% /tab %}}
{{< /tabs >}}
