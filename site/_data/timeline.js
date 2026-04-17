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

const CITY_DOT = {
  'Красноярск': 'd-kja', 'Иркутск': 'd-kja',
  'Пекин': 'd-bj',
  'Чжанцзядзе': 'd-zjj',
  'Фужунчжэнь': 'd-frz',
  'Шанхай': 'd-sh'
};

function cityDot(city) {
  return CITY_DOT[city] || 'd-bj';
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
  const js = new Date(Date.UTC(d.y, d.mo - 1, d.d + delta, 12, 0));
  return { y: js.getUTCFullYear(), mo: js.getUTCMonth() + 1, d: js.getUTCDate() };
}

function fmtDate(d) {
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return `${d.d} ${months[d.mo - 1]}`;
}

function fmtDateTime(d, t) {
  return `${fmtDate(d)} ${String(t.h).padStart(2, '0')}:${String(t.mi).padStart(2, '0')}`;
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
        let arrDate = d;
        if ((arr.h * 60 + arr.mi) < (dep.h * 60 + dep.mi)) arrDate = addDays(d, 1);
        legs.push({
          kind: 'plane',
          fromCity: b.kv['Город отправления'] || '',
          toCity: b.kv['Город прибытия'] || '',
          depDate: d, depTime: dep, arrDate, arrTime: arr
        });
      } else if (kind.includes('поезд')) {
        const depD = parseRuDate(b.kv['Дата отправления'] || b.kv['Дата']);
        const depT = parseTime(b.kv['Время отправления']);
        const arrD = parseRuDate(b.kv['Дата прибытия'] || b.kv['Дата']);
        const arrT = parseTime(b.kv['Время прибытия']);
        if (!depD || !depT || !arrD || !arrT) continue;
        legs.push({
          kind: 'train',
          fromCity: b.kv['Город отправления'] || '',
          toCity: b.kv['Город прибытия'] || '',
          depDate: depD, depTime: depT, arrDate: arrD, arrTime: arrT
        });
      }
      continue;
    }

    if (b.kv['Отель'] && b.kv['Город'] && b.kv['Даты проживания']) {
      const rm = b.kv['Даты проживания'].match(/(\d{1,2}\s+[а-яё]+)\s*→\s*(\d{1,2}\s+[а-яё]+)/i);
      if (!rm) continue;
      const startD = parseRuDate(rm[1]);
      const endD = parseRuDate(rm[2]);
      if (!startD || !endD) continue;
      stays.push({ city: b.kv['Город'], hotel: b.kv['Отель'], start: startD, end: endD });
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

function makeLegItem(leg) {
  const isPlane = leg.kind === 'plane';
  return {
    type: 'leg',
    kind: leg.kind,
    fromCity: leg.fromCity,
    toCity: leg.toCity,
    depStr: fmtDateTime(leg.depDate, leg.depTime),
    arrStr: fmtDateTime(leg.arrDate, leg.arrTime),
    badgeClass: isPlane ? 'bp' : 'bt',
    badgeIcon: isPlane ? '✈' : '🚆',
    iconWrapClass: isPlane ? 'ip' : 'itr',
    iconKind: isPlane ? 'plane' : 'train'
  };
}

function makeStayItem(stay, locals) {
  return {
    type: 'stay',
    city: stay.city,
    hotel: stay.hotel,
    dateRange: `${fmtDate(stay.start)} → ${fmtDate(stay.end)}`,
    dotClass: cityDot(stay.city),
    locals
  };
}

export default function () {
  const routeMd = fs.readFileSync(ROUTE_MD, 'utf8');
  const localMd = fs.readFileSync(LOCAL_MD, 'utf8');
  const { legs, stays } = parseRoute(routeMd);
  const locals = parseLocal(localMd);

  function localsForStay(stay) {
    const s = dateKey(stay.start) - 1;
    const e = dateKey(stay.end) + 1;
    return locals
      .filter(li => li.date && dateKey(li.date) >= s && dateKey(li.date) <= e)
      .filter(li => (`${li.title} ${li.kv['Куда'] || ''} ${li.kv['Откуда'] || ''}`).toLowerCase().includes(stay.city.toLowerCase()))
      .map(li => ({
        title: li.title,
        sub: (li.kv['Вид транспорта'] ? `${li.kv['Вид транспорта']} · ` : '') + li.dateLabel,
        price: li.kv['Стоимость'] || '',
        details: Object.entries(li.kv).map(([key, value]) => ({ key, value }))
      }));
  }

  // Build flat stream: departure → legs interleaved with stays
  const stream = [];

  if (legs.length) {
    const first = legs[0];
    stream.push({
      type: 'departure',
      city: first.fromCity,
      datetimeStr: fmtDateTime(first.depDate, first.depTime),
      dotClass: cityDot(first.fromCity)
    });
  }

  const used = new Set();
  for (const leg of legs) {
    stream.push(makeLegItem(leg));
    const stay = stays.find(s =>
      !used.has(s) &&
      s.city === leg.toCity &&
      dateKey(s.start) <= dateKey(leg.arrDate) + 1 &&
      dateKey(s.end) >= dateKey(leg.arrDate)
    );
    if (stay) {
      used.add(stay);
      stream.push(makeStayItem(stay, localsForStay(stay)));
    }
  }

  // Group consecutive legs (no stay between them) into transfer-group cards
  const items = [];
  let i = 0;
  while (i < stream.length) {
    const item = stream[i];
    if (item.type === 'leg') {
      const group = [item];
      while (i + 1 < stream.length && stream[i + 1].type === 'leg') {
        i++;
        group.push(stream[i]);
      }
      if (group.length > 1) {
        items.push({ type: 'transfer-group', legs: group });
      } else {
        items.push(item);
      }
    } else {
      items.push(item);
    }
    i++;
  }

  return { items };
}
