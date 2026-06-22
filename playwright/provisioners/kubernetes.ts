/**
 * Kubernetes-mode bring-up — NOTES / STUB (not wired into the runnable POC).
 *
 * Standalone mode launches the binary via Playwright's `webServer` (see
 * playwright.config.ts). Kubernetes mode is heavier than a single command, so the
 * intended pattern is: bring the cluster up yourself, start a long-lived port-forward to
 * the UI, then run Playwright pointed at it — `reuseExistingServer: true` makes the
 * webServer attach to the already-serving UI instead of launching the binary.
 *
 *   # 1. cluster + app + traffic (reuses the machinery in scripts/TEST_FRAMEWORK.md)
 *   kind create cluster ... ; cloud-provider-kind &   # sudo on macOS
 *   helm install <controller> ... ; kubectl apply -f <gateway/app/routes>
 *   # 2. wait for readiness (YAMLTest wait blocks), then expose the UI
 *   kubectl port-forward -n <ns> svc/<proxy> 15000:15000 &
 *   # 3. capture
 *   UI_BASE_URL=http://localhost:15000 npm run test:standalone
 *
 * The LONG-LIVED `kubectl port-forward` is the one piece that cannot fold into the
 * existing doc-test runner: that harness AUTO-FAILS any script containing
 * `kubectl port-forward` (it can't hold a persistent background process). The screenshot
 * pipeline holds it for the duration of the run — which is why it is a SIBLING job to
 * the doc tests, not a step inside them.
 *
 * To fully automate, add a "set up and leave running" mode to scripts/doc_test_run.py
 * (it currently creates -> runs -> DELETES the cluster per scenario) and start the
 * port-forward before invoking Playwright.
 */
export {};
