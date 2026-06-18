---
title: Providers
weight: 20
description: Configure agentgateway for first-class, OpenAI-compatible, and self-hosted LLM providers
test: skip
---

Learn how to configure agentgateway for a particular LLM {{< gloss "Provider" >}}provider{{< /gloss >}}.

## First-class providers

Use the dedicated provider pages when agentgateway already knows the upstream base URL and request format. This list includes Anthropic, OpenAI, and many OpenAI-compatible providers.

## OpenAI-compatible fallback

Use [OpenAI-compatible]({{< link-hextra path="/llm/providers/openai-compatible/" >}}) only for providers that do not have a first-class shortcut, such as Perplexity, vLLM, LM Studio, or another service that exposes the OpenAI API format.

### Override the upstream base URL

When you need a custom upstream endpoint, set `params.baseUrl` on the model instead of older host or path override fields.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    auth:
      key:
        value: "$PERPLEXITY_API_KEY"
    params:
      baseUrl: "https://api.perplexity.ai"
    tls: {}
```

## Authentication

For simplified `llm` configuration, upstream provider authentication is configured per model via `llm.models[].auth`. In routing-based configurations, use `policies.backendAuth` on a route instead.

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

Use `auth.key.location` only when a provider needs the credential somewhere other than its default location. For example, Azure often uses `api-key`:

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

These are the default auth mechanisms for the corresponding built-in providers, so you usually only need to override them when you need custom credential handling.

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
      aws: {}
  - name: "*"
    provider: azure
    auth:
      azure:
        implicit: {}
```

## Standalone upstream TLS

Use `llm.models[].tls` to configure TLS when connecting to an upstream provider. You might use this configuration to trust a private CA when using a self-hosted HTTPS endpoint. Common fields include `root` for a trusted CA bundle, `hostname` and `subjectAltNames` for upstream identity checks, `cert` and `key` for client certificates, and `keyExchangeGroups` for TLS negotiation. In agentgateway versions prior to 1.3, this model-level setting was called `backendTLS`.
