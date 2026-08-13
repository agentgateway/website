Use Microsoft Intune to deploy a managed Claude Desktop configuration that
routes inference through agentgateway and authenticates each user with
Microsoft Entra ID. The workflow applies to agentgateway running in Kubernetes
or standalone mode.

Intune installs the application and enforces its endpoint configuration. Entra
ID authenticates the user, and agentgateway validates the identity before it
adds the centrally managed Anthropic credential to the upstream request.

### Prepare the rollout

1. Complete the [Claude Desktop]({{< link-hextra
   path="/integrations/llm-clients/claude-desktop/" >}}) guide through the
   Entra ID authentication steps for your agentgateway mode.
2. Expose agentgateway through a stable HTTPS hostname that the managed devices
   can resolve. Claude Desktop rejects plain HTTP for non-loopback addresses.
3. Enroll your [Windows
   devices](https://learn.microsoft.com/en-us/intune/device-enrollment/windows/guide)
   or [macOS
   devices](https://learn.microsoft.com/en-us/intune/device-enrollment/apple/guide-macos)
   in Intune.
4. Install a supported Claude Desktop release on an unmanaged administrator
   workstation so that you can build and test the configuration before export.
5. Create an Intune pilot device group and an Entra ID pilot user group. Do not
   begin with a tenant-wide assignment.

{{< callout type="warning" >}}
This workflow uses a centrally managed Anthropic provider credential. It does
not establish per-user Anthropic subscription or seat attribution. Do not put
an Anthropic API key, subscription token, or another upstream provider secret
in an Intune profile.
{{< /callout >}}

### Choose the Entra sign-in flow

Claude Desktop supports two Entra sign-in flows for a Gateway connection.

| Flow | User experience | When to use |
| --- | --- | --- |
| Browser | Claude Desktop opens the system browser and receives the result on a loopback callback. | Initial testing or environments that do not require a device claim during sign-in. |
| Broker | Claude Desktop uses Web Account Manager on Windows or Company Portal and the Microsoft Enterprise SSO plug-in on macOS. | Production deployments that use Conditional Access to require a managed or compliant device. |

The broker is the recommended production choice for Intune-managed devices. A
browser presents device identity only when the browser and operating system are
configured to provide it. The broker provides the device identity directly and
does not require a loopback callback.

### Register Claude Desktop in Entra ID

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

### Prepare managed devices for broker sign-in

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

Use an administrator workstation that does not already have a Claude Desktop
managed profile.

1. In Claude Desktop, enable developer mode from **Help > Troubleshooting >
   Enable Developer Mode**.
2. Go to **Developer > Configure Third-Party Inference > Connection**.
3. Configure the connection.

   | Setting | Value |
   | --- | --- |
   | Inference provider | **Gateway** |
   | Gateway base URL | The HTTPS agentgateway URL, including the `/claude` route prefix |
   | Credential kind | **Interactive sign-in** |
   | Issuer | `https://login.microsoftonline.com/TENANT_ID/v2.0` |
   | Client ID | The Entra Application (client) ID |
   | Bearer token | **ID token** |
   | Scopes | `openid profile email offline_access` |
   | Gateway sign-in flow (`inferenceGatewayOidcAuthFlow`) | **Broker** for a compliant-device production policy; otherwise **Browser** |

4. In **Workspace restrictions**, set `disableDeploymentModeChooser` when users
   must not sign in directly to Claude.ai.
5. In **Connectors & extensions**, configure `managedMcpServers` with the
   organization-approved servers and explicit per-tool `toolPolicy` values.
   Set `isLocalDevMcpEnabled` to `false` when users must not add local MCP
   servers. Set `mcpPersistentAlwaysAllowEnabled` to `false` when approvals
   must not persist across sessions.
6. Review **Egress Requirements** and give the exported hostname list to the
   network team. Blocking direct provider access is a separate network control;
   an Intune profile alone cannot prevent another application from bypassing
   agentgateway.
7. Apply the configuration locally and test model discovery, inference, and
   each managed MCP server.
8. Verify that agentgateway logs the authenticated Entra identity and does not
   log bearer tokens or the upstream provider credential.

Agentgateway must validate the token signature, exact issuer, and application
audience. Keep the Entra issuer and client ID in the managed client profile
aligned with the issuer and audience configured on agentgateway.

### Export the configuration

After every connection and policy test succeeds, use **Export** in Claude
Desktop.

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

### Add Conditional Access

After broker sign-in works on the pilot devices, create a Conditional Access
policy that targets the Claude Desktop Entra enterprise application and pilot
users.

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
   preference or registry contents.
4. Fully quit and reopen Claude Desktop instead of only closing its window. On
   macOS, use **Command-Q**. Open the third-party inference configuration and
   confirm that it is marked as organization-managed, read-only, and points to
   agentgateway.
5. Start the agentgateway log stream as described in [Verify the
   deployment](#verify-the-deployment). Sign in with a pilot Entra account,
   start a new third-party inference conversation, and send a harmless prompt.

   ```text
   Reply exactly: AGW-CLAUDE-VERIFY. Do not use tools.
   ```

   Then test model discovery and each managed MCP server.
6. Correlate the inference request by its time. Confirm a successful
   `POST /v1/messages` entry with the expected managed hostname, identity,
   route, upstream provider, and `http.status=200`. The access log does not
   need to contain the prompt text and must not contain the bearer token or
   upstream provider credential. If no entry appears, check the full restart,
   managed HTTPS URL, DNS, and network path. An unauthorized response indicates
   an Entra token or agentgateway authentication-policy problem.
7. Confirm that an invalid issuer, audience, expired token, and missing token
   each receive an unauthorized response.
8. Try to save a local gateway URL or local third-party configuration. Fully
   restart Claude Desktop and confirm that the managed configuration remains
   effective.
9. Confirm that only approved MCP servers are available and that each tool
    uses the configured approval policy.
10. For broker mode, mark a pilot device noncompliant and confirm that
    Conditional Access blocks a new sign-in.
11. Remove a pilot user from the assigned Entra group and revoke the user's
    sessions. Confirm that a new sign-in is blocked. A JWT that agentgateway
   already accepted remains valid until its expiration unless you add a
   separate token-revocation mechanism, so choose an appropriate token and
   session lifetime.
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
