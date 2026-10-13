Export agentgateway metrics, access logs, and traces to [Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/) from Azure Kubernetes Service (AKS).

Each type of telemetry reaches Azure Monitor through a different path.

- Azure Monitor managed Prometheus scrapes controller (control plane) metrics through a `ServiceMonitor`, which discovers targets through the controller's metrics Service. The Gateway proxy (data plane) exposes metrics on each pod, while its Service exposes only traffic ports. A `PodMonitor` discovers and scrapes those pods directly.
- Agentgateway writes structured access logs to stdout. Container Insights collects the proxy container's stdout and stores each record in the `ContainerLogV2` table in Log Analytics.
- An {{< reuse "agw-docs/snippets/policy.md" >}} sends traces over OpenTelemetry Protocol (OTLP) and gRPC to an in-cluster OpenTelemetry Collector. The Collector authenticates with AKS Workload Identity and sends OTLP over HTTP to Azure Monitor native ingestion, which stores the spans in Log Analytics' `OTelSpans` table.

## Before you begin

Check that you have these resources and permissions before changing the cluster.

- An existing AKS cluster with [agentgateway installed]({{< link-hextra path="/documentation/install/" >}}) and a running [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}). The examples use the documentation defaults in the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace with the `agentgateway-proxy` Gateway name.
- [OpenID Connect (OIDC) issuer](https://learn.microsoft.com/azure/aks/use-oidc-issuer) and [AKS Workload Identity](https://learn.microsoft.com/azure/aks/workload-identity-deploy-cluster) enabled on the cluster.
- [Azure Monitor managed service for Prometheus](https://learn.microsoft.com/azure/azure-monitor/containers/kubernetes-monitoring-enable) enabled on the cluster. Managed Prometheus queries require the built-in `Monitoring Data Reader` role on the linked Azure Monitor workspace.
- [Container Insights](https://learn.microsoft.com/azure/azure-monitor/containers/container-insights-overview) enabled on the cluster with the `Microsoft-ContainerLogV2` stream and stdout collection enabled. Access-log queries require the built-in `Log Analytics Reader` role on its linked workspace.
- Access logs that retain the default `http.status`, `trace.id`, and `duration` fields. The verification supports text and JSON log formats.
- A working model or provider route through your existing Gateway, plus a representative request for that route. Follow the [OpenAI setup guide]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) for an example that creates a provider and an HTTPRoute, or choose another [LLM provider]({{< link-hextra path="/integrations/llm/providers/" >}}).
- Azure CLI (tested with version 2.85.0), `kubectl`, `jq`, `curl`, and OpenSSL installed locally. Sign in to Azure and configure `kubectl` for the target cluster.
- `Contributor` on the resource group, or an equivalent custom role that grants create and read access to `Microsoft.OperationalInsights/workspaces`, `Microsoft.Insights/dataCollectionEndpoints`, `Microsoft.Insights/dataCollectionRules`, `Microsoft.ManagedIdentity/userAssignedIdentities`, and `Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials`.
- `Role Based Access Control Administrator`, `User Access Administrator`, or equivalent `Microsoft.Authorization/roleAssignments/read` and `Microsoft.Authorization/roleAssignments/write` permissions at the Data Collection Rule (DCR) scope. These permissions let you inspect and assign `Monitoring Metrics Publisher` for the Collector identity.
- Kubernetes create and get access for the named `ServiceMonitor`, `PodMonitor`, `AgentgatewayPolicy`, `ServiceAccount`, `ConfigMap`, `Deployment`, `Service`, `NetworkPolicy`, and `ReferenceGrant` resources used by this guide.
- You need get access for the cluster-scoped `Namespace` resource named `otel-system`. If the namespace is absent, you also need create access for that resource.
- Verification requires get and list access to the relevant Custom Resource Definitions (CRDs), each named resource, the agentgateway controller, Collector and Gateway proxy pods, and pod logs. Deployment rollout status also requires watch access to the Collector `Deployment`.
- `Log Analytics Reader` or equivalent query permission on the Log Analytics workspace for trace verification.

> [!IMPORTANT]
> Choose unused names for the Azure resources and Kubernetes objects created in this guide. The setup checks stop if those names already exist.

## Set environment variables

Set your subscription, resource group, and cluster names. Choose unused names for the Log Analytics workspace, Data Collection Endpoint (DCE), DCR, and Collector identity. Descriptions in this guide use the default `otel-system` namespace and `otel-collector` names. The commands use your values, including for the Workload Identity subject.

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
  --arg gateway "$GATEWAY_NAME" \
  --arg otel_namespace "$OTEL_NAMESPACE" \
  --arg service_account "$OTEL_SERVICE_ACCOUNT" '
    all([$subscription, $resource_group, $location, $cluster, $workspace, $dce, $dcr, $identity][];
      (length > 0) and (startswith("<") | not)) and
    all([$controller_namespace, $gateway_namespace, $gateway, $otel_namespace, $service_account][];
      test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$"))' >/dev/null; then
  printf 'Replace every placeholder and use valid Kubernetes resource names.\n' >&2
  false
fi &&
az account set --subscription "$SUBSCRIPTION_ID" &&
az group show \
  --subscription "$SUBSCRIPTION_ID" \
  --name "$RESOURCE_GROUP" \
  --output none \
  --only-show-errors &&
kubectl config current-context &&
printf '%s\n' 'Environment checks passed.'
```

Expected final output after the checks pass:

```text
Environment checks passed.
```

Run the command blocks in order in a Bash or Zsh session. Stop if a block returns a nonzero status and resolve the error before continuing.

## Export metrics to managed Prometheus

Managed Prometheus uses Azure Monitor's versions of the Prometheus Operator monitoring resources to discover the controller and Gateway proxy. It scrapes their metrics directly.

1. Check that the chosen `ServiceMonitor` and `PodMonitor` names are available. The commands stop if either object already exists.

   ```sh
   controller_monitor="$(kubectl get servicemonitors.azmonitoring.coreos.com \
     "$CONTROLLER_SERVICE_MONITOR" --namespace "$CONTROLLER_NAMESPACE" \
     --ignore-not-found --output name)" &&
   if [ -n "$controller_monitor" ]; then
     printf 'Refusing to overwrite existing object: %s.\n' "$controller_monitor" >&2
     false
   fi &&
   gateway_monitor="$(kubectl get podmonitors.azmonitoring.coreos.com \
     "$GATEWAY_POD_MONITOR" --namespace "$GATEWAY_NAMESPACE" \
     --ignore-not-found --output name)" &&
   if [ -n "$gateway_monitor" ]; then
     printf 'Refusing to overwrite existing object: %s.\n' "$gateway_monitor" >&2
     false
   fi &&
   printf '%s\n' 'Monitor names are available.'
   ```

   Expected final output after the checks pass:

   ```text
   Monitor names are available.
   ```

2. Create a `ServiceMonitor` for the controller and a `PodMonitor` for the Gateway proxy.

   ```sh
   kubectl create -f- <<EOF &&
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
   printf '%s\n' 'Controller and Gateway monitors created.'
   ```

   Expected final output after the checks pass:

   ```text
   Controller and Gateway monitors created.
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
     --output name &&
   printf '%s\n' 'Controller and Gateway monitors verified.'
   ```

   Expected final output after the checks pass:

   ```text
   Controller and Gateway monitors verified.
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

{{< reuse "agw-docs/snippets/azure-monitor-trace-resources.md" >}}

## Configure Workload Identity for the Collector

{{< reuse "agw-docs/snippets/azure-monitor-workload-identity.md" >}}

## Deploy the OpenTelemetry Collector

The Collector receives trace data inside the cluster and exports only traces to Azure Monitor. The NetworkPolicy accepts OTLP traffic only from pods for your named Gateway.

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

2. Check that the Collector object names in `OTEL_NAMESPACE` are available. The commands stop if an object already exists or an API or RBAC error prevents the check.

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
   ) &&
   printf '%s\n' 'Collector object names are available.'
   ```

   Expected final output after the checks pass:

   ```text
   Collector object names are available.
   ```

3. Restrict Collector ingress to pods for your named Gateway, and let the {{< reuse "agw-docs/snippets/policy.md" >}} in the Gateway namespace reference the Collector Service. Create these objects before the Collector so that ingress is restricted when the Collector pod starts.

   ```sh
   if ! jq -en \
     --arg namespace "$GATEWAY_NAMESPACE" \
     --arg gateway "$GATEWAY_NAME" \
     --arg otel_namespace "$OTEL_NAMESPACE" \
     --arg collector "$OTEL_COLLECTOR_NAME" \
     --arg network_policy "$OTEL_NETWORK_POLICY" \
     --arg reference_grant "$OTEL_REFERENCE_GRANT" '
       ($namespace | test("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")) and
       ($gateway | test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$")) and
       ($otel_namespace | test("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")) and
       ([$collector, $network_policy, $reference_grant] |
         all(.[]; test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$")))' >/dev/null; then
     printf 'A NetworkPolicy or ReferenceGrant substitution value is invalid.\n' >&2
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
   printf '%s\n' 'Collector network policy and reference grant created.'
   ```

   Expected final output after the checks pass:

   ```text
   Collector network policy and reference grant created.
   ```

   | Field | Description |
   | --- | --- |
   | `NetworkPolicy.spec.ingress` | Permits port 4317 only from Gateway pods with the selected Gateway label in the selected namespace. Your network plugin must enforce Kubernetes NetworkPolicy. |
   | `ReferenceGrant.spec` | Lets an {{< reuse "agw-docs/snippets/policy.md" >}} in the Gateway namespace reference the cross-namespace Collector Service. |

4. Apply the Collector manifest. Your shell fills in the setup variables, while escaped expressions such as `\${env:AZURE_CLIENT_ID}` remain literal for the Collector to resolve.

   {{< reuse "agw-docs/snippets/azure-monitor-collector-manifest.md" >}}

## Configure agentgateway tracing

Attach tracing to your existing Gateway with an {{< reuse "agw-docs/snippets/policy.md" >}}. The policy sends sampled traces to the Collector without changing your model or provider route.

> [!IMPORTANT]
> `randomSampling: "true"` samples requests that arrive without incoming trace context. Use this setting during verification. For an ongoing deployment, set `randomSampling` to `"false"` and send deliberate incoming sampled trace context, or choose a production sampling policy that fits your traffic and data-handling requirements. This guide does not validate either ongoing-deployment approach.

`clientSampling: "true"` honors the sampled flag in an incoming W3C `traceparent` header. Keep it enabled for verification. Set `clientSampling` to `"false"` to prevent clients from requesting traces. Requests with sampled incoming trace context then remain untraced, even when `randomSampling` is `"true"`.

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
   kubectl create -f- <<EOF &&
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
   printf '%s\n' 'Gateway tracing policy created.'
   ```

   Expected final output after the checks pass:

   ```text
   Gateway tracing policy created.
   ```

   | Field | Description |
   | --- | --- |
   | `spec.targetRefs` | Attaches the policy to the named Gateway in the same namespace. |
   | `spec.frontend.tracing.backendRef` | Sends traces to `OTEL_COLLECTOR_NAME` in `OTEL_NAMESPACE` on port 4317. The `ReferenceGrant` authorizes this cross-namespace reference. |
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

2. Confirm that the policy reports current `Accepted` and `Attached` conditions.

   ```sh
   policy_json="$(kubectl get agentgatewaypolicies.agentgateway.dev \
     "$TRACE_POLICY_NAME" \
     --namespace "$GATEWAY_NAMESPACE" \
     --output json)" &&
   if ! jq -e '
     .metadata.generation as $generation |
     any(.status.ancestors[]?.conditions[]?;
       .type == "Accepted" and .status == "True" and
       .observedGeneration == $generation) and
     any(.status.ancestors[]?.conditions[]?;
       .type == "Attached" and .status == "True" and
       .observedGeneration == $generation)' \
     <<<"$policy_json" >/dev/null; then
     printf 'The gateway tracing policy is not accepted and attached.\n' >&2
     false
   fi &&
   printf '%s\n' 'Gateway tracing policy is accepted and attached.'
   ```

   Expected final output after the checks pass:

   ```text
   Gateway tracing policy is accepted and attached.
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
       ($url | test("^https?://"))' >/dev/null; then
     printf 'The generated trace ID, span ID, or request URL is invalid.\n' >&2
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

   Expected final output after the checks pass:

   ```text
   Representative request returned HTTP 200.
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
   TRACE_ROWS="$(az monitor log-analytics query \
     --workspace "$LOG_ANALYTICS_WORKSPACE_ID" \
     --analytics-query "$TRACE_QUERY" \
     --timespan PT30M \
     --output json \
     --only-show-errors)" &&
   if ! jq -e \
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
   ACCESS_LOG_ROWS="$(az monitor log-analytics query \
     --workspace "$CONTAINER_INSIGHTS_WORKSPACE_ID" \
     --analytics-query "$ACCESS_LOG_QUERY" \
     --timespan PT30M \
     --output json \
     --only-show-errors)" &&
   if ! jq -e \
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
     <<<"$ACCESS_LOG_ROWS" >/dev/null; then
     printf 'The access log rows did not pass verification.\n' >&2
     false
   fi &&
   jq '{verified_access_log_rows: length}' <<<"$ACCESS_LOG_ROWS"
   ```

   Expected output shape (identifiers and counts vary):

   ```text
   {"verified_access_log_rows":1}
   ```

   The query prints only the verified row count and keeps log bodies in `ACCESS_LOG_ROWS`. Inspect that variable only if your logging policy allows access to the request metadata recorded by agentgateway.

## Clean up the integration

Remove only the tracing policy and monitors created by this guide. Keep the Gateway, controller, provider routes, model access, and their namespaces. Do not remove a shared Collector until every workload using it has stopped exporting traces.

```sh
kubectl delete agentgatewaypolicies.agentgateway.dev "$TRACE_POLICY_NAME" \
  --namespace "$GATEWAY_NAMESPACE" --ignore-not-found --wait=true &&
kubectl delete podmonitors.azmonitoring.coreos.com "$GATEWAY_POD_MONITOR" \
  --namespace "$GATEWAY_NAMESPACE" --ignore-not-found --wait=true &&
kubectl delete servicemonitors.azmonitoring.coreos.com "$CONTROLLER_SERVICE_MONITOR" \
  --namespace "$CONTROLLER_NAMESPACE" --ignore-not-found --wait=true &&
kubectl delete referencegrants.gateway.networking.k8s.io "$OTEL_REFERENCE_GRANT" \
  --namespace "$OTEL_NAMESPACE" --ignore-not-found --wait=true &&
printf '%s\n' 'Guide tracing policy and monitors removed.'
```

Expected final output after the checks pass:

```text
Guide tracing policy and monitors removed.
```

Repeat the representative model request and confirm it still succeeds before removing the Collector.

{{< reuse "agw-docs/snippets/azure-monitor-cleanup.md" >}}

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
| Workload Identity variables are absent | Confirm that OIDC and Workload Identity are enabled on AKS. Check the pod label `azure.workload.identity/use: "true"`, the service account annotation, federated credential issuer, audience, and exact subject in `COLLECTOR_SUBJECT`. Restart the Deployment after fixing identity metadata. |
| Collector logs report `401`, `403`, authentication, or export errors | Confirm the Collector identity has `Monitoring Metrics Publisher` at the exact DCR scope. Check the `https://monitor.azure.com/.default` scope, native traces endpoint, DCE public access, and DCR immutable ID. Role assignments can take several minutes to propagate. |
| The Gateway cannot reach the Collector | Check the Collector Service endpoints and port 4317. The NetworkPolicy selectors must match the Gateway namespace and `gateway.networking.k8s.io/gateway-name` pod label, and your cluster network plugin must enforce the policy. |
| The Collector exports successfully but `OTelSpans` is empty | Confirm that the DCR data flow includes all three `Microsoft-OTel-Traces-*` streams and targets the intended Log Analytics workspace. Query the known trace ID over a 30-minute window. Native ingestion can take up to 15 minutes. |
