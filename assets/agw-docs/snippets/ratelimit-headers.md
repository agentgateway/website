When rate limiting is enabled, the following headers are added to responses. These headers help clients understand their current rate limit status and adapt their behavior accordingly.

**Note:** The `x-envoy-ratelimited` header is only present when using global rate limiting with an Envoy-compatible rate limit service. It is added by the rate limit service itself, not by agentgateway. As such, this header does not appear with local rate limiting.

| Header | Description | Added by | Example |
|--------|-------------|----------|---------|
| `x-ratelimit-limit` | The rate limit ceiling for the given request. For local rate limiting, this is the base limit plus burst. For global rate limiting with time windows, this might include window information. | Agentgateway | `6` (local), `10, 10;w=60` (global with 60-second window) |
| `x-ratelimit-remaining` | The number of requests (or tokens for LLM rate limiting) remaining in the current time window. | Agentgateway | `5` |
| `x-ratelimit-reset` | The time in seconds until the rate limit window resets. | Agentgateway | `30` |
| `x-envoy-ratelimited` | Present when the request is rate limited. Only appears in 429 responses when using global rate limiting. | External rate limit service | (header present) |
