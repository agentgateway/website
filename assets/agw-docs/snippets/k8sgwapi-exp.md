The following features were introduced in the experimental channel of the upstream Kubernetes Gateway API. The table distinguishes the minimum version listed for each feature from the version in which it became standard. Features that remain experimental are subject to change.

| Feature | Minimum Gateway API version | Standard channel since |
| --- | --- | --- |
| ListenerSets | 1.3 | 1.5 |
| TCPRoutes | 1.3 | 1.6 |
| TLSRoutes | 0.3 | 1.5 |
| BackendTLSPolicy | 1.4 | 1.4 |
| CORS policies | 1.2 | 1.5 |
| Frontend client-certificate validation | 1.4 | 1.5 |
| Retries | 1.2 | 1.7 |
| HTTPRoute rule attachment option | 1.3 | 1.4 |
| Gateway address routability | 1.7 | Experimental |
| Listener filters (pre-routing) | 1.7 | Experimental |

BackendTLSPolicy and named HTTPRoute rules became standard in [Gateway API 1.4](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.4.0). ListenerSets, HTTPRoute CORS filters, TLSRoutes, and frontend client-certificate validation became standard in [Gateway API 1.5](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.5.0). TCPRoutes and UDPRoutes became standard in [Gateway API 1.6](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.6.0). HTTPRoute retries became standard in [Gateway API 1.7](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.7.0). These features do not require experimental CRDs at or after their standard-channel version.

To use a feature that is still experimental in your Gateway API version, install the experimental channel of the Gateway API CRDs. Experimental features follow the CRD channel that you install, so you do not need to change any Helm values.

**Sample command for version {{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}**: Note that some CRDs are prefixed with `X` to indicate that the entire CRD is experimental and subject to change.
    
```sh
kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
```

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
If the standard channel CRDs are already in your cluster, the install command fails because the Gateway API `safe-upgrades` admission policy blocks experimental CRDs on top of standard CRDs. To switch channels, delete the policy and its binding first, and then run the install command again.

```sh
kubectl delete validatingadmissionpolicybinding safe-upgrades.gateway.networking.k8s.io
kubectl delete validatingadmissionpolicy safe-upgrades.gateway.networking.k8s.io
```

Example output:

```txt
validatingadmissionpolicybinding.admissionregistration.k8s.io "safe-upgrades.gateway.networking.k8s.io" deleted
validatingadmissionpolicy.admissionregistration.k8s.io "safe-upgrades.gateway.networking.k8s.io" deleted
```

The experimental install re-creates the policy. Until then, the cluster no longer blocks you from installing CRDs of an older Gateway API version.
{{< /version >}}
