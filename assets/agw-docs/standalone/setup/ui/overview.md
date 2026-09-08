## About

The agentgateway UI is a built-in web interface that runs alongside the proxy. It is fully interactive in standalone mode, so you can inspect your current configuration and manage your proxy without restarting agentgateway.

The UI is separate from the [Web UI integrations]({{< link-hextra path="/integrations/web-uis/" >}}), which are third-party AI chat frontends (such as Open WebUI or LibreChat) that you connect to agentgateway as a backend. The UI is the management interface for agentgateway itself.

## Where the UI is served

You choose where the UI is served with the `ui` section of your configuration file. List the gateways that you want to serve it on, and agentgateway attaches the UI to the port of each one.

| Configuration | Where the UI is served | Who can reach it |
| --- | --- | --- |
| A `ui` section that lists `gateways` | The port of each gateway that you list, on the `/ui` path. | Anything that can reach that gateway, subject to the policies in `ui.policies`. |
| A `ui` section with no `gateways` | The port of the gateway that is named `default`, if one exists. | Anything that can reach that gateway. |
| No `ui` section | Nowhere on your gateways. The UI is reachable only on the admin interface, which is loopback-only. | Only a client on the same host. |

A generated configuration includes a `ui` section, so the UI is served on the gateway port from the first start.

In every case, the admin interface also serves a copy of the UI for local use. That copy is not a location that you configure, and it does not change what a gateway serves. For more information, see [The UI and the admin interface are not the same thing](#admin-interface).

> [!WARNING]
> A gateway serves the UI without authentication until you add a policy. A gateway listener is as reachable as your other proxy traffic, so attach an authentication policy before you put the UI on a network that you do not control. For more information, see [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}).

The UI calls an API of its own for the data that it displays and the changes that it saves. This UI API is served on the `/api` path wherever the UI is served, so a gateway that serves the UI also serves `/api/config/effective` and the other UI endpoints. The policies in `ui.policies` cover both.

## The UI and the admin interface are not the same thing {#admin-interface}

Agentgateway also runs an **admin interface**, which is a local debugging endpoint on `localhost:15000` by default. The two are easy to confuse, because the admin interface happens to serve a copy of the UI as a convenience for local use.

They are not the same surface, and only one of them is meant to leave your machine.

| | The UI | The admin interface |
| --- | --- | --- |
| What it is | The web interface that you use to operate agentgateway | Debugging and profiling endpoints for a single local process |
| Where it is served | The gateways that you list in the `ui` section | The address in `config.adminAddr`, which is `localhost:15000` by default |
| What it serves | `/ui` and the UI API on `/api` | `/config_dump`, `/logging`, `/memory`, `/quitquitquit`, and `/debug/*`, plus a copy of `/ui` and `/api` |
| Reachable from another host | Yes, when you attach it to a gateway | No. The address is loopback-only unless you change it. |
| Authentication | Whatever you configure in `ui.policies` | None, ever |
| How often you change it | Whenever your setup changes | Almost never |

**Attaching the UI to a gateway does not put the admin interface on that gateway.** The debugging endpoints stay on the admin address. A request to `/config_dump` on a gateway that serves the UI returns a `404` response, because the gateway serves only the UI and the UI API.

> [!CAUTION]
> The admin interface is separate from the UI. Typically, treat the admin interface address (`config.adminAddr`) as a setting that you do not change. Moving it to a routable address, such as `0.0.0.0:15000`, publishes shutdown and configuration-dump endpoints to anything that can reach that port.

To reach the UI from another host, attach it to a gateway. That is the supported path, and it is the only one that you can authenticate. For the admin interface itself, see [Debug your setup]({{< link-hextra path="/documentation/operations/debug/" >}}).

## Guides
