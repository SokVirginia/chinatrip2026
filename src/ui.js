(() => {
  function toggleLocal(btn) {
    btn.classList.toggle('open');
    const panel = btn.closest('.city-section').querySelector('.local-panel');
    if (panel) panel.classList.toggle('open');
  }

  function toggleDetail(btn) {
    const d = btn.closest('.ltile').querySelector('.ltile-detail');
    btn.textContent = d.classList.toggle('open') ? 'свернуть' : 'подробнее';
  }

  function selectDay(isoDate) {
    document.querySelectorAll('.ds-pill').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.ds-panel').forEach(p => { p.hidden = true; });

    const pill  = document.querySelector(`.ds-pill[data-date="${isoDate}"]`);
    const panel = document.getElementById(`day-${isoDate}`);

    if (pill) {
      pill.classList.add('active');
      pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    if (panel) panel.hidden = false;
  }

  function initDayStrip() {
    const pills = document.querySelectorAll('.ds-pill');
    if (!pills.length) return;

    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    const todayPill = document.querySelector(`.ds-pill[data-date="${todayIso}"]`);
    if (todayPill) todayPill.classList.add('today');

    const firstDate = pills[0].dataset.date;
    const lastDate  = pills[pills.length - 1].dataset.date;

    if (todayPill) {
      selectDay(todayIso);
    } else if (todayIso < firstDate) {
      selectDay(firstDate);
    } else {
      selectDay(lastDate);
    }
  }

  window.toggleLocal  = toggleLocal;
  window.toggleDetail = toggleDetail;
  window.selectDay    = selectDay;
  window.initDayStrip = initDayStrip;
})();

