// Simulador DC (análisis nodal modificado) + integración con el laboratorio
(() => {
  // ---------- Solver ----------
  function gauss(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      if (Math.abs(A[p][i]) < 1e-18) continue;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i]; if (!f) continue;
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = Math.abs(A[i][i]) < 1e-18 ? 0 : s / A[i][i];
    }
    return x;
  }
  // N = nº de nodos (0 = tierra). Elementos: R{a,b,r}  D{a,k,vf,rs}  V{p,n,v}
  function solve(N, els) {
    const nv = els.filter((e) => e.t === 'V').length, n = N - 1 + nv;
    const on = els.map(() => false);
    let x = [];
    for (let it = 0; it < 40; it++) {
      const A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
      const g = (a, c, G) => {
        if (a) A[a - 1][a - 1] += G; if (c) A[c - 1][c - 1] += G;
        if (a && c) { A[a - 1][c - 1] -= G; A[c - 1][a - 1] -= G; }
      };
      const inj = (a, I) => { if (a) b[a - 1] += I; };
      for (let k = 1; k < N; k++) A[k - 1][k - 1] += 1e-9; // evita nodos flotantes
      let vi = 0;
      els.forEach((e, i) => {
        if (e.t === 'R') g(e.a, e.b, 1 / Math.max(e.r, 1e-3));
        else if (e.t === 'D') { if (on[i]) { const G = 1 / e.rs; g(e.a, e.k, G); inj(e.a, G * e.vf); inj(e.k, -G * e.vf); } }
        else {
          const row = N - 1 + vi++;
          if (e.p) { A[row][e.p - 1] += 1; A[e.p - 1][row] += 1; }
          if (e.n) { A[row][e.n - 1] -= 1; A[e.n - 1][row] -= 1; }
          b[row] = e.v;
        }
      });
      x = gauss(A, b);
      const V = (k) => (k ? x[k - 1] : 0);
      let changed = false;
      els.forEach((e, i) => {
        if (e.t !== 'D') return;
        const vd = V(e.a) - V(e.k);
        if (!on[i] && vd > e.vf + 1e-9) { on[i] = true; changed = true; }
        else if (on[i] && vd < e.vf - 1e-9) { on[i] = false; changed = true; }
      });
      if (!changed) break;
    }
    const V = (k) => (k ? x[k - 1] : 0);
    let vi = 0;
    const cur = els.map((e, i) => {
      if (e.t === 'R') return (V(e.a) - V(e.b)) / Math.max(e.r, 1e-3);
      if (e.t === 'D') return on[i] ? (V(e.a) - V(e.k) - e.vf) / e.rs : 0;
      return -x[N - 1 + vi++]; // corriente que entrega la fuente
    });
    return { V, cur };
  }
  if (typeof window === 'undefined' || !window.Lab) return;
  window.Sim = { solve };

  // ---------- Integración con el laboratorio ----------
  const LED_VF = { red: 1.8, green: 2.0, blue: 3.0, yellow: 2.1, orange: 2.0, white: 3.0 };
  const GLOW = { red: '#FF5555', green: '#A6E3A1', blue: '#89DCEB', yellow: '#F1FA8C', orange: '#FAB387', white: '#ffffff' };
  const K = (c, p) => c + '|' + p;
  const num = (v, d) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d);

  function netlist() {
    const parent = new Map();
    const find = (k) => { if (!parent.has(k)) parent.set(k, k); while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
    const union = (a, b) => parent.set(find(a), find(b));
    Lab.wires.forEach((w) => union(K(w.from.component, w.from.pin), K(w.to.component, w.to.pin)));
    const groups = {};
    Lab.comps.forEach((c) => (c.el.pinInfo || []).forEach((p) => {
      const g = Lab.internalGroup(c.type, p.name);
      if (g) (groups[c.id + '#' + g] = groups[c.id + '#' + g] || []).push(K(c.id, p.name));
    }));
    Object.values(groups).forEach((l) => l.slice(1).forEach((k) => union(l[0], k)));

    const ard = Lab.comps.find((c) => /^wokwi-arduino/.test(c.type)), bat = Lab.comps.find((c) => c.type === 'pcl-battery');
    const ref = ard ? K(ard.id, 'GND.1') : bat ? K(bat.id, '-') : null;
    if (!ref) return null;
    const ids = new Map([[find(ref), 0]]);
    const node = (c, p) => { const r = find(K(c.id, p)); if (!ids.has(r)) ids.set(r, ids.size); return ids.get(r); };

    const els = [], owner = [];
    const add = (c, e) => { els.push(e); owner.push(c); };
    Lab.comps.forEach((c) => {
      const P = (p) => node(c, p), pr = c.props;
      if (c.type === 'pcl-battery') add(c, { t: 'V', p: P('+'), n: P('-'), v: num(pr.voltage, 9) });
      else if (/^wokwi-arduino/.test(c.type)) {
        add(c, { t: 'V', p: P('5V'), n: P('GND.1'), v: 5 });
        // Pines digitales: el sketch (arduino.js) deja su estado en Lab.pins; cada pin OUTPUT cableado
        // se modela como una fuente de voltaje (HIGH/LOW, o el promedio del duty de analogWrite).
        Object.entries(Lab.pins || {}).forEach(([pin, st]) => {
          if (st.mode !== 'OUTPUT') return;
          const wired = Lab.wires.some((w) => (w.from.component === c.id && w.from.pin === pin) || (w.to.component === c.id && w.to.pin === pin));
          if (!wired) return;
          add(c, { t: 'V', p: P(pin), n: P('GND.1'), v: (st.pwm != null ? st.pwm / 255 : st.digital) * 5 });
        });
      }
      else if (c.type === 'wokwi-resistor') add(c, { t: 'R', a: P('1'), b: P('2'), r: num(pr.value, 220) });
      else if (c.type === 'wokwi-led') add(c, { t: 'D', a: P('A'), k: P('C'), vf: LED_VF[pr.color] || 2, rs: 5 });
      else if (c.type === 'pcl-diode') add(c, { t: 'D', a: P('A'), k: P('K'), vf: num(pr.vf, 0.7), rs: 2 });
      else if (c.type === 'wokwi-pushbutton') { if (c.pressed) add(c, { t: 'R', a: P('1.l'), b: P('2.l'), r: 0.001 }); }
      else if (c.type === 'wokwi-slide-switch') add(c, { t: 'R', a: P('2'), b: P(c.el.value ? '3' : '1'), r: 0.001 });
      else if (c.type === 'wokwi-potentiometer') {
        const min = num(c.el.min, 0), max = num(c.el.max, 100), t = Math.min(1, Math.max(0, (num(c.el.value, 50) - min) / (max - min || 1)));
        add(c, { t: 'R', a: P('GND'), b: P('SIG'), r: Math.max(10000 * t, 1) });
        add(c, { t: 'R', a: P('SIG'), b: P('VCC'), r: Math.max(10000 * (1 - t), 1) });
      }
    });
    const volAt = (cid, pin) => { const r = find(K(cid, pin)); return ids.has(r) ? ids.get(r) : null; };
    return { N: ids.size, els, owner, volAt };
  }

  function label(c, text, bad) {
    let l = c.w._meas;
    if (!l) { l = c.w._meas = document.createElement('div'); l.className = 'meas'; c.w.appendChild(l); }
    l.textContent = text || ''; l.style.display = text ? '' : 'none'; l.classList.toggle('over', !!bad);
    l.style.transform = `translateX(-50%) rotate(${-c.rotation}deg)`;
  }
  const mA = (i) => (i * 1000).toFixed(1) + ' mA';

  Lab.refreshSim = () => {
    const svg = document.querySelector('#wires');
    let res = null, nl = null;
    if (Lab.running) { nl = netlist(); if (nl) res = solve(nl.N, nl.els); else Lab.status('⚠ Añade una batería o un Arduino (referencia de tierra)'); }
    // Pines no-OUTPUT (entradas): guarda el voltaje que "ven" para que digitalRead/analogRead del sketch lo lean.
    if (res && Lab.pins) {
      const ard = Lab.comps.filter((c) => /^wokwi-arduino/.test(c.type));
      Object.entries(Lab.pins).forEach(([pin, st]) => {
        if (st.mode === 'OUTPUT') return;
        const c = ard[0]; if (!c) return;
        const nid = nl.volAt(c.id, pin), v = nid != null ? res.V(nid) : 0;
        st.sensedVoltage = v; st.sensedDigital = v > 2.5 ? 1 : 0;
      });
    }
    const cur = new Map(), volt = new Map();
    if (res) nl.els.forEach((e, i) => {
      const c = nl.owner[i];
      cur.set(c, (cur.get(c) || 0) + res.cur[i]);
      volt.set(c, e.t === 'R' ? res.V(e.a) - res.V(e.b) : e.t === 'D' ? res.V(e.a) - res.V(e.k) : e.v);
    });
    svg.classList.toggle('running', !!res && res.cur.some((i) => Math.abs(i) > 1e-4));
    Lab.comps.forEach((c) => {
      const i = cur.get(c) || 0, v = volt.get(c), isLed = c.type === 'wokwi-led';
      if (isLed) {
        const lit = i > 0.0005;
        c.el.value = lit; c.el.brightness = Math.min(1, i / 0.02);
        c.w.classList.toggle('lit', lit); c.w.style.setProperty('--glow', GLOW[c.props.color] || GLOW.green);
      }
      let t = '';
      if (res && cur.has(c)) {
        if (c.type === 'pcl-battery') t = `${v.toFixed(1)} V · ${mA(i)}`;
        else if (c.type === 'wokwi-resistor') t = `${v.toFixed(2)} V · ${mA(i)}`;
        else if (isLed || c.type === 'pcl-diode') t = (isLed && i > 0.03 ? '⚠ ' : '') + mA(i);
      }
      label(c, t, isLed && i > 0.03);
    });
  };

  // Componentes interactivos (botón, interruptor, potenciómetro)
  const addC = Lab.addComponent;
  Lab.addComponent = (...a) => {
    const c = addC(...a);
    if (c) {
      const f = () => Lab.refreshSim();
      c.el.addEventListener('button-press', () => { c.pressed = true; f(); });
      c.el.addEventListener('button-release', () => { c.pressed = false; f(); });
      c.el.addEventListener('input', f);
    }
    return c;
  };

  // Propiedades editables
  Lab.editProps = () => {
    const c = Lab.sel; if (!c) return;
    const ask = (msg, cur) => prompt(msg, cur);
    if (c.type === 'wokwi-resistor') { const v = ask('Valor en Ohms:', c.props.value); if (num(v, 0) > 0) c.props.value = c.el.value = String(num(v)); }
    else if (c.type === 'wokwi-led') { const v = ask('Color (red, green, blue, yellow, orange, white):', c.props.color); if (LED_VF[v]) c.props.color = c.el.color = v; }
    else if (c.type === 'pcl-battery') { const v = ask('Voltaje (V):', c.props.voltage); if (num(v, 0) > 0) c.props.voltage = c.el.voltage = num(v); }
    else if (c.type === 'pcl-diode') { const v = ask('Caída de tensión directa Vf (V):', c.props.vf); if (num(v, 0) > 0) c.props.vf = c.el.vf = num(v); }
    else return Lab.status('Este componente no tiene propiedades editables');
    Lab.refreshSim();
  };
})();