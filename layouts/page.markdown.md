{{- $md := partial "page-to-markdown.html" . -}}
> For the complete documentation index, see [llms.txt](/docs/llms.txt). Markdown versions of all docs pages are available by appending .md to any docs URL.

# {{ .Title | replaceRE "\n" " " }}

{{ $md }}
