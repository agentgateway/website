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
- Kubernetes get, list, create, and patch access for the named `PodMonitor`, `ServiceAccount`, `ConfigMap`, `Deployment`, `Service`, and `NetworkPolicy` objects used in this guide.
- Kubernetes get and list access for the standalone and Collector pods, read access to their logs, and watch access to the two Deployments.
- Kubernetes get access for the cluster-scoped Namespace selected by `OTEL_NAMESPACE` (`otel-system` by default). If the namespace is absent, you also need create access for that exact Namespace.

> [!IMPORTANT]
> Choose unused names for the Azure resources and Kubernetes objects created in this guide. The setup checks stop if those names already exist.

Run the command blocks in order in a Bash or Zsh session. Stop if a block returns a nonzero status and resolve the error before continuing.

## Set environment variables

Set your subscription, resource group, and cluster names, and identify the existing standalone release. Choose unused names for the Log Analytics workspace, Data Collection Endpoint (DCE), DCR, and Collector identity. Descriptions in this guide use the default `otel-system` namespace and `otel-collector` names. The commands use your values, including for the Workload Identity subject.

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
    all([$otel_namespace, $collector, $service_account, $network_policy, $pod_monitor][];
      test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$"))' >/dev/null; then
  printf 'Replace every placeholder and use valid Kubernetes resource names.\n' >&2
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
deployment_count="$(jq -er '.items | length' <<<"$deployment_json")" &&
if [ "$deployment_count" -ne 1 ]; then
  printf 'Expected exactly one standalone Deployment, found %s.\n' "$deployment_count" >&2
  false
fi &&
STANDALONE_DEPLOYMENT="$(jq -er '.items[0].metadata.name | select(length > 0)' \
  <<<"$deployment_json")" &&
export STANDALONE_DEPLOYMENT &&
printf '%s\n' 'Standalone release prerequisites verified.'
```

Expected final output after the checks pass:

```text
Standalone release prerequisites verified.
```

The commands find the Deployment using all three chart labels. The Collector `NetworkPolicy` and metrics `PodMonitor` also use the release's `app.kubernetes.io/instance` label to select its pods.

## Create the native OTLP trace resources

{{< reuse "agw-docs/snippets/azure-monitor-trace-resources.md" >}}

## Configure Workload Identity for the Collector

{{< reuse "agw-docs/snippets/azure-monitor-workload-identity.md" >}}

## Deploy the OpenTelemetry Collector

The Collector receives OTLP over gRPC on port 4317 and exports only traces. No `ReferenceGrant` is needed for a standalone Helm deployment.

1. Check whether the Collector namespace exists, and create it if needed. The commands leave an existing namespace unchanged and stop if the lookup fails.

   ```sh
   namespace_state="$(kubectl get namespace "$OTEL_NAMESPACE" \
     --ignore-not-found --output name)" &&
   if [ -z "$namespace_state" ]; then
     kubectl create namespace "$OTEL_NAMESPACE"
   fi &&
   printf '%s\n' 'Collector namespace is ready.'
   ```

   Expected final output after the checks pass:

   ```text
   Collector namespace is ready.
   ```

2. Check that the Collector object names are available. The commands stop if an object already exists or an API or RBAC error prevents the check.

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
   ) &&
   printf '%s\n' 'Collector object names are available.'
   ```

   Expected final output after the checks pass:

   ```text
   Collector object names are available.
   ```

3. Restrict Collector ingress to pods from the standalone release. Create the policy before the Collector so that ingress is restricted when the Collector pod starts.

   ```sh
   if ! jq -en \
     --arg standalone_namespace "$STANDALONE_NAMESPACE" \
     --arg release "$STANDALONE_RELEASE" \
     --arg otel_namespace "$OTEL_NAMESPACE" \
     --arg collector "$OTEL_COLLECTOR_NAME" \
     --arg network_policy "$OTEL_NETWORK_POLICY" '
       all([$standalone_namespace, $release, $otel_namespace, $collector, $network_policy][];
         test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$"))' >/dev/null; then
     printf 'A NetworkPolicy substitution value is invalid.\n' >&2
     false
   fi &&
   kubectl create -f- <<EOF &&
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
   printf '%s\n' 'Collector network policy created.'
   ```

   Expected final output after the checks pass:

   ```text
   Collector network policy created.
   ```

   | Field | Description |
   | --- | --- |
   | `NetworkPolicy.spec.ingress` | Permits port 4317 only from pods in the selected standalone namespace with all three release labels. Your network plugin must enforce Kubernetes NetworkPolicy. |

4. Apply the Collector manifest. Your shell fills in the setup variables, while escaped expressions such as `\${env:AZURE_CLIENT_ID}` remain literal for the Collector to resolve.

   {{< reuse "agw-docs/snippets/azure-monitor-collector-manifest.md" >}}

## Configure standalone Helm values

`randomSampling: true` samples every request that arrives without incoming trace context. This increases proxy overhead and Azure ingestion volume. Use it during verification. For ongoing use, choose a sampling policy for your traffic, such as `randomSampling: false` with sampled incoming trace context.

`clientSampling: true` honors the sampled flag in an incoming W3C `traceparent` header. Keep it enabled for verification. Set `clientSampling` to `false` to prevent clients from requesting traces. Requests with sampled incoming trace context then remain untraced, even when `randomSampling` is `true`.

Back up the user-supplied values with `helm get values`, without `--all`, then merge the observability settings into those values. The commands reject an absent or empty `config` before upgrading the release. Both files are plaintext copies of your Helm user values, which can include provider credentials. `mktemp` makes them readable only by you, and cleanup removes them. Run this block once. It refuses to run again in the same shell or against a release that already sends traces to this Collector, so a rerun cannot replace the original backup.

```sh
if [ -s "${HELM_VALUES_BACKUP:-}" ]; then
  printf 'A values backup from an earlier run exists at %s. Keep it for cleanup and do not rerun this block.\n' "$HELM_VALUES_BACKUP" >&2
  false
fi &&
HELM_VALUES_BACKUP="$(mktemp "${TMPDIR:-/tmp}/agentgateway-user-values.XXXXXX")" &&
HELM_MERGED_VALUES="$(mktemp "${TMPDIR:-/tmp}/agentgateway-merged-values.XXXXXX")" &&
export HELM_VALUES_BACKUP HELM_MERGED_VALUES &&
metadata="$(helm get metadata "$STANDALONE_RELEASE" \
  --namespace "$STANDALONE_NAMESPACE"  -o json)" &&
STANDALONE_CHART_VERSION="$(jq -er '.version | select(length > 0)' \
  <<<"$metadata")" &&
STANDALONE_ORIGINAL_REVISION="$(jq -er '.revision' <<<"$metadata")" &&
export STANDALONE_CHART_VERSION STANDALONE_ORIGINAL_REVISION &&
raw_values="$(helm get values "$STANDALONE_RELEASE" \
  --namespace "$STANDALONE_NAMESPACE"  -o json)" &&
if ! jq -e '.config | type == "object" and length > 0' \
  <<<"$raw_values" >/dev/null; then
  printf 'This guide requires a nonempty config mapping in Helm user values.\n' >&2
  false
fi &&
collector_host="${OTEL_COLLECTOR_NAME}.${OTEL_NAMESPACE}.svc.cluster.local:4317" &&
if jq -e --arg host "$collector_host" \
  '.config.frontendPolicies.tracing.host == $host' <<<"$raw_values" >/dev/null; then
  printf 'The release already sends traces to this Collector. Restore the original values before rerunning this block.\n' >&2
  false
fi &&
if jq -e '.config.frontendPolicies.tracing != null or .config.config.tracing != null' \
  <<<"$raw_values" >/dev/null; then
  printf 'The release already exports traces. Remove or migrate that exporter before using this guide.\n' >&2
  false
fi &&
if jq -e '.monitoring.podMonitor.enabled == true' <<<"$raw_values" >/dev/null; then
  printf 'The release enables the chart PodMonitor. This guide replaces it with an Azure Monitor PodMonitor; disable it first.\n' >&2
  false
fi &&
printf '%s\n' "$raw_values" >"$HELM_VALUES_BACKUP" &&
merged_values="$(jq -ce --arg namespace "$STANDALONE_NAMESPACE" \
  --arg host "$collector_host" '
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
    host: $host,
    protocol: "grpc",
    randomSampling: true,
    clientSampling: true
  }' "$HELM_VALUES_BACKUP")" &&
printf '%s\n' "$merged_values" >"$HELM_MERGED_VALUES" &&
if ! jq -e --arg namespace "$STANDALONE_NAMESPACE" \
  --arg host "$collector_host" '
  .monitoring.enabled == true and
  .monitoring.podMonitor.enabled == false and
  ([.extraEnv[] | select(.name == "OTEL_SERVICE_NAME" and
    .value == "agentgateway-standalone")] | length) == 1 and
  ([.extraEnv[] | select(.name == "OTEL_RESOURCE_ATTRIBUTES" and
    .value == ("service.namespace=" + $namespace))] | length) == 1 and
  .config.config.tracing == null and
  .config.frontendPolicies.tracing.host == $host and
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
  --timeout=5m &&
printf 'Release revision before this change: %s\n' "$STANDALONE_ORIGINAL_REVISION" &&
printf '%s\n' 'Standalone observability values applied.'
```

Expected final output after the checks pass, with your release's revision number:

```text
Release revision before this change: <revision>
Standalone observability values applied.
```

Record the printed revision. If you lose this shell, cleanup can roll the release back to it with Helm's own history.

Use `--reset-values` with the merged JSON. Do not use `--reuse-values` with this list overlay. The merged values preserve unrelated settings and `extraEnv` entries while replacing the two named OpenTelemetry entries and the tracing block.

The overlay sets `frontendPolicies.tracing`. Setup refuses a release that already configures `frontendPolicies.tracing` or the deprecated `config.tracing`, so it never replaces an existing exporter. Its explicit host and protocol take precedence over exporter environment settings. Keep `HELM_VALUES_BACKUP` until the release is healthy so the original values are available if the upgrade fails.

| Setting | Effect |
| --- | --- |
| `monitoring.enabled: true` | Exposes the named `metrics` port used by the `PodMonitor`. |
| `monitoring.podMonitor.enabled: false` | Prevents the chart from creating a second monitor. |
| `OTEL_SERVICE_NAME=agentgateway-standalone` | Sets the Azure `ServiceName` value used by trace verification. |
| `OTEL_RESOURCE_ATTRIBUTES=service.namespace=<standalone namespace>` | Sets the Azure `ServiceNamespace` value to the selected namespace. |
| `frontendPolicies.tracing.host` | Sends spans to the in-cluster Collector Service on port 4317. |
| `frontendPolicies.tracing.protocol: grpc` | Uses OTLP over gRPC between agentgateway and the Collector. |
| `frontendPolicies.tracing.randomSampling: true` | Samples requests that have no incoming sampling decision during this verification window. |
| `frontendPolicies.tracing.clientSampling: true` | Honors the sampled flag in the incoming W3C `traceparent` header of the verification request. |

## Export metrics to managed Prometheus

Managed Prometheus scrapes the standalone pods directly.

1. Create the standalone PodMonitor after Helm exposes the metrics port. The commands check the full CRD name first and stop if the CRD is missing or you lack permission to read it.

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
   kubectl create -f- <<EOF &&
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
   printf '%s\n' 'Standalone monitor created.'
   ```

   Expected final output after the checks pass:

   ```text
   Standalone monitor created.
   ```

   | Field | Description |
   | --- | --- |
   | `metadata.namespace` | Limits discovery to the selected standalone namespace. |
   | `spec.selector.matchLabels` | Selects the standalone pods by name, release-derived instance, and component. |
   | `podMetricsEndpoints[].port` | Selects the container port named `metrics`. This is a port name, not a number. |
   | `podMetricsEndpoints[].path` | Scrapes `/metrics`. |
   | `podMetricsEndpoints[].interval` | Requests a scrape every 15 seconds. |

2. Find all ready pods for the standalone release and print the PromQL queries. The generated PromQL matches those pod names exactly, so the queries cover every ready replica.

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
     sort' <<<"$pods_json")" &&
   if [ "$STANDALONE_PODS_JSON" = "[]" ]; then
     printf 'No ready standalone pods were found.\n' >&2
     false
   fi &&
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

3. Run both printed PromQL expressions in the query interface for the Azure Monitor workspace linked to AKS. Confirm that the first result equals `STANDALONE_READY_POD_COUNT` and record the aggregate request counter.

4. Send a representative successful request through the existing route. Wait for managed Prometheus to ingest several 15-second scrape intervals, then rerun the aggregate counter query and confirm that the value increased.

## Verify native OTLP traces

Azure Monitor native ingestion can take up to 15 minutes.

1. Wait for the Collector and standalone Deployments, then inspect the Collector's Workload Identity environment variable names. The `jq` expression inspects environment variable names only. It does not print a projected token or token file content.

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
   if ! jq -e '
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
     <<<"$collector_pods" >/dev/null; then
     printf 'The Collector pod is missing Workload Identity or trace endpoint settings.\n' >&2
     false
   fi &&
   printf '%s\n' 'Collector Workload Identity injection verified.'
   ```

   Expected final output after the checks pass:

   ```text
   Collector Workload Identity injection verified.
   ```

2. Send a representative sampled request through an existing route. Set its URL and JSON request file, reusing the method, path, request body, and non-telemetry headers that the route already requires. Keep credentials out of shell history and local request files when your client supports safer storage.

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
       ($url | test("^https?://"))' >/dev/null; then
     printf 'The generated trace ID, span ID, or request URL is invalid.\n' >&2
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

   Expected final output after the checks pass:

   ```text
   Representative request returned HTTP 200.
   ```

3. Find the request's spans in Azure Monitor with the following Kusto Query Language (KQL) query, which matches the lowercase trace ID and service identity. Rerun the complete command block until it succeeds or 15 minutes have elapsed.

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
   TRACE_ROWS="$(az monitor log-analytics query \
     --workspace "$LOG_ANALYTICS_WORKSPACE_ID" \
     --analytics-query "$TRACE_QUERY" \
     --timespan PT30M \
     --output json \
     --only-show-errors)" &&
   if ! jq -e \
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
     <<<"$TRACE_ROWS" >/dev/null; then
     printf 'The trace rows did not pass verification.\n' >&2
     false
   fi &&
   jq --arg trace_id "$TRACE_ID" '{trace_id: $trace_id, verified_span_count: length}' <<<"$TRACE_ROWS"
   ```

   Expected output shape (identifiers and counts vary):

   ```text
   {"trace_id":"<trace-id>","verified_span_count":2}
   ```

## Verify access logs in Container Insights

By default, agentgateway writes one structured access log per request to stdout. The `ama-logs` agent collects this output for Container Insights, independently of the OpenTelemetry Collector and trace DCR.

1. Resolve the Log Analytics workspace linked to Container Insights and confirm that the collection agent is ready.

   {{< reuse "agw-docs/snippets/azure-monitor-container-insights-workspace.md" >}}

2. Query `ContainerLogV2` for the representative request sent in the trace verification. Rerun the complete block until it succeeds or 15 minutes have elapsed.

   ```sh
   case "$HTTP_STATUS" in
     2??) ;;
     *) false ;;
   esac &&
   if ! jq -e '
     type == "array" and length > 0 and
     all(.[]; type == "string" and length > 0)' \
     <<<"$STANDALONE_PODS_JSON" >/dev/null; then
     printf 'No standalone pod names were found.\n' >&2
     false
   fi &&
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
   ACCESS_LOG_ROWS="$(az monitor log-analytics query \
     --workspace "$CONTAINER_INSIGHTS_WORKSPACE_ID" \
     --analytics-query "$ACCESS_LOG_QUERY" \
     --timespan PT30M \
     --output json \
     --only-show-errors)" &&
   if ! jq -e \
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
   ' <<<"$ACCESS_LOG_ROWS" >/dev/null; then
     printf 'The access log rows did not pass verification.\n' >&2
     false
   fi &&
   jq '{verified_access_log_rows: length}' <<<"$ACCESS_LOG_ROWS"
   ```

   Expected output shape (counts vary):

   ```text
   {"verified_access_log_rows":1}
   ```

   The query prints only the verified row count and keeps log bodies in `ACCESS_LOG_ROWS`. Inspect that variable only if your logging policy allows access to the request metadata recorded by agentgateway.

## Clean up the integration

Restore the original release before removing its telemetry destination. Keep the unchanged `HELM_VALUES_BACKUP` and `STANDALONE_CHART_VERSION` from setup. If the setup shell is gone, skip the following block and roll back to the revision that setup printed instead: run `helm history "$STANDALONE_RELEASE" --namespace "$STANDALONE_NAMESPACE"` to confirm it, then `helm rollback "$STANDALONE_RELEASE" <revision> --namespace "$STANDALONE_NAMESPACE" --wait`. Delete the orphaned `agentgateway-user-values.*` and `agentgateway-merged-values.*` files from your temporary directory afterward. Do not uninstall the release, delete its namespace, or remove its model configuration. Restoring the backup also restores the original metrics and tracing settings. Any observability configured before this guide remains in place.

```sh
[ -s "${HELM_VALUES_BACKUP:?Keep the original Helm values backup}" ] &&
if ! jq -e '.config | type == "object" and length > 0' "$HELM_VALUES_BACKUP" >/dev/null; then
  printf 'The values backup has no config mapping.\n' >&2
  false
fi &&
helm upgrade "$STANDALONE_RELEASE" "$STANDALONE_CHART" \
  --version "${STANDALONE_CHART_VERSION:?Keep the original chart version}" \
  --namespace "$STANDALONE_NAMESPACE" \
  --reset-values \
  --values "$HELM_VALUES_BACKUP" \
  --atomic --wait --timeout 5m &&
kubectl rollout status deployment/"$STANDALONE_DEPLOYMENT" \
  --namespace "$STANDALONE_NAMESPACE" --timeout=5m &&
printf '%s\n' 'Original standalone values restored.'
```

Expected final output after the checks pass:

```text
Original standalone values restored.
```

Repeat the representative model request and confirm it still succeeds. If restoration or the request fails, stop and keep the backup and Collector for investigation. Do not remove a Collector still used by another workload.

Remove only the standalone monitor created by this guide:

```sh
kubectl delete podmonitors.azmonitoring.coreos.com "$STANDALONE_POD_MONITOR" \
  --namespace "$STANDALONE_NAMESPACE" --ignore-not-found --wait=true &&
printf '%s\n' 'Guide standalone monitor removed.'
```

Expected final output after the checks pass:

```text
Guide standalone monitor removed.
```

{{< reuse "agw-docs/snippets/azure-monitor-cleanup.md" >}}

After restoration and cleanup succeed, remove the merged values file:

```sh
rm -f -- "${HELM_MERGED_VALUES:?Keep the merged values path}" &&
printf '%s\n' 'Merged values file removed.'
```

Expected final output after the checks pass:

```text
Merged values file removed.
```

The backup is a plaintext copy of your Helm user values and can include provider credentials. Delete it once you no longer need it for recovery:

```sh
rm -f -- "${HELM_VALUES_BACKUP:?Keep the original values path}" &&
printf '%s\n' 'Values backup removed.'
```

Expected final output after the checks pass:

```text
Values backup removed.
```

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
| The values block failed or `helm upgrade` rolled back | The release keeps its original values. Confirm with `helm history`, delete the files named by `HELM_VALUES_BACKUP` and `HELM_MERGED_VALUES`, run `unset HELM_VALUES_BACKUP HELM_MERGED_VALUES`, and rerun the values block. |
