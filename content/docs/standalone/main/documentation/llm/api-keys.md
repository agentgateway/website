---
title: Provider API keys
weight: 40
description: Provide and rotate the API keys that agentgateway uses to authenticate to your LLM providers.
prev: /llm/providers
---

Provider API keys authenticate agentgateway to LLM providers such as OpenAI or Anthropic. A leaked key lets attackers run requests at your expense.

Clients can authenticate with [virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}). Agentgateway replaces each virtual key with the provider key before forwarding the request.

This guide covers inline keys, environment variables, files, and Kubernetes secrets or passthrough tokens. To replace an existing key, see [Rotate a provider key](#rotate).

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Configure your agentgateway proxy

You can set the provider API key in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
1. Start agentgateway with a configuration that has an `llm` section. You add the model and its API key in the UI.

   ```sh
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models: []
   EOF
   agentgateway -f config.yaml
   ```

2. Open **LLM** > **Models** in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
3. From the **Provider** dropdown, select **OpenAI**.
4. Keep the default `openai/*` in the **Incoming model match** field, and keep **Strip openai/** for the **Outgoing model**.
5. For the **Provider API key**, select one of the following options.
   * **API key**: Enter the key itself, such as `sk-proj....`. The UI writes the key inline in the `params.apiKey` field. This option is the least secure. Only use this option for quick tests.
   * **Env var**: Enter the name of the environment variable, such as `OPENAI_API_KEY`. The UI writes `apiKey: $OPENAI_API_KEY`. The variable must be set in the environment that agentgateway runs in, or the save fails.
   * **File**: Enter the path to a file that holds the key, such as `/etc/agentgateway/openai-key.txt`. The UI writes `apiKey: {file: <path>}`. Agentgateway watches the file and reloads the configuration when the file changes, so a rotated key takes effect without a restart. This option differs from the **File** steps in the **Config file** tab, which use `auth.key.value.file` and pick up a changed key on the next request.
   * **Unset**: Configure no provider credential.

   {{< reuse-image src="img/ui-llm-model-prefixed.png" srcDark="img/ui-llm-model-prefixed-dark.png" alt="Add model drawer with the OpenAI provider, the default openai/* match, the OPENAI_API_KEY environment variable, and Strip openai/ as the outgoing model" >}}

6. Click **Save model**.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
Choose how to provide the key.

{{< tabs >}}

{{% tab name="Inline" %}}

You can provide your API key directly in the agentgateway configuration. This option is the least secure. Only use this option for quick tests.

1. Configure the agentgateway proxy and enter your key in the `params.apiKey` field directly.
   ```yaml
   cat <<EOF > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "openai/*"
       provider: openAI
       params:
         apiKey: "sk-proj...."
       transformation:
         model: llmRequest.model.stripPrefix("openai/")
   EOF
   ```

{{% /tab %}}
{{% tab name="Environment variable" %}}

1. Get the token from your LLM provider, such as an API key to OpenAI and save it as an environment variable.
   ```sh
   export OPENAI_API_KEY=<your-api-key>
   ```

2. Configure the agentgateway proxy to refer to that environment variable. Agentgateway automatically replaces the value of the variable with the value that is stored in the environment.
   ```yaml
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "openai/*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
       transformation:
         model: llmRequest.model.stripPrefix("openai/")
   EOF
   ```
   
{{% /tab %}}
{{% tab name="File" %}}

Store the key in a file on the gateway host. Agentgateway watches the file for changes, so rotation does not require a restart.

1. Save the key in a file readable only by the user who runs agentgateway.
   ```sh
   printf '%s' "<your-api-key>" > openai-key
   chmod 600 openai-key
   ```

2. Configure agentgateway to read the file. Relative paths resolve from the directory where you start agentgateway. Use an absolute path in production.
   ```yaml
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "openai/*"
       provider: openAI
       auth:
         key:
           value:
             file: openai-key
       transformation:
         model: llmRequest.model.stripPrefix("openai/")
   EOF
   ```

   Clients authenticate with separate keys. See [Virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}) for setup.
{{% /tab %}}
{{% tab name="Kubernetes secret or passthrough token" %}}

When deploying agentgateway on Kubernetes, you can leverage Kubernetes secrets to store your API key or pass through a token by using an `Authorization` or other custom header. 

For more information, see the [agentgateway on Kubernetes docs](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/api-keys/). 

{{% /tab %}}
{{< /tabs >}}
{{% /tab %}}
{{< /tabs >}}

## Rotate a provider key {#rotate}

Rotate provider keys regularly, when your provider requires it, or after a suspected leak. Clients that use [virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}) need no configuration changes.

1. Create a new API key in the console of your LLM provider. Keep the old key active for now.
2. Replace the key on the gateway using the method that matches your configuration.

   | Option | How to replace the key | Restart needed |
   | -- | -- | -- |
   | File (`auth.key.value.file` or `params.apiKey: {file: <path>}`) | Replace the file contents. With `auth.key.value.file`, agentgateway uses the new key for the next request. With a `params.apiKey` file, agentgateway detects the change and reloads the configuration. | No |
   | Inline | Edit the key in the configuration file. Agentgateway reloads the file when it changes. | No |
   | Environment variable | Set the variable to the new key and restart agentgateway. | Yes |

3. Send a request through agentgateway, and verify that it succeeds with the new key. If your gateway requires [virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}), add an `Authorization: Bearer <virtual-key>` header.

   ```sh
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "openai/gpt-4o-mini", "messages": [{"role": "user", "content": "Hello!"}]}' | jq .
   ```

   Example output:

   ```json
   {
     "choices": [{
       "message": {
         "role": "assistant",
         "content": "Hello! How can I help you today?"
       }
     }]
   }
   ```

4. Revoke the old key in the console of your LLM provider.

## Next steps

{{< cards >}}
  {{< card path="/documentation/llm/cost-controls/virtual-keys/" title="Virtual keys" subtitle="Protect provider keys and add optional budgets and usage tracking" >}}
{{< /cards >}}
