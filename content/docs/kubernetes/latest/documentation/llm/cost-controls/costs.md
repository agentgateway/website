---
title: Model costs
weight: 20
description: Price LLM requests with a model cost catalog and expose realized USD costs in logs, traces, and metrics.
test:
  costs:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/integrations/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/latest/documentation/llm/cost-controls/costs.md
    path: costs
---

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} computes the realized USD cost of each LLM request from a model cost catalog. For each request that matches a catalog entry, CEL expressions can use `llm.model` to read the resolved model metadata. For each priced request, {{< reuse "agw-docs/snippets/agentgateway.md" >}} also records the cost in access logs, traces, and metrics, and exposes the values to CEL expressions as `llm.cost` and `llm.costRates`.

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} ships with a built-in catalog, so requests to common public models are priced without any configuration. The built-in catalog is fixed when your {{< reuse "agw-docs/snippets/agentgateway.md" >}} version is built. To price newer models, set contracted rates, or add your own models, add catalog sources as described in the following steps.

In Kubernetes mode, you deliver your own catalog as a ConfigMap and reference it from a Gateway-level {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. For document and optical character recognition (OCR) models that report page usage, such as Mistral OCR on `/v1/ocr`, the catalog can price each processed page. A listener that serves {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} resources detects `/v1/ocr` requests automatically. On an HTTPRoute with an AI backend, map the path to the `Detect` route type in the `spec.backend.ai.routes` field of an {{< reuse "agw-docs/snippets/policy.md" >}}, such as `"/v1/ocr": "Detect"`. Otherwise, the request is parsed as a chat completion and fails.

## How catalog sources combine {#catalog-precedence}

The proxy combines the built-in catalog and your catalog sources into one catalog.

- **Base catalog**: A catalog with a `metadata.generatedAt` timestamp is a complete base catalog. The built-in catalog has this timestamp, and so does every catalog that `agctl catalog import` generates. The proxy uses only the base catalog with the newest timestamp and ignores the others. A freshly imported catalog therefore replaces the built-in catalog.
- **Overlays**: A catalog without `metadata` is an overlay. The proxy applies overlays on top of the base catalog in the order that you list them. A later overlay takes precedence at the model level.

> [!CAUTION]
> The proxy ignores imported catalogs that are older than its built-in catalog, without a warning. You can remove your imported catalog if the built-in catalog has the rates that you need. To customize rates, omit `metadata` from your catalog. The proxy then applies your catalog as an overlay, regardless of its age.

## Step 1: Prepare a catalog

Prepare a catalog by creating your own JSON file or using the `agctl catalog import` command.

### Catalog JSON format

{{< reuse "agw-docs/snippets/model-catalog-json-format.md" >}}

### Generate a catalog with agctl

Use `agctl catalog import` to generate a catalog JSON file, then load it into a ConfigMap.

1. Generate a catalog from one or more supported sources. The `--source` flag takes a comma-separated list, and the sources merge in the order that you list them, so a later source overlays an earlier one. By default, `agctl catalog import` imports `models.dev,aws-bedrock-mantle,vertex-pricing`, which prices every provider that the proxy supports, tags the Amazon Bedrock models, and adds Vertex AI service-tier prices. A source is a catalog to import from, not an LLM provider: each source covers one or more providers and contributes rates, tags, or both. To import only a subset of the providers that a source covers, pass a comma-separated list to `--providers`.

   | Source | What it contributes |
   |--------|---------------------|
   | `models.dev` | Rates for every provider that the proxy supports, from [models.dev](https://models.dev). |
   | `aws-bedrock-mantle` | Tags for Amazon Bedrock models only, read from the AWS model cards. This source contributes no rates. The tags record which endpoint serves a model, `runtime` or `mantle`, and which request formats the Mantle endpoint accepts. |
   | `vertex-pricing` | Service-tier rates for Vertex AI Gemini models, read from Google Cloud pricing. This source augments models that earlier sources already added. |
   | `github` | The curated catalog that the agentgateway project publishes at [agentgateway.dev/model-catalog](https://agentgateway.dev/model-catalog), which covers the models that the agentgateway project tracks rather than everything that models.dev lists. Not imported by default. |

   ```sh
   agctl catalog import --pretty --providers openai,anthropic --out ./catalog.json
   ```

   > [!IMPORTANT]
   > The `--providers` flag takes the provider IDs of the source that you import from, and the sources name some providers differently. The `models.dev` source uses its own IDs, such as `google` and `amazon-bedrock`, while the `github` source uses the agentgateway provider IDs, such as `gcp.gemini` and `aws.bedrock`. The sources also handle an unrecognized ID differently. `models.dev` fails with `no providers matched`, but `github` reports `imported 0 providers` and writes a catalog without that provider. A `--providers` list that omits Bedrock also makes `aws-bedrock-mantle` contribute nothing. Check the provider list in the generated file before you load it.

2. Create or update the ConfigMap from the generated file. The `--from-file` syntax sets the data key to `catalog.json`.

   ```sh
   kubectl create configmap my-model-costs \
     --from-file=catalog.json=./catalog.json \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --dry-run=client -o yaml | kubectl apply -f-
   ```

3. Review the ConfigMap catalog.

   ```bash
   kubectl describe configmap my-model-costs -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```yaml
   Name:         my-model-costs
   Namespace:    agentgateway-system
   Labels:       <none>
   Annotations:  <none>
   
   Data
   ====
   catalog.json:
   ----
   {
     "providers": {
       "anthropic": {
         "models": {
           "claude-3-5-haiku-latest": {
             "rates": {
               "input": "0.8",
               "output": "4",
               "cacheRead": "0.08",
               "cacheWrite": "1"
             }
           },
   ...   
   ```

4. Reference the ConfigMap from your {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, as shown in the next section, [Configure a catalog as a ConfigMap](#step-2-configure-a-catalog-as-a-configmap).

### Filter providers and apply import overrides

{{< reuse "agw-docs/snippets/model-catalog-import-options.md" >}}

For all options, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference.

## Step 2: Configure a catalog as a ConfigMap

1. Create a ConfigMap that holds the catalog JSON. The ConfigMap must be in the same namespace as the Gateway that references it. By default, the catalog is read from the `catalog.json` data key. If you already created the ConfigMap in [Step 1](#generate-a-catalog-with-agctl), you can skip this step.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: my-model-costs
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   data:
     catalog.json: |
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
   ```

2. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that references the ConfigMap as a catalog source. For how multiple sources combine with each other and with the built-in catalog, see [How catalog sources combine](#catalog-precedence).

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: my-agwp
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     modelCatalog:
       sources:
         - configMap:
             name: my-model-costs
             key: catalog.json
   EOF
   ```

3. Attach the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource to your Gateway with `infrastructure.parametersRef`. The `key` field is optional and defaults to `catalog.json`.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: agentgateway-proxy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
     infrastructure:
       parametersRef:
         name: my-agwp
         group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
     listeners:
       - name: http
         port: 80
         protocol: HTTP
         allowedRoutes:
           namespaces:
             from: All
   EOF
   ```

> [!WARNING]
> `modelCatalog` is honored only on a **Gateway-level** {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource (attached through `Gateway.spec.infrastructure.parametersRef`). `modelCatalog` is ignored on a GatewayClass-level {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, because ConfigMap references are resolved from the Gateway's deployment namespace.

## Step 3: Generate traffic

Generate traffic through agentgateway that matches a model entry from the catalog. For example steps, try the [LLM getting started]({{< link-hextra path="/documentation/quickstart/llm/" >}}).

## Step 4: Use cost data in CEL, logs, traces, and metrics

When a request matches an entry in the catalog, {{< reuse "agw-docs/snippets/agentgateway.md" >}} populates the following CEL fields:

- `llm.cost`: The realized USD cost of the request. Includes `total` plus per-usage-type components: `input`, `output`, `cacheRead`, `cacheWrite`, `cacheWriteDetails`, `reasoning`, `inputAudio`, `outputAudio`, `pages` for page-billed document models, and `audioDuration` for audio models that bill by duration. Unset when the model cannot be priced.
- `llm.costRates`: The effective USD-per-1,000,000-token rates that were applied, after tier selection. For page-billed document models, `perPage` holds the USD-per-page rate instead. For audio models that bill by duration, `perAudioMinute` holds the USD-per-minute rate. Unset when the model cannot be priced.
- `llm.model`: The resolved model's catalog metadata, including `id`, `tags`, `limits`, `modalities`, `capabilities`, and `reasoning`. Unset when no catalog entry matches the request provider and model.

`llm.cost.cacheWriteDetails` reports the cost of Anthropic 1-hour and OpenAI 12-hour prompt-cache writes. For more information, see [Cache writes by TTL](#cache-write-details).

For transcription and translation requests, `llm.audioSeconds` holds the audio duration in seconds that the provider reported, even when the model cannot be priced. The audio cost is the duration in minutes multiplied by the `perAudioMinute` rate, so 90 seconds at a rate of `0.006` costs `0.009`. Traces record this cost as `agw.ai.usage.cost.audio_duration`. For an example, see [Audio models]({{< link-hextra path="/integrations/llm/providers/audio/#usage-and-cost" >}}).

When an Anthropic Messages response reports `usage.iterations`, {{< reuse "agw-docs/snippets/agentgateway.md" >}} prices each iteration separately and adds the results to get the request cost. If an iteration names a `model` with an exact catalog match, the tokens for that iteration use that model's catalog entry. Otherwise, the iteration uses the response model.

The request access log includes `agw.ai.usage.cost.total` only for priced LLM requests. When the model cannot be priced, which is a lookup status of `Unpriced` or `Missing` as described in the next step, the access log leaves out the field. For how to view logs and add cost fields, see [Metrics and logs]({{< link-hextra path="/documentation/llm/observability/" >}}).

### Cache writes by TTL {#cache-write-details}

Anthropic and OpenAI price prompt-cache writes by how long the cache entry lives, its time to live (TTL). {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} prices two extended TTLs separately from other cache writes: Anthropic 1-hour writes (`1h`) and OpenAI Responses API 12-hour writes (`12h`).

The cost data reports these writes separately from other cache writes.

- `llm.cost.cacheWrite` covers only cache writes without an extended TTL, such as Anthropic 5-minute writes.
- `llm.cost.cacheWriteDetails` maps each TTL to its cost. The map contains only TTLs with a non-zero cost, so a request without extended-TTL writes has an empty map.
- `llm.costRates.cacheWriteDetails` maps each TTL to the rate that the catalog sets for it. A TTL that uses the `cacheWrite` rate has no key.
- Traces add `agw.ai.usage.cost.cache_write_details.1h` and `agw.ai.usage.cost.cache_write_details.12h` only when that cost is non-zero.

The keys start with a digit, so read them with index syntax, such as `llm.cost.cacheWriteDetails['1h']`. A lookup of a missing key fails, and the access log leaves out the field. To log `0` instead, check for the key first.

To set the rates and log the cost of 1-hour cache writes, follow these steps.

1. Add a `cacheWriteDetails` map to a model's `rates` or to a tier's `rates` in your catalog JSON. Writes for a TTL that the map omits use the `cacheWrite` rate. The built-in catalog already sets these rates for many Anthropic and OpenAI models.

   ```json
   "claude-opus-5": {
     "rates": {
       "input": "5",
       "output": "25",
       "cacheRead": "0.5",
       "cacheWrite": "6.25",
       "cacheWriteDetails": { "1h": "10" }
     }
   }
   ```

2. Add the cost of 1-hour cache writes as an access log attribute. The expression checks for the key first, so requests without 1-hour writes log `0`.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: cache-write-log
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       accessLog:
         attributes:
           add:
           - name: cache_write_1h
             expression: "'1h' in llm.cost.cacheWriteDetails ? llm.cost.cacheWriteDetails['1h'] : 0.0"
   EOF
   ```

   Example output:

   ```console
   agentgatewaypolicy.agentgateway.dev/cache-write-log created
   ```

3. Send a request that writes to the 1-hour cache, and check the proxy logs for the `cache_write_1h` field.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} | grep cache_write_1h
   ```

   The following log entry is for a request that wrote 400,000 tokens to the 5-minute cache and 600,000 tokens to the 1-hour cache. The 1-hour writes cost `$6`, and the 5-minute writes cost `$2.50`.

   ```console
   ... gen_ai.provider.name=anthropic gen_ai.request.model=claude-opus-5
   gen_ai.usage.cache_creation.input_tokens=1000000 agw.ai.usage.cost.total=8.50075 cache_write_1h=6 ...
   ```

### Service tiers {#service-tiers}

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} normalizes the service tier reported in each LLM response to `standard`, `flex`, `priority`, or `reserved`. CEL expressions access it as `llm.serviceTier`.

Cost calculations match this value to catalog tiers with a `serviceTier` field. Requests without a recorded tier use `standard` rates.

| Provider | Reported tier and normalized `llm.serviceTier` |
|---|---|
| OpenAI and Azure | `default` becomes `standard`. `flex` stays `flex`. `priority` and `fast` become `priority`. `scale` becomes `reserved`. |
| Anthropic | `standard` and `priority` stay the same. |
| Amazon Bedrock | `default` and `standard` become `standard`. `flex`, `priority`, and `reserved` stay the same. |
| Gemini | `standard`, `flex`, and `priority` stay the same. |
| Vertex AI | `ON_DEMAND` becomes `standard`. `ON_DEMAND_FLEX` becomes `flex`. `ON_DEMAND_PRIORITY` becomes `priority`. `PROVISIONED_THROUGHPUT` becomes `reserved`. Claude models report the Anthropic tiers, `standard` and `priority`. |

Unlisted providers or tiers leave `llm.serviceTier` unset.

For Bedrock tier requests and the response header used to detect the tier, see [Service tier]({{< link-hextra path="/integrations/llm/providers/bedrock/#service-tier" >}}).

To record the tier in the access log, follow these steps.

1. Add `llm.serviceTier` as an access log attribute.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: service-tier-log
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       accessLog:
         attributes:
           add:
           - name: service_tier
             expression: llm.serviceTier
   EOF
   ```

   Example output:

   ```console
   agentgatewaypolicy.agentgateway.dev/service-tier-log created
   ```

2. Send a chat completion request that asks OpenAI for the priority tier. The request uses the `openai/*` model and the gateway address from the [LLM getting started]({{< link-hextra path="/documentation/quickstart/llm/" >}}).

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -s "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H content-type:application/json \
     -d '{
       "model": "openai/gpt-5-mini",
       "service_tier": "priority",
       "messages": [{"role": "user", "content": "Say hello."}]
     }' | jq '.service_tier'
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -s "http://localhost:8080/v1/chat/completions" \
     -H content-type:application/json \
     -d '{
       "model": "openai/gpt-5-mini",
       "service_tier": "priority",
       "messages": [{"role": "user", "content": "Say hello."}]
     }' | jq '.service_tier'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console
   "priority"
   ```

3. Check the proxy logs for the `service_tier` field.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} | grep service_tier
   ```

   Example output:

   ```console
   ... gen_ai.provider.name=openai gen_ai.request.model=gpt-5-mini gen_ai.response.model=gpt-5-mini
   agw.ai.original_model=openai/gpt-5-mini gen_ai.usage.input_tokens=10 gen_ai.usage.output_tokens=2
   agw.ai.usage.cost.total=0.0000117 service_tier="priority"
   ```

   A request without `service_tier` logs `service_tier="standard"`. A request to a provider that is not in the table has no `service_tier` field.

4. Optional: Remove the access log policy.

   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} service-tier-log -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```console
   agentgatewaypolicy.agentgateway.dev "service-tier-log" deleted from {{< reuse "agw-docs/snippets/namespace.md" >}} namespace
   ```

## Step 5: Monitor catalog lookups

Every cost lookup increments the `agentgateway_cost_catalog_lookups_total` counter, labeled with the lookup `status` and the request's `gen_ai_system` (provider), `gen_ai_request_model`, and `gen_ai_response_model`. Use the lookup to confirm that your catalog prices your traffic.

The `status` label is one of the following values:

| Status | Meaning |
|--------|---------|
| `Exact` | The provider and model were found in the catalog and priced. |
| `Unpriced` | The model was found, but its catalog entry has no rates, such as an entry with only `tags`. |
| `Missing` | The provider or model was not found in the catalog. |
| `NoCatalog` | No catalog was available for the lookup. Because the built-in catalog is always loaded, a running proxy does not report this status. |

To view the metric, port-forward the proxy and query the metrics endpoint:

1. Port-forward the gateway proxy.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15020
   ```

2. Query the metrics endpoint.

   ```sh
   curl -s http://localhost:15020/metrics | grep agentgateway_cost_catalog_lookups_total
   ```

3. Review the metrics.

   ```
   agentgateway_cost_catalog_lookups_total{status="NoCatalog",gen_ai_operation_name="chat",gen_ai_system="openai",gen_ai_request_model="gpt-3.5-turbo",gen_ai_response_model="gpt-3.5-turbo-0125",bind="80/agentgateway-system/agentgateway-proxy",gateway="agentgateway-system/agentgateway-proxy",listener="http",route="agentgateway-system/openai",route_rule="unknown"} 1
   ```

A rising `Missing` or `Unpriced` count means requests are flowing through models that your catalog does not price. Add the missing providers or models to your catalog and update the ConfigMap.

## Model tags

{{< reuse "agw-docs/snippets/model-catalog-tags.md" >}}

{{< doc-test paths="costs" >}}
# Create a catalog that prices the httpbun test model (gpt-4) and attach it to the Gateway
# through a Gateway-level AgentgatewayParameters resource.
kubectl apply -f- <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: costs-test-catalog
  namespace: agentgateway-system
data:
  catalog.json: |
    {
      "providers": {
        "openai": {
          "models": {
            "gpt-4": { "rates": { "input": "30", "output": "60" } }
          }
        }
      }
    }
---
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayParameters
metadata:
  name: costs-test-params
  namespace: agentgateway-system
spec:
  modelCatalog:
    sources:
      - configMap:
          name: costs-test-catalog
          key: catalog.json
EOF
kubectl patch gateway agentgateway-proxy -n agentgateway-system --type merge \
  -p '{"spec":{"infrastructure":{"parametersRef":{"name":"costs-test-params","group":"agentgateway.dev","kind":"AgentgatewayParameters"}}}}'
# Attaching the catalog rolls the proxy so it can mount the ConfigMap.
sleep 10
kubectl rollout status deployment/agentgateway-proxy -n agentgateway-system --timeout=180s
{{< /doc-test >}}

{{< doc-test paths="costs" >}}
# Send priced traffic through the httpbun route and confirm the catalog prices it. The proxy
# always logs agw.ai.usage.cost.total for LLM requests (Step 4); a value greater than 0 means
# the catalog priced the gpt-4 model. Read the cost from the proxy access log rather than the
# stats endpoint, which is not reachable from outside the proxy pod in automated tests.
export INGRESS_GW_ADDRESS=$(kubectl get gateway agentgateway-proxy -n agentgateway-system -o jsonpath="{.status.addresses[0].value}")
priced=false
for i in $(seq 1 12); do
  curl -s --max-time 15 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions" \
    -H "content-type: application/json" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}' || true
  cost=$(kubectl logs deployment/agentgateway-proxy -n agentgateway-system --tail=500 2>/dev/null \
    | grep -oE 'agw\.ai\.usage\.cost\.total[^0-9-]*[0-9]+(\.[0-9]+)?' \
    | grep -oE '[0-9]+(\.[0-9]+)?$' \
    | sort -rn | head -1 || true)
  if [ -n "$cost" ] && awk "BEGIN{exit !(${cost} > 0)}"; then
    priced=true
    break
  fi
  sleep 5
done
if [ "$priced" != "true" ]; then
  echo "FAIL: catalog did not price gpt-4 traffic (no non-zero agw.ai.usage.cost.total in access log)"
  exit 1
fi
echo "PASS: catalog priced gpt-4 traffic (agw.ai.usage.cost.total=${cost})"
{{< /doc-test >}}

{{< doc-test paths="costs" >}}
# Cleanup: detach the catalog and remove the test resources.
kubectl patch gateway agentgateway-proxy -n agentgateway-system --type json \
  -p '[{"op":"remove","path":"/spec/infrastructure/parametersRef"}]' || true
kubectl delete agentgatewayparameters costs-test-params -n agentgateway-system --ignore-not-found
kubectl delete configmap costs-test-catalog -n agentgateway-system --ignore-not-found
{{< /doc-test >}}
