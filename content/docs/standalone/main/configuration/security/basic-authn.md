---
title: Basic authentication
weight: 16
description: Configure simple username and password authentication for your routes.
test:
  basic-authn:
  - file: content/docs/standalone/main/configuration/security/basic-authn.md
    path: basic-authn
---

Attaches to: {{< badge content="Listener" path="/configuration/listeners/">}} {{< badge content="Route" path="/configuration/routes/">}}

{{< doc-test paths="basic-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway.md" >}}
{{< /doc-test >}}

[Basic authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication#basic_authentication_scheme) enables a simple username/password authentication mechanism.

> [!WARNING]
> Basic authentication is not generally recommended for production use.
> At a minimum, use basic authentication along with TLS encryption.

The **htpasswd** field specifies the username/password pairs. See the [htpasswd](https://httpd.apache.org/docs/current/programs/htpasswd.html) documentation.
The **realm** field, optionally, specifies the [realm name](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication#www-authenticate_and_proxy-authenticate_headers) returned in error responses.

Additionally, authentication can run in two different modes:
* **Strict**: A valid username/password pair must be present.
* **Optional** (default): If a username/password pair exists, validate it.  
  *Warning*: This allows requests without a username/password pair!

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      basicAuth:
        mode: strict
        # Generated with `htpasswd -nb -B user1 agentgateway`
        # You can also use:
        # htpasswd:
        #   file: /path/to/htpasswd
        # With inline configuration, $ must be escaped to $$.
        htpasswd: |
          user1:$$2y$$05$$LMZ.8WGNqvagmtJz2Gw6VuiE6khXc2zc0FDTHrfWJyLT66HM8BMAa
        realm: example.com
    routes:
    - backends:
      - host: localhost:8080
```

{{< doc-test paths="basic-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The basicAuth listener-level authentication example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That credentials are actually enforced at runtime — requires a backend
#     the page omits to forward to.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      basicAuth:
        mode: strict
        # Generated with `htpasswd -nb -B user1 agentgateway`
        # You can also use:
        # htpasswd:
        #   file: /path/to/htpasswd
        # With inline configuration, $ must be escaped to $$.
        htpasswd: |
          user1:$$2y$$05$$LMZ.8WGNqvagmtJz2Gw6VuiE6khXc2zc0FDTHrfWJyLT66HM8BMAa
        realm: example.com
    routes:
    - backends:
      - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

Now to send requests, include the username and password.

```shell
curl http://user1:agentgateway@localhost:3000
```
