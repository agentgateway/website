Agentgateway provides a built-in UI with a wizard to walk you through your first configuration.

The following steps are equivalent to creating this basic configuration file.

1. From the terminal, start agentgateway. 
   ```sh
   agentgateway 
   ```

2. In your browser, [open the agentgateway UI](http://localhost:15000/ui/). The first time, you are greeted with a wizard that walks you through creating your first configuration. Click **Start Setup** to continue.
   {{< reuse-image src="img/ui-wizard.png" >}}

3. From the **Configure Listener** tab, set up your first listener as follows:

   * Listener name: `default`
   * Protocol: `HTTP`
   * Hostname: `localhost`
   * Port: `3000`
   * Click **Next** to continue.

   {{< reuse-image src="img/ui-wizard-listeners.png" >}}

4. From the **Configure Route** tab, leave the default configuration to allow path matching from all hostnames on `GET` and `POST` methods. Then click **Next** to continue.
   
   {{< reuse-image src="img/ui-wizard-routes.png" >}}

5. From the **Configure Backend** tab, set up your first MCP backend as follows:

   * Backend Type: `MCP`
   * MCP Backend Name: `default`
   * Target Type: `Stdio`
   * Target Name: `everything`
   * Command: `npx`
   * Arguments: `@modelcontextprotocol/server-everything`
   * Click **Next** to continue.
   
   {{< reuse-image src="img/ui-wizard-backends.png" >}}

6. From the **Configure Policies** tab, set up a basic CORS policy as follows. This way, the configuration works with the [MCP inspector tool](https://modelcontextprotocol.io/docs/tools/inspector).

   * Allowed Origins: `*`
   * Allowed Methods: `GET,POST,PUT,DELETE,OPTIONS`
   * Allowed Headers: `mcp-protocol-version`
   * Click **Next** to continue.
   
   {{< reuse-image src="img/ui-wizard-policies.png" >}}

7. From the **Review Configuration** tab, make sure that the `Ready to Deploy` message is displayed. Then click **Complete Setup**.

   {{< reuse-image src="img/ui-wizard-review.png" >}}