// Barra lateral: que arme una fila por componente del catálogo y que el buscador filtre bien.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

module.exports = function testSidebar() {
  const errors = [];
  const JS_DIR = path.join(__dirname, '..', 'js');
  const html = `<!doctype html><html><body>
    <header id="topbar">
      <input id="name" value="Mi circuito">
      <button id="btnRun"></button><button id="btnStop"></button><button id="btnSave"></button>
      <select id="loadSel"></select><button id="btnDel"></button>
      <span id="userbox"></span><button id="btnOut"></button>
    </header>
    <aside id="sidebar"></aside>
    <main id="canvas"><div id="world"></div><svg id="wires"></svg><div id="status"></div>
      <div id="selbar" hidden><button id="bRot"></button><button id="bProps"></button><button id="bDel"></button></div>
    </main>
  </body></html>`;
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  const { window } = dom;
  if (!window.requestAnimationFrame) window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  const run = (file) => window.eval(fs.readFileSync(path.join(JS_DIR, file), 'utf8'));

  // app.js llama a Auth (login) y a la red; se simula para no depender del backend real.
  window.eval(`
    window.Auth = {
      user: () => ({ name: 'Test' }),
      logout: () => {},
      api: async () => { throw new Error('offline (stub)'); }
    };
  `);

  run('canvas.js'); run('parts.js'); run('sim.js'); run('app.js');

  const { document } = window;
  const search = document.querySelector('#partSearch');
  if (!search) errors.push('No se creó el input #partSearch');

  const items = Array.from(document.querySelectorAll('#sidebar .item'));
  const catalogSize = Object.keys(window.Lab.CATALOG).length;
  if (items.length !== catalogSize) errors.push(`Se esperaban ${catalogSize} .item en la barra lateral, hay ${items.length}`);

  const details = Array.from(document.querySelectorAll('#sidebar details'));
  const instrumentos = details.find((d) => d.querySelector('summary').textContent === 'Instrumentos');
  if (!instrumentos) errors.push('No existe la categoría "Instrumentos"');
  else {
    const labels = Array.from(instrumentos.querySelectorAll('.item')).map((i) => i.textContent);
    ['Voltímetro', 'Amperímetro', 'Óhmetro', 'Multímetro (V / A / Ω)', 'Osciloscopio (2 canales)'].forEach((l) => {
      if (!labels.includes(l)) errors.push(`Falta instrumento "${l}" en la categoría Instrumentos`);
    });
  }

  const setSearch = (q) => { search.value = q; search.dispatchEvent(new window.Event('input', { bubbles: true })); };

  setSearch('voltimetro'); // sin tilde, debe encontrar "Voltímetro" por normalización
  const visibleV = items.filter((i) => !i.hidden).map((i) => i.textContent);
  if (visibleV.length !== 1 || visibleV[0] !== 'Voltímetro') errors.push(`Buscar "voltimetro" no filtró bien, visibles: ${JSON.stringify(visibleV)}`);

  setSearch('arduino');
  const visibleArduino = items.filter((i) => !i.hidden).map((i) => i.textContent);
  if (visibleArduino.length < 3) errors.push('Se esperaban varias placas al buscar "arduino"');

  setSearch('');
  const visibleAll = items.filter((i) => !i.hidden).length;
  if (visibleAll !== catalogSize) errors.push('Al vaciar la búsqueda no se restauraron todos los componentes');

  return { name: 'Barra lateral y buscador', errors };
};
