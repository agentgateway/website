Use the standalone Helm chart when you want the standalone agentgateway model, but you want Kubernetes to run and expose the process for you. The chart runs the same binary and reads the same configuration file that the binary and Docker installations use. You supply that file through Helm values, and the chart renders it into a ConfigMap that the proxy reads at startup.

> [!TIP]
> This chart installs agentgateway as a single, unmanaged Kubernetes Deployment. You manage agentgateway config by upgrading the Helm values, and optionally by adding a PostgreSQL database so that you can edit the config in the UI. If you want a managed Kubernetes solution that includes a control plane and Gateway API resources, see [Kubernetes control plane]({{< link-hextra path="/setup/install/kubernetes/" >}}).

## Before you begin

{{< reuse "agw-docs/standalone/helm-standalone-prereqs.md" >}}

## Install

Install the standalone Helm chart.

{{< tabs >}}
{{% tab name="Latest" %}}
```sh
helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
  {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --create-namespace \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
```
{{% /tab %}}
{{% tab name="Nightly build" %}}
```sh
helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
  {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --create-namespace \
  --version {{< reuse "agw-docs/versions/patch-dev.md" >}}
```
{{% /tab %}}
{{% tab name="Unique name and namespace" %}}
To install with a different name and in a different namespace, set both the Helm release namespace and `namespaceOverride` setting.

The following example installs an `agw` Helm release in the `agw` namespace.

```sh
helm upgrade -i agw \
  {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
  --namespace agw \
  --create-namespace \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
  --set namespaceOverride=agw
```
{{% /tab %}}
{{< /tabs >}}

### What the chart installs {#install-included}

The chart creates the following resources. Each resource is named after the Helm release, which is `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` in these examples.

| Resource | Name | Purpose |
| --- | --- | --- |
| Deployment | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Runs the agentgateway proxy. |
| ConfigMap | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-config` | Holds the rendered `config.yaml`, mounted read-only at `/config`. |
| Service | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Exposes the gateway listener. Type `LoadBalancer` and port `80` to container port `4000` by default. |
| ServiceAccount | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Identity for the proxy pod. |

If you installed with a different release name or namespace, such as with the **Unique name and namespace** tab, adjust the resource names and the `-n` values in the commands throughout this documentation accordingly.

### What the chart does not install

Keep in mind that the Helm chart installation does not include the following features:

* No PersistentVolumeClaim for persistent storage.
* No Service for the admin port. Instead, you can reach the admin interface by port-forwarding the `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` Deployment.
* No writeable UI by default. To make the UI writable, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).
* No database for features such as LLM analytics, LLM logs, API key budgets, and hybrid storage. To add a database, see [Database]({{< link-hextra path="/setup/database/#helm" >}}).
  
Also keep in mind that this standalone Kubernetes Deployment via Helm does not include the features of [{{< reuse "agw-docs/snippets/agentgateway.md" >}} for Kubernetes](https://docs.solo.io/agentgateway/kubernetes/latest/), such as a control plane, agentgateway custom resources, or additional services such as rate limiting, external auth, and WAF.

## Verify the installation

1. Verify that the agentgateway pod is running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name={{< reuse "agw-docs/standalone/helm-standalone-chart-name.md" >}}
   ```

   Example output:

   ```txt
   NAME                                       READY   STATUS    RESTARTS   AGE
   {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-6d5dc56bdb-792pt   1/1     Running   0          30s
   ```

2. Review the configuration that the chart rendered into the ConfigMap.

   ```sh
   kubectl get configmap {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-config \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o jsonpath='{.data.config\.yaml}'
   ```

   Example output: Note that `storage` is nested in agentgateway's own top-level `config` section, which the chart manages for you based on the `mode` value.

   ```yaml
   config:
     storage:
       mode: file
   gateways:
     default:
       port: 4000
   llm:
     models: []
   mcp:
     targets: []
   ui: {}
   ```

## Open the UI

For quick access to the UI, port-forward the `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` Deployment and open the `/ui` path.

1. Port-forward the admin interface.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
   ```

2. In your browser, open the `/ui` path: [http://localhost:15000/ui](http://localhost:15000/ui)

A port-forward is a quick way to look at the UI on a cluster. To give the UI its own gateway so that you can reach it without one, secure it with OIDC, and expose it on your own hostname, see [UI]({{< link-hextra path="/setup/ui/" >}}).

## Common Helm values

{{< reuse "agw-docs/standalone/helm-standalone-values-table.md" >}}

## Uninstall

1. Uninstall the Helm release.

   ```sh
   helm uninstall {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Remove the namespace or any PostgreSQL database that you created.

   ```sh
   kubectl delete namespace {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

## Next steps

* [Set up the UI]({{< link-hextra path="/setup/ui/" >}}) to give the UI its own gateway and secure it with OIDC.
* [Set up a database]({{< link-hextra path="/setup/database/#helm" >}}) so that the **Analytics** and **Logs** pages have data to show.
* [Choose where configuration is stored]({{< link-hextra path="/setup/storage/" >}}) so that the UI can save your changes.
* [Update your configuration]({{< link-hextra path="/setup/update/" >}}) by upgrading your Helm values.
* [Upgrade agentgateway]({{< link-hextra path="/operations/upgrade/" >}}) to a new chart version.
