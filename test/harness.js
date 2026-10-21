// Arnés mínimo para correr el simulador fuera del navegador (jsdom), usado por las pruebas de
// regresión de este directorio. No sustituye probarlo en el navegador real, pero atrapa roturas
// del solver/netlist antes de publicar (ver test/README.md).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const JS_DIR = path.join(__dirname, '..', 'js');

function createLab({ stubResistor = true } = {}) {
  const html = `<!doctype html><html><body>
    <div id="canvas"><div id="world"></div><svg id="wires"></svg></div>
    <div id="status"></div>
  </body></html>`;
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  const { window } = dom;
  if (!window.requestAnimationFrame) window.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  // Reloj controlable a mano: así una curva de carga RC de varios segundos se prueba al
  // instante, sin esperar tiempo real. sim.js usa performance.now() para calcular su Δt.
  let fakeClock = 0;
  window.performance = window.performance || {};
  window.performance.now = () => fakeClock;

  const run = (file) => window.eval(fs.readFileSync(path.join(JS_DIR, file), 'utf8'));

  if (stubResistor) {
    // 'wokwi-resistor' viene de la librería externa @wokwi/elements (CDN), que aquí no se
    // carga; solo necesitamos sus dos pines para que el solver pueda cablearla.
    window.eval(`
      class StubResistor extends HTMLElement {
        get pinInfo() { return [{ name: '1', x: 0, y: 0 }, { name: '2', x: 20, y: 0 }]; }
      }
      customElements.define('wokwi-resistor', StubResistor);
    `);
  }

  run('canvas.js');
  run('parts.js');
  run('sim.js');

  const Lab = window.Lab;
  const burns = [];
  Lab.triggerBurn = (c, why) => { burns.push({ id: c.id, type: c.type, why }); c.burned = true; };

  const DT = 0.02;
  const advance = (ms) => { fakeClock += ms; };
  const tick = (seconds) => { for (let t = 0; t < seconds; t += DT) { advance(DT * 1000); Lab.refreshSim(); } };
  const wire = (c1, p1, c2, p2) => Lab.wires.push({ id: 'w' + Lab.wires.length, color: '#fff', from: { component: c1, pin: p1 }, to: { component: c2, pin: p2 } });
  const readingOf = (c) => (c.w && c.w._meas ? c.w._meas.textContent : '');

  return { window, Lab, advance, tick, wire, readingOf, DT, burns };
}

module.exports = { createLab };
