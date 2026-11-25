import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url));
let html=await readFile(join(dir,'index.html'),'utf8');
const css=await readFile(join(dir,'style.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`);
for(const filename of ['engine.js','app.js']){
  const code=await readFile(join(dir,filename),'utf8');
  html=html.replace(`<script src="${filename}"></script>`,()=>`<script>${code.replace(/<\/script/gi,'<\\/script')}</script>`);
}
for(const filename of ['physarum.jpg','aquila.jpg']){
  const image=await readFile(join(dir,'assets',filename));
  html=html.replace(`src="assets/${filename}"`,()=>`src="data:image/jpeg;base64,${image.toString('base64')}"`);
}
const readme=await readFile(join(dir,'README.md'),'utf8');
const readmeData=`data:text/plain;charset=utf-8,${encodeURIComponent(readme)}`;
html=html.replace('href="README.md"',()=>`href="${readmeData}" download="README-presentasi.txt"`);
const output=join(dir,'presentasi-task-scheduling.html');
await writeFile(output,html,'utf8');
console.log(`Presentasi mandiri dibuat: ${output}`);
await mkdir(join(dir,'deploy'),{recursive:true});
await writeFile(join(dir,'deploy','index.html'),html,'utf8');
const {build}=await import('vite');
await build({configFile:join(dir,'visualization','vite.config.mjs')});
const threeLicense=await readFile(join(dir,'node_modules','three','LICENSE'),'utf8');
await writeFile(join(dir,'deploy','visualization','THIRD_PARTY_LICENSES.txt'),`Three.js 0.187.0\nhttps://threejs.org/\n\n${threeLicense}`,'utf8');
