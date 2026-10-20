---
title: Listeners
weight: 25
description: Define the ports, protocols, and TLS settings where agentgateway accepts incoming traffic.
test:
  listeners:
  - file: ${versionRoot}/documentation/configuration/listeners.md
    path: listeners
---

Listeners are the entrypoints for traffic into agentgateway.
Agentgateway supports both {{< gloss "HTTP (Hypertext Transfer Protocol)" >}}HTTP{{< /gloss >}} and {{< gloss "TCP (Transmission Control Protocol)" >}}TCP{{< /gloss >}} traffic, with and without {{< gloss "TLS (Transport Layer Security)" >}}TLS{{< /gloss >}}.

You configure a listener as part of a gateway. A gateway with a single listener sets the protocol and TLS settings directly, and a gateway that serves multiple hostnames on one port uses the `listeners` field to define each one. For more information about gateways and how routes attach to them, see [Gateways]({{< link-hextra path="/documentation/configuration/gateways/" >}}).

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

An HTTP listener can be configured by setting `protocol: HTTP` on the gateway.
This is also the default protocol if no protocol is specified.

You can add an HTTP listener in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add a gateway with an HTTP listener in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps.

1. Open **Traffic** > **Gateways**, and click **Add gateway**.
2. Enter a **Name** and a **Port**, such as `http` and `3000`.
3. Keep **HTTP** as the **Protocol**.

   {{< reuse-image src="img/ui-listeners-http.png" srcDark="img/ui-listeners-http-dark.png" >}}

4. Click **Save gateway**.

Because HTTP is the default protocol, the UI leaves the `protocol` field out of the gateway entry.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
For example:
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
    protocol: HTTP
routes: []
```
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The HTTP listener example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the listener actually serves traffic at runtime — the config defines
#     no routes or backends to exercise.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
    protocol: HTTP
routes: []
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## HTTPS Listeners

Serving {{< gloss "HTTPS (HTTP Secure)" >}}HTTPS{{< /gloss >}} traffic requires TLS certificates and setting `protocol: HTTPS` on the gateway. When you set `tls`, the protocol defaults to `HTTPS`, so you can also omit the `protocol` field.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open **Traffic** > **Gateways**, and click **Add gateway**.
2. Enter a **Name** and a **Port**, such as `https` and `443`.
3. Select **HTTPS** as the **Protocol**.
4. Expand the **TLS** section, and enter the paths to your files.
   * **Certificate**: `examples/tls/certs/cert.pem`
   * **Key**: `examples/tls/certs/key.pem`

   {{< reuse-image src="img/ui-listeners-https.png" srcDark="img/ui-listeners-https-dark.png" >}}

5. Click **Save gateway**.

The certificate and key files must exist when you save. Relative paths resolve from the directory where agentgateway runs. The UI leaves out `protocol: HTTPS`, because setting `tls` implies it.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 443
    protocol: HTTPS
    tls:
      cert: examples/tls/certs/cert.pem
      key: examples/tls/certs/key.pem
routes: []
```
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The HTTPS listener example config (cert + key) is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That TLS is actually negotiated at runtime — requires a client connection
#     the page does not exercise.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 443
    protocol: HTTPS
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
To serve multiple hostnames on one port, add a named listener for each one under the gateway's `listeners` field and set the `hostname` field. Traffic is then routed based on the [hostname](https://en.wikipedia.org/wiki/Server_Name_Indication).
The most exact match will be used, as well as the corresponding TLS certificates.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open **Traffic** > **Gateways**, and click **Add gateway**.
2. Enter a **Name** and a **Port**, such as `web` and `443`.
3. Select **Multiple listeners**, and click **Save gateway**. The gateway gets one listener named `listener1`.

   > [!NOTE]
   > Select **Multiple listeners** before you change other fields. The option is unavailable after you set a protocol, TLS, or a policy on the gateway.

4. In the listener table of the `web` gateway, click the edit icon for `listener1`, and fill out the **Edit listener** drawer.
   1. Enter `discrete` for the **Name**.
   2. Select **HTTPS** as the **Protocol**.
   3. Enter `a.example.com` for the **Hostname**.
   4. Expand the **TLS** section. Enter `examples/tls/certs/cert-a.pem` for the **Certificate** and `examples/tls/certs/key-a.pem` for the **Key**.

   {{< reuse-image src="img/ui-listeners-hostname.png" srcDark="img/ui-listeners-hostname-dark.png" >}}

5. Click **Save listener**.
6. In the header of the `web` gateway, click the **Add listener** icon. Repeat the previous steps for a `wildcard` listener with the `*.example.com` hostname and the `cert-wildcard.pem` and `key-wildcard.pem` files.

The UI leaves out `protocol: HTTPS` on each listener, because setting `tls` implies it.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  web:
    port: 443
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
routes: []
```
{{% /tab %}}
{{< /tabs >}}

To attach a route to one of these listeners instead of the whole gateway, reference it as `web/discrete` or `web/wildcard` in the route's `gateways` field.

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The hostname-based HTTPS example config (discrete + wildcard SNI) is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That SNI hostname matching selects the right cert at runtime — requires TLS
#     client connections the page does not exercise.
cat <<'EOF' > config3.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  web:
    port: 443
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
routes: []
EOF
agentgateway -f config3.yaml --validate-only
{{< /doc-test >}}

### Redirect HTTP to HTTPS

Listeners under one gateway share a port, so they cannot mix encrypted and plaintext traffic. To serve both HTTP and HTTPS, define a separate gateway for each, and attach a route with a `requestRedirect` policy to the HTTP gateway. The following example listens for plaintext HTTP on port 80 and redirects it to HTTPS, while serving encrypted traffic on port 443.

```yaml
gateways:
  http:
    port: 80
    protocol: HTTP
  https:
    port: 443
    protocol: HTTPS
    tls:
      cert: ./certs/cert.pem
      key: ./certs/key.pem
routes:
- name: redirect
  gateways: [http]  # Redirects plaintext traffic to the https gateway
  policies:
    requestRedirect:
      scheme: https
```

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The "Redirect HTTP to HTTPS" example config (HTTP requestRedirect + HTTPS gateway) is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That an HTTP request is actually redirected to HTTPS at runtime — requires a
#     client request the page does not exercise.
cat <<'EOF' > config4.yaml
gateways:
  http:
    port: 80
    protocol: HTTP
  https:
    port: 443
    protocol: HTTPS
    tls:
      cert: ./certs/cert.pem
      key: ./certs/key.pem
routes:
- name: redirect
  gateways: [http]
  policies:
    requestRedirect:
      scheme: https
EOF
agentgateway -f config4.yaml --validate-only
{{< /doc-test >}}

## TCP Listeners

TCP listeners can be configured by setting `protocol: TCP` on the gateway.
TCP listeners are useful when serving traffic that is not HTTP based.

> [!NOTE]
> A large portion of agentgateway's functionality is specific to HTTP traffic, and not available for TCP traffic.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open **Traffic** > **Gateways**, and click **Add gateway**.
2. Enter a **Name** and a **Port**, such as `tcp` and `9000`.
3. Select **TCP** as the **Protocol**.

   {{< reuse-image src="img/ui-listeners-tcp.png" srcDark="img/ui-listeners-tcp-dark.png" >}}

4. Click **Save gateway**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  tcp:
    port: 9000
    protocol: TCP
tcpRoutes: []
```
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The TCP listener example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That TCP traffic is actually forwarded at runtime — the config defines no
#     tcpRoutes or backends to exercise.
cat <<'EOF' > config5.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  tcp:
    port: 9000
    protocol: TCP
tcpRoutes: []
EOF
agentgateway -f config5.yaml --validate-only
{{< /doc-test >}}

Additionally, note the use of `tcpRoutes` instead of `routes` (which are HTTP routes) in the example.

## TLS Listeners

For serving TLS traffic, the `protocol: TLS` can be used.

> [!NOTE]
> TLS encrypted HTTP traffic should use [HTTPS listeners](#https-listeners).

TLS listeners can either _terminate_ or _passthrough_ TLS traffic.
While both a TCP and TLS passthrough listener do not terminate TLS, the latter enables the use of routing based on the hostname (utilizing [SNI](https://en.wikipedia.org/wiki/Server_Name_Indication)).

{{< tabs >}}
{{% tab name="UI" %}}
A TLS listener without a certificate passes TLS through. A TLS listener with a certificate and key terminates TLS.

1. Open **Traffic** > **Gateways**, and click **Add gateway**.
2. Enter a **Name** and a **Port**, such as `tls` and `8443`.
3. Select **Multiple listeners**, and click **Save gateway**. The gateway gets one listener named `listener1`.
4. In the listener table of the `tls` gateway, click the edit icon for `listener1`, and add the passthrough listener.
   1. Enter `passthrough` for the **Name**.
   2. Select **TLS** as the **Protocol**.
   3. Enter `passthrough.example.com` for the **Hostname**.
   4. Leave the **TLS** section empty.
5. Click **Save listener**.
6. In the header of the `tls` gateway, click the **Add listener** icon, and add the termination listener.
   1. Enter `termination` for the **Name**.
   2. Select **TLS** as the **Protocol**.
   3. Enter `termination.example.com` for the **Hostname**.
   4. Expand the **TLS** section. Enter `examples/tls/certs/cert.pem` for the **Certificate** and `examples/tls/certs/key.pem` for the **Key**.

   {{< reuse-image src="img/ui-listeners-tls.png" srcDark="img/ui-listeners-tls-dark.png" >}}

7. Click **Save listener**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  tls:
    port: 8443
    listeners:
    - name: passthrough
      hostname: passthrough.example.com
      protocol: TLS
    - name: termination
      hostname: termination.example.com
      protocol: TLS
      tls:
        cert: examples/tls/certs/cert.pem
        key: examples/tls/certs/key.pem
tcpRoutes: []
```
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="listeners" >}}
# WHAT THIS TEST VALIDATES:
#   * The TLS listeners example config (passthrough + termination via SNI) is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That passthrough/termination behavior occurs at runtime — requires TLS client
#     connections and backends the page does not exercise.
cat <<'EOF' > config7.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  tls:
    port: 8443
    listeners:
    - name: passthrough
      hostname: passthrough.example.com
      protocol: TLS
    - name: termination
      hostname: termination.example.com
      protocol: TLS
      tls:
        cert: examples/tls/certs/cert.pem
        key: examples/tls/certs/key.pem
tcpRoutes: []
EOF
agentgateway -f config7.yaml --validate-only
{{< /doc-test >}}
