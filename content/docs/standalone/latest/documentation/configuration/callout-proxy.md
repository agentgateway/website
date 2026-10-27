---
title: Callout proxy
weight: 38
description: Send the requests that agentgateway makes on its own behalf, such as JWKS fetches and external authorization calls, through a forward proxy.
---

In networks where outbound traffic must leave through a corporate HTTP proxy, you can send the requests that agentgateway makes on its own behalf through that forward proxy. These requests are called callouts. Callouts that use TLS go through the forward proxy in an HTTP CONNECT tunnel, and plaintext callouts go to the forward proxy as standard forward-proxy requests.

## About callouts

A callout is any request that agentgateway sends for itself rather than for a client. Callouts include the following requests.

* Remote JSON Web Key Set (JWKS) fetches for JSON Web Token (JWT) authentication.
* OpenID Connect (OIDC) discovery, including for MCP authentication.
* [External authorization]({{< link-hextra path="/documentation/configuration/security/external-authz" >}}), external processing, and remote rate limit requests.
* Guardrail requests, such as webhooks, OpenAI moderation, AWS Bedrock Guardrails, Google Model Armor, and Azure AI Content Safety.
* Virtual model callout routing requests.
* Credential fetches from cloud providers, such as AWS, Azure, and Google Cloud Platform (GCP).

Client traffic to your primary backends is not a callout, so the callout proxy does not apply to it. To send backend traffic through a forward proxy, set the `backendTunnel` policy on the backend instead. To proxy CONNECT requests from your clients instead, see [Egress proxy]({{< link-hextra path="/documentation/configuration/egress-proxy/" >}}).

## Configure the callout proxy

You can configure the callout proxy in either of the following ways.

* **[In the configuration file](#configuration-file)**: Set `config.callouts.tunnel`. Use this method to keep the forward proxy settings with the rest of your configuration.
* **[With environment variables](#environment-variables)**: Set the standard proxy environment variables, such as `HTTPS_PROXY`. Use this method to send GCP credential fetches through the forward proxy, or to reuse variables that your environment already sets.

If you use both, `config.callouts.tunnel` takes precedence, and agentgateway ignores the proxy environment variables for most callouts. GCP credential fetches are the exception. These fetches never use `config.callouts.tunnel`, and they still use the proxy environment variables if you set them.

### Option 1: Configuration file {#configuration-file}

Set `config.callouts.tunnel` in your configuration file to configure the forward proxy that you want to route requests through. Settings in the `config` section take effect at startup, so restart agentgateway after you change this setting. For more information, see [Static configuration]({{< link-hextra path="/documentation/configuration/static-configuration/" >}}).

```yaml
config:
  callouts:
    tunnel:
      url: http://proxy.example.com:3128
      noProxy:
      - internal.example.com
      - 10.0.0.0/8
```

| Setting | Description |
| -- | -- |
| `config.callouts.tunnel.url` | The URL and port of the forward proxy. This forward proxy handles every callout, whether the callout uses Transport Layer Security (TLS) or plaintext. The scheme must be `http` or `https`. With `https`, the connection to the forward proxy uses TLS, and the forward proxy certificate is verified against the system trust bundle. If you omit the port, the default is `80` for `http` and `443` for `https`. To authenticate to the forward proxy with basic authentication, include the credentials in the URL, such as `http://user:password@proxy.example.com:3128`. The `agentgateway --validate-only` command, which checks a configuration file without starting agentgateway, does not check the scheme. A URL with an unsupported scheme, such as `socks5://`, passes validation, and then agentgateway fails to start with an `invalid callouts config` error. |
| `config.callouts.tunnel.noProxy` | Optional. Destinations that bypass the forward proxy. Each entry is a hostname, an IP address, a Classless Inter-Domain Routing (CIDR) range, or `*` for every destination. A hostname also matches its subdomains. |

### Option 2: Environment variables {#environment-variables}

Set the following variables in the environment that runs agentgateway. Agentgateway reads them at startup. Uppercase names take precedence over lowercase names, such as `HTTPS_PROXY` over `https_proxy`.

| Variable | Description |
| -- | -- |
| `HTTPS_PROXY` | The forward proxy for callouts that use TLS. |
| `HTTP_PROXY` | The forward proxy for plaintext callouts. |
| `ALL_PROXY` | The forward proxy for callouts when you omit `HTTPS_PROXY` or `HTTP_PROXY`. |
| `NO_PROXY` | A comma-separated list of destinations that bypass the forward proxy, in the same syntax as `noProxy`. |

You can set `NO_PROXY` together with the other variables. The following example sends TLS and plaintext callouts through the same forward proxy, and keeps callouts to `internal.example.com`, its subdomains, and the `10.0.0.0/8` range direct.

```sh
export HTTPS_PROXY=http://proxy.example.com:3128
export HTTP_PROXY=http://proxy.example.com:3128
export NO_PROXY=internal.example.com,10.0.0.0/8
agentgateway -f config.yaml
```

> [!IMPORTANT]
> The proxy environment variables apply to callouts even when you set the variables for another purpose. If the environment that runs agentgateway exports `HTTPS_PROXY` for other tools, callouts also go through that forward proxy. To keep callouts direct, unset the variables for the agentgateway process, or set `NO_PROXY` to `*`.

## Destinations that bypass the forward proxy {#destinations-that-bypass-the-proxy}

The following callouts go directly to their destination, even when you configure a forward proxy.

* Destinations that match `noProxy` or `NO_PROXY`.
* Loopback and link-local IP addresses, such as `127.0.0.1` and the cloud metadata server at `169.254.169.254`. A remote forward proxy cannot reach these addresses. This rule applies to IP addresses only. A callout to the hostname `localhost` goes through the forward proxy, so add `localhost` to `noProxy` or `NO_PROXY` if your callout targets use it.
* Callouts to a backend that has its own `backendTunnel` policy. These callouts use that tunnel instead.
* Callouts to a service from the top-level `services` list, and to Unix domain sockets.
* GCP credential fetches, when you configure the proxy with `config.callouts.tunnel`. To send these fetches through a forward proxy, use the environment variables instead.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Set up a forward proxy that supports the CONNECT method and logs the requests that it receives. The following steps assume that the forward proxy listens on `http://127.0.0.1:3128`. If you do not have a forward proxy, run Squid in Docker as a test forward proxy.
   1. Create a Squid configuration file that allows requests from any client. The default Squid configuration rejects requests from the Docker bridge network with a `403` response.
      ```sh
      cat <<EOF > squid.conf
      http_port 3128
      acl all src all
      http_access allow all
      EOF
      ```
   2. Start Squid with this configuration file, and publish port `3128` on your machine.
      ```sh
      docker run -d --name squid -p 3128:3128 \
        -v "$(pwd)/squid.conf:/etc/squid/squid.conf" ubuntu/squid:latest
      ```

## Send a JWKS fetch through the forward proxy {#send-a-jwks-fetch-through-the-proxy}

Configure JWT authentication with a remote JWKS, and send callouts through the forward proxy with `config.callouts.tunnel`. Then confirm in the forward proxy log that the JWKS fetch goes through the forward proxy. The last step shows the same test with environment variables instead. A JWKS fetch is a good test because agentgateway makes it at startup, before any client traffic arrives.

1. Create a configuration file that fetches a remote JWKS and sends callouts through the forward proxy.
   ```yaml
   cat <<EOF > callout-proxy.yaml
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   config:
     callouts:
       tunnel:
         url: http://127.0.0.1:3128
   binds:
   - port: 3000
     listeners:
     - routes:
       - policies:
           jwtAuth:
             mode: strict
             issuer: https://accounts.google.com
             jwks:
               url: https://www.googleapis.com/oauth2/v3/certs
         backends:
         - host: httpbin.org:80
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `config.callouts.tunnel.url` | The address of the forward proxy. The loopback bypass applies to callout destinations, not to the forward proxy. A forward proxy on `127.0.0.1` still receives the callouts. |
   | `jwtAuth.jwks.url` | The remote JWKS. The JWKS fetch is a callout and goes through the forward proxy. |
   | `backends[].host` | The primary backend. Client requests to this backend are not callouts and do not use the forward proxy. |

2. Validate the configuration.
   ```sh
   agentgateway --validate-only -f callout-proxy.yaml
   ```

   Example output:
   ```console
   Configuration is valid!
   ```

3. Start agentgateway. The JWKS fetch happens at startup. If the forward proxy is unreachable, the fetch fails and agentgateway exits with a `failed to load JWKS` error.
   ```sh
   agentgateway -f callout-proxy.yaml
   ```

   The startup logs include a line that names the forward proxy.
   ```console
   info	client::callout	callouts will use proxy Matcher { http: Intercept { uri: http://127.0.0.1:3128/ }, https: Intercept { uri: http://127.0.0.1:3128/ } }
   ```

4. In a second terminal, check the access log of your forward proxy for a CONNECT request to `www.googleapis.com:443`, the JWKS host. If you use the Squid container from [Before you begin](#before-you-begin), run the following command. For another forward proxy, the log location and format differ.
   ```sh
   docker exec squid cat /var/log/squid/access.log
   ```

   Example output:
   ```console
   1791983992.466   1203 172.17.0.1 TCP_TUNNEL/200 6287 CONNECT www.googleapis.com:443 - HIER_DIRECT/142.250.80.74 -
   ```

   If the log has no CONNECT entry, stop agentgateway with Ctrl+C, and then check the log again. Squid writes the entry only when the tunnel closes, and agentgateway keeps the tunnel open to reuse it.

5. Optional: To use environment variables instead, remove the `config.callouts` section from the configuration file. Then, start agentgateway with the `HTTPS_PROXY` variable set. The forward proxy log shows the same CONNECT request.
   ```sh
   HTTPS_PROXY=http://127.0.0.1:3128 agentgateway -f callout-proxy.yaml
   ```

## Configuration reference

For every field in the `config.callouts` section, see the [configuration schema]({{< link-hextra path="/reference/configuration/schema/" >}}).
