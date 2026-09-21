Set up listeners on your agentgateway proxy. A listener configures how your proxy accepts and processes incoming requests.

In the Kubernetes Gateway API, you can create listeners in two main ways:

* Inline as part of the Gateway resource.
* As a separate resource called a ListenerSet.

## Inline on the Gateway {#inline}

A common, simple approach is to write the listener inline on the Gateway resource. You have the flexibility to write different protocols, ports, and even TLS certificates. Each listener can specify its own hostname, or inherit the hostname of the Gateway. Gateways support up to 64 listeners.

Most examples in both the {{< reuse "agw-docs/snippets/kgateway.md" >}} and Kubernetes Gateway API docs use the inline approach.

## ListenerSets {#listenersets}

With ListenerSets, you can group together listeners that have their own unique configuration, such as different protocols, ports, hostnames, or TLS settings. Then, the ListenerSet refers to a Gateway, which can be in a different namespace than the ListenerSet. The same Gateway can also have multiple ListenerSets.

Similar to Gateways, ListenerSets can have a maximum of 64 listeners. However, because you can attach multiple ListenerSets to a single Gateway, now a single Gateway can have more than 64 listeners. Keep in mind that more listeners can impact how long it takes to propagate configuration changes on the Gateway. If you have more than 1,000 listeners, consider attaching ListenerSets to multiple Gateways.

### ListenerSet use cases {#listenerset-use-cases}

As such, you might use ListenerSets for the following advantages:

- **Multitenancy**: You can let different teams create their own ListenerSets, but share the same Gateway and backing load balancing infrastructure.
- **Inheritance**: Because ListenerSets inherit routes and policies from the Gateway, you can standardize the configuration of listeners across a multitenant environment. Teams still have the flexibility to overwrite settings in the ListenerSet.
- **Large scale deployments**: By using ListenerSets, Gateways can have more than 64 listeners attached. Teams can also share the same ListenerSet configuration to avoid duplication.
- **Certificates for more listeners per gateway**: Because you can now have more than 64 listeners per Gateway, a single Gateway can forward secured traffic to more backends that might have their own certificates. This approach aligns with projects that might require service-level certificates, such as Istio Ambient Mesh or Knative.

The following diagram presents a simple illustration of how ListenerSets can help you decentralize route configuration in a multitenant environment at scale.

* Team 1 and Team 2 each manage their own Service and HTTPRoute resources within their respective namespaces.
* Each HTTPRoute refers to a namespace-local ListenerSet. This way, each team controls how their routes are exposed, such as the protocol, port, and TLS certificate settings.
* The ListenerSets from both teams share a common Gateway in a separate namespace. A separate Gateway team can setup and manage centralized infrastructure or enforce policies as appropriate.


```mermaid
flowchart TD

  subgraph team1 namespace
    SVC1[Services]
    HR1[HTTPRoutes]
    LS1[ListenerSet]
  end

  subgraph team2 namespace
    SVC2[Services]
    HR2[HTTPRoutes]
    LS2[ListenerSet]
  end

  subgraph shared namespace
    GW[Gateway]
  end

  HR1 -- "parentRef" --> LS1
  LS1 -- "parentRef" --> GW
  HR1 -- "backendRef" --> SVC1

  HR2 -- "parentRef" --> LS2
  LS2 -- "parentRef" --> GW
  HR2 -- "backendRef" --> SVC2
```

<!-- The exclude list names 2026.9.x directly because the OSS-to-enterprise version remap rewrites the literal `1.5.x` only once, and the `latest` entry consumes it. Every other enterprise version is reached through its ossVersion. -->
{{< version exclude-if="2.2.x,1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2026.9.x" >}}
### Listener precedence {#listener-precedence}

Listeners that share a port must agree on their protocol, hostname, and bind mode. When they do not, only the first listener in precedence order is accepted. Each later listener that collides with it reports `Conflicted: True` and `Accepted: False` in its status, with a reason of `HostnameConflict`, `ProtocolConflict`, or `BindModeConflict`. Precedence follows the order that [GEP-1713](https://gateway-api.sigs.k8s.io/geps/gep-1713/#listener-precedence) defines:

1. Listeners written inline on the Gateway come before any listener that a ListenerSet contributes.
2. ListenerSets are ordered by `metadata.creationTimestamp`, oldest first.
3. ListenerSets that share a creation timestamp are ordered alphabetically, first by namespace and then by name.
4. Within a single ListenerSet, listeners keep the order that they appear in `spec.listeners`.

Because precedence starts from the creation timestamp, re-creating a ListenerSet moves it to the end of the order, and a listener that used to win a conflict can lose it.
{{< /version >}}

### More information {#more-info}

The listener setup guides in this section include tabs for examples of using both the inline and ListenerSet approaches.

For more information about ListenerSets, see the [Kubernetes Gateway API docs](https://gateway-api.sigs.k8s.io/geps/gep-1713/).






