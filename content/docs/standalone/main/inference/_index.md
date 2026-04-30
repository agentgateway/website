---
title: Inference routing
weight: 50
icon: alt_route
description:
test: skip
---

Agentgateway supports the Kubernetes Gateway API Inference Extension in two
deployment modes.

## Kubernetes Gateway API mode

In Kubernetes Gateway API mode, agentgateway runs as the gateway data plane for
Gateway API resources. You install the Inference Extension CRDs, create an
`InferencePool`, and route to that pool from an `HTTPRoute`. The Endpoint Picker
Extension (EPP) acts as an extension service that selects the best model server
endpoint for each inference request.

Use this mode when you want Gateway API integration, `InferencePool` resources,
traffic splitting, route matching, and other Kubernetes networking features.

{{< cards>}}
  {{< card link="/docs/kubernetes/main/inference/" title="Set up Kubernetes inference routing" >}}
{{< /cards >}}

## Standalone request scheduler mode

In standalone request scheduler mode, agentgateway runs as a sidecar proxy with
the EPP. The proxy and EPP communicate over localhost, and agentgateway uses its
standalone `inferenceRouting` local configuration to route requests to a
Kubernetes `Service` before consulting the EPP for endpoint selection.

Use this mode for single-tenant or job-scoped workloads where deploying a full
Gateway API stack would add unnecessary operational overhead. In this mode, the
upstream standalone Helm chart can deploy agentgateway as the sidecar proxy with
`proxyType: agentgateway`.

Standalone request scheduler mode does not support `InferencePool`. The model
workload must have a Kubernetes `Service`, and the chart-generated service ports
must match the EPP target ports.

{{< cards>}}
  {{< card link="https://gateway-api-inference-extension.sigs.k8s.io/guides/standalone/#deploy-as-a-standalone-request-scheduler" title="Deploy a standalone request scheduler" icon="external-link" >}}
{{< /cards >}}
