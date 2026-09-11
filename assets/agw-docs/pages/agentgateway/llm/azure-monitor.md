Export agentgateway metrics, access logs, and traces to Azure Monitor from Azure Kubernetes Service (AKS).

Each type of telemetry reaches Azure Monitor through a different path.

- Azure Monitor managed Prometheus scrapes controller metrics through a `ServiceMonitor`. It scrapes the Gateway proxy through a `PodMonitor`.
- Agentgateway writes structured access logs to stdout. Container Insights collects the proxy container's stdout and stores each record in the `ContainerLogV2` table in Log Analytics.
- An {{< reuse "agw-docs/snippets/policy.md" >}} sends traces over OpenTelemetry Protocol (OTLP) and gRPC to an in-cluster OpenTelemetry Collector. The Collector authenticates with AKS Workload Identity and sends OTLP over HTTP to Azure Monitor native ingestion, which stores the spans in Log Analytics' `OTelSpans` table.

## Before you begin

Check that you have these resources and permissions before changing the cluster.

- An existing AKS cluster with the agentgateway controller and a working Gateway API proxy. The examples use the documentation defaults in the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace with the `agentgateway-proxy` Gateway name.
- [OpenID Connect (OIDC) issuer](https://learn.microsoft.com/azure/aks/use-oidc-issuer) and [AKS Workload Identity](https://learn.microsoft.com/azure/aks/workload-identity-deploy-cluster) enabled on the cluster.
- [Azure Monitor managed service for Prometheus](https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable) enabled on the cluster. Managed Prometheus queries require the built-in `Monitoring Data Reader` role on the linked Azure Monitor workspace.
- [Container Insights](https://learn.microsoft.com/azure/azure-monitor/containers/container-insights-overview) enabled on the cluster with the `Microsoft-ContainerLogV2` stream and stdout collection enabled. Access-log queries require the built-in `Log Analytics Reader` role on its linked workspace.
- Access logs that retain the default `http.status`, `trace.id`, and `duration` fields. The verification supports text and JSON log formats.
- A working model or provider route through your existing Gateway, plus a representative request for that route. This guide does not create a provider or route.
- Azure CLI, `kubectl`, `jq`, `curl`, and OpenSSL installed locally. Sign in to Azure and configure `kubectl` for the target cluster.
- `Contributor` on the resource group, or an equivalent custom role that grants create and read access to `Microsoft.OperationalInsights/workspaces`, `Microsoft.Insights/dataCollectionEndpoints`, `Microsoft.Insights/dataCollectionRules`, `Microsoft.ManagedIdentity/userAssignedIdentities`, and `Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials`.
- `Role Based Access Control Administrator`, `User Access Administrator`, or equivalent `Microsoft.Authorization/roleAssignments/read` and `Microsoft.Authorization/roleAssignments/write` permissions at the DCR scope. These permissions let you inspect and assign `Monitoring Metrics Publisher` for the Collector identity.
- Kubernetes create and get access for the named `ServiceMonitor`, `PodMonitor`, `AgentgatewayPolicy`, `ServiceAccount`, `ConfigMap`, `Deployment`, `Service`, `NetworkPolicy`, and `ReferenceGrant` resources used by this guide.
- You need get access for the cluster-scoped `Namespace` resource named `otel-system`. If the namespace is absent, you also need create access for that resource.
- Verification requires get and list access to the relevant Custom Resource Definitions (CRDs), each named resource, the agentgateway controller, Collector and Gateway proxy pods, and pod logs. Deployment rollout status also requires watch access to the Collector `Deployment`.
- `Log Analytics Reader` or equivalent query permission on the Log Analytics workspace for trace verification.

> [!IMPORTANT]
> Choose unused names for the Azure resources and Kubernetes objects created below. The setup checks stop if those names already exist.

## Set environment variables

Set your subscription, resource group, and cluster names. Choose unused names for the Log Analytics workspace, DCE, DCR, and Collector identity. The `otel-system` namespace and `otel-collector` service account must match the Workload Identity subject used later.

```sh
export SUBSCRIPTION_ID="<subscription-id>"
export RESOURCE_GROUP="<existing-resource-group>"
export LOCATION="<azure-region>"
export AKS_CLUSTER="<aks-cluster-name>"
export LOG_ANALYTICS_WORKSPACE="agw-law"
export DATA_COLLECTION_ENDPOINT="agw-dce"
export DATA_COLLECTION_RULE="agw-dcr"
export COLLECTOR_IDENTITY="agw-otel"
export CONTROLLER_NAMESPACE={{< reuse "agw-docs/snippets/namespace.md" >}}
export CONTROLLER_SERVICE_NAME=agentgateway
export CONTROLLER_SERVICE_MONITOR=agentgateway-controller
export GATEWAY_NAMESPACE={{< reuse "agw-docs/snippets/namespace.md" >}}
export GATEWAY_NAME=agentgateway-proxy
export GATEWAY_POD_MONITOR=agentgateway-proxy
export OTEL_NAMESPACE=otel-system
export OTEL_COLLECTOR_NAME=otel-collector
export OTEL_SERVICE_ACCOUNT=otel-collector
export OTEL_NETWORK_POLICY=otel-collector-ingress
export OTEL_REFERENCE_GRANT=agentgateway-to-otel-collector
export OTEL_COLLECTOR_IMAGE=otel/opentelemetry-collector-contrib:0.148.0
export TRACE_POLICY_NAME=azure-monitor-tracing
export FEDERATED_CREDENTIAL_NAME=agentgateway-otel-collector
unset AZURE_NAME_PREFLIGHT_PASSED

if ! jq -en \
  --arg subscription "$SUBSCRIPTION_ID" \
  --arg resource_group "$RESOURCE_GROUP" \
  --arg location "$LOCATION" \
  --arg cluster "$AKS_CLUSTER" \
  --arg workspace "$LOG_ANALYTICS_WORKSPACE" \
  --arg dce "$DATA_COLLECTION_ENDPOINT" \
  --arg dcr "$DATA_COLLECTION_RULE" \
  --arg identity "$COLLECTOR_IDENTITY" \
  --arg controller_namespace "$CONTROLLER_NAMESPACE" \
  --arg gateway_namespace "$GATEWAY_NAMESPACE" \
  --arg gateway "$GATEWAY_NAME" '
    all([$subscription, $resource_group, $location, $cluster, $workspace, $dce, $dcr, $identity][];
      (length > 0) and (startswith("<") | not)) and
    all([$controller_namespace, $gateway_namespace, $gateway][];
      test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$"))'; then
  printf 'Replace every placeholder and use valid Kubernetes resource names.\n' >&2
  false
fi &&
az account set --subscription "$SUBSCRIPTION_ID" &&
az group show \
  --subscription "$SUBSCRIPTION_ID" \
  --name "$RESOURCE_GROUP" \
  --output none \
  --only-show-errors &&
kubectl config current-context
```

Run the command blocks in order in a Bash or Zsh session. Stop if a block returns a nonzero status and resolve the error before continuing.

## Export metrics to managed Prometheus

Managed Prometheus uses Azure Monitor's versions of the Prometheus Operator monitoring resources to discover the controller and Gateway proxy. It scrapes their metrics directly.

1. Check that the chosen `ServiceMonitor` and `PodMonitor` names are available. The commands stop if either object already exists.

   ```sh
   controller_monitor="$(kubectl get servicemonitors.azmonitoring.coreos.com \
     "$CONTROLLER_SERVICE_MONITOR" --namespace "$CONTROLLER_NAMESPACE" \
     --ignore-not-found --output name)" &&
   [ -z "$controller_monitor" ] &&
   gateway_monitor="$(kubectl get podmonitors.azmonitoring.coreos.com \
     "$GATEWAY_POD_MONITOR" --namespace "$GATEWAY_NAMESPACE" \
     --ignore-not-found --output name)" &&
   [ -z "$gateway_monitor" ]
   ```

2. Create a `ServiceMonitor` for the controller and a `PodMonitor` for the Gateway proxy.

   ```sh
   kubectl create -f- <<EOF
   apiVersion: azmonitoring.coreos.com/v1
   kind: ServiceMonitor
   metadata:
     name: ${CONTROLLER_SERVICE_MONITOR}
     namespace: ${CONTROLLER_NAMESPACE}
   spec:
     selector:
       matchLabels:
         agentgateway: agentgateway
         app.kubernetes.io/name: agentgateway
         app.kubernetes.io/instance: agentgateway
     endpoints:
       - port: metrics
         path: /metrics
         interval: 15s
   ---
   apiVersion: azmonitoring.coreos.com/v1
   kind: PodMonitor
   metadata:
     name: ${GATEWAY_POD_MONITOR}
     namespace: ${GATEWAY_NAMESPACE}
   spec:
     selector:
       matchLabels:
         gateway.networking.k8s.io/gateway-name: ${GATEWAY_NAME}
     podMetricsEndpoints:
       - port: metrics
         path: /metrics
         interval: 15s
   EOF
   ```

   | Field | Description |
   | --- | --- |
   | `ServiceMonitor.metadata.namespace` | Limits Service discovery to the controller namespace. A `ServiceMonitor` cannot select a Service in another namespace unless you add a `namespaceSelector`. |
   | `ServiceMonitor.spec.selector.matchLabels` | Selects the controller metrics Service by its three agentgateway Helm labels. All three labels must match the Service. |
   | `ServiceMonitor.spec.endpoints[].port` | Selects the Service port named `metrics`. This value is a port name, not a number. |
   | `ServiceMonitor.spec.endpoints[].path` | Scrapes the controller's `/metrics` endpoint. |
   | `ServiceMonitor.spec.endpoints[].interval` | Requests a scrape every 15 seconds. |
   | `PodMonitor.metadata.namespace` | Limits Pod discovery to the namespace that contains your Gateway proxy. |
   | `PodMonitor.spec.selector.matchLabels` | Selects only pods created for the named Gateway through the `gateway.networking.k8s.io/gateway-name` label. |
   | `PodMonitor.spec.podMetricsEndpoints[].port` | Selects the proxy container port named `metrics`. This value is a port name, not a number. |
   | `PodMonitor.spec.podMetricsEndpoints[].path` | Scrapes the proxy's `/metrics` endpoint. |
   | `PodMonitor.spec.podMetricsEndpoints[].interval` | Requests a scrape every 15 seconds. |

3. Confirm that both monitoring resources exist.

   ```sh
   kubectl get servicemonitors.azmonitoring.coreos.com "$CONTROLLER_SERVICE_MONITOR" \
     --namespace "$CONTROLLER_NAMESPACE" \
     --output name &&
   kubectl get podmonitors.azmonitoring.coreos.com "$GATEWAY_POD_MONITOR" \
     --namespace "$GATEWAY_NAMESPACE" \
     --output name
   ```

## Verify managed Prometheus metrics

Use the Prometheus query interface for the Azure Monitor workspace linked to your AKS cluster. Target discovery and new samples can take several scrape intervals.

1. Generate the two `up` queries from your environment variables. Copy each resulting query into the Prometheus query interface.

   ```sh
   printf 'up{namespace="%s",service="%s",endpoint="metrics"}\n' \
     "$CONTROLLER_NAMESPACE" "$CONTROLLER_SERVICE_NAME"
   printf 'up{namespace="%s",pod=~"%s-.*",endpoint="metrics"}\n' \
     "$GATEWAY_NAMESPACE" "$GATEWAY_NAME"
   ```

   Confirm that every returned target is `1`. The first query checks the controller `ServiceMonitor`, and the second checks the Gateway proxy `PodMonitor`.

2. Generate the Gateway request counter query and run it in the same interface.

   ```sh
   printf 'sum(agentgateway_requests_total{namespace="%s",pod=~"%s-.*"}) or vector(0)\n' \
     "$GATEWAY_NAMESPACE" "$GATEWAY_NAME"
   ```

3. Record the counter value. Send one representative request through your existing Gateway route with the client and headers that route already requires. Do not create a provider-specific route for this check.

4. Rerun the counter query after managed Prometheus ingests the next samples. Confirm that the value is greater than the value you recorded.

## Create the native OTLP trace resources

Trace ingestion uses a public Data Collection Endpoint (DCE) and a Data Collection Rule (DCR). The DCR sends only the three native OpenTelemetry trace streams to Log Analytics.

1. Run the read-only checks below for conflicts with existing Azure resources and recoverable Log Analytics workspaces. Resolve any API or permission error before continuing.

   ```sh
   unset AZURE_NAME_PREFLIGHT_PASSED
   azure_resources="$(az resource list \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --output json --only-show-errors)" &&
   jq -e \
     --arg workspace "$LOG_ANALYTICS_WORKSPACE" \
     --arg dce "$DATA_COLLECTION_ENDPOINT" \
     --arg dcr "$DATA_COLLECTION_RULE" \
     --arg identity "$COLLECTOR_IDENTITY" '
       type == "array" and
       all(.[];
         ((.type | ascii_downcase) != "microsoft.operationalinsights/workspaces" or
           (.name | ascii_downcase) != ($workspace | ascii_downcase)) and
         ((.type | ascii_downcase) != "microsoft.insights/datacollectionendpoints" or
           (.name | ascii_downcase) != ($dce | ascii_downcase)) and
         ((.type | ascii_downcase) != "microsoft.insights/datacollectionrules" or
           (.name | ascii_downcase) != ($dcr | ascii_downcase)) and
         ((.type | ascii_downcase) != "microsoft.managedidentity/userassignedidentities" or
           (.name | ascii_downcase) != ($identity | ascii_downcase)))' \
     <<<"$azure_resources" &&
   deleted_workspaces="$(az monitor log-analytics workspace list-deleted-workspaces \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --output json --only-show-errors)" &&
   jq -e --arg name "$LOG_ANALYTICS_WORKSPACE" --arg location "$LOCATION" '
     type == "array" and
     all(.[];
       ((.name // "") | ascii_downcase) != ($name | ascii_downcase) or
       ((.location // "") | ascii_downcase) != ($location | ascii_downcase))' \
     <<<"$deleted_workspaces" &&
   export AZURE_NAME_PREFLIGHT_PASSED=true
   ```

2. Create and validate the Log Analytics workspace, then retrieve its resource ID and workspace ID.

   ```sh
   [ "${AZURE_NAME_PREFLIGHT_PASSED:-false}" = "true" ] &&
   az monitor log-analytics workspace create \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
     --location "$LOCATION" \
     --sku PerGB2018 \
     --retention-time 30 \
     --output none \
     --only-show-errors &&
   workspace_json="$(az monitor log-analytics workspace show \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
     --output json \
     --only-show-errors)" &&
   if ! jq -e \
     --arg location "$LOCATION" '
       (.location | ascii_downcase) == ($location | ascii_downcase) and
       .provisioningState == "Succeeded" and
       .sku.name == "PerGB2018" and
       (.customerId // "") != ""' \
     <<<"$workspace_json" >/dev/null; then
     printf 'The new Log Analytics workspace failed validation.\n' >&2
     false
   fi &&
   LOG_ANALYTICS_RESOURCE_ID="$(jq -er '.id | select(length > 0)' \
     <<<"$workspace_json")" &&
   LOG_ANALYTICS_WORKSPACE_ID="$(jq -er '.customerId | select(length > 0)' \
     <<<"$workspace_json")" &&
   export LOG_ANALYTICS_RESOURCE_ID LOG_ANALYTICS_WORKSPACE_ID
   ```

3. Create the public DCE with Azure Monitor API version `2024-03-11`, then retrieve and validate the resource.

   ```sh
   export DATA_COLLECTION_ENDPOINT_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Insights/dataCollectionEndpoints/${DATA_COLLECTION_ENDPOINT}" &&
   DCE_BODY="$(jq -n \
     --arg location "$LOCATION" '{
       location: $location,
       properties: {
         description: "agentgateway native OTLP endpoint",
         networkAcls: {publicNetworkAccess: "Enabled"}
       }
     }')" &&
   export DCE_BODY &&
   az rest \
     --method put \
     --url "${DATA_COLLECTION_ENDPOINT_ID}?api-version=2024-03-11" \
     --body "$DCE_BODY" \
     --output none \
     --only-show-errors &&
   DCE_JSON="$(az rest \
     --method get \
     --url "${DATA_COLLECTION_ENDPOINT_ID}?api-version=2024-03-11" \
     --output json \
     --only-show-errors)" &&
   export DCE_JSON &&
   if ! jq -e \
     --arg name "$DATA_COLLECTION_ENDPOINT" \
     --arg location "$LOCATION" '
       .name == $name and
       (.location | ascii_downcase) == ($location | ascii_downcase) and
       .properties.provisioningState == "Succeeded" and
       .properties.networkAcls.publicNetworkAccess == "Enabled" and
       (.properties.logsIngestion.endpoint | test("^https://"))' \
     <<<"$DCE_JSON" >/dev/null; then
     printf 'The new Data Collection Endpoint failed validation.\n' >&2
     false
   fi
   ```

   | Field | Description |
   | --- | --- |
   | `location` | Places the DCE in the selected Azure region. |
   | `properties.provisioningState` | Must report `Succeeded` before the ingestion endpoint is used. |
   | `properties.networkAcls.publicNetworkAccess` | Enables the Collector to reach the DCE through its public endpoint. Use a private connectivity design instead if your cluster blocks public egress. |
   | `properties.logsIngestion.endpoint` | Supplies the endpoint prefix returned by Azure. The command removes any trailing slash before adding the immutable DCR path. |

4. Create the trace-only DCR with Azure Monitor API version `2024-03-11`, then retrieve and validate the resource.

   ```sh
   export DATA_COLLECTION_RULE_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Insights/dataCollectionRules/${DATA_COLLECTION_RULE}" &&
   DCR_BODY="$(jq -n \
     --arg location "$LOCATION" \
     --arg dce "$DATA_COLLECTION_ENDPOINT_ID" \
     --arg workspace "$LOG_ANALYTICS_RESOURCE_ID" '
     def trace_streams: [
       "Microsoft-OTel-Traces-Spans",
       "Microsoft-OTel-Traces-Events",
       "Microsoft-OTel-Traces-Resources"
     ];
     {
       location: $location,
       properties: {
         description: "agentgateway native OTLP traces",
         dataCollectionEndpointId: $dce,
         directDataSources: {
           otelTraces: [{
             streams: trace_streams,
             enrichWithResourceAttributes: ["*"],
             name: "otelTracesDataSourceDirect"
           }]
         },
         destinations: {
           logAnalytics: [{
             workspaceResourceId: $workspace,
             name: "otelLaw"
           }]
         },
         dataFlows: [{
           streams: trace_streams,
           destinations: ["otelLaw"]
         }]
       }
     }')" &&
   export DCR_BODY &&
   az rest \
     --method put \
     --url "${DATA_COLLECTION_RULE_ID}?api-version=2024-03-11" \
     --body "$DCR_BODY" \
     --output none \
     --only-show-errors &&
   DCR_JSON="$(az rest \
     --method get \
     --url "${DATA_COLLECTION_RULE_ID}?api-version=2024-03-11" \
     --output json \
     --only-show-errors)" &&
   export DCR_JSON &&
   if ! jq -e \
     --arg name "$DATA_COLLECTION_RULE" \
     --arg location "$LOCATION" \
     --arg dce "$DATA_COLLECTION_ENDPOINT_ID" \
     --arg workspace "$LOG_ANALYTICS_RESOURCE_ID" '
       def expected: [
         "Microsoft-OTel-Traces-Events",
         "Microsoft-OTel-Traces-Resources",
         "Microsoft-OTel-Traces-Spans"
       ];
       .name == $name and
       (.location | ascii_downcase) == ($location | ascii_downcase) and
       .properties.provisioningState == "Succeeded" and
       (.properties.dataCollectionEndpointId | ascii_downcase) == ($dce | ascii_downcase) and
       (.properties.dataSources // {}) == {} and
       (.properties.references // {}) == {} and
       (.properties.directDataSources | keys) == ["otelTraces"] and
       (.properties.directDataSources.otelTraces | length) == 1 and
       (.properties.directDataSources.otelTraces[0].streams | sort) == expected and
       .properties.directDataSources.otelTraces[0].enrichWithResourceAttributes == ["*"] and
       (.properties.destinations | keys) == ["logAnalytics"] and
       (.properties.destinations.logAnalytics | length) == 1 and
       (.properties.destinations.logAnalytics[0] | {workspaceResourceId, name}) == {
         workspaceResourceId: $workspace, name: "otelLaw"
       } and
       (.properties.dataFlows | length) == 1 and
       (.properties.dataFlows[0].streams | sort) == expected and
       .properties.dataFlows[0].destinations == ["otelLaw"] and
       (.properties.immutableId // "") != ""' \
     <<<"$DCR_JSON" >/dev/null; then
     printf 'The new Data Collection Rule failed trace-only validation.\n' >&2
     false
   fi
   ```

   | Field | Description |
   | --- | --- |
   | `properties.dataCollectionEndpointId` | Connects this DCR to the DCE created in the previous step. |
   | `properties.directDataSources.otelTraces[].streams` | Accepts native span, event, and resource streams. The rule contains no metric or log data source. |
   | `properties.directDataSources.otelTraces[].enrichWithResourceAttributes` | Copies OpenTelemetry resource attributes, including the service identity, into the native tables. |
   | `properties.destinations.logAnalytics` | Selects the Log Analytics workspace that stores the trace records. |
   | `properties.dataFlows` | Sends all three trace streams to the `otelLaw` destination. |
   | `properties.immutableId` | Forms the immutable rule segment of the native ingestion URL. |

5. Construct and validate the Collector's native traces endpoint from the DCE logs ingestion endpoint and immutable DCR ID.

   ```sh
   DCE_LOGS_INGESTION_ENDPOINT="$(jq -er \
     '.properties.logsIngestion.endpoint | select(length > 0)' \
     <<<"$DCE_JSON")" &&
   DCR_IMMUTABLE_ID="$(jq -er \
     '.properties.immutableId | select(length > 0)' \
     <<<"$DCR_JSON")" &&
   AZURE_MONITOR_OTLP_TRACES_ENDPOINT="${DCE_LOGS_INGESTION_ENDPOINT%/}/dataCollectionRules/${DCR_IMMUTABLE_ID}/streams/Microsoft-OTLP-Traces/otlp/v1/traces" &&
   if ! jq -en --arg endpoint "$AZURE_MONITOR_OTLP_TRACES_ENDPOINT" '$endpoint | test("^https://[^|&\\\\[:space:]]+$")'; then
     false
   fi &&
   export DCE_LOGS_INGESTION_ENDPOINT DCR_IMMUTABLE_ID &&
   export AZURE_MONITOR_OTLP_TRACES_ENDPOINT
   ```

## Configure Workload Identity for the Collector

The Collector authenticates as a user-assigned managed identity. AKS projects a signed service account token into the Collector pod, so this path needs no client secret, connection string, instrumentation key, or Application Insights resource.

1. Create and validate the Collector identity, then record its client and principal IDs.

   ```sh
   [ "${AZURE_NAME_PREFLIGHT_PASSED:-false}" = "true" ] &&
   az identity create \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --name "$COLLECTOR_IDENTITY" \
     --location "$LOCATION" \
     --output none \
     --only-show-errors &&
   identity_json="$(az identity show \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --name "$COLLECTOR_IDENTITY" \
     --output json \
     --only-show-errors)" &&
   if ! jq -e \
     '
       ((.id // "") | length > 0) and
       (.clientId | test("^[0-9A-Fa-f-]{36}$")) and
       (.principalId | test("^[0-9A-Fa-f-]{36}$"))' \
     <<<"$identity_json" >/dev/null; then
     printf 'The new Collector identity failed validation.\n' >&2
     false
   fi &&
   COLLECTOR_CLIENT_ID="$(jq -er '.clientId | select(length > 0)' \
     <<<"$identity_json")" &&
   COLLECTOR_PRINCIPAL_ID="$(jq -er '.principalId | select(length > 0)' \
     <<<"$identity_json")" &&
   export COLLECTOR_CLIENT_ID COLLECTOR_PRINCIPAL_ID
   ```

2. Retrieve the AKS OIDC issuer and create the federated identity credential for the exact Collector service account subject.

   ```sh
   aks_json="$(az aks show \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --name "$AKS_CLUSTER" \
     --output json \
     --only-show-errors)" &&
   if ! jq -e '
     .oidcIssuerProfile.enabled == true and
     .securityProfile.workloadIdentity.enabled == true and
     (.oidcIssuerProfile.issuerUrl // "") != ""' \
     <<<"$aks_json" >/dev/null; then
     printf 'AKS OIDC or Workload Identity is not enabled.\n' >&2
     false
   fi &&
   AKS_OIDC_ISSUER="$(jq -er '.oidcIssuerProfile.issuerUrl' \
     <<<"$aks_json")" &&
   export AKS_OIDC_ISSUER &&
   export COLLECTOR_SUBJECT="system:serviceaccount:otel-system:otel-collector" &&
   credentials="$(az identity federated-credential list \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --identity-name "$COLLECTOR_IDENTITY" \
     --output json \
     --only-show-errors)" &&
   if ! jq -e --arg name "$FEDERATED_CREDENTIAL_NAME" '[.[] | select(.name == $name)] | length == 0' \
     <<<"$credentials" >/dev/null; then
     printf 'Refusing an existing federated credential named %s.\n' \
       "$FEDERATED_CREDENTIAL_NAME" >&2
     false
   fi &&
   az identity federated-credential create \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --identity-name "$COLLECTOR_IDENTITY" \
     --name "$FEDERATED_CREDENTIAL_NAME" \
     --issuer "$AKS_OIDC_ISSUER" \
     --subject "$COLLECTOR_SUBJECT" \
     --audiences api://AzureADTokenExchange \
     --output none \
     --only-show-errors
   ```

3. Assign `Monitoring Metrics Publisher` at the DCR scope. Despite its name, this role also authorizes native OTLP trace writes to the DCR.

   ```sh
   MONITORING_METRICS_PUBLISHER_ROLE_ID="3913510d-42f4-4e42-8a64-420c390055eb" &&
   assignments="$(az role assignment list \
     --subscription "$SUBSCRIPTION_ID" \
     --assignee-object-id "$COLLECTOR_PRINCIPAL_ID" \
     --role "$MONITORING_METRICS_PUBLISHER_ROLE_ID" \
     --scope "$DATA_COLLECTION_RULE_ID" \
     --output json --only-show-errors)" &&
   jq -e \
     --arg principal "$COLLECTOR_PRINCIPAL_ID" \
     --arg scope "$DATA_COLLECTION_RULE_ID" \
     --arg role "$MONITORING_METRICS_PUBLISHER_ROLE_ID" '
       type == "array" and length <= 1 and
       all(.[];
         (.principalId | ascii_downcase) == ($principal | ascii_downcase) and
         (.scope | ascii_downcase) == ($scope | ascii_downcase) and
         (.roleDefinitionId | ascii_downcase | endswith("/" + ($role | ascii_downcase))))' \
     <<<"$assignments" &&
   if [ "$(jq 'length' <<<"$assignments")" -eq 0 ]; then
     az role assignment create \
       --subscription "$SUBSCRIPTION_ID" \
       --assignee-object-id "$COLLECTOR_PRINCIPAL_ID" \
       --assignee-principal-type ServicePrincipal \
       --role "$MONITORING_METRICS_PUBLISHER_ROLE_ID" \
       --scope "$DATA_COLLECTION_RULE_ID" \
       --output none --only-show-errors
   fi
   ```

## Deploy the OpenTelemetry Collector

The Collector receives trace data inside the cluster and exports only traces to Azure Monitor. The NetworkPolicy accepts OTLP traffic only from pods for your named Gateway.

1. Check whether the Collector namespace exists, and create it if needed. The commands leave an existing namespace unchanged and stop if the lookup fails.

   ```sh
   namespace_state="$(kubectl get namespace "$OTEL_NAMESPACE" \
     --ignore-not-found --output name)" &&
   if [ -z "$namespace_state" ]; then
     kubectl create namespace "$OTEL_NAMESPACE"
   fi
   ```

2. Check that the Collector object names in `otel-system` are available. The commands stop if an object already exists or an API or RBAC error prevents the check.

   ```sh
   (
     while read -r resource_type resource_name; do
       object_state="$(kubectl get "$resource_type" "$resource_name" \
         --namespace "$OTEL_NAMESPACE" --ignore-not-found --output name)" || exit 1
       if [ -n "$object_state" ]; then
         printf 'Resource already exists: %s\n' "$object_state" >&2
         exit 1
       fi
     done <<EOF
   serviceaccounts ${OTEL_SERVICE_ACCOUNT}
   configmaps ${OTEL_COLLECTOR_NAME}
   deployments.apps ${OTEL_COLLECTOR_NAME}
   services ${OTEL_COLLECTOR_NAME}
   networkpolicies.networking.k8s.io ${OTEL_NETWORK_POLICY}
   referencegrants.gateway.networking.k8s.io ${OTEL_REFERENCE_GRANT}
   EOF
   )
   ```

3. Apply the Collector manifest. Your shell fills in the setup variables, while escaped expressions such as `\${env:AZURE_CLIENT_ID}` remain literal for the Collector to resolve.

   ```sh
   jq -en \
   --arg client_id "$COLLECTOR_CLIENT_ID" \
   --arg endpoint "$AZURE_MONITOR_OTLP_TRACES_ENDPOINT" \
   --arg namespace "$GATEWAY_NAMESPACE" \
   --arg gateway "$GATEWAY_NAME" \
   --arg otel_namespace "$OTEL_NAMESPACE" \
   --arg collector "$OTEL_COLLECTOR_NAME" \
   --arg service_account "$OTEL_SERVICE_ACCOUNT" \
   --arg network_policy "$OTEL_NETWORK_POLICY" \
   --arg reference_grant "$OTEL_REFERENCE_GRANT" \
   --arg image "$OTEL_COLLECTOR_IMAGE" '
     ($client_id | test("^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$")) and
     ($endpoint | test("^https://[^|&\\\\[:space:]]+$")) and
     ($namespace | test("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")) and
     ($gateway | test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$")) and
     ($otel_namespace == "otel-system") and
     ($service_account == "otel-collector") and
     ([$collector, $network_policy, $reference_grant] |
       all(.[]; test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$"))) and
     ($image == "otel/opentelemetry-collector-contrib:0.148.0")' &&
   kubectl create -f- <<EOF
   apiVersion: v1
   kind: ServiceAccount
   metadata:
     name: ${OTEL_SERVICE_ACCOUNT}
     namespace: ${OTEL_NAMESPACE}
     annotations:
       azure.workload.identity/client-id: "${COLLECTOR_CLIENT_ID}"
   ---
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: ${OTEL_COLLECTOR_NAME}
     namespace: ${OTEL_NAMESPACE}
   data:
     collector.yaml: |
       receivers:
         otlp:
           protocols:
             grpc:
               endpoint: 0.0.0.0:4317
       processors:
         memory_limiter:
           check_interval: 1s
           limit_mib: 256
           spike_limit_mib: 64
         batch:
           send_batch_size: 512
           timeout: 5s
       extensions:
         health_check:
           endpoint: 0.0.0.0:13133
         azure_auth:
           workload_identity:
             client_id: \${env:AZURE_CLIENT_ID}
             federated_token_file: \${env:AZURE_FEDERATED_TOKEN_FILE}
             tenant_id: \${env:AZURE_TENANT_ID}
           scopes:
             - https://monitor.azure.com/.default
       exporters:
         otlphttp/azuremonitor:
           traces_endpoint: \${env:AZURE_MONITOR_OTLP_TRACES_ENDPOINT}
           auth:
             authenticator: azure_auth
           sending_queue:
             enabled: true
             queue_size: 1000
           retry_on_failure:
             enabled: true
             initial_interval: 5s
             max_interval: 30s
             max_elapsed_time: 300s
       service:
         extensions: [health_check, azure_auth]
         pipelines:
           traces:
             receivers: [otlp]
             processors: [memory_limiter, batch]
             exporters: [otlphttp/azuremonitor]
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: ${OTEL_COLLECTOR_NAME}
     namespace: ${OTEL_NAMESPACE}
     labels:
       app.kubernetes.io/name: ${OTEL_COLLECTOR_NAME}
   spec:
     replicas: 1
     selector:
       matchLabels:
         app.kubernetes.io/name: ${OTEL_COLLECTOR_NAME}
     template:
       metadata:
         labels:
           app.kubernetes.io/name: ${OTEL_COLLECTOR_NAME}
           azure.workload.identity/use: "true"
       spec:
         serviceAccountName: ${OTEL_SERVICE_ACCOUNT}
         securityContext:
           runAsNonRoot: true
           seccompProfile:
             type: RuntimeDefault
         containers:
           - name: collector
             image: ${OTEL_COLLECTOR_IMAGE}
             imagePullPolicy: IfNotPresent
             args: ["--config=/conf/collector.yaml"]
             env:
               - name: AZURE_MONITOR_OTLP_TRACES_ENDPOINT
                 value: "${AZURE_MONITOR_OTLP_TRACES_ENDPOINT}"
             ports:
               - name: otlp-grpc
                 containerPort: 4317
                 protocol: TCP
               - name: health
                 containerPort: 13133
                 protocol: TCP
             readinessProbe:
               httpGet:
                 path: /
                 port: health
               initialDelaySeconds: 2
               periodSeconds: 5
             livenessProbe:
               httpGet:
                 path: /
                 port: health
               initialDelaySeconds: 10
               periodSeconds: 10
             resources:
               requests:
                 cpu: 50m
                 memory: 128Mi
               limits:
                 cpu: 500m
                 memory: 384Mi
             securityContext:
               allowPrivilegeEscalation: false
               capabilities:
                 drop: ["ALL"]
               readOnlyRootFilesystem: true
             volumeMounts:
               - name: config
                 mountPath: /conf
                 readOnly: true
         volumes:
         - name: config
           configMap:
             name: ${OTEL_COLLECTOR_NAME}
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: ${OTEL_COLLECTOR_NAME}
     namespace: ${OTEL_NAMESPACE}
   spec:
     type: ClusterIP
     selector:
       app.kubernetes.io/name: ${OTEL_COLLECTOR_NAME}
     ports:
       - name: otlp-grpc
         port: 4317
         targetPort: otlp-grpc
         protocol: TCP
   ---
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: ${OTEL_NETWORK_POLICY}
     namespace: ${OTEL_NAMESPACE}
   spec:
     podSelector:
       matchLabels:
         app.kubernetes.io/name: ${OTEL_COLLECTOR_NAME}
     policyTypes: [Ingress]
     ingress:
       - from:
           - namespaceSelector:
               matchLabels:
                 kubernetes.io/metadata.name: ${GATEWAY_NAMESPACE}
             podSelector:
               matchLabels:
                 gateway.networking.k8s.io/gateway-name: ${GATEWAY_NAME}
         ports:
           - protocol: TCP
             port: 4317
   ---
   apiVersion: gateway.networking.k8s.io/v1beta1
   kind: ReferenceGrant
   metadata:
     name: ${OTEL_REFERENCE_GRANT}
     namespace: ${OTEL_NAMESPACE}
   spec:
     from:
       - group: agentgateway.dev
         kind: AgentgatewayPolicy
         namespace: ${GATEWAY_NAMESPACE}
     to:
       - group: ""
         kind: Service
         name: ${OTEL_COLLECTOR_NAME}
   EOF
   ```

   | Field | Description |
   | --- | --- |
   | `ServiceAccount.metadata.name` and `metadata.namespace` | Produce the exact subject `system:serviceaccount:otel-system:otel-collector`. |
   | `ServiceAccount.metadata.annotations.azure.workload.identity/client-id` | Connects the Kubernetes service account to the user-assigned identity. The AKS Workload Identity webhook injects `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_FEDERATED_TOKEN_FILE`. |
   | `ConfigMap.data.collector.yaml.receivers.otlp.protocols.grpc` | Listens for OTLP over gRPC on port 4317. |
   | `ConfigMap.data.collector.yaml.processors.memory_limiter` | Limits Collector memory pressure before batching spans. |
   | `ConfigMap.data.collector.yaml.processors.batch` | Sends batches of up to 512 items or after five seconds. |
   | `ConfigMap.data.collector.yaml.extensions.health_check` | Exposes Collector health on port 13133 for the pod probes. |
   | `ConfigMap.data.collector.yaml.extensions.azure_auth.workload_identity` | Reads the environment variables injected by AKS Workload Identity. It does not contain a secret. |
   | `ConfigMap.data.collector.yaml.extensions.azure_auth.scopes` | Requests a token for the `https://monitor.azure.com/.default` scope. |
   | `ConfigMap.data.collector.yaml.exporters.otlphttp/azuremonitor.traces_endpoint` | Sends only traces to the native DCR endpoint constructed earlier. |
   | `ConfigMap.data.collector.yaml.exporters.otlphttp/azuremonitor.sending_queue` | Queues up to 1,000 pending batches when export slows down. |
   | `ConfigMap.data.collector.yaml.exporters.otlphttp/azuremonitor.retry_on_failure` | Retries temporary export failures for up to five minutes. |
   | `ConfigMap.data.collector.yaml.service.pipelines.traces` | Connects the OTLP receiver to the memory and batch processors, then to the Azure Monitor exporter. There are no metric or log pipelines. |
   | `Deployment.spec.template.metadata.labels.azure.workload.identity/use` | Activates the AKS Workload Identity mutating webhook for the Collector pod. |
   | `Deployment.spec.template.spec.serviceAccountName` | Runs the pod as the `otel-collector` service account that the federated credential trusts. |
   | `Deployment.spec.template.spec.containers[].image` | Uses the public `otel/opentelemetry-collector-contrib:0.148.0` image. Pin it to an immutable digest in production. |
   | `Deployment.spec.template.spec.containers[].env` | Supplies the native OTLP traces endpoint. The webhook adds the three Workload Identity environment variables. |
   | `Deployment.spec.template.spec.containers[].readinessProbe` and `livenessProbe` | Check the Collector health extension on port 13133. |
   | `Deployment.spec.template.spec.securityContext` | Runs the pod as non-root with the runtime default seccomp profile. |
   | `Deployment.spec.template.spec.containers[].securityContext` | Prevents privilege escalation, drops Linux capabilities, and uses a read-only root filesystem. |
   | `Deployment.spec.template.spec.containers[].resources` | Requests 50 millicores and 128 MiB, with a memory limit of 384 MiB. Adjust these values after measuring your trace volume. |
   | `Service.spec.selector` and `spec.ports[].port` | Select the Collector pod and expose its OTLP gRPC receiver as `otel-collector.otel-system.svc.cluster.local:4317`. |
   | `NetworkPolicy.spec.ingress` | Permits port 4317 only from Gateway pods with the selected Gateway label in the selected namespace. Your network plugin must enforce Kubernetes NetworkPolicy. |
   | `ReferenceGrant.spec` | Lets an {{< reuse "agw-docs/snippets/policy.md" >}} in the Gateway namespace reference the cross-namespace Collector Service. |

## Configure agentgateway tracing

Attach tracing to your existing Gateway with an {{< reuse "agw-docs/snippets/policy.md" >}}. The policy sends sampled traces to the Collector without changing your model or provider route.

> [!IMPORTANT]
> `randomSampling: "true"` samples requests that arrive without incoming trace context. Use this setting during verification. For an ongoing deployment, set `randomSampling` to `"false"` and send deliberate incoming sampled trace context, or choose a production sampling policy that fits your traffic and data-handling requirements. This guide does not validate either ongoing-deployment approach.

Check that the tracing policy name is available and no other tracing policy targets the Gateway, then create the policy.

   ```sh
   if ! object_state="$(kubectl get agentgatewaypolicies.agentgateway.dev \
     "$TRACE_POLICY_NAME" \
     --namespace "$GATEWAY_NAMESPACE" \
     --ignore-not-found \
     --output name)"; then
     printf 'Unable to check policy %s in namespace %s.\n' \
       "$TRACE_POLICY_NAME" "$GATEWAY_NAMESPACE" >&2
     false
   fi &&
   if [ -n "$object_state" ]; then
     printf 'Refusing to overwrite existing object: %s.\n' "$object_state" >&2
     false
   fi &&
   gateway_json="$(kubectl get gateways.gateway.networking.k8s.io \
     "$GATEWAY_NAME" \
     --namespace "$GATEWAY_NAMESPACE" \
     --output json)" &&
   policies_json="$(kubectl get agentgatewaypolicies.agentgateway.dev \
     --namespace "$GATEWAY_NAMESPACE" \
     --output json)" &&
   conflicting_policies="$(jq -nr \
     --arg policy_name "$TRACE_POLICY_NAME" \
     --arg gateway_name "$GATEWAY_NAME" \
     --argjson gateway "$gateway_json" \
     --argjson policies "$policies_json" '
       [
         $policies.items[]?
         | select(.metadata.name != $policy_name)
         | select(.spec.frontend.tracing != null)
         | select(
             any((.spec.targetRefs // [])[];
               (.group // "") == "gateway.networking.k8s.io" and
               .kind == "Gateway" and
               .name == $gateway_name) or
             any((.spec.targetSelectors // [])[];
               (.group // "") == "gateway.networking.k8s.io" and
               .kind == "Gateway" and
               ((.matchLabels // {}) as $match_labels |
                 all($match_labels | to_entries[];
                   ($gateway.metadata.labels // {})[.key] == .value)))
         )
         | .metadata.name
       ]
       | join(", ")
     ')" &&
   if [ -n "$conflicting_policies" ]; then
     printf 'Refusing to add tracing while these policies already target the Gateway: %s.\n' \
       "$conflicting_policies" >&2
     false
   fi &&
   kubectl create -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: ${TRACE_POLICY_NAME}
     namespace: ${GATEWAY_NAMESPACE}
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: Gateway
         name: ${GATEWAY_NAME}
     frontend:
       tracing:
         backendRef:
           group: ""
           kind: Service
           name: ${OTEL_COLLECTOR_NAME}
           namespace: ${OTEL_NAMESPACE}
           port: 4317
         protocol: GRPC
         randomSampling: "true"
         clientSampling: "true"
         resources:
           - name: service.name
             expression: '"${GATEWAY_NAME}"'
           - name: service.namespace
             expression: '"${GATEWAY_NAMESPACE}"'
   EOF
   ```

   | Field | Description |
   | --- | --- |
   | `spec.targetRefs` | Attaches the policy to the named Gateway in the same namespace. |
   | `spec.frontend.tracing.backendRef` | Sends traces to the `otel-collector` Service in `otel-system` on port 4317. The `ReferenceGrant` authorizes this cross-namespace reference. |
   | `spec.frontend.tracing.protocol` | Uses OTLP over gRPC between the Gateway proxy and Collector. |
   | `spec.frontend.tracing.randomSampling` | Enables random sampling for requests that do not arrive with a client sampling decision. |
   | `spec.frontend.tracing.clientSampling` | Honors the sampled flag in an incoming W3C `traceparent` header. |
   | `spec.frontend.tracing.resources` | Sets `service.name` to the Gateway name and `service.namespace` to its Kubernetes namespace. Azure Monitor maps these resource attributes to `ServiceName` and `ServiceNamespace`. |

## Verify native OTLP traces

Check the Collector and policy before you send a known trace ID. Azure Monitor ingestion can take up to 15 minutes.

1. Wait for the Collector Deployment and inspect its Workload Identity environment variable names. Do not print the federated token file.

   ```sh
   kubectl rollout status deployment/"$OTEL_COLLECTOR_NAME" \
     --namespace "$OTEL_NAMESPACE" \
     --timeout=5m &&
   collector_pods="$(kubectl get pods \
     --namespace "$OTEL_NAMESPACE" \
     --selector "app.kubernetes.io/name=${OTEL_COLLECTOR_NAME}" \
     --output json)" &&
   jq -e '
     (.items | length) == 1 and
     ([.items[0].spec.containers[] |
       select(.name == "collector") |
       .env[]?.name] as $names |
     [
       "AZURE_MONITOR_OTLP_TRACES_ENDPOINT",
       "AZURE_CLIENT_ID",
       "AZURE_TENANT_ID",
       "AZURE_FEDERATED_TOKEN_FILE"
     ] as $required |
     all($required[]; . as $name | $names | index($name) != null))' \
     <<<"$collector_pods" >/dev/null
   ```

2. Confirm that the policy reports current `Accepted` and `Attached` conditions.

   ```sh
   policy_json="$(kubectl get agentgatewaypolicies.agentgateway.dev \
     "$TRACE_POLICY_NAME" \
     --namespace "$GATEWAY_NAMESPACE" \
     --output json)" &&
   jq -e '
     .metadata.generation as $generation |
     any(.status.ancestors[]?.conditions[]?;
       .type == "Accepted" and .status == "True" and
       .observedGeneration == $generation) and
     any(.status.ancestors[]?.conditions[]?;
       .type == "Attached" and .status == "True" and
       .observedGeneration == $generation)' \
     <<<"$policy_json" >/dev/null
   ```

3. Set the URL and request file for a representative call through your existing Gateway route.

   ```sh
   export GATEWAY_REQUEST_URL="<existing-gateway-route-url>"
   export GATEWAY_REQUEST_FILE="<path-to-representative-request.json>"
   ```

   > [!IMPORTANT]
   > Reuse the request method, path, body, and non-telemetry headers that your route already requires. Keep credentials out of shell history and local request files when your existing client supports safer credential storage.

4. Generate a trace ID and parent span ID, then send the request with a sampled W3C `traceparent` header. The command discards the response body and requires a successful HTTP status.

   ```sh
   TRACE_ID="$(openssl rand -hex 16)" &&
   PARENT_SPAN_ID="$(openssl rand -hex 8)" &&
   export TRACE_ID PARENT_SPAN_ID &&
   if ! jq -en \
     --arg trace "$TRACE_ID" \
     --arg parent "$PARENT_SPAN_ID" \
     --arg url "$GATEWAY_REQUEST_URL" '
       ($trace | test("^[0-9a-f]{32}$")) and
       ($parent | test("^[0-9a-f]{16}$")) and
       ($url | test("^https?://"))'; then
     false
   fi &&
   if [ ! -f "$GATEWAY_REQUEST_FILE" ]; then
     printf 'Representative request file not found.\n' >&2
     false
   fi &&
   ACCESS_LOG_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)" &&
   export ACCESS_LOG_START &&
   HTTP_STATUS="$(curl --silent --show-error \
     --output /dev/null \
     --write-out '%{http_code}' \
     --connect-timeout 15 \
     --max-time 180 \
     --header 'content-type: application/json' \
     --header "traceparent: 00-${TRACE_ID}-${PARENT_SPAN_ID}-01" \
     --data-binary "@${GATEWAY_REQUEST_FILE}" \
     "$GATEWAY_REQUEST_URL")" &&
   case "$HTTP_STATUS" in
     2??) printf 'Representative request returned HTTP %s.\n' "$HTTP_STATUS" ;;
     *)
       printf 'Representative request returned HTTP %s, expected 2xx.\n' \
         "$HTTP_STATUS" >&2
       false
       ;;
   esac &&
   export HTTP_STATUS
   ```

5. Query `OTelSpans` for the trace ID you sent. Rerun the complete command block until it succeeds or 15 minutes have elapsed. After the privacy checks pass, the command prints only the trace ID and verified span count. Raw attributes stay in a shell variable.

   ```sh
   TRACE_QUERY="$(jq -nr \
     --arg trace_id "$TRACE_ID" \
     --arg service_name "$GATEWAY_NAME" \
     --arg service_namespace "$GATEWAY_NAMESPACE" '
       "OTelSpans\n" +
       "| where TimeGenerated > ago(30m)\n" +
       "| where tolower(TraceId) == \"" + ($trace_id | ascii_downcase) + "\"\n" +
       "| where ServiceName == \"" + $service_name + "\"\n" +
       "| where ServiceNamespace == \"" + $service_namespace + "\"\n" +
       "| project TraceId=tolower(TraceId), SpanId, DurationMs, ServiceName, ServiceNamespace, Attributes, TimeGenerated"
     ')" &&
   export TRACE_QUERY &&
   TRACE_ROWS="$(az monitor log-analytics query \
     --workspace "$LOG_ANALYTICS_WORKSPACE_ID" \
     --analytics-query "$TRACE_QUERY" \
     --timespan PT30M \
     --output json \
     --only-show-errors)" &&
   export TRACE_ROWS &&
   jq -e \
     --arg trace "$TRACE_ID" \
     --arg service_name "$GATEWAY_NAME" \
     --arg service_namespace "$GATEWAY_NAMESPACE" '
       def attrs:
         if (.Attributes | type) == "object"
         then .Attributes
         else (.Attributes | fromjson? // {})
         end;
       [
         "llm.prompt",
         "llm.completion",
         "gen_ai.input.messages",
         "gen_ai.output.messages",
         "request.body",
         "response.body",
         "authorization"
       ] as $forbidden |
       length > 0 and
       all(.[];
         .TraceId == ($trace | ascii_downcase) and
         (.SpanId // "") != "" and
         .DurationMs > 0 and
         .ServiceName == $service_name and
         .ServiceNamespace == $service_namespace) and
       any(.[];
         attrs as $attributes |
         $attributes | has("gen_ai.provider.name") and
         (has("gen_ai.request.model") or has("gen_ai.response.model"))) and
       all(.[];
         attrs as $attributes |
         all($forbidden[]; . as $key | $attributes | has($key) | not))' \
     <<<"$TRACE_ROWS" >/dev/null &&
   jq --arg trace_id "$TRACE_ID" '{trace_id: $trace_id, verified_span_count: length}' <<<"$TRACE_ROWS"
   ```

## Verify access logs in Container Insights

By default, agentgateway writes one structured access log per request to stdout. The `ama-logs` agent collects this output for Container Insights, independently of the OpenTelemetry Collector and trace DCR.

1. Resolve the Log Analytics workspace linked to Container Insights and confirm that the collection agent is ready.

   {{< reuse "agw-docs/snippets/azure-monitor-container-insights-workspace.md" >}}

2. Query `ContainerLogV2` for the representative request sent in the trace verification. Rerun the query block until it succeeds or 15 minutes have elapsed.

   ```sh
   case "$HTTP_STATUS" in
     2??) ;;
     *) false ;;
   esac &&
   ACCESS_LOG_QUERY="$(jq -nr \
     --arg start "$ACCESS_LOG_START" \
     --arg namespace "$GATEWAY_NAMESPACE" \
     --arg gateway "$GATEWAY_NAME" \
     --arg status "$HTTP_STATUS" \
     --arg trace_id "$TRACE_ID" '
       "ContainerLogV2\n" +
       "| where TimeGenerated >= todatetime(\"" + $start + "\")\n" +
       "| where PodNamespace == \"" + $namespace + "\"\n" +
       "| where PodName startswith \"" + $gateway + "-\"\n" +
       "| where ContainerName == \"agentgateway\"\n" +
       "| extend LogFields = parse_json(tostring(LogMessage))\n" +
       "| where tostring(LogFields[\"http.status\"]) == \"" + $status + "\" or tostring(LogMessage) contains \"http.status=" + $status + "\"\n" +
       "| where tostring(LogFields[\"trace.id\"]) == \"" + $trace_id + "\" or tostring(LogMessage) contains \"trace.id=" + $trace_id + "\"\n" +
       "| where isnotnull(LogFields.duration) or tostring(LogMessage) contains \"duration=\"\n" +
       "| project TimeGenerated, PodName, ContainerName, LogMessage\n" +
       "| take 20"
     ')" &&
   export ACCESS_LOG_QUERY &&
   ACCESS_LOG_ROWS="$(az monitor log-analytics query \
     --workspace "$CONTAINER_INSIGHTS_WORKSPACE_ID" \
     --analytics-query "$ACCESS_LOG_QUERY" \
     --timespan PT30M \
     --output json \
     --only-show-errors)" &&
   export ACCESS_LOG_ROWS &&
   jq -e \
     --arg pod_prefix "${GATEWAY_NAME}-" \
     --arg status_code "$HTTP_STATUS" \
     --arg trace_id "$TRACE_ID" \
     --arg status "http.status=${HTTP_STATUS}" \
     --arg trace "trace.id=${TRACE_ID}" '
       def matches_request:
         (if (.LogMessage | type) == "object" then .LogMessage
          else (try (.LogMessage | fromjson) catch null) end) as $fields |
         if ($fields | type) == "object" then
           ($fields["http.status"] | tostring) == $status_code and
           $fields["trace.id"] == $trace_id and $fields.duration != null
         else
           (.LogMessage | contains($status)) and
           (.LogMessage | contains($trace)) and
           (.LogMessage | contains("duration="))
         end;
       length > 0 and
       all(.[];
         (.PodName | startswith($pod_prefix)) and
         .ContainerName == "agentgateway" and
         matches_request)' \
     <<<"$ACCESS_LOG_ROWS" >/dev/null &&
   jq '{verified_access_log_rows: length}' <<<"$ACCESS_LOG_ROWS"
   ```

   The query prints only the verified row count and keeps log bodies in `ACCESS_LOG_ROWS`. Inspect that variable only if your logging policy allows access to the request metadata recorded by agentgateway.

## Troubleshoot the integration

Start with the symptom for the metrics, access logs, or traces you are checking.

| Symptom | Checks |
| --- | --- |
| `kubectl` does not recognize `ServiceMonitor` or `PodMonitor` | Confirm that managed Prometheus is enabled on the AKS cluster. Check for `servicemonitors.azmonitoring.coreos.com` and `podmonitors.azmonitoring.coreos.com` with `kubectl get crd`. |
| A managed Prometheus target is absent | Compare the monitor namespace and selectors with the live Service or pod labels. Confirm that the selected Service or container exposes a port named `metrics`, and that `/metrics` responds on that port. |
| A managed Prometheus target reports `up = 0` | Check the named port, `/metrics` path, endpoint health, and any NetworkPolicy between the managed scraper and the selected workload. |
| The request counter does not increase | Confirm that the request reached the named Gateway pod and completed after the `PodMonitor` began scraping. Wait several scrape intervals, then rerun the exact counter query. |
| The `ama-logs` DaemonSet is absent or unavailable | Confirm that Container Insights is enabled on the AKS cluster and that its managed identity can write to the linked Log Analytics workspace. |
| `ContainerLogV2` has no access-log row | Confirm that the Container Insights DCR includes `Microsoft-ContainerLogV2`, stdout collection is enabled, and the query uses the Gateway namespace. Allow up to 15 minutes for ingestion. |
| The {{< reuse "agw-docs/snippets/policy.md" >}} is rejected | Inspect `status.ancestors[].conditions` and controller events. Confirm the Gateway target, Collector Service name, port 4317, and cross-namespace `ReferenceGrant`. |
| Workload Identity variables are absent | Confirm that OIDC and Workload Identity are enabled on AKS. Check the pod label `azure.workload.identity/use: "true"`, the service account annotation, federated credential issuer, audience, and exact subject `system:serviceaccount:otel-system:otel-collector`. Restart the Deployment after fixing identity metadata. |
| Collector logs report `401`, `403`, authentication, or export errors | Confirm the Collector identity has `Monitoring Metrics Publisher` at the exact DCR scope. Check the `https://monitor.azure.com/.default` scope, native traces endpoint, DCE public access, and DCR immutable ID. Role assignments can take several minutes to propagate. |
| The Gateway cannot reach the Collector | Check the Collector Service endpoints and port 4317. The NetworkPolicy selectors must match the Gateway namespace and `gateway.networking.k8s.io/gateway-name` pod label, and your cluster network plugin must enforce the policy. |
| The Collector exports successfully but `OTelSpans` is empty | Confirm that the DCR data flow includes all three `Microsoft-OTel-Traces-*` streams and targets the intended Log Analytics workspace. Query the known trace ID over a 30-minute window. Native ingestion can take up to 15 minutes. |
