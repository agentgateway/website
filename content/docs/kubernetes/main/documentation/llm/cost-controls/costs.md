---
title: Model costs
weight: 20
description: Price LLM requests with a model cost catalog and expose realized USD costs in logs, traces, and metrics.
test:
  costs:
  - file: content/docs/kubernetes/main/documentation/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/integrations/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/main/documentation/llm/cost-controls/costs.md
    path: costs
---

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} computes the realized USD cost of each LLM request from a model cost catalog. For each priced request, {{< reuse "agw-docs/snippets/agentgateway.md" >}} records the cost in access logs, traces, and metrics, and exposes the values to CEL expressions as `llm.cost` and `llm.costRates`.

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

1. Generate a catalog from one or more supported sources. The `--source` flag takes a comma-separated list, and the sources merge in the order that you list them, so a later source overlays an earlier one. By default, `agctl catalog import` imports `models.dev,aws-bedrock-mantle`, which prices every provider that the proxy supports and then tags the Amazon Bedrock models. A source is a catalog to import from, not an LLM provider: each source covers one or more providers and contributes rates, tags, or both. To import only a subset of the providers that a source covers, pass a comma-separated list to `--providers`.

   | Source | What it contributes |
   |--------|---------------------|
   | `models.dev` | Rates for every provider that the proxy supports, from [models.dev](https://models.dev). |
   | `aws-bedrock-mantle` | Tags for Amazon Bedrock models only, read from the AWS model cards. This source contributes no rates. The tags record which endpoint serves a model, `runtime` or `mantle`, and which request formats the Mantle endpoint accepts. |
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

- `llm.cost`: The realized USD cost of the request. Includes `total` plus per-usage-type components: `input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, `inputAudio`, `outputAudio`, and `pages` for page-billed document models. Unset when the model cannot be priced.
- `llm.costRates`: The effective USD-per-1,000,000-token rates that were applied, after tier selection. For page-billed document models, `perPage` holds the USD-per-page rate instead. Unset when the model cannot be priced.

The request access log includes `agw.ai.usage.cost.total` only for priced LLM requests. When the model cannot be priced, which is a lookup status of `Unpriced` or `Missing` as described in the next step, the access log leaves out the field. For how to view logs and add cost fields, see [Metrics and logs]({{< link-hextra path="/documentation/llm/observability/" >}}).

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
