{{< tabs items="agentgateway,agentgateway-waypoint" tabTotal="2">}}
{{% tab %}}
The `agentgateway` GatewayClass is the standard class for when you want to use an agentgateway proxy in kgateway.
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: agentgateway
spec:
  controllerName: kgateway.dev/agentgateway
  description: Specialized class for agentgateway.
```
{{% /tab %}}
{{% tab %}}
The `agentgateway-waypoint` GatewayClass is for when you use agentgateway as a waypoint in an Istio Ambient service mesh setup.
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: agentgateway-waypoint
spec:
  controllerName: kgateway.dev/kgateway
  description: Specialized class for Istio ambient mesh waypoint proxies.
```
{{% /tab %}}
{{< /tabs >}}

The `kgateway.dev/kgateway` controller watches the resources in your cluster. When a Gateway resource is created that references the GatewayClass, the controller spins up an agentgateway proxy by using the configuration that is defined in the GatewayParameters resource. The controller also translates other resources, such as HTTPRoute, {{< reuse "docs/snippets/trafficpolicy.md" >}}, HTTPListenerPolicy, and more, into valid agentgateway configuration, and applies the configuration to the gateway proxies it manages.
