---
title: Customization options
weight: 10
description:
---

In upstream agentgateway, you can manage [configuration](https://agentgateway.dev/docs/configuration/overview/) via a YAML or JSON file. The configuration features of agentgateway are captured in the [schema of the agentgateway codebase](https://github.com/agentgateway/agentgateway/tree/main/schema). 

Unlike in the upstream agentgateway project, you do not configure these features in a raw configuration file when running agentgateway on Kubernetes. Instead, you configure them in a Kubernetes Gateway API-native way as explained in the guides throughout this doc set. 

You can choose between the following options to provide custom configuration to your agentgateway proxy.

* [Built-in config options in {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} CRD (recommended)](#built-in) 
* [Overlays (strategic merge patch)](#overlays) 
* [Raw upstream config](#raw-config)

## Built-in customization (recommended) {#built-in}

The {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource comes with built-in customization options that you can use to change certain aspects of your agentgateway proxy, such as the image that you use, logging configuration, resource limits and requests, or environment variables. These built-in config options are automatically validated when you create the agentgateway proxy from your {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. 

Review the built-in configurations that are provided via the [{{< reuse "agw-docs/snippets/gatewayparameters.md" >}}]({{< link-hextra path="/reference/api/#agentgatewayparameters" >}}) resource. 

| Built-in customization | Description | 
| -- | -- | 
| `env` | Add custom environment variables to your agentgateway proxy deployment. To remove a default environment variable, set its value to `null`.  | 
| `image` | Provide a custom image for the agentgateway proxy. This setting is useful if you deploy your proxy in an airgapped environment.  | 
| `logging` | Change the log level and format of the agentgateway proxy logs.   | 
| `resources` | Set resource limits and requests. For more information, see the [Kubernetes documentation](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/). | 

{{< callout type="info" >}}
Because the built-in customization options are provided by the agentgateway API, they are considered stable and do not change between upgrades. 
{{< /callout >}}

To find common configuration examples, [Example configs]({{< link-hextra path="/setup/customize/configs/" >}}). 

To change configuration that is not exposed via the built-in options, use [overlays](#overlays) instead, or [add raw upstream agentgateway configuration](#raw-config) to your proxies. 


## Overlays

For advanced customization of the Kubernetes resources that the agentgateway control plane generates, such as Deployments, Services, ServiceAccounts, you can configure overlays in the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. Overlays use [Kubernetes strategic merge patch (SMP)](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-api-machinery/strategic-merge-patch.md) semantics to modify the generated resources after they are rendered. For additional examples, see the [kubectl patch documentation](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/update-api-object-kubectl-patch/#use-a-strategic-merge-patch-to-update-a-deployment).

You can overlay the following resource types in the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} spec:

| Field | Resource Type | Description |
|-------|--------------|-------------|
| `deployment` | Deployment | The agentgateway proxy deployment. Common use casese include adding image pull secrets to pull images from private registries, removing default security contexts, configuring node selectors, affinities, and tolerations, adding custom labels and annotations, or mounting custom ConfigMaps or Secrets as volumes.   |
| `service` | Service | The service that exposes the agentgateway proxy. A common use case is configuring cloud provider-specific service annotations.  |
| `serviceAccount` | ServiceAccount | The service account for the proxy pods |
| `horizontalPodAutoscaler` | HorizontalPodAutoscaler (HPA) | Unlike Deployment, Service, and ServiceAccount, HPA are created **only** when an overlay is specified.|
| `podDisruptionBudget` | PodDisruptionBudget (PBD) | Unlike Deployment, Service, and ServiceAccount, PDBs are created **only** when an overlay is specified. |

### How overlays work

Overlays are applied **after** the control plane renders the base Kubernetes resources. The control plane runs through the following steps: 

1. The control plane reads built-in customization options from the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, such as `image`, `logging`, and `resources`. 
2. The control plane generates the base resources for the agentgateway proxy, including the Deployment, Service, and ServiceAccount.
3. The control plane applies any overlays that you specified in the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource.
4. The control plane creates or updates the resources in the cluster. 

{{< callout context="warning" >}}
Unlike the built-in customization options, overlays are **not validated** by the agentgateway control plane when you create the Gateway. Instead, the resulting resources, such as the Deployment is validated by Kubernetes when the Deployment is created or updated. 

Keep in mind that the overlay API is **not stable** and might change between Kubernetes versions, which can lead to breaking changes or unexpected behaviors. Make sure to test your overlay configurations thoroughly after each upgrade and use these configurations only if the customization cannot be achieved with the built-in option. 
{{< /callout >}}

### Remove or replace config

You can use overlays to also remove configuration from your resources, such as the pod security context when working in OpenShift environments. To remove configuration, the strategic merge patch allows the following methods: 

**Set field value to null**

Set a field to a `null` value. This option is best to removing scalar values and simple objects. 

The following example snippet sets the `securityContext` field in the container template to `null`. Note that you must use the `kubectl apply --server-side` command to apply the change and set the field to `null`. If you do not use the `--server-side` option, the `null` value is silently dropped when you apply the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. 

```yaml
spec:
  deployment:
    spec:
      template:
        spec:
          containers:
            - name: agentgateway
              # Removes the securityContext entirely
              securityContext: null
```

**Remove an entire field**

To remove an entire object, such as when setting the field to `null` is not an option, use the `$patch: delete` method instead.

The following example snippets removes the `securityContext` field from the deployment template. 

```yaml
spec:
  deployment:
    spec:
      template:
        spec:
          # Removes the pod-level securityContext
          securityContext:
            $patch: delete
```


## Raw config

For configuration that is not exposed via the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}'s built-in or overlay configuration options, or if you prefer to pass in raw upstream configuration, such as to migrate more easily from the agentgateway standalone binary to agentgateway on Kubernetes, you can use the `rawConfig` option in the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. 

To find the configuration that you want to apply, review [Configuration](https://agentgateway.dev/docs/local/latest/configuration/) in the standalone agentgateway binary docs. 

{{< callout context="warning">}}
Note that raw configuration is not automatically validated. If configuration is malformatted or includes unsupported fields, the agentgateway proxy does not start. You can run `kubectl logs deploy/agentgateway-proxy -n agentgateway-system` to view the logs of the proxy and find more information about why the configuration could not be applied. 
{{< /callout >}}

For a setup example, see [Customize the gateway]({{< link-hextra path="/setup/customize/customize/#rawconfig" >}}). 


## Configuration priority and precedence

You can attach an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource to either a GatewayClass that is shared by all Gateways that use that class, or to an individual Gateway. When the resource is applied to both, they are processed in the following order:

1. **Built-in configuration in the GatewayClass is applied first** - This includes settings, such as `image`, `logging`, `resources`, and `env`. 
2. **Built-in configuration in the Gateway overrides GatewayClass settings** - If conflicting built-in configuration is specified on the Gateway, the GatewayClass configuration is overridden.  
3. **Overlay configuration in GatewayClass** - After all built-in configuration is processed, overlay configuration that is defined on the GatewayClass is applied and might modify the rendered resources. 
4. **Overlay configuration in Gateway overrides GatewayClass settings** - If conflicting overlay configuration is specified on the Gateway, the GatewayClass is overridden by using strategic merge patch semantics. Consider the following examples: 
   - For scalar values, such as `replicas`, the Gateway configuration takes precedence
   - For maps, such as `labels`, the label keys are merged. If both the Gateway and GatewayClass specify the same label key, the label key on the Gateway takes precedence.  


**Example:**

Consider the following GatewayClass configuration:
```yaml
spec:
  deployment:
    spec:
      replicas: 3
      template:
        spec:
          containers:
            - name: agentgateway
              resources:
                limits:
                  memory: 512Mi
```

Consider the following Gateway configuration:
```yaml
spec:
  deployment:
    spec:
      replicas: 5
      template:
        spec:
          containers:
            - name: agentgateway
              resources:
                limits:
                  cpu: 500m
```

The resulting configuration merges both configurations as follows:
- `replicas: 5` - Gateway configuration takes precedence
- `memory: 512Mi` - GatewayClass setting is preserved
- `cpu: 500m` - Gateway setting is added