package main

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestObjectUnionLocations(t *testing.T) {
	for _, union := range []string{"oneOf", "anyOf"} {
		t.Run(union, func(t *testing.T) {
			var doc yaml.Node
			err := yaml.Unmarshal([]byte(`type: object
properties:
  location:
    description: Credential location
    anyOf:
      - $ref: '#/$defs/Location'
      - type: 'null'
$defs:
  Location:
    UNION:
      - type: object
        description: Read a header
        required: [header]
        properties:
          header:
            type: object
            required: [name]
            properties:
              name: {type: string}
              prefix: {type: string}
      - type: object
        description: Read a query parameter
        required: [queryParameter]
        properties:
          queryParameter:
            type: object
            required: [name]
            properties:
              name: {type: string}
      - type: object
        required: [cookie]
        properties:
          cookie: {type: string}
      - type: object
        required: [expression]
        properties:
          expression: {type: string}
`), &doc)
			if err != nil {
				t.Fatal(err)
			}
			root := doc.Content[0]
			// Switch the inner union while retaining the nullable outer anyOf.
			defs := getNode(decodeMapping(root), "$defs")
			location := getNode(decodeMapping(defs), "Location")
			location.Content[0].Value = union
			pm := toPropertyMapWithResolver(root, nil, &schemaResolver{root: root}, nil)
			loc := pm.props["location"]
			if loc.description != "Credential location" {
				t.Fatalf("description: %q", loc.description)
			}
			if loc.definition == nil || strings.Join(loc.definition.keys, ",") != "header,queryParameter,cookie,expression" {
				t.Fatalf("missing union variants: %+v", loc.definition)
			}
			for name, prop := range loc.definition.props {
				if prop.required {
					t.Errorf("alternative %s marked required", name)
				}
			}
			header := loc.definition.props["header"]
			if header.description != "Read a header" || !header.definition.props["name"].required || header.definition.props["prefix"].required {
				t.Fatalf("lost variant metadata: %+v", header)
			}
			html := renderWidget("Configuration schema", "", "", "Schema", pm, "test", nil)
			for _, name := range []string{"header.name", "queryParameter.name", "cookie", "expression"} {
				if !strings.Contains(html, `data-ks-path="location.`+name+`"`) {
					t.Errorf("missing rendered path %s", name)
				}
			}
		})
	}
}

// The whole row is the disclosure control, so a field with children must carry
// the target on its row line as well as on its type badge, and neither may
// render as already open. Rows without children must carry no target at all,
// or clicking them would try to open nothing.
func TestRowDisclosure(t *testing.T) {
	var doc yaml.Node
	err := yaml.Unmarshal([]byte(`type: object
required: [spec]
properties:
  name:
    type: string
  spec:
    type: object
    properties:
      replicas: {type: integer}
`), &doc)
	if err != nil {
		t.Fatal(err)
	}
	root := doc.Content[0]
	pm := toPropertyMapWithResolver(root, nil, &schemaResolver{root: root}, nil)
	html := renderWidget("Configuration schema", "", "", "Schema", pm, "test", nil)

	for _, want := range []string{
		// The row line opens the same container the badge does.
		`<div class="ks-row-line" id="test-node-1" data-ks-node-id="test-node-1" data-ks-path="spec" data-ks-children-target="test-node-1-children">`,
		`<button type="button" class="ks-type-toggle is-clickable" data-ks-children-target="test-node-1-children" aria-controls="test-node-1-children" aria-expanded="false">`,
	} {
		if !strings.Contains(html, want) {
			t.Errorf("missing markup: %s", want)
		}
	}

	// A leaf row must stay inert: no target, so the click only selects.
	if !strings.Contains(html, `<div class="ks-row-line" id="test-node-0" data-ks-node-id="test-node-0" data-ks-path="name">`) {
		t.Error("leaf row line gained a children target")
	}

	// No glyph column: this change deliberately adds no visual affordance.
	for _, unwanted := range []string{"ks-expander", "ks-expander-spacer"} {
		if strings.Contains(html, unwanted) {
			t.Errorf("unexpected %s in output", unwanted)
		}
	}

	// Collapsed is the initial state, checked against the tree markup alone,
	// since the stylesheet and script carry these literals for their own reasons.
	markup := html
	if i := strings.Index(markup, "</style>"); i >= 0 {
		markup = markup[i:]
	}
	if i := strings.Index(markup, "<script"); i >= 0 {
		markup = markup[:i]
	}
	if strings.Contains(markup, `aria-expanded="true"`) {
		t.Error("a row rendered as already expanded")
	}
}

// A union variant that is not an object, and a property restated by more than
// one variant, both used to abandon the merge and cost the reader every
// alternative but one. `backendAuth` has both, which is how a field with ten
// alternatives rendered only `key`.
func TestUnionVariantsSurvive(t *testing.T) {
	parse := func(t *testing.T, src string) *propertyMap {
		t.Helper()
		var doc yaml.Node
		if err := yaml.Unmarshal([]byte(src), &doc); err != nil {
			t.Fatal(err)
		}
		root := doc.Content[0]
		return toPropertyMapWithResolver(root, nil, &schemaResolver{root: root}, nil)
	}
	keys := func(t *testing.T, pm *propertyMap) string {
		t.Helper()
		auth := pm.props["auth"]
		if auth.definition == nil {
			t.Fatal("auth has no definition")
		}
		return strings.Join(auth.definition.keys, ",")
	}

	// A serde unit variant serializes as the bare tag (`auth: copilot`), so its
	// schema is a scalar with a const. It is an alternative like any other.
	t.Run("unit variant becomes a named leaf", func(t *testing.T) {
		pm := parse(t, `type: object
properties:
  auth: {$ref: '#/$defs/Auth'}
$defs:
  Auth:
    oneOf:
      - type: object
        required: [key]
        properties: {key: {type: string}}
      - type: string
        const: copilot
        description: Authenticate to GitHub Copilot.
      - type: object
        required: [jwtSign]
        properties: {jwtSign: {type: object, properties: {alg: {type: string}}}}
`)
		if got := keys(t, pm); got != "key,copilot,jwtSign" {
			t.Fatalf("variants = %q, want key,copilot,jwtSign", got)
		}
		copilot := pm.props["auth"].definition.props["copilot"]
		if copilot.description != "Authenticate to GitHub Copilot." {
			t.Errorf("unit variant lost its description: %q", copilot.description)
		}
		html := renderWidget("Configuration schema", "", "", "Schema", pm, "test", nil)
		for _, want := range []string{"auth.key", "auth.copilot", "auth.jwtSign"} {
			if !strings.Contains(html, `data-ks-path="`+want+`"`) {
				t.Errorf("missing rendered path %s", want)
			}
		}
	})

	// A compat wrapper restates one property across variants. Identical
	// restatements are not ambiguous, so they must not cost the other variants.
	t.Run("identical repeat collapses", func(t *testing.T) {
		pm := parse(t, `type: object
properties:
  auth: {$ref: '#/$defs/Auth'}
$defs:
  Auth:
    anyOf:
      - type: object
        required: [key]
        properties: {key: {type: string}}
      - type: object
        required: [credentials]
        properties: {credentials: {type: array, items: {type: string}}}
      - type: object
        required: [credentials]
        properties: {credentials: {type: array, items: {type: string}}}
`)
		if got := keys(t, pm); got != "key,credentials" {
			t.Fatalf("variants = %q, want key,credentials", got)
		}
	})

	// A repeat that genuinely disagrees is a naming clash, not a reason to drop
	// the other variants: the fuller schema wins the name and the rest survive.
	// This is `backendAuth`, where the legacy `key: <value>` shorthand meets the
	// canonical `key: {value, location}`.
	t.Run("conflicting repeat keeps the fuller schema", func(t *testing.T) {
		pm := parse(t, `type: object
properties:
  auth: {$ref: '#/$defs/Auth'}
$defs:
  Auth:
    anyOf:
      - type: object
        required: [key]
        properties: {key: {type: string}}
      - type: object
        required: [key]
        properties:
          key:
            type: object
            properties:
              value: {type: string}
              location: {type: string}
      - type: object
        required: [jwtSign]
        properties: {jwtSign: {type: object, properties: {alg: {type: string}}}}
`)
		if got := keys(t, pm); got != "key,jwtSign" {
			t.Fatalf("variants = %q, want key,jwtSign", got)
		}
		key := pm.props["auth"].definition.props["key"]
		if key.definition == nil || strings.Join(key.definition.keys, ",") != "value,location" {
			t.Fatalf("clash kept the thinner schema: %+v", key.definition)
		}
	})

	// The remaining guard: a scalar with no const names nothing, so there is no
	// row to merge it into and the single-variant fallback still applies.
	t.Run("const-less scalar falls back", func(t *testing.T) {
		pm := parse(t, `type: object
properties:
  auth: {$ref: '#/$defs/Auth'}
$defs:
  Auth:
    oneOf:
      - type: string
      - type: object
        required: [key]
        properties: {key: {type: string}}
      - type: object
        required: [jwtSign]
        properties: {jwtSign: {type: string}}
`)
		if got := keys(t, pm); got != "key" {
			t.Fatalf("variants = %q, want the fallback's single variant", got)
		}
	})
}
