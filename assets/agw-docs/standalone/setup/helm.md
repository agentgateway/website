Deploy agentgateway as a standalone Kubernetes workload by using the standalone Helm chart.

Use this chart when you want the standalone agentgateway model, but you want Kubernetes to run and expose the process for you. The chart runs the same binary and reads the same configuration file that the binary and Docker installations use. You supply that file through Helm values, and the chart renders it into a ConfigMap that the proxy reads at startup.

> [!TIP]
> This chart installs agentgateway as a single, unmanaged Kubernetes Deployment. You manage agentgateway config by upgrading the Helm values, and optionally by adding a PostgreSQL database so that you can edit the config in the admin UI. If you want a managed Kubernetes solution that includes a control plane and Gateway API resources, see [Kubernetes control plane]({{< link-hextra path="/setup/install/kubernetes/" >}}).

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
> The chart creates no PersistentVolumeClaim and no Service for the admin port. Configuration lives in the ConfigMap, and you reach the admin address by port-forwarding the Deployment. Because the ConfigMap is mounted read-only, the admin UI cannot save configuration changes by default. To make the UI writable, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).

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

1. Port-forward the admin address.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
   ```

2. In your browser, open the `/ui` path.

   ```sh
   open http://localhost:15000/ui
   ```

To give the UI its own gateway, secure it with OIDC, and expose it on your own hostname, see [Admin UI]({{< link-hextra path="/setup/ui/" >}}).

## Reuse configuration from the standalone guides

The `config` Helm value holds the entire agentgateway configuration file, so the configuration examples throughout the standalone documentation are complete files that you can copy into the `config` value without changing their structure. For the values file itself, see [Update your configuration]({{< link-hextra path="/setup/update/" >}}). Keep the following points in mind when you copy an example.

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

* [Set up the admin UI]({{< link-hextra path="/setup/ui/" >}}) to give the UI its own gateway and secure it with OIDC.
* [Choose where configuration is stored]({{< link-hextra path="/setup/storage/" >}}) so that the UI can save your changes.
* [Update your configuration]({{< link-hextra path="/setup/update/" >}}) by upgrading your Helm values.
* [Upgrade agentgateway]({{< link-hextra path="/operations/upgrade/" >}}) to a new chart version.
