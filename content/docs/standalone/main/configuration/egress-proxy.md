---
title: Egress proxy
weight: 37
description: Run agentgateway as an HTTP CONNECT proxy to control which destinations your clients can reach.
---

Agentgateway can act as an HTTP CONNECT proxy for outbound traffic. Clients point their proxy settings at agentgateway, and agentgateway decides which destinations they are allowed to reach.

## About the egress proxy

A client selects the proxy through the standard environment variable that most tools read.

```sh
export HTTPS_PROXY=http://127.0.0.1:3000
```

The client then sends `CONNECT <host>:443` to agentgateway instead of connecting to the destination directly. What agentgateway does with that request depends on which of the two CONNECT handling modes you configure.

| | Tunnel mode | Route mode |
| -- | -- | -- |
| Configuration | `tunnelProtocol: connect` on a bind | `frontendPolicies.connect.mode: route` |
| How a destination is matched | TLS SNI, through `tcpRoutes` hostnames | The CONNECT authority, through route `hostnames` |
| HTTP policies apply to the CONNECT request | No | Yes |
| Client authentication | Not available | Available, through `basicAuth` |
| A blocked destination fails with | A TLS error, after the tunnel is established | A `404` response to the CONNECT request |
| Can terminate TLS for selected hostnames | Yes | No |

Neither mode is a replacement for the other. Tunnel mode gives you SNI-based control and the option to terminate TLS, and route mode gives you the HTTP policy engine, including client authentication.

> [!NOTE]
> Policies that you attach to a listener on a `tunnelProtocol: connect` bind are not applied to the CONNECT request, because tunnel mode handles the request before route matching. To authenticate clients, use route mode.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Allowlist destinations without decrypting traffic

Use this pattern when you need to restrict outbound HTTPS by hostname and the traffic must stay encrypted end to end. Agentgateway reads the TLS SNI hostname for routing and forwards the encrypted connection without decrypting it.

1. Create a configuration file that accepts CONNECT requests on port 3000 and allowlists destinations by hostname.
   ```yaml
   cat <<EOF > egress.yaml
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     tunnelProtocol: connect
     listeners: []
   gateways:
     secure:
       port: 443
       listeners:
       - name: public-egress
         hostname: "*"
         protocol: TLS
   tcpRoutes:
   - name: public-egress-allowlist
     gateways: secure/public-egress
     hostnames:
     - pypi.org
     - files.pythonhosted.org
     backends:
     - dynamic: {}
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `binds[].tunnelProtocol` | Set to `connect` so that the bind accepts HTTP CONNECT requests. The other values are `direct`, which is the default, `proxy`, `hboneWaypoint`, and `hboneGateway`. |
   | `binds[].listeners` | Empty, because the tunneled traffic is handled by the `gateways` entry rather than by a listener on this bind. |
   | `gateways.secure.listeners[].protocol` | Set to `TLS` so that agentgateway inspects the SNI hostname without terminating the connection. |
   | `tcpRoutes[].hostnames` | The destinations that clients are allowed to reach. A destination that matches no entry has no route. |
   | `backends[].dynamic` | Sends the connection to the hostname from SNI, on the original destination port. |

2. Start agentgateway.
   ```sh
   agentgateway -f egress.yaml
   ```

3. In another terminal, verify that an allowed destination works.
   ```sh
   curl --proxy http://127.0.0.1:3000 --head https://pypi.org/
   ```

   Example output:
   ```console
   HTTP/1.1 200 OK
   ```

4. Verify that a destination that is not in the allowlist is refused.
   ```sh
   curl --proxy http://127.0.0.1:3000 --head https://example.com/
   ```

   Example output:
   ```console
   curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to example.com:443
   ```

   > [!IMPORTANT]
   > The CONNECT tunnel is established before the destination is checked, so the client sees a TLS error rather than a refusal from the proxy. To refuse a blocked destination at the proxy instead, use route mode, described in [Require client authentication](#require-client-authentication).

Package managers often download from several hostnames. Include artifact and redirect destinations, such as `files.pythonhosted.org`, not only the primary site.

### Send a permitted hostname to a different destination

To redirect an allowed hostname, set a TCP dynamic target expression. The expression must return a `host:port` string.

```yaml
tcpRoutes:
- hostnames:
  - pypi.org
  backends:
  - dynamic:
      target: 'destination.hostname == "pypi.org" ? "mirror.example.com:8443" : destination.hostname + ":" + string(destination.port)'
```

TCP target expressions can use `destination.hostname`, `destination.address`, `destination.port`, and `source.*`. This form applies to `tcpRoutes` only. A dynamic backend is not accepted as the destination for a policy call.

## Require client authentication

Use this pattern when only known clients may use the proxy. Route mode sends the CONNECT request through normal route matching, so HTTP policies such as `basicAuth` apply to it.

1. Create a user database in htpasswd format.
   ```sh
   printf 'egressuser:%s\n' "$(openssl passwd -apr1 'secretpw')" > htpasswd.txt
   ```

2. Create a configuration file that enables route mode and requires credentials.
   ```yaml
   cat <<EOF > egress-auth.yaml
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     connect:
       mode: route
   binds:
   - port: 3000
     listeners:
     - name: connect
       protocol: HTTP
       policies:
         basicAuth:
           htpasswd:
             file: htpasswd.txt
           mode: strict
           realm: agentgateway-egress
           authorizationLocation:
             header:
               name: proxy-authorization
               prefix: "Basic "
       routes:
       - name: egress-allowlist
         hostnames:
         - pypi.org
         - files.pythonhosted.org
         backends:
         - dynamic: {}
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `frontendPolicies.connect.mode` | Set to `route` so that CONNECT requests go through route matching. The other values are `tunnel`, which behaves like tunnel mode, and `deny`, which refuses CONNECT requests. |
   | `basicAuth.htpasswd` | The user database, either inline or loaded from a file. |
   | `basicAuth.mode` | Set to `strict` to require valid credentials. The default is `optional`, which validates credentials when a client sends them but allows requests that omit them. |
   | `basicAuth.realm` | The realm that agentgateway returns in the challenge. |
   | `basicAuth.authorizationLocation` | Set to the `proxy-authorization` header. Reading the credential from this header is what makes agentgateway answer with `407` and `Proxy-Authenticate` instead of `401` and `WWW-Authenticate`. |
   | `routes[].hostnames` | The destinations that clients are allowed to reach, matched against the CONNECT authority. |

3. Start agentgateway.
   ```sh
   agentgateway -f egress-auth.yaml
   ```

4. Verify that a request without credentials is challenged. The `--verbose` flag is required, because the proxy response is not the response that `curl` reports.
   ```sh
   curl --verbose --proxy http://127.0.0.1:3000 --head https://pypi.org/
   ```

   Example output:
   ```console
   * CONNECT tunnel: HTTP/1.1 negotiated
   < HTTP/1.1 407 Proxy Authentication Required
   < proxy-authenticate: Basic realm="agentgateway-egress"
   * CONNECT tunnel failed, response 407
   ```

5. Verify that a request with credentials reaches an allowed destination.
   ```sh
   curl --proxy http://127.0.0.1:3000 --proxy-user egressuser:secretpw --head https://pypi.org/
   ```

   Example output:
   ```console
   HTTP/1.1 200 OK
   ```

6. Verify that a destination that is not in the allowlist is refused, even for an authenticated client. Agentgateway returns `404` to the CONNECT request, because no route matches the destination.
   ```sh
   curl --verbose --proxy http://127.0.0.1:3000 --proxy-user egressuser:secretpw --head https://example.com/
   ```

   Example output:
   ```console
   * CONNECT tunnel: HTTP/1.1 negotiated
   < HTTP/1.1 404 Not Found
   * CONNECT tunnel failed, response 404
   ```

> [!TIP]
> A proxy response is not the response that `curl` reports. When the proxy refuses a request, `curl` writes `000` for the HTTP status and exits with code `56`, so the `407` and the `404` are visible only with `--verbose`.

## Terminate TLS for selected hostnames

Use this pattern when most destinations must stay encrypted end to end, but agentgateway must serve selected hostnames itself. This pattern uses tunnel mode, and adds HTTPS listeners for the hostnames that agentgateway terminates.

1. Generate a certificate authority and a certificate for the hostnames that agentgateway serves.
   ```sh
   openssl req -x509 -newkey rsa:2048 -nodes -keyout ca-key.pem -out ca-cert.pem -days 30 \
     -subj "/CN=agentgateway egress CA"
   openssl req -newkey rsa:2048 -nodes -keyout key.pem -out csr.pem -subj "/CN=egress"
   printf "subjectAltName=DNS:llm.example.com,DNS:static.example.com\n" > san.ext
   openssl x509 -req -in csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial \
     -out cert.pem -days 30 -extfile san.ext
   ```

   > [!WARNING]
   > This certificate authority is for local testing. Do not distribute it outside your test environment. Generate and protect a certificate authority that is appropriate for your environment.

2. Create a configuration file that terminates TLS for two hostnames and passes every other allowed hostname through.
   ```yaml
   cat <<EOF > egress-conditional.yaml
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     tunnelProtocol: connect
     listeners: []
   gateways:
     secure:
       port: 443
       listeners:
       - name: llm
         hostname: llm.example.com
         protocol: HTTPS
         tls:
           cert: cert.pem
           key: key.pem
       - name: direct-response
         hostname: static.example.com
         protocol: HTTPS
         tls:
           cert: cert.pem
           key: key.pem
       - name: public-egress
         hostname: "*"
         protocol: TLS
   tcpRoutes:
   - name: public-egress-allowlist
     gateways: secure/public-egress
     hostnames:
     - pypi.org
     - files.pythonhosted.org
     backends:
     - dynamic: {}
   routes:
   - name: static-response
     gateways: secure/direct-response
     policies:
       directResponse:
         status: 200
         body: hello from agentgateway
   llm:
     gateways: secure/llm
     models:
     - name: smart
       provider: openAI
       params:
         model: gpt-5.5
   EOF
   ```

   The listener with the `*` hostname matches last, so the two named hostnames are terminated and every other allowed hostname passes through encrypted.

3. Start agentgateway. The LLM routes need a provider key to be present, but listing models is handled locally and does not call the provider.
   ```sh
   OPENAI_API_KEY=dummy agentgateway -f egress-conditional.yaml
   ```

4. Verify that an allowlisted public destination still passes through unchanged.
   ```sh
   curl --proxy http://127.0.0.1:3000 --head https://pypi.org/
   ```

   Example output:
   ```console
   HTTP/1.1 200 OK
   ```

5. Verify the hostname that returns a configured response.
   ```sh
   curl --proxy http://127.0.0.1:3000 --cacert ca-cert.pem https://static.example.com/
   ```

   Example output:
   ```console
   hello from agentgateway
   ```

6. Verify that the LLM hostname serves the configured model catalog.
   ```sh
   curl --proxy http://127.0.0.1:3000 --cacert ca-cert.pem https://llm.example.com/v1/models
   ```

   Example output:
   ```json
   {"data":[{"id":"smart","object":"model","created":1787773708,"owned_by":"openai"}],"object":"list"}
   ```

## Inspect all HTTPS traffic

Use this pattern when agentgateway must apply HTTP policies to every outbound request. Agentgateway issues a certificate for each requested hostname from a certificate authority that you supply, then opens a separate TLS connection to the destination.

1. Create a configuration file that terminates every HTTPS stream with a dynamic certificate.
   ```yaml
   cat <<EOF > egress-inspect.yaml
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     tunnelProtocol: connect
     listeners: []
   - port: 443
     mode: internal
     listeners:
     - protocol: HTTPS
       tls:
         mode: dynamicCa
         cert: ca-cert.pem
         key: ca-key.pem
       routes:
       - backends:
         - dynamic: {}
           policies:
             backendTLS: {}
         policies:
           transformations:
             request:
               set:
                 x-agentgateway-req-message: "'Hello from agentgateway!'"
             response:
               set:
                 x-agentgateway-resp-message: "'Hello from agentgateway!'"
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `binds[].mode` | Set to `internal` so that the bind routes traffic without opening a listener socket on port 443. The default is `standard`, which binds the port. |
   | `tls.mode` | Set to `dynamicCa` so that `cert` and `key` are treated as a certificate authority that issues a leaf certificate for each requested hostname. The default is `static`, which treats them as the leaf certificate. |
   | `backendTLS` | Adds TLS back to the outgoing request, because agentgateway terminated the client connection. |
   | `transformations` | Included to show that HTTP policies now apply. Replace this policy with the policies that you need. |

2. Start agentgateway.
   ```sh
   agentgateway -f egress-inspect.yaml
   ```

3. Send a request to an endpoint that echoes request headers, and trust the certificate authority.
   ```sh
   curl --proxy http://127.0.0.1:3000 --cacert ca-cert.pem --include https://httpbingo.org/headers
   ```

   The response headers include the header that the response policy adds:
   ```console
   x-agentgateway-resp-message: Hello from agentgateway!
   ```

   The response body shows the header that the request policy added to the upstream request:
   ```console
   "X-Agentgateway-Req-Message": [
     "Hello from agentgateway!"
   ]
   ```

> [!WARNING]
> This configuration has no hostname allowlist, so it permits every HTTPS destination. To restrict destinations as well, add route `hostnames` entries, or combine this pattern with one of the allowlist patterns on this page.

## Choose a pattern

* To restrict outbound traffic by hostname and keep it encrypted, use [Allowlist destinations without decrypting traffic](#allowlist-destinations-without-decrypting-traffic).
* To restrict who may use the proxy, use [Require client authentication](#require-client-authentication). This pattern also refuses a blocked destination at the proxy rather than through a TLS error.
* To serve selected hostnames from agentgateway while everything else passes through, use [Terminate TLS for selected hostnames](#terminate-tls-for-selected-hostnames).
* To apply HTTP policies to every outbound request, use [Inspect all HTTPS traffic](#inspect-all-https-traffic).

Run one configuration at a time. Each configuration on this page listens for proxy requests on port 3000.
