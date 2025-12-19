---
title: Basic authentication
weight: 16
---

[Basic authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication#basic_authentication_scheme) enables a simple username/password authentication mechanism.

**[Supported attachment points](/docs/configuration/policies/):** Listener and Route.

The **htpasswd** field specifies the username/password pairs. See the [htpasswd](https://httpd.apache.org/docs/current/programs/htpasswd.html) documentation.
The **realm** field, optionally, specifies the [realm name](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication#www-authenticate_and_proxy-authenticate_headers) returned in error responses.

Additionally, authentication can run in three different modes:
* **Strict**: A valid username/password must be present.
* **Optional** (default): If a username/password exists, validate it.  
  *Warning*: This allows requests without a valid username/password!

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

Requests can now be sent with the user details:

```shell
curl http://user1:agentgateway@localhost:3000
```

> [!WARNING]
> Basic authentication is not generally recommended for production use.
> At minimum, it should be used in conjunction with TLS.
