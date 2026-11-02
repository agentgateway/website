---
title: Providers
weight: 10
description: Configure agentgateway for first-class, OpenAI-compatible, and self-hosted LLM providers
---

Learn how to configure agentgateway for a particular LLM {{< gloss "Provider" >}}provider{{< /gloss >}}.

To manage models and providers on a running gateway from the command line, see [Manage config resources with agctl]({{< link-hextra path="/documentation/operations/config-resources/#agctl" >}}).

## First-class providers

Use the dedicated provider pages when agentgateway already knows the upstream base URL and request format. This list includes Anthropic, OpenAI, and many more!

## Custom providers

Use [Custom providers]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) only for providers that do not have a first-class shortcut. Examples include vLLM, LM Studio, or another service that exposes a compatible [API format]({{< link-hextra path="/documentation/llm/api-types/" >}}).

{{< reuse "agw-docs/snippets/model-exposure-patterns-tip.md" >}}

## Authentication

For simplified `llm` configuration, upstream provider authentication is configured per model via `llm.models[]` (typically `params.apiKey` for API-key providers, and `auth` for cloud-native flows). In routing-based configurations, use `policies.backendAuth` on a route instead.

### API key

You can set a model's API key in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Models**, and click **Add model**, or click the **Edit model** icon for an existing model.
2. For the **Provider API key**, select how to provide the key.
   * **Env var**: Enter the name of an environment variable, such as `OPENAI_API_KEY`. The UI saves the value as `$OPENAI_API_KEY`. The variable must be set when agentgateway starts.
   * **API key**: Enter the key value. The UI saves the raw value in your configuration.
   * **File**: Enter the path to a file that contains the key.

   {{< reuse-image src="img/ui-llm-add-model.png" srcDark="img/ui-llm-add-model-dark.png" alt="Add model drawer with OpenAI selected as the provider and Env var selected for the provider API key, with OPENAI_API_KEY as the variable name" >}}

3. Click **Save model**.

Amazon Bedrock and Gemini Enterprise (GCP Vertex) show cloud credential options instead. For Azure, select **API key** in the **Azure credentials** field to see the same choices. The form has no field for `auth.key.location`. To set it, click the **Raw** icon (`<>`) in the drawer header, or use the **Config file** tab.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{% /tab %}}
{{< /tabs >}}

Use `auth.key.location` only when a provider needs the credential somewhere other than its default location. For example, Azure often uses `api-key`:

```yaml
llm:
  models:
  - name: "*"
    provider:
      custom:
        formats:
        - type: completions
    auth:
      key:
        value: "$API_KEY"
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

This example sets authentication explicitly for each cloud provider. It uses [provider prefixes]({{< link-hextra path="/documentation/llm/about/#provider-prefix" >}}), such as `bedrock/*`, to route requests to the matching provider.

```yaml
llm:
  models:
  - name: "vertex/*"
    provider: vertex
    params:
      vertexProject: my-project-id
      vertexRegion: us-central1
    auth:
      gcp:
        type: accessToken
    transformation:
      model: llmRequest.model.stripPrefix("vertex/")
  - name: "bedrock/*"
    provider: bedrock
    params:
      awsRegion: us-west-2
    auth:
      aws: {}
    transformation:
      model: llmRequest.model.stripPrefix("bedrock/")
  - name: "azure/*"
    provider: azure
    params:
      azureResourceName: my-resource-name
      azureResourceType: openAI
    auth:
      azure:
        implicit: {}
    transformation:
      model: llmRequest.model.stripPrefix("azure/")
```

## Standalone upstream TLS

Use `llm.models[].tls` to configure advanced TLS when connecting to an upstream provider.
When using built in providers, default TLS settings are used.
When using custom a `baseUrl`, the `https://` scheme will automatically use TLS.

However, if you need advanced configurations such as client certificates or customized verification steps, you may set fields such as `root` for a trusted CA bundle, `hostname` and `subjectAltNames` for upstream identity checks, `cert` and `key` for client certificates.
