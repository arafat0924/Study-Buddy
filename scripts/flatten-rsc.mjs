// Next 16 static export writes route payloads as `__next.<route>/__PAGE__.txt`, but the client
// prefetches `__next.<route>.__PAGE__.txt`. Write flat copies so client navigation never 404s.
import { copyFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let count = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith('__next.')) flatten(p, dir, name);
    else walk(p);
  }
}
function flatten(src, parent, prefix) {
  for (const name of readdirSync(src)) {
    const p = join(src, name);
    if (statSync(p).isDirectory()) flatten(p, parent, `${prefix}.${name}`);
    else { copyFileSync(p, join(parent, `${prefix}.${name}`)); count++; }
  }
}
walk('out');
console.log(`flatten-rsc: ${count} payload file(s)`);
