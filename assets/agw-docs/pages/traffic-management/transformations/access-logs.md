When building or debugging transformations, you can log CEL variables to inspect what values are available at runtime. Configure an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with `spec.frontend.accessLog` to add custom attributes to the structured access log using CEL expressions.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Log specific request data 

Add access log attributes with CEL expressions.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that targets your Gateway and adds CEL variables as log attributes.

   ```yaml {paths="access-logs"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
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
         attributes:
           add:
           - name: request_path
             expression: request.path
           - name: request_method
             expression: request.method
           - name: client_ip
             expression: source.address
   EOF
   ```

   {{< doc-test paths="access-logs" >}}
   YAMLTest -f - <<'EOF'
   - name: verify request through gateway returns 200
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/get"
       method: GET
       headers:
         host: www.example.com
     source:
       type: local
     expect:
       statusCode: 200
   EOF
   {{< /doc-test >}}

2. Send a request through the gateway.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Check the agentgateway logs to verify that the CEL variables are being logged.

   ```sh
   kubectl logs -n agentgateway-system -l app.kubernetes.io/name=agentgateway-proxy --tail=1
   ```

   Example output:

   ```console {hl_lines=[5]}
   info	request gateway=agentgateway-system/agentgateway-proxy
   listener=http route=httpbin/httpbin endpoint=10.244.0.7:8080
   src.addr=10.244.0.1:8468 http.method=GET http.host=www.example.com
   http.path=/get http.version=HTTP/1.1 http.status=200 protocol=http
   duration=0ms request_path="/get" request_method="GET" client_ip="10.244.0.1"
   ```

## Log only specific requests

Add a `filter` CEL expression to log only requests that match a condition. This configuration is useful for reducing log volume by capturing only error responses or specific traffic patterns.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with a `filter` field that logs requests only if the response status code does not equal 400. 

   ```yaml {paths="access-logs-filter"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
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
         filter: response.code >= 400
         attributes:
           add:
           - name: request_path
             expression: request.path
           - name: status_code
             expression: string(response.code)
   EOF
   ```

   {{< doc-test paths="access-logs-filter" >}}
   YAMLTest -f - <<'EOF'
   - name: verify 400 response triggers access log entry
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/status/400"
       method: GET
       headers:
         host: www.example.com
     source:
       type: local
     expect:
       statusCode: 400
   EOF
   {{< /doc-test >}}

2. Send a request that returns a `400` response. 

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/status/400 \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/status/400 \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Check the agentgateway logs. Verify that the log entry is written.

   ```sh
   kubectl logs -n agentgateway-system -l app.kubernetes.io/name=agentgateway-proxy --tail=1
   ```

   Example output:

   ```console {hl_lines=[5]}
   info	request gateway=agentgateway-system/agentgateway-proxy listener=http
   route=httpbin/httpbin endpoint=10.244.0.7:8080 src.addr=10.244.0.1:37259
   http.method=GET http.host=www.example.com http.path=/status/400
   http.version=HTTP/1.1 http.status=400 protocol=http duration=0ms
   request_path="/status/400" status_code="400"
   ```

4. Send a request that returns a `200` response. 

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

5. Check the agentgateway logs. Verify that no log entry is written and the last entry was from the previous unsuccessful request. The log entry for the successful request is absent because the response code was `200`, which does not match the `response.code >= 400` filter.

   ```sh
   kubectl logs -n agentgateway-system -l app.kubernetes.io/name=agentgateway-proxy --tail=1
   ```

   Example output:

   ```console {hl_lines=[5]}
   info	request gateway=agentgateway-system/agentgateway-proxy listener=http
   route=httpbin/httpbin endpoint=10.244.0.7:8080 src.addr=10.244.0.1:37259
   http.method=GET http.host=www.example.com http.path=/status/400
   http.version=HTTP/1.1 http.status=400 protocol=http duration=0ms
   request_path="/status/400" status_code="400"
   ```


## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="access-logs,access-logs-filter"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} access-logs -n agentgateway-system
```
