---
title: TLS / HTTPS
weight: 7
description: Enable HTTPS with TLS certificates for secure connections
---

Agentgateway supports TLS termination for secure HTTPS connections. This tutorial shows you how to configure TLS with your own certificates.

## What you'll build

In this tutorial, you configure the following.

1. Generate self-signed TLS certificates for testing
2. Configure agentgateway with HTTPS enabled
3. Test secure connections to your MCP server
4. Learn how to use Let's Encrypt certificates for production

## Before you begin

- [Node.js](https://nodejs.org/) installed (for MCP servers)
- OpenSSL installed (for generating certificates)

## Step 1: Install agentgateway

```bash
curl -sL https://agentgateway.dev/install | bash
```

## Step 2: Create a directory and generate certificates

Create a directory for this tutorial.

```bash
mkdir tls-tutorial && cd tls-tutorial
```

Generate self-signed certificates for testing.

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost"
```

Example output:
```
certs/key.pem
certs/cert.pem
```

{{< callout type="warning" >}}
Self-signed certificates are for **testing only**. Browsers and clients will show security warnings. For production, use certificates from a trusted CA like Let's Encrypt.
{{< /callout >}}

## Step 3: Create the config

Create a configuration file with HTTPS enabled.

```bash
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - name: default
    protocol: HTTPS
    tls:
      cert: ./certs/cert.pem
      key: ./certs/key.pem
    routes:
    - policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: ["*"]
          exposeHeaders: ["Mcp-Session-Id"]
      backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
EOF
```

Key configuration:
- `protocol: HTTPS` - Enables TLS on this listener
- `tls.cert` - Path to the certificate file
- `tls.key` - Path to the private key file

## Step 4: Start agentgateway

```bash
agentgateway -f config.yaml
```

Example output:

```
INFO agentgateway: Listening on 0.0.0.0:3000
INFO agentgateway: Admin UI available at http://localhost:15000/ui/
```

## Step 5: Test the HTTPS connection

Use curl with `-k` to skip certificate verification (needed for self-signed certs).

```bash
curl -k -s -i https://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

Example output:

```
HTTP/2 200
content-type: text/event-stream
mcp-session-id: abc123-def456-...
```

This confirms your HTTPS connection is working!

---

## How it works

This configuration includes the following.
- **Enables HTTPS** - Uses TLS for encrypted connections
- **Terminates TLS** - Agentgateway handles certificate management
- **Secures traffic** - All communication between clients and the gateway is encrypted

---

## Using Let's Encrypt Certificates

For production, use certificates from Let's Encrypt or another trusted CA.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 443
  listeners:
  - name: default
    protocol: HTTPS
    tls:
      cert: /etc/letsencrypt/live/example.com/fullchain.pem
      key: /etc/letsencrypt/live/example.com/privkey.pem
    routes:
    - backends:
      - mcp:
          targets:
          - name: myserver
            stdio:
              cmd: npx
              args: ["my-mcp-server"]
```

## HTTP to HTTPS Redirect

You can run both HTTP and HTTPS, redirecting HTTP traffic to HTTPS.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
# HTTP listener - redirects to HTTPS
- port: 80
  listeners:
  - name: http
    protocol: HTTP
    routes:
    - policies:
        redirect:
          https: true
      backends: []

# HTTPS listener - handles actual traffic
- port: 443
  listeners:
  - name: https
    protocol: HTTPS
    tls:
      cert: ./certs/cert.pem
      key: ./certs/key.pem
    routes:
    - policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: ["*"]
          exposeHeaders: ["Mcp-Session-Id"]
      backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
```

## Cleanup

Stop agentgateway with `Ctrl+C`, then remove the test directory.

```bash
cd .. && rm -rf tls-tutorial
```

## Next steps

{{< cards >}}
  {{< card link="/docs/configuration/security/" title="Security Configuration" subtitle="Complete security options" >}}
  {{< card link="/docs/configuration/listeners" title="Listeners" subtitle="Listener configuration" >}}
{{< /cards >}}
