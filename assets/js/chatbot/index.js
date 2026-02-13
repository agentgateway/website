/**
 * Chatbot - Alpine.js component for the agentgateway assistant
 * Expects Alpine.js to be loaded globally via CDN
 *
 * State is persisted to sessionStorage so conversations survive
 * full-page navigations in this Hugo static site.
 */

import { ChatStreamer, ErrorType } from './stream.js';
import { ThinkingAnimator, MarkdownRenderer } from './ui.js';
import { parseMarkdown } from './markdown.js';

const AGENT_ENDPOINT = 'https://docs-search-agent.is.solo.io';
const STORAGE_KEY = 'chatbot-state';
const INPUT_STORAGE_KEY = 'chatbot-input';
const MAX_CONTEXT_PAGES = 3;
const INPUT_SAVE_DEBOUNCE_MS = 300;

/**
 * A URL is only eligible as a context page if it is same-origin AND
 * sits under a recognised docs version path.
 *   /docs/standalone/latest/...
 *   /docs/standalone/main/...
 *   /docs/kubernetes/latest/...
 *   /docs/kubernetes/main/...
 */
const DOCS_PATH_RE = /^\/docs\/(standalone|kubernetes)\/(latest|main)(\/|$)/;

/**
 * Load the page index embedded by Hugo at build time.
 * Returns an array of { title, url, section } objects.
 */
function loadPageIndex() {
  try {
    const el = document.getElementById('chatbot-page-index');
    if (el) return JSON.parse(el.textContent);
  } catch (e) {
    console.warn('Chatbot: could not load page index', e);
  }
  return [];
}

/**
 * Register chatbot component with Alpine.js before it initializes
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('chatbot', () => ({
    // ── Visible state ────────────────────────────────────────
    isOpen: false,
    isExpanded: false,
    isProcessing: false,
    userInput: '',
    messages: [],
    selectedModel: 'standalone',
    contextPages: [],

    // ── Internal / UI state ──────────────────────────────────
    showThinking: false,
    sessionId: '',
    showContextMenu: false,
    showModelMenu: false,

    // Feedback
    showFeedbackModal: false,
    feedbackModalIndex: -1,
    feedbackComment: '',

    // @ Mention
    showMentionMenu: false,
    mentionFilter: '',
    mentionSelectedIndex: 0,
    mentionStartPos: -1,
    filteredMentionPages: [],
    pageIndex: [],

    // Non-reactive helpers (assigned in init)
    streamer: null,
    thinkingAnimator: null,
    markdownRenderer: null,
    currentEventSource: null,
    _saveInputTimer: null,

    // ─── Lifecycle ───────────────────────────────────────────

    init() {
      this.streamer = new ChatStreamer(AGENT_ENDPOINT);
      this.thinkingAnimator = new ThinkingAnimator();
      this.markdownRenderer = new MarkdownRenderer(parseMarkdown);

      // Hugo-generated page index for @ mentions
      this.pageIndex = loadPageIndex();

      // Restore persisted conversation (runs BEFORE watchers are set up,
      // so setting isOpen / messages here does NOT fire the watchers).
      this.restoreState();

      // First visit: detect model from URL
      if (!this.sessionId) {
        this.selectedModel = this.detectModelFromPath();
      }

      // ── Watchers ───────────────────────────────────────────

      this.$watch('isOpen', (open) => {
        if (open) {
          if (!this.sessionId) this.sessionId = this.generateSessionId();
          this.$nextTick(() => {
            this.autoResizeInput();
            this.$refs.input?.focus();
          });
        } else {
          this.stopActiveStream();
          this.showContextMenu = false;
          this.showModelMenu = false;
          this.closeMentionMenu();
        }
        this.saveState();
      });

      this.$watch('userInput', () => {
        this.autoResizeInput();
        this.checkForMention();
        this.debouncedSaveInput();
      });

      // Restore textarea content AFTER watchers (the watcher will fire
      // once for the restored value – that is harmless: autoResize may
      // return early if the dialog is hidden, and debouncedSaveInput
      // simply writes back the same value).
      this.restoreInputState();

      // Safety net: persist state before unload
      window.addEventListener('beforeunload', () => {
        this.flushInputSave();
        this.finalizeAndSave();
      });
    },

    // ─── Persistence ─────────────────────────────────────────

    /**
     * Save conversation state to sessionStorage.
     * Only finalized messages are persisted (no streaming / loading flags).
     */
    saveState() {
      try {
        const state = {
          isOpen: this.isOpen,
          sessionId: this.sessionId,
          selectedModel: this.selectedModel,
          contextPages: this.contextPages,
          messages: this.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            markdown: msg.markdown || '',
            isError: msg.isError || false,
            isRateLimited: msg.isRateLimited || false,
            contextPages: msg.contextPages || [],
            feedback: msg.feedback || null
          }))
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn('Chatbot: could not save state', e);
      }
    },

    /**
     * Restore conversation state from sessionStorage.
     * Called once during init() – before watchers are registered.
     */
    restoreState() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const state = JSON.parse(raw);

        if (state.sessionId) this.sessionId = state.sessionId;
        if (state.selectedModel) this.selectedModel = state.selectedModel;

        if (Array.isArray(state.contextPages)) {
          this.contextPages = state.contextPages;
        }

        if (Array.isArray(state.messages) && state.messages.length > 0) {
          this.messages = state.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            markdown: msg.markdown || '',
            isError: msg.isError || false,
            isRateLimited: msg.isRateLimited || false,
            isStreaming: false,
            isLoading: false,
            showAvatar: msg.role === 'assistant',
            contextPages: msg.contextPages || [],
            feedback: msg.feedback || null
          }));
          this.isExpanded = true;
        }

        if (state.isOpen) this.isOpen = true;
      } catch (e) {
        console.warn('Chatbot: could not restore state', e);
      }
    },

    /**
     * Debounced save of textarea input to localStorage.
     * Removes the key when the input is empty.
     */
    debouncedSaveInput() {
      clearTimeout(this._saveInputTimer);
      this._saveInputTimer = setTimeout(() => {
        try {
          if (this.userInput) {
            localStorage.setItem(INPUT_STORAGE_KEY, this.userInput);
          } else {
            localStorage.removeItem(INPUT_STORAGE_KEY);
          }
        } catch (e) {
          console.warn('Chatbot: could not save input state', e);
        }
      }, INPUT_SAVE_DEBOUNCE_MS);
    },

    /**
     * Immediately flush any pending debounced input save.
     * Called on beforeunload to avoid losing data.
     */
    flushInputSave() {
      clearTimeout(this._saveInputTimer);
      try {
        if (this.userInput) {
          localStorage.setItem(INPUT_STORAGE_KEY, this.userInput);
        } else {
          localStorage.removeItem(INPUT_STORAGE_KEY);
        }
      } catch (_) { /* ignore during unload */ }
    },

    /**
     * Restore textarea input from localStorage.
     * Called once during init, after watchers are set up.
     */
    restoreInputState() {
      try {
        const saved = localStorage.getItem(INPUT_STORAGE_KEY);
        if (saved) {
          this.userInput = saved;
        }
      } catch (e) {
        console.warn('Chatbot: could not restore input state', e);
      }
    },

    /** Clear saved textarea input and cancel any pending save. */
    clearSavedInput() {
      clearTimeout(this._saveInputTimer);
      try {
        localStorage.removeItem(INPUT_STORAGE_KEY);
      } catch (_) { /* ignore */ }
    },

    /**
     * Finalize any in-flight streaming message and save.
     * Called on beforeunload to capture partial responses.
     */
    finalizeAndSave() {
      if (this.currentEventSource) {
        this.currentEventSource.close();
        this.currentEventSource = null;
      }
      const lastMsg = this.messages[this.messages.length - 1];
      if (lastMsg?.isStreaming) {
        try {
          const html = this.markdownRenderer.flush();
          if (html) lastMsg.content = html;
          lastMsg.markdown = this.markdownRenderer.getContent();
        } catch (_) { /* ignore flush errors during unload */ }
        lastMsg.isStreaming = false;
        lastMsg.isLoading = false;
      }
      this.isProcessing = false;
      this.saveState();
    },

    // ─── Open / Close / Reset ────────────────────────────────

    toggle() {
      this.isOpen = !this.isOpen;
    },

    open() {
      this.isOpen = true;
    },

    close() {
      if (this.showFeedbackModal) {
        this.closeFeedbackModal();
        return;
      }
      this.isOpen = false;
    },

    /**
     * Start a new conversation: clears messages, context, input,
     * and generates a fresh session ID.
     */
    newChat() {
      this.stopActiveStream();
      this.messages = [];
      this.userInput = '';
      this.isExpanded = false;
      this.isProcessing = false;
      this.showThinking = false;
      this.contextPages = [];
      this.showContextMenu = false;
      this.showModelMenu = false;
      this.showFeedbackModal = false;
      this.feedbackModalIndex = -1;
      this.feedbackComment = '';
      this.closeMentionMenu();
      this.sessionId = this.generateSessionId();
      this.thinkingAnimator.stop();
      this.markdownRenderer.reset();
      this.clearSavedInput();
      this.saveState();
      this.$nextTick(() => {
        this.autoResizeInput();
        this.$refs.input?.focus();
      });
    },

    /**
     * Export the current conversation as a Markdown file download.
     */
    exportChat() {
      if (this.messages.length === 0) return;

      const lines = [
        '# Agentgateway Assistant Conversation',
        '',
        `**Date:** ${new Date().toLocaleString()}`,
        `**Model:** ${this.getModelLabel()}`,
        '',
        '---',
        ''
      ];

      for (const msg of this.messages) {
        if (msg.role === 'user') {
          lines.push('## User', '', msg.content, '');
        } else if (msg.role === 'assistant') {
          lines.push('## Assistant', '');
          if (msg.isError) {
            lines.push(`> **Error:** ${msg.content}`);
          } else if (msg.markdown) {
            lines.push(msg.markdown);
          } else {
            const tmp = document.createElement('div');
            tmp.innerHTML = msg.content;
            lines.push(tmp.innerText);
          }
          lines.push('');
        }
      }

      const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    /**
     * Stop any active streaming connection without clearing messages.
     */
    stopActiveStream() {
      if (this.currentEventSource) {
        this.currentEventSource.close();
        this.currentEventSource = null;
      }
      const lastMsg = this.messages[this.messages.length - 1];
      if (lastMsg?.isStreaming) {
        lastMsg.isStreaming = false;
        lastMsg.isLoading = false;
      }
      this.isProcessing = false;
      this.showThinking = false;
      this.thinkingAnimator.stop();
    },

    // ─── URL Validation ──────────────────────────────────────

    /**
     * Check whether a URL is eligible as a context page.
     * Must be same-origin AND under a recognised docs version path.
     */
    isValidDocsUrl(url) {
      try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.hostname !== window.location.hostname) return false;
        return DOCS_PATH_RE.test(parsed.pathname);
      } catch (_) {
        return false;
      }
    },

    // ─── Page Context ────────────────────────────────────────

    /**
     * Look up a human-readable title for a URL from the page index.
     * Falls back to a breadcrumb derived from the last path segments.
     */
    getTitleForUrl(url) {
      try {
        const pathname = new URL(url, window.location.origin).pathname.replace(/\/$/, '');
        const page = this.pageIndex.find(
          (p) => p.url.replace(/\/$/, '') === pathname
        );
        if (page) return page.title;
      } catch (_) { /* fall through to breadcrumb */ }

      try {
        const segments = new URL(url, window.location.origin)
          .pathname.replace(/\/$/, '')
          .split('/')
          .filter(Boolean);
        return segments.length === 0 ? 'Home page' : segments.slice(-2).join(' / ');
      } catch (_) {
        return 'Page';
      }
    },

    /**
     * Normalise a URL to a canonical form for deduplication:
     * absolute URL with trailing slash, no query or hash.
     */
    normaliseUrl(url) {
      const parsed = new URL(
        url.startsWith('http')
          ? url
          : window.location.origin + (url.startsWith('/') ? '' : '/') + url
      );
      let pathname = parsed.pathname;
      if (!pathname.endsWith('/')) pathname += '/';
      return parsed.origin + pathname;
    },

    /**
     * Add the current page to contextPages.
     * Silently no-ops if the page is invalid or a duplicate.
     * Pages beyond MAX_CONTEXT_PAGES are kept in the UI (shown as
     * overflow pills) but are NOT sent in the API request.
     */
    addCurrentPage() {
      const url = window.location.href;
      if (!this.isValidDocsUrl(url)) return;
      const normalised = this.normaliseUrl(url);
      if (this.contextPages.some((p) => p.url === normalised)) return;
      this.contextPages.push({ title: this.getTitleForUrl(normalised), url: normalised });
      this.saveState();
    },

    /**
     * Add a page from the page index (via @ mention) to contextPages.
     */
    addContextPage(page) {
      const fullUrl = page.url.startsWith('http')
        ? page.url
        : window.location.origin + page.url;
      if (this.contextPages.some((p) => p.url === fullUrl)) return;
      this.contextPages.push({ title: page.title, url: fullUrl });
      this.saveState();
    },

    /**
     * Remove a context page by index.
     */
    removeContextPage(index) {
      this.contextPages.splice(index, 1);
      this.saveState();
    },

    // ─── Paste & Drop ────────────────────────────────────────

    /**
     * Handle pasted content – if it's a plain URL paste, add as a pill.
     */
    handlePaste(event) {
      const text = event.clipboardData?.getData('text') || '';
      const urls = this.extractUrls(text);
      if (urls.length > 0 && text.trim() === urls[0]) {
        event.preventDefault();
        urls.forEach((url) => this.addPastedUrl(url));
      }
    },

    /**
     * Handle dropped content – extract URLs and add as pills.
     */
    handleDrop(event) {
      event.preventDefault();
      event.stopPropagation();

      const text = event.dataTransfer?.getData('text') || '';
      const html = event.dataTransfer?.getData('text/html') || '';

      // Try HTML first (drag from browser)
      const urlFromHtml = this.extractUrlFromHtml(html);
      if (urlFromHtml) { this.addPastedUrl(urlFromHtml); return; }

      // Plain-text URLs
      const urls = this.extractUrls(text);
      if (urls.length > 0) { urls.forEach((u) => this.addPastedUrl(u)); return; }

      // Fallback: insert text at cursor
      const pos = this.$refs.input?.selectionStart || this.userInput.length;
      this.userInput =
        this.userInput.substring(0, pos) + text + this.userInput.substring(pos);
    },

    handleDragOver(event) {
      event.preventDefault();
      event.stopPropagation();
    },

    /**
     * Extract valid docs URLs from plain text.
     */
    extractUrls(text) {
      const urlRe = /(https?:\/\/[^\s]+|\/docs\/[^\s]+)/gi;
      return (text.match(urlRe) || [])
        .map((u) => u.replace(/[,;.!?)]*$/, ''))
        .filter((u) => u.length > 0 && this.isValidDocsUrl(u));
    },

    /**
     * Extract a valid docs URL from an HTML href attribute.
     */
    extractUrlFromHtml(html) {
      try {
        const m = html.match(/href=["']([^"']+)["']/);
        if (m && this.isValidDocsUrl(m[1])) return m[1];
      } catch (_) { /* ignore */ }
      return null;
    },

    /**
     * Add a URL (from paste/drop) as a context page pill.
     */
    addPastedUrl(url) {
      if (!this.isValidDocsUrl(url)) return;
      try {
        const fullUrl = this.normaliseUrl(url);
        if (this.contextPages.some((p) => p.url === fullUrl)) return;
        this.contextPages.push({ title: this.getTitleForUrl(fullUrl), url: fullUrl });
        this.saveState();
      } catch (_) { /* invalid URL */ }
    },

    // ─── @ Mention System ────────────────────────────────────

    /**
     * Check the textarea for an active @ mention trigger.
     * Updates `filteredMentionPages` so the template can bind to a
     * stable array instead of calling a filter function on every render.
     */
    checkForMention() {
      const input = this.$refs.input;
      if (!input) return;

      const cursorPos = input.selectionStart;
      const text = this.userInput;

      // Walk backward from cursor to find '@'
      let atPos = -1;
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (text[i] === '@') { atPos = i; break; }
        if (text[i] === '\n') break;
      }

      if (atPos >= 0) {
        const charBefore = atPos > 0 ? text[atPos - 1] : ' ';
        if (atPos === 0 || /\s/.test(charBefore)) {
          const filter = text.substring(atPos + 1, cursorPos);
          this.mentionStartPos = atPos;
          this.mentionFilter = filter;
          this.mentionSelectedIndex = 0;
          this.filteredMentionPages = this.computeFilteredPages(filter);
          this.showMentionMenu = true;
          return;
        }
      }

      this.closeMentionMenu();
    },

    /**
     * Detect the version prefix for the current docs path.
     * e.g. "/docs/standalone/latest/"
     */
    getVersionPrefix() {
      const m = window.location.pathname.match(DOCS_PATH_RE);
      return m ? `/docs/${m[1]}/${m[2]}/` : '';
    },

    /**
     * Compute filtered page results for the mention popup.
     *
     * The current page is treated specially:
     *  - It is marked with `_isCurrentPage: true` and hoisted to the
     *    top of the list so users can quickly add the page they are on.
     *  - It is matched by its real title/section/url AND by the alias
     *    "current page", so typing "@current" will surface it.
     *  - There is always only ONE entry per page (no duplicates).
     *  - If the current page is already in contextPages it is omitted.
     */
    computeFilteredPages(filter = '') {
      const versionPrefix = this.getVersionPrefix();
      const scoped = versionPrefix
        ? this.pageIndex.filter((p) => p.url.startsWith(versionPrefix))
        : this.pageIndex;

      // Identify the current page's pathname for matching
      let currentPathname = null;
      const currentUrl = window.location.href;
      if (this.isValidDocsUrl(currentUrl)) {
        const normalised = this.normaliseUrl(currentUrl);
        // Only treat as current page if not already added
        if (!this.contextPages.some((p) => p.url === normalised)) {
          currentPathname = new URL(normalised).pathname;
        }
      }

      const terms = filter.toLowerCase().trim();
      const termList = terms ? terms.split(/\s+/) : [];

      // Helper: does a page match the filter terms?
      const matchesFilter = (haystack) =>
        termList.length === 0 || termList.every((t) => haystack.includes(t));

      let currentPageResult = null;
      const otherResults = [];

      for (const page of scoped) {
        const pagePath = page.url.replace(/\/$/, '');
        const isCurrentPage =
          currentPathname && pagePath === currentPathname.replace(/\/$/, '');

        const haystack = `${page.title} ${page.section} ${page.url}`.toLowerCase();
        // Current page also matches the alias "current page"
        const fullHaystack = isCurrentPage
          ? `current page ${haystack}`
          : haystack;

        if (!matchesFilter(fullHaystack)) continue;

        if (isCurrentPage && !currentPageResult) {
          currentPageResult = { ...page, _isCurrentPage: true };
        } else {
          otherResults.push(page);
          if (otherResults.length >= 8) break;
        }
      }

      // Hoist the current page to the top
      if (currentPageResult) {
        return [currentPageResult, ...otherResults.slice(0, 7)];
      }
      return otherResults.slice(0, 8);
    },

    /**
     * Select a page from the mention popup: remove the @filter text
     * from the textarea and add the page to contextPages.
     */
    selectMention(page) {
      const cursorPos = this.$refs.input?.selectionStart || this.userInput.length;
      const before = this.userInput.substring(0, this.mentionStartPos);
      const after = this.userInput.substring(cursorPos);
      this.userInput = before + after;

      if (page._isCurrentPage) {
        this.addCurrentPage();
      } else {
        this.addContextPage(page);
      }
      this.closeMentionMenu();
      this.$nextTick(() => this.$refs.input?.focus());
    },

    closeMentionMenu() {
      this.showMentionMenu = false;
      this.mentionFilter = '';
      this.mentionSelectedIndex = 0;
      this.mentionStartPos = -1;
      this.filteredMentionPages = [];
    },

    /**
     * Insert '@' at the cursor and trigger the mention popup.
     * Called from the context dropdown "Mention a page" button.
     */
    insertMention() {
      const input = this.$refs.input;
      if (!input) return;

      const cursorPos = input.selectionStart;
      const before = this.userInput.substring(0, cursorPos);
      const after = this.userInput.substring(cursorPos);
      const prefix = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
      this.userInput = before + prefix + '@' + after;

      this.$nextTick(() => {
        const newPos = cursorPos + prefix.length + 1;
        input.focus();
        input.setSelectionRange(newPos, newPos);
      });
    },

    // ─── Model ───────────────────────────────────────────────

    getModelLabel() {
      return { standalone: 'Standalone', kubernetes: 'Kubernetes' }[this.selectedModel] || this.selectedModel;
    },

    // ─── Input ───────────────────────────────────────────────

    /**
     * Auto-resize the textarea to fit its content.
     * Operates directly on the DOM element to avoid a reactive cycle
     * (no reactive `inputHeight` property involved).
     */
    autoResizeInput() {
      const el = this.$refs.input;
      if (!el) return;
      const min = 68;
      const max = 150;
      el.style.height = '0px';
      el.style.height = Math.max(min, Math.min(el.scrollHeight, max)) + 'px';
    },

    scrollMentionIntoView() {
      this.$nextTick(() => {
        const list = this.$refs.mentionList;
        if (!list) return;
        const items = list.querySelectorAll('.chatbot-mention-item');
        const active = items[this.mentionSelectedIndex];
        if (active) active.scrollIntoView({ block: 'nearest' });
      });
    },

    handleKeydown(event) {
      // ── Mention popup keyboard navigation ──────────────────
      if (this.showMentionMenu) {
        const filtered = this.filteredMentionPages;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          this.mentionSelectedIndex = Math.min(this.mentionSelectedIndex + 1, filtered.length - 1);
          this.scrollMentionIntoView();
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.mentionSelectedIndex = Math.max(this.mentionSelectedIndex - 1, 0);
          this.scrollMentionIntoView();
          return;
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && filtered.length > 0) {
          event.preventDefault();
          this.selectMention(filtered[this.mentionSelectedIndex]);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          this.closeMentionMenu();
          return;
        }
      }

      // ── Send on Enter ──────────────────────────────────────
      if (event.key === 'Enter' && !event.shiftKey && !this.isProcessing) {
        event.preventDefault();
        this.sendQuery();
      }
    },

    // ─── Query ───────────────────────────────────────────────

    async sendQuery() {
      const query = this.userInput.trim();
      if (!query || this.isProcessing) return;

      if (!this.sessionId) {
        this.sessionId = this.generateSessionId();
      }

      this.isProcessing = true;

      // Snapshot context pages (only first MAX_CONTEXT_PAGES are sent)
      const capturedContextPages = this.contextPages.map((p) => ({ ...p }));
      const pages = capturedContextPages
        .slice(0, MAX_CONTEXT_PAGES)
        .map((p) => p.url)
        .join(',');

      // Push user message
      this.messages.push({
        role: 'user',
        content: query,
        contextPages: capturedContextPages
      });

      if (this.messages.length === 1) this.isExpanded = true;

      // Clear input and context
      this.userInput = '';
      this.contextPages = [];
      this.closeMentionMenu();
      this.clearSavedInput();
      this.saveState();

      // Streaming assistant message placeholder
      this.messages.push({
        role: 'assistant',
        content: '',
        isStreaming: true,
        showAvatar: true,
        isLoading: true,
        isError: false,
        feedback: null
      });

      this.markdownRenderer.reset();
      this.showThinking = true;

      await this.$nextTick();
      if (this.$refs.thinkingDots) {
        this.thinkingAnimator.start(this.$refs.thinkingDots);
      }

      try {
        this.currentEventSource = await this.streamer.stream(query, {
          sessionId: this.sessionId,
          model: this.selectedModel,
          pages,

          onToken: (token) => {
            this.markdownRenderer.addToken(token);
            const html = this.markdownRenderer.render();
            const idx = this.messages.length - 1;
            this.messages[idx].content = html;

            if (this.markdownRenderer.getContent().length > 0 && this.showThinking) {
              this.showThinking = false;
              this.thinkingAnimator.stop();
              this.messages[idx].isLoading = false;
            }
          },

          onDone: () => {
            const html = this.markdownRenderer.flush();
            const idx = this.messages.length - 1;
            this.messages[idx].content = html;
            this.messages[idx].markdown = this.markdownRenderer.getContent();
            this.messages[idx].isStreaming = false;
            this.messages[idx].isLoading = false;
            this.showThinking = false;
            this.thinkingAnimator.stop();
            this.isProcessing = false;
            this.currentEventSource = null;
            this.saveState();
            this.$nextTick(() => this.$refs.input?.focus());
          },

          onError: (errorMessage, errorType) => {
            console.error('Stream error:', errorMessage, errorType);
            this.showThinking = false;
            this.thinkingAnimator.stop();
            const idx = this.messages.length - 1;
            this.messages[idx].content = errorMessage;
            this.messages[idx].isError = true;
            this.messages[idx].isRateLimited = errorType === ErrorType.RATE_LIMITED;
            this.messages[idx].isStreaming = false;
            this.messages[idx].isLoading = false;
            this.isProcessing = false;
            this.currentEventSource = null;
            this.saveState();
          }
        });
      } catch (error) {
        console.error('Chat error:', error);
        this.showThinking = false;
        this.thinkingAnimator.stop();
        const idx = this.messages.length - 1;
        this.messages[idx].content = `Error: ${error.message}`;
        this.messages[idx].isError = true;
        this.messages[idx].isStreaming = false;
        this.messages[idx].isLoading = false;
        this.isProcessing = false;
        this.currentEventSource = null;
        this.saveState();
      }
    },

    // ─── Feedback ─────────────────────────────────────────────

    /**
     * Submit a thumb-up or thumb-down for an assistant message.
     * The vote is sent to the backend immediately (fire-and-forget).
     * For thumb-down, a comment modal is shown afterwards; the vote
     * has already been recorded even if the user dismisses the modal.
     */
    async submitFeedback(index, type) {
      const msg = this.messages[index];
      if (!msg || msg.role !== 'assistant' || msg.feedback) return;

      // Record feedback in UI immediately
      msg.feedback = type;
      this.saveState();

      // Find the user query that prompted this response
      const userMsg = index > 0 ? this.messages[index - 1] : null;
      const query = userMsg?.role === 'user' ? userMsg.content : '';

      // Send vote to backend (fire-and-forget)
      try {
        await fetch(`${AGENT_ENDPOINT}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.sessionId,
            messageIndex: index,
            type,
            query,
            response: msg.markdown || msg.content
          })
        });
      } catch (e) {
        console.warn('Chatbot: could not submit feedback', e);
      }

      // Show comment modal for thumb-down
      if (type === 'down') {
        this.feedbackModalIndex = index;
        this.feedbackComment = '';
        this.showFeedbackModal = true;
        this.$nextTick(() => this.$refs.feedbackInput?.focus());
      }
    },

    /**
     * Submit the optional comment from the thumb-down modal.
     * Only sends if the user typed something.
     */
    async submitFeedbackComment() {
      const comment = this.feedbackComment.trim();
      const index = this.feedbackModalIndex;
      this.closeFeedbackModal();

      if (!comment) return;

      try {
        await fetch(`${AGENT_ENDPOINT}/feedback/comment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.sessionId,
            messageIndex: index,
            comment
          })
        });
      } catch (e) {
        console.warn('Chatbot: could not submit feedback comment', e);
      }
    },

    /**
     * Close the feedback comment modal without sending anything extra.
     * The thumb-down vote was already sent when the button was clicked.
     */
    closeFeedbackModal() {
      this.showFeedbackModal = false;
      this.feedbackModalIndex = -1;
      this.feedbackComment = '';
    },

    // ─── Utilities ───────────────────────────────────────────

    generateSessionId() {
      if (window.crypto?.randomUUID) return window.crypto.randomUUID();
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    },

    scrollToBottom() {
      const c = this.$refs.messagesContainer;
      if (c) c.scrollTop = c.scrollHeight;
    },

    isLastMessage(index) {
      return index === this.messages.length - 1;
    },

    detectModelFromPath() {
      return window.location.pathname.includes('/docs/kubernetes/') ? 'kubernetes' : 'standalone';
    }
  }));
});
