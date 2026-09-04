
When the {{< reuse "agw-docs/snippets/agentgateway.md" >}} control plane pushes an XDS configuration update to a proxy, the proxy validates the configuration before applying it. If the proxy rejects the configuration, such as because a CEL expression is syntactically valid in the Go-based control plane validator, but fails the Rust-based proxy validator, the rejection is called a NACK (negative acknowledgement). The proxy continues running on its last known-good configuration, so traffic keeps flowing, but the intended change is silently not applied.

The {{< reuse "agw-docs/snippets/agentgateway.md" >}} control plane tracks these rejections via the `agentgateway_xds_rejects_total` counter on port `9092`. When a rejection occurs, the control plane also creates a Kubernetes Warning event on the affected Gateway resource so you can identify which policy or route caused the rejection.

Common causes of rejections:

- CEL expressions in policies that pass the Go-based control plane validator but fail the Rust-based proxy validator, such as calling `has()` with an invalid argument.
- Invalid TLS certificates that the proxy cannot load.

## View the rejection metric

> [!NOTE]
> `agentgateway_xds_rejects_total` only appears after at least one rejection has occurred. If no rejections were recoreded, the metric is not present.

1. Port-forward the control plane deployment.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployment/{{< reuse "agw-docs/snippets/helm-agentgateway.md" >}} 9092
   ```

2. Query the metrics endpoint and search for the rejection counter.

   ```sh
   curl http://localhost:9092/metrics | grep xds_rejects
   ```

   Example output when rejections have occurred:

   ```console
   # HELP agentgateway_xds_rejects_total Total number of xDS responses rejected by agentgateway proxy
   # TYPE agentgateway_xds_rejects_total counter
   agentgateway_xds_rejects_total 3
   ```

{{< doc-test paths="nacks" >}}
YAMLTest -f - <<'EOF'
- name: Control plane metrics endpoint is accessible
  retries: 3
  http:
    url: "http://localhost:9092/metrics"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

You can use this metric to configure alerts in Prometheus that fire when rejections occur. For guidance on setting up the observability stack, see the [OTel stack guide]({{< link path="/observability/otel-stack/" >}}).

## View rejection events

When a rejection occurs, the control plane creates Kubernetes Warning events on both the Gateway and its corresponding Deployment resources. The event message includes the policy or route that caused the rejection and the error from the proxy.

**Example rejection event:**

```console
LAST SEEN   TYPE      REASON                  OBJECT                    MESSAGE
83s         Warning   AgentGatewayNackError   gateway/agentgateway      policy/traffic/default/example-agw-policy-for-body:transformation:default/example-route-for-body: error: parse: ERROR: <input>:1:20: invalid argument has(request.headers['x-priority-level']) ? 'level_' + request.headers['x-priority-level'] : 'level_unknown'
```

1. List rejection events in the namespace where your Gateway is deployed.

   ```sh {paths="nacks"}
   kubectl get events -n {{< reuse "agw-docs/snippets/namespace.md" >}} --field-selector=reason=AgentGatewayNackError
   ```

2. View events on the Gateway resource directly.

   ```sh {paths="nacks"}
   kubectl describe gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
