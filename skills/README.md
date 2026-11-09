# Agentgateway assistant skills

These folders are the publishing source for the two OSS skills. Enterprise packages are maintained and previewed separately. The skills retrieve current public documentation and inspect the user's actual runtime. There is no gateway compatibility allowlist, dated skill release, authoring date, or manual version bump.

## Distribution

Use `npx skills add agentgateway/website --skill NAME --agent CLIENT` after publication, or replace the repository with an absolute local source directory during review. Default project installation uses the shared skill directory and client links. `npx skills update NAME --project` follows that source. Keep ZIP extraction as the no-Node alternative. Use a current Node.js LTS for the installer.

Current ZIPs live at `static/downloads/agent-skills/current/NAME.zip`. The package and download manifests identify exact contents with SHA-256. Updating content regenerates the current downloads; previous review artifacts remain historical evidence and are not linked as the customer default. Repository or archive installation must include the whole skill folder.

## Generate and check

```sh
python3 scripts/refresh-agent-skill-metadata.py
python3 scripts/package-agent-skills.py
python3 scripts/refresh-agent-skill-metadata.py --check
python3 scripts/package-agent-skills.py --check
python3 -B -m unittest discover -s scripts/tests -v
python3 scripts/check-skill-install.py
```

`skills/catalog.json` lists the distributable skills. `package.json` contains edition, configuration mode, public documentation, file hashes, and a content fingerprint. An optional source commit is provenance, not a runtime requirement. By default, content hashes identify the package without asserting a commit or publication status. Metadata and ZIPs are generated from source without dates or release-number edits. Archive files have mode 0644; invoke the helper with `python3`. The helper needs Python 3.10+; contributor test tooling needs Python 3.11+.

Keep the verification helper and its supporting reference identical across the two OSS packages. Update both copies together. The publishing tree and its generated archives are checked together; do not maintain independent, unsynchronized public copies.

## Acceptance checks

Installer tests use disposable projects and local source fixtures to verify discovery, complete folders, updates reaching both clients, customization backups, and selected removal. They resolve the current installer instead of maintaining a pinned installer release. Actual client checks install the packages through that installer, then invoke each skill with the other skills present:

```sh
python3 scripts/check-skill-client.py --client claude --output out/client-claude
python3 scripts/check-skill-client.py --client codex --output out/client-codex
```

These checks use existing client authentication and can incur normal assistant charges. They disable MCP servers and hooks and constrain work to a read-only fixture. They verify identity/reference loading, provider setup handoffs, ownership, mode conflicts, and accurate unverified-status reporting. They do not certify a live provider, cluster, license, budget, or UI.

PR CI runs package, helper and installer checks without model credentials. The optional client acceptance job requires a separately configured trusted runner with authenticated clients. Customer skills never require that runner or internal Solo systems. Run broader scenario checks for important behavior changes, not every gateway release.

For maintenance automation, use stable documentation discovery URLs and validate actual runtime capabilities during the task. Automated checks should surface broken source discovery, invalid package contents, behavioral regressions and changed product boundaries. A new product tag alone is not a reason to rewrite or bump a skill.
