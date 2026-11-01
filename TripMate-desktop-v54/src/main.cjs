'use strict';
const { app, BrowserWindow, WebContentsView, Menu, session, protocol, net, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { SERVER, SHELL, isWorkspaceURL, isShellURL, externalURL, failureMessage } = require('./policy.cjs');

app.setName('TripMate');
app.setAppUserModelId('com.tripmate.desktop');
protocol.registerSchemesAsPrivileged([{scheme: 'tripmate-desktop', privileges: {standard: true, secure: true, supportFetchAPI: true}}]);
const testing = !app.isPackaged && process.env.TRIPMATE_DESKTOP_TEST === '1';
if (testing && process.env.TRIPMATE_TEST_PROFILE) app.setPath('userData', process.env.TRIPMATE_TEST_PROFILE);
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(createWindow).catch(() => { dialog.showErrorBox('TripMate 未能启动', '请重新打开软件。如果仍然无法启动，请联系 tripmate@yeah.net。'); app.quit(); });
}
let win, workspace, status = 'loading', message = '', zoom = 1, loadingTimeout, printing = false, loadFailed = false;
const locationGrants = new Set();
function publish() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('shell:state', {status, message, zoom: Math.round(zoom * 100)});
}
function setState(next, text = '') {
  status = next; message = text;
  if (next === 'error') loadFailed = true;
  if (workspace) workspace.setVisible(next === 'ready');
  publish();
}
function layout() {
  if (!win || !workspace) return;
  const [width, height] = win.getContentSize();
  workspace.setBounds({x: 0, y: 56, width, height: Math.max(0, height - 56)});
}
async function openExternal(value) {
  const url = externalURL(value);
  if (!url) return;
  try { await shell.openExternal(url); }
  catch { if (win && !win.isDestroyed()) dialog.showMessageBox(win, {type: 'info', message: '无法打开默认浏览器', detail: '请检查 Windows 的默认浏览器设置。'}); }
}
async function connect() {
  clearTimeout(loadingTimeout);
  loadFailed = false;
  setState('loading');
  loadingTimeout = setTimeout(() => {
    if (status === 'loading') { workspace.webContents.stop(); setState('error', failureMessage(-118)); }
  }, 30000);
  try { await workspace.webContents.loadURL(SERVER + '/'); }
  catch (error) { if (error.errno !== -3) { clearTimeout(loadingTimeout); setState('error', failureMessage(error.errno)); } }
}
async function reload() {
  if (status !== 'ready') return connect();
  const result = await dialog.showMessageBox(win, {type:'question', buttons:['继续编辑','刷新'], defaultId:0, cancelId:0,
    message:'刷新旅行工作台？', detail:'尚未保存的输入或正在生成的攻略可能中断，请先保存。'});
  if (result.response === 1) await connect();
}
function setZoom(action) {
  zoom = action === 'zoom-reset' ? 1 : Math.min(1.5, Math.max(.8, Math.round((zoom + (action === 'zoom-in' ? .1 : -.1)) * 10) / 10));
  workspace.webContents.setZoomFactor(zoom); publish();
}
async function savePDF() {
  if (printing || status !== 'ready' || !isWorkspaceURL(workspace.webContents.getURL())) return;
  printing = true;
  try {
    const result = await dialog.showSaveDialog(win, {title:'保存行程 PDF', defaultPath:path.join(app.getPath('downloads'), 'TripMate-行程.pdf'), filters:[{name:'PDF 文档',extensions:['pdf']}]});
    if (result.canceled || !result.filePath) return;
    const bytes = await workspace.webContents.printToPDF({printBackground:true, landscape:true, pageSize:'A4', preferCSSPageSize:true});
    await fs.writeFile(result.filePath, bytes);
    await dialog.showMessageBox(win, {type:'info', message:'行程 PDF 已保存', detail:result.filePath});
  } catch {
    await dialog.showMessageBox(win, {type:'error', message:'PDF 未能保存', detail:'请确认目标文件没有被其他程序占用，或换一个文件夹重试。'});
  } finally { printing = false; }
}
async function exportPlan() {
  if (status !== 'ready') return;
  try {
    const triggered = await workspace.webContents.executeJavaScript(`(() => {
      const gate = document.querySelector('#auth-gate');
      if (gate && !gate.hidden) return false;
      const button = document.querySelector('#print-plan');
      if (!button) return false;
      button.click(); return true;
    })()`);
    if (!triggered) await dialog.showMessageBox(win, {type:'info', message:'请先打开一份行程', detail:'登录或进入游客体验后，在工作台打开行程，再导出 PDF。'});
  } catch { /* A navigation interrupted the action. Nothing is written. */ }
}
async function createWindow() {
  protocol.handle('tripmate-desktop', request => {
    const url = new URL(request.url);
    const files = {'/index.html':'index.html', '/shell.css':'shell.css', '/shell.js':'shell.js', '/icon.png':'../assets/icon.png'};
    if (url.host !== 'app' || !Object.hasOwn(files, url.pathname)) return new Response('Not found', {status:404});
    return net.fetch(pathToFileURL(path.join(__dirname, files[url.pathname])).href);
  });
  const workspaceSession = session.fromPartition('persist:tripmate-workspace');
  workspaceSession.setPermissionCheckHandler((contents, permission, origin) => Boolean(
    contents && contents === workspace?.webContents && isWorkspaceURL(origin) &&
    (permission === 'clipboard-sanitized-write' || (permission === 'geolocation' && locationGrants.has(contents.id)))
  ));
  workspaceSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (!contents || contents !== workspace?.webContents || !isWorkspaceURL(contents.getURL()) || !isWorkspaceURL(details.requestingUrl)) return callback(false);
    if (permission === 'clipboard-sanitized-write') return callback(true);
    if (permission !== 'geolocation') return callback(false);
    try {
      const result = await dialog.showMessageBox(win, {type:'question', buttons:['不允许','允许本次使用'], defaultId:0, cancelId:0,
        message:'允许 TripMate 使用当前位置？', detail:'用于实时行程与路线计算。电脑定位可能不准确；你也可以在行程中手动输入当前位置。关闭软件后本次授权失效。'});
      if (result.response === 1 && !contents.isDestroyed()) locationGrants.add(contents.id);
      callback(result.response === 1);
    } catch { callback(false); }
  });
  workspaceSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({title:'保存 TripMate 下载文件', defaultPath:path.join(app.getPath('downloads'), path.basename(item.getFilename()))});
    item.once('done', (_event, state) => {
      if (state === 'interrupted' && win && !win.isDestroyed()) dialog.showMessageBox(win, {type:'error', message:'下载中断', detail:'请检查网络和保存位置，然后重试。'});
    });
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const prefs = {nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true, allowRunningInsecureContent:false};
  win = new BrowserWindow({title:'旅伴 TripMate', width:1360, height:900, minWidth:800, minHeight:620,
    backgroundColor:'#f7f8fc', icon:path.join(__dirname,'../assets/icon.png'), show:false,
    webPreferences:{...prefs, preload:path.join(__dirname,'preload.cjs')}});
  workspace = new WebContentsView({webPreferences:{...prefs, session:workspaceSession, preload:path.join(__dirname,'workspace-preload.cjs')}});
  workspace.setVisible(false); win.contentView.addChildView(workspace); layout();
  win.on('resize', layout);
  win.on('closed', () => {clearTimeout(loadingTimeout); locationGrants.clear(); if (!workspace.webContents.isDestroyed()) workspace.webContents.close(); win=null;});
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  const wc = workspace.webContents;
  wc.setWindowOpenHandler(({url}) => { void openExternal(url); return {action:'deny'}; });
  wc.on('will-navigate', (event, url) => {if (!isWorkspaceURL(url)) { event.preventDefault(); void openExternal(url); }});
  wc.on('will-redirect', (event, url) => {if (!isWorkspaceURL(url)) {event.preventDefault(); clearTimeout(loadingTimeout); setState('error','服务器跳转到了其他地址。为保护账号，已停止打开；请联系 TripMate。');}});
  wc.on('did-navigate', (_event,_url,code) => {if (code >= 400) { clearTimeout(loadingTimeout); setState('error', `服务器暂时无法打开工作台（HTTP ${code}），请稍后重新连接。`); }});
  wc.on('did-fail-load', (_event,code,_description,_url,isMainFrame) => {if (isMainFrame && code !== -3) {clearTimeout(loadingTimeout); setState('error',failureMessage(code));}});
  wc.on('did-finish-load', async () => {
    clearTimeout(loadingTimeout);
    if (loadFailed || !isWorkspaceURL(wc.getURL())) return;
    // Preserve the site's itinerary print layout, then offer a real Windows Save As dialog.
    await wc.executeJavaScript('window.print = () => window.tripmateDesktop.printPDF();').catch(() => {});
    wc.setZoomFactor(zoom); setState('ready');
  });
  wc.on('render-process-gone', () => {clearTimeout(loadingTimeout); setState('error','旅行工作台意外停止。点击“重新连接”即可再次打开。');});
  function shortcuts(event,input) {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
    if (input.key.toLowerCase() === 'r') {event.preventDefault(); void reload();}
    if (input.key.toLowerCase() === 'p') {event.preventDefault(); void exportPlan();}
  }
  win.webContents.on('before-input-event',shortcuts); wc.on('before-input-event',shortcuts);
  ipcMain.on('shell:action', (event,action) => {
    if (event.sender !== win?.webContents || !isShellURL(event.senderFrame?.url)) return;
    if (action === 'retry') {if (status !== 'ready') void connect();}
    else if (action === 'reload') void reload();
    else if (action === 'browser') void openExternal(SERVER);
    else if (action === 'pdf') void exportPlan();
    else if (['zoom-in','zoom-out','zoom-reset'].includes(action)) setZoom(action);
  });
  ipcMain.on('workspace:pdf',(event) => {
    if (event.sender === wc && event.senderFrame === wc.mainFrame && isWorkspaceURL(event.senderFrame.url)) void savePDF();
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'文件',submenu:[{label:'导出行程 PDF',click:exportPlan},{type:'separator'},{label:'退出',role:'quit'}]},
    {label:'编辑',submenu:[{label:'撤销',role:'undo'},{label:'重做',role:'redo'},{type:'separator'},{label:'剪切',role:'cut'},{label:'复制',role:'copy'},{label:'粘贴',role:'paste'},{label:'全选',role:'selectAll'}]},
    {label:'视图',submenu:[{label:'刷新工作台',click:reload},{label:'放大文字',click:()=>setZoom('zoom-in')},{label:'缩小文字',click:()=>setZoom('zoom-out')},{label:'默认字号',click:()=>setZoom('zoom-reset')},{type:'separator'},{label:'全屏',role:'togglefullscreen'}]},
    {label:'帮助',submenu:[{label:'在浏览器中打开',click:()=>openExternal(SERVER)},{label:'关于 TripMate',click:()=>dialog.showMessageBox(win,{type:'info',message:`旅伴 TripMate ${app.getVersion()}`,detail:'Windows 桌面版 · v54\n需要联网使用现有 TripMate 服务。\n联系邮箱：tripmate@yeah.net'})}]}
  ]));
  await win.loadURL(SHELL+'index.html');
  win.show(); publish();
  if (testing) globalThis.__tripmateTest = {win,workspace,connect,exportPlan,savePDF,getState:()=>({status,message,zoom})};
  void connect();
}
app.on('window-all-closed', () => app.quit());
