# Verification — OSS Agentgateway Kubernetes controller

Start with the package/runtime version check in [verification helpers](verification-helpers.md). The same reference provides tested MCP-response and controlled-masking checks; use them only for the relevant evidence.

Select checks for the actual task; do not require a separate test cluster or full POC for a small edit. Preserve the distinction between prepared artifacts and executed work.

| Evidence | Check | Does not prove |
| --- | --- | --- |
| Source/static | Release/mode, Helm render, YAML, CRD schema and reference consistency. | Kubernetes acceptance or runtime support. |
| Admission | Server-side dry-run where authorized and schemas/admission exist; namespace/RBAC and object acceptance. | Controller attachment, config delivery, or enforcement. |
| Reconciliation | Current observed generations; relevant GatewayClass/Gateway/listener/route/model/policy conditions; proxy config and rejection logs. | A successful end-to-end transaction. |
| Functional | Real client requests through the gateway and negative cases for requested controls. | Real cloud integration from a mock, or production capacity from a smoke test. |

For each success criterion record the command/client action, expected outcome, observed outcome, and pass/fail/not-run status. Never use example output as captured evidence. Do not dump Secrets, licenses, raw bearer tokens, or customer prompt data.

## Behavior checks

- Routing: use the actual host/path/protocol/model, verify the intended upstream and transformations, and test streaming if promised. Missing model prefixes and HTTPRoute/model-listener conflicts are routing failures, not provider credential failures.
- MCP: initialize, discover, and invoke a representative tool with the documented transport/session headers. Distinguish HTTP success from JSON-RPC errors or a tool result with `isError`. For authorization, also invoke a forbidden tool directly and prove it did not execute upstream.

For native MCP tool authorization, match the [documented denial response](https://agentgateway.dev/docs/kubernetes/latest/documentation/mcp/tool-access.md) and verify the same tool/arguments are valid with an allowed identity in a harmless test fixture. A generic HTTP 400, parse error, invalid session, unknown tool name, or bad arguments can fail without exercising authorization. Do not count those as a passing policy-denial test. Correlate the gateway's policy decision with upstream non-execution; discovery filtering or a status code alone is insufficient.

- Authentication: test a valid identity and relevant missing/invalid/expired/wrong-issuer/wrong-audience cases. Strict auth must cover every exposed route that needs it. Passing a JWT as an SDK API key only supplies the Bearer header; it does not obtain/refresh the token or configure gateway verification. Use a token issued for the gateway's configured trust requirements, and keep upstream provider auth separate.
- Keys and budgets: follow [llm-setup.md](llm-setup.md). Check independent authenticated identities, routing/pricing coverage, enforcement scope, reset semantics, and shared/persistent counters where promised. Verify that exhausting one test key does not consume another's allowance. Token estimates and Audit mode are not USD blocking.
- Telemetry/PII: generate a known request and inspect its actual destination. For redaction use synthetic data, check the relevant request/response and streaming path, and ensure the sensitive value did not leak through a different configured signal. Do not claim comprehensive detection from a few samples.

Use the replacement token for the configured rule when checking masking. Read the selected runtime’s detector documentation or matching source to establish the replacement token; built-in detectors and custom regex rules can use different markers. Recheck another release; a hard-coded custom-regex marker can reject correctly masked built-in output. Also verify known sensitive upstream content and a benign control, because an LLM omitting the requested email is not proof of redaction.

- UI: verify the correct proxy or management UI from the user's host while the documented port-forward is running. Report HTTP reachability separately from interactive functionality and telemetry views.
- Lifecycle: verify delivery of a changed resource and preserve previous configuration and state for rollback. Restart/persistence tests must be within the authorized test scope; do not restart a shared production service just to complete a checklist.

## Diagnose by layer

Start at cluster access/version/CRD/admission, then controller ownership/reconciliation, listener/network/TLS, route/model matching, identity/policy, dependency services/storage, and upstream protocol/IAM. Collect the precise version and minimal sanitized failure, form a specific hypothesis, and rerun only the relevant check after a change. A policy's positive status can coexist with a different policy winning or with config delivery failing; inspect effective behavior.

If a needed test requires an unavailable license, credential, cluster, or out-of-scope change, finish the independent work and name the unmet requirement. Do not turn a limited mock/static check into a claim of a complete deployment.
