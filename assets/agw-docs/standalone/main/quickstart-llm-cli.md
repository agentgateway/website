For OpenAI, you can use the CLI instead of the UI in Steps 3 and 4. [Install agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}), then apply the following model resource to the running gateway. The `OPENAI_API_KEY` environment variable must be set in the gateway's environment, as in Step 1.

```sh
cat <<'EOF' > openai-model.yaml
kind: llm.model
value:
  name: gpt-3.5-turbo
  provider: openAI
  params:
    apiKey: "$OPENAI_API_KEY"
EOF
agctl standalone apply -f openai-model.yaml
agctl standalone get llm.model gpt-3.5-turbo -o yaml
```

Continue with the OpenAI request in Step 5. To remove this model after the quickstart, run `agctl standalone delete llm.model gpt-3.5-turbo`. For other providers, use the UI tabs below or adapt a resource using the [provider configuration]({{< link-hextra path="/integrations/llm/providers/" >}}).
