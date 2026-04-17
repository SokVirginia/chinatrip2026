import fs from 'node:fs';
import path from 'node:path';

export default function () {
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const m = html.match(/<style>([\s\S]*?)<\/style>/i);
  return m ? m[1].trim() : '';
}

