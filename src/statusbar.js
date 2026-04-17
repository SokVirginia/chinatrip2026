(() => {
  // Statusbar uses a "UTC+8 wall-time scale": event dates are created with Date.UTC(y,mo-1,d,h,mi).
  // Display uses getUTC* so times match UTC+8 wall time.

  function dt(y, mo, d, h, mi) {
    return new Date(Date.UTC(y, mo - 1, d, h, mi));
  }

  const TZ_OFFSET_MIN = 8 * 60;
  function nowUTC8() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + TZ_OFFSET_MIN * 60000);
  }

  // ── CHECKIN ──────────────────────────────────────────────────
  const CHECKIN_OPEN_MS = 24 * 60 * 60 * 1000;
  const CHECKIN_WARN_MS = 90 * 60 * 1000;
  const CHECKIN_CLOSE_MS = 45 * 60 * 1000;

  function fmtCountdown(ms) {
    if (ms <= 0) return '0м';
    const tot = Math.floor(ms / 60000);
    const d = Math.floor(tot / 1440), h = Math.floor((tot % 1440) / 60), m = tot % 60;
    if (d > 0) return h > 0 ? `${d}д ${h}ч` : `${d}д`;
    if (h > 0) return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
    return `${m}м`;
  }

  function fmtIn(ms) {
    if (ms <= 0) return '';
    const tot = Math.floor(ms / 60000);
    const d = Math.floor(tot / 1440), h = Math.floor((tot % 1440) / 60), m = tot % 60;
    if (d >= 2) return `через ${d} дня`;
    if (d === 1) return `через 1 день`;
    if (h > 0) return `через ${h}ч ${m}м`;
    return `через ${m}м`;
  }

  function renderCheckin(event, now) {
    if (event.type !== 'plane') return '';
    const dep = event.start;
    const msUntilDep = dep - now;
    if (msUntilDep > CHECKIN_OPEN_MS || now >= dep) return '';
    if (msUntilDep <= 0) return '';

    if (msUntilDep <= CHECKIN_CLOSE_MS) {
      return `<div class="sb-checkin sb-checkin-closed">
        <span class="sb-checkin-dot sb-checkin-dot-closed"></span>
        <span class="sb-checkin-text sb-checkin-text-closed">регистрация закрыта</span>
      </div>`;
    }

    if (msUntilDep <= CHECKIN_WARN_MS) {
      const pct = Math.round((1 - (msUntilDep - CHECKIN_CLOSE_MS) / (CHECKIN_WARN_MS - CHECKIN_CLOSE_MS)) * 100);
      const left = fmtCountdown(msUntilDep - CHECKIN_CLOSE_MS);
      return `<div class="sb-checkin sb-checkin-warn">
        <span class="sb-checkin-dot sb-checkin-dot-warn"></span>
        <span class="sb-checkin-text sb-checkin-text-warn">⚠ регистрация · закрывается через ${left}</span>
        <div class="sb-checkin-bar-wrap"><div class="sb-checkin-bar sb-checkin-bar-warn" style="width:${pct}%"></div></div>
      </div>`;
    }

    const totalWindow = CHECKIN_OPEN_MS - CHECKIN_CLOSE_MS;
    const elapsed = totalWindow - (msUntilDep - CHECKIN_CLOSE_MS);
    const pct = Math.round(elapsed / totalWindow * 100);
    const left = fmtCountdown(msUntilDep - CHECKIN_CLOSE_MS);
    return `<div class="sb-checkin sb-checkin-open">
      <span class="sb-checkin-dot sb-checkin-dot-open"></span>
      <span class="sb-checkin-text sb-checkin-text-open">регистрация открыта · закрывается через ${left}</span>
      <div class="sb-checkin-bar-wrap"><div class="sb-checkin-bar sb-checkin-bar-open" style="width:${pct}%"></div></div>
    </div>`;
  }
  // ── END CHECKIN ───────────────────────────────────────────────

  const EVENTS = [
    { id: 's7-6432', type: 'plane', priority: 1, icon: '✈', barClass: 'sb-bar-plane', iconClass: 'sb-icon-plane', label: 'перелёт', title: 'S7 6432 · Красноярск → Иркутск', subtitle: 'KJA → IKT', start: dt(2026, 4, 18, 21, 5), end: dt(2026, 4, 18, 23, 45), d: [{ l: 'вылет', v: '18 апр, 21:05 (KJA)' }, { l: 'прибытие', v: '18 апр, 23:45 (IKT)' }, { l: 'рейс', v: 'S7 6432 · Embraer 170' }] },
    { id: 's7-6311', type: 'plane', priority: 1, icon: '✈', barClass: 'sb-bar-plane', iconClass: 'sb-icon-plane', label: 'перелёт', title: 'S7 6311 · Иркутск → Пекин', subtitle: 'IKT → PKX (Beijing Daxing)', start: dt(2026, 4, 19, 1, 40), end: dt(2026, 4, 19, 4, 35), d: [{ l: 'вылет', v: '19 апр, 01:40 (IKT)' }, { l: 'прибытие', v: '19 апр, 04:35 (PKX)' }, { l: 'рейс', v: 'S7 6311 · Boeing 737-800' }] },
    { id: 'train-bj-zjj', type: 'train', priority: 1, icon: '🚆', barClass: 'sb-bar-train', iconClass: 'sb-icon-train', label: 'поезд', title: 'Пекин → Чжанцзядзе', subtitle: 'Beijing West → Zhangjiajie West', start: dt(2026, 4, 22, 11, 14), end: dt(2026, 4, 23, 5, 20), d: [{ l: 'отправление', v: '22 апр, 11:14 (北京西站)' }, { l: 'прибытие', v: '23 апр, 05:20 (张家界西站)' }, { l: 'длительность', v: '18ч 06м' }] },
    { id: 'train-zjj-frz', type: 'train', priority: 1, icon: '🚆', barClass: 'sb-bar-train', iconClass: 'sb-icon-train', label: 'скоростной поезд', title: 'Чжанцзядзе → Фужунчжэнь', subtitle: 'Zhangjiajie West → Furongzhen', start: dt(2026, 4, 27, 12, 47), end: dt(2026, 4, 27, 13, 10), d: [{ l: 'отправление', v: '27 апр, 12:47' }, { l: 'прибытие', v: '27 апр, 13:10' }, { l: 'длительность', v: '23 мин' }] },
    { id: 'train-frz-zjj', type: 'train', priority: 1, icon: '🚆', barClass: 'sb-bar-train', iconClass: 'sb-icon-train', label: 'скоростной поезд', title: 'Фужунчжэнь → Чжанцзядзе', subtitle: 'Furongzhen → Zhangjiajie West', start: dt(2026, 4, 28, 12, 5), end: dt(2026, 4, 28, 12, 28), d: [{ l: 'отправление', v: '28 апр, 12:05' }, { l: 'прибытие', v: '28 апр, 12:28' }, { l: 'длительность', v: '23 мин' }] },
    { id: 'ho1222', type: 'plane', priority: 1, icon: '✈', barClass: 'sb-bar-plane', iconClass: 'sb-icon-plane', label: 'перелёт', title: 'HO1222 · Чжанцзядзе → Шанхай', subtitle: 'DYG → PVG (Shanghai Pudong)', start: dt(2026, 4, 28, 16, 25), end: dt(2026, 4, 28, 18, 30), d: [{ l: 'вылет', v: '28 апр, 16:25 (DYG)' }, { l: 'прибытие', v: '28 апр, 18:30 (PVG)' }, { l: 'рейс', v: 'HO1222' }] },
    { id: 'cz8880', type: 'plane', priority: 1, icon: '✈', barClass: 'sb-bar-plane', iconClass: 'sb-icon-plane', label: 'перелёт', title: 'CZ8880 · Шанхай → Пекин', subtitle: 'SHA Hongqiao → PKX (Beijing Daxing)', start: dt(2026, 5, 2, 15, 30), end: dt(2026, 5, 2, 17, 40), d: [{ l: 'вылет', v: '2 мая, 15:30 (SHA)' }, { l: 'прибытие', v: '2 мая, 17:40 (PKX)' }, { l: 'рейс', v: 'CZ8880' }] },
    { id: 's7-6312', type: 'plane', priority: 1, icon: '✈', barClass: 'sb-bar-plane', iconClass: 'sb-icon-plane', label: 'перелёт', title: 'S7 6312 · Пекин → Иркутск', subtitle: 'PKX → IKT', start: dt(2026, 5, 4, 5, 35), end: dt(2026, 5, 4, 8, 45), d: [{ l: 'вылет', v: '4 мая, 05:35 (PKX)' }, { l: 'прибытие', v: '4 мая, 08:45 (IKT)' }, { l: 'рейс', v: 'S7 6312 · Boeing 737-800' }] },
    { id: 's7-6431', type: 'plane', priority: 1, icon: '✈', barClass: 'sb-bar-plane', iconClass: 'sb-icon-plane', label: 'перелёт', title: 'S7 6431 · Иркутск → Красноярск', subtitle: 'IKT → KJA', start: dt(2026, 5, 4, 19, 50), end: dt(2026, 5, 4, 21, 30), d: [{ l: 'вылет', v: '4 мая, 19:50 (IKT)' }, { l: 'прибытие', v: '4 мая, 20:30 (KJA)' }, { l: 'рейс', v: 'S7 6431 · Embraer 170' }] },

    { id: 'hotel-bj-1', type: 'hotel', priority: 0, icon: '🏨', barClass: 'sb-bar-hotel', iconClass: 'sb-icon-hotel', label: 'проживание', title: 'Jialong Hotel · Пекин', subtitle: 'Chaoyangmen · Dongcheng', start: dt(2026, 4, 19, 14, 0), end: dt(2026, 4, 22, 14, 0), d: [{ l: 'заезд', v: '19 апр, после 14:00' }, { l: 'выезд', v: '22 апр, до 14:00' }, { l: 'бронь', v: '153936075973396' }] },
    { id: 'hotel-zjj', type: 'hotel', priority: 0, icon: '🏨', barClass: 'sb-bar-hotel', iconClass: 'sb-icon-hotel', label: 'проживание', title: 'Qiquan Homestay · Чжанцзядзе', subtitle: 'Wulingyuan · National Forest Park', start: dt(2026, 4, 23, 13, 0), end: dt(2026, 4, 27, 14, 0), d: [{ l: 'заезд', v: '23 апр, после 13:00' }, { l: 'выезд', v: '27 апр, до 14:00' }, { l: 'бронь', v: '1539360649797487' }] },
    { id: 'hotel-frz', type: 'hotel', priority: 0, icon: '🏨', barClass: 'sb-bar-hotel', iconClass: 'sb-icon-hotel', label: 'проживание', title: 'Xuanyuan B&B · Фужунчжэнь', subtitle: 'Furong Town Scenic Area', start: dt(2026, 4, 27, 14, 0), end: dt(2026, 4, 28, 14, 0), d: [{ l: 'заезд', v: '27 апр, после 14:00' }, { l: 'выезд', v: '28 апр, до 14:00' }, { l: 'бронь', v: '1539361794512009' }] },
    { id: 'hotel-sh', type: 'hotel', priority: 0, icon: '🏨', barClass: 'sb-bar-hotel', iconClass: 'sb-icon-hotel', label: 'проживание', title: 'Heyitang Hotel · Шанхай', subtitle: 'Huinan Town · Pudong', start: dt(2026, 4, 28, 14, 0), end: dt(2026, 5, 2, 12, 0), d: [{ l: 'заезд', v: '28 апр, после 14:00' }, { l: 'выезд', v: '2 мая, до 12:00' }, { l: 'бронь', v: '1539361999479926' }] },
    { id: 'hotel-bj-2', type: 'hotel', priority: 0, icon: '🏨', barClass: 'sb-bar-hotel', iconClass: 'sb-icon-hotel', label: 'проживание', title: 'James Joyce Coffetel · Пекин', subtitle: 'Дасин · рядом с аэропортом PKX', start: dt(2026, 5, 2, 14, 0), end: dt(2026, 5, 4, 14, 0), d: [{ l: 'заезд', v: '2 мая, после 14:00' }, { l: 'выезд', v: '4 мая, до 14:00' }, { l: 'бронь', v: '1539363458646333' }] },
  ];

  function getSorted() { return [...EVENTS].sort((a, b) => a.start - b.start); }
  function getCurrent(now) {
    const active = EVENTS.filter(e => now >= e.start && now < e.end);
    if (!active.length) return null;
    const transport = active.filter(e => e.priority === 1);
    return transport.length ? transport[0] : active[0];
  }
  function getNext(now, current) {
    const sorted = getSorted();
    for (const e of sorted) {
      if (e.start <= now) continue;
      if (current && e.id === current.id) continue;
      if (current && current.priority === 1 && e.priority === 0 && e.start < current.end) continue;
      return e;
    }
    return null;
  }

  function renderSB() {
    const now = nowUTC8();
    const current = getCurrent(now);
    const next = getNext(now, current);
    const wrap = document.getElementById('sb-wrap');
    if (!wrap) return;
    const sorted = getSorted();
    const tripStart = sorted[0].start;
    const tripEnd = sorted[sorted.length - 1].end;

    if (now < tripStart) {
      const n = next || sorted[0];
      wrap.innerHTML = `<div class="sb-idle">
        <div class="sb-next-icon">✈</div>
        <div class="sb-idle-meta">
          <div class="sb-idle-lbl">до поездки · следующее</div>
          <div class="sb-idle-title">${n.title}</div>
          <div class="sb-idle-sub">${n.subtitle} · ${n.d[0].v}</div>
        </div>
        <div class="sb-idle-in">${fmtIn(n.start - now)}</div>
      </div>${renderCheckin(n, now)}`;
      return;
    }
    if (now >= tripEnd) {
      wrap.innerHTML = `<div class="sb-idle" style="justify-content:center">
        <div style="font-size:13px;color:var(--tx2)">Поездка завершена · добро пожаловать домой</div>
      </div>`;
      return;
    }

    let html = '';
    if (current) {
      const pct = Math.round((now - current.start) / (current.end - current.start) * 100);
      const remain = fmtCountdown(current.end - now);
      const remainLbl = current.type === 'hotel' ? 'до выезда' : 'до прибытия';
      html += `<div class="sb-card">
        <div class="sb-top">
          <div class="sb-icon ${current.iconClass}">${current.icon}</div>
          <div class="sb-meta">
            <div class="sb-status-lbl">сейчас · ${current.label}</div>
            <div class="sb-title">${current.title}</div>
            <div class="sb-subtitle">${current.subtitle}</div>
          </div>
          <div class="sb-time">
            <div class="sb-countdown">${remain}</div>
            <div class="sb-countdown-lbl">${remainLbl}</div>
          </div>
        </div>
        <div class="sb-prog-wrap">
          <div class="sb-bar-bg"><div class="sb-bar-fill ${current.barClass}" style="width:${pct}%"></div></div>
          <div class="sb-pct">${pct}%</div>
        </div>
        ${renderCheckin(current, now)}
        <div class="sb-details">
          ${current.d.map(d => `<div class="sb-det"><div class="sb-det-lbl">${d.l}</div><div class="sb-det-val">${d.v}</div></div>`).join('')}
        </div>
      </div>`;
    }
    if (next) {
      html += `<div class="sb-next">
        <div class="sb-next-icon">${next.icon}</div>
        <div class="sb-next-meta">
          <div class="sb-next-lbl">следующее · ${next.label}</div>
          <div class="sb-next-title">${next.title}</div>
          <div class="sb-next-sub">${next.subtitle} · ${next.d[0].v}</div>
        </div>
        <div class="sb-next-in">${fmtIn(next.start - now)}</div>
      </div>${renderCheckin(next, now)}`;
    }
    wrap.innerHTML = html;
  }

  function init() {
    renderSB();
    setInterval(renderSB, 30000);
  }

  window.Statusbar = { init };
})();

