const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

const APP_VERSION = require('./package.json').version;

let win = null;
let isDirty = false;
let pendingFile = findFileArg(process.argv);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function findFileArg(argv) {
  for (const a of argv.slice(1)) {
    if (/\.(docx|html|htm|txt)$/i.test(a)) {
      try {
        if (fs.existsSync(a) && fs.statSync(a).isFile()) return path.resolve(a);
      } catch (e) { /* ignore */ }
    }
  }
  return null;
}

function wrapHtml(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Document</title>
<style>
  body { font-family: Calibri, sans-serif; font-size: 11pt; }
  h1 { font-family: 'Calibri Light', Calibri, sans-serif; font-size: 16pt; color: #2F5496; }
  h2 { font-family: 'Calibri Light', Calibri, sans-serif; font-size: 13pt; color: #2F5496; }
  p.doc-title { font-family: 'Calibri Light', Calibri, sans-serif; font-size: 28pt; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

async function loadFileToHtml(p) {
  const ext = path.extname(p).toLowerCase();
  if (fs.statSync(p).size === 0) return '<p><br></p>';
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const res = await mammoth.convertToHtml({ path: p });
    return res.value || '<p><br></p>';
  }
  if (ext === '.txt') {
    const t = fs.readFileSync(p, 'utf8');
    return t.split(/\r?\n/).map((l) => `<p>${escapeHtml(l) || '<br>'}</p>`).join('');
  }
  const t = fs.readFileSync(p, 'utf8');
  const m = t.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1] : t;
}

async function sendFileToWindow(p) {
  try {
    const html = await loadFileToHtml(p);
    win.webContents.send('file-opened', { html, filePath: p, fileName: path.basename(p) });
  } catch (err) {
    dialog.showErrorBox('Erreur d\'ouverture', String(err.message || err));
  }
}

// Instance unique : un double-clic sur un .docx réutilise la fenêtre existante
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    const f = findFileArg(argv);
    if (f) sendFileToWindow(f);
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#e8e8e8',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.on('did-finish-load', () => {
    if (pendingFile) {
      sendFileToWindow(pendingFile);
      pendingFile = null;
    }
  });

  // Correcteur orthographique en français
  try {
    const ses = win.webContents.session;
    const available = ses.availableSpellCheckerLanguages || [];
    const wanted = ['fr-FR', 'fr'].filter((l) => available.includes(l));
    if (wanted.length) {
      ses.setSpellCheckerLanguages(wanted);
    } else {
      const anyFr = available.filter((l) => l.toLowerCase().startsWith('fr'));
      if (anyFr.length) ses.setSpellCheckerLanguages(anyFr);
    }
  } catch (err) {
    console.error('Spellchecker init:', err);
  }

  // Menu contextuel : suggestions orthographiques + presse-papiers
  win.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();
    if (params.misspelledWord) {
      const sugg = params.dictionarySuggestions.slice(0, 6);
      if (sugg.length) {
        for (const s of sugg) {
          menu.append(new MenuItem({
            label: s,
            click: () => win.webContents.replaceMisspelling(s)
          }));
        }
      } else {
        menu.append(new MenuItem({ label: '(aucune suggestion)', enabled: false }));
      }
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({
        label: 'Ajouter au dictionnaire',
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    }
    menu.append(new MenuItem({ label: 'Couper', role: 'cut', enabled: params.editFlags.canCut }));
    menu.append(new MenuItem({ label: 'Copier', role: 'copy', enabled: params.editFlags.canCopy }));
    menu.append(new MenuItem({ label: 'Coller', role: 'paste', enabled: params.editFlags.canPaste }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: 'Tout sélectionner', role: 'selectAll' }));
    menu.popup();
  });

  win.on('close', (e) => {
    if (isDirty) {
      const r = dialog.showMessageBoxSync(win, {
        type: 'warning',
        buttons: ['Quitter sans enregistrer', 'Annuler'],
        defaultId: 1,
        cancelId: 1,
        title: 'DaveOffice',
        message: 'Modifications non enregistrées',
        detail: 'Voulez-vous vraiment quitter sans enregistrer ?'
      });
      if (r === 1) e.preventDefault();
    }
  });

  win.on('maximize', () => win.webContents.send('window-state', 'maximized'));
  win.on('unmaximize', () => win.webContents.send('window-state', 'normal'));
}

app.setAppUserModelId('com.killian.daveoffice');

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC ---

ipcMain.on('get-version', (e) => { e.returnValue = APP_VERSION; });

ipcMain.on('set-dirty', (e, d) => { isDirty = !!d; });

ipcMain.on('win-control', (e, action) => {
  if (!win) return;
  if (action === 'min') win.minimize();
  else if (action === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});

ipcMain.on('print', () => {
  if (win) win.webContents.print({}, () => {});
});

ipcMain.handle('save-file', async (e, { html, filePath, saveAs }) => {
  let target = filePath;
  if (!target || saveAs) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Enregistrer sous',
      defaultPath: target || 'Document1.docx',
      filters: [
        { name: 'Document Word (*.docx)', extensions: ['docx'] },
        { name: 'Document HTML (*.html)', extensions: ['html'] }
      ]
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    target = r.filePath;
  }
  try {
    const wrapped = wrapHtml(html);
    if (target.toLowerCase().endsWith('.docx')) {
      const HTMLtoDOCX = require('html-to-docx');
      const buf = await HTMLtoDOCX(wrapped, null, {
        font: 'Calibri',
        fontSize: 22,
        title: path.basename(target, '.docx')
      });
      fs.writeFileSync(target, buf);
    } else {
      fs.writeFileSync(target, wrapped, 'utf8');
    }
    return { canceled: false, filePath: target, fileName: path.basename(target) };
  } catch (err) {
    dialog.showErrorBox('Erreur d\'enregistrement', String(err.message || err));
    return { canceled: true, error: String(err) };
  }
});

ipcMain.handle('open-file', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Ouvrir',
    properties: ['openFile'],
    filters: [
      { name: 'Documents', extensions: ['docx', 'html', 'htm', 'txt'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });
  if (r.canceled || !r.filePaths.length) return { canceled: true };
  const p = r.filePaths[0];
  try {
    const html = await loadFileToHtml(p);
    return { canceled: false, filePath: p, fileName: path.basename(p), html };
  } catch (err) {
    dialog.showErrorBox('Erreur d\'ouverture', String(err.message || err));
    return { canceled: true, error: String(err) };
  }
});

ipcMain.handle('confirm-discard', async () => {
  const r = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Continuer sans enregistrer', 'Annuler'],
    defaultId: 1,
    cancelId: 1,
    title: 'DaveOffice',
    message: 'Modifications non enregistrées',
    detail: 'Voulez-vous continuer sans enregistrer ?'
  });
  return r.response === 0;
});

ipcMain.handle('pick-image', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Insérer une image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  let ext = path.extname(p).slice(1).toLowerCase();
  if (ext === 'jpg') ext = 'jpeg';
  const data = fs.readFileSync(p).toString('base64');
  return `data:image/${ext};base64,${data}`;
});

// --- Mises à jour (via les tags de release du repo GitHub) ---

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: __dirname, windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout);
    });
  });
}

function cmpVersion(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
}

function getAutoUpdater() {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  return autoUpdater;
}

ipcMain.handle('check-updates', async () => {
  try {
    if (app.isPackaged) {
      // Version installee par le Setup : interroge les releases GitHub
      const updater = getAutoUpdater();
      const r = await updater.checkForUpdates();
      const latest = (r && r.updateInfo && r.updateInfo.version) || APP_VERSION;
      return { current: APP_VERSION, latest, upToDate: cmpVersion(latest, APP_VERSION) <= 0 };
    }
    // Version git : compare aux tags du depot
    const out = await runGit(['ls-remote', '--tags', 'origin']);
    const tags = [...out.matchAll(/refs\/tags\/v?(\d+\.\d+\.\d+)\s*$/gm)].map((m) => m[1]);
    if (!tags.length) return { current: APP_VERSION, latest: APP_VERSION, upToDate: true };
    tags.sort(cmpVersion);
    const latest = tags[tags.length - 1];
    return { current: APP_VERSION, latest, upToDate: cmpVersion(latest, APP_VERSION) <= 0 };
  } catch (err) {
    return { error: String(err.message || err) };
  }
});

ipcMain.handle('do-update', async () => {
  try {
    if (app.isPackaged) {
      // Telecharge la release GitHub puis reinstalle et redemarre
      const updater = getAutoUpdater();
      await updater.checkForUpdates();
      await updater.downloadUpdate();
      isDirty = false;
      updater.quitAndInstall(true, true);
      return;
    }
    const run = (cmd, args) => new Promise((resolve, reject) => {
      const p = spawn(cmd, args, { cwd: __dirname, shell: true, windowsHide: true });
      let errOut = '';
      p.stderr.on('data', (d) => { errOut += d; });
      p.on('error', reject);
      p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(errOut.trim() || ('code ' + c)))));
    });
    const installScript = path.join(__dirname, 'install.ps1');
    const installedDir = path.join(process.env.LOCALAPPDATA || '', 'DaveOffice', 'app');
    if (fs.existsSync(installScript) && path.resolve(__dirname).toLowerCase() === path.resolve(installedDir).toLowerCase()) {
      // Copie installee : l'installeur refait tout (pull, deps, raccourcis, registre)
      await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `"${installScript}"`]);
    } else {
      await run('git', ['pull', '--ff-only']);
      await run('npm', ['install', '--no-audit', '--no-fund']);
    }
    isDirty = false;
    app.relaunch();
    app.exit(0);
  } catch (err) {
    return { error: String(err.message || err) };
  }
});
