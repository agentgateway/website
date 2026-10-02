Import a model catalog

### Synopsis

Import a model catalog.

Multiple sources are merged in order, so later sources overlay earlier ones (e.g. models.dev
supplies pricing and aws-bedrock-mantle overlays Bedrock endpoint tags onto it).

Examples:
	agctl catalog import --out ./costs/catalog.json
	agctl catalog import --source models.dev --providers anthropic,google,openai
	agctl catalog import --source models.dev,aws-bedrock-mantle --overlay ./catalog/model-catalog-overrides.yaml --out ./catalog/model-catalog.json --pretty

```
agctl catalog import [flags]
```

### Options

```
      --exclude-providers strings   source provider ids to omit
  -h, --help                        help for import
      --legacy                      include deprecated models
  -o, --out string                  output catalog path (default: stdout)
      --overlay string              YAML catalog to merge over imported data
      --pretty                      pretty-print the output JSON
      --providers strings           source provider ids to import (default: every provider the proxy supports)
      --source strings              import sources to merge, in order (aws-bedrock-mantle, github, models.dev) (default [models.dev,aws-bedrock-mantle])
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl catalog](../agctl-catalog/)	 - Manage model catalogs

