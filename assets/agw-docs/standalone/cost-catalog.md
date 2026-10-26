Agentgateway can track LLM spend by mapping each request's provider, model, and token counts to per-token pricing.

Agentgateway extracts token usage from supported LLM APIs automatically. {{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}To convert those token counts into cost, configure a model cost catalog.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}To convert those token counts into cost, agentgateway uses a model cost catalog. A built-in catalog prices common public models, and you can add your own catalog sources.{{< /version >}} The catalog maps provider and model names to pricing data so agentgateway can attach realized USD cost to logs, traces, metrics, and CEL expressions.

{{< version exclude-if="1.5.x" >}}For document and optical character recognition (OCR) models that report page usage, such as Mistral OCR on `/v1/ocr`, the catalog can also price each processed page. An `llm.models` gateway detects `/v1/ocr` requests automatically. On a route with an `ai` backend, map the path to the `detect` route type in `policies.ai.routes`, such as `"/v1/ocr": detect`. Otherwise, the request is parsed as a chat completion and fails.{{< /version >}}

> [!NOTE]
> Cost analysis is best-effort and may not exactly match your provider bill in scenarios such as price changes, custom pricing, failed requests, or provider-specific billing rules.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

{{< doc-test paths="costs" >}}
# Install agentgateway binary
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Configure a model catalog

{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
Use `config.modelCatalog` to load one or more model cost catalog files. Catalog entries are merged in order, and later entries take precedence. This lets you start with an imported public catalog and then layer local overrides for contracted pricing, internal models, or provider-specific aliases.
{{% /version %}}
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
Use `config.modelCatalog` to load one or more model cost catalog files. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} also ships with a built-in catalog, so requests to common public models are priced without any configuration. The built-in catalog is fixed when your agentgateway version is built. Add catalog sources to price newer models, set contracted pricing, or add internal models and provider-specific aliases.

The proxy combines the built-in catalog and your catalog sources into one catalog.

- **Base catalog**: A catalog with a `metadata.generatedAt` timestamp is a complete base catalog. The built-in catalog has this timestamp, and so does every catalog that `agctl catalog import` or the UI **Refresh base costs** button generates. The proxy uses only the base catalog with the newest timestamp and ignores the others. A freshly imported catalog therefore replaces the built-in catalog.
- **Overlays**: A catalog without `metadata` is an overlay. The proxy applies overlays on top of the base catalog in the order that you list them. A later overlay takes precedence at the model level.

> [!CAUTION]
> The proxy ignores imported catalogs that are older than its built-in catalog, without a warning. You can remove your imported catalog if the built-in catalog has the rates that you need. To customize rates, omit `metadata` from your catalog. The proxy then applies your catalog as an overlay, regardless of its age.
{{% /version %}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
You can load a catalog in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Costs** in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), such as [http://localhost:15000/ui/llm/costs](http://localhost:15000/ui/llm/costs).
2. Click **Refresh base costs**. The UI downloads the agentgateway model catalog to a `base-costs.json` file in the same directory as your configuration file, and adds the file to `config.modelCatalog`. The **Catalog sources** table lists the file.

   {{< reuse-image src="img/ui-cost-catalog.png" srcDark="img/ui-cost-catalog-dark.png" alt="LLM Costs page with the cost catalog sources and custom cost overrides" >}}

   > [!CAUTION]
   > If `config.modelCatalog` already lists a file, the refresh writes the downloaded catalog to the first listed file instead, and replaces its contents. Keep your own rates in a later file or in **Custom costs**, not in the first file.

The UI cannot add a catalog file that you wrote yourself. To load your own catalog files, use the **Config file** tab. For more information about the refresh, see [Import costs (UI)](#import-costs-ui).

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/cost-catalog-configure.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/cost-catalog-configure.md" >}}
{{% /version %}}

After the catalog is loaded, priced requests include cost data. The access log includes `agw.ai.usage.cost.total`, and CEL exposes cost data as `llm.cost` and `llm.costRates`. {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}Catalog metadata for the resolved model is available as `llm.model`.{{< /version >}}

For general LLM telemetry setup, see [Observe traffic]({{< link-hextra path="/documentation/llm/observability/" >}}).

## Import costs (agctl)

<!-- The merged `--source` list is new in 1.6. Every gate in this file must keep
     include/exclude as a complete, matching pair — shortening either to "1.5.x"
     would also match 1.4.x and older, and adding "main" would need an edit every
     release. -->
Use `agctl {{< reuse "agw-docs/versions/agctl-catalog-cmd.md" >}} import` to generate a catalog file. {{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}The command reads from a supported pricing source, and the default source is `models.dev`.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}The `--source` flag takes a comma-separated list, and the sources merge in the order that you list them, so a later source overlays an earlier one. The default is `models.dev,aws-bedrock-mantle`, which prices every provider that the proxy supports and then tags the Amazon Bedrock models.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}The default also includes `vertex-pricing`, which adds Vertex AI service-tier prices.{{< /version >}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
A source is a catalog to import from, not an LLM provider: each source covers one or more providers and contributes rates, tags, or both. Use `--providers` to import a subset of the providers that a source covers.

| Source | What it contributes |
|--------|---------------------|
| `models.dev` | Rates for every provider that the proxy supports, from [models.dev](https://models.dev). |
| `aws-bedrock-mantle` | Tags for Amazon Bedrock models only, read from the AWS model cards. This source contributes no rates. The tags record which endpoint serves a model, `runtime` or `mantle`, and which request formats the Mantle endpoint accepts. |
| `github` | The curated catalog that the agentgateway project publishes at [agentgateway.dev/model-catalog](https://agentgateway.dev/model-catalog), which covers the models that the agentgateway project tracks rather than everything that models.dev lists. Not imported by default. |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
| `vertex-pricing` | Service-tier rates for Vertex AI Gemini models, read from Google Cloud pricing. This source augments models that earlier sources already added. |{{< /version >}}
{{% /version %}}

```sh
mkdir -p costs
agctl {{< reuse "agw-docs/versions/agctl-catalog-cmd.md" >}} import --out ./costs/catalog.json
```

To keep the catalog smaller, import only the providers that you use. {{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}The following provider IDs are the same in both sources.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}The following provider IDs are the same in the `models.dev` and `github` sources.{{< /version >}}

```sh
agctl {{< reuse "agw-docs/versions/agctl-catalog-cmd.md" >}} import \
  --providers anthropic,mistral,openai \
  --out ./costs/catalog.json
```

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
> [!IMPORTANT]
> The `--providers` flag takes the provider IDs of the source that you import from, and the sources name some providers differently. The `github` source uses the agentgateway provider IDs, such as `gcp.gemini` and `aws.bedrock`, while `models.dev` uses its own IDs, such as `google` and `amazon-bedrock`. An ID that the source does not recognize is handled differently too: `models.dev` fails with `no providers matched`, but `github` reports `imported 0 providers` and writes a catalog without that provider. A `--providers` list that omits Bedrock also makes `aws-bedrock-mantle` contribute nothing. Check the provider list in the generated file before you load it.
{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
{{< reuse "agw-docs/snippets/model-catalog-import-options.md" >}}
{{< /version >}}

For all flags, see the {{< version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}[`agctl costs import`]({{< link-hextra path="/reference/agctl/agctl-costs-import/" >}}){{< /version >}}{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}[`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}){{< /version >}} reference.

## Import costs (UI)

You can also manage the model cost catalog from the built-in [UI]({{< link-hextra path="/documentation/setup/ui/" >}}).

{{< version include-if="1.5.x,1.4.x,1.3.x" >}}

> [!WARNING]
> The **Refresh base costs** button in the UI changes behavior in version 1.6 and later. Instead of downloading the catalog from `models.dev`, it downloads the catalog from the `main` branch of the agentgateway repository. Existing catalogs continue to work, but make sure not to refresh the model catalog through the UI until you upgrade to version 1.6 or later.
{{< /version >}}

1. Open the [UI cost page](http://localhost:15000/ui/llm/costs) (**LLM > Costs**). The page lists your configured **Catalog sources** (files and ConfigMaps, merged in order) and any inline **Custom costs** overrides.

   {{< reuse-image-light src="img/ui-cost-catalog.png" alt="UI LLM Costs page showing catalog sources and custom cost overrides" >}}
   {{< reuse-image-dark srcDark="img/ui-cost-catalog-dark.png" alt="UI LLM Costs page showing catalog sources and custom cost overrides" >}}

2. Press **Refresh base costs**. {{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}The UI downloads the public models.dev catalog and configures `modelCatalog`.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}The UI downloads the agentgateway model catalog, which tracks the `main` branch of the agentgateway repository, and configures `modelCatalog`. The catalog on `main` can gain fields after your release. So that a refresh keeps working, agentgateway ignores catalog fields that it does not recognize, and drops any pricing tier with a condition that it cannot apply.{{< /version >}}

3. To adjust pricing for a specific model, use **Edit** under **Custom costs** to add inline overrides without changing your catalog files.

{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" %}}
When you set up a fresh configuration for the first time, the UI automatically performs the refresh step.
{{% /version %}}

After you load a catalog, the same UI visualizes your priced traffic. For more information, see [Cost dashboard]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/" >}}).

## Override catalog entries

If your provider pricing differs from the imported public catalog, add another catalog file after the imported one. Later catalog sources override earlier sources. {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}Leave out the `metadata` field in the override file so that the file is applied as an overlay. For more information, see [Configure a model catalog](#configure-a-model-catalog).{{< /version >}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Costs**, and click **Edit** in the **Custom costs** section.
2. Click **Add model cost**, and enter the **Provider** and **Model**, such as `openai` and `gpt-4o-mini`.
3. Enter the rates in USD per 1M tokens for **Input** and **Output**, such as `0.15` and `0.60`, and optionally for **Cache read** and **Cache write**.

   {{< reuse-image src="img/ui-llm-costs-custom.png" srcDark="img/ui-llm-costs-custom-dark.png" alt="LLM Costs page with Custom costs in edit mode and an openai gpt-4o-mini row with input cost 0.15 and output cost 0.60" >}}

4. Click **Save**.

The UI writes the custom costs as an `inline` catalog source at the end of `config.modelCatalog`, not as a separate file. Like a later file, the inline source overrides the earlier sources.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/cost-catalog-override.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/cost-catalog-override.md" >}}
{{% /version %}}

Use overrides for contracted pricing, internally hosted models, or models that do not appear in the imported catalog.

{{% version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
You can also load one or more catalog files with the `MODEL_CATALOG_PATHS` environment variable. Set it to a comma-separated list of file paths.

```sh
MODEL_CATALOG_PATHS=./costs/catalog.json,./costs/overrides.json agentgateway -f config.yaml
```

> [!WARNING]
> When `MODEL_CATALOG_PATHS` is set, it replaces any `config.modelCatalog` sources. Use one mechanism or the other.
{{% /version %}}

{{% version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
> [!WARNING]
> The `MODEL_CATALOG_PATHS` environment variable is removed. Agentgateway ignores it without an error, so a catalog that you loaded this way stops applying. List your catalog files under `config.modelCatalog` instead.
{{% /version %}}

## Use cost data

When a request matches an entry in the catalog, agentgateway populates these CEL fields:

- `llm.cost`: The realized USD cost of the request. Includes `total` plus per-token-type components such as `input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, `inputAudio`, and `outputAudio`. Unset when the model cannot be priced.
- `llm.costRates`: The effective USD-per-1,000,000-token rates that were applied. Includes the same per-token-type fields when available. Unset when the model cannot be priced.
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
- `llm.model`: The resolved model's catalog metadata, including `id`, `tags`, `limits`, `modalities`, `capabilities`, and `reasoning`. Unset when no catalog entry matches the request provider and model.
{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}`llm.cost.cacheWriteDetails` reports the cost of Anthropic 1-hour and OpenAI 12-hour prompt-cache writes. For more information, see [Cache writes by TTL](#cache-write-details).{{< /version >}}

{{< version exclude-if="1.5.x" >}}For page-billed document models, `llm.cost.pages` reports the page-cost component, and `llm.costRates.perPage` reports the USD-per-page rate that was applied.{{< /version >}}

The request access log includes `agw.ai.usage.cost.total` only for priced LLM requests. When the model cannot be priced, the access log leaves out the field.
Traces always include the full breakdown:
* `agw.ai.usage.cost.total`
* `agw.ai.usage.cost.input`
* `agw.ai.usage.cost.output`
* `agw.ai.usage.cost.cache_read`
* `agw.ai.usage.cost.cache_write`
* `agw.ai.usage.cost.reasoning`
* `agw.ai.usage.cost.input_audio`
* `agw.ai.usage.cost.output_audio`
{{< version exclude-if="1.5.x" >}}* `agw.ai.usage.cost.pages`{{< /version >}}

As these are loaded into the CEL context, they can be explicitly emitted as well.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
       # Add the input cost
       input_cost: llm.cost.input
       # Add ALL cost variables, as `cost.input`, `cost.output`, etc.
       cost: flatten(llm.cost)
```

A priced request produces an access log entry that includes cost data.

```console
... protocol=llm gen_ai.provider.name=openai gen_ai.request.model=gpt-4o-mini
gen_ai.usage.input_tokens=14 gen_ai.usage.output_tokens=6 agw.ai.usage.cost.total=0.0000057 ...
```

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
### Cache writes by TTL {#cache-write-details}

Anthropic and OpenAI price prompt-cache writes by how long the cache entry lives, its time to live (TTL). {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} prices two extended TTLs separately from other cache writes: Anthropic 1-hour writes (`1h`) and OpenAI Responses API 12-hour writes (`12h`).

To set the rates, add a `cacheWriteDetails` map to a model's `rates` or to a tier's `rates`. Writes for a TTL that the map omits use the `cacheWrite` rate. The built-in catalog already sets these rates for many Anthropic and OpenAI models.

```json
{
  "providers": {
    "anthropic": {
      "models": {
        "claude-opus-5": {
          "rates": {
            "input": "5",
            "output": "25",
            "cacheRead": "0.5",
            "cacheWrite": "6.25",
            "cacheWriteDetails": { "1h": "10" }
          }
        }
      }
    }
  }
}
```

The cost data reports these writes separately from other cache writes.

- `llm.cost.cacheWrite` covers only cache writes without an extended TTL, such as Anthropic 5-minute writes.
- `llm.cost.cacheWriteDetails` maps each TTL to its cost. The map contains only TTLs with a non-zero cost, so a request without extended-TTL writes has an empty map.
- `llm.costRates.cacheWriteDetails` maps each TTL to the rate that the catalog sets for it. A TTL that uses the `cacheWrite` rate has no key.
- Traces add `agw.ai.usage.cost.cache_write_details.1h` and `agw.ai.usage.cost.cache_write_details.12h` only when that cost is non-zero.

The keys start with a digit, so read them with index syntax, such as `llm.cost.cacheWriteDetails['1h']`. A lookup of a missing key fails, and the access log leaves out the field. To log `0` instead, check for the key first.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      cache_write_1h: "'1h' in llm.cost.cacheWriteDetails ? llm.cost.cacheWriteDetails['1h'] : 0.0"
```

The following log entry is for a request that wrote 400,000 tokens to the 5-minute cache and 600,000 tokens to the 1-hour cache. The 1-hour writes cost `$6`, and the 5-minute writes cost `$2.50`.

```console
... gen_ai.provider.name=anthropic gen_ai.request.model=claude-opus-5
gen_ai.usage.cache_creation.input_tokens=1000000 agw.ai.usage.cost.total=8.50075 cache_write_1h=6 ...
```
{{% /version %}}

{{% version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" %}}
### Service tiers {#service-tiers}

Agentgateway normalizes the service tier reported in each LLM response to `standard`, `flex`, `priority`, or `reserved`. CEL expressions access it as `llm.serviceTier`.

Cost calculations match this value to catalog tiers with a `serviceTier` field. Requests without a recorded tier use `standard` rates.

| Provider | Reported tier and normalized `llm.serviceTier` |
|---|---|
| OpenAI and Azure | `default` becomes `standard`. `flex` stays `flex`. `priority` and `fast` become `priority`. `scale` becomes `reserved`. |
| Anthropic | `standard` and `priority` stay the same. |
| Amazon Bedrock | `default` and `standard` become `standard`. `flex`, `priority`, and `reserved` stay the same. |
| Gemini | `standard`, `flex`, and `priority` stay the same. |
| Vertex AI | `ON_DEMAND` becomes `standard`. `ON_DEMAND_FLEX` becomes `flex`. `ON_DEMAND_PRIORITY` becomes `priority`. `PROVISIONED_THROUGHPUT` becomes `reserved`. Claude models report the Anthropic tiers, `standard` and `priority`. |

Unlisted providers or tiers leave `llm.serviceTier` unset.

Earlier versions exposed the provider's original tier name, such as `default` or `ON_DEMAND`. Update CEL comparisons to use the normalized names.

For Bedrock tier requests and the response header used to detect the tier, see [Service tier]({{< link-hextra path="/integrations/llm/providers/bedrock/#service-tier" >}}).

To record the tier in the access log, add `llm.serviceTier` as a field.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      service_tier: llm.serviceTier
```

Example access log for an OpenAI request served at the priority tier:

```console
... gen_ai.provider.name=openai gen_ai.request.model=gpt-4.1 gen_ai.response.model=gpt-4.1
gen_ai.usage.input_tokens=10 gen_ai.usage.output_tokens=2 agw.ai.usage.cost.total=0.000063 service_tier="priority"
```
{{% /version %}}

## Monitor catalog lookups

Every cost lookup increments the `agentgateway_cost_catalog_lookups_total` counter. The metric is labeled with lookup `status`, provider, request model, and response model.

| Status | Meaning |
|--------|---------|
| `Exact` | The provider and model were found in the catalog and priced. |
| `Unpriced` | The model was found, but its catalog entry has no rates, such as an entry with only `tags`. |
| `Missing` | The provider or model was not found in the catalog. |
| `NoCatalog` | {{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}No catalog is configured.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}No catalog was available for the lookup. Because the built-in catalog is always loaded, a running proxy does not report this status.{{< /version >}} |

A rising `Missing` or `Unpriced` count means requests are flowing through models that your catalog does not price. Add the missing providers or models to your catalog and reload.

> [!NOTE]
> In traces, the corresponding cost-resolution `status` attribute uses lowercase values: `exact`, `unpriced`, `missing`, and `noCatalog`.

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
## Check priced traffic with agctl {#agctl}

After you send an LLM request, use [agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}) to inspect the recorded costs. These commands require a [request-log database]({{< link-hextra path="/documentation/observability/access-logs/database/" >}}).

```sh
agctl standalone logs --limit 10
agctl standalone analytics --by provider,model --since 1h
```

Example output of the `analytics` command:

```text
PROVIDER  MODEL        REQUESTS  ERRORS  TOKENS  COST       AVG TTFT  TOK/S  CACHE HIT
openai    gpt-4o-mini  1         0       19      $0.000007  -         -      0.0%
```

The `COST` column of the log table shows the cost of each request, and the analytics summary adds up the recorded costs. A request that the catalog does not price shows no cost. Therefore, a low or zero total does not prove that the catalog priced every request. To find unpriced requests, use the catalog lookup metrics in the previous section. For time buckets and identity breakdowns, see [CLI analytics]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/#cli" >}}).
{{< /version >}}

## Enforce budgets

The model catalog provides pricing data for spend visibility. To block or throttle traffic, combine cost visibility with rate limiting or virtual key management.

- Use [Rate limiting]({{< link-hextra path="/documentation/configuration/resiliency/rate-limits/" >}}) to cap request or token usage per route, user, or API key.
- Use [Virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}) to issue keys with per-key controls and attribution.

## Advanced: Catalog format

Usually, you do not need to write catalog JSON by hand. Use `agctl {{< reuse "agw-docs/versions/agctl-catalog-cmd.md" >}} import` or the UI to generate the base catalog, then add overrides only when needed.

{{< reuse "agw-docs/snippets/model-catalog-json-format.md" >}}

{{% version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
## Model tags

{{< reuse "agw-docs/snippets/model-catalog-tags.md" >}}
{{% /version %}}

{{< doc-test paths="costs" >}}
# Verify that agentgateway loads a catalog from a file source.
cat > /tmp/costs-catalog.json <<'EOF'
{
  "providers": {
    "openai": {
      "models": {
        "gpt-4o-mini": {
          "rates": { "input": "0.15", "output": "0.6", "cacheRead": "0.075" }
        }
      }
    }
  }
}
EOF
cat > /tmp/costs-config.yaml <<'EOF'
config:
  modelCatalog:
  - file: /tmp/costs-catalog.json
llm:
  models:
  - name: gpt-4o-mini
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f /tmp/costs-config.yaml > /tmp/costs-agw.log 2>&1 &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
grep -qE "model catalog (re)?loaded" /tmp/costs-agw.log
{{< /doc-test >}}
