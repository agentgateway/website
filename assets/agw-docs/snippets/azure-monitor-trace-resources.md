Microsoft recommends an [Application Insights resource with OTLP support](https://learn.microsoft.com/azure/azure-monitor/containers/opentelemetry-protocol-ingestion), which provisions the DCE and DCR for you along with endpoints for logs and metrics. This guide creates the DCE and a trace-only DCR directly instead. Metrics and access logs already reach Azure Monitor through managed Prometheus and Container Insights, so the Collector sends only traces.

This example uses a public DCE so you can set up tracing without first configuring private endpoints and their DNS. The Collector authenticates with AKS Workload Identity. Traces travel over HTTPS.

If you need private ingestion, see [Azure Monitor Private Link design guidance](https://learn.microsoft.com/azure/azure-monitor/fundamentals/private-link-design) for the Azure Monitor Private Link Scope (AMPLS), private endpoint, and DNS setup.

The DCR sends only these three native OpenTelemetry trace streams to Log Analytics.

| Stream | Content |
| --- | --- |
| `Microsoft-OTel-Traces-Spans` | Operations within a trace, with their timing, status, and attributes. |
| `Microsoft-OTel-Traces-Events` | Span events, including recorded exceptions. |
| `Microsoft-OTel-Traces-Resources` | Attributes of the telemetry source, such as its service name and instance. |

1. Run the following read-only checks for conflicts with existing Azure resources and recoverable Log Analytics workspaces. Resolve any API or permission error before continuing. Run these checks once, before creating resources; if a later step fails, fix the cause and rerun only that step in the same shell. A new shell loses this check's result and the creation records. In that case, continue only after confirming the existing resources are the ones this guide created, then run `export AZURE_NAME_PREFLIGHT_PASSED=true`. The guided cleanup will not delete resources whose creation it did not record, so delete those with `az resource delete --ids` once no workload uses them.

   ```sh
   unset AZURE_NAME_PREFLIGHT_PASSED
   azure_resources="$(az resource list \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --output json --only-show-errors)" &&
   if ! jq -e \
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
     <<<"$azure_resources" >/dev/null; then
     printf 'An Azure resource with a configured name already exists.\n' >&2
     false
   fi &&
   deleted_workspaces="$(az monitor log-analytics workspace list-deleted-workspaces \
     --subscription "$SUBSCRIPTION_ID" \
     --resource-group "$RESOURCE_GROUP" \
     --output json --only-show-errors)" &&
   if ! jq -e --arg name "$LOG_ANALYTICS_WORKSPACE" --arg location "$LOCATION" '
     type == "array" and
     all(.[];
       ((.name // "") | ascii_downcase) != ($name | ascii_downcase) or
       ((.location // "") | ascii_downcase) != ($location | ascii_downcase))' \
     <<<"$deleted_workspaces" >/dev/null; then
     printf 'A recoverable deleted Log Analytics workspace uses this name and location.\n' >&2
     false
   fi &&
   export AZURE_NAME_PREFLIGHT_PASSED=true &&
   printf '%s\n' 'Azure resource-name checks passed.'
   ```

   Expected final output after the checks pass:

   ```text
   Azure resource-name checks passed.
   ```

2. Create and validate the Log Analytics workspace, then retrieve its resource ID and workspace ID.

   ```sh
   if [ "${AZURE_NAME_PREFLIGHT_PASSED:-false}" != "true" ]; then
     printf 'Run the Azure resource-name checks in this shell first.\n' >&2
     false
   fi &&
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
   export GUIDE_CREATED_WORKSPACE_ID="$LOG_ANALYTICS_RESOURCE_ID" &&
   printf '%s\n' 'Log Analytics workspace validated.'
   ```

   Expected final output after the checks pass:

   ```text
   Log Analytics workspace validated.
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
   fi &&
   export GUIDE_CREATED_DCE_ID="$DATA_COLLECTION_ENDPOINT_ID" &&
   printf '%s\n' 'Data Collection Endpoint validated.'
   ```

   Expected final output after the checks pass:

   ```text
   Data Collection Endpoint validated.
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
   fi &&
   export GUIDE_CREATED_DCR_ID="$DATA_COLLECTION_RULE_ID" &&
   printf '%s\n' 'Trace-only Data Collection Rule validated.'
   ```

   Expected final output after the checks pass:

   ```text
   Trace-only Data Collection Rule validated.
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
   if ! jq -en --arg endpoint "$AZURE_MONITOR_OTLP_TRACES_ENDPOINT" '$endpoint | test("^https://[^|&\\\\[:space:]]+$")' >/dev/null; then
     printf 'The OTLP traces endpoint is invalid.\n' >&2
     false
   fi &&
   export DCE_LOGS_INGESTION_ENDPOINT DCR_IMMUTABLE_ID &&
   export AZURE_MONITOR_OTLP_TRACES_ENDPOINT &&
   printf '%s\n' 'Native OTLP traces endpoint configured.'
   ```

   Expected final output after the checks pass:

   ```text
   Native OTLP traces endpoint configured.
   ```
