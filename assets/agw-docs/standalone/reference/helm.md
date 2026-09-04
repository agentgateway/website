Review the Helm values that you can set for the `{{< reuse "agw-docs/standalone/helm-standalone-chart-name.md" >}}` Helm chart, which deploys agentgateway in standalone mode on Kubernetes.

To install the chart, see [Install with Helm]({{< link-hextra path="/setup/install/helm/" >}}).

> [!NOTE]
> This chart deploys the standalone agentgateway proxy only. For the Helm values of the charts that deploy the agentgateway control plane and CRDs for Kubernetes mode, see the [Kubernetes mode Helm reference](https://agentgateway.dev/docs/kubernetes/main/reference/helm/).

## Download the Helm chart {#download}

You can download the Helm chart to review the Helm values that are supported.

1. Download the Helm chart as an archive to your local machine.

   ```sh
   helm pull {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
   ```

2. Extract the files from the downloaded archive.

   ```sh
   tar -xvf {{< reuse "agw-docs/standalone/helm-standalone-chart-name.md" >}}-{{< reuse "agw-docs/versions/helm-version-flag.md" >}}.tgz
   ```

3. Open the Helm values file.

   ```sh
   open {{< reuse "agw-docs/standalone/helm-standalone-chart-name.md" >}}/values.yaml
   ```
