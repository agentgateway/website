### Repeated request headers {#repeated-headers}

A client can send the same header more than once. In CEL, `request.headers["x-a"]` then returns a list of values, not a string. When the header is sent once, it returns a string. Because the type changes depending on what the client sends, an expression that works for one value can behave differently for repeated values:

* Comparing a list to a string with `==` returns `false`.
* String functions such as `startsWith()` fail with an error.

This behavior can open a security hole. Take a `Deny` rule that matches requests that include `x-role: guest`, such as with the expression `request.headers["x-role"] == "guest"`. If a client sends `x-role: guest` twice, the lookup returns `["guest", "guest"]`. The comparison is false, the deny rule doesn't match, and the request is allowed.

To get a consistent type, read the header through a header view. The following table shows the result of each expression for a request made with `curl -H 'x-a: 1' -H 'x-a: 2'`:

| Expression | Result | Notes |
| -- | -- | -- |
| `request.headers["x-a"]` | `["1", "2"]` | Not recommended. The type depends on how many times the header is sent. |
| `request.headers["x-a"] == "1"` | `false` | Not recommended. The comparison is false for repeated headers. |
| `request.headers["x-a"].startsWith("1")` | Error | Not recommended. String functions fail for repeated headers. |
| `request.headers.raw()["x-a"][0]` | `"1"` | Gets the first value. |
| `request.headers.join()["x-a"]` | `"1,2"` | Gets all values as one string. |
| `request.headers.split()["x-a"]` | `["1", "2"]` | Gets all values as a list, with comma-separated values split too. |

The `raw()` view always returns a list, even if the header is sent once, so `[0]` works for single and repeated headers. The `split()` view also splits each value on commas, so `x-a: 1,2` and `x-a: 3` together return `["1", "2", "3"]`. For the full list of header views, see [Header Views](https://github.com/agentgateway/agentgateway/blob/main/schema/cel-functions.md#header-views) in the agentgateway CEL schema.
