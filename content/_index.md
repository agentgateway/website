---
title: agentgateway
toc: false
description: ""
---

<section class="text-white pt-[7.875rem] bg-center bg-no-repeat bg-[length:61.85319rem_60.14119rem] lg:bg-auto">
<div class="py-8 lg:py-16 flex flex-col items-center px-6 max-w-4xl mx-auto text-center">
<h1 class="text-3xl/tight lg:text-5xl/tight xl:text-6xl/tight font-bold mt-6 font-heading">
<span class="block">
<span class="inline-block h-[1.2em] overflow-hidden align-bottom">
<span id="hero-words" class="inline-block text-tertiary-text transition-transform duration-500">
<span class="block">Connect</span>
<span class="block">Secure</span>
<span class="block">Observe</span>
<span class="block">Connect</span>
</span>
</span>
</span>
<span class="block">Agentic Workflows</span>
</h1>
<script>
(function() {
const words = document.getElementById('hero-words');
let current = 0;
const total = 3;
setInterval(() => {
current++;
words.style.transition = current > total ? 'none' : 'transform 0.5s';
if (current > total) {
current = 0;
words.style.transform = 'translateY(0)';
setTimeout(() => {
current = 1;
words.style.transition = 'transform 0.5s';
words.style.transform = 'translateY(-25%)';
}, 50);
} else {
words.style.transform = `translateY(-${current * 25}%)`;
}
}, 2000);
})();
</script>
<p class="text-xl max-w-2xl font-semibold mt-6 lg:mt-10 font-heading text-secondary-text">
Agent Gateway is an open source data plane built on AI-native protocols (A2A & MCP) to connect, secure, and observe agent-to-agent and agent-to-tool communication across any framework and environment.
</p>
<div class="flex flex-wrap justify-center gap-4 pt-10">
{{< button style="primary" href="/docs/quickstart/" iconRight="true" text="Get Started" icon="arrow-right" >}}
{{< button style="secondary" href="https://github.com/agentgateway/agentgateway" text="View on GitHub" icon="github" >}}
{{< button style="secondary" href="https://discord.gg/y9efgEmppm" text="Discord" icon="discord" >}}
</div>
<div class="mt-12 w-full max-w-3xl">
<img src="/heroshort.png" alt="Agent Gateway" class="w-full rounded-lg" />
</div>
</div>
</section>

<section class="py-12 bg-primary-bg overflow-hidden">
  <p class="text-center text-secondary-text text-lg font-medium mb-8">Contributing Companies</p>
  <div class="marquee-container">
    <div class="marquee-track">
      <div class="marquee-content">
        <div class="logo-item">
          <img src="/adopters/solo-io-light.png" alt="Solo.io" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Solo.io</span>
        </div>
        <div class="logo-item">
          <img src="/quotes/microsoft.svg" alt="Microsoft" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Microsoft</span>
        </div>
        <div class="logo-item">
          <img src="/logos/apple.svg" alt="Apple" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Apple</span>
        </div>
        <div class="logo-item">
          <img src="/logos/alibaba.svg" alt="Alibaba" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Alibaba</span>
        </div>
        <div class="logo-item">
          <img src="/logos/adobe.svg" alt="Adobe" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Adobe</span>
        </div>
        <div class="logo-item">
          <img src="/logos/aws.svg" alt="AWS" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>AWS</span>
        </div>
        <div class="logo-item">
          <img src="/logos/cisco.svg" alt="Cisco" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Cisco</span>
        </div>
        <div class="logo-item">
          <img src="/logos/salesforce.svg" alt="Salesforce" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Salesforce</span>
        </div>
        <div class="logo-item">
          <img src="/logos/huawei.svg" alt="Huawei" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Huawei</span>
        </div>
        <div class="logo-item">
          <img src="/logos/amdocs.svg" alt="Amdocs" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Amdocs</span>
        </div>
      </div>
      <div class="marquee-content" aria-hidden="true">
        <div class="logo-item">
          <img src="/adopters/solo-io-light.png" alt="Solo.io" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Solo.io</span>
        </div>
        <div class="logo-item">
          <img src="/quotes/microsoft.svg" alt="Microsoft" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Microsoft</span>
        </div>
        <div class="logo-item">
          <img src="/logos/apple.svg" alt="Apple" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Apple</span>
        </div>
        <div class="logo-item">
          <img src="/logos/alibaba.svg" alt="Alibaba" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Alibaba</span>
        </div>
        <div class="logo-item">
          <img src="/logos/adobe.svg" alt="Adobe" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Adobe</span>
        </div>
        <div class="logo-item">
          <img src="/logos/aws.svg" alt="AWS" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>AWS</span>
        </div>
        <div class="logo-item">
          <img src="/logos/cisco.svg" alt="Cisco" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Cisco</span>
        </div>
        <div class="logo-item">
          <img src="/logos/salesforce.svg" alt="Salesforce" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Salesforce</span>
        </div>
        <div class="logo-item">
          <img src="/logos/huawei.svg" alt="Huawei" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Huawei</span>
        </div>
        <div class="logo-item">
          <img src="/logos/amdocs.svg" alt="Amdocs" class="logo-img" style="filter: brightness(0) invert(1);" />
          <span>Amdocs</span>
        </div>
      </div>
    </div>
  </div>
  <style>
    .marquee-container {
      width: 100%;
      overflow: hidden;
    }
    .marquee-track {
      display: flex;
      width: fit-content;
      animation: scroll-left 30s linear infinite;
      will-change: transform;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      perspective: 1000px;
      -webkit-perspective: 1000px;
      transform: translate3d(0, 0, 0);
      -webkit-transform: translate3d(0, 0, 0);
    }
    .marquee-content {
      display: flex;
      align-items: flex-start;
      gap: 5rem;
      padding: 0 2.5rem;
      flex-shrink: 0;
    }
    .logo-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      min-width: 140px;
    }
    .logo-item span {
      color: #9ca3af;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .logo-item img {
      image-rendering: -webkit-optimize-contrast;
      height: 56px;
      width: auto;
      max-width: 160px;
      object-fit: contain;
    }
    @keyframes scroll-left {
      0% { transform: translate3d(0, 0, 0); }
      100% { transform: translate3d(-50%, 0, 0); }
    }
  </style>
</section>


<section class="py-16 bg-secondary-bg" id="get-started">
  <div class="max-w-7xl mx-auto px-6">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Install -->
      <a href="/docs/quickstart/" class="group bg-tertiary-bg rounded-xl border border-secondary-border p-6 hover:border-tertiary-text transition-all">
        <div class="w-10 h-10 bg-primary-bg rounded-lg flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
        </div>
        <h3 class="text-primary-text text-lg font-bold mb-2">Install</h3>
        <p class="text-secondary-text text-sm">Get started with binary, Docker, or Kubernetes deployment options.</p>
      </a>
      <!-- Tutorials -->
      <a href="/tutorials/" class="group bg-tertiary-bg rounded-xl border border-secondary-border p-6 hover:border-tertiary-text transition-all">
        <div class="w-10 h-10 bg-primary-bg rounded-lg flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h3 class="text-primary-text text-lg font-bold mb-2">Tutorials</h3>
        <p class="text-secondary-text text-sm">Step-by-step guides for MCP connectivity, A2A, and LLM routing.</p>
      </a>
      <!-- Documentation -->
      <a href="/docs/" class="group bg-tertiary-bg rounded-xl border border-secondary-border p-6 hover:border-tertiary-text transition-all">
        <div class="w-10 h-10 bg-primary-bg rounded-lg flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <h3 class="text-primary-text text-lg font-bold mb-2">Documentation</h3>
        <p class="text-secondary-text text-sm">Complete reference for configuration, security, and policies.</p>
      </a>
      <!-- Integrations -->
      <a href="/docs/integrations/" class="group bg-tertiary-bg rounded-xl border border-secondary-border p-6 hover:border-tertiary-text transition-all">
        <div class="w-10 h-10 bg-primary-bg rounded-lg flex items-center justify-center mb-4">
          <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
          </svg>
        </div>
        <h3 class="text-primary-text text-lg font-bold mb-2">Integrations</h3>
        <p class="text-secondary-text text-sm">Connect with OpenAI, Anthropic, Azure, and MCP servers.</p>
      </a>
    </div>
  </div>
</section>

<!-- What is Agent Gateway Section -->
<section class="py-20 bg-primary-bg">
  <div class="max-w-7xl mx-auto px-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div>
        <h2 class="text-primary-text text-3xl lg:text-4xl font-bold mb-6">What is Agent Gateway?</h2>
        <p class="text-secondary-text text-lg mb-4">
          Agent Gateway is a next-generation proxy designed for the agentic AI ecosystem. It provides drop-in security, observability, and governance for agent-to-agent (A2A) and agent-to-tool (MCP) communication.
        </p>
        <p class="text-secondary-text mb-8">
          Built to tackle enterprise challenges, Agent Gateway enables teams to connect, secure, and audit all AI agent communications from a single control point.
        </p>
        <div class="space-y-4">
          <div class="bg-secondary-bg rounded-xl border border-secondary-border p-4">
            <div class="flex items-center gap-3 mb-2">
              <svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <h3 class="text-primary-text font-semibold">Protocol Native</h3>
            </div>
            <p class="text-secondary-text text-sm pl-8">Built on MCP and A2A protocols for seamless agent connectivity</p>
          </div>
          <div class="bg-secondary-bg rounded-xl border border-secondary-border p-4">
            <div class="flex items-center gap-3 mb-2">
              <svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
              <h3 class="text-primary-text font-semibold">Security First</h3>
            </div>
            <p class="text-secondary-text text-sm pl-8">RBAC, JWT authentication, TLS, and CEL-based access policies</p>
          </div>
          <div class="bg-secondary-bg rounded-xl border border-secondary-border p-4">
            <div class="flex items-center gap-3 mb-2">
              <svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <h3 class="text-primary-text font-semibold">High Performance</h3>
            </div>
            <p class="text-secondary-text text-sm pl-8">Written in Rust, designed for any scale deployment</p>
          </div>
        </div>
        <div class="mt-8">
          {{< button style="primary" href="#features" iconRight="true" text="Learn more about features" icon="arrow-right" >}}
        </div>
      </div>
      <div class="flex justify-center">
        <div class="bg-secondary-bg rounded-xl border border-secondary-border p-8 w-full max-w-md">
          <div class="space-y-4">
            <div class="text-center">
              <span class="text-secondary-text text-xs uppercase tracking-wider">AGENTS</span>
              <div class="flex justify-center gap-2 mt-3">
                <span class="bg-tertiary-bg border border-secondary-border rounded-lg px-4 py-2 text-primary-text text-sm">Claude</span>
                <span class="bg-tertiary-bg border border-secondary-border rounded-lg px-4 py-2 text-primary-text text-sm">GPT-5</span>
                <span class="bg-tertiary-bg border border-secondary-border rounded-lg px-4 py-2 text-primary-text text-sm">Custom</span>
              </div>
            </div>
            <div class="flex justify-center">
              <div class="w-px h-6 bg-tertiary-text"></div>
            </div>
            <div class="flex justify-center">
              <div class="bg-primary-bg border-2 border-tertiary-text rounded-lg px-8 py-4 flex items-center justify-center">
                <img src="/mark-transparent.svg" alt="Agent Gateway" class="h-10 w-auto">
              </div>
            </div>
            <div class="flex justify-center">
              <div class="w-px h-6 bg-tertiary-text"></div>
            </div>
            <div class="text-center">
              <span class="text-secondary-text text-xs uppercase tracking-wider">BACKENDS</span>
              <div class="flex justify-center gap-2 mt-3">
                <span class="bg-tertiary-bg border border-secondary-border rounded-lg px-3 py-2 text-primary-text text-xs">MCP Servers</span>
                <span class="bg-tertiary-bg border border-secondary-border rounded-lg px-3 py-2 text-primary-text text-xs">LLM APIs</span>
                <span class="bg-tertiary-bg border border-secondary-border rounded-lg px-3 py-2 text-primary-text text-xs">A2A Agents</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Features Section -->
<section class="py-16 bg-primary-bg" id="features">
<div class="max-w-4xl mx-auto px-6">
<h2 class="text-primary-text text-3xl lg:text-4xl font-bold text-center pb-4">Features</h2>
<p class="text-secondary-text text-center text-lg pb-10 max-w-2xl mx-auto">Everything you need to connect, secure, and observe your AI infrastructure</p>
<div class="space-y-3" id="features-list">

<!-- LLM Gateway -->
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('llm')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">LLM Gateway</h3>
<p class="text-secondary-text text-sm">Route traffic to major LLM providers through a unified OpenAI-compatible API</p>
</div>
<svg id="chevron-llm" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
</button>
<div id="detail-llm" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<p class="text-secondary-text text-sm mb-4">Seamlessly switch between providers without changing your application code.</p>
<table class="w-full text-sm mb-4 border-collapse">
<thead>
<tr class="border-b border-secondary-border">
<th class="text-left text-secondary-text py-2 font-medium">Provider</th>
<th class="text-center text-secondary-text py-2 font-medium">Chat Completions</th>
<th class="text-center text-secondary-text py-2 font-medium">Streaming</th>
</tr>
</thead>
<tbody class="text-secondary-text">
<tr class="border-b border-secondary-border/50"><td class="py-2">OpenAI / Azure OpenAI</td><td class="text-center text-emerald-400">✓</td><td class="text-center text-emerald-400">✓</td></tr>
<tr class="border-b border-secondary-border/50"><td class="py-2">Anthropic</td><td class="text-center text-emerald-400">✓</td><td class="text-center text-emerald-400">✓</td></tr>
<tr class="border-b border-secondary-border/50"><td class="py-2">Google Gemini</td><td class="text-center text-emerald-400">✓</td><td class="text-center text-emerald-400">✓</td></tr>
<tr class="border-b border-secondary-border/50"><td class="py-2">Google Vertex AI</td><td class="text-center text-emerald-400">✓</td><td class="text-center text-emerald-400">✓</td></tr>
<tr><td class="py-2">Amazon Bedrock</td><td class="text-center text-emerald-400">✓</td><td class="text-center text-emerald-400">✓</td></tr>
</tbody>
</table>
<div class="bg-tertiary-bg/50 rounded-lg p-3 mb-4">
<p class="text-primary-text text-sm font-medium mb-2">OpenAI-compatible providers</p>
<p class="text-secondary-text text-xs mb-2">Route to any provider that supports the OpenAI API format:</p>
<p class="text-secondary-text text-xs">Cohere, Mistral, Groq, Together AI, Fireworks, Ollama, LM Studio, vLLM, llama.cpp, and any custom endpoint with <code class="text-tertiary-text">/v1/chat/completions</code></p>
</div>
<a href="/docs/llm/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>

<!-- Inference Routing -->
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('inference')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">Inference Routing</h3>
<p class="text-secondary-text text-sm">Intelligent routing to self-hosted models and local LLM workloads</p>
</div>
<svg id="chevron-inference" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
</button>
<div id="detail-inference" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<p class="text-secondary-text text-sm mb-4">Running your own models on GPU infrastructure? Agentgateway implements the Kubernetes Inference Gateway extensions for intelligent routing to local LLM workloads.</p>
<p class="text-primary-text text-sm font-medium mb-2">Route based on:</p>
<ul class="text-secondary-text text-sm space-y-2 mb-4">
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span><strong class="text-primary-text">GPU & KV cache utilization</strong> — Send requests to the least-loaded model</span></li>
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span><strong class="text-primary-text">Prompt criticality</strong> — Prioritize high-priority requests</span></li>
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span><strong class="text-primary-text">LoRA adapters</strong> — Route to models with specific fine-tuned adapters</span></li>
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span><strong class="text-primary-text">Work queue depth</strong> — Avoid overloaded inference servers</span></li>
</ul>
<a href="/docs/llm/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>

<!-- MCP Gateway -->
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('mcp')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path></svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">MCP Gateway</h3>
<p class="text-secondary-text text-sm">Connect LLMs to tools and external data sources using MCP</p>
</div>
<svg id="chevron-mcp" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
</button>
<div id="detail-mcp" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<p class="text-secondary-text text-sm mb-4">Connect LLMs to tools and external data sources using the Model Context Protocol (MCP).</p>
<ul class="text-secondary-text text-sm space-y-2 mb-4">
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span><strong class="text-primary-text">Tool federation</strong> — Aggregate multiple MCP servers behind a single endpoint</span></li>
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span><strong class="text-primary-text">Protocol support</strong> — stdio, HTTP/SSE, and Streamable HTTP transports</span></li>
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span><strong class="text-primary-text">OpenAPI integration</strong> — Expose existing REST APIs as MCP-native tools</span></li>
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span><strong class="text-primary-text">Authentication & authorization</strong> — Built-in MCP auth spec compliance with OAuth providers (Auth0, Keycloak)</span></li>
</ul>
<a href="/docs/mcp/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>

<!-- A2A Gateway -->
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('agent')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">A2A Gateway</h3>
<p class="text-secondary-text text-sm">Enable secure communication between AI agents using A2A</p>
</div>
<svg id="chevron-agent" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
</button>
<div id="detail-agent" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<p class="text-secondary-text text-sm mb-4">Enable secure communication between AI agents using the Agent-to-Agent (A2A) protocol. Agents can:</p>
<ul class="text-secondary-text text-sm space-y-2 mb-4">
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span>Discover each other's capabilities</span></li>
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span>Negotiate interaction modalities (text, forms, media)</span></li>
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span>Collaborate on long-running tasks</span></li>
<li class="flex items-start gap-2"><span class="text-tertiary-text">•</span><span>Operate without exposing internal state or tools</span></li>
</ul>
<a href="/docs/agent/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>

<!-- Security & Observability -->
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('security')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">Security & Observability</h3>
<p class="text-secondary-text text-sm">Enterprise-grade authentication, authorization, and monitoring</p>
</div>
<svg id="chevron-security" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
</button>
<div id="detail-security" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
<div class="bg-tertiary-bg/50 rounded-lg p-3">
<p class="text-primary-text text-sm font-medium mb-2">Authentication</p>
<p class="text-secondary-text text-xs">JWT, API keys, basic auth, MCP auth spec</p>
</div>
<div class="bg-tertiary-bg/50 rounded-lg p-3">
<p class="text-primary-text text-sm font-medium mb-2">Authorization</p>
<p class="text-secondary-text text-xs">Fine-grained RBAC with Cedar policy engine</p>
</div>
<div class="bg-tertiary-bg/50 rounded-lg p-3">
<p class="text-primary-text text-sm font-medium mb-2">Traffic Policies</p>
<p class="text-secondary-text text-xs">Rate limiting, CORS, TLS, external authz</p>
</div>
<div class="bg-tertiary-bg/50 rounded-lg p-3">
<p class="text-primary-text text-sm font-medium mb-2">Observability</p>
<p class="text-secondary-text text-xs">Built-in OpenTelemetry metrics, logs, and distributed tracing</p>
</div>
</div>
<a href="/docs/configuration/security/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>

</div>
</div>
</section>

<script>
function toggleFeature(feature) {
var detail = document.getElementById('detail-' + feature);
var chevron = document.getElementById('chevron-' + feature);
var isHidden = detail.classList.contains('hidden');
if (isHidden) {
detail.classList.remove('hidden');
chevron.classList.add('rotate-180');
} else {
detail.classList.add('hidden');
chevron.classList.remove('rotate-180');
}
}
</script>

<!-- Getting Started Section -->
<section class="py-16 bg-secondary-bg" id="getting-started">
<div class="max-w-4xl mx-auto px-6">
<div class="flex justify-between items-center mb-6">
<h2 class="text-primary-text text-2xl lg:text-3xl font-bold">Getting Started</h2>
<a href="/docs/deployment/" class="text-tertiary-text hover:underline text-sm font-medium flex items-center gap-1">View all docs <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>
</div>
<div class="bg-primary-bg rounded-lg border border-secondary-border overflow-hidden mb-6">
<div class="flex items-center justify-between border-b border-secondary-border px-4 py-2">
<span class="text-xs font-medium text-tertiary-text">Binary</span>
<button onclick="copyGettingStarted()" id="copy-btn" class="px-3 py-1 text-xs text-secondary-text hover:text-primary-text bg-secondary-bg rounded border border-secondary-border transition-colors">Copy</button>
</div>
<div class="p-4 space-y-3 text-xs font-mono">
<div class="flex gap-3"><span class="text-tertiary-text">$</span><code class="text-primary-text">curl https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentgateway | bash</code></div>
<div class="flex gap-3"><span class="text-tertiary-text">$</span><code class="text-primary-text">curl -sL https://raw.githubusercontent.com/agentgateway/agentgateway/main/examples/basic/config.yaml -o config.yaml</code></div>
<div class="flex gap-3"><span class="text-tertiary-text">$</span><code class="text-primary-text">agentgateway -f config.yaml</code></div>
<div class="text-secondary-text pt-1"># Open UI at localhost:15000</div>
</div>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<a href="/docs/quickstart/" class="bg-primary-bg rounded-lg border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors">
<div class="flex items-center gap-2 mb-2">
<svg class="w-4 h-4 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
<h3 class="text-primary-text font-semibold">Quick Start</h3>
</div>
<p class="text-secondary-text text-sm">Get up and running with Agent Gateway in under 5 minutes.</p>
</a>
<a href="/docs/mcp/" class="bg-primary-bg rounded-lg border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors">
<div class="flex items-center gap-2 mb-2">
<svg class="w-4 h-4 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
<h3 class="text-primary-text font-semibold">MCP Connectivity Guide</h3>
</div>
<p class="text-secondary-text text-sm">Connect agents to MCP tool servers with auth.</p>
</a>
</div>
</div>
</section>

<script>
function copyGettingStarted() {
var commands = 'curl https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentgateway | bash\ncurl -sL https://raw.githubusercontent.com/agentgateway/agentgateway/main/examples/basic/config.yaml -o config.yaml\nagentgateway -f config.yaml';
navigator.clipboard.writeText(commands);
var btn = document.getElementById('copy-btn');
btn.textContent = 'Copied!';
setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
}
</script>

<!-- Tutorials Section -->
<section class="py-16 bg-primary-bg" id="tutorials">
<div class="max-w-7xl mx-auto px-6">
<div class="flex justify-between items-center mb-4">
<h2 class="text-primary-text text-2xl lg:text-3xl font-bold">Tutorials</h2>
<a href="/tutorials/" class="text-tertiary-text hover:underline text-sm font-medium flex items-center gap-1">View all tutorials <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>
</div>
<p class="text-secondary-text text-lg mb-8">Hands-on guides to get you up and running with agentgateway in minutes.</p>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
<!-- Standalone Tutorials -->
<div>
<div class="flex items-center gap-2 mb-4">
<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"></path></svg>
<h3 class="text-primary-text text-lg font-bold">Standalone</h3>
</div>
<div class="space-y-3">
<a href="/docs/standalone/latest/tutorials/llm-gateway/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">LLM Gateway</h4>
<p class="text-secondary-text text-xs mt-1">Route requests to OpenAI, Anthropic, and Gemini</p>
</div>
<span class="inline-block bg-tertiary-text/20 text-tertiary-text text-xs font-medium px-2 py-0.5 rounded-full">LLM</span>
</div>
</a>
<a href="/docs/standalone/latest/tutorials/basic/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">Basic MCP Server</h4>
<p class="text-secondary-text text-xs mt-1">Connect to your first MCP tool server</p>
</div>
<span class="inline-block bg-violet-400/20 text-violet-400 text-xs font-medium px-2 py-0.5 rounded-full">MCP</span>
</div>
</a>
<a href="/docs/standalone/latest/tutorials/mcp-federation/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">MCP Federation</h4>
<p class="text-secondary-text text-xs mt-1">Federate multiple MCP servers behind one endpoint</p>
</div>
<span class="inline-block bg-violet-400/20 text-violet-400 text-xs font-medium px-2 py-0.5 rounded-full">MCP</span>
</div>
</a>
<a href="/docs/standalone/latest/tutorials/" class="text-tertiary-text hover:underline text-sm font-medium flex items-center gap-1 mt-3 ml-1">View all standalone tutorials <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>
</div>
</div>

<!-- Kubernetes Tutorials -->
<div>
<div class="flex items-center gap-2 mb-4">
<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
<h3 class="text-primary-text text-lg font-bold">Kubernetes</h3>
</div>
<div class="space-y-3">
<a href="/docs/kubernetes/latest/tutorials/llm-gateway/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">LLM Gateway</h4>
<p class="text-secondary-text text-xs mt-1">Route to LLM providers on Kubernetes with Gateway API</p>
</div>
<span class="inline-block bg-tertiary-text/20 text-tertiary-text text-xs font-medium px-2 py-0.5 rounded-full">LLM</span>
</div>
</a>
<a href="/docs/kubernetes/latest/tutorials/basic/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">Basic MCP Server</h4>
<p class="text-secondary-text text-xs mt-1">Deploy and route to an MCP server on K8s</p>
</div>
<span class="inline-block bg-violet-400/20 text-violet-400 text-xs font-medium px-2 py-0.5 rounded-full">MCP</span>
</div>
</a>
<a href="/docs/kubernetes/latest/tutorials/azure-ai-foundry/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">Azure AI Foundry</h4>
<p class="text-secondary-text text-xs mt-1">Route to Azure OpenAI through agentgateway</p>
</div>
<span class="inline-block bg-blue-400/20 text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">Azure</span>
</div>
</a>
<a href="/docs/kubernetes/latest/tutorials/jwt-authorization/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">JWT Authorization</h4>
<p class="text-secondary-text text-xs mt-1">Secure your gateway with JWT authentication</p>
</div>
<span class="inline-block bg-amber-400/20 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">Security</span>
</div>
</a>
<a href="/docs/kubernetes/latest/tutorials/ai-prompt-guard/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">AI Prompt Guard</h4>
<p class="text-secondary-text text-xs mt-1">Block sensitive data in LLM requests</p>
</div>
<span class="inline-block bg-amber-400/20 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">Security</span>
</div>
</a>
<a href="/docs/kubernetes/latest/tutorials/prompt-enrichment/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">Prompt Enrichment</h4>
<p class="text-secondary-text text-xs mt-1">Inject context at the gateway layer for better LLM output</p>
</div>
<span class="inline-block bg-tertiary-text/20 text-tertiary-text text-xs font-medium px-2 py-0.5 rounded-full">LLM</span>
</div>
</a>
<a href="/docs/kubernetes/latest/tutorials/claude-code-proxy/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">Claude Code CLI Proxy</h4>
<p class="text-secondary-text text-xs mt-1">Proxy and secure agentic CLI traffic</p>
</div>
<span class="inline-block bg-amber-400/20 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">Security</span>
</div>
</a>
<a href="/docs/kubernetes/latest/tutorials/telemetry/" class="bg-secondary-bg rounded-xl border border-secondary-border p-4 hover:border-tertiary-text/50 transition-colors block">
<div class="flex items-center justify-between">
<div>
<h4 class="text-primary-text font-semibold text-sm">Telemetry & Observability</h4>
<p class="text-secondary-text text-xs mt-1">Distributed tracing with OpenTelemetry and Jaeger</p>
</div>
<span class="inline-block bg-cyan-400/20 text-cyan-400 text-xs font-medium px-2 py-0.5 rounded-full">Ops</span>
</div>
</a>
<a href="/docs/kubernetes/latest/tutorials/" class="text-tertiary-text hover:underline text-sm font-medium flex items-center gap-1 mt-3 ml-1">View all Kubernetes tutorials <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>
</div>
</div>
</div>
</div>
</section>

<!-- Popular Integrations Section -->
<section class="py-16 bg-secondary-bg" id="integrations">
<div class="max-w-7xl mx-auto px-6">
<div class="flex justify-between items-center mb-8">
<h2 class="text-primary-text text-2xl lg:text-3xl font-bold">Popular Integrations</h2>
<a href="/docs/integrations/" class="text-tertiary-text hover:underline text-sm font-medium flex items-center gap-1">View all integrations <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<a href="/docs/integrations/llm-providers/" class="bg-primary-bg rounded-xl border border-secondary-border p-5 hover:border-tertiary-text/50 transition-colors">
<div class="flex items-center gap-3 mb-2">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
<h3 class="text-primary-text font-bold">LLM Providers</h3>
</div>
<p class="text-secondary-text text-sm">Connect to OpenAI, Anthropic, Azure OpenAI, Amazon Bedrock, and Google Gemini.</p>
</a>
<a href="/docs/integrations/mcp-servers/" class="bg-primary-bg rounded-xl border border-secondary-border p-5 hover:border-tertiary-text/50 transition-colors">
<div class="flex items-center gap-3 mb-2">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
<h3 class="text-primary-text font-bold">MCP Servers</h3>
</div>
<p class="text-secondary-text text-sm">Expose and federate MCP tool servers with stdio, SSE, and streamable HTTP transports.</p>
</a>
<a href="/docs/integrations/platforms/kubernetes/" class="bg-primary-bg rounded-xl border border-secondary-border p-5 hover:border-tertiary-text/50 transition-colors">
<div class="flex items-center gap-3 mb-2">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
<h3 class="text-primary-text font-bold">Kubernetes Gateway API</h3>
</div>
<p class="text-secondary-text text-sm">Deploy with kgateway for dynamic provisioning using Kubernetes Gateway API.</p>
</a>
<a href="/docs/integrations/observability/" class="bg-primary-bg rounded-xl border border-secondary-border p-5 hover:border-tertiary-text/50 transition-colors">
<div class="flex items-center gap-3 mb-2">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
<h3 class="text-primary-text font-bold">Observability</h3>
</div>
<p class="text-secondary-text text-sm">OpenTelemetry, Prometheus, Grafana, and Jaeger for metrics, tracing, and visualization.</p>
</a>
</div>
</div>
</section>

<script>
function copyCode(button) {
  const codeBlock = button.previousElementSibling;
  const text = codeBlock.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const originalSvg = button.innerHTML;
    button.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    button.classList.add('text-green-400');
    setTimeout(() => {
      button.innerHTML = originalSvg;
      button.classList.remove('text-green-400');
    }, 2000);
  });
}
function showDockerOption(option) {
  document.querySelectorAll('.docker-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.docker-option').forEach(el => {
    el.classList.remove('bg-tertiary-text', 'text-white', 'border-tertiary-text');
    el.classList.add('bg-secondary-bg', 'text-primary-text', 'border-secondary-border', 'hover:border-tertiary-text', 'hover:bg-tertiary-bg');
  });
  document.getElementById('docker-' + option).classList.remove('hidden');
  const selectedOpt = document.getElementById('docker-opt-' + option);
  selectedOpt.classList.add('bg-tertiary-text', 'text-white', 'border-tertiary-text');
  selectedOpt.classList.remove('bg-secondary-bg', 'text-primary-text', 'border-secondary-border', 'hover:border-tertiary-text', 'hover:bg-tertiary-bg');
}
function switchLLMProvider(provider) {
  document.querySelectorAll('.llm-provider-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('llm-' + provider).classList.remove('hidden');
  const exportEl = document.getElementById('docker-llm-export');
  const exports = {
    openai: 'export OPENAI_API_KEY=your-api-key',
    gemini: 'export GEMINI_API_KEY=your-api-key',
    anthropic: 'export ANTHROPIC_API_KEY=your-api-key',
    bedrock: 'export AWS_ACCESS_KEY_ID=your-access-key-id\nexport AWS_SECRET_ACCESS_KEY=your-secret-access-key\nexport AWS_REGION=us-east-1'
  };
  exportEl.textContent = exports[provider];
}
function showBinaryOption(option) {
  document.querySelectorAll('.binary-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.binary-option').forEach(el => {
    el.classList.remove('bg-tertiary-text', 'text-white', 'border-tertiary-text');
    el.classList.add('bg-secondary-bg', 'text-primary-text', 'border-secondary-border', 'hover:border-tertiary-text', 'hover:bg-tertiary-bg');
  });
  document.getElementById('binary-' + option).classList.remove('hidden');
  const selectedOpt = document.getElementById('binary-opt-' + option);
  selectedOpt.classList.add('bg-tertiary-text', 'text-white', 'border-tertiary-text');
  selectedOpt.classList.remove('bg-secondary-bg', 'text-primary-text', 'border-secondary-border', 'hover:border-tertiary-text', 'hover:bg-tertiary-bg');
}
function switchBinaryLLMProvider(provider) {
  document.querySelectorAll('.binary-llm-provider-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('binary-llm-' + provider).classList.remove('hidden');
  const exportEl = document.getElementById('binary-llm-export');
  const exports = {
    openai: 'export OPENAI_API_KEY=your-api-key',
    gemini: 'export GEMINI_API_KEY=your-api-key',
    anthropic: 'export ANTHROPIC_API_KEY=your-api-key',
    bedrock: 'export AWS_ACCESS_KEY_ID=your-access-key-id\nexport AWS_SECRET_ACCESS_KEY=your-secret-access-key\nexport AWS_REGION=us-east-1'
  };
  exportEl.textContent = exports[provider];
}
function showK8sOption(option) {
  document.querySelectorAll('.k8s-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.k8s-option').forEach(el => {
    el.classList.remove('bg-tertiary-text', 'text-white', 'border-tertiary-text');
    el.classList.add('bg-secondary-bg', 'text-primary-text', 'border-secondary-border', 'hover:border-tertiary-text', 'hover:bg-tertiary-bg');
  });
  document.getElementById('k8s-' + option).classList.remove('hidden');
  const selectedOpt = document.getElementById('k8s-opt-' + option);
  selectedOpt.classList.add('bg-tertiary-text', 'text-white', 'border-tertiary-text');
  selectedOpt.classList.remove('bg-secondary-bg', 'text-primary-text', 'border-secondary-border', 'hover:border-tertiary-text', 'hover:bg-tertiary-bg');
}
</script>

<section class="text-center py-20">
  <h2 class="text-primary-text text-3xl font-bold pb-12">
    AI-native connectivity for agentic applications
  </h2>
  <div class="flex flex-col md:flex-row text-start gap-8 items-center md:items-stretch justify-center mx-6 min-h-36">
    <a class="bg-secondary-bg rounded-xl md:max-w-96 p-4 border-secondary-border border-[1px] hover:border-primary-border" href="/docs/mcp/">
      <h3 class="font-bold text-primary-text">
        <span class="text-tertiary-text">Tool Federation</span>
      </h3>
      <p class="text-secondary-text text-sm">
        Provide a single MCP endpoint for all the tools your agents consume, with unified security, observability, and governance for all agent-to-tool communication.
      </p>
    </a>
    <a class="bg-secondary-bg rounded-xl md:max-w-96 p-4 border-secondary-border border-[1px] hover:border-primary-border" href="/docs/mcp/connect/">
      <h3 class="font-bold  text-primary-text">
        <span class="text-tertiary-text">Unified Connectivity</span>
      </h3>
      <p class="text-secondary-text text-sm">
        Support for industry standard AI protocols for agent and tool connectivity including A2A and MCP with the ability to automatically expose existing REST APIs as MCP-native tools.
      </p>
    </a>
    <a class="bg-secondary-bg rounded-xl md:max-w-96 p-4 border-secondary-border border-[1px] hover:border-primary-border" href="/docs/quickstart/#step-3-explore-the-ui">
      <h3 class="font-bold  text-primary-text">
        <span class="text-tertiary-text">Developer Portal</span>
      </h3>
      <p class="text-secondary-text text-sm">
        Self-service developer portal for agent and tool developers to create, configure, discover, and debug tools and agents from a single pane of glass UI.
      </p>
    </a>
  </div>
</section>

<!-- Community Meeting Section -->
<section class="py-16 bg-primary-bg" id="community-meeting">
  <div class="max-w-5xl mx-auto px-6">
    <h2 class="text-primary-text text-3xl lg:text-4xl font-bold text-center mb-4">Join the Community</h2>
    <p class="text-center text-secondary-text text-lg mb-8 max-w-3xl mx-auto">
      Calling all agent creators, tool providers, platform engineers, and AI enthusiasts - come build the future of AI agent connectivity.
    </p>
    <div class="flex justify-center gap-4 mb-12">
      {{< button style="secondary" href="https://discord.gg/y9efgEmppm" text="Discord" icon="discord" >}}
      {{< button style="secondary" href="https://github.com/agentgateway/agentgateway" text="GitHub" icon="github" >}}
    </div>
    {{< community-meeting >}}
  </div>
</section>

{{< quotes-carousel >}}

<section class="text-center py-20 bg-secondary-bg">
  <h2 class="text-primary-text text-3xl font-bold pb-12">
    Solving AI Connectivity Challenges
  </h2>
  <div class="text-start max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
    <div class="bg-tertiary-bg rounded-xl p-4 border-secondary-border border-[1px]">
      <h3 class="font-bold text-primary-text">
        <span class="text-tertiary-text">Agent and Tool Interoperability</span>
      </h3>
      <p class="text-secondary-text text-sm">
        Built on the leading industry protocols for agent and tool connectivity, agentgateway allows you to seamlessly integrate any agent and tool supporting A2A and MCP.
      </p>
    </div>
    <div class="bg-tertiary-bg rounded-xl p-4 border-secondary-border border-[1px]">
      <h3 class="font-bold text-primary-text">
        <span class="text-tertiary-text">Agent Governance</span>
      </h3>
      <p class="text-secondary-text text-sm">
        Agentic applications will be composed of multiple tools and agents working together to achieve a goal, creating a fragmented landscape for security and observability. Agentgateway is a drop-in solution transparent to agents and tools to secure, govern, and audit agent and tool communications.
      </p>
    </div>
    <div class="bg-tertiary-bg rounded-xl p-4 border-secondary-border border-[1px]">
      <h3 class="font-bold text-primary-text">
        <span class="text-tertiary-text">Tool Sprawl</span>
      </h3>
      <p class="text-secondary-text text-sm">
        Agent development will never scale treating every tool integration as a 1:1 integration. Agentgateway provides a federated MCP endpoint with a centralized registry, self-service discovery, and dynamic configuration of agents and tools.
      </p>
    </div>
    <div class="bg-tertiary-bg rounded-xl p-4 border-secondary-border border-[1px]">
      <h3 class="font-bold text-primary-text">
        <span class="text-tertiary-text">Leveraging Existing APIs</span>
      </h3>
      <p class="text-secondary-text text-sm">
        No need to create custom MCP tool server implementations for every REST API you have today. Agentgateway automatically translates OpenAPI resources into MCP tools ready to consume from agents.
      </p>
    </div>
  </div>
</section>
