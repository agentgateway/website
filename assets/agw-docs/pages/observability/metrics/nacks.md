
The {{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy validates XDS updates from the control plane before applying them. A rejected resource produces a NACK (negative acknowledgement).

The proxy retains its last known-good configuration for that resource. Traffic continues, but the rejected change is not applied.

The control plane counts rejections in `agentgateway_xds_rejects_total` on port `9092`. It also creates a Kubernetes Warning event on the affected Gateway.

Rejections can occur when the proxy cannot parse a value accepted by the Kubernetes API server and control plane. One example is an invalid `agentRuntimeArn` in an {{< reuse "agw-docs/snippets/backend.md" >}}.

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
The proxy also reports problems it can work around, including invalid CEL expressions and TLS certificates. A CEL expression may pass the Go control plane validator but fail the Rust proxy parser.

The proxy applies the rest of the resource and replaces the invalid part, such as with an expression that always fails. The control plane counts these problems as rejections too.
{{< /version >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
If only part of a resource is unusable, the proxy can apply the rest and report a configuration warning. Warnings use a separate counter and event reason. See [View configuration warnings](#config-warnings).
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

A rejection creates a Kubernetes Warning event on the Gateway with reason `AgentGatewayNackError`. The message is a JSON list with these fields:

- `key`: The rejected resource.
- `error`: The error from the proxy.

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
For a problem that the proxy works around, such as a CEL expression that it cannot parse, the entry has a `warn` field instead of an `error` field.
{{< /version >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
The resource status does not show the rejection. For example, an {{< reuse "agw-docs/snippets/backend.md" >}} with an invalid `agentRuntimeArn` still reports `Accepted: True`.
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

When the proxy can apply a resource after ignoring or replacing an invalid part, it reports a configuration warning. The control plane records warnings separately:

- **Counter**: `agentgateway_xds_warnings_total`.
- **Gateway event**: A Kubernetes Warning event with reason `AgentGatewayConfigWarning`.

Warnings do not increase `agentgateway_xds_rejects_total`.

Common causes of warnings:

- CEL expressions that pass the Go-based control plane validator but fail the Rust-based proxy parser, such as calling `has()` with an invalid argument. The proxy replaces the expression with one that always fails.
- Invalid regular expressions in route paths or prompt guards. Invalid path patterns never match. The proxy skips invalid prompt guard patterns.
- Invalid TLS certificates that the proxy cannot load.

Warnings describe how the proxy handled each problem. Fix them as configuration errors: traffic may behave differently from your configuration.

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

3. List warning events in the Gateway namespace.

   Each JSON message entry uses `key` for the resource and `warn` for the proxy warning.

   ```sh
   kubectl get events -n {{< reuse "agw-docs/snippets/namespace.md" >}} --field-selector=reason=AgentGatewayConfigWarning
   ```

   Example output:

   ```console
   LAST SEEN   TYPE      REASON                      OBJECT                       MESSAGE
   8s          Warning   AgentGatewayConfigWarning   gateway/agentgateway-proxy   [{"key":"policy/traffic/agentgateway-system/priority-header:transformation:agentgateway-system/httpbin","warn":"invalid CEL expression for transformation: parse: ERROR: <input>:1:20: invalid argument to has() macro\n| has(request.headers['x-priority-level']) ? 'level_' + request.headers['x-priority-level'] : 'level_unknown'\n| ...................^; replacing \"has(request.headers['x-priority-level']) ? 'level_' + request.headers['x-priority-level'] : 'level_unknown'\" with an expression that always fails"}]
   ```
{{< /version >}}
