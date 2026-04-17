import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ROUTE_MD = path.join(ROOT, 'data', 'marshrut-kitay-v11.md');
const LOCAL_MD = path.join(ROOT, 'data', 'local-transport.md');

const YEAR = 2026;
const RU_MONTHS = {
  'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4, 'мая': 5, 'июня': 6,
  'июля': 7, 'августа': 8, 'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseRuDate(s) {
  const m = (s || '').trim().toLowerCase().match(/^(\d{1,2})\s+([а-яё]+)$/i);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = RU_MONTHS[m[2]];
  if (!mo) return null;
  return { y: YEAR, mo, d };
}

function parseTime(s) {
  const m = (s || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { h: Number(m[1]), mi: Number(m[2]) };
}

function dateKey(d) {
  return d.y * 10000 + d.mo * 100 + d.d;
}

function addDays(d, delta) {
  // naive date add, good enough for this itinerary window
  const js = new Date(Date.UTC(d.y, d.mo - 1, d.d + delta, 12, 0));
  return { y: js.getUTCFullYear(), mo: js.getUTCMonth() + 1, d: js.getUTCDate() };
}

function fmtDate(d) {
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return `${d.d} ${months[d.mo - 1]}`;
}

function fmtDateTime(d, t) {
  return `${fmtDate(d)} ${String(t.h).padStart(2,'0')}:${String(t.mi).padStart(2,'0')}`;
}

function parseMdBlocks(md) {
  const lines = md.split(/\r?\n/);
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (cur) blocks.push(cur);
      cur = { title: line.slice(4).trim(), kv: {} };
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^\-\s*([^:]+)\s*:\s*(.*)\s*$/);
    if (m) cur.kv[m[1].trim()] = m[2].trim();
  }
  if (cur) blocks.push(cur);
  return blocks;
}

function parseRoute(md) {
  const blocks = parseMdBlocks(md);
  const legs = [];
  const stays = [];

  for (const b of blocks) {
    const kind = (b.kv['Вид транспорта'] || '').toLowerCase();
    if (kind) {
      if (kind.includes('самол')) {
        const d = parseRuDate(b.kv['Дата']);
        const dep = parseTime(b.kv['Время отправления']);
        const arr = parseTime(b.kv['Время прибытия']);
        if (!d || !dep || !arr) continue;
        const fromCity = b.kv['Город отправления'] || '';
        const toCity = b.kv['Город прибытия'] || '';
        const code = b.kv['Номер рейса'] || '';
        let arrDate = d;
        if ((arr.h * 60 + arr.mi) < (dep.h * 60 + dep.mi)) arrDate = addDays(d, 1);
        legs.push({ kind: 'plane', fromCity, toCity, code, depDate: d, depTime: dep, arrDate, arrTime: arr });
      } else if (kind.includes('поезд')) {
        const depD = parseRuDate(b.kv['Дата отправления'] || b.kv['Дата']);
        const depT = parseTime(b.kv['Время отправления']);
        const arrD = parseRuDate(b.kv['Дата прибытия'] || b.kv['Дата']);
        const arrT = parseTime(b.kv['Время прибытия']);
        if (!depD || !depT || !arrD || !arrT) continue;
        const fromCity = b.kv['Город отправления'] || '';
        const toCity = b.kv['Город прибытия'] || '';
        stays.push(); // no-op
        legs.push({ kind: 'train', fromCity, toCity, label: b.kv['Вид транспорта'] || 'поезд', depDate: depD, depTime: depT, arrDate: arrD, arrTime: arrT });
      }
      continue;
    }

    // Stays (section 2 blocks)
    if (b.kv['Отель'] && b.kv['Город'] && b.kv['Даты проживания']) {
      const city = b.kv['Город'];
      const m = b.kv['Даты проживания'].match(/(\d{1,2}\s+[а-яё]+)\s*→\s*(\d{1,2}\s+[а-яё]+)/i);
      if (!m) continue;
      const startD = parseRuDate(m[1]);
      const endD = parseRuDate(m[2]);
      if (!startD || !endD) continue;
      stays.push({
        city,
        hotel: b.kv['Отель'],
        start: startD,
        end: endD,
        raw: b
      });
    }
  }

  legs.sort((a, b) => dateKey(a.depDate) - dateKey(b.depDate) || (a.depTime.h * 60 + a.depTime.mi) - (b.depTime.h * 60 + b.depTime.mi));
  stays.sort((a, b) => dateKey(a.start) - dateKey(b.start));
  return { legs, stays };
}

function parseLocal(md) {
  const lines = md.split(/\r?\n/);
  const items = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s+—\s+(.+)$/);
    if (h) {
      if (cur) items.push(cur);
      cur = { dateLabel: h[1].trim(), title: h[2].trim(), kv: {} };
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^\-\s*([^:]+)\s*:\s*(.*)\s*$/);
    if (m) cur.kv[m[1].trim()] = m[2].trim();
  }
  if (cur) items.push(cur);

  for (const it of items) it.date = parseRuDate(it.dateLabel);
  return items;
}

function renderLeg(leg) {
  const isPlane = leg.kind === 'plane';
  const badge = isPlane ? `<span class="badge bp">✈</span>` : `<span class="badge bt">🚆</span>`;
  const iconWrap = isPlane ? 'ip' : 'itr';
  const iconSvg = isPlane
    ? `<svg class="ic" viewBox="0 0 16 16" fill="none"><path d="M2 10.5L7 8.5V5a1 1 0 012 0v3.5l5 2v1.5l-5-1v2l1.5 1V15L8 14l-2.5 1v-1.5L7 12.5v-2L2 12v-1.5z" fill="#378ADD"/></svg>`
    : `<svg class="ic" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="10" rx="2" stroke="#3B6D11" stroke-width="1.2" fill="none"/><rect x="5" y="4" width="2.5" height="3" rx="0.5" fill="#3B6D11"/><rect x="8.5" y="4" width="2.5" height="3" rx="0.5" fill="#3B6D11"/><line x1="5" y1="9" x2="11" y2="9" stroke="#3B6D11" stroke-width="1"/><line x1="4" y1="12" x2="6.5" y2="12" stroke="#3B6D11" stroke-width="1.2" stroke-linecap="round"/><line x1="9.5" y1="12" x2="12" y2="12" stroke="#3B6D11" stroke-width="1.2" stroke-linecap="round"/></svg>`;

  const main = `${escapeHtml(leg.fromCity)} → ${escapeHtml(leg.toCity)}${badge}`;
  const sub = `${fmtDateTime(leg.depDate, leg.depTime)} → ${fmtDateTime(leg.arrDate, leg.arrTime)}`;

  return `<div class="leg-section">
    <div class="leg-row">
      <div class="lspine"><div class="llt ltravel"></div><div class="liw ${iconWrap}">${iconSvg}</div><div class="llb ltravel"></div></div>
      <div class="linfo"><div class="lmain">${main}</div><div class="lsub">${escapeHtml(sub)}</div></div>
    </div>
  </div>`;
}

function renderStay(stay, locals) {
  const dateRange = `${fmtDate(stay.start)} → ${fmtDate(stay.end)}`;
  const localsHtml = locals.length
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
               ${Object.entries(li.kv).map(([k,v])=>`<div class="drow"><span class="dlbl">${escapeHtml(k)}</span><span class="dval">${escapeHtml(v)}</span></div>`).join('')}
             </div></div>
           </div>`;
         }).join('')}
       </div></div>`
    : '';

  return `<div class="city-section">
    <div class="city-row">
      <div class="spine"><div class="cdot d-bj"></div><div class="sline lstay" style="height:10px"></div></div>
      <div class="ccard">
        <div class="ctitle"><span class="cname">${escapeHtml(stay.city)}</span><span class="cdates">${escapeHtml(dateRange)}</span></div>
        <div class="chotel">${escapeHtml(stay.hotel)}</div>
        ${localsHtml}
      </div>
    </div>
  </div>`;
}

export default function () {
  const routeMd = fs.readFileSync(ROUTE_MD, 'utf8');
  const localMd = fs.readFileSync(LOCAL_MD, 'utf8');
  const { legs, stays } = parseRoute(routeMd);
  const locals = parseLocal(localMd);

  function localsForStay(stay) {
    const s = dateKey(stay.start) - 1; // buffer 1 day
    const e = dateKey(stay.end) + 1;
    return locals.filter(li => li.date && dateKey(li.date) >= s && dateKey(li.date) <= e)
      .filter(li => (`${li.title} ${li.kv['Куда'] || ''} ${li.kv['Откуда'] || ''}`).toLowerCase().includes(stay.city.toLowerCase()));
  }

  // Build stream: departure card -> legs -> stay when arriving to its city
  let html = '';
  if (legs.length) {
    const first = legs[0];
    html += `<div class="city-section">
      <div class="city-row">
        <div class="spine"><div class="cdot d-kja"></div><div class="sline ltravel" style="height:24px"></div></div>
        <div class="ccard"><div class="ctitle"><span class="cname">${escapeHtml(first.fromCity)}</span><span class="cdates">${escapeHtml(fmtDateTime(first.depDate, first.depTime))}</span></div><div class="chotel" style="padding-bottom:10px">Вылет</div></div>
      </div>
    </div>`;
  }

  const used = new Set();
  for (const leg of legs) {
    html += renderLeg(leg);
    const stay = stays.find(s => !used.has(s) && s.city === leg.toCity && dateKey(s.start) <= dateKey(leg.arrDate) + 1 && dateKey(s.end) >= dateKey(leg.arrDate));
    if (stay) {
      used.add(stay);
      html += renderStay(stay, localsForStay(stay));
    }
  }

  return { html };
}

