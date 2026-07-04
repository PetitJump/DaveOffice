// Harnais de test : charge la vraie interface et vérifie le comportement réel.
// Usage : electron test-harness.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const OUT = process.env.DAVE_TEST_OUT || path.join(app.getPath('temp'), 'dave-test-results.txt');

// Stubs des IPC utilisés par le preload/renderer au démarrage
ipcMain.on('get-version', (e) => { e.returnValue = '1.4.0-test'; });
ipcMain.on('get-username', (e) => { e.returnValue = 'Testeur'; });
ipcMain.on('set-dirty', () => {});
ipcMain.on('win-control', () => {});
ipcMain.on('print', () => {});

function browserTests() {
  return (async () => {
    const results = [];
    const check = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail: String(detail) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const editor = document.getElementById('editor');
    const $ = (id) => document.getElementById(id);
    const caretEnd = () => {
      const r = document.createRange(); r.selectNodeContents(editor); r.collapse(false);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); editor.focus();
    };
    const selectAll = () => {
      const r = document.createRange(); r.selectNodeContents(editor);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); editor.focus();
    };
    const type = (t) => { caretEnd(); document.execCommand('insertText', false, t); };
    const ctrl = (key, shift = false) => document.dispatchEvent(
      new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey: shift, bubbles: true }));
    const SNAP = 600; // > debounce historique (450ms)

    try {
      // 1. Init
      check('editeur present', !!editor);
      check('barre statut mots', $('sb-words') && /0\s*mot/.test($('sb-words').textContent), $('sb-words') && $('sb-words').textContent);
      check('nom utilisateur affiche', $('tb-user').textContent === 'Testeur', $('tb-user').textContent);

      // 2. Frappe + compteur de mots
      editor.innerHTML = '<p><br></p>'; caretEnd();
      type('Bonjour le monde ici');
      await wait(900);
      check('compteur mots (4)', /4\s*mots/.test($('sb-words').textContent), $('sb-words').textContent);

      // 3. Gras
      selectAll(); $('btn-bold').click();
      check('gras applique', $('btn-bold').classList.contains('on') || /font-weight/i.test(editor.innerHTML), editor.innerHTML.slice(0, 60));
      selectAll(); $('btn-bold').click(); // retire

      // 4. Italique
      selectAll(); $('btn-italic').click();
      check('italique applique', $('btn-italic').classList.contains('on') || /italic/i.test(editor.innerHTML));
      selectAll(); $('btn-italic').click();

      // 5. Annuler universel (frappe)
      editor.innerHTML = '<p>Base</p>'; caretEnd(); await wait(SNAP);
      type(' AJOUT');
      await wait(SNAP);
      const beforeUndo = editor.innerText;
      ctrl('z'); await wait(150);
      check('annuler retire la frappe', !editor.innerText.includes('AJOUT'), editor.innerText);
      ctrl('y'); await wait(150);
      check('retablir remet la frappe', editor.innerText.includes('AJOUT'), editor.innerText);
      check('etat identique apres redo', editor.innerText === beforeUndo, editor.innerText);

      // 6. Tableau + annuler
      editor.innerHTML = '<p><br></p>'; caretEnd(); await wait(SNAP);
      $('btn-table').click(); // ouvre la grille
      await wait(50);
      const cell = document.querySelector('#dropdown .tbl-cell[data-r="2"][data-c="3"]');
      check('grille tableau affichee', !!cell);
      if (cell) cell.click();
      await wait(100);
      const tbl = editor.querySelector('table');
      check('tableau insere 2x3', tbl && tbl.rows.length === 2 && tbl.rows[0].cells.length === 3, tbl ? tbl.rows.length + 'x' + tbl.rows[0].cells.length : 'aucun');
      await wait(SNAP);
      ctrl('z'); await wait(150);
      check('annuler retire le tableau', !editor.querySelector('table'));

      // 7. Palette couleur police
      editor.innerHTML = '<p>couleur</p>'; selectAll(); await wait(50);
      $('btn-forecolor').click(); await wait(50);
      const swatches = document.querySelectorAll('#dropdown .dd-swatch');
      check('palette couleurs ouverte', swatches.length > 0);
      // pastille rouge (index 3 = #ff0000), pas le noir par defaut
      if (swatches[3]) swatches[3].click();
      await wait(100);
      check('couleur police appliquee', /color:\s*rgb\(255/i.test(editor.innerHTML) || /#ff0000|color:\s*red/i.test(editor.innerHTML), editor.innerHTML.slice(0, 100));

      // 8. Surlignage palette
      editor.innerHTML = '<p>surlignage</p>'; selectAll(); await wait(50);
      $('btn-highlight').click(); await wait(50);
      check('palette surlignage ouverte', !!document.querySelector('#dropdown .dd-swatch'));
      const shi = document.querySelector('#dropdown .dd-swatch'); if (shi) shi.click();
      await wait(100);
      check('surlignage applique', /background/i.test(editor.innerHTML), editor.innerHTML.slice(0, 80));

      // 9. Style Titre 1
      editor.innerHTML = '<p>Mon titre</p>'; caretEnd(); selectAll();
      document.querySelector('.style-card[data-style="h1"]').click();
      await wait(100);
      check('style Titre 1 (H1)', !!editor.querySelector('h1'), editor.innerHTML.slice(0, 60));

      // 10. Liste a puces
      editor.innerHTML = '<p>item</p>'; selectAll(); $('btn-ul').click();
      await wait(100);
      check('liste a puces', !!editor.querySelector('ul'), editor.innerHTML.slice(0, 60));

      // 11. Saut de page (Ctrl+Entree)
      editor.innerHTML = '<p>x</p>'; caretEnd();
      ctrl('Enter');
      await wait(100);
      check('saut de page insere', !!editor.querySelector('.page-break'));

      // 12. Date/heure
      editor.innerHTML = '<p><br></p>'; caretEnd();
      $('btn-datetime').click();
      await wait(100);
      check('date inseree (annee)', editor.innerText.includes(String(new Date().getFullYear())), editor.innerText.slice(0, 40));

      // 13. Tri A->Z
      editor.innerHTML = '<p>Charlie</p><p>Alpha</p><p>Bravo</p>'; selectAll();
      $('btn-sort').click();
      await wait(100);
      const order = [...editor.querySelectorAll('p')].map((p) => p.innerText).join(',');
      check('tri alphabetique', order === 'Alpha,Bravo,Charlie', order);

      // 14. Rechercher (panneau)
      $('btn-find').click();
      await wait(50);
      check('panneau recherche ouvert', !$('find-panel').classList.contains('hidden'));
      $('find-close').click();

      // 15. Zoom
      const z0 = $('zoom-label').textContent;
      $('zoom-plus').click();
      check('zoom change', $('zoom-label').textContent !== z0, z0 + ' -> ' + $('zoom-label').textContent);
      $('btn-zoom100').click();
      check('zoom 100%', /100/.test($('zoom-label').textContent), $('zoom-label').textContent);

      // 16. Image + selection/poignee
      editor.innerHTML = '<p><br></p>'; caretEnd();
      const dot = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
      document.execCommand('insertImage', false, dot);
      await wait(100);
      const img = editor.querySelector('img');
      check('image inseree', !!img);
      if (img) { img.click(); await wait(50); }
      const handle = document.querySelector('.img-handle');
      check('poignee image visible', handle && !handle.classList.contains('hidden'));

      // 17. Casse (MAJUSCULES)
      editor.innerHTML = '<p>minuscule</p>'; selectAll();
      $('btn-case').click(); await wait(30);
      const majItem = [...document.querySelectorAll('#dropdown .dd-item')].find((b) => /MAJUSCULES/.test(b.textContent));
      check('menu casse ouvert', !!majItem);
      if (majItem) majItem.click();
      await wait(80);
      check('texte en majuscules', editor.innerText.includes('MINUSCULE'), editor.innerText);

      // 18. Alignement centre
      editor.innerHTML = '<p>centre</p>'; selectAll();
      $('btn-center').click(); await wait(50);
      check('alignement centre', /center/i.test(editor.innerHTML) || $('btn-center').classList.contains('on'), editor.innerHTML.slice(0, 60));

    } catch (err) {
      check('EXCEPTION', false, (err && err.stack) || String(err));
    }
    return results;
  })();
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1400, height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  try {
    await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    await new Promise((r) => setTimeout(r, 500));
    const results = await win.webContents.executeJavaScript(`(${browserTests.toString()})()`);
    const pass = results.filter((r) => r.pass).length;
    const lines = ['===== RESULTATS DES TESTS ====='];
    for (const r of results) {
      lines.push(`${r.pass ? 'OK  ' : 'FAIL'} | ${r.name}${r.pass ? '' : '  >> ' + r.detail}`);
    }
    lines.push(`\n${pass}/${results.length} tests reussis`);
    const report = lines.join('\n');
    fs.writeFileSync(OUT, report, 'utf8');
    process.stdout.write(report + '\n');
    app.exit(results.length - pass); // 0 si tout passe
    return;
  } catch (err) {
    const msg = 'ERREUR HARNAIS: ' + ((err && err.stack) || err);
    fs.writeFileSync(OUT, msg, 'utf8');
    process.stdout.write(msg + '\n');
    app.exit(1);
    return;
  }
});
