import { mkdir, readFile, writeFile } from "node:fs/promises";

const html = await readFile(new URL("./src/index.html", import.meta.url), "utf8");
const template = await readFile(new URL("./src/worker.mjs", import.meta.url), "utf8");
const downloadHtml = await readFile(new URL('./src/download.html', import.meta.url), 'utf8');
const regionalScript = await readFile(new URL('./src/tripmate-regions.js', import.meta.url), 'utf8');
const icon = (await readFile(new URL('./src/tripmate-icon.png', import.meta.url))).toString('base64');
const marker = 'const PAGE_HTML = "__TRIPMATE_HTML__";';
if (!template.includes(marker)) throw new Error("Worker HTML marker is missing");
const mergeModule=await readFile(new URL('./src/tripmate-merge.mjs',import.meta.url),'utf8');
const bridgeModule=await readFile(new URL('./src/regional-bridge.mjs',import.meta.url),'utf8');
const accountHtml=await readFile(new URL('./src/tripmate-account-link.html',import.meta.url),'utf8');
const syncUi=await readFile(new URL('./src/tripmate-sync-ui.js',import.meta.url),'utf8');
const extraNames={LEGACY_HTML:'legacy.html',LEGACY_RECORDS:'legacy-records.html',LEGACY_REGIONS:'legacy-regions.js',LEGACY_SYNC_UI:'legacy-sync-ui.js',LEGACY_TRANSPORT:'legacy-transport.js',LEGACY_RECOVERY:'legacy-recovery.js',UNIFIED_TRANSPORT:'tripmate-unified.js',UNIFIED_INFO_HTML:'unified-info.html',UNIFIED_INFO_SCRIPT:'tripmate-unified-info.js'};
let extra='';for(const [name,file] of Object.entries(extraNames))extra+='const '+name+' = '+JSON.stringify(await readFile(new URL('./src/'+file,import.meta.url),'utf8'))+';\n';
const worker = (extra+mergeModule.replace(/export /g,'')+'\n'+bridgeModule.replace(/^import .*;$/m,'').replace(/export /g,'')+'\n'+template.replace(/^import .*;$/m,'')).replace(marker, `const PAGE_HTML = ${JSON.stringify(html)};\nconst DOWNLOAD_HTML = ${JSON.stringify(downloadHtml)};\nconst REGIONAL_SCRIPT = ${JSON.stringify(regionalScript)};\nconst SYNC_UI = ${JSON.stringify(syncUi)};\nconst ACCOUNT_LINK_HTML = ${JSON.stringify(accountHtml)};\nconst ICON_BASE64 = ${JSON.stringify(icon)};`);
await mkdir(new URL("./dist/server/", import.meta.url), { recursive: true });
await writeFile(new URL("./dist/server/index.js", import.meta.url), worker, "utf8");
