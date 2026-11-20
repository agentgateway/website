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

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
### Use an existing session key Secret {#helm-session-secret}

Agentgateway encrypts the MCP session IDs that it issues to clients with an AES-256-GCM session key. When you do not set a key, what happens depends on the chart's `mode` value.

* In `database` mode, agentgateway generates a key at startup and stores it in PostgreSQL, so every replica uses the same key.
* In the default `readonly` mode, agentgateway cannot save a generated key to the read-only ConfigMap, so session IDs are encoded but not encrypted. The proxy logs `failed to write generated session key` and `no session key configured; MCP session IDs are not encrypted` at startup.

Set `session.secretName` to read the key from an existing Kubernetes Secret instead of writing it into `config.session.key`, which the chart stores in a ConfigMap. The chart passes the Secret's `key` entry to the proxy container as the `SESSION_KEY` environment variable. `SESSION_KEY` takes precedence over `config.session.key` and over a key that agentgateway generates. For more information, see [Session key]({{< link-hextra path="/integrations/mcp/servers/http/#session-key" >}}).

> [!NOTE]
> Every proxy replica reads the same Secret, so any replica can decrypt a session ID that another replica issued. When you change the key, including when you set a Secret on a release that used a generated key or no key, agentgateway returns `404 Not Found` for session IDs that were encrypted with the old key and MCP clients must start a new session.

1. Create a Secret with a `key` entry. The key must be 32 random bytes encoded as 64 hexadecimal characters. If the value has any other length or format, the proxy fails to start.

   ```sh
   kubectl create secret generic agentgateway-session-key \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=key="$(openssl rand -hex 32)"
   ```

2. Upgrade the Helm release and set `session.secretName` to the Secret name.

   ```sh
   helm upgrade {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --reuse-values \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --set session.secretName=agentgateway-session-key
   ```

   | Value | Description |
   | --- | --- |
   | `session.secretName` | Name of an existing Secret in the same namespace as the proxy Deployment. The Secret must contain a `key` entry. Omit this value to leave `SESSION_KEY` unset. |

3. Wait for the rollout to finish. If the rollout does not finish, check the proxy logs for `invalid session persistence key SESSION_KEY`, which means the key is not 64 hexadecimal characters.

   ```sh
   kubectl rollout status deployment/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

4. Verify that the Deployment reads the Secret.

   ```sh
   kubectl get deployment {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.spec.template.spec.containers[*].env[?(@.name=="SESSION_KEY")].valueFrom.secretKeyRef.name}'
   ```

   Expected output:

   ```txt
   agentgateway-session-key
   ```

{{< /version >}}
