---
title: Google Cloud
weight: 20
description: Run agentgateway on Google Cloud and reach Vertex AI with a service account instead of an API key.
test:
  gcp:
  - file: ${versionRoot}/integrations/cloud-providers/gcp.md
    path: gcp
aliases:
  - /docs/standalone/main/integrations/platforms/gcp/
---

Run agentgateway on Cloud Run or GKE, and reach [Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}}) with the service account that Google Cloud already attaches to the workload. No API key goes into your configuration file.

{{< doc-test paths="gcp" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Authenticate with a service account": the example config is accepted by
#     agentgateway (--validate-only), so `auth.gcp.type: accessToken` is a
#     recognized shape alongside `provider: vertex` and the `params.model` /
#     `params.vertexProject` / `params.vertexRegion` fields.
#   * With that config loaded, agentgateway serves the client-facing model name
#     on port 4000 and resolves the upstream to the configured model, project,
#     and region. This is what makes the `--port 4000` flag in the Cloud Run
#     command on this page checkable rather than asserted.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That Application Default Credentials reach Vertex AI - external
#     dependency; the test has no Google Cloud identity, and a live call bills a
#     completion. The config loads without credentials because ADC is resolved
#     per request.
#   * "Run on Cloud Run" - external dependency; the gcloud commands need a
#     project, a service account, and a Secret Manager secret that the test
#     cannot stand up. The image, port, and args in them match the configuration
#     that this test does run.
#   * "IAM roles" - a different layer; the roles are evaluated by Google Cloud,
#     not by agentgateway.
#   * "Google Cloud services" - display-only table of links.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

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

{{< doc-test paths="gcp" >}}
cat <<'EOF' > config.yaml
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
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

Review the following table to understand this configuration.

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. |
| `provider` | The LLM provider, set to `vertex` for Vertex AI. |
| `params.model` | The Vertex AI model to send upstream, which does not have to match `name`. |
| `params.vertexProject` | The Google Cloud project ID. |
| `params.vertexRegion` | The Google Cloud region. Defaults to `global` if not set. |
| `auth.gcp.type` | The token to fetch through ADC. Use `accessToken` for Vertex AI. Use `idToken` when the upstream is a Cloud Run service or another endpoint that verifies an identity token. |

{{< doc-test paths="gcp" >}}
# Confirm that agentgateway serves LLM traffic on port 4000, which the Cloud Run
# command on this page sets with --port, and that the Vertex params reach the
# resolved provider as the settings table describes.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

SERVED=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -r '[.data[].id] | index("gemini-2.5-flash") // "missing"')
if [ "$SERVED" = "missing" ]; then
  echo "FAIL: the model name gemini-2.5-flash from the example config is not served on port 4000"
  exit 1
fi
RESOLVED=$(curl -sf --max-time 10 http://localhost:15000/config_dump | jq -r '
  [ .backends[].backend.ai
    | select(. != null)
    | .target.providers[].active[].endpoint
    | .provider.vertex
    | "\(.model)|\(.projectId)|\(.region)"
  ] | first')
EXPECTED="google/gemini-2.5-flash|my-project-id|us-central1"
if [ "$RESOLVED" != "$EXPECTED" ]; then
  echo "FAIL: expected vertex params $EXPECTED but agentgateway resolved $RESOLVED"
  exit 1
fi
echo "✓ Port 4000 serves the model and the Vertex params resolve to the documented values"
{{< /doc-test >}}

For the full list of Vertex AI settings, see [Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}}). For direct Gemini API access with an API key instead, see [Google Gemini]({{< link-hextra path="/llm/providers/gemini/" >}}).

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

* **Port 4000 carries LLM traffic.** When your configuration file defines no gateway, the implied `default` gateway serves LLM traffic on port `4000` and MCP traffic on port `3000`. Set `--port` to the port that carries the traffic you route. For more information, see [Configuration modes]({{< link-hextra path="/llm/configuration-modes/" >}}).
* **The service account is the credential.** Because `auth.gcp` uses ADC, `--service-account` is what lets agentgateway call Vertex AI. No API key is needed in the deploy command or in the configuration file.
* **A secret mount is read-only.** Set `config.storage.mode` to `readOnly` so that writes from the admin UI fail with a clear message instead of a filesystem error. For more information, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).

> [!IMPORTANT]
> The example uses `--no-allow-unauthenticated`. A gateway that holds Vertex AI access is a credential of its own, so anyone who can reach it can spend against your project. If you do need public access, put an authentication policy in front of it. For more information, see [Authentication and identity]({{< link-hextra path="/integrations/auth/" >}}).

## Run on GKE

GKE is an ordinary Kubernetes distribution as far as agentgateway is concerned. Two options are available.

* Run standalone agentgateway as a Deployment with the [Helm chart]({{< link-hextra path="/setup/install/helm/" >}}). Bind the Kubernetes service account to a Google service account with Workload Identity Federation, and the same `auth.gcp` configuration applies.
* Run the [Kubernetes control plane]({{< link-hextra path="/setup/install/kubernetes/" >}}), which manages agentgateway proxies from Kubernetes custom resources and the Kubernetes Gateway API.

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
| [Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}}) | Gemini and other models, reached with the service account |
| [Google Gemini]({{< link-hextra path="/llm/providers/gemini/" >}}) | Direct Gemini API access with an API key |
| [Secret Manager](https://cloud.google.com/security/products/secret-manager) | Storage for the configuration file and for the API keys of non-Google providers |
| Cloud Load Balancing | Load balancing and TLS termination in front of the gateway port |
| Cloud Monitoring | Metrics collection, through a [Prometheus]({{< link-hextra path="/observability/metrics/prometheus/" >}}) scrape |
| Cloud Trace | Trace collection, through an [OpenTelemetry]({{< link-hextra path="/observability/traces/configs/otel/" >}}) collector |

## Next steps

* [Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}}) for the full provider reference.
* [Set up the admin UI]({{< link-hextra path="/setup/ui/" >}}) to serve the web interface on a gateway.
* [Choose where configuration is stored]({{< link-hextra path="/setup/storage/" >}}) before you mount a read-only secret.
