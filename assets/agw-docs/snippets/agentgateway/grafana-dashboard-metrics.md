| Section | Metric | Description |
| -- | -- | -- |
| Overview | Memory | The working set memory that each agentgateway proxy pod consumes. |
| Overview | CPU | The CPU usage rate for each agentgateway proxy pod. |
| Requests | Requests (by Pod) | The request rate that each agentgateway proxy pod handles. |
| Requests | Requests (by Gateway) | The request rate for each gateway. |
| Requests | Requests (by Status) | The request rate grouped by HTTP response status. |
| Requests | Requests (by Reason) | The request rate grouped by the response reason. |
| LLM | Token Consumption | The rate of tokens that LLM requests consume, grouped by token type, model, and gateway. |
| LLM | Time To First Token | The time that it takes the LLM provider to return the first token of a response. |
| LLM | Request Time | The total duration of LLM requests. |
| LLM | Tokens Per Second | The rate at which the LLM provider returns output tokens. |
| MCP | MCP Calls (by method) | The rate of MCP requests grouped by JSON-RPC method. |
| MCP | Tool Calls (by tool) | The rate of MCP tool calls grouped by server, resource, and tool. |
| Latency | Latency by Route | The 50th, 95th, and 99th percentile request latency for each gateway and route. |
| XDS | XDS Messages by Type | The rate of xDS configuration messages that the control plane sends, grouped by resource type. |
| XDS | XDS Average Message Size | The average size of xDS messages, grouped by resource type. |
| Runtime | Cgroup Memory | The cgroup memory usage for each agentgateway proxy pod, such as working set, anonymous, file, and kernel memory. |
| Runtime | Process Memory | The process-level memory for each agentgateway proxy pod, such as RSS, PSS, private, shared, and swap memory. |
| Runtime | Tokio Runtime | The async runtime statistics for each agentgateway proxy pod, such as the worker count, number of alive tasks, and global queue depth. |
| Runtime | Build Versions | The agentgateway build versions that are running, grouped by tag. |
