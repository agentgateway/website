The httpbin app lets you test out agentgateway for non-agentic HTTP traffic by sending requests to it and receiving responses.

## About

Review the following diagram to understand the setup.

```mermaid
flowchart LR
    A[client] -->|example.com| B[gateway proxy]
    B --> C[httpbin backend]
```

* The client calls the `www.example.com` hostname that you set up in the Gateway configuration.
* The agentgateway proxy receives the request. Based on the routing rules that you set up in the Gateway configuration, the gateway proxy forwards the traffic to the backend destination, which is the httpbin service. The gateway proxy is available from an external LoadBalancer service that is backed by an IP address that your cloud provider typically assigns. For testing in a local cluster where you do not have an external service, you can enable port-forwarding so that the gateway proxy listens on the localhost instead.
* The httpbin service receives and responds to the request. Note that the httpbin service does not have to be publicly exposed because the gateway proxy handles the external traffic. Instead, it can have an internal service type, such as ClusterIP.

## Before you begin

{{< reuse "agw-docs/snippets/agentgateway-prereq.md" >}}

## Install httpbin

{{% steps %}}

### Step 1: Install the httpbin app

Install the sample httpbin app.

1. Install the httpbin app.
   ```sh,paths="install-httpbin"
   kubectl apply -f https://raw.githubusercontent.com/kgateway-dev/kgateway/refs/heads/main/examples/httpbin.yaml
   ```

   {{< doc-test paths="install-httpbin" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for httpbin deployment to be ready
     wait:
       target:
         kind: Deployment
         metadata:
           namespace: httpbin
           name: httpbin
       jsonPath: "$.status.availableReplicas"
       jsonPathExpectation:
         comparator: greaterThan
         value: 0
       polling:
         timeoutSeconds: 300
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

2. Verify that the httpbin app is up and running.
   
   ```sh
   kubectl get pods -n httpbin
   ````

### Step 2: Create a route to the httpbin app

Create an HTTPRoute resource that routes requests to the httpbin app through the Gateway that you created before you began.

```sh,paths="install-httpbin"
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: httpbin
  namespace: httpbin
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  hostnames:
    - "www.example.com"
  rules:
    - backendRefs:
        - name: httpbin
          port: 8000
EOF
```

{{< doc-test paths="install-httpbin" >}}
YAMLTest -f - <<'EOF'
- name: wait for httpbin HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
- name: wait for httpbin HTTPRoute refs to be resolved
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin
    jsonPath: "$.status.parents[0].conditions[?(@.type=='ResolvedRefs')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

### Step 3: Send a request to the httpbin app

Send a request to the httpbin app through the agentgateway proxy.

{{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}
1. Get the external address of the gateway proxy and save it in an environment variable.

   ```sh,paths="install-httpbin"
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```

2. Send a request to the httpbin app and verify that you get back a 200 HTTP response code. Note that it might take a few seconds for the load balancer service to become fully ready and accept traffic.

   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/headers -H "host: www.example.com"
   ```

   Example output:

   ```txt
   HTTP/1.1 200 OK
   access-control-allow-credentials: true
   access-control-allow-origin: *
   content-type: application/json; encoding=utf-8
   date: Thu, 13 Feb 2025 18:49:32 GMT
   content-length: 330
   x-envoy-upstream-service-time: 4
   server: envoy
   ```
   ```json
   {
     "headers": {
      "Accept": [
        "*/*"
      ],
      "Host": [
        "www.example.com"
      ],
      "User-Agent": [
        "curl/8.7.1"
      ]
    }
   }
   ```
{{% /tab %}}
{{% tab tabName="Port-forward for local testing"%}}
1. Port-forward the gateway proxy `http` pod on port 8080.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```

2. Send a request to the httpbin app and verify that you get back a 200 HTTP response code.

   ```sh
   curl -i localhost:8080/headers -H "host: www.example.com"
   ```

   Example output:

   ```txt
   HTTP/1.1 200 OK
   access-control-allow-credentials: true
   access-control-allow-origin: *
   content-type: application/json; encoding=utf-8
   date: Thu, 13 Feb 2025 18:49:32 GMT
   content-length: 330
   x-envoy-upstream-service-time: 4
   server: envoy
   ```
   ```json
   {
     "headers": {
       "Accept": [
         "*/*"
       ],
       "Host": [
         "www.example.com"
       ],
       "User-Agent": [
         "curl/8.7.1"
       ]
     }
   }
   ```
{{% /tab %}}
{{< /tabs >}}

{{% /steps %}}

## Next steps

Now that you have {{< reuse "/agw-docs/snippets/kgateway.md" >}} set up and running, check out the following guides to expand your API gateway capabilities.

{{< cards >}}
  {{< card link="traffic-management" title="Traffic management" subtitle="Add routing capabilities to your httpbin route." >}}
  {{< card link="resiliency" title="Resiliency" subtitle="Make your routes more resilient to failures and disruptions." >}}
  {{< card link="security" title="Security" subtitle="Secure routes with external authentication and rate limiting policies." >}}
{{< /cards >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}


1. Delete the httpbin app.

   ```sh
   kubectl delete -f https://raw.githubusercontent.com/kgateway-dev/kgateway/refs/heads/{{< reuse "agw-docs/versions/github-branch.md" >}}/examples/httpbin.yaml
   ```

2. Delete the HTTPRoute.

   ```sh
   kubectl delete httproute httpbin -n httpbin
   ```

3. Delete the Gateway.

   ```sh
   kubectl delete gateway http -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
