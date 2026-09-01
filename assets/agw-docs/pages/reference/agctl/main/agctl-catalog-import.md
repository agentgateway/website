Import a model catalog

### Synopsis

Import a model catalog.

Examples:
	agctl catalog import > catalog.json
	agctl catalog import --overlay ./catalog/model-catalog-overrides.yaml --out ./catalog/model-catalog.json --pretty
	agctl catalog import --source models.dev --providers anthropic,google,openai

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
      --source string               import source (models.dev) (default "models.dev")
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl catalog](../agctl-catalog/)	 - Manage model catalogs

