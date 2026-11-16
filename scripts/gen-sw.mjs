// Genera out/sw.js con la lista de archivos del build para uso sin conexión.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const OUT = 'out';
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
walk(OUT);
const skip = /(\.map$|\.txt$|sw\.js$|404)/;
const urls = files.filter((f) => !skip.test(f)).map((f) => '/' + relative(OUT, f).split('\\').join('/'))
  .map((u) => u.replace(/index\.html$/, ''));
const hash = createHash('sha1');
files.filter((f) => !f.endsWith('sw.js')).forEach((f) => hash.update(readFileSync(f)));
const VERSION = hash.digest('hex').slice(0, 10);
const tpl = readFileSync('scripts/sw.template.js', 'utf8');
writeFileSync(join(OUT, 'sw.js'), tpl.replace('__VERSION__', VERSION).replace('__PRECACHE__', JSON.stringify(urls)));
console.log(`sw.js: ${urls.length} archivos precargados · versión ${VERSION}`);
