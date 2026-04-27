1. Install the custom resources of the {{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} version {{< reuse "agw-docs/versions/k8s-gw-version.md" >}}.
   {{< tabs items="Standard, Experimental" tabTotal="2" >}}
   {{% tab tabName="Standard" %}}
   ```sh {paths="standard"}
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/standard-install.yaml
   ```
   {{% /tab %}}
   {{% tab tabName="Experimental" %}}
   CRDs in the experimental channel are required to use some experimental features in the Gateway API. Guides that require experimental CRDs note this requirement in their prerequisites.
   ```sh {paths="experimental"}
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/experimental-install.yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}
   Example output:
   ```console
   customresourcedefinition.apiextensions.k8s.io/gatewayclasses.gateway.networking.k8s.io created
   customresourcedefinition.apiextensions.k8s.io/gateways.gateway.networking.k8s.io created
   customresourcedefinition.apiextensions.k8s.io/httproutes.gateway.networking.k8s.io created
   customresourcedefinition.apiextensions.k8s.io/referencegrants.gateway.networking.k8s.io created
   customresourcedefinition.apiextensions.k8s.io/grpcroutes.gateway.networking.k8s.io created
   ```

2. Apply the {{< reuse "/agw-docs/snippets/kgateway.md" >}} CRDs for the upgrade version by using Helm.

   1. **Optional**: To check the CRDs locally, download the CRDs to a `helm` directory.

      ```sh
      helm template --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} {{< reuse "agw-docs/snippets/helm-path-crds.md" >}} --output-dir ./helm
      ```

   2. Deploy the {{< reuse "/agw-docs/snippets/kgateway.md" >}} CRDs by using Helm. This command creates the {{< reuse "agw-docs/snippets/namespace.md" >}} namespace and creates the {{< reuse "/agw-docs/snippets/kgateway.md" >}} CRDs in the cluster.
      ```sh {paths="standard,experimental"}
      helm upgrade -i --create-namespace \
        --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
        --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} {{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}} {{< reuse "/agw-docs/snippets/helm-path-crds.md" >}}
      ```

3. Install the {{< reuse "/agw-docs/snippets/kgateway.md" >}} Helm chart.

   1. **Optional**: Pull and inspect the {{< reuse "/agw-docs/snippets/kgateway.md" >}} Helm chart values before installation. You might want to update the Helm chart values files to customize the installation. For example, you might change the namespace, update the resource limits and requests, or enable extensions such as for AI.

      ```sh
      helm pull {{< reuse "agw-docs/snippets/helm-path.md" >}} --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}

      tar -xvf {{< reuse "agw-docs/snippets/helm-kgateway.md" >}}-{{< reuse "agw-docs/versions/helm-version-flag.md" >}}.tgz

      open {{< reuse "agw-docs/snippets/helm-kgateway.md" >}}/values.yaml
      ```

   2. Install {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane by using Helm. If you modified the `values.yaml` file with custom installation values, add the `-f {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}/values.yaml` flag.

      {{< tabs tabTotal="3" items="Basic installation,Custom values file,Development" >}}
{{% tab tabName="Basic installation" %}}




```sh {paths="standard"}
helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} {{< reuse "/agw-docs/snippets/helm-path.md" >}} \
--version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
```


{{% /tab %}}
{{% tab tabName="Custom values" %}}




```sh
helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}} {{< reuse "/agw-docs/snippets/helm-path.md" >}} \
--version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
-f {{< reuse "agw-docs/snippets/helm-kgateway.md" >}}/values.yaml
```


{{% /tab %}}
{{% tab tabName="Development" %}}
When using the development build {{< reuse "agw-docs/versions/helm-version-flag-n1.md" >}}, add the `--set controller.image.pullPolicy=Always` option to ensure you get the latest image. Alternatively, you can specify the exact image digest.




```sh {paths="experimental"}
helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} {{< reuse "/agw-docs/snippets/helm-path.md" >}} \
--version {{< reuse "agw-docs/versions/helm-version-flag-n1.md" >}} \
--set controller.image.pullPolicy=Always \
--set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true
```


{{% /tab %}}
      {{< /tabs >}}

      Example output:
      ```txt
      NAME: {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}
      LAST DEPLOYED: Thu Feb 13 14:03:51 2025
      NAMESPACE: {{< reuse "agw-docs/snippets/namespace.md" >}}
      STATUS: deployed
      REVISION: 1
      TEST SUITE: None
      ```

4. Verify that the control plane is up and running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```txt
   NAME                                      READY   STATUS    RESTARTS   AGE
   {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}-78658959cd-cz6jt             1/1     Running   0          12s
   ```

5. Verify that the `{{< reuse "/agw-docs/snippets/gatewayclass.md" >}}` GatewayClass is created. You can optionally take a look at how the GatewayClass is configured by adding the `-o yaml` option to your command.

   ```sh
   kubectl get gatewayclass {{< reuse "/agw-docs/snippets/gatewayclass.md" >}}
   ```

   Example output: 
   
   ```txt
   NAME             CONTROLLER                       ACCEPTED   AGE   
   {{< reuse "/agw-docs/snippets/gatewayclass.md" >}}     agentgateway.dev/{{< reuse "/agw-docs/snippets/gatewayclass.md" >}}    True       6m36s
   ```

{{< doc-test paths="standard,experimental" >}}
YAMLTest -f - <<'EOF'
- name: wait for agentgateway deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: verify agentgateway GatewayClass exists
  wait:
    target:
      kind: GatewayClass
      metadata:
        name: agentgateway
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 5
EOF
{{< /doc-test >}}
