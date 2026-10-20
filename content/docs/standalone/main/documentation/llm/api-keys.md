---
title: Manage API keys
weight: 40
description: Manage API keys for LLM provider authentication.
prev: /llm/providers
---

Managing API keys is an important security mechanism to prevent unauthorized access to your LLM provider. If API keys are compromised, attackers can deliberately run expensive queries, such as large and recursive prompts, at your expense.

You can choose between the following options to provide an API key to agentgateway: 
* Inline
* Environment variable
* File
* Kubernetes secret or passthrough token

Follow the instructions in this guide to learn how to use these different methods. 

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
4. Replace the **Incoming model match** with `*`.
5. For the **Provider API key**, select one of the following options.
   * **API key**: Enter the key itself, such as `sk-proj....`. The UI writes the key inline in the `params.apiKey` field. This option is the least secure. Only use this option for quick tests.
   * **Env var**: Enter the name of the environment variable, such as `OPENAI_API_KEY`. The UI writes `apiKey: $OPENAI_API_KEY`. The variable must be set in the environment that agentgateway runs in, or the save fails.
   * **File**: Enter the path to a file that holds the key, such as `/etc/agentgateway/openai-key.txt`. The UI writes `apiKey: {file: <path>}`, and agentgateway reads the key from the file. This option differs from the **File** steps in the **Config file** tab, which load the file into an environment variable.
   * **Unset**: Configure no provider credential.
6. Click **Save model**.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
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

You can store your API key in a file and load the file into agentgateway during startup.

1. Save your API key in a file, such as `key.txt`.
   ```sh
   echo "<your-apikey>" >> key.txt
   ```

2. Load the key from the file into an environment variable and configure the agentgateway proxy.
   ```sh
   export OPENAI_API_KEY=$(cat key.txt)
   ```

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
{{% tab name="Kubernetes secret or passthrough token" %}}

When deploying agentgateway on Kubernetes, you can leverage Kubernetes secrets to store your API key or pass through a token by using an `Authorization` or other custom header. 

For more information, see the [agentgateway on Kubernetes docs](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/api-keys/). 

{{% /tab %}}
{{< /tabs >}}
{{% /tab %}}
{{< /tabs >}}
