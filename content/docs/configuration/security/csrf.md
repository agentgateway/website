---
title: CSRF
weight: 10
---

Cross-Site Request Forgery ([CSRF](https://developer.mozilla.org/en-US/docs/Glossary/CSRF)) protection prevents malicious websites from making unauthorized requests to your application on behalf of authenticated users.

## How it works

The CSRF policy implements a multi-layered validation approach to allow or block requests based on their properties. 

CSRF protection is enforced by the server and blocks malicious cross-site requests before they reach your backend. Unlike CORS, CSRF protection works with all HTTP clients, not just browsers.

### Allowed requests

Allowed requests are as follows.

- Safe methods (`GET`, `HEAD`, `OPTIONS`) from any origin
- Same-origin requests (`Origin` matches `Host`)
- Requests from origins in `additional_origins`
- Requests with `Sec-Fetch-Site: same-origin` or `Sec-Fetch-Site: none`

### Blocked requests

Blocked requests, which receive a `403 Forbidden` response with the message "CSRF validation failed", are as follows.

- Cross-site requests with `Sec-Fetch-Site: cross-site` (unless trusted)
- Cross-site requests where `Origin` doesn't match `Host` (unless trusted)
- Malformed `Origin` headers in cross-site contexts

## Configuration

{{< reuse "docs/snippets/review-configuration.md" >}}

```yaml
policies:
  csrf:
    additional_origins:
      - "https://www.example.com"
      - "https://trusted.domain.com"
```

The `additional_origins` setting is a list of trusted origins allowed to make cross-site requests.
- Format: `"scheme://host[:port]"`
- Examples: `"https://www.example.com"`, `"http://localhost:3000"`

For strict CSRF protection to prevent all cross-site requests, set `additional_origins` to an empty list.

```yaml
...
policies:
  csrf:
    additional_origins: []
```
