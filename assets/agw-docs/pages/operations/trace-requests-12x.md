Capture a per-request trace as an agentgateway proxy handles the request, by using `agctl trace`.

## About

`agctl trace` taps the agentgateway admin endpoint at `/debug/trace` and streams a step-by-step record of how the proxy processes the next request that arrives. The trace shows you the matched route, the policies that were applied, the backend that was chosen, and the response status. Tracing helps you understand why a request matched or did not match a route, why a policy was or was not applied, or why a request returned an unexpected status.

`agctl trace` resolves the proxy pod for you, opens a port-forward to its admin port, and streams the trace back to your terminal. You do not need to manage `kubectl port-forward` yourself.

You can run `agctl trace` in two modes:

* **Inject mode**: Enables tracing and sends the request itself through the same port-forward. The host portion of the URL sets the `Host` header but is not used for DNS resolution.

  ```sh
  agctl trace gateway/<name> --port <listener> -- <url>
  ```

* **Watch mode**: Waits for the next request that arrives at the proxy and traces it. Send the request from any client.
  
  ```sh
  agctl trace gateway/<name>
  ```

## Before you begin

1. [Install agctl]({{< link-hextra path="/operations/agctl" >}}).
2. {{< reuse "agw-docs/snippets/agentgateway-prereq.md" >}}
3. Have an HTTPRoute that the trace request matches. The examples assume the `httpbin` HTTPRoute from the [non-agentic HTTP quickstart]({{< link-hextra path="/quickstart/non-agentic-http" >}}), which routes `www.example.com` to the httpbin service.

## Trace a request that agctl sends (inject mode)

Run `agctl trace` against the gateway and have it send the request for you.

```sh
agctl trace gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --raw --port 80 -- http://www.example.com/headers
```

`agctl` opens a port-forward to the proxy pod, enables tracing on its admin endpoint, sends the request, and prints the trace as JSON Lines. Example output:

```json
{"eventStart":null,"eventEnd":1,"severity":"info","message":{"type":"requestStarted"}}
{"eventStart":null,"eventEnd":65,"severity":"info","message":{"type":"requestSnapshot","stage":"initial request","requestState":{"request":{"method":"GET","uri":"http://www.example.com/headers","path":"/headers","pathAndQuery":"/headers","host":"www.example.com","scheme":"http","version":"HTTP/1.1","headers":{"accept":"*/*","user-agent":"curl/8.7.1"},"startTime":"2026-05-11T16:05:22.175838Z"},"source":{"address":"127.0.0.1","port":33006,"rawAddress":"127.0.0.1","rawPort":33006},"env":{"podName":"agentgateway-proxy-784ffbfc76-pcpqk","namespace":"agentgateway-system","gateway":"agentgateway-proxy"}}}}
{"eventStart":null,"eventEnd":94,"severity":"info","message":{"type":"requestSnapshot","stage":"gateway policies","requestState":{"request":{"method":"GET","uri":"http://www.example.com/headers","path":"/headers","pathAndQuery":"/headers","host":"www.example.com","scheme":"http","version":"HTTP/1.1","headers":{"accept":"*/*","user-agent":"curl/8.7.1"},"startTime":"2026-05-11T16:05:22.175838Z"},"source":{"address":"127.0.0.1","port":33006,"rawAddress":"127.0.0.1","rawPort":33006},"env":{"podName":"agentgateway-proxy-784ffbfc76-pcpqk","namespace":"agentgateway-system","gateway":"agentgateway-proxy"}}}}
{"eventStart":null,"eventEnd":99,"severity":"info","message":{"type":"routeSelection","selectedRoute":"httpbin/httpbin.00.http","evaluatedRoutes":["agentgateway-system/openai.00.http","httpbin/httpbin.00.http"]}}
{"eventStart":null,"eventEnd":113,"severity":"info","message":{"type":"policySelection","effectivePolicy":{"localRateLimit":null,"remoteRateLimit":null,"authorization":null,"jwt":null,"oidc":null,"basicAuth":null,"apiKey":null,"extAuthz":null,"extProc":null,"transformation":null,"csrf":null,"directResponse":null,"requestHeaderModifier":null,"responseHeaderModifier":null,"requestRedirect":null,"urlRewrite":null,"cors":null}}}
{"eventStart":null,"eventEnd":126,"severity":"info","message":{"type":"requestSnapshot","stage":"route policies","requestState":{"request":{"method":"GET","uri":"http://www.example.com/headers","path":"/headers","pathAndQuery":"/headers","host":"www.example.com","scheme":"http","version":"HTTP/1.1","headers":{"accept":"*/*","user-agent":"curl/8.7.1"},"startTime":"2026-05-11T16:05:22.175838Z"},"source":{"address":"127.0.0.1","port":33006,"rawAddress":"127.0.0.1","rawPort":33006},"env":{"podName":"agentgateway-proxy-784ffbfc76-pcpqk","namespace":"agentgateway-system","gateway":"agentgateway-proxy"}}}}
{"eventStart":null,"eventEnd":150,"severity":"info","message":{"type":"requestSnapshot","stage":"final request","requestState":{"request":{"method":"GET","uri":"http://www.example.com/headers","path":"/headers","pathAndQuery":"/headers","host":"www.example.com","scheme":"http","version":"HTTP/1.1","headers":{"accept":"*/*","user-agent":"curl/8.7.1"},"startTime":"2026-05-11T16:05:22.175838Z"},"source":{"address":"127.0.0.1","port":33006,"rawAddress":"127.0.0.1","rawPort":33006},"backend":{"name":"httpbin.httpbin.svc.cluster.local:8000","type":"service","protocol":"http"},"env":{"podName":"agentgateway-proxy-784ffbfc76-pcpqk","namespace":"agentgateway-system","gateway":"agentgateway-proxy"}}}}
{"eventStart":null,"eventEnd":154,"severity":"info","message":{"type":"backendCallStart","target":"10.244.0.7:8080"}}
{"eventStart":153,"eventEnd":514,"severity":"info","message":{"type":"backendCallResult","status":200,"error":null}}
{"eventStart":null,"eventEnd":526,"severity":"info","message":{"type":"responseSnapshot","stage":"backend response ready","requestState":{"response":{"code":200,"headers":{"access-control-allow-credentials":"true","access-control-allow-origin":"*","content-type":"application/json; encoding=utf-8","date":"Mon, 11 May 2026 16:05:22 GMT","content-length":"148"}},"env":{"podName":"agentgateway-proxy-784ffbfc76-pcpqk","namespace":"agentgateway-system","gateway":"agentgateway-proxy"}}}}
{"eventStart":null,"eventEnd":537,"severity":"info","message":{"type":"responseSnapshot","stage":"final response","requestState":{"response":{"code":200,"headers":{"access-control-allow-credentials":"true","access-control-allow-origin":"*","content-type":"application/json; encoding=utf-8","date":"Mon, 11 May 2026 16:05:22 GMT","content-length":"148"}},"env":{"podName":"agentgateway-proxy-784ffbfc76-pcpqk","namespace":"agentgateway-system","gateway":"agentgateway-proxy"}}}}
{"eventStart":null,"eventEnd":546,"severity":"info","message":{"type":"requestFinished"}}
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

## Trace a request from another client (watch mode)

If you cannot use `agctl` to send the request, for example because the request originates from a real client outside the cluster, start a watch and send the request separately.

1. In one terminal, watch for the next request.

   ```sh
   agctl trace gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --raw
   ```

2. In another terminal, send the request through your usual client.

   ```sh
   # Example: through the gateway's load balancer
   curl -H "host: www.example.com" http://${INGRESS_GW_ADDRESS}/headers
   ```

3. Back in the watch terminal, review the trace output of the next request that arrives at the proxy.

   ```json
   {"eventStart":null,"eventEnd":1,"severity":"info","message":{"type":"requestStarted"}}
   {"eventStart":null,"eventEnd":65,"severity":"info","message":{"type":"requestSnapshot","stage":"initial request","requestState":{"request":{"method":"GET","uri":"http://www.example.com/headers","path":"/headers","pathAndQuery":"/headers","host":"www.example.com","scheme":"http","version":"HTTP/1.1","headers":{"accept":"*/*","user-agent":"curl/8.7.1"},"startTime":"2026-05-11T16:05:22.175838Z"},"source":{"address":"127.0.0.1","port":33006,"rawAddress":"127.0.0.1","rawPort":33006},"env":{"podName":"agentgateway-proxy-784ffbfc76-pcpqk","namespace":"agentgateway-system","gateway":"agentgateway-proxy"}}}}
   ...
   ```

## Open the interactive TUI

Omit `--raw` to render the trace in an interactive, text-based terminal user interface (TUI) that lets you step through each event and drill into the request and response state.

```sh
agctl trace gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --port 80 -- http://www.example.com/headers
```

Example TUI:
```console
╔═════════════════════Events gateway/agentgateway-proxy═════════════════════╗┌──────────────────── Raw Event ───────────────────┐
║#  Type           Summary                                                  ║│eventEnd: 1112                                    │
║1  Request Start  request started                                          ║│eventStart: null                                  │
║2  Snapshot       initial request                                          ║│message:                                          │
║3  Snapshot       gateway policies                                         ║│  type: requestFinished                           │
║4  Route          selected "httpbin/httpbin.00.http" (2 evaluated)         ║│severity: info                                    │
║5  Policies       effective policies: apiKey, authorization, basicAuth, co…║│                                                  │
║6  Snapshot       route policies                                           ║│                                                  │
║7  Snapshot       final request                                            ║│                                                  │
║8  Backend Start  10.244.0.7:8080                                          ║│                                                  │
║9  Backend Result status=200                                               ║│                                                  │
║10 Snapshot       backend response ready                                   ║│                                                  │
║11 Snapshot       final response                                           ║│                                                  │
║12 Request Done   request finished                                         ║│                                                  │
║                                                                           ║│                                                  │
║                                                                           ║│                                                  │
║                                                                           ║│                                                  │
║                                                                           ║│                                                  │
║                                                                           ║│                                                  │
╚═══════════════════════════════════════════════════════════════════════════╝└──────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────Help──────────────────────────────────────────────────────────────┐
│stream complete, press q to exit                                                                                               │
│tab: switch pane (events)   arrows: scroll selected pane   e/s/d: detail mode   q: quit                                        │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Press **q** to quit the TUI.

## Pass extra curl arguments

You can append any `curl` arguments after the URL, such as headers, methods, or a request body.

```sh
agctl trace gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --raw --port 80 -- http://www.example.com/post \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

Passing curl arguments is helpful for testing authorization, JWT, API key, and CORS policies, where the trace shows you which policy applied and why a request was allowed or rejected.
