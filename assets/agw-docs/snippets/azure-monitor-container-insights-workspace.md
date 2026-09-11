```sh
CONTAINER_INSIGHTS_WORKSPACE_RESOURCE_ID="$(az aks show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_CLUSTER" \
  --query 'azureMonitorProfile.containerInsights.logAnalyticsWorkspaceResourceId' \
  --output tsv \
  --only-show-errors)" &&
if [ -z "$CONTAINER_INSIGHTS_WORKSPACE_RESOURCE_ID" ]; then
  CONTAINER_INSIGHTS_WORKSPACE_RESOURCE_ID="$(az aks show \
    --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" \
    --name "$AKS_CLUSTER" \
    --query 'addonProfiles.omsagent.config.logAnalyticsWorkspaceResourceID' \
    --output tsv \
    --only-show-errors)"
fi &&
[ -n "$CONTAINER_INSIGHTS_WORKSPACE_RESOURCE_ID" ] &&
CONTAINER_INSIGHTS_WORKSPACE_ID="$(az resource show \
  --ids "$CONTAINER_INSIGHTS_WORKSPACE_RESOURCE_ID" \
  --api-version 2022-10-01 \
  --query properties.customerId \
  --output tsv \
  --only-show-errors)" &&
[ -n "$CONTAINER_INSIGHTS_WORKSPACE_ID" ] &&
export CONTAINER_INSIGHTS_WORKSPACE_RESOURCE_ID CONTAINER_INSIGHTS_WORKSPACE_ID &&
kubectl rollout status daemonset/ama-logs \
  --namespace kube-system \
  --timeout=5m
```
