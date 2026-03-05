Capture an access log for all the requests that enter the proxy. 

## About access logging

Access logs, sometimes referred to as audit logs, represent all traffic requests that pass through the gateway proxy. The access log entries can be customized to include data from the request, the routing destination, and the response. 

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

You can set up access logs to write to a standard (stdout/stderr) stream. The following example writes access logs to a stdout in the pod of the selected `agentgateway-proxy` gateway.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource to define your access logging rules. The following example writes access logs to the `stdout` stream of the gateway proxy container when a request fails. It also adds a string field of the response code. Successful requests are not logged with this configuration.

   ```yaml {linenos=table}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
   metadata:
     name: access-logs
     namespace: agentgateway-system
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       accessLog:
         filter: response.code == 404
         attributes:
           add:
           - name: http.statusString
             expression: string(response.code)
   EOF
   ```

   | Setting | Description |
   | ------- | ----------- |
   | `targetRefs`| Select the Gateway to enable access logging for. The example selects the `agentgateway-proxy` gateway that you created from the sample app guide. |
   | `accessLog` | Configure the details for access logging. |
   | `filter` | Filter the logs that are included by using a CEL expression. |
   | `attributes` | Add or remove attributes that are logged in the requests by using a CEL expression. |

2. Send a request to the httpbin app on the `www.example.com` domain. Verify that your request results in a 404 HTTP response code.  
   
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/status/404 -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/status/404 -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```
   HTTP/1.1 404 Not Found
   access-control-allow-credentials: true
   access-control-allow-origin: *
   ```
   
3. Get the logs for the gateway pod and verify that you see a stdout entry for each request that you sent to the httpbin app. 
   
   ```sh
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} logs deployments/agentgateway-proxy | tail -1 
   ```
   
   Example output: 
   ```console
   info	request gateway=agentgateway-system/agentgateway-proxy listener=http route=httpbin/httpbin endpoint=10.244.0.4:8080 src.addr=127.0.0.1:46886 http.method=GET http.host=www.example.com http.path=/status/404 http.version=HTTP/1.1 http.status=404 protocol=http duration=0ms http.statusString="404"
   ```

4. Send a `200` request to the httpbin app on the `www.example.com` domain. 
   
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

3. Get the logs for the gateway pod again and verify that you do not see a stdout entry for the `200` request that you sent to the httpbin app. The last entry is still for the previous `404` request.
   
   ```sh
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} logs deployments/agentgateway-proxy | tail -1 
   ```

   Example:
   ```console
   info	request gateway=agentgateway-system/agentgateway-proxy listener=http route=httpbin/httpbin endpoint=10.244.0.4:8080 src.addr=127.0.0.1:46886 http.method=GET http.host=www.example.com http.path=/status/404 http.version=HTTP/1.1 http.status=404 protocol=http duration=0ms http.statusString="404"
   ```
  
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following command.

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} access-logs -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```




