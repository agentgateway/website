---
title: Tailscale Authentication
weight: 11
description: Authenticate users using Tailscale identity for zero-trust access
---

Agentgateway can integrate with [Tailscale](https://tailscale.com/) to authenticate users based on their Tailscale identity, enabling zero-trust access to your MCP servers.

## What you'll build

In this tutorial, you configure the following.

1. Configure agentgateway to use Tailscale for authentication
2. Query the Tailscale daemon to identify connecting users
3. Extract node name and user email from Tailscale identity
4. Enable zero-trust access to your MCP servers

## Before you begin

- [agentgateway installed]({{< link-hextra path="/quickstart/" >}})
- [Tailscale](https://tailscale.com/download) installed and connected to your tailnet
- Another device on your tailnet to test from (or use the same machine via its Tailscale IP)

## Step 1: Verify Tailscale is running

Check that Tailscale is connected.

```bash
tailscale status
```

You should see your machine listed with a `100.x.x.x` IP address.

Note your Tailscale IP.

```bash
tailscale ip -4
```

## Step 2: Create the configuration

Create a working directory.

```bash
mkdir tailscale-auth-test && cd tailscale-auth-test
```

Create a `config.yaml` file.

{{< tabs items="Linux,macOS" >}}
{{% tab %}}
**Linux configuration:**
```bash
cat > config.yaml << 'EOF'
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
          # Linux: Tailscale socket location
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
EOF
```
{{% /tab %}}
{{% tab %}}
**macOS configuration:**
```bash
cat > config.yaml << 'EOF'
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
          # macOS: Tailscale socket location
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
EOF
```
{{% /tab %}}
{{< /tabs >}}

### Configuration explained

| Setting | Description |
|---------|-------------|
| `frontendPolicies.accessLog.add` | Adds Tailscale identity to access logs |
| `extAuthz.host` | Unix socket path to Tailscale daemon |
| `extAuthz.protocol.http.path` | CEL expression calling Tailscale's whois API with client IP |
| `addRequestHeaders.:authority` | Required hostname for Tailscale local API |
| `metadata.tailscaleNode` | Extracts machine name from Tailscale response |
| `metadata.tailscaleEmail` | Extracts user email from Tailscale response |

## Step 3: Start agentgateway

```bash
agentgateway -f config.yaml
```

Example output:

```
info proxy::gateway started bind bind="bind/3000"
```

## Step 4: Test the authentication

### Test from localhost (should fail)

Requests from localhost do not have a Tailscale identity.

```bash
curl -i http://localhost:3000/mcp
```

**Expected response:**
```
HTTP/1.1 403 Forbidden
external authorization failed
```

This is expected - localhost isn't a Tailscale IP.

### Test via Tailscale IP (should succeed)

Use your Tailscale IP address.

```bash
# Get your Tailscale IP
TAILSCALE_IP=$(tailscale ip -4)

# Make request via Tailscale IP
curl -i http://$TAILSCALE_IP:3000/mcp
```

**Expected response:**
```
HTTP/1.1 406 Not Acceptable
Not Acceptable: Client must accept text/event-stream
```

The 406 response means authentication passed and the request reached the MCP server (which requires SSE headers).

### Test with proper MCP headers

```bash
TAILSCALE_IP=$(tailscale ip -4)

curl -X POST "http://$TAILSCALE_IP:3000/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

### Check the logs

After a successful request, the agentgateway logs show Tailscale identity.

```
info request ... tailscale.node=your-machine-name tailscale.email=you@example.com
```

## How it works

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client     │────▶│agentgateway │────▶│ Tailscale Daemon│
│(100.x.x.x)   │     │              │     │                 │
└──────────────┘     └──────────────┘     └─────────────────┘
       │                    │                      │
       │ 1. Request         │                      │
       │───────────────────▶│                      │
       │                    │ 2. whois?addr=       │
       │                    │    100.x.x.x         │
       │                    │─────────────────────▶│
       │                    │ 3. {Node, User}      │
       │                    │◀─────────────────────│
       │ 4. Response        │                      │
       │◀───────────────────│                      │
```

1. Client connects from their Tailscale IP (100.x.x.x)
2. Agentgateway calls Tailscale's local `whois` API with the source IP
3. Tailscale returns the node and user information
4. Agentgateway allows/denies the request and logs the identity

## Adding authorization rules

Restrict access based on Tailscale identity.

```yaml
policies:
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
  authorization:
    rules:
    # Only allow specific users
    - if: 'extauthz.tailscaleEmail == "admin@example.com"'
    # Or check node name patterns
    - if: 'extauthz.tailscaleNode.startsWith("prod-")'
```

## Tailscale socket locations

| Platform | Socket Path |
|----------|-------------|
| Linux | `/run/tailscale/tailscaled.sock` |
| macOS | `/var/run/tailscale/tailscaled.sock` |
| Windows | Named pipe (not supported via unix socket) |

## Cleanup

Stop the agentgateway with `Ctrl+C` and remove the test directory.

```bash
cd .. && rm -rf tailscale-auth-test
```

## Troubleshooting

### "external authorization failed" for Tailscale IPs

Check that the Tailscale socket exists and is accessible.

```bash
# Linux
ls -la /run/tailscale/tailscaled.sock

# macOS
ls -la /var/run/tailscale/tailscaled.sock
```

### "no match for IP:port" in Tailscale response

The connecting IP isn't recognized by Tailscale. Ensure you're connecting via a Tailscale IP address, not localhost or a LAN IP.

## Learn more

{{< cards >}}
  {{< card link="/docs/configuration/security/" title="Security Configuration" subtitle="Complete security options" >}}
  {{< card link="/docs/configuration/traffic-management/external-authorization/" title="External Authorization" subtitle="ExtAuthz configuration reference" >}}
{{< /cards >}}
