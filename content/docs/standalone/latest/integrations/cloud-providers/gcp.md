---
title: Google Cloud
weight: 20
description: Run agentgateway on Google Cloud and reach Vertex AI with a service account instead of an API key.
aliases:
  - ../platforms/gcp/
---

Run agentgateway on Cloud Run or GKE, and reach [Vertex AI]({{< link-hextra path="/integrations/llm/providers/vertex/" >}}) with the service account that Google Cloud already attaches to the workload. No API key goes into your configuration file.

## Authenticate with a service account

On Cloud Run and GKE, Google Cloud supplies credentials to the workload through its service account, which agentgateway reads with [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials) (ADC). ADC is the default for the `vertex` provider, so `auth.gcp` only makes that choice explicit.

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: gemini-2.5-flash
    provider: vertex
    params:
      model: google/gemini-2.5-flash
      vertexProject: my-project-id
      vertexRegion: us-central1
    auth:
      gcp:
        type: accessToken
```

Review the following table to understand this configuration.

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. |
| `provider` | The LLM provider, set to `vertex` for Vertex AI. |
| `params.model` | The Vertex AI model to send upstream, which does not have to match `name`. |
| `params.vertexProject` | The Google Cloud project ID. |
| `params.vertexRegion` | The Google Cloud region. Defaults to `global` if not set. |
| `auth.gcp.type` | The token to fetch through ADC. Use `accessToken` for Vertex AI. Use `idToken` when the upstream is a Cloud Run service or another endpoint that verifies an identity token. |

For the full list of Vertex AI settings, see [Vertex AI]({{< link-hextra path="/integrations/llm/providers/vertex/" >}}). For direct Gemini API access with an API key instead, see [Google Gemini]({{< link-hextra path="/integrations/llm/providers/gemini/" >}}).

## Run on Cloud Run

Run agentgateway as a serverless container. Cloud Run gives the container an identity through its service account and can mount your configuration file from Secret Manager.

{{% steps %}}

### Store the configuration file as a secret

```bash
gcloud secrets create agentgateway-config --data-file=config.yaml
```

### Deploy the service

```bash
gcloud run deploy agentgateway \
  --image cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}} \
  --port 4000 \
  --service-account agentgateway@my-project.iam.gserviceaccount.com \
  --set-secrets /config/config.yaml=agentgateway-config:latest \
  --args="-f,/config/config.yaml" \
  --no-allow-unauthenticated
```

{{% /steps %}}

Note the following details.

* **Port 4000 carries LLM traffic.** When your configuration file defines no gateway, the implied `default` gateway serves LLM traffic on port `4000` and MCP traffic on port `3000`. Set `--port` to the port that carries the traffic you route. For more information, see [Configuration modes]({{< link-hextra path="/documentation/llm/configuration-modes/" >}}).
* **The service account is the credential.** Because `auth.gcp` uses ADC, `--service-account` is what lets agentgateway call Vertex AI. No API key is needed in the deploy command or in the configuration file.
* **A secret mount is read-only.** Set `config.storage.mode` to `readOnly` so that writes from the UI fail with a clear message instead of a filesystem error. For more information, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).

> [!IMPORTANT]
> The example uses `--no-allow-unauthenticated`. A gateway that holds Vertex AI access is a credential of its own, so anyone who can reach it can spend against your project. If you do need public access, put an authentication policy in front of it. For more information, see [Authentication and identity]({{< link-hextra path="/integrations/auth/" >}}).

## Run on GKE

GKE is an ordinary Kubernetes distribution as far as agentgateway is concerned. Two options are available.

* Run standalone agentgateway as a Deployment with the [Helm chart]({{< link-hextra path="/documentation/setup/install/helm/" >}}). Bind the Kubernetes service account to a Google service account with Workload Identity Federation, and the same `auth.gcp` configuration applies.
* Run the [Kubernetes control plane]({{< link-hextra path="/documentation/setup/install/kubernetes/" >}}), which manages agentgateway proxies from Kubernetes custom resources and the Kubernetes Gateway API.

{{< cards >}}
  {{< card link="https://agentgateway.dev/docs/kubernetes/" title="Kubernetes mode docs" icon="external-link" >}}
{{< /cards >}}

## IAM roles

Create a service account and grant it the roles that agentgateway needs.

```bash
# Create the service account
gcloud iam service-accounts create agentgateway \
  --display-name "agentgateway"

# Grant Vertex AI access
gcloud projects add-iam-policy-binding my-project \
  --member "serviceAccount:agentgateway@my-project.iam.gserviceaccount.com" \
  --role "roles/aiplatform.user"

# Grant access to the configuration secret
gcloud secrets add-iam-policy-binding agentgateway-config \
  --member "serviceAccount:agentgateway@my-project.iam.gserviceaccount.com" \
  --role "roles/secretmanager.secretAccessor"
```

## Google Cloud services

| Service | How it is used |
|-------------|---------|
| [Vertex AI]({{< link-hextra path="/integrations/llm/providers/vertex/" >}}) | Gemini and other models, reached with the service account |
| [Google Gemini]({{< link-hextra path="/integrations/llm/providers/gemini/" >}}) | Direct Gemini API access with an API key |
| [Secret Manager](https://cloud.google.com/security/products/secret-manager) | Storage for the configuration file and for the API keys of non-Google providers |
| Cloud Load Balancing | Load balancing and TLS termination in front of the gateway port |
| Cloud Monitoring | Metrics collection, through a [Prometheus]({{< link-hextra path="/documentation/observability/metrics/prometheus/" >}}) scrape |
| Cloud Trace | Trace collection, through an [OpenTelemetry]({{< link-hextra path="/documentation/observability/traces/configs/otel/" >}}) collector |

## Next steps

* [Vertex AI]({{< link-hextra path="/integrations/llm/providers/vertex/" >}}) for the full provider reference.
* [Set up the UI]({{< link-hextra path="/documentation/setup/ui/" >}}) to serve the web interface on a gateway.
* [Choose where configuration is stored]({{< link-hextra path="/documentation/setup/storage/" >}}) before you mount a read-only secret.
