# Maintaining the inference benchmark pages

The source of truth is `agentgateway/benchmarks`. This snapshot uses commit
`522fc04a595faad40e6cb070d0f2275e1314f1f9` (PR #3) and campaign
`optimized-baseline-v0230-gateway-refresh-20260817` under
`inference/reports/llm-d-benchmark/optimized-baseline-qwen3-32b-h100/optimized-baseline-v0230-gateway-refresh-20260817`.

- `environment.md`, `results-notes.md`, and `methodology.md` share the test
  environment, summary guidance, and metric definitions between both modes.
- `latency-caveat.md` places the shared failure-rate and single-run qualifications
  immediately after the charts.
- `kubernetes.md` and `standalone.md` contain the respective published tables and
  interpretation, reused by the `latest` and `main` page wrappers at
  `documentation/llm/benchmarking.md`. The inference overview at `/documentation/inference/` links to these
  reports and the routing guide at `documentation/llm/inference/inference-routing/`.
- The six PNGs under `assets/img/benchmarks/optimized-baseline-v0230-gateway-refresh-20260817/`
  are byte-for-byte copies of the published charts, grouped by mode.

To publish another campaign, review its manifest, provenance, reports, and CSVs
at one pinned commit. Update the methodology, mode-specific tables and text,
evidence links, and all charts together. Use a campaign-specific image directory
and verify table values against the CSVs. Keep the tested component versions
explicit even when they differ from the selected docs version. Build the site
and check both modes in `latest` and `main`, including the inference section
navigation, images, and links.
