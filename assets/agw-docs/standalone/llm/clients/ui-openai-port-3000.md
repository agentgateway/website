To create the same configuration in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps.

1. Set your OpenAI API key, create a configuration file with an empty `llm` section, and start agentgateway. The UI checks that the `OPENAI_API_KEY` environment variable exists when you save the model.

   ```sh
   export OPENAI_API_KEY='<your-api-key>'
   cat > config.yaml <<'EOF'
   llm:
     models: []
   EOF
   agentgateway -f config.yaml
   ```

2. Add the model.
   1. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
   2. From the **Provider** dropdown, select **OpenAI**.
   3. In the **Incoming model match** field, replace the default `openai/*` with `*`.
   4. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`.

      {{< reuse-image src="img/ui-llm-model-passthrough.png" srcDark="img/ui-llm-model-passthrough-dark.png" alt="Add model drawer with the OpenAI provider, * as the incoming model match, and the provider API key read from the OPENAI_API_KEY environment variable" >}}

   5. Click **Save model**.
3. Serve LLM traffic on port `3000`.
   1. Open the **Gateway Overview** page, such as [http://localhost:15000/ui/](http://localhost:15000/ui/).
   2. On the **LLM** row, click **Settings**.
   3. Enter `3000` for the **Port**, and click **Save settings**.

      {{< reuse-image src="img/ui-llm-settings-port.png" srcDark="img/ui-llm-settings-port-dark.png" alt="LLM Settings drawer with the Gateway binding port set to 3000 and a Save settings button" >}}

The UI writes the same deprecated `llm.port` field as the **Config file** tab, plus an empty `llm.gateways` list. If your configuration defines `gateways`, the **Settings** drawer shows a **Gateway** dropdown instead of **Port**, and binds LLM traffic to the gateway that you select. The UI also writes the provider as `openai` instead of `openAI`. Agentgateway accepts both values.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
