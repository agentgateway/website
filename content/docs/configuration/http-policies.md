---
title: HTTP Policies
weight: 11
description: 
---

Agentgateway enables advanced operations on HTTP requests and responses.
This page contains an overview of the available policies.

> [!TIP]
> Many of these policies are directly from the [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/reference/spec/#httprouterule) and behave the same as those policies.

## Request and response manipulation

There are a few different policies that offer manipulation of HTTP requests and responses.

The `requestHeaderModifier` and `responseHeaderModifier` modify request and response headers respectively.
These allow you to `add`, `set`, or `remove` headers.
`add` and `set` differ in the case the header already exists; `set` will replace it while `add` will append.

```yaml
requestHeaderModifier:
  add:
    x-req-added: value
  remove:
    - x-remove-me
```

More advanced operations are available with the `transformation` policy.
Like the `HeaderModifier` policies, this can also `add`, `set`, or `remove` headers, but can also manipulate HTTP bodies.
Additionally, each modification is based on a [CEL expression](/docs/operations/cel) rather than static strings.

Examples:

```yaml
transformations:
  request:
    add:
      x-request-id: 'random()'
  response:
    add:
      x-sub: "jwt.sub"
      x-claim: "jwt.nested.key"
    body: |
      has(jwt.sub) ?
      {"success": "user is authenticated as " + jwt.sub} :
      {"error": "unauthenticated"}
```

To modify the request authority (also known as "hostname") or path, the `urlRewrite` policy be used:

```yaml
urlRewrite:
  authority:
    full: example.com
  path:
    full: "/v1/chat/completions"
```

## Request redirects

Request redirects allow returning a direct response redirecting users to another location.

For example, the following configuration will return a `307 Temporary Redirect` response with the header `location: https://example.com/new-path`:

```yaml
requestRedirect:
  scheme: https
  authority:
    full: example.com
  path:
    full: /new-path
  status: 307
```

## Timeouts

Request timeouts allow returning an error for requests that take too long to complete.

There are two types of timeouts.

|Timeout|Description|
|-|-|
|`requestTimeout`|The time from the start of an incoming request, until the end of the response headers is received. Note if there are retries, this includes the total time across retries.|
|`backendRequestTimeout`|The time from the start of a request to a backend, until the end of the response headers are completed. Note this is per-request, so with retries this is a per-retry timeout.|

For example:

```yaml
timeout:
  requestTimeout: 1s
```

## Retries

When a backend request fails, agentgateway can be configured to *retry* the request.
When a retry is attempted, a different backend will be preferred (if possible).

```yaml
retry:
  # total number of attempts allowed.
  # Note: 1 attempt implies no retries; the initial attempt is included in the content.
  attempts: 3
  # Optional; if set, a delay between each additional attempt
  backoff: 500ms
  # A list of HTTP response codes to consider retry-able.
  # In addition, retries are always permitted if the request to a backend was never started.
  codes: [429, 500, 503]
```

When a request has retries enabled and an HTTP body, the request body will be buffered.
If the total body size exceeds a threshold size, retries will be disabled.

## Cross-Origin Resource Sharing (CORS)

[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) is a browser security mechanism which allows a server to control which origins can request resources.

> [!TIP]
> CORS is enforced on the browser, not the server. Request that violate the CORS policy will still have responses returned, but the browser will reject them. As such, usage of tools like `curl` with `cors` can be confusing, as `curl` does not respect CORS headers.

Example:

```yaml
cors:
  allowOrigins:
  - "*"
  allowHeaders:
  - mcp-protocol-version
  - content-type
  allowCredentials: true
  exposeHeaders:
  - x-my-header
  maxAge: 100s
```

## Request Mirroring

Request mirroring allows sending a copy of each request to an alterative backend.
These request will not be retried if they fail.

```yaml
requestMirror:
  backend:
    host: localhost:8080
  # Mirror 50% of request
  percentage: 0.5
```
