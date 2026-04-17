(() => {
  function toggleLocal(btn) {
    btn.classList.toggle('open');
    btn.nextElementSibling.classList.toggle('open');
  }

  function toggleDetail(btn) {
    const d = btn.closest('.ltile').querySelector('.ltile-detail');
    btn.textContent = d.classList.toggle('open') ? 'свернуть' : 'подробнее';
  }

  window.toggleLocal = toggleLocal;
  window.toggleDetail = toggleDetail;
})();

