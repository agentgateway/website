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

{{< callout type="info" >}}
For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/llm/about/" >}}).
{{< /callout >}}

## Using the API

Send a request to the `/v1/models` endpoint to list models from the upstream provider.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl 'http://localhost:4000/v1/models'
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations](/docs/standalone/main/integrations/llm-clients/).

{{% /tab %}}
{{< /tabs >}}
