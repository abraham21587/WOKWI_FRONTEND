(() => {
  const svg = document.querySelector('#wires'), world = document.querySelector('#world'), cv = document.querySelector('#canvas');
  const NS = 'http://www.w3.org/2000/svg';
  let draft = null, line = null;

  // Curva Bézier cúbica con "caída", como un cable real
  const bez = (a, b) => {
    const s = 40 + Math.hypot(b.x - a.x, b.y - a.y) * 0.2;
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + s}, ${b.x} ${b.y + s}, ${b.x} ${b.y}`;
  };
  Lab.redraw = () => {
    svg.querySelectorAll('.wire:not(.draft)').forEach((n) => n.remove());
    Lab.wires.forEach((w) => {
      const a = Lab.pinPos(w.from.component, w.from.pin), b = Lab.pinPos(w.to.component, w.to.pin);
      if (!a || !b) return;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 'wire'); p.setAttribute('d', bez(a, b));
      p.style.stroke = w.color; p.style.color = w.color;
      p.addEventListener('dblclick', () => { Lab.wires = Lab.wires.filter((x) => x !== w); Lab.redraw(); Lab.refreshSim(); });
      svg.appendChild(p);
    });
  };
  const cancel = () => { draft = null; line && line.remove(); line = null; };

  world.addEventListener('click', (e) => {
    const pin = e.target.closest('.pin'); if (!pin) return;
    const ref = { component: pin.parentElement.dataset.id, pin: pin.dataset.pin };
    if (!draft) {
      draft = ref; line = document.createElementNS(NS, 'path');
      line.setAttribute('class', 'wire draft'); line.style.stroke = Lab.color; line.style.color = Lab.color; svg.appendChild(line);
    } else {
      if (ref.component !== draft.component || ref.pin !== draft.pin)
        Lab.wires.push({ id: 'w' + Lab.seq++, color: Lab.color, from: draft, to: ref });
      cancel(); Lab.redraw(); Lab.refreshSim();
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!draft) return;
    const a = Lab.pinPos(draft.component, draft.pin); if (a) line.setAttribute('d', bez(a, Lab.toWorld(e.clientX, e.clientY)));
  });
  cv.addEventListener('contextmenu', (e) => { if (draft) { e.preventDefault(); cancel(); } });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && cancel());

  // Selector de color de cable
  const bar = document.querySelector('#wirebar');
  ['#FF5555', '#50FA7B', '#8BE9FD', '#F1FA8C', '#BD93F9'].forEach((c, i) => {
    const b = document.createElement('button'); b.style.background = c; b.style.color = c; b.title = 'Color de cable';
    if (!i) b.classList.add('on');
    b.onclick = () => {
      Lab.color = c; bar.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on');
      if (line) { line.style.stroke = c; line.style.color = c; }
    };
    bar.appendChild(b);
  });
})();