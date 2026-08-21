Deploy agentgateway as a standalone Kubernetes workload by using the standalone Helm chart.

Use this chart when you want the standalone agentgateway binary model, but you want Kubernetes to run and expose the process for you. The chart runs the same binary and reads the same configuration file that the binary and Docker deployments use. You supply that file through Helm values, and the chart renders it into a ConfigMap that the proxy reads at startup.

> [!TIP]
> This chart installs agentgateway as a single, unmanaged Kubernetes deployment. You manage agentgateway config by upgrading the Helm values, and optionally adding a PostgreSQL database for editting the agentgateway config through the admin UI. If you want a managed Kubernetes solution that includes a control plane and Gateway API resources, see the [Kubernetes mode documentation](https://agentgateway.dev/docs/kubernetes/).

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

The chart creates the following resources. Each resource is named after the Helm release, which is `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` in these examples.

| Resource | Name | Purpose |
| --- | --- | --- |
| Deployment | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Runs the agentgateway proxy. |
| ConfigMap | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-config` | Holds the rendered `config.yaml`, mounted read-only at `/config`. |
| Service | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Exposes the gateway listener. Type `LoadBalancer` and port `80` to container port `4000` by default. |
| ServiceAccount | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Identity for the proxy pod. |

> [!NOTE]
> The chart creates no PersistentVolumeClaim and no Service for the admin port. Configuration lives in the ConfigMap, and you reach the admin interface by port-forwarding the Deployment. To persist configuration changes that you make in the UI, see [Store configuration in a database]({{< link-hextra path="/deployment/helm/storage/" >}}).

## Verify the installation

1. Verify that the agentgateway pod is running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name=agentgateway-standalone
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

   Example output:

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

For quick access to the admin UI, port-forward the agentgateway Deployment and open the `/ui` path.

<!--TODO secure UI
To securely expose the UI on your own domain, see the guide.-->

1. Port-forward the admin interface.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
   ```

2. In your browser, open the `/ui` path.

   ```sh
   open http://localhost:15000/ui
   ```

## Configure agentgateway

The `config` Helm value holds the entire agentgateway configuration file. Anything that you can write in a `config.yaml` for the binary, you can write in the Helm values file.

{{< reuse "agw-docs/standalone/helm-upgrade.md" >}}

<!--TODO not sure we need this info, sort of reference-y
### Fields that the chart manages

The chart sets two fields in the `config` section, and overwrites any value that you supply for them.

| Field | Set to |
| --- | --- |
| `config.storage.mode` | `file` when `mode` is `readonly`, or `hybrid` when `mode` is `database`. |
| `config.database.url` | The value of `database.postgres.url`, only when `mode` is `database`. |

Set the `mode` value instead of setting these fields directly.

| `mode` | Configuration source | Configuration changes in the UI |
| --- | --- | --- |
| `readonly` (default) | The ConfigMap that the chart renders from your Helm values. | Not saved. |
| `database` | The ConfigMap as a baseline, with an overlay stored in PostgreSQL. | Saved to the database. |

-->

### Reuse configuration from the standalone guides

The configuration examples throughout the standalone documentation are complete configuration files, so you can copy one into the `config` value without changing its structure. Keep the following points in mind.

* **Align the ports.** A Service port sends traffic to a `targetPort` on the pod, and that target port must be a port that your agentgateway configuration listens on. The chart's Service sends port `80` to container port `4000`, but the guides commonly configure a listener on port `3000` or `8080`, so the Service has no listener to send traffic to. Either change the listener in the configuration to port `4000`, or set `gateway.service.ports` so that the Service targets the port that your configuration uses. For more information, see [Expose listeners](#expose-listeners).
* **Omit the schema comment.** The `# yaml-language-server: $schema=` line that the guides include is a comment for your editor. Helm does not preserve it when it renders the ConfigMap.
* **Replace `stdio` MCP targets.** The proxy image contains no shell and no Node.js, so a target that starts a local process, such as `cmd: npx`, fails at startup with `mcp: failed to start stdio server: No such file or directory`. Use a remote target instead, or build an image that includes the command.

   ```yaml
   config:
     mcp:
       port: 3000
       targets:
       - name: server-everything
         mcp:
           host: http://server-everything.default.svc.cluster.local:3000/mcp/
   ```

### Edit the configuration in the UI

The admin UI reads the running configuration in every mode. Whether you can save an edit depends on the `mode` value.

In the default `readonly` mode, the ConfigMap is mounted read-only, so a save fails.

```txt
failed to write to file `/config/config.yaml`: Read-only file system (os error 30)
```

In `database` mode, you can add and edit the resources that the UI manages, such as MCP targets, LLM providers, models, and routes. Agentgateway stores the configuration in PostgreSQL and merges them over the ConfigMap baseline at read time. Saving the configuration file as a whole still fails, because the file itself remains read-only. To set up this mode, see [Store configuration in a database]({{< link-hextra path="/deployment/helm/storage/" >}}).

> [!IMPORTANT]
> Treat the Helm values as the source of truth for the configuration file, and the UI as the way to manage the resources that are layered on top of it. To change a field that the UI does not manage, such as a listener or a bind, update your Helm values and upgrade the release.

## Expose listeners

The chart's default values configure a gateway named `default` that listens on container port `4000`, and a `LoadBalancer` Service that sends its port `80` to that container port. If your configuration listens on other ports, set `gateway.service.ports` so that the Service targets them. The following example exposes a listener on port `3000`.

```yaml
gateway:
  service:
    ports:
    - name: mcp
      port: 3000
      targetPort: 3000
      protocol: TCP
```

Agentgateway does not read the `name` field, so you can choose any name that is a valid lowercase Kubernetes port name and is unique within the Service. Kubernetes requires a name when a Service exposes more than one port. The field that must match your configuration is `targetPort`, which must be a port that a gateway or bind in your configuration listens on.

To expose listeners on separate Services, such as an internal Service and an external Service, add `gateway.extraServices`. Each entry creates a Service named `<release name>-<name>` that selects the same pods.

```yaml
gateway:
  extraServices:
  - name: private-listener
    type: ClusterIP
    ports:
    - name: private
      port: 3000
      targetPort: 3000
      protocol: TCP
  - name: public-listener
    type: LoadBalancer
    annotations:
      service.beta.kubernetes.io/aws-load-balancer-type: nlb
    ports:
    - name: public
      port: 80
      targetPort: 4000
      protocol: TCP
```

## Other common values

{{< reuse "agw-docs/standalone/helm-standalone-values-table.md" >}}

## Upgrade

Upgrade the release by running `helm upgrade` with a new chart version, new Helm values, or both.

Because the ConfigMap is rendered from your Helm values, an upgrade replaces the entire configuration file, including any listener, bind, or route that you set in the `config` value. In `database` mode, the upgrade replaces only the ConfigMap baseline. The resources that the UI stores in PostgreSQL are unaffected, and agentgateway merges them over the new baseline.

> [!NOTE]
> The Deployment stores a checksum of the ConfigMap in its pod annotations, so a change to your `config` values rolls out new pods. Because the default `replicaCount` is `1`, expect a brief interruption in traffic during the rollout. To keep a pod serving traffic while the new pod starts, set `replicaCount` to a value greater than `1`.

{{< tabs >}}
{{% tab name="Upgrade version, reuse values" %}}
```sh
helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
  {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --reuse-values \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
```
{{% /tab %}}
{{% tab name="Upgrade Helm values file" %}}
{{< reuse "agw-docs/standalone/helm-upgrade.md" >}}
{{% /tab %}}
{{< /tabs >}}

## Uninstall

1. Uninstall the Helm release.

   ```sh
   helm uninstall {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Remove the namespace or any PostgreSQL database that you created.

   ```sh
   kubectl delete namespace {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
