---
title: Vertex AI
weight: 15
icon: /integrations/providers/bw/vertex.svg
description: Route agentgateway LLM traffic to models on Google Cloud Vertex AI.
---

Configure Google Cloud Vertex AI as an LLM provider in agentgateway.

## Authentication

Before you can use Vertex AI as an LLM provider, you must authenticate by using Google Cloud's [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials). Choose from one of the three methods:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `application_default_credentials.json`
- metadata server

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set up GCP Application Default Credentials (ADC) in the terminal where you run agentgateway.
2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Gemini Enterprise (GCP Vertex)**.
5. In the **Incoming model match** field, replace the default `vertex/*` with `gemini-2.5-flash`.
6. Keep **ADC** for the **Google credentials**. To use a service account key file instead, select **File**, and enter the path to the file.
7. Enter `my-project-id` for the **Vertex project**.
8. For the **Vertex region**, enter or select `us-west2`. If you leave the field empty, Vertex uses `global`.
9. For the **Outgoing model**, select **Explicit**, and enter `google/gemini-2.5-flash-lite-preview-06-17`.

   {{< reuse-image src="img/ui-llm-add-model-vertex-explicit.png" srcDark="img/ui-llm-add-model-vertex-explicit-dark.png" alt="Add model drawer with Gemini Enterprise (GCP Vertex) selected as the provider, gemini-2.5-flash as the incoming model match, ADC as the Google credentials, my-project-id as the Vertex project, us-west2 as the Vertex region, and google/gemini-2.5-flash-lite-preview-06-17 as the explicit outgoing model" >}}

10. Click **Save model**.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: gemini-2.5-flash
    provider: vertex
    params:
      model: google/gemini-2.5-flash-lite-preview-06-17
      vertexProject: my-project-id
      vertexRegion: us-west2
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `vertex` for Google Cloud Vertex AI. |
| `params.model` | The specific Vertex AI model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.vertexProject` | The Google Cloud project ID. |
| `params.vertexRegion` | The Google Cloud region. Defaults to `global` if not specified. |
| `auth.gcp` | Google Cloud authentication configuration. Uses Application Default Credentials (ADC) by default. |
{{% /tab %}}
{{< /tabs >}}

## Send file content by URI {#send-file-content-by-uri}

In an OpenAI-compatible Chat Completions request, you can put a `gs://`, `http://`, or `https://` URI in a `file` content part's `file_data` or `file_id`. The request to Vertex AI uses `fileData`.

For HTTP(S) signed URLs, MIME type detection uses the extension before the query string or fragment. If the URI does not have a recognized extension, set `filename`, `mime_type`, or `content_type` on the file object.

```json
{
  "model": "gemini-2.5-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Compare these documents." },
        {
          "type": "file",
          "file": {
            "file_id": "https://storage.googleapis.com/my-bucket/report.pdf?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=abc"
          }
        },
        {
          "type": "file",
          "file": {
            "filename": "summary.pdf",
            "file_data": "https://example.com/download/123"
          }
        }
      ]
    }
  ]
}
```
