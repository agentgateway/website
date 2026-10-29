---
title: CSRF
weight: 11
description: Protect against cross-site request forgery attacks with origin validation.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

## About CSRF protection

According to [OWASP](https://community.owasp.org/attacks/csrf), CSRF is defined as follows:

> Cross-Site Request Forgery (CSRF) is an attack that forces an end user to execute unwanted actions on a web application in which they're currently authenticated. With a little help of social engineering (such as sending a link via email or chat), an attacker may trick the users of a web application into executing actions of the attacker's choosing. If the victim is a normal user, a successful CSRF attack can force the user to perform state changing requests like transferring funds, changing their email address, and so forth. If the victim is an administrative account, CSRF can compromise the entire web application.

To help prevent CSRF attacks, the CSRF policy implements a multi-layered validation approach to allow or block requests based on their properties. The policy checks that the request's origin matches its destination. If the origin and destination do not match, a 403 Forbidden error code is returned. Unlike CORS, CSRF protection works with all HTTP clients, not just browsers.

For requests without a `Sec-Fetch-Site` header, the policy compares the host and port in the `Origin` header with the request `Host` header. The policy ignores the scheme, so the origin `https://www.example.com` matches a plain HTTP request to `www.example.com`. The policy treats an `Origin: null` header as a cross-origin request, and rejects it unless `additionalOrigins` contains `null`.

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
- Same-origin requests, where the host and port in `Origin` match `Host`, regardless of scheme
- Requests from origins in `additionalOrigins`
- Requests with `Sec-Fetch-Site: same-origin` or `Sec-Fetch-Site: none`

### Blocked requests

Blocked requests, which receive a `403 Forbidden` response with the message "CSRF validation failed", are as follows.

- Cross-site requests with `Sec-Fetch-Site: cross-site` (unless trusted)
- Cross-site requests where `Origin` doesn't match `Host` (unless trusted)
- Requests without `Sec-Fetch-Site` and with `Origin: null` (unless trusted)
- Malformed `Origin` headers in cross-site contexts

> [!NOTE]
> Note that because CSRF attacks specifically target state-changing requests, the filter only acts on HTTP requests that have a state-changing method such as `POST` or `PUT`.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    csrf:
      additionalOrigins:
      - "https://www.example.com"
      - "https://trusted.domain.com"
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- policies:
    csrf:
      additionalOrigins:
      - "https://www.example.com"
      - "https://trusted.domain.com"
  backends:
  - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

The `additionalOrigins` setting is a list of trusted origins allowed to make cross-site requests.
- Format: `"scheme://host[:port]"`. To allow requests that send an `Origin: null` header, add `"null"`.
- Examples: `"https://www.example.com"`, `"http://localhost:3000"`

For strict CSRF protection to prevent all cross-site requests, set `additionalOrigins` to an empty list, as shown in the following route-level policy.

```yaml
policies:
  csrf:
    additionalOrigins: []
```
