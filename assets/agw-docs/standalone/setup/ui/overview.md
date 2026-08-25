## About

The agentgateway admin UI is a built-in web interface that runs alongside the proxy. It is fully interactive in standalone mode, so you can inspect your current configuration and manage your proxy without restarting agentgateway.

The admin UI is separate from the [Web UI integrations]({{< link-hextra path="/integrations/web-uis/" >}}), which are third-party AI chat frontends (such as Open WebUI or LibreChat) that you connect to agentgateway as a backend. The admin UI is the management interface for agentgateway itself.

## Where the UI is served

Agentgateway serves the UI on the admin address, and optionally on the port of each gateway that you list in the `ui` section of your configuration file.

| Configuration | Where the UI is served | Who can reach it |
| --- | --- | --- |
| No `ui` section | The admin address only, which is `localhost:15000` by default. | Anything that can reach the admin address. Loopback only, unless you change `config.adminAddr`. |
| A `ui` section with `gateways` | The port of each gateway that you list, on the `/ui` path, and still on the admin address. | Anything that can reach that gateway, subject to the policies in `ui.policies`. The admin address stays reachable to anything that can reach it. |

The admin API is served in the same places as the UI, so `/api/config/effective` and the other admin endpoints follow the same rule.

Attaching the UI to a gateway adds a location. It does not remove the admin address. To turn the admin address off entirely, set `config.adminAddr` to `off`, which also disables the admin API on that address. For more information, see [Change the admin address]({{< link-hextra path="/setup/ui/gateway-ui/#customize-port" >}}).

> [!WARNING]
> Neither location requires authentication by default. The admin address is loopback-only, so it is not reachable from another host unless you change it. A gateway listener, on the other hand, is as reachable as your other proxy traffic, so attach an authentication policy before you expose the UI. For more information, see [Secure the UI]({{< link-hextra path="/setup/ui/secure-ui/" >}}).

## Guides
