(() => {
  const nav = document.getElementById('site-nav');
  const toggle = document.querySelector('.topbar__toggle');
  const collapseClass = 'is-collapsible';

  if (!nav || !toggle) {
    return;
  }

  const collapseNav = (restoreFocus = false) => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      toggle.focus();
    }
  };

  const expandNav = () => {
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  };

  const handleToggleClick = () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      collapseNav();
    } else {
      expandNav();
    }
  };

  const handleResize = () => {
    if (window.matchMedia('(min-width: 769px)').matches) {
      collapseNav();
    }
  };

  nav.classList.add(collapseClass);
  toggle.addEventListener('click', handleToggleClick);
  window.addEventListener('resize', handleResize);

  nav.addEventListener('click', (event) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.tagName === 'A' &&
      window.matchMedia('(max-width: 768px)').matches
    ) {
      collapseNav();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      collapseNav(true);
    }
  });
})();
