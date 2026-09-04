Set deadlines for connecting to a backend and receiving its response. Backend
timeouts apply to a selected destination, so you configure them in the
`backend` section of an {{< reuse "agw-docs/snippets/policy.md" >}}.

A backend connection timeout starts when agentgateway begins to open a
connection to the destination, and ends when the TCP connection is established.
A backend response timeout starts when agentgateway sends the request to the
destination, and ends when the complete response is received. For the other
timeout types and where each one attaches, see
[About timeouts]({{< link-hextra path="/resiliency/timeouts/about/" >}}).

Set the request timeout long enough to include backend calls and any retries. A
backend response timeout that is longer than the request timeout cannot extend
the overall deadline.

## Configure backend timeouts

The following example applies both backend timeout types to the `httpbin`
Service, so that they apply to every route that reaches that Service. Because
the policy targets a Service, create it in the same namespace as that Service.
To set the same deadlines on a route instead, see
[HTTP connection settings]({{< link-hextra path="/resiliency/connection/#backend" >}}).

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
   | `backend.http.requestTimeout` | Maximum time to receive the complete HTTP response from the destination. The value must be at least `1ms`. |

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
also a backend, and none of them carry a timeout field of their own. When the
integration references a Kubernetes Service, attach a separate
{{< reuse "agw-docs/snippets/policy.md" >}} to that Service and set
`backend.http.requestTimeout`, the same way as the preceding example. For a
worked example, see
[Configure the webhook timeout]({{< link-hextra path="/llm/guardrails/webhook/guardrails/#webhook-timeout" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="backend-timeouts"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} \
  httpbin-backend-timeouts -n httpbin
```

For the other destination settings that use the same attachment model, see
[Policy sections]({{< link-hextra path="/about/policies/overview/#backend-policy-fields" >}}).
