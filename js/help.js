(() => {
  const $ = (s) => document.querySelector(s);
  const modal = $('#helpModal');
  const open = () => (modal.hidden = false);
  const close = () => (modal.hidden = true);
  $('#btnHelp').onclick = open;
  $('#helpClose').onclick = close;
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
})();
