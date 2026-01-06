---
title: Timeouts
weight: 10
---

Attach to:
{{< badge content="Route" link="/docs/configuration/routes/">}} {{< badge content="Backend" link="/docs/configuration/backends/">}}

Request timeouts allow returning an error for requests that take too long to complete.

## Route Timeouts

You can configure two types of timeouts on a route.

|Timeout|Description|
|-|-|
|`requestTimeout`|The time from the start of an incoming request, until the end of the response headers is received. Note if there are retries, this includes the total time across retries.|
|`backendRequestTimeout`|The time from the start of a request to a backend, until the end of the response headers are completed. Note this is per-request, so with retries this is a per-retry timeout.|

For example:

```yaml
timeout:
  requestTimeout: 1s
```

## Backend Timeouts

In addition to route level timeouts, you can configure per-backend timeouts within the backend configuration section.

| Timeout          | Description                                                                                       |
|------------------|---------------------------------------------------------------------------------------------------|
| `requestTimeout` | The time from the start of an HTTP request to a backend until the response headers are completed. |
| `connectTimeout` | The time from the start of a TCP connection to a backend until the connection is established.     |

```yaml
http:
  requestTimeout: 1s
tcp:
  connectTimeout: 10s
```
