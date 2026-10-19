---
title: Provider API keys
weight: 40
description: Provide and rotate the API keys that agentgateway uses to authenticate to your LLM providers.
prev: /llm/providers
---

Provider API keys authenticate agentgateway to LLM providers such as OpenAI or Anthropic. A leaked key lets attackers run requests at your expense.

Clients can authenticate with [virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}). Agentgateway replaces each virtual key with the provider key before forwarding the request. For a walkthrough, see [Protect provider API keys]({{< link-hextra path="/documentation/llm/protect-provider-keys/" >}}).

This guide covers inline keys, environment variables, files, and Kubernetes secrets or passthrough tokens. To replace an existing key, see [Rotate a provider key](#rotate).

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Configure your agentgateway proxy

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
     - name: "*"
       provider: openAI
       params:
         apiKey: "sk-proj...."
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
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
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
     - name: "*"
       provider: openAI
       auth:
         key:
           value:
             file: openai-key
   EOF
   ```

   To share a key across models, define it in `llm.providers` and reference that provider from each model. See [Protect provider API keys]({{< link-hextra path="/documentation/llm/protect-provider-keys/" >}}).
{{% /tab %}}
{{% tab name="Kubernetes secret or passthrough token" %}}

When deploying agentgateway on Kubernetes, you can leverage Kubernetes secrets to store your API key or pass through a token by using an `Authorization` or other custom header. 

For more information, see the [agentgateway on Kubernetes docs](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/api-keys/). 

{{% /tab %}}
{{< /tabs >}}

## Rotate a provider key {#rotate}

Rotate provider keys regularly, when your provider requires it, or after a suspected leak. Clients that use [virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}) need no configuration changes.

1. Create a new API key in the console of your LLM provider. Keep the old key active for now.
2. Replace the key on the gateway using the method that matches your configuration.

   | Option | How to replace the key | Restart needed |
   | -- | -- | -- |
   | File (`auth.key.value.file`) | Replace the file contents. Agentgateway uses the new key for the next request. | No |
   | Inline | Edit the key in the configuration file. Agentgateway reloads the file when it changes. | No |
   | Environment variable | Set the variable to the new key and restart agentgateway. | Yes |

   For file references in `params.apiKey`, agentgateway reads the key only when loading the configuration. After replacing the key file, save the configuration file to trigger a reload, or restart agentgateway.

3. Send a request through agentgateway, and verify that it succeeds with the new key.
4. Revoke the old key in the console of your LLM provider.

## Next steps

{{< cards >}}
  {{< card path="/documentation/llm/protect-provider-keys/" title="Protect provider API keys" subtitle="Give clients revocable virtual keys instead of the provider key" >}}
{{< /cards >}}
