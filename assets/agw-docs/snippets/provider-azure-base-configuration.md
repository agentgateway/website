| Setting | Description |
|---------|-------------|
| `ai.name` | The name of the LLM provider for this AI backend. |
| `ai.provider.azure.resourceName` | The Azure resource name used to construct the endpoint hostname. |
| `ai.provider.azure.resourceType` | The endpoint type: `foundry` for Azure AI Foundry, or `openAI` for Azure OpenAI Service. |
| `ai.provider.azure.projectName` | The Foundry project name. Required for `foundry` type. |
| `ai.provider.azure.model` | Optionally set the model to use for requests. If set, any models in the request are overwritten. If not set, the request must include the model to use. |
