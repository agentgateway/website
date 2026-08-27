
## Values

| Key | Type | Description |
|-----|------|-------------|
| affinity | object | Set affinity rules for pod scheduling, such as 'nodeAffinity:'.<br/><br/>The default value is `{}`. |
| agentgatewayModels | object | Configure the experimental AgentgatewayModel API.<br/><br/>The default value is `{"enabled":false}`. |
| agentgatewayModels.enabled | bool | Enable AgentgatewayModel support in the agentgateway controller.<br/><br/>The default value is `false`. |
| commonLabels | object | Additional labels to add to all resources created by the Helm chart.<br/><br/>The default value is `{}`. |
| controller | object | Configure the agentgateway control plane deployment.<br/><br/>The default value is `{"extraContainers":[],"extraEnv":{},"extraVolumeMounts":[],"extraVolumes":[],"horizontalPodAutoscaler":{},"image":{"pullPolicy":"","registry":"","repository":"controller","tag":""},"logLevel":"info","podDisruptionBudget":{},"priorityClassName":"","replicaCount":1,"revisionHistoryLimit":null,"service":{"allocateLoadBalancerNodePorts":null,"annotations":{},"clusterIP":"","clusterIPs":[],"enabled":true,"externalIPs":[],"externalName":"","externalTrafficPolicy":"","extraLabels":{},"healthCheckNodePort":null,"internalTrafficPolicy":"","ipFamilies":[],"ipFamilyPolicy":"","loadBalancerClass":"","loadBalancerIP":"","loadBalancerSourceRanges":[],"ports":{"agwGrpc":9978,"health":9093,"metrics":9092},"publishNotReadyAddresses":false,"sessionAffinity":"","sessionAffinityConfig":{},"trafficDistribution":"","type":"ClusterIP"},"strategy":{},"verticalPodAutoscaler":{},"xds":{"mode":"tls"}}`. |
| controller.extraContainers | list | Add extra sidecar containers to the controller pod.<br/><br/>The default value is `[]`. |
| controller.extraEnv | object | Add extra environment variables to the controller container. Supports either a direct scalar value: extraEnv:   LOG_FORMAT: json Or Kubernetes valueFrom sources: extraEnv:   API_TOKEN:     valueFrom:       secretKeyRef:         name: agentgateway-secrets         key: apiToken.<br/><br/>The default value is `{}`. |
| controller.extraVolumeMounts | list | Add extra volume mounts to the controller container.<br/><br/>The default value is `[]`. |
| controller.extraVolumes | list | Add extra volumes to the controller pod.<br/><br/>The default value is `[]`. |
| controller.horizontalPodAutoscaler | object | Set horizontal pod autoscaler for the controller. Note that this does not    affect the data plane. The scaleTargetRef is automatically configured to    target the controller deployment. E.g.:  horizontalPodAutoscaler:   minReplicas: 1   maxReplicas: 5   metrics:     - type: Resource       resource:         name: cpu         target:           type: Utilization           averageUtilization: 80.<br/><br/>The default value is `{}`. |
| controller.image | object | Configure the controller container image.<br/><br/>The default value is `{"pullPolicy":"","registry":"","repository":"controller","tag":""}`. |
| controller.image.pullPolicy | string | Set the image pull policy for the controller.<br/><br/>The default value is `""`. |
| controller.image.registry | string | Set the image registry for the controller.<br/><br/>The default value is `""`. |
| controller.image.repository | string | Set the image repository for the controller.<br/><br/>The default value is `"controller"`. |
| controller.image.tag | string | Set the image tag for the controller.<br/><br/>The default value is `""`. |
| controller.logLevel | string | Set the log level for the controller.<br/><br/>The default value is `"info"`. |
| controller.podDisruptionBudget | object | Set pod disruption budget for the controller. Note that this does not    affect the data plane. E.g.:  podDisruptionBudget:   minAvailable: 100%.<br/><br/>The default value is `{}`. |
| controller.priorityClassName | string | Set the priority class name for the controller pod.<br/><br/>The default value is `""`. |
| controller.replicaCount | int | Set the number of controller pod replicas.<br/><br/>The default value is `1`. |
| controller.revisionHistoryLimit | string | Set the number of old ReplicaSets the controller deployment retains for rollback. Leave unset to use the Kubernetes default of 10. '0' is honored and keeps no history.<br/><br/>The default value is `nil`. |
| controller.service | object | Configure the controller service.<br/><br/>The default value is `{"allocateLoadBalancerNodePorts":null,"annotations":{},"clusterIP":"","clusterIPs":[],"enabled":true,"externalIPs":[],"externalName":"","externalTrafficPolicy":"","extraLabels":{},"healthCheckNodePort":null,"internalTrafficPolicy":"","ipFamilies":[],"ipFamilyPolicy":"","loadBalancerClass":"","loadBalancerIP":"","loadBalancerSourceRanges":[],"ports":{"agwGrpc":9978,"health":9093,"metrics":9092},"publishNotReadyAddresses":false,"sessionAffinity":"","sessionAffinityConfig":{},"trafficDistribution":"","type":"ClusterIP"}`. |
| controller.service.allocateLoadBalancerNodePorts | string | Allocate load balancer node ports.<br/><br/>The default value is `nil`. |
| controller.service.annotations | object | Service annotations.<br/><br/>The default value is `{}`. |
| controller.service.clusterIP | string | Cluster IP address.<br/><br/>The default value is `""`. |
| controller.service.clusterIPs | list | Cluster IPs for dual-stack.<br/><br/>The default value is `[]`. |
| controller.service.enabled | bool | Create the controller Service.<br/><br/>The default value is `true`. |
| controller.service.externalIPs | list | External IP addresses.<br/><br/>The default value is `[]`. |
| controller.service.externalName | string | External name for ExternalName services.<br/><br/>The default value is `""`. |
| controller.service.externalTrafficPolicy | string | External traffic policy.<br/><br/>The default value is `""`. |
| controller.service.extraLabels | object | Extra labels for the Service.<br/><br/>The default value is `{}`. |
| controller.service.healthCheckNodePort | string | Health check node port.<br/><br/>The default value is `nil`. |
| controller.service.internalTrafficPolicy | string | Internal traffic policy.<br/><br/>The default value is `""`. |
| controller.service.ipFamilies | list | IP families.<br/><br/>The default value is `[]`. |
| controller.service.ipFamilyPolicy | string | IP family policy.<br/><br/>The default value is `""`. |
| controller.service.loadBalancerClass | string | Load balancer class.<br/><br/>The default value is `""`. |
| controller.service.loadBalancerIP | string | Load balancer IP address.<br/><br/>The default value is `""`. |
| controller.service.loadBalancerSourceRanges | list | Allowed source ranges for load balancer.<br/><br/>The default value is `[]`. |
| controller.service.ports | object | Service ports.<br/><br/>The default value is `{"agwGrpc":9978,"health":9093,"metrics":9092}`. |
| controller.service.publishNotReadyAddresses | bool | Publish not ready addresses.<br/><br/>The default value is `false`. |
| controller.service.sessionAffinity | string | Session affinity.<br/><br/>The default value is `""`. |
| controller.service.sessionAffinityConfig | object | Session affinity configuration.<br/><br/>The default value is `{}`. |
| controller.service.trafficDistribution | string | Traffic distribution.<br/><br/>The default value is `""`. |
| controller.service.type | string | Service type.<br/><br/>The default value is `"ClusterIP"`. |
| controller.strategy | object | Change the rollout strategy from the Kubernetes default of a RollingUpdate with 25% maxUnavailable, 25% maxSurge. E.g., to recreate pods, minimizing resources for the rollout but causing downtime: strategy:   type: Recreate E.g., to roll out as a RollingUpdate but with non-default parameters: strategy:   type: RollingUpdate   rollingUpdate:     maxSurge: 100%.<br/><br/>The default value is `{}`. |
| controller.verticalPodAutoscaler | object | Set vertical pod autoscaler for the controller. Note that this does not    affect the data plane. The targetRef is automatically configured to    target the controller deployment. E.g.:  verticalPodAutoscaler:   updatePolicy:     updateMode: Auto   resourcePolicy:     containerPolicies:       - containerName: "*"         minAllowed:           cpu: 100m           memory: 128Mi.<br/><br/>The default value is `{}`. |
| controller.xds | object | Configure xDS transport mode for the gRPC servers.<br/><br/>The default value is `{"mode":"tls"}`. |
| controller.xds.mode | string | One of: plaintext, tls, either.<br/><br/>The default value is `"tls"`. |
| controllerName | string | Value written to GatewayClass.spec.controllerName that this controller reconciles.    Leave empty to use the built-in default ("agentgateway.dev/agentgateway"). Sets AGW_CONTROLLER_NAME.    Change this together with gatewayClassName when running multiple agentgateway controllers.<br/><br/>The default value is `""`. |
| deploymentAnnotations | object | Add annotations to the agentgateway deployment.<br/><br/>The default value is `{}`. |
| discoveryNamespaceSelectors | list | List of namespace selectors (OR'ed): each entry can use 'matchLabels' or 'matchExpressions' (AND'ed within each entry if used together). Agentgateway includes the selected namespaces in config discovery. For more information, see the docs https://agentgateway.dev/docs/kubernetes/latest/install/advanced/#namespace-discovery.<br/><br/>The default value is `[]`. |
| dnsConfig | object | Set the pod DNS configuration, such as 'options: [{name: ndots, value: "3"}]'. Merged with the DNS settings the kubelet derives from the pod's dnsPolicy.<br/><br/>The default value is `{}`. |
| fullnameOverride | string | Override the full name of resources created by the Helm chart, which is 'agentgateway'. If you set 'fullnameOverride: "foo", the full name of the resources that the Helm release creates become 'foo', such as the deployment, service, and service account for the agentgateway control plane in the agentgateway-system namespace.<br/><br/>The default value is `""`. |
| gatewayClassName | string | Name of the primary GatewayClass the controller creates and manages.    Leave empty to use the built-in default ("agentgateway"). Sets AGW_AGENTGATEWAY_CLASS_NAME.<br/><br/>The default value is `""`. |
| gatewayClassParametersRefs | object | Map of GatewayClass names to GatewayParameters references that will be set on    the default GatewayClasses managed by kgateway. Each entry must define both the    name and namespace of the GatewayParameters resource.    The default GatewayClasses managed by kgateway are:    - agentgateway    Example:    gatewayClassParametersRefs:      agentgateway:        name: shared-gwp        namespace: kgateway-system.<br/><br/>The default value is `{}`. |
| image | object | Configure the default container image for the components that Helm deploys. You can override these settings for each particular component in that component's section, such as 'controller.image' for the agentgateway control plane. If you use your own private registry, make sure to include the imagePullSecrets.<br/><br/>The default value is `{"pullPolicy":"IfNotPresent","registry":"cr.agentgateway.dev","tag":""}`. |
| image.pullPolicy | string | Set the default image pull policy.<br/><br/>The default value is `"IfNotPresent"`. |
| image.registry | string | Set the default image registry.<br/><br/>The default value is `"cr.agentgateway.dev"`. |
| image.tag | string | Set the default image tag.<br/><br/>The default value is `""`. |
| imagePullSecrets | list | Set a list of image pull secrets for Kubernetes to use when pulling container images from your own private registry instead of the default agentgateway registry.<br/><br/>The default value is `[]`. |
| inferenceExtension | object | Configure the integration with the Gateway API Inference Extension project, which lets you use agentgateway to route to AI inference workloads like LLMs that run locally in your Kubernetes cluster. Documentation for Inference Extension can be found here: https://agentgateway.dev/docs/kubernetes/latest/inference/.<br/><br/>The default value is `{"enabled":false}`. |
| inferenceExtension.enabled | bool | Enable Inference Extension support in the agentgateway controller.<br/><br/>The default value is `false`. |
| istio | object | Control-plane-wide Istio mesh defaults.<br/><br/>The default value is `{"autoEnabled":false,"caAddress":"","clusterId":"","namespace":"","network":"","revision":""}`. |
| istio.autoEnabled | bool | Enable Istio integration by default on all built-in-class gateways.    When false (default), gateways opt in via AgentgatewayParameters spec.istio;    when true, individual gateways can opt out via spec.istio.enabled=false.<br/><br/>The default value is `false`. |
| istio.caAddress | string | Istio CA address override;    Defaults to "https://istiod.istio-system.svc:15012".<br/><br/>The default value is `""`. |
| istio.clusterId | string | Istio cluster ID (the istiod multiCluster clusterName) for mesh-integrated gateways.<br/><br/>The default value is `""`. |
| istio.namespace | string | Namespace where the Istio control plane the controller integrates with is installed.    Defaults to "istio-system".<br/><br/>The default value is `""`. |
| istio.network | string | Istio network for mesh-integrated gateways.<br/><br/>The default value is `""`. |
| istio.revision | string | Revision of the Istio control plane the controller integrates with.   If unset, the default revision is used.<br/><br/>The default value is `""`. |
| monitoring | object | Configure Prometheus and Grafana monitoring resources.<br/><br/>The default value is `{"enabled":false,"grafanaDashboard":{"enabled":true,"labels":{"grafana_dashboard":"1"}},"proxy":{"gatewayClassNames":["agentgateway"],"namespaceSelector":{},"podMonitor":{"enabled":true}},"serviceMonitor":{"enabled":true,"extraLabels":{},"interval":"15s"}}`. |
| monitoring.enabled | bool | Create monitoring resources (ServiceMonitors and Grafana dashboard ConfigMap). Requires the Prometheus Operator CRDs to be installed in the cluster.<br/><br/>The default value is `false`. |
| monitoring.grafanaDashboard.enabled | bool | Create the Grafana dashboard ConfigMap.<br/><br/>The default value is `true`. |
| monitoring.grafanaDashboard.labels | object | Labels that the Grafana sidecar uses to discover dashboards.<br/><br/>The default value is `{"grafana_dashboard":"1"}`. |
| monitoring.proxy.gatewayClassNames | list | GatewayClass names whose proxy pods are selected by the proxy PodMonitor.<br/><br/>The default value is `["agentgateway"]`. |
| monitoring.proxy.namespaceSelector | object | Namespace selector used by the proxy PodMonitor. Defaults to the release namespace only.<br/><br/>The default value is `{}`. |
| monitoring.proxy.podMonitor.enabled | bool | Create a PodMonitor that scrapes provisioned proxy pods on the pod's    metrics port (15020) directly, without requiring a metrics port on the    provisioned Service.<br/><br/>The default value is `true`. |
| monitoring.serviceMonitor.enabled | bool | Create the controller ServiceMonitor.<br/><br/>The default value is `true`. |
| monitoring.serviceMonitor.extraLabels | object | Additional labels to add to the controller ServiceMonitor and the proxy PodMonitor (e.g. release: prometheus).<br/><br/>The default value is `{}`. |
| monitoring.serviceMonitor.interval | string | Scrape interval for the controller ServiceMonitor and the proxy PodMonitor.<br/><br/>The default value is `"15s"`. |
| nameOverride | string | Add a name to the default Helm base release, which is 'agentgateway'. If you set 'nameOverride: "foo", the name of the resources that the Helm release creates become 'agentgateway-foo', such as the deployment, service, and service account for the agentgateway control plane in the agentgateway-system namespace.<br/><br/>The default value is `""`. |
| nodeSelector | object | Set node selector labels for pod scheduling, such as 'kubernetes.io/arch: amd64'.<br/><br/>The default value is `{}`. |
| podAnnotations | object | Add annotations to the agentgateway pods.<br/><br/>The default value is `{"prometheus.io/scrape":"true"}`. |
| podLabels | object | Add labels to the agentgateway pods. Useful for `NetworkPolicy` selectors (e.g. opt-in egress labels on Cilium-based clusters).<br/><br/>The default value is `{}`. |
| podSecurityContext | object | Set the pod-level security context. For example, 'fsGroup: 2000' sets the filesystem group to 2000.<br/><br/>The default value is `{}`. |
| proxy | object | Configure the agentgateway data plane deployment.<br/><br/>The default value is `{"image":{"registry":"","repository":"agentgateway","tag":""}}`. |
| proxy.image.registry | string | Set the default image registry. Set to override the global value.<br/><br/>The default value is `""`. |
| proxy.image.repository | string | Set the default image repository.<br/><br/>The default value is `"agentgateway"`. |
| proxy.image.tag | string | Set the default image tag.<br/><br/>The default value is `""`. |
| rbac | object | Configure the RBAC permissions created for the controller.<br/><br/>The default value is `{"gatewayNamespaces":[]}`. |
| rbac.gatewayNamespaces | list | Restrict namespaced write permissions to these namespaces. The namespaces must already exist. An empty list preserves the default cluster-wide write access. Cluster-wide read permissions and writes to cluster-scoped resources are unaffected. Restricting this list means only Gateways in these namespaces can be used.<br/><br/>The default value is `[]`. |
| resources | object | Configure resource requests and limits for the container, such as 'limits.cpu: 100m' or 'requests.memory: 128Mi'.<br/><br/>The default value is `{"requests":{"cpu":"100m","memory":"128Mi"}}`. |
| securityContext | object | Set the container-level security context, such as 'runAsNonRoot: true'.<br/><br/>The default value is `{}`. |
| serviceAccount | object | Configure the service account for the deployment.<br/><br/>The default value is `{"annotations":{},"create":true,"name":""}`. |
| serviceAccount.annotations | object | Add annotations to the service account.<br/><br/>The default value is `{}`. |
| serviceAccount.create | bool | Specify whether a service account should be created.<br/><br/>The default value is `true`. |
| serviceAccount.name | string | Set the name of the service account to use. If not set and create is true, a name is generated using the fullname template.<br/><br/>The default value is `""`. |
| tolerations | list | Set tolerations for pod scheduling, such as 'key: "nvidia.com/gpu"'.<br/><br/>The default value is `[]`. |
