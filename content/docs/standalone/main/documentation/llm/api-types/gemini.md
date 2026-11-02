---
title: Gemini
weight: 33
description: Send requests through agentgateway in the native Gemini wire format, including streaming and token counting.
---

The native Gemini API (`models/{model}:generateContent`) is the wire format that the Gemini and Vertex AI SDKs send.

## About

The [Gemini API](https://ai.google.dev/api/generate-content) addresses a model through the request path rather than the request body, as `models/{model}:generateContent`. A client that is built on the Gemini or Vertex AI SDK sends this format directly, so pointing that client at agentgateway needs no OpenAI-compatible shim.

Two route types carry the format:

| Route type | Endpoints |
|------------|-----------|
| `generateContent` | `models/{model}:generateContent` and `models/{model}:streamGenerateContent` |
| `geminiCountTokens` | `models/{model}:countTokens` |

Because the model name comes from the path, any Gemini model works without a per-model entry in your configuration. The `tunedModels/{model}` form is preserved as well.

Native Gemini requests reach Gemini-family backends only:

- The Gemini API
- Vertex AI with a Gemini model
- A custom provider that advertises the `generateContent` format

A native Gemini request that is routed to any other provider is rejected with an unsupported-conversion error rather than translated.

> [!NOTE]
> Prompt guards apply to `generateContent` and `streamGenerateContent`. They are skipped for `geminiCountTokens`, which counts tokens and never reaches a model. Thinking configuration in `generationConfig.thinkingConfig`, returned thought parts, and `thoughtsTokenCount` all pass through unchanged.

## Route type configuration

In the simplified `llm` configuration, agentgateway maps the three Gemini path suffixes to their route types, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: gemini
    params:
      apiKey: "$GEMINI_API_KEY"
```

In the `gateways` and `routes` format, set the route types in the `policies.ai.routes` map. This map is required in this format: traffic that matches no entry is handled as chat completions, and a Gemini request then fails to parse.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 4000
routes:
- backends:
  - ai:
      name: gemini
      provider:
        gemini: {}
  policies:
    ai:
      routes:
        ":generateContent": "generateContent"
        ":streamGenerateContent": "generateContent"
        ":countTokens": "geminiCountTokens"
    backendAuth:
      key: "$GEMINI_API_KEY"
```

The keys are matched as path suffixes, so a leading colon matches the Gemini method suffix whatever version prefix the client sends.

> [!NOTE]
> For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/documentation/llm/about/" >}}).

## Using the API

Send a request to `models/{model}` with the Gemini method suffix. Agentgateway forwards the body unchanged and returns the Gemini response shape to the client.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl -X POST 'http://localhost:4000/v1beta/models/gemini-2.5-flash:generateContent' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Say hello"}]
      }
    ]
  }'
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations]({{< link-hextra path="/integrations/llm/clients/" >}}).

{{% /tab %}}
{{< /tabs >}}

To estimate the size of a request before you send it, use the `:countTokens` suffix with the same body.

```shell
curl -X POST 'http://localhost:4000/v1beta/models/gemini-2.5-flash:countTokens' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "How many tokens are in this request?"}]
      }
    ]
  }'
```

## Streaming

Streaming uses the `:streamGenerateContent` suffix, and requires the `alt=sse` query parameter.

```shell
curl -N 'http://localhost:4000/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Count to five"}]
      }
    ]
  }'
```

Without `alt=sse`, the Gemini API streams a JSON array instead of server-sent events, which agentgateway cannot parse incrementally. Rather than fail partway through a response, agentgateway rejects the request before it reaches the provider.

```json
{
  "error": {
    "code": 400,
    "message": "streamGenerateContent requires alt=sse; the JSON-array streaming variant is not supported",
    "status": "INVALID_ARGUMENT"
  }
}
```

For Gemini-specific provider settings, see the [Gemini]({{< link-hextra path="/integrations/llm/providers/gemini/" >}}) and [Vertex AI]({{< link-hextra path="/integrations/llm/providers/vertex/" >}}) provider guides.
