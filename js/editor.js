(() => {
  const $ = (s) => document.querySelector(s);
  const ed = $('#editor'), head = $('#edHead'), fab = $('#edFab'), ta = $('#code'), root = document.documentElement;
  ta.value = `void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n`;
  Lab.getCode = () => ta.value; Lab.setCode = (t) => (ta.value = t);
  Lab.editorMode = (m) => {
    ed.className = m === 'dock' ? 'docked' : m === 'float' ? 'floating' : 'hidden';
    root.style.setProperty('--edw', m === 'dock' ? '380px' : '0px');
    fab.hidden = m !== 'min';
    if (m === 'float') { ed.style.left = '260px'; ed.style.top = '120px'; } else { ed.style.left = ed.style.top = ''; }
    Lab.editorState = m;
  };
  head.querySelectorAll('button').forEach((b) => (b.onclick = () => Lab.editorMode(b.dataset.m)));
  fab.onclick = () => Lab.editorMode('dock');
  $('#btnCode').onclick = () => Lab.editorMode(Lab.editorState === 'min' ? 'dock' : 'min');
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); }
  });
  let off = null;
  head.addEventListener('pointerdown', (e) => {
    if (!ed.classList.contains('floating') || e.target.tagName === 'BUTTON') return;
    off = { x: e.clientX - ed.offsetLeft, y: e.clientY - ed.offsetTop }; head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => { if (off) { ed.style.left = e.clientX - off.x + 'px'; ed.style.top = e.clientY - off.y + 'px'; } });
  head.addEventListener('pointerup', () => (off = null));
  Lab.editorMode('dock');
})();