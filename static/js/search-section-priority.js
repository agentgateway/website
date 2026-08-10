/**
 * Search section filter:
 * - On docs (standalone/kubernetes): show only that section's results, with a
 *   "See results in [other] docs" button to toggle.
 * - On blog: keep only blog *post* results (drop docs hits and the /blog list
 *   page). Non-matching hits are removed from the DOM so keyboard selection
 *   (Enter / arrows) targets a visible result — hiding with display:none left
 *   hextra-search-active on the first (docs) hit, so Enter appeared to do nothing.
 */
(function () {
  var BLOG_PREFIX = '/blog/';
  var DOCS_PREFIX = '/docs/';
  var STANDALONE_PREFIX = '/docs/standalone/';
  var KUBERNETES_PREFIX = '/docs/kubernetes/';
  var SWITCHER_ID = 'search-section-switcher';
  var EMPTY_CLASS = 'hextra-search-no-result';

  function getSectionFromPath(pathname) {
    if (pathname === '/blog' || pathname === '/blog/' || pathname.startsWith(BLOG_PREFIX)) {
      return 'blog';
    }
    if (pathname.startsWith(STANDALONE_PREFIX)) return 'standalone';
    if (pathname.startsWith(KUBERNETES_PREFIX)) return 'kubernetes';
    if (pathname.startsWith(DOCS_PREFIX)) return 'docs';
    return 'other';
  }

  function getCurrentSection() {
    var path = window.location.pathname;
    if (path === '/blog' || path === '/blog/' || path.startsWith(BLOG_PREFIX)) return 'blog';
    if (path.startsWith(STANDALONE_PREFIX)) return 'standalone';
    if (path.startsWith(KUBERNETES_PREFIX)) return 'kubernetes';
    return 'other';
  }

  function getPathFromHref(href) {
    if (!href) return '';
    try {
      return new URL(href, window.location.origin).pathname;
    } catch (e) {
      return href;
    }
  }

  /** True for the blog index listing, not an individual post. */
  function isBlogIndexPath(pathname) {
    return pathname === '/blog' || pathname === '/blog/';
  }

  /**
   * After filtering, renumber data-index and put hextra-search-active on the
   * first remaining link so Enter / arrow keys match what the user sees.
   */
  function reindexActiveResults(resultsContainer) {
    var links = resultsContainer.querySelectorAll('a[data-index], a[href]');
    var ordered = [];
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      // Skip links inside hidden nodes (docs toggle path).
      if (a.offsetParent === null && a.style.display === 'none') continue;
      var li = a.closest('li') || a.parentElement;
      if (li && li.style && li.style.display === 'none') continue;
      if (a.closest('[style*="display: none"], [style*="display:none"]')) {
        // Also skip if an ancestor was hidden via style.display
        var hidden = false;
        var el = a.parentElement;
        while (el && el !== resultsContainer) {
          if (el.style && el.style.display === 'none') {
            hidden = true;
            break;
          }
          el = el.parentElement;
        }
        if (hidden) continue;
      }
      ordered.push(a);
    }

    // Prefer only anchors that are result rows (have data-index or are direct result links).
    var resultLinks = [];
    for (var j = 0; j < ordered.length; j++) {
      var link = ordered[j];
      var row = link.closest('li') || link;
      if (row.id === SWITCHER_ID) continue;
      if (row.style && row.style.display === 'none') continue;
      resultLinks.push(link);
    }

    for (var k = 0; k < resultLinks.length; k++) {
      resultLinks[k].classList.remove('hextra-search-active');
      resultLinks[k].dataset.index = String(k);
    }
    if (resultLinks.length > 0) {
      resultLinks[0].classList.add('hextra-search-active');
    }
    resultsContainer.dataset.count = String(resultLinks.length);
  }

  function showBlogEmptyState(resultsContainer) {
    // Clear leftover prefixes / empty rows so the panel isn't a blank box.
    while (resultsContainer.firstChild) {
      resultsContainer.removeChild(resultsContainer.firstChild);
    }
    var empty = document.createElement('span');
    empty.className = EMPTY_CLASS;
    empty.textContent = 'No results found.';
    resultsContainer.appendChild(empty);
    resultsContainer.dataset.count = '0';
  }

  function filterAndAddSwitcher(resultsContainer) {
    var currentSection = getCurrentSection();
    if (currentSection === 'other') return;

    var groups = [];
    var prevPrefix = null;

    for (var i = 0; i < resultsContainer.children.length; i++) {
      var child = resultsContainer.children[i];
      if (child.id === SWITCHER_ID) continue;
      if (child.classList && child.classList.contains(EMPTY_CLASS)) continue;
      if (child.classList.contains('hextra-search-prefix') || child.classList.contains('prefix')) {
        prevPrefix = child;
        continue;
      }

      var link = child.querySelector('a[href]');
      if (!link) continue;

      var path = getPathFromHref(link.getAttribute('href') || '');
      var section = getSectionFromPath(path);

      // Blog index listing is not a useful hit (same page, title "Blog").
      if (currentSection === 'blog' && isBlogIndexPath(path)) {
        section = 'other';
      }

      /* On blog page, treat all docs (standalone + kubernetes) as one "docs" section */
      if (currentSection === 'blog' && (section === 'standalone' || section === 'kubernetes')) {
        section = 'docs';
      }
      groups.push({ prefix: prevPrefix, node: child, section: section, path: path });
      prevPrefix = null;
    }

    if (groups.length === 0) return;

    // --- Blog: hard-filter to posts only (remove non-blog from DOM) ---
    if (currentSection === 'blog') {
      var kept = 0;
      for (var b = 0; b < groups.length; b++) {
        var grp = groups[b];
        if (grp.section === 'blog') {
          kept++;
          continue;
        }
        if (grp.prefix && grp.prefix.parentNode) grp.prefix.parentNode.removeChild(grp.prefix);
        if (grp.node && grp.node.parentNode) grp.node.parentNode.removeChild(grp.node);
      }

      // Drop any leftover orphan prefixes / switcher.
      var orphanSwitcher = resultsContainer.querySelector('#' + SWITCHER_ID);
      if (orphanSwitcher) orphanSwitcher.parentNode.removeChild(orphanSwitcher);

      if (kept === 0) {
        showBlogEmptyState(resultsContainer);
        return;
      }

      reindexActiveResults(resultsContainer);
      return;
    }

    // --- Docs: hide non-current section, optional switcher (unchanged idea) ---
    var hasCurrent = groups.some(function (g) { return g.section === currentSection; });
    var otherSection = currentSection === 'standalone' ? 'kubernetes' : 'standalone';
    var hasOther = groups.some(function (g) { return g.section === otherSection; });
    var showSection = hasCurrent ? currentSection : otherSection;

    if (!hasCurrent && !hasOther) return;

    for (var j = 0; j < groups.length; j++) {
      var g = groups[j];
      g.node.dataset.searchSection = g.section;
      if (g.prefix) g.prefix.dataset.searchSection = g.section;
    }

    var existingSwitcher = resultsContainer.querySelector('#' + SWITCHER_ID);
    if (existingSwitcher) existingSwitcher.remove();

    var switcherBtn = null;

    function setVisibility() {
      for (var k = 0; k < groups.length; k++) {
        var item = groups[k];
        var visible = item.section === showSection;
        var display = visible ? '' : 'none';
        item.node.style.display = display;
        if (item.prefix) item.prefix.style.display = display;
      }
      if (switcherBtn) {
        var label = showSection === 'standalone' ? 'Kubernetes' : 'Standalone';
        switcherBtn.textContent = 'See results in ' + label + ' docs';
        switcherBtn.dataset.showing = showSection;
      }
      reindexActiveResults(resultsContainer);
    }

    if (hasOther) {
      var switcherLi = document.createElement('li');
      switcherLi.id = SWITCHER_ID;
      switcherLi.className = 'search-section-switcher';
      switcherLi.style.cssText = 'list-style:none;padding:0.75rem 1rem;border-top:1px solid rgba(128,128,128,0.3);margin-top:0.5rem;';
      switcherBtn = document.createElement('button');
      switcherBtn.type = 'button';
      switcherBtn.className = 'search-section-switcher-btn';
      switcherBtn.style.cssText = 'width:100%;padding:0.5rem 0.75rem;text-align:center;background:transparent;border:1px solid currentColor;border-radius:0.375rem;cursor:pointer;font-size:0.875rem;color:inherit;';
      switcherBtn.dataset.showing = showSection;

      switcherBtn.addEventListener('click', function () {
        showSection = showSection === 'standalone' ? 'kubernetes' : 'standalone';
        setVisibility();
      });

      switcherLi.appendChild(switcherBtn);
      resultsContainer.appendChild(switcherLi);
    }

    setVisibility();
  }

  function observeSearchResults() {
    var observed = new WeakSet();
    var debounceTimer = null;
    var pendingTarget = null;

    function observeContainer(el) {
      if (!el || observed.has(el)) return;
      observed.add(el);
      observer.observe(el, { childList: true, subtree: true });
    }

    function processDebounced(target) {
      pendingTarget = target;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        if (pendingTarget && pendingTarget.children.length > 0) {
          filterAndAddSwitcher(pendingTarget);
        }
        pendingTarget = null;
      }, 50);
    }

    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var mutation = mutations[m];
        if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) continue;
        var added = mutation.addedNodes;
        var skipMutation = false;
        for (var n = 0; n < added.length; n++) {
          var node = added[n];
          if (node.nodeType === 1 && (
            node.id === SWITCHER_ID ||
            (node.classList && node.classList.contains(EMPTY_CLASS)) ||
            (node.querySelector && node.querySelector('#' + SWITCHER_ID))
          )) {
            skipMutation = true;
            break;
          }
        }
        if (skipMutation) continue;
        var target = mutation.target;
        if (!target || !target.classList) continue;
        if (target.classList.contains('search-results') || target.classList.contains('hextra-search-results')) {
          if (target.children.length > 0) processDebounced(target);
        }
      }
    });

    function setup() {
      var containers = document.querySelectorAll('.search-results, .hextra-search-results');
      containers.forEach(observeContainer);
      containers.forEach(function (el) {
        if (el.children.length > 0) filterAndAddSwitcher(el);
      });
    }

    document.addEventListener('DOMContentLoaded', function () {
      setup();
      setTimeout(setup, 500);
    });
    if (document.readyState !== 'loading') {
      setup();
      setTimeout(setup, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeSearchResults);
  } else {
    observeSearchResults();
  }
})();
