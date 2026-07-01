---
title: Model costs
weight: 20
description: Price LLM requests with a model cost catalog and expose realized USD costs in logs, traces, and metrics.
test:
  costs:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - file: content/docs/kubernetes/main/llm/cost-controls/costs.md
    path: costs
---

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} can compute the realized USD cost of each LLM request when you provide a model cost catalog. With a catalog in place, {{< reuse "agw-docs/snippets/agentgateway.md" >}} attributes cost per request in access logs, traces, and metrics, and exposes the values to CEL expressions as `llm.cost` and `llm.costRates`.

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} does not ship a built-in catalog. Costs are computed only when you configure one (for example, a catalog that you generate with [`agctl costs import`](#generate-a-catalog-with-agctl)).

In Kubernetes mode, you deliver the catalog as a ConfigMap and reference it from a Gateway-level {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource.

## Step 1: Prepare a catalog

Prepare a catalog by creating your own JSON file or using the `agctl costs import` command.

### Catalog JSON format

{{< reuse "agw-docs/snippets/model-catalog-json-format.md" >}}

### Generate a catalog with agctl

Use `agctl costs import` to generate a catalog JSON file, then load it into a ConfigMap.

1. Generate a catalog from a supported source. By default, `agctl costs import` imports every provider that the proxy supports from [models.dev](https://models.dev). To import only a subset of providers, pass a comma-separated list to `--providers`.

   ```sh
   agctl costs import --pretty --providers openai,anthropic --out ./catalog.json
   ```

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

4. Reference the ConfigMap from your {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, as shown in the next section, [Configure a catalog as a ConfigMap](#configure-a-catalog-as-a-configmap).

For all options, see the [`agctl costs import`]({{< link-hextra path="/reference/agctl/agctl-costs-import/" >}}) reference.

## Step 2: Configure a catalog as a ConfigMap

1. Create a ConfigMap that holds the catalog JSON. The ConfigMap must be in the same namespace as the Gateway that references it. By default, the catalog is read from the `catalog.json` data key. If you used the `agctl costs import` command, you already created the ConfigMap.

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

2. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that references the ConfigMap as a catalog source. Sources are merged in order, with later sources taking precedence at the model level.

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
         group: {{< reuse "agw-docs/snippets/gatewayparam-group.md" >}}
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

{{< callout type="warning" >}}
`modelCatalog` is honored only on a **Gateway-level** {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource (attached through `Gateway.spec.infrastructure.parametersRef`). `modelCatalog` is ignored on a GatewayClass-level {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, because ConfigMap references are resolved from the Gateway's deployment namespace.
{{< /callout >}}

## Step 3: Generate traffic

Generate traffic through agentgateway that matches a model entry from the catalog. For example steps, try the [LLM getting started]({{< link-hextra path="/quickstart/llm/" >}}).

## Step 4: Use cost data in CEL, logs, traces, and metrics

When a request matches an entry in the catalog, {{< reuse "agw-docs/snippets/agentgateway.md" >}} populates the following CEL fields:

- `llm.cost`: The realized USD cost of the request. Includes `total` plus per-token-type components: `input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, `inputAudio`, and `outputAudio`. Unset when the model cannot be priced.
- `llm.costRates`: The effective USD-per-1,000,000-token rates that were applied, after tier selection. Unset when the model cannot be priced.

The request access log always includes `agw.ai.usage.cost.total` for LLM requests (it is `0` when the model cannot be priced). For how to view logs and add cost fields, see [Metrics and logs]({{< link-hextra path="/llm/observability/" >}}).

## Step 5: Monitor catalog lookups

Every cost lookup increments the `agentgateway_cost_catalog_lookups_total` counter, labeled with the lookup `status` and the request's `gen_ai_system` (provider), `gen_ai_request_model`, and `gen_ai_response_model`. Use the lookup to confirm that your catalog prices your traffic.

The `status` label is one of the following values:

| Status | Meaning |
|--------|---------|
| `Exact` | The provider and model were found in the catalog and priced. |
| `Unpriced` | The model was found, but the token types in the request had no matching rates. |
| `Missing` | The provider or model was not found in the catalog. |
| `NoCatalog` | No catalog is configured. |

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
# Send priced traffic through the httpbun route and confirm the catalog prices it
# (the lookup metric records status="Exact" for the gpt-4 model).
export INGRESS_GW_ADDRESS=$(kubectl get gateway agentgateway-proxy -n agentgateway-system -o jsonpath="{.status.addresses[0].value}")
kubectl port-forward deployment/agentgateway-proxy -n agentgateway-system 15020:15020 > /dev/null 2>&1 &
PF_PID=$!
trap 'kill $PF_PID 2>/dev/null' EXIT
sleep 3
priced=false
for i in $(seq 1 12); do
  curl -s -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions" \
    -H "content-type: application/json" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}'
  if curl -s http://localhost:15020/metrics \
      | grep -E 'agentgateway_cost_catalog_lookups_total\{status="Exact"' \
      | grep -q 'gen_ai_request_model="gpt-4"'; then
    priced=true
    break
  fi
  sleep 5
done
if [ "$priced" != "true" ]; then
  echo "FAIL: catalog did not price gpt-4 traffic (no status=Exact lookup)"
  exit 1
fi
echo "PASS: catalog priced gpt-4 traffic (status=Exact)"
{{< /doc-test >}}

{{< doc-test paths="costs" >}}
# Cleanup: detach the catalog and remove the test resources.
kubectl patch gateway agentgateway-proxy -n agentgateway-system --type json \
  -p '[{"op":"remove","path":"/spec/infrastructure/parametersRef"}]' || true
kubectl delete agentgatewayparameters costs-test-params -n agentgateway-system --ignore-not-found
kubectl delete configmap costs-test-catalog -n agentgateway-system --ignore-not-found
{{< /doc-test >}}
