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
  // Umbrales de daño (aproximados, con fines didácticos): superarlos "quema" el componente.
  const BURN = { led: 0.05, diode: 1, resistorW: 0.25, arduino: 0.5, battery: 2, contact: 0.5, pot: 0.3 };

  // Agrupa los pines unidos por cables o por conexiones internas (une-busca); lo reutiliza
  // también measureResistance() para el óhmetro, que necesita la topología sin pedir netlist().
  function buildGraph() {
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
    return find;
  }

  function netlist() {
    const find = buildGraph();
    const ard = Lab.comps.find((c) => /^wokwi-arduino/.test(c.type)), bat = Lab.comps.find((c) => c.type === 'pcl-battery');
    const ref = ard ? K(ard.id, 'GND.1') : bat ? K(bat.id, '-') : null;
    if (!ref) return null;
    const ids = new Map([[find(ref), 0]]);
    const node = (c, p) => { const r = find(K(c.id, p)); if (!ids.has(r)) ids.set(r, ids.size); return ids.get(r); };

    const els = [], owner = [];
    const add = (c, e) => { els.push(e); owner.push(c); };
    Lab.comps.forEach((c) => {
      if (c.burned) return; // quemado: queda desconectado, como una pieza real que ya no conduce
      const P = (p) => node(c, p), pr = c.props;
      if (c.type === 'pcl-battery') {
        // Cable directo entre + y -: cortocircuito puro. El solver no puede "medir" esto (ambos
        // terminales son el mismo nodo), así que se detecta y se quema de inmediato.
        if (P('+') === P('-')) { Lab.triggerBurn(c, 'cortocircuito directo entre sus terminales'); return; }
        add(c, { t: 'V', p: P('+'), n: P('-'), v: num(pr.voltage, 9) });
      }
      else if (/^wokwi-arduino/.test(c.type)) {
        if (P('5V') === P('GND.1')) { Lab.triggerBurn(c, 'cortocircuito directo entre 5V y GND'); return; }
        add(c, { t: 'V', p: P('5V'), n: P('GND.1'), v: 5 });
        // Pines digitales: el sketch (arduino.js) deja su estado en Lab.pins; cada pin OUTPUT cableado
        // se modela como una fuente de voltaje (HIGH/LOW, o el promedio del duty de analogWrite).
        Object.entries(Lab.pins || {}).forEach(([pin, st]) => {
          const wired = Lab.wires.some((w) => (w.from.component === c.id && w.from.pin === pin) || (w.to.component === c.id && w.to.pin === pin));
          if (!wired) return;
          if (st.mode === 'OUTPUT') {
            // Un pin de salida cableado directo a GND (sin carga) es un corto que fríe el pin.
            if (P(pin) === P('GND.1')) { Lab.triggerBurn(c, `pin ${pin} en cortocircuito directo con GND`); return; }
            add(c, { t: 'V', p: P(pin), n: P('GND.1'), v: (st.pwm != null ? st.pwm / 255 : st.digital) * 5 });
          }
          // INPUT_PULLUP: resistencia interna (~20k) a 5V, igual que el AVR real, para leer botones sin resistencia externa.
          else if (st.mode === 'INPUT_PULLUP') add(c, { t: 'R', a: P('5V'), b: P(pin), r: 20000 });
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
      // Instrumentos: el amperímetro es ~0 Ω (va en serie, mide por caída de tensión); el
      // voltímetro y el óhmetro son ideales (resistencia infinita), así que solo registran
      // sus nodos sin aportar conductancia — su lectura se calcula aparte en Lab.refreshSim.
      else if (c.type === 'pcl-ammeter') add(c, { t: 'R', a: P('COM'), b: P('A'), r: 0.001 });
      else if (c.type === 'pcl-voltmeter') { P('COM'); P('V'); }
      else if (c.type === 'pcl-ohmmeter') { P('COM'); P('Ω'); }
      else if (c.type === 'pcl-multimeter') {
        if (pr.mode === 'A') add(c, { t: 'R', a: P('COM'), b: P('VΩA'), r: 0.001 });
        else { P('COM'); P('VΩA'); }
      }
    });
    const volAt = (cid, pin) => { const r = find(K(cid, pin)); return ids.has(r) ? ids.get(r) : null; };
    return { N: ids.size, els, owner, volAt };
  }

  // Resistencia equivalente entre los dos pines de un óhmetro/multímetro, ignorando fuentes
  // (solo tiene sentido con la fuente desconectada, igual que un óhmetro real: ver BURN hint).
  function measureResistance(c, pinCom, pinHot) {
    const find = buildGraph();
    const ids = new Map();
    const node = (k) => { const r = find(k); if (!ids.has(r)) ids.set(r, ids.size); return ids.get(r); };
    const a = node(K(c.id, pinCom)), b = node(K(c.id, pinHot));
    const resEls = [];
    Lab.comps.forEach((cc) => {
      if (cc.burned || cc === c) return;
      if (cc.type === 'wokwi-resistor') resEls.push({ a: node(K(cc.id, '1')), b: node(K(cc.id, '2')), r: num(cc.props.value, 220) });
      else if (cc.type === 'wokwi-potentiometer') {
        const min = num(cc.el.min, 0), max = num(cc.el.max, 100);
        const t = Math.min(1, Math.max(0, (num(cc.el.value, 50) - min) / (max - min || 1)));
        resEls.push({ a: node(K(cc.id, 'GND')), b: node(K(cc.id, 'SIG')), r: Math.max(10000 * t, 1) });
        resEls.push({ a: node(K(cc.id, 'SIG')), b: node(K(cc.id, 'VCC')), r: Math.max(10000 * (1 - t), 1) });
      }
    });
    if (a === b) return 0;
    const n = ids.size, A = Array.from({ length: n }, () => new Array(n).fill(0)), bArr = new Array(n).fill(0);
    for (let k = 0; k < n; k++) A[k][k] += 1e-9;
    const g = (p, q, G) => { A[p][p] += G; A[q][q] += G; A[p][q] -= G; A[q][p] -= G; };
    resEls.forEach((e) => g(e.a, e.b, 1 / Math.max(e.r, 1e-3)));
    bArr[a] += 1; bArr[b] -= 1;
    const x = gauss(A, bArr);
    return x[a] - x[b];
  }

  function label(c, text, bad) {
    let l = c.w._meas;
    if (!l) { l = c.w._meas = document.createElement('div'); l.className = 'meas'; c.w.appendChild(l); }
    l.textContent = text || ''; l.style.display = text ? '' : 'none'; l.classList.toggle('over', !!bad);
    l.style.transform = `translateX(-50%) rotate(${-c.rotation}deg)`;
  }
  const mA = (i) => (i * 1000).toFixed(1) + ' mA';
  const ampStr = (i) => (Math.abs(i) >= 1 ? i.toFixed(3) + ' A' : mA(i));
  const ohmStr = (r) => {
    if (!isFinite(r) || Math.abs(r) > 2e6) return 'OL';
    const ar = Math.abs(r);
    if (ar >= 1e6) return (r / 1e6).toFixed(2) + ' MΩ';
    if (ar >= 1e3) return (r / 1e3).toFixed(2) + ' kΩ';
    return r.toFixed(1) + ' Ω';
  };

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
      if (c.burned) return; // ya está quemado: se queda carbonizado, sin más actualizaciones
      const i = cur.get(c) || 0, v = volt.get(c), ai = Math.abs(i), isLed = c.type === 'wokwi-led';
      if (res && cur.has(c)) {
        let why = null;
        if (isLed && ai > BURN.led) why = `${mA(ai)} superan los ~50 mA máximos: faltó o era muy baja la resistencia en serie`;
        else if (c.type === 'pcl-diode' && ai > BURN.diode) why = `${ai.toFixed(2)} A superan su corriente máxima (~1 A)`;
        else if (c.type === 'wokwi-resistor') {
          const r = num(c.props.value, 220), p = ai * ai * r;
          if (p > BURN.resistorW) why = `disipó ${p.toFixed(2)} W (máx. ${BURN.resistorW} W): usa una resistencia de mayor valor`;
        }
        else if (/^wokwi-arduino/.test(c.type) && ai > BURN.arduino) why = `${ai.toFixed(2)} A por la placa: revisa cortocircuitos o voltajes mal conectados`;
        else if (c.type === 'pcl-battery' && ai > BURN.battery) why = `${ai.toFixed(1)} A: probablemente un cortocircuito`;
        else if ((c.type === 'wokwi-pushbutton' || c.type === 'wokwi-slide-switch') && ai > BURN.contact) why = `${ai.toFixed(2)} A por los contactos: falta una resistencia limitadora`;
        else if (c.type === 'wokwi-potentiometer' && ai > BURN.pot) why = `${ai.toFixed(2)} A por la pista resistiva`;
        if (why) { Lab.triggerBurn(c, why); return; }
      }
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
        else if (c.type === 'pcl-ammeter' || (c.type === 'pcl-multimeter' && c.props.mode === 'A')) t = ampStr(i);
      }
      if (c.type === 'pcl-voltmeter' || (c.type === 'pcl-multimeter' && c.props.mode === 'V')) {
        if (res) {
          const pin2 = c.type === 'pcl-voltmeter' ? 'V' : 'VΩA';
          const na = nl.volAt(c.id, 'COM'), nb = nl.volAt(c.id, pin2);
          t = ((na != null ? res.V(na) : 0) - (nb != null ? res.V(nb) : 0)).toFixed(2) + ' V';
        }
      }
      if (c.type === 'pcl-ohmmeter' || (c.type === 'pcl-multimeter' && c.props.mode === 'Ω')) {
        t = Lab.running ? '⚠ desconecta la fuente' : ohmStr(measureResistance(c, 'COM', c.type === 'pcl-ohmmeter' ? 'Ω' : 'VΩA'));
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
    else if (c.type === 'pcl-multimeter') {
      const v = ask('Modo del multímetro (V = voltímetro, A = amperímetro, Ω = óhmetro):', c.props.mode);
      const m = { v: 'V', a: 'A', o: 'Ω', 'ω': 'Ω' }[String(v || '').trim().toLowerCase()];
      if (m) c.props.mode = c.el.mode = m;
    }
    else return Lab.status('Este componente no tiene propiedades editables');
    Lab.refreshSim();
  };
})();