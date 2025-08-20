---
title: Timeouts
weight: 10
---

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