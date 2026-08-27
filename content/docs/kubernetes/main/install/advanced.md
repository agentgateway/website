---
title: Advanced settings
weight: 70
description: Install agentgateway and related components.
test: skip
---

{{< reuse "agw-docs/pages/install/advanced.md" >}}

## Autoscaling

You can configure Horizontal Pod Autoscaler or Vertical Pod Autoscaler policies for the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane. To set up these policies, you use the `horizontalPodAutoscaler` or `verticalPodAutoscaler` fields in the Helm chart.

> [!NOTE]
> Note that {{< reuse "agw-docs/snippets/kgateway.md" >}} uses leader election if multiple replicas are present. The elected leader's workload is typically larger than the workload of non-leader replicas and therefore drives the overall infrastructure cost. Because of that, Vertical Pod Autoscaling can be a reasonable solution to ensure that the elected leader has the resources it needs to perform its work successfully. In cases where the leader has a large workload, Horizontal Pod Autoscaling might not be as effective as it adds more replicas that do not reduce the workload of the elected leader. 

> [!WARNING]
> If you plan to set up both VPA and HPA policies, make sure to closely monitor performance and cost during scale up events. Using both policies can lead to conflict or even destructive loops that impact the performance of your control plane. 


### Vertical Pod Autoscaler (VPA)

Vertical Pod Autoscaler (VPA) is a Kubernetes component that automatically adjusts the CPU and memory reservations of your pods to match their actual usage. 

The following Helm configuration ensures that the control plane pod is always assigned a minimum of 0.1 CPU cores (100millicores) and 128Mi of memory. 

```yaml

verticalPodAutoscaler:
  updatePolicy:
    updateMode: Auto
  resourcePolicy:
    containerPolicies:
    - containerName: "*"
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

### Horizontal Pod Autoscaler (HPA)

Horizontal Pod Autoscaler (HPA) adds more instances of the pod to your environment when certain memory or CPU thresholds are reached. 

In the following example, you want to have 1 control plane replica running at any given time. If the CPU utilization averages 80%, you want to gradually scale up your replicas. You can have a maximum of 5 replicas at any given time. 
```yaml

horizontalPodAutoscaler:
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
```


**Note**: To monitor the memory and CPU threshold, you need to deploy the Kubernetes `metrics-server` in your cluster. The `metrics-server` retrieves metrics, such as CPU and memory consumption for your workloads. 

You can install the server with the following command: 
```sh
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system patch deployment metrics-server \
 --type=json \
 -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

Then, start monitoring CPU and memory consumption with the `kubectl top pod` command. 

## PriorityClass 

You can assign a PriorityClassName to the control plane pods by using the Helm chart. [Priority](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/) indicates the importance of a pod relative to other pods. If a pod cannot be scheduled, the scheduler tries to preempt (evict) lower priority pods to make scheduling of the pending pod possible. 

To assign a PriorityClassName to the control plane, you must first create a PriorityClass resource. The following example creates a PriorityClass with the name `system-cluster-critical` that assigns a priority of 1 Million. 

```yaml
kubectl apply -f- <<EOF
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: system-cluster-critical
value: 1000000
globalDefault: false
description: "Use this priority class on system-critical pods only."
EOF
```

In your Helm values file, add the name of the PriorityClass in the `controller.priorityClassName` field. 

```yaml
controller:
  priorityClassName: 
```


## Common labels

Add custom labels to all resources that are created by the {{< reuse "agw-docs/snippets/kgateway.md" >}} Helm charts, including the Deployment, Service, ServiceAccount, and ClusterRoles. This allows you to better organize your resources or integrate with external tooling. 

The following snippet adds the `label-key` and `agw-managed` labels to all resources. 

```yaml

commonLabels: 
  label-key: label-value
  agw-managed: "true"
```

## PodDisruptionBudget

Configure a Pod Disruption Budget to ensure that a minimum number of control plane instances are up and running at any given time during voluntary disruptions, such as upgrades. In this example, 50% of your control plane instances must be running.

```yaml
controller:
  podDisruptionBudget:
    minAvailable: 50%
```

## Namespace-scoped write permissions {#rbac-gateway-namespaces}

By default, the controller holds cluster-wide write permissions for the objects that it provisions for a Gateway. To restrict those writes to the namespaces that hold your Gateways, set `rbac.gatewayNamespaces` in the controller Helm chart.

```yaml
rbac:
  gatewayNamespaces:
  - gateway-system
  - team-a
```

The chart then creates a RoleBinding in each listed namespace, instead of the single ClusterRoleBinding that it creates otherwise. Each RoleBinding grants the controller's service account the `agentgateway-<controller-namespace>-deployer` ClusterRole, where `<controller-namespace>` is the namespace that you install the controller in. The chart creates no Role, so audit the ClusterRole to see the permissions and the RoleBindings to see where they apply.

That ClusterRole grants `create`, `delete`, `patch`, and `update` on the objects that the controller provisions for a Gateway, which are ConfigMaps, Secrets, Services, ServiceAccounts, Deployments, DaemonSets, HorizontalPodAutoscalers, and PodDisruptionBudgets. It also grants `create` and `patch` on Events. The cluster-wide role keeps read access to those objects.

Review the following constraints before you set the field.

| Constraint | Detail |
| -- | -- |
| Only listed namespaces can hold a Gateway | The controller cannot provision a Gateway in a namespace that the list omits. |
| The namespaces must already exist | The chart does not create them. |
| The default is an empty `rbac.gatewayNamespaces` list | An empty list keeps the cluster-wide write access, so an upgrade does not change permissions on its own. |
| Events are scoped too | The controller publishes a warning Event on a Gateway when a proxy rejects its xDS configuration. After you set the field, the controller can create those Events in the listed namespaces only. |
| Cluster-scoped access is unaffected | Cluster-wide read permissions, and writes to cluster-scoped resources such as GatewayClass and status subresources, do not change. |

For the full list of chart values, see the [Helm reference]({{< link-hextra path="/reference/helm/" >}}).

