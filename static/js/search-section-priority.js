/**
 * Search section filter:
 * - On docs (standalone/kubernetes): show only that section's results, with a
 *   "See results in [other] docs" button to toggle.
 * - On blog: show only blog results, with a "Search docs" button to show docs
 *   results (and "Search blog" to switch back).
 */
(function () {
  var BLOG_PREFIX = '/blog/';
  var DOCS_PREFIX = '/docs/';
  var STANDALONE_PREFIX = '/docs/standalone/';
  var KUBERNETES_PREFIX = '/docs/kubernetes/';
  var SWITCHER_ID = 'search-section-switcher';

  function getSectionFromPath(pathname) {
    if (pathname.startsWith(BLOG_PREFIX)) return 'blog';
    if (pathname.startsWith(STANDALONE_PREFIX)) return 'standalone';
    if (pathname.startsWith(KUBERNETES_PREFIX)) return 'kubernetes';
    if (pathname.startsWith(DOCS_PREFIX)) return 'docs';
    return 'other';
  }

  function getCurrentSection() {
    var path = window.location.pathname;
    if (path.startsWith(BLOG_PREFIX)) return 'blog';
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

  function filterAndAddSwitcher(resultsContainer) {
    var currentSection = getCurrentSection();
    if (currentSection === 'other') return;

    var groups = [];
    var prevPrefix = null;

    for (var i = 0; i < resultsContainer.children.length; i++) {
      var child = resultsContainer.children[i];
      if (child.id === SWITCHER_ID) continue;
      if (child.classList.contains('hextra-search-prefix') || child.classList.contains('prefix')) {
        prevPrefix = child;
        continue;
      }

      var link = child.querySelector('a[href]');
      if (!link) continue;

      var path = getPathFromHref(link.getAttribute('href') || '');
      var section = getSectionFromPath(path);
      /* On blog page, treat all docs (standalone + kubernetes) as one "docs" section */
      if (currentSection === 'blog' && (section === 'standalone' || section === 'kubernetes')) {
        section = 'docs';
      }
      groups.push({ prefix: prevPrefix, node: child, section: section });
      prevPrefix = null;
    }

    if (groups.length === 0) return;

    var hasCurrent, hasOther, otherSection, showSection, switcherLabelFn;

    if (currentSection === 'blog') {
      hasCurrent = groups.some(function (g) { return g.section === 'blog'; });
      hasOther = groups.some(function (g) { return g.section === 'docs'; });
      otherSection = 'docs';
      showSection = hasCurrent ? 'blog' : 'docs';
      switcherLabelFn = function () {
        return showSection === 'blog' ? 'Search docs' : 'Search blog';
      };
    } else {
      hasCurrent = groups.some(function (g) { return g.section === currentSection; });
      otherSection = currentSection === 'standalone' ? 'kubernetes' : 'standalone';
      hasOther = groups.some(function (g) { return g.section === otherSection; });
      showSection = hasCurrent ? currentSection : otherSection;
      switcherLabelFn = function () {
        var label = showSection === 'standalone' ? 'Kubernetes' : 'Standalone';
        return 'See results in ' + label + ' docs';
      };
    }

    if (!hasCurrent && !hasOther) return;

    for (var j = 0; j < groups.length; j++) {
      var g = groups[j];
      g.node.dataset.searchSection = g.section;
      if (g.prefix) g.prefix.dataset.searchSection = g.section;
    }

    var existingSwitcher = resultsContainer.querySelector('#' + SWITCHER_ID);
    if (existingSwitcher) existingSwitcher.remove();

    function setVisibility() {
      for (var k = 0; k < groups.length; k++) {
        var grp = groups[k];
        var visible = grp.section === showSection;
        var display = visible ? '' : 'none';
        grp.node.style.display = display;
        if (grp.prefix) grp.prefix.style.display = display;
      }
      if (switcherBtn) {
        switcherBtn.textContent = switcherLabelFn();
        switcherBtn.dataset.showing = showSection;
      }
    }

    var switcherLi = null;
    var switcherBtn = null;

    if (hasOther) {
      switcherLi = document.createElement('li');
      switcherLi.id = SWITCHER_ID;
      switcherLi.className = 'search-section-switcher';
      switcherLi.style.cssText = 'list-style:none;padding:0.75rem 1rem;border-top:1px solid rgba(128,128,128,0.3);margin-top:0.5rem;';
      switcherBtn = document.createElement('button');
      switcherBtn.type = 'button';
      switcherBtn.className = 'search-section-switcher-btn';
      switcherBtn.style.cssText = 'width:100%;padding:0.5rem 0.75rem;text-align:center;background:transparent;border:1px solid currentColor;border-radius:0.375rem;cursor:pointer;font-size:0.875rem;color:inherit;';
      switcherBtn.dataset.showing = showSection;

      switcherBtn.addEventListener('click', function () {
        if (currentSection === 'blog') {
          showSection = showSection === 'blog' ? 'docs' : 'blog';
        } else {
          showSection = showSection === 'standalone' ? 'kubernetes' : 'standalone';
        }
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
          if (node.nodeType === 1 && (node.id === SWITCHER_ID || (node.querySelector && node.querySelector('#' + SWITCHER_ID)))) {
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
