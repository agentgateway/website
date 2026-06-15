---
title: Tailscale
weight: 30
description: Use Tailscale as a network boundary in front of agentgateway.
---

You can use [Tailscale](https://tailscale.com/) with agentgateway to place your MCP servers behind a private network boundary (your tailnet).

{{< callout type="warning" >}}
agentgateway does not currently integrate with the Tailscale local API to resolve a request to a Tailscale *user* or *device* identity. Treat Tailscale as a network/access boundary, and use agentgateway policies (JWT/OIDC, HTTP authz, external authz) when you need application-layer authentication and authorization.
{{< /callout >}}

## How it works

1. You run agentgateway on a host that is connected to your tailnet.
2. Clients connect to agentgateway over Tailscale (using the host's tailnet IP or DNS name).
3. Tailscale ACLs (and optionally agentgateway network authorization) restrict who can reach the gateway.
4. agentgateway optionally applies application-layer policies (for example JWT validation) to authenticate/authorize requests.

## Before you begin

- [Install agentgateway]({{< link-hextra path="/quickstart/" >}}).
- [Install Tailscale](https://tailscale.com/download) on the agentgateway host and connect it to your tailnet.
- Have at least one other device on your tailnet to test from.

## Step 1: Verify Tailscale connectivity

1. Check that Tailscale is connected. You should see your machine listed with a `100.x.x.x` IP address.

   ```bash
   tailscale status
   ```

2. Note the host's Tailscale IP address. You use this address to test access later.

   ```bash
   tailscale ip -4
   ```

## Step 2: Restrict access to your tailnet

Use Tailscale ACLs/tags to control which users/devices in your tailnet can reach the agentgateway host and port. This is the recommended place to enforce tailnet identity-based access, because it happens before traffic reaches agentgateway.

If you also want agentgateway to enforce a network allowlist, configure a [network authorization policy]({{< link-hextra path="/configuration/security/network-authz/" >}}) to only accept connections from the Tailscale CGNAT range (`100.64.0.0/10`).

{{< callout type="info" >}}
This check is IP-based. It does not prove a specific Tailscale user/device identity, and it can be affected by routing (for example, subnet routers or proxies). Use Tailscale ACLs for identity-based control.
{{< /callout >}}

Create a `config.yaml` file:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  networkAuthorization:
    rules:
    - allow: 'cidr("100.64.0.0/10").containsIP(source.address)'

binds:
- port: 3000
  listeners:
  - name: default
    protocol: HTTP
    routes:
    - name: mcp
      backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
```

## Step 3: Start agentgateway

```bash
agentgateway -f config.yaml
```

Example output:

```
info proxy::gateway started bind bind="bind/3000"
```

## Step 4: Test connectivity

1. From a different device on your tailnet, send a request to the agentgateway host's Tailscale IP:

   ```bash
   curl -i http://<TAILSCALE_IP>:3000/mcp
   ```

2. From a device that is not on your tailnet, verify that you cannot connect (either because of Tailscale ACLs or because the `networkAuthorization` policy rejects the connection).

## Next steps: add application-layer auth (optional)

Tailscale protects network access, but it does not replace HTTP/MCP authentication and authorization. Depending on your use case, you might also want to configure:

- [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}) to validate OIDC access tokens.
- [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz/" >}}) for claim- and request-aware authorization rules.
- [External authorization]({{< link-hextra path="/configuration/security/external-authz" >}}) to delegate authz decisions to an external service (such as an IdP-aware proxy).

## Troubleshooting

**Can't connect from a tailnet client**: Confirm that your client is connected to the same tailnet and that you are connecting to the agentgateway host's *Tailscale* IP/DNS name (not a LAN IP).

**Connection is rejected after enabling `networkAuthorization`**: Temporarily remove the `frontendPolicies.networkAuthorization` section to confirm whether the block is coming from Tailscale ACLs or from agentgateway. If you're using subnet routers, proxies, or other routing, the downstream `source.address` might not fall into `100.64.0.0/10`.

## Learn more

{{< cards >}}
  {{< card path="/configuration/security/network-authz/" title="Network authorization" subtitle="L4 allow/deny rules for incoming connections" >}}
  {{< card path="/configuration/security/jwt-authn/" title="JWT authentication" subtitle="Validate OIDC access tokens" >}}
  {{< card path="/configuration/security/" title="Security configuration" subtitle="Complete security options" >}}
{{< /cards >}}
