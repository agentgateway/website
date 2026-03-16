Manage HTTP connections to an upstream service.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Configure HTTP protocol connections {#http}

You can use an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to apply HTTP connection settings to a service in your cluster. These settings include idle connection timeouts, the maximum number of connections that an upstream service can receive, and more. Note that these options are applied to only HTTP/1 or HTTP/2 requests when indicated in the name.

### General settings {#general}

You can use the `maxBufferSize` setting for both HTTP/1 and HTTP/2.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies connection configuration to the proxy.

   ```yaml {paths="connection-general"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: maxbuffer
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - kind: Gateway
       name: agentgateway-proxy
       group: gateway.networking.k8s.io
     frontend:
       http:
         maxBufferSize: 2097152
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `maxBufferSize` | The maximum size HTTP body that is buffered into memory. Defaults to 2mb if unset. Minimum value: 1. |

2. Port-forward the gateway proxy on port 15000.
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

3. Get the config dump and verify that the policy is set as you configured it.

   Example `jq` command:
   ```sh
   curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.frontend != null and .policy.frontend.hTTP != null and .policy.frontend.hTTP.maxBufferSize != null)] | .[0]'
   ```

   Example output:
   ```json {linenos=table,hl_lines=[18],filename="http://localhost:15000/config_dump"}
   {
     "key": "frontend/agentgateway-system/maxbuffer:frontend-http:agentgateway-system/agentgateway-proxy",
     "name": {
       "kind": "AgentgatewayPolicy",
       "name": "maxbuffer",
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
          "maxBufferSize": 2097152,
          "http1MaxHeaders": null,
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

{{< doc-test paths="connection-general" >}}
YAMLTest -f - <<'EOF'
- name: wait for maxbuffer policy in config dump
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
    - '"maxBufferSize"'
    - '2097152'
EOF
{{< /doc-test >}}

#### Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} maxbuffer -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

### HTTP/1.1 settings {#http1}

Use these settings to control header limits and idle connection behavior for HTTP/1.1 connections.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies HTTP/1.1 connection configuration to the proxy.

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
         http1IdleTimeout: 10s
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `http1MaxHeaders` | The maximum number of headers allowed in HTTP/1.1 requests. Defaults to 100 if unset. Valid range: 1–4096. Requests that exceed this limit receive a 431 response. |
   | `http1IdleTimeout` | The timeout before an unused HTTP/1.1 connection is closed. Defaults to 10 minutes if unset. |

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
   ```json {linenos=table,hl_lines=[19,20],filename="http://localhost:15000/config_dump"}
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
          "http1IdleTimeout": "10s",
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
    - '"http1IdleTimeout"'
    - '"10s"'
EOF
{{< /doc-test >}}

#### Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} http1 -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

### HTTP/2 flow control {#http2-flow}

Use these settings to tune HTTP/2 flow control, which governs how much data can be in-flight at the stream and connection levels.

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
         http2WindowSize: 1
         http2ConnectionWindowSize: 1
         http2FrameSize: 17000
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `http2WindowSize` | The initial window size for stream-level flow control for received data. Minimum value: 1. |
   | `http2ConnectionWindowSize` | The initial window size for connection-level flow control for received data. Minimum value: 1. |
   | `http2FrameSize` | The maximum frame size to use for HTTP/2 connections. Defaults to 16kb if unset. Valid range: 16384–1677215. |

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
          "http2WindowSize": 1,
          "http2ConnectionWindowSize": 1,
          "http2FrameSize": 17000,
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

### HTTP/2 keepalive {#http2-keepalive}


{{< cards >}}
  {{< card path="/resiliency/keepalive/#http-keepalive" title="Keepalive" subtitle="Manage idle and stale connections with HTTP/2 keepalive." >}}
{{< /cards >}}


## Next steps

You can learn more about these individual HTTP connection settings.

{{< cards >}}
  {{< card path="/resiliency/timeouts/idle/" title="Idle timeouts" subtitle="Set idle timeout settings." >}}
  {{< card path="/resiliency/keepalive/" title="Keepalive" subtitle="Set keepalive settings." >}}
{{< /cards >}}

