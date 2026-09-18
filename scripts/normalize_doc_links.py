#!/usr/bin/env python3
"""
Rewrite stale agentgateway.dev doc URLs in generated reference docs.

WHY THIS EXISTS. The reference docs for a released version are generated from that
version's git TAG, so their links are frozen at whatever the chart comments said on
release day. A link fix that lands in agentgateway main after the tag was cut cannot
reach the generated docs until the NEXT release, and the nightly regeneration undoes
any hand-edit made to the generated file in the meantime.

Concretely: v1.5.0's values.yaml points discoveryNamespaceSelectors at
/docs/kubernetes/latest/install/advanced/. The docs moved that page under
documentation/ afterwards, and agentgateway#3427 repointed the comment, but v1.5.0 is
frozen, so every nightly run reintroduced the old URL.

WHAT IT DOES. Resolves every agentgateway.dev URL in the generated markdown against
this repo's own record of where pages have moved, so a link that only survived via a
runtime redirect is written out already pointing at its current home.

THE SITE MOVES PAGES TWO DIFFERENT WAYS, AND BOTH HAVE TO BE READ.

  1. static/_redirects, served by Cloudflare as a 301.
  2. Hugo `aliases:` front matter, which builds a stub page at the old path. That stub
     is served as a 200 carrying a <meta http-equiv=refresh>, NOT as a 301.

Neither is a superset of the other, and the second is currently the larger of the two:
at the time of writing, _redirects holds ~55 site-relative rules while content/docs holds
~115 alias entries. Reading only _redirects would silently miss the majority of moves,
and because an alias answers 200, nothing else reports them either: a link checker sees
a healthy page, so the staleness is invisible from every direction.

_redirects also cannot simply absorb the aliases. The Cloudflare Pages project applies
only the first ~100 rules in that file and silently drops the rest, with no build warning,
so it is a capped resource that a bulk page move cannot be parked in. That cap is why the
site reaches for aliases in the first place.

So load_rules() reads _redirects and load_alias_rules() sweeps the content tree, and
callers concatenate them (see all_rules()). Redirects go first, mirroring the runtime
order: Cloudflare answers before Hugo's stub is ever fetched.

Matching follows Cloudflare Pages: rules are tried in file order, first match wins, a
:placeholder matches exactly one path segment, and a trailing * matches the rest
(possibly empty). Rules whose target is not a site-relative path are skipped, so the
off-site rules (/install, /examples/*, and friends) can never pull a docs link out to
raw.githubusercontent.com.

VERSION RETARGETING (--version). Separately from the path fix above, these URLs hardcode
"latest" because the chart comments they come from do. That sends a reader of the frozen
1.5.x Helm reference to the CURRENT release's docs. retarget_version rewrites the version
segment to the version being generated, but only when that content tree exists: a numbered
snapshot is frozen at release and its tree is not created until the version is archived, so
rewriting unconditionally would 404 for the whole window in between.

Usage:
  # as a library, from generate-ref-docs.py
  from normalize_doc_links import all_rules, normalize_text, retarget_version

  # see exactly what rule set a run will use, redirects and aliases together
  python3 scripts/normalize_doc_links.py --dump-rules

  # standalone, to repair already-frozen files in place
  python3 scripts/normalize_doc_links.py assets/agw-docs/pages/reference/helm/1.5.x/*.md

  # same, and point the links at that version's own docs (run this when a version
  # is archived and content/docs/<section>/<version>/ comes into existence)
  python3 scripts/normalize_doc_links.py --version 1.5.x \
      assets/agw-docs/pages/reference/helm/1.5.x/*.md
"""

import functools
import os
import re
import sys

SITE = "https://agentgateway.dev"

# Generated markdown puts these URLs inside table cells and mid-sentence, so the match
# has to stop before the surrounding punctuation: the cell delimiter, the literal <br/>
# the generator injects, a closing paren from markdown link syntax, and a quote. The
# sentence-ending period is stripped separately, since a period is legal inside a URL.
_URL_RE = re.compile(r"https://agentgateway\.dev(/[^\s<>|\"')\]]*)")

# A trailing * makes the rule a splat rule; :name matches exactly one path segment.
_PLACEHOLDER_RE = re.compile(r":([a-zA-Z_][a-zA-Z0-9_]*)")

# A rewritten URL can match a later rule, so re-apply until it settles. The cap turns a
# cycle in _redirects into a loud failure instead of a hang.
_MAX_HOPS = 10


def load_rules(redirects_path):
    """Parse _redirects into [(from, to), ...] in file order, site-relative targets only."""
    rules = []
    with open(redirects_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            source, target = parts[0], parts[1]
            # Off-site targets (raw.githubusercontent.com and friends) are downloads, not
            # doc pages. Rewriting a doc link into one would be worse than leaving it stale.
            if not target.startswith("/"):
                continue
            rules.append((source, target))
    return rules


# --------------------------------------------------------------------------------------
# Hugo aliases
#
# An `aliases:` entry in a page's front matter lists OLD paths that should land on THAT
# page, so each entry becomes a rule pointing alias -> the declaring page's own URL. The
# direction is the opposite of how the front matter reads, which is easy to get backwards.
# --------------------------------------------------------------------------------------

# Already a dependency of this scripts/ directory; extract_rendered_yaml.py imports it and
# runs from the same workflow on the same interpreter, so this adds nothing to install.
import yaml as _yaml

_FRONT_MATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?(?:\n|\Z)", re.S)

# /docs/<section>/<version>/... is the shape every versioned doc URL has. Used to check an
# alias against the tree that declares it.
_TREE_RE = re.compile(r"^/docs/(?P<section>[^/]+)/(?P<version>[^/]+)(?=/|$)")


def _front_matter(path):
    """Return a page's front matter as a dict, or None when it has none or is malformed."""
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except (UnicodeDecodeError, OSError):
        return None
    match = _FRONT_MATTER_RE.match(text)
    if not match:
        return None
    try:
        data = _yaml.safe_load(match.group(1))
    except _yaml.YAMLError:
        return None
    return data if isinstance(data, dict) else None


def _page_url(content_root, path, front_matter):
    """The site path a content file is published at, as Hugo would compute it.

    An explicit `url:` wins outright, which matters here: several inference pages set one,
    and deriving from the file path instead would point their aliases at a URL that does
    not exist.
    """
    explicit = front_matter.get("url")
    if isinstance(explicit, str) and explicit.startswith("/"):
        return _with_slash(explicit)

    # relpath is taken from content/, which already includes the leading "docs" segment,
    # so the site path is that relative path verbatim. Prepending "docs" again yields
    # /docs/docs/... and quietly poisons every downstream check.
    rel = os.path.relpath(path, content_root).replace(os.sep, "/")
    rel = rel[: -len(".md")] if rel.endswith(".md") else rel

    parts = [p for p in rel.split("/") if p]
    if parts and parts[-1] == "_index":
        parts.pop()
    elif parts:
        slug = front_matter.get("slug")
        if isinstance(slug, str) and slug:
            parts[-1] = slug

    return _with_slash("/" + "/".join(parts)) if parts else "/"


def _with_slash(path):
    """Hugo publishes directory-style URLs, so every page path ends in exactly one slash."""
    return path if path.endswith("/") else path + "/"


def load_alias_rules(website_dir, on_skip=None):
    """Sweep content/docs for `aliases:` front matter and return [(from, to), ...].

    Three classes of alias are deliberately dropped rather than turned into rules,
    because each one would let the rewriter emit a URL that is wrong or unstable. Every
    drop is reported through on_skip, so nothing disappears quietly.

      NOT SITE-ABSOLUTE. `vllm` and `windsurf` are declared without a leading slash.
      Hugo resolves those somewhere, but not somewhere this script can predict, and a
      guess would be baked into a released artifact.

      CLAIMED BY MORE THAN ONE PAGE. 14 alias paths are declared by two or more pages,
      `windsurf` by eleven of them. At build time whichever page is written last wins, so
      the live target is not knowable from the source; picking one here would be inventing
      an answer. (These are worth fixing in the content, separately from this script.)

      CROSS-TREE. content/docs/kubernetes/1.4.x/.../inference/_index.md declares an alias
      under /docs/kubernetes/latest/. Honouring that would rewrite a `latest` link to point
      into a frozen 1.4.x page, which is strictly worse than leaving it alone.
    """
    content_root = os.path.join(website_dir, "content")
    docs_root = os.path.join(content_root, "docs")
    if not os.path.isdir(docs_root):
        return []

    claims = {}
    for dirpath, _, filenames in os.walk(docs_root):
        for filename in sorted(filenames):
            if not filename.endswith(".md"):
                continue
            path = os.path.join(dirpath, filename)
            front_matter = _front_matter(path)
            if not front_matter:
                continue
            aliases = front_matter.get("aliases")
            if not isinstance(aliases, list):
                continue

            target = _page_url(content_root, path, front_matter)
            for alias in aliases:
                if not isinstance(alias, str) or not alias.strip():
                    continue
                claims.setdefault(_with_slash(alias.strip()), []).append((path, target))

    rules = []
    for alias, sources in sorted(claims.items()):
        if not alias.startswith("/"):
            _report(on_skip, alias, "not site-absolute", sources)
            continue
        if len({t for _, t in sources}) > 1:
            _report(on_skip, alias, f"claimed by {len(sources)} pages", sources)
            continue

        path, target = sources[0]
        if alias == target:
            continue

        # An alias is a literal path, but rule sources are read as Cloudflare patterns, so
        # a ":" or "*" in one would silently become a placeholder or a splat and match far
        # more than it should. No current alias contains either; drop any that ever does
        # rather than let it match broadly.
        if ":" in alias or "*" in alias:
            _report(on_skip, alias, "contains pattern syntax", sources)
            continue

        alias_tree = _TREE_RE.match(alias)
        target_tree = _TREE_RE.match(target)
        if alias_tree and target_tree and alias_tree.groups() != target_tree.groups():
            _report(on_skip, alias, f"declared by a {target_tree.group('version')} page", sources)
            continue

        rules.append((alias, target))

    return rules


def _report(on_skip, alias, reason, sources):
    if on_skip:
        on_skip(alias, reason, [p for p, _ in sources])


# --------------------------------------------------------------------------------------
# {{< redirect >}} stub pages
#
# The third way this site moves a page: a real page is left at the old path whose entire
# body is a redirect shortcode. It renders a <script> plus a <noscript> meta refresh, so
# like an alias it is served as a 200.
#
# It is not interchangeable with an alias. A real page always beats a conflicting
# `aliases:` entry and Hugo warns about neither, so the two trees genuinely use different
# mechanisms for the same move and both have to be read.
# --------------------------------------------------------------------------------------

_STUB_RE = re.compile(r"\{\{<\s*redirect\s+(?P<args>[^>]*?)\s*>\s*\}\}")
_STUB_ARG_RE = re.compile(r"""(?:(?P<key>url|path)\s*=\s*)?["'](?P<value>[^"']+)["']""")


def _stub_target(args, page_url):
    """Resolve one redirect shortcode's arguments to a site path.

    Mirrors layouts/_shortcodes/redirect.html: `url` (or the positional argument) is used
    as-is, while `path` is version-relative and gets the page's own /docs/<section>/<version>
    root prefixed onto it.
    """
    url = path = None
    for match in _STUB_ARG_RE.finditer(args):
        key, value = match.group("key"), match.group("value")
        if key == "path":
            path = value
        elif key == "url" or key is None:
            url = url or value

    if path is not None:
        root = _TREE_RE.match(page_url)
        if not root:
            return None
        resolved = f"{root.group(0)}/{path.lstrip('/')}"
        resolved = re.sub(r"/{2,}", "/", resolved)
        return _with_slash(resolved)

    return url if url and url.startswith("/") else None


def load_stub_rules(website_dir, on_skip=None):
    """Sweep content/docs for {{< redirect >}} stub pages and return [(from, to), ...]."""
    content_root = os.path.join(website_dir, "content")
    docs_root = os.path.join(content_root, "docs")
    if not os.path.isdir(docs_root):
        return []

    rules = []
    for dirpath, _, filenames in os.walk(docs_root):
        for filename in sorted(filenames):
            if not filename.endswith(".md"):
                continue
            path = os.path.join(dirpath, filename)
            try:
                with open(path, encoding="utf-8") as f:
                    text = f.read()
            except (UnicodeDecodeError, OSError):
                continue
            match = _STUB_RE.search(text)
            if not match:
                continue

            front_matter = _front_matter(path) or {}
            page_url = _page_url(content_root, path, front_matter)
            target = _stub_target(match.group("args"), page_url)
            if not target:
                if on_skip:
                    on_skip(page_url, "unresolvable redirect shortcode", [path])
                continue
            if target.rstrip("/") == page_url.rstrip("/"):
                continue
            if ":" in page_url or "*" in page_url:
                continue
            rules.append((page_url, target))

    return sorted(set(rules))


def known_page_urls(website_dir):
    """Every /docs/ URL this repo actually publishes a page at.

    WHY. Resolving faithfully is not the same as resolving usefully. A _redirects splat can
    land on a path that has no page: /docs/standalone/latest/llm/providers/openai-compatible/
    follows a rule to .../integrations/llm/providers/openai-compatible/, which is a 404 on
    the live site today, because the page is custom.md and openai-compatible is only one of
    its aliases. Reproducing that faithfully would bake a dead link into a released artifact.

    Working from the content tree instead of the live site is what makes this checkable at
    all, so it is worth spending: a rewrite whose target does not exist is not applied.
    """
    content_root = os.path.join(website_dir, "content")
    docs_root = os.path.join(content_root, "docs")
    urls = set()
    if not os.path.isdir(docs_root):
        return urls
    for dirpath, _, filenames in os.walk(docs_root):
        for filename in filenames:
            if not filename.endswith(".md"):
                continue
            path = os.path.join(dirpath, filename)
            urls.add(_page_url(content_root, path, _front_matter(path) or {}))
    return urls


def make_target_check(website_dir):
    """A predicate for normalize_text: does this resolved path have a page behind it?

    Only /docs/ paths are judged. Everything else on the site is outside the content tree,
    so there is nothing here to check it against and it is accepted unchanged.
    """
    published = known_page_urls(website_dir)
    if not published:
        return lambda path: True

    def exists(path):
        if not path.startswith("/docs/"):
            return True
        return _with_slash(path) in published

    return exists


def all_rules(website_dir, use_aliases=True, on_skip=None):
    """The full rule set: static/_redirects, then aliases, then redirect-shortcode stubs.

    Redirects lead because that is the runtime order: Cloudflare answers a 301 before Hugo
    ever serves the page that would bounce the reader onward. The two page-level mechanisms
    follow, and resolve() chains through all three, which is what the live site does when a
    _redirects rule lands on an alias that lands on a stub.
    """
    redirects_path = os.path.join(website_dir, "static", "_redirects")
    rules = load_rules(redirects_path) if os.path.isfile(redirects_path) else []
    if use_aliases:
        rules += load_alias_rules(website_dir, on_skip=on_skip)
        rules += load_stub_rules(website_dir, on_skip=on_skip)
    return rules


@functools.lru_cache(maxsize=None)
def _rule_regex(source):
    """Build a match pattern for one rule source, mirroring Cloudflare's semantics.

    Cached because the rule set is now ~150 rules (redirects plus the alias sweep) and
    _apply walks all of them for every URL, on every hop, in every file.
    """
    splat = source.endswith("*")
    body = source[:-1] if splat else source

    pattern = ""
    pos = 0
    for match in _PLACEHOLDER_RE.finditer(body):
        pattern += re.escape(body[pos:match.start()])
        # A placeholder is one segment, so it cannot span a slash.
        pattern += f"(?P<{match.group(1)}>[^/]+)"
        pos = match.end()
    pattern += re.escape(body[pos:])
    # An empty splat is a match: /install* covers /install itself.
    pattern += "(?P<splat>.*)" if splat else ""
    return re.compile("^" + pattern + "$")


def _apply(path, rules):
    """Return path rewritten by the first matching rule, or None if nothing matches."""
    for source, target in rules:
        match = _rule_regex(source).match(path)
        if not match:
            continue
        groups = match.groupdict()
        result = target
        # Longest name first, so :section never eats the leading characters of a longer
        # placeholder name that happens to share its prefix.
        for name in sorted(groups, key=len, reverse=True):
            if name == "splat":
                continue
            result = result.replace(f":{name}", groups[name])
        result = result.replace(":splat", groups.get("splat", "") or "")
        return result
    return None


def resolve(path, rules):
    """Follow the redirect chain for one path until it stops moving."""
    seen = {path}
    current = path
    for _ in range(_MAX_HOPS):
        nxt = _apply(current, rules)
        if nxt is None or nxt == current:
            return current
        if nxt in seen:
            raise ValueError(f"redirect cycle reached from {path}")
        seen.add(nxt)
        current = nxt
    raise ValueError(f"redirect chain from {path} exceeded {_MAX_HOPS} hops")


def normalize_text(text, rules, on_rewrite=None, on_error=None, target_exists=None):
    """Rewrite every agentgateway.dev URL in text through the redirect rules.

    on_rewrite, when given, is called with (before, after) for each change, so the caller
    can surface it. A rewrite means the generated source shipped a URL that only worked
    via a redirect, which is usually a stale link upstream and worth seeing in the log.

    A cycle affects one URL, so it is reported through on_error and that URL is left as it
    was, rather than aborting the run. Redirects and aliases are maintained separately and
    can disagree, so a loop between them is a content bug to fix, not a reason to fail a
    nightly regeneration and leave every other link stale.
    """
    def replace(match):
        url = match.group(0)
        # A period or comma at the end is the sentence, not the URL. Peel it off, rewrite
        # the rest, and put it back.
        trailing = ""
        while url and url[-1] in ".,;:":
            trailing = url[-1] + trailing
            url = url[:-1]

        path = url[len(SITE):]
        # The fragment and query never reach the redirect engine, so they ride along.
        anchor = ""
        for sep in ("#", "?"):
            idx = path.find(sep)
            if idx != -1:
                anchor = path[idx:] + anchor
                path = path[:idx]

        try:
            resolved = resolve(path, rules)
        except ValueError as e:
            if on_error:
                on_error(url, str(e))
            return url + trailing
        if resolved == path:
            return url + trailing

        # The rules said where this goes, but the content tree gets a veto. Emitting a
        # target with no page behind it would turn a link that at least redirected into a
        # hard 404 in a file nobody regenerates.
        if target_exists and not target_exists(resolved):
            if on_error:
                on_error(url, f"resolves to {resolved}, which has no page; left alone")
            return url + trailing

        after = SITE + resolved + anchor
        if on_rewrite:
            # url still carries the anchor, so report it as-is rather than re-appending.
            on_rewrite(url, after)
        return after + trailing

    return _URL_RE.sub(replace, text)


# Doc URLs carry the version they point at: /docs/<section>/<version>/<rest>.
_DOC_URL_RE = re.compile(
    re.escape(SITE) + r"/docs/(?P<section>kubernetes|standalone)/(?P<version>[^/\s]+)(?P<rest>/[^\s<>|\"')\]]*)?"
)


def version_tree_exists(section, version, website_dir):
    """True when content/docs/<section>/<version>/ is a real tree on the site."""
    return os.path.isdir(os.path.join(website_dir, "content", "docs", section, version))


def retarget_version(text, version, website_dir, on_rewrite=None, on_skip=None):
    """Point doc URLs at the version being generated instead of whatever they hardcode.

    WHY. The chart comments these URLs come from hardcode "latest", so every generated
    artifact links to latest no matter which version it documents. A reader on the frozen
    1.5.x Helm reference gets sent to the current release's docs, which may describe
    different behaviour than the values they are reading.

    SAFETY. A version is only substituted when content/docs/<section>/<version>/ exists.
    A numbered snapshot is frozen at release but its content tree is not created until the
    version is archived, so rewriting unconditionally would turn a working link into a 404
    for the whole window in between. Skips are reported rather than silently dropped.
    """
    def replace(match):
        section = match.group("section")
        current = match.group("version")
        rest = match.group("rest") or ""
        if current == version:
            return match.group(0)
        if not version_tree_exists(section, version, website_dir):
            if on_skip:
                on_skip(section, version, match.group(0))
            return match.group(0)
        after = f"{SITE}/docs/{section}/{version}{rest}"
        if on_rewrite:
            # rest runs to the end of the URL-ish run, which in prose swallows the
            # sentence's full stop. Both sides keep it, so only the log needs trimming.
            trim = len(rest) - len(rest.rstrip(".,;:"))
            before_log = match.group(0)[:-trim] if trim else match.group(0)
            after_log = after[:-trim] if trim else after
            on_rewrite(before_log, after_log)
        return after

    return _DOC_URL_RE.sub(replace, text)


def normalize_file(file_path, rules, on_rewrite=None):
    """Rewrite one file in place. Returns True if the file changed."""
    with open(file_path, encoding="utf-8") as f:
        original = f.read()
    updated = normalize_text(original, rules, on_rewrite)
    if updated == original:
        return False
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(updated)
    return True


def main():
    args = sys.argv[1:]
    version = ""
    files = []
    use_aliases = True
    dump_rules = False
    i = 0
    while i < len(args):
        if args[i] == "--version":
            i += 1
            if i >= len(args):
                print("Error: --version needs a value (e.g. main, latest, 1.5.x)")
                sys.exit(1)
            version = args[i]
        elif args[i].startswith("--version="):
            version = args[i].split("=", 1)[1]
        elif args[i] == "--no-aliases":
            use_aliases = False
        elif args[i] == "--dump-rules":
            dump_rules = True
        else:
            files.append(args[i])
        i += 1

    if not files and not dump_rules:
        print(__doc__)
        print("Error: pass at least one file to normalize")
        sys.exit(1)

    website_dir = os.environ.get("WEBSITE_DIR", ".")
    redirects_path = os.path.join(website_dir, "static", "_redirects")
    if not os.path.isfile(redirects_path):
        print(f"Error: {redirects_path} not found")
        sys.exit(1)

    report_skip = lambda item, reason, paths: print(
        f"  skipped {item} ({reason}): {', '.join(sorted(paths))}"
    )
    redirect_rules = load_rules(redirects_path)
    alias_rules = stub_rules = []
    if use_aliases:
        alias_rules = load_alias_rules(website_dir, on_skip=report_skip)
        stub_rules = load_stub_rules(website_dir, on_skip=report_skip)
    rules = redirect_rules + alias_rules + stub_rules

    print(
        f"Loaded {len(redirect_rules)} redirect rules from {redirects_path}"
        + (
            f", {len(alias_rules)} alias rules and {len(stub_rules)} stub-page rules "
            "from content/docs"
            if use_aliases
            else ""
        )
    )

    target_check = make_target_check(website_dir)

    if dump_rules:
        for source, target in rules:
            print(f"  {source} -> {target}")
        if not files:
            return

    if version:
        print(f"Retargeting doc links to version {version}")

    changed = 0
    skipped = set()
    for file_path in files:
        rel = os.path.relpath(file_path, website_dir)
        with open(file_path, encoding="utf-8") as f:
            original = f.read()

        updated = normalize_text(
            original,
            rules,
            on_rewrite=lambda b, a, r=rel: print(f"  {r}: {b} -> {a}"),
            on_error=lambda u, msg, r=rel: print(f"  {r}: left {u} alone: {msg}"),
            target_exists=target_check,
        )
        if version:
            updated = retarget_version(
                updated,
                version,
                website_dir,
                on_rewrite=lambda b, a, r=rel: print(f"  {r}: {b} -> {a}"),
                on_skip=lambda sec, ver, url: skipped.add((sec, ver)),
            )

        if updated != original:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(updated)
            changed += 1

    for section, ver in sorted(skipped):
        print(
            f"  Note: left {section} links at their original version; "
            f"content/docs/{section}/{ver}/ does not exist yet"
        )

    print(f"Done: rewrote {changed}/{len(files)} files")


if __name__ == "__main__":
    main()
