Use `--exclude-providers` to omit source provider IDs, including when `--providers` selects a broader set. As with `--providers`, use the IDs expected by each source. Exclusions apply during import; a later overlay can add a provider again.

Use `--overlay` to merge a local YAML catalog after all imported sources. For example, save custom tags in `catalog-overrides.yaml`.

```yaml
providers:
  openai:
    models:
      gpt-4o-mini:
        tags: [team-approved]
```

Then generate a catalog with those overrides.

```sh
agctl catalog import \
  --source models.dev \
  --exclude-providers google \
  --overlay ./catalog-overrides.yaml \
  --pretty --out ./catalog.json
```

The overlay can set rates, tiers, or tags. It is merged into the generated output, which still has `metadata.generatedAt` and is loaded as a base catalog. The `--overlay` flag does not produce a separate runtime overlay. To maintain a runtime overlay independently of imported catalog timestamps, load a catalog without `metadata` as a separate source.
