Set deadlines for connecting to a backend and receiving its response. Backend
timeouts apply to a selected destination, so you configure them in the
`backend` section of an {{< reuse "agw-docs/snippets/policy.md" >}}.

## Choose the timeout

Agentgateway supports several timeout types at different request stages.

| Timeout | Field | Starts | Ends |
| -- | -- | -- | -- |
| Backend connection | `backend.tcp.connectTimeout` | When agentgateway starts to open a connection to the destination. | When the TCP connection is established. |
| Backend response | `backend.http.requestTimeout` | When agentgateway sends the request to the destination. | When agentgateway receives the complete response. |
| Route request | `traffic.timeouts.request` or `HTTPRoute.rules[].timeouts.request` | When agentgateway starts processing a request on the selected route. | When the request completes, including retries and backend calls. |
| Per-try | `HTTPRoute.rules[].timeouts.backendRequest` or an {{< reuse "agw-docs/snippets/policy.md" >}} timeout with a retry policy | When one retry attempt starts. | When that retry attempt completes. |
| Idle | Frontend HTTP fields | When a downstream or upstream connection stops transferring data. | When data transfer resumes or agentgateway closes the idle connection. |

Set the overall request timeout long enough to include backend calls and any
retries. A backend response timeout that is longer than the overall request
timeout cannot extend the overall deadline.

For route-scoped configuration, see
[Request timeouts]({{< link-hextra path="/resiliency/timeouts/request/" >}})
and [Per-try timeouts]({{< link-hextra path="/resiliency/retry/per-try-timeout/" >}}).

## Configure backend timeouts

The following example applies both backend timeout types to the `httpbin`
Service. Because the policy targets a Service, create it in the same namespace
as that Service.

1. Create the backend timeout policy.

   ```yaml {paths="backend-timeouts"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: httpbin-backend-timeouts
     namespace: httpbin
   spec:
     targetRefs:
     - group: ""
       kind: Service
       name: httpbin
     backend:
       tcp:
         connectTimeout: 2s
       http:
         requestTimeout: 5s
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `targetRefs` | The destination that receives the settings. To select one Service port, set `sectionName` to its numeric port. You can also target an {{< reuse "agw-docs/snippets/backend.md" >}}, route, route rule, listener, or Gateway. |
   | `backend.tcp.connectTimeout` | Maximum time to establish a connection to the destination. The value must be at least `100ms`. |
   | `backend.http.requestTimeout` | Maximum time to receive the complete HTTP response from the destination. |

2. Verify that the policy is accepted.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} \
     httpbin-backend-timeouts -n httpbin
   ```

3. Optional: Port-forward the proxy admin port to verify the effective settings.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000 &
   sleep 2
   curl -s http://localhost:15000/config_dump | \
     jq '[.policies[] | select(.name.name == "httpbin-backend-timeouts")] | .[0]'
   ```

{{< doc-test paths="backend-timeouts" >}}
YAMLTest -f - <<'EOF'
- name: wait for backend timeout policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: httpbin
        name: httpbin-backend-timeouts
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
- name: wait for backend timeouts in config dump
  retries: 20
  http:
    url: http://localhost:15000
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
    - '"httpbin-backend-timeouts"'
    - '"connectTimeout":"2s"'
    - '"requestTimeout":"5s"'
EOF
{{< /doc-test >}}

## Set a webhook timeout

A guardrail webhook, external authorization server, or external processor is
also a backend. When the integration references a Kubernetes Service, attach a
separate {{< reuse "agw-docs/snippets/policy.md" >}} to that Service and set
`backend.http.requestTimeout`.

For example, the following policy gives the `ai-guardrail-webhook` Service five
seconds to respond.

```yaml
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: guardrail-webhook-timeout
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: ai-guardrail-webhook
  backend:
    http:
      requestTimeout: 5s
```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="backend-timeouts"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} \
  httpbin-backend-timeouts -n httpbin
```

For other destination settings that use the same attachment model, see
[Backend policies]({{< link-hextra path="/about/policies/backend-policies/" >}}).
