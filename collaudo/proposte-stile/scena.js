(async function () {
  const fb = window.__fb, q = new URLSearchParams(location.search), s = q.get('s') || 'board', t = q.get('t') || '';
  const att = ms => new Promise(r => setTimeout(r, ms));
  if (t) document.body.classList.add('tema-' + t);
  for (let i = 0; i < 300 && fb.listeners.length < 24; i++) await att(20);
  fb.setConnesso(true); fb.rilasciaCaricamento(); await att(400);
  if (s === 'board') switchView('board');
  if (s === 'agenda') switchView('agenda');
  if (s === 'archivio') switchView('archivio');
  if (s === 'conto') { switchView('board'); openClosingModal(103); }
  if (s === 'collab') switchView('ledger');
  if (s === 'nuova') switchView('nuova');
  document.title = 'PRONTO';
})();
