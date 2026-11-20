window.__AGW_MOCK_MCP_TOOLS = [
 {
  "name": "solo-search_search",
  "description": "Search documentation for the following products (Product (Aliases) - [collection source types]):\n\n- **Solo Enterprise For Istio** (istio) - [docs]\n- **Solo Enterprise For Kagent** (kagent) - [docs]\n- **Solo Enterprise For Kgateway** (kgateway) - [docs]\n- **Solo Enterprise For Agentgateway** (agentgateway) - [docs]\n- **Solo Enterprise For Agentgateway Standalone** (agentgateway) - [docs]\n- **Agentgateway Kubernetes** (agentgateway) - [docs]\n- **Agentgateway Standalone** (agentgateway) - [docs]\n- **Solo Enterprise For Agentregistry** (agentregistry) - [docs]\n- **Agentregistry OSS** (agentregistry) - [docs]\n- **Kgateway OSS** (kgateway) - [docs]\n- **Kagent OSS** (kagent) - [docs]\n- **Gloo Mesh Enterprise** (gloo-mesh) - [docs]\n- **Gloo Edge** - [docs]\n- **Gloo Gateway V1** (gloo-gateway v1) - [docs]\n- **Gateway Api** - [docs]\n- **Agentevals OSS** - [docs]\n\n\n**Usage Note:** Evaluate search results: if they provide a complete and certain answer, then proceed. If the result is relevant but incomplete (e.g., ends mid - sentence), refers to a \"see below\" section, then use the `get_chunks` tool to get more context from the same document.\n",
  "inputSchema": {
   "$schema": "http://json-schema.org/draft-07/schema#",
   "type": "object",
   "properties": {
    "query": {
     "type": "string",
     "maxLength": 2000,
     "description": "The search query to find relevant documentation (max 2000 characters)"
    },
    "product": {
     "type": "string",
     "enum": [
      "solo-enterprise-for-istio",
      "solo-enterprise-for-kagent",
      "solo-enterprise-for-kgateway",
      "solo-enterprise-for-agentgateway",
      "solo-enterprise-for-agentgateway-standalone",
      "agentgateway-kubernetes",
      "agentgateway-standalone",
      "solo-enterprise-for-agentregistry",
      "agentregistry-oss",
      "kgateway-oss",
      "kagent-oss",
      "gloo-mesh-enterprise",
      "gloo-edge",
      "gloo-gateway-v1",
      "gateway-api",
      "agentevals-oss"
     ],
     "description": "The product to search documentation for"
    },
    "limit": {
     "default": 4,
     "description": "Maximum number of results to return (default: 4)",
     "type": "number"
    }
   },
   "required": [
    "query",
    "product"
   ]
  },
  "annotations": {
   "readOnlyHint": true,
   "destructiveHint": false,
   "idempotentHint": true,
   "openWorldHint": false
  }
 },
 {
  "name": "solo-search_get_chunks",
  "description": "\nRetrieve sequential segments of a document to fill in missing context.\n\n**When to use:** Use only when a `search` result is highly relevant but incomplete. This is the preferred way to \"read the rest of the page\" without performing additional keyword searches.\n\n**When to skip:** Do not use if the `search` snippet already contains the full answer or if the search result is irrelevant to the user's query.\n    ",
  "inputSchema": {
   "$schema": "http://json-schema.org/draft-07/schema#",
   "type": "object",
   "properties": {
    "collection": {
     "type": "string",
     "description": "The Qdrant collection name to query (e.g., 'istio-io_latest_docs')"
    },
    "url": {
     "type": "string",
     "description": "The URL of the document to retrieve chunks from"
    },
    "startIndex": {
     "type": "integer",
     "minimum": 0,
     "maximum": 9007199254740991,
     "description": "The starting chunk index (0-based, inclusive)"
    },
    "endIndex": {
     "type": "integer",
     "minimum": 0,
     "maximum": 9007199254740991,
     "description": "The ending chunk index (0-based, inclusive). Will be clamped to the maximum available index if too large."
    }
   },
   "required": [
    "collection",
    "url",
    "startIndex",
    "endIndex"
   ]
  },
  "annotations": {
   "readOnlyHint": true,
   "destructiveHint": false,
   "idempotentHint": true,
   "openWorldHint": false
  }
 },
 {
  "name": "solo-search_get_full_page",
  "description": "\nRetrieve the full markdown content of a documentation page by its URL from the database.\n\n**When to use:** Use when you need the complete content of a specific page and chunk-based retrieval is insufficient.\n\n**Limits:** Pages longer than 20,000 characters will return an error with the approximate token count. Set `force: true` to retrieve them anyway \u00e2\u20ac\u201d note that very large pages consume significant context window space.\n    ",
  "inputSchema": {
   "$schema": "http://json-schema.org/draft-07/schema#",
   "type": "object",
   "properties": {
    "url": {
     "type": "string",
     "description": "The exact URL of the documentation page to retrieve"
    },
    "force": {
     "description": "Set to true to retrieve the page even if it exceeds the 20,000 character limit. Use with caution \u00e2\u20ac\u201d large pages consume significant context.",
     "type": "boolean"
    }
   },
   "required": [
    "url"
   ]
  },
  "annotations": {
   "readOnlyHint": true,
   "destructiveHint": false,
   "idempotentHint": true,
   "openWorldHint": false
  }
 },
 {
  "name": "agentgateway-repo_fetch_agentgateway_documentation",
  "description": "Fetch entire documentation file from GitHub repository: agentgateway/agentgateway. Useful for general questions. Always call this tool first if asked about agentgateway/agentgateway.",
  "inputSchema": {
   "type": "object"
  },
  "annotations": {}
 },
 {
  "name": "agentgateway-repo_search_agentgateway_documentation",
  "description": "Semantically search within the fetched documentation from GitHub repository: agentgateway/agentgateway. Useful for specific queries.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "query": {
     "type": "string",
     "description": "The search query to find relevant documentation"
    }
   },
   "required": [
    "query"
   ],
   "additionalProperties": false,
   "$schema": "http://json-schema.org/draft-07/schema#"
  }
 },
 {
  "name": "agentgateway-repo_search_agentgateway_code",
  "description": "Search for code within the GitHub repository: \"agentgateway/agentgateway\" using the GitHub Search API (exact match). Returns matching files for you to query further if relevant.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "query": {
     "type": "string",
     "description": "The search query to find relevant code files"
    },
    "page": {
     "type": "number",
     "description": "Page number to retrieve (starting from 1). Each page contains 30 results."
    }
   },
   "required": [
    "query"
   ],
   "additionalProperties": false,
   "$schema": "http://json-schema.org/draft-07/schema#"
  }
 },
 {
  "name": "agentgateway-repo_fetch_generic_url_content",
  "description": "Generic tool to fetch content from any absolute URL, respecting robots.txt rules. Use this to retrieve referenced urls (absolute urls) that were mentioned in previously fetched documentation.",
  "inputSchema": {
   "type": "object",
   "properties": {
    "url": {
     "type": "string",
     "description": "The URL of the document or page to fetch"
    }
   },
   "required": [
    "url"
   ],
   "additionalProperties": false,
   "$schema": "http://json-schema.org/draft-07/schema#"
  }
 },
 {
  "name": "context7_resolve-library-id",
  "title": "Resolve Context7 Library ID",
  "description": "Resolves a package/product name to a Context7-compatible library ID and returns matching libraries.\n\nYou MUST call this function before 'Query Documentation' tool to obtain a valid Context7-compatible library ID UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version' in their query.\n\nEach result includes:\n- Library ID: Context7-compatible identifier (format: /org/project)\n- Name: Library or package name\n- Description: Short summary\n- Code Snippets: Number of available code examples\n- Source Reputation: Authority indicator (High, Medium, Low, or Unknown)\n- Benchmark Score: Quality indicator (100 is the highest score)\n- Versions: List of versions if available. Use one of those versions if the user provides a version in their query. The format of the version is /org/project/version.\n\nFor best results, select libraries based on name match, source reputation, snippet coverage, benchmark score, and relevance to your use case.\n\nSelection Process:\n1. Analyze the query to understand what library/package the user is looking for\n2. Return the most relevant match based on:\n- Name similarity to the query (exact matches prioritized)\n- Description relevance to the query's intent\n- Documentation coverage (prioritize libraries with higher Code Snippet counts)\n- Source reputation (consider libraries with High or Medium reputation more authoritative)\n- Benchmark Score: Quality indicator (100 is the highest score)\n\nResponse Format:\n- Return the selected library ID in a clearly marked section\n- Provide a brief explanation for why this library was chosen\n- If multiple good matches exist, acknowledge this but proceed with the most relevant one\n- If no good matches exist, clearly state this and suggest query refinements\n\nFor ambiguous queries, request clarification before proceeding with a best-guess match.\n\nIMPORTANT: Do not call this tool more than 3 times per question. If you cannot find what you need after 3 calls, use the best result you have.",
  "inputSchema": {
   "type": "object",
   "$schema": "https://json-schema.org/draft/2020-12/schema",
   "properties": {
    "query": {
     "type": "string",
     "description": "What to look up in the library's documentation. This is used to rank library results by relevance to what the user is trying to accomplish. The query is sent to the Context7 API for processing. Do not include any sensitive or confidential information such as API keys, passwords, credentials, personal data, or proprietary code in your query."
    },
    "libraryName": {
     "type": "string",
     "description": "Library name to search for and retrieve a Context7-compatible library ID. Use the official library name with proper punctuation \u00e2\u20ac\u201d e.g., 'Next.js' instead of 'nextjs', 'Customer.io' instead of 'customerio', 'Three.js' instead of 'threejs'."
    }
   },
   "required": [
    "query",
    "libraryName"
   ]
  },
  "annotations": {
   "readOnlyHint": true,
   "destructiveHint": false,
   "idempotentHint": true,
   "openWorldHint": true
  }
 },
 {
  "name": "context7_query-docs",
  "title": "Query Documentation",
  "description": "Retrieves and queries up-to-date documentation and code examples from Context7 for any programming library or framework.\n\nYou must call 'Resolve Context7 Library ID' tool first to obtain the exact Context7-compatible library ID required to use this tool, UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version' in their query.\n\nDo not call this tool more than 3 times per question.\n\nIf you know the programming language the user is working in, pass it as `language` so the results match their setup.",
  "inputSchema": {
   "type": "object",
   "$schema": "https://json-schema.org/draft/2020-12/schema",
   "properties": {
    "libraryId": {
     "type": "string",
     "description": "Exact Context7-compatible library ID (e.g., '/mongodb/docs', '/vercel/next.js', '/supabase/supabase', '/vercel/next.js/v16.2.9') retrieved from 'resolve-library-id' or directly from user query in the format '/org/project' or '/org/project/version'."
    },
    "query": {
     "type": "string",
     "description": "What to look up in the library's documentation, scoped to a single concept. Be specific and include relevant details, but keep each query to one topic \u00e2\u20ac\u201d if the user's question spans multiple distinct concepts, make a separate call per concept instead of combining them, unless the question is about how the concepts interact. Good: 'How to set up authentication with JWT in Express.js' or 'React useEffect cleanup function examples'. Bad (too vague): 'auth' or 'hooks'. Bad (too broad): 'routing and auth and caching in Next.js'. The query is sent to the Context7 API for processing. Do not include any sensitive or confidential information such as API keys, passwords, credentials, personal data, or proprietary code in your query."
    },
    "language": {
     "description": "Programming language the user is writing code in, such as 'Python', 'TypeScript', 'Go', or 'C#'. Ranks code examples in that language first. Leave it out when the language is unknown or does not apply.",
     "type": "string"
    }
   },
   "required": [
    "libraryId",
    "query"
   ]
  },
  "annotations": {
   "readOnlyHint": true,
   "destructiveHint": false,
   "idempotentHint": true,
   "openWorldHint": true
  }
 },
 {
  "name": "deepwiki_ask_wiki_question",
  "title": "Ask Wiki Question",
  "description": "Ask any question about a GitHub repository's codebase and get an AI-powered answer\ngrounded in its DeepWiki.",
  "inputSchema": {
   "properties": {
    "repoName": {
     "anyOf": [
      {
       "type": "string"
      },
      {
       "items": {
        "type": "string"
       },
       "type": "array"
      }
     ],
     "description": "GitHub repository or list of repositories (max 10) in owner/repo format."
    },
    "question": {
     "description": "The question to ask about the repository.",
     "type": "string"
    }
   },
   "required": [
    "repoName",
    "question"
   ],
   "type": "object",
   "additionalProperties": false
  },
  "outputSchema": {
   "properties": {
    "result": {
     "type": "string"
    }
   },
   "required": [
    "result"
   ],
   "type": "object",
   "x-fastmcp-wrap-result": true
  },
  "_meta": {
   "fastmcp": {
    "tags": []
   }
  }
 },
 {
  "name": "deepwiki_read_wiki_contents",
  "title": "Read Wiki Contents",
  "description": "View documentation about a GitHub repository.",
  "inputSchema": {
   "properties": {
    "repoName": {
     "description": "GitHub repository in owner/repo format (e.g. \"facebook/react\").",
     "type": "string"
    }
   },
   "required": [
    "repoName"
   ],
   "type": "object",
   "additionalProperties": false
  },
  "outputSchema": {
   "properties": {
    "result": {
     "type": "string"
    }
   },
   "required": [
    "result"
   ],
   "type": "object",
   "x-fastmcp-wrap-result": true
  },
  "_meta": {
   "fastmcp": {
    "tags": []
   }
  }
 },
 {
  "name": "deepwiki_read_wiki_structure",
  "title": "Read Wiki Structure",
  "description": "Get a list of documentation topics for a GitHub repository.",
  "inputSchema": {
   "properties": {
    "repoName": {
     "description": "GitHub repository in owner/repo format (e.g. \"facebook/react\").",
     "type": "string"
    }
   },
   "required": [
    "repoName"
   ],
   "type": "object",
   "additionalProperties": false
  },
  "outputSchema": {
   "properties": {
    "result": {
     "type": "string"
    }
   },
   "required": [
    "result"
   ],
   "type": "object",
   "x-fastmcp-wrap-result": true
  },
  "_meta": {
   "fastmcp": {
    "tags": []
   }
  }
 }
];
