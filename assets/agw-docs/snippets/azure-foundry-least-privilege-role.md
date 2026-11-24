When the gateway authenticates to Azure AI Foundry with a Microsoft Entra ID token, such as with implicit authentication, a managed identity, or workload identity, Azure checks the roles of that identity on the Foundry resource. API keys are not checked against Azure roles.

Built-in roles such as `Foundry User` (previously `Azure AI User`) and `Cognitive Services User` grant every data action on the resource (`Microsoft.CognitiveServices/*`). These data actions include agents, fine-tuning, files, and evaluations, which the gateway does not need. To limit the identity to the requests that the gateway sends, you can create a custom role instead.

The gateway sends inference requests to `https://{resourceName}.services.ai.azure.com` with a token for the `https://ai.azure.com/.default` scope. The gateway does not call Azure Resource Manager to list deployments, read keys, or read the resource. As a result, the custom role needs no control plane permissions (`Actions`), only the following data plane permissions (`DataActions`). In the table, the status shows whether Azure confirmed the data action as the permission that it checks for the request type.

| Request type | Upstream path | Data action | Status |
| -- | -- | -- | -- |
| Chat completions | `/api/projects/{projectName}/openai/v1/chat/completions`. If `projectName` is not set, the resource name is used instead. | `Microsoft.CognitiveServices/accounts/OpenAI/deployments/chat/completions/action` | Confirmed |
| Claude token counting | `/anthropic/v1/messages/count_tokens` | `Microsoft.CognitiveServices/accounts/AIServices/providers/action` | Confirmed |
| Claude Messages | `/anthropic/v1/messages` | `Microsoft.CognitiveServices/accounts/AIServices/providers/action` | Not yet confirmed |

For Claude Messages requests, the Azure error does not name a data action. However, Azure reports one permission check for all `POST /anthropic/v1/*` requests, so the same data action is expected to apply. Test Claude Messages requests before you rely on the custom role for them. The custom role does not cover other request types, such as Responses or embeddings requests. If a request fails with a `401` error, check the error message. In many cases, the message names the data action that the identity is missing, which you can add to the role.

1. Save the following custom role definition to a file, such as `foundry-inference-role.json`. Replace `<subscription-id>` with the ID of your Azure subscription.

   ```json
   {
     "Name": "agentgateway Foundry Inference",
     "IsCustom": true,
     "Description": "Least-privilege inference for agentgateway against an Azure AI Foundry resource",
     "Actions": [],
     "NotActions": [],
     "DataActions": [
       "Microsoft.CognitiveServices/accounts/AIServices/providers/action",
       "Microsoft.CognitiveServices/accounts/OpenAI/deployments/chat/completions/action"
     ],
     "NotDataActions": [],
     "AssignableScopes": ["/subscriptions/<subscription-id>"]
   }
   ```

2. Create the custom role.

   ```sh
   az role definition create --role-definition foundry-inference-role.json
   ```

3. Assign the custom role to the identity that the gateway uses. Assign the role at the scope of the Foundry resource, not a Foundry project. The Claude paths are resource-level paths with no project in the URL, so a role that is assigned only to a project might not authorize Claude requests. For a managed identity, use the principal ID, also called the object ID, of the identity.

   ```sh
   az role assignment create \
     --assignee-object-id <identity-principal-id> \
     --assignee-principal-type ServicePrincipal \
     --role "agentgateway Foundry Inference" \
     --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<resource-name>"
   ```

   Role assignments can take several minutes to take effect.

For more information, see [Role-based access control for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/rbac-foundry) and [Azure custom roles](https://learn.microsoft.com/azure/role-based-access-control/custom-roles).
