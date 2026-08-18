---
title: Import a configuration
weight: 11
description: Convert a LiteLLM proxy configuration into an agentgateway standalone configuration and review compatibility findings.
prev: /configuration/overview
next: /configuration/gateways
test: skip
---

Use the agentgateway configuration importer to migrate a file-based configuration from another standalone AI gateway. The importer converts supported settings into a valid agentgateway YAML configuration and reports how each source field was handled.

Currently, the importer supports LiteLLM proxy configuration files. Support for additional source gateways can be added to the same import command in future releases.

> [!WARNING]
> An imported configuration can be valid without being behaviorally identical to the source configuration. Review every compatibility finding and test the generated configuration before using it in production.

Compatibility is field-based rather than whole-config parity. The importer converts only the [supported LiteLLM mappings](#supported-litellm-mappings) described in this guide and emits findings for other fields. It does not check a version value in the configuration or resolve LiteLLM `include` files. Combine included files into one input file before importing them.

## Before you begin

- [Install an agentgateway binary]({{< link-hextra path="/deployment/binary/" >}}) that includes the `agentgateway import` command.
- Locate the LiteLLM proxy configuration file that you want to import. The file must contain at least one `model_list` entry.
- Make the environment variables referenced by the LiteLLM configuration available to agentgateway. The importer preserves environment references instead of copying secret values into the generated file.

## Import a LiteLLM configuration

1. Review the LiteLLM configuration that you want to import. The following example defines a centralized credential that is shared by two models.

   ```yaml
   credential_list:
   - credential_name: shared-openai
     credential_info:
       provider: openai
     credential_values:
       api_key: os.environ/OPENAI_API_KEY
       api_base: https://api.openai.example/v1
   model_list:
   - model_name: chat
     litellm_params:
       model: openai/gpt-4o
       litellm_credential_name: shared-openai
   - model_name: summarize
     litellm_params:
       model: openai/gpt-4o-mini
       litellm_credential_name: shared-openai
       temperature: 0.2
   ```

2. Run the importer and write the generated agentgateway configuration to a new file.

   ```sh
   agentgateway import \
     --from litellm \
     --file litellm.yaml \
     --output config.yaml
   ```

   The command writes compatibility findings to stderr and confirms the output path on stdout.

   Example output:

   ```text
   exact: model_list[0]: Imported model deployment for chat
   exact: credential_list[0]: Imported supported values from LiteLLM credential "shared-openai"
   exact: model_list[0].litellm_params.litellm_credential_name: Mapped LiteLLM credential "shared-openai" to reusable agentgateway provider "imported/litellm/shared-openai"
   exact: model_list[1]: Imported model deployment for summarize
   exact: model_list[1].litellm_params.litellm_credential_name: Mapped LiteLLM credential "shared-openai" to reusable agentgateway provider "imported/litellm/shared-openai"
   Imported litellm config: config.yaml
   ```

3. Review the generated configuration. For the previous example, the importer creates one reusable provider and references it from both models.

   ```yaml
   config:
     database:
       url: sqlite://data.db
   gateways:
     default:
       port: 4000
   ui:
     gateways: default
   llm:
     gateways: default
     models:
     - name: chat
       provider:
         reference: imported/litellm/shared-openai
       params:
         model: gpt-4o
     - name: summarize
       provider:
         reference: imported/litellm/shared-openai
       params:
         model: gpt-4o-mini
       defaults:
         temperature: 0.2
     providers:
     - name: imported/litellm/shared-openai
       provider: openAI
       params:
         baseUrl: https://api.openai.example/v1
         apiKey: $OPENAI_API_KEY
   ```

4. Provide any environment variables referenced by the generated configuration.

   ```sh
   export OPENAI_API_KEY=<your-api-key>
   ```

5. Validate the generated configuration with agentgateway's native configuration loader.

   ```sh
   agentgateway -f config.yaml --validate-only
   ```

6. Test the imported routes and models in a non-production environment, and then start agentgateway with the generated file.

   ```sh
   agentgateway -f config.yaml
   ```

## Read compatibility findings

The importer emits one of the following statuses for every field that it consumes or intentionally does not emit. Each finding includes the path to the corresponding field in the source configuration.

| Status | Meaning | Action |
| -- | -- | -- |
| `exact` | The setting was converted without a known semantic difference. | Verify the generated value. |
| `approximate` | The setting was mapped to the closest agentgateway behavior, but the semantics differ. | Test the behavior and adjust the generated configuration if needed. |
| `manual` | The setting requires review or manual migration and was not fully converted. | Re-create the setting manually when agentgateway has an equivalent. |
| `unsupported` | The setting cannot be safely represented and was not emitted. | Remove the dependency on the setting or choose an alternative agentgateway configuration. |

Unknown or unhandled source fields are reported instead of being silently discarded. Keep the findings with your migration records so that you can account for every setting in the source configuration.

### Review non-exact findings

For example, add the following fields to the source configuration from the previous section to see how the importer reports settings that require additional review.

```yaml
router_settings:
  routing_strategy: simple-shuffle
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
custom_section:
  enabled: true
```

In addition to the `exact` findings for the imported models and credential, the importer reports the following findings.

```text
approximate: router_settings.routing_strategy: Approximated LiteLLM simple-shuffle with generated agentgateway routing; RPM is used only by weighted routes
manual: general_settings.master_key: Requires manual review and was not emitted
unsupported: custom_section: Unrecognized LiteLLM top-level field was not emitted
```

## Supported LiteLLM mappings

The importer currently handles the following common file-based LiteLLM settings.

| LiteLLM configuration | Imported agentgateway configuration |
| -- | -- |
| Common provider prefixes | First-class providers for OpenAI, Azure OpenAI, Azure AI Foundry, Anthropic, Bedrock, Gemini, Vertex AI, Ollama, Cohere, Hugging Face, Groq, Mistral, OpenRouter, Together AI, xAI, DeepInfra, DeepSeek, and Fireworks |
| `model_name` and `litellm_params.model` | Public model names and provider-specific upstream model names |
| Multiple deployments with the same `model_name` | Internal models behind a generated virtual model |
| `credential_list` and `litellm_credential_name` | Reusable providers when the credential can be shared safely; otherwise, supported values are applied inline |
| `api_key`, API base URLs, Azure API versions, AWS regions, and Vertex project or location settings | Corresponding provider parameters, including preserved environment references |
| `rpm` | Relative weights for generated weighted routes when the routing strategy permits it |
| Ordinary `fallbacks` | Priority-based failover targets |
| `simple-shuffle` routing | Generated routing with an `approximate` finding because the semantics are not identical |
| Public wildcard model names | Exact `*`, prefix patterns such as `gpt-*`, and suffix patterns such as `*-preview` |

For identity mappings such as a public `*` model that targets `openai/*`, agentgateway preserves the model requested by the client instead of sending a literal wildcard upstream.

The importer does not emit wildcard patterns with a wildcard in the middle, multiple wildcards, or rewrites between different public and upstream wildcard patterns. It reports these patterns as `unsupported` because they cannot be represented safely.

## Use stdin and stdout

Use `-` as the input file to read the LiteLLM configuration from stdin. If you omit `--output`, the generated configuration is written to stdout.

```sh
agentgateway import --from litellm --file - < litellm.yaml > config.yaml
```

Compatibility findings are written to stderr, so they do not become part of the redirected YAML file. You can also pass `--output -` explicitly to write the generated configuration to stdout.

When you write to a file, the generated SQLite database URL points to `data.db` in the same directory as the output file. When you write to stdout, the URL is `sqlite://data.db` relative to the directory where you run agentgateway. Review this path before starting the gateway.

## Current limitations

The importer focuses on file-based model and routing configuration. It does not currently migrate all LiteLLM functionality, including the following areas:

- Database-managed runtime state, such as virtual keys, users, teams, spend history, and key rotation.
- Inbound API key policies from `master_key` and related security settings.
- Budgets, per-user or per-team rate limits, caches, callbacks, logging, alerting, and other operational settings.
- Secret-manager references and advanced authentication variants for individual providers.
- Configurations split across LiteLLM `include` files unless you combine them into one input file first.
- Model group aliases, condition-specific fallbacks, guardrails, MCP servers, custom prompt templates, and tokenizers.
- Routing strategies other than the mappings described in this guide.

Review the [`agentgateway` importer follow-on issue](https://github.com/agentgateway/agentgateway/issues/2607) for the current implementation backlog. Treat the compatibility findings produced by your installed binary as the source of truth because importer support can expand between releases.
