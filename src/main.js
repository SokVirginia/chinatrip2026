(() => {
  // App bootstrap: PWA + dynamic timeline + existing statusbar.
  function init() {
    try { window.PWA?.registerPwa?.(); } catch {}

    document.addEventListener('DOMContentLoaded', async () => {
      try { await window.Timeline?.buildTimelineFromMd?.(); } catch {}
      try { window.applyTransferGroups?.(); } catch {}
    });
  }

  init();
})();

