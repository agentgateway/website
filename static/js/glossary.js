// Glossary tooltip behavior.
//
// Tooltips use `position: fixed` so they escape ancestor overflow contexts —
// notably `.table-wrapper { overflow-x: auto }` from the table render hook,
// which previously clipped tooltips inside tables to the visible portion of
// the table only. Position is computed against the term's bounding rect on
// each show, and re-positioned on scroll/resize while open.
document.addEventListener('DOMContentLoaded', function () {
  const TOOLTIP_GAP = 8; // px gap between tooltip and term

  function positionTooltip(term) {
    const tip = term.querySelector(':scope > span');
    if (!tip) return;

    // Reveal off-screen first so we can measure the tooltip's true size.
    tip.style.visibility = 'hidden';
    tip.style.left = '0px';
    tip.style.top = '0px';
    tip.style.display = 'block';

    const termRect = term.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Center horizontally on the term, clamp into the viewport.
    let left = termRect.left + (termRect.width / 2) - (tipRect.width / 2);
    left = Math.max(8, Math.min(left, viewportWidth - tipRect.width - 8));

    // Prefer above the term; flip below if not enough room.
    let top = termRect.top - tipRect.height - TOOLTIP_GAP;
    let placeBelow = false;
    if (top < 8) {
      top = termRect.bottom + TOOLTIP_GAP;
      placeBelow = true;
      if (top + tipRect.height > viewportHeight - 8) {
        top = Math.max(8, viewportHeight - tipRect.height - 8);
      }
    }

    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.classList.toggle('tooltip-below', placeBelow);
    tip.style.removeProperty('display');
    tip.style.visibility = '';
  }

  function clearPosition(term) {
    const tip = term.querySelector(':scope > span');
    if (!tip) return;
    tip.style.left = '';
    tip.style.top = '';
    tip.style.visibility = '';
    tip.classList.remove('tooltip-below');
  }

  let activeTerm = null;

  function showTooltip(term) {
    if (activeTerm && activeTerm !== term) {
      activeTerm.classList.remove('active', 'show-tooltip');
      clearPosition(activeTerm);
    }
    activeTerm = term;
    positionTooltip(term);
    term.classList.add('show-tooltip');
  }

  function hideTooltip(term) {
    if (term === activeTerm) activeTerm = null;
    term.classList.remove('active', 'show-tooltip');
    clearPosition(term);
  }

  const glossaryTerms = document.querySelectorAll('.glossary-term');
  glossaryTerms.forEach(function (term) {
    // Desktop: hover and keyboard focus.
    term.addEventListener('mouseenter', function () { showTooltip(term); });
    term.addEventListener('mouseleave', function () { hideTooltip(term); });
    term.addEventListener('focus', function () { showTooltip(term); });
    term.addEventListener('blur', function () { hideTooltip(term); });

    // Mobile/touch: tap to toggle.
    term.addEventListener('click', function (e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        const wasActive = term.classList.contains('active');
        if (activeTerm) {
          activeTerm.classList.remove('active', 'show-tooltip');
          clearPosition(activeTerm);
          activeTerm = null;
        }
        if (!wasActive) {
          term.classList.add('active');
          showTooltip(term);
        }
      }
    });
  });

  // Re-position on scroll/resize while a tooltip is open. The term may have
  // moved (page scroll) or the viewport size changed.
  function reposition() {
    if (activeTerm) positionTooltip(activeTerm);
  }
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);

  // Close mobile tooltips when clicking outside.
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.glossary-term')) {
      if (activeTerm) {
        activeTerm.classList.remove('active', 'show-tooltip');
        clearPosition(activeTerm);
        activeTerm = null;
      }
    }
  });

  // Close on escape key.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && activeTerm) {
      activeTerm.classList.remove('active', 'show-tooltip');
      clearPosition(activeTerm);
      activeTerm = null;
    }
  });
});
