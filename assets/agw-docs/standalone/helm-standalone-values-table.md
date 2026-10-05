{{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [Helm reference docs]({{< link-hextra path="/reference/helm/" >}}).

| Value | Use |
| --- | --- |
| `replicaCount` | Run more than one proxy pod. |{{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
| `podDisruptionBudget.enabled`, `podDisruptionBudget.minAvailable`, `podDisruptionBudget.maxUnavailable`, `podDisruptionBudget.unhealthyPodEvictionPolicy` | Create a PodDisruptionBudget for multi-replica proxy deployments. Set `replicaCount` greater than `1`, or `autoscaling.minReplicas` greater than `1` when `autoscaling.enabled` is `true`. The chart skips the PodDisruptionBudget for one replica.{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}} When you set `podDisruptionBudget.maxUnavailable` to a non-zero number or non-empty string, the chart renders `spec.maxUnavailable` and omits `spec.minAvailable`.{{< /version >}} |{{< /version >}}
| `monitoring.enabled` | Create a PodMonitor and expose the metrics port for Prometheus Operator. |
| `extraEnv`, `extraVolumes`, `extraVolumeMounts`, `extraContainers` | Add environment variables, mount secrets, or run sidecars. |
| `imagePullSecrets` | Pull the proxy image from a private registry. |
| `image.registry`, `image.repository`, `image.tag` | Pull the proxy image from another registry, such as an internal mirror. |
