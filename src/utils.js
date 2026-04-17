// Shared helpers (timezone-safe display in UTC+8)
(() => {
  const TZ_OFFSET_MIN = 8 * 60;
  const MD_YEAR = 2026;
  const RU_MONTHS = {
    'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4, 'мая': 5, 'июня': 6,
    'июля': 7, 'августа': 8, 'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12
  };

  function nowUTC8() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + TZ_OFFSET_MIN * 60000);
  }

  // Create a Date whose UTC components represent UTC+8 wall time.
  function dtUTC8(y, mo, d, h, mi) {
    return new Date(Date.UTC(y, mo - 1, d, h - 8, mi));
  }

  function parseRuDate(dayMonthStr) {
    const m = (dayMonthStr || '').trim().toLowerCase().match(/^(\d{1,2})\s+([а-яё]+)$/i);
    if (!m) return null;
    const d = Number(m[1]);
    const mo = RU_MONTHS[m[2]];
    if (!mo) return null;
    return { y: MD_YEAR, mo, d };
  }

  function parseRuTime(t) {
    const m = (t || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return { h: Number(m[1]), mi: Number(m[2]) };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtRuDateTime(d) {
    // IMPORTANT: all app dates are stored as dtUTC8; render via getUTC* to show UTC+8 wall time.
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dd = d.getUTCDate();
    const mm = months[d.getUTCMonth()];
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${dd} ${mm} ${hh}:${mi}`;
  }

  function fmtGap(ms) {
    const tot = Math.round(ms / 60000);
    const h = Math.floor(tot / 60), m = tot % 60;
    if (h <= 0) return `${m}м`;
    if (m === 0) return `${h}ч`;
    return `${h}ч ${m}м`;
  }

  window.AppUtils = {
    TZ_OFFSET_MIN,
    nowUTC8,
    dtUTC8,
    parseRuDate,
    parseRuTime,
    escapeHtml,
    fmtRuDateTime,
    fmtGap,
  };
})();

