
## Values

| Key | Type | Description | Default |
|-----|------|-------------|---------|
| affinity | object | The affinity rules for scheduling the agentgateway proxy pod. | `{}` |
| commonLabels | object | Additional labels to add to all resources that the Helm chart creates. | `{}` |
| config | object | The standalone agentgateway configuration to serve, in the same format as a local agentgateway config file. The chart manages the 'config.storage' and 'config.database' sections for you based on the 'mode' value, so do not set them here. | `{}` |
| database.postgres.url | string | The PostgreSQL connection string that the the chart renders into the ConfigMap. Required in database mode. | `""` |
| dnsConfig | object | The DNS configuration for the agentgateway proxy pod, which is merged with the settings that the kubelet derives from the pod's dnsPolicy. For example, 'options: [{name: ndots, value: "3"}]'. | `{}` |
| extraContainers | list | Additional containers to run in the agentgateway proxy pod, such as a sidecar. | `[]` |
| extraEnv | list | Additional environment variables to set on the agentgateway proxy container. | `[]` |
| extraVolumeMounts | list | Additional volume mounts to add to the agentgateway proxy container. | `[]` |
| extraVolumes | list | Additional volumes to add to the agentgateway proxy pod. | `[]` |
| fullnameOverride | string | Override the full name of the resources that the Helm chart creates. | `""` |
| gateway.extraServices | list | Additional services that select the same agentgateway proxy pods, such as a separate service for the Admin UI. | `[]` |
| gateway.service.allocateLoadBalancerNodePorts | string | Allocate node ports for a load balancer service. | `nil` |
| gateway.service.annotations | object | Annotations to add to the gateway service. | `{}` |
| gateway.service.clusterIP | string | The cluster IP to assign to the gateway service. | `""` |
| gateway.service.clusterIPs | list | The list of cluster IPs to assign to the gateway service. | `[]` |
| gateway.service.enabled | bool | Create the primary Kubernetes service for the gateway listener, named after the Helm release. | `true` |
| gateway.service.externalIPs | list | The external IPs to route to the gateway service. | `[]` |
| gateway.service.externalName | string | The external name for a service of type ExternalName. | `""` |
| gateway.service.externalTrafficPolicy | string | Whether the gateway service routes external traffic to node-local or cluster-wide endpoints. | `""` |
| gateway.service.extraLabels | object | Additional labels to add to the gateway service. | `{}` |
| gateway.service.healthCheckNodePort | string | The node port for the load balancer's health check. | `nil` |
| gateway.service.internalTrafficPolicy | string | Whether the gateway service routes internal traffic to node-local or cluster-wide endpoints. | `""` |
| gateway.service.ipFamilies | list | The IP families to assign to the gateway service. | `[]` |
| gateway.service.ipFamilyPolicy | string | The IP family policy for the gateway service. | `""` |
| gateway.service.loadBalancerClass | string | The load balancer implementation class for the gateway service. | `""` |
| gateway.service.loadBalancerIP | string | The load balancer IP to request for the gateway service. | `""` |
| gateway.service.loadBalancerSourceRanges | list | The client IP ranges that are allowed to access the load balancer. | `[]` |
| gateway.service.ports | list | The ports to expose on the gateway service. Each target port must match a listener port in your agentgateway configuration. | `[{"name":"http","port":80,"protocol":"TCP","targetPort":4000}]` |
| gateway.service.publishNotReadyAddresses | bool | Send traffic to the gateway service's endpoints even when the pods are not ready. | `false` |
| gateway.service.sessionAffinity | string | The session affinity for the gateway service. | `""` |
| gateway.service.sessionAffinityConfig | object | The session affinity configuration for the gateway service. | `{}` |
| gateway.service.trafficDistribution | string | The traffic distribution preference for the gateway service, such as 'PreferClose'. | `""` |
| gateway.service.type | string | The type of the gateway service. | `"LoadBalancer"` |
| image.pullPolicy | string | The image pull policy for the agentgateway proxy image. | `"IfNotPresent"` |
| image.registry | string | The registry to pull the agentgateway proxy image from. | `"cr.agentgateway.dev"` |
| image.repository | string | The repository of the agentgateway proxy image. | `"agentgateway"` |
| image.tag | string | The tag of the agentgateway proxy image. If unset, the chart uses the chart's app version. | `""` |
| imagePullSecrets | list | Set a list of image pull secrets for Kubernetes to use when pulling the agentgateway container image from your own private registry instead of the default agentgateway registry. | `[]` |
| mode | string | How agentgateway persists its configuration. In 'readonly' mode, the chart serves the static configuration in the 'config' value from a read-only ConfigMap. In 'database' mode, the chart treats that configuration as a baseline and stores the changes that you make in the Admin UI in PostgreSQL. | `"readonly"` |
| monitoring.annotations | object | Annotations to add to the PodMonitor. | `{}` |
| monitoring.enabled | bool | Enable the integration to create a PodMonitor and expose the metrics container port | `false` |
| monitoring.extraLabels | object | Additional labels to add to the PodMonitor. | `{}` |
| monitoring.podMonitor.enabled | bool | Create the PodMonitor resource. | `true` |
| monitoring.podMonitor.interval | string | How often Prometheus scrapes the agentgateway proxy's metrics. | `"15s"` |
| nameOverride | string | Override the name to the Helm base release, which by default is 'agentgateway-standalone'. | `""` |
| namespaceOverride | string | Install the agentgateway resources in a different namespace than the Helm release namespace. | `""` |
| nodeSelector | object | The node labels that a node must have for the agentgateway proxy pod to be scheduled on it. | `{}` |
| oidc.cookieSecretName | string | The name of an existing secret that has the 'OIDC_COOKIE_SECRET' key. If unset, the chart references a '<release name>-oidc' secret as an optional secret. | `""` |
| podAnnotations | object | Annotations to add to the agentgateway proxy pod. The defaults let Prometheus scrape the proxy's metrics endpoint. | `{"prometheus.io/path":"/metrics","prometheus.io/port":"15020","prometheus.io/scrape":"true"}` |
| podLabels | object | Labels to add to the agentgateway proxy pod. | `{}` |
| podSecurityContext | object | The pod-level security context for the agentgateway proxy pod. | `{}` |
| replicaCount | int | The number of agentgateway proxy pods to run. Both storage modes support multiple replicas. | `1` |
| resources | object | The compute resource requests and limits for the agentgateway proxy container. | `{"requests":{"cpu":"100m","memory":"128Mi"}}` |
| revisionHistoryLimit | string | The number of old ReplicaSets to retain so that you can roll back a Deployment. If unset, Kubernetes defaults to 10. Set to 0 to keep no history. | `nil` |
| securityContext | object | The container-level security context for the agentgateway proxy container. | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true,"runAsNonRoot":true}` |
| serviceAccount.annotations | object | Annotations to add to the service account. Use these annotations to bind a cloud IAM role to the pod, such as 'eks.amazonaws.com/role-arn' for IAM roles for service accounts (IRSA) on Amazon EKS, or 'iam.gke.io/gcp-service-account' for Workload Identity on Google GKE. | `{}` |
| serviceAccount.create | bool | Create a service account for the agentgateway proxy pod. The proxy needs no Kubernetes API permissions, so this service account is only a pod identity, such as for binding a cloud IAM role or attaching image pull secrets. Set to false to use a service account that you manage outside the chart, such as when your cluster policy does not allow Helm releases to create identities, and set 'name' to that service account. | `true` |
| serviceAccount.name | string | The name of the service account. If 'create' is true, this value names the service account that the chart creates, and defaults to the name of the Helm release. If 'create' is false, this value must name a service account that already exists in the release namespace, because the chart does not create one. Note that if 'create' is false and you leave this value unset, the pod runs with the namespace's 'default' service account. | `""` |
| strategy | object | Override the Kubernetes Deployment strategy for the agentgateway proxy. | `{}` |
| tolerations | list | The tolerations to apply to the agentgateway proxy pod. | `[]` |
