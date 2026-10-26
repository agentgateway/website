---
title: Debug your setup
weight: 15
description: Debug your agentgateway environment.
---

Inspect and troubleshoot agentgateway proxies through the admin endpoints and the [`agctl`]({{< link-hextra path="/documentation/operations/agctl" >}}) command-line tool. If you need help from the community or support, [collect a bug report](#bug-report) that captures the state of your setup.

## Admin endpoints

Each agentgateway pod runs an admin server on port `15000`. The admin server provides the following endpoints for inspection and debugging.

| Endpoint | Description |
| -- | -- |
| `/config_dump` | Returns the runtime configuration that the proxy has loaded, including binds, listeners, routes, backends, workloads, services, and policies. |
| `/debug/trace` | Streams a JSON-over-SSE trace of the next request that the proxy handles. The `agctl proxy trace` command consumes this endpoint. |
| `/logging` | Get and set the logging level at runtime. |
| `/memory` | Dump allocator and process memory statistics. |
| `/debug/pprof/profile` | Build a CPU profile by using the [pprof](https://github.com/google/pprof) profiler. Use `?seconds=N` to set the duration (1–300s, default 10s) and `?frequency=N` to set the sampling rate in Hz (1–1000, default 100). |
| `/debug/pprof/heap` | Collect heap profiling data. |
| `/debug/tasks` | Inspect the live tokio task tree. |
| `/quitquitquit` | Trigger a graceful shutdown of the proxy. |

To inspect the configuration that a gateway proxy has loaded and to capture per-request traces, use the [`agctl`]({{< link-hextra path="/documentation/operations/agctl" >}}) command-line tool. `agctl` resolves the proxy pod for you, opens a port-forward, and renders the admin output in formats that are easier to scan than raw JSON.

## Before you begin

[Install agctl]({{< link-hextra path="/documentation/operations/agctl" >}}).

## Check the gateway, route, and policy status

Most routing and policy issues surface in the status of the corresponding Kubernetes resource. Check these first.

1. Verify that the agentgateway control plane and proxy pods are running.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   kubectl get pods -n <namespace>
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   kubectl get pods -n agentgateway-system
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Verify the Gateway is `Accepted` and `Programmed`.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   kubectl get gateway -A
   kubectl get gateway <name> -n <namespace> -o yaml
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   kubectl get gateway agentgateway-proxy -n agentgateway-system -o yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Check the HTTPRoute for `Accepted` and `ResolvedRefs` conditions.

   ```sh
   kubectl get httproute -A
   ```

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   kubectl get httproute <name> -n <namespace> -o yaml
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   kubectl get httproute openai -n agentgateway-system -o yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Common issues to check for:

   * The wrong backend is selected.
   * The wrong parent Gateway is referenced.
   * Multiple HTTPRoutes conflict by having identical matchers or by having no matchers (and so default to `/`).

4. If the route sends traffic to an InferencePool, check the pool status for endpoint picker configuration errors.

   ```sh
   kubectl get inferencepool <name> -n <namespace> -o yaml
   ```

   An InferencePool that omits `spec.endpointPickerRef` reports `Accepted=False` with `reason: EndpointPickerRefMissing`. Add an endpoint picker reference before you debug route matching or proxy configuration.

5. Check {{< reuse "agw-docs/snippets/backend.md" >}} and {{< reuse "agw-docs/snippets/policy.md" >}} resources for partial acceptance. A resource can report `Accepted=True` with `reason: PartiallyValid` when the controller keeps the usable parts of a backend or policy and reports the invalid part in the condition message.

   1. Find the backends and policies that report `PartiallyValid`. The `ACCEPTED` column of `kubectl get` shows `True` for these resources, so filter on the reason instead.

      ```sh
      kubectl get {{< reuse "agw-docs/snippets/backend.md" >}} -A -o json | jq -r '.items[] | .metadata as $m | .status.conditions[]? | select(.type == "Accepted" and .reason == "PartiallyValid") | "\($m.namespace)/\($m.name): \(.message)"'
      kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} -A -o json | jq -r '.items[] | .metadata as $m | .status.ancestors[]?.conditions[]? | select(.type == "Accepted" and .reason == "PartiallyValid") | "\($m.namespace)/\($m.name): \(.message)"'
      ```

   2. Inspect the resource that you want to debug, such as the `openai` backend in the following example.

      ```sh
      kubectl get {{< reuse "agw-docs/snippets/backend.md" >}} openai -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
      ```

   3. Find the `Accepted` condition in the output. For a backend, look in `status.conditions`. For a policy, look in `status.ancestors[].conditions`, which has one entry per Gateway that the policy attaches to.

      Example output:

      ```yaml
      status:
        conditions:
        - type: Accepted
          status: "True"
          reason: PartiallyValid
          message: 'failed to translate backend: secret {{< reuse "agw-docs/snippets/namespace.md" >}}/openai-secret not found'
          observedGeneration: 1
          lastTransitionTime: "2026-09-21T14:02:28Z"
      ```

   4. Read the `reason`, not only the `status`. A check that tests the `Accepted` status alone passes in this state because the status stays `True`. When the reason is `PartiallyValid`, the message names the configuration that could not be translated.

   5. Fix the cause that the message names. The rest of the resource is still translated and served, so the symptom usually shows up at request time instead of at apply time.

      | Invalid part | What the proxy loads instead | How to fix it |
      | -- | -- | -- |
      | The Secret that holds LLM provider credentials does not exist | The backend keeps the credential field, but empty. Provider calls go out unauthenticated, so the failure comes back from the provider rather than from agentgateway. | Create the Secret in the namespace that `secretRef` names or correct the reference. |
      | The controller cannot translate an `oauthTokenExchange` or `crossAppAccess` backend authentication block | The authentication block is replaced with a marker that rejects every request that uses it. Those requests fail with HTTP `500` and the message `backend authentication failed`, and the gateway does not call the token endpoint. The proxy logs name the cause, such as `oauthTokenExchange configuration is invalid` or `crossAppAccess configuration is invalid`. Requests that do not use the block are not affected. | Fix the field that the condition message names, such as an unsupported `subjectToken.tokenType` value or a missing client authentication Secret. |
      | A prompt guard `webhook.backendRef` names a Service that does not exist | The webhook stays in the policy with no target to call. Guarded requests then take the webhook `failureMode`, which is `FailClosed` unless you set it. With `FailOpen`, prompt guarding is skipped instead. | Create the Service or point `backendRef` at one that exists. |
      | A remote JWKS is not available yet | The authentication policy keeps an empty key set, `{"keys":[]}`, so the policy trusts no keys. JWT authentication defaults to `Strict` mode, which rejects a request that carries no token and rejects any token that does arrive because no key can verify a signature. | Check that the JWKS endpoint is reachable from the control plane. The controller retries the fetch with a backoff and installs the keys when it succeeds. |
      | A CEL expression does not compile | The rest of the policy is kept and the expression is replaced with one that always fails. An `authorization` rule that depends on that replacement therefore allows nothing. | Fix the expression. The condition message names the field, then the expression that did not compile. |

   6. Check the condition again. The controller recomputes it on its own when the missing Secret, Service, or key set appears, so you do not need to reapply the resource.

## Inspect the loaded configuration

Sometimes a route is `Accepted` but the proxy still does not behave as expected. To see what the proxy actually loaded, dump its runtime configuration.

1. Render a summary of the routes, backends, and policies that the gateway has loaded.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy config all gateway/<gateway-name> -n <namespace> -o yaml
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy config all gateway/agentgateway-proxy -n agentgateway-system -o yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Inspect the backends that the gateway is sending traffic to and their endpoint health.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy config backends gateway/<gateway-name> -n <namespace>
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy config backends gateway/agentgateway-proxy -n agentgateway-system
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   TYPE     NAME       NAMESPACE            ENDPOINT                    HEALTH  REQUESTS  LATENCY
   Backend  openai     agentgateway-system  backend                     1.00    1         4682.37ms
   Service  ext-authz  backend-extauth      ext-authz-7c7596b5f6-tvs28  0.70    4         0.00ms
   Service  httpbin    backend-extauth      httpbin-7dc88b5fbc-zqrfn    1.00    2         3.06ms
   ```

   A backend or policy that reports `PartiallyValid` still appears here because the part of it that translated successfully is still served. Compare what the proxy loaded against the condition message from the previous section. For example, an authentication policy whose remote JSON Web Key Set (JWKS) was not available loads with an empty key set, `{"keys":[]}`.

For complete steps, see [Inspect agentgateway configuration]({{< link-hextra path="/documentation/operations/inspect-config" >}}).

## Trace requests

To see how a specific request flows through agentgateway, use `agctl proxy trace`. The trace shows you the route that was selected, the policies that were applied, the backend that was chosen, and the response status. Tracing helps you understand why a request did or did not match a route, why a policy was or was not applied, or why a request returned an unexpected status.

{{< tabs >}}
{{% tab name="Replace with your own" %}}
```sh
agctl proxy trace gateway/<gateway-name> -n <namespace> --port <listener-port> -- http://<host>/<path>
```
{{% /tab %}}
{{% tab name="Quickstart example" %}}

```sh
agctl proxy trace gateway/agentgateway-proxy -n agentgateway-system --port 8080 -- http://httpbin.example.com/
```
{{% /tab %}}
{{< /tabs >}}

`agctl` opens a port-forward to the proxy pod, captures the trace, sends the request, and renders the result in a text-based terminal user interface (TUI). Use `--raw` to print JSON Lines instead.

For complete steps, see [Trace requests with agctl]({{< link-hextra path="/documentation/operations/trace-requests" >}}).

## Enable debug logs {#debug-logs}

Agentgateway uses the same level syntax as [`RUST_LOG`](https://docs.rs/env_logger/latest/env_logger/#enabling-logging): `error`, `warn`, `info`, `debug`, and `trace`. Use `agctl` to read and change log levels at runtime for both the proxy and the controller. `agctl` resolves the pod and opens a port-forward for you, so you do not need to manage `kubectl port-forward` yourself.

### Proxy logs

1. Show the proxy's current log filter directive.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy log gateway/<gateway-name> -n <namespace>
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy log gateway/agentgateway-proxy -n agentgateway-system
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Set the global log level for the proxy.

   ```sh
   agctl proxy log gateway/agentgateway-proxy -n agentgateway-system --level debug
   ```

   Example output:

   ```
   current log level is typespec_client_core::http::policies::logging=warn,hickory_server::server::server_future=off,rmcp=warn,debug
   ```

3. Tail the proxy logs to see the added detail.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   kubectl logs -n <namespace> deploy/<gateway-name> -f
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   kubectl logs -n agentgateway-system deploy/agentgateway-proxy -f
   ```
   {{% /tab %}}
   {{< /tabs >}}

### Controller logs

The agentgateway controller tracks a log level per component, such as the translator, syncer, and gateway controller.

1. Show the controller's current log level for each component. The `-n` flag defaults to `agentgateway-system`.

   ```sh
   agctl controller log -n agentgateway-system
   ```

   Example output (truncated):

   ```
   current log levels:
   ---
   agentgateway/syncer: info
   agentgateway/translator: info
   gateway-controller: info
   deployer: info
   default: info
   ```

2. Set the log level. Change all components at once with `--level`, or target a single component with `--set component=level`.

   ```sh
   # Set all components to debug
   agctl controller log -n agentgateway-system --level debug

   # Set a single component to debug
   agctl controller log -n agentgateway-system --set agentgateway/syncer=debug
   ```

3. Tail the controller logs.

   ```sh
   kubectl logs -n agentgateway-system deploy/agentgateway -f
   ```

> [!NOTE]
> You can also get and set the proxy log level directly through the `/logging` admin endpoint, such as `curl -X POST "http://localhost:15000/logging?level=debug"` after you port-forward to the proxy pod. The endpoint accepts the same `RUST_LOG` filter syntax for fine-grained, per-module levels, such as `info,proxy::httpproxy=trace`.

## Debug client-safe error responses {#client-safe-error-responses}

When the agentgateway proxy rejects a request or cannot complete it, the response body carries a short, generic message, such as `authentication failed` or `no backends available`. The message does not include internal details, such as backend addresses, credential sources, or token validation errors. The `error` field of the proxy's access log and the request traces keep the full cause.

For example, an HTTPRoute sends traffic to a Service that has no ready endpoints. The client receives only a generic message.

```console
HTTP/1.1 503 Service Unavailable
content-type: text/plain
content-length: 21

no backends available
```

The proxy log line for the same request names the cause.

```console
error	request gateway=agentgateway-system/agentgateway-proxy listener=http route=httpbin/httpbin ... http.status=503 protocol=http error="no healthy backends" reason=NoHealthyBackend
```

{{< reuse "agw-docs/pages/operations/client-error-messages.md" >}}

### Return error details to clients {#expose-error-details}

For debugging in a trusted test environment, you can send the full internal error back to the client. Set the `AGENTGATEWAY_UNSAFE_EXPOSE_ERROR_DETAILS` environment variable to `true` on the proxy. Any other value keeps the details hidden. To set the environment variable, use the `spec.env` field of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that your Gateway references.

> [!WARNING]
> Do not use this setting on a shared or production gateway. Client responses can include backend addresses, credential lookup failures, and other details about your environment.

1. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that sets the environment variable. If your Gateway already references an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, add the `env` entry to that resource instead.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: expose-error-details
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     env:
     - name: AGENTGATEWAY_UNSAFE_EXPOSE_ERROR_DETAILS
       value: "true"
   EOF
   ```

2. Reference the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource from your Gateway. The following command patches the `agentgateway-proxy` Gateway from the quickstart.

   ```sh
   kubectl patch gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type=merge -p '{"spec":{"infrastructure":{"parametersRef":{"group":"{{< reuse "agw-docs/snippets/group.md" >}}","kind":"{{< reuse "agw-docs/snippets/gatewayparameters.md" >}}","name":"expose-error-details"}}}}'
   ```

   Example output:

   ```console
   gateway.gateway.networking.k8s.io/agentgateway-proxy patched
   ```

3. Verify that the proxy deployment has the environment variable. The proxy pods restart with the new setting.

   ```sh
   kubectl get deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="AGENTGATEWAY_UNSAFE_EXPOSE_ERROR_DETAILS")]}'
   ```

   Example output:

   ```console
   {"name":"AGENTGATEWAY_UNSAFE_EXPOSE_ERROR_DETAILS","value":"true"}
   ```

4. Send a request that fails. The response now includes the cause, such as for the Service without ready endpoints from the previous section.

   ```console
   HTTP/1.1 503 Service Unavailable
   content-type: text/plain
   content-length: 19

   no healthy backends
   ```

   The proxy logs a warning the first time that it returns an error with details.

   ```console
   warn	proxy	AGENTGATEWAY_UNSAFE_EXPOSE_ERROR_DETAILS is enabled; internal error details are sent to clients
   ```

5. When you finish debugging, remove the `parametersRef` from the Gateway, or remove the `env` entry from your existing {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource.

   ```sh
   kubectl patch gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type=json -p '[{"op":"remove","path":"/spec/infrastructure/parametersRef"}]'
   kubectl delete {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} expose-error-details -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

## Capture profiles

Agentgateway includes pprof endpoints to help you investigate CPU and memory issues. Use the `agctl proxy profile` commands to capture a profile. `agctl` resolves the proxy pod, opens the port-forward, reads the admin endpoint, and writes the profile to a file, so you do not need to manage `kubectl port-forward` yourself.

1. Optional: If you have not already, download [Graphviz](https://graphviz.org/download/) to visualize the profiles.

2. Capture a CPU profile. The default duration is 30 seconds. Send traffic through the gateway while the profile runs. Otherwise, the profile contains no samples.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy profile cpu gateway/<gateway-name> -n <namespace> --seconds 30 -o ./cpu.pprof
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy profile cpu gateway/agentgateway-proxy -n agentgateway-system --seconds 30 -o ./cpu.pprof
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   Wrote cpu profile to ./cpu.pprof
   ```

3. Capture a heap profile.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy profile heap gateway/<gateway-name> -n <namespace> -o ./heap.pprof
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy profile heap gateway/agentgateway-proxy -n agentgateway-system -o ./heap.pprof
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   Wrote heap profile to ./heap.pprof
   ```

   If you omit `-o`, `agctl` writes the profile to `agentgateway-cpu-<timestamp>.pb.gz` or `agentgateway-heap-<timestamp>.pb.gz` in the current directory.

4. Inspect the profiles with `go tool pprof`.

   **CPU profile**
   ```sh
   go tool pprof -http=: cpu.pprof
   ```

   **Heap profile**
   ```sh
   go tool pprof -http=: heap.pprof
   ```

   Graphviz opens on your web browser to a UI on localhost. Example:

   {{< reuse-image-light src="img/debug-heap-pprof.png" caption="Heap profile graph" >}}
   {{< reuse-image-dark srcDark="img/debug-heap-pprof.png" caption="Heap profile graph" >}}

> [!NOTE]
> To profile an agentgateway binary that runs on your workstation instead of a proxy pod, use `--local`, such as `agctl proxy profile heap --local`. Note that profiling data is available only when agentgateway runs on Linux. Proxy pods always meet this requirement, but a local macOS or Windows build does not: the CPU profile endpoint is not registered, so `agctl proxy profile cpu` fails with a `404 Not Found` error, and `agctl proxy profile heap` writes a profile that contains no allocation samples.

## Collect a bug report {#bug-report}

When you open an issue or ask for help, attach a snapshot of your setup. The `agctl bug-report` command collects the agentgateway resources, logs, and metrics from your cluster into a single `.tar.gz` archive, so you do not have to gather them one by one.

The archive includes the following information.

* All Gateway API resources and all resources with an agentgateway category, along with the Services, ConfigMaps, Secrets, and Events in every namespace that holds one of those resources or the controller. Secret values are redacted.
* Logs and metrics from the agentgateway proxy pods and from all pods in the controller namespace.

1. Collect the bug report. By default, `agctl` captures the last 24 hours of logs, up to 5,000 lines per container, and writes `bug-report.tar.gz` to the current directory.

   ```sh
   agctl bug-report
   ```

2. Optional: Narrow or extend the report with flags. For example, limit the report to specific namespaces and the last hour of logs. Add `--config-dump` to also capture the `/config_dump` output from each proxy, which includes the routes, backends, and policies that the proxy loaded. The controller namespace is always captured, even if you do not list it with `-n`.

   > [!TIP]
   > For all flags, see the [`agctl bug-report` reference]({{< link-hextra path="/reference/agctl/agctl-bug-report/" >}}).

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl bug-report -n <namespace1> -n <namespace2> --since 1h --config-dump -o /tmp/report.tar.gz
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl bug-report -n agentgateway-system --since 1h --config-dump -o /tmp/report.tar.gz
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Review the archive before you share it. Secret values are redacted, but logs and config dumps can still contain details that are specific to your environment, such as hostnames and request metadata.

   ```sh
   tar -tzf bug-report.tar.gz
   ```

4. Attach the archive to your [GitHub issue](https://github.com/agentgateway/agentgateway/issues) or share it with your support contact.
