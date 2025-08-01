---
title: Set up a TLS listener
weight: 10
description:
---

You can configure the HTTP listener on the agentgateway with a TLS certificate to secure the communication to the agentgateway. 

## Before you begin

{{< reuse "docs/snippets/prereq-agentgateway.md" >}}

## Set up a TLS listener {#tls-listener}

1. Download the `.pem` files for certificate and key that you use to secure the HTTP listener. 
   ```sh
   curl -o examples/tls/certs/cert.pem https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/tls/certs/cert.pem
   curl -o examples/tls/certs/key.pem https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/tls/certs/key.pem
   ```

2. Download a TLS configuration for your agentgateway. 
   ```sh
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/tls/config.yaml -o config.yaml
   ```

3. Review the configuration file.
   * **Listener**: An HTTP listener is configured and exposed on port 3000. The listener is secured with the certificate and key that you downloaded earlier. 
   * **Backend**: The agentgateway targets a sample, open source MCP test server, `server-everything`. 
   
   ```
   cat config.yaml
   ```

   {{% github-yaml  url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/tls/config.yaml" %}}

4. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```
   
5. Send an HTTP request to the agentgateway. Verify that this request is denied and that you see a message that the HTTP protocol is not allowed. 
   ```sh
   curl -vik http://localhost:3000/sse
   ```
   
   Example output: 
   ```
   curl -vik http://localhost:3000/sse             
   ...
   > 
   * Request completely sent off
   * Received HTTP/0.9 when not allowed
   * Closing connection
   curl: (1) Received HTTP/0.9 when not allowed
   ```

6. Send an HTTPS request to the agentgateway. Verify that you see a TLS handshake and that a connection to the agentgateway can be established.
   ```sh
   curl -vik https://localhost:3000/sse
   ```
   
   Example output: 
   ```
   * Host localhost:3000 was resolved.
   * IPv6: ::1
   * IPv4: 127.0.0.1
   *   Trying [::1]:3000...
   * Connected to localhost (::1) port 3000
   * ALPN: curl offers h2,http/1.1
   * (304) (OUT), TLS handshake, Client hello (1):
   * (304) (IN), TLS handshake, Server hello (2):
   * (304) (IN), TLS handshake, Unknown (8):
   * (304) (IN), TLS handshake, Certificate (11):
   * (304) (IN), TLS handshake, CERT verify (15):
   * (304) (IN), TLS handshake, Finished (20):
   * (304) (OUT), TLS handshake, Finished (20):
   * SSL connection using TLSv1.3 / AEAD-CHACHA20-POLY1305-SHA256 / [blank] / UNDEF
   * ALPN: server accepted h2
   * Server certificate:
   *  subject: C=XX; ST=mass; L=boston; O=solo.io; OU=octo; CN=localhost
   *  start date: Apr  9 19:18:58 2025 GMT
   *  expire date: Apr  7 19:18:58 2035 GMT
   *  issuer: C=XX; ST=mass; L=boston; O=solo.io; OU=octo; CN=localhost
   *  SSL certificate verify result: self signed certificate (18), continuing anyway.
   * using HTTP/2
   * [HTTP/2] [1] OPENED stream for https://localhost:3000/sse
   * [HTTP/2] [1] [:method: GET]
   * [HTTP/2] [1] [:scheme: https]
   * [HTTP/2] [1] [:authority: localhost:3000]
   * [HTTP/2] [1] [:path: /sse]
   * [HTTP/2] [1] [user-agent: curl/8.7.1]
   * [HTTP/2] [1] [accept: */*]
   > GET /sse HTTP/2
   > Host: localhost:3000
   > User-Agent: curl/8.7.1
   > Accept: */*
   > 
   * Request completely sent off
   < HTTP/2 200 
   HTTP/2 200 
   ...

   event: endpoint
   data: ?sessionId=f25025b0f78d5a143ce43c36cedaebec
   ```

