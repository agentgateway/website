---
title: HTTP connection settings
weight: 10
description: Configure and manage HTTP connections to an upstream service.
test:
  connection-general:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/resiliency/connection.md
    path: connection-general

  connection-http1:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/resiliency/connection.md
    path: connection-http1

  connection-http2-flow:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/resiliency/connection.md
    path: connection-http2-flow
---

{{< reuse "agw-docs/pages/resiliency/connection.md" >}}

## Backend connections {#backend}

The `frontend` settings on this page tune the connections that clients open to the gateway. To tune the connections that the gateway opens to a destination, set the `backend` section of an {{< reuse "agw-docs/snippets/policy.md" >}} instead.

> [!IMPORTANT]
> The `backend.tcp` fields existed in earlier versions, but the controller did not translate them, so a policy that set them had no effect. Version 1.5 implements them. Review any policy that already sets `backend.tcp`, because the values now apply to real traffic.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that tunes the connection to the httpbin backend.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: httpbin-connection
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     backend:
       tcp:
         connectTimeout: 3s
         keepalive:
           time: 60s
           interval: 30s
           retries: 5
       http:
         requestTimeout: 30s
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `tcp.connectTimeout` | Deadline for establishing a connection to the destination. The value must be at least `100ms`. |
   | `tcp.keepalive.time` | How long a connection stays idle before agentgateway starts to send keepalive probes. The default is `180s`. |
   | `tcp.keepalive.interval` | Time between keepalive probes. The default is `180s`. |
   | `tcp.keepalive.retries` | Maximum number of keepalive probes to send before agentgateway drops the connection. The default is `9`. |
   | `http.requestTimeout` | Deadline for receiving a response from the backend. |

2. Verify the settings in the proxy configuration.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

   ```sh
   curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.backend != null and .policy.backend.tcp != null)] | .[0]'
   ```

3. Optional: Clean up the {{< reuse "agw-docs/snippets/policy.md" >}}.

   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} httpbin-connection -n httpbin
   ```

> [!NOTE]
> A `backend` policy sets `tcp` and `http` fields only. The `handshakeTimeout`, `http1IdleTimeout`, `http2KeepaliveInterval`, `http2KeepaliveTimeout`, and `maxConnectionDuration` settings belong to the `frontend` section, and apply to incoming connections. For where each policy section can attach, see [Targeting and merging]({{< link-hextra path="/about/policies/target-merge/" >}}).
