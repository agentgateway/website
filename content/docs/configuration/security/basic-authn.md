---
title: Basic authentication
weight: 16
---

Attach to:
{{< badge content="Listener" link="/docs/configuration/listeners/">}} {{< badge content="Route" link="/docs/configuration/routes/">}}

[Basic authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication#basic_authentication_scheme) enables a simple username/password authentication mechanism.

> [!WARNING]
> Basic authentication is not generally recommended for production use.
> At minimum, use basic authentication along with TLS encryption.

The **htpasswd** field specifies the username/password pairs. See the [htpasswd](https://httpd.apache.org/docs/current/programs/htpasswd.html) documentation.
The **realm** field, optionally, specifies the [realm name](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication#www-authenticate_and_proxy-authenticate_headers) returned in error responses.

Additionally, authentication can run in two different modes:
* **Strict**: A valid username/password pair must be present.
* **Optional** (default): If a username/password pair exists, validate it.  
  *Warning*: This allows requests without a username/password pair!

```yaml
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
```

Now to send requests, include the username and password.

```shell
curl http://user1:agentgateway@localhost:3000
```
