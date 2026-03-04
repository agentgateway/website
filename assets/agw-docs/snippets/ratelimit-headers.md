When rate limiting is enabled, agentgateway adds the following headers to responses. These headers help clients understand their current rate limit status and adapt their behavior accordingly.

| Header | Description | Example |
|--------|-------------|---------|
| `x-ratelimit-limit` | The rate limit ceiling for the given request. For local rate limiting, this is the base limit plus burst. For global rate limiting with time windows, this may include window information. | `6` (local), `10, 10;w=60` (global with 60-second window) |
| `x-ratelimit-remaining` | The number of requests (or tokens for LLM rate limiting) remaining in the current time window. | `5` |
| `x-ratelimit-reset` | The time in seconds until the rate limit window resets. | `30` |
| `x-envoy-ratelimited` | Present when the request is rate limited. Only appears in 429 responses. | (header present) |
