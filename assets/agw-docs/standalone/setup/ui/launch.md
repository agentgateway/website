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

   {{< reuse-image-light src="img/agentgateway-ui-landing.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-landing-dark.png" >}}

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

## Try out the UI

Use the UI to review what agentgateway loaded and to manage the resources that you can edit from the UI. The following guides configure agentgateway from a file first, and then you can open the same configuration in the UI to see how the UI presents it.

* [MCP quickstart]({{< link-hextra path="/documentation/quickstart/mcp/" >}}) to connect an MCP server and try tools in the built-in playground.
* [LLM quickstart]({{< link-hextra path="/documentation/quickstart/llm/" >}}) to route requests to an LLM provider and see the model in the UI.

Whether the UI can save the changes that you make depends on your storage mode. In the binary and Docker installations, the UI writes to your configuration file by default. In the Helm installation, the ConfigMap is read-only and a save fails unless you switch the chart to database mode. For more information, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).

## Generate LLM client settings {#client-setup}

For an example of using the UI to set something up, use the **LLM > Client Setup** page. It generates connection settings and snippets for curl, Claude Code, Claude Desktop, Codex CLI, OpenCode, Cursor, GitHub Copilot, Windsurf, and the OpenAI JavaScript and Python SDKs.

1. Configure at least one LLM model and, if the gateway requires client authentication, a [virtual API key]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}).
2. Open the **LLM** > **Client Setup** page in the UI, such as [http://localhost:15000/ui/llm/client-setup](http://localhost:15000/ui/llm/client-setup).
3. Review the **Gateway base URL**, and select a model and virtual API key.
4. Select the client from the **Integration** dropdown, and copy the generated settings or snippet.

Client Setup does not create a route, model, authentication policy, or provider credential. It generates client-side values from the configuration that already exists. For client-specific prerequisites, see [LLM clients]({{< link-hextra path="/integrations/llm/clients/" >}}).

The selected model appears only in recipes that accept a model setting. For example, the Claude Desktop recipe outputs a gateway URL and API key, but does not configure a model name in Claude Desktop.

## Next steps

* [Serve the UI on its own gateway]({{< link-hextra path="/documentation/setup/ui/gateway-ui/" >}}) so that UI traffic and proxy traffic do not share a port.
* [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}) with an OIDC login.
* [Expose the UI]({{< link-hextra path="/documentation/setup/ui/expose-ui/" >}}) on your own HTTPS hostname.
* [Choose where configuration is stored]({{< link-hextra path="/documentation/setup/storage/" >}}) so that the UI can save your changes.
