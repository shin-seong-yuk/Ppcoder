(() => {
  const button = document.querySelector('#theme-toggle');
  if (!button) return;
  const apply = theme => {
    const light = theme === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    button.setAttribute('aria-pressed', String(light));
    button.setAttribute('aria-label', light ? '다크 모드로 전환' : '라이트 모드로 전환');
    button.querySelector('[aria-hidden]').textContent = light ? '☾' : '☀';
    button.querySelector('.theme-toggle-text').textContent = light ? '다크 모드' : '라이트 모드';
  };
  apply(document.documentElement.dataset.theme);
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    apply(next);
    try { localStorage.setItem('portfolio-theme', next); } catch {}
  });

  const orbit = document.querySelector('.celestial-orbit');
  if (!orbit || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let previousScroll = window.scrollY;
  let lag = 0;
  let frame = 0;
  const followScroll = () => {
    lag *= 0.88;
    orbit.style.transform = `translate3d(0, ${lag.toFixed(2)}px, 0)`;
    if (Math.abs(lag) > 0.25) frame = requestAnimationFrame(followScroll);
    else { orbit.style.transform = ''; frame = 0; }
  };
  window.addEventListener('scroll', () => {
    const nextScroll = window.scrollY;
    lag = Math.max(-120, Math.min(120, lag + (previousScroll - nextScroll) * 0.7));
    previousScroll = nextScroll;
    if (!frame) frame = requestAnimationFrame(followScroll);
  }, { passive: true });
})();
