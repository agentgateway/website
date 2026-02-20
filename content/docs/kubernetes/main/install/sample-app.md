---
title: Sample app
weight: 20
description: Set up the httpbin sample app to try traffic management, security, and resiliency guides.
---

You can set up the httpbin sample app. This app can be used to try out traffic management, security, and resiliency guides.

## Before you begin

Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).

## Install httpbin

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
3. Verify that the httpbin app is up and running.
   ```sh
   kubectl get pods -n httpbin
   ````
4. Create a route to the httpbin app.
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

5. Send a request to the httpbin app.
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
