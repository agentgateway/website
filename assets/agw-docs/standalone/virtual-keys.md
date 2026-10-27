Keep provider API keys on the gateway and give each client a revocable virtual key. Add token budgets and usage tracking as needed.

## About

Clients use virtual keys to authenticate to agentgateway. The gateway replaces each virtual key with the provider key before forwarding the request. Clients never receive the provider key, and the provider never receives the virtual key.

Each client has its own key, so you can revoke one client's access without rotating the provider key or reconfiguring other clients. Provider-key rotation happens on the gateway host.

### How virtual keys work

{{% reuse "agw-docs/snippets/llm-provider-key-flow.md" %}}

### Security considerations

The gateway host holds every provider key. Protect it as you would any other secret store.

* **Restrict access to the files.** Run agentgateway as a dedicated user, and make the key file and the configuration file readable only by that user.
* **Do not store raw virtual keys.** Store a `keyHash` for each virtual key instead of the raw `key`, so that a copy of the configuration file does not contain usable keys.
* **Encrypt client traffic.** Virtual keys are bearer credentials. Serve clients over TLS, or keep the gateway on a private network.
* **Protect the UI and admin API.** Anyone who can reach them can create and read virtual keys. {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x" >}}For more information, see [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}).{{< /version >}}
* **Keep agentgateway up to date** with security patches.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You also need an OpenAI API key. The examples read it from `OPENAI_API_KEY`.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}} For file-based credentials and rotation without a restart, see [Provider API keys]({{< link-hextra path="/documentation/llm/api-keys/" >}}).{{< /version >}}

{{< doc-test paths="virtual-keys" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Step 1": the virtual keys config is accepted by agentgateway
#     (--validate-only), so the apiKey policy fields are correct.
#   * "Step 3": a request with either virtual key is authenticated and proxied
#     to the provider (200), and a request with an unknown key is rejected (401),
#     which is the behavior the strict apiKey mode describes.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The provider's response content. The test runs against a local mock LLM
#     rather than OpenAI, so no provider API key is needed and no live completion
#     is billed. Only the gateway behavior on this page is asserted.
#   * "Configure token budgets" and "Monitor per-key spending" - those sections
#     need a provider that returns realistic token counts and a Prometheus
#     instance, so they are left to manual verification.
# Install agentgateway binary
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< reuse "agw-docs/snippets/start-mock-llm.md" >}}
{{< /doc-test >}}

## Set up virtual keys {#set-up-virtual-keys}

<span id="set-up-virtual-keys-ui"></span><span id="set-up-virtual-keys-config-file"></span>

Turn on API key authentication, and create two virtual keys, one for Alice and one for Bob. You can do this interactively in the built-in [UI]({{< link-hextra path="/documentation/setup/ui/" >}}), {{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}from the command line with [agctl](#agctl), {{< /version >}}or declaratively in your config file. The UI is convenient for exploring and one-off changes. The config file is the source of truth for GitOps workflows.

### Step 1: Create the virtual keys {#step-1-configure-api-key-authentication}

{{< tabs >}}
{{% tab name="UI" %}}
1. Create a configuration with an LLM model, but no API key authentication. You add the authentication and the keys in the UI.

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

2. Start agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

3. Open [http://localhost:15000/ui/llm/keys](http://localhost:15000/ui/llm/keys) (**LLM > Virtual API Keys**).
4. Click **Enable API key auth**. For the **Validation mode**, select **Strict**, and click **Enable API key auth** again. Strict mode requires a valid API key for all requests.
5. Click **New key**, and create Alice's key.
   1. Enter `alice` for the **Name**.
   2. For the **Key value**, select **Use custom key**, and enter `vk-alice-4f9c2a`. To have agentgateway generate the key instead, keep the auto-generate option, and use the generated value in the later steps.
   3. Expand **Metadata**, enter `user` and `alice`, and click **Add**.
   4. Click **Save key**.

   {{< reuse-image-light src="img/ui-virtual-keys-new.png" alt="Create virtual key drawer with name, key value, and metadata" >}}
   {{< reuse-image-dark srcDark="img/ui-virtual-keys-new-dark.png" alt="Create virtual key drawer with name, key value, and metadata" >}}

6. Copy the key. {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}In the **Copy your new API key** dialog, click **Copy**, and click **Done**. The UI does not show the key again.{{< /version >}}{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}In the key list, click **Copy** for the key.{{< /version >}}
7. Click **New key**, and create Bob's key in the same way as Alice's key. Enter `bob` for the **Name**, the custom key `vk-bob-8d1e7b`, and the metadata `user` and `bob`. Then, copy the key.

   The **Virtual API Keys** page lists both keys. From here, you can show, copy, edit, or delete each one.

   {{< reuse-image-light src="img/ui-virtual-keys-list.png" alt="UI Virtual API Keys page listing configured keys and metadata" >}}
   {{< reuse-image-dark srcDark="img/ui-virtual-keys-list-dark.png" alt="UI Virtual API Keys page listing configured keys and metadata" >}}

The UI writes the same `apiKey` policy as the **Config file** tab{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}, with one difference. It saves a hash of each key (`keyHash`), not the raw value. To save the raw value, select **Store raw key**. If you open the UI over plain HTTP from a host other than `localhost`, the UI cannot hash keys and always saves the raw value{{< /version >}}. Give the keys to your users to send in an `Authorization: Bearer $VIRTUAL_KEY` header.
{{% /tab %}}
{{% tab name="Config file" %}}
Create a configuration with API key authentication. This example creates two virtual keys for Alice and Bob.

```yaml {paths="virtual-keys"}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: vk-alice-4f9c2a
        metadata:
          user: alice
      - key: vk-bob-8d1e7b
        metadata:
          user: bob
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
```

| Setting | Description |
| -- | -- |
| `apiKey.mode` | The API key authentication mode. `strict` requires a valid API key for all requests. `optional` (default) validates the key if one is present but allows unauthenticated requests. `permissive` never rejects requests, which is useful when later steps such as authorization or logging rely on API key claims. |
| `apiKey.keys` | List of API keys. Each key has a `key` value and optional `metadata`. |
| `key` | The API key value that users include in the `Authorization: Bearer <key>` header. |
| `metadata` | Optional metadata associated with the key, such as a user identifier or tier. |
| `models[].name` | The models that the gateway serves. Use `*` for all provider models, or list model names to restrict access. {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x" >}}For per-key restrictions, see [Restrict model access](#restrict-model-access).{{< /version >}} |
| `params.apiKey` | The provider key that replaces the virtual key in outgoing requests.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}} For file-based rotation without a restart, see [Rotate a provider key]({{< link-hextra path="/documentation/llm/api-keys/#rotate" >}}).{{< /version >}} |

Start agentgateway.

```sh
agentgateway -f config.yaml
```
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="virtual-keys" >}}
# Virtual keys: validate the documented config, then run it against the mock LLM.
{{< reuse "agw-docs/snippets/point-config-at-mock-llm.md" >}}
agentgateway -f config-mock.yaml &
AGW_PID=$!
trap 'kill $AGW_PID $MOCK_LLM_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

### Step 2: Test the virtual keys {#step-3-test-the-virtual-keys}

You can test the keys in the UI playground or with curl. Both work the same way, whether you created the keys in the UI or in the config file.

{{< tabs >}}
{{% tab name="Playground" %}}
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
1. Open **LLM** > **Chat Playground** in the UI, such as [http://localhost:15000/ui/llm/playground](http://localhost:15000/ui/llm/playground).
2. If you see a **Browser access is not allowed** notice, click **Apply CORS**. The UI adds a CORS policy for the UI's address to `llm.policies`, so that the playground can call the gateway from the browser.
3. In the **Specific model** field, enter `gpt-3.5-turbo`. The `*` model accepts any model name, so the playground needs a specific name to send.
4. From the **Virtual API key** dropdown, select Alice's key. The dropdown lists only the keys that are stored as raw values. If the UI saved the key as a hash, select **Raw value**, and paste Alice's key into the **Raw API key** field.
5. In the **User message** field, enter `Hello!`, and click **Send**. Verify that the reply from the model appears.
6. From the **Virtual API key** dropdown, select **Raw value**, and enter `invalid-key` in the **Raw API key** field. Send the message again. Verify that the playground shows **Playground request failed** with the error `authentication failed`.
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
The playground steps need agentgateway 1.7 or later. Use the **curl** tab.
{{% /version %}}
{{% /tab %}}
{{% tab name="curl" %}}
1. Send a request with Alice's API key. Verify that the request succeeds.

   ```sh {paths="virtual-keys"}
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer vk-alice-4f9c2a" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}]
     }' | jq .
   ```

   Example successful response:
   ```json
   {
     "choices": [{
       "message": {
         "role": "assistant",
         "content": "Hello! How can I help you today?"
       }
     }],
     "usage": {
       "prompt_tokens": 10,
       "completion_tokens": 9,
       "total_tokens": 19
     }
   }
   ```

2. Send a request without a valid API key. Verify that the request is rejected with a 401 status.

   ```sh {paths="virtual-keys"}
   curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer invalid-key" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```

   Expected response:
   ```
   HTTP/1.1 401 Unauthorized
   ```
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="virtual-keys" >}}
YAMLTest -f - <<'EOF'
- name: request with valid API key succeeds
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer vk-alice-4f9c2a"
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello!"}]
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: request with invalid API key is rejected
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer invalid-key"
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello!"}]
      }
  source:
    type: local
  expect:
    statusCode: 401

- name: request with Bob's key also succeeds independently
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer vk-bob-8d1e7b"
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Hello!"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

## Manage client access

Control access for individual clients without reconfiguring the others.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}} You can also rotate the provider key without changing any client.{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x" >}}
### Restrict model access {#restrict-model-access}

The `*` model serves every model the provider offers. To restrict access for all clients, replace it with named model entries.

{{< tabs >}}
{{% tab name="UI" %}}
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
1. Open **LLM** > **Virtual API Keys**, and click the **Edit key** icon for Bob's key.
2. Expand **Model access**, and select **Selected models**.
3. In the **Allowed model patterns** field, enter `gpt-3.5-turbo`, and click **Add**.
4. Click **Save key**.
5. In the **Chat Playground**, select Bob's key, enter `gpt-4o` in the **Specific model** field, and send a message. Verify that the playground shows **Playground request failed** with the message `Model is not allowed for this API key`.
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
The UI steps for this section need agentgateway 1.7 or later. Use the **Config file** tab.
{{% /version %}}
{{% /tab %}}
{{% tab name="Config file" %}}
1. To restrict a specific key, add `allowedModels` to that key. This example keeps Bob's access to the model used by this guide.

   ```yaml
   keys:
   - key: vk-alice-4f9c2a
     metadata:
       user: alice
   - key: vk-bob-8d1e7b
     metadata:
       user: bob
     allowedModels:
     - gpt-3.5-turbo
   ```

2. Send a request with Bob's key for a model outside `allowedModels`. Verify that agentgateway returns `403`. Requests for a model absent from `llm.models` get `404`.

   ```sh
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer vk-bob-8d1e7b" \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello!"}]}'
   ```

   Example output:

   ```json
   {"error":{"message":"Model is not allowed for this API key","type":"invalid_request_error","code":"model_not_allowed"}}
   ```
{{% /tab %}}
{{< /tabs >}}

For model patterns and budget interactions, see [Limit model access per key]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/#limit-model-access-per-key" >}}).
{{< /version >}}

### Revoke a virtual key {#revoke-a-virtual-key}

Revoke one client's access without restarting agentgateway or changing other keys.

{{< tabs >}}
{{% tab name="UI" %}}
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
1. Open **LLM** > **Virtual API Keys**, and click the **Delete key** icon for Bob's key. In the **Delete virtual API key?** dialog, click **Delete key**.
2. In the **Chat Playground**, select **Raw value** from the **Virtual API key** dropdown, and enter Bob's key, `vk-bob-8d1e7b`. Send a message. Verify that the playground shows **Playground request failed** with the error `authentication failed`.
3. Restore Bob's key before continuing with the budget examples. Click **New key**, and create Bob's key again in the same way as in [Step 1](#step-1-configure-api-key-authentication).
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
The UI steps for this section need agentgateway 1.7 or later. Use the **Config file** tab.
{{% /version %}}
{{% /tab %}}
{{% tab name="Config file" %}}
1. Remove Bob's entry from `llm.policies.apiKey.keys` and save the configuration. Keep Alice's entry:

   ```yaml
   keys:
   - key: vk-alice-4f9c2a
     metadata:
       user: alice
   ```

2. Send a request with Bob's key. Verify that agentgateway returns `401`.

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer vk-bob-8d1e7b" \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello!"}]}'
   ```

   Example output:

   ```
   401
   ```

3. Restore Bob's key before continuing with the budget examples.
{{% /tab %}}
{{< /tabs >}}

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
### Rotate a virtual key {#rotate-a-virtual-key}

Replace one client's key, such as after a suspected leak. The key keeps its name, metadata, model access, and budget settings. Agentgateway tracks budget usage by the key value, so the budgets of a rotated key start again from zero.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Virtual API Keys**, and click the **Edit key** icon for Alice's key.
2. Replace the key value.
   * If the key starts with `agw_sk_`, such as a key that the UI generated, click **Regenerate**. The UI generates a new `agw_sk_` value.
   * For a custom key, such as `vk-alice-4f9c2a`, click **Edit**. Replace the value in the **Key value** field with the new value, such as `vk-alice-7c2e5b`.

   {{< reuse-image-light src="img/ui-llm-key-rotate.png" alt="Edit virtual key drawer for alice with a new value in the Key value field, a Keep existing button, and the Store raw key option" >}}
   {{< reuse-image-dark srcDark="img/ui-llm-key-rotate-dark.png" alt="Edit virtual key drawer for alice with a new value in the Key value field, a Keep existing button, and the Store raw key option" >}}

3. Optional: Select **Store raw key** to save the key value instead of a hash. If you keep the default, the UI saves only a hash of the key (`keyHash`). The UI can hash the key only when you open it over HTTPS or from `localhost`. If you open the UI over plain HTTP from another host, such as `http://192.168.1.10:15000/ui`, the UI selects **Store raw key** and you cannot clear it.
4. Click **Save key**. If the UI saved a hash, the **Copy your new API key** dialog shows the new key. Click **Copy**, and click **Done**. The UI does not show the key again.
5. Give the new key to Alice. Requests with the old key now fail with `401`.
6. Optional: The budget examples on this page use Alice's original key, `vk-alice-4f9c2a`. To continue with these examples after you set a custom key in step 2, edit Alice's key again, click **Edit**, and replace the value with `vk-alice-4f9c2a`. If you clicked **Regenerate** instead, use the new `agw_sk_` key in place of `vk-alice-4f9c2a`. In production, do not reuse a key that might have leaked.
{{% /tab %}}
{{% tab name="Config file" %}}
1. Replace the `key` value of Alice's entry in `llm.policies.apiKey.keys`, and save the configuration. Agentgateway reloads the file without a restart.

   ```yaml
   keys:
   - key: vk-alice-7c2e5b
     metadata:
       user: alice
   - key: vk-bob-8d1e7b
     metadata:
       user: bob
   ```

2. Send a request with Alice's old key. Verify that agentgateway returns `401`.

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer vk-alice-4f9c2a" \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello!"}]}'
   ```

   Example output:

   ```
   401
   ```

3. Give the new key to Alice.
4. Optional: The budget examples on this page use Alice's original key, `vk-alice-4f9c2a`. To continue with these examples, change the value back to `vk-alice-4f9c2a`. In production, do not reuse a key that might have leaked.
{{% /tab %}}
{{< /tabs >}}
{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}
### Rotate a provider key {#rotate-a-provider-key}

Replace the provider credential on the gateway host. Clients keep their virtual keys.

1. Follow [Rotate a provider key]({{< link-hextra path="/documentation/llm/api-keys/#rotate" >}}) to replace the credential and revoke the old provider key.
2. Send a request with an existing virtual key. Verify that it still succeeds.
{{< /version >}}

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
## Set up virtual keys (agctl) {#agctl}

Generate, restrict, update, and revoke virtual keys from the command line with `agctl standalone`. The CLI can also give each key a dollar or token budget, and report the budget usage and spending of each key. Before you begin, [install agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}).

### Step 1: Configure the gateway {#agctl-configure}

1. Create a separate configuration file with a database and an API key policy that has no keys yet. The database stores the budget usage of each key, and records LLM requests for analytics. In the default `file` storage mode, the CLI writes the keys that you create into this configuration file.

   ```yaml
   cat <<'EOF' > config-agctl.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     database:
       url: sqlite://virtual-keys.db
   llm:
     policies:
       apiKey:
         mode: strict
         keys: []
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `config.database.url` | The database that stores budget usage and request logs. A budget requires this field. Setting only `config.logging.database.url` does not meet this requirement. |
   | `apiKey.keys` | The keys that you define in the file. Start with an empty list, and create the keys with the CLI. |

2. Start agentgateway. If agentgateway still runs from a previous section, stop it first. Keep agentgateway running, and run the CLI commands in another terminal.

   ```sh
   agentgateway -f config-agctl.yaml
   ```

### Step 2: Create a key {#agctl-create}

The CLI prints the generated key once, and stores only a SHA-256 hash of the key. You cannot retrieve the key later.

1. Create a key named `team-a` that can use `gpt-4o` models and has a daily token budget. The command saves the key in the `VIRTUAL_KEY` environment variable.

   ```sh
   VIRTUAL_KEY="$(agctl standalone keys create team-a \
     --model 'gpt-4o*' \
     --budget 1000tokens/24h \
     --budget-action block)"
   ```

   Example output:

   ```text
   API key "team-a" created. Save it now; it cannot be shown again.
   ```

   The `VIRTUAL_KEY` variable exists only in your current shell. Before you close the terminal, store the key somewhere safe, such as a secrets manager, and give it to the client that uses it.

   | Flag | Description |
   | -- | -- |
   | `--model` | A model name or wildcard pattern that the key can use, such as `gpt-4o*`. Repeat the flag for several patterns. If you omit the flag, the key can use every model. |
   | `--budget` | The amount and window of a budget, such as `1000tokens/24h` or `10usd/24h`. If you omit the window, it defaults to `30d`. Repeat the flag to add independent budgets. The CLI names each budget after its unit and window, such as `tokens-24h`. A `usd` budget charges a request only if the [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}) prices its model. |
   | `--budget-action` | `block` rejects requests after the key uses up a budget. The default, `audit`, records the overage but allows the requests. |

2. List the keys. The `KEY` column shows a hint of the key, not the full value.

   ```sh
   agctl standalone keys
   ```

   Example output:

   ```text
   NAME    KEY             MODELS   BUDGETS          CREATED           ID
   team-a  agw_sk_...8mk2  gpt-4o*  1000 tokens/24h  2026-10-20 15:50  2672111b-2804-471c-8575-763e41c2d91c
   ```

Budget windows are aligned to the Unix epoch, not to the time that you create the key. For more information about how budgets charge requests, see [Per-key budgets]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/" >}}).

### Step 3: Test the key {#agctl-test}

1. Send a request for a model that the key can use. Agentgateway forwards the request to the provider, and charges the token usage of the response to the budget of the key. If the request returns a `401` status right after you create the key, retry the request. New keys reach the traffic path asynchronously.

   ```sh
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer $VIRTUAL_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'
   ```

   Example output:

   ```json
   {
     "model": "gpt-4o-mini",
     "choices": [{
       "message": {
         "role": "assistant",
         "content": "Hello! How can I help you today?"
       }
     }],
     "usage": {
       "prompt_tokens": 10,
       "completion_tokens": 9,
       "total_tokens": 19
     }
   }
   ```

2. Send a request for a model that the key cannot use. Agentgateway rejects the request with a `403` status before the request reaches the provider.

   ```sh
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer $VIRTUAL_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"model":"gpt-5","messages":[{"role":"user","content":"Hello!"}]}'
   ```

   Example output:

   ```json
   {"error":{"message":"Model is not allowed for this API key","type":"invalid_request_error","code":"model_not_allowed"}}
   ```

### Step 4: Check usage and spending {#agctl-usage}

1. Check the budget usage of the key. To list the budgets of every key, omit the `--key` flag.

   ```sh
   agctl standalone budgets --key team-a
   ```

   Example output:

   ```text
   KEY     BUDGET      USED       LIMIT        REMAINING   RESETS            STATUS  ACTION
   team-a  tokens-24h  19 tokens  1000 tokens  981 tokens  2026-10-20 20:00  ok      block
   ```

   The `RESETS` column shows the end of the current window in your local time. The command reports per-key budgets only, not `localRateLimit` token buckets.

2. Summarize the requests, tokens, and cost of each user. The rejected request from the previous step counts as an error.

   ```sh
   agctl standalone analytics --by agentgateway.user --since 24h
   ```

   Example output:

   ```text
   AGENTGATEWAY.USER  REQUESTS  ERRORS  TOKENS  COST       AVG TTFT  TOK/S  CACHE HIT
   team-a             2         1       19      $0.000007  -         -      0.0%
   ```

   Agentgateway attributes each request to the `user` or `name` metadata of the key. For more groupings, see [CLI analytics]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/#cli" >}}).

3. List the requests that agentgateway recorded.

   ```sh
   agctl standalone logs --since 1h
   ```

   Example output:

   ```text
   TIME                 STATUS  DURATION  PROVIDER  MODEL        TOKENS(IN/OUT)  COST       ID
   2026-10-20 15:50:34  200     1ms       openai    gpt-4o-mini  10/9            $0.000007  01a15add-9aa1-73ee-bc2a-b7fe5c9a70a6
   2026-10-20 15:50:34  403     0ms       -         -            -               -          01a15add-9aba-720e-a3dd-a11287a94806
   ```

   For filters and request details, see [View LLM request logs with agctl]({{< link-hextra path="/documentation/observability/access-logs/view/#cli" >}}).

### Step 5: Update a key {#agctl-update}

To change the metadata, model restrictions, or budgets of a key without changing the key itself, export the key, edit it, and apply it again. The update replaces the whole value of the key, so keep every field that you want to retain.

1. Export the key.

   ```sh
   agctl standalone get llm.apiKey team-a -o yaml --no-metadata > team-a.yaml
   ```

2. Edit `team-a.yaml`. For example, add `group: engineering` under `value.metadata`. Keep the top-level `id`, the `value.keyHash` field, and the existing metadata. Do not change the metadata fields that start with `agentgateway.dev/`. To change a budget, edit its `value.budgets[].limit.amount` field. Keep the name and window of the budget so that agentgateway keeps its usage count.
3. Apply the update.

   ```sh
   agctl standalone apply -f team-a.yaml
   ```

   Example output:

   ```text
   llm.apiKey/2672111b-2804-471c-8575-763e41c2d91c applied
   ```

The key in `VIRTUAL_KEY` still works, because its hash did not change. The `keys create` command has no flags for other metadata, such as `user` or `group`. To add this metadata to a key, use this update workflow.

### Step 6: Revoke a key {#agctl-revoke}

1. Delete the key by name. If several keys have the same name, use the ID from `agctl standalone keys` instead.

   ```sh
   agctl standalone delete llm.apiKey team-a
   ```

   Example output:

   ```text
   llm.apiKey/team-a deleted
   ```

2. Repeat the request from [Step 3](#agctl-test). Agentgateway rejects the request with a `401` status. Requests that are already in progress when you delete the key can still complete.

   Example output:

   ```text
   authentication failed
   ```

   The agentgateway logs record the reason, `api key authentication failure: invalid credentials`.

To rotate a key, create a replacement key with a new name, update the client, and then revoke the old key.
{{< /version >}}

## Configure token budgets

Token budgets are optional. Continue here to limit token usage across clients, then give each key its own budget. Keep your existing keys, provider credentials, and model restrictions when adding these policies.

> [!WARNING]
> `localRateLimit` is a **gateway-wide** limit, not a per-key limit. It enforces a single shared token budget across **all** requests and API keys.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}} To give each virtual key its own budget instead, add a `key` field to the rule, as shown in [Step 4](#per-key-budget).{{< /version >}}

### How rate limiting works

Agentgateway checks token-based rate limits in two phases:

**At request time:**

{{< reuse "agw-docs/snippets/ratelimit-requesttime.md" >}}

**At response time:**

{{< reuse "agw-docs/snippets/ratelimit-responsetime.md" >}}

### Step 1: Add a token budget

{{< tabs >}}
{{% tab name="UI" %}}
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
1. Open **LLM** > **Policies**, such as [http://localhost:15000/ui/llm/policies](http://localhost:15000/ui/llm/policies), and click the **Local rate limit** tile.
2. Select **Tokens** for the **Limit type**.
3. Fill out the other fields.
   1. **Fill interval**: `60s`
   2. **Max tokens**: `10`
   3. **Tokens per fill**: `1`
4. Click **Save policy**.

The UI writes the same `localRateLimit` rule as the **Config file** tab.
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
The UI steps for this section need agentgateway 1.7 or later. Use the **Config file** tab.
{{% /version %}}
{{% /tab %}}
{{% tab name="Config file" %}}
Add `localRateLimit` under `llm.policies` in `config.yaml`. Keep the existing `apiKey` policy and model configuration.

```yaml
llm:
  policies:
    localRateLimit:
    - maxTokens: 10
      tokensPerFill: 1
      fillInterval: 60s
      type: tokens
```
{{% /tab %}}
{{< /tabs >}}

| Setting | Description |
| -- | -- |
| `localRateLimit` | Applies a token-based rate limit to all incoming LLM requests. |
| `maxTokens` | The maximum number of tokens that are available to use. |
| `tokensPerFill` | The number of tokens that are added during a refill. |
| `fillInterval` | The number of seconds after which the token bucket is refilled. |
| `type` | The type of rate limiting to apply. Use `tokens` for token-based rate limiting, or `requests` for request-based rate limiting. |

### Step 2: Verify rate limits

1. Start agentgateway with the updated configuration.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}} If you saved the policy in the UI, skip this step, because the UI applies the change without a restart.{{< /version >}}
   ```sh
   agentgateway -f config.yaml
   ```

2. Send a prompt to the LLM. At the time the prompt is sent, the number of tokens required for the completion is unknown. Make sure to include a virtual key in the authorization header. Because `tokenize: true` is not set on the model, the prompt count is not estimated. As a result, the prompt is allowed.

   > [!NOTE]
   > The LLM typically returns the number of tokens required for completion in its response. Agentgateway uses this number and counts it against the rate limit.

   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer vk-alice-4f9c2a' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Tell me a short story"
         }
       ]
     }'
   ```

   Example output:
   ```json
   {
     "choices": [
       {
         "message": {
           "content": "Once upon a time, in a small village nestled between towering mountains...",
           "role": "assistant"
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 12,
       "completion_tokens": 248,
       "total_tokens": 260
     }
   }
   ```

3. Repeat the same request. This time, the request is rate limited because the tokens used in the first request exceeded the budget.
   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer vk-alice-4f9c2a' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Tell me a short story"
         }
       ]
     }'
   ```

   Example output:
   ```
   rate limit exceeded
   ```

### Step 3: Enable request-time token estimation

By default, agentgateway does not estimate token counts at request time. To reject requests before they reach the LLM, set `tokenize: true` on your model.

For more information about rate limiting configuration options, see [Rate limits]({{< link-hextra path="/documentation/configuration/resiliency/rate-limits/" >}}).

{{< tabs >}}
{{% tab name="UI" %}}
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
1. Open **LLM** > **Models**, and click the **Edit model** icon for the `*` model.
2. The form has no field for `tokenize`. Click the **Raw** icon (`<>`) in the drawer header, and add `tokenize: true` under `params`.
3. Click **Save model**. Requests are rejected immediately if the estimated prompt tokens exceed the available budget.
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
The UI steps for this section need agentgateway 1.7 or later. Use the **Config file** tab.
{{% /version %}}
{{% /tab %}}
{{% tab name="Config file" %}}
1. Add `tokenize: true` to the model's `params` in `config.yaml`. Keep the existing provider credentials. Requests are rejected immediately if the estimated prompt tokens exceed the available budget.
   
   ```yaml
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
         tokenize: true
   ```
{{% /tab %}}
{{< /tabs >}}

Then, verify the change.

1. Send a request. Use Bob's virtual key because Alice's virtual key already reached the rate limit in the previous step. This time, the request is rate limited because the estimated tokens exceed the budget.
   
   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer vk-bob-8d1e7b' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Tell me a short story"
         }
       ]
     }'
   ```

   Example output:
   ```
   rate limit exceeded
   ```

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}
### Step 4: Give each key its own budget {#per-key-budget}

So far, all of the virtual keys share one token budget, so the busiest key exhausts the budget for everyone else. To give each key its own budget, add a `key` field to the rate limit rule. The `key` field takes a CEL expression, and each distinct value that the expression returns gets its own token bucket with the limits of that rule. Use `apiKey.user` to read the `user` metadata from the authenticated key.

{{< tabs >}}
{{% tab name="UI" %}}
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
1. Open **LLM** > **Policies**, and click the **Local rate limit** tile.
2. The form edits a rule without a `key`. Click the **Raw** icon (`<>`) in the drawer header, and add `key: apiKey.user` to the rule.
3. Click **Save policy**.
4. Remove `tokenize: true` from the `*` model to compare the result with [Step 1](#step-1-add-a-token-budget). Use the **Raw** editor of the model, as in [Step 3](#step-3-enable-request-time-token-estimation), and click **Save model**.

The UI applies the changes without a restart.
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
The UI steps for this section need agentgateway 1.7 or later. Use the **Config file** tab.
{{% /version %}}
{{% /tab %}}
{{% tab name="Config file" %}}
1. Add `key: apiKey.user` to the rate limit rule. Remove `tokenize: true` from the model to compare the result with [Step 1](#step-1-add-a-token-budget). Keep the other authentication and model settings.

   ```yaml
   llm:
     policies:
       localRateLimit:
       - maxTokens: 10
         tokensPerFill: 1
         fillInterval: 60s
         type: tokens
         key: apiKey.user
   ```

2. Restart agentgateway with the updated configuration.

   ```sh
   agentgateway -f config.yaml
   ```
{{% /tab %}}
{{< /tabs >}}

Then, verify that each key has its own budget.

1. Send a prompt with Alice's virtual key. The request is allowed, because the keyed rule starts Alice with a full bucket.

   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer vk-alice-4f9c2a' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Tell me a short story"
         }
       ]
     }'
   ```

   Example output:
   ```json
   {
     "choices": [
       {
         "message": {
           "content": "Once upon a time, in a small village nestled between towering mountains...",
           "role": "assistant"
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 12,
       "completion_tokens": 248,
       "total_tokens": 260
     }
   }
   ```

2. Repeat the same request to exhaust Alice's budget. The tokens that the first response used exceed the 10-token bucket, so this request is rate limited.

   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer vk-alice-4f9c2a' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Tell me a short story"
         }
       ]
     }'
   ```

   Example output:
   ```
   rate limit exceeded
   ```

3. Send the same request with Bob's virtual key. Unlike in [Step 3](#step-3-enable-request-time-token-estimation), where Alice's usage rate limited Bob, the request succeeds, because Bob's key now has its own token bucket that Alice's requests do not draw from.

   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer vk-bob-8d1e7b' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Tell me a short story"
         }
       ]
     }'
   ```

   Example output:
   ```json
   {
     "choices": [
       {
         "message": {
           "content": "Once upon a time, in a small village nestled between towering mountains...",
           "role": "assistant"
         },
         "finish_reason": "stop"
       }
     ],
     "usage": {
       "prompt_tokens": 12,
       "completion_tokens": 248,
       "total_tokens": 260
     }
   }
   ```

Review the following behavior before you rely on a keyed budget.

* **Keys that cannot be evaluated**: Requests whose key is empty, or whose expression cannot be evaluated, such as an unauthenticated request when the key reads `apiKey.user`, all share one bucket. An empty key does not exempt a request from the limit.
* **How many buckets are kept, and where they live**: {{< reuse "agw-docs/snippets/ratelimit-key-buckets.md" >}} For a virtual key whose bucket was dropped, the next request starts from a full bucket. For a budget that is shared across instances, use [remote rate limits]({{< link-hextra path="/documentation/configuration/resiliency/rate-limits/#remote" >}}).

For more information, including how to key a limit on a JWT claim or on the requested model, see [Per-key limits]({{< link-hextra path="/documentation/configuration/resiliency/rate-limits/#per-key" >}}).
{{< /version >}}

## Monitor per-key spending

Usage tracking is optional and does not require a token budget.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}The UI cannot set the `config.metrics` fields that this section uses, so the steps use the configuration file only. To see the spending of each key in the UI instead, use the [cost dashboard]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/" >}}).{{< /version >}}

Agentgateway exposes token usage as Prometheus metrics on its stats endpoint, which listens on port `15020` by default (not the `15000` admin port). The `agentgateway_gen_ai_client_token_usage` metric is a histogram that records the tokens used per request.

By default, this metric is broken down by dimensions such as the model (`gen_ai_request_model`) and token type (`gen_ai_token_type`), but *not* by key. To attribute usage to each virtual key, add a label such as `user_id` that reads the `user` metadata from the authenticated key, then query Prometheus.

> [!NOTE]
> The token usage metric only appears after a request *succeeds* and the LLM returns a usage count. Requests that are rejected (for example, a `401` from an invalid key or a `429` from the rate limit) never reach the LLM, so they do not produce token usage metrics.

### Add a per-key metric label

You can add a per-key metric label such as to track metrics by user ID. Note that the `user_id` label is high cardinality: every unique value creates a new metric series, which increases Prometheus memory and storage. This is acceptable for tens or hundreds of keys, but avoid attaching unbounded identifiers at large scale. Prefer lower-cardinality dimensions like tier or team when possible.

1. Update your configuration to add a `user_id` metric label. The `add` field maps a label name to a CEL expression that is evaluated per request. Use `apiKey.user` to read the `user` metadata from the authenticated key. Add this block to `config.yaml` without replacing the existing authentication or budget policies.

   ```yaml
   config:
     metrics:
       fields:
         add:
           user_id: apiKey.user
   ```

   | Setting | Description |
   | -- | -- |
   | `config.metrics.fields.add` | A map of metric label names to CEL expressions. Each expression is evaluated per request and its result is attached as a Prometheus label on the metrics. |
   | `user_id: apiKey.user` | Adds a `user_id` label whose value is the `user` metadata from the authenticated API key. If the expression cannot be evaluated (for example, on an unauthenticated request), the label value is `unknown`. |

2. Restart agentgateway with the updated configuration, then send successful requests with each key so the metrics have per-key data to report. Because the earlier rate-limit budget is small, raise `maxTokens` or wait for the bucket to refill so the requests are not rejected.

3. Verify that the `user_id` label is attached to the token usage metric. Read the metrics endpoint and filter for the token usage sum.

   ```sh
   curl -s http://localhost:15020/metrics | grep gen_ai_client_token_usage_sum
   ```

   Each series now carries a `user_id` label that matches the `user` metadata of the key that made the request. For example, after sending requests with Alice's and Bob's keys:

   ```
   agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input",gen_ai_request_model="gpt-3.5-turbo",...,user_id="alice"} 21.0
   agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output",gen_ai_request_model="gpt-3.5-turbo",...,user_id="alice"} 14.0
   agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input",gen_ai_request_model="gpt-3.5-turbo",...,user_id="bob"} 9.0
   agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output",gen_ai_request_model="gpt-3.5-turbo",...,user_id="bob"} 9.0
   ```

### Query with Prometheus

The raw curl output in the previous step is a quick sanity check, but it returns only Prometheus exposition text. To run aggregations such as totals over time or estimated cost, use PromQL. PromQL runs inside a Prometheus server that scrapes the agentgateway metrics endpoint. You cannot send PromQL to the `/metrics` endpoint directly, so in standalone mode you run your own Prometheus.

1. Create a Prometheus scrape configuration that targets the agentgateway stats endpoint.

   ```yaml
   cat <<'EOF' > prometheus.yml
   global:
     scrape_interval: 5s

   scrape_configs:
   - job_name: agentgateway
     static_configs:
     - targets: ["host.docker.internal:15020"]
   EOF
   ```

   > [!NOTE]
   > Use `host.docker.internal:15020` when you run Prometheus in Docker, as in the next step. If you run the Prometheus binary directly on your machine, use `localhost:15020` instead.

2. Start Prometheus with this configuration.

   ```sh
   docker run --rm -p 9090:9090 \
     -v "$(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml" \
     prom/prometheus
   ```

3. Verify that Prometheus is scraping agentgateway. Open [http://localhost:9090/targets](http://localhost:9090/targets) and confirm that the `agentgateway` target is **UP**. You might need to restart the container or refresh the page.

   {{< reuse-image-light src="img/prom-agw.png">}}
   {{< reuse-image-dark srcDark="img/prom-agw-dark.png">}}

4. Query token usage per key. The following query returns the total tokens consumed by each virtual key. The token usage metric carries a separate series per token type, so match both `input` and `output` in a *single* selector with `=~` and sum them. 
   
   {{< tabs >}}
   {{% tab name="Query"%}}
   ```promql
   sum by (user_id) (agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type=~"input|output"})
   ```
   {{% /tab %}}
   {{% tab name="Prometheus UI"%}}
   Open the [Prometheus expression browser](http://localhost:9090/query?) and run a PromQL query

   {{< reuse-image-light src="img/prom-agw-query.png">}}
   {{< reuse-image-dark srcDark="img/prom-agw-query-dark.png">}}

   {{% /tab %}}
   {{% tab name="curl"%}}
   ```sh
   curl -s http://localhost:9090/api/v1/query \
     --data-urlencode 'query=sum by (user_id) (agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type=~"input|output"})' \
     | jq .
   ```
   
   Example output:
   ```json
   {
     "status": "success",
     "data": {
       "resultType": "vector",
       "result": [
         {
           "metric": {
             "user_id": "bob"
           },
           "value": [
             1783540709.896,
             "253"
           ]
         },
         {
           "metric": {
             "user_id": "alice"
           },
           "value": [
             1783540709.896,
             "262"
           ]
         }
       ]
     }
   }
   ```
   {{% /tab %}}
   {{< /tabs >}}

5. Estimate costs by multiplying token counts by your provider's pricing. Input and output tokens are usually priced differently, so aggregate each type separately, then add the two results. Each `sum by (user_id)` collapses the `gen_ai_token_type` label, so the `+` matches on `user_id`.

   > [!NOTE]
   > Queries that use `rate()` or `increase()` over a range such as `[24h]` need that much scrape history to return meaningful values. While testing locally, query the raw `_sum` counters or use a shorter range such as `[5m]`.
   > 
   > This query *estimates* cost for OpenAI GPT-3.5 by applying your own pricing to token counts. To have agentgateway compute the *realized* USD cost per request from a model cost catalog, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).

   {{< tabs >}}
   {{% tab name="Query"%}}

   ```promql
   # Estimated cost per key (assuming $0.50 per 1M input tokens, $1.50 per 1M output tokens)
   sum by (user_id) (agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"} / 1000000 * 0.50)
   +
   sum by (user_id) (agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"} / 1000000 * 1.50)
   ```
   {{% /tab %}}
   {{% tab name="Prometheus UI"%}}
   Open the [Prometheus expression browser](http://localhost:9090/query?) and run a PromQL query

   {{< reuse-image-light src="img/prom-agw-query-add.png">}}
   {{< reuse-image-dark srcDark="img/prom-agw-query-add-dark.png">}}

   {{% /tab %}}
   {{% tab name="curl"%}}
   ```sh
   curl -s http://localhost:9090/api/v1/query \
     --data-urlencode 'query=(sum by (user_id) (agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"} / 1000000 * 0.50))+(sum by (user_id) (agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"} / 1000000 * 1.50))' \
     | jq .
   ```
   
   Example output:
   ```json
   {
     "status": "success",
     "data": {
       "resultType": "vector",
       "result": [
         {
           "metric": {
             "user_id": "bob"
           },
           "value": [
             1783541276.199,
             "0.0003675"
           ]
         },
         {
           "metric": {
             "user_id": "alice"
           },
           "value": [
             1783541276.199,
             "0.000381"
           ]
         }
       ]
     }
   }
   ```
   {{% /tab %}}
   {{< /tabs >}}
