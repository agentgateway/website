Capture an access log for all the requests that enter the proxy. 

## About access logging

Access logs, sometimes referred to as audit logs, represent all traffic requests that pass through the gateway proxy. The access log entries can be customized to include data from the request, the routing destination, and the response. 

Access logs can be written to a file, the `stdout` stream of the gateway proxy container, or exported to a gRPC server for custom handling. The access logs capture information from requests that your gateway proxy handles.

### Data that can be logged

The gateway proxy exposes a lot of data that can be used when customizing access logs. The following data properties are available for both TCP and HTTP access logging:

* The downstream (client) address, connection information, TLS configuration, and timing
* The backend (service) address, connection information, TLS configuration, timing, and routing information
* Relevant configuration, such as rate of sampling (if used)
* Filter-specific context that is published to the dynamic metadata during the filter chain

### Additional HTTP properties 

When the gateway is used as an HTTP proxy, additional HTTP information is available for access logging, including:

* Request data, including the method, path, scheme, port, user agent, headers, body, and more
* Response data, including the response code, headers, body, and trailers, as well as a string representation of the response code
* Protocol version

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Access logs to `stdout` {#access-log-stdout-filesink}

You can set up access logs to write to a standard (stdout/stderr) stream. The following example writes access logs to a stdout in the pod of the selected `http` gateway.

1. Create an HTTPListenerPolicy resource to define your access logging rules. The following example writes access logs to the `stdout` stream of the gateway proxy container by using a custom string format that is defined in the `jsonFormat` field. 
   
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: access-logs
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - kind: Gateway
       name: agentgateway-proxy
       group: gateway.networking.k8s.io
     frontend:
       accessLog:
         attributes:
           add:
           - name: headers
             expression: "flatten(request.headers)"
   EOF
   ```

   | Setting | Description |
   | ------- | ----------- |
   | `targetRefs`| Select the Gateway to enable access logging for. The example selects the `agentgateway-proxy` gateway that you created from the sample app guide. |
   | `accessLog` | Configure the details for access logging. You can use multiple `fileSink` configurations for multiple outputs. The example sets up a `fileSink` for standard logging (stdout) in JSON format at `/dev/stdout`. You can also send the access logs to a `grpcService` instead of `fileSink`. |
   | `path` | The path in the gateway proxy to write access logs to, such as `/dev/stdout`. |
   | `jsonFormat` | The structured JSON format to write logs in. For more information about the JSON format dictionaries and command operators you can use, see the [Envoy docs](https://www.envoyproxy.io/docs/envoy/latest/configuration/observability/access_log/usage#format-dictionaries). To format as a string, use the `stringFormat` setting instead. If you omit or leave this setting blank, the [Envoy default format string](https://www.envoyproxy.io/docs/envoy/latest/configuration/observability/access_log/usage#default-format-string) is used. |
   | `stringFormat` | The string format to write logs in. For more information about the string format and command operators you can use, see the [Envoy docs](https://www.envoyproxy.io/docs/envoy/latest/configuration/observability/access_log/usage#config-access-log-format-strings). To format as JSON, use the `jsonFormat` setting instead. If you omit or leave this setting blank, the [Envoy default format string](https://www.envoyproxy.io/docs/envoy/latest/configuration/observability/access_log/usage#default-format-string) is used. |

2. Send a request to the httpbin app on the `www.example.com` domain. Verify that your request succeeds and that you get back a 200 HTTP response code.  
   
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/status/200 -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/status/200 -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```
   HTTP/1.1 200 OK
   access-control-allow-credentials: true
   access-control-allow-origin: *
   ```
   
3. Get the logs for the gateway pod and verify that you see a stdout JSON entry for each request that you sent to the httpbin app. 
   
   ```sh
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} logs deployments/agentgateway-proxy | tail -1 | jq
   ```
   
   Example output: 
   ```json
   {
     "authority": "www.example.com:8080",
     "bytes_received": 0,
     "bytes_sent": 0,
     "method": "GET",
     "path": "/status/200",
     "protocol": "HTTP/1.1",
     "req_x_forwarded_for": null,
     "request_id": "a6758866-0f26-4c95-95d9-4032c365c498",
     "resp_backend_service_time": "0",
     "response_code": 200,
     "response_flags": "-",
     "start_time": "2024-08-19T20:57:57.511Z",
     "total_duration": 1,
     "backendCluster": "kube-svc:httpbin-httpbin-8000_httpbin",
     "backendHost": "10.36.0.14:8080",
     "user_agent": "curl/7.77.0"
   }
   ```


## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete HTTPListenerPolicy access-logs -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```




