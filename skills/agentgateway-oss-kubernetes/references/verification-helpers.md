# Verification helpers

The installed [package metadata](../package.json) identifies this skill's content fingerprint, edition, mode, and authoritative documentation. The [helper](../scripts/verify.py) needs Python 3.10+ and uses only the standard library. Run it with `python3` from the installed skill folder, or use its absolute path from another working directory. It does not install, upgrade, start, or reconfigure a gateway. Its `version` and `collect-kubernetes` commands perform the explicitly selected read operations; MCP/masking checks only read saved evidence.

Exit codes are **0 = the stated check passed**, **1 = failed/invalid evidence**, and **2 = inconclusive or further compatibility review needed**. Preserve these distinctions in automation. A passed helper does not imply the whole deployment works. Use the normal verification workflow when Python is unavailable; report that the helper was not run.

## Start with package and runtime versions

For standalone, select the actual executable or existing container used for this task:

```sh
python3 scripts/verify.py version --binary /path/to/agentgateway
python3 scripts/verify.py version --container my-gateway --container-binary /path/in/container/agentgateway
```

The first checks the selected executable, which may differ from a running process. The second runs only `--version` inside the named Docker container. Confirm the process/container association and loaded configuration separately. The package hashes detect local edits; they are not a cryptographic signature of the publisher. Review intentional edits rather than discarding them.

For controller mode, collect the actual cluster inventory. Supply the intended context, namespace, selectors, and CRD names from the deployed release. Do not copy guessed selectors or infer the cluster version from a local CLI:

```sh
python3 scripts/verify.py collect-kubernetes \
  --context "$KUBE_CONTEXT" --namespace "$GATEWAY_NAMESPACE" \
  --controller-selector "$CONTROLLER_SELECTOR" --proxy-selector "$PROXY_SELECTOR" \
  --crd "$AGENTGATEWAY_CRD_NAME" --crd "$GATEWAY_API_CRD_NAME" > versions.json
python3 scripts/verify.py version --evidence versions.json
```

Define each variable from the selected deployment; repeat `--crd` for all relevant Agentgateway and Gateway API CRDs. Collection uses only `kubectl get` and retains container image references, runtime image IDs, readiness, and CRD spec hashes/served/storage versions. It does not read Secrets. If controller and proxy run in different namespaces, set `--namespace` to the controller namespace and add `--proxy-namespace` with the proxy namespace. Each collected container records its namespace. The helper requires both role inventories; empty selections remain incomplete evidence. It includes sidecars in the inventory; identify the actual controller/proxy containers during review.

Compare the CRD specs with release-matched manifests, accounting for API-server defaulting. A verified JSON mapping of CRD name to canonical spec SHA-256 can be passed as `--expected-crds crd-baseline.json`. The hash is SHA-256 of UTF-8 JSON with sorted keys, compact separators, and the entire `spec`; a hand-entered or installed-cluster-derived baseline alone does not establish release provenance. Record its release/source. Image tags are declared versions; verify their digest/release provenance. The Kubernetes result stays inconclusive until that review is performed outside the helper. This avoids treating a mutable tag or CRD `v1alpha1` API version as a product release.

The helper observes the runtime; it has no fixed supported/tested-release list. If this task requires a particular runtime, supply `--expected-version` from that requirement. A mismatch is inconclusive and needs investigation. Otherwise, use the observed runtime to fetch matching documentation, schemas/CRDs and release notes, then perform native validation and functional checks. Preserve prerelease/build identifiers; do not silently upgrade the gateway or skill. OSS and Enterprise version numbers are separate release families. Version checks precede configuration verification and never replace it.

## Classify an MCP tool-call response

Save a sanitized response envelope such as:

```json
{"http_status":200,"body":{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"synthetic result"}]}}}
```

```sh
python3 scripts/verify.py mcp --response response.json --request-id 1 --expect success
python3 scripts/verify.py mcp --response denied.json --request-id 1 --expect denial
```

The helper expects one decoded `tools/call` response. For SSE, use a compatible MCP client to decode the matching response; do not pass raw event-stream text. JSON-RPC string IDs must be JSON quoted, for example `--request-id '"probe-1"'`.

HTTP 400, malformed/incorrect-ID replies, RPC errors, and tool `isError` results are not successful calls. HTTP 401/403 are denial observations, never sufficient proof of the intended policy. If the release represents denial as a JSON-RPC error, supply both `--denial-code` and `--denial-message` from its documented exact signature; generic parser errors remain failures. A matching denial still returns inconclusive. Complete the known-valid allowed control, gateway policy attribution, and upstream non-execution checks in [verification.md](verification.md).

## Verify controlled masking

Use synthetic data and known content from immediately before the transformation. For example, for a detector whose release-specific replacement is `<EMAIL_ADDRESS>`:

```json
{
  "sensitive_input":"Email test@example.invalid.",
  "sensitive_values":["test@example.invalid"],
  "replacement":"<EMAIL_ADDRESS>",
  "observed_output":"Email <EMAIL_ADDRESS>.",
  "benign_input":"Hello world.",
  "benign_output":"Hello world."
}
```

```sh
python3 scripts/verify.py masking --evidence masking.json
```

Obtain the replacement marker from the selected detector/release; custom regex and built-in detectors can differ. The helper checks an exact controlled transformation, residual sensitive values, and an unchanged benign control. An answer omitting the original content is inconclusive. It does not establish coverage for other detectors, directions, streaming, or earlier logs. It prints classifications without repeating sensitive input/output values.
