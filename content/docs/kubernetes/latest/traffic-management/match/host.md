---
title: Host
weight: 10
test:
  host-match:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/traffic-management/match/host.md
    path: host-match
---
Expose a route on multiple hosts. 

For more information, see the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} documentation](https://gateway-api.sigs.k8s.io/api-types/httproute/#matches).

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up host matching

1. Create an HTTPRoute that is exposed on two domains, `host1.example` and `host2.example`.
   ```yaml {paths="host-match"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-match
     namespace: httpbin
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
       - host1.example
       - host2.example
     rules:
       - backendRefs:
           - name: httpbin
             port: 8000
   EOF
   ```
   
2. Send a request to the `/status/200` path of the httpbin app on the `host1.example` domain. Verify that you get back a 200 HTTP response code.  
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/status/200 -H "host: host1.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/status/200 -H "host: host1.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-length: 0
   content-length: 0
   ```

3. Send another request to the httpbin app. This time, you send it along the `host2.example` domain. Verify that the request succeeds and that you also get back a 200 HTTP response code. 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/status/200 -H "host: host2.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/status/200 -H "host: host2.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-length: 0
   content-length: 0
   ```
   
{{< doc-test paths="host-match" >}}
YAMLTest -f - <<'EOF'
- name: host match - host1.example returns 200
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /status/200
    method: GET
    headers:
      host: host1.example
  source:
    type: local
  expect:
    statusCode: 200
- name: host match - host2.example returns 200
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /status/200
    method: GET
    headers:
      host: host2.example
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete httproute httpbin-match -n httpbin
```



