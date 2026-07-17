Use the {{< reuse "agw-docs/snippets/backend.md" >}} `tunnel` policy to route backend connections through an HTTP proxy server. This is useful in environments where outbound traffic must pass through a corporate proxy, such as for JWKS retrieval or accessing AI providers behind a network egress point.

## About the tunnel policy

The `tunnel` field on an {{< reuse "agw-docs/snippets/backend.md" >}} configures an HTTP CONNECT tunnel to the target backend. Agentgateway establishes an HTTP tunnel through the proxy and forwards all requests to the upstream endpoint.

The tunnel supports `Service` and {{< reuse "agw-docs/snippets/backend.md" >}} types as the proxy target.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup" >}}).
2. Have access to an HTTP proxy (forward proxy) in your cluster, such as [Squid](https://squid-cache.org/).

## Configure a tunnel for JWKS fetching

This example configures an {{< reuse "agw-docs/snippets/agentgateway.md" >}} backend that connects to an upstream identity provider (IdP) through a Squid forward proxy. The tunnel is used for JWKS (JSON Web Key Set) retrieval.

1. Deploy the proxy backend {{< reuse "agw-docs/snippets/backend.md" >}} that points to your proxy server.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: squid-proxy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     static:
       host: squid-proxy.proxy-namespace.svc.cluster.local
       port: 3128
   EOF
   ```

2. Create the main backend with the `tunnel` policy that references the proxy.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: idp-proxied
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     static:
       host: idp.provider.com
       port: 443
     policies:
       tls:
         insecureSkipVerify: true
       tunnel:
         backendRef:
           group: {{< reuse "agw-docs/snippets/group.md" >}}
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
           name: squid-proxy
           port: 3128
   EOF
   ```

   | Setting | Description |
   |---------|-------------|
   | `spec.static.host` | The upstream backend host (the actual service you want to reach) |
   | `spec.policies.tunnel.backendRef.name` | The {{< reuse "agw-docs/snippets/backend.md" >}} or `Service` that represents the proxy |
   | `spec.policies.tunnel.backendRef.port` | The port the proxy listens on |
   | `spec.policies.tls.insecureSkipVerify` | Skip TLS certificate validation when connecting to the upstream backend. Use with caution — only in trusted environments. |

3. Agentgateway now routes all outbound connections from `idp-proxied` through the `squid-proxy` tunnel. When the control plane needs to fetch JWKS keys, it does so via the proxy.
