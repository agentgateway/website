The {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} feature is an experimental preview and not enabled by default.

1. Enable the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` API in the control plane Helm chart.

   ```sh {paths="serve-model"}
   helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} {{< reuse "/agw-docs/snippets/helm-path.md" >}} \
   --version {{< reuse "agw-docs/versions/n-patch.md" >}} \
   --reuse-values \
   --set controller.image.pullPolicy=Always \
   --set agentgatewayModels.enabled=true \
   --wait
   ```

   {{< doc-test paths="serve-model" >}}
   kubectl rollout status deploy/agentgateway -n {{< reuse "agw-docs/snippets/namespace.md" >}} --timeout=300s
   {{< /doc-test >}}

2. Verify that the API is enabled. The command returns `true` when the feature gate is set.

   ```sh
   kubectl get deploy {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="AGW_ENABLE_AGENTGATEWAY_MODELS")].value}'
   ```