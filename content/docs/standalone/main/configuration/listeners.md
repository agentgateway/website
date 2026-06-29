---
title: Listeners
weight: 12
description: Configure listeners for agentgateway.
test:
  listeners:
  - file: content/docs/standalone/main/configuration/listeners.md
    path: listeners
---

Listeners are the entrypoints for traffic into agentgateway.
Agentgateway supports both {{< gloss "HTTP (Hypertext Transfer Protocol)" >}}HTTP{{< /gloss >}} and {{< gloss "TCP (Transmission Control Protocol)" >}}TCP{{< /gloss >}} traffic, with and without {{< gloss "TLS (Transport Layer Security)" >}}TLS{{< /gloss >}}.

The following examples use routing-based configuration with `binds`. If you only route to LLM or MCP backends, the simplified `llm` and `mcp` modes set the listener port and TLS directly through `llm.port`, `llm.tls`, and `mcp.port`. For more information about the configuration styles, see [Routing-based configuration]({{< link-hextra path="/llm/configuration-modes/" >}}).

{{< doc-test paths="listeners" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="listeners" >}}
# Create self-signed certs referenced by the examples
mkdir -p examples/tls/certs certs
openssl req -x509 -newkey rsa:2048 -keyout examples/tls/certs/key.pem -out examples/tls/certs/cert.pem -days 365 -nodes -subj "/CN=localhost" 2>/dev/null
openssl req -x509 -newkey rsa:2048 -keyout examples/tls/certs/key-a.pem -out examples/tls/certs/cert-a.pem -days 365 -nodes -subj "/CN=a.example.com" 2>/dev/null
openssl req -x509 -newkey rsa:2048 -keyout examples/tls/certs/key-wildcard.pem -out examples/tls/certs/cert-wildcard.pem -days 365 -nodes -subj "/CN=wildcard.example.com" 2>/dev/null
cp examples/tls/certs/cert.pem certs/cert.pem
cp examples/tls/certs/key.pem certs/key.pem
{{< /doc-test >}}

## HTTP Listeners

An HTTP listener can be configured by setting `protocol: HTTP` in the listener configuration.
This is also the default protocol if no protocol is specified.

For example:
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - protocol: HTTP
    routes: []
```

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The HTTP listener example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the listener actually serves traffic at runtime — the config defines
#     no routes or backends to exercise.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - protocol: HTTP
    routes: []
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## HTTPS Listeners

Serving {{< gloss "HTTPS (HTTP Secure)" >}}HTTPS{{< /gloss >}} traffic requires TLS certificates and setting `protocol: HTTPS` in the listener configuration:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 443
  listeners:
  - protocol: HTTPS
    tls:
      cert: examples/tls/certs/cert.pem
      key: examples/tls/certs/key.pem
    routes: []
```

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The HTTPS listener example config (cert + key) is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That TLS is actually negotiated at runtime — requires a client connection
#     the page does not exercise.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 443
  listeners:
  - protocol: HTTPS
    tls:
      cert: examples/tls/certs/cert.pem
      key: examples/tls/certs/key.pem
    routes: []
EOF
agentgateway -f config2.yaml --validate-only
{{< /doc-test >}}

To generate a self-signed certificate for local testing, you can use `openssl`. Self-signed certificates trigger security warnings in browsers and clients, so use a certificate from a trusted certificate authority, such as Let's Encrypt, in production.

```sh
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
```

By default, a listener will match any traffic on the port.
Requests can be routed based on the [hostname](https://en.wikipedia.org/wiki/Server_Name_Indication) using the `hostname` field.
The most exact match will be used, as well as the corresponding TLS certificates.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 443
  listeners:
  - name: discrete
    protocol: HTTPS
    hostname: a.example.com
    tls:
      cert: examples/tls/certs/cert-a.pem
      key: examples/tls/certs/key-a.pem
    routes: []
  - name: wildcard
    protocol: HTTPS
    hostname: "*.example.com"
    tls:
      cert: examples/tls/certs/cert-wildcard.pem
      key: examples/tls/certs/key-wildcard.pem
    routes: []
```

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The hostname-based HTTPS example config (discrete + wildcard SNI) is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That SNI hostname matching selects the right cert at runtime — requires TLS
#     client connections the page does not exercise.
cat <<'EOF' > config3.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 443
  listeners:
  - name: discrete
    protocol: HTTPS
    hostname: a.example.com
    tls:
      cert: examples/tls/certs/cert-a.pem
      key: examples/tls/certs/key-a.pem
    routes: []
  - name: wildcard
    protocol: HTTPS
    hostname: "*.example.com"
    tls:
      cert: examples/tls/certs/cert-wildcard.pem
      key: examples/tls/certs/key-wildcard.pem
    routes: []
EOF
agentgateway -f config3.yaml --validate-only
{{< /doc-test >}}

### Redirect HTTP to HTTPS

To serve both HTTP and HTTPS, configure an HTTP listener that redirects all traffic to the HTTPS listener with a `requestRedirect` policy. The following example listens for plaintext HTTP on port 80 and redirects it to HTTPS, while serving encrypted traffic on port 443.

```yaml
binds:
- port: 80
  listeners:
  - name: http
    protocol: HTTP
    routes:
    - policies:
        requestRedirect:
          scheme: https
- port: 443
  listeners:
  - name: https
    protocol: HTTPS
    tls:
      cert: ./certs/cert.pem
      key: ./certs/key.pem
    routes: []
```

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The "Redirect HTTP to HTTPS" example config (HTTP requestRedirect + HTTPS listener) is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That an HTTP request is actually redirected to HTTPS at runtime — requires a
#     client request the page does not exercise.
cat <<'EOF' > config4.yaml
binds:
- port: 80
  listeners:
  - name: http
    protocol: HTTP
    routes:
    - policies:
        requestRedirect:
          scheme: https
- port: 443
  listeners:
  - name: https
    protocol: HTTPS
    tls:
      cert: ./certs/cert.pem
      key: ./certs/key.pem
    routes: []
EOF
agentgateway -f config4.yaml --validate-only
{{< /doc-test >}}

## TCP Listeners

TCP listeners can be configured by setting `protocol: TCP` in the listener configuration.
TCP listeners are useful when serving traffic that is not HTTP based.

> [!NOTE]
> A large portion of agentgateway's functionality is specific to HTTP traffic, and not available for TCP traffic.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 9000
  listeners:
  - name: default
    protocol: TCP
    tcpRoutes: []
```

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The TCP listener example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That TCP traffic is actually forwarded at runtime — the config defines no
#     tcpRoutes or backends to exercise.
cat <<'EOF' > config5.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 9000
  listeners:
  - name: default
    protocol: TCP
    tcpRoutes: []
EOF
agentgateway -f config5.yaml --validate-only
{{< /doc-test >}}

Additionally, note the use of `tcpRoutes` instead of `routes` (which are HTTP routes) in the example.

## Auto-detect protocol

Set `protocol: auto` to automatically detect the protocol for each incoming connection. The gateway peeks at the first byte of the connection. If the byte is `0x16` (a TLS ClientHello), the gateway dispatches the connection as TLS. Otherwise, the gateway dispatches it as HTTP. Use auto-detection in mixed-protocol environments where the same port accepts both TLS and plaintext traffic.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 443
  listeners:
  - protocol: auto
    routes: []
    tls:
      cert: examples/tls/certs/cert.pem
      key: examples/tls/certs/key.pem
```

<!-- NOTE: The `protocol: auto` example above is intentionally NOT covered by a doc test.
     The current agentgateway binary rejects `auto` (valid protocols: HTTP, HTTPS, TLS, TCP,
     HBONE), so this example does not validate. Flagged for a content/product review of the
     "Auto-detect protocol" section before adding a test. -->

## TLS Listeners

For serving TLS traffic, the `protocol: TLS` can be used.

> [!NOTE]
> TLS encrypted HTTP traffic should use [HTTPS listeners](#https-listeners).

TLS listeners can either _terminate_ or _passthrough_ TLS traffic.
While both a TCP and TLS passthrough listener do not terminate TLS, the latter enables the use of routing based on the hostname (utilizing [SNI](https://en.wikipedia.org/wiki/Server_Name_Indication)).

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 8443
  listeners:
  - hostname: passthrough.example.com
    protocol: TLS
    tcpRoutes: []
  - hostname: termination.example.com
    protocol: TLS
    tcpRoutes: []
    tls:
      cert: examples/tls/certs/cert.pem
      key: examples/tls/certs/key.pem
```

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The TLS listeners example config (passthrough + termination via SNI) is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That passthrough/termination behavior occurs at runtime — requires TLS client
#     connections and backends the page does not exercise.
cat <<'EOF' > config7.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 8443
  listeners:
  - hostname: passthrough.example.com
    protocol: TLS
    tcpRoutes: []
  - hostname: termination.example.com
    protocol: TLS
    tcpRoutes: []
    tls:
      cert: examples/tls/certs/cert.pem
      key: examples/tls/certs/key.pem
EOF
agentgateway -f config7.yaml --validate-only
{{< /doc-test >}}
