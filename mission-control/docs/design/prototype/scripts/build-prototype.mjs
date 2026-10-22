import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const dataStamp=()=>{const h=crypto.createHash('sha1');for(const f of ['snapshot.js','extras.js','manual-live.js']){const p=path.join(root,'data',f);if(fs.existsSync(p))h.update(fs.readFileSync(p));}return h.digest('hex').slice(0,10);};
const html=read('prototype.template.html').replace('/* BASE_CSS */',()=>read('base.css')).replace('/* ROUND_CSS */',()=>read('prototype.css')).replace('/* APP_SCRIPT */',()=>read('prototype.js'))
  // The data scripts carry a content hash: a browser never keeps stale data, and an unchanged build stays byte-identical (the freeze hashes this file).
  .replaceAll('?v=__BUILD__',`?v=${dataStamp()}`);
if(html.includes('/* APP_SCRIPT */'))throw new Error('Unresolved template marker');
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Built stable index.html from template and sources.');
