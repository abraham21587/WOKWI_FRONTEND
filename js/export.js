(() => {
  const $ = (s) => document.querySelector(s);
  const btn = $('#btnDownload'), menu = $('#downloadMenu');

  btn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.dropdown')) menu.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.hidden = true; });

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = (s) => norm(String(s || 'circuito')).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'circuito';

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadJSON() {
    const data = Lab.serialize();
    saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), slug(data.name) + '.json');
    Lab.status('🗂 Proyecto descargado (.json)');
  }

  function downloadIno() {
    const code = Lab.getCode ? Lab.getCode() : '';
    saveBlob(new Blob([code], { type: 'text/plain' }), slug($('#name').value) + '.ino');
    Lab.status('🧩 Código descargado (.ino)');
  }

  // Informe en PDF: datos del proyecto, lista de componentes/conexiones y el código del sketch.
  function downloadPDF() {
    if (!window.jspdf) throw new Error('No se pudo cargar la librería de PDF (revisa tu conexión y recarga la página)');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = Lab.serialize();
    const user = (window.Auth && Auth.user()) || null;
    const PAGE_BOTTOM = 285, LEFT = 14;
    let y = 18;
    const newPageIfNeeded = () => { if (y > PAGE_BOTTOM) { doc.addPage(); y = 18; } };
    const line = (text, size, gap) => {
      doc.setFontSize(size);
      doc.splitTextToSize(text, 182).forEach((l) => { newPageIfNeeded(); doc.text(l, LEFT, y); y += gap; });
    };

    doc.setFont('helvetica', 'bold'); line('Informe de circuito — Physics Cyber Lab', 16, 8);
    doc.setFont('helvetica', 'normal');
    line(`Proyecto: ${data.name || 'Mi circuito'}`, 10, 6);
    line(`Autor: ${user ? user.name : '—'}`, 10, 6);
    line(`Fecha: ${new Date().toLocaleString()}`, 10, 6);
    y += 4;

    doc.setFont('helvetica', 'bold'); line('Componentes', 12, 7);
    doc.setFont('helvetica', 'normal');
    if (!data.components.length) line('(sin componentes)', 9, 5);
    data.components.forEach((c) => {
      const label = (Lab.CATALOG[c.type] && Lab.CATALOG[c.type].label) || c.type;
      const extra = Object.entries(c.props || {}).map(([k, v]) => `${k}=${v}`).join(', ');
      line(`• ${label} (${c.id}) — x:${c.x} y:${c.y} rot:${c.rotation}°${extra ? ' — ' + extra : ''}`, 9, 5);
    });
    y += 4;

    doc.setFont('helvetica', 'bold'); line('Conexiones', 12, 7);
    doc.setFont('helvetica', 'normal');
    if (!data.connections.length) line('(sin conexiones)', 9, 5);
    data.connections.forEach((w) => line(`• ${w.from.component}.${w.from.pin}  →  ${w.to.component}.${w.to.pin}`, 9, 5));
    y += 4;

    doc.setFont('helvetica', 'bold'); line('Código Arduino', 12, 7);
    doc.setFont('courier', 'normal');
    (data.code || '').split('\n').forEach((l) => line(l || ' ', 8, 4.5));

    doc.save(slug(data.name) + '.pdf');
    Lab.status('📄 Informe PDF descargado');
  }

  menu.querySelectorAll('button[data-fmt]').forEach((b) => {
    b.onclick = () => {
      menu.hidden = true;
      try {
        if (b.dataset.fmt === 'pdf') downloadPDF();
        else if (b.dataset.fmt === 'ino') downloadIno();
        else if (b.dataset.fmt === 'json') downloadJSON();
      } catch (e) { Lab.status('❌ ' + e.message); }
    };
  });
})();
