The `outcome` label of the `agentgateway_mcp_requests_total` metric has one of the following values. Agentgateway checks the conditions in order and uses the first value that matches. For example, a response with a 5xx HTTP status that also carries a JSON-RPC error is counted as `gateway_error`, not `protocol_error`.

1. `gateway_error`: Agentgateway returned an error for the request, or the response has a 4xx or 5xx HTTP status.
2. `protocol_error`: The response is a JSON-RPC error.
3. `tool_error`: The request is a `tools/call` request, and the tool result sets `isError: true`.
4. `success`: The request is a `tools/call` request with a tool result that does not set `isError: true`, or the request uses any other method and the response has a 2xx HTTP status.
5. `unknown`: The request does not match any of the previous conditions. For example, a `tools/call` request that has no tool result is counted as `unknown`, even if the response has a 2xx HTTP status.
