---
title: Callout proxy
weight: 38
description: Send gateway-originated callouts through an HTTP proxy.
---

Use a callout proxy when the agentgateway process must reach identity providers, authorization services, or cloud APIs through an outbound proxy. Configure the proxy with `config.callouts.tunnel`, or leave that field unset and use the standard proxy environment variables.

The callout proxy is different from the [egress proxy]({{< link-hextra path="/documentation/configuration/egress-proxy/" >}}). The egress proxy handles client traffic that uses agentgateway as its proxy. The callout proxy handles outbound calls from the agentgateway process.

## Callouts that use the proxy

`config.callouts.tunnel` applies to callout APIs. Examples include JWKS fetches, OIDC discovery, external authorization, and cloud provider credential fetches. The setting does not apply to primary backend requests, mirrored backend requests, XDS or CA calls, backends with their own tunnel policy, or Kubernetes services. The setting also does not apply to loopback and link-local addresses, such as cloud metadata servers.

GCP authentication calls do not read `config.callouts.tunnel`. To proxy those calls, use the standard proxy environment variables instead.

## Configure the callout proxy

Add `config.callouts.tunnel` to your configuration file. Because this setting is under the top-level `config` section, restart the agentgateway process after you change the setting.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  callouts:
    tunnel:
      url: http://user:pass@proxy.example.com:3128
      noProxy:
      - internal.example.com
      - 10.0.0.0/8
```

| Field | Description |
| --- | --- |
| `config.callouts.tunnel.url` | The HTTP proxy URL. The URL must use the `http` or `https` scheme. If the proxy requires basic authentication, include the credentials in the URL. |
| `config.callouts.tunnel.noProxy` | Destinations that bypass the proxy. Use `NO_PROXY` syntax, such as hostnames that also match subdomains, IP addresses, CIDR ranges, or `*`. |

When `config.callouts.tunnel` is set, the setting controls callout proxying. When `config.callouts.tunnel` is omitted, configure callout proxying with the environment variables that the process reads at startup.

```shell
export ALL_PROXY=http://proxy.example.com:3128
export NO_PROXY=internal.example.com,10.0.0.0/8
agentgateway -f config.yaml
```

The agentgateway process reads `ALL_PROXY`, `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`, including the lowercase forms.
