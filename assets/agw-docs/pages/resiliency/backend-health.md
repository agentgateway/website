Agentgateway continuously tracks the health of the endpoints behind a backend and can automatically remove, or *evict*, endpoints that return errors, then gradually restore them as they recover. This passive health checking (also known as outlier detection) is built into the load balancer, so it applies to any backend, including regular Kubernetes Services, not just LLM providers.

Unlike active health checks that probe endpoints on a schedule, passive health checking observes the responses from real traffic. When an endpoint's responses match an unhealthy condition that you define, its health score drops. If the score crosses the eviction threshold, the gateway stops sending new requests to that endpoint for a backoff period, then returns it to the pool to see whether it recovered.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## How backend health checking works {#about}

You configure backend health checking in the `health` field of a backend policy. The `health` field has two parts:

* **`unhealthyCondition`**: A CEL expression that is evaluated against each response. When the expression returns `true`, the response is counted as unhealthy. If you do not set this field, any `5xx` response or connection failure is treated as unhealthy, which lowers the endpoint's health score but does not trigger eviction on its own.
* **`eviction`**: The settings that control when an unhealthy endpoint is evicted and how it recovers, such as how many consecutive failures to allow before eviction (`consecutiveFailures`), how long to evict the endpoint for (`duration`), and the health score to restore it with (`restoreHealth`).

When every endpoint of a backend is evicted, the load balancer falls back to returning evicted endpoints rather than failing requests entirely. As such, you typically observe eviction in action only when a backend has multiple endpoints and some of them are healthy.

## Configure backend health checking {#configure}

The following example evicts an httpbin endpoint after it returns three consecutive `5xx` responses, keeps it out of the pool for 30 seconds, and then restores it with full health. Restoring full health does not guarantee that the endpoint has recovered. If it keeps failing, it is evicted again, but each subsequent eviction lasts longer because the `duration` uses a multiplicative backoff. This backoff prevents a tight evict-restore-fail loop from sending a steady stream of traffic to a persistently broken endpoint. To restore the endpoint more cautiously, set `restoreHealth` below 100 so that it returns with a degraded health score and receives less traffic until it proves healthy.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that applies backend health settings to the httpbin Service. Because the policy targets a Service, create it in the same namespace as the Service.

   ```yaml {paths="backend-health"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: httpbin-health
     namespace: httpbin
   spec:
     targetRefs:
     - group: ""
       kind: Service
       name: httpbin
     backend:
       health:
         unhealthyCondition: 'response.code >= 500'
         eviction:
           consecutiveFailures: 3
           duration: 30s
           restoreHealth: 100
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `targetRefs` | The backend to apply the health settings to. This example targets the httpbin Kubernetes Service (`group: ""`, `kind: Service`). You can also target an {{< reuse "agw-docs/snippets/backend.md" >}}. |
   | `backend.health.unhealthyCondition` | A CEL expression that is evaluated against each response. When it returns `true`, the response counts as unhealthy. This example treats any `5xx` response as unhealthy. |
   | `backend.health.eviction.consecutiveFailures` | The number of consecutive unhealthy responses required before the endpoint is evicted. |
   | `backend.health.eviction.duration` | The base amount of time to evict the endpoint for. Subsequent evictions use a multiplicative backoff. |
   | `backend.health.eviction.restoreHealth` | The health score from 0 to 100 to assign the endpoint when it returns from eviction. Set a value below 100 for gradual recovery, or 100 to restore it immediately. |

2. Port-forward the gateway proxy on port 15000.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

3. Get the config dump and verify that the health policy is applied to the httpbin Service.

   Example `jq` command:
   ```sh
   curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.name.name == "httpbin-health")] | .[0]'
   ```

   Example output: Note that the gateway reports your `unhealthyCondition` as `unhealthyExpression`, and normalizes the `restoreHealth` value of `100` to its internal `1` (100%).
   ```json {filename="http://localhost:15000/config_dump"}
   {
     "key": "httpbin/httpbin-health:health:httpbin/httpbin.httpbin.svc.cluster.local",
     "name": {
       "kind": "AgentgatewayPolicy",
       "name": "httpbin-health",
       "namespace": "httpbin"
     },
     "target": {
       "backend": {
         "service": {
           "hostname": "httpbin.httpbin.svc.cluster.local",
           "namespace": "httpbin"
         }
       }
     },
     "policy": {
       "backend": {
         "health": {
           "unhealthyExpression": "response.code >= 500",
           "eviction": {
             "duration": "30s",
             "restoreHealth": 1,
             "consecutiveFailures": 3
           }
         }
       }
     }
   }
   ```

   {{< doc-test paths="backend-health" >}}
   # This test verifies that the health policy is accepted and present in the config dump.
   # Eviction behavior is not exercised here: the quickstart deploys a single httpbin endpoint,
   # so the load balancer falls back to the evicted endpoint instead of shifting traffic away.
   # Observing eviction requires multiple endpoints, which is called out in the manual steps below.
   YAMLTest -f - <<'EOF'
   - name: wait for httpbin-health policy to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: httpbin
           name: httpbin-health
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 300
         intervalSeconds: 5
   - name: wait for httpbin-health policy in config dump
     retries: 20
     http:
       url: http://localhost:15000
       skipSslVerification: true
       method: GET
       path: /config_dump
     source:
       type: pod
       usePortForward: true
       selector:
         kind: Deployment
         metadata:
           namespace: agentgateway-system
           name: agentgateway-proxy
     expect:
       bodyContains:
       - '"httpbin-health"'
       - '"unhealthyExpression"'
   EOF
   {{< /doc-test >}}

4. Send requests to the httpbin app to confirm that healthy traffic still flows. The `/headers` endpoint returns a `200` response code, and the `/status/503` endpoint simulates an unhealthy backend response that matches your `unhealthyCondition`.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com"
   curl -i "http://${INGRESS_GW_ADDRESS}:80/status/503" -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   In a separate terminal, port-forward the gateway proxy on port 8080.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```

   ```sh
   curl -i "http://localhost:8080/headers" -H "host: www.example.com"
   curl -i "http://localhost:8080/status/503" -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   The `/headers` request returns a `200` response, and the `/status/503` request returns a `503`. With a single httpbin endpoint, the gateway falls back to the evicted endpoint instead of failing requests. To observe eviction shifting traffic away from an unhealthy endpoint, scale the backend to multiple endpoints.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} httpbin-health -n httpbin
```
