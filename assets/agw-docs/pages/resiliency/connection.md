Configure and manage HTTP connections to an upstream service. 

## Supported HTTP connection settings

You can use a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to apply HTTP connection settings to a service in your cluster. These settings include general settings, such as connection timeouts or the maximum number of connections that an upstream service can receive. You can also configure settings for HTTP/2 and HTTP/1 requests. 

* [General connection settings](#general-settings)
* [HTTP protocol options](#http)
* [Additional HTTP 1.0 protocol options](#http1)

### General connection settings {#general-settings}

Configure the timeout for a connection. 

```yaml 
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: httpbin-policy
  namespace: httpbin
spec:
  targetRefs:
    - name: httpbin
      group: ""
      kind: Service
  backend:
    tcp:
      connectTimeout: 5s
      # perConnectionBufferLimitBytes: 1024
```

| Setting | Description | 
| -- | -- | 
| `connectTimeout` | The timeout for new network connections to an upstream service. | 


### HTTP protocol options {#http}

You can use a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to configure additional connection options when handling upstream HTTP requests. Note that these options are applied to HTTP/1 and HTTP/2 requests. 

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: httpbin-policy
  namespace: httpbin
spec:
  targetRefs:
    - name: httpbin
      group: ""
      kind: Service
  commonHttpProtocolOptions:
    idleTimeout: 10s  
    maxHeadersCount: 15
    maxStreamDuration: 30s
    maxRequestsPerConnection: 100 
```

| Setting | Description | 
| -- | -- | 
| `idleTimeout` | The idle timeout for connections. The idle timeout is defined as the period in which there are no active requests. When the idle timeout is reached, the connection is closed. Note that request-based timeouts mean that HTTP/2 PINGs do not keep the connection alive. If not specified, the idle timeout defaults to 1 hour. To disable idle timeouts, explicitly set this field to 0. **Warning**: Disabling the timeout has a highly likelihood of yielding connection leaks, such as due to lost TCP FIN packets.| 
| `maxHeadersCount` | The maximum number of headers that can be sent in a connection. If not specified, the number defaults to 100. Requests that exceed this limit receive a 431 response for HTTP/1 and cause a stream reset for HTTP/2. | 
| `maxStreamDuration` | The total duration to keep alive an HTTP request/response stream. If the time limit is reached, the stream is reset independent of any other timeouts. If not specified, this value is not set. | 
| `maxRequestsPerConnection` | The maximum number of requests that can be sent per connection. | 
 

#### Additional HTTP 1.0 protocol options {#http1}

The {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} allows you to apply additional configuration to HTTP/1 connections. 

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: httpbin-policy
  namespace: httpbin
spec:
  targetRefs:
    - name: httpbin
      group: ""
      kind: Service
  http1ProtocolOptions:
    enableTrailers: true
    overrideStreamErrorOnInvalidHttpMessage: true
    preserveHttp1HeaderCase: true
```

| Setting | Description | 
| -- | -- | 
| `enableTrailers` | Enables trailers for HTTP/1 requests. Trailers are headers that are sent after the request body is sent. By default, the HTTP/1 codec drops proxied trailers. | 
| `overrideStreamErrorOnInvalidHttpMessage` | When set to false, the proxy terminates HTTP/1.1 connections when an invalid HTTP message is received, such as malformatted headers. When set to true, the proxy leaves the HTTP/1.1 connection open where possible. | 
| `headerFormat` | By default, the proxy normalizes header keys to lowercase. Set to `PreserveCaseHeaderKeyFormat` to preserve the original casing after the request is proxied. Set to `properCaseHeaderKeyFormat` to capitalize the first character and any character following a special character if it's an alpha character. For example, `content-type` becomes `Content-Type`, and `foo$b#$are` becomes `Foo$B#$Are`. |


## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Configure connections

1. Create a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies connection configuration to the httpbin app. 
   ```yaml 
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: httpbin-connection
     namespace: httpbin   
   spec:
     targetRefs:
       - name: httpbin
         group: ""
         kind: Service
     backend:
       tcp:
         connectTimeout: 5s
     perConnectionBufferLimitBytes: 1024
     commonHttpProtocolOptions:
       idleTimeout: 10s  
       maxHeadersCount: 15
       maxStreamDuration: 30s
       maxRequestsPerConnection: 100 
     http1ProtocolOptions:
       enableTrailers: true
       overrideStreamErrorOnInvalidHttpMessage: true
       preserveHttp1HeaderCase: true
   EOF
   ```   

2. Port-forward the gateway proxy on port 15000. 
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```
   
3. Get the config dump and verify that the idle timeout policy is set as you configured it.
  
   Example `jq` command:
   ```sh
   curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.frontend != null and .policy.frontend.hTTP != null and .policy.frontend.hTTP.http1IdleTimeout != null)] | .[0]'
   ```
  
   Example output: 
   ```json {linenos=table,hl_lines=[20],filename="http://localhost:15000/config_dump"}
   {
     "key": "frontend/agentgateway-system/idle-time:frontend-http:agentgateway-system/agentgateway-proxy",
     "name": {
       "kind": "AgentgatewayPolicy",
       "name": "idle-time",
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
          "http1IdleTimeout": "30s",
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
    
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following command.

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} httpbin-connection -n httpbin
```





