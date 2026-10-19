---
title: Provider API keys
weight: 40
description: Provide and rotate the API keys that agentgateway uses to authenticate to your LLM providers.
prev: /llm/providers
---

Provider API keys, such as an OpenAI or Anthropic API key, are the credentials that agentgateway sends to your LLM provider. Managing these keys is an important security mechanism to prevent unauthorized access to your LLM provider. If API keys are compromised, attackers can deliberately run expensive queries, such as large and recursive prompts, at your expense.

Provider API keys are different from the keys that clients send to agentgateway. Clients authenticate to agentgateway with their own [virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}). Agentgateway removes the virtual key from each request and attaches the provider API key, so your clients never need a provider key. For a walkthrough, see [Protect provider API keys]({{< link-hextra path="/documentation/llm/protect-provider-keys/" >}}).

You can choose between the following options to provide an API key to agentgateway:
* Inline
* Environment variable
* File
* Kubernetes secret or passthrough token

Follow the instructions in this guide to learn how to use these different methods. To replace a key later, see [Rotate a provider key](#rotate).

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Configure your agentgateway proxy

Browse through the tabs to learn about different ways for how to provide your API key to agentgateway. 

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

You can store your API key in a file on the gateway host. Agentgateway watches the file, so you can rotate the key by replacing the contents of the file, without a restart.

1. Save your API key in a file, such as `openai-key`, that only the user who runs agentgateway can read.
   ```sh
   printf '%s' "<your-api-key>" > openai-key
   chmod 600 openai-key
   ```

2. Configure the agentgateway proxy to read the key from the file. A relative path resolves from the directory where you start agentgateway, so use an absolute path in production.
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

   To use the same key for several models, set the key once on a provider in `llm.providers` and reference the provider from each model. For an example, see [Protect provider API keys]({{< link-hextra path="/documentation/llm/protect-provider-keys/" >}}).
{{% /tab %}}
{{% tab name="Kubernetes secret or passthrough token" %}}

When deploying agentgateway on Kubernetes, you can leverage Kubernetes secrets to store your API key or pass through a token by using an `Authorization` or other custom header. 

For more information, see the [agentgateway on Kubernetes docs](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/api-keys/). 

{{% /tab %}}
{{< /tabs >}}

## Rotate a provider key {#rotate}

Rotate a provider key on a schedule, when your provider asks you to, or as soon as you suspect that a key leaked. Because clients authenticate with their own [virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}), you rotate the provider key on the gateway only, and no client changes.

1. Create a new API key in the console of your LLM provider. Keep the old key active for now.
2. Replace the key on the gateway. How you replace it depends on how you provide the key.

   | Option | How to replace the key | Restart needed |
   | -- | -- | -- |
   | File (`auth.key.value.file`) | Replace the contents of the file. Agentgateway watches the file and uses the new key for the next request. | No |
   | Inline | Edit the key in the configuration file. Agentgateway reloads the file when it changes. | No |
   | Environment variable | Set the variable to the new key, and restart agentgateway. Agentgateway reads environment variables only when it starts. | Yes |

   If you set `params.apiKey` to a file reference instead of using `auth.key.value.file`, agentgateway reads the file only when it loads the configuration. After you replace the file, save the configuration file to reload it, or restart agentgateway.

3. Send a request through agentgateway, and verify that it succeeds with the new key.
4. Revoke the old key in the console of your LLM provider.
