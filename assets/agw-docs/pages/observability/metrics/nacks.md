
{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
When the {{< reuse "agw-docs/snippets/agentgateway.md" >}} control plane pushes an XDS configuration update to a proxy, the proxy validates the configuration before applying it. If the proxy rejects the configuration, such as because a CEL expression is syntactically valid in the Go-based control plane validator, but fails the Rust-based proxy validator, the rejection is called a NACK (negative acknowledgement). The proxy continues running on its last known-good configuration, so traffic keeps flowing, but the intended change is silently not applied.
{{< /version >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
When the {{< reuse "agw-docs/snippets/agentgateway.md" >}} control plane pushes an XDS configuration update to a proxy, the proxy validates the configuration before applying it. If the proxy rejects a resource, such as because a value passes the Kubernetes API server and the Go-based control plane, but the Rust-based proxy cannot parse it, the rejection is called a NACK (negative acknowledgement). The proxy continues running on its last known-good configuration, so traffic keeps flowing, but the intended change is silently not applied.
{{< /version >}}

The {{< reuse "agw-docs/snippets/agentgateway.md" >}} control plane tracks these rejections via the `agentgateway_xds_rejects_total` counter on port `9092`. When a rejection occurs, the control plane also creates a Kubernetes Warning event on the affected Gateway resource so you can identify which policy or route caused the rejection.

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
Common causes of rejections:

- CEL expressions in policies that pass the Go-based control plane validator but fail the Rust-based proxy validator, such as calling `has()` with an invalid argument.
- Invalid TLS certificates that the proxy cannot load.
{{< /version >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
Not every problem rejects a resource. When the proxy can load a resource but must ignore or replace part of it, such as a CEL expression that it cannot parse, the proxy applies the resource and reports a configuration warning instead. Warnings have their own counter and event reason. For more information, see [View configuration warnings](#config-warnings).
{{< /version >}}

## View the rejection metric

> [!NOTE]
> `agentgateway_xds_rejects_total` only appears after at least one rejection has occurred. If no rejections were recorded, the metric is not present.

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

You can use this metric to configure alerts in Prometheus that fire when rejections occur. For guidance on setting up the observability stack, see the [OTel stack guide]({{< link path="/documentation/observability/otel-stack/" >}}).

## View rejection events

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
When a rejection occurs, the control plane creates Kubernetes Warning events on both the Gateway and its corresponding Deployment resources. The event message includes the policy or route that caused the rejection and the error from the proxy.

**Example rejection event:**

```console
LAST SEEN   TYPE      REASON                  OBJECT                    MESSAGE
83s         Warning   AgentGatewayNackError   gateway/agentgateway      policy/traffic/default/example-agw-policy-for-body:transformation:default/example-route-for-body: error: parse: ERROR: <input>:1:20: invalid argument has(request.headers['x-priority-level']) ? 'level_' + request.headers['x-priority-level'] : 'level_unknown'
```
{{< /version >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
When a rejection occurs, the control plane creates a Kubernetes Warning event with the `AgentGatewayNackError` reason on the Gateway. The event message is a JSON list. In each entry, the `key` field names the resource that the proxy rejected, and the `error` field has the error from the proxy.

The status of the rejected resource does not show the rejection. For example, an {{< reuse "agw-docs/snippets/backend.md" >}} with an `agentRuntimeArn` value that is not a valid ARN reports `Accepted: True`, but the proxy rejects it.
{{< /version >}}

1. List rejection events in the namespace where your Gateway is deployed.

   ```sh {paths="nacks"}
   kubectl get events -n {{< reuse "agw-docs/snippets/namespace.md" >}} --field-selector=reason=AgentGatewayNackError
   ```
   {{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}

   Example output:

   ```console
   LAST SEEN   TYPE      REASON                  OBJECT                       MESSAGE
   8s          Warning   AgentGatewayNackError   gateway/agentgateway-proxy   [{"key":"backend/agentgateway-system/agentcore","error":"error: invalid AgentCore ARN: not-an-arn"}]
   ```
   {{< /version >}}

2. View events on the Gateway resource directly.

   ```sh {paths="nacks"}
   kubectl describe gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
   {{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}

   Example output, which also shows a [configuration warning](#config-warnings):

   ```console
   Events:
     Type     Reason                     Age    From                           Message
     ----     ------                     ----   ----                           -------
     Warning  AgentGatewayConfigWarning  8m33s  agentgateway.dev/agentgateway  [{"key":"policy/traffic/agentgateway-system/priority-header:transformation:agentgateway-system/httpbin","warn":"invalid CEL expression for transformation: ...
     Warning  AgentGatewayNackError      13s    agentgateway.dev/agentgateway  [{"key":"backend/agentgateway-system/agentcore","error":"error: invalid AgentCore ARN: not-an-arn"}]
   ```
   {{< /version >}}

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
## View configuration warnings {#config-warnings}

Some configuration problems do not stop the proxy from loading a resource. The proxy applies the resource, ignores or replaces the part that it cannot use, and reports a warning. The control plane counts warnings in the `agentgateway_xds_warnings_total` counter and creates a Kubernetes Warning event with the `AgentGatewayConfigWarning` reason on the Gateway. Warnings do not increase `agentgateway_xds_rejects_total`.

Common causes of warnings:

- CEL expressions that pass the Go-based control plane validator but fail the Rust-based proxy parser, such as calling `has()` with an invalid argument. The proxy replaces the expression with one that always fails.
- Regular expressions that the proxy cannot compile, such as in a route path match or a prompt guard. The proxy replaces an invalid path regex with a matcher that never matches, and skips an invalid prompt guard pattern.
- Invalid TLS certificates that the proxy cannot load.

The warning message describes how the proxy handled each problem. Because the proxy applies the rest of the resource, traffic can behave differently from what you configured, so treat warnings as configuration errors to fix.

> [!NOTE]
> In version 1.6 and earlier, the control plane reported these warnings as rejections, with the `AgentGatewayNackError` event reason and the `agentgateway_xds_rejects_total` counter. If your alerts watch for rejections, also alert on `agentgateway_xds_warnings_total`.

1. Port-forward the control plane deployment.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployment/{{< reuse "agw-docs/snippets/helm-agentgateway.md" >}} 9092
   ```

2. Query the metrics endpoint and search for the warning counter. Like the rejection counter, `agentgateway_xds_warnings_total` appears only after the first warning.

   ```sh
   curl -s http://localhost:9092/metrics | grep xds_warnings
   ```

   Example output:

   ```console
   # HELP agentgateway_xds_warnings_total Total number of xDS responses with configuration warnings from agentgateway proxy
   # TYPE agentgateway_xds_warnings_total counter
   agentgateway_xds_warnings_total 2
   ```

3. List warning events in the namespace where your Gateway is deployed. The event message is a JSON list. In each entry, the `key` field names the resource, and the `warn` field has the warning from the proxy.

   ```sh
   kubectl get events -n {{< reuse "agw-docs/snippets/namespace.md" >}} --field-selector=reason=AgentGatewayConfigWarning
   ```

   Example output:

   ```console
   LAST SEEN   TYPE      REASON                      OBJECT                       MESSAGE
   8s          Warning   AgentGatewayConfigWarning   gateway/agentgateway-proxy   [{"key":"policy/traffic/agentgateway-system/priority-header:transformation:agentgateway-system/httpbin","warn":"invalid CEL expression for transformation: parse: ERROR: <input>:1:20: invalid argument to has() macro\n| has(request.headers['x-priority-level']) ? 'level_' + request.headers['x-priority-level'] : 'level_unknown'\n| ...................^; replacing \"has(request.headers['x-priority-level']) ? 'level_' + request.headers['x-priority-level'] : 'level_unknown'\" with an expression that always fails"}]
   ```
{{< /version >}}
