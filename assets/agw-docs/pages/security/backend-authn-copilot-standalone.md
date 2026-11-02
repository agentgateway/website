## About

The `copilot` backend authentication method sends a GitHub Copilot token and the request headers that the Copilot API expects. Agentgateway finds the token itself, from an environment variable or from the configuration that the GitHub Copilot tools and the GitHub CLI already wrote to disk, so no credential appears in the configuration file.

{{% version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" %}}
> [!IMPORTANT]
> The `copilot` method is available in the standalone binary only. The method reads its token from the environment of the agentgateway process, which has no Kubernetes equivalent, so the field does not exist in the custom resources.
{{% /version %}}

## Configuration example

The `copilot` method takes no settings. Write the method name on its own, as a string rather than a map.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: api.githubcopilot.com:443
    policies:
      backendAuth: copilot
```

> [!WARNING]
> Write `backendAuth: copilot`, not `backendAuth: {copilot: {}}`. The method is the only one that is a bare string, and the map form is rejected when the configuration loads.
>
> ```
> Error: routes[0]: data did not match any variant of untagged enum BackendAuthCompat
> ```

## Where agentgateway finds the token

Agentgateway tries the following sources in order and stops at the first one that yields a token.

1. The `GH_COPILOT_TOKEN` environment variable.
2. The `COPILOT_GITHUB_TOKEN` environment variable.
3. The `github-copilot/hosts.json` file in your configuration directory, then `github-copilot/apps.json`. The GitHub Copilot editor extensions write these files.
4. The `gh/hosts.yml` file in your configuration directory. The [GitHub CLI](https://cli.github.com/) writes this file when you run `gh auth login`.

The configuration directory is `$XDG_CONFIG_HOME` when that variable is set. Otherwise it is `%APPDATA%` on Windows and `$HOME/.config` everywhere else. Agentgateway reads the `github.com` entry from each file, so a token for a GitHub Enterprise host is not used.

In practice this means that a workstation where you already use GitHub Copilot or the GitHub CLI needs no extra setup. Set `GH_COPILOT_TOKEN` when you run agentgateway somewhere that has neither, such as a container.

```sh
export GH_COPILOT_TOKEN="<your-token>"
agentgateway -f config.yaml
```

> [!NOTE]
> Agentgateway does not cache a token that it read from a file, because the GitHub tools rotate those tokens on their own. Agentgateway reads the file again on each request, so a rotation is picked up without a restart.

## What agentgateway sends

The method writes the token to the `Authorization` header, and adds the headers that identify the caller to the Copilot API.

| Header | Value |
| -- | -- |
| `authorization` | `Bearer` followed by the token. |
| `content-type` | `application/json`. |
| `editor-version` | `agentgateway/` followed by the version of the binary. |
| `x-github-api-version` | The Copilot API version that this release targets. |
| `x-initiator` | `agent`. |
| `x-interaction-type` | `conversation-agent`. |
| `openai-intent` | `conversation-agent`. |

> [!WARNING]
> The method sets `content-type` to `application/json` on every request, and it overwrites the value that the client sent. Do not use the method on a route that carries a body of another type.

## Troubleshoot

The method needs no token to load a configuration, so `--validate-only` passes on a host with no token available. A missing token surfaces on the first request instead, as a `500`.

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
```
backend authentication failed: Copilot token not found; set GH_COPILOT_TOKEN or authenticate with GitHub Copilot/GitHub CLI
```
{{< /version >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
```
backend authentication failed
```

The agentgateway logs record the cause, such as `Copilot token not found; set GH_COPILOT_TOKEN or authenticate with GitHub Copilot/GitHub CLI`.
{{< /version >}}

| Symptom | Cause |
| -- | -- |
| `Copilot token not found` in the response or the agentgateway logs | None of the four sources yielded a token. Set `GH_COPILOT_TOKEN`, or run `gh auth login`. In a container, check that `HOME` or `XDG_CONFIG_HOME` points at the directory that holds the mounted configuration. |
| `data did not match any variant of untagged enum BackendAuthCompat` | The configuration uses the map form. Write `backendAuth: copilot`. |
| The backend rejects the token, although agentgateway found one. | The token belongs to an account with no Copilot subscription, or it came from a `gh` login with too few scopes. Confirm the token separately before you debug the route. |
| The upstream rejects the request body. | The method overwrote `content-type` with `application/json`. |
