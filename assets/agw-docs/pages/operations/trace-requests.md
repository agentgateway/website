Capture a per-request trace as an agentgateway proxy handles the request, by using `agctl trace`.

## About

`agctl trace` taps the agentgateway admin endpoint at `/debug/trace` and streams a step-by-step record of how the proxy processes the next request that arrives. The trace shows you the matched route, the policies that were applied, the backend that was chosen, and the response status. Tracing helps you understand why a request matched or did not match a route, why a policy was or was not applied, or why a request returned an unexpected status.

`agctl trace` resolves the proxy pod for you, opens a port-forward to its admin port, and streams the trace back to your terminal. You do not need to manage `kubectl port-forward` yourself.

You can run `agctl trace` in two modes:

* **Watch mode**: `agctl trace gateway/<name>` waits for the next request that arrives at the proxy and traces it. Send the request from any client.
* **Inject mode**: `agctl trace gateway/<name> --port <listener> -- <url>` enables tracing and sends the request itself through the same port-forward. The host portion of the URL sets the `Host` header but is not used for DNS resolution.

## Before you begin

* [Install agctl]({{< link-hextra path="/operations/agctl" >}}).
* Install agentgateway and create a Gateway. The examples in this guide use the agentgateway proxy that the [Get started]({{< link-hextra path="/quickstart/" >}}) installs in the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace.
* Have an HTTPRoute that the trace request matches. The examples assume the `httpbin` HTTPRoute from the [non-agentic HTTP quickstart]({{< link-hextra path="/quickstart/non-agentic-http" >}}), which routes `www.example.com` to the httpbin service.

## Steps

{{% steps %}}

### Step 1: Trace a request that agctl sends (inject mode)

Run `agctl trace` against the gateway and have it send the request for you.

```sh
agctl trace gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --raw --port 80 -- http://www.example.com/headers
```

`agctl` opens a port-forward to the proxy pod, enables tracing on its admin endpoint, sends the request, and prints the trace as JSON Lines. Example output:

```json
{"eventStart":null,"eventEnd":17,"severity":"info","message":{"type":"requestStarted"}}
{"eventStart":null,"eventEnd":1022,"severity":"info","message":{"type":"requestSnapshot","stage":"initial request","requestState":{"request":{"method":"GET","uri":"http://www.example.com/headers","path":"/headers","host":"www.example.com",...},"env":{"podName":"agentgateway-proxy-bfdfcc5b-qf88r","namespace":"agentgateway-system","gateway":"agentgateway-proxy"}}}}
{"eventStart":null,"eventEnd":1153,"severity":"info","message":{"type":"routeSelection","selectedRoute":"httpbin/httpbin.00.http","evaluatedRoutes":["agentgateway-system/openai.00.http","httpbin/httpbin.00.http"]}}
{"eventStart":null,"eventEnd":1377,"severity":"info","message":{"type":"requestSnapshot","stage":"final request","requestState":{"request":{...},"backend":{"name":"httpbin.httpbin.svc.cluster.local:8000","type":"service","protocol":"http"},...}}}
{"eventStart":null,"eventEnd":1385,"severity":"info","message":{"type":"backendCallStart","target":"10.244.0.68:8080"}}
{"eventStart":1383,"eventEnd":4016,"severity":"info","message":{"type":"backendCallResult","status":200,"error":null}}
{"eventStart":null,"eventEnd":4073,"severity":"info","message":{"type":"responseSnapshot","stage":"final response","requestState":{"response":{"code":200,...}}}}
{"eventStart":null,"eventEnd":4100,"severity":"info","message":{"type":"requestFinished"}}
```

Each request emits the following events.

| Event type | Stage | What it tells you |
| -- | -- | -- |
| `requestStarted` | &mdash; | The proxy accepted a new request. |
| `requestSnapshot` | `initial request` | The request as it arrived, before any processing. |
| `requestSnapshot` | `gateway policies` | The request after gateway-level policies ran. |
| `routeSelection` | &mdash; | The route that matched the request, and the routes that were evaluated. |
| `policySelection` | &mdash; | The merged effective policy that applies to the matched route. |
| `requestSnapshot` | `route policies` | The request after route-level policies ran. |
| `requestSnapshot` | `final request` | The request as it is sent to the backend, including the resolved backend. |
| `backendCallStart` | &mdash; | The proxy began the upstream call. |
| `backendCallResult` | &mdash; | The upstream returned a status. The `error` field carries any transport error. |
| `responseSnapshot` | `backend response ready` | The response from the backend, before any response processing. |
| `responseSnapshot` | `final response` | The response as it is returned to the client. |
| `requestFinished` | &mdash; | The proxy completed the request. |

The `env` block on every snapshot includes `podName`, `namespace`, and `gateway`, which is useful when multiple proxy replicas are in scope.

### Step 2: Trace a request from another client (watch mode)

If you cannot use `agctl` to send the request, for example because the request originates from a real client outside the cluster, start a watch and send the request separately.

In one terminal, watch for the next request.

```sh
agctl trace gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --raw
```

In another terminal, send the request through your usual client. The next request that arrives at the proxy is traced and printed in the watch terminal.

```sh
# Example: through the gateway's load balancer
curl -H "host: www.example.com" http://${INGRESS_GW_ADDRESS}/headers
```

### Step 3: Open the interactive TUI

Omit `--raw` to render the trace in an interactive terminal UI that lets you step through each event and drill into the request and response state.

```sh
agctl trace gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --port 80 -- http://www.example.com/headers
```

Press <kbd>q</kbd> to quit the TUI.

### Step 4: Pass extra curl arguments

You can append any `curl` arguments after the URL, such as headers, methods, or a request body.

```sh
agctl trace gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --raw --port 80 -- http://www.example.com/post \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

Passing curl arguments is helpful for testing authorization, JWT, API key, and CORS policies, where the trace shows you which policy applied and why a request was allowed or rejected.

{{% /steps %}}

## Troubleshooting

### `no Gateways found` or wrong pod selected

**What's happening**: `agctl trace` returns an error about the gateway resource not being found, or the trace runs against a different pod than you expect.

**Why it's happening**: You did not pass a resource argument, the namespace is wrong, or the resource name does not match a Gateway in the cluster.

**How to fix it**: Pass the Gateway resource explicitly with `gateway/<name>` and `-n <namespace>`. Confirm the Gateway exists.

```sh
kubectl get gateway -A
```

### The trace shows a different route than expected

**What's happening**: `routeSelection.selectedRoute` is not the route you wanted to test, even though that route is `Accepted`.

**Why it's happening**: Another HTTPRoute on the same Gateway has a more specific or earlier-evaluated match. Gateway API evaluates routes by hostname specificity, then path specificity, then creation timestamp.

**How to fix it**: The `evaluatedRoutes` array in the trace lists every route that the proxy considered. Compare its matchers and hostnames against the route you expected to hit, and adjust hostnames or path matches to disambiguate.

### `--port requires a request URL after --`

**What's happening**: `agctl trace` exits with this error.

**Why it's happening**: `--port` and a request URL must be passed together. You set one without the other.

**How to fix it**: Either drop `--port` to use watch mode, or include both `--port <listener>` and a `-- http://...` request URL.

## What's next

* [Inspect agentgateway configuration with agctl]({{< link-hextra path="/operations/inspect-config" >}}).
* [Debug your setup]({{< link-hextra path="/operations/debug" >}}).
