Use the standalone Helm chart when you want the standalone agentgateway model, but you want Kubernetes to run and expose the process for you. The chart runs the same binary and reads the same configuration file that the binary and Docker installations use. You supply that file through Helm values, and the chart renders it into a ConfigMap that the proxy reads at startup.

> [!TIP]
> This chart installs agentgateway as a single, unmanaged Kubernetes Deployment. You manage agentgateway config by upgrading the Helm values, and optionally by adding a PostgreSQL database so that you can edit the config in the UI. If you want a managed Kubernetes solution that includes a control plane and Gateway API resources, see [Kubernetes control plane]({{< link-hextra path="/documentation/setup/install/kubernetes/" >}}).

## Before you begin

{{< reuse "agw-docs/standalone/helm-standalone-prereqs.md" >}}

## Install

Install agentgateway with the database and Helm values that you want to use.

{{% steps %}}

### Set up a database {#database}

The chart does not install a database. The default `readonly` mode prevents UI saves. Database features, including LLM analytics, logs, and API key budgets, require a separate database. For the full list, see [Features that need a database]({{< link-hextra path="/documentation/setup/database/#features-that-need-a-database" >}}).

For production, use a managed PostgreSQL service or an operator that handles backups and failover. The following steps deploy a single instance for testing. To install without a database, continue to [Create your Helm values](#values).

Create the namespace that agentgateway and PostgreSQL share.

```sh
kubectl create namespace {{< reuse "agw-docs/snippets/namespace.md" >}}
```

{{< reuse "agw-docs/standalone/helm-postgres-deploy.md" >}}

### Create your Helm values {#values}

Create a `values.yaml` file that holds your agentgateway configuration. The chart renders the `config` value into the proxy configuration file.

{{< tabs >}}
{{% tab name="With PostgreSQL" %}}
Point the chart at the database that you deployed in the previous step.

```sh
cat <<'EOF' > values.yaml
mode: database
database:
  postgres:
    url: postgres://agw:${POSTGRES_PASSWORD}@postgres.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:5432/agw
extraEnv:
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: agentgateway-postgres
      key: POSTGRES_PASSWORD
config:
  gateways:
    default:
      port: 4000
  llm:
    providers: []
    models: []
    virtualModels: []
  mcp:
    targets: []
EOF
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
| --- | --- |
| `mode` | Set to `database` to save UI changes in PostgreSQL. The ConfigMap remains a read-only baseline. The chart sets `config.storage.mode` to `hybrid` and derives `config.database.url` from `database.postgres.url`. Do not set these fields in `config`. See [Configuration storage]({{< link-hextra path="/documentation/setup/storage/#helm" >}}). |
| `database.postgres.url` | PostgreSQL connection URL. Use `postgres://` or `postgresql://` and the `postgres` Service in the release namespace. The `${POSTGRES_PASSWORD}` reference keeps the password out of the ConfigMap. Startup logs contain the resolved URL, including the password. Limit access to pod logs. |
| `extraEnv` | Sets the proxy container's `POSTGRES_PASSWORD` environment variable from the PostgreSQL Secret. |
| `config.gateways.default.port` | The port of the default gateway. The Service that the chart creates sends traffic to port `4000`. |
| `config.llm`, `config.mcp` | Define these sections to add LLM providers, models, and MCP servers in the UI. In `database` mode, the UI can add resources to existing sections, but cannot create sections. See [Sections must exist in the file]({{< link-hextra path="/documentation/setup/storage/#sections-must-exist" >}}). |
{{% /tab %}}
{{% tab name="Without a database" %}}
Install in the default `readonly` mode. Your Helm values are the only source of configuration, and the UI cannot save changes. To add a database later, see [Database]({{< link-hextra path="/documentation/setup/database/#helm" >}}).

```sh
cat <<'EOF' > values.yaml
config:
  gateways:
    default:
      port: 4000
EOF
```
{{% /tab %}}
{{< /tabs >}}

### Install the chart {#install-chart}

Install the standalone Helm chart with your values file.

{{< tabs >}}
{{% tab name="Latest" %}}
```sh
helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
  {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --create-namespace \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
  -f values.yaml
```
{{% /tab %}}
{{% tab name="Nightly build" %}}
```sh
helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
  {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --create-namespace \
  --version {{< reuse "agw-docs/versions/patch-dev.md" >}} \
  -f values.yaml
```
{{% /tab %}}
{{% tab name="Unique name and namespace" %}}
To change the release name and namespace, set the Helm release namespace and `namespaceOverride`. If you use PostgreSQL, deploy PostgreSQL and its Secret in that namespace too. Update the hostname in `database.postgres.url` to match.

The following example installs an `agw` Helm release in the `agw` namespace.

```sh
helm upgrade -i agw \
  {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
  --namespace agw \
  --create-namespace \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
  --set namespaceOverride=agw \
  -f values.yaml
```
{{% /tab %}}
{{< /tabs >}}

If the pod logs show `failed to connect postgres database`, the proxy cannot reach PostgreSQL. The proxy retries for about 30 seconds, then exits. Kubernetes restarts the pod.

Check that the PostgreSQL pod is ready. The hostname in `database.postgres.url` must match the namespace of the `postgres` Service.

{{% /steps %}}

### What the chart installs {#install-included}

The chart creates the following resources. Each resource is named after the Helm release, which is `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` in these examples.

| Resource | Name | Purpose |
| --- | --- | --- |
| Deployment | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Runs the agentgateway proxy. |
| ConfigMap | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-config` | Holds the rendered `config.yaml`, mounted read-only at `/config`. |
| Service | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Exposes the gateway listener. Type `LoadBalancer` and port `80` to container port `4000` by default. |
| ServiceAccount | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Identity for the proxy pod. |{{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
| PodDisruptionBudget | `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` | Protects multi-replica proxy Deployments during voluntary disruptions when `podDisruptionBudget.enabled` is `true` and the minimum replica count is greater than `1`. |{{< /version >}}

If you installed with a different release name or namespace, such as with the **Unique name and namespace** tab, adjust the resource names and the `-n` values in the commands throughout this documentation accordingly.

### What the chart does not install

Keep in mind that the Helm chart installation does not include the following features:

* No database. Follow [Set up a database](#database) for a new installation, or [Database]({{< link-hextra path="/documentation/setup/database/#helm" >}}) for an existing release.
* No writable UI unless you install in `database` mode. For more information, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).
* No PersistentVolumeClaim for persistent storage.
* No Service for the admin port. Instead, you can reach the admin interface by port-forwarding the `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` Deployment.

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

   With PostgreSQL, expect `storage.mode: hybrid` and a database URL that contains the literal `${POSTGRES_PASSWORD}` reference. The proxy resolves the reference at startup.

   Without a database, expect `storage.mode: file` and no `database` field.

   Example output with PostgreSQL:

   ```yaml
   config:
     database:
       url: postgres://agw:${POSTGRES_PASSWORD}@postgres.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:5432/agw
     storage:
       mode: hybrid
   gateways:
     default:
       port: 4000
   llm:
     models: []
     providers: []
     virtualModels: []
   mcp:
     targets: []
   ```

3. If you use PostgreSQL, verify that the database tables exist. The proxy creates the tables on first startup without a separate migration.

   ```sh
   kubectl exec -n {{< reuse "agw-docs/snippets/namespace.md" >}} deploy/postgres \
     -- psql -U agw -d agw -c '\dt'
   ```

   Expect the following tables, including `request_logs` for LLM logs and `agw_config_resources` for UI configuration changes:

   ```txt
                          List of relations
    Schema |                 Name                 | Type  | Owner
   --------+--------------------------------------+-------+-------
    public | _agentgateway_request_log_migrations | table | agw
    public | agw_config_resources                 | table | agw
    public | budget_usage                         | table | agw
    public | request_log_payloads                 | table | agw
    public | request_logs                         | table | agw
   (5 rows)
   ```

## Open the UI

For quick access to the UI, port-forward the `{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}` Deployment and open the `/ui` path.

1. Port-forward the admin interface.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
   ```

2. In your browser, open the `/ui` path: [http://localhost:15000/ui](http://localhost:15000/ui)

   {{< reuse-image src="img/agentgateway-ui-landing.png" srcDark="img/agentgateway-ui-landing-dark.png" >}}

3. Check whether the UI can save changes.

   ```sh
   curl -s http://localhost:15000/api/runtime | jq '.ui.configStoreMode'
   ```

   Expect `hybrid` for PostgreSQL storage. In `readonly` mode, the result is `file`, and UI saves fail.

   Example output:

   ```txt
   "hybrid"
   ```

A port-forward is a quick way to look at the UI on a cluster. To give the UI its own gateway so that you can reach it without one, secure it with OIDC, and expose it on your own hostname, see [UI]({{< link-hextra path="/documentation/setup/ui/" >}}).

## Common Helm values

{{< reuse "agw-docs/standalone/helm-standalone-values-table.md" >}}

{{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
### Create a PodDisruptionBudget {#helm-pdb}

Use a PodDisruptionBudget (PDB) to keep one proxy pod available during voluntary disruptions. The chart creates the PDB only when `podDisruptionBudget.enabled` is `true` and the minimum replica count is greater than `1`. The minimum replica count is `replicaCount`, or `autoscaling.minReplicas` when `autoscaling.enabled` is `true`.

1. Upgrade the Helm release with multiple replicas and enable the PDB.

   ```sh
   helm upgrade {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --reuse-values \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --set replicaCount=2 \
     --set podDisruptionBudget.enabled=true \
     --set podDisruptionBudget.minAvailable=1
   ```

   | Value | Description |
   | --- | --- |
   | `replicaCount` | Must be greater than `1`. The chart skips the PDB for one replica. If `autoscaling.enabled` is `true`, the chart checks `autoscaling.minReplicas` instead. |
   | `podDisruptionBudget.enabled` | Set to `true` to render the PDB. |
   | `podDisruptionBudget.minAvailable` | Sets `spec.minAvailable`. The default value is `1`. |{{< version include-if="1.6.x" >}}
   | `podDisruptionBudget.maxUnavailable` | Sets `spec.maxUnavailable`. To use this field instead of `minAvailable`, also clear the `minAvailable` default with `--set-string podDisruptionBudget.minAvailable=`. Otherwise, the PDB sets both fields, and Kubernetes rejects it. |{{< /version >}}{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
   | `podDisruptionBudget.maxUnavailable` | Sets `spec.maxUnavailable`. When you set `podDisruptionBudget.maxUnavailable` to a non-zero number or non-empty string, the field takes precedence over `minAvailable`. The chart renders `spec.maxUnavailable` and omits `spec.minAvailable`. |{{< /version >}}
   | `podDisruptionBudget.unhealthyPodEvictionPolicy` | Sets `spec.unhealthyPodEvictionPolicy` when the value is not empty. |

2. Verify that Kubernetes created the PDB for the release.

   ```sh
   kubectl get poddisruptionbudget {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.spec.minAvailable}'
   ```

   Expected output:

   ```txt
   1
   ```

### Scale the proxy automatically {#helm-autoscaling}

Enable the chart's HorizontalPodAutoscaler (HPA) to adjust the number of proxy pods based on CPU or memory utilization. The cluster must provide the Kubernetes resource metrics API, typically through Metrics Server. Utilization targets are percentages of the pods' resource requests, so set requests for each resource that you use as a scaling signal.

1. Save the autoscaling settings in a values file. This example keeps two to five replicas, targets 80% CPU utilization, and disables the chart's default memory target.

   For scaling policies and stabilization windows, set `autoscaling.behavior`. For custom HPA annotations, set `autoscaling.annotations`. See the [Helm reference]({{< link-hextra path="/reference/helm/" >}}) for all chart values.

   ```yaml
   cat <<'EOF' > autoscaling-values.yaml
   autoscaling:
     enabled: true
     minReplicas: 2
     maxReplicas: 5
     targetCPUUtilizationPercentage: 80
     targetMemoryUtilizationPercentage: 0
   resources:
     requests:
       cpu: 100m
       memory: 128Mi
   EOF
   ```

   | Value | Description |
   | --- | --- |
   | `autoscaling.enabled` | Creates an `autoscaling/v2` HPA for the proxy Deployment. The HPA manages replicas instead of `replicaCount`. |
   | `autoscaling.minReplicas`, `autoscaling.maxReplicas` | Minimum and maximum replica counts. If you also enable a PDB, keep `minReplicas` greater than `1`. |
   | `autoscaling.targetCPUUtilizationPercentage` | Target CPU utilization as a percentage of the CPU request. Defaults to `80`. Set to `0` to omit this scaling signal. |
   | `autoscaling.targetMemoryUtilizationPercentage` | Target memory utilization as a percentage of the memory request. Defaults to `80`. Set to `0` to omit this scaling signal. Keep at least one signal enabled. |
   | `resources.requests` | Resource requests used to calculate utilization. |

2. Upgrade the release while retaining its existing values.

   ```sh
   helm upgrade {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --reuse-values \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     -f autoscaling-values.yaml
   ```

3. Check the HPA and its metrics. If utilization is `<unknown>`, inspect the HPA events and confirm that the resource metrics API is available.

   ```sh
   kubectl get hpa {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl describe hpa {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

{{< /version >}}

## Uninstall

1. Uninstall the Helm release.

   ```sh
   helm uninstall {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Remove the namespace.

   > [!WARNING]
   > This command deletes all resources in the namespace. If you deployed PostgreSQL there, the command also deletes its PersistentVolumeClaim and stored data.

   ```sh
   kubectl delete namespace {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

## Next steps

* [Set up the UI]({{< link-hextra path="/documentation/setup/ui/" >}}) to give the UI its own gateway and secure it with OIDC.
* [Add configuration in the UI]({{< link-hextra path="/documentation/setup/storage/#add-configuration-in-the-ui" >}}) and verify that it persists across restarts.
* [Verify request logging]({{< link-hextra path="/documentation/setup/database/#verify" >}}) by sending an LLM request.
* [Update your configuration]({{< link-hextra path="/documentation/setup/update/" >}}) by upgrading your Helm values.
* [Upgrade agentgateway]({{< link-hextra path="/documentation/operations/upgrade/" >}}) to a new chart version.
