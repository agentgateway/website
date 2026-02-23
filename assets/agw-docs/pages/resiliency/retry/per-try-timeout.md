Set separate timeouts for retries. 

{{< callout type="warning" >}} 
{{< reuse "agw-docs/versions/warn-experimental.md" >}}
{{< /callout >}}

## About per-try timeouts

The per-try timeout allows you to set a timeout for retried requests. If the timeout expires, the agentgateway proxy cancels the retry attempt and immediately retries on another upstream host. 

A request timeout represents the time the proxy waits for the entire request to complete, including retries. Without a per-try timeout, retries might take longer than the overall request timeout, and therefore might not be executed as the request times out before the retry attempts can be performed. You can configure a larger request timeout<!--[request timeout]({{< link-hextra path="/resiliency/timeouts/request/" >}})--> to account for this case. However, you can also define timeouts for each retry so that you can protect against slow retry attempts from consuming the entire request timeout.

Per-try timeouts can be configured on an HTTPRoute directly. To enable per-try timeouts on a Gateway listener level, use an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} instead. 




{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up per-try timeouts

1. Install the experimental Kubernetes Gateway API CRDs.
   
   ```sh
   kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/experimental-install.yaml --server-side
   ```

2. Configure the per-try timeout. You can apply the timeout to an HTTPRoute by using a Kubernetes Gateway API-native approach. To apply it to an HTTPRoute rule or Gateway listener, use an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource. 
   {{< tabs tabTotal="3" items="HTTPRoute (Kubernetes GW API),HTTPRoute (AgentgatewayPolicy),Gateway listener" >}}
   {{% tab tabName="HTTPRoute (Kubernetes GW API)" %}}
   Use the `timeouts.backendRequest` field to configure the per-try timeout. Note that you must set a retry policy also to configure a per-try timeout. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: retry
     namespace: httpbin
   spec:
     hostnames:
     - retry.example
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches: 
       - path:
           type: PathPrefix
           value: /
       backendRefs:
       - name: httpbin
         port: 8000
       retry:
         attempts: 3
         backoff: 1s  
         codes: 
         - 517
       timeouts:
         backendRequest: 5s 
   EOF
   ```

3. Verify that the gateway proxy is configured with the per-try timeout.

   1. Port-forward the gateway proxy on port 15000.

      ```sh
      kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
      ```

   2. Get the configuration of your gateway proxy as a config dump and find the route configuration for the cluster. Verify that the policy is set as you configured it, with both a retry and a timeout.
      
      Example `jq` command:
      ```sh
      curl -s http://localhost:15000/config_dump | jq '[.binds[].listeners | to_entries[] | select(.value.routes | to_entries | any(.value.name == "retry")) | { key: .key, value: (.value | .routes = ((.routes | to_entries | map(select(.value.name == "retry")) | from_entries))) } ] | .[0] | .key as $k | .value as $v | {($k): $v}'
      ```

      Example output:
      ```json {linenos=table,hl_lines=[34,35,36,37,38,39,40,41,42,43,44,45],filename="http://localhost:15000/config_dump"}
      ...
      "agentgateway-system/agentgateway-proxy.http": {
        "key": "agentgateway-system/agentgateway-proxy.http",
        "gatewayName": "agentgateway-proxy",
        "gatewayNamespace": "agentgateway-system",
        "listenerName": "http",
        "hostname": "",
        "protocol": "HTTP",
        "routes": {
          "httpbin/retry.0.0.http": {
            "key": "httpbin/retry.0.0.http",
            "name": "retry",
            "namespace": "httpbin",
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
                  "name": "httpbin/httpbin.httpbin.svc.cluster.local",
                  "port": 8000
                }
              }
            ],
            "inlinePolicies": [
              {
                "timeout": {
                  "backendRequestTimeout": "5s"
                }
              },
              {
                "retry": {
                  "attempts": 3,
                  "backoff": "1s",
                  "codes": [517]
                }
              }
            ]
          }
        }}
      ...
      ```

   {{% /tab %}}
   {{% tab tabName="HTTPRoute (AgentGatewayPolicy)" %}}
   1. Create an HTTPRoute to route requests along the `retry.example` domain to the httpbin app. Note that you add a name `timeout` to your HTTPRoute rule so that you can configure the per-try timeout for that rule later. 
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: retry
        namespace: httpbin
      spec:
        hostnames:
        - retry.example
        parentRefs:
        - name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
          - path:
              type: PathPrefix
              value: /
          backendRefs:
          - name: httpbin
            port: 8000
          name: timeout 
      EOF
      ```
   2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to configure the per-try timeout. In this example, the per-try timeout is set to 5 seconds and assigned to the `timeout` HTTPRoute rule. Note that you must set a retry policy also to apply a per-try timeout. 
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
      kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
      metadata:
        name: retry
        namespace: httpbin
      spec:
        targetRefs:
        - kind: HTTPRoute
          group: gateway.networking.k8s.io
          name: retry
          sectionName: timeout
        traffic:
          retry:
            attempts: 3
            backoff: 1s
            codes: [517]
          timeouts:
            request: 5s 
      EOF
      ```

3. Verify that the gateway proxy is configured with the per-try timeout.

   1. Port-forward the gateway proxy on port 15000.

      ```sh
      kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
      ```

   2. Get the configuration of your gateway proxy as a config dump and find the route configuration for the cluster. Verify that the policy is set as you configured it, with both a retry and a timeout.
      
      Example `jq` command:
      ```sh
      curl -s http://localhost:15000/config_dump | jq '[.. | objects | select(has("policy") and .policy.traffic? and ((.policy.traffic.retry? != null) or (.policy.traffic.timeout? != null)) and .name.name? == "retry")] | { retry: (map(select(.policy.traffic.retry?)) | .[0]), timeout: (map(select(.policy.traffic.timeout?)) | .[0]) }'
      ```

      Example output:
      ```json {linenos=table,hl_lines=[20,21,22,23,24,25,26,47,48,49],filename="http://localhost:15000/config_dump"}
      ...
      {
        "retry": {
          "key": "traffic/httpbin/retry:retry:httpbin/retry/timeout",
          "name": {
            "kind": "AgentgatewayPolicy",
            "name": "retry",
            "namespace": "httpbin"
          },
          "target": {
            "route": {
              "name": "retry",
              "namespace": "httpbin",
              "ruleName": "timeout"
            }
          },
          "policy": {
            "traffic": {
              "phase": "route",
              "retry": {
                "attempts": 3,
                "backoff": "1s",
                "codes": [
                  "517 <unknown status code>"
                ]
              }
            }
          }
        },
        "timeout": {
          "key": "traffic/httpbin/retry:timeout:httpbin/retry/timeout",
          "name": {
            "kind": "AgentgatewayPolicy",
            "name": "retry",
            "namespace": "httpbin"
          },
          "target": {
            "route": {
              "name": "retry",
              "namespace": "httpbin",
              "ruleName": "timeout"
            }
          },
          "policy": {
            "traffic": {
              "phase": "route",
              "timeout": {
                "requestTimeout": "5s"
              }
            }
          }
        }
      }
      ...
      ```
   
   {{% /tab %}}
   {{% tab tabName="Gateway listener" %}}
   1. Create an HTTPRoute to route requests along the `retry.example` domain to the httpbin app. 
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: HTTPRoute
      metadata:
        name: retry
        namespace: httpbin
      spec:
        hostnames:
        - retry.example
        parentRefs:
        - name: agentgateway-proxy
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        rules:
        - matches: 
          - path:
              type: PathPrefix
              value: /
          backendRefs:
          - name: httpbin
            port: 8000
      EOF
      ```
   2. Create {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to configure the per-try timeout. In this example, the per-try timeout is set to 5 seconds and assigned to the `http` Gateway listener that you set up as part of the [before you begin](#before-you-begin) section. Note that you must set a retry policy also to apply a per-try timeout. 
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
      kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
      metadata:
        name: retry
        namespace: httpbin
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
            codes: [517]
          timeouts:
            request: 5s 
      EOF
      ```

3. Verify that the gateway proxy is configured with the per-try timeout.

   1. Port-forward the gateway proxy on port 15000.

      ```sh
      kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
      ```

   2. Get the configuration of your gateway proxy as a config dump and find the route configuration for the cluster. Verify that the policy is set as you configured it, with both a retry and a timeout.
      
      Example `jq` command:
      ```sh
      curl -s http://localhost:15000/config_dump | jq '[.. | objects | select(has("policy") and .policy.traffic? and ((.policy.traffic.retry? != null) or (.policy.traffic.timeout? != null)) and .name.name? == "retry")] | { retry: (map(select(.policy.traffic.retry?)) | .[0]), timeout: (map(select(.policy.traffic.timeout?)) | .[0]) }'
      ```

      Example output:
      ```json {linenos=table,hl_lines=[20,21,22,23,24,25,26,47,48,49],filename="http://localhost:15000/config_dump"}
      ...
      {
        "retry": {
          "key": "traffic/httpbin/retry:retry:httpbin/agentgateway-proxy/http",
          "name": {
            "kind": "AgentgatewayPolicy",
            "name": "retry",
            "namespace": "httpbin"
          },
          "target": {
            "gateway": {
              "gatewayName": "agentgateway-proxy",
              "gatewayNamespace": "httpbin",
              "listenerName": "http"
            }
          },
          "policy": {
            "traffic": {
              "phase": "route",
              "retry": {
                "attempts": 3,
                "backoff": "1s",
                "codes": [
                  "517 <unknown status code>"
                ]
              }
            }
          }
        },
        "timeout": {
          "key": "traffic/httpbin/retry:timeout:httpbin/agentgateway-proxy/http",
          "name": {
            "kind": "AgentgatewayPolicy",
            "name": "retry",
            "namespace": "httpbin"
          },
          "target": {
            "gateway": {
              "gatewayName": "agentgateway-proxy",
              "gatewayNamespace": "httpbin",
              "listenerName": "http"
            }
          },
          "policy": {
            "traffic": {
              "phase": "route",
              "timeout": {
                "requestTimeout": "5s"
              }
            }
          }
        }
      }
      ...
      ```
   {{% /tab %}}
   {{< /tabs >}}






## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}
   
```sh
kubectl delete httproute retry -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} retry -n httpbin
```





