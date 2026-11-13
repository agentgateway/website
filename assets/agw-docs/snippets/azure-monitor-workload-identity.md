The Collector authenticates as a user-assigned managed identity. AKS projects a signed service account token into the Collector pod, so this path needs no client secret, connection string, instrumentation key, or Application Insights resource.

1. Create and validate the Collector identity, then record its client and principal IDs.

   ```sh
   if [ "${AZURE_NAME_PREFLIGHT_PASSED:-false}" != "true" ]; then
     printf 'Run the Azure resource-name checks in this shell first.\n' >&2
     false
   fi &&
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
   export GUIDE_CREATED_COLLECTOR_ID="$(jq -er '.id' <<<"$identity_json")" &&
   printf '%s\n' 'Collector identity validated.'
   ```

   Expected final output after the checks pass:

   ```text
   Collector identity validated.
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
   export COLLECTOR_SUBJECT="system:serviceaccount:${OTEL_NAMESPACE}:${OTEL_SERVICE_ACCOUNT}" &&
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
   printf '%s\n' 'Collector federation created.'
   ```

   Expected final output after the checks pass:

   ```text
   Collector federation created.
   ```

3. Assign `Monitoring Metrics Publisher` at the DCR scope. Despite its name, this role also authorizes native OTLP trace writes to the DCR. The commands keep an existing matching assignment and create one only if none exists. A rerun keeps this guide's creation record; an assignment that existed before the guide is not recorded, so cleanup leaves it in place.

   ```sh
   MONITORING_METRICS_PUBLISHER_ROLE_ID="3913510d-42f4-4e42-8a64-420c390055eb" &&
   assignments="$(az role assignment list \
     --subscription "$SUBSCRIPTION_ID" \
     --assignee-object-id "$COLLECTOR_PRINCIPAL_ID" \
     --role "$MONITORING_METRICS_PUBLISHER_ROLE_ID" \
     --scope "$DATA_COLLECTION_RULE_ID" \
     --output json --only-show-errors)" &&
   if ! jq -e \
     --arg principal "$COLLECTOR_PRINCIPAL_ID" \
     --arg scope "$DATA_COLLECTION_RULE_ID" \
     --arg role "$MONITORING_METRICS_PUBLISHER_ROLE_ID" '
       type == "array" and length <= 1 and
       all(.[];
         (.principalId | ascii_downcase) == ($principal | ascii_downcase) and
         (.scope | ascii_downcase) == ($scope | ascii_downcase) and
         (.roleDefinitionId | ascii_downcase | endswith("/" + ($role | ascii_downcase))))' \
     <<<"$assignments" >/dev/null; then
     printf 'The Collector has unexpected Monitoring Metrics Publisher assignments at the DCR scope.\n' >&2
     false
   fi &&
   if [ "$(jq 'length' <<<"$assignments")" -eq 0 ]; then
     GUIDE_CREATED_ROLE_ASSIGNMENT_ID="$(az role assignment create \
       --subscription "$SUBSCRIPTION_ID" \
       --assignee-object-id "$COLLECTOR_PRINCIPAL_ID" \
       --assignee-principal-type ServicePrincipal \
       --role "$MONITORING_METRICS_PUBLISHER_ROLE_ID" \
       --scope "$DATA_COLLECTION_RULE_ID" \
       --query id --output tsv --only-show-errors)" &&
     [ -n "$GUIDE_CREATED_ROLE_ASSIGNMENT_ID" ] &&
     export GUIDE_CREATED_ROLE_ASSIGNMENT_ID
   elif [ "${GUIDE_CREATED_ROLE_ASSIGNMENT_ID:-}" != "$(jq -r '.[0].id' <<<"$assignments")" ]; then
     unset GUIDE_CREATED_ROLE_ASSIGNMENT_ID
   fi &&
   printf '%s\n' 'Collector DCR publish permission verified.'
   ```

   Expected final output after the checks pass:

   ```text
   Collector DCR publish permission verified.
   ```
