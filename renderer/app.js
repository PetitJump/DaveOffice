/* DaveOffice - logique du traitement de texte */
(() => {
  const editor = document.getElementById('editor');
  const api = window.daveAPI;

  // ---------- État ----------
  let currentFilePath = null;
  let currentFileName = 'Document1';
  let dirty = false;
  let savedRange = null;
  let foreColor = '#c00000';
  let highlightColor = '#ffff00';

  document.execCommand('styleWithCSS', false, true);

  function setDirty(d) {
    dirty = d;
    api.setDirty(d);
    updateTitle();
  }

  function updateTitle() {
    const label = `${currentFileName}${dirty ? ' *' : ''} - DaveOffice`;
    document.title = label;
    document.getElementById('doc-title-label').textContent = label;
    document.getElementById('bs-filename').textContent = currentFileName;
    document.getElementById('bs-filepath').textContent = currentFilePath || 'Document non enregistré';
  }

  // ---------- Sélection ----------
  function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    if (!savedRange) { editor.focus(); return; }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    editor.focus();
  }
  document.addEventListener('selectionchange', () => {
    saveSelection();
    syncToolbar();
    updateStatus();
  });

  function exec(cmd, val = null) {
    restoreSelection();
    document.execCommand(cmd, false, val);
    saveSelection();
    syncToolbar();
    setDirty(true);
  }

  function getSelectedBlocks() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return [];
    const range = sel.getRangeAt(0);
    const blocks = new Set();
    const blockOf = (node) => {
      let n = node.nodeType === 3 ? node.parentElement : node;
      while (n && n !== editor) {
        if (/^(P|H1|H2|H3|H4|DIV|LI)$/.test(n.tagName)) return n;
        n = n.parentElement;
      }
      return null;
    };
    const start = blockOf(range.startContainer);
    const end = blockOf(range.endContainer);
    if (!start) return end ? [end] : [];
    if (start === end || !end) return [start];
    let cur = start;
    while (cur) {
      blocks.add(cur);
      if (cur === end) break;
      cur = cur.nextElementSibling;
    }
    return [...blocks];
  }

  // ---------- Synchronisation barre d'outils ----------
  const toggles = {
    'btn-bold': 'bold',
    'btn-italic': 'italic',
    'btn-underline': 'underline',
    'btn-strike': 'strikeThrough',
    'btn-sub': 'subscript',
    'btn-sup': 'superscript',
    'btn-ul': 'insertUnorderedList',
    'btn-ol': 'insertOrderedList',
    'btn-left': 'justifyLeft',
    'btn-center': 'justifyCenter',
    'btn-right': 'justifyRight',
    'btn-justify': 'justifyFull'
  };

  function syncToolbar() {
    for (const [id, cmd] of Object.entries(toggles)) {
      try {
        document.getElementById(id).classList.toggle('on', document.queryCommandState(cmd));
      } catch (e) { /* ignore */ }
    }
    // Police et taille au curseur
    const sel = window.getSelection();
    if (sel.rangeCount && editor.contains(sel.anchorNode)) {
      const el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
      if (el && editor.contains(el)) {
        const cs = getComputedStyle(el);
        const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        const fontSel = document.getElementById('font-name');
        for (const opt of fontSel.options) {
          if (opt.value.toLowerCase() === fam.toLowerCase()) { fontSel.value = opt.value; break; }
        }
        const pt = Math.round(parseFloat(cs.fontSize) * 72 / 96);
        document.getElementById('font-size').value = String(pt);
        // Style actif dans la galerie
        const block = el.closest('h1, h2, p, div');
        let styleKey = 'normal';
        if (block) {
          if (block.tagName === 'H1') styleKey = 'h1';
          else if (block.tagName === 'H2') styleKey = 'h2';
          else if (block.classList.contains('doc-title')) styleKey = 'title';
          else if (block.classList.contains('no-spacing')) styleKey = 'nospacing';
        }
        document.querySelectorAll('.style-card').forEach((c) =>
          c.classList.toggle('active', c.dataset.style === styleKey));
      }
    }
  }

  // Empêcher les boutons du ruban de voler le focus
  document.querySelectorAll('#ribbon-body button, .qat button').forEach((b) => {
    b.addEventListener('mousedown', (e) => e.preventDefault());
  });

  // ---------- Boutons bascule ----------
  for (const [id, cmd] of Object.entries(toggles)) {
    document.getElementById(id).addEventListener('click', () => exec(cmd));
  }

  // ---------- Presse-papiers ----------
  document.getElementById('btn-cut').addEventListener('click', () => exec('cut'));
  document.getElementById('btn-copy').addEventListener('click', () => exec('copy'));
  document.getElementById('btn-paste').addEventListener('click', () => {
    restoreSelection();
    const clip = api.readClipboard();
    if (clip.html && clip.html.trim()) {
      document.execCommand('insertHTML', false, clip.html);
    } else if (clip.text) {
      document.execCommand('insertText', false, clip.text);
    }
    setDirty(true);
  });
  document.getElementById('btn-painter').addEventListener('click', () => { /* visuel */ });

  // ---------- Police ----------
  document.getElementById('font-name').addEventListener('change', (e) => {
    exec('fontName', e.target.value);
  });

  function applyFontSizePt(pt) {
    restoreSelection();
    document.execCommand('fontSize', false, '7');
    editor.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = pt + 'pt';
      span.innerHTML = f.innerHTML;
      f.replaceWith(span);
    });
    editor.querySelectorAll('span[style*="xxx-large"]').forEach((s) => {
      s.style.fontSize = pt + 'pt';
    });
    saveSelection();
    setDirty(true);
  }
  document.getElementById('font-size').addEventListener('change', (e) => {
    applyFontSizePt(parseInt(e.target.value, 10) || 11);
  });

  const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
  function stepFontSize(dir) {
    const cur = parseInt(document.getElementById('font-size').value, 10) || 11;
    let idx = SIZES.findIndex((s) => s >= cur);
    if (idx === -1) idx = SIZES.length - 1;
    idx = Math.min(SIZES.length - 1, Math.max(0, idx + dir));
    document.getElementById('font-size').value = String(SIZES[idx]);
    applyFontSizePt(SIZES[idx]);
  }
  document.getElementById('btn-grow').addEventListener('click', () => stepFontSize(1));
  document.getElementById('btn-shrink').addEventListener('click', () => stepFontSize(-1));

  document.getElementById('btn-clear').addEventListener('click', () => {
    exec('removeFormat');
    getSelectedBlocks().forEach((b) => {
      if (/^H[1-4]$/.test(b.tagName)) {
        const p = document.createElement('p');
        p.innerHTML = b.innerHTML;
        b.replaceWith(p);
      } else {
        b.className = '';
      }
    });
    setDirty(true);
  });

  // Casse
  document.getElementById('btn-case').addEventListener('click', (e) => {
    openDropdown(e.currentTarget, [
      { label: 'MAJUSCULES', action: () => transformCase((t) => t.toUpperCase()) },
      { label: 'minuscules', action: () => transformCase((t) => t.toLowerCase()) },
      { label: '1re Lettre Des Mots En Majuscule', action: () => transformCase((t) => t.replace(/\p{L}+/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())) }
    ]);
  });
  function transformCase(fn) {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const text = sel.toString();
    document.execCommand('insertText', false, fn(text));
    setDirty(true);
  }

  // Couleurs
  const foreInput = document.getElementById('forecolor-input');
  const highInput = document.getElementById('highlight-input');
  document.getElementById('btn-forecolor').addEventListener('click', (e) => {
    if (e.shiftKey) { foreInput.click(); return; }
    exec('foreColor', foreColor);
  });
  document.getElementById('btn-forecolor').addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation(); foreInput.click();
  });
  foreInput.addEventListener('input', (e) => {
    foreColor = e.target.value;
    document.getElementById('forecolor-bar').style.background = foreColor;
    exec('foreColor', foreColor);
  });
  document.getElementById('btn-highlight').addEventListener('click', (e) => {
    if (e.shiftKey) { highInput.click(); return; }
    exec('hiliteColor', highlightColor);
  });
  document.getElementById('btn-highlight').addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation(); highInput.click();
  });
  highInput.addEventListener('input', (e) => {
    highlightColor = e.target.value;
    document.getElementById('highlight-bar').style.background = highlightColor;
    exec('hiliteColor', highlightColor);
  });

  // ---------- Paragraphe ----------
  document.getElementById('btn-indent').addEventListener('click', () => exec('indent'));
  document.getElementById('btn-outdent').addEventListener('click', () => exec('outdent'));
  document.getElementById('btn-marks').addEventListener('click', (e) => {
    editor.classList.toggle('show-marks');
    e.currentTarget.classList.toggle('on', editor.classList.contains('show-marks'));
  });
  document.getElementById('btn-spacing').addEventListener('click', (e) => {
    const mk = (v) => ({ label: v.toFixed(2).replace('.', ','), action: () => {
      restoreSelection();
      getSelectedBlocks().forEach((b) => { b.style.lineHeight = String(v); });
      setDirty(true);
    }});
    openDropdown(e.currentTarget, [mk(1.0), mk(1.15), mk(1.5), mk(2.0), mk(2.5), mk(3.0)]);
  });

  // ---------- Styles ----------
  document.querySelectorAll('.style-card').forEach((card) => {
    card.addEventListener('click', () => {
      restoreSelection();
      const s = card.dataset.style;
      if (s === 'h1') document.execCommand('formatBlock', false, 'H1');
      else if (s === 'h2') document.execCommand('formatBlock', false, 'H2');
      else document.execCommand('formatBlock', false, 'P');
      getSelectedBlocks().forEach((b) => {
        b.classList.remove('doc-title', 'no-spacing');
        if (s === 'title') b.classList.add('doc-title');
        if (s === 'nospacing') b.classList.add('no-spacing');
      });
      saveSelection();
      syncToolbar();
      setDirty(true);
    });
  });

  // ---------- Édition (Rechercher / Remplacer / Sélectionner) ----------
  const findPanel = document.getElementById('find-panel');
  const findInput = document.getElementById('find-input');
  const replaceRow = document.getElementById('replace-row');
  const fpStatus = document.getElementById('fp-status');

  function openFind(withReplace) {
    findPanel.classList.remove('hidden');
    replaceRow.style.display = withReplace ? 'flex' : 'none';
    fpStatus.textContent = '';
    findInput.focus();
    findInput.select();
  }
  document.getElementById('btn-find').addEventListener('click', () => openFind(false));
  document.getElementById('btn-replace').addEventListener('click', () => openFind(true));
  document.getElementById('find-close').addEventListener('click', () => findPanel.classList.add('hidden'));

  function findNext() {
    const q = findInput.value;
    if (!q) return false;
    editor.focus();
    const found = window.find(q, false, false, true, false, false, false);
    fpStatus.textContent = found ? '' : 'Aucun résultat.';
    return found;
  }
  document.getElementById('find-next').addEventListener('click', findNext);
  findInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') findNext(); });

  document.getElementById('replace-one').addEventListener('click', () => {
    const q = findInput.value;
    const r = document.getElementById('replace-input').value;
    if (!q) return;
    const sel = window.getSelection();
    if (sel.rangeCount && sel.toString().toLowerCase() === q.toLowerCase()) {
      document.execCommand('insertText', false, r);
      setDirty(true);
    }
    findNext();
  });
  document.getElementById('replace-all').addEventListener('click', () => {
    const q = findInput.value;
    const r = document.getElementById('replace-input').value;
    if (!q) return;
    // Repartir du début
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    let count = 0;
    editor.focus();
    while (window.find(q, false, false, false, false, false, false) && count < 5000) {
      document.execCommand('insertText', false, r);
      count++;
    }
    fpStatus.textContent = `${count} remplacement(s) effectué(s).`;
    if (count) setDirty(true);
  });

  document.getElementById('btn-select').addEventListener('click', (e) => {
    openDropdown(e.currentTarget, [
      { label: 'Sélectionner tout (Ctrl+A)', action: () => { editor.focus(); document.execCommand('selectAll'); } }
    ]);
  });

  // ---------- Dropdown générique ----------
  const dropdown = document.getElementById('dropdown');
  function openDropdown(anchor, items) {
    dropdown.innerHTML = '';
    for (const it of items) {
      if (it.sep) {
        const s = document.createElement('div');
        s.className = 'dd-sep';
        dropdown.appendChild(s);
        continue;
      }
      const b = document.createElement('button');
      b.className = 'dd-item';
      b.textContent = it.label;
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { closeDropdown(); it.action(); });
      dropdown.appendChild(b);
    }
    const r = anchor.getBoundingClientRect();
    dropdown.classList.remove('hidden');
    dropdown.style.left = Math.min(r.left, window.innerWidth - dropdown.offsetWidth - 8) + 'px';
    dropdown.style.top = (r.bottom + 2) + 'px';
  }
  function closeDropdown() { dropdown.classList.add('hidden'); }
  document.addEventListener('mousedown', (e) => {
    if (!dropdown.contains(e.target)) closeDropdown();
  });

  // ---------- Onglets ----------
  document.querySelectorAll('.rtab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const t = tab.dataset.tab;
      if (t === 'fichier') { openBackstage(); return; }
      document.querySelectorAll('.rtab').forEach((x) => x.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      const panel = document.getElementById('panel-' + t);
      if (panel) panel.classList.add('active');
    });
  });

  // ---------- Backstage ----------
  const backstage = document.getElementById('backstage');
  function openBackstage() { updateTitle(); backstage.classList.remove('hidden'); }
  function closeBackstage() { backstage.classList.add('hidden'); editor.focus(); }
  document.getElementById('bs-back').addEventListener('click', closeBackstage);

  document.getElementById('bs-new').addEventListener('click', async () => { closeBackstage(); await newDoc(); });
  document.getElementById('bs-open').addEventListener('click', async () => { closeBackstage(); await openDoc(); });
  document.getElementById('bs-save').addEventListener('click', async () => { closeBackstage(); await saveDoc(false); });
  document.getElementById('bs-saveas').addEventListener('click', async () => { closeBackstage(); await saveDoc(true); });
  document.getElementById('bs-print').addEventListener('click', () => { closeBackstage(); api.print(); });
  document.getElementById('bs-close').addEventListener('click', () => api.winControl('close'));

  // ---------- Fichiers ----------
  async function newDoc() {
    if (dirty && !(await api.confirmDiscard())) return;
    editor.innerHTML = '<p><br></p>';
    currentFilePath = null;
    currentFileName = 'Document1';
    setDirty(false);
    updateStatus();
    editor.focus();
  }

  async function openDoc() {
    if (dirty && !(await api.confirmDiscard())) return;
    const r = await api.openFile();
    if (r.canceled) return;
    editor.innerHTML = r.html || '<p><br></p>';
    currentFilePath = r.filePath;
    currentFileName = r.fileName;
    setDirty(false);
    updateStatus();
    editor.focus();
  }

  async function saveDoc(saveAs) {
    const r = await api.saveFile({
      html: editor.innerHTML,
      filePath: currentFilePath,
      saveAs: !!saveAs
    });
    if (r.canceled) return;
    currentFilePath = r.filePath;
    currentFileName = r.fileName;
    setDirty(false);
  }

  document.getElementById('qat-save').addEventListener('click', () => saveDoc(false));
  document.getElementById('qat-undo').addEventListener('click', () => exec('undo'));
  document.getElementById('qat-redo').addEventListener('click', () => exec('redo'));

  // ---------- Insertion ----------
  document.getElementById('btn-table').addEventListener('click', (e) => {
    const mk = (rows, cols) => ({ label: `Tableau ${cols} × ${rows}`, action: () => {
      restoreSelection();
      let html = '<table>';
      for (let i = 0; i < rows; i++) {
        html += '<tr>';
        for (let j = 0; j < cols; j++) html += '<td><br></td>';
        html += '</tr>';
      }
      html += '</table><p><br></p>';
      document.execCommand('insertHTML', false, html);
      setDirty(true);
    }});
    openDropdown(e.currentTarget, [mk(2, 2), mk(3, 3), mk(4, 4), mk(5, 3), mk(6, 4)]);
  });

  document.getElementById('btn-image').addEventListener('click', async () => {
    const dataUrl = await api.pickImage();
    if (!dataUrl) return;
    restoreSelection();
    document.execCommand('insertImage', false, dataUrl);
    setDirty(true);
  });

  document.getElementById('btn-link').addEventListener('click', () => {
    restoreSelection();
    const sel = window.getSelection();
    const url = prompt('Adresse du lien :', 'https://');
    if (!url) return;
    if (sel.isCollapsed) {
      document.execCommand('insertHTML', false, `<a href="${url}">${url}</a>`);
    } else {
      document.execCommand('createLink', false, url);
    }
    setDirty(true);
  });

  document.getElementById('btn-symbol').addEventListener('click', (e) => {
    const syms = ['€', '£', '©', '®', '™', '°', '±', '≠', '≤', '≥', '×', '÷', '…', '—', '–', '«', '»', 'α', 'β', 'π', 'Ω', '∞', '→', '←', '↑', '↓', '☺', '★', '✓'];
    openDropdown(e.currentTarget, syms.map((s) => ({
      label: s,
      action: () => { restoreSelection(); document.execCommand('insertText', false, s); setDirty(true); }
    })));
  });

  // ---------- Mise en page ----------
  const page = document.getElementById('page');
  document.getElementById('btn-margins').addEventListener('click', (e) => {
    const mk = (label, cm) => ({ label, action: () => { editor.style.padding = cm + 'cm'; } });
    openDropdown(e.currentTarget, [mk('Normales (2,5 cm)', 2.5), mk('Étroites (1,27 cm)', 1.27), mk('Larges (5 cm)', 5)]);
  });
  document.getElementById('btn-orientation').addEventListener('click', (e) => {
    openDropdown(e.currentTarget, [
      { label: 'Portrait', action: () => { page.style.width = '21cm'; page.style.minHeight = '29.7cm'; } },
      { label: 'Paysage', action: () => { page.style.width = '29.7cm'; page.style.minHeight = '21cm'; } }
    ]);
  });

  // ---------- Révision ----------
  document.getElementById('btn-spell-toggle').addEventListener('click', (ev) => {
    const on = editor.getAttribute('spellcheck') !== 'true';
    editor.setAttribute('spellcheck', String(on));
    ev.currentTarget.classList.toggle('on', on);
    // Forcer la re-vérification
    editor.blur(); editor.focus();
  });
  document.getElementById('btn-stats').addEventListener('click', () => {
    const text = editor.innerText || '';
    const words = (text.trim().match(/\S+/g) || []).length;
    const chars = text.replace(/\n/g, '').length;
    const paras = editor.querySelectorAll('p, h1, h2, li').length;
    alert(`Statistiques\n\nMots : ${words}\nCaractères : ${chars}\nParagraphes : ${paras}`);
  });

  // ---------- Affichage / Zoom ----------
  const zoomSlider = document.getElementById('zoom-slider');
  const zoomLabel = document.getElementById('zoom-label');
  const pageWrap = document.getElementById('page-wrap');
  function setZoom(pct) {
    pct = Math.min(300, Math.max(30, Math.round(pct)));
    zoomSlider.value = pct;
    zoomLabel.textContent = pct + ' %';
    pageWrap.style.zoom = pct / 100;
  }
  zoomSlider.addEventListener('input', () => setZoom(parseInt(zoomSlider.value, 10)));
  document.getElementById('zoom-minus').addEventListener('click', () => setZoom(parseInt(zoomSlider.value, 10) - 10));
  document.getElementById('zoom-plus').addEventListener('click', () => setZoom(parseInt(zoomSlider.value, 10) + 10));
  document.getElementById('btn-zoom100').addEventListener('click', () => setZoom(100));
  document.getElementById('btn-zoompage').addEventListener('click', () => {
    const ws = document.getElementById('workspace');
    const pageW = page.offsetWidth;
    setZoom((ws.clientWidth - 60) / pageW * 100);
  });

  // ---------- Barre de statut ----------
  const PAGE_CONTENT_PX = (29.7 - 5) * 96 / 2.54; // hauteur utile A4 en px
  function updateStatus() {
    const text = editor.innerText || '';
    const words = (text.trim().match(/\S+/g) || []).length;
    document.getElementById('sb-words').textContent = `${words} mot${words > 1 ? 's' : ''}`;
    const pages = Math.max(1, Math.ceil(editor.scrollHeight / (PAGE_CONTENT_PX + 189)));
    document.getElementById('sb-page').textContent = `Page 1 sur ${pages}`;
    // Ajuster la hauteur de la page en multiples d'A4
    const needed = Math.max(1, Math.ceil((editor.scrollHeight) / (29.7 * 96 / 2.54)));
    page.style.minHeight = (needed * 29.7) + 'cm';
  }

  let statusTimer = null;
  editor.addEventListener('input', () => {
    setDirty(true);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(updateStatus, 150);
  });

  // ---------- Raccourcis clavier ----------
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) {
      if (e.key === 'Escape') {
        findPanel.classList.add('hidden');
        closeDropdown();
        if (!backstage.classList.contains('hidden')) closeBackstage();
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveDoc(e.shiftKey); }
    else if (k === 'o') { e.preventDefault(); openDoc(); }
    else if (k === 'n') { e.preventDefault(); newDoc(); }
    else if (k === 'g' && !e.shiftKey) { e.preventDefault(); exec('bold'); }
    else if (k === 'f') { e.preventDefault(); openFind(false); }
    else if (k === 'h') { e.preventDefault(); openFind(true); }
    else if (k === 'p') { e.preventDefault(); api.print(); }
    else if (k === 'e') { e.preventDefault(); exec('justifyCenter'); }
    else if (k === 'l') { e.preventDefault(); exec('justifyLeft'); }
    else if (k === 'r') { e.preventDefault(); exec('justifyRight'); }
    else if (k === 'j') { e.preventDefault(); exec('justifyFull'); }
    // Ctrl+B/I/U/Z/Y : gérés nativement par Chromium
  });

  // ---------- Contrôles fenêtre ----------
  document.getElementById('win-min').addEventListener('click', () => api.winControl('min'));
  document.getElementById('win-max').addEventListener('click', () => api.winControl('max'));
  document.getElementById('win-close').addEventListener('click', () => api.winControl('close'));
  document.getElementById('titlebar').addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    api.winControl('max');
  });

  // ---------- Init ----------
  updateTitle();
  updateStatus();
  editor.focus();
})();
