Use Microsoft Intune to install supported LLM clients, configure them to use
agentgateway, and repair configuration drift. The endpoint-management workflow
applies to both Kubernetes and standalone deployments. This guide uses Codex
and Claude Desktop for complete examples and describes the management options
for the other supported clients.

Intune manages the client endpoint. Agentgateway remains the enforcement point
for authentication, authorization, rate limits, guardrails, and observability.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Configure the [LLM provider]({{< link-hextra path="/llm/providers/" >}})
   that your managed clients use.
3. Expose the Gateway through a stable HTTPS hostname that Intune-managed
   devices can resolve, such as `https://llm.example.com`.
4. Enroll your test devices in Intune by following the [Windows enrollment
   guide](https://learn.microsoft.com/en-us/intune/device-enrollment/windows/guide)
   or the [macOS enrollment
   guide](https://learn.microsoft.com/en-us/intune/device-enrollment/apple/guide-macos).
5. Review the configuration guide for each [supported LLM
   client]({{< link-hextra path="/integrations/llm-clients/" >}}) that you plan
   to manage.

{{< conditional-text include-if="kubernetes" >}}
For Kubernetes, terminate TLS on the agentgateway proxy by following the
[HTTPS listener guide]({{< link-hextra path="/setup/listeners/https/" >}}).
Use a certificate whose subject alternative name matches the managed hostname
and whose issuer is trusted by the client devices.
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
For standalone, terminate TLS on agentgateway by following the [HTTPS listener
configuration]({{< link-hextra path="/configuration/listeners/#https-listeners"
>}}). Use a certificate whose subject alternative name matches the managed
hostname and whose issuer is trusted by the client devices.
{{< /conditional-text >}}

{{< callout type="warning" >}}
Do not use a port-forward, localhost address, or temporary load balancer address
in a managed configuration. Never include an upstream LLM provider key in an
Intune profile or remediation script. A static agentgateway client key is
acceptable only for a limited pilot because an administrator of the managed
device can recover it.
{{< /callout >}}

## Plan the Intune policy

Use four controls for each managed client.

1. **Required application:** Deploy the client as a required Intune
   application. Use a [Win32 app on
   Windows](https://learn.microsoft.com/en-us/intune/app-management/deployment/win32).
   On macOS, use a [DMG
   app](https://learn.microsoft.com/en-us/intune/app-management/deployment/add-dmg-macos)
   when the vendor image contains the application bundle, or an [unmanaged PKG
   app](https://learn.microsoft.com/en-us/intune/app-management/deployment/add-unmanaged-pkg-macos)
   when the vendor supplies a PKG or the installation requires scripts or
   custom packaging. For either macOS app type, set **Ignore app version** to
   **Yes** for a self-updating client so that Intune detects the bundle instead
   of reinstalling an older uploaded version. To enforce an exact version, set
   it to **No**, control the client's auto-update behavior when supported, and
   upload each approved replacement package.
2. **Managed configuration:** See [Choose a management
   method](#choose-a-management-method) to identify the supported mechanism for
   each client. When the client supports native managed policy, deploy that
   policy through Intune. Otherwise, use a platform script or remediation to
   manage only the gateway-related settings without overwriting unrelated user
   configuration.
3. **Drift enforcement:** Prefer native managed policy, such as managed
   preferences on macOS. For a macOS client without native managed policy,
   deploy a recurring [Intune shell
   script](https://learn.microsoft.com/en-us/intune/device-management/tools/run-shell-scripts-macos)
   to detect and restore the approved configuration. On supported Windows
   devices, [Intune
   Remediations](https://learn.microsoft.com/en-us/intune/device-management/tools/deploy-remediations)
   can run on an hourly schedule. Intune Remediations are not available for
   macOS.
4. **Compliance and access:** On enrolled macOS, Linux, and supported Windows
   devices, optionally use an [Intune custom compliance discovery
   script](https://learn.microsoft.com/en-us/intune/device-security/compliance/create-custom-script)
   to report whether the approved gateway configuration is effective. Custom
   compliance reports drift but does not repair it. Protect agentgateway
   separately, and optionally use the device compliance result with Microsoft
   Entra Conditional Access.

A recurring shell script or Windows remediation is periodic, not continuous. A
user can change an ordinary user configuration between evaluations. Native
managed policy is stronger, but network and gateway policies are still required
if users must not bypass agentgateway with another executable or SDK. These
macOS controls apply to an enrolled BYOD Mac, but the user can unenroll a
personally owned device. Use compliance and Conditional Access policies when
access must require continued enrollment.

{{< callout type="info" >}}
**Do not use Discovered apps to verify configuration delivery.** On a
personally owned macOS device, Intune reports only apps that Intune manages. An
independently installed Codex or Claude Desktop app might not appear. The
Discovered apps report also normally refreshes every seven days from the
device's enrollment date. Use **Device configuration**, the effective managed
preference, and agentgateway request logs to verify this workflow. For more
information, see [Intune Discovered
Apps](https://learn.microsoft.com/en-us/intune/app-management/discovered-apps).
{{< /callout >}}

## Choose a management method

The supported clients expose different configuration and enforcement
mechanisms. This guide provides end-to-end application deployment, managed
configuration, drift enforcement, compliance, and verification examples for
Codex and Claude Desktop. The other clients receive configuration-specific
guidance. Start with clients that provide native managed policy.

| Client | Configuration used by the agentgateway guide | Recommended Intune method | Enforcement level |
| --- | --- | --- | --- |
| Codex | `model_provider` and `model_providers.agentgateway` | Deploy Codex managed configuration. Use a macOS preference profile or a Windows remediation. | Strong managed startup configuration. |
| Claude Code | `ANTHROPIC_BASE_URL` | Deploy native Claude Code managed settings through a macOS preference profile, Windows registry policy, or `managed-settings.json`. | Strong native managed policy. |
| Claude Desktop | Gateway connection, a gateway-key or subscription credential helper, Entra sign-in, workspace restrictions, and managed MCP servers | Build and test the configuration in Claude Desktop, export the native `.mobileconfig` or ADMX policy, and deploy it with Intune. | Strong native managed policy. Managed settings override local configuration. |
| Cursor | **Override OpenAI Base URL** in Cursor settings | Seed and audit the user setting only after validating its on-disk schema for the deployed Cursor version. | Remediation-based. |
| Devin Desktop | `http.proxy` in the editor settings | Merge the setting into the user's editor configuration and remediate only that key. | Remediation-based. |
| VS Code Continue | The model entry in `~/.continue/config.json` | Deploy the configuration file or merge the agentgateway model entry with a user-context script. | Remediation-based. |
| GitHub Copilot | `github.copilot.advanced.debug.overrideProxyUrl` in VS Code settings | Merge the setting into VS Code user settings. Preserve unrelated settings when remediating the JSON file. | Remediation-based; requires Copilot Business or Enterprise. |
| OpenAI SDK | `base_url` or `baseURL` in application code | Deploy an organization-owned wrapper, environment file, or application configuration. | Not enforceable by managing the SDK package alone. |
| curl | Request URL | Deploy an organization-owned wrapper command for convenience. | Not an application-policy boundary. |

For clients with an ordinary user settings file, detect and update only the
gateway-related keys. Replacing the entire file can delete a user's unrelated
editor, model, or accessibility settings.

## Configure a gateway client key for the pilot

Use one revocable agentgateway client key for the Codex and Claude Desktop
pilot examples in this guide. Protect the OpenAI and Anthropic routes with the
same [virtual key]({{< link-hextra
path="/llm/cost-controls/virtual-keys/" >}}), and keep the provider credentials
separate.

| Credential | Purpose | Send to managed clients? |
| --- | --- | --- |
| Gateway client key | Authenticates Codex and Claude Desktop to agentgateway | Yes, for the pilot |
| OpenAI provider key | Authenticates agentgateway to OpenAI | No |
| Anthropic provider key | Authenticates agentgateway to Anthropic | No |

You do not need a different gateway client key or client-key store for each
application. In Kubernetes, configure the API key policies on both client
HTTPRoutes to use the same virtual-key source. Do not apply the policy to a
shared Gateway listener if another route must accept a different credential.

Store the raw pilot key in a password manager while you build the client
policies. The examples refer to it as `AGENTGATEWAY_API_KEY`. Before a broad
production assignment, replace the shared static key with per-user,
per-device, or identity-based credentials so that you can revoke access and
attribute usage independently.

## Manage Codex

Codex supports [managed
configuration](https://learn.chatgpt.com/docs/enterprise/managed-configuration)
in the Codex CLI, IDE extension, and Codex in the ChatGPT desktop app. Managed
configuration overrides the user's `config.toml` and CLI `--config` values
when the client starts.

### Choose a Codex authentication option

Choose one authentication method for the custom agentgateway provider.

| Method | When to use | Managed TOML |
| --- | --- | --- |
| Environment variable | Initial pilot | Set `env_key = "AGENTGATEWAY_API_KEY"`. Provision the variable with the pilot gateway client key. |
| Command-backed bearer token | Production | Configure `model_providers.agentgateway.auth` to invoke an organization-owned credential helper. |

This guide uses the environment-variable method. The variable must be
available to the process that launches Codex. Setting it only in an interactive
shell does not make it available to a Codex desktop application launched from
the macOS Finder or Windows Start menu. Use your organization's secret
delivery mechanism to provision the value in the intended user context. Do
not place the raw value in the managed TOML.

For production, a command-backed authentication helper can retrieve a
short-lived or device-specific credential from Keychain, Credential Manager,
or an internal secret broker. Do not combine `auth` with `env_key`,
`experimental_bearer_token`, or `requires_openai_auth`. For the supported
fields, see the [Codex configuration
reference](https://developers.openai.com/codex/config-reference#configtoml).

Create the following approved configuration. Replace the example hostname with
the stable HTTPS address that exposes agentgateway. Keep the `/v1` suffix
because Codex sends Responses API requests to `/v1/responses`.

```toml
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "OpenAI via agentgateway"
base_url = "https://llm.example.com/v1"
wire_api = "responses"
env_key = "AGENTGATEWAY_API_KEY"
```

{{< callout type="warning" >}}
Do not distribute a plain HTTP gateway URL. It sends prompts, responses, and
credentials without transport encryption. Use a publicly trusted or
organization-trusted certificate on the HTTPS listener before assigning the
managed Codex configuration.
{{< /callout >}}

For more information about the client behavior, see [Codex]({{< link-hextra
path="/integrations/llm-clients/codex/" >}}).

### macOS

Codex reads managed preferences from the `com.openai.codex` domain. Deploy the
TOML as a base64-encoded `config_toml_base64` value.

1. Save the approved configuration as `managed_config.toml`.
2. Encode the file without line wrapping.

   ```sh
   base64 < managed_config.toml | tr -d '\n'
   ```

3. Save the following Intune preference-file content as
   `codex-managed-preferences.xml`. Replace `BASE64_ENCODED_TOML` with the
   output from the previous step.

   ```xml
   <key>config_toml_base64</key>
   <string>BASE64_ENCODED_TOML</string>
   ```

   {{< callout type="warning" >}}
   The Intune **Preference file** template accepts a `.plist` or `.xml` file,
   but the uploaded file must contain only the key-value pairs. Do not add an
   XML declaration, `DOCTYPE`, `<plist>`, or `<dict>` wrapper. Those elements
   cause Intune to reject or incorrectly process this preference-file payload.
   {{< /callout >}}

4. In the Intune admin center, go to **Devices > Manage devices >
   Configuration > Create > New policy**.
5. Select **macOS** and **Templates > Preference file**.
6. Use `com.openai.codex` as the preference domain, upload
   `codex-managed-preferences.xml`, and assign the policy to your pilot device
   group.
7. Restart Codex.

For more information about the Intune workflow, see [Add preference file
settings to macOS
devices](https://learn.microsoft.com/en-us/intune/device-configuration/templates/configure-preference-file-macos).

You can also deploy `requirements_toml_base64` in the same preference domain
to enforce supported Codex security requirements. Provider and base URL fields
are managed defaults, not supported `requirements.toml` constraints.

#### Verify Codex on macOS

1. In the Intune admin center, open **Devices > All devices**, select the Mac,
   and open **Device configuration**. Confirm that the Codex preference policy
   reports **Succeeded**.
2. On the Mac, open Company Portal, select the device, and select **Check
   status** to request the latest assigned configuration.
3. Deploy the [macOS verification script](#automate-verification-with-intune)
   with Codex enabled. Confirm that Intune reports success for the
   installation, effective managed configuration, and network checks. The
   script reports only check results and does not return the decoded TOML.
4. From the intended user context, verify the gateway key independently. The
   environment variable must contain the gateway client key, not the OpenAI
   provider key.

   ```sh
   curl --fail-with-body \
     --header "Authorization: Bearer $AGENTGATEWAY_API_KEY" \
     "https://llm.example.com/v1/models?client_version=intune-verification"
   ```

5. Fully quit Codex. On macOS, use **Command-Q** instead of only closing the
   window. Reopen Codex so that it loads the managed defaults, and start a new
   local task. A cloud task does not run through the local managed provider.
6. Start the agentgateway log stream as described in [Verify the
   deployment](#verify-the-deployment), and then send a harmless prompt from
   the new task.

   ```text
   Reply exactly: AGW-CODEX-VERIFY. Do not use tools.
   ```

   To test the Codex CLI on the same managed Mac, you can instead run the
   following command.

   ```sh
   codex exec 'Reply exactly: AGW-CODEX-VERIFY. Do not use tools.'
   ```

7. Correlate the request by its time. Codex might first send `GET /v1/models`.
   The decisive entry is a successful `POST /v1/responses` with the configured
   gateway hostname, the expected route, and `http.status=200`. The access log
   does not need to contain the prompt text.
8. If no entry appears, check that the task is local, Codex was fully
   restarted, DNS resolves the managed hostname, the HTTPS listener serves a
   trusted certificate for that hostname, and the managed URL uses `https`.
   If the authenticated `curl` request succeeds but Codex returns HTTP 401,
   confirm that `AGENTGATEWAY_API_KEY` is available to the Codex process and
   restart the application. If both requests return HTTP 401, confirm that the
   supplied value matches the virtual key configured on the route.
9. Add a conflicting provider or base URL to the user's `config.toml`, or start
   Codex with a conflicting `--config` value. Restart Codex and confirm that it
   starts with the managed agentgateway values.

Managed defaults apply when Codex starts. A user can change a supported setting
during a running session, but Codex reapplies the managed value at the next
launch. Use `requirements.toml` for supported security constraints and use
gateway or network policy when a control must not depend on a client restart.

### Windows

Codex reads managed defaults from `~/.codex/managed_config.toml` on Windows.
Use an Intune Remediation script package to detect and restore the file. Run
both scripts with the logged-on user's credentials so that `USERPROFILE`
resolves to the intended Codex user.

Create the detection script.

```powershell
$path = Join-Path $env:USERPROFILE ".codex\managed_config.toml"
$expected = @'
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "OpenAI via agentgateway"
base_url = "https://llm.example.com/v1"
wire_api = "responses"
env_key = "AGENTGATEWAY_API_KEY"
'@

if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    Write-Output "Codex managed configuration is missing."
    exit 1
}

$actual = [IO.File]::ReadAllText($path).Replace("`r`n", "`n").TrimEnd()
if ($actual -ne $expected.Replace("`r`n", "`n").TrimEnd()) {
    Write-Output "Codex managed configuration differs from policy."
    exit 1
}

Write-Output "Codex managed configuration matches policy."
exit 0
```

Create the remediation script with the same approved TOML.

```powershell
$directory = Join-Path $env:USERPROFILE ".codex"
$path = Join-Path $directory "managed_config.toml"
$expected = @'
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "OpenAI via agentgateway"
base_url = "https://llm.example.com/v1"
wire_api = "responses"
env_key = "AGENTGATEWAY_API_KEY"
'@

New-Item -ItemType Directory -Path $directory -Force | Out-Null
$encoding = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($path, $expected.TrimEnd() + "`n", $encoding)
Write-Output "Restored the Codex managed configuration."
```

In the Intune admin center, go to **Devices > Manage devices > Scripts and
remediations** and create a script package with these settings.

- Upload the detection and remediation scripts.
- Set **Run this script using the logged-on credentials** to **Yes**.
- Set **Run script in 64-bit PowerShell** to **Yes**.
- Sign the scripts and enable signature enforcement if your organization has a
  code-signing process.
- Assign the package to a pilot group and select an hourly schedule.

Change `managed_config.toml` on a pilot device. At the next evaluation, the
detection script exits with code 1 and Intune runs the remediation script to
restore the approved content.

{{< callout type="info" >}}
Intune Remediations restore the file on their configured schedule. Codex reads
managed defaults at startup, so restart the client after remediation when you
validate a policy change.
{{< /callout >}}

## Manage Claude Code

Claude Code provides [native endpoint-managed
settings](https://code.claude.com/docs/en/settings#settings-files) that users
and projects cannot normally override. Set `ANTHROPIC_BASE_URL` in the managed
`env` object.

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://llm.example.com"
  }
}
```

Deploy the JSON through one of these Intune-compatible policy locations.

- macOS managed preference domain: `com.anthropic.claudecode`.
- Windows machine policy: the `Settings` string value under
  `HKLM\SOFTWARE\Policies\ClaudeCode`.
- Managed file: `/Library/Application Support/ClaudeCode/managed-settings.json`
  on macOS or `C:\Program Files\ClaudeCode\managed-settings.json` on Windows.

Use the machine policy or managed file instead of `~/.claude/settings.json`.
The managed source has higher precedence and is designed for endpoint
management.

## Manage Claude Desktop

{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/claude-desktop-intune.md" >}}

## Manage other clients

The Codex and Claude Desktop sections provide complete rollout examples. The
Claude Code section provides native managed-settings guidance, and the
remaining clients below provide configuration-specific guidance. Pin and test
a client version before you depend on its settings-file format, and update
only the keys that route traffic through agentgateway.

### Cursor

Follow the [Cursor]({{< link-hextra
path="/integrations/llm-clients/cursor/" >}}) guide to enable **Override OpenAI
Base URL**. Seed and audit that setting only after you confirm its on-disk
schema for the Cursor version that Intune deploys. Preserve all unrelated user
settings when a remediation changes the value.

### Devin Desktop

Follow the [Devin Desktop]({{< link-hextra
path="/integrations/llm-clients/devin/" >}}) guide and manage the `http.proxy`
value in the editor settings. Use a user-context script that merges only this
key, because replacing the file can remove unrelated editor settings.

### VS Code Continue

Follow the [VS Code Continue]({{< link-hextra
path="/integrations/llm-clients/continue/" >}}) guide and deploy or merge the
agentgateway model entry in `~/.continue/config.json`. If users can define
other models, identify the managed entry by a stable name and leave the other
array entries unchanged.

### GitHub Copilot

Follow the [GitHub Copilot]({{< link-hextra
path="/integrations/llm-clients/github-copilot/" >}}) guide and manage
`github.copilot.advanced.debug.overrideProxyUrl` in the VS Code user settings.
This workflow requires Copilot Business or Enterprise. Merge the property into
the JSON file instead of replacing the user's complete VS Code configuration.

### OpenAI SDK

Follow the [OpenAI SDK]({{< link-hextra
path="/integrations/llm-clients/openai-sdk/" >}}) guide and set `base_url` for
Python or `baseURL` for JavaScript in organization-owned application
configuration. Intune can deploy a wrapper, environment file, or managed
application, but managing the SDK package alone cannot force application code
to use agentgateway.

### curl

Follow the [curl]({{< link-hextra path="/integrations/llm-clients/curl/" >}})
guide and deploy an organization-owned wrapper command when users need a
convenient request template. The curl executable accepts any URL, so this is
not an enforcement boundary. Use gateway authentication and endpoint network
controls when direct provider access must be blocked.

## Manage MCP server policy

You can use the same endpoint-management channels to control Model Context
Protocol (MCP) servers in supported clients.

- For Codex, deploy `requirements.toml` with an `mcp_servers` allowlist. On
  macOS, encode it in the `requirements_toml_base64` managed preference.
- For Claude Code, deploy `allowedMcpServers`, `deniedMcpServers`, and
  `allowManagedMcpServersOnly` through the native managed settings. Deploy a
  `managed-mcp.json` file when you also need to define the approved servers.
- For Claude Desktop, deploy `managedMcpServers` and set per-tool `toolPolicy`
  values. Set `isLocalDevMcpEnabled` to `false` when users must not add local
  MCP servers, and set `mcpPersistentAlwaysAllowEnabled` to `false` when tool
  approvals must not persist across sessions.

MCP policy controls which tool servers the client can load. It is separate from
the model-provider configuration that routes LLM requests through agentgateway.

## Automate verification with Intune

The complete Codex and Claude Desktop workflows use the example verification
scripts in the agentgateway repository so administrators can check both
clients without asking users to run local commands.

- [macOS shell
  script](https://github.com/agentgateway/agentgateway/blob/main/examples/microsoft-intune/verification/verify-agentgateway-clients-macos.sh)
- [Windows PowerShell
  script](https://github.com/agentgateway/agentgateway/blob/main/examples/microsoft-intune/verification/Verify-AgentgatewayClientsWindows.ps1)
- [Script configuration and deployment
  instructions](https://github.com/agentgateway/agentgateway/tree/main/examples/microsoft-intune)

Before you upload a script, edit its configuration block. Set the approved
Codex URL including `/v1`, and set the approved Claude Desktop URL to match its
route layout. Include a prefix such as `/claude` only when the route matches
and rewrites it. Enable only the clients required for the target group. The
optional installation check recognizes the common paths listed in the script.
Add your organization's package path or disable that check and use the Intune
managed-app report when the approved package uses a different path. Never add
a gateway client key, provider key, bearer token, or another secret.

The scripts perform these checks for every enabled client.

1. Confirm that the application is installed in a recognized location when
   the installation check is enabled.
2. Read the effective managed preference, file, or registry policy and confirm
   the approved agentgateway URL. For Codex, also confirm that the TOML names
   the approved credential environment variable. The scripts do not inspect
   the variable's value or print the configuration.
3. Connect to the approved URL and confirm that it returns an HTTP response. A
   `401` or `403` response passes this connectivity check because it proves
   that DNS, transport, and the protected Gateway listener are reachable.

### Deploy the verification script on macOS

1. In the Intune admin center, go to **Devices > By platform > macOS > Manage
   devices > Scripts > Add** and upload the shell script.
2. Set **Run script as signed-in user** to **Yes**. The effective Codex and
   Claude Desktop settings are user-scoped.
3. Select a frequency, assign the pilot group, and monitor **Device status** or
   **User status**. Exit code `0` reports success; a nonzero exit code reports
   one or more failed checks.

The Mac must have the Microsoft Intune management agent. For prerequisites,
scheduling, and reporting behavior, see [Use shell scripts on macOS devices in
Intune](https://learn.microsoft.com/en-us/intune/device-management/tools/run-shell-scripts-macos).

### Deploy the verification script on Windows

1. In the Intune admin center, go to **Devices > Manage devices > Scripts and
   remediations** and create a script package.
2. Upload the PowerShell script as the detection script. A remediation script
   is optional when the managed client policy already restores configuration.
3. Set **Run this script using the logged-on credentials** and **Run script in
   64-bit PowerShell** to **Yes**.
4. Assign a schedule and the pilot group, and then monitor **Device status**.

You can instead upload the PowerShell file as a [Windows platform
script](https://learn.microsoft.com/en-us/intune/device-management/tools/run-powershell-scripts-windows)
for a one-time check. For recurring checks, review the enrollment, Windows
edition, and licensing requirements for [Intune
Remediations](https://learn.microsoft.com/en-us/intune/device-management/tools/deploy-remediations).

{{< callout type="info" >}}
These operational scripts are not custom compliance discovery scripts. Custom
compliance requires platform-specific discovery output and a matching JSON
rule definition. Use the dedicated artifacts described in [Add compliance
reporting](#add-compliance-reporting).
{{< /callout >}}

The network check does not send an LLM prompt and cannot prove that an
interactive client request used agentgateway. After the script passes, complete
the interactive test in [Verify the deployment](#verify-the-deployment) and
correlate the request with the agentgateway access log.

## Add compliance reporting

Use [custom
compliance](https://learn.microsoft.com/en-us/intune/device-security/compliance/custom-settings)
when access decisions must include the state of a client configuration. Custom
compliance supports enrolled and managed macOS devices, including a BYOD Mac
enrolled through Company Portal. It does not cover an unenrolled or MAM-only
device. On macOS, a Bash discovery script can report a client-specific Boolean
after checking the effective file or managed preference.

The agentgateway examples include independently assignable compliance
artifacts for Codex and Claude Desktop.

| Client | macOS discovery | Windows discovery | Rule JSON | Reported setting |
| --- | --- | --- | --- | --- |
| Codex | [Bash script](https://github.com/agentgateway/agentgateway/blob/main/examples/microsoft-intune/compliance/codex/discover-gateway-macos.sh) | [PowerShell script](https://github.com/agentgateway/agentgateway/blob/main/examples/microsoft-intune/compliance/codex/Discover-GatewayWindows.ps1) | [Rules](https://github.com/agentgateway/agentgateway/blob/main/examples/microsoft-intune/compliance/codex/compliance.json) | `CodexGatewayConfigured` |
| Claude Desktop | [Bash script](https://github.com/agentgateway/agentgateway/blob/main/examples/microsoft-intune/compliance/claude-desktop/discover-gateway-macos.sh) | [PowerShell script](https://github.com/agentgateway/agentgateway/blob/main/examples/microsoft-intune/compliance/claude-desktop/Discover-GatewayWindows.ps1) | [Rules](https://github.com/agentgateway/agentgateway/blob/main/examples/microsoft-intune/compliance/claude-desktop/compliance.json) | `ClaudeDesktopGatewayConfigured` |

These scripts apply the same managed-configuration intent as the operational
verifiers but implement the custom-compliance contract. They return only the
discovered state and never return configuration contents, tokens, prompts, or
credentials. A missing or mismatched configuration is a valid discovered
`false` value and uses exit code `0`. A nonzero exit code is reserved for a
script execution error.

The discovery scripts do not test Gateway reachability. A temporary Gateway or
network outage must not make every managed device noncompliant or unexpectedly
affect Conditional Access.

Before uploading a script, replace its example URL with the approved address.
Include `/v1` for Codex and keep `EXPECTED_CODEX_ENV_KEY` aligned with the
managed TOML. For Claude Desktop, include a route prefix such as `/claude` only
when the `HTTPRoute` matches and rewrites it; use only the origin for a
dedicated hostname that matches `/`. Keep the expected values aligned with the
corresponding managed configuration policy.

Use separate compliance policies and assignments for the two clients. This
prevents a device that requires only one client from being marked noncompliant
because the other client is not configured.

### Add client compliance on macOS

1. Download the macOS discovery script and rule JSON for the required client.
2. In the Intune admin center, go to **Endpoint security > Device compliance >
   Scripts > Add > macOS** and upload the script.
3. The script resolves the signed-in console user and reads both per-user and
   machine managed preferences, so it supports either the default system
   context or logged-in-user context. If Intune displays an execution-context
   setting, either context is supported. Enable signature enforcement when
   your organization signs scripts.
4. Create a macOS compliance policy, add **Custom Compliance**, select the
   discovery script, and upload the custom-compliance rule JSON.
5. Assign the policy to the same pilot group as the client application and
   managed preference policies.

Each macOS discovery script returns one JSON object on a single line. For
example:

```json
{"CodexGatewayConfigured":true}
```

```json
{"ClaudeDesktopGatewayConfigured":true}
```

The setting name is case-sensitive and must match the corresponding
`SettingName` in the rule JSON. The value is a JSON Boolean, not a quoted
string. Each script returns exit code `0` for either discovered value. A
nonzero exit code is reserved for a script execution error.

### Add client compliance on Windows

1. Download the Windows discovery script and rule JSON for the required client.
2. In the Intune admin center, go to **Endpoint security > Device compliance >
   Scripts > Add > Windows** and upload the script.
3. Set **Run this script using the logged on credentials** and **Run script in
   64-bit PowerShell Host** to **Yes**. Enable signature enforcement when your
   organization signs scripts.
4. Create a Windows compliance policy, add **Custom Compliance**, select the
   discovery script, and upload the custom-compliance rule JSON.
5. Assign the policy to the same pilot group as the client application and
   managed configuration policies.

Each Windows discovery script returns one compressed JSON object. For example:

```json
{"CodexGatewayConfigured":true}
```

```json
{"ClaudeDesktopGatewayConfigured":true}
```

Use a grace period during the pilot so that application installation and first
policy evaluation can complete. If access to agentgateway uses an Entra
enterprise application, optionally use the resulting device compliance state
in a Conditional Access policy after the pilot reports the expected results.

Compliance reporting does not repair configuration. Keep the native managed
policy, recurring macOS shell script, or Windows remediation assigned when you
add compliance reporting. A corrected custom setting can take up to eight hours
to appear compliant. On macOS, a user can open Company Portal, select the
device, and select **Check Status** to request an evaluation.

## Verify the deployment

Test each policy on a pilot device before broad assignment. The automated
script verifies the local prerequisites and network path; retain this final
interactive test to prove that the client actually sends inference traffic
through agentgateway.

1. If Intune deploys the client, confirm its installation under **Managed
   apps** or the app installation report. On a personally owned device, do not
   expect an independently installed application under **Discovered apps**.
2. Start the client and send a request.
3. Check that the request appears in the agentgateway proxy logs.

{{< conditional-text include-if="kubernetes" >}}
```sh
kubectl logs deployment/agentgateway-proxy \
  -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --follow \
  --since=5s
```
{{< /conditional-text >}}

{{< conditional-text include-if="standalone" >}}
Review the terminal output from the `agentgateway` process or the logs from the
service that runs agentgateway. Confirm that the request uses the expected
listener, route, and model.
{{< /conditional-text >}}

Start the log stream before sending the client request so that unrelated
traffic is easier to distinguish. Correlate the request by time; access logs do
not need to include prompt text. Confirm the managed hostname, expected route
and API path, upstream provider, and a successful status. No matching entry
indicates a client, DNS, listener, or network problem. An unauthorized response
indicates an authentication problem.

4. For a client managed by a recurring macOS shell script or Windows
   remediation, change the gateway setting, wait for the next script run, and
   confirm that Intune restores the approved value.
5. For a client with native managed policy, test a user-level setting and any
   supported command-line override. Restart the client and confirm that the
   managed value remains effective.
6. Review the applicable Intune device configuration, managed app, macOS shell
   script, or Windows remediation status for failures.

## Limitations

- Intune manages enrolled endpoints. It does not manage cloud-hosted agents,
  continuous integration runners, or unmanaged personal devices.
- A recurring macOS shell-script or Windows remediation interval creates a
  window in which an ordinary user setting can differ from policy.
- Custom compliance is periodic reporting, not continuous enforcement. A
  corrected setting can take up to eight hours to appear compliant.
- A personally owned Mac must remain enrolled and managed for its custom
  compliance policy to run. A user who unenrolls the Mac removes this Intune
  control.
- Local administrators can subvert many endpoint controls. Use agentgateway
  authentication and authorization, and consider network controls that block
  direct access to LLM providers.
- Client configuration formats and supported enterprise settings can change.
  Pin and test an approved client version before updating the Intune package.

## Next steps

Review the client guides that underpin the two complete Intune examples, then
apply the Gateway security controls appropriate for your deployment.

{{< cards >}}
  {{< card path="/integrations/llm-clients/codex" title="Codex" subtitle="Configure and verify Codex with agentgateway" >}}
  {{< card path="/integrations/llm-clients/claude-desktop" title="Claude Desktop" subtitle="Configure and verify Claude Desktop with agentgateway" >}}
{{< conditional-text include-if="kubernetes" >}}
  {{< card path="/security/jwt/" title="JWT authentication" subtitle="Authenticate managed clients at the Gateway" >}}
  {{< card path="/llm/rbac/" title="Authorization" subtitle="Control which identities can use the Gateway" >}}
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
  {{< card path="/configuration/security/jwt-authn/" title="JWT authentication" subtitle="Authenticate managed clients at the Gateway" >}}
  {{< card path="/configuration/security/http-authz/" title="Authorization" subtitle="Control which identities can use the Gateway" >}}
{{< /conditional-text >}}
{{< /cards >}}
