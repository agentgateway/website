---
title: Providers
weight: 20
description: Configure agentgateway for OpenAI-compatible and self-hosted LLM providers
test: skip
---

Learn how to configure agentgateway for a particular LLM {{< gloss "Provider" >}}provider{{< /gloss >}}.

## Standalone authentication

In standalone mode, upstream provider authentication is configured per model via `llm.models[].auth`. (In routing-based configurations, use `policies.backendAuth` on a route instead.)

### API key

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openai
    auth:
      key:
        value: "$OPENAI_API_KEY"
```

### Credential passthrough

To forward the validated incoming JWT to the upstream provider, use `passthrough`:

```yaml
llm:
  models:
  - name: "*"
    provider: openai
    auth:
      passthrough: {}
```

### Cloud provider auth

- **Google Cloud**: `auth.gcp` uses Application Default Credentials (ADC) to fetch an access token or ID token.
- **AWS**: `auth.aws` signs upstream requests with SigV4 using implicit or explicit AWS credentials.
- **Azure**: `auth.azure` uses Entra ID (implicit or explicit configuration).

```yaml
llm:
  models:
  - name: "*"
    provider: vertex
    auth:
      gcp:
        type: accessToken
  - name: "*"
    provider: bedrock
    auth:
      aws:
        serviceName: bedrock
  - name: "*"
    provider: azure
    auth:
      azure:
        implicit: {}
```

## Standalone upstream TLS

Use `llm.models[].tls` to configure TLS when connecting to an upstream provider (for example, to enable HTTPS for a self-hosted model endpoint). `backendTLS` is a deprecated alias for the same setting.

## OpenAI-compatible providers

Popular OpenAI-compatible providers include xAI (Grok), Cohere, Together AI, Groq, DeepSeek, Mistral, Perplexity, and Fireworks AI.

Additional self-hosted solutions like vLLM and LM Studio are also supported through the [OpenAI-compatible]({{< link-hextra path="/llm/providers/openai-compatible/" >}}) configuration.

### Path prefix

When using the advanced `binds/listeners/routes` configuration, you can set `pathPrefix` on an AI provider to prepend a custom path to all API requests. Use `pathPrefix` when routing through a proxy or custom API endpoint that requires a different base path.

```yaml
backends:
- ai:
    name: openai
    pathPrefix: /custom/v1
    provider:
      openAI:
        model: gpt-4o-mini
  policies:
    backendAuth:
      key: "$OPENAI_API_KEY"
```
