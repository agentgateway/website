
## Values

| Key | Type | Description |
|-----|------|-------------|
| affinity | object | The affinity rules for scheduling the agentgateway proxy pod.<br/><br/>The default value is `{}`. |
| commonLabels | object | Additional labels to add to all resources that the Helm chart creates.<br/><br/>The default value is `{}`. |
| config | object | The standalone agentgateway configuration to serve, in the same format as a local agentgateway config file. Changes outside the nested 'config' section, plus 'config.modelCatalog', are applied without restarting the pods. Changes to other nested 'config' settings restart the pods because agentgateway reads them only at startup. The chart manages the 'config.storage' and 'config.database' sections for you based on the 'mode' value, so do not set them here.<br/><br/>The default value is `{}`. |
| database.postgres.url | string | The PostgreSQL connection string that the the chart renders into the ConfigMap. Required in database mode.<br/><br/>The default value is `""`. |
| dnsConfig | object | The DNS configuration for the agentgateway proxy pod, which is merged with the settings that the kubelet derives from the pod's dnsPolicy. For example, 'options: [{name: ndots, value: "3"}]'.<br/><br/>The default value is `{}`. |
| extraContainers | list | Additional containers to run in the agentgateway proxy pod, such as a sidecar.<br/><br/>The default value is `[]`. |
| extraEnv | list | Additional environment variables to set on the agentgateway proxy container.<br/><br/>The default value is `[]`. |
| extraVolumeMounts | list | Additional volume mounts to add to the agentgateway proxy container.<br/><br/>The default value is `[]`. |
| extraVolumes | list | Additional volumes to add to the agentgateway proxy pod.<br/><br/>The default value is `[]`. |
| fullnameOverride | string | Override the full name of the resources that the Helm chart creates.<br/><br/>The default value is `""`. |
| gateway.extraServices | list | Additional services that select the same agentgateway proxy pods, such as a separate service for the Admin UI.<br/><br/>The default value is `[]`. |
| gateway.service.allocateLoadBalancerNodePorts | string | Allocate node ports for a load balancer service.<br/><br/>The default value is `nil`. |
| gateway.service.annotations | object | Annotations to add to the gateway service.<br/><br/>The default value is `{}`. |
| gateway.service.clusterIP | string | The cluster IP to assign to the gateway service.<br/><br/>The default value is `""`. |
| gateway.service.clusterIPs | list | The list of cluster IPs to assign to the gateway service.<br/><br/>The default value is `[]`. |
| gateway.service.enabled | bool | Create the primary Kubernetes service for the gateway listener, named after the Helm release.<br/><br/>The default value is `true`. |
| gateway.service.externalIPs | list | The external IPs to route to the gateway service.<br/><br/>The default value is `[]`. |
| gateway.service.externalName | string | The external name for a service of type ExternalName.<br/><br/>The default value is `""`. |
| gateway.service.externalTrafficPolicy | string | Whether the gateway service routes external traffic to node-local or cluster-wide endpoints.<br/><br/>The default value is `""`. |
| gateway.service.extraLabels | object | Additional labels to add to the gateway service.<br/><br/>The default value is `{}`. |
| gateway.service.healthCheckNodePort | string | The node port for the load balancer's health check.<br/><br/>The default value is `nil`. |
| gateway.service.internalTrafficPolicy | string | Whether the gateway service routes internal traffic to node-local or cluster-wide endpoints.<br/><br/>The default value is `""`. |
| gateway.service.ipFamilies | list | The IP families to assign to the gateway service.<br/><br/>The default value is `[]`. |
| gateway.service.ipFamilyPolicy | string | The IP family policy for the gateway service.<br/><br/>The default value is `""`. |
| gateway.service.loadBalancerClass | string | The load balancer implementation class for the gateway service.<br/><br/>The default value is `""`. |
| gateway.service.loadBalancerIP | string | The load balancer IP to request for the gateway service.<br/><br/>The default value is `""`. |
| gateway.service.loadBalancerSourceRanges | list | The client IP ranges that are allowed to access the load balancer.<br/><br/>The default value is `[]`. |
| gateway.service.ports | list | The ports to expose on the gateway service. Each target port must match a listener port in your agentgateway configuration.<br/><br/>The default value is `[{"name":"http","port":80,"protocol":"TCP","targetPort":4000}]`. |
| gateway.service.publishNotReadyAddresses | bool | Send traffic to the gateway service's endpoints even when the pods are not ready.<br/><br/>The default value is `false`. |
| gateway.service.sessionAffinity | string | The session affinity for the gateway service.<br/><br/>The default value is `""`. |
| gateway.service.sessionAffinityConfig | object | The session affinity configuration for the gateway service.<br/><br/>The default value is `{}`. |
| gateway.service.trafficDistribution | string | The traffic distribution preference for the gateway service, such as 'PreferClose'.<br/><br/>The default value is `""`. |
| gateway.service.type | string | The type of the gateway service.<br/><br/>The default value is `"LoadBalancer"`. |
| image.pullPolicy | string | The image pull policy for the agentgateway proxy image.<br/><br/>The default value is `"IfNotPresent"`. |
| image.registry | string | The registry to pull the agentgateway proxy image from.<br/><br/>The default value is `"cr.agentgateway.dev"`. |
| image.repository | string | The repository of the agentgateway proxy image.<br/><br/>The default value is `"agentgateway"`. |
| image.tag | string | The tag of the agentgateway proxy image. If unset, the chart uses the chart's app version.<br/><br/>The default value is `""`. |
| imagePullSecrets | list | Set a list of image pull secrets for Kubernetes to use when pulling the agentgateway container image from your own private registry instead of the default agentgateway registry.<br/><br/>The default value is `[]`. |
| mode | string | How agentgateway persists its configuration. In 'readonly' mode, the chart serves the static configuration in the 'config' value from a read-only ConfigMap. In 'database' mode, the chart treats that configuration as a baseline and stores the changes that you make in the Admin UI in PostgreSQL.<br/><br/>The default value is `"readonly"`. |
| monitoring.annotations | object | Annotations to add to the PodMonitor.<br/><br/>The default value is `{}`. |
| monitoring.enabled | bool | Enable the integration to create a PodMonitor and expose the metrics container port.<br/><br/>The default value is `false`. |
| monitoring.extraLabels | object | Additional labels to add to the PodMonitor.<br/><br/>The default value is `{}`. |
| monitoring.podMonitor.enabled | bool | Create the PodMonitor resource.<br/><br/>The default value is `true`. |
| monitoring.podMonitor.interval | string | How often Prometheus scrapes the agentgateway proxy's metrics.<br/><br/>The default value is `"15s"`. |
| nameOverride | string | Override the name to the Helm base release, which by default is 'agentgateway-standalone'.<br/><br/>The default value is `""`. |
| namespaceOverride | string | Install the agentgateway resources in a different namespace than the Helm release namespace.<br/><br/>The default value is `""`. |
| nodeSelector | object | The node labels that a node must have for the agentgateway proxy pod to be scheduled on it.<br/><br/>The default value is `{}`. |
| oidc.cookieSecretName | string | The name of an existing secret that has the 'OIDC_COOKIE_SECRET' key. If unset, the chart references a '<release name>-oidc' secret as an optional secret.<br/><br/>The default value is `""`. |
| podAnnotations | object | Annotations to add to the agentgateway proxy pod. The defaults let Prometheus scrape the proxy's metrics endpoint.<br/><br/>The default value is `{"prometheus.io/path":"/metrics","prometheus.io/port":"15020","prometheus.io/scrape":"true"}`. |
| podLabels | object | Labels to add to the agentgateway proxy pod.<br/><br/>The default value is `{}`. |
| podSecurityContext | object | The pod-level security context for the agentgateway proxy pod.<br/><br/>The default value is `{}`. |
| replicaCount | int | The number of agentgateway proxy pods to run. Both storage modes support multiple replicas.<br/><br/>The default value is `1`. |
| resources | object | The compute resource requests and limits for the agentgateway proxy container.<br/><br/>The default value is `{"requests":{"cpu":"100m","memory":"128Mi"}}`. |
| revisionHistoryLimit | string | The number of old ReplicaSets to retain so that you can roll back a Deployment. If unset, Kubernetes defaults to 10. Set to 0 to keep no history.<br/><br/>The default value is `nil`. |
| securityContext | object | The container-level security context for the agentgateway proxy container.<br/><br/>The default value is `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true,"runAsNonRoot":true}`. |
| serviceAccount.annotations | object | Annotations to add to the service account. Use these annotations to bind a cloud IAM role to the pod, such as 'eks.amazonaws.com/role-arn' for IAM roles for service accounts (IRSA) on Amazon EKS, or 'iam.gke.io/gcp-service-account' for Workload Identity on Google GKE.<br/><br/>The default value is `{}`. |
| serviceAccount.create | bool | Create a service account for the agentgateway proxy pod. The proxy needs no Kubernetes API permissions, so this service account is only a pod identity, such as for binding a cloud IAM role or attaching image pull secrets. Set to false to use a service account that you manage outside the chart, such as when your cluster policy does not allow Helm releases to create identities, and set 'name' to that service account.<br/><br/>The default value is `true`. |
| serviceAccount.name | string | The name of the service account. If 'create' is true, this value names the service account that the chart creates, and defaults to the name of the Helm release. If 'create' is false, this value must name a service account that already exists in the release namespace, because the chart does not create one. Note that if 'create' is false and you leave this value unset, the pod runs with the namespace's 'default' service account.<br/><br/>The default value is `""`. |
| strategy | object | Override the Kubernetes Deployment strategy for the agentgateway proxy.<br/><br/>The default value is `{}`. |
| tolerations | list | The tolerations to apply to the agentgateway proxy pod.<br/><br/>The default value is `[]`. |
