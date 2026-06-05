#!/usr/bin/env python3
"""One-off: add a `category` field to blog post frontmatter (idempotent)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOG = ROOT / "content" / "blog"

CATEGORY = {
    "2025-07-14-a2a-mcp-gateway-api-0-6-release": "Release",
    "2025-08-12-mcp-authorization-following-the-spec": "Security",
    "2025-08-25-solo-contributes-agentgateway-to-lf": "Announcement",
    "2025-11-02-rate-limit-quota-llm": "LLM",
    "2026-01-26-enterprise-mcp-sso": "Tutorial",
    "2026-01-30-adds-nginx-migration-support": "Release",
    "2026-02-09-getting-started-agentgateway-llm-routing": "Tutorial",
    "2026-02-11-your-first-AI-route": "Tutorial",
    "2026-02-13-Happy-V-Day": "Community",
    "2026-02-17-agentgateway-langfuse-integration": "Tutorial",
    "2026-02-19-connect-any-ide-githhub-mcp-agentgateway": "Tutorial",
    "2026-02-20-mcp-multiplexing-tool-access-agentgateway": "Tutorial",
    "2026-02-21-kill-switch": "Architecture",
    "2026-03-12-agentgateway-v1.0": "Release",
    "2026-03-19-agentgateway-llm-d-gaie-inference-serving": "LLM",
    "2026-03-25-agentgateway-one-year-anniversary": "Community",
    "2026-05-11-agentgateway-v1.2.0": "Release",
    "2026-06-04-agentgateway-joins-aaif": "Announcement",
    "2026-06-04-designing-agentgateway-unified-gateway": "Engineering",
}


def main():
    changed = 0
    for slug, cat in CATEGORY.items():
        path = BLOG / f"{slug}.md"
        if not path.exists():
            print(f"  missing: {slug}")
            continue
        text = path.read_text(encoding="utf-8")
        if not text.startswith("---"):
            print(f"  no frontmatter: {slug}")
            continue
        end = text.find("\n---", 3)
        block = text[3:end]
        if re.search(r'^category:', block, re.M):
            print(f"  skip (has category): {slug}")
            continue
        # insert category right after the author line, else at top of block
        lines = block.splitlines()
        out, inserted = [], False
        for line in lines:
            out.append(line)
            if not inserted and line.startswith("author:"):
                out.append(f'category: "{cat}"')
                inserted = True
        if not inserted:
            out.insert(1, f'category: "{cat}"')
        new_block = "\n".join(out)
        path.write_text("---" + new_block + text[end:], encoding="utf-8")
        print(f"  + {slug}: {cat}")
        changed += 1
    print(f"\nUpdated {changed} post(s).")


if __name__ == "__main__":
    main()
