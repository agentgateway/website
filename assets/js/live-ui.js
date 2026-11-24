// Guided tours for the embedded agentgateway UI on the homepage (layouts/partials/live-ui.html).
// The UI itself is the real agentgateway admin UI in an iframe (static/live-ui/), backed by an
// in-browser mock. This script navigates it, highlights parts of the page, and keeps the
// fake address bar in sync.
(() => {
	const root = document.querySelector('[data-lu]');
	if (!root) return;
	const $ = (s, el = root) => el.querySelector(s);
	const $$ = (s, el = root) => [...el.querySelectorAll(s)];
	const frame = $('[data-lu-frame]');
	const stage = $('[data-lu-stage]');
	const ring = $('[data-lu-ring]');
	const pop = $('[data-lu-pop]');
	const panel = $('[data-lu-panel]');
	const tab = $('[data-lu-tab]');
	const panelToggle = $('[data-lu-panel-toggle]');
	const doc = () => { try { return frame.contentDocument; } catch { return null; } };
	// Load the UI from this page's own host so the tour can reach into it (see the partial).
	// Match the embedded UI's theme to the site's. The UI reads localStorage.theme on start
	// (same origin, so we can set it first) and afterwards only changes theme through its own
	// toggle button, so a later site toggle clicks that button.
	const siteTheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
	function syncTheme() {
		const want = siteTheme();
		try { localStorage.setItem('theme', want); } catch {}
		const d = doc(), have = d?.documentElement?.dataset.theme;
		if (!d?.body?.childElementCount) return;
		const current = have === 'dark' ? 'dark' : 'light';
		if (current !== want) d.querySelector('button[aria-label="Toggle theme"]')?.click();
	}
	try { localStorage.setItem('theme', siteTheme()); } catch {}
	new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

	// canonifyURLs rewrites data-src too, so keep only its path.
	if (frame.dataset.src && !frame.getAttribute('src')) frame.src = location.origin + new URL(frame.dataset.src, location.href).pathname;

	// Finders run inside the embedded UI. Each returns the element to highlight.
	const byText = (selector, text) => d => [...d.querySelectorAll(selector)].find(el => el.textContent.trim() === text);
	const button = text => byText('main button', text);
	const table = d => d.querySelector('main table');
	const cardOf = find => d => { const el = find(d); return el?.closest('section') || el?.closest('.card, .panel') || el; };
	// The smallest ancestor of `find` whose text also includes `text` (for example a row of filters).
	const rowOf = (find, text) => d => { let el = find(d); while (el && el !== d.body && !el.textContent.includes(text)) el = el.parentElement; return el; };
	const lastTextarea = d => [...d.querySelectorAll('textarea')].pop();

	const TOURS = {
		general: {
			name: 'General overview',
			steps: [
				{ path: '/', find: d => d.querySelector('.page-stack'), t: 'One gateway, every kind of agent traffic', b: 'This is the agentgateway UI. LLM calls, MCP tool calls, A2A, and plain HTTP all go through one open source data plane, configured from here.' },
				{ path: '/llm/models', find: table, t: 'Every provider behind one API', b: 'OpenAI, Anthropic, Bedrock, Gemini, Vertex, Azure, Mistral, and Ollama behind one OpenAI-compatible endpoint. Virtual models add failover and weighted routing.' },
				{ path: '/llm/keys', find: table, t: 'A key and a budget for every team', b: 'Hand out virtual keys instead of provider keys. Each one has its own model allowlist and token or dollar budgets, enforced at the gateway.' },
				{ path: '/llm/guardrails', find: d => d.querySelector('.page-stack > :nth-child(2)') || d.querySelector('main'), t: 'Guardrails on every prompt', b: 'Reject prompt injection and mask PII before anything leaves your network, and mask what comes back.' },
				{ path: '/llm/playground', find: lastTextarea, t: 'Try it', b: 'Send a prompt with an email address or a card number, or ask the model to ignore its instructions, and see what the guardrails do.' },
				{ path: '/llm/logs', find: table, t: 'Every call, live', b: 'Who sent it, from which harness, to which model, with tokens, cache hits, cost, and the full payload. Turn on Stream to watch traffic arrive, or open a row.' },
				{ path: '/llm/analytics?groupBy=model&metric=cost', find: cardOf(byText('h2, h3, div, span', 'Traffic over time')), t: 'Spend and usage, sliced any way', b: 'Group cost, tokens, or requests by model, user, harness, key, or provider, and see where the money goes.' },
				{ path: '/mcp/playground', find: d => [...d.querySelectorAll('button')].find(b => /Initialize|Reset/.test(b.textContent)), t: 'MCP through the same gateway', b: 'One endpoint for every tool on GitHub, DeepWiki, Context7, Kubernetes, and more. Initialize a session and call a tool.' }
			]
		},
		build: {
			name: 'Build an LLM gateway',
			steps: [
				{ path: '/llm/models', find: button('Add model'), t: 'Add a model', b: 'Pick a provider, a model, and a credential. OpenAI, Anthropic, Bedrock, Gemini, Vertex, Azure, Mistral, Ollama, or any OpenAI-compatible server. Click it to see the form.' },
				{ path: '/llm/models', find: table, t: 'One endpoint for all of them', b: 'Every model here is served from the same OpenAI-compatible API. Apps ask for a model by name, and the gateway handles each provider\'s API and credentials.' },
				{ path: '/llm/models', find: button('Add virtual model'), t: 'Failover and load balancing', b: 'A virtual model is a name your apps call, backed by several real models. Fail over when a provider is down, or split traffic by weight.' },
				{ path: '/llm/keys', find: button('New key'), t: 'Hand out virtual keys', b: 'Give each team or agent its own key instead of your provider keys. Limit which models it can use and set token or dollar budgets.' },
				{ path: '/llm/guardrails', find: d => d.querySelector('.page-stack > :nth-child(2)') || d.querySelector('main'), t: 'Add guardrails', b: 'Block prompt injection and mask emails, card numbers, and secrets on the way in, and mask responses on the way out.' },
				{ path: '/llm/client-setup', find: cardOf(byText('h2, h3, h4, div, span', 'curl')), t: 'Connect your apps', b: 'Pick a model and a key, and get ready-to-paste setup for curl, the OpenAI and Anthropic SDKs, and coding agents.' },
				{ path: '/llm/playground', find: lastTextarea, t: 'Send a request', b: 'Try a prompt through the gateway. Include an email address, or ask the model to ignore its instructions, and watch the guardrails act.' },
				{ path: '/llm/logs', find: table, t: 'See it in the logs', b: 'Every request shows up here with the key, model, tokens, cost, guardrail results, and the full payload. Open a row for the details.' }
			]
		},
		cost: {
			name: 'Cost & analytics',
			steps: [
				{ path: '/llm/analytics?groupBy=model&metric=cost', find: cardOf(byText('h2, h3, div, span', 'Traffic over time')), t: 'Spend over time', b: 'Cost per model per hour, from the gateway\'s own logs. Switch to tokens or requests, or change the time range. No extra pipeline to run.' },
				{ path: '/llm/analytics?groupBy=model&metric=cost', find: rowOf(button('All models'), 'All user agents'), t: 'Filter to what you care about', b: 'Narrow it to one model, user, group, provider, or harness, such as Claude Code, Codex, Cursor, or your own agents.' },
				{ path: '/llm/analytics?groupBy=model&metric=cost', find: cardOf(byText('h2, h3, div, span', 'Breakdown')), t: 'Which models cost the most', b: 'Total spend for each model over the time range, including virtual models like smart and fast.' },
				{ path: '/llm/analytics?groupBy=userAgent&metric=cost', find: cardOf(byText('h2, h3, div, span', 'Breakdown')), t: 'Spend by harness', b: 'The same data grouped by the client that sent it: Claude Code, Cursor, Codex, kagent, and the rest. Group by user or team the same way.' },
				{ path: '/llm/costs', find: d => d.querySelector('.page-stack') || table(d), t: 'Prices for every model', b: 'Cost comes from a model price catalog, including cache reads and writes. Add custom prices for your own or negotiated models.' },
				{ path: '/llm/keys', find: table, t: 'Budgets that are enforced', b: 'Each key can have token or dollar budgets over a rolling window. The bars show usage, and the gateway blocks requests once a budget runs out.' },
				{ path: '/llm/logs', find: table, t: 'Cost on every request', b: 'Each log row has the tokens, cache hits, and cost of that one call. Open a row to see the breakdown and the full prompt.' }
			]
		}
	};

	let tourOn = false, tour = TOURS.general, step = 0, target = null;
	const navigate = path => frame.contentWindow?.__agwMock?.navigate(path);
	const wait = ms => new Promise(r => setTimeout(r, ms));

	async function findWithRetry(fn) {
		for (let i = 0; i < 20; i++) {
			const d = doc();
			const el = d && (fn(d) || null);
			if (el && el.getBoundingClientRect().height > 0) return el;
			await wait(100);
		}
		return doc()?.querySelector('main') || null;
	}

	function place() {
		if (!tourOn) return;
		const sr = stage.getBoundingClientRect();
		const W = sr.width, H = sr.height;
		let x = 0, y = 0, w = 0, h = 0;
		if (target && !target.isConnected) { const d = doc(); target = d && tour.steps[step].find(d); }
		if (target) {
			const r = target.getBoundingClientRect(); // frame coordinates equal stage coordinates
			x = Math.max(0, r.left); y = Math.max(0, r.top);
			w = Math.min(W, r.right) - x; h = Math.min(H, r.bottom) - y;
		}
		if (w > 0 && h > 0) { Object.assign(ring.style, { left: x - 4 + 'px', top: y - 4 + 'px', width: w + 8 + 'px', height: h + 8 + 'px' }); ring.classList.remove('hidden'); }
		else ring.classList.add('hidden');
		const pw = pop.offsetWidth, ph = pop.offsetHeight;
		let px, py;
		if (W < 640) { px = 16; py = H - ph - 16; }
		else {
			px = Math.min(Math.max(16, x + w - pw), W - pw - 16);
			if (y + h + 14 + ph < H - 8) py = y + h + 14;
			else if (y - 14 - ph > 8) py = y - 14 - ph;
			else { py = H - ph - 20; px = Math.min(240, W - pw - 24); }
		}
		Object.assign(pop.style, { left: px + 'px', top: py + 'px' });
	}

	async function show(i) {
		step = i;
		const steps = tour.steps, s = steps[i];
		$('[data-lu-step]').textContent = `${tour.name} · ${i + 1} of ${steps.length}`;
		$('[data-lu-ttitle]').textContent = s.t;
		$('[data-lu-tbody]').textContent = s.b;
		$('[data-lu-prev]').disabled = i === 0;
		$('[data-lu-next]').textContent = i === steps.length - 1 ? 'Finish' : 'Next';
		pop.classList.remove('hidden');
		const here = () => frame.contentWindow?.location.pathname.replace(/^\/live-ui/, '') || '/';
		const [want, query = ''] = s.path.split('?');
		const samePath = here().replace(/\/$/, '') === want.replace(/\/$/, '');
		const sameQuery = (frame.contentWindow?.location.search || '').replace(/^\?/, '') === query;
		if (samePath && !sameQuery) { navigate(s.path); await wait(600); }
		if (!samePath) {
			const old = doc()?.querySelector('main')?.firstElementChild;
			navigate(s.path);
			frame.contentWindow?.scrollTo(0, 0);
			// Wait for the route to change and the new page to replace the old one.
			for (let n = 0; n < 30; n++) {
				const path = here();
				const main = doc()?.querySelector('main')?.firstElementChild;
				if ((path === want || path === want + '/') &&(n > 3 || main !== old)) break;
				await wait(100);
			}
			await wait(250);
		}
		target = await findWithRetry(s.find);
		if (step !== i || tour.steps !== steps) return;
		// Bring the target's top into view inside the embedded UI, leaving the homepage alone.
		const top = target?.getBoundingClientRect().top ?? 0;
		if (top < 0 || top > stage.clientHeight * 0.6) frame.contentWindow?.scrollBy(0, top - 80);
		requestAnimationFrame(place);
	}
	function startTour(name) {
		tour = TOURS[name] || TOURS.general;
		tourOn = true; setPanel(false); tab.style.display = 'none';
		// The frame is lazy; if it hasn't loaded yet, start once it has.
		if (doc()?.body?.childElementCount) show(0);
		else frame.addEventListener('load', () => show(0), { once: true });
	}
	function endTour() { tourOn = false; target = null; ring.classList.add('hidden'); pop.classList.add('hidden'); tab.style.display = ''; }

	// Tour picker side panel. Closed, it collapses to a tab on the right edge.
	let panelOpen = false;
	function setPanel(open) {
		panelOpen = open;
		panel.dataset.open = tab.dataset.open = String(open);
		panel.inert = !open;
		panelToggle.setAttribute('aria-expanded', String(open));
		tab.setAttribute('aria-expanded', String(open));
	}
	setPanel(false);
	panelToggle.addEventListener('click', () => setPanel(!panelOpen));
	tab.addEventListener('click', () => setPanel(true));
	$('[data-lu-panel-close]').addEventListener('click', () => setPanel(false));
	// Slide the panel open the first time the demo scrolls into view (not on phones,
	// where it would cover the whole UI).
	if ('IntersectionObserver' in window) {
		const io = new IntersectionObserver(entries => {
			if (!entries.some(e => e.isIntersecting)) return;
			io.disconnect();
			if (innerWidth >= 768 && !tourOn) setTimeout(() => !tourOn && setPanel(true), 500);
		}, { threshold: 0.35 });
		io.observe(stage);
	}

	$$('[data-lu-tour-start]').forEach(b => b.addEventListener('click', () => startTour(b.dataset.luTourStart)));
	$('[data-lu-tour-end]').addEventListener('click', endTour);
	$('[data-lu-next]').addEventListener('click', () => (step < tour.steps.length - 1 ? show(step + 1) : endTour()));
	$('[data-lu-prev]').addEventListener('click', () => step > 0 && show(step - 1));
	addEventListener('resize', place);
	addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (tourOn) endTour(); else if (panelOpen) setPanel(false); });

	// Inside the frame: follow scrolling and clicks, and mirror the route in the fake address bar.
	// Clicking into the UI tucks the panel away so it doesn't cover what the visitor is using.
	frame.addEventListener('load', () => {
		const d = doc(); if (!d) return;
		setTimeout(syncTheme, 300);
		d.addEventListener('scroll', () => tourOn && place(), { capture: true, passive: true });
		d.addEventListener('pointerdown', e => {
			if (panelOpen) setPanel(false);
			if (tourOn && !e.target.closest('textarea, input, select')) setTimeout(() => tourOn && place(), 50);
		});
	});
	let lastPath = '';
	setInterval(() => {
		let p = '';
		try { p = frame.contentWindow.location.pathname.replace(/^\/live-ui/, '/ui'); } catch { return; }
		if (p && p !== lastPath) { lastPath = p; $('[data-lu-path]').textContent = p; if (tourOn) setTimeout(place, 300); }
	}, 400);
})();
