You can use an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to apply HTTP connection settings to the agentgateway proxy. These settings include idle connection timeouts, the maximum number of connections that an upstream service can receive, and more. Note that these options are applied to HTTP/1 or HTTP/2 requests only when indicated.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Maximum buffer size {#buffer}

Fine-tune connection speeds for read and write operations by setting a connection buffer limit (`maxBufferSize`). You can use this setting for both HTTP/1 and HTTP/2 connections.

{{< cards >}}
  {{< card path="/traffic-management/buffering" title="Buffering" subtitle="Configure a buffer size setting." >}}
{{< /cards >}}


## HTTP/1.1 settings {#http1}

Use these settings to control header limits and idle connection behavior for HTTP/1.1 connections.

### Idle timeouts  {#http1-idle}

Set an idle timeout for HTTP/1 traffic to terminate the connection to a downstream or upstream service if there are no active streams.

{{< cards >}}
  {{< card path="/resiliency/timeouts/idle/" title="Idle timeouts" subtitle="Configure an idle timeout setting." >}}
{{< /cards >}}

### Max headers  {#http1-headers}

Set the maximum number of headers allowed in HTTP/1.1 requests.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies the HTTP/1.1 connection configuration to the proxy.

   ```yaml {paths="connection-http1"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: http1
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - kind: Gateway
       name: agentgateway-proxy
       group: gateway.networking.k8s.io
     frontend:
       http:
         http1MaxHeaders: 15
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `http1MaxHeaders` | The maximum number of headers allowed in HTTP/1.1 requests. Requests that exceed the limit receive a 431 response. |


2. Port-forward the gateway proxy on port 15000.
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

3. Get the config dump and verify that the policy is set as you configured it.

   Example `jq` command:
   ```sh
   curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.frontend != null and .policy.frontend.hTTP != null and .policy.frontend.hTTP.http1IdleTimeout != null)] | .[0]'
   ```

   Example output:
   ```json {linenos=table,hl_lines=[19],filename="http://localhost:15000/config_dump"}
   {
     "key": "frontend/agentgateway-system/http1:frontend-http:agentgateway-system/agentgateway-proxy",
     "name": {
       "kind": "AgentgatewayPolicy",
       "name": "http1",
       "namespace": "agentgateway-system"
     },
     "target": {
       "gateway": {
        "gatewayName": "agentgateway-proxy",
        "gatewayNamespace": "agentgateway-system",
        "listenerName": null
      }
    },
    "policy": {
      "frontend": {
        "hTTP": {
          "maxBufferSize": null,
          "http1MaxHeaders": 15,
          "http1IdleTimeout": null,
          "http2WindowSize": null,
          "http2ConnectionWindowSize": null,
          "http2FrameSize": null,
          "http2KeepaliveInterval": null,
          "http2KeepaliveTimeout": null
        }
      }
    }
   }
   ```

{{< doc-test paths="connection-http1" >}}
YAMLTest -f - <<'EOF'
- name: wait for http1 policy in config dump
  retries: 20
  http:
    url: http://localhost:15000
    skipSslVerification: true
    method: GET
    path: /config_dump
  source:
    type: pod
    usePortForward: true
    selector:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
  expect:
    bodyContains:
    - '"http1MaxHeaders"'
EOF
{{< /doc-test >}}

#### Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} http1 -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## HTTP/2 settings {#http2}

Use these settings to tune HTTP/2 flow control, which governs how much data can be in-flight at the stream and connection levels.

### Flow control {#http2-flow}

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies HTTP/2 flow control configuration to the proxy.

   ```yaml {paths="connection-http2-flow"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: http2-flow
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - kind: Gateway
       name: agentgateway-proxy
       group: gateway.networking.k8s.io
     frontend:
       http:
         http2WindowSize: 1048576
         http2ConnectionWindowSize: 4194304
         http2FrameSize: 65536
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `http2WindowSize` | Controls how many bytes can be in-flight on a single HTTP/2 stream before the sender must wait for a `WINDOW_UPDATE` acknowledgment. Setting this to 1 means the client can only send 1 byte at a time per stream, essentially halting all throughput. The default is 65,535 bytes (64KB). |
   | `http2ConnectionWindowSize` | The initial window size for connection-level flow control for received data. This settings controls the total bytes in-flight across all streams on a single connection combined.  |
   | `http2FrameSize` | The maximum size of a single HTTP/2 DATA frame the gateway  accepts. The HTTP/2 protocol minimum (and default) is 16,384 bytes. 17000 is a modest bump above that default, allowing slightly larger frames and potentially fewer round-trips for larger payloads. |

2. Port-forward the gateway proxy on port 15000.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

3. Get the config dump and verify that the policy is set as you configured it.

   Example `jq` command:
   ```sh
   curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.frontend != null and .policy.frontend.hTTP != null and .policy.frontend.hTTP.http2WindowSize != null)] | .[0]'
   ```

   Example output:
   ```json {linenos=table,hl_lines=[21,22,23],filename="http://localhost:15000/config_dump"}
   {
     "key": "frontend/agentgateway-system/http2-flow:frontend-http:agentgateway-system/agentgateway-proxy",
     "name": {
       "kind": "AgentgatewayPolicy",
       "name": "http2-flow",
       "namespace": "agentgateway-system"
     },
     "target": {
       "gateway": {
        "gatewayName": "agentgateway-proxy",
        "gatewayNamespace": "agentgateway-system",
        "listenerName": null
      }
    },
    "policy": {
      "frontend": {
        "hTTP": {
          "maxBufferSize": null,
          "http1MaxHeaders": null,
          "http1IdleTimeout": null,
          "http2WindowSize": 1048576,
          "http2ConnectionWindowSize": 4194304,
          "http2FrameSize": 65536,
          "http2KeepaliveInterval": null,
          "http2KeepaliveTimeout": null
        }
      }
    }
   }
   ```

{{< doc-test paths="connection-http2-flow" >}}
YAMLTest -f - <<'EOF'
- name: wait for http2-flow policy in config dump
  retries: 20
  http:
    url: http://localhost:15000
    skipSslVerification: true
    method: GET
    path: /config_dump
  source:
    type: pod
    usePortForward: true
    selector:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
  expect:
    bodyContains:
    - '"http2WindowSize"'
    - '"http2FrameSize"'
    - '17000'
EOF
{{< /doc-test >}}

#### Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} http2-flow -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

### Keepalive {#http2-keepalive}

Manage idle and stale connections with HTTP/2 keepalive.

{{< cards >}}
  {{< card path="/resiliency/keepalive/#http-keepalive" title="Keepalive" subtitle="COnfigure keepalive connection settings." >}}
{{< /cards >}}


