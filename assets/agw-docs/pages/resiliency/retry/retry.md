Specify the number of times and duration for the gateway to try a connection to an unresponsive backend service.<!--
You might commonly use retries alongside [Timeouts]({{< link-hextra path="/resiliency/timeouts/">}}) to ensure that your apps are available even if they are temporarily unavailable. -->

{{< callout type="warning" >}} 
{{< reuse "agw-docs/versions/warn-experimental.md" >}}
{{< /callout >}}

## About request retries

A request retry is the number of times a request is retried if it fails. This setting can be useful to avoid your apps from failing if they are temporarily unavailable. With retries, calls are retried a certain number of times before they are considered failed. Retries can enhance your app's availability by making sure that calls don't fail permanently because of transient problems, such as a temporarily overloaded service or network.

<!-- TO DO: Is the sample app needed since another is installed? -->
{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}
 

## Step 1: Set up your environment

1. Install the experimental Kubernetes Gateway API CRDs.

   ```sh
   kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/experimental-install.yaml
   ```
   

## Step 2: Set up request retries {#setup-retries}

Set up retries to the sample app.

1. Create an HTTPRoute resource to specify your retry rules. You can apply the retry policy on an HTTPRoute, HTTPRoute rule, or Gateway listener. 
   {{< tabs tabTotal="3" items="HTTPRoute (Kubernetes GW API),HTTPRoute and rule (AgentgatewayPolicy),Gateway listener" >}}
   {{% tab tabName="HTTPRoute (Kubernetes GW API)" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: retry
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     hostnames:
     - retry.example
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches: 
       - path:
           type: PathPrefix
           value: /
       backendRefs:
       - group: ""
         kind: Service
         name: httpbin
         namespace: httpbin
         port: 8000
       retry:
         attempts: 3
         backoff: 1s      
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Field | Description |
   |-------|-------------|
   | `hostnames` | The hostnames to match the request, such as `retry.example`. |
   | `parentRefs` | The gateway to which the request is sent. In this example, you select the `agentgateway-proxy` gateway that you set up before you began. |
   | `rules` | The rules to apply to requests. |
   | `matches` | The path to match the request. In this example, you match any requests to the sample app with `/`. |
   | `path` | The path to match the request. In this example, you match the request to the `/httpbin/1` path. |
   | `backendRefs` | The backend service to which the request is sent. In this example, you select the `httpbin` service that you set up in the previous step. |
   | `retry.attempts` | The number of times to retry the request. In this example, you retry the request 3 times. |
   | `retry.backoff` | The duration to wait before retrying the request. In this example, you wait 1 second before retrying the request. |

2. Verify that the gateway proxy is configured to retry the request.

   1. Port-forward the gateway proxy on port 15000.

      ```sh
      kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
      ```

   2. Get the configuration of your gateway proxy as a config dump.

      ```sh
      http://localhost:15000/config_dump
      ```

   3. Find the route configuration for the cluster in the config dump. Verify that the retry policy is set as you configured it.
      
      Example `jq` command:
      
      ```sh
      jq '.listeners."agentgateway-system/agentgateway-proxy.http".routes | to_entries[] | select(.value.name == "retry" and (.value.inlinePolicies[]? | has("retry"))) | .value'
      ```

      Example output:
      ```json {linenos=table,hl_lines=[57,58,59,60,61],filename="http://localhost:15000/config_dump"}
      ...
      "listeners": {
        "agentgateway-system/agentgateway-proxy.http": {
          "key": "agentgateway-system/agentgateway-proxy.http",
          "gatewayName": "agentgateway-proxy",
          "gatewayNamespace": "agentgateway-system",
          "listenerName": "http",
          "hostname": "",
          "protocol": "HTTP",
          "routes": {
            "httpbin/httpbin.0.0.http": {
              "key": "httpbin/httpbin.0.0.http",
              "name": "httpbin",
              "namespace": "httpbin",
              "hostnames": [
                "www.example.com"
              ],
              "matches": [
                {
                  "path": {
                    "pathPrefix": "/"
                  }
                }
              ],
              "backends": [
                {
                  "weight": 1,
                  "service": {
                    "name": "httpbin/httpbin.httpbin.svc.cluster.local",
                    "port": 8000
                  }
                }
              ]
            },
            "agentgateway-system/retry.0.0.http": {
              "key": "agentgateway-system/retry.0.0.http",
              "name": "retry",
              "namespace": "agentgateway-system",
              "hostnames": [
                "retry.example"
              ],
              "matches": [
                {
                  "path": {
                    "pathPrefix": "/"
                  }
                }
              ],
              "backends": [
                {
                  "weight": 0,
                  "invalid": null
                }
              ],
              "inlinePolicies": [
                {
                  "retry": {
                    "attempts": 3,
                    "backoff": "1s",
                    "codes": []
                  }
                }
              ]
            }
          },
          "tcpRoutes": {}
        }
      }
      ...
      ```
   
   {{% /tab %}}
   {{% tab tabName="HTTPRoute (AgentgatewayPolicy)" %}}
   1. Create an HTTPRoute that routes requests along the `retry.example` domain to the sample app.
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: retry
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      spec:
        hostnames:
        - retry.example
        parentRefs:
        - group: gateway.networking.k8s.io
          kind: Gateway
          name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
          - path:
              type: PathPrefix
              value: /
          backendRefs:
          - group: ""
            kind: Service
            name: httpbin
            namespace: httpbin
            port: 8000 
      EOF
      ```
   2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies a retry policy to the HTTPRoute rule. 
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
      kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
      metadata:
        name: retry
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      spec:
        targetRefs:
        - kind: HTTPRoute
          group: gateway.networking.k8s.io
          name: retry
        traffic:
          retry:
            attempts: 3
            backoff: 1s
            codes: [500, 503]
      EOF
      ```
      
      {{< reuse "agw-docs/snippets/review-table.md" >}}

      | Field | Description |
      |-------|-------------|
      | `targetRefs.sectionName` | Select the HTTPRoute rule that you want to apply the policy to. |
      | `retry.attempts` | The number of times to retry the request. In this example, you retry the request 3 times. |
      | `retry.backoff` | The duration to wait before retrying the request. In this example, you wait 1 second before retrying the request. |
      | `retry.codes` | The condition that must be met for the gateway proxy to retry the request. In this example, the request is retried if a 500 or 503 HTTP response code is returned. | 


   2. Verify that the gateway proxy is configured to retry the request.

   1. Port-forward the gateway proxy on port 15000.

      ```sh
      kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
      ```

   2. Get the configuration of your gateway proxy as a config dump.

      ```sh
      http://localhost:15000/config_dump
      ```

   3. Find the route configuration for the cluster in the config dump. Verify that the retry policy is set as you configured it.
      
      Example `jq` command:
      
      ```sh
      jq '.listeners."agentgateway-system/agentgateway-proxy.http".routes | to_entries[] | select(.value.name == "retry" and (.value.inlinePolicies[]? | has("retry"))) | .value'
      ```

      Example output:
      ```json {linenos=table,hl_lines=[60,61,62,63,64],filename="http://localhost:15000/config_dump"}
      ...
      "listeners": {
        "agentgateway-system/agentgateway-proxy.http": {
          "key": "agentgateway-system/agentgateway-proxy.http",
          "gatewayName": "agentgateway-proxy",
          "gatewayNamespace": "agentgateway-system",
          "listenerName": "http",
          "hostname": "",
          "protocol": "HTTP",
          "routes": {
            "httpbin/httpbin.0.0.http": {
              "key": "httpbin/httpbin.0.0.http",
              "name": "httpbin",
              "namespace": "httpbin",
              "hostnames": [
                "www.example.com"
              ],
              "matches": [
                {
                  "path": {
                    "pathPrefix": "/"
                  }
                }
              ],
              "backends": [
                {
                  "weight": 1,
                  "service": {
                    "name": "httpbin/httpbin.httpbin.svc.cluster.local",
                    "port": 8000
                  }
                }
              ]
            },
            "agentgateway-system/retry.0.0.http": {
              "key": "agentgateway-system/retry.0.0.http",
              "name": "retry",
              "namespace": "agentgateway-system",
              "hostnames": [
                "retry.example"
              ],
              "matches": [
                {
                  "path": {
                    "pathPrefix": "/"
                  }
                }
              ],
              "backends": [
                {
                  "weight": 1,
                  "service": {
                    "name": "agentgateway-system/agentgateway-proxy.agentgateway-system.svc.cluster.local",
                    "port": 9080
                  }
                }
              ],
              "inlinePolicies": [
                {
                  "retry": {
                    "attempts": 3,
                    "backoff": "1s",
                    "codes": []
                  }
                }
              ]
            }
          },
          "tcpRoutes": {}
        }
      }
      ...
      ```

   
   {{% /tab %}}
   {{% tab tabName="Gateway listener" %}}
   1. Create an HTTPRoute that routes requests along the `retry.example` domain to the sample app. 
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: retry
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      spec:
        hostnames:
        - retry.example
        parentRefs:
        - group: gateway.networking.k8s.io
          kind: Gateway
          name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
          - path:
              type: PathPrefix
              value: /
          backendRefs:
          - group: ""
            kind: Service
            name: httpbin
            namespace: httpbin
            port: 8000 
      EOF
      ```
   2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies a retry policy to the `agentgateway-proxy` Gateway listener. You set up this Gateway in the [before you begin](#before-you-begin) section.  
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
      kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
      metadata:
        name: retry
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      spec:
        targetRefs:
        - kind: Gateway
          group: gateway.networking.k8s.io
          name: agentgateway-proxy
          sectionName: http
        traffic:
          retry:
            attempts: 3
            backoff: 1s
            codes: [500, 503]
      EOF
      ```
      
      | Field | Description |
      |-------|-------------|
      | `targetRefs.sectionName` | Select the Gateway listener that you want to apply the policy to. |
      | `retry.attempts` | The number of times to retry the request. In this example, you retry the request 3 times. |
      | `retry.backoff` | The duration to wait before retrying the request. In this example, you wait 1 second before retrying the request. |
      | `retry.codes` | The condition that must be met for the gateway proxy to retry the request. In this example, the request is retried if a 500 or 503 HTTP response code is returned. | 

  2. Verify that the gateway proxy is configured to retry the request.

   1. Port-forward the gateway proxy on port 15000.

      ```sh
      kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
      ```

   2. Get the configuration of your gateway proxy as a config dump.

      ```sh
      http://localhost:15000/config_dump
      ```

   3. Find the route configuration for the cluster in the config dump. Verify that the retry policy is set as you configured it.
      
      Example `jq` command:
      
      ```sh
      jq '.listeners."agentgateway-system/agentgateway-proxy.http".routes | to_entries[] | select(.value.name == "retry" and (.value.inlinePolicies[]? | has("retry"))) | .value'
      ```

      Example output:
      ```json {linenos=table,hl_lines=[60,61,62,63,64],filename="http://localhost:15000/config_dump"}
      ...
      "listeners": {
        "agentgateway-system/agentgateway-proxy.http": {
          "key": "agentgateway-system/agentgateway-proxy.http",
          "gatewayName": "agentgateway-proxy",
          "gatewayNamespace": "agentgateway-system",
          "listenerName": "http",
          "hostname": "",
          "protocol": "HTTP",
          "routes": {
            "httpbin/httpbin.0.0.http": {
              "key": "httpbin/httpbin.0.0.http",
              "name": "httpbin",
              "namespace": "httpbin",
              "hostnames": [
                "www.example.com"
              ],
              "matches": [
                {
                  "path": {
                    "pathPrefix": "/"
                  }
                }
              ],
              "backends": [
                {
                  "weight": 1,
                  "service": {
                    "name": "httpbin/httpbin.httpbin.svc.cluster.local",
                    "port": 8000
                  }
                }
              ]
            },
            "agentgateway-system/retry.0.0.http": {
              "key": "agentgateway-system/retry.0.0.http",
              "name": "retry",
              "namespace": "agentgateway-system",
              "hostnames": [
                "retry.example"
              ],
              "matches": [
                {
                  "path": {
                    "pathPrefix": "/"
                  }
                }
              ],
              "backends": [
                {
                  "weight": 1,
                  "service": {
                    "name": "agentgateway-system/agentgateway-proxy.agentgateway-system.svc.cluster.local",
                    "port": 9080
                  }
                }
              ],
              "inlinePolicies": [
                {
                  "retry": {
                    "attempts": 3,
                    "backoff": "1s",
                    "codes": []
                  }
                }
              ]
            }
          },
          "tcpRoutes": {}
        }
      }
      ...
      ```

   {{% /tab %}}
   {{< /tabs >}}

END OF TABS


3. Send a request to the sample app. Verify that the request succeeds.
 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/httpbin/1 -H "host: retry.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/httpbin/1 -H "host: retry.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output for a successful response:

   ```
   HTTP/1.1 200 OK
   ...

   ```

4. Verify that the request was not retried.
   <!--
   ```sh
   kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l gateway.networking.k8s.io/gateway-name=agentgateway-proxy | tail -1 | jq
   ```
  
   Example output: Note that the `response_flags` field is `-`, which means that the request was not retried.

   ```json
   {
     "method": "GET",
     "path": "/httpbin/1",
     "response_code": 200,
     "response_flags": "-",
     "start_time": "2025-06-16T17:24:04.268Z",
     "upstream_cluster": "kube_default_httpbin_9080",
     "upstream_host": "10.244.0.24:9080"
   }
   ```
   -->

## Step 3: Trigger a retry {#trigger-retry}

Simulate a failure for the sample app so that you can verify that the request is retried.

1. Send the sample app to sleep, to simulate an app failure.

   ```sh
   kubectl -n httpbin patch deploy httpbin --patch '{"spec":{"template":{"spec":{"containers":[{"name":"httpbin","command":["sleep","20h"]}]}}}}'
   ```

2. Send another request to the sample app. This time, the request fails.
   
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/httpbin/1 -H "host: retry.example:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/httpbin/1 -H "host: retry.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   HTTP/1.1 503 Service Unavailable
   ...
   upstream connect error or disconnect/reset before headers. retried and the latest reset reason: remote connection failure, transport failure reason: delayed connect error: Connection refused
   ```

3. Verify that the request was retried.
   <!--
   ```sh
   kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l gateway.networking.k8s.io/gateway-name=http | tail -1 | jq
   ```

   Example output: Note that the `response_flags` field now has values as follows:

   * `URX` means `UpstreamRetryLimitExceeded`, which verifies that the request was retried.
   * `UF` means `UpstreamOverflow`, which verifies that the request failed.
   
   ```json
   {
     "method": "GET",
     "path": "/httpbin/1",
     "response_code": 503,
     "response_flags": "URX,UF",
     "start_time": "2025-06-16T17:26:07.287Z",
     "upstream_cluster": "kube_default_httpbin_9080",
     "upstream_host": "10.244.0.25:9080"
   }
   ```
   -->

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the HTTPRoute resource.
   
   ```sh
   kubectl delete httproute retry -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete httproute retry -n httpbin
   ```

2. Delete the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}.
   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} retry -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```





