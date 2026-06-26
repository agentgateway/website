---
title: Tailscale
weight: 30
description: Authenticate users with their Tailscale identity for zero-trust access to your MCP servers.
---

Agentgateway can integrate with [Tailscale](https://tailscale.com/) to authenticate users based on their Tailscale identity, which enables zero-trust access to your MCP servers. Agentgateway uses an [external authorization (`extAuthz`)]({{< link-hextra path="/configuration/security/external-authz" >}}) policy to call the local Tailscale daemon's `whois` API and identify the user behind each connection.

## How it works

1. The client connects from its Tailscale IP address (`100.x.x.x`).
2. Agentgateway calls the Tailscale local `whois` API with the source IP address.
3. Tailscale returns the node and user information.
4. Agentgateway allows or denies the request and logs the identity.

## Before you begin

- [Install agentgateway]({{< link-hextra path="/quickstart/" >}}).
- [Install Tailscale](https://tailscale.com/download) and connect it to your tailnet.
- Have another device on your tailnet to test from, or use the same machine through its Tailscale IP.

## Step 1: Verify that Tailscale is running

1. Check that Tailscale is connected. You should see your machine listed with a `100.x.x.x` IP address.

   ```bash
   tailscale status
   ```

2. Note your Tailscale IP address. You use this address to test access later.

   ```bash
   tailscale ip -4
   ```

## Step 2: Create the configuration

Create a `config.yaml` file. The configuration uses an `extAuthz` policy to call the Tailscale daemon's local `whois` API with the source IP address of each request, then extracts the node name and user email from the response. The socket path for the Tailscale daemon differs by platform.

{{< tabs >}}
{{% tab name="Linux" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      tailscale.node: extauthz.tailscaleNode
      tailscale.email: extauthz.tailscaleEmail

binds:
- port: 3000
  listeners:
  - name: default
    protocol: HTTP
    routes:
    - name: application
      backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
      policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: ["*"]
          exposeHeaders: ["Mcp-Session-Id"]
        extAuthz:
          host: unix:/run/tailscale/tailscaled.sock
          protocol:
            http:
              path: |
                "/localapi/v0/whois?addr=" + source.address
              addRequestHeaders:
                :authority: '"local-tailscaled.sock"'
              metadata:
                tailscaleNode: json(response.body).Node.Name
                tailscaleEmail: json(response.body).UserProfile.LoginName
```
{{% /tab %}}
{{% tab name="macOS" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      tailscale.node: extauthz.tailscaleNode
      tailscale.email: extauthz.tailscaleEmail

binds:
- port: 3000
  listeners:
  - name: default
    protocol: HTTP
    routes:
    - name: application
      backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
      policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: ["*"]
          exposeHeaders: ["Mcp-Session-Id"]
        extAuthz:
          host: unix:/var/run/tailscale/tailscaled.sock
          protocol:
            http:
              path: |
                "/localapi/v0/whois?addr=" + source.address
              addRequestHeaders:
                :authority: '"local-tailscaled.sock"'
              metadata:
                tailscaleNode: json(response.body).Node.Name
                tailscaleEmail: json(response.body).UserProfile.LoginName
```
{{% /tab %}}
{{< /tabs >}}

The following table describes the key settings in the configuration.

| Setting | Description |
|---------|-------------|
| `frontendPolicies.accessLog.add` | Adds the Tailscale identity to the access logs. |
| `extAuthz.host` | The Unix socket path to the Tailscale daemon. |
| `extAuthz.protocol.http.path` | A CEL expression that calls the Tailscale `whois` API with the client's source IP address. |
| `addRequestHeaders.:authority` | The hostname that the Tailscale local API requires. |
| `metadata.tailscaleNode` | Extracts the machine name from the Tailscale response. |
| `metadata.tailscaleEmail` | Extracts the user email from the Tailscale response. |

The value for `extAuthz.host` is the path to the Tailscale daemon's local socket, which differs by platform. Use the path that matches the platform where agentgateway runs.

| Platform | Socket path |
|----------|-------------|
| Linux | `/run/tailscale/tailscaled.sock` |
| macOS | `/var/run/tailscale/tailscaled.sock` |
| Windows | Named pipe (not supported through a Unix socket) |

{{< callout type="info" >}}
On most Linux systems, `/var/run` is a symlink to `/run`, so `/var/run/tailscale/tailscaled.sock` and `/run/tailscale/tailscaled.sock` point to the same socket.
{{< /callout >}}

## Step 3: Start agentgateway

```bash
agentgateway -f config.yaml
```

Example output:

```
info proxy::gateway started bind bind="bind/3000"
```

## Step 4: Test the authentication

1. Send a request from localhost. Because localhost does not have a Tailscale identity, the request is denied with a `403 Forbidden` response.

   ```bash
   curl -i http://localhost:3000/mcp
   ```

   Example output:

   ```
   HTTP/1.1 403 Forbidden
   external authorization failed
   ```

2. Send a request through your Tailscale IP address. The request passes authentication and reaches the MCP server, which returns a `406 Not Acceptable` response because the request does not include the required `text/event-stream` header.

   ```bash
   TAILSCALE_IP=$(tailscale ip -4)
   curl -i http://$TAILSCALE_IP:3000/mcp
   ```

   Example output:

   ```
   HTTP/1.1 406 Not Acceptable
   Not Acceptable: Client must accept text/event-stream
   ```

3. Send a complete MCP request through your Tailscale IP address with the required headers.

   ```bash
   TAILSCALE_IP=$(tailscale ip -4)
   curl -X POST "http://$TAILSCALE_IP:3000/mcp" \
     -H "Content-Type: application/json" \
     -H "Accept: text/event-stream" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
   ```

4. Check the agentgateway logs. After a successful request, the logs show the Tailscale identity from the access log fields that you configured.

   ```
   info request ... tailscale.node=your-machine-name tailscale.email=you@example.com
   ```

## Troubleshooting

**`external authorization failed` for Tailscale IPs**: Check that the Tailscale socket exists and is accessible at the path in your configuration.

```bash
# Linux
ls -la /run/tailscale/tailscaled.sock

# macOS
ls -la /var/run/tailscale/tailscaled.sock
```

**`no match for IP:port` in the Tailscale response**: The connecting IP address is not recognized by Tailscale. Make sure that you connect through a Tailscale IP address, not localhost or a LAN IP address.

## Learn more

{{< cards >}}
  {{< card path="/configuration/security/external-authz" title="External authorization" subtitle="ExtAuthz configuration reference" >}}
  {{< card path="/configuration/security/" title="Security configuration" subtitle="Complete security options" >}}
{{< /cards >}}
