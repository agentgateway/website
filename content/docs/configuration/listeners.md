---
title: Listeners
weight: 12
description: Configure listeners for agentgateway.
--- 

Listeners are the entrypoints for traffic into agentgateway.
Agentgateway supports both HTTP and TCP traffic, with and without TLS.

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

Serving HTTPS traffic requires TLS certificates and setting `protocol: HTTPS` in the listener configuration:

```yaml
listeners:
- protocol: HTTPS
  tls:
    cert: examples/tls/certs/cert.pem
    key: examples/tls/certs/key.pem
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
