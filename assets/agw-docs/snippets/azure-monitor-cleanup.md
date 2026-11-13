The following commands remove the named Collector objects, not their namespace. Run them only after restoring or removing the tracing configuration above and confirming that no other workload uses this Collector. Use the same variables and unused resource names that passed the setup checks. Cleanup requires Kubernetes delete permission for these objects.

```sh
kubectl delete deployment "$OTEL_COLLECTOR_NAME" \
  --namespace "$OTEL_NAMESPACE" --ignore-not-found --wait=true &&
kubectl delete service "$OTEL_COLLECTOR_NAME" \
  --namespace "$OTEL_NAMESPACE" --ignore-not-found --wait=true &&
kubectl delete configmap "$OTEL_COLLECTOR_NAME" \
  --namespace "$OTEL_NAMESPACE" --ignore-not-found --wait=true &&
kubectl delete serviceaccount "$OTEL_SERVICE_ACCOUNT" \
  --namespace "$OTEL_NAMESPACE" --ignore-not-found --wait=true &&
kubectl delete networkpolicy "$OTEL_NETWORK_POLICY" \
  --namespace "$OTEL_NAMESPACE" --ignore-not-found --wait=true &&
printf '%s\n' 'Collector objects removed.'
```

Expected final output after the checks pass:

```text
Collector objects removed.
```

Confirm the Collector and its service account are absent:

```sh
deployment_state="$(kubectl get deployment "$OTEL_COLLECTOR_NAME" \
  --namespace "$OTEL_NAMESPACE" --ignore-not-found --output name)" &&
if [ -n "$deployment_state" ]; then
  printf 'The Collector Deployment still exists: %s.\n' "$deployment_state" >&2
  false
fi &&
service_account_state="$(kubectl get serviceaccount "$OTEL_SERVICE_ACCOUNT" \
  --namespace "$OTEL_NAMESPACE" --ignore-not-found --output name)" &&
if [ -n "$service_account_state" ]; then
  printf 'The Collector ServiceAccount still exists: %s.\n' "$service_account_state" >&2
  false
fi &&
printf '%s\n' 'Collector deployment and ServiceAccount are absent.'
```

Expected final output after the checks pass:

```text
Collector deployment and ServiceAccount are absent.
```

The Azure resources can remain for another validation run. They may continue to incur storage or ingestion charges. If keeping the identity but removing this cluster's federation, first check its subject, audience, and issuer. The example deletes only the exact credential created by this guide, not the managed identity:

```sh
credential_json="$(az identity federated-credential show \
  --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" \
  --identity-name "$COLLECTOR_IDENTITY" --name "$FEDERATED_CREDENTIAL_NAME" \
  --output json --only-show-errors)" &&
if ! jq -e --arg subject "$COLLECTOR_SUBJECT" --arg issuer "$AKS_OIDC_ISSUER" '
  .subject == $subject and .issuer == $issuer and
  .audiences == ["api://AzureADTokenExchange"]' <<<"$credential_json" >/dev/null; then
  printf 'The federated credential does not match the expected subject, issuer, and audience.\n' >&2
  false
fi &&
az identity federated-credential delete \
  --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" \
  --identity-name "$COLLECTOR_IDENTITY" --name "$FEDERATED_CREDENTIAL_NAME" \
  --yes --output none --only-show-errors &&
printf '%s\n' 'Collector federation removed.'
```

Expected final output after the checks pass:

```text
Collector federation removed.
```

If no workload needs the guide-created Azure resources, you can also delete them. Setup records successful creation in the `GUIDE_CREATED_*` variables. Keep those values from the setup session, and do not reconstruct them from resource names. Run the access-log verification earlier in the same shell, because it identifies the Container Insights workspace.

The following block refuses deletion in these cases:

- The shell has no record that the guide created a resource.
- The guide reused an existing role assignment instead of creating one.
- Container Insights sends logs to the guide's workspace.
- Another DCR in the subscription still sends data to the workspace.
- The Collector identity still has federated credentials.

Leave such resources and grants in place for their owner to review. Do not delete a shared identity or resources that existed before this guide. Export any telemetry you need first. The block asks you to type the DCR name and then the workspace name. Deleting the workspace removes its stored telemetry, so inspect the resource IDs before confirming. If the block stops partway, check which resources remain before rerunning it. A rerun stops at the first resource that is already gone. These commands require Azure delete permissions and `Microsoft.Authorization/roleAssignments/delete` at the DCR scope. They do not delete the AKS cluster or resource group.

```sh
expected_dcr="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Insights/dataCollectionRules/${DATA_COLLECTION_RULE}" &&
expected_dce="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Insights/dataCollectionEndpoints/${DATA_COLLECTION_ENDPOINT}" &&
expected_workspace="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.OperationalInsights/workspaces/${LOG_ANALYTICS_WORKSPACE}" &&
if ! {
  [ "$DATA_COLLECTION_RULE_ID" = "$expected_dcr" ] &&
  [ "$DATA_COLLECTION_ENDPOINT_ID" = "$expected_dce" ] &&
  [ "$LOG_ANALYTICS_RESOURCE_ID" = "$expected_workspace" ] &&
  [ "${GUIDE_CREATED_DCR_ID:-}" = "$expected_dcr" ] &&
  [ "${GUIDE_CREATED_DCE_ID:-}" = "$expected_dce" ] &&
  [ "${GUIDE_CREATED_WORKSPACE_ID:-}" = "$expected_workspace" ] &&
  jq -en \
    --arg created "${GUIDE_CREATED_COLLECTOR_ID:-}" \
    --arg expected "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/${COLLECTOR_IDENTITY}" \
    --arg assignment "${GUIDE_CREATED_ROLE_ASSIGNMENT_ID:-}" \
    --arg assignment_prefix "${expected_dcr}/providers/Microsoft.Authorization/roleAssignments/" \
    --arg workspace "$expected_workspace" \
    --arg container_insights "${CONTAINER_INSIGHTS_WORKSPACE_RESOURCE_ID:-}" '
      ($created | ascii_downcase) == ($expected | ascii_downcase) and
      ($assignment | ascii_downcase | startswith($assignment_prefix | ascii_downcase)) and
      ($assignment | length) > ($assignment_prefix | length) and
      ($container_insights | length) > 0 and
      ($container_insights | ascii_downcase) != ($workspace | ascii_downcase)' >/dev/null
}; then
  printf 'Removal refused: this shell has no record that the guide created every resource, the role assignment was reused, or Container Insights uses the workspace.\n' >&2
  false
fi &&
subscription_dcrs='[]' &&
dcr_url="/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.Insights/dataCollectionRules?api-version=2024-03-11" &&
while [ -n "$dcr_url" ]; do
  if dcr_page="$(az rest --method get --url "$dcr_url" --output json --only-show-errors)" &&
    subscription_dcrs="$(jq -c --argjson page "$dcr_page" '. + $page.value' <<<"$subscription_dcrs")"; then
    dcr_url="$(jq -r '.nextLink // empty' <<<"$dcr_page")"
  else
    dcr_url=""
    subscription_dcrs=""
  fi
done &&
if ! jq -e --arg own "$expected_dcr" --arg workspace "$expected_workspace" '
  type == "array" and
  all(.[];
    (.id | ascii_downcase) == ($own | ascii_downcase) or
    ([.properties.destinations.logAnalytics[]?.workspaceResourceId | ascii_downcase] |
      index($workspace | ascii_downcase)) == null)' \
  <<<"$subscription_dcrs" >/dev/null; then
  printf 'Removal refused: the subscription DCR listing failed, or another Data Collection Rule sends data to the workspace.\n' >&2
  false
fi &&
identity_credentials="$(az identity federated-credential list \
  --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" \
  --identity-name "$COLLECTOR_IDENTITY" --output json --only-show-errors)" &&
if ! jq -e 'type == "array" and length == 0' <<<"$identity_credentials" >/dev/null; then
  printf 'Removal refused: the Collector identity still has federated credentials that another workload may use.\n' >&2
  false
fi &&
printf 'Guide-created resources: %s\n%s\n%s\nIdentity: %s\n' \
  "$expected_dcr" "$expected_dce" "$expected_workspace" "$COLLECTOR_IDENTITY" &&
printf 'Type the Data Collection Rule name to confirm removal: ' &&
read -r cleanup_confirmation &&
[ "$cleanup_confirmation" = "$DATA_COLLECTION_RULE" ] &&
printf 'Type the Log Analytics workspace name to confirm deleting it and its stored telemetry: ' &&
read -r workspace_confirmation &&
[ "$workspace_confirmation" = "$LOG_ANALYTICS_WORKSPACE" ] &&
az role assignment delete \
  --subscription "$SUBSCRIPTION_ID" --ids "$GUIDE_CREATED_ROLE_ASSIGNMENT_ID" \
  --only-show-errors &&
az resource delete --subscription "$SUBSCRIPTION_ID" \
  --ids "$expected_dcr" "$expected_dce" --output none --only-show-errors &&
az identity delete --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" --name "$COLLECTOR_IDENTITY" \
  --output none --only-show-errors &&
az monitor log-analytics workspace delete \
  --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" --yes \
  --output none --only-show-errors &&
printf '%s\n' 'Guide-created Azure resources removed.'
```

Expected final output after the checks pass:

```text
Guide-created Azure resources removed.
```

Check the resource group's inventory afterward and confirm only the intended resources are gone. Log Analytics deletion is soft deletion. It does not immediately purge stored telemetry, and the workspace name may remain recoverable. Do not use `--force` just to reuse the name. Recover the workspace through Azure's documented recovery procedure, or choose unused names for a fresh run. If retaining these resources instead, recreate the exact federation for the next cluster's current OIDC issuer and deploy the Collector before restoring trace export.
