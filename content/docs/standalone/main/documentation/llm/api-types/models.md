---
title: Models
weight: 55
description: List available models through agentgateway using the OpenAI-compatible Models API.
test: skip
---

The Models API (`/v1/models`) lists the models that are available through the configured LLM provider.

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

With the default `llm.discovery: catalog` setting, wildcard model names such as `*` can expand into model IDs from the local model catalog. The expansion happens only when the public wildcard maps back to provider catalog names. If a wildcard uses an unsupported model transformation, or the catalog has no entries for that provider, `/v1/models` returns the configured wildcard pattern instead.

To list configured model names without catalog expansion, set `llm.discovery` to `disabled`.

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

> [!NOTE]
> For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/documentation/llm/about/" >}}).

## Using the API

With `llm.discovery: catalog`, send a request to the `/v1/models` endpoint to list the model IDs that the gateway serves.

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
