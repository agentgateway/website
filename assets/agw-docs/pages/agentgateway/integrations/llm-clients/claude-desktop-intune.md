Use Microsoft Intune to deploy a managed Claude Desktop configuration that
routes inference through agentgateway. The workflow applies to agentgateway
running in Kubernetes or standalone mode and supports three credential models:
an agentgateway API key, Microsoft Entra ID, or an advanced per-user Claude
subscription passthrough configuration.

Intune installs the application and enforces its endpoint configuration. The
credential model determines whether agentgateway validates a gateway key or an
Entra identity before adding a centrally managed Anthropic credential, or
passes each user's Claude subscription token upstream.

### Prepare the rollout

1. Complete the [Claude Desktop]({{< link-hextra
   path="/integrations/llm-clients/claude-desktop/" >}}) guide for your
   agentgateway mode and chosen credential model.
2. Expose agentgateway through a stable HTTPS hostname that the managed devices
   can resolve. Claude Desktop rejects plain HTTP for non-loopback addresses
   with `baseUrl: must use https (or http on loopback)`.
3. Enroll your [Windows
   devices](https://learn.microsoft.com/en-us/intune/device-enrollment/windows/guide)
   or [macOS
   devices](https://learn.microsoft.com/en-us/intune/device-enrollment/apple/guide-macos)
   in Intune.
4. Install a supported Claude Desktop release on an unmanaged administrator
   workstation so that you can build and test the configuration before export.
5. Create an Intune pilot device group. For Entra mode, also create an Entra ID
   pilot user group. Do not begin with a tenant-wide assignment.

{{< callout type="warning" >}}
The gateway API key and Entra workflows use a centrally managed Anthropic
provider credential. They do not establish per-user Anthropic subscription or
seat attribution. Never put the Anthropic provider key or a subscription token
in an Intune profile. A static agentgateway client key is acceptable for a
limited pilot, but the exported policy contains that key. Do not reuse one
static key across a production fleet.
{{< /callout >}}

### Choose one authentication model

Choose exactly one of the following models before you build the managed
profile. The credential settings are mutually exclusive.

| Authentication model | When to use | Upstream credential | Billing |
| --- | --- | --- | --- |
| [Gateway API key](#claude-gateway-api-key) | Static key for an initial pilot; credential helper for production | Centrally managed Anthropic API key | Anthropic API account |
| [Claude subscription passthrough](#claude-subscription) | Advanced option for preserving per-user seat usage | Per-user Claude subscription token | User's Claude subscription |
| [Microsoft Entra ID](#claude-entra) | Recommended enterprise identity and Conditional Access model | Centrally managed Anthropic API key | Anthropic API account |

{{< callout type="important" >}}
Complete only one authentication option. Do not combine the gateway-key,
subscription-token, and Entra credential settings in the same Claude Desktop
profile. After completing one option, continue with [Build and test the managed
configuration](#build-and-test-the-managed-configuration).
{{< /callout >}}

{{< callout type="important" >}}
The JSON blocks below are reference examples, not files to create or upload to
Intune. Enter the equivalent values in **Developer > Configure Third-Party
Inference**. Claude Desktop creates its local `<id>.json` file when you save
the configuration. Use **Export** to create the `.mobileconfig` or Windows
policy artifact that you deploy with Intune.

Replace `https://claude.example.com` with the [stable HTTPS
hostname](#before-you-begin) that exposes agentgateway. Use only the origin
when the route matches `/`. Include a path such as `/claude` only when the
route matches that prefix and rewrites it to `/`. Replace each example helper
path with the fixed absolute path where Intune deploys your helper executable.
{{< /callout >}}

{{< callout type="info" >}}
**Find the locally saved configuration**

- **macOS:** In Finder, select **Go > Go to Folder**, enter
  `~/Library/Application Support/Claude-3p/configLibrary/`, and open the
  applicable `<id>.json` file.

- **Windows:** Press **Windows+R**, enter
  `%LOCALAPPDATA%\Claude-3p\configLibrary\`, and open the applicable `<id>.json`
  file.

`_meta.json` identifies the currently applied configuration. Use these files
for inspection only; they might contain static credentials. Use Claude
Desktop's **Export** action to create the Intune deployment artifact. For
details, see the [Claude Desktop configuration
reference](https://claude.com/docs/third-party/claude-desktop/configuration#how-keys-are-read).
{{< /callout >}}

### Option 1: Use a gateway API key {#claude-gateway-api-key}

Gateway API key mode is the recommended starting point. Claude Desktop sends a
client key that agentgateway validates, and agentgateway replaces it with a
separately managed Anthropic API key for the upstream request. Complete the
[Claude Desktop gateway API key setup]({{< link-hextra
path="/integrations/llm-clients/claude-desktop/#gateway-api-key" >}}) for your
agentgateway mode before you build the Intune profile.

For an initial pilot, select **Static API key** and use the revocable gateway
client key from [Configure a gateway client key for the
pilot](#configure-a-gateway-client-key-for-the-pilot). This is the same client
key that the Codex example reads from `AGENTGATEWAY_API_KEY`; you do not need a
Claude-specific client-key store. Do not use the Anthropic provider key. A
static client key is stored in the local Claude Desktop configuration and in
the exported Intune policy, where device administrators can recover it. Limit
the assignment to the pilot group and rotate or revoke the key after testing.

Enter and test the following gateway API key settings in Claude Desktop.

```json
{
  "inferenceProvider": "gateway",
  "inferenceGatewayBaseUrl": "https://claude.example.com",
  "inferenceCredentialKind": "static",
  "inferenceGatewayApiKey": "REPLACE_WITH_SHARED_PILOT_GATEWAY_KEY",
  "inferenceGatewayAuthScheme": "bearer",
  "modelDiscoveryEnabled": false,
  "inferenceModels": [
    {
      "name": "claude-opus-5",
      "anthropicFamilyTier": "opus"
    }
  ]
}
```

Before a broad production assignment, replace the static key with an
organization-owned credential helper:

```json
{
  "inferenceCredentialKind": "helper-script",
  "inferenceCredentialHelper": "/absolute/path/to/agentgateway-key-helper"
}
```

A helper is an executable that Claude Desktop runs with no arguments. It
retrieves the assigned key from Keychain, Credential Manager, or an internal
secret broker and writes only the credential to standard output. For the
output, error, caching, and refresh contract, see [Write a credential
helper](https://claude.com/docs/third-party/claude-desktop/credential-helper).

From Claude Desktop, confirm that **Test connection** succeeds, normal
inference returns HTTP 200 in the agentgateway request log, and a request
without the gateway key returns HTTP 401. When testing a helper, also run it as
the intended user with
`CLAUDE_HELPER_CONTEXT=setup-test`. Then continue with [Build and test the
managed configuration](#build-and-test-the-managed-configuration).

### Option 2: Use Claude subscription passthrough {#claude-subscription}

Claude subscription passthrough is an advanced option that preserves each
user's Claude seat and usage attribution. The user authenticates to Anthropic
with a bearer token from
`claude setup-token`; agentgateway passes that token upstream instead of
injecting a centrally managed Anthropic API key. Complete the [Claude
subscription setup]({{< link-hextra
path="/integrations/llm-clients/claude-desktop/#configure-claude-desktop" >}})
for your agentgateway mode before you build the Intune profile.

Intune can enforce the gateway address, Bearer auth scheme, model list, and
model-discovery setting, but do not put the user's token in the profile. A
managed profile is readable by device administrators and cannot safely hold a
per-user subscription credential. Instead, deploy an organization-owned
credential helper that retrieves the token from per-user secure storage such
as Keychain or Credential Manager. Each user obtains and stores their own
token. The helper follows the same [credential-helper
contract](https://claude.com/docs/third-party/claude-desktop/credential-helper)
and returns that user's token instead of a gateway key.

Enter and test the following subscription-passthrough settings in Claude
Desktop. Add at least one full model ID under **Models** and turn off model
discovery.

```json
{
  "inferenceProvider": "gateway",
  "inferenceGatewayBaseUrl": "https://claude.example.com",
  "inferenceCredentialKind": "helper-script",
  "inferenceCredentialHelper": "/absolute/path/to/claude-subscription-helper",
  "inferenceGatewayAuthScheme": "bearer",
  "modelDiscoveryEnabled": false,
  "inferenceModels": [
    {
      "name": "claude-opus-5",
      "anthropicFamilyTier": "opus"
    }
  ]
}
```

Claude Desktop appends `/v1/models` and `/v1/messages` to the configured base
URL.

Test the helper under the intended user account and for noninteractive helper
contexts before deployment. In particular, the connection test invokes the
helper with `CLAUDE_HELPER_CONTEXT=setup-test`, and background refreshes must
not stop for an interactive prompt. Then continue with [Build and test the
managed configuration](#build-and-test-the-managed-configuration).

{{< callout type="info" >}}
With subscription passthrough, **Test connection** might return HTTP 429 with
`rate_limit_error` even when normal Cowork inference works. Apply the
configuration, send a harmless prompt, and inspect the agentgateway request
log. If the real `/v1/messages` request returns HTTP 200, treat the connection
test as a false negative and use actual inference as the final validation.
{{< /callout >}}

### Option 3: Use Microsoft Entra ID {#claude-entra}

Complete the [Claude Desktop Entra setup]({{< link-hextra
path="/integrations/llm-clients/claude-desktop/#sso" >}}) for your agentgateway
mode before you build the Intune profile.

#### Choose the Entra sign-in flow

Claude Desktop supports two Entra sign-in flows for a Gateway connection.

| Flow | User experience | When to use |
| --- | --- | --- |
| Browser | Claude Desktop opens the system browser and receives the result on a loopback callback. | Initial testing or environments that do not require a device claim during sign-in. |
| Broker | Claude Desktop uses Web Account Manager on Windows or Company Portal and the Microsoft Enterprise SSO plug-in on macOS. | Production deployments that use Conditional Access to require a managed or compliant device. |

The broker is the recommended production choice for Intune-managed devices. A
browser presents device identity only when the browser and operating system are
configured to provide it. The broker provides the device identity directly and
does not require a loopback callback.

#### Register Claude Desktop in Entra ID

1. In the Microsoft Entra admin center, go to **Entra ID > App registrations >
   New registration**.
2. Create a single-tenant registration, such as `Claude Desktop gateway`.
3. Record the **Application (client) ID** and **Directory (tenant) ID**.
4. Go to **Authentication**, add the **Mobile and desktop applications**
   platform, and configure the redirect URIs for your sign-in flow.

   | Flow and platform | Redirect URI |
   | --- | --- |
   | Browser on Windows or macOS | `http://127.0.0.1/callback` |
   | Broker on Windows | `ms-appx-web://Microsoft.AAD.BrokerPlugin/CLIENT_ID` |
   | Broker on macOS | `msauth.com.anthropic.claudefordesktop://auth` |

   Replace `CLIENT_ID` in the Windows broker URI with the Application (client)
   ID. When you support both flows during a pilot, register all applicable
   redirect URIs.
5. For broker sign-in, set **Allow public client flows** to **Yes**.
6. In **Enterprise applications**, open the service principal that corresponds
   to the registration. Set **Assignment required?** to **Yes**, and assign the
   Entra pilot user group. This prevents unassigned tenant users from signing
   in to the client registration.

The client is public and must not have a client secret. For more information,
see [Register an application in Microsoft Entra
ID](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).

#### Prepare managed devices for broker sign-in

On Windows, Web Account Manager is part of the operating system. The device
must be registered, joined, or hybrid joined to Entra ID. It must also report
the required compliance state to Intune before a compliant-device Conditional
Access policy can grant access.

On macOS, deploy the current Intune Company Portal application and configure
the Microsoft Enterprise SSO plug-in. Microsoft recommends Platform SSO for
strong device registration. For the prerequisites and Intune settings, see
[Configure Platform SSO for macOS
devices](https://learn.microsoft.com/en-us/intune/device-configuration/settings-catalog/configure-platform-sso-macos).

Do not enable a Conditional Access requirement until broker sign-in succeeds on
both pilot platforms.

### Build and test the managed configuration

After you complete exactly one authentication option, build a profile that
contains only that option's credential settings plus the common settings in
this section.

Use an administrator workstation that does not already have a Claude Desktop
managed profile.

1. In Claude Desktop, enable developer mode from **Help > Troubleshooting >
   Enable Developer Mode**.
2. Go to **Developer > Configure Third-Party Inference > Connection**.
3. Configure the values shared by all three authentication models.

   | Setting | Value |
   | --- | --- |
   | Inference provider | **Gateway** |
   | Gateway base URL | The HTTPS agentgateway URL. Include `/claude` only when the route matches and rewrites that prefix. |
   | Model discovery | **Off** when you deploy a fixed model list |
   | Models | One or more full model IDs, such as `claude-opus-5`; the first entry is the default |

4. Configure credentials for only the authentication model that you selected.

   | Authentication model | Credential kind | Required settings |
   | --- | --- | --- |
   | Gateway API key | **Static API key** for a pilot; **Helper script** for production | For a pilot, enter the shared gateway client key and select **Bearer**. For production, set the absolute credential-helper path instead. |
   | Claude subscription passthrough | **Helper script** | Set the absolute credential-helper path and **Bearer** auth scheme. The helper returns the current user's Claude subscription token. |
   | Microsoft Entra ID | **Interactive sign-in** | Set the issuer to `https://login.microsoftonline.com/TENANT_ID/v2.0`, the Entra Application (client) ID, **ID token**, scopes `openid profile email offline_access`, and **Broker** or **Browser** sign-in flow. |

   For Entra ID, agentgateway must validate the token signature, exact issuer,
   and application audience. Keep the issuer and client ID in the managed
   profile aligned with the issuer and audience configured on agentgateway.
5. Review the remaining **Configure Third-Party Inference** settings and apply
   them according to your organization's requirements. These optional settings
   are not required to route inference through agentgateway. See the [Claude
   Desktop configuration
   reference](https://claude.com/docs/third-party/claude-desktop/configuration)
   and [MDM deployment
   guide](https://claude.com/docs/third-party/claude-desktop/mdm) for additional
   details.
6. Ensure that managed devices can reach the agentgateway hostname. If users
   must not access LLM providers directly, enforce that requirement with
   separate network controls. A Claude Desktop or Intune configuration cannot
   prevent another application from bypassing agentgateway.
7. Apply the configuration locally and test model selection and inference. If
   you configured managed MCP servers, test them separately. If you
   intentionally use discovery instead of a fixed list, also test
   `GET /v1/models`.
8. Verify the result for the selected model. In all modes, confirm that the
   agentgateway log records the real `/v1/messages` request with HTTP 200 and
   does not expose credentials.

   - For a gateway API key, also confirm that a request without the key returns
     HTTP 401.
   - For subscription passthrough, use a real prompt as the final validation if
     **Test connection** returns the documented false-negative HTTP 429.
   - For Entra ID, confirm that the log records the authenticated identity and
     that an invalid issuer, audience, expired token, or missing token is
     rejected.

### Export the configuration

After every connection and policy test succeeds, use **Export** in Claude
Desktop.

{{< callout type="warning" >}}
When **Static API key** is selected, the exported macOS profile or Windows
policy contains the agentgateway client key. Assign it only to the pilot group.
Before production rollout, switch to **Helper script** so that the managed
policy contains a helper path instead of the credential.
{{< /callout >}}

- Export `.mobileconfig` for macOS. The profile contains the complete managed
  configuration in the `com.anthropic.claudefordesktop` preference domain.
- Export the ADMX package for Windows. The package supplies the schema that
  Intune uses to create a policy; enter the validated values in the Intune
  profile. Export `.reg` as a reference when you need to compare the resulting
  registry values.

Prefer the application-generated artifacts over hand-written profiles. Nested
objects such as the OIDC and MCP settings are encoded as JSON strings in macOS
preferences and Windows registry policy. A native property-list dictionary,
registry subkey, or incorrectly escaped string does not apply.

For all supported settings and their precedence, see [Claude Desktop managed
configuration](https://claude.com/docs/third-party/claude-desktop/configuration)
and [Deploy with
MDM](https://claude.com/docs/third-party/claude-desktop/mdm).

### Deploy the configuration on macOS

1. In the Intune admin center, go to **Devices > Manage devices >
   Configuration > Create > New policy**.
2. Select **macOS** and **Templates > Custom**.
3. Upload the exported `.mobileconfig` file.
4. Assign the profile to the pilot group and monitor its deployment status.
5. Fully quit and reopen Claude Desktop. The application reads managed
   configuration at launch.

For more information, see [Add custom settings to Apple devices in Microsoft
Intune](https://learn.microsoft.com/en-us/intune/device-configuration/templates/configure-custom-settings-apple).

### Deploy the configuration on Windows

1. Extract the exported ADMX package.
2. In the Intune admin center, go to **Devices > Manage devices >
   Configuration > Import ADMX** and import the ADMX and `en-US` ADML files.
3. Create a **Windows 10 and later > Templates > Imported Administrative
   templates** profile.
4. Enter the complete validated Claude Desktop configuration and assign it to
   the pilot group.
5. Confirm that the policy writes string values directly under
   `HKLM\SOFTWARE\Policies\Claude`. Do not split the configuration across
   `HKLM` and `HKCU`, and do not put values in registry subkeys.
6. Fully quit and reopen Claude Desktop.

Machine policy is recommended. When any supported machine-policy value is
present, Claude Desktop ignores the entire user-policy hive. For more
information about importing the templates, see [Import custom ADMX and ADML
administrative templates into Microsoft
Intune](https://learn.microsoft.com/en-us/intune/device-configuration/settings-catalog/import-custom-admx-templates).

If imported ADMX templates do not meet your deployment requirements, use an
organization-owned [Intune PowerShell
script](https://learn.microsoft.com/en-us/intune/device-management/tools/run-powershell-scripts-windows)
to write the exported values to the machine-policy key. Never include a
provider credential in the script.

### Optional: Add Conditional Access for Entra ID

Complete this section only when you selected Microsoft Entra ID. After broker
sign-in works on the pilot devices, create a Conditional Access policy that
targets the Claude Desktop Entra enterprise application and pilot users.

1. Start the policy in **Report-only** mode.
2. Require multifactor authentication as appropriate for your organization.
3. Require the device to be marked compliant.
4. Exclude emergency access accounts.
5. Review the Entra sign-in logs for the expected user, application, device,
   and grant-control results.
6. Enable the policy for the pilot group before expanding the assignment.

Avoid targeting all users and all resources while developing the policy. A
misconfigured compliant-device requirement can also block the administrators
who need to repair it. For deployment guidance, see [Require healthy and
compliant devices with
Intune](https://learn.microsoft.com/en-us/microsoft-365/solutions/manage-devices-with-intune-require-compliance?view=o365-worldwide).

### Verify Claude Desktop enforcement

Test the following cases on Windows and macOS before expanding the rollout.

1. If Intune deploys Claude Desktop, confirm its installation under **Managed
   apps** or the app installation report. An independently installed copy on a
   personally owned Mac does not need to appear under **Discovered apps**.
2. In the Intune admin center, open the device's **Device configuration** page
   and confirm that the Claude Desktop profile reports **Succeeded**. On macOS,
   use Company Portal **Check status** to request the latest configuration.
3. Deploy the platform-appropriate script from [Automate verification with
   Intune](#automate-verification-with-intune) with Claude Desktop enabled.
   Confirm that Intune reports success for the installation, effective managed
   gateway URL, and network checks. The script does not return managed
   preference or registry contents. It currently verifies the gateway URL, not
   the model list; confirm the managed model settings in the read-only Claude
   Desktop configuration window.
4. Fully quit and reopen Claude Desktop instead of only closing its window. On
   macOS, use **Command-Q**. Open the third-party inference configuration and
   confirm that it is marked as organization-managed, read-only, and points to
   agentgateway.
5. Start the agentgateway log stream as described in [Verify the
   deployment](#verify-the-deployment). Authenticate with the authentication
   model that you selected, start a new third-party inference conversation,
   and send a harmless prompt.

   ```text
   Reply exactly: AGW-CLAUDE-VERIFY. Do not use tools.
   ```

   Then test model discovery and each managed MCP server.
6. Correlate the inference request by its time. Confirm a successful
   `POST /v1/messages` entry with the expected managed hostname, route,
   upstream provider, and `http.status=200`. For Entra ID, also confirm the
   authenticated identity. The access log does not need to contain the prompt
   text and must not contain the client or upstream credential. If no entry
   appears, check the full restart, managed HTTPS URL, DNS, and network path.
7. Test the negative case for the selected model.

   - For a gateway API key, confirm that a missing or invalid key receives an
     unauthorized response from agentgateway.
   - For Entra ID, confirm that an invalid issuer, audience, expired token, and
     missing token each receive an unauthorized response from agentgateway.
   - For subscription passthrough, confirm that an invalid subscription token
     is rejected by Anthropic. Agentgateway does not independently authenticate
     the caller in this mode.
8. Try to save a local gateway URL or local third-party configuration. Fully
   restart Claude Desktop and confirm that the managed configuration remains
   effective.
9. Confirm that only approved MCP servers are available and that each tool
    uses the configured approval policy.
10. If you selected Entra broker mode, mark a pilot device noncompliant and
    confirm that Conditional Access blocks a new sign-in.
11. If you selected Entra ID, remove a pilot user from the assigned group and
    revoke the user's sessions. Confirm that a new sign-in is blocked. A JWT
    that agentgateway already accepted remains valid until its expiration
    unless you add a separate token-revocation mechanism, so choose an
    appropriate token and session lifetime.
12. Confirm that endpoint network controls block direct inference traffic to
    unapproved providers.

### Update or remove the Claude Desktop policy

Use a new pilot assignment for every client or configuration update. Claude
Desktop reads managed settings once at launch, so users must fully quit and
reopen it after a profile change.

To return a device to local configuration, remove the managed Intune profile
and restart Claude Desktop. Do not leave a partial machine policy on Windows:
any recognized value in the machine-policy hive causes Claude Desktop to
ignore user policy.
