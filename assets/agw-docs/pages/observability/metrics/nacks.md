
When the {{< reuse "agw-docs/snippets/agentgateway.md" >}} control plane pushes an XDS configuration update to a proxy, the proxy validates the configuration before applying it. If the proxy rejects a resource, the rejection is called a NACK (negative acknowledgement). The proxy continues running on its last known-good configuration for that resource, so traffic keeps flowing, but the intended change is silently not applied.

The {{< reuse "agw-docs/snippets/agentgateway.md" >}} control plane tracks these rejections via the `agentgateway_xds_rejects_total` counter on port `9092`. When a rejection occurs, the control plane also creates a Kubernetes Warning event on the affected Gateway resource so you can identify which policy or route caused the rejection.

A common cause of rejections is a value that the Kubernetes API server and the control plane accept, but that the proxy cannot parse, such as an `agentRuntimeArn` value in an {{< reuse "agw-docs/snippets/backend.md" >}} that is not a valid ARN.

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
The proxy also reports problems that it can work around, such as a CEL expression that the Go-based control plane validator accepts but the Rust-based proxy cannot parse, or a TLS certificate that the proxy cannot load. For these problems, the proxy applies the rest of the resource and replaces the invalid part, such as with a CEL expression that always fails. The control plane counts these problems as rejections too.
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

When a rejection occurs, the control plane creates a Kubernetes Warning event with the `AgentGatewayNackError` reason on the Gateway. The event message is a JSON list. In each entry, the `key` field names the resource that the proxy rejected, and the `error` field has the error from the proxy.

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
For a problem that the proxy works around, such as a CEL expression that it cannot parse, the entry has a `warn` field instead of an `error` field.
{{< /version >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
The status of the rejected resource does not show the rejection. For example, an {{< reuse "agw-docs/snippets/backend.md" >}} with an `agentRuntimeArn` value that is not a valid ARN reports `Accepted: True`, but the proxy rejects it.
{{< /version >}}

1. List rejection events in the namespace where your Gateway is deployed.

   ```sh {paths="nacks"}
   kubectl get events -n {{< reuse "agw-docs/snippets/namespace.md" >}} --field-selector=reason=AgentGatewayNackError
   ```

   Example output:

   ```console
   LAST SEEN   TYPE      REASON                  OBJECT                       MESSAGE
   8s          Warning   AgentGatewayNackError   gateway/agentgateway-proxy   [{"key":"backend/agentgateway-system/agentcore","error":"error: invalid AgentCore ARN: not-an-arn"}]
   ```

2. View events on the Gateway resource directly.

   ```sh {paths="nacks"}
   kubectl describe gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```console
   Events:
     Type     Reason                 Age   From                           Message
     ----     ------                 ----  ----                           -------
     Warning  AgentGatewayNackError  13s   agentgateway.dev/agentgateway  [{"key":"backend/agentgateway-system/agentcore","error":"error: invalid AgentCore ARN: not-an-arn"}]
   ```

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
