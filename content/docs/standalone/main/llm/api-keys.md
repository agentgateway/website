---
title: Manage API keys
weight: 40
description: Configure authentication when connecting to your LLM. 
prev: /docs/llm/providers
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

Browse through the tabs to learn about different ways for how to provide your API key to agentgateway. 

{{< tabs items="Inline,Environment variable,File,Kubernetes secret or passthrough token" >}}

{{% tab %}}

You can provide your API key directly in the agentgateway configuration. This option is the least secure. Only use this option for quick tests.

1. Configure the agentgateway proxy and enter your key in the `policies.backendAuth.key` field directly. 
   ```yaml
   cat <<EOF > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - routes:
       - backends:
          - ai:
             name: openai
             provider:
               openAI:
                 # Optional; overrides the model in requests
                 model: gpt-3.5-turbo
         policies:
           backendAuth:
             key: "sk-proj...."
   EOF
   ```

{{% /tab %}}
{{% tab %}}

1. Get the token from your LLM provider, such as an API key to OpenAI and save it as an environment variable.
   ```sh
   export OPENAI_API_KEY=<your-api-key>
   ```

2. Configure the agentgateway proxy to refer to that environment variable. Agentgateway automatically replaces the value of the variable with the value that is stored in the environment. 
   ```yaml
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - routes:
       - backends:
          - ai:
             name: openai
             provider:
               openAI:
                 # Optional; overrides the model in requests
                 model: gpt-3.5-turbo
         policies:
           backendAuth:
             key: "$OPENAI_API_KEY"
   EOF
   ```
   
{{% /tab %}}
{{% tab %}}

You can store your API key in a file and load the file into agentgateway during startup. 

1. Save your API key in a file, such as `key.txt`. 
   ```sh
   echo "<your-apikey>" >> key.txt
   ```

2. Configure the agentgateway proxy. 
   ```yaml
   cat <<EOF > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - routes:
       - backends:
          - ai:
             name: openai
             provider:
               openAI:
                 # Optional; overrides the model in requests
                 model: gpt-3.5-turbo
         policies:
           backendAuth:
             key: 
               file: "key.txt"
   EOF
   ```
{{% /tab %}}
{{% tab %}}

When deploying agentgateway in a Kubernetes environment by using the kgateway control plane, you can leverage Kubernetes secrets to store your API key or pass through a token by using an `Authorization` or other custom header. 

For more information, see the [agentgateway on Kubernetes docs](https://agentgateway.dev/docs/kubernetes/latest/llm/api-keys/). 

{{% /tab %}}
{{< /tabs >}}