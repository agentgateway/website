---
title: Callout proxy
weight: 38
description: Send the requests that agentgateway makes on its own behalf, such as JWKS fetches and external authorization calls, through an HTTP proxy.
---

In networks where outbound traffic must leave through a corporate HTTP proxy, you can send the requests that agentgateway makes on its own behalf through that proxy. These requests are called callouts. Callouts that use TLS go through the proxy in an HTTP CONNECT tunnel, and plaintext callouts go to the proxy as standard forward-proxy requests.

## About callouts

A callout is any request that agentgateway sends for itself rather than for a client. Callouts include the following requests.

* Remote JSON Web Key Set (JWKS) fetches for JSON Web Token (JWT) authentication.
* OpenID Connect (OIDC) discovery, including for MCP authentication.
* [External authorization]({{< link-hextra path="/documentation/configuration/security/external-authz" >}}), external processing, and remote rate limit requests.
* Guardrail requests, such as webhooks, OpenAI moderation, AWS Bedrock Guardrails, Google Model Armor, and Azure AI Content Safety.
* Virtual model callout routing requests.
* Cloud provider credential fetches, such as AWS and Azure credentials.

Client traffic to your primary backends is not a callout, so the callout proxy does not apply to it. To send backend traffic through a proxy, set the `backendTunnel` policy on the backend instead. To proxy CONNECT requests from your clients instead, see [Egress proxy]({{< link-hextra path="/documentation/configuration/egress-proxy/" >}}).

## Configure the proxy

You can configure the callout proxy in either of the following ways.

* **In the configuration file**: Set `config.callouts.tunnel`. Settings in the `config` section take effect at startup, so restart agentgateway after you change this setting. For more information, see [Static configuration]({{< link-hextra path="/documentation/configuration/static-configuration/" >}}).
* **With environment variables**: Omit `config.callouts.tunnel` and set the standard proxy environment variables in the environment that runs agentgateway. When you set `config.callouts.tunnel`, the proxy environment variables have no effect on callouts.

### Configuration file

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
| `config.callouts.tunnel.url` | The URL of the proxy. This proxy handles every callout, whether the callout uses Transport Layer Security (TLS) or plaintext. The scheme must be `http` or `https`. With `https`, the connection to the proxy uses TLS, and the proxy certificate is verified against the system trust bundle. If you omit the port, the default is `80` for `http` and `443` for `https`. To authenticate to the proxy with basic authentication, include the credentials in the URL, such as `http://user:password@proxy.example.com:3128`. The `--validate-only` flag does not check the scheme. A URL with an unsupported scheme, such as `socks5://`, passes validation, and then agentgateway fails to start with an `invalid callouts config` error. |
| `config.callouts.tunnel.noProxy` | Optional. Destinations that bypass the proxy. Entries use the `NO_PROXY` syntax: a hostname, which also matches its subdomains, an IP address, a Classless Inter-Domain Routing (CIDR) range, or `*` to bypass the proxy for every destination. |

### Environment variables

If you omit `config.callouts.tunnel`, agentgateway reads the following environment variables at startup. Uppercase names take precedence over lowercase names, such as `HTTPS_PROXY` over `https_proxy`.

| Variable | Description |
| -- | -- |
| `HTTPS_PROXY` | The proxy for callouts that use TLS. |
| `HTTP_PROXY` | The proxy for plaintext callouts. |
| `ALL_PROXY` | The proxy for callouts whose scheme-specific variable is unset. |
| `NO_PROXY` | A comma-separated list of destinations that bypass the proxy, in the same syntax as `noProxy`. |

> [!IMPORTANT]
> The proxy environment variables apply to callouts even when you set the variables for another purpose. If the environment that runs agentgateway exports `HTTPS_PROXY` for other tools, callouts also go through that proxy. To keep callouts direct, unset the variables for the agentgateway process, or set `NO_PROXY` to `*`.

## Destinations that bypass the proxy

The following callouts go directly to their destination, even when you configure a proxy.

* Destinations that match `noProxy` or `NO_PROXY`.
* Loopback and link-local IP addresses, such as `127.0.0.1` and the cloud metadata server at `169.254.169.254`. A remote proxy cannot reach these addresses. This rule applies to IP addresses only. A callout to the hostname `localhost` goes through the proxy, so add `localhost` to `noProxy` or `NO_PROXY` if your callout targets use it.
* Callouts to a backend that has its own `backendTunnel` policy. These callouts use that tunnel instead.
* Callouts to a service from the top-level `services` list, and to Unix domain sockets.
* Google Cloud Platform (GCP) credential fetches, when you configure the proxy with `config.callouts.tunnel`. To send these fetches through a proxy, use the environment variables instead.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You also need an HTTP proxy that supports the CONNECT method and logs the requests that it receives, such as Squid. The following steps assume that the proxy listens on `http://127.0.0.1:3128`.

## Send a JWKS fetch through the proxy

Configure JWT authentication with a remote JWKS, and confirm in the proxy log that the JWKS fetch goes through the proxy. A JWKS fetch is a good test because agentgateway makes it at startup, before any client traffic arrives.

1. Create a configuration file that fetches a remote JWKS and sends callouts through the proxy.
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
   | `config.callouts.tunnel.url` | The address of the proxy. The loopback bypass applies to callout destinations, not to the proxy. A proxy on `127.0.0.1` still receives the callouts. |
   | `jwtAuth.jwks.url` | The remote JWKS. The JWKS fetch is a callout and goes through the proxy. |
   | `backends[].host` | The primary backend. Client requests to this backend are not callouts and do not use the proxy. |

2. Validate the configuration.
   ```sh
   agentgateway --validate-only -f callout-proxy.yaml
   ```

   Example output:
   ```console
   Configuration is valid!
   ```

3. Start agentgateway. The JWKS fetch happens at startup. If the proxy is unreachable, the fetch fails and agentgateway exits with a `failed to load JWKS` error.
   ```sh
   agentgateway -f callout-proxy.yaml
   ```

   The startup logs include a line that names the callout proxy.
   ```console
   info	client::callout	callouts will use proxy Matcher { http: Intercept { uri: http://127.0.0.1:3128/ }, https: Intercept { uri: http://127.0.0.1:3128/ } }
   ```

4. Check the access log of your proxy for a CONNECT request to `www.googleapis.com:443`, the JWKS host. The log format depends on your proxy.

5. Optional: To use environment variables instead, remove the `config.callouts` section from the configuration file. Then, start agentgateway with the `HTTPS_PROXY` variable set. The proxy log shows the same CONNECT request.
   ```sh
   HTTPS_PROXY=http://127.0.0.1:3128 agentgateway -f callout-proxy.yaml
   ```

## Configuration reference

For every field in the `config.callouts` section, see the [configuration schema]({{< link-hextra path="/reference/configuration/schema/" >}}).
