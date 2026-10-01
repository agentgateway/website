{{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [Helm reference docs]({{< link-hextra path="/reference/helm/" >}}).

| Value | Use |
| --- | --- |
| `replicaCount` | Run more than one proxy pod. |{{< version exclude-if="1.5.x" >}}
| `podDisruptionBudget.enabled`, `podDisruptionBudget.minAvailable`, `podDisruptionBudget.maxUnavailable`, `podDisruptionBudget.unhealthyPodEvictionPolicy` | Create a PodDisruptionBudget for multi-replica proxy deployments. Set `replicaCount` greater than `1`. The chart skips the PodDisruptionBudget for one replica. |{{< /version >}}
| `monitoring.enabled` | Create a PodMonitor and expose the metrics port for Prometheus Operator. |
| `extraEnv`, `extraVolumes`, `extraVolumeMounts`, `extraContainers` | Add environment variables, mount secrets, or run sidecars. |
| `imagePullSecrets` | Pull the proxy image from a private registry. |
| `image.registry`, `image.repository`, `image.tag` | Pull the proxy image from another registry, such as an internal mirror. |
