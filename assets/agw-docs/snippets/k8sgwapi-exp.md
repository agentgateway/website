The following features were introduced in the experimental channel of the upstream Kubernetes Gateway API. The table distinguishes the minimum version listed for each feature from the version in which it became standard. Features that remain experimental are subject to change.

| Feature | Minimum Gateway API version | Standard channel since |
| --- | --- | --- |
| ListenerSets | 1.3 | 1.5 |
| TCPRoutes | 1.3 | 1.6 |
| TLSRoutes | 0.3 | 1.5 |
| BackendTLSPolicy | 1.4 | 1.4 |
| CORS policies | 1.2 | 1.5 |
| Frontend client-certificate validation | 1.4 | 1.5 |
| Retries | 1.2 | Experimental |
| Session persistence | 1.3 | Experimental |
| HTTPRoute rule attachment option | 1.3 | 1.4 |

BackendTLSPolicy and named HTTPRoute rules became standard in [Gateway API 1.4](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.4.0). ListenerSets, HTTPRoute CORS filters, TLSRoutes, and frontend client-certificate validation became standard in [Gateway API 1.5](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.5.0). TCPRoutes and UDPRoutes became standard in [Gateway API 1.6](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.6.0). These features do not require experimental CRDs at or after their standard-channel version.

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
