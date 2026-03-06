Capture an access log for all the requests that enter the proxy. 

## About access logging

Access logs, sometimes referred to as audit logs, represent all traffic requests that pass through the gateway proxy. The access log entries can be customized to include data from the request, the routing destination, and the response. 

### Data that can be logged

Access log content is controlled by [CEL (Common Expression Language)](https://agentgateway.dev/docs/kubernetes/main/reference/cel/) expressions. You can filter which requests are logged and define custom attributes from the request and response.

For logging, CEL exposes these variable groups when enabled or applicable:

* **request**: method, URI, host, path, headers, body, and timing
* **response**: status code, headers, and body
* **source**: client address, port, and TLS identity
* **backend**: backend name, type, and protocol
* **Auth and metadata**: `jwt`, `apiKey`, or `basicAuth`, plus `extauthz` and `extproc` metadata
* **LLM**: model, provider, token counts, and optional prompt/completion
* **MCP**: tool, prompt, and resource name and target

Use the `filter` field to include only certain requests (for example, errors or specific paths) and the `attributes.add` list to add fields with CEL expressions. For the full variable table, available functions, and examples, see the [CEL expressions reference](https://agentgateway.dev/docs/kubernetes/main/reference/cel/).


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Access logs to `stdout` {#access-log-stdout-filesink}

You can set up access logs to write to a standard (stdout/stderr) stream. The following example writes access logs to a stdout in the pod of the selected `agentgateway-proxy` gateway.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource to define your access logging rules. The following example writes access logs to the `stdout` stream of the gateway proxy container when a request fails with a 404 HTTP response code. It also adds the actual response code to the log entry. This policy does not apply to requests that return a response code other than 404.

   ```yaml {linenos=table,paths="access-logging"}
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
   ```sh {paths="access-logging"}
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
   
3. Get the logs for the agentgateway proxy. Verify that you see an access log entry for the request that you sent and that the `http.statusString` attribute was added. 
   
   ```sh {paths="access-logging"}
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} logs deployments/agentgateway-proxy | tail -1 
   ```
   
   Example output: 
   ```console {hl_lines=[5]} 
   info	request gateway=agentgateway-system/agentgateway-proxy
   listener=http route=httpbin/httpbin endpoint=10.244.0.4:8080
   src.addr=127.0.0.1:46886 http.method=GET http.host=www.example.com
   http.path=/status/404 http.version=HTTP/1.1 http.status=404
   protocol=http duration=0ms http.statusString="404"
   ```

4. Send another request to the httpbin app. This time, you use the `/status/200` path to return a `200` HTTP response code. 
   
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh {paths="access-logging"}
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

3. Get the logs for the gateway pod again and verify that you do not see an access log entry for the `200` request that you sent to the httpbin app. The last entry is still for the previous `404` request.
   
   ```sh {paths="access-logging"}
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} logs deployments/agentgateway-proxy | tail -1 
   ```

   Example:
   ```console {hl_lines=[4]}
   info	request gateway=agentgateway-system/agentgateway-proxy
   listener=http route=httpbin/httpbin endpoint=10.244.0.4:8080
   src.addr=127.0.0.1:46886 http.method=GET http.host=www.example.com
   http.path=/status/404 http.version=HTTP/1.1 http.status=404
   protocol=http duration=0ms http.statusString="404"
   ```
  
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following command.

```sh {paths="access-logging"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} access-logs -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```




