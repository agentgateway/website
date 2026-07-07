---
title: Listeners
weight: 12
description: Configure listeners for agentgateway.
--- 

Listeners are the entrypoints for traffic into agentgateway.
Agentgateway supports both {{< gloss "HTTP (Hypertext Transfer Protocol)" >}}HTTP{{< /gloss >}} and {{< gloss "TCP (Transmission Control Protocol)" >}}TCP{{< /gloss >}} traffic, with and without {{< gloss "TLS (Transport Layer Security)" >}}TLS{{< /gloss >}}.

## HTTP Listeners

An HTTP listener can be configured by setting `protocol: HTTP` in the listener configuration.
This is also the default protocol if no protocol is specified.

For example:
```yaml
listeners:
- protocol: HTTP
  routes: []
```

## HTTPS Listeners

Serving {{< gloss "HTTPS (HTTP Secure)" >}}HTTPS{{< /gloss >}} traffic requires TLS certificates and setting `protocol: HTTPS` in the listener configuration:

```yaml
listeners:
- protocol: HTTPS
  tls:
    cert: examples/tls/certs/cert.pem
    key: examples/tls/certs/key.pem
```

To generate a self-signed certificate for local testing, you can use `openssl`. Self-signed certificates trigger security warnings in browsers and clients, so use a certificate from a trusted certificate authority, such as Let's Encrypt, in production.

```sh
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
```

By default, a listener will match any traffic on the port.
Requests can be routed based on the [hostname](https://en.wikipedia.org/wiki/Server_Name_Indication) using the `hostname` field.
The most exact match will be used, as well as the corresponding TLS certificates.

```yaml
listeners:
- name: discrete
  protocol: HTTPS
  hostname: a.example.com
  tls:
    cert: examples/tls/certs/cert-a.pem
    key: examples/tls/certs/key-a.pem
- name: wildcard
  protocol: HTTPS
  hostname: "*.example.com"
  tls:
    cert: examples/tls/certs/cert-wildcard.pem
    key: examples/tls/certs/key-wildcard.pem
```

For a complete HTTPS listener configuration, see the [mcp-tls example](https://github.com/agentgateway/agentgateway/blob/main/examples/mcp-tls/README.md).

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

## TCP Listeners

TCP listeners can be configured by setting `protocol: TCP` in the listener configuration.
TCP listeners are useful when serving traffic that is not HTTP based.

> [!NOTE]
> A large portion of agentgateway's functionality is specific to HTTP traffic, and not available for TCP traffic.

```yaml
listeners:
- name: default
  protocol: TCP
  tcpRoutes: []
```

Additionally, note the use of `tcpRoutes` instead of `routes` (which are HTTP routes) in the example.

## Auto-detect protocol

Set `protocol: auto` to automatically detect the protocol for each incoming connection. The gateway peeks at the first byte of the connection. If the byte is `0x16` (a TLS ClientHello), the gateway dispatches the connection as TLS. Otherwise, the gateway dispatches it as HTTP. Use auto-detection in mixed-protocol environments where the same port accepts both TLS and plaintext traffic.

```yaml
listeners:
- protocol: auto
  routes: []
  tls:
    cert: examples/tls/certs/cert.pem
    key: examples/tls/certs/key.pem
```

## TLS Listeners

For serving TLS traffic, the `protocol: TLS` can be used.

> [!NOTE]
> TLS encrypted HTTP traffic should use [HTTPS listeners](#https-listeners).

TLS listeners can either _terminate_ or _passthrough_ TLS traffic.
While both a TCP and TLS passthrough listener do not terminate TLS, the latter enables the use of routing based on the hostname (utilizing [SNI](https://en.wikipedia.org/wiki/Server_Name_Indication)).

```yaml
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
