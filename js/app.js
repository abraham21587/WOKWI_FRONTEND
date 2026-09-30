(() => {
  const $ = (s) => document.querySelector(s);
  const API = '/api/circuits';

  const u = Auth.user();
  $('#userbox').textContent = u ? '👤 ' + u.name : '';
  $('#btnOut').onclick = Auth.logout;

  // Paleta de componentes por categoría
  const cats = {};
  Object.entries(Lab.CATALOG).forEach(([t, d]) => (cats[d.cat] = cats[d.cat] || []).push([t, d.label]));
  Object.entries(cats).forEach(([cat, items]) => {
    const det = document.createElement('details'); det.open = true;
    det.innerHTML = `<summary>${cat}</summary>`;
    items.forEach(([t, label]) => {
      const d = document.createElement('div'); d.className = 'item'; d.draggable = true; d.textContent = label;
      d.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', t));
      d.addEventListener('dblclick', () => Lab.addComponent(t, 120 - Lab.pan.x, 120 - Lab.pan.y));
      det.appendChild(d);
    });
    $('#sidebar').appendChild(det);
  });

  $('#bRot').onclick = Lab.rotateSel; $('#bDel').onclick = Lab.deleteSel; $('#bProps').onclick = Lab.editProps;

  // Simulación
  const run = (r) => {
    Lab.setRunning(r); $('#btnRun').disabled = r; $('#btnStop').disabled = !r;
    Lab.status(r ? '● Simulación activa' : '■ Simulación detenida');
  };
  $('#btnRun').onclick = () => run(true); $('#btnStop').onclick = () => run(false);

  // Lista de circuitos del usuario
  async function refreshList(selectId) {
    try {
      const list = await Auth.api(API), sel = $('#loadSel');
      sel.innerHTML = '<option value="">📂 Cargar circuito…</option>';
      list.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = `${c.name} — ${new Date(c.date).toLocaleString()}`;
        sel.appendChild(o);
      });
      if (selectId) sel.value = selectId;
    } catch (e) { Lab.status('⚠ ' + e.message); }
  }

  // Guardar: crea si es nuevo, actualiza si ya estaba guardado
  $('#btnSave').onclick = async () => {
    try {
      Lab.status('Guardando…');
      const body = JSON.stringify(Lab.serialize());
      const r = Lab.currentId
        ? await Auth.api(`${API}/${Lab.currentId}`, { method: 'PUT', body })
        : await Auth.api(`${API}/save`, { method: 'POST', body });
      Lab.currentId = r.id;
      Lab.status('💾 Proyecto guardado'); refreshList(r.id);
    } catch (e) { Lab.status('❌ ' + e.message); }
  };

  $('#loadSel').onchange = async (e) => {
    if (!e.target.value) { Lab.currentId = null; return; }
    try {
      const d = await Auth.api(`${API}/${e.target.value}`);
      Lab.load(d); Lab.currentId = d.id; Lab.status('📂 Circuito cargado');
    } catch (err) { Lab.status('❌ ' + err.message); }
  };

  $('#btnDel').onclick = async () => {
    if (!Lab.currentId) return Lab.status('Carga un circuito guardado para eliminarlo');
    if (!confirm('¿Eliminar este proyecto guardado? No se puede deshacer.')) return;
    try {
      await Auth.api(`${API}/${Lab.currentId}`, { method: 'DELETE' });
      Lab.currentId = null; Lab.clear(); $('#name').value = 'Mi circuito';
      Lab.status('🗑 Proyecto eliminado'); refreshList();
    } catch (e) { Lab.status('❌ ' + e.message); }
  };

  refreshList();
})();