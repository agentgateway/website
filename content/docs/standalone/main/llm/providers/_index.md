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
    provider: openAI
    auth:
      key:
        value: "$OPENAI_API_KEY"
```

Use `auth.key.location` to place the credential somewhere other than the default header (for example, Azure often uses `api-key`):

```yaml
llm:
  models:
  - name: "*"
    provider: azure
    auth:
      key:
        value: "$AZURE_API_KEY"
        location:
          header:
            name: api-key
```

### Credential passthrough

To forward the validated incoming JWT to the upstream provider, use `passthrough`:

```yaml
llm:
  models:
  - name: "*"
    provider: openAI
    auth:
      passthrough: {}
```

### Cloud provider auth

- **Google Cloud**: `auth.gcp` uses Application Default Credentials (ADC) and can fetch an access token or ID token (depending on the `type` you select).
- **AWS**: `auth.aws` signs upstream requests with SigV4 using standard AWS credentials (for example, environment variables, an instance profile, or a shared config profile).
- **Azure**: `auth.azure` uses Entra ID. `auth.azure.implicit` uses the Azure SDK's `DefaultAzureCredential` to discover credentials automatically.

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

Use `llm.models[].tls` to configure TLS when connecting to an upstream provider (for example, to trust a private CA when using a self-hosted HTTPS endpoint). Common fields include `root` for a trusted CA bundle, `hostname` and `subjectAltNames` for upstream identity checks, `cert` and `key` for client certificates, and `keyExchangeGroups` for TLS negotiation. In agentgateway versions prior to 1.3, this model-level setting was called `backendTLS`.

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
