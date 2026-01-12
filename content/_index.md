---
title: agentgateway
toc: false
description: ""
---

<section class="text-white pt-[7.875rem] bg-center bg-no-repeat bg-[length:61.85319rem_60.14119rem] lg:bg-auto">
  <div class="py-8 lg:py-16 flex flex-col lg:flex-row items-center px-6 border-b-[1px] border-b-secondary-border gap-12 lg:gap-16 max-w-7xl mx-auto">
    <div class="text-center lg:text-left flex-1">
      <h1 class="text-3xl/tight lg:text-5xl/tight xl:text-6xl/tight max-w-2xl font-bold mt-6 font-heading">Agent <span class="text-tertiary-text">Connectivity</span> Solved</h1>
      <p class="text-xl max-w-xl font-semibold mt-6 lg:mt-10 font-heading text-secondary-text">
        Agentgateway is an open source project that is built on AI-native protocols to connect, secure, and observe agent-to-agent and agent-to-tool communication across any agent framework and environment.
      </p>
      <div class="flex flex-wrap justify-center lg:justify-start gap-4 pt-10">
        {{< button style="primary" href="/docs/quickstart/" iconRight="true" text="Get Started" icon="arrow-right" >}}
        {{< button style="secondary" href="https://github.com/agentgateway/agentgateway" text="View on GitHub" icon="github" >}}
        {{< button style="secondary" href="https://discord.gg/y9efgEmppm" text="Discord" icon="discord" >}}
      </div>
    </div>
    <div class="flex-1 flex justify-center lg:justify-end">
      <div class="relative w-full max-w-[600px] group/slider">
        <img id="hero-slide-1" src="/hero.png" width="600" height="450" class="hero-slide object-cover max-w-full transition-opacity duration-700 opacity-100" />
        <img id="hero-slide-2" src="/hero2.png" width="600" height="450" class="hero-slide object-cover max-w-full transition-opacity duration-700 opacity-0 absolute inset-0 m-auto" />
        <button onclick="prevSlide()" class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary-bg/80 hover:bg-tertiary-bg text-secondary-text hover:text-primary-text transition-all opacity-0 group-hover/slider:opacity-100 flex items-center justify-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <button onclick="nextSlide()" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary-bg/80 hover:bg-tertiary-bg text-secondary-text hover:text-primary-text transition-all opacity-0 group-hover/slider:opacity-100 flex items-center justify-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
        <div class="flex justify-center gap-2 mt-4">
          <button onclick="goToSlide(0)" id="dot-0" class="hero-dot w-2 h-2 rounded-full bg-tertiary-text transition-colors"></button>
          <button onclick="goToSlide(1)" id="dot-1" class="hero-dot w-2 h-2 rounded-full bg-secondary-text/50 hover:bg-secondary-text transition-colors"></button>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="py-16 bg-secondary-bg" id="get-started">
<div class="max-w-3xl mx-auto px-6">
<h2 class="text-primary-text text-4xl lg:text-5xl font-bold text-center mb-8">Get Started</h2>
<div class="bg-tertiary-bg rounded-xl border border-secondary-border overflow-hidden">
<div class="flex border-b border-secondary-border">
<button onclick="showTab('binary')" id="tab-binary" class="get-started-tab flex-1 px-4 py-3 text-sm font-medium bg-primary-bg text-primary-text border-b-2 border-tertiary-text">Binary</button>
<button onclick="showTab('docker')" id="tab-docker" class="get-started-tab flex-1 px-4 py-3 text-sm font-medium text-secondary-text hover:text-primary-text border-b-2 border-transparent">Docker</button>
<button onclick="showTab('kubernetes')" id="tab-kubernetes" class="get-started-tab flex-1 px-4 py-3 text-sm font-medium text-secondary-text hover:text-primary-text border-b-2 border-transparent">Kubernetes</button>
</div>
<div class="p-6">
<div id="content-binary" class="get-started-content">
<div class="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-secondary-border">
<span class="text-primary-text text-sm font-medium mr-1">Use case:</span>
<button onclick="showBinaryOption('quickstart')" id="binary-opt-quickstart" class="binary-option px-4 py-2 text-sm font-semibold rounded-lg bg-tertiary-text text-white border-2 border-tertiary-text transition-all">Quick Start</button>
<button onclick="showBinaryOption('llm')" id="binary-opt-llm" class="binary-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">LLM Consumption</button>
<button onclick="showBinaryOption('mcp')" id="binary-opt-mcp" class="binary-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">MCP Connectivity</button>
<button onclick="showBinaryOption('agent')" id="binary-opt-agent" class="binary-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">Agent Connectivity</button>
</div>
<div id="binary-quickstart" class="binary-content">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Install agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl https://agentgateway.dev/install | bash</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Download config and run
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl -sL https://agentgateway.dev/examples/basic/config.yaml -o config.yaml<br>agentgateway -f config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="mt-4 pt-4 border-t border-secondary-border flex items-center justify-between">
<span class="text-white text-base font-medium">To view in GUI, open <a href="http://localhost:15000" class="text-white hover:underline">localhost:15000</a></span>
<a href="/docs/quickstart/" class="text-tertiary-text hover:underline text-sm font-medium">Full docs →</a>
</div>
</div>
</div>
<div id="binary-llm" class="binary-content hidden">
<div class="space-y-4">
<div class="flex items-center gap-3 mb-2">
<span class="text-secondary-text text-sm">Provider:</span>
<select id="binary-llm-provider-select" onchange="switchBinaryLLMProvider(this.value)" class="bg-primary-bg text-primary-text text-sm rounded-lg border border-secondary-border px-3 py-1.5 focus:outline-none focus:border-tertiary-text">
<option value="openai" selected>OpenAI (Default)</option>
<option value="gemini">Gemini</option>
<option value="anthropic">Anthropic</option>
<option value="bedrock">Amazon Bedrock</option>
</select>
</div>
<div class="relative group mb-2">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12"><span id="binary-llm-export">export OPENAI_API_KEY=your-api-key</span></div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div id="binary-llm-openai" class="binary-llm-provider-content">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Install agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentgateway | bash</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Download config and run
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl -sL https://agentgateway.dev/configs/binary-llm-openai.yaml -o config.yaml<br>OPENAI_API_KEY=$OPENAI_API_KEY agentgateway -f config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Test with a chat completion
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl http://localhost:3000/v1/chat/completions \<br>  -H "Content-Type: application/json" \<br>  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
</div>
</div>
<div id="binary-llm-gemini" class="binary-llm-provider-content hidden">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Install agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentgateway | bash</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Download config and run
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl -sL https://agentgateway.dev/configs/binary-llm-gemini.yaml -o config.yaml<br>GEMINI_API_KEY=$GEMINI_API_KEY agentgateway -f config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Test with a chat completion
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl http://localhost:3000/v1/chat/completions \<br>  -H "Content-Type: application/json" \<br>  -d '{"model":"gemini-1.5-flash","messages":[{"role":"user","content":"Hello!"}]}'</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
</div>
</div>
<div id="binary-llm-anthropic" class="binary-llm-provider-content hidden">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Install agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentgateway | bash</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Download config and run
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl -sL https://agentgateway.dev/configs/binary-llm-anthropic.yaml -o config.yaml<br>ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY agentgateway -f config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Test with a chat completion
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl http://localhost:3000/v1/chat/completions \<br>  -H "Content-Type: application/json" \<br>  -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"Hello!"}]}'</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
</div>
</div>
<div id="binary-llm-bedrock" class="binary-llm-provider-content hidden">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Install agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentgateway | bash</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Download config and run
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl -sL https://agentgateway.dev/configs/binary-llm-bedrock.yaml -o config.yaml<br>AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \<br>  AWS_REGION=$AWS_REGION agentgateway -f config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Test with a chat completion
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl http://localhost:3000/v1/chat/completions \<br>  -H "Content-Type: application/json" \<br>  -d '{"model":"anthropic.claude-3-sonnet-20240229-v1:0","messages":[{"role":"user","content":"Hello!"}]}'</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
</div>
</div>
<div class="mt-4 pt-4 border-t border-secondary-border flex items-center justify-between">
<span class="text-white text-base font-medium">To view in GUI, open <a href="http://localhost:15000" class="text-white hover:underline">localhost:15000</a></span>
<a href="/docs/llm/providers/" class="text-tertiary-text hover:underline text-sm font-medium">View more providers →</a>
</div>
</div>
</div>
<div id="binary-mcp" class="binary-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Connect and federate MCP servers through agentgateway. Learn how to configure different connection types and policies.</p>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<a href="/docs/mcp/connect/stdio/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Stdio</span>
<p class="text-secondary-text text-xs mt-1">Spawn MCP servers as child processes</p>
</a>
<a href="/docs/mcp/connect/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">MCP Multiplexing</span>
<p class="text-secondary-text text-xs mt-1">Federate multiple MCP servers</p>
</a>
<a href="/docs/llm/providers/openai/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">OpenAI</span>
<p class="text-secondary-text text-xs mt-1">Connect MCP to OpenAI models</p>
</a>
<a href="/docs/mcp/authn/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Authentication</span>
<p class="text-secondary-text text-xs mt-1">Secure MCP connections</p>
</a>
<a href="/docs/mcp/authz/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Authorization</span>
<p class="text-secondary-text text-xs mt-1">Control access to MCP tools</p>
</a>
<a href="/docs/mcp/observability/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Observability</span>
<p class="text-secondary-text text-xs mt-1">Monitor MCP traffic</p>
</a>
</div>
</div>
</div>
<div id="binary-agent" class="binary-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Enable agent-to-agent communication with A2A protocol support.</p>
<div class="flex justify-center">
<a href="/docs/agent/a2a/" class="block p-4 px-8 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors text-center">
<span class="text-primary-text text-sm font-medium">A2A Protocol</span>
<p class="text-secondary-text text-xs mt-1">Agent-to-agent communication</p>
</a>
</div>
</div>
</div>
</div>
<div id="content-docker" class="get-started-content hidden">
<div class="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-secondary-border">
<span class="text-primary-text text-sm font-medium mr-1">Use case:</span>
<button onclick="showDockerOption('llm')" id="docker-opt-llm" class="docker-option px-4 py-2 text-sm font-semibold rounded-lg bg-tertiary-text text-white border-2 border-tertiary-text transition-all">LLM Consumption</button>
<button onclick="showDockerOption('mcp')" id="docker-opt-mcp" class="docker-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">MCP Connectivity</button>
<button onclick="showDockerOption('agent')" id="docker-opt-agent" class="docker-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">Agent Connectivity</button>
</div>
<div id="docker-mcp" class="docker-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Connect and federate MCP servers through agentgateway. Learn how to configure different connection types and policies.</p>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<a href="/docs/mcp/connect/stdio/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Stdio</span>
<p class="text-secondary-text text-xs mt-1">Spawn MCP servers as child processes</p>
</a>
<a href="/docs/mcp/connect/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">MCP Multiplexing</span>
<p class="text-secondary-text text-xs mt-1">Federate multiple MCP servers</p>
</a>
<a href="/docs/llm/providers/openai/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">OpenAI</span>
<p class="text-secondary-text text-xs mt-1">Connect MCP to OpenAI models</p>
</a>
<a href="/docs/mcp/authn/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Authentication</span>
<p class="text-secondary-text text-xs mt-1">Secure MCP connections</p>
</a>
<a href="/docs/mcp/authz/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Authorization</span>
<p class="text-secondary-text text-xs mt-1">Control access to MCP tools</p>
</a>
<a href="/docs/mcp/observability/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Observability</span>
<p class="text-secondary-text text-xs mt-1">Monitor MCP traffic</p>
</a>
</div>
</div>
</div>
<div id="docker-agent" class="docker-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Enable agent-to-agent communication with A2A protocol support.</p>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<a href="/docs/agent/a2a/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">A2A Protocol</span>
<p class="text-secondary-text text-xs mt-1">Agent-to-agent communication</p>
</a>
</div>
</div>
</div>
<div id="docker-llm" class="docker-content">
<div class="space-y-4">
<div class="flex items-center gap-3 mb-2">
<span class="text-secondary-text text-sm">Provider:</span>
<select id="llm-provider-select" onchange="switchLLMProvider(this.value)" class="bg-primary-bg text-primary-text text-sm rounded-lg border border-secondary-border px-3 py-1.5 focus:outline-none focus:border-tertiary-text">
<option value="openai" selected>OpenAI (Default)</option>
<option value="gemini">Gemini</option>
<option value="anthropic">Anthropic</option>
<option value="bedrock">Amazon Bedrock</option>
</select>
</div>
<div class="relative group mb-2">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12"><span id="docker-llm-export">export OPENAI_API_KEY=your-api-key</span></div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div id="llm-openai" class="llm-provider-content">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Download config.yaml for OpenAI
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl -sL https://agentgateway.dev/configs/docker-llm-openai.yaml -o config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Run agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">docker run -v ./config.yaml:/config.yaml -p 3000:3000 \<br>  -e OPENAI_API_KEY=$OPENAI_API_KEY \<br>  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Test with a chat completion
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl http://localhost:3000/v1/chat/completions \<br>  -H "Content-Type: application/json" \<br>  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
</div>
</div>
<div id="llm-gemini" class="llm-provider-content hidden">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Download config.yaml for Gemini
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl -sL https://agentgateway.dev/configs/docker-llm-gemini.yaml -o config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Run agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">docker run -v ./config.yaml:/config.yaml -p 3000:3000 \<br>  -e GEMINI_API_KEY=$GEMINI_API_KEY \<br>  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Test with a chat completion
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl http://localhost:3000/v1/chat/completions \<br>  -H "Content-Type: application/json" \<br>  -d '{"model":"gemini-1.5-flash","messages":[{"role":"user","content":"Hello!"}]}'</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
</div>
</div>
<div id="llm-anthropic" class="llm-provider-content hidden">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Download config.yaml for Anthropic
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl -sL https://agentgateway.dev/configs/docker-llm-anthropic.yaml -o config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Run agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">docker run -v ./config.yaml:/config.yaml -p 3000:3000 \<br>  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \<br>  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Test with a chat completion
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl http://localhost:3000/v1/chat/completions \<br>  -H "Content-Type: application/json" \<br>  -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"Hello!"}]}'</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
</div>
</div>
<div id="llm-bedrock" class="llm-provider-content hidden">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Download config.yaml for Amazon Bedrock
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl -sL https://agentgateway.dev/configs/docker-llm-bedrock.yaml -o config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Run agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">docker run -v ./config.yaml:/config.yaml -p 3000:3000 \<br>  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \<br>  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \<br>  -e AWS_REGION=$AWS_REGION \<br>  cr.agentgateway.dev/agentgateway:0.11.1 -f /config.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Test with a chat completion
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">curl http://localhost:3000/v1/chat/completions \<br>  -H "Content-Type: application/json" \<br>  -d '{"model":"anthropic.claude-3-sonnet-20240229-v1:0","messages":[{"role":"user","content":"Hello!"}]}'</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
</div>
</div>
<div class="mt-4 pt-4 border-t border-secondary-border flex items-center justify-end">
<a href="/docs/llm/providers/" class="text-tertiary-text hover:underline text-sm font-medium">View more providers →</a>
</div>
</div>
</div>
</div>
<div id="content-kubernetes" class="get-started-content hidden">
<div class="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-secondary-border">
<span class="text-primary-text text-sm font-medium mr-1">Use case:</span>
<button onclick="showK8sOption('quickstart')" id="k8s-opt-quickstart" class="k8s-option px-4 py-2 text-sm font-semibold rounded-lg bg-tertiary-text text-white border-2 border-tertiary-text transition-all">Quick Start</button>
<button onclick="showK8sOption('llm')" id="k8s-opt-llm" class="k8s-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">LLM Consumption</button>
<button onclick="showK8sOption('inference')" id="k8s-opt-inference" class="k8s-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">Inference Routing</button>
<button onclick="showK8sOption('mcp')" id="k8s-opt-mcp" class="k8s-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">MCP Connectivity</button>
<button onclick="showK8sOption('agent')" id="k8s-opt-agent" class="k8s-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">Agent Connectivity</button>
<button onclick="showK8sOption('rbac')" id="k8s-opt-rbac" class="k8s-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">CEL-based RBAC</button>
<button onclick="showK8sOption('observability')" id="k8s-opt-observability" class="k8s-option px-4 py-2 text-sm font-semibold rounded-lg bg-secondary-bg text-primary-text border-2 border-secondary-border hover:border-tertiary-text hover:bg-tertiary-bg transition-all">Observability</button>
</div>
<div id="k8s-quickstart" class="k8s-content">
<div class="space-y-4">
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Install Gateway API CRDs
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/standard-install.yaml</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Install agentgateway CRDs
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">helm upgrade -i agentgateway-crds oci://ghcr.io/kgateway-dev/charts/agentgateway-crds \<br>  --create-namespace --namespace agentgateway-system --version v2.2.0-main</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="flex items-center gap-3 text-primary-text text-sm">
<span class="text-tertiary-text font-mono">#</span> Deploy agentgateway
</div>
<div class="relative group">
<div class="bg-primary-bg rounded-lg p-4 font-mono text-sm text-secondary-text overflow-x-auto pr-12">helm upgrade -i agentgateway oci://ghcr.io/kgateway-dev/charts/agentgateway \<br>  --namespace agentgateway-system --version v2.2.0-main</div>
<button onclick="copyCode(this)" class="absolute top-2 right-2 p-2 rounded-md bg-tertiary-bg hover:bg-secondary-border text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
</button>
</div>
<div class="mt-4 pt-4 border-t border-secondary-border flex items-center justify-between">
<span class="text-white text-base font-medium">Verify: <span class="font-mono text-sm">kubectl get pods -n agentgateway-system</span></span>
<a href="https://kgateway.dev/docs/agentgateway/main/quickstart/" class="text-tertiary-text hover:underline text-sm font-medium">Full docs →</a>
</div>
</div>
</div>
<div id="k8s-llm" class="k8s-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Proxy and manage requests to multiple LLM providers with unified authentication, rate limiting, and observability.</p>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<a href="https://kgateway.dev/docs/agentgateway/main/llm/providers/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Providers</span>
<p class="text-secondary-text text-xs mt-1">OpenAI, Anthropic, Azure, more</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/llm/api-keys/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Manage API Keys</span>
<p class="text-secondary-text text-xs mt-1">Centralized key management</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/llm/failover/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Model Failover</span>
<p class="text-secondary-text text-xs mt-1">Automatic failover between models</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/llm/prompt-guards/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Prompt Guards</span>
<p class="text-secondary-text text-xs mt-1">Set up prompt safety guards</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/llm/prompt-enrichment/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Enrich Prompts</span>
<p class="text-secondary-text text-xs mt-1">Add context to prompts</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/llm/functions/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Call Functions</span>
<p class="text-secondary-text text-xs mt-1">Function calling support</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/llm/guardrail-api/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Guardrail Webhook API</span>
<p class="text-secondary-text text-xs mt-1">Custom guardrail webhooks</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/llm/observability/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Metrics and Logs</span>
<p class="text-secondary-text text-xs mt-1">View metrics and logs</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/llm/tracing/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">View Traces</span>
<p class="text-secondary-text text-xs mt-1">Distributed tracing</p>
</a>
</div>
</div>
</div>
<div id="k8s-inference" class="k8s-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Intelligently route inference requests based on model availability, cost, and latency requirements.</p>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<a href="https://kgateway.dev/docs/agentgateway/main/inference/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Inference Routing</span>
<p class="text-secondary-text text-xs mt-1">Smart routing for inference</p>
</a>
</div>
</div>
</div>
<div id="k8s-mcp" class="k8s-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Connect and federate MCP servers through agentgateway with unified security and discovery.</p>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<a href="https://kgateway.dev/docs/agentgateway/main/mcp/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">MCP Gateway</span>
<p class="text-secondary-text text-xs mt-1">Federate MCP servers</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/mcp/authn/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Authentication</span>
<p class="text-secondary-text text-xs mt-1">Secure MCP connections</p>
</a>
<a href="https://kgateway.dev/docs/agentgateway/main/mcp/authz/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Authorization</span>
<p class="text-secondary-text text-xs mt-1">Control access to MCP tools</p>
</a>
</div>
</div>
</div>
<div id="k8s-agent" class="k8s-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Enable agent-to-agent communication with A2A protocol support.</p>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<a href="https://kgateway.dev/docs/agentgateway/main/agent/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">A2A Protocol</span>
<p class="text-secondary-text text-xs mt-1">Agent-to-agent communication</p>
</a>
</div>
</div>
</div>
<div id="k8s-rbac" class="k8s-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Define granular access control policies using Common Expression Language (CEL).</p>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<a href="https://kgateway.dev/docs/agentgateway/main/rbac/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">CEL-based RBAC</span>
<p class="text-secondary-text text-xs mt-1">Expression-based access control</p>
</a>
</div>
</div>
</div>
<div id="k8s-observability" class="k8s-content hidden">
<div class="space-y-4">
<p class="text-secondary-text text-sm">Monitor and observe all agent and tool traffic with built-in observability features.</p>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<a href="https://kgateway.dev/docs/agentgateway/main/observability/" class="block p-3 bg-primary-bg rounded-lg border border-secondary-border hover:border-tertiary-text transition-colors">
<span class="text-primary-text text-sm font-medium">Observability</span>
<p class="text-secondary-text text-xs mt-1">Metrics, logs, and tracing</p>
</a>
</div>
</div>
</div>
</div>
</div>
</div>
</section>

<section class="py-20" id="features">
<div class="max-w-4xl mx-auto px-6">
<h2 class="text-primary-text text-4xl lg:text-5xl font-bold text-center pb-4">Features</h2>
<p class="text-secondary-text text-center text-lg lg:text-xl pb-12 max-w-2xl mx-auto">Everything you need to connect, secure, and observe your AI infrastructure</p>
<div class="space-y-3" id="features-list">
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('llm')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
</svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">LLM Consumption</h3>
<p class="text-secondary-text text-sm">Proxy and manage requests to multiple LLM providers</p>
</div>
<svg id="chevron-llm" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
</svg>
</button>
<div id="detail-llm" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<p class="text-secondary-text text-sm mb-3">Route requests to OpenAI, Anthropic, Azure, and other LLM providers through a single unified gateway. Get built-in rate limiting, cost tracking, and observability across all your LLM traffic.</p>
<ul class="text-secondary-text text-sm space-y-1 mb-4">
<li>• Unified authentication across providers</li>
<li>• Request/response logging and metrics</li>
<li>• Cost attribution and budget controls</li>
<li>• Automatic failover between providers</li>
</ul>
<a id="usecase-llm" href="/docs/llm/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('inference')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
</svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">Inference Routing</h3>
<p class="text-secondary-text text-sm">Smart routing based on model, cost, and latency</p>
</div>
<svg id="chevron-inference" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
</svg>
</button>
<div id="detail-inference" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<p class="text-secondary-text text-sm mb-3">Intelligently route inference requests to the optimal backend based on model availability, cost constraints, latency requirements, or custom routing policies.</p>
<ul class="text-secondary-text text-sm space-y-1 mb-4">
<li>• Model-aware load balancing</li>
<li>• Cost-optimized routing policies</li>
<li>• Latency-based backend selection</li>
<li>• Custom CEL routing expressions</li>
</ul>
<a id="usecase-inference" href="/docs/inference/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('mcp')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path>
</svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">MCP Connectivity</h3>
<p class="text-secondary-text text-sm">Federate MCP tools from multiple servers</p>
</div>
<svg id="chevron-mcp" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
</svg>
</button>
<div id="detail-mcp" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<p class="text-secondary-text text-sm mb-3">Expose a single MCP endpoint that federates tools from multiple backend MCP servers. Agents connect once and get access to all available tools with unified security and discovery.</p>
<ul class="text-secondary-text text-sm space-y-1 mb-4">
<li>• Single endpoint for all MCP tools</li>
<li>• Automatic tool discovery and registration</li>
<li>• OpenAPI to MCP translation</li>
<li>• Tool-level access control</li>
</ul>
<a id="usecase-mcp" href="/docs/mcp/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('agent')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
</svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">Agent Connectivity</h3>
<p class="text-secondary-text text-sm">Secure agent-to-agent communication via A2A</p>
</div>
<svg id="chevron-agent" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
</svg>
</button>
<div id="detail-agent" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<p class="text-secondary-text text-sm mb-3">Enable secure communication between agents using the Agent-to-Agent (A2A) protocol. Discover, authenticate, and route messages between agents across different frameworks and environments.</p>
<ul class="text-secondary-text text-sm space-y-1 mb-4">
<li>• A2A protocol support</li>
<li>• Agent discovery and registration</li>
<li>• Cross-framework interoperability</li>
<li>• Message routing and observability</li>
</ul>
<a id="usecase-agent" href="/docs/agent/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>
<div class="feature-item bg-secondary-bg rounded-xl border border-secondary-border overflow-hidden">
<button onclick="toggleFeature('rbac')" class="w-full flex items-center gap-4 p-5 text-left hover:bg-tertiary-bg/50 transition-colors">
<div class="w-10 h-10 bg-tertiary-bg rounded-lg flex items-center justify-center shrink-0">
<svg class="w-5 h-5 text-tertiary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
</svg>
</div>
<div class="flex-1">
<h3 class="text-primary-text font-semibold">CEL-based RBAC</h3>
<p class="text-secondary-text text-sm">Fine-grained access control with CEL expressions</p>
</div>
<svg id="chevron-rbac" class="w-5 h-5 text-secondary-text transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
</svg>
</button>
<div id="detail-rbac" class="hidden px-5 pb-5">
<div class="pl-14 border-l-2 border-tertiary-text/30 ml-5">
<p class="text-secondary-text text-sm mb-3">Define granular access control policies using Common Expression Language (CEL). Control which agents can access which tools, models, and resources based on identity, context, and custom attributes.</p>
<ul class="text-secondary-text text-sm space-y-1 mb-4">
<li>• CEL expression-based policies</li>
<li>• Tool and model-level permissions</li>
<li>• Identity-aware access control</li>
<li>• Audit logging for compliance</li>
</ul>
<a id="usecase-rbac" href="/docs/configuration/security/" class="text-tertiary-text hover:underline text-sm font-medium">Learn more →</a>
</div>
</div>
</div>
</div>
</div>
</section>

<script>
const localLinks = {
  'usecase-llm': '/docs/llm/',
  'usecase-inference': '/docs/inference/',
  'usecase-mcp': '/docs/mcp/',
  'usecase-agent': '/docs/agent/',
  'usecase-rbac': '/docs/configuration/security/'
};
const k8sLinks = {
  'usecase-llm': 'https://kgateway.dev/docs/agentgateway/main/llm/',
  'usecase-inference': 'https://kgateway.dev/docs/agentgateway/main/inference/',
  'usecase-mcp': 'https://kgateway.dev/docs/agentgateway/main/mcp/',
  'usecase-agent': 'https://kgateway.dev/docs/agentgateway/main/agent/',
  'usecase-rbac': 'https://kgateway.dev/docs/agentgateway/main/rbac/'
};
function updateUseCaseLinks(isKubernetes) {
  const links = isKubernetes ? k8sLinks : localLinks;
  Object.keys(links).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = links[id];
  });
}
function showTab(tab) {
  document.querySelectorAll('.get-started-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.get-started-tab').forEach(el => {
    el.classList.remove('bg-primary-bg', 'text-primary-text', 'border-tertiary-text');
    el.classList.add('text-secondary-text', 'border-transparent');
  });
  document.getElementById('content-' + tab).classList.remove('hidden');
  const selectedTab = document.getElementById('tab-' + tab);
  selectedTab.classList.add('bg-primary-bg', 'text-primary-text', 'border-tertiary-text');
  selectedTab.classList.remove('text-secondary-text', 'border-transparent');
  updateUseCaseLinks(tab === 'kubernetes');
}
function toggleFeature(feature) {
  const detail = document.getElementById('detail-' + feature);
  const chevron = document.getElementById('chevron-' + feature);
  const isHidden = detail.classList.contains('hidden');
  if (isHidden) {
    detail.classList.remove('hidden');
    chevron.classList.add('rotate-180');
  } else {
    detail.classList.add('hidden');
    chevron.classList.remove('rotate-180');
  }
}
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
let currentSlide = 0;
const totalSlides = 2;
function goToSlide(index) {
  currentSlide = index;
  document.querySelectorAll('.hero-slide').forEach((slide, i) => {
    slide.classList.toggle('opacity-100', i === index);
    slide.classList.toggle('opacity-0', i !== index);
  });
  document.querySelectorAll('.hero-dot').forEach((dot, i) => {
    dot.classList.toggle('bg-tertiary-text', i === index);
    dot.classList.toggle('bg-secondary-text/50', i !== index);
  });
}
function nextSlide() {
  goToSlide((currentSlide + 1) % totalSlides);
}
function prevSlide() {
  goToSlide((currentSlide - 1 + totalSlides) % totalSlides);
}
setInterval(nextSlide, 5000);
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

{{< quotes-carousel >}}

{{< adopters >}}

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
