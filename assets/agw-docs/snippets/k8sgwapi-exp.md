The following features are experimental in the upstream Kubernetes Gateway API project, and are subject to change.

| Feature | Minimum Gateway API version |
| --- | --- | 
| ListenerSets | 1.3 |
| TCPRoutes| 1.3 |
| BackendTLSPolicy| 1.4 | 
| CORS policies| 1.2 |
| Retries | 1.2 | 
| Session persistence | 1.3 | 
| HTTPRoute rule attachment option | 1.3 |


{{< callout type="warning" >}}
**Experimental feature gate**: To use experimental Gateway API features in agentgateway version 2.2 or later, you must enable the `KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES` environment variable in your agentgateway controller deployment. This setting defaults to `false` and must be explicitly enabled. For example, you might upgrade your installation with the following Helm value:

```yaml
controller:
  extraEnv:
    KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES: "true"
```
{{< /callout >}}


**Sample command for version {{< reuse "agw-docs/versions/k8s-gw-version.md" >}}**: Note that some CRDs are prefixed with `X` to indicate that the entire CRD is experimental and subject to change.
    
```sh
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/experimental-install.yaml
```
