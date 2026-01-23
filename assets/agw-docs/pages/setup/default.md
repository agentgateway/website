Learn about the different {{< reuse "agw-docs/snippets/kgateway.md" >}} and Kubernetes resources that make up your gateway proxy deployment.

## GatewayClass

The GatewayClass is a {{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}}-native resource that defines the controller that spins up and configures gateway proxies in your environment. 

When you install {{< reuse "agw-docs/snippets/kgateway.md" >}}, the following GatewayClass resources are automatically created with the following configuration. 

{{< reuse "agw-docs/snippets/class-setup.md" >}}

## Gateway proxy template

When you create a Gateway resource, a default gateway proxy template for [agentgateway](https://github.com/kgateway-dev/kgateway/blob/{{< reuse "agw-docs/versions/github-branch.md" >}}/pkg/kgateway/helm/agentgateway/templates/deployment.yaml) proxies is used to automatically spin up and bootstrap a gateway proxy deployment and service in your cluster. The template includes agentgateway configuration that binds the gateway proxy deployment to the Gateway resource that you created. In addition, the settings in the [{{< reuse "agw-docs/snippets/gatewayparameters.md" >}}](#gatewayparameters) resource are used to configure the gateway proxy. 

The resulting gateway proxy is managed for you and its configuration is automatically updated based on the settings in the GatewayParameters resource. To publicly expose the gateway proxy deployment, a service of type LoadBalancer is created for you. Depending on the cloud provider that you use, the LoadBalancer service is assigned a public IP address or hostname that you can use to reach the gateway. To expose an app on the gateway, you must create an HTTPRoute resource and define the matchers and filter rules that you want to apply before forwarding the request to the app in your cluster. You can review the [Get started]({{< link-hextra path="/quickstart/" >}}), [traffic management]({{< link-hextra path="/traffic-management/" >}}), [security]({{< link-hextra path="/security/" >}}), and [resiliency]({{< link-hextra path="/resiliency/" >}}) guides to find examples for how to route and secure traffic to an app. 

You can change the default configuration of your gateway proxy by creating custom {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resources, or updating the default {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} values in your {{< reuse "agw-docs/snippets/kgateway.md" >}} Helm chart. If you change the values in the Helm chart, {{< reuse "agw-docs/snippets/kgateway.md" >}} automatically applies the changes to the default {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resources. 

{{< callout type="info" >}}
Do not edit or change the default {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource directly. Always update the values in the {{< reuse "agw-docs/snippets/kgateway.md" >}} Helm chart so that they persist between upgrades.
{{< /callout >}} 

## {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} {#gatewayparameters}

{{< reuse "agw-docs/snippets/gatewayparameters-about.md" >}}

## Reserved ports

{{< reuse "agw-docs/snippets/reserved-ports.md" >}}
