## About

Agentgateway serves the UI on the port of any gateway that you list in the `ui` section of your configuration file. A generated configuration lists the `default` gateway, so the UI is served on the gateway port from the first start. Agentgateway logs the address that it serves the UI on when it starts, so the log is the quickest way to find the UI.

A copy of the UI is also served on the admin interface, which is `localhost:15000` by default. That copy is a local convenience, and the admin address is loopback-only, so a gateway is what you use to reach the UI from anywhere else. For more information, see [UI]({{< link-hextra path="/documentation/setup/ui/" >}}).

## Before you begin

[Install standalone agentgateway]({{< link-hextra path="/documentation/setup/install/" >}}) as a binary, a Docker container, or a Kubernetes Deployment with Helm.

{{< doc-test paths="ui-standalone-default" >}}
# Install agentgateway binary for tests
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Open the UI {#open-admin-ui}

{{< tabs >}}
{{% tab name="Binary" %}}
1. Start agentgateway with a configuration file.

   ```sh
   agentgateway -f config.yaml
   ```

   Agentgateway logs where it serves the UI.

   ```
   INFO app  serving UI at http://localhost:15000/ui
   ```

2. Open [http://localhost:15000/ui/](http://localhost:15000/ui/) in your browser.

   The UI opens on the **Gateway Overview**, which lists the available capabilities (LLM, MCP, and Traffic) and lets you enable the ones you want to operate.

   {{< reuse-image-light src="img/agentgateway-ui-landing.png" alt="agentgateway UI Gateway Overview page with LLM, MCP, and Traffic rows, and the sidebar groups Gateway, LLM, MCP, Traffic, and Tools" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-landing-dark.png" alt="agentgateway UI Gateway Overview page with LLM, MCP, and Traffic rows, and the sidebar groups Gateway, LLM, MCP, Traffic, and Tools" >}}

If you started agentgateway with no arguments instead, the generated configuration attaches the UI to the `default` gateway, so the UI is also served at [http://localhost:4000/ui/](http://localhost:4000/ui/).
{{% /tab %}}
{{% tab name="Docker" %}}
The generated configuration that agentgateway writes into a mounted `/config` directory attaches the UI to the `default` gateway, so the UI is served on the gateway port that you published.

1. Confirm where the container serves the UI.

   ```sh
   docker logs <container-name> | grep "serving UI"
   ```

   Example output:

   ```txt
   INFO app  serving UI at http://localhost:4000/ui
   ```

2. Open [http://localhost:4000/ui/](http://localhost:4000/ui/) in your browser.

If you mounted your own configuration file that has no `ui` section, the UI is served only on the admin interface, which is not reachable from your host. Add a `ui` section that lists a gateway. For more information, see [Reach the UI in a container]({{< link-hextra path="/documentation/operations/debug/#docker-admin-addr" >}}).
{{% /tab %}}
{{% tab name="Helm" %}}
The chart creates no Service for the admin port, so you reach the UI by port-forwarding the {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} Deployment. A port-forward is fine for a quick look. To reach the UI without one, give it a gateway.

1. Port-forward the {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} deployment on the admin port.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
   ```

2. In your browser, open the `/ui` path.

   ```sh
   open http://localhost:15000/ui
   ```

To serve the UI on its own gateway and hostname instead of a port-forward, see [Serve the UI on its own gateway]({{< link-hextra path="/documentation/setup/ui/gateway-ui/" >}}).
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="ui-standalone-default" >}}
pkill -f "agentgateway -f" 2>/dev/null || true
sleep 1
cat > /tmp/agw-ui-default.yaml <<'EOF'
config:
  adminAddr: localhost:15000
EOF
agentgateway -f /tmp/agw-ui-default.yaml &
AGW_DEFAULT_PID=$!
sleep 3
YAMLTest -f - <<'EOF'
- name: UI returns HTTP 200 on the admin address
  http:
    url: "http://localhost:15000/ui/"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
  retries: 3
EOF
kill $AGW_DEFAULT_PID 2>/dev/null || true
{{< /doc-test >}}

## Tour the UI {#tour}

The sidebar groups the UI into five areas: **Gateway**, **LLM**, **MCP**, **Traffic**, and **Tools**. Each page lists the resources in your configuration, and you can add, edit, or delete them in the page. The **Gateway** area has the **Home** page. The **Tools** area has the **CEL Playground**, **Raw Configuration**, and **Settings** pages. The following examples show a configuration with one gateway, two routes, an LLM model, and an MCP server.

### Traffic {#tour-traffic}

The **Traffic** area holds the HTTP gateways and routes that are not LLM or MCP traffic.

* **Gateways**: Shows each gateway with its port and protocol. Click **Add gateway** to open a new port.

  {{< reuse-image src="img/ui-tour-traffic-gateways.png" srcDark="img/ui-tour-traffic-gateways-dark.png" alt="Traffic Gateways page with one gateway named default on port 3000 and an Add gateway button" >}}

* **Routes**: Lists every route with its gateway, path match, and backends. A route with more than one backend splits traffic between them by weight.

  {{< reuse-image src="img/ui-tour-traffic-routes.png" srcDark="img/ui-tour-traffic-routes-dark.png" alt="Traffic Routes page with two HTTP routes, api-v2 and httpbin, that show the gateway, path match, and backends" >}}

* **Route policies**: To change a backend or a policy on a route, click the **Edit route** icon for the route. The **Edit route** drawer shows the backends, a **Route policies** summary such as CORS and rate limits{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}, and the YAML that your change produces{{< /version >}}. Click **View diff** to compare the change with your current configuration before you save.

  {{< reuse-image src="img/ui-tour-route-policies.png" srcDark="img/ui-tour-route-policies-dark.png" alt="Edit route drawer with a host backend, a Backend policies row, a Route policies row for CORS and rate limits, and a View diff button" >}}

> [!NOTE]
> In standalone mode, you set route policies in the **Edit route** drawer. The sidebar has no **Traffic** > **Policies** page in standalone mode. That read-only page exists only for gateways that get their configuration from a control plane, such as agentgateway on Kubernetes.

### LLM {#tour-llm}

The **LLM** area configures the models that clients can request and the policies that apply to all LLM traffic.

* **Models**: Lists each model with its provider and the model name that the request uses with that provider. Click the play icon to try a model in the **Chat Playground**.

  {{< reuse-image src="img/ui-tour-llm-models.png" srcDark="img/ui-tour-llm-models-dark.png" alt="LLM Models page with one gpt-4o-mini model from the OpenAI provider and play, edit, and delete icons" >}}

* **Policies**: Shows each policy type as a card that is marked **enabled** or **disabled**. Click a card to configure that policy for all LLM traffic.

  {{< reuse-image src="img/ui-tour-llm-policies.png" srcDark="img/ui-tour-llm-policies-dark.png" alt="LLM Policies page with policy cards such as CORS, API keys, and JWT auth, each marked enabled or disabled" >}}

The **LLM** area also has pages for providers, guardrails, virtual API keys, costs, analytics, and logs. For more information, see the [LLM quickstart]({{< link-hextra path="/documentation/quickstart/llm/" >}}).{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}} To replace the value of a virtual API key, see [Rotate a virtual key]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/#rotate-a-virtual-key" >}}).{{< /version >}}

### MCP {#tour-mcp}

The **MCP** area configures the MCP servers behind the gateway and the policies that apply to MCP traffic.

* **Servers**: Lists each MCP server with its transport, endpoint, and connection state. A server in the **ready** state is connected, and its tools are available in the **Tool Playground**.

  {{< reuse-image src="img/ui-tour-mcp-servers.png" srcDark="img/ui-tour-mcp-servers-dark.png" alt="MCP Servers page with one Streamable HTTP server named time in the ready state" >}}

* **Policies**: Shows the MCP policy types as cards, including MCP authentication, MCP authorization, and CORS. Click a card to configure that policy.

  {{< reuse-image src="img/ui-tour-mcp-policies.png" srcDark="img/ui-tour-mcp-policies-dark.png" alt="MCP Policies page with policy cards such as MCP authentication, MCP authorization, and CORS, each marked enabled or disabled" >}}

For more information, see the [MCP quickstart]({{< link-hextra path="/documentation/quickstart/mcp/" >}}).

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
### Settings {#tour-settings}

The **Settings** page, under **Tools**, holds the settings that apply to the whole gateway. The page has two sub-pages, and [http://localhost:15000/ui/settings](http://localhost:15000/ui/settings) opens the first one.

* **UI**: Selects the **Public gateway** that serves the UI in addition to the admin interface. The page also shows the UI access policies, such as OIDC, JWT auth, API keys, and CORS. The UI saves these settings in the `ui` section of your configuration. For more information, see [Serve the UI on its own gateway]({{< link-hextra path="/documentation/setup/ui/gateway-ui/" >}}) and [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}).

  {{< reuse-image src="img/ui-tour-settings-ui.png" srcDark="img/ui-tour-settings-ui-dark.png" alt="Settings UI page with the Public gateway dropdown set to None and the UI access policy cards, such as OIDC and JWT auth, marked disabled" >}}

* **Observability**: Shows the **Tracing** and **Access logs** cards, which configure tracing and access logs for all traffic. The UI saves these settings in `frontendPolicies.tracing` and `frontendPolicies.accessLog`. For more information, see [Access logs]({{< link-hextra path="/documentation/observability/access-logs/view/" >}}) and [Traces]({{< link-hextra path="/documentation/observability/traces/" >}}).

  {{< reuse-image src="img/ui-tour-settings-observability.png" srcDark="img/ui-tour-settings-observability-dark.png" alt="Settings Observability page with the Tracing and Access logs cards, both marked disabled" >}}
{{< /version >}}

## Try out the UI

Use the UI to review what agentgateway loaded and to manage the resources that you can edit from the UI. The following guides configure agentgateway from a file first, and then you can open the same configuration in the UI to see how the UI presents it.

* [MCP quickstart]({{< link-hextra path="/documentation/quickstart/mcp/" >}}) to connect an MCP server and try tools in the built-in playground.
* [LLM quickstart]({{< link-hextra path="/documentation/quickstart/llm/" >}}) to route requests to an LLM provider and see the model in the UI.

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
## Edit a resource as YAML {#raw-mode}

The drawers that edit models, providers, guardrails, MCP servers, gateways, listeners, routes, policies, and virtual API keys have a **Raw** mode. Use raw mode to set a field that the form does not show, or to paste a configuration snippet.

1. Open the drawer for a resource. For example, open **LLM** > **Virtual API Keys**, and click the **Edit key** icon for a key.
2. Click the **Raw** icon (`<>`) at the top of the drawer.

   The drawer shows the YAML for that one resource, such as one key, model, route, or policy. It does not show the rest of your configuration. Expand **Help** to see the fields that the resource accepts.

   ```yaml
   key: sk-custom-bob-0001
   metadata:
     name: bob-key
     user: bob
     group: sales
   ```

   {{< reuse-image src="img/ui-llm-key-raw.png" srcDark="img/ui-llm-key-raw-dark.png" alt="Edit virtual key drawer in raw mode with the YAML for the bob-key virtual API key" >}}

3. Edit the YAML. The UI checks each edit against the configuration schema. If an edit is not valid, the drawer shows an **Invalid configuration** banner with the first error, and you cannot save. For example, if you delete the `key` field of a virtual API key, the banner reports that `key` is required.

   {{< reuse-image src="img/ui-llm-key-raw-invalid.png" srcDark="img/ui-llm-key-raw-invalid-dark.png" alt="Edit virtual key drawer in raw mode with an Invalid configuration banner that reports key: Required, and the Save key button turned off" >}}

4. Optional: To return to the form, click the **Raw** icon again. The form keeps your last valid edit and drops any text that is not valid. If the form cannot show a value, such as a field that has no form control, the drawer stays in raw mode. The tooltip on the **Raw** icon explains why.
5. Click the save button, such as **Save key**. To check the change first, click **View diff**.

To work with the whole configuration instead of one resource, open **Tools** > **Raw Configuration**.
{{< /version >}}

## Save changes from the UI {#save-changes}

Whether the UI can save the changes that you make depends on your storage mode. In the binary and Docker installations, the UI writes to your configuration file by default. In the Helm installation, the ConfigMap is read-only and a save fails unless you switch the chart to database mode. For more information, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
The UI checks a change before it writes the configuration file. If the change is not valid, the save fails with an error and the file does not change.

If you edit the file outside the UI and agentgateway rejects the reload, the UI shows a **Configuration reload failed** banner. Agentgateway keeps running the previous valid configuration. The UI and `/api/config/effective` show the file on disk, including the rejected change. To retry the reload, fix the file and save it again.
{{< /version >}}

## Generate LLM client settings {#client-setup}

For an example of using the UI to set something up, use the **LLM > Client Setup** page. It generates connection settings and snippets for curl, Claude Code, Claude Desktop, Codex CLI, OpenCode, Goose, Cursor, GitHub Copilot, {{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}Continue, {{< /version >}}Windsurf, and the OpenAI JavaScript and Python SDKs{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}. The page also includes a Pi recipe that writes `baseUrl` and `apiKey` values into `~/.pi/agent/models.json`{{< /version >}}.{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}} The Continue recipe shows a model entry for `~/.continue/config.yaml`. For the rest of the Continue setup, see [Continue]({{< link-hextra path="/integrations/llm/clients/continue/" >}}).{{< /version >}}

1. Configure at least one LLM model and, if the gateway requires client authentication, a [virtual API key]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}).
2. Open the **LLM** > **Client Setup** page in the UI, such as [http://localhost:15000/ui/llm/client-setup](http://localhost:15000/ui/llm/client-setup).
3. Review the **Gateway base URL**, and select a model and virtual API key.
4. Select the client from the **Integration** dropdown, and copy the generated settings or snippet.

   {{< reuse-image src="img/ui-tour-client-setup.png" srcDark="img/ui-tour-client-setup-dark.png" alt="LLM Client Setup page with connection settings on the left and a generated curl snippet on the right" >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
   For example, select **Continue** to get a model entry for `~/.continue/config.yaml`.

   {{< reuse-image src="img/ui-tour-client-setup-continue.png" srcDark="img/ui-tour-client-setup-continue-dark.png" alt="LLM Client Setup page with Continue selected as the integration and a generated model entry for the Continue config.yaml file" >}}
{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
Client Setup fills in **Gateway base URL** from the gateway that serves LLM traffic. If the same gateway also serves the UI, Client Setup uses the address in your browser instead, so the URL keeps the host, scheme, and port of a reverse proxy in front of agentgateway. Check the URL before you copy a snippet, and change it if clients reach agentgateway through a different address. The snippets appear only when **Gateway base URL** has a value.
{{< /version >}}

Client Setup does not create a route, model, authentication policy, or provider credential. It generates client-side values from the configuration that already exists. For client-specific prerequisites, see [LLM clients]({{< link-hextra path="/integrations/llm/clients/" >}}).

The selected model appears only in recipes that accept a model setting. For example, the Claude Desktop recipe outputs a gateway URL and API key, but does not configure a model name in Claude Desktop.

## Next steps

* [Serve the UI on its own gateway]({{< link-hextra path="/documentation/setup/ui/gateway-ui/" >}}) so that UI traffic and proxy traffic do not share a port.
* [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}) with an OIDC login.
* [Expose the UI]({{< link-hextra path="/documentation/setup/ui/expose-ui/" >}}) on your own HTTPS hostname.
* [Choose where configuration is stored]({{< link-hextra path="/documentation/setup/storage/" >}}) so that the UI can save your changes.
