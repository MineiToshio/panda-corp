import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('prototype.template.html').replace('/* BASE_CSS */',()=>read('base.css')).replace('/* ROUND_CSS */',()=>read('prototype.css')).replace('/* APP_SCRIPT */',()=>read('prototype.js'));
if(html.includes('/* APP_SCRIPT */'))throw new Error('Unresolved template marker');
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Built stable index.html from template and sources.');
