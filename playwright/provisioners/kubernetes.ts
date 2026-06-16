/**
 * Kubernetes-mode provisioner — STUB.
 *
 * This is intentionally not implemented in the POC. The bring-up it needs already
 * exists in scripts/TEST_FRAMEWORK.md and scripts/doc_test_run.py:
 *
 *   1. kind cluster + cloud-provider-kind (LoadBalancer IPs; sudo on macOS)
 *   2. helm install CRDs + controller
 *   3. create Gateway, deploy sample app (httpbin), apply traffic resources
 *   4. YAMLTest `wait` blocks until resources are Ready
 *   5. LONG-LIVED `kubectl port-forward` to the UI port so :15000 is reachable
 *
 * Step 5 is the one piece that cannot fold into the existing doc-test runner: that
 * harness AUTO-FAILS any script containing `kubectl port-forward` (it can't hold a
 * persistent background process). A Playwright globalSetup CAN hold it — spawn the
 * port-forward here, keep the ChildProcess handle, and kill it in teardown — which is
 * why the screenshot pipeline is a SIBLING job to the doc tests, not a step inside them.
 *
 * Recommended implementation path:
 *   - add a "set up and leave running" mode to doc_test_run.py (it currently
 *     creates -> runs -> DELETES the cluster per scenario), then attach here.
 *   - or shell out to the same kind/helm/kubectl commands and port-forward, mirroring
 *     standalone.ts (spawn, waitForUI, return teardown).
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  throw new Error(
    'kubernetes provisioner is a POC stub — see provisioners/kubernetes.ts for the implementation plan. ' +
      'Use `npm run test:standalone` for the working path.',
  );
}
