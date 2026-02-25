---
title: Release notes
weight: 20
---

Review the release notes for agentgateway.


## 🔥 Breaking changes {#v22-breaking-changes}

{{< callout type="info">}}
For more details, review the [GitHub release notes in the kgateway repository](https://github.com/kgateway-dev/kgateway/releases/tag/v2.2.0).
{{< /callout >}}


## 🌟 New features {#v22-new-features}

The following features were introduced in 2.3.0.

### Autoscaling policies for agentgateway controller

You can now configure Horizontal Pod Autoscaler or Vertical Pod Autoscaler policies for the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane. To set up these policies, you use the `horizontalPodAutoscaler` or `verticalPodAutoscaler` fields in the Helm chart.  

Vertical Pod Autoscaler (VPA) is a Kubernetes component that automatically adjusts the CPU and memory reservations of your pods to match their actual usage. Horizontal Pod Autoscaler (HPA) on the other hand adds more instances of the pod to your environment when certain memory or CPU thresholds are reached. 

{{< callout type="info" >}}
Note that {{< reuse "agw-docs/snippets/kgateway.md" >}} uses leader election if multiple replicas are present. The elected leader's workload is typically larger than the workload of non-leader replicas and therefore drives the overall infrastructure cost. Because of that, Vertical Pod Autoscaling can be a reasonable solution to ensure that the elected leader has the resources it needs to perform its work successfully. In cases where the leader has a large workload, Horizontal Pod Autoscaling might not be as effective as it adds more replicas that do not reduce the workload of the elected leader. 
{{< /callout >}}

{{< callout type="warning" >}}
If you plan to set up both VPA and HPA policies, make sure to closely monitor performance and cost during scale up events. Using both policies can lead to conflict or even destructive loops that impact the performance of your control plane. 
{{< /callout >}}

Review the following Helm configuration examples. For more information, see [Advanced install settings]({{< link-hextra path="/install/advanced/" >}}). 

**Vertical Pod Autoscaler**: 

The following configuration ensures that the control plan pod is always assigned a minimum of 0.1 CPU cores (100millicores) and 128Mi of memory. 

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

**Horizontal Pod Autoscaler**:

Make sure to deploy the Kubernetes `metrics-server` in your cluster. The `metrics-server` retrieves metrics, such as CPU and memory consumption for your workloads. These metrics can be used by the HPA plug-in to determine if the pod must be scaled up or down.

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

### Priority class support for agentgateway controller

You can now assign a PriorityClassName to the control plane pods by using the Helm chart. [Priority](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/) indicates the importance of a pod relative to other pods. If a pod cannot be scheduled, the scheduler tries to preempt (evict) lower priority pods to make scheduling of the pending pod possible. 

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

<!-- 

### Use agw as a mesh egress

https://github.com/solo-io/gloo-gateway/pull/1454

### Multiple OAuth providers

https://github.com/solo-io/gloo-gateway/pull/1462

### GRPCRoute support

https://github.com/kgateway-dev/kgateway/pull/13293/changes#diff-781a8d153c4872696262e6b28d80b1523d7e76641c0817b1139b076346cbd24f

--> 

### Common labels

Add custom labels to all resources that are created by the {{< reuse "agw-docs/snippets/kgateway.md" >}} Helm charts, including the Deployment, Service, and ServiceAccount of gateway proxies. This allows you to better organize your resources or integrate with external tools. 

The following snippet adds the `label-key` and `agw-managed` labels to all resources. 

```yaml

commonLabels: 
  label-key: label-value
  agw-managed: "true"
```


### Static IP addresses for Gateways

You can now assign a static IP address to the Kubernetes service that exposes your Gateway as shown in the following example. 

```yaml
kind: Gateway
apiVersion: gateway.networking.k8s.io/v1
metadata:
  name: agentgateway-proxy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
  addresses:
    - type: IPAddress
      value: 203.0.113.11
  listeners:
    - protocol: HTTP
      port: 80
      name: http
      allowedRoutes:
        namespaces:
          from: Same
```

## 🗑️ Deprecated or removed features {#v22-removed-features}


