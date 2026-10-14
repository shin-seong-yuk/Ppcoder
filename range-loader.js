(() => {
  const range = document.querySelector('#range');
  const status = document.querySelector('#range-loading');
  function fallback() {
    range.dataset.engine = 'fallback';
    status.textContent = '3D를 실행할 수 없습니다. 아래 프로젝트 버튼으로 내용을 확인하세요.';
    document.querySelectorAll('.range-label').forEach(button => {
      button.onclick = () => document.querySelector(button.dataset.destination)?.scrollIntoView({behavior:'smooth'});
    });
    document.querySelectorAll('#sound-toggle,#quality-toggle,#pause-toggle,#reset-props,.range-quickbar button,.weapon').forEach(el => el.disabled = true);
  }
  const observer = new IntersectionObserver(async entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    try {
      const module = await import('./range-3d.js');
      await module.initRange();
    } catch (error) {
      console.error('3D range unavailable:', error);
      fallback();
    }
  }, {rootMargin:'500px'});
  observer.observe(range);
})();
