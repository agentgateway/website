---
title: Migrate from LiteLLM
weight: 11
description: Convert a LiteLLM proxy configuration into an agentgateway standalone configuration and review compatibility findings.
prev: /configuration/overview
next: /configuration/gateways
test: skip
---

Migrate from LiteLLM to agentgateway by importing your existing LiteLLM proxy configuration file. The agentgateway configuration importer converts supported settings into a valid agentgateway YAML configuration and reports how each source field was handled.

The importer currently supports LiteLLM proxy configuration files. Support for additional source gateways can be added to the same import command in future releases.

> [!WARNING]
> An imported configuration can be valid without being behaviorally identical to the source configuration. Review every compatibility finding and test the generated configuration before using it in production.

Compatibility is field-based rather than whole-config parity. The importer converts only the [supported LiteLLM mappings](#supported-litellm-mappings) described in this guide and emits findings for other fields. It does not check a version value in the configuration or resolve LiteLLM `include` files. Combine included files into one input file before importing them.

## Before you begin

- [Install an agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/" >}}) that includes the `agentgateway import` command.
- Locate the LiteLLM proxy configuration file that you want to import. The file must contain at least one `model_list` entry.
- Make the environment variables referenced by the LiteLLM configuration available to agentgateway. The importer preserves environment references instead of copying secret values into the generated file.

## Import a LiteLLM configuration

1. Save the LiteLLM configuration that you want to import to a file, such as `litellm.yaml`. The following example defines a centralized credential that is shared by two models.

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
| Common provider prefixes | First-class providers for OpenAI, Azure OpenAI, Azure AI Foundry, Anthropic, Bedrock, Gemini, Vertex AI, Ollama, Cohere, Hugging Face, Groq, Mistral, OpenRouter, Together AI, xAI, DeepInfra, DeepSeek, Fireworks, and Perplexity |
| `model_name` and `litellm_params.model` | Public model names and provider-specific upstream model names |
| Multiple deployments with the same `model_name` | Internal models behind a generated virtual model |
| `credential_list` and `litellm_credential_name` | Reusable providers when the credential can be shared safely; otherwise, supported values are applied inline |
| `api_key`, API base URLs, Azure API versions, AWS regions, and Vertex project or location settings | Corresponding provider parameters, including preserved environment references |
| `litellm_params.organization` | `requestHeaders.set.openai-organization` for OpenAI and OpenAI-compatible models; environment references are preserved |
| Fixed string values in `litellm_params.extra_headers` | `requestHeaders.set` on the model or reusable provider, with model-level values overriding shared credential values |
| `rpm` | Relative weights for generated weighted routes when the routing strategy permits it |
| Ordinary `fallbacks` | Priority-based failover targets |
| `default_fallbacks` in `router_settings` or `litellm_settings` | Priority-based failover targets for each model that has no `fallbacks` entry of its own. For more information, see [Import fallbacks](#fallbacks). |
| `router_settings.allowed_fails` and `router_settings.cooldown_time` | `health.eviction.consecutiveFailures` and `health.eviction.duration` on each imported model. Both mappings are `approximate`. For more information, see [Import cooldowns](#cooldowns). |
| `router_settings.disable_cooldowns: true` | No `health` policy |
| `router_settings.max_fallbacks` | The depth limit for the failover chains that `default_fallbacks` produces. `0` turns off all fallbacks. Without `default_fallbacks`, the importer reports any other value as `manual`. |
| `simple-shuffle` routing | Generated routing with an `approximate` finding because the semantics are not identical |
| Public wildcard model names | Exact `*`, prefix patterns such as `gpt-*`, and suffix patterns such as `*-preview` |

For identity mappings such as a public `*` model that targets `openai/*`, agentgateway preserves the model requested by the client instead of sending a literal wildcard upstream.

The importer does not emit wildcard patterns with a wildcard in the middle, multiple wildcards, or rewrites between different public and upstream wildcard patterns. It reports these patterns as `unsupported` because they cannot be represented safely.

## Import fallbacks {#fallbacks}

The importer converts LiteLLM fallbacks into priority-based failover on a generated virtual model. Ordinary `fallbacks` list the backup models for one model. `default_fallbacks` lists the backup models for every model that has no `fallbacks` entry of its own. The importer reads both settings from `router_settings`. If a setting is not there, the importer reads it from `litellm_settings`.

1. Save the LiteLLM configuration to a file, such as `litellm-fallbacks.yaml`. The following example has three models and two default fallbacks.

   ```yaml
   model_list:
   - model_name: chat
     litellm_params:
       model: openai/gpt-4o
       api_key: os.environ/OPENAI_API_KEY
   - model_name: backup
     litellm_params:
       model: anthropic/claude-haiku-4-5
       api_key: os.environ/ANTHROPIC_API_KEY
   - model_name: spare
     litellm_params:
       model: openai/gpt-4o-mini
       api_key: os.environ/OPENAI_API_KEY
   router_settings:
     default_fallbacks: [backup, spare]
   ```

2. Run the importer. To keep the `config.yaml` file from the previous section, write the output to a different file.

   ```sh
   agentgateway import \
     --from litellm \
     --file litellm-fallbacks.yaml \
     --output fallbacks-config.yaml
   ```

   Example output:

   ```text
   exact: model_list[0]: Imported model deployment for chat
   exact: model_list[1]: Imported model deployment for backup
   exact: model_list[2]: Imported model deployment for spare
   approximate: router_settings.default_fallbacks: Flattened LiteLLM fallback recursion (per-hop explicit fallbacks, default_fallbacks at hops without one, attempted models skipped) into static priority-ordered failover targets
   manual: router_settings.default_fallbacks: LiteLLM serves unknown model names via the first default fallback "backup"; agentgateway returns 404 for unmatched model names because wildcard matching applies only to concrete llm.models entries; add a "*" model manually if unknown names must be served
   Imported litellm config: fallbacks-config.yaml
   ```

3. Review the generated configuration. The `llm.models` list has one internal model for each deployment, such as `imported/litellm/chat/1`. The `llm.virtualModels` list has one virtual model for each public model name, with the failover chain as priority-ordered targets. A lower `priority` value is tried first. The following excerpt shows only the `llm.virtualModels` section.

   ```yaml
   llm:
     virtualModels:
     - name: chat
       routing:
         failover:
           targets:
           - model: imported/litellm/chat/1
             priority: 0
           - model: imported/litellm/backup/1
             priority: 1
           - model: imported/litellm/spare/1
             priority: 2
     - name: backup
       routing:
         failover:
           targets:
           - model: imported/litellm/backup/1
             priority: 0
           - model: imported/litellm/spare/1
             priority: 1
     - name: spare
       routing:
         failover:
           targets:
           - model: imported/litellm/spare/1
             priority: 0
           - model: imported/litellm/backup/1
             priority: 1
   ```

### How the importer builds the failover chain {#failover-chain}

LiteLLM picks a fallback each time a request fails. Agentgateway uses a fixed list instead, so the importer flattens the LiteLLM fallbacks into one chain for each model.

* At each model in the chain, the importer uses that model's own `fallbacks` entry, if it has one. Otherwise, it uses `default_fallbacks`. For example, with `fallbacks: [{chat: [backup]}]` and `default_fallbacks: [backup, spare]`, the chain for `chat` is `chat`, `backup`, and then `spare`. The `backup` model has no `fallbacks` entry, so the default list applies after it.
* The importer skips the models that are already in the chain, so a model is never its own fallback. A model whose chain has no other model stays a regular model, not a virtual model.
* When you set `default_fallbacks`, `router_settings.max_fallbacks` limits how deep the importer follows the fallbacks of fallbacks, in the same way that it limits fallback depth in LiteLLM. It does not shorten the fallback list of the model itself. The default is `5`. `max_fallbacks: 0` turns off fallbacks, so the importer emits no failover, not even for ordinary `fallbacks`.

Agentgateway moves traffic to the next priority after it removes a failing target from the active set. The request that fails is not retried on the next target, so the client still gets that error. For more information, see [Failover routing]({{< link-hextra path="/documentation/llm/virtual-models/#failover-routing" >}}).

### Review fallback findings {#fallback-findings}

Review the following fallback findings.

| Finding | Action |
| -- | -- |
| `approximate` on `default_fallbacks` | Test the failover chains, because a fixed list does not match the LiteLLM fallback behavior exactly. |
| `manual` about unknown model names | LiteLLM sends a request for an unknown model to the first default fallback. Agentgateway returns a `404` error with `model_not_found`. To serve unknown model names, add a `*` model. |
| `manual` about a wildcard model | The importer cannot attach default fallbacks to a wildcard model, because failover needs a virtual model and virtual model names match exactly. Configure failover for that traffic yourself. |
| `manual` on `context_window_fallbacks` or `content_policy_fallbacks` | These fallbacks apply only to certain errors, so the importer does not convert them. Configure equivalent behavior yourself. |
| `manual` on `litellm_settings.default_fallbacks` | Both sections set `default_fallbacks`. The importer uses the `router_settings` value. |
| `manual` on `max_fallbacks` with "No automatic mapping is available" | You set `max_fallbacks` to a value other than `0`, but not `default_fallbacks`. Without `default_fallbacks`, each failover chain has only the model's own `fallbacks` entry, so the importer has no chain depth to limit. Review the generated failover chains. |
| `manual` on `max_fallbacks` with "must be a non-negative integer" | The value is not a non-negative whole number, so the importer uses the default of `5`. |


## Import cooldowns {#cooldowns}

LiteLLM cools down a deployment after it fails more than `allowed_fails` times in a minute, and keeps it out of rotation for `cooldown_time` seconds. The importer maps these router settings to a model health eviction policy on each imported model.

* `allowed_fails` becomes `health.eviction.consecutiveFailures`, set to the `allowed_fails` value plus one. LiteLLM cools down a deployment on the failure after the allowed ones, so the extra failure keeps the same threshold.
* `cooldown_time` becomes `health.eviction.duration`.

The importer maps the two settings only together. If you set only one of them, the importer emits no health policy and reports a `manual` finding.

1. Save the LiteLLM configuration to a file, such as `litellm-cooldowns.yaml`. The following example allows three failures and sets a 60-second cooldown.

   ```yaml
   model_list:
   - model_name: chat
     litellm_params:
       model: openai/gpt-4o
       api_key: os.environ/OPENAI_API_KEY
   - model_name: chat
     litellm_params:
       model: openai/gpt-4o-mini
       api_key: os.environ/OPENAI_API_KEY
   router_settings:
     allowed_fails: 3
     cooldown_time: 60
   ```

2. Run the importer.

   ```sh
   agentgateway import \
     --from litellm \
     --file litellm-cooldowns.yaml \
     --output cooldowns-config.yaml
   ```

   Example output:

   ```text
   exact: model_list[0]: Imported model deployment for chat
   exact: model_list[1]: Imported model deployment for chat
   approximate: router_settings.allowed_fails: Mapped LiteLLM allowed_fails + 1 to the model health eviction consecutiveFailures threshold; agentgateway counts consecutive failures rather than failures within a window
   approximate: router_settings.cooldown_time: Mapped LiteLLM cooldown_time to the model health eviction duration
   Imported litellm config: cooldowns-config.yaml
   ```

3. Review the generated configuration. Each model in the `llm.models` list has the same `health` policy. The following excerpt shows the first model.

   ```yaml
   llm:
     models:
     - name: imported/litellm/chat/1
       visibility: internal
       provider: openAI
       params:
         model: gpt-4o
         apiKey: $OPENAI_API_KEY
       health:
         eviction:
           consecutiveFailures: 4
           duration: 60s
   ```

The eviction policy behaves differently from a LiteLLM cooldown. Agentgateway counts consecutive failures, not failures within a minute. The `duration` value is the base eviction time, and repeated evictions of the same model last longer. For how eviction works, see [Failover routing]({{< link-hextra path="/documentation/llm/virtual-models/#failover-routing" >}}).

### Review cooldown findings {#cooldown-findings}

Review the following cooldown findings.

| Finding | Action |
| -- | -- |
| `approximate` on `allowed_fails` and `cooldown_time` | Test the eviction behavior, because agentgateway counts consecutive failures instead of failures within a minute. |
| `manual` on `allowed_fails` or `cooldown_time` with "requires" | You set only one of the two settings, so the importer emitted no health policy. Set both settings, or add a `health` policy yourself. |
| `manual` on `allowed_fails` and `cooldown_time` with "must be" or "was not mapped because" | One of the values is invalid, so the importer emitted no health policy. `allowed_fails` must be a non-negative integer, and `cooldown_time` must be a positive whole number of seconds. A decimal such as `0.5` is invalid. Fix the value, or add a `health` policy yourself. |
| `manual` on `allowed_fails_policy` | LiteLLM thresholds for each exception type do not fit the single eviction threshold. The importer does not map `allowed_fails_policy`, `allowed_fails`, or `cooldown_time`. Configure a `health` policy yourself. |
| `manual` on `model_list[N].litellm_params.cooldown_time` | The importer does not map a cooldown for one deployment, and the router-level `health` policy does not apply to that model. Configure its `health` policy yourself. A `cooldown_time`, `allowed_fails`, or `allowed_fails_policy` key in the deployment's `model_info` has the same effect, but the importer reports no finding for it. |
| `exact` on `disable_cooldowns` | Cooldowns are disabled, and the importer emitted no health policy. |
| `manual` on `disable_cooldowns` | Cooldowns are disabled, but the import also created failover routes. Agentgateway evicts failing failover targets by default, even without a `health` policy. Review the eviction behavior of the generated failover routes. |

## Use stdin and stdout

Use `-` as the input file to read the LiteLLM configuration from stdin. If you omit `--output`, the generated configuration is written to stdout.

```sh
agentgateway import --from litellm --file - < litellm.yaml > config.yaml
```

Compatibility findings are written to stderr, so they do not become part of the redirected YAML file. You can also pass `--output -` explicitly to write the generated configuration to stdout.

When you write to a file, the generated SQLite database URL points to `data.db` in the same directory as the output file. When you write to stdout, the URL is `sqlite://data.db` relative to the directory where you run agentgateway. Review this path before starting the gateway.

Header names are matched case-insensitively. The importer reports invalid header names or values, unsupported dynamic header values, and conflicting header settings as compatibility findings. Review these findings before using the generated configuration.

## Current limitations

The importer focuses on file-based model and routing configuration. It does not currently migrate all LiteLLM functionality, including the following areas:

- Database-managed runtime state, such as virtual keys, users, teams, spend history, and key rotation.
- Inbound API key policies from `master_key` and related security settings.
- Budgets, per-user or per-team rate limits, caches, callbacks, logging, alerting, and other operational settings.
- Secret-manager references and advanced authentication variants for individual providers.
- Configurations split across LiteLLM `include` files unless you combine them into one input file first.
- Model group aliases, condition-specific fallbacks, default fallbacks for wildcard models, guardrails, MCP servers, custom prompt templates, and tokenizers.
- Routing strategies other than the mappings described in this guide.
- Cooldown thresholds for each exception type in `allowed_fails_policy`, and cooldown settings on individual deployments. The importer maps only the router-level `allowed_fails` and `cooldown_time` settings.

Review the [`agentgateway` importer follow-on issue](https://github.com/agentgateway/agentgateway/issues/2607) for the current implementation backlog. Treat the compatibility findings produced by your installed binary as the source of truth because importer support can expand between releases.
