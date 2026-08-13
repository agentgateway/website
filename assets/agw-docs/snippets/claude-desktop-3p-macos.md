> [!NOTE]
> On macOS, Claude Desktop might not enter third-party inference mode from the settings panel alone. If the app still signs in to Anthropic after you reopen it, set `deploymentMode` to `3p` in the third-party configuration file, then quit and reopen the app again.
>
> ```bash
> python3 - <<'EOF'
> import json, os
> p = os.path.expanduser('~/Library/Application Support/Claude-3p/claude_desktop_config.json')
> d = json.load(open(p))
> d['deploymentMode'] = '3p'
> open(p, 'w').write(json.dumps(d, indent=2))
> EOF
> ```
