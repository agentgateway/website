Export metrics, access logs, and traces from an existing standalone agentgateway Helm release on Azure Kubernetes Service (AKS) to Azure Monitor.

Each type of telemetry reaches Azure Monitor through a different path.

- Azure Monitor managed service for Prometheus scrapes proxy metrics through a `PodMonitor`.
- Agentgateway writes structured access logs to stdout. Container Insights collects the proxy container's stdout and stores each record in the `ContainerLogV2` table in Log Analytics.
- The proxy sends traces over OpenTelemetry Protocol (OTLP) and gRPC to an in-cluster OpenTelemetry Collector. The Collector uses AKS Workload Identity to send traces to Azure Monitor native ingestion, which stores the spans in Log Analytics' `OTelSpans` table.

## Before you begin

Check that you have these resources and permissions before starting.

- An existing standalone agentgateway Helm release on AKS. This guide updates its user-supplied Helm values and saves a backup of the original values.
- The release must leave the chart's `nameOverride` and `namespaceOverride` values unset. The setup checks stop before making changes if either override is present.
- The release must supply a nonempty `config` mapping in its Helm user values. The setup checks reject releases that rely on the chart's default configuration, including database-mode releases with an empty `config`. Adding tracing to those releases would suppress their default gateway, UI, LLM, and MCP sections.
- [OpenID Connect (OIDC) issuer](https://learn.microsoft.com/azure/aks/use-oidc-issuer) and [AKS Workload Identity](https://learn.microsoft.com/azure/aks/workload-identity-deploy-cluster) enabled on the cluster.
- [Azure Monitor managed service for Prometheus](https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable) enabled on the cluster.
- [Container Insights](https://learn.microsoft.com/azure/azure-monitor/containers/container-insights-overview) enabled on the cluster with the `Microsoft-ContainerLogV2` stream and stdout collection enabled.
- Access logs that retain the default `http.status`, `trace.id`, and `duration` fields. The verification supports text and JSON log formats.
- A working model, provider, and route through the existing release, along with a representative successful request. This guide does not create or change models, providers, or routes.
- Azure CLI (tested with version 2.85.0), `kubectl`, `jq`, `helm`, `curl`, and OpenSSL installed locally. Sign in to Azure and configure `kubectl` for the target cluster.
- Azure create, get, list, and update permissions for `Microsoft.OperationalInsights/workspaces`, `Microsoft.Insights/dataCollectionEndpoints`, `Microsoft.Insights/dataCollectionRules`, `Microsoft.ManagedIdentity/userAssignedIdentities`, and the fully qualified `Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials` resource type.
- `Microsoft.ContainerService/managedClusters/read` for the AKS cluster.
- `Microsoft.Authorization/roleAssignments/read` and `Microsoft.Authorization/roleAssignments/write` at the Data Collection Rule (DCR) scope.
- The built-in `Monitoring Data Reader` role on the Azure Monitor workspace linked to AKS for managed Prometheus queries.
- The built-in `Log Analytics Reader` role, or equivalent query permission, on the Log Analytics workspaces used for access logs and traces.
- Kubernetes read access to the `podmonitors.azmonitoring.coreos.com` Custom Resource Definition (CRD).
- Kubernetes get, list, create, and patch access for the named `PodMonitor`, `ServiceAccount`, `ConfigMap`, `Deployment`, `Service`, and `NetworkPolicy` objects used below.
- Kubernetes get and list access for the standalone and Collector pods, read access to their logs, and watch access to the two Deployments.
- Kubernetes get access for the cluster-scoped `otel-system` Namespace. If the namespace is absent, you also need create access for that exact Namespace.

> [!IMPORTANT]
> Choose unused names for the Azure resources and Kubernetes objects created below. The setup checks stop if those names already exist.

Run the command blocks in order in a Bash or Zsh session. Stop if a block returns a nonzero status and resolve the error before continuing.

## Set environment variables

### 1. Set resource names and identify the release

Set your subscription, resource group, and cluster names. Choose unused names for the Log Analytics workspace, DCE, DCR, and Collector identity.

```sh
export SUBSCRIPTION_ID="<subscription-id>"
export RESOURCE_GROUP="<existing-resource-group>"
export LOCATION="<azure-region>"
export AKS_CLUSTER="<aks-cluster-name>"
export STANDALONE_NAMESPACE="<standalone-namespace>"
export STANDALONE_RELEASE="<existing-standalone-release>"
export STANDALONE_CHART='{{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}}'
export LOG_ANALYTICS_WORKSPACE="agw-law"
export DATA_COLLECTION_ENDPOINT="agw-dce"
export DATA_COLLECTION_RULE="agw-dcr"
export COLLECTOR_IDENTITY="agw-otel"
export FEDERATED_CREDENTIAL_NAME="agentgateway-otel-collector"
export OTEL_NAMESPACE="otel-system"
export OTEL_COLLECTOR_NAME="otel-collector"
export OTEL_SERVICE_ACCOUNT="otel-collector"
export OTEL_NETWORK_POLICY="otel-collector-ingress"
export OTEL_COLLECTOR_IMAGE="otel/opentelemetry-collector-contrib:0.148.0"
export STANDALONE_POD_MONITOR="agentgateway-standalone-azure-monitor"
export STANDALONE_LABEL_SELECTOR="app.kubernetes.io/name=agentgateway-standalone,app.kubernetes.io/instance=${STANDALONE_RELEASE},app.kubernetes.io/component=standalone"
unset AZURE_NAME_PREFLIGHT_PASSED

if ! jq -en \
  --arg subscription "$SUBSCRIPTION_ID" \
  --arg resource_group "$RESOURCE_GROUP" \
  --arg location "$LOCATION" \
  --arg cluster "$AKS_CLUSTER" \
  --arg namespace "$STANDALONE_NAMESPACE" \
  --arg release "$STANDALONE_RELEASE" \
  --arg workspace "$LOG_ANALYTICS_WORKSPACE" \
  --arg dce "$DATA_COLLECTION_ENDPOINT" \
  --arg dcr "$DATA_COLLECTION_RULE" \
  --arg identity "$COLLECTOR_IDENTITY" \
  --arg otel_namespace "$OTEL_NAMESPACE" \
  --arg collector "$OTEL_COLLECTOR_NAME" \
  --arg service_account "$OTEL_SERVICE_ACCOUNT" \
  --arg network_policy "$OTEL_NETWORK_POLICY" \
  --arg pod_monitor "$STANDALONE_POD_MONITOR" '
    all([$subscription, $resource_group, $location, $cluster, $workspace, $dce, $dcr, $identity][];
      (length > 0) and (startswith("<") | not)) and
    ($namespace | test("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")) and
    ($release | test("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")) and
    all([$network_policy, $pod_monitor][];
      test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$")) and
    $otel_namespace == "otel-system" and
    $collector == "otel-collector" and
    $service_account == "otel-collector"'; then
  printf 'Replace every placeholder and use valid standalone namespace and release names.\n' >&2
  false
fi &&
az account set --subscription "$SUBSCRIPTION_ID" &&
kubectl config current-context &&
if ! release_values="$(helm get values "$STANDALONE_RELEASE" \
  --namespace "$STANDALONE_NAMESPACE" \
  --output json)"; then
  printf 'Unable to read the standalone release values.\n' >&2
  false
fi &&
if ! jq -e '
    (. // {}) as $values |
    (($values.nameOverride // "") == "") and
    (($values.namespaceOverride // "") == "")' \
  <<<"$release_values" >/dev/null; then
  printf 'This guide requires nameOverride and namespaceOverride to be unset.\n' >&2
  false
fi &&
if ! jq -e '.config | type == "object" and length > 0' \
  <<<"$release_values" >/dev/null; then
  printf 'This guide requires a nonempty config mapping in Helm user values.\n' >&2
  false
fi &&
if ! deployment_json="$(kubectl get deployments.apps \
  --namespace "$STANDALONE_NAMESPACE" \
  --selector "$STANDALONE_LABEL_SELECTOR" \
  --output json)"; then
  printf 'Unable to list the selected standalone Deployment.\n' >&2
  false
fi &&
if ! deployment_count="$(jq -er '.items | length' <<<"$deployment_json")"; then
  false
fi &&
if [ "$deployment_count" -ne 1 ]; then
  printf 'Expected exactly one standalone Deployment, found %s.\n' "$deployment_count" >&2
  false
fi &&
if ! STANDALONE_DEPLOYMENT="$(jq -er '.items[0].metadata.name | select(length > 0)' \
  <<<"$deployment_json")"; then
  false
fi &&
export STANDALONE_DEPLOYMENT
```

The commands find the Deployment using all three chart labels. The Collector `NetworkPolicy` and metrics `PodMonitor` also use the release's `app.kubernetes.io/instance` label to select its pods.

## Create the native OTLP trace resources

### 2. Check that Azure resource names are available

These read-only checks reject existing resources and recoverable Log Analytics workspaces. Resolve any API or permission error before continuing.

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

### 3. Create and validate the workspace, DCE, and trace-only DCR

Create a Log Analytics workspace, a public Data Collection Endpoint (DCE), and a DCR that accepts only native OpenTelemetry traces.

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
export LOG_ANALYTICS_RESOURCE_ID LOG_ANALYTICS_WORKSPACE_ID &&
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
fi &&
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
fi &&
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

The DCE uses the public logs-ingestion endpoint. Use a private connectivity design instead if the cluster cannot use public egress.

| DCE field | Description |
| --- | --- |
| `location` | Places the DCE in the selected Azure region. |
| `properties.provisioningState` | Must report `Succeeded` before the Collector configuration is derived. |
| `properties.networkAcls.publicNetworkAccess` | Enables the public logs-ingestion endpoint. |
| `properties.logsIngestion.endpoint` | Supplies the endpoint prefix returned by Azure. The command removes any trailing slash before adding the immutable DCR path. |

The DCR accepts only the three native OpenTelemetry trace streams.

| DCR field | Description |
| --- | --- |
| `properties.dataCollectionEndpointId` | Connects the DCR to the selected DCE. |
| `properties.provisioningState` | Must report `Succeeded` before the immutable rule ID is used. |
| `properties.directDataSources.otelTraces[].streams` | Accepts `Microsoft-OTel-Traces-Spans`, `Microsoft-OTel-Traces-Events`, and `Microsoft-OTel-Traces-Resources`. |
| `properties.directDataSources.otelTraces[].enrichWithResourceAttributes` | Copies resource attributes, including service identity, into the native tables. |
| `properties.destinations.logAnalytics` | Selects the Log Analytics workspace that stores the trace records. |
| `properties.dataFlows` | Sends all three trace streams to `otelLaw`. There is no metric or log data flow. |
| `properties.immutableId` | Forms the immutable rule segment of the native ingestion URL. |

## Configure Workload Identity for the Collector

AKS projects a signed service account token for `system:serviceaccount:otel-system:otel-collector` into the Collector pod. The Collector uses this identity to authenticate without a client secret, connection string, instrumentation key, or Application Insights resource.

### 4. Create the identity, federation, and DCR role assignment

Despite its name, `Monitoring Metrics Publisher` also authorizes native OTLP trace ingestion at DCR scope. The commands keep an existing matching assignment and create one only if none exists.

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
export COLLECTOR_CLIENT_ID COLLECTOR_PRINCIPAL_ID &&
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
  --only-show-errors &&
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

The Collector receives OTLP over gRPC on port 4317 and exports only traces. No `ReferenceGrant` is needed for a standalone Helm deployment.

### 5. Prepare the Collector namespace

Create `otel-system` if it does not exist. A failed lookup stops the command block, and an existing namespace stays unchanged.

```sh
namespace_state="$(kubectl get namespace "$OTEL_NAMESPACE" \
  --ignore-not-found --output name)" &&
if [ -z "$namespace_state" ]; then
  kubectl create namespace "$OTEL_NAMESPACE"
fi
```

Check that all five Collector object names are available before applying the manifest.

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
EOF
)
```

### 6. Deploy the Collector

The manifest uses the public `otel/opentelemetry-collector-contrib:0.148.0` image. Pin it to an immutable digest before using this configuration in production.

```sh
if ! jq -en \
  --arg client_id "$COLLECTOR_CLIENT_ID" \
  --arg endpoint "$AZURE_MONITOR_OTLP_TRACES_ENDPOINT" \
  --arg standalone_namespace "$STANDALONE_NAMESPACE" \
  --arg release "$STANDALONE_RELEASE" \
  --arg otel_namespace "$OTEL_NAMESPACE" \
  --arg collector "$OTEL_COLLECTOR_NAME" \
  --arg service_account "$OTEL_SERVICE_ACCOUNT" \
  --arg network_policy "$OTEL_NETWORK_POLICY" \
  --arg image "$OTEL_COLLECTOR_IMAGE" '
    ($client_id | test("^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$")) and
    ($endpoint | test("^https://[^|&\\\\[:space:]]+$")) and
    all([$standalone_namespace, $release, $otel_namespace, $collector,
      $service_account, $network_policy][];
      test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$")) and
    ($otel_namespace == "otel-system") and
    ($collector == "otel-collector") and
    ($service_account == "otel-collector") and
    ($image == "otel/opentelemetry-collector-contrib:0.148.0")'; then
  printf 'A Collector manifest substitution value is invalid.\n' >&2
  false
fi &&
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
              kubernetes.io/metadata.name: ${STANDALONE_NAMESPACE}
          podSelector:
            matchLabels:
              app.kubernetes.io/name: agentgateway-standalone
              app.kubernetes.io/instance: ${STANDALONE_RELEASE}
              app.kubernetes.io/component: standalone
      ports:
        - protocol: TCP
          port: 4317
EOF
```

| Field | Description |
| --- | --- |
| ServiceAccount annotation | Connects the exact Kubernetes service account subject to the user-assigned identity client ID. |
| Workload Identity pod label | Activates the AKS mutating webhook that injects `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_FEDERATED_TOKEN_FILE`. |
| OTLP gRPC receiver | Listens on `0.0.0.0:4317` for proxy spans. |
| `memory_limiter` | Limits memory pressure before batching spans. |
| `batch` | Sends up to 512 items or waits five seconds. |
| `health_check` | Exposes port 13133 for readiness and liveness probes. |
| `azure_auth.workload_identity` | Reads only the Workload Identity environment variables injected by AKS. |
| `azure_auth.scopes` | Requests `https://monitor.azure.com/.default`. |
| `otlphttp/azuremonitor.traces_endpoint` | Sends traces to the DCE and immutable DCR endpoint. |
| Export queue and retry | Queues up to 1,000 batches and retries temporary failures for up to five minutes. |
| Trace pipeline | Connects the receiver, memory limiter, batch processor, and Azure exporter. No metrics or logs pipeline exists. |
| Collector image | Uses the public `otel/opentelemetry-collector-contrib:0.148.0` image. Use an immutable digest in production. |
| Deployment endpoint environment variable | Supplies the native OTLP traces endpoint without storing a credential. |
| Deployment probes and resources | Checks Collector health and sets CPU and memory requests and limits. |
| Pod and container security contexts | Require non-root execution, runtime-default seccomp, no privilege escalation, no Linux capabilities, and a read-only root filesystem. |
| ClusterIP Service | Exposes OTLP gRPC at `otel-collector.otel-system.svc.cluster.local:4317`. |
| NetworkPolicy source | Allows only pods in the selected standalone namespace with all three release labels. |

## Configure standalone Helm values

`randomSampling: true` samples every request that arrives without incoming trace context. This increases proxy overhead and Azure ingestion volume. Use it during verification. For ongoing use, choose a sampling policy for your traffic, such as `randomSampling: false` with sampled incoming trace context.

`clientSampling: true` honors the sampled flag in an incoming W3C `traceparent` header. Keep it enabled for verification. Set `clientSampling` to `false` to prevent clients from requesting traces. Requests with sampled incoming trace context then remain untraced, even when `randomSampling` is `true`.

### 7. Back up Helm values and enable observability

Back up the user-supplied values with `helm get values`, without `--all`, then merge the observability settings into those values. The commands reject an absent or empty `config` before upgrading the release.

```sh
HELM_VALUES_BACKUP="$(mktemp "${TMPDIR:-/tmp}/agentgateway-user-values.XXXXXX")" &&
HELM_MERGED_VALUES="$(mktemp "${TMPDIR:-/tmp}/agentgateway-merged-values.XXXXXX")" &&
export HELM_VALUES_BACKUP HELM_MERGED_VALUES &&
metadata="$(helm get metadata "$STANDALONE_RELEASE" \
  --namespace "$STANDALONE_NAMESPACE"  -o json)" &&
STANDALONE_CHART_VERSION="$(jq -er '.version | select(length > 0)' \
  <<<"$metadata")" &&
export STANDALONE_CHART_VERSION &&
raw_values="$(helm get values "$STANDALONE_RELEASE" \
  --namespace "$STANDALONE_NAMESPACE"  -o json)" &&
if ! jq -e '.config | type == "object" and length > 0' \
  <<<"$raw_values" >/dev/null; then
  printf 'This guide requires a nonempty config mapping in Helm user values.\n' >&2
  false
fi &&
printf '%s\n' "$raw_values" >"$HELM_VALUES_BACKUP" &&
merged_values="$(jq -ce --arg namespace "$STANDALONE_NAMESPACE" '
  (. // {}) as $values |
  ($values.extraEnv // []) as $existing_env |
  $values |
  .extraEnv = (
    $existing_env |
    map(select(
      .name != "OTEL_SERVICE_NAME" and
      .name != "OTEL_RESOURCE_ATTRIBUTES"
    )) + [
      {name: "OTEL_SERVICE_NAME", value: "agentgateway-standalone"},
      {
        name: "OTEL_RESOURCE_ATTRIBUTES",
        value: ("service.namespace=" + $namespace)
      }
    ]
  ) |
  .monitoring = (($values.monitoring // {}) * {
    enabled: true,
    podMonitor: (($values.monitoring.podMonitor // {}) * {enabled: false})
  }) |
  del(.config.config.tracing) |
  .config.frontendPolicies.tracing = {
    host: "otel-collector.otel-system.svc.cluster.local:4317",
    protocol: "grpc",
    randomSampling: true,
    clientSampling: true
  }' "$HELM_VALUES_BACKUP")" &&
printf '%s\n' "$merged_values" >"$HELM_MERGED_VALUES" &&
if ! jq -e --arg namespace "$STANDALONE_NAMESPACE" '
  .monitoring.enabled == true and
  .monitoring.podMonitor.enabled == false and
  ([.extraEnv[] | select(.name == "OTEL_SERVICE_NAME" and
    .value == "agentgateway-standalone")] | length) == 1 and
  ([.extraEnv[] | select(.name == "OTEL_RESOURCE_ATTRIBUTES" and
    .value == ("service.namespace=" + $namespace))] | length) == 1 and
  .config.config.tracing == null and
  .config.frontendPolicies.tracing.host == "otel-collector.otel-system.svc.cluster.local:4317" and
  .config.frontendPolicies.tracing.protocol == "grpc" and
  .config.frontendPolicies.tracing.randomSampling == true and
  .config.frontendPolicies.tracing.clientSampling == true and
  (.config.frontendPolicies.tracing | keys | sort) ==
    ["clientSampling", "host", "protocol", "randomSampling"]' "$HELM_MERGED_VALUES" >/dev/null; then
  printf 'The merged Helm values failed validation.\n' >&2
  false
fi &&
helm upgrade --install "$STANDALONE_RELEASE" "$STANDALONE_CHART" \
  --version "$STANDALONE_CHART_VERSION" \
  --namespace "$STANDALONE_NAMESPACE" \
  --reset-values \
  --values "$HELM_MERGED_VALUES" \
  --atomic \
  --wait \
  --timeout 5m &&
kubectl rollout status deployment/"$STANDALONE_DEPLOYMENT" \
  --namespace "$STANDALONE_NAMESPACE" \
  --timeout=5m
```

Use `--reset-values` with the merged JSON. Do not use `--reuse-values` with this list overlay. The merged values preserve unrelated settings and `extraEnv` entries while replacing the two named OpenTelemetry entries and the tracing block.

The overlay sets `frontendPolicies.tracing` and removes deprecated `config.tracing` during verification. Its explicit host and protocol take precedence over exporter environment settings. Keep `HELM_VALUES_BACKUP` until the release is healthy so the original values are available if the upgrade fails.

| Setting | Effect |
| --- | --- |
| `monitoring.enabled: true` | Exposes the named `metrics` port used by the `PodMonitor`. |
| `monitoring.podMonitor.enabled: false` | Prevents the chart from creating a second monitor. |
| `OTEL_SERVICE_NAME=agentgateway-standalone` | Sets the Azure `ServiceName` value used by trace verification. |
| `OTEL_RESOURCE_ATTRIBUTES=service.namespace=<standalone namespace>` | Sets the Azure `ServiceNamespace` value to the selected namespace. |
| `frontendPolicies.tracing.host` | Sends spans to the in-cluster Collector Service on port 4317. |
| `frontendPolicies.tracing.protocol: grpc` | Uses OTLP over gRPC between agentgateway and the Collector. |
| `frontendPolicies.tracing.randomSampling: true` | Samples requests that have no incoming sampling decision during this verification window. |
| `frontendPolicies.tracing.clientSampling: true` | Honors the sampled flag in the incoming W3C `traceparent` used below. |

## Export metrics to managed Prometheus

Managed Prometheus scrapes the standalone pods directly.

### 8. Create the standalone PodMonitor

Create the monitor only after Helm exposes the metrics port. The commands check the full CRD name first and stop if the CRD is missing or you lack permission to read it.

```sh
crd_state="$(kubectl get crd  podmonitors.azmonitoring.coreos.com \
  --output name)" &&
if [ "$crd_state" != "customresourcedefinition.apiextensions.k8s.io/podmonitors.azmonitoring.coreos.com" ]; then
  printf 'The Azure Monitor PodMonitor CRD is unavailable.\n' >&2
  false
fi &&
object_state="$(kubectl get podmonitors.azmonitoring.coreos.com "$STANDALONE_POD_MONITOR" \
  --namespace "$STANDALONE_NAMESPACE" \
  --ignore-not-found \
  --output name)" &&
if [ -n "$object_state" ]; then
  printf 'Refusing to overwrite existing object: %s.\n' "$object_state" >&2
  false
fi &&
kubectl create -f- <<EOF
apiVersion: azmonitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: ${STANDALONE_POD_MONITOR}
  namespace: ${STANDALONE_NAMESPACE}
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: agentgateway-standalone
      app.kubernetes.io/instance: ${STANDALONE_RELEASE}
      app.kubernetes.io/component: standalone
  podMetricsEndpoints:
    - port: metrics
      path: /metrics
      interval: 15s
EOF
```

| Field | Description |
| --- | --- |
| `metadata.namespace` | Limits discovery to the selected standalone namespace. |
| `spec.selector.matchLabels` | Selects the standalone pods by name, release-derived instance, and component. |
| `podMetricsEndpoints[].port` | Selects the container port named `metrics`. This is a port name, not a number. |
| `podMetricsEndpoints[].path` | Scrapes `/metrics`. |
| `podMetricsEndpoints[].interval` | Requests a scrape every 15 seconds. |

### 9. Verify scrape targets and request counts

Find all ready pods for the standalone release. The generated PromQL matches those pod names exactly, so the queries cover every ready replica.

```sh
pods_json="$(kubectl get pods \
  --namespace "$STANDALONE_NAMESPACE" \
  --selector "$STANDALONE_LABEL_SELECTOR" \
  --output json)" &&
STANDALONE_PODS_JSON="$(jq -ce '
  [.items[] |
    select(.metadata.deletionTimestamp == null) |
    select(any(.status.conditions[]?;
      .type == "Ready" and .status == "True")) |
    .metadata.name] |
  sort |
  select(length > 0)' <<<"$pods_json")" &&
STANDALONE_READY_POD_COUNT="$(jq -er 'length' \
  <<<"$STANDALONE_PODS_JSON")" &&
STANDALONE_POD_REGEX="$(jq -er \
  'map(gsub("\\."; "\\.")) | join("|") | select(length > 0) | @json' \
  <<<"$STANDALONE_PODS_JSON")" &&
export STANDALONE_PODS_JSON STANDALONE_READY_POD_COUNT STANDALONE_POD_REGEX &&
printf 'count(up{namespace="%s",pod=~%s,endpoint="metrics"} == 1)\n' \
  "$STANDALONE_NAMESPACE" "$STANDALONE_POD_REGEX" &&
printf 'sum(agentgateway_requests_total{namespace="%s",pod=~%s}) or vector(0)\n' \
  "$STANDALONE_NAMESPACE" "$STANDALONE_POD_REGEX"
```

Run both printed PromQL expressions in the query interface for the Azure Monitor workspace linked to AKS. Confirm that the first result equals `STANDALONE_READY_POD_COUNT` and record the aggregate request counter.

Send a representative successful request through the existing route. Wait for managed Prometheus to ingest several 15-second scrape intervals, then rerun the aggregate counter query and confirm that the value increased.

## Verify native OTLP traces

Azure Monitor native ingestion can take up to 15 minutes.

### 10. Check Deployment health and Workload Identity

The `jq` expression inspects environment variable names only. It does not print a projected token or token file content.

```sh
kubectl rollout status deployment/"$OTEL_COLLECTOR_NAME" \
  --namespace "$OTEL_NAMESPACE" \
  --timeout=5m &&
kubectl rollout status deployment/"$STANDALONE_DEPLOYMENT" \
  --namespace "$STANDALONE_NAMESPACE" \
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

### 11. Send a representative sampled request

Use an existing route. Set its URL and JSON request file, reusing the method, path, request body, and non-telemetry headers that the route already requires. Keep credentials out of shell history and local request files when your client supports safer storage.

```sh
export STANDALONE_REQUEST_URL="<existing-standalone-route-url>"
export STANDALONE_REQUEST_FILE="<path-to-representative-request.json>"

TRACE_ID="$(openssl rand -hex 16)" &&
PARENT_SPAN_ID="$(openssl rand -hex 8)" &&
export TRACE_ID PARENT_SPAN_ID &&
if ! jq -en \
  --arg trace "$TRACE_ID" \
  --arg parent "$PARENT_SPAN_ID" \
  --arg url "$STANDALONE_REQUEST_URL" '
    ($trace | test("^[0-9a-f]{32}$")) and
    ($parent | test("^[0-9a-f]{16}$")) and
    ($url | test("^https?://"))'; then
  false
fi &&
if [ ! -f "$STANDALONE_REQUEST_FILE" ]; then
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
  --data-binary "@${STANDALONE_REQUEST_FILE}" "$STANDALONE_REQUEST_URL")" &&
case "$HTTP_STATUS" in
  2??) printf 'Representative request returned HTTP %s.\n' "$HTTP_STATUS" ;;
  *)
    printf 'Representative request returned HTTP %s, expected 2xx.\n' "$HTTP_STATUS" >&2
    false
    ;;
esac &&
export HTTP_STATUS
```

### 12. Verify traces in Azure Monitor

Find the request's spans with the Kusto Query Language (KQL) query below, which matches the lowercase trace ID and service identity. Rerun the complete command block until it succeeds or 15 minutes have elapsed.

```sh
TRACE_QUERY="$(jq -nr \
  --arg trace_id "$TRACE_ID" \
  --arg namespace "$STANDALONE_NAMESPACE" '
  "OTelSpans\n" +
  "| where TimeGenerated > ago(30m)\n" +
  "| where tolower(TraceId) == \"" + ($trace_id | ascii_downcase) + "\"\n" +
  "| where ServiceName == \"agentgateway-standalone\"\n" +
  "| where ServiceNamespace == \"" + $namespace + "\"\n" +
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
  --arg namespace "$STANDALONE_NAMESPACE" '
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
    .ServiceName == "agentgateway-standalone" and
    .ServiceNamespace == $namespace) and
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

Resolve the Log Analytics workspace linked to Container Insights and confirm that the collection agent is ready.

{{< reuse "agw-docs/snippets/azure-monitor-container-insights-workspace.md" >}}

Query `ContainerLogV2` for the representative request sent in the trace verification. Rerun the complete block until it succeeds or 15 minutes have elapsed.

```sh
case "$HTTP_STATUS" in
  2??) ;;
  *) false ;;
esac &&
jq -e '
  type == "array" and length > 0 and
  all(.[]; type == "string" and length > 0)' \
  <<<"$STANDALONE_PODS_JSON" >/dev/null &&
ACCESS_LOG_QUERY="$(jq -nr \
  --arg start "$ACCESS_LOG_START" \
  --arg namespace "$STANDALONE_NAMESPACE" \
  --argjson pods "$STANDALONE_PODS_JSON" \
  --arg status "$HTTP_STATUS" \
  --arg trace_id "$TRACE_ID" '
    "ContainerLogV2\n" +
    "| where TimeGenerated >= todatetime(\"" + $start + "\")\n" +
    "| where PodNamespace == \"" + $namespace + "\"\n" +
    "| where PodName in (" + ($pods | map(@json) | join(", ")) + ")\n" +
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
  --argjson pods "$STANDALONE_PODS_JSON" \
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
    .PodName as $pod |
    ($pods | index($pod)) != null and
    .ContainerName == "agentgateway" and
    matches_request)
' <<<"$ACCESS_LOG_ROWS" >/dev/null &&
jq '{verified_access_log_rows: length}' <<<"$ACCESS_LOG_ROWS"
```

The query prints only the verified row count and keeps log bodies in `ACCESS_LOG_ROWS`. Inspect that variable only if your logging policy allows access to the request metadata recorded by agentgateway.

## Troubleshoot the integration

Start with the symptom for the metrics, access logs, or traces you are checking.

| Symptom | Checks |
| --- | --- |
| The `PodMonitor` CRD is missing | Confirm managed Prometheus is enabled on AKS. Run `kubectl get crd podmonitors.azmonitoring.coreos.com`. |
| The metrics target is absent | Compare the live pod labels with all three `PodMonitor` selector labels. Confirm the release-derived instance label, the named `metrics` port, and `/metrics` path. |
| The target reports `up = 0` | Check pod readiness, the named port, `/metrics`, and policies between the Azure managed scraper and the pod. |
| The request counter does not increase | Refresh the ready-pod list, confirm the request reached one of those release pods after the monitor began scraping, and rerun the aggregate namespace and pod query after several scrape intervals. |
| The `ama-logs` DaemonSet is absent or unavailable | Confirm that Container Insights is enabled on the AKS cluster and that its managed identity can write to the linked Log Analytics workspace. |
| `ContainerLogV2` has no access-log row | Confirm that the Container Insights DCR includes `Microsoft-ContainerLogV2`, stdout collection is enabled, and the query uses the ready pods for the selected release and namespace. Allow up to 15 minutes for ingestion. |
| Helm values are missing or unexpected | Inspect `helm get values` without `--all`, the unchanged backup, and the derived JSON. Confirm the merge retained unrelated `extraEnv` entries and that the upgrade used `--reset-values`, not `--reuse-values`. |
| The proxy cannot reach the Collector | Check the ClusterIP Service endpoints, DNS name, TCP port 4317, Collector readiness, and proxy logs. |
| The NetworkPolicy blocks the proxy | Confirm its namespace selector and all three pod labels match the selected standalone release. Confirm the cluster network plugin enforces NetworkPolicy. |
| Workload Identity variables are absent | Check OIDC and Workload Identity on AKS, the `azure.workload.identity/use: "true"` pod label, service account client ID annotation, issuer, audience, and exact federated subject. Restart the Collector after correcting metadata. |
| Collector export reports `401` | Check the `azure_auth` workload identity fields, projected environment variables, and `https://monitor.azure.com/.default` scope. |
| Collector export reports `403` | Confirm `Monitoring Metrics Publisher` is assigned to the Collector principal at the exact DCR scope. Allow time for role propagation. |
| The native endpoint is rejected | Confirm it uses the DCE `logsIngestion.endpoint` with its trailing slash removed, followed by the immutable DCR ID and native trace stream path. |
| The Collector exports but `OTelSpans` is empty | Confirm both the direct data source and data flow contain all three span, event, and resource streams and target the intended workspace. |
| A known trace ID is not visible yet | Query a 30-minute window and allow up to 15 minutes for native ingestion. Confirm the representative request returned 2xx. |
