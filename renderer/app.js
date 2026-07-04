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
  // Reproduire la mise en forme : copie le format au curseur, l'applique à la prochaine sélection
  let painter = null;
  const painterBtn = document.getElementById('btn-painter');
  painterBtn.addEventListener('click', () => {
    if (painter) { painter = null; painterBtn.classList.remove('on'); return; }
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return;
    const el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
    const cs = getComputedStyle(el);
    painter = {
      bold: parseInt(cs.fontWeight, 10) >= 600,
      italic: cs.fontStyle === 'italic',
      underline: cs.textDecorationLine.includes('underline'),
      font: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      pt: Math.round(parseFloat(cs.fontSize) * 72 / 96),
      color: cs.color
    };
    painterBtn.classList.add('on');
  });
  editor.addEventListener('mouseup', () => {
    if (!painter) return;
    const sel = window.getSelection();
    if (sel.isCollapsed) return;
    const p = painter;
    painter = null;
    painterBtn.classList.remove('on');
    if (document.queryCommandState('bold') !== p.bold) document.execCommand('bold');
    if (document.queryCommandState('italic') !== p.italic) document.execCommand('italic');
    if (document.queryCommandState('underline') !== p.underline) document.execCommand('underline');
    document.execCommand('fontName', false, p.font);
    document.execCommand('foreColor', false, p.color);
    applyFontSizePt(p.pt);
    setDirty(true);
  });

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

  // Couleurs : palettes façon Word
  const foreInput = document.getElementById('forecolor-input');
  const highInput = document.getElementById('highlight-input');
  const FONT_COLORS = [
    '#000000', '#44546a', '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050',
    '#00b0f0', '#0070c0', '#002060', '#7030a0', '#e2a1c4', '#808080', '#d9d9d9', '#ffffff'
  ];
  const HIGHLIGHT_COLORS = [
    '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080',
    '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0', '#000000', '#ffffff'
  ];

  function applyForeColor(c) {
    foreColor = c;
    document.getElementById('forecolor-bar').style.background = c;
    exec('foreColor', c);
  }
  function applyHighlight(c) {
    highlightColor = c;
    document.getElementById('highlight-bar').style.background = c === 'transparent' ? '#ffffff' : c;
    exec('hiliteColor', c);
  }

  document.getElementById('btn-forecolor').addEventListener('click', (e) => {
    openColorPalette(e.currentTarget, FONT_COLORS, applyForeColor, [
      { label: 'Automatique (noir)', action: () => applyForeColor('#000000') },
      { label: 'Autres couleurs...', action: () => foreInput.click() }
    ]);
  });
  document.getElementById('btn-forecolor').addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation(); foreInput.click();
  });
  foreInput.addEventListener('input', (e) => applyForeColor(e.target.value));

  document.getElementById('btn-highlight').addEventListener('click', (e) => {
    openColorPalette(e.currentTarget, HIGHLIGHT_COLORS, applyHighlight, [
      { label: 'Aucune couleur', action: () => applyHighlight('transparent') },
      { label: 'Autres couleurs...', action: () => highInput.click() }
    ]);
  });
  document.getElementById('btn-highlight').addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation(); highInput.click();
  });
  highInput.addEventListener('input', (e) => applyHighlight(e.target.value));

  // ---------- Paragraphe ----------
  document.getElementById('btn-indent').addEventListener('click', () => exec('indent'));
  document.getElementById('btn-outdent').addEventListener('click', () => exec('outdent'));

  // Liste multiniveaux : crée une liste puis imbrique d'un niveau
  document.getElementById('btn-mlist').addEventListener('click', () => {
    restoreSelection();
    const sel = window.getSelection();
    const inList = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode).closest('li');
    if (!inList) document.execCommand('insertUnorderedList');
    else document.execCommand('indent');
    saveSelection();
    setDirty(true);
  });

  // Trier les paragraphes sélectionnés (ou tout le document) A → Z
  document.getElementById('btn-sort').addEventListener('click', () => {
    restoreSelection();
    let blocks = getSelectedBlocks();
    if (blocks.length < 2) blocks = [...editor.children].filter((b) => /^(P|H1|H2|DIV)$/.test(b.tagName));
    if (blocks.length < 2) return;
    const sorted = [...blocks].sort((a, b) => a.innerText.localeCompare(b.innerText, 'fr', { sensitivity: 'base' }));
    const marker = document.createElement('div');
    blocks[0].before(marker);
    sorted.forEach((b) => marker.before(b));
    marker.remove();
    setDirty(true);
    updateStatus();
  });

  // Trame de fond des paragraphes
  let shadingColor = '#d9e2f3';
  const shadingInput = document.createElement('input');
  shadingInput.type = 'color';
  shadingInput.value = shadingColor;
  shadingInput.className = 'offscreen';
  document.body.appendChild(shadingInput);
  document.getElementById('btn-shading').addEventListener('click', () => {
    restoreSelection();
    getSelectedBlocks().forEach((b) => {
      b.style.backgroundColor = b.style.backgroundColor ? '' : shadingColor;
    });
    setDirty(true);
  });
  document.getElementById('btn-shading').addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation(); shadingInput.click();
  });
  shadingInput.addEventListener('input', (e) => {
    shadingColor = e.target.value;
    restoreSelection();
    getSelectedBlocks().forEach((b) => { b.style.backgroundColor = shadingColor; });
    setDirty(true);
  });

  // Bordures de paragraphe
  document.getElementById('btn-borders').addEventListener('click', (e) => {
    const apply = (fn) => () => {
      restoreSelection();
      getSelectedBlocks().forEach(fn);
      setDirty(true);
    };
    openDropdown(e.currentTarget, [
      { label: 'Encadré', action: apply((b) => { b.style.border = '1px solid #000'; b.style.padding = '4px 8px'; }) },
      { label: 'Bordure inférieure', action: apply((b) => { b.style.border = ''; b.style.borderBottom = '1px solid #000'; b.style.padding = ''; }) },
      { label: 'Aucune bordure', action: apply((b) => { b.style.border = ''; b.style.padding = ''; }) }
    ]);
  });
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
    positionDropdown(anchor);
  }
  function positionDropdown(anchor) {
    const r = anchor.getBoundingClientRect();
    dropdown.classList.remove('hidden');
    dropdown.style.left = Math.min(r.left, window.innerWidth - dropdown.offsetWidth - 8) + 'px';
    dropdown.style.top = (r.bottom + 2) + 'px';
  }
  function closeDropdown() { dropdown.classList.add('hidden'); }
  dropdown.addEventListener('mousedown', (e) => e.preventDefault());
  document.addEventListener('mousedown', (e) => {
    if (!dropdown.contains(e.target)) closeDropdown();
  });

  // Palette de couleurs (grille de pastilles + options)
  function openColorPalette(anchor, colors, onPick, extras) {
    dropdown.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'dd-swatches';
    for (const c of colors) {
      const s = document.createElement('button');
      s.className = 'dd-swatch';
      s.style.background = c;
      s.title = c;
      s.addEventListener('click', () => { closeDropdown(); onPick(c); });
      grid.appendChild(s);
    }
    dropdown.appendChild(grid);
    for (const it of (extras || [])) {
      const b = document.createElement('button');
      b.className = 'dd-item';
      b.textContent = it.label;
      b.addEventListener('click', () => { closeDropdown(); it.action(); });
      dropdown.appendChild(b);
    }
    positionDropdown(anchor);
  }

  // Sélecteur de tableau façon Word (grille au survol)
  function insertTable(rows, cols) {
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
    updateStatus();
  }
  function openTableGrid(anchor) {
    dropdown.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'tbl-label';
    label.textContent = 'Insérer un tableau';
    const grid = document.createElement('div');
    grid.className = 'tbl-grid';
    const cells = [];
    for (let r = 1; r <= 8; r++) {
      for (let c = 1; c <= 10; c++) {
        const d = document.createElement('button');
        d.className = 'tbl-cell';
        d.dataset.r = r;
        d.dataset.c = c;
        d.addEventListener('mouseenter', () => {
          cells.forEach((x) => x.classList.toggle('hot', +x.dataset.r <= r && +x.dataset.c <= c));
          label.textContent = `Tableau ${c} × ${r}`;
        });
        d.addEventListener('click', () => { closeDropdown(); insertTable(r, c); });
        cells.push(d);
        grid.appendChild(d);
      }
    }
    grid.addEventListener('mouseleave', () => {
      cells.forEach((x) => x.classList.remove('hot'));
      label.textContent = 'Insérer un tableau';
    });
    dropdown.appendChild(label);
    dropdown.appendChild(grid);
    positionDropdown(anchor);
  }

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
  function openBackstage() { updateTitle(); renderRecents(); backstage.classList.remove('hidden'); }
  function closeBackstage() { backstage.classList.add('hidden'); editor.focus(); }
  document.getElementById('bs-back').addEventListener('click', closeBackstage);

  // Documents récents
  function getRecents() {
    try { return JSON.parse(localStorage.getItem('recents') || '[]'); } catch (e) { return []; }
  }
  function saveRecent(filePath, fileName) {
    if (!filePath) return;
    const list = getRecents().filter((r) => r.path !== filePath);
    list.unshift({ path: filePath, name: fileName });
    localStorage.setItem('recents', JSON.stringify(list.slice(0, 8)));
  }
  function renderRecents() {
    const box = document.getElementById('bs-recents');
    const list = getRecents();
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<p class="bs-empty">Aucun document récent.</p>';
      return;
    }
    for (const r of list) {
      const b = document.createElement('button');
      b.className = 'bs-recent';
      b.innerHTML = `<span class="rn"></span><span class="rp"></span>`;
      b.querySelector('.rn').textContent = r.name;
      b.querySelector('.rp').textContent = r.path;
      b.addEventListener('click', async () => {
        closeBackstage();
        if (dirty && !(await api.confirmDiscard())) return;
        const res = await api.openPath(r.path);
        if (res.canceled) { if (res.error) alert(res.error); return; }
        editor.innerHTML = res.html || '<p><br></p>';
        currentFilePath = res.filePath;
        currentFileName = res.fileName;
        setDirty(false);
        clearDraft();
        saveRecent(res.filePath, res.fileName);
        updateStatus();
        editor.focus();
      });
      box.appendChild(b);
    }
  }

  // Récupération automatique (brouillon local)
  function clearDraft() { localStorage.removeItem('draft'); }
  setInterval(() => {
    if (!dirty) return;
    localStorage.setItem('draft', JSON.stringify({
      html: editor.innerHTML,
      filePath: currentFilePath,
      fileName: currentFileName,
      ts: Date.now()
    }));
  }, 20000);

  document.getElementById('bs-new').addEventListener('click', async () => { closeBackstage(); await newDoc(); });
  document.getElementById('bs-open').addEventListener('click', async () => { closeBackstage(); await openDoc(); });
  document.getElementById('bs-save').addEventListener('click', async () => { closeBackstage(); await saveDoc(false); });
  document.getElementById('bs-saveas').addEventListener('click', async () => { closeBackstage(); await saveDoc(true); });
  document.getElementById('bs-print').addEventListener('click', () => { closeBackstage(); api.print(); });
  document.getElementById('bs-pdf').addEventListener('click', async () => {
    closeBackstage();
    const r = await api.exportPdf(currentFileName);
    if (!r.canceled) alert('PDF exporté :\n' + r.filePath);
  });
  document.getElementById('bs-close').addEventListener('click', () => api.winControl('close'));

  // ---------- Fichiers ----------
  async function newDoc() {
    if (dirty && !(await api.confirmDiscard())) return;
    editor.innerHTML = '<p><br></p>';
    currentFilePath = null;
    currentFileName = 'Document1';
    setDirty(false);
    clearDraft();
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
    clearDraft();
    saveRecent(r.filePath, r.fileName);
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
    clearDraft();
    saveRecent(r.filePath, r.fileName);
  }

  document.getElementById('qat-save').addEventListener('click', () => saveDoc(false));
  document.getElementById('qat-undo').addEventListener('click', () => exec('undo'));
  document.getElementById('qat-redo').addEventListener('click', () => exec('redo'));

  // ---------- Insertion ----------
  function currentCell() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const n = sel.anchorNode;
    const el = n && (n.nodeType === 3 ? n.parentElement : n);
    return el && editor.contains(el) ? el.closest('td') : null;
  }
  document.getElementById('btn-table').addEventListener('click', (e) => {
    const cell = currentCell();
    if (cell) {
      const row = cell.parentElement;
      const table = row.closest('table');
      const idx = cell.cellIndex;
      const done = () => { setDirty(true); updateStatus(); };
      openDropdown(e.currentTarget, [
        { label: 'Ligne au-dessus', action: () => { const r = table.insertRow(row.rowIndex); for (let i = 0; i < row.cells.length; i++) r.insertCell().innerHTML = '<br>'; done(); } },
        { label: 'Ligne en dessous', action: () => { const r = table.insertRow(row.rowIndex + 1); for (let i = 0; i < row.cells.length; i++) r.insertCell().innerHTML = '<br>'; done(); } },
        { label: 'Colonne à gauche', action: () => { for (const r of table.rows) r.insertCell(idx).innerHTML = '<br>'; done(); } },
        { label: 'Colonne à droite', action: () => { for (const r of table.rows) r.insertCell(idx + 1).innerHTML = '<br>'; done(); } },
        { sep: true },
        { label: 'Supprimer la ligne', action: () => { table.deleteRow(row.rowIndex); if (!table.rows.length) table.remove(); done(); } },
        { label: 'Supprimer la colonne', action: () => { for (const r of [...table.rows]) if (r.cells[idx]) r.deleteCell(idx); if (!table.rows[0] || !table.rows[0].cells.length) table.remove(); done(); } },
        { label: 'Supprimer le tableau', action: () => { table.remove(); done(); } }
      ]);
      return;
    }
    openTableGrid(e.currentTarget);
  });

  document.getElementById('btn-pagebreak').addEventListener('click', () => {
    restoreSelection();
    document.execCommand('insertHTML', false, '<div class="page-break"></div><p><br></p>');
    setDirty(true);
    updateStatus();
  });

  document.getElementById('btn-datetime').addEventListener('click', () => {
    restoreSelection();
    const now = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    document.execCommand('insertText', false, now);
    setDirty(true);
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
  document.getElementById('btn-pagesize').addEventListener('click', (e) => {
    const mk = (label, w, h) => ({ label, action: () => { page.style.width = w + 'cm'; page.style.minHeight = h + 'cm'; } });
    openDropdown(e.currentTarget, [
      mk('A4 (21 × 29,7 cm)', 21, 29.7),
      mk('A5 (14,8 × 21 cm)', 14.8, 21),
      mk('Lettre US (21,6 × 27,9 cm)', 21.6, 27.9),
      mk('Légal US (21,6 × 35,6 cm)', 21.6, 35.6)
    ]);
  });

  // ---------- Conception ----------
  const pageColorInput = document.createElement('input');
  pageColorInput.type = 'color';
  pageColorInput.value = '#ffffff';
  pageColorInput.className = 'offscreen';
  document.body.appendChild(pageColorInput);
  document.getElementById('btn-pagecolor').addEventListener('click', (e) => {
    openDropdown(e.currentTarget, [
      { label: 'Blanc (par défaut)', action: () => { page.style.background = '#fff'; } },
      { label: 'Sépia', action: () => { page.style.background = '#f4ecd8'; } },
      { label: 'Gris doux', action: () => { page.style.background = '#f3f2f1'; } },
      { label: 'Personnalisée...', action: () => pageColorInput.click() }
    ]);
  });
  pageColorInput.addEventListener('input', (e) => { page.style.background = e.target.value; });

  document.getElementById('btn-watermark').addEventListener('click', () => {
    const existing = page.querySelector('.watermark');
    const current = existing ? existing.textContent : '';
    const text = prompt('Texte du filigrane (vide pour le retirer) :', current || 'BROUILLON');
    if (text === null) return;
    if (existing) existing.remove();
    if (text.trim()) {
      const w = document.createElement('div');
      w.className = 'watermark';
      w.textContent = text.trim();
      page.appendChild(w);
    }
  });

  // ---------- Lecture à voix haute ----------
  const speakBtn = document.getElementById('btn-speak');
  speakBtn.addEventListener('click', () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      speakBtn.classList.remove('on');
      return;
    }
    const sel = window.getSelection();
    const text = (!sel.isCollapsed && editor.contains(sel.anchorNode)) ? sel.toString() : editor.innerText;
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const frVoice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('fr'));
    if (frVoice) u.voice = frVoice;
    u.onend = () => speakBtn.classList.remove('on');
    u.onerror = () => speakBtn.classList.remove('on');
    speakBtn.classList.add('on');
    speechSynthesis.speak(u);
  });

  // ---------- Plein écran ----------
  document.getElementById('btn-fullscreen').addEventListener('click', () => api.winControl('fullscreen'));

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
    statusTimer = setTimeout(updateStatus, 600);
  });

  // ---------- Raccourcis clavier ----------
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) {
      if (e.key === 'Escape') {
        findPanel.classList.add('hidden');
        closeDropdown();
        if (!backstage.classList.contains('hidden')) closeBackstage();
      } else if (e.key === 'F11') {
        e.preventDefault();
        api.winControl('fullscreen');
      } else if (e.key === 'Tab' && editor.contains(document.activeElement)) {
        e.preventDefault();
        const sel = window.getSelection();
        const el = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
        if (el && el.closest && el.closest('li')) {
          document.execCommand(e.shiftKey ? 'outdent' : 'indent');
        } else if (el && el.closest && el.closest('td')) {
          // Tab dans un tableau : cellule suivante/précédente
          const td = el.closest('td');
          const cells = [...td.closest('table').querySelectorAll('td')];
          const next = cells[cells.indexOf(td) + (e.shiftKey ? -1 : 1)];
          if (next) {
            const range = document.createRange();
            range.selectNodeContents(next);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          return;
        } else if (!e.shiftKey) {
          document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
        } else {
          document.execCommand('outdent');
        }
        setDirty(true);
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '<div class="page-break"></div><p><br></p>');
      setDirty(true);
      return;
    }
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

  // ---------- Mises à jour ----------
  document.getElementById('btn-update').addEventListener('click', async () => {
    const r = await api.checkUpdates();
    if (r.error) {
      alert('Vérification impossible (connexion ou dépôt inaccessible).\n\n' + r.error);
      return;
    }
    if (r.upToDate) {
      alert(`DaveOffice est à jour (version ${r.current}).`);
      return;
    }
    const ok = confirm(`Nouvelle version disponible : ${r.latest}\nVersion installée : ${r.current}\n\nMettre à jour maintenant ? L'application redémarrera.`);
    if (!ok) return;
    if (dirty && !(await api.confirmDiscard())) return;
    const u = await api.doUpdate();
    if (u && u.error) alert('Échec de la mise à jour :\n' + u.error);
  });
  document.getElementById('btn-setdefault').addEventListener('click', async () => {
    const r = await api.setDefaultDocx();
    if (r.ok) {
      alert('Une fenêtre Windows va s\'ouvrir.\n\nChoisissez DaveOffice dans la liste et cochez « Toujours utiliser cette application pour ouvrir les fichiers .docx », puis OK.');
    } else if (r.info) {
      alert(r.info);
    }
  });

  document.getElementById('btn-uninstall').addEventListener('click', async () => {
    const ok = confirm('Désinstaller DaveOffice de cet ordinateur ?\n\nSeront supprimés : l\'application, les raccourcis, les entrées du registre et l\'exclusion antivirus.\nVos documents (.docx) ne sont PAS supprimés.');
    if (!ok) return;
    if (dirty && !(await api.confirmDiscard())) return;
    const r = await api.uninstall();
    if (r && r.error) alert('Désinstallation impossible :\n' + r.error);
  });

  document.getElementById('about-text').textContent =
    `DaveOffice ${api.appVersion} — ` + document.getElementById('about-text').textContent.replace(/^DaveOffice — /, '');

  // ---------- Fichier ouvert depuis Windows (double-clic .docx) ----------
  api.onFileOpened(async (data) => {
    if (dirty && !(await api.confirmDiscard())) return;
    editor.innerHTML = data.html || '<p><br></p>';
    currentFilePath = data.filePath;
    currentFileName = data.fileName;
    setDirty(false);
    clearDraft();
    saveRecent(data.filePath, data.fileName);
    updateStatus();
    editor.focus();
  });

  // ---------- Contrôles fenêtre ----------
  document.getElementById('win-min').addEventListener('click', () => api.winControl('min'));
  document.getElementById('win-max').addEventListener('click', () => api.winControl('max'));
  document.getElementById('win-close').addEventListener('click', () => api.winControl('close'));
  document.getElementById('titlebar').addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    api.winControl('max');
  });

  // ---------- Zoom Ctrl+molette ----------
  document.getElementById('workspace').addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(parseInt(zoomSlider.value, 10) + (e.deltaY < 0 ? 10 : -10));
  }, { passive: false });

  // ---------- Init ----------
  const uname = api.userName || '';
  if (uname) {
    document.getElementById('tb-user').textContent = uname;
    document.getElementById('tb-avatar').textContent = uname.slice(0, 2).toUpperCase();
  } else {
    document.getElementById('tb-avatar').style.display = 'none';
  }

  try {
    const draft = JSON.parse(localStorage.getItem('draft') || 'null');
    if (draft && draft.html && draft.html !== '<p><br></p>') {
      const when = new Date(draft.ts).toLocaleString('fr-FR');
      if (confirm(`Un document non enregistré a été récupéré (${draft.fileName}, ${when}).\n\nLe restaurer ?`)) {
        editor.innerHTML = draft.html;
        currentFilePath = draft.filePath;
        currentFileName = draft.fileName;
        setDirty(true);
      } else {
        clearDraft();
      }
    }
  } catch (e) { clearDraft(); }

  updateTitle();
  updateStatus();
  editor.focus();
})();
