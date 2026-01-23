Get started with {{< reuse "/agw-docs/snippets/kgateway.md" >}}. {{< reuse "agw-docs/snippets/kgateway-about.md" >}}

## Before you begin

These quick start steps assume that you have a Kubernetes cluster, `kubectl`, and `helm` already set up. For quick testing, you can use [Kind](https://kind.sigs.k8s.io/).

```sh
kind create cluster
```

## Install

The following steps get you started with a basic installation. For detailed instructions, see the [installation guides]({{< link-hextra path="/install" >}}).

{{< reuse "agw-docs/snippets/get-started.md" >}}

Good job! You now have the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane running in your cluster.

## Next steps

{{< icon "kgateway" >}} [Set up an API gateway with an httpbin sample app]({{< link-hextra path="/install/sample-app/" >}}). This guide uses the Envoy-based {{< reuse "/agw-docs/snippets/kgateway.md" >}} proxy to set up an API gateway. Then, deploy a sample httpbin app, configure a basic HTTP listener on the API gateway, and route traffic to httpbin by using an HTTPRoute resource.

## Cleanup

No longer need {{< reuse "/agw-docs/snippets/kgateway.md" >}}? Uninstall with the following command:

```sh
helm uninstall {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
