# Verification and troubleshooting

Start with the package/runtime version check in [verification helpers](verification-helpers.md). The same reference provides tested MCP-response and controlled-masking checks; use them only for the relevant evidence.

Use the subset that proves the customer's request. Do not provision a separate cloud environment, require internal test tools, or impose a full POC workflow for a small change.

## Levels of evidence

| Level | What to check | What it does not prove |
| --- | --- | --- |
| Documentation/source review | Edition, standalone mode, release, exact fields and prerequisites. | That the generated configuration runs. |
| Static validation | YAML/JSON parsing, the release-matched schema where available, shell syntax, file references, required variables. | Runtime policy enforcement or upstream compatibility. |
| Runtime validation | The intended binary/image version, successful config load, expected listeners, process/container logs. Use a documented config-check command if the release has one; do not invent a `--validate` flag. | That an end-to-end transaction succeeds. |
| Functional validation | A representative client transaction and relevant negative cases, with expected and observed outcomes. | Real-provider behavior when the test uses a mock; production capacity from a smoke test. |

For each material success criterion, record the command/client action, expected outcome, observed outcome, and pass/fail/not-run status. Preserve enough sanitized evidence to reproduce failures. Do not present example output as captured output.

Discover the configuration-check command through the selected binary’s `--help` and matching validation documentation; use `--validate-only -f config.yaml` only when that runtime supports it. It does not start the gateway, but can resolve dependencies such as remote JWKS. For offline work, use supplied local test material where supported or report that dependency as blocking native validation. Use the command alongside the release JSON schema when the binary is available, and report unresolved template inputs separately. A passing parser does not establish database initialization, CEL behavior, provider access, or enforcement.

## Select checks by behavior

- **HTTP/LLM routing:** send a request through the gateway and verify the intended upstream/model, path, response, and any streaming behavior being claimed. A healthy listener or an upstream-only request is insufficient. Use a deterministic mock for routing checks when possible; identify real provider/auth/model checks still outstanding. Do not incur paid model traffic without authorization for that testing.
- **MCP connectivity:** use a compatible MCP client or the documented protocol sequence to initialize, discover tools, and invoke one representative tool. Preserve required session and protocol headers. Distinguish HTTP transport errors, JSON-RPC errors, and tool results with `isError`; HTTP 200 alone is not success.
- **Authentication:** verify a permitted credential and relevant missing, invalid, expired, wrong-issuer, or wrong-audience cases. Choose strict enforcement when the requirement says unauthenticated callers must be rejected. A claims-only/permissive setting does not meet that requirement. Verify actual defaults for the release.
- **Virtual keys and dollar budgets:** verify the requested number of distinct key identities, strict authentication, independent budgets, price/usage coverage for allowed models, counter persistence, and a bounded over-budget rejection case. Follow [llm-setup.md](llm-setup.md). A token limit, audit-only policy, or dollar field with no matching model price does not establish dollar enforcement. Do not exhaust real customer budgets for a test.
- **UI delivery:** discover the runtime's actual UI URL and verify it from the host before returning a clickable link. Distinguish UI HTTP reachability, interactive UI verification, and whether configuration changes persist.
- **MCP authorization:** use allowed and denied identities. Check the visibility of tools and attempt a forbidden tool directly, even if it is absent from `tools/list`. Verify that the forbidden action never reaches or executes on the upstream. Include other methods/resources if the requirement covers them; do not claim complete MCP protection from one tool test.
- **Upstream credentials/token exchange:** distinguish client authentication from backend authentication. Verify the backend receives the intended identity/audience through a safe test assertion; never log the raw bearer token or client secret as proof. Include a rejected exchange case when it is part of the requirement.
- **Telemetry:** generate a known request and inspect the requested signal at the actual endpoint/exporter. A configured exporter is not proof of delivery. Do not turn on prompt/body or credential logging merely to obtain evidence.
- **PII masking:** use the requested direction and response mode. Check a deterministic sensitive input/output and a benign control. An email absent from an LLM reply does not prove redaction: the model may simply have omitted it. Confirm known upstream content is transformed at the intended point, without claiming the same protection for earlier logs or an untested streaming path.

Use the selected release's replacement token for the configured rule. Read the selected runtime’s detector documentation or matching source to establish the replacement token; built-in detectors and custom regex rules can use different markers. Recheck other releases rather than testing all redaction against one marker.

- **Resiliency/rate limits:** exercise the specified failure/limit and verify the documented response and recovery. Use bounded traffic against an authorized test target; do not infer enforcement from a config field or readiness check.
- **Lifecycle:** verify the documented reload/restart path and restoration of the prior known-good configuration. Stop only processes/containers created for the task. Avoid broad process kills or teardown of shared resources.

For Kubernetes-hosted standalone testing, additionally verify the selected context/namespace, rendered standalone chart values, mounted config, image version, and exposure. A ready Deployment still needs the same end-to-end checks above. Do not use controller/CRD tests as proof of standalone behavior.

## Diagnose at the failed layer

Work from the failing request toward its dependency:

1. **Process/config:** exact version, invocation, config source, schema error, reload behavior.
2. **Listener/network:** address and port binding, host/container namespace, published ports, DNS, firewall, TLS, and proxy settings.
3. **Matching/routing:** incoming path/host/method, selected route/backend, rewrites, provider or MCP endpoint.
4. **Identity/policy:** JWKS availability, issuer/audience/expiry, enforcement mode, verified CEL attributes, authn versus authz versus backend credentials.
5. **Upstream/protocol:** direct upstream reachability where appropriate, supported MCP transport/session handling, provider API compatibility, upstream response and timeout.

Read logs and public issues for the exact error and version. Keep a short hypothesis/evidence record for multi-step investigations. Change one relevant factor, rerun the failed check, and widen testing only if the change or findings justify it. If the next step needs missing information or an out-of-scope mutation, report that specific dependency while completing independent checks.
