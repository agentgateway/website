{{< reuse "agw-docs/snippets/review-table.md" >}}{{< version exclude-if="1.4.x" >}} For more information, see the [Helm reference docs]({{< link-hextra path="/reference/helm/" >}}).{{< /version >}}

| Value | Use |
| --- | --- |
| `replicaCount` | Run more than one proxy pod. |
| `monitoring.enabled` | Create a PodMonitor and expose the metrics port for Prometheus Operator. |
| `extraEnv`, `extraVolumes`, `extraVolumeMounts`, `extraContainers` | Add environment variables, mount secrets, or run sidecars. |
| `imagePullSecrets` | Pull the proxy image from a private registry. |
| `image.registry`, `image.repository`, `image.tag` | Pull the proxy image from another registry, such as an internal mirror. |
