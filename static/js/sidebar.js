// Sidebar tree expand/collapse.
//
// The full nav tree is rendered server-side (see layouts/partials/sidebar.html)
// with each branch's `<li data-sidebar-item>` carrying a `data-expanded` flag
// the server pre-set for ancestors of the current page. This script wires the
// chevron `<button class="sidebar-toggle">` so users can expand or collapse a
// branch without the link's navigation firing — clicking the link still
// navigates, clicking the chevron only toggles.
//
// State is persisted in localStorage keyed by the branch's href so the user's
// expansion preferences survive navigation.
(function () {
  'use strict';

  const STORAGE_KEY = 'agw-sidebar-expanded';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      // localStorage may be disabled (private mode, quota); silently degrade.
    }
  }

  function getKey(item) {
    const link = item.querySelector(':scope > .sidebar-link-wrapper > .sidebar-link');
    return link ? link.getAttribute('href') : null;
  }

  function setExpanded(item, expanded) {
    item.setAttribute('data-expanded', expanded ? 'true' : 'false');
    const btn = item.querySelector(':scope > .sidebar-link-wrapper > .sidebar-toggle');
    if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    const children = item.querySelector(':scope > .sidebar-children');
    if (children) {
      if (expanded) children.removeAttribute('hidden');
      else children.setAttribute('hidden', '');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const state = loadState();

    // Apply persisted state. Skip items that contain the current page —
    // those should always be expanded so the user sees where they are.
    document.querySelectorAll('[data-sidebar-item]').forEach(function (item) {
      const containsCurrent = item.querySelector('a[aria-current="page"]');
      if (containsCurrent) return;
      const key = getKey(item);
      if (key && key in state) {
        setExpanded(item, state[key]);
      }
    });

    document.querySelectorAll('.sidebar-toggle').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const item = btn.closest('[data-sidebar-item]');
        if (!item) return;
        const wasExpanded = item.getAttribute('data-expanded') === 'true';
        const newExpanded = !wasExpanded;
        setExpanded(item, newExpanded);

        const key = getKey(item);
        if (key) {
          state[key] = newExpanded;
          saveState(state);
        }
      });
    });
  });
})();
