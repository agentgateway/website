---
title: "Private Multi-LLM Routing on GKE with Cluster Toolkit"
category: "Tutorial"
toc: true
publishDate: 2026-11-16
author: "Daneyon Hansen"
description: "Deploy a private agentgateway on GKE with Cluster Toolkit, validate Gemini requests, and add routes for OpenAI and Anthropic."
---

Platform teams often need one private entry point for several LLM providers. Getting there on a new Kubernetes cluster means setting up networking, identity, ingress, and readiness alongside the gateway itself.

The [agentgateway community blueprint for Google Cloud Cluster Toolkit](https://github.com/GoogleCloudPlatform/cluster-toolkit/tree/v1.109.0/community/examples/agentgateway-gke), included in [v1.109.0](https://github.com/GoogleCloudPlatform/cluster-toolkit/releases/tag/v1.109.0), provisions those pieces together. It starts with Gemini, then lets you add OpenAI and Anthropic behind the same internal load balancer. Agentgateway routes requests by provider path. This walkthrough deploys the default Gemini route, sends a request through it, and shows how to enable a second provider.

## What you get

| Component | Blueprint default |
| --- | --- |
| Cluster and ingress | Regional, CPU-only GKE Standard cluster and an internal Application Load Balancer |
| LLM routing | Gemini at `/v1/chat/completions`; optional OpenAI and Anthropic paths |
| Provider identity | Workload Identity for Gemini; Kubernetes Secrets for optional API keys |
| Validation | Staged readiness checks and manual requests from a temporary in-cluster curl Pod |

This is path-based multi-LLM routing: clients choose the provider endpoint. The blueprint does not configure semantic model selection or automatic failover. Anthropic uses its native Messages API, so the three paths do not share one request format.

## What the blueprint builds

{{< reuse-image src="img/blog/agentgateway-gke-cluster-toolkit/architecture.svg" srcDark="img/blog/agentgateway-gke-cluster-toolkit/architecture-dark.svg" alt="Private multi-LLM routing on GKE: clients reach an internal load balancer and agentgateway, which routes by path to Gemini, OpenAI, or Anthropic" caption="One private gateway address, with Gemini enabled by default and optional routes for OpenAI and Anthropic" >}}

The diagram shows how the two Gateway controllers and provider routes fit together:

1. Applications in the VPC or a connected network reach the gateway's internal address.
2. The GKE Gateway controller manages the internal load balancer, which forwards traffic to the proxy's ClusterIP Service.
3. The agentgateway controller manages a second Gateway and its proxy. HTTPRoutes select the provider backend by request path.
4. The proxy calls Gemini through Workload Identity Federation for GKE, or an optional provider using a Kubernetes Secret. The default Gemini identity receives a custom role with the `aiplatform.endpoints.predict` permission; no Google service-account key is created.

The blueprint deploys infrastructure, the controller, gateway configuration, and ingress in stages, checking readiness at each step. This keeps the cloud ingress and model-provider routing in their respective controllers.

## Before you deploy

Use a Google Cloud project where you can create the resources in the blueprint. Enable the Gemini Enterprise Agent Platform API, confirm access to the selected model, and check its quota. Follow the [Cluster Toolkit setup guide](https://docs.cloud.google.com/cluster-toolkit/docs/setup/configure-environment) for the required tools and project access. The [released deployment guide](https://github.com/GoogleCloudPlatform/cluster-toolkit/blob/v1.109.0/community/examples/agentgateway-gke/README.md#before-you-deploy) has the example-specific prerequisites.

You need two kinds of access. The [blueprint's `authorized_cidr` variable](https://github.com/GoogleCloudPlatform/cluster-toolkit/blob/v1.109.0/community/examples/agentgateway-gke/agentgateway-gke.yaml#L29-L30) sets a GKE authorized network for the Kubernetes API. Set it in the companion deployment file to the deployment runner's public egress IP with a CIDR prefix, such as `YOUR_IP/32`, so that machine can reach the API.

Requests to the gateway follow a different path. The client must reach the internal load balancer from the VPC or a connected network. Allowing your public IP to reach the Kubernetes API does not give your laptop access to the private gateway. The in-cluster test below sends a request from inside GKE, so it works without a separate VPC connection from your laptop.

The example serves HTTP inside the VPC and does not authenticate downstream clients, so restrict network access to the listener. Increase [`total_max_nodes`](https://github.com/GoogleCloudPlatform/cluster-toolkit/blob/v1.109.0/community/examples/agentgateway-gke/agentgateway-gke.yaml#L132) in the blueprint if you need more than two nodes in the system node pool.

## Deploy the default Gemini route

The blueprint is included in the [Cluster Toolkit v1.109.0 release bundles](https://github.com/GoogleCloudPlatform/cluster-toolkit/releases/tag/v1.109.0). Download the `.tgz` or `.zip` asset for your OS and architecture, then follow the [prebuilt bundle installation steps](https://docs.cloud.google.com/cluster-toolkit/docs/setup/configure-environment#install-the-prebuilt-bundle) to extract it. The bundle includes `gcluster` and the community examples. Run the remaining commands from the extracted `cluster-toolkit` directory.

Edit `community/examples/agentgateway-gke/agentgateway-gke-deployment.yaml`. Set `project_id`, choose a unique `deployment_name`, and set `authorized_cidr` to your deployment machine's public egress IP with a CIDR prefix, such as `YOUR_IP/32`. The default deployment name is `agw-demo`, the default region is `us-central1`, and the default model is `gemini-2.5-flash`. Keep provider credentials out of this file.

Create and deploy the example:

```sh
./gcluster create community/examples/agentgateway-gke/agentgateway-gke.yaml \
  -d community/examples/agentgateway-gke/agentgateway-gke-deployment.yaml
./gcluster deploy agw-demo
```

Replace `agw-demo` in subsequent commands if you chose another name. The blueprint installs the agentgateway CRD and controller charts at the same pinned version, creates the proxy configuration, and attaches the internal ingress. Its readiness checks wait for the Gateway, route, backend, proxy, and ingress conditions before deployment completes.

## Send a request through the internal gateway

Fetch cluster credentials:

```sh
gcloud container clusters get-credentials agw-demo \
  --region us-central1 --project YOUR_PROJECT
```

To see the request and response, run a temporary curl Pod through the internal load balancer:

```sh
GATEWAY_IP=$(kubectl -n agentgateway-system get gateway agentgateway-internal \
  -o jsonpath='{.status.addresses[0].value}')

kubectl -n agentgateway-system run agw-curl \
  --image=curlimages/curl:8.12.1 \
  --restart=Never --rm -i \
  --command -- curl \
  --fail-with-body --silent --show-error \
  --connect-timeout 10 --max-time 300 \
  "http://${GATEWAY_IP}/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Count from one to ten."}],
    "max_tokens": 128,
    "thinking_config": {"thinkingBudget": 0},
    "stream": false
  }'
```

The response is an OpenAI-compatible chat completion. Its `choices[0].message.content` contains the answer; for example, an excerpt might look like this (the wording and other fields vary):

```json
{"choices":[{"message":{"role":"assistant","content":"1, 2, 3, ..."}}]}
```

The configured [`vertex_model`](https://github.com/GoogleCloudPlatform/cluster-toolkit/blob/v1.109.0/community/examples/agentgateway-gke/agentgateway-gke.yaml#L41-L42) controls which Gemini model the gateway calls, even if a different model appears in the request. Refer to the [released guide](https://github.com/GoogleCloudPlatform/cluster-toolkit/blob/v1.109.0/community/examples/agentgateway-gke/README.md#send-a-request-with-curl) for the full manual-request notes.

## Add OpenAI or Anthropic when you need them

The default deployment needs no external-provider API key. To add OpenAI, read your key from a protected local file into a Kubernetes Secret. Do not place the key in the blueprint or your shell history:

```sh
kubectl -n agentgateway-system create secret generic openai-credentials \
  --from-file=Authorization=/secure/path/openai-key
```

Uncomment or add `openai_secret_name: openai-credentials` under `vars` in `agentgateway-gke-deployment.yaml`. Then regenerate the same deployment and apply the update:

```sh
./gcluster create community/examples/agentgateway-gke/agentgateway-gke.yaml \
  -d community/examples/agentgateway-gke/agentgateway-gke-deployment.yaml \
  --overwrite-deployment
./gcluster deploy agw-demo
```

The key stays out of Terraform; only the Secret name enters its state. To test an OpenAI model available to your account, send a request from a temporary curl Pod through the internal load balancer:

```sh
GATEWAY_IP=$(kubectl -n agentgateway-system get gateway agentgateway-internal \
  -o jsonpath='{.status.addresses[0].value}')

kubectl -n agentgateway-system run agw-curl \
  --image=curlimages/curl:8.12.1 \
  --restart=Never --rm -i \
  --command -- curl \
  --fail-with-body --silent --show-error \
  --connect-timeout 10 --max-time 300 \
  "http://${GATEWAY_IP}/openai/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "OPENAI_MODEL_ID",
    "messages": [{"role": "user", "content": "Count from one to ten."}],
    "stream": false
  }'
```

Replace `OPENAI_MODEL_ID` with a model supported by your account. The response should contain an OpenAI chat completion. The Pod is removed when the request finishes.

| Provider | Gateway path | Request format |
| --- | --- | --- |
| Gemini | `/v1/chat/completions` | OpenAI-compatible Chat Completions |
| OpenAI | `/openai/v1/chat/completions` | OpenAI Chat Completions |
| Anthropic | `/v1/messages` | Native Anthropic Messages |

Anthropic follows the same Secret and deployment pattern, but uses native Messages requests at `/v1/messages`. The [released provider guide](https://github.com/GoogleCloudPlatform/cluster-toolkit/blob/v1.109.0/community/examples/agentgateway-gke/README.md#optional-external-providers) has the Anthropic request format and model-specific token settings.

## Next steps

After testing the gateway, explore more of agentgateway:

- [Add API key authentication](https://agentgateway.dev/docs/kubernetes/latest/documentation/security/apikey/) to control which clients can call the gateway.
- [Explore cost controls](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/cost-controls/) to track usage and set spending limits.
- [Apply LLM rate limits](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/rate-limit/) to cap requests or token consumption.

## Clean up

When you finish exploring, remove the deployment:

```sh
./gcluster destroy agw-demo
```

The [GKE installation page](https://agentgateway.dev/docs/kubernetes/latest/documentation/install/gke/) points to the released blueprint. Its [v1.109.0 README](https://github.com/GoogleCloudPlatform/cluster-toolkit/blob/v1.109.0/community/examples/agentgateway-gke/README.md) remains the source of truth for prerequisites, configuration, troubleshooting, and cleanup.
