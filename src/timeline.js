(() => {
  const { dtUTC8, parseRuDate, parseRuTime, escapeHtml, fmtRuDateTime } = window.AppUtils;

  function parseMdBlocks(md, level3Prefix = '### ') {
    const lines = md.split(/\r?\n/);
    const blocks = [];
    let cur = null;
    for (const line of lines) {
      if (line.startsWith(level3Prefix)) {
        if (cur) blocks.push(cur);
        cur = { title: line.slice(level3Prefix.length).trim(), kv: {} };
        continue;
      }
      if (!cur) continue;
      const m = line.match(/^\-\s*([^:]+)\s*:\s*(.*)\s*$/);
      if (m) cur.kv[m[1].trim()] = m[2].trim();
    }
    if (cur) blocks.push(cur);
    return blocks;
  }

  function parseRouteMd(md) {
    const blocks = parseMdBlocks(md, '### ');
    const legs = [];
    const hotels = [];

    for (const b of blocks) {
      const type = (b.kv['Вид транспорта'] || '').toLowerCase();
      if (type) {
        if (type.includes('самол')) {
          const d = parseRuDate(b.kv['Дата'] || '');
          const depT = parseRuTime(b.kv['Время отправления'] || '');
          const arrT = parseRuTime(b.kv['Время прибытия'] || '');
          const fromCity = b.kv['Город отправления'] || '';
          const toCity = b.kv['Город прибытия'] || '';
          if (d && depT && arrT && fromCity && toCity) {
            const start = dtUTC8(d.y, d.mo, d.d, depT.h, depT.mi);
            let end = dtUTC8(d.y, d.mo, d.d, arrT.h, arrT.mi);
            if (end < start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
            legs.push({ kind: 'plane', fromCity, toCity, code: b.kv['Номер рейса'] || '', start, end, raw: b });
          }
          continue;
        }
        if (type.includes('поезд')) {
          const depD = parseRuDate(b.kv['Дата отправления'] || b.kv['Дата'] || '');
          const depT = parseRuTime(b.kv['Время отправления'] || '');
          const arrD = parseRuDate(b.kv['Дата прибытия'] || b.kv['Дата'] || '');
          const arrT = parseRuTime(b.kv['Время прибытия'] || '');
          const fromCity = b.kv['Город отправления'] || '';
          const toCity = b.kv['Город прибытия'] || '';
          if (depD && depT && arrD && arrT && fromCity && toCity) {
            const start = dtUTC8(depD.y, depD.mo, depD.d, depT.h, depT.mi);
            const end = dtUTC8(arrD.y, arrD.mo, arrD.d, arrT.h, arrT.mi);
            legs.push({ kind: 'train', fromCity, toCity, label: b.kv['Вид транспорта'] || 'поезд', start, end, raw: b });
          }
          continue;
        }
      }

      if (b.kv['Отель'] || b.kv['Даты проживания']) {
        const city = b.kv['Город'] || '';
        const dateRange = b.kv['Даты проживания'] || '';
        const m = dateRange.match(/(\d{1,2}\s+[а-яё]+)\s*→\s*(\d{1,2}\s+[а-яё]+)/i);
        if (city && m) {
          const startD = parseRuDate(m[1]);
          const endD = parseRuDate(m[2]);
          if (startD && endD) {
            const checkin = (b.kv['Заезд'] || '').match(/(\d{1,2}):(\d{2})/);
            const checkout = (b.kv['Выезд'] || '').match(/(\d{1,2}):(\d{2})/);
            const inH = checkin ? Number(checkin[1]) : 14;
            const inM = checkin ? Number(checkin[2]) : 0;
            const outH = checkout ? Number(checkout[1]) : 12;
            const outM = checkout ? Number(checkout[2]) : 0;
            const start = dtUTC8(startD.y, startD.mo, startD.d, inH, inM);
            const end = dtUTC8(endD.y, endD.mo, endD.d, outH, outM);
            hotels.push({
              city,
              title: `${b.kv['Отель'] || b.title} · ${city}`,
              start,
              end,
              raw: b
            });
          }
        }
      }
    }

    legs.sort((a, b) => a.start - b.start);
    hotels.sort((a, b) => a.start - b.start);
    return { legs, hotels };
  }

  function parseLocalTransportMd(md) {
    const lines = md.split(/\r?\n/);
    const items = [];
    let cur = null;
    for (const line of lines) {
      const h = line.match(/^##\s+(.+?)\s+—\s+(.+)$/);
      if (h) {
        if (cur) items.push(cur);
        cur = { header: h[0].slice(3).trim(), dateLabel: h[1].trim(), title: h[2].trim(), kv: {} };
        continue;
      }
      if (!cur) continue;
      const m = line.match(/^\-\s*([^:]+)\s*:\s*(.*)\s*$/);
      if (m) cur.kv[m[1].trim()] = m[2].trim();
    }
    if (cur) items.push(cur);

    for (const it of items) {
      const d = parseRuDate(it.dateLabel || '');
      it.date = d ? dtUTC8(d.y, d.mo, d.d, 12, 0) : null;
    }
    return items;
  }

  function renderLegCard(leg) {
    const isPlane = leg.kind === 'plane';
    const badge = isPlane ? `<span class="badge bp">✈</span>` : `<span class="badge bt">🚆</span>`;
    const sub = `${fmtRuDateTime(leg.start)} → ${fmtRuDateTime(leg.end)}`;
    const main = `${escapeHtml(leg.fromCity)} → ${escapeHtml(leg.toCity)}${badge}`;
    const iconWrap = isPlane ? 'ip' : 'itr';
    const spineClassTop = 'ltravel';
    const iconSvg = isPlane
      ? `<svg class="ic" viewBox="0 0 16 16" fill="none"><path d="M2 10.5L7 8.5V5a1 1 0 012 0v3.5l5 2v1.5l-5-1v2l1.5 1V15L8 14l-2.5 1v-1.5L7 12.5v-2L2 12v-1.5z" fill="#378ADD"/></svg>`
      : `<svg class="ic" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="10" rx="2" stroke="#3B6D11" stroke-width="1.2" fill="none"/><rect x="5" y="4" width="2.5" height="3" rx="0.5" fill="#3B6D11"/><rect x="8.5" y="4" width="2.5" height="3" rx="0.5" fill="#3B6D11"/><line x1="5" y1="9" x2="11" y2="9" stroke="#3B6D11" stroke-width="1"/><line x1="4" y1="12" x2="6.5" y2="12" stroke="#3B6D11" stroke-width="1.2" stroke-linecap="round"/><line x1="9.5" y1="12" x2="12" y2="12" stroke="#3B6D11" stroke-width="1.2" stroke-linecap="round"/></svg>`;

    return `<div class="leg-section">
      <div class="leg-row">
        <div class="lspine"><div class="llt ${spineClassTop}"></div><div class="liw ${iconWrap}">${iconSvg}</div><div class="llb ${spineClassTop}"></div></div>
        <div class="linfo"><div class="lmain">${main}</div><div class="lsub">${escapeHtml(sub)}</div></div>
      </div>
    </div>`;
  }

  function renderCityCard(hotel, locals) {
    const start = fmtRuDateTime(hotel.start);
    const end = fmtRuDateTime(hotel.end);
    const city = escapeHtml(hotel.city);
    const title = escapeHtml(hotel.title.split('·')[0].trim());

    const localsHtml = (locals && locals.length)
      ? `<button class="local-btn" onclick="toggleLocal(this)"><span class="arr">▶</span> локальные перемещения</button>
         <div class="local-panel"><div class="local-inner">
           ${locals.map(li => {
             const price = li.kv['Стоимость'] ? `<span class="ltile-price">${escapeHtml(li.kv['Стоимость'])}</span>` : '';
             const sub = li.kv['Вид транспорта'] ? `${li.kv['Вид транспорта']} · ${li.dateLabel}` : li.dateLabel;
             return `<div class="ltile">
               <div class="ltile-head">
                 <div class="ltile-icon ip"><svg class="ic" viewBox="0 0 16 16" fill="none"><path d="M8 2C5.8 2 4 3.8 4 6c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" fill="#378ADD"/></svg></div>
                 <div class="ltile-main"><div class="ltile-title">${escapeHtml(li.title)}</div><div class="ltile-sub">${escapeHtml(sub)}</div></div>
                 <div class="ltile-meta">${price}<button class="ltile-expand" onclick="toggleDetail(this)">подробнее</button></div>
               </div>
               <div class="ltile-detail"><div class="ltile-detail-inner">
                 ${Object.entries(li.kv).map(([k, v]) => `<div class="drow"><span class="dlbl">${escapeHtml(k)}</span><span class="dval">${escapeHtml(v)}</span></div>`).join('')}
               </div></div>
             </div>`;
           }).join('')}
         </div></div>`
      : '';

    return `<div class="city-section">
      <div class="city-row">
        <div class="spine"><div class="cdot d-bj"></div><div class="sline lstay" style="height:10px"></div></div>
        <div class="ccard">
          <div class="ctitle"><span class="cname">${city}</span><span class="cdates">${escapeHtml(start)} → ${escapeHtml(end)}</span></div>
          <div class="chotel">${title}</div>
          ${localsHtml}
        </div>
      </div>
    </div>`;
  }

  async function buildTimelineFromMd() {
    const el = document.getElementById('timeline');
    if (!el) return;
    el.innerHTML = `<div class="sb-idle" style="justify-content:center"><div style="font-size:12px;color:var(--tx3)">загружаем таймлайн…</div></div>`;
    try {
      const [routeMd, localMd] = await Promise.all([
        fetch('./data/marshrut-kitay-v11.md').then(r => r.text()),
        fetch('./data/local-transport.md').then(r => r.text())
      ]);
      const { legs, hotels } = parseRouteMd(routeMd);
      const locals = parseLocalTransportMd(localMd);

      function localsForHotel(hotel) {
        const start = hotel.start.getTime() - 24 * 60 * 60 * 1000;
        const end = hotel.end.getTime() + 24 * 60 * 60 * 1000;
        return locals
          .filter(li => li.date && li.date.getTime() >= start && li.date.getTime() <= end)
          .filter(li => (`${li.header} ${li.title}`).toLowerCase().includes(hotel.city.toLowerCase()));
      }

      const usedHotels = new Set();
      let html = '';

      if (legs.length) {
        const first = legs[0];
        const depCity = escapeHtml(first.fromCity);
        html += `<div class="city-section">
          <div class="city-row">
            <div class="spine"><div class="cdot d-kja"></div><div class="sline ltravel" style="height:24px"></div></div>
            <div class="ccard"><div class="ctitle"><span class="cname">${depCity}</span><span class="cdates">${escapeHtml(fmtRuDateTime(first.start))}</span></div><div class="chotel" style="padding-bottom:10px">Вылет</div></div>
          </div>
        </div>`;
      }

      for (const leg of legs) {
        html += renderLegCard(leg);
        const arrivingCity = leg.toCity;
        const h = hotels.find(hh =>
          !usedHotels.has(hh) &&
          hh.city === arrivingCity &&
          hh.start.getTime() >= leg.end.getTime() - 24 * 60 * 60 * 1000 &&
          hh.start.getTime() <= leg.end.getTime() + 48 * 60 * 60 * 1000
        );
        if (h) {
          usedHotels.add(h);
          html += renderCityCard(h, localsForHotel(h));
        }
      }

      el.innerHTML = html || `<div class="sb-idle" style="justify-content:center"><div style="font-size:12px;color:var(--tx3)">таймлайн пуст</div></div>`;
    } catch (e) {
      el.innerHTML = `<div class="sb-idle" style="justify-content:center"><div style="font-size:12px;color:var(--tx3)">не удалось загрузить md-файлы</div></div>`;
    }
  }

  window.Timeline = { buildTimelineFromMd };
})();

