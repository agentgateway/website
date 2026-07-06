Deploy agentgateway as a standalone Kubernetes workload by using the standalone Helm chart.

Use this chart when you want the standalone agentgateway binary model, but you want Kubernetes to run and expose the process for you. The chart does not install the agentgateway Kubernetes control plane or Gateway API resources. For the managed Kubernetes deployment model, see the [Kubernetes documentation](https://agentgateway.dev/docs/kubernetes/).

## Before you begin

1. Create or use an existing Kubernetes cluster.
2. Install the following command-line tools.
   * [`kubectl`](https://kubernetes.io/docs/tasks/tools/#kubectl), the Kubernetes command line tool.
   * [`helm`](https://helm.sh/docs/intro/install/), the Kubernetes package manager.

## Install

Install the standalone Helm chart.

```sh
helm upgrade -i agentgateway-standalone \
  oci://cr.agentgateway.dev/charts/agentgateway-standalone \
  --namespace agentgateway-system \
  --create-namespace \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
```

By default, the chart creates the following resources.

| Resource | Default |
| --- | --- |
| Deployment | `agentgateway-standalone` |
| Namespace | `agentgateway-system` |
| Config storage | A `1Gi` PersistentVolumeClaim named `agentgateway-standalone-config` mounted at `/config` |
| Database | SQLite at `/config/data.db` |
| Admin Service | `agentgateway-standalone-admin`, `ClusterIP`, port `15000` |
| Gateway Service | `agentgateway-standalone-gateway`, `LoadBalancer` |

The gateway Service maps these ports by default. Note that by default, the http and https ports have listeners. The mcp and llm ports are exposed on the Service, but do not have backing listeners until you add one in the UI or the config in the Helm values file.

| Service port | Target (container) port | Listener |
| --- | --- | --- |
| `80` | `8080` | http |
| `443` | `8443` | https |
| `3000` | `3000` | mcp |
| `4000` | `4000` | llm |

To install into a different namespace, set both the Helm release namespace and `namespaceOverride`.

```sh
helm upgrade -i agentgateway-standalone \
  oci://cr.agentgateway.dev/charts/agentgateway-standalone \
  --namespace agw \
  --create-namespace \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
  --set namespaceOverride=agw
```

## Verify the installation

Verify that the agentgateway pod is running.

```sh
kubectl get pods -n agentgateway-system \
  -l app.kubernetes.io/name=agentgateway-standalone
```

Example output:

```txt
NAME                                       READY   STATUS    RESTARTS   AGE
agentgateway-standalone-7f7b9d8c8-xmpl    1/1     Running   0          30s
```

Verify that the configuration volume is bound.

```sh
kubectl get pvc agentgateway-standalone-config -n agentgateway-system
```

Example output:

```txt
NAME                         STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
agentgateway-standalone-config   Bound    pvc-00000000-0000-0000-0000-000000000000   1Gi        RWO            standard       30s
```

Check the gateway and admin Services.

```sh
kubectl get svc -n agentgateway-system \
  -l app.kubernetes.io/name=agentgateway-standalone
```

## Open the admin UI

The admin Service is internal by default. To open the UI locally, port-forward the admin Service.

```sh
kubectl port-forward -n agentgateway-system \
  svc/agentgateway-standalone-admin 15000:15000
```

Open <http://localhost:15000/ui> to get started.

## Customize the configuration

The chart bootstraps `/config/config.yaml` on first install. By default, the bootstrap configuration enables the admin UI on `0.0.0.0:15000`, uses SQLite at `/config/data.db`, and creates empty HTTP and HTTPS binds for ports `8080` and `8443`.

Use the admin UI to add and save configuration updates after you install the chart. Throughout the rest of the standalone docs, whenever you see instructions to edit the configuration file, you can make the same change in the UI.

You can also manage the configuration file with Helm values. Use this approach when you want to provide raw config directly or keep the config in a Helm values file. You can provide structured Helm values in `config`, or provide the complete file as `configYaml`. If both are set, `configYaml` takes precedence.

```yaml
config:
  config:
    adminAddr: 0.0.0.0:15000
    database:
      url: sqlite:///config/data.db
  binds:
  - port: 8080
    listeners: []
  - port: 8443
    listeners: []
```

```yaml
configYaml: |
  config:
    adminAddr: 0.0.0.0:15000
    database:
      url: sqlite:///config/data.db
  binds:
  - port: 8080
    listeners: []
  - port: 8443
    listeners: []
```

The chart does not overwrite an existing `/config/config.yaml` by default. To force Helm upgrades to rewrite the file from chart values, set `configBootstrap.overwrite=true`.

```sh
helm upgrade -i agentgateway-standalone \
  oci://cr.agentgateway.dev/charts/agentgateway-standalone \
  --namespace agentgateway-system \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
  -f values.yaml \
  --set configBootstrap.overwrite=true
```

### Customize gateway listener ports

The default gateway Service exposes port `80` to container port `8080`, port `443` to container port `8443`, port `3000` to container port `3000`, and port `4000` to container port `4000`. To replace these defaults with a custom set of Service ports for listeners that you create in the UI or in the Helm values file, set `gateway.service.ports`.

```yaml
gateway:
  service:
    ports:
    - name: custom-listener
      port: 9000
      targetPort: 9000
      protocol: TCP
```

You can also create additional Services for separate listener exposure.

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
      targetPort: 8080
      protocol: TCP
```

### Scale the deployment

The chart defaults to one replica with SQLite on a `ReadWriteOnce` volume. This is the simplest mode for a standalone deployment.

To run more than one replica, deploy your own PostgreSQL instance and use shared `ReadWriteMany` config storage, or provide an existing claim that supports `ReadWriteMany`.

```yaml
replicaCount: 2
strategy:
  type: RollingUpdate
persistence:
  storageClassName: efs-sc
  accessModes:
  - ReadWriteMany
database:
  type: postgres
  postgres:
    url: postgres://agw:secret@postgres.default.svc:5432/agw
```

### Use a private image registry

For air-gapped or private registry environments, set `global.imageRegistry` to rewrite both the agentgateway image and the config bootstrap image registry.

```yaml
global:
  imageRegistry: registry.internal.example.com
image:
  repository: platform/agentgateway
  tag: "{{< reuse "agw-docs/versions/n-patch.md" >}}"
configBootstrap:
  image:
    repository: library/busybox
    tag: "1.36"
```

## Upgrade

Upgrade the release by running `helm upgrade` with the new chart version.

```sh
helm upgrade -i agentgateway-standalone \
  oci://cr.agentgateway.dev/charts/agentgateway-standalone \
  --namespace agentgateway-system \
  --reuse-values \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
```

## Uninstall

Uninstall the Helm release.

```sh
helm uninstall agentgateway-standalone -n agentgateway-system
```

The uninstall command does not remove persistent volumes. To remove the default configuration PVC, delete it separately.

```sh
kubectl delete pvc agentgateway-standalone-config -n agentgateway-system
```
