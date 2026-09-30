(() => {
  const $ = (s) => document.querySelector(s);
  const cv = $('#canvas'), world = $('#world'), svg = $('#wires');
  const GLOW = { red: '#FF5555', green: '#A6E3A1', blue: '#89DCEB', yellow: '#F1FA8C', orange: '#FAB387', white: '#ffffff' };
  const Lab = (window.Lab = {
    comps: [], wires: [], scale: 1, pan: { x: 0, y: 0 }, sel: null, running: false, color: '#FF5555', seq: 1, currentId: null,
    CATALOG: {
      'wokwi-arduino-uno': { label: 'Arduino Uno', cat: 'Microcontroladores', props: {} },
      'wokwi-resistor': { label: 'Resistencia', cat: 'Pasivos', props: { value: '220' } },
      'wokwi-potentiometer': { label: 'Potenciómetro', cat: 'Pasivos', props: {} },
      'wokwi-breadboard': { label: 'Protoboard', cat: 'Pasivos', props: {} },
      'wokwi-led': { label: 'LED', cat: 'Activos', props: { color: 'green' } },
      'wokwi-pushbutton': { label: 'Pulsador', cat: 'Activos', props: {} },
      'wokwi-lcd1602': { label: 'LCD 16x2', cat: 'Pantallas / Medidores', props: {} }
    }
  });
  const snap = (v) => Math.round(v / 10) * 10;
  Lab.byId = (id) => Lab.comps.find((c) => c.id === id);
  Lab.toWorld = (cx, cy) => { const r = world.getBoundingClientRect(); return { x: (cx - r.left) / Lab.scale, y: (cy - r.top) / Lab.scale }; };
  Lab.status = (t) => { $('#status').textContent = t; clearTimeout(Lab._t); Lab._t = setTimeout(() => ($('#status').textContent = ''), 3500); };

  function view() {
    world.style.transform = `translate(${Lab.pan.x}px,${Lab.pan.y}px) scale(${Lab.scale})`;
    cv.style.backgroundSize = `${20 * Lab.scale}px ${20 * Lab.scale}px`;
    cv.style.backgroundPosition = `${Lab.pan.x}px ${Lab.pan.y}px`;
  }
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const ns = Math.min(3, Math.max(0.25, Lab.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1))), f = ns / Lab.scale;
    Lab.pan.x = mx - (mx - Lab.pan.x) * f; Lab.pan.y = my - (my - Lab.pan.y) * f; Lab.scale = ns; view(); Lab.redraw && Lab.redraw();
  }, { passive: false });

  Lab.pinPos = (cid, pin) => {
    const c = Lab.byId(cid); if (!c) return null;
    const d = c.w.querySelector(`[data-pin="${CSS.escape(pin)}"]`); if (!d) return null;
    const r = d.getBoundingClientRect();
    return Lab.toWorld(r.left + r.width / 2, r.top + r.height / 2);
  };

  function buildPins(c) {
    (c.el.pinInfo || []).forEach((p) => {
      const d = document.createElement('div');
      d.className = 'pin'; d.dataset.pin = p.name; d.title = p.name; d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
      c.w.appendChild(d);
    });
    Lab.redraw && Lab.redraw();
  }

  Lab.addComponent = (type, x, y, id, rotation = 0, props) => {
    const def = Lab.CATALOG[type]; if (!def) return;
    id = id || 'c' + Lab.seq++;
    const w = document.createElement('div'); w.className = 'comp'; w.dataset.id = id;
    const el = document.createElement(type); w.appendChild(el); world.appendChild(w);
    const c = { id, type, x: snap(x), y: snap(y), rotation, props: { ...def.props, ...(props || {}) }, w, el };
    Object.assign(el, c.props);
    Lab.comps.push(c); place(c); rotate(c, 0);
    customElements.whenDefined(type).then(() => requestAnimationFrame(() => buildPins(c)));
    return c;
  };
  const place = (c) => { c.w.style.left = c.x + 'px'; c.w.style.top = c.y + 'px'; };
  function rotate(c, delta) { c.rotation = (c.rotation + delta) % 360; c.w.style.transform = `rotate(${c.rotation}deg)`; Lab.redraw && Lab.redraw(); }

  Lab.select = (c) => {
    Lab.sel && Lab.sel.w.classList.remove('sel');
    Lab.sel = c; c && c.w.classList.add('sel'); $('#selbar').hidden = !c;
  };
  Lab.rotateSel = () => Lab.sel && rotate(Lab.sel, 90);
  Lab.deleteSel = () => {
    const c = Lab.sel; if (!c) return;
    Lab.wires = Lab.wires.filter((w) => w.from.component !== c.id && w.to.component !== c.id);
    c.w.remove(); Lab.comps = Lab.comps.filter((x) => x !== c); Lab.select(null); Lab.redraw(); Lab.refreshSim();
  };
  Lab.editProps = () => {
    const c = Lab.sel; if (!c) return;
    if (c.type === 'wokwi-resistor') {
      const v = prompt('Valor en Ohms:', c.props.value); if (v !== null && +v > 0) { c.props.value = c.el.value = v; }
    } else if (c.type === 'wokwi-led') {
      const v = prompt('Color (red, green, blue, yellow, orange, white):', c.props.color);
      if (v && GLOW[v]) { c.props.color = c.el.color = v; Lab.refreshSim(); }
    } else Lab.status('Este componente no tiene propiedades editables');
  };

  // Simulación lógica básica: un LED se enciende si A y C están cableados
  Lab.refreshSim = () => {
    svg.classList.toggle('running', Lab.running);
    Lab.comps.filter((c) => c.type === 'wokwi-led').forEach((c) => {
      const used = (pin) => Lab.wires.some((w) => [w.from, w.to].some((e) => e.component === c.id && e.pin === pin));
      const lit = Lab.running && used('A') && used('C');
      c.el.value = lit; c.w.classList.toggle('lit', lit);
      c.w.style.setProperty('--glow', GLOW[c.props.color] || GLOW.green);
    });
  };
  Lab.setRunning = (r) => { Lab.running = r; Lab.refreshSim(); };

  // Mover componentes y desplazar el lienzo
  let drag = null, pan = null;
  cv.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('pin') || e.target.closest('#wirebar,#selbar')) return;
    const w = e.target.closest('.comp');
    if (w) {
      const c = Lab.byId(w.dataset.id), p = Lab.toWorld(e.clientX, e.clientY);
      Lab.select(c); drag = { c, dx: p.x - c.x, dy: p.y - c.y }; cv.setPointerCapture(e.pointerId);
    } else if (!e.target.closest('path')) {
      Lab.select(null); pan = { sx: e.clientX - Lab.pan.x, sy: e.clientY - Lab.pan.y }; cv.setPointerCapture(e.pointerId);
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (drag) { const p = Lab.toWorld(e.clientX, e.clientY); drag.c.x = snap(p.x - drag.dx); drag.c.y = snap(p.y - drag.dy); place(drag.c); Lab.redraw(); }
    else if (pan) { Lab.pan.x = e.clientX - pan.sx; Lab.pan.y = e.clientY - pan.sy; view(); }
  });
  cv.addEventListener('pointerup', () => { drag = pan = null; });

  // Soltar componentes desde la paleta
  cv.addEventListener('dragover', (e) => e.preventDefault());
  cv.addEventListener('drop', (e) => {
    e.preventDefault(); const t = e.dataTransfer.getData('text/plain');
    if (Lab.CATALOG[t]) { const p = Lab.toWorld(e.clientX, e.clientY); Lab.select(Lab.addComponent(t, p.x - 40, p.y - 40)); }
  });
  document.addEventListener('keydown', (e) => {
    if (/TEXTAREA|INPUT/.test(e.target.tagName)) return;
    if (e.key === 'Delete') Lab.deleteSel(); else if (e.key.toLowerCase() === 'r') Lab.rotateSel();
  });

  // Guardar / cargar el estado
  Lab.serialize = () => ({
    name: $('#name').value, code: Lab.getCode ? Lab.getCode() : '',
    components: Lab.comps.map((c) => ({ id: c.id, type: c.type, x: c.x, y: c.y, rotation: c.rotation, props: c.props })),
    connections: Lab.wires.map((w) => ({ id: w.id, color: w.color, from: w.from, to: w.to }))
  });
  const num = (s) => parseInt(String(s).replace(/\D/g, '')) || 0;
  Lab.clear = () => {
    Lab.comps.forEach((c) => c.w.remove()); Lab.comps = []; Lab.wires = []; Lab.select(null); Lab.redraw && Lab.redraw();
  };
  Lab.load = (d) => {
    Lab.clear();
    $('#name').value = d.name || ''; Lab.setCode && Lab.setCode(d.code || '');
    d.components.forEach((c) => Lab.addComponent(c.type, c.x, c.y, c.id, c.rotation, c.props));
    Lab.seq = 1 + Math.max(0, ...d.components.map((c) => num(c.id)), ...d.connections.map((c) => num(c.id)));
    Lab.wires = d.connections.map((c) => ({ id: c.id, color: c.color, from: c.from, to: c.to }));
    Lab.refreshSim(); setTimeout(Lab.redraw, 400);
  };
  view();
})();