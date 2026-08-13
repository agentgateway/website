The following features come from the upstream Kubernetes Gateway API project and were introduced in its experimental channel. Features that remain in the experimental channel are subject to change. Several have since moved to the standard channel, as the footnotes describe, and no longer require you to install the experimental CRDs.

| Feature | Minimum Gateway API version |
| --- | --- | 
| ListenerSets`*` | 1.3 |
| TCPRoutes`**`| 1.3 |
| TLSRoutes`*` | 0.3 |
| BackendTLSPolicy`*`| 1.4 | 
| CORS policies`*`| 1.2 |
| Retries | 1.2 | 
| Session persistence | 1.3 | 
| HTTPRoute rule attachment option | 1.3 |

`*` **Note**: ListenerSets, CORS in HTTPRoutes, TLSRoutes, and BackendTLSPolicy moved from the experimental to the standard channel in [Gateway API version 1.5](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.5.0). If you run Gateway API 1.5 or later, you do not need the experimental channel for these features.

`**` **Note**: TCPRoutes and UDPRoutes moved to the standard channel in [Gateway API version 1.6](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.6.0).

> [!NOTE]
> **Experimental feature gate**: Experimental Gateway API features in agentgateway are controlled by the `AGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES` environment variable in your agentgateway controller deployment. This setting is enabled by default. To set it explicitly, or to turn experimental features off, include the following Helm value:
>
> ```yaml
> controller:
>   extraEnv:
>     AGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES: "true"
> ```


**Sample command for version {{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}**: Note that some CRDs are prefixed with `X` to indicate that the entire CRD is experimental and subject to change.
    
```sh
kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
```
