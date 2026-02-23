---
title: CSRF
weight: 11
---

Attach to:
{{< badge content="Route" link="/docs/configuration/routes/">}}


## About CSRF protection

According to [OWASP](https://owasp.org/www-community/attacks/csrf), CSRF is defined as follows:

> Cross-Site Request Forgery (CSRF) is an attack that forces an end user to execute unwanted actions on a web application in which they're currently authenticated. With a little help of social engineering (such as sending a link via email or chat), an attacker may trick the users of a web application into executing actions of the attacker's choosing. If the victim is a normal user, a successful CSRF attack can force the user to perform state changing requests like transferring funds, changing their email address, and so forth. If the victim is an administrative account, CSRF can compromise the entire web application.

To help prevent CSRF attacks, the CSRF policy implements a multi-layered validation approach to allow or block requests based on their properties. The policy checks that the request's origin matches its destination. If the origin and destination do not match, a 403 Forbidden error code is returned. Unlike CORS, CSRF protection works with all HTTP clients, not just browsers.


Review the following diagram to see an example CSRF request flow:
```mermaid
sequenceDiagram
    participant Attacker as Malicious Site<br/>(attacker.com)
    participant User as User's Browser
    participant AGW as AgentGateway Proxy
    participant Backend as Backend Service

    Note over Attacker,Backend: CSRF Attack Attempt

    Attacker->>User: Trick user into visiting<br/>malicious page with hidden form
    User->>AGW: POST /api/action<br/>Origin: malicioussite.com<br/>Cookie: session=abc123

    AGW->>AGW: CSRF validation:<br/>Origin (malicioussite.com)<br/>vs Destination (api.example.com)

    alt Origin does NOT match destination<br/>and NOT in additionalOrigins
        AGW-->>User: 403 Forbidden<br/>"CSRF validation failed"
        Note over User,AGW: Attack blocked
    end

    Note over User,Backend: Legitimate Request

    User->>AGW: POST /api/action<br/>Origin: allowThisOne.example.com<br/>Cookie: session=abc123

    AGW->>AGW: CSRF validation:<br/>Origin in additionalOrigins list
    AGW->>Backend: Forward request
    Backend-->>AGW: 200 OK
    AGW-->>User: 200 OK
```

### Allowed requests

Allowed requests are as follows.

- Safe methods (`GET`, `HEAD`, `OPTIONS`) from any origin
- Same-origin requests (`Origin` matches `Host`)
- Requests from origins in `additionalOrigins`
- Requests with `Sec-Fetch-Site: same-origin` or `Sec-Fetch-Site: none`

### Blocked requests

Blocked requests, which receive a `403 Forbidden` response with the message "CSRF validation failed", are as follows.

- Cross-site requests with `Sec-Fetch-Site: cross-site` (unless trusted)
- Cross-site requests where `Origin` doesn't match `Host` (unless trusted)
- Malformed `Origin` headers in cross-site contexts

> [!NOTE]
> Note that because CSRF attacks specifically target state-changing requests, the filter only acts on HTTP requests that have a state-changing method such as `POST` or `PUT`.



## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
policies:
  csrf:
    additionalOrigins:
      - "https://www.example.com"
      - "https://trusted.domain.com"
```

The `additionalOrigins` setting is a list of trusted origins allowed to make cross-site requests.
- Format: `"scheme://host[:port]"`
- Examples: `"https://www.example.com"`, `"http://localhost:3000"`

For strict CSRF protection to prevent all cross-site requests, set `additionalOrigins` to an empty list.

```yaml
...
policies:
  csrf:
    additionalOrigins: []
```
