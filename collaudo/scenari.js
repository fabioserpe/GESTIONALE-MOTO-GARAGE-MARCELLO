(async function () {
  const fb = window.__fb;
  const oggi = window.__oggi;
  const R = [];
  let falliti = 0, totali = 0;
  const ok = (c, m) => { totali++; R.push((c ? 'OK       ' : 'FALLITO  ') + m); if (!c) falliti++; };
  const attendi = ms => new Promise(r => setTimeout(r, ms));
  const nScr = () => fb.scritture.length;
  const chiaviDa = n => fb.scritture.slice(n).flatMap(w => w.chiavi);
  const ordina = a => a.slice().sort();
  const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const chiaveDi = (sez, id, campo = 'id') => { const n = fb.nodo(sez) || {}; return Object.keys(n).find(k => String(n[k][campo]) === String(id)); };
  const recordDi = (sez, id) => { const k = chiaveDi(sez, id); return k ? fb.leggi(sez + '/' + k) : null; };
  const ovVisibile = () => document.getElementById('offline-banner').style.display === 'flex';
  const ovTitolo = () => document.getElementById('cloud-ov-titolo').textContent;
  const ovTesto = () => document.getElementById('cloud-ov-testo').innerHTML;
  const campo = (id, v) => { const e = document.getElementById(id); if (!e) throw new Error('campo mancante ' + id); e.value = v; };
  async function passo(nome, fn) { try { await fn(); } catch (e) { ok(false, nome + ': eccezione ' + (e && e.message)); } }

  for (let i = 0; i < 300 && fb.inAttesa.length < 21; i++) await attendi(20);
  await attendi(50);

  await passo('Avvio', async () => {
    ok(document.getElementById('app-shell').style.display === 'flex', 'Avvio: accesso simulato, gestionale visibile');
    ok(fb.inAttesa.length === 21, 'Avvio: tutte le 21 sezioni in ascolto (' + fb.inAttesa.length + ')');
    ok(ovVisibile() && ovTitolo() === 'Caricamento dati…', 'Avvio: pannello "Caricamento dati…" finché i dati non arrivano');
    const n = nScr(), a = fb.alerts.length;
    db.push({ id: 999, cognome: 'PRIMA DEL CARICAMENTO' });
    saveDB();
    ok(nScr() === n, 'Avvio: salvataggio prima del caricamento bloccato, archivio sul cloud intatto');
    ok(fb.alerts.length === a + 1 && /non ancora caricati/.test(fb.alerts[a] || ''), 'Avvio: avviso "Dati non ancora caricati"');
    fb.setConnesso(true);
    ok(ovVisibile() && ovTitolo() === 'Caricamento dati…', 'Avvio: connesso ma archivio non arrivato, il pannello resta');
    fb.rilasciaCaricamento();
    await attendi(400);
    ok(!ovVisibile(), 'Avvio: pannello sparito all\'arrivo dei dati');
    ok(db.length === 5 && !db.some(j => j.id === 999), 'Avvio: 5 schede caricate, quella non salvata non compare');
  });

  await passo('Migrazione', async () => {
    const w = fb.scritture.filter(w => w.chiavi.some(k => k === 'db' || k.startsWith('db/')));
    ok(w.length === 1, 'Migrazione all\'avvio: una sola scrittura sull\'archivio (' + w.length + ')');
    ok(w.length === 1 && uguali(ordina(w[0].chiavi), ['db/2', 'db/3']), 'Migrazione: riscritte solo le 2 schede da sistemare (' + (w[0] && w[0].chiavi) + ')');
    ok(recordDi('db', 1003).data_chiusura === '2026-09-01', 'Migrazione: data di chiusura aggiunta al lavoro chiuso');
    ok(!!recordDi('db', 1004).clientId, 'Migrazione: codice cliente assegnato alla scheda che non lo aveva');
  });

  await passo('Bacheca', async () => {
    switchView('board');
    await attendi(400);
    const t = document.getElementById('view-board').textContent;
    ok(t.includes('ROSSI') && t.includes('BIANCHI'), 'Bacheca: le schede aperte compaiono');
    {
      // La zona che scorre taglia quello che esce dai suoi bordi: deve restare spazio per il tratteggio (2px) e il contorno del pulsante
      const lista = document.getElementById('list-todo'), prima = lista.querySelector('.card-compact');
      const a = lista.getBoundingClientRect(), b = prima.getBoundingClientRect();
      ok(b.top - a.top >= 3 && b.left - a.left >= 3, 'Bacheca: la prima scheda ha spazio sopra e a sinistra (il bordo tratteggiato "targa mancante" non viene tagliato)');
      const colEl = lista.parentElement, cs = getComputedStyle(colEl), col = colEl.getBoundingClientRect();
      const bordo = col.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
      ok(Math.abs(b.left - bordo) < 1 && Math.abs(lista.clientWidth - lista.scrollWidth) < 1, 'Bacheca: le schede restano allineate come prima (a ' + (b.left - bordo).toFixed(1) + ' px dal bordo della colonna), niente scorrimento di lato');
      const barra = document.getElementById('topbar-quicklinks'), btn = barra.querySelector('.tq-active');
      const c = barra.getBoundingClientRect(), d = btn.getBoundingClientRect();
      ok(d.top - c.top >= 3 && c.bottom - d.bottom >= 3, 'Barra in alto: spazio sopra e sotto i pulsanti (il contorno del pulsante selezionato non viene tagliato)');
    }
  });

  await passo('Nuova commessa', async () => {
    switchView('nuova');
    campo('f_cognome', 'TESTA'); campo('f_nome', 'GIULIO'); campo('f_tel', '3330000000'); campo('f_targa', 'zz99999');
    campo('f_marca', 'SUZUKI'); campo('f_modello', 'SV650'); campo('f_km', '5000'); campo('f_lavori', 'CONTROLLO GENERALE'); campo('f_data', oggi);
    const prima = JSON.parse(JSON.stringify(fb.nodo('db')));
    const n = nScr();
    saveJob('todo');
    const ch = chiaviDa(n);
    const dbCh = ch.filter(k => k.startsWith('db'));
    ok(dbCh.length === 1 && /^db\/-Ntest/.test(dbCh[0]), 'Nuova commessa: scritta solo la nuova scheda (' + ch + ')');
    ok(ch.some(k => /^agenda\/-Ntest/.test(k)), 'Nuova commessa: appuntamento creato in agenda');
    const id = (db.find(j => j.cognome === 'TESTA') || {}).id;
    const r = recordDi('db', id);
    ok(r && r.targa === 'ZZ99999' && r.stato === 'todo' && r.lavori_richiesti === 'CONTROLLO GENERALE', 'Nuova commessa: dati corretti sul cloud');
    const dopo = fb.nodo('db');
    ok(['0', '1', '2', '3', '4'].every(k => uguali(dopo[k], prima[k])), 'Nuova commessa: le altre schede non sono state toccate');
  });

  await passo('Modifica commessa', async () => {
    editJob(1001);
    campo('f_lavori', 'TAGLIANDO + CATENA');
    const n = nScr();
    saveJob('todo');
    const ch = ordina(chiaviDa(n));
    ok(uguali(ch, ['agenda/0', 'db/0']), 'Modifica: scritte solo la scheda e il suo appuntamento (' + ch + ')');
    ok(recordDi('db', 1001).lavori_richiesti === 'TAGLIANDO + CATENA', 'Modifica: lavoro aggiornato sul cloud');
    ok(recordDi('agenda', 2001).note === 'TAGLIANDO + CATENA', 'Modifica: nota dell\'appuntamento aggiornata');
  });

  await passo('Chiusura con conto', async () => {
    openClosingModal(1001);
    document.getElementById('conto-rows').innerHTML = '';
    addVoceConto('OLIO 10W40', 15, 22, false, 'OLIO-01', 3);
    addVoceConto('MANODOPERA', 50, 22, false, '', 1);
    calcContoTotal();
    const n = nScr();
    saveJobConConto('done');
    const w = fb.scritture.slice(n).find(w => w.chiavi.includes('db/0'));
    ok(w && uguali(ordina(w.chiavi), ['db/0', 'magazzino/OLIO-01']), 'Chiusura: scheda e magazzino nella stessa scrittura (' + (w && w.chiavi) + ')');
    const r = recordDi('db', 1001);
    ok(r.stato === 'done' && r.totale_lordo === 95 && !!r.data_chiusura, 'Chiusura: stato, totale (3×15 + 50 = 95 €) e data di chiusura corretti');
    ok(fb.leggi('magazzino/OLIO-01').giacenza === 7, 'Chiusura: giacenza olio scalata di 3 (da 10 a 7)');
    ok(document.getElementById('modal-conto').classList.contains('hidden'), 'Chiusura: finestra del conto chiusa');
  });

  await passo('Anteprima conto', async () => {
    previewJob(1001);
    const h = document.getElementById('st-corpo').innerHTML;
    ok(h.includes('×3') && h.includes('€ 45.00'), 'Anteprima conto: riga olio con ×3 e totale 45,00 €');
    closeModal('modal-storico');
  });

  let idTesta;
  await passo('Eliminazione', async () => {
    idTesta = db.find(j => j.cognome === 'TESTA').id;
    const kDb = chiaveDi('db', idTesta), kAg = chiaveDi('agenda', idTesta, 'jobId');
    const n = nScr();
    deleteJob(idTesta);
    const ch = ordina(chiaviDa(n));
    ok(uguali(ch, ordina(['db/' + kDb, 'agenda/' + kAg])), 'Eliminazione: cancellate solo la scheda e il suo appuntamento (' + ch + ')');
    ok(!recordDi('db', idTesta) && Object.keys(fb.nodo('db')).length === 5, 'Eliminazione: scheda sparita, le altre 5 restano');
  });

  await passo('Annulla', async () => {
    const n = nScr();
    eseguiUndo();
    const ch = chiaviDa(n);
    ok(!!recordDi('db', idTesta) && Object.keys(fb.nodo('db')).length === 6, 'Annulla: scheda eliminata ripristinata (6 schede)');
    ok(!!chiaveDi('agenda', idTesta, 'jobId'), 'Annulla: anche l\'appuntamento è tornato');
    ok(ch.filter(k => k.startsWith('db')).length === 1, 'Annulla: riscritta solo la scheda ripristinata (' + ch.filter(k => k.startsWith('db')) + ')');
  });

  await passo('Preventivo', async () => {
    openPreventivoForm(1005);
    campo('p_km', '7777');
    const n = nScr();
    savePreventivo(false, false);
    const ch = chiaviDa(n);
    ok(uguali(ch, ['db/4']), 'Preventivo: scritta solo la scheda del preventivo (' + ch + ')');
    const r = recordDi('db', 1005);
    ok(r.km === '7777' && Array.isArray(r.acconti) && r.acconti.length === 1 && r.acconti[0].val === 100, 'Preventivo: modifica salvata e acconto di 100 € conservato');
  });

  await passo('Storico preventivi', async () => {
    archiviaPreventivo(1005);
    ok(recordDi('db', 1005).stato === 'archived', 'Storico: preventivo archiviato');
    convertiStoricoInCommessa(1005);
    convertiStoricoInCommessa(1005);
    const ag = Object.values(fb.nodo('agenda')).filter(a => String(a.jobId) === '1005');
    ok(recordDi('db', 1005).stato === 'todo', 'Storico: convertito in commessa');
    ok(ag.length === 1, 'Storico: convertito due volte, un solo appuntamento (' + ag.length + ')');
  });

  await passo('Appuntamento', async () => {
    switchView('nuova-app');
    campo('app_id', ''); campo('app_job_id', ''); campo('app_tipo', 'officina');
    campo('app_cognome', 'MARRONI'); campo('app_nome', 'ELISA'); campo('app_tel', '3339998888'); campo('app_targa', 'MN44444');
    campo('app_marca', 'APRILIA'); campo('app_modello', 'TUONO'); campo('app_note', 'RUMORE MOTORE'); campo('app_data', oggi); campo('app_ora', '10:30');
    const n = nScr();
    salvaAppuntamento();
    const ch = chiaviDa(n);
    ok(ch.filter(k => /^db\/-Ntest/.test(k)).length === 1 && ch.filter(k => /^agenda\/-Ntest/.test(k)).length === 1
       && ch.filter(k => k.startsWith('db') || k.startsWith('agenda')).length === 2, 'Appuntamento: create una scheda e un appuntamento, nient\'altro (' + ch + ')');
    ok(Object.values(fb.nodo('agenda')).some(a => (a.cliente || '').includes('MARRONI') && a.ora === '10:30'), 'Appuntamento: presente in agenda alle 10:30');
  });

  await passo('Due dispositivi', async () => {
    const kB = chiaveDi('db', 1002), kC = chiaveDi('db', 1003);
    const remoto = fb.leggi('db/' + kB); remoto.note_tablet = 'DAL TABLET';
    fb.scritturaRemota({ ['db/' + kB]: remoto }, true);
    db.find(x => x.id === 1003).note_mac = 'DAL MAC';
    const n = nScr();
    saveDB();
    ok(uguali(chiaviDa(n), ['db/' + kC]), 'Due dispositivi: il Mac scrive solo la sua scheda');
    fb.consegnaTutto();
    ok(recordDi('db', 1002).note_tablet === 'DAL TABLET' && recordDi('db', 1003).note_mac === 'DAL MAC', 'Due dispositivi: sul cloud ci sono entrambe le modifiche');
    ok(db.find(x => x.id === 1002).note_tablet === 'DAL TABLET', 'Due dispositivi: il Mac vede la modifica del tablet');
  });

  await passo('Dispositivo non aggiornato', async () => {
    const v = fb.leggi('db');
    const arr = (Array.isArray(v) ? v : Object.values(v)).filter(Boolean);
    fb.scritturaRemota({ db: arr }, false);
    ok(Object.keys(fb.nodo('db')).every(k => /^\d+$/.test(k)), 'Vecchio dispositivo: archivio riscritto per intero con chiavi 0..N');
    db.find(x => x.id === 1002).note_dopo = 'OK';
    const n = nScr();
    saveDB();
    const ch = chiaviDa(n);
    ok(ch.length === 1 && ch[0] === 'db/' + chiaveDi('db', 1002), 'Vecchio dispositivo: il Mac si riallinea e scrive sulla chiave giusta (' + ch + ')');
    const ids = Object.values(fb.nodo('db')).map(x => x.id);
    ok(ids.length === arr.length && new Set(ids).size === ids.length, 'Vecchio dispositivo: nessuna scheda persa o doppia');
  });

  await passo('Prima Nota', async () => {
    ok(Array.isArray(ledgerDB) && ledgerDB.length === 1, 'Prima Nota: dati salvati come oggetto letti correttamente come lista');
  });

  await passo('Moto usate', async () => {
    switchView('usate');
    await attendi(200);
    ok(window.__xss === undefined && document.getElementById('view-usate').innerHTML.includes('&lt;img'), 'Moto usate: un testo con codice HTML viene mostrato, non eseguito');
  });

  await passo('Tutte le schermate', async () => {
    const viste = ['board', 'nuova', 'archivio', 'nuovo-cliente', 'stats', 'preventivi', 'crea-prev', 'agenda', 'ledger', 'ordini', 'rubrica',
                   'specials', 'incidentate', 'magazzino', 'nuova-app', 'tagliandi', 'scadenze', 'lista-attesa', 'usate', 'garanzie', 'vendite', 'schede'];
    const conErrori = [];
    for (const v of viste) {
      const e0 = window.__errori.length;
      try { switchView(v); } catch (e) { conErrori.push(v + ': ' + e.message); }
      await attendi(150);
      if (window.__errori.length > e0) conErrori.push(v + ': ' + window.__errori.slice(e0).join(' | '));
    }
    ok(conErrori.length === 0, 'Tutte le 22 schermate si aprono senza errori' + (conErrori.length ? ' → ' + conErrori.join(' ; ') : ''));
    const fuori = [...document.querySelectorAll('[id^="view-"]')].filter(el => !el.parentElement.classList.contains('main-content')).map(el => el.id);
    ok(fuori.length === 0, 'Struttura: tutte le pagine stanno dentro il contenitore principale' + (fuori.length ? ' → fuori: ' + fuori.join(', ') : ''));
    const nere = [];
    for (const v of viste) {
      switchView(v); await attendi(60);
      const r = document.getElementById('view-' + v).getBoundingClientRect();
      if (!(r.top < window.innerHeight && r.bottom > 0 && r.height > 0)) nere.push(v + ' (inizia a ' + Math.round(r.top) + 'px)');
    }
    ok(nere.length === 0, 'Ogni pagina aperta si vede sullo schermo (niente schermo nero)' + (nere.length ? ' → non visibili: ' + nere.join(', ') : ''));
    switchView('board');
  });

  await passo('Salvataggi altre sezioni', async () => {
    const prove = [['saveLedger', 'ledger'], ['saveOrdini', 'ordini'], ['saveRubrica', 'rubrica'], ['saveNote', 'note'], ['saveBilling', 'billing'],
                   ['saveTagliandi', 'tagliandi'], ['saveScadenzeDB', 'scadenze'], ['saveAttesaDB', 'lista_attesa'], ['saveUsateDB', 'moto_usate'], ['saveListaOrdiniMag', 'lista_ordini']];
    const a0 = fb.alerts.length, bloccati = [];
    for (const [fn, chiave] of prove) { const n = nScr(); window[fn](); if (!chiaviDa(n).includes(chiave)) bloccati.push(fn); }
    ok(bloccati.length === 0 && fb.alerts.length === a0, 'Salvataggio consentito in tutte le altre 10 sezioni' + (bloccati.length ? ' → bloccati: ' + bloccati.join(', ') : ''));
  });

  await passo('Prima Nota scheda collaboratore', async () => {
    ledgerDB.push({ id: 3101, data: oggi, tipo: 'in', cat: 'officina', collab: 'MARCO', desc: 'LAVORO A', importo: 30, qta: 2 });
    ledgerDB.push({ id: 3102, data: oggi, tipo: 'out', cat: 'officina', collab: 'MARCO', desc: 'ACCONTO', importo: 20, qta: 1 });
    saveLedger();
    switchView('ledger');
    openCollabDetail(safeEncode('MARCO'));
    archiviaSoloScheda();
    await attendi(100);
    const arch = Object.values(fb.leggi('storico_casse/MARCO') || {});
    ok(arch.length === 1 && arch[0].saldo === 40, 'Prima Nota: scheda di MARCO archiviata (saldo 2×30 − 20 = 40 €)');
    azzeraCassa();
    const voci = Object.values(fb.nodo('ledger') || {}).filter(x => x.collab === 'MARCO');
    ok(voci.length === 1 && /RESET/.test(voci[0].desc), 'Prima Nota: scheda svuotata, resta solo la riga di reset');
    ok(Object.values(fb.leggi('storico_casse/MARCO') || {}).length === 1, 'Prima Nota: svuotare la scheda non crea un doppione in archivio');
    ok(Object.values(fb.nodo('ledger')).some(x => x.collab === 'INTERNO'), 'Prima Nota: le voci degli altri restano');
    switchView('board');
  });

  await passo('Preventivo inesistente', async () => {
    let eccezione = null;
    try { openPreventivoForm(424242); } catch (e) { eccezione = e; }
    const toast = document.querySelector('.toast-msg');
    ok(!eccezione && toast && /non trovato/i.test(toast.textContent), 'Preventivo inesistente: messaggio "non trovato", nessun blocco');
    switchView('board');
  });

  await passo('Lavori Lunghi pre-conto', async () => {
    fb.scritturaRemota({
      'db/-Nsp001': { id: 1006, data: oggi, cognome: 'FERRARI', nome: 'LUIGI', tel: '3331231234', marca: 'DUCATI', modello: '750SS', targa: 'EF55555', stato: 'special', special_cat: 'restauri', lavori_richiesti: 'RESTAURO COMPLETO', clientId: 'c-ferrari', totale_lordo: 0 },
      'db/-Nsp002': { id: 1007, data: oggi, cognome: 'BLU', nome: 'ANNA', marca: 'YAMAHA', modello: 'R1', targa: 'PQ66666', stato: 'special', special_cat: 'incidentate', lavori_richiesti: 'SINISTRO', clientId: 'c-blu', totale_lordo: 0 },
    }, false);
    switchView('specials');
    await attendi(200);
    const col = () => document.getElementById('sp-col-restauri').textContent;
    ok(col().includes('750SS') && col().includes('Pre-conto'), 'Lavori Lunghi: scheda in Restauri con il pulsante "Pre-conto"');
    const giac = fb.leggi('magazzino/OLIO-01').giacenza;

    openClosingModal(1006);
    const nota = document.getElementById('conto-nota-speciale');
    ok(nota.style.display !== 'none' && /Lavori Lunghi/.test(nota.textContent), 'Lavori Lunghi: nella finestra del conto compare la nota');
    document.getElementById('conto-rows').innerHTML = '';
    addVoceConto('RESTAURO TELAIO', 600, 22, false, '', 1);
    addVoceConto('OLIO 10W40', 15, 22, false, 'OLIO-01', 2);
    addAcconto('conto-acconti-container', 'c_acc_val', 'c_acc_date', calcContoTotal, 500, oggi);
    calcContoTotal();
    const n = nScr();
    saveJobConConto('doing');
    ok(uguali(chiaviDa(n), ['db/-Nsp001']), 'Pre-conto: scritta solo la scheda (' + chiaviDa(n) + ')');
    let r = recordDi('db', 1006);
    ok(r.stato === 'special' && r.special_cat === 'restauri', 'Pre-conto: la scheda resta nei Lavori Lunghi, colonna Restauri');
    ok(r.totale_lordo === 630 && r.acconti.length === 1 && r.acconti[0].val === 500, 'Pre-conto: totale 600 + 2×15 = 630 € e acconto di 500 € salvati');
    ok(fb.leggi('magazzino/OLIO-01').giacenza === giac, 'Pre-conto: il magazzino non viene ancora scalato');
    await attendi(200);
    ok(col().includes('€ 630.00') && col().includes('Acconti € 500.00') && col().includes('Resta € 130.00'), 'Pre-conto: sulla scheda si vedono totale, acconti e quanto resta');
    ok(document.getElementById('modal-conto').classList.contains('hidden'), 'Pre-conto: finestra chiusa dopo il salvataggio');

    openClosingModal(1006);
    addVoceConto('VERNICIATURA', 450, 22, false, '', 1);
    calcContoTotal();
    saveJobConConto('doing');
    r = recordDi('db', 1006);
    ok(r.stato === 'special' && r.totale_lordo === 1080 && r.conto.length === 3 && r.acconti.length === 1, 'Secondo pre-conto: voce aggiunta, totale 1080 €, acconto conservato, sempre nei Lavori Lunghi');

    openClosingModal(1006);
    saveJobConConto('done');
    r = recordDi('db', 1006);
    ok(r.stato === 'done' && !!r.data_chiusura, 'Chiusura del lavoro lungo: scheda chiusa');
    ok(fb.leggi('magazzino/OLIO-01').giacenza === giac - 2, 'Chiusura del lavoro lungo: magazzino scalato una sola volta (2 olio)');
    await attendi(200);
    ok(!col().includes('750SS'), 'Chiusura del lavoro lungo: la scheda esce dai Lavori Lunghi');

    openClosingModal(1007);
    ok(/Incidentate/.test(document.getElementById('conto-nota-speciale').textContent), 'Incidentate: nota "resta tra le Incidentate"');
    document.getElementById('conto-rows').innerHTML = '';
    addVoceConto('CARENA', 300, 22, false, '', 1);
    calcContoTotal();
    saveJobConConto('doing');
    r = recordDi('db', 1007);
    ok(r.stato === 'special' && r.special_cat === 'incidentate' && r.totale_lordo === 300, 'Incidentate: il pre-conto non sposta la moto in bacheca');

    openClosingModal(1005);
    ok(document.getElementById('conto-nota-speciale').style.display === 'none', 'Scheda normale: nessuna nota');
    saveJobConConto('doing');
    ok(recordDi('db', 1005).stato === 'doing', 'Scheda normale: "Salva Pre-Conto" la porta in lavorazione come prima');
    switchView('board');
  });

  await passo('Rubrica periti', async () => {
    switchView('preventivi');
    openPeritiModal();
    campo('per_nome', 'Marco Periti'); campo('per_compagnia', 'Unipol'); campo('per_cell', '3471234567'); campo('per_email', 'marco.periti@esempio.it');
    let n = nScr();
    salvaPerito();
    const ch = chiaviDa(n);
    ok(ch.length === 1 && /^periti\/per\d+$/.test(ch[0]), 'Rubrica: salvato solo il nuovo perito (' + ch + ')');
    const idPer = ch[0].split('/')[1];
    ok(peritiDB.length === 1 && peritiDB[0].email === 'marco.periti@esempio.it', 'Rubrica: perito in elenco con la sua email');
    ok(document.getElementById('periti-list').textContent.includes('Marco Periti'), 'Rubrica: perito visibile nella finestra');
    campo('per_nome', 'Senza contatti');
    n = nScr(); salvaPerito();
    ok(nScr() === n, 'Rubrica: perito senza email né cellulare rifiutato');
    _resetPeritoForm();
    campo('per_nome', 'Email sbagliata'); campo('per_email', 'non-valida');
    n = nScr(); salvaPerito();
    ok(nScr() === n, 'Rubrica: email non valida rifiutata');
    _resetPeritoForm();
    editPerito(idPer); campo('per_cell', '3479999999');
    n = nScr(); salvaPerito();
    ok(uguali(chiaviDa(n), ['periti/' + idPer]) && fb.leggi('periti/' + idPer).cell === '3479999999', 'Rubrica: modifica del perito salvata sulla stessa voce');
    closeModal('modal-periti');
    window.__idPerito = idPer;
  });

  await passo('Preventivo assicurativo', async () => {
    fb.scritturaRemota({ 'db/-Npa001': { id: 1201, data: oggi, cognome: 'ROSA', nome: 'GINO', tel: '3330001111', marca: 'HONDA', modello: 'HORNET', targa: 'XY12345', stato: 'preventivo', era_preventivo: true, lavori_richiesti: 'Vedi voci preventivo', conto: [{ desc: 'CARENA ANTERIORE', price: 250, qty: 1, iva: 22 }, { desc: 'MANODOPERA SOSTITUZIONE E VERNICIATURA PARTI DANNEGGIATE', price: 180, qty: 2, iva: 22 }], totale_lordo: 430, clientId: 'c-rosa', acconti: [{ val: 50, date: oggi }] } }, false);
    openPreventivoForm(1201);
    ok(document.getElementById('p-assic-campi').style.display === 'none', 'Assicurativo: campi nascosti finché non si spunta');
    document.getElementById('p_assic').checked = true; toggleAssicPrev();
    ok(document.getElementById('p-assic-campi').style.display === 'grid', 'Assicurativo: spunta mostra perito, sinistro e libretto');
    ok(document.getElementById('p-libretto-box').textContent.includes('Nessun libretto'), 'Assicurativo: libretto non ancora caricato');
    document.getElementById('p_perito').value = window.__idPerito;
    campo('p_sinistro', '2026/555');
    const n = nScr();
    savePreventivo(false, false);
    ok(uguali(chiaviDa(n), ['db/-Npa001']), 'Assicurativo: scritta solo la scheda del preventivo');
    const r = recordDi('db', 1201);
    ok(r.assicurativo === true && r.perito_id === window.__idPerito && r.n_sinistro === '2026/555', 'Assicurativo: perito e sinistro salvati');
    ok(r.acconti && r.acconti[0].val === 50 && r.totale_lordo === 430, 'Assicurativo: acconti e totale conservati');
    switchView('preventivi'); setPrevTab('aperti'); await attendi(100);
    const t = document.getElementById('preventivi-results').innerHTML;
    ok(t.includes('🛡️ Marco Periti · Unipol · n. 2026/555') && t.includes('openInvioPerito(1201)'), 'Lista: etichetta perito e azione "Invia al perito"');
    ok(!t.includes('openInvioPerito(1005)'), 'Lista: nessun "Invia al perito" sui preventivi non assicurativi');
    openPreventivoForm(1201);
    ok(document.getElementById('p_assic').checked && document.getElementById('p_perito').value === window.__idPerito && document.getElementById('p_sinistro').value === '2026/555', 'Riapertura: campi assicurativi ricaricati');
    openPreventivoForm();
    ok(!document.getElementById('p_assic').checked && document.getElementById('p_sinistro').value === '', 'Nuovo preventivo: campi assicurativi vuoti');
    nuovoPreventivoFromIncidentata(1001);
    ok(document.getElementById('p_assic').checked, 'Preventivo da Incidentata: parte già spuntato come assicurativo');
    switchView('preventivi');
  });

  await passo('Libretto', async () => {
    openPreventivoForm(1201);
    const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
    const input = { files: [new File([pdf], 'libretto rosa.pdf', { type: 'application/pdf' })], value: 'x' };
    const n = nScr();
    await caricaLibretto(input);
    ok(uguali(ordina(chiaviDa(n)), ['libretti/XY12345', 'libretti_info/XY12345']), 'Libretto: salvato in una sezione a parte, collegato alla targa (' + chiaviDa(n) + ')');
    ok(input.value === '', 'Libretto: campo file svuotato dopo il caricamento');
    ok(librettiInfo.XY12345 && librettiInfo.XY12345.tipo === 'application/pdf', 'Libretto: informazioni disponibili subito');
    ok(document.getElementById('p-libretto-box').textContent.includes('Apri'), 'Libretto: nel preventivo compaiono Apri / Sostituisci / Elimina');
    ok(!JSON.stringify(fb.nodo('db')).includes('JVBERi0'), 'Libretto: il file non appesantisce l\'archivio dei lavori');
    const f = await _leggiLibretto('XY12345');
    ok(f.name === 'Libretto_XY12345.pdf' && (await f.text()) === pdf, 'Libretto: il file riletto è identico all\'originale');
    const grande = { files: [{ name: 'enorme.pdf', type: 'application/pdf', size: 9 * 1024 * 1024 }], value: 'x' };
    const n2 = nScr(); await caricaLibretto(grande);
    ok(nScr() === n2, 'Libretto: PDF oltre 7 MB rifiutato con avviso');
    previewJob(1201);
    ok(document.getElementById('st-corpo').innerHTML.includes('Apri libretto'), 'Anteprima scheda: pulsante "Apri libretto" per quella targa');
    closeModal('modal-storico');
  });

  await passo('Invio al perito', async () => {
    switchView('preventivi');
    await openInvioPerito(1201);
    const tk = _invio;
    ok(tk.pronto && !tk.errori.preventivo, 'Invio: PDF del preventivo generato' + (tk.errori.preventivo ? ' → ' + tk.errori.preventivo : ''));
    ok(tk.files.preventivo && tk.files.preventivo.type === 'application/pdf' && tk.files.preventivo.size > 2000, 'Invio: PDF valido (' + (tk.files.preventivo && tk.files.preventivo.size) + ' byte)');
    ok(tk.files.preventivo && /^%PDF/.test(await tk.files.preventivo.slice(0, 4).text()), 'Invio: il file inizia come un vero PDF');
    ok(tk.files.libretto && tk.files.libretto.name === 'Libretto_XY12345.pdf', 'Invio: libretto allegato');
    ok(document.getElementById('ip_perito').value === window.__idPerito && document.getElementById('ip-contatti').textContent.includes('marco.periti@esempio.it'), 'Invio: perito del preventivo già selezionato con la sua email');
    ok(!document.getElementById('ip-invia').disabled, 'Invio: pulsante attivo a allegati pronti');
    const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(tk.files.preventivo); });
    document.getElementById('e2e-pdf').textContent = b64;
    const scaricati = [], aperti = [];
    const origScarica = window._scaricaFile, origLink = window._apriLink, origShare = navigator.canShare;
    window._scaricaFile = f => scaricati.push(f.name);
    window._apriLink = u => aperti.push(u);
    navigator.canShare = undefined;
    try {
      const n = nScr();
      inviaAlPerito();
      await attendi(800);
      ok(uguali(scaricati, [tk.files.preventivo.name, 'Libretto_XY12345.pdf']), 'Invio senza Condividi: entrambi gli allegati scaricati');
      ok(aperti.length === 1 && aperti[0].startsWith('mailto:marco.periti@esempio.it?subject=') && decodeURIComponent(aperti[0]).includes('sinistro n. 2026/555'), 'Invio senza Condividi: email al perito con oggetto e testo');
      ok(uguali(chiaviDa(n), ['db/-Npa001']) && recordDi('db', 1201).inviato_perito.data === oggi, 'Invio: preventivo segnato come inviato oggi');
    } finally { window._scaricaFile = origScarica; window._apriLink = origLink; navigator.canShare = origShare; }

    let condiviso = null;
    const origNS = navigator.share;
    navigator.canShare = () => true;
    navigator.share = d => { condiviso = d; return Promise.resolve(); };
    try {
      await openInvioPerito(1201);
      ok(document.getElementById('ip-invia').textContent.includes('Condividi'), 'Invio con Condividi: pulsante "Condividi"');
      document.getElementById('ip_chk_lib').checked = false;
      inviaAlPerito();
      await attendi(100);
      ok(condiviso && condiviso.files.length === 1 && condiviso.files[0].type === 'application/pdf' && /sinistro/.test(condiviso.title), 'Invio con Condividi: menu aperto con il solo PDF scelto');
      ok(document.getElementById('modal-invio-perito').classList.contains('hidden'), 'Invio con Condividi: finestra chiusa dopo l\'invio');
    } finally { navigator.share = origNS; navigator.canShare = origShare; }
    switchView('preventivi'); await attendi(100);
    ok(document.getElementById('preventivi-results').textContent.includes('Inviato il'), 'Lista: indicazione "Inviato il …"');
  });

  await passo('Quantità nei preventivi', async () => {
    openPreventivoForm(1201);
    const righe = [...document.querySelectorAll('#p-conto-rows tr.voce-row')];
    ok(righe.length === 2 && parseFloat(righe[1].querySelector('.p-price').value) === 90 && righe[1].querySelector('.p-qty').value === '2', 'Riapertura: voce ×2 mostrata a 90 € l\'una, non 180');
    savePreventivo(false, false); savePreventivo(false, false);
    ok(recordDi('db', 1201).totale_lordo === 430, 'Salvando più volte il totale resta 430 € (prima cresceva a ogni salvataggio)');
    openPreventivoForm(1201);
    savePreventivo(false, true);
    let r = recordDi('db', 1201);
    ok(r.stato === 'todo' && r.totale_lordo === 430, 'Convertito in commessa: totale invariato 430 €');
    ok(r.conto[1].price === 90 && r.conto[1].qty === 2, 'Convertito: la voce ×2 ora ha prezzo unitario 90 €');
    openClosingModal(1201);
    calcContoTotal();
    ok(/TOTALE: 430\.00/.test(document.getElementById('conto-totale').textContent), 'Conto della commessa: totale 430 €, non gonfiato');
    saveJobConConto('doing');
    ok(recordDi('db', 1201).totale_lordo === 430, 'Salvando il conto il totale resta 430 €');
    previewJob(1201);
    ok(document.getElementById('st-corpo').innerHTML.includes('€ 180.00'), 'Anteprima: riga ×2 da 180 €');
    closeModal('modal-storico');
    fb.scritturaRemota({ 'db/-Nvecchio': { id: 1301, data: '2026-09-10', cognome: 'VECCHIO', stato: 'done', era_preventivo: true, conto: [{ desc: 'PNEUMATICI', price: 240, qty: 2, iva: 22 }, { desc: 'MONTAGGIO', price: 30, qty: 1, iva: 22 }], totale_lordo: 270, clientId: 'c-v' } }, false);
    r = recordDi('db', 1301);
    ok(r.totale_lordo === 270 && r.conto[0].price === 120 && r.conto[0].qty === 2 && r.conto[1].price === 30, 'Commessa già convertita in passato: righe sistemate, totale 270 € invariato');
    fb.scritturaRemota({ 'db/-Ngiusto': { id: 1302, data: '2026-09-11', cognome: 'GIUSTO', stato: 'done', conto: [{ desc: 'OLIO', price: 15, qty: 3, iva: 22 }], totale_lordo: 45, clientId: 'c-g' } }, false);
    ok(recordDi('db', 1302).conto[0].price === 15, 'Commessa normale (prezzo già unitario): non toccata');
    fb.scritturaRemota({ 'db/-Ndubbio': { id: 1303, data: '2026-09-12', cognome: 'DUBBIO', stato: 'done', conto: [{ desc: 'X', price: 50, qty: 2, iva: 22 }], totale_lordo: 77, clientId: 'c-d' } }, false);
    ok(recordDi('db', 1303).conto[0].price === 50 && recordDi('db', 1303).totale_lordo === 77, 'Totale che non torna con nessuna delle due regole: scheda non toccata');
    switchView('board');
  });

  await passo('Incidentate', async () => {
    fb.scritturaRemota({
      'db/-Ninc1': { id: 1401, data: '2026-09-01', cognome: 'ZANCHI', nome: 'ELIO', marca: 'APRILIA', modello: 'RS 660', targa: 'ZZ00001', stato: 'special', special_cat: 'incidentate', lavori_richiesti: 'CADUTA LATO DX', clientId: 'c-z' },
      'db/-Ninc2': { id: 1402, data: '2026-10-01', cognome: 'ALBERTI', nome: 'ANNA', tel: '3401112233', marca: 'BMW', modello: 'F 900', targa: 'AA00002', stato: 'special', special_cat: 'incidentate', lavori_richiesti: 'TAMPONAMENTO', clientId: 'c-a' },
      'db/-Ninc3': { id: 1403, data: '2026-09-15', cognome: 'MORETTI', nome: 'LUCA', marca: 'KTM', modello: '390', targa: 'MM00003', stato: 'special', special_cat: 'incidentate', lavori_richiesti: 'SINISTRO STRADALE', clientId: 'c-m' },
      'db/-Nincp': { id: 1404, data: '2026-09-20', cognome: 'MORETTI', nome: 'LUCA', marca: 'KTM', modello: '390', targa: 'MM 00003', stato: 'preventivo', era_preventivo: true, lavori_richiesti: 'Vedi voci preventivo', conto: [{ desc: 'SERBATOIO', price: 400, qty: 1, iva: 22 }], totale_lordo: 400, clientId: 'c-m', assicurativo: true, n_sinistro: 'S-77' },
    }, false);
    switchView('incidentate'); await attendi(100);
    const nomi = () => [...document.querySelectorAll('#incidentate-results .archive-card-row')].map(r => r.textContent.trim().split(/\s+/)[0]);
    ok(uguali(nomi().filter(n => ['ALBERTI', 'BLU', 'MORETTI', 'ZANCHI'].includes(n)), ['ALBERTI', 'BLU', 'MORETTI', 'ZANCHI']), 'Incidentate: elenco in ordine alfabetico (' + nomi().join(', ') + ')');
    ok(document.getElementById('incidentate-results').textContent.includes('Preventivo aperto'), 'Incidentate: indicazione del preventivo aperto (targa scritta con spazio)');
    campo('incidentate-search', 'ktm'); refreshIncidentate();
    ok(uguali(nomi(), ['MORETTI']), 'Ricerca "ktm": solo MORETTI');
    campo('incidentate-search', 'anna 340'); refreshIncidentate();
    ok(uguali(nomi(), ['ALBERTI']), 'Ricerca su nome + telefono: solo ALBERTI');
    campo('incidentate-search', 'rossi'); refreshIncidentate();
    ok(nomi().length === 0 && document.getElementById('incidentate-results').textContent.includes('Nessuna moto'), 'Ricerca: cerca solo tra le incidentate (ROSSI è in bacheca, non compare)');
    campo('incidentate-search', ''); refreshIncidentate();

    apriPreventivoIncidentata(1403);
    ok(document.getElementById('p_id').value === '1404' && document.getElementById('p_sinistro').value === 'S-77', 'Pulsante Preventivo: apre il preventivo esistente');
    ok(document.getElementById('p-nuovo-stessa').style.display === '', 'Nel preventivo esistente compare "Nuovo preventivo per questa moto"');
    nuovoPreventivoStessaMoto();
    ok(document.getElementById('p_id').value === '' && document.getElementById('p_targa').value === 'MM 00003' && document.getElementById('p_assic').checked && document.getElementById('p_sinistro').value === 'S-77', 'Nuovo per la stessa moto: dati moto e sinistro tenuti, voci vuote');
    ok(document.getElementById('p-nuovo-stessa').style.display === 'none', 'Nel nuovo preventivo il pulsante sparisce');
    const n = nScr();
    document.querySelector('#p-conto-rows .p-desc').value = 'FORCELLA';
    document.querySelector('#p-conto-rows .p-price').value = '300';
    savePreventivo(false, false);
    ok(fb.leggi('db/-Nincp').tel === undefined, 'Riaprendo un preventivo senza telefono non viene salvato "undefined"');
    ok(chiaviDa(n).length === 1 && /^db\/-Ntest/.test(chiaviDa(n)[0]) && recordDi('db', 1404).totale_lordo === 400, 'Nuovo per la stessa moto: creato un secondo preventivo, il primo intatto (' + chiaviDa(n) + ')');
    apriPreventivoIncidentata(1403);
    ok(document.getElementById('p_id').value !== '' , 'Con due preventivi aperti si apre il più recente');
    apriPreventivoIncidentata(1401);
    ok(document.getElementById('p_id').value === '' && document.getElementById('p_targa').value === 'ZZ00001' && document.getElementById('p_assic').checked, 'Senza preventivo aperto: nuovo preventivo assicurativo precompilato');
    switchView('board');
  });

  await passo('Riordino sotto scorta', async () => {
    fb.scritturaRemota({
      'magazzino/FIL-02': { codice: 'FIL-02', nome: 'FILTRO ARIA', marca: 'HIFLO', categoria: 'ARIA E CARBURANTE', giacenza: 0, prezzo: 9, prezzo_pubblico: 16, min_stock: 2 },
      'magazzino/PAS-01': { codice: 'PAS-01', nome: 'PASTIGLIE FRENO', marca: 'BREMBO', categoria: 'FRENI', giacenza: 1, prezzo: 22, prezzo_pubblico: 40, min_stock: 2 },
      'magazzino/CAN-01': { codice: 'CAN-01', nome: 'CANDELA', marca: 'NGK', categoria: 'MOTORE', giacenza: 5, prezzo: 6, prezzo_pubblico: 11, min_stock: 2 },
      'magazzino/CAT-01': { codice: 'CAT-01', nome: 'CATENA', marca: 'DID', categoria: 'TRASMISSIONE', giacenza: 0, prezzo: 60, prezzo_pubblico: 95, min_stock: 1 },
      'lista_ordini': [{ id: 7001, codice: 'CAT-01', nome: 'CATENA', marca: 'DID', categoria: 'TRASMISSIONE', giacenza: 1, prezzo: 60 }]
    }, false);
    switchView('magazzino'); await attendi(150);
    ok(document.getElementById('mag-riordina-badge').textContent === '2', 'Riordino: il pulsante indica 2 articoli (il terzo è già in lista)');
    ok(/Da Riordinare\s*3/.test(document.getElementById('mag-summary-container').textContent), 'Riquadro "Da Riordinare": 3, con la stessa regola delle righe colorate');
    apriRiordino();
    const righe = [...document.querySelectorAll('#riordino-lista tbody tr')];
    ok(righe.length === 2 && righe[0].textContent.includes('FIL-02') && righe[1].textContent.includes('PAS-01'), 'Finestra: prima gli esauriti, poi quelli sotto scorta');
    ok(righe.length === 2 && righe[0].querySelector('.riordino-qta').value === '3' && righe[1].querySelector('.riordino-qta').value === '2', 'Quantità proposte: 3 (da 0 con scorta 2) e 2 (da 1 con scorta 2)');
    ok(document.getElementById('riordino-gia').textContent.includes('CAT-01'), 'Finestra: segnala l\'articolo già in lista');
    if (righe[1]) righe[1].querySelector('.riordino-qta').value = '5';
    const n = nScr();
    confermaRiordino();
    ok(uguali(chiaviDa(n), ['lista_ordini']), 'Conferma: scritta solo la lista da ordinare (' + chiaviDa(n) + ')');
    const lista = Object.values(fb.leggi('lista_ordini') || {});
    const fil = lista.find(x => x.codice === 'FIL-02'), pas = lista.find(x => x.codice === 'PAS-01');
    ok(lista.length === 3 && fil && fil.giacenza === 3 && fil.prezzo === 9 && pas && pas.giacenza === 5 && pas.prezzo_pubblico === 40, 'Lista: aggiunti filtro ×3 e pastiglie ×5 (quantità modificata) con i prezzi, catena non duplicata');
    ok(document.getElementById('modal-riordino').classList.contains('hidden') && document.getElementById('lo-card').style.display === 'block', 'Dopo la conferma si chiude la finestra e si apre la lista da ordinare');
    ok(document.getElementById('mag-riordina-badge').style.display === 'none', 'Pulsante: nessun articolo rimasto da riordinare');
    apriRiordino();
    ok(document.getElementById('modal-riordino').classList.contains('hidden') && /già tutti nella lista/.test((document.querySelector('.toast-msg') || {}).textContent || ''), 'Secondo clic: avviso "già tutti nella lista", nessun doppione');
    if (fil) await spostaInMagazzino(fil.id);
    ok(fb.leggi('magazzino/FIL-02').giacenza === 3 && !Object.values(fb.leggi('lista_ordini') || {}).some(x => x.codice === 'FIL-02'), 'Arrivo merce: "📥 Mag." porta il filtro a 3 pezzi e lo toglie dalla lista');
    toggleFiltroSottosogliaMag(); await attendi(50);
    const tab = document.getElementById('view-magazzino').textContent;
    ok(tab.includes('PAS-01') && tab.includes('CAT-01') && !tab.includes('CAN-01'), 'Filtro "Da Riordinare": solo gli articoli sotto scorta');
    toggleFiltroSottosogliaMag();
    switchView('board');
  });

  await passo('Ordini collegati alla moto', async () => {
    const toast = () => (document.querySelector('.toast-msg') || {}).textContent || '';
    const ordine = desc => Object.values(fb.leggi('ordini') || {}).find(x => x.desc === desc);
    ordinaRicambioPerJob(1002);
    ok(currentView === 'ordini' && document.getElementById('ord-form-container').style.display === '', 'Dalla scheda (menu ⋯ → Ordina ricambio) si apre il modulo ordine');
    ok(document.getElementById('ord_job').value === '1002' && document.getElementById('ord_cliente').value === 'BIANCHI LUCA' && document.getElementById('ord_tel_cliente').value === '3334445555', 'Moto già scelta, cliente e telefono compilati');
    const apertoDi = id => { const j = db.find(x => String(x.id) === String(id)) || {}; return _jobApertoPer(j.targa, j.clientId); };
    ok(apertoDi(1004) === null && String((apertoDi(1401) || {}).id) === '1401' && String((apertoDi(1002) || {}).id) === '1002', 'Ricerca cliente o moto: collega solo le moto con un lavoro aperto (anche incidentate), non le archiviate');
    ok(document.getElementById('ord-collegato').textContent.includes('sul ponte'), 'Modulo ordine: indica la moto collegata e dove si trova');
    campo('ord_desc', 'kit catena'); campo('ord_fornitore', 'gipa');
    let n = nScr();
    addOrdine();
    ok(uguali(chiaviDa(n), ['ordini', 'db/' + chiaveDi('db', 1002)]), 'Salvataggio: scritti l\'ordine e la sola scheda della moto (conto) (' + chiaviDa(n) + ')');
    let o = ordine('KIT CATENA');
    ok(o && String(o.jobId) === '1002' && o.targa === 'CD67890' && o.moto === 'YAMAHA MT07' && o.stato === 'todo' && o.data === oggi, 'Ordine salvato e collegato alla moto CD67890');
    switchView('ordini'); await attendi(50);
    ok([...document.querySelectorAll('#ord-lista .ord-riga')].some(r => r.textContent.includes('KIT CATENA') && r.textContent.includes('CD67890') && r.textContent.includes('YAMAHA MT07')), 'Elenco ordini: la riga indica la moto collegata');
    switchView('board'); await attendi(350);
    const cardB = () => [...document.querySelectorAll('#view-board .card-compact')].find(c => c.textContent.includes('CD67890'));
    ok(cardB() && cardB().textContent.includes('Attesa ricambi'), 'Bacheca: la moto mostra "Attesa ricambi"');
    ok(document.getElementById('view-board').innerHTML.includes('ordinaRicambioPerJob('), 'Bacheca: voce "Ordina ricambio" nel menu ⋯');
    moveOrdine(o.id, 'doing');
    editOrdine(o.id); campo('ord_prezzo', '75');
    addOrdine();
    o = ordine('KIT CATENA');
    ok(o.stato === 'doing' && o.prezzo === 75 && o.data === oggi && String(o.jobId) === '1002', 'Modifica di un ordine già ordinato: resta ordinato (prima tornava in "Da ordinare")');
    moveOrdine(o.id, 'done');
    ok(/CD67890 arrivato · tutti i ricambi arrivati/.test(toast()), 'Arrivo del ricambio: avviso con la targa');
    switchView('board'); await attendi(350);
    ok(cardB() && cardB().textContent.includes('Ricambi arrivati') && !cardB().textContent.includes('Attesa ricambi'), 'Bacheca: diventa "Ricambi arrivati"');
    ordinaRicambioPerJob(1401); campo('ord_desc', 'carena destra'); addOrdine();
    switchView('incidentate'); await attendi(100);
    const rigaZ = [...document.querySelectorAll('#incidentate-results .archive-card-row')].find(r => r.textContent.includes('ZANCHI'));
    ok(rigaZ && rigaZ.textContent.includes('Attesa ricambi'), 'Incidentate: la moto mostra "Attesa ricambi"');
    switchView('ordini'); cancelEditOrdine(); campo('ord_desc', 'olio da banco'); addOrdine();
    const banco = ordine('OLIO DA BANCO');
    ok(banco && (banco.jobId == null) && !banco.targa, 'Ordine senza moto: resta libero come prima');
    switchView('board');
  });

  await passo('Ricambi per gli appuntamenti futuri', async () => {
    const tra = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const dApp = tra(5);
    fb.scritturaRemota({
      'db/-Nfut1': { id: 1501, data: dApp, cognome: 'FUTURI', nome: 'ELENA', tel: '3409990000', marca: 'TRIUMPH', modello: 'STREET TRIPLE', targa: 'TR55501', stato: 'todo', lavori_richiesti: 'TAGLIANDO E KIT CATENA', clientId: 'c-fut' },
      'agenda/-Nfut1': { id: 2501, tipo: 'officina', jobId: 1501, data: dApp, ora: '09:30', cliente: 'FUTURI ELENA', moto: 'TRIUMPH STREET TRIPLE - TR55501', raw_targa: 'TR55501' }
    }, false);
    switchView('agenda');
    const cerca = async q => { campo('agenda-search-input', q); refreshAgenda(); await attendi(30); return document.getElementById('agenda-search-results').innerHTML; };
    let html = await cerca('futuri');
    ok(html.includes("ordinaRicambioPerJob('1501')"), 'Agenda: l\'appuntamento futuro ha il pulsante 📦 Ordina ricambio');
    html = await cerca('rossi');
    ok(!html.includes('ordinaRicambioPerJob'), 'Agenda: niente pulsante sugli appuntamenti di lavori già chiusi');
    ordinaRicambioPerJob('1501');
    const info = () => document.getElementById('ord-job-info').textContent;
    ok(document.getElementById('ord_job').value === '1501' && /Appuntamento .* alle 09:30 \(tra 5 giorni\)/.test(info()), 'Modulo ordine: mostra l\'appuntamento e i giorni mancanti (' + info() + ')');
    ok(document.getElementById('ord-collegato').textContent.includes('appuntamento ' + formattaData(dApp)), 'Moto collegata: indica la data dell\'appuntamento');
    campo('ord_data_consegna', tra(7)); aggiornaInfoJobOrdine();
    ok(/dopo l'appuntamento/.test(info()), 'Consegna prevista dopo l\'appuntamento: avviso nel modulo');
    campo('ord_desc', 'kit catena 525'); campo('ord_fornitore', 'gipa');
    addOrdine();
    switchView('agenda');
    html = await cerca('futuri');
    ok(/Ricambio previsto il .*dopo l'appuntamento/.test(html), 'Agenda: avviso rosso "ricambio previsto dopo l\'appuntamento"');
    switchView('ordini'); await attendi(30);
    ok(/Appuntamento .*tra 5 giorni.*il ricambio arriva dopo/.test(document.getElementById('view-ordini').textContent), 'Scheda dell\'ordine: appuntamento e avviso di ritardo');
    const o = Object.values(fb.leggi('ordini') || {}).find(x => x.desc === 'KIT CATENA 525');
    editOrdine(o.id); campo('ord_data_consegna', tra(3)); aggiornaInfoJobOrdine();
    ok(/in tempo per l'appuntamento/.test(info()), 'Consegna prevista prima: "in tempo per l\'appuntamento"');
    addOrdine();
    switchView('agenda');
    html = await cerca('futuri');
    ok(html.includes('Attesa ricambi') && html.includes('arrivo previsto ' + formattaData(tra(3))) && !html.includes("dopo l'appuntamento"), 'Agenda: "Attesa ricambi · arrivo previsto" con la data');
    moveOrdine(o.id, 'doing'); moveOrdine(o.id, 'done');
    html = await cerca('futuri');
    ok(html.includes('Ricambi arrivati'), 'Agenda: dopo l\'arrivo "Ricambi arrivati"');
    campo('agenda-search-input', ''); refreshAgenda();
    switchView('board');
  });

  await passo('Ricambio ordinato nel conto', async () => {
    const ordine = desc => Object.values(fb.leggi('ordini') || {}).find(x => x.desc === desc);
    const conto = () => (recordDi('db', 1601).conto || []);
    const rigaOrd = o => conto().find(c => String(c.ordine_id) === String(o.id));
    fb.scritturaRemota({ 'db/-Nconto1': { id: 1601, data: oggi, cognome: 'CONTI', nome: 'MARA', tel: '3401234567', marca: 'HONDA', modello: 'AFRICA TWIN', targa: 'AT16010', stato: 'doing', lavori_richiesti: 'FRENI', conto: [{ desc: 'MANODOPERA', price: 50, qty: 1, iva: 22, mag_codice: '' }], totale_lordo: 50, clientId: 'c-conti' } }, false);
    const giacPas = fb.leggi('magazzino/PAS-01').giacenza;
    ordinaRicambioPerJob(1601);
    campo('ord_sku', 'pas-01'); prezziDaMagazzinoOrdine();
    ok(document.getElementById('ord_desc').value === 'PASTIGLIE FRENO' && document.getElementById('ord_prezzo').value === '22' && document.getElementById('ord_prezzo_cliente').value === '40', 'Codice del magazzino: descrizione, prezzo d\'acquisto e prezzo al cliente compilati');
    campo('ord_qta', '2');
    let n = nScr();
    addOrdine();
    let o = ordine('PASTIGLIE FRENO');
    ok(uguali(chiaviDa(n), ['ordini', 'db/-Nconto1']), 'Salvataggio: ordine + conto della moto');
    let r = rigaOrd(o);
    ok(r && r.price === 40 && r.qty === 2 && r.mag_codice === '' && conto().length === 2 && recordDi('db', 1601).totale_lordo === 130, 'Nel conto: PASTIGLIE FRENO ×2 a € 40, totale 50 + 80 = 130 €');
    ok(/Aggiunto al conto di CONTI \(AT16010\): 2 × € 40\.00/.test((document.querySelector('.toast-msg') || {}).textContent || ''), 'Avviso "Aggiunto al conto di CONTI"');
    openClosingModal(1601);
    const riga = [...document.querySelectorAll('#conto-rows tr.voce-row')].find(tr => tr.dataset.ordineId);
    ok(riga && riga.textContent.includes('ORDINE') && /TOTALE: 130\.00/.test(document.getElementById('conto-totale').textContent), 'Finestra del conto: riga con etichetta ORDINE, totale 130 €');
    riga.querySelector('.r-price').value = '38'; calcContoTotal();
    saveJobConConto('doing');
    r = rigaOrd(o);
    ok(r && r.price === 38 && String(r.ordine_id) === String(o.id), 'Salvando il conto il legame con l\'ordine resta (prezzo corretto a mano: 38 €)');
    editOrdine(o.id); campo('ord_note', 'urgente'); addOrdine();
    ok(rigaOrd(o).price === 38, 'Modifica dell\'ordine senza cambiare il prezzo: la correzione nel conto resta');
    editOrdine(o.id); campo('ord_qta', '3'); addOrdine();
    r = rigaOrd(o);
    ok(r.qty === 3 && r.price === 38 && recordDi('db', 1601).totale_lordo === 50 + 3 * 38, 'Cambio quantità nell\'ordine: aggiornata nel conto (totale 164 €)');
    ok(conto().filter(c => String(c.ordine_id) === String(o.id)).length === 1, 'Nessun doppione nel conto');
    openClosingModal(1601);
    [...document.querySelectorAll('#conto-rows tr.voce-row')].find(tr => tr.dataset.ordineId).remove(); calcContoTotal();
    saveJobConConto('doing');
    editOrdine(o.id); campo('ord_fornitore', 'autodis'); addOrdine();
    ok(!rigaOrd(o) && conto().length === 1, 'Riga tolta a mano dal conto: modificando l\'ordine non ricompare');
    ordinaRicambioPerJob(1601); campo('ord_desc', 'tubo freno'); campo('ord_prezzo_cliente', '25'); addOrdine();
    let t = ordine('TUBO FRENO');
    ok(rigaOrd(t) && recordDi('db', 1601).totale_lordo === 75, 'Secondo ricambio: nel conto, totale 75 €');
    editOrdine(t.id); document.getElementById('ord_job').value = '1002'; onCambioJobOrdine(); addOrdine();
    t = ordine('TUBO FRENO');
    ok(!rigaOrd(t) && recordDi('db', 1601).totale_lordo === 50 && (recordDi('db', 1002).conto || []).some(c => String(c.ordine_id) === String(t.id) && c.price === 25), 'Ordine spostato su un\'altra moto: la riga passa al suo conto');
    const tot1002 = recordDi('db', 1002).totale_lordo;
    deleteOrdine(t.id);
    ok(!(recordDi('db', 1002).conto || []).some(c => String(c.ordine_id) === String(t.id)) && Math.abs(recordDi('db', 1002).totale_lordo - (tot1002 - 25)) < 0.001, 'Ordine eliminato: tolto anche dal conto (con conferma)');
    ordinaRicambioPerJob(1601); campo('ord_desc', 'paraolio'); addOrdine();
    ok(/senza prezzo/.test((document.querySelector('.toast-msg') || {}).textContent || '') && rigaOrd(ordine('PARAOLIO')).price === 0, 'Senza prezzo al cliente: riga a 0 € e avviso di completarla');
    openClosingModal(1601); saveJobConConto('done');
    ok(recordDi('db', 1601).stato === 'done' && fb.leggi('magazzino/PAS-01').giacenza === giacPas, 'Chiusura del conto: i ricambi ordinati non scalano il magazzino');
    switchView('board');
  });

  await passo('Più ricambi per la stessa moto', async () => {
    fb.scritturaRemota({ 'db/-Nmulti': { id: 1701, data: oggi, cognome: 'MOLTI', nome: 'PIERO', tel: '3407770000', marca: 'KTM', modello: '890 ADVENTURE', targa: 'KT89000', stato: 'doing', lavori_richiesti: 'REVISIONE COMPLETA', conto: [], totale_lordo: 0, clientId: 'c-molti' } }, false);
    const val = id => document.getElementById(id).value;
    ordinaRicambioPerJob(1701);
    campo('ord_fornitore', 'gipa'); campo('ord_num_ordine', 'ORD-77'); campo('ord_data_consegna', oggi);
    campo('ord_desc', 'filtro olio'); campo('ord_prezzo_cliente', '18'); addOrdine();
    ok(document.getElementById('ord-form-container').style.display === '' && val('ord_job') === '1701' && val('ord_fornitore').toUpperCase() === 'GIPA' && val('ord_num_ordine') === 'ORD-77' && val('ord_data_consegna') === oggi && val('ord_cliente') === 'MOLTI PIERO',
       'Dopo "Aggiungi" il modulo resta aperto con moto, cliente, fornitore, n° ordine e consegna');
    ok(val('ord_desc') === '' && val('ord_prezzo_cliente') === '' && val('ord_qta') === '1', 'Descrizione, prezzo e quantità pronti per il ricambio successivo');
    campo('ord_desc', 'candele'); campo('ord_qta', '2'); campo('ord_prezzo_cliente', '12'); addOrdine();
    campo('ord_desc', 'pastiglie post'); campo('ord_prezzo_cliente', '35'); addOrdine();
    const el = document.getElementById('ord-job-elenco').textContent;
    ok(/Ricambi per KT89000 \(3\)/.test(el) && el.includes('FILTRO OLIO') && el.includes('2× CANDELE') && el.includes('PASTIGLIE POST'), 'Sotto il modulo: elenco dei 3 ricambi inseriti per la moto');
    const ordJ = Object.values(fb.leggi('ordini') || {}).filter(o => String(o.jobId) === '1701');
    ok(ordJ.length === 3 && ordJ.every(o => o.fornitore === 'GIPA' && o.num_ordine === 'ORD-77' && o.data_consegna === oggi), 'Tre ordini, tutti con fornitore, n° ordine e consegna prevista');
    const r = recordDi('db', 1701);
    ok((r.conto || []).length === 3 && r.totale_lordo === 18 + 24 + 35, 'Nel conto 3 righe, totale 18 + 2×12 + 35 = 77 €');
    switchView('board'); await attendi(350);
    const card = [...document.querySelectorAll('#view-board .card-compact')].find(c => c.textContent.includes('KT89000'));
    ok(card && card.textContent.includes('Attesa ricambi (3)'), 'Bacheca: "Attesa ricambi (3)"');
    const primo = ordJ.find(o => o.desc === 'FILTRO OLIO');
    editOrdine(primo.id); campo('ord_note', 'originale'); addOrdine();
    ok(document.getElementById('ord-form-container').style.display === 'none', 'La modifica di un ordine esistente chiude il modulo come prima');
    switchView('board');
  });

  await passo('Svuotare il modulo ordine', async () => {
    const val = id => document.getElementById(id).value;
    const vuoto = () => ['ord_job', 'ord_desc', 'ord_fornitore', 'ord_num_ordine', 'ord_data_consegna', 'ord_cliente', 'ord_tel_cliente', 'ord_prezzo_cliente'].every(id => val(id) === '')
      && document.getElementById('ord-job-elenco').textContent.trim() === '' && document.getElementById('ord-job-info').textContent.trim() === '';
    const aperto = () => document.getElementById('ord-form-container').style.display !== 'none';
    ordinaRicambioPerJob(1701);
    campo('ord_fornitore', 'gipa'); campo('ord_desc', 'leva freno'); addOrdine();
    ok(aperto() && val('ord_job') === '1701' && document.getElementById('ord-job-elenco').textContent.includes('KT89000'), 'Dopo un ordine il modulo è ancora compilato sulla moto');
    toggleOrdForm();
    ok(!aperto() && document.getElementById('ord-form-toggle-btn').textContent.includes('Nuovo Ordine'), '"Chiudi Form" chiude il modulo');
    toggleOrdForm();
    ok(aperto() && vuoto(), 'Riaprendo con "Nuovo Ordine" il modulo è vuoto (prima restava compilato)');
    ordinaRicambioPerJob(1701); campo('ord_fornitore', 'gipa'); campo('ord_desc', 'specchio');
    svuotaModuloOrdine();
    ok(aperto() && vuoto(), 'Pulsante 🧹: svuota il modulo e lo lascia aperto');
    const n = nScr();
    svuotaModuloOrdine();
    ok(nScr() === n, 'Svuotare non salva e non cancella niente');
    const o = Object.values(fb.leggi('ordini') || {}).find(x => x.desc === 'LEVA FRENO');
    editOrdine(o.id);
    ok(document.getElementById('btn-svuota-ordine').classList.contains('hidden') && !document.getElementById('btn-cancel-ordine').classList.contains('hidden'), 'In modifica al posto di 🧹 c\'è ❌ (annulla modifica)');
    cancelEditOrdine();
    ok(!document.getElementById('btn-svuota-ordine').classList.contains('hidden') && !aperto(), 'Annullando la modifica torna 🧹 e il modulo si chiude');
    switchView('board');
  });

  await passo('Spostare in Lavori Lunghi dalla bacheca', async () => {
    const tra = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    fb.scritturaRemota({
      'db/-Nll1': { id: 1801, data: oggi, cognome: 'LUNGO', nome: 'ADA', targa: 'LL18010', marca: 'GUZZI', modello: 'V7', stato: 'doing', lavori_richiesti: 'RESTAURO', clientId: 'c-l1' },
      'db/-Nll2': { id: 1802, data: oggi, cognome: 'LUNGO', nome: 'BRUNO', targa: 'LL18020', marca: 'LAVERDA', modello: '750', stato: 'todo', lavori_richiesti: 'MOTORE', clientId: 'c-l2' },
      'db/-Nll3': { id: 1803, data: oggi, cognome: 'LUNGO', nome: 'CARLA', targa: 'LL18030', marca: 'BMW', modello: 'R80', stato: 'special', special_cat: 'incidentate', lavori_richiesti: 'SINISTRO', clientId: 'c-l3' },
      'db/-Nll4': { id: 1804, data: oggi, cognome: 'LUNGO', nome: 'DINO', targa: 'LL18040', marca: 'MV', modello: 'F3', stato: 'special', special_cat: 'incidentate', lavori_richiesti: 'CADUTA', clientId: 'c-l4' },
      'agenda/-Nll2': { id: 2802, tipo: 'officina', jobId: 1802, data: oggi, ora: '11:00', cliente: 'LUNGO BRUNO', moto: 'LAVERDA 750 - LL18020' }
    }, false);
    const st = id => { const j = db.find(x => String(x.id) === String(id)); return j.stato + '/' + (j.special_cat || '-'); };
    const inLunghi = t => { switchView('specials'); return document.getElementById('view-specials').textContent.includes(t); };
    // il caso che faceva "sparire" la moto: "Nuova Scheda" dalle Incidentate, poi altro, poi Modifica → Salva in Lavori Lunghi
    switchView('incidentate'); _pendingSpecialCat = 'incidentate'; switchView('nuova');
    switchView('board');
    editJob(1801); saveJob('special');
    ok(st(1801) === 'special/-' && inLunghi('LL18010'), 'Modifica scheda → "Salva in Lavori Lunghi" dopo "Nuova Scheda" delle Incidentate: va nei Lavori Lunghi (prima finiva tra le Incidentate)');
    switchView('board');
    moveStatus(1802, 'special');
    ok(st(1802) === 'special/-' && inLunghi('LL18020'), 'Menu ⋯ → Sposta in Lavori Lunghi: la moto compare nei Lavori Lunghi');
    ok(!Object.values(fb.nodo('agenda') || {}).some(a => String(a.jobId) === '1802'), 'Spostata dalla bacheca: tolta dall\'agenda come quando si sposta dall\'agenda');
    editJob(1803); saveJob('special');
    ok(st(1803) === 'special/-' && inLunghi('LL18030'), 'Incidentata → Modifica → "Salva in Lavori Lunghi": passa nei Lavori Lunghi');
    switchView('incidentate'); await attendi(50);
    ok(document.getElementById('view-incidentate').innerHTML.includes('spostaInLavoriLunghi(1804)'), 'Incidentate: voce "Sposta in Lavori Lunghi" nel menu ⋯');
    spostaInLavoriLunghi(1804);
    ok(st(1804) === 'special/-' && inLunghi('LL18040'), '"Sposta in Lavori Lunghi" dalle Incidentate funziona');
    switchView('incidentate'); _pendingSpecialCat = 'incidentate'; switchView('nuova');
    campo('f_cognome', 'NUOVA'); campo('f_nome', 'INCIDENTATA'); campo('f_targa', 'NI00001'); campo('f_data', oggi);
    saveJob('special');
    const ni = db.find(j => j.targa === 'NI00001');
    ok(ni && ni.stato === 'special' && ni.special_cat === 'incidentate', '"Nuova Scheda" dalle Incidentate salvata come Lavoro Lungo resta un\'incidentata');
    editJob(1804); _pendingSpecialCat = 'incidentate'; saveJob('special');
    ok(st(1804) === 'special/incidentate', '"Salva come Incidentata" funziona come prima');
    switchView('board');
  });

  await passo('Pulsanti delle righe dei preventivi', async () => {
    const prev = (id, cognome, extra) => Object.assign({ id, data: oggi, cognome, nome: 'TEST', tel: '3471110000', marca: 'HONDA', modello: 'SH 150', targa: 'PV' + id, stato: 'preventivo', era_preventivo: true, lavori_richiesti: 'Vedi voci preventivo', conto: [{ desc: 'CARENA', price: 200, qty: 1, iva: 22 }, { desc: 'FRECCIA', price: 60, qty: 2, iva: 22 }], totale_lordo: 260, clientId: 'c-' + id }, extra || {});
    fb.scritturaRemota({
      'db/-Npv1': prev(1901, 'AAPRIMO'), 'db/-Npv2': prev(1902, 'ABSECONDO'), 'db/-Npv3': prev(1903, 'ACTERZO'),
      'db/-Npv4': prev(1904, 'ADQUARTO', { stato: 'archived', data_accettazione: oggi })
    }, false);
    const aperti = [], stampe = [];
    const origOpen = window.open, origPrint = window.print;
    window.open = u => { aperti.push(String(u)); return null; };
    window.print = () => { stampe.push(1); };
    const err0 = window.__errori.length;
    try {
      switchView('preventivi'); setPrevTab('aperti'); await attendi(80);
      // il menu aperto non deve essere coperto dalle righe sotto
      const righe = [...document.querySelectorAll('#preventivi-results .prev-card-row')];
      const riga2 = righe.find(r => r.textContent.includes('ABSECONDO'));
      const btnAz = riga2.querySelector('.dropdown > button');
      toggleDropdown(btnAz); await attendi(30);
      const voci = [...riga2.querySelectorAll('.dropdown-content button')];
      const coperte = voci.filter(b => { const r = b.getBoundingClientRect(); if (r.bottom > window.innerHeight || r.top < 0) return false; const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(el && (el === b || b.contains(el))); }).map(b => b.textContent.trim());
      ok(voci.length >= 6 && coperte.length === 0, 'Menu Azioni aperto: tutte le voci cliccabili, nessuna coperta dalle righe sotto' + (coperte.length ? ' → coperte: ' + coperte.join(', ') : ''));
      toggleDropdown(btnAz);

      // ✅ Converti in Commessa
      accettaPreventivo(1901);
      ok(!document.getElementById('modal-accetta-prev').classList.contains('hidden') && document.getElementById('ap-summary').textContent.includes('AAPRIMO'), 'Converti in Commessa: si apre la finestra di conferma (prima si bloccava)');
      ok(document.getElementById('ap_lavori').value === 'CARENA / FRECCIA' && document.getElementById('ap_wa').checked, 'Finestra: lavori precompilati dalle voci, WhatsApp già spuntato');
      confermaAccettaPreventivo(); await attendi(50);
      let r = recordDi('db', 1901);
      ok(r.stato === 'todo' && r.data === oggi && r.data_accettazione === oggi && r.totale_lordo === 260, 'Conferma: diventa appuntamento di oggi, totale 260 € invariato');
      ok(r.conto[1].price === 30 && r.conto[1].qty === 2, 'Le voci passano al prezzo unitario (FRECCIA ×2: 60 € di riga → 30 € l\'una)');
      ok(Object.values(fb.nodo('agenda') || {}).some(a => String(a.jobId) === '1901'), 'Conferma: appuntamento creato in agenda');
      ok(aperti.some(u => u.includes('wa.me/')), 'Conferma: parte il WhatsApp di accettazione al cliente');
      ok(document.getElementById('modal-accetta-prev').classList.contains('hidden'), 'Conferma: la finestra si chiude');
      switchView('board'); await attendi(350);
      ok(document.getElementById('view-board').textContent.includes('PV1901'), 'La commessa compare in bacheca tra gli appuntamenti di oggi');

      // 📁 Archivia in Storico
      archiviaPreventivo(1902);
      ok(recordDi('db', 1902).stato === 'archived', 'Archivia in Storico: preventivo nello storico');
      // 📲 Invia WhatsApp
      aperti.length = 0; sendWhatsAppPreventivo(1903);
      ok(aperti.length === 1 && aperti[0].includes('wa.me/39') && decodeURIComponent(aperti[0]).includes('CARENA'), 'Invia WhatsApp: si apre WhatsApp con il preventivo');
      ok(decodeURIComponent(aperti[0]).includes('FRECCIA ×2: €60.00') && !decodeURIComponent(aperti[0]).includes('CARENA ×'), 'Invia WhatsApp: quantità accanto alla voce (solo se più di 1), prezzo della riga');
      // 🖨️ Stampa Preventivo
      printPreventivo(1903); await attendi(150);
      ok(stampe.length === 1 && document.getElementById('print-area').textContent.includes('ACTERZO') && document.getElementById('print-area').textContent.includes('260.00'), 'Stampa Preventivo: pagina di stampa con cliente e totale');
      {
        const tab = document.querySelector('#print-area table');
        const th = [...tab.querySelectorAll('thead th')].map(x => x.textContent.trim());
        const righe = [...tab.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
        ok(th[1] === 'Q.tà', 'Stampa Preventivo: colonna Q.tà dopo la descrizione');
        ok(righe[0][0] === 'CARENA' && righe[0][1] === '1' && righe[1][0] === 'FRECCIA' && righe[1][1] === '2' && righe[1][4] === '60.00 €', 'Stampa Preventivo: quantità di ogni voce (FRECCIA 2 pezzi, 60 € di riga)');
        const j = db.find(x => String(x.id) === '1903');
        j.conto.push({ desc: 'OLIO <b>5W40</b>', price: 18, qty: 1.5, iva: 22 }); j.cognome = 'ACTERZO <i>X</i>';
        printPreventivo(1903); await attendi(150);
        const pa = document.getElementById('print-area');
        ok(pa.textContent.includes('OLIO <b>5W40</b>') && pa.textContent.includes('ACTERZO <I>X</I>') && !pa.querySelector('table b, i'), 'Stampa Preventivo: descrizioni e nomi con < stampati come scritti');
        ok([...pa.querySelectorAll('tbody tr')].pop().children[1].textContent.trim() === '1,5', 'Stampa Preventivo: quantità con la virgola (1,5)');
        j.conto.pop(); j.cognome = 'ACTERZO';
      }
      // ✏️ Modifica
      openPreventivoForm(1903);
      ok(currentView === 'crea-prev' && document.getElementById('p_id').value === '1903', 'Modifica: si apre il preventivo');
      switchView('preventivi');

      // Storico
      setPrevTab('storico'); await attendi(50);
      const st = document.getElementById('preventivi-results').innerHTML;
      ok(st.includes('convertiStoricoInCommessa(1904)') && st.includes("openPreventivoForm(1904, true)"), 'Storico: pulsanti presenti');
      openPreventivoForm(1904, true); savePreventivo(false, false);
      ok(recordDi('db', 1904).stato === 'archived', 'Storico → Modifica Voci: salvando resta nello storico');
      convertiStoricoInCommessa(1904);
      ok(recordDi('db', 1904).stato === 'todo', 'Storico → Converti in Commessa: diventa commessa');
      // 🗑️ Elimina
      deleteJob(1903);
      ok(!recordDi('db', 1903), 'Elimina: preventivo eliminato');
      ok(window.__errori.length === err0, 'Nessun errore JavaScript usando i pulsanti' + (window.__errori.length > err0 ? ': ' + window.__errori.slice(err0).join(' | ') : ''));
    } finally { window.open = origOpen; window.print = origPrint; }
    setPrevTab('aperti');
    switchView('board');
  });

  await passo('Ordini ricambi: elenco a righe', async () => {
    fb.scritturaRemota({
      'db/-Nord1': { id: 2001, data: oggi, cognome: 'RIGHE', nome: 'UGO', tel: '3401010101', marca: 'HONDA', modello: 'TRANSALP', targa: 'RG20010', stato: 'doing', lavori_richiesti: 'FRENI', conto: [], totale_lordo: 0, clientId: 'c-righe' },
      'ordini': [
        { id: 9101, desc: 'LEVA FRENO', fornitore: 'LARSSON', qta: 1, stato: 'todo', data: '2026-06-04', cliente: 'RIGHE UGO', jobId: 2001, targa: 'RG20010', moto: 'HONDA TRANSALP', prezzo: 29.85, prezzo_cliente: 45.52 },
        { id: 9102, desc: 'KIT TRASMISSIONE', fornitore: 'LARSSON', qta: 2, sku: 'KT-1', stato: 'todo', data: oggi, cliente: 'BIANCHI', moto: 'BMW R 1200 RT' },
        { id: 9103, desc: 'CINGHIA', fornitore: 'PARTS EUROPE', qta: 1, stato: 'todo', data: oggi },
        { id: 9104, desc: 'INFO CENTRALINA', qta: 1, stato: 'todo', data: oggi },
        { id: 9105, desc: 'DUNLOP ROADSMART', fornitore: 'PARTS EUROPE', qta: 1, stato: 'doing', data: oggi, data_consegna: '2026-01-01' },
        { id: 9106, desc: 'INTERRUTTORE STOP', fornitore: 'LARSSON', qta: 1, stato: 'done', data: '2026-07-16', cliente: 'FARNISI', tel_cliente: '3355798871' },
        { id: 9107, desc: 'PASTIGLIE', fornitore: 'LARSSON', qta: 1, stato: 'done', data: oggi }
      ]
    }, false);
    switchView('ordini'); setOrdTab('todo'); await attendi(50);
    const tabs = () => document.getElementById('ord-tabs').textContent.replace(/\s+/g, ' ');
    const righe = () => [...document.querySelectorAll('#ord-lista .ord-riga')];
    const testo = () => document.getElementById('ord-lista').textContent;
    ok(/Da ordinare 4/.test(tabs()) && /Ordinati 1/.test(tabs()) && /Arrivati 2/.test(tabs()) && /Storico \d+/.test(tabs()), 'Schede con il numero di ricambi per stato (' + tabs() + ')');
    ok(document.querySelectorAll('#ord-lista .ord-riga button').length > 0 && [...document.querySelectorAll('#ord-lista .ord-riga button')].every(b => b.getBoundingClientRect().width < 200), 'Pulsanti della riga di misura normale (prima la freccia occupava tutta la riga)');
    const t = testo();
    ok(!t.includes('SENZA FORNITORE') && !t.includes('segna tutti ordinati') && righe()[0].textContent.includes('LEVA FRENO'), 'Da ordinare: elenco unico senza gruppi per fornitore, il più vecchio in alto');
    const rigaHtml = document.getElementById('ord-riga-9101').innerHTML;
    ok(rigaHtml.includes('<b style="color:white;">RIGHE UGO</b>') && rigaHtml.includes('<b style="color:#fbbf24;">HONDA TRANSALP</b>'), 'Nome del cliente e moto in grassetto e in risalto');
    ok(!document.getElementById('ord-riga-9101').textContent.includes('LARSSON'), 'Il fornitore non compare sulla riga');
    const rigaLeva = document.getElementById('ord-riga-9101');
    ok(rigaLeva && rigaLeva.getBoundingClientRect().height < 75, 'Riga corta: un ricambio su una sola riga (' + (rigaLeva && Math.round(rigaLeva.getBoundingClientRect().height)) + ' px)');
    const det = document.getElementById('ord-det-9101');
    ok(det && det.style.display === 'none' && rigaLeva.querySelectorAll('button').length === 1, 'Dettagli nascosti e un solo pulsante sulla riga');
    toggleDettaglioOrdine('9101');
    ok(det.style.display === 'grid' && det.textContent.includes('LARSSON') && det.innerHTML.includes('editOrdine(9101)') && det.innerHTML.includes('deleteOrdine(9101)') && det.textContent.includes('Copia elenco LARSSON'), 'Clic sulla riga: dettaglio con fornitore, pulsanti e "Copia elenco" del fornitore');
    refreshOrdini();
    ok(document.getElementById('ord-det-9101').style.display === 'grid', 'Il dettaglio aperto resta aperto quando la pagina si aggiorna');
    toggleDettaglioOrdine('9102');
    ok(document.getElementById('ord-det-9102').style.display === 'grid' && document.getElementById('ord-det-9101').style.display === 'none', 'Aprendo un altro ricambio, quello aperto prima si chiude');
    toggleDettaglioOrdine('9102');
    ok(document.getElementById('ord-det-9102').style.display === 'none', 'Ricliccando si richiude');
    ok(/acquisto € 29,85/.test(t) && /cliente € 45,52/.test(t), 'Prezzi con scritto "acquisto" e "cliente"');
    ok(/⏳ da \d+ mesi/.test(t), 'Ricambio da ordinare da mesi: segnalato');
    ok(righe().some(r => r.textContent.includes('RG20010') && r.textContent.includes('HONDA TRANSALP')), 'Riga con la moto collegata');
    let copiato = '';
    const origClip = navigator.clipboard;
    try {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: x => { copiato = x; return Promise.resolve(); } } });
      copiaElencoFornitore(safeEncode('LARSSON')); await attendi(20);
    } finally { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: origClip }); }
    ok(copiato.includes('LARSSON') && copiato.includes('• 1 × LEVA FRENO — per HONDA TRANSALP') && copiato.includes('• 2 × KIT TRASMISSIONE (cod. KT-1)') && !copiato.includes('CINGHIA') && !copiato.includes('RIGHE'), 'Copia elenco: solo i ricambi del fornitore, con codice e moto, senza nomi dei clienti');
    moveOrdine(9101, 'doing'); moveOrdine(9102, 'doing');
    const leggi = id => Object.values(fb.leggi('ordini') || {}).find(o => o.id === id);
    ok(leggi(9101).stato === 'doing' && leggi(9102).stato === 'doing' && leggi(9101).data_ordinato === oggi && leggi(9103).stato === 'todo', '✓ Ordinato: data dell\'ordine registrata, gli altri restano da ordinare');
    campo('ord-cerca', 'cinghia'); refreshOrdini();
    ok(righe().length === 1 && testo().includes('CINGHIA'), 'Ricerca: trova il ricambio');
    campo('ord-cerca', ''); setOrdTab('doing');
    ok(/in ritardo dal 01\/01\/2026/.test(testo()) && testo().indexOf('DUNLOP') < testo().indexOf('LEVA FRENO'), 'Ordinati: prima quelli in ritardo, con l\'avviso');
    moveOrdine(9101, 'done');
    ok(leggi(9101).data_arrivo === oggi, 'Arrivato: data di arrivo registrata');
    setOrdTab('done');
    ok(righe().some(r => r.textContent.includes('INTERRUTTORE STOP') && r.innerHTML.includes('waOrdineArrivato(9106)')), 'Arrivati: pulsante WhatsApp per avvisare il cliente');
    consegnaOrdine(9106);
    ok(leggi(9106).stato === 'consegnato' && leggi(9106).data_consegnato === oggi, 'Consegnato: va nello Storico con la data');
    let r = recordDi('db', 2001);
    ok(leggi(9101).stato === 'done', 'Leva freno arrivata, moto ancora sul ponte: resta tra gli Arrivati');
    switchView('board'); moveStatus(2001, 'done'); await attendi(50);
    ok(leggi(9101).stato === 'consegnato' && leggi(9101).consegnato_auto === true, 'Moto pronta: i suoi ricambi arrivati passano da soli nello Storico');
    switchView('ordini'); setOrdTab('consegnato');
    ok(testo().includes('LEVA FRENO') && /chiuso con la moto il/.test(testo()), 'Storico: indica i ricambi chiusi insieme alla moto');
    moveOrdine(9106, 'done');
    ok(leggi(9106).stato === 'done' && !leggi(9106).data_consegnato, '⬅️ dallo Storico: torna tra gli Arrivati');
    setOrdTab('done');
    segnaTuttiConsegnati();
    ok(Object.values(fb.leggi('ordini') || {}).filter(o => o.stato === 'done').length === 0, 'Segna tutti consegnati: Arrivati svuotato');
    ok(_badgeRicambi(2001, null).includes('Ricambi arrivati'), 'Ricambio consegnato conta come arrivato sulla scheda della moto');
    setOrdTab('todo');
    switchView('board');
  });

  await passo('Abbigliamento e caschi', async () => {
    fb.scritturaRemota({
      'magazzino/AGV-K1-L-NERO': { codice: 'AGV-K1-L-NERO', sku: 'AGV-K1', nome: 'CASCO AGV K1', marca: 'AGV', categoria: 'CASCHI', taglia: 'L', colore: 'NERO', giacenza: 3, prezzo: 120, prezzo_pubblico: 189, min_stock: 1 },
      'magazzino/GIU-01': { codice: 'GIU-01', nome: 'GIUBBOTTO DAINESE', marca: 'DAINESE', categoria: 'ABBIGLIAMENTO', taglia: '52', colore: 'NERO/ROSSO', giacenza: 0, prezzo: 200, prezzo_pubblico: 320, min_stock: 1 }
    }, false);
    switchView('magazzino'); await attendi(100);
    const righeCat = c => [...document.querySelectorAll('.mag-item-row[data-cat="' + c + '"]')];
    const thAbb = () => [...document.querySelectorAll('.mag-col-abb')];
    const variante = (t, c) => Object.values(fb.nodo('magazzino')).find(x => x.sku === 'AGV-K1' && x.taglia === t && x.colore === c);
    const nCaschi = () => Object.values(fb.nodo('magazzino')).filter(x => x.categoria === 'CASCHI').length;
    ok(document.getElementById('mag-rep-ricambi') && document.getElementById('mag-rep-abbigliamento') && document.getElementById('mag-rep-abbigliamento').textContent.includes('2'), 'Magazzino: schede "Ricambi" e "Abbigliamento e Caschi" (2 articoli)');
    ok(righeCat('CASCHI').length === 0 && righeCat('ABBIGLIAMENTO').length === 0 && righeCat('LUBRIFICANTI').length > 0, 'Scheda Ricambi: niente caschi né abbigliamento');
    ok(thAbb().length === 2 && thAbb().every(th => th.style.display === 'none'), 'Scheda Ricambi: colonne Taglia e Colore nascoste');
    setMagReparto('abbigliamento'); await attendi(50);
    ok(righeCat('LUBRIFICANTI').length === 0 && righeCat('CASCHI').length === 1 && righeCat('ABBIGLIAMENTO').length === 1, 'Scheda Abbigliamento e Caschi: solo i suoi articoli');
    ok(thAbb().every(th => th.style.display === '') && righeCat('CASCHI')[0].style.display !== 'none', 'Scheda Abbigliamento: colonne Taglia e Colore visibili, categorie aperte');
    const rAgv = righeCat('CASCHI')[0];
    ok(rAgv && rAgv.querySelector('.mag-in-sku').value === 'AGV-K1' && rAgv.querySelector('.mag-in-taglia').value === 'L' && rAgv.querySelector('.mag-in-colore').value === 'NERO', 'Riga del casco: SKU del modello AGV-K1 (non la chiave interna), taglia L, colore NERO');
    ok(righeCat('ABBIGLIAMENTO')[0].querySelector('.mag-in-sku').value === 'GIU-01', 'Articolo inserito prima (senza SKU separato): si vede il suo codice');
    const riep = document.getElementById('mag-summary-container').textContent;
    ok(/Articoli a Magazzino\s*2/.test(riep) && /Da Riordinare\s*1/.test(riep), 'Riepilogo della scheda: 2 articoli, 1 da riordinare (giubbotto esaurito)');

    // Stesso SKU per tutte le taglie e i colori del modello
    toggleMagForm();
    const vis = () => [...document.querySelectorAll('#mag-new-item-form .mag-campo-abb')].every(d => d.style.display === '');
    ok(vis() && document.getElementById('mag-new-abb-nota').style.display === 'flex', 'Modulo aperto dalla scheda Abbigliamento: campi Taglia e Colore visibili');
    campo('mag-new-categoria', 'MOTORE'); _aggiornaCampiAbbForm();
    ok(!vis(), 'Modulo: con una categoria di ricambi Taglia e Colore spariscono');
    campo('mag-new-categoria', 'CASCHI'); _aggiornaCampiAbbForm();
    const cod = document.getElementById('mag-new-codice'), tg = document.getElementById('mag-new-taglia'), col = document.getElementById('mag-new-colore');
    const avviso = () => document.getElementById('mag-btn-add-submit').disabled && (document.getElementById('mag-sku-warning').style.display === 'block' || document.getElementById('mag-new-abb-doppione').style.display === '');
    cod.value = 'agv-k1'; cod.dispatchEvent(new Event('input'));
    campo('mag-new-nome', 'casco agv k1'); campo('mag-new-marca', 'agv');
    tg.value = 'm'; tg.dispatchEvent(new Event('input'));
    col.value = 'nero'; col.dispatchEvent(new Event('input'));
    campo('mag-new-giacenza', '2'); campo('mag-new-prezzo', '120'); campo('mag-new-prezzo-pubblico', '189');
    ok(!avviso(), 'Stesso SKU di un casco già presente ma taglia diversa: nessun "Già presente"');
    const form = document.getElementById('mag-new-item-form');
    await form.onsubmit({ preventDefault() {} });
    const m = variante('M', 'NERO');
    ok(m && m.codice !== 'AGV-K1' && m.categoria === 'CASCHI' && m.giacenza === 2 && m.nome === 'CASCO AGV K1' && fb.leggi('magazzino/AGV-K1-L-NERO').giacenza === 3, 'Taglia M salvata con lo SKU AGV-K1, accanto alla L (chiave interna ' + (m && m.codice) + ')');
    ok(cod.value === 'agv-k1' && document.getElementById('mag-new-nome').value === 'casco agv k1' && col.value === 'nero' && tg.value === '' && document.getElementById('mag-new-giacenza').value === '1', 'Dopo "Aggiungi": SKU, nome e colore restano, vuote taglia e quantità');
    tg.value = 'xl'; tg.dispatchEvent(new Event('input'));
    await form.onsubmit({ preventDefault() {} });
    const xl = variante('XL', 'NERO');
    ok(xl && xl.prezzo_pubblico === 189 && xl.giacenza === 1 && xl.codice !== m.codice, 'Taglia XL salvata con lo stesso SKU e gli stessi prezzi');
    tg.value = 'l'; tg.dispatchEvent(new Event('input'));
    ok(avviso() && document.getElementById('mag-new-abb-doppione').style.display === '' && document.getElementById('mag-sku-warning').style.display === 'none' && tg.style.borderColor !== '', 'Stesso SKU, taglia L e colore NERO già presenti: avviso nella barra, campi in rosso, Aggiungi bloccato');
    const prima = nCaschi();
    await form.onsubmit({ preventDefault() {} });
    ok(nCaschi() === prima, 'Doppione: non viene salvato');
    col.value = 'bianco'; col.dispatchEvent(new Event('input'));
    ok(!avviso(), 'Stessa taglia L ma colore BIANCO: si può aggiungere');
    await form.onsubmit({ preventDefault() {} });
    ok(variante('L', 'BIANCO') && variante('L', 'NERO') && nCaschi() === prima + 1, 'Taglia L in due colori, stesso SKU');
    toggleMagForm();
    ok(document.getElementById('mag-form-wrapper').style.display === 'none' && document.getElementById('mag-new-nome').value === '' && cod.value === '' && !avviso(), 'Chiudendo la finestra il modulo si svuota');
    toggleMagForm();
    cod.value = 'AGV-K1'; _datiModelloMag();
    ok(document.getElementById('mag-new-categoria').value === 'CASCHI' && document.getElementById('mag-new-nome').value === 'CASCO AGV K1' && document.getElementById('mag-new-prezzo-pubblico').value === '189' && col.value === '', 'SKU di un modello già in magazzino: categoria, nome e prezzi compilati da soli (colore no)');
    svuotaModuloMag(); toggleMagForm();
    await attendi(50);
    const ordine = righeCat('CASCHI').map(r => r.querySelector('.mag-in-sku').value + ' ' + r.querySelector('.mag-in-taglia').value + ' ' + r.querySelector('.mag-in-colore').value);
    ok(uguali(ordine, ['AGV-K1 L BIANCO', 'AGV-K1 M NERO', 'AGV-K1 L NERO', 'AGV-K1 XL NERO']), 'Caschi raggruppati per colore e in ordine di taglia, tutti con SKU AGV-K1 (' + ordine + ')');
    ok(document.getElementById('mag-rep-abbigliamento').textContent.includes('5'), 'Scheda Abbigliamento: ora 5 articoli');

    // Ricambio aggiunto mentre si è nella scheda Abbigliamento → si torna su Ricambi e il modulo si svuota
    toggleMagForm();
    campo('mag-new-categoria', 'FRENI'); _aggiornaCampiAbbForm();
    campo('mag-new-codice', 'DIS-01'); campo('mag-new-nome', 'disco freno'); campo('mag-new-giacenza', '1');
    await form.onsubmit({ preventDefault() {} });
    const dis = fb.leggi('magazzino/DIS-01');
    ok(dis && dis.taglia === undefined && dis.sku === undefined && magReparto === 'ricambi' && document.getElementById('mag-new-nome').value === '', 'Ricambio: salvato col suo SKU come prima, senza taglia/colore; si passa alla scheda Ricambi');
    campo('mag-new-categoria', 'FRENI'); _aggiornaCampiAbbForm();
    cod.value = 'DIS-01'; cod.dispatchEvent(new Event('input'));
    ok(avviso() && document.getElementById('mag-sku-warning').style.display === 'block' && document.getElementById('mag-sku-warning').textContent.includes('Già presente'), 'Ricambi: lo SKU resta unico ("Già presente")');
    svuotaModuloMag(true); toggleMagForm();

    // Modifica dalla tabella
    modificaArticoloMag(xl.codice, 'colore', 'bianco'); await attendi(700);
    ok(fb.leggi('magazzino/' + xl.codice).colore === 'BIANCO', 'Colore modificato dalla tabella (BIANCO), la chiave interna non cambia');
    const kLb = variante('L', 'BIANCO').codice;
    modificaArticoloMag(kLb, 'colore', 'nero');
    ok(/già un altro/.test((document.querySelector('.toast-msg') || {}).textContent || ''), 'Dalla tabella: stessa taglia e colore di un altro articolo → avviso doppione');
    modificaArticoloMag(kLb, 'colore', 'bianco'); await attendi(700);
    modificaArticoloMag('GIU-01', 'sku', 'gdai-ss'); await attendi(700);
    ok(fb.leggi('magazzino/GIU-01').sku === 'GDAI-SS' && fb.leggi('magazzino/GIU-01').giacenza === 0, 'SKU modificabile dalla tabella senza spostare l\'articolo');

    // Ricerca dalla scheda sbagliata
    setMagReparto('ricambi');
    campo('mag-search-input', 'AGV'); renderTableMag();
    const vuota = document.getElementById('mag-inventory-table');
    const btnAltro = vuota.querySelector('button');
    ok(vuota.textContent.includes('Trovati 4 in') && btnAltro, 'Ricerca "AGV" nei Ricambi: indica i 4 caschi nell\'altra scheda');
    if (btnAltro) btnAltro.click();
    ok(magReparto === 'abbigliamento' && righeCat('CASCHI').length === 4, 'Clic: si apre la scheda Abbigliamento con i 4 caschi');
    campo('mag-search-input', ''); renderTableMag();

    // Conto: ricerca articolo con taglia e colore
    const t = document.createElement('table'); const tr = t.insertRow(); const td = tr.insertCell();
    td.innerHTML = '<div><input class="r-desc"></div><div class="mag-conto-results"></div>';
    const inp = td.querySelector('.r-desc'); inp.value = 'CASCO AGV';
    cercaMagPerConto(inp);
    const voce = [...td.querySelector('.mag-conto-results').children].find(d => d.textContent.includes('TG. M · NERO'));
    ok(voce && voce.textContent.includes('AGV-K1') && voce.getAttribute('onmousedown').includes('CASCO AGV K1 (TG. M, NERO)') && voce.getAttribute('onmousedown').includes("'" + m.codice + "'"), 'Conto: casco con SKU e taglia; descrizione "CASCO AGV K1 (TG. M, NERO)", scarico sulla taglia giusta');
    ok(_skuDaChiaveMag(m.codice) === 'AGV-K1', 'Conto: l\'etichetta del magazzino mostra lo SKU AGV-K1');

    // Riordino e lista da ordinare
    apriRiordino();
    const rg = [...document.querySelectorAll('#riordino-lista tbody tr')];
    rg.forEach(r => { r.querySelector('.riordino-chk').checked = r.textContent.includes('GDAI-SS') || r.textContent.includes('TG. XL'); });
    const rGiu = rg.find(r => r.textContent.includes('GDAI-SS'));
    ok(rGiu && rGiu.textContent.includes('TG. 52 · NERO/ROSSO') && rg.some(r => r.textContent.includes('AGV-K1') && r.textContent.includes('TG. XL')), 'Riordino: giubbotto e casco XL con SKU, taglia e colore');
    confermaRiordino();
    const lo = () => Object.values(fb.leggi('lista_ordini') || {});
    const giuLo = () => lo().find(x => x.codice === 'GDAI-SS');
    const xlLo = lo().find(x => x.codice === 'AGV-K1' && x.taglia === 'XL');
    ok(giuLo() && giuLo().taglia === '52' && giuLo().colore === 'NERO/ROSSO' && xlLo && xlLo.colore === 'BIANCO', 'Lista da ordinare: SKU del modello con taglia e colore');
    ok(document.getElementById('lo-list').textContent.includes('TG. 52 · NERO/ROSSO'), 'Lista da ordinare: taglia e colore visibili sulla riga');
    apriRiordino();
    ok(/AGV-K1 TG\. XL · BIANCO/.test(document.getElementById('riordino-gia').textContent) && ![...document.querySelectorAll('#riordino-lista tbody tr')].some(r => r.textContent.includes('TG. XL')), 'Riordino: il casco XL già in lista non viene riproposto, la L sì');
    closeModal('modal-riordino');
    if (xlLo) await spostaInMagazzino(xlLo.id);
    ok(fb.leggi('magazzino/' + xl.codice).giacenza === 2 && nCaschi() === prima + 1, 'Arrivo del casco XL: carico sulla sua taglia (2 pezzi), nessun articolo nuovo');
    editListaOrdine(giuLo().id);
    ok(document.getElementById('lo-taglia').value === '52' && [...document.querySelectorAll('#lo-form .lo-campo-abb')].every(d => d.style.display === ''), 'Modifica riga della lista: taglia e colore nel modulo');
    campo('lo-colore', 'nero');
    document.getElementById('lo-form').onsubmit({ preventDefault() {} });
    ok(giuLo().colore === 'NERO' && giuLo().taglia === '52' && giuLo().prezzo_pubblico === 320, 'Riga modificata: colore NERO, taglia e prezzo al pubblico conservati');
    ok([...document.querySelectorAll('#lo-form .lo-campo-abb')].every(d => d.style.display === 'none'), 'Dopo il salvataggio il modulo della lista torna senza taglia e colore');
    const guanti = () => Object.values(fb.nodo('magazzino')).filter(x => x.sku === 'GUA-01');
    for (const q of ['2', '1']) {
      campo('lo-categoria', 'ABBIGLIAMENTO'); _aggiornaCampiAbbLo();
      campo('lo-codice', 'GUA-01'); campo('lo-nome', 'guanti'); campo('lo-taglia', '9'); campo('lo-colore', 'nero'); campo('lo-giacenza', q);
      document.getElementById('lo-form').onsubmit({ preventDefault() {} });
      const gua = lo().find(x => x.codice === 'GUA-01');
      ok(gua && gua.taglia === '9' && gua.colore === 'NERO', 'Lista da ordinare: guanti GUA-01 inseriti a mano con taglia 9 (×' + q + ')');
      if (gua) await spostaInMagazzino(gua.id);
    }
    ok(guanti().length === 1 && guanti()[0].taglia === '9' && guanti()[0].colore === 'NERO' && guanti()[0].categoria === 'ABBIGLIAMENTO' && guanti()[0].giacenza === 3, 'Arrivo merce: i guanti entrano con SKU, taglia e colore; il secondo arrivo si somma (3 pezzi)');

    // Excel
    const origURL = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
    let blob = null;
    URL.createObjectURL = b => { blob = b; return 'about:blank'; };
    HTMLAnchorElement.prototype.click = function () {};
    try { esportaExcelMag(); } finally { URL.createObjectURL = origURL; HTMLAnchorElement.prototype.click = origClick; }
    const csv = blob ? await blob.text() : '';
    ok(csv.includes('CATEGORIA;TAGLIA;COLORE;STOCK') && csv.includes('\nAGV-K1;CASCO AGV K1;AGV;CASCHI;M;NERO;2;') && csv.includes('OLIO-01;OLIO 10W40;MOTUL;LUBRIFICANTI;;;'), 'Excel: SKU del modello, colonne Taglia e Colore (vuote per i ricambi)');

    // Cambio categoria: l'articolo passa all'altra scheda
    const kGua = guanti()[0].codice;
    modificaArticoloMag(kGua, 'categoria', 'ACCESSORI'); renderTableMag();
    ok(/spostato in "Ricambi"/.test((document.querySelector('.toast-msg') || {}).textContent || '') && righeCat('ACCESSORI').length === 0, 'Categoria cambiata in Accessori: avviso e articolo passato nei Ricambi');
    await attendi(700);
    fb.scritturaRemota({
      'magazzino/COL-1': { codice: 'COL-1', sku: 'GH9069', nome: 'G21 SUNVISOR', marca: 'GARI', categoria: 'CASCHI', taglia: 'XL', colore: 'BIANCO PERLATO', giacenza: 2, prezzo: 37.17, prezzo_pubblico: 75 },
      'magazzino/COL-2': { codice: 'COL-2', sku: 'GH9069', nome: 'G21 SUNVISOR', marca: 'GARI', categoria: 'CASCHI', taglia: 'M', colore: 'NERO OPACO/ROSSO FLUO', giacenza: 2, prezzo: 37.17, prezzo_pubblico: 75 }
    }, false);
    setMagReparto('abbigliamento'); renderTableMag(); await attendi(50);
    const colori = [...document.querySelectorAll('.mag-in-colore')];
    const tagliati = colori.filter(i => i.scrollWidth > i.clientWidth + 1).map(i => i.value + ' (' + i.scrollWidth + '/' + i.clientWidth + ')');
    ok(colori.some(i => i.value === 'NERO OPACO/ROSSO FLUO') && tagliati.length === 0, 'Colonna Colore: nessun colore tagliato, anche "BIANCO PERLATO" e "NERO OPACO/ROSSO FLUO"' + (tagliati.length ? ' → ' + tagliati.join(', ') : ''));
    const cnv = document.createElement('canvas').getContext('2d');
    const catTagliate = () => [...document.querySelectorAll('#mag-inventory-table select')].filter(x => x.offsetParent).filter(x => {
      const cs = getComputedStyle(x); cnv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      return cnv.measureText(x.options[x.selectedIndex].text).width > x.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    }).map(x => x.options[x.selectedIndex].text + ' (' + x.clientWidth + ')');
    inventarioMag.forEach(i => categorieAperteMag.add(i.categoria)); renderTableMag();
    const ctA = catTagliate();
    ok(document.querySelectorAll('#mag-inventory-table select').length > 0 && ctA.length === 0, 'Scheda Abbigliamento: categoria "ABBIGLIAMENTO" non tagliata' + (ctA.length ? ' → ' + ctA.join(', ') : ''));
    setMagReparto('ricambi'); renderTableMag();
    const ctR = catTagliate();
    ok([...document.querySelectorAll('#mag-inventory-table select')].some(x => x.value === 'ARIA E CARBURANTE') && ctR.length === 0, 'Scheda Ricambi: categorie non tagliate, anche "ARIA E CARBURANTE"' + (ctR.length ? ' → ' + ctR.join(', ') : ''));
    setMagReparto('abbigliamento');
    toggleMagForm(); campo('mag-new-categoria', 'CASCHI'); _aggiornaCampiAbbForm();
    const cf = document.getElementById('mag-new-colore'); cf.value = 'BIANCO PERLATO';
    ok(cf.scrollWidth <= cf.clientWidth + 1, 'Modulo: il campo Colore contiene "BIANCO PERLATO" senza tagliarlo (' + cf.scrollWidth + '/' + cf.clientWidth + ')');
    svuotaModuloMag(true); toggleMagForm();
    fb.scritturaRemota({ 'magazzino/COL-1': null, 'magazzino/COL-2': null }, false);
    const regole = [...document.styleSheets].flatMap(f => { try { return [...f.cssRules]; } catch (e) { return []; } }).flatMap(r => r.cssRules ? [...r.cssRules] : [r]);
    const regMob = regole.find(r => r.selectorText === '#mag-mobile-container');
    ok(regMob && regMob.style.getPropertyPriority('display') === 'important', 'Telefono: l\'elenco del magazzino non resta nascosto sotto "Inventario"');
    setMagReparto('ricambi');
    switchView('board');
  });

  await passo('Ordini futuri abbigliamento', async () => {
    switchView('magazzino'); setMagReparto('ricambi'); await attendi(50);
    const btn = document.getElementById('mag-btn-ordini-abb'), card = document.getElementById('oa-card');
    ok(btn.style.display === 'none', 'Ordini futuri: pulsante nascosto nella scheda Ricambi');
    setMagReparto('abbigliamento');
    ok(btn.style.display === 'flex', 'Ordini futuri: pulsante visibile nella scheda Abbigliamento e Caschi');
    toggleOrdiniAbb();
    ok(card.style.display === 'block' && /Nessun ordine in arrivo/.test(card.textContent), 'Riquadro aperto, nessun ordine');
    const oa = () => Object.values(fb.leggi('ordini_abb') || {}).map(o => ({ ...o, righe: Object.values(o.righe || {}) }));
    const mag = () => Object.values(fb.nodo('magazzino'));
    const agvM = mag().find(x => x.sku === 'AGV-K1' && x.taglia === 'M' && x.colore === 'NERO');
    const agvPrima = agvM ? agvM.giacenza : null;
    const nMag = mag().length;

    apriOrdineAbb();
    ok(!document.getElementById('modal-ordine-abb').classList.contains('hidden') && document.getElementById('oa-data').value === oggi && document.querySelectorAll('#oa-griglia .oa-q').length === 8, 'Nuovo ordine: finestra aperta, data di oggi, griglia XS…4XL');
    campo('oa-fornitore', 'gari'); campo('oa-prevista', '2099-11-20'); campo('oa-note', 'stagione estiva');
    campo('oa-sku', 'gh9069'); campo('oa-nome', 'g21 sunvisor'); campo('oa-marca', 'gari'); campo('oa-categoria', 'CASCHI'); campo('oa-colore', 'nero opaco'); campo('oa-prezzo', '37.17'); campo('oa-prezzo-pubblico', '75');
    const q = (t, n) => { const i = document.querySelector('#oa-griglia .oa-q[data-taglia="' + t + '"]'); i.value = n; i.dispatchEvent(new Event('input')); };
    q('S', 2); q('M', 3); q('L', 3); q('XL', 2);
    ok(document.getElementById('oa-tot-pz').textContent === '10 pz', 'Griglia: totale 10 pezzi');
    ok(aggiungiRigheOrdineAbb() && _oaEdit.righe.length === 4, 'Aggiungi all\'ordine: una riga per taglia (4)');
    ok(document.getElementById('oa-sku').value === 'gh9069' && document.getElementById('oa-colore').value === '' && document.getElementById('oa-tot-pz').textContent === '0 pz', 'Dopo l\'aggiunta: modello e prezzi restano, colore e pezzi si svuotano');
    campo('oa-colore', 'bianco perlato'); q('M', 1); q('L', 1); aggiungiRigheOrdineAbb();
    campo('oa-colore', 'bianco perlato'); q('M', 1); aggiungiRigheOrdineAbb();
    const mB = _oaEdit.righe.find(r => r.colore === 'BIANCO PERLATO' && r.taglia === 'M');
    ok(_oaEdit.righe.length === 6 && mB && mB.qta === 2, 'Stessa taglia e colore aggiunti due volte: pezzi sommati (M bianco ×2)');
    const lB = _oaEdit.righe.find(r => r.colore === 'BIANCO PERLATO' && r.taglia === 'L');
    togliRigaOrdineAbb(lB.id);
    ok(_oaEdit.righe.length === 5 && /BIANCO PERLATO/.test(document.getElementById('oa-righe').textContent), 'Taglia tolta dall\'ordine con ✕');
    svuotaRigaOrdineAbb(true);
    campo('oa-sku', 'agv-k1'); _datiModelloOa();
    ok(document.getElementById('oa-nome').value === 'CASCO AGV K1' && document.getElementById('oa-categoria').value === 'CASCHI' && document.getElementById('oa-prezzo-pubblico').value === '189', 'SKU già in magazzino: nome, categoria e prezzi compilati da soli');
    campo('oa-colore', 'nero'); q('M', 2);
    const n0 = nScr();
    salvaOrdineAbb();
    const o1 = oa()[0];
    ok(oa().length === 1 && o1.fornitore === 'GARI' && o1.stato === 'aperto' && o1.righe.length === 6 && o1.data_prevista === '2099-11-20' && o1.note === 'stagione estiva', 'Salva ordine: GARI con 6 righe (il casco AGV aggiunto da solo anche senza premere "Aggiungi")');
    ok(uguali(chiaviDa(n0), ['ordini_abb']) && mag().length === nMag, 'Salvataggio: scritto solo l\'ordine, magazzino non toccato');
    ok(document.getElementById('modal-ordine-abb').classList.contains('hidden') && /14 pz in arrivo/.test(card.textContent) && document.getElementById('oa-badge').textContent === '1', 'Riquadro: ordine GARI con 14 pezzi in arrivo, 1 ordine sul pulsante');
    ok(card.textContent.includes('arrivo previsto 20/11/2099') && !card.textContent.includes('doveva arrivare'), 'Data di arrivo prevista mostrata');

    // Arrivo parziale: solo la S nera
    const rS = o1.righe.find(r => r.sku === 'GH9069' && r.taglia === 'S');
    const chip = [...card.querySelectorAll('.oa-chip')].find(b => b.getAttribute('onclick').includes("'" + rS.id + "'"));
    ok(chip && /S ×2/.test(chip.textContent), 'Ogni taglia è un pulsante (S ×2)');
    const n1 = nScr();
    await arrivoRigheAbb(o1.id, String(rS.id));
    const s1 = mag().find(x => x.sku === 'GH9069' && x.taglia === 'S' && x.colore === 'NERO OPACO');
    ok(s1 && s1.giacenza === 2 && s1.categoria === 'CASCHI' && s1.prezzo === 37.17 && s1.prezzo_pubblico === 75 && s1.nome === 'G21 SUNVISOR', 'Arrivo della sola S: in magazzino 2 pezzi con SKU, taglia, colore e prezzi');
    ok(fb.scritture.length === n1 + 1 && oa()[0].stato === 'aperto' && oa()[0].righe.find(r => String(r.id) === String(rS.id)).arrivata === true, 'Un solo salvataggio (magazzino + ordine); ordine ancora aperto, S segnata come arrivata');
    ok(/12 pz in arrivo/.test(card.textContent) && /✓ S ×2/.test(card.textContent), 'Riquadro: S con la spunta verde, 12 pezzi ancora in arrivo');

    // Arrivato tutto
    await arrivoTuttoAbb(o1.id);
    const gh = mag().filter(x => x.sku === 'GH9069');
    ok(gh.length === 5 && gh.find(x => x.taglia === 'M' && x.colore === 'BIANCO PERLATO').giacenza === 2, 'Arrivato tutto: 5 varianti GH9069 in magazzino (M bianco ×2)');
    const agvDopo = mag().find(x => x.sku === 'AGV-K1' && x.taglia === 'M' && x.colore === 'NERO');
    ok(agvPrima !== null && agvDopo.giacenza === agvPrima + 2 && mag().filter(x => x.sku === 'AGV-K1' && x.taglia === 'M' && x.colore === 'NERO').length === 1, 'Casco AGV M nero già in magazzino: pezzi sommati (' + agvPrima + ' → ' + (agvDopo && agvDopo.giacenza) + '), nessun doppione');
    ok(oa()[0].stato === 'arrivato' && oa()[0].data_arrivo === oggi && document.getElementById('oa-badge').style.display === 'none', 'Ordine completato: passa negli arrivati, pulsante senza numero');
    ok(/Nessun ordine in arrivo/.test(card.textContent) && /Ordini arrivati \(1\)/.test(card.textContent), 'Riquadro: nessun ordine aperto, "Ordini arrivati (1)"');
    setMagReparto('abbigliamento'); renderTableMag();
    ok([...document.querySelectorAll('.mag-item-row[data-cat="CASCHI"] .mag-in-sku')].filter(i => i.value === 'GH9069').length === 5, 'Tabella Abbigliamento: i 5 visiere GH9069 compaiono con il loro SKU');

    // Ordine in ritardo, taglie numeriche, altra taglia, modifica ed eliminazione
    apriOrdineAbb();
    campo('oa-fornitore', 'dainese'); campo('oa-prevista', '2020-01-10');
    campo('oa-sku', 'gia-01'); campo('oa-nome', 'giacca super speed'); campo('oa-categoria', 'ABBIGLIAMENTO'); campo('oa-colore', 'nero');
    cambiaSetTaglieAbb('giacche');
    ok(document.querySelectorAll('#oa-griglia .oa-q').length === 9 && document.querySelector('#oa-griglia .oa-q[data-taglia="52"]'), 'Taglie giacche: 44…60');
    q('52', 1); campo('oa-altra-taglia', '62'); campo('oa-altra-qta', '1');
    salvaOrdineAbb();
    const o2 = oa().find(o => o.fornitore === 'DAINESE');
    ok(o2 && o2.righe.length === 2 && o2.righe.some(r => r.taglia === '62'), 'Taglia fuori griglia (62) aggiunta con "Altra taglia"');
    const blocco = [...card.querySelectorAll('.oa-ordine')].find(b => b.textContent.includes('DAINESE'));
    ok(blocco && /doveva arrivare il 10\/01\/2020/.test(blocco.textContent), 'Ordine in ritardo: "doveva arrivare il 10/01/2020"');
    apriOrdineAbb(o2.id);
    ok(_oaEdit.righe.length === 2 && document.getElementById('oa-fornitore').value === 'DAINESE', 'Modifica: l\'ordine si riapre con le sue righe');
    togliRigaOrdineAbb(_oaEdit.righe.find(r => r.taglia === '62').id);
    closeModal('modal-ordine-abb');
    ok(oa().find(o => o.fornitore === 'DAINESE').righe.length === 2, 'Annulla: le modifiche non salvate si perdono');
    apriOrdineAbb(o2.id);
    togliRigaOrdineAbb(_oaEdit.righe.find(r => r.taglia === '62').id);
    salvaOrdineAbb();
    ok(oa().find(o => o.fornitore === 'DAINESE').righe.length === 1 && oa().length === 2, 'Modifica salvata: resta solo la 52');
    apriOrdineAbb(); campo('oa-fornitore', '');
    salvaOrdineAbb();
    ok(oa().length === 2 && !document.getElementById('modal-ordine-abb').classList.contains('hidden'), 'Senza fornitore non si salva');
    campo('oa-fornitore', 'x'); salvaOrdineAbb();
    ok(oa().length === 2, 'Senza modelli non si salva');
    closeModal('modal-ordine-abb');
    eliminaOrdineAbb(o2.id);
    ok(oa().length === 1 && !card.textContent.includes('DAINESE') && mag().every(x => x.sku !== 'GIA-01'), 'Ordine eliminato: il magazzino non cambia');

    fb.scritturaRemota({ 'ordini_abb': [{ id: 77, fornitore: '<img src=x onerror="window.__xssOa=1">', data_ordine: oggi, stato: 'aperto', righe: [{ id: 78, sku: 'X1', nome: '<b>Y</b>', colore: '', taglia: 'M', qta: 1, arrivata: false }] }] }, false);
    await attendi(50);
    ok(!window.__xssOa && card.textContent.includes('<b>Y</b>'), 'Testi dell\'ordine mostrati come testo (nessun codice eseguito)');
    setMagReparto('ricambi');
    ok(card.style.display === 'none' && btn.style.display === 'none', 'Scheda Ricambi: riquadro e pulsante Ordini futuri nascosti');
    switchView('board');
  });

  await passo('Incasso settimanale', async () => {
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const lun = new Date(); lun.setHours(0, 0, 0, 0); lun.setDate(lun.getDate() - (lun.getDay() + 6) % 7);
    const g = n => { const x = new Date(lun); x.setDate(x.getDate() + n); return iso(x); };
    const ita = d => d.split('-').reverse().join('/');
    fb.scritturaRemota({
      'db/k901': { id: 901, cognome: 'SETTIMANA', nome: 'PRIMA', stato: 'archived', data: g(-12), data_chiusura: g(-5), totale_lordo: 100 },
      'db/k902': { id: 902, cognome: 'SETTIMANA', nome: 'QUESTA', stato: 'done', data: g(-1), data_chiusura: g(0), totale_lordo: 250 },
      'db/k903': { id: 903, cognome: 'SETTIMANA', nome: 'APERTA', stato: 'doing', data: g(0), data_chiusura: g(0), totale_lordo: 999 }
    }, false);
    const somma = (da, a) => { const jj = db.filter(j => ['done', 'archived'].includes(j.stato)).filter(j => { const d = j.data_chiusura || j.data; return d && d >= da && d <= a; }); return { tot: jj.reduce((s, j) => s + (parseFloat(j.totale_lordo) || 0), 0), n: jj.length }; };
    switchView('stats'); await attendi(50);
    const qs = somma(g(0), g(6)), pr = somma(g(-7), g(-1));
    const txt = id => document.getElementById(id).textContent;
    ok(qs.tot >= 250 && txt('stat-sett-lordo') === qs.tot.toFixed(2) + ' €', 'Incasso settimana in corso: ' + txt('stat-sett-lordo') + ' (atteso ' + qs.tot.toFixed(2) + ' €, la moto ancora sul ponte non conta)');
    ok(txt('stat-sett-periodo') === ita(g(0)).slice(0, 5) + ' – ' + ita(g(6)) + ' (in corso)', 'Periodo da lunedì a domenica: ' + txt('stat-sett-periodo'));
    ok(txt('stat-sett-count').startsWith(qs.n + ' lavor') && txt('stat-sett-count').includes(pr.tot.toFixed(2) + ' €'), 'Lavori chiusi e confronto con la settimana prima: ' + txt('stat-sett-count'));
    const diff = Math.round((qs.tot - pr.tot) / pr.tot * 100);
    ok(txt('stat-sett-count').includes((diff >= 0 ? '+' : '') + diff + '%'), 'Percentuale sulla settimana prima (' + diff + '%)');
    ok(document.getElementById('stat-sett-succ').disabled, 'Settimana in corso: freccia ▶ disattivata');
    cambiaSettStats(-1);
    ok(txt('stat-sett-lordo') === pr.tot.toFixed(2) + ' €' && pr.tot >= 100 && txt('stat-sett-periodo') === ita(g(-7)).slice(0, 5) + ' – ' + ita(g(-1)), '◀: settimana precedente ' + txt('stat-sett-periodo') + ' = ' + txt('stat-sett-lordo'));
    ok(!document.getElementById('stat-sett-succ').disabled, 'Settimana passata: freccia ▶ attiva');
    cambiaSettStats(1); cambiaSettStats(1);
    ok(txt('stat-sett-periodo').includes('(in corso)'), '▶ non va oltre la settimana in corso');
    cambiaSettStats(-3); switchView('board'); switchView('stats');
    ok(txt('stat-sett-periodo').includes('(in corso)'), 'Riaprendo le Statistiche si riparte dalla settimana in corso');
    fb.scritturaRemota({ 'db/k901': null, 'db/k902': null, 'db/k903': null }, false);
    switchView('board');
  });

  await passo('Ricerca globale', async () => {
    const ita = d => d.split('-').reverse().join('/');
    fb.scritturaRemota({
      'db/k951': { id: 951, cognome: 'CERCATO', nome: 'UNO', tel: '3471234567', marca: 'APRILIA', modello: 'TUONO', targa: 'ZX951AA', stato: 'doing', data: oggi, totale_lordo: 200, acconti: [{ val: 50, date: oggi }], clientId: 'c-cerc1' },
      'db/k952': { id: 952, cognome: 'CERCATO', nome: 'UNO', tel: '3471234567', marca: 'APRILIA', modello: 'TUONO', targa: 'ZX951AA', stato: 'archived', data: '2026-01-10', data_chiusura: '2026-01-12', totale_lordo: 90, clientId: 'c-cerc1' },
      'db/k953': { id: 953, cognome: 'CERCATO', nome: 'DUE', marca: 'VESPA', modello: 'GTS', targa: 'ZX953BB', stato: 'todo', data: oggi, clientId: 'c-cerc2' },
      'agenda/k953': { id: 9530, tipo: 'officina', jobId: 953, data: oggi, ora: '15:30', cliente: 'CERCATO DUE' },
      'db/k954': { id: 954, cognome: 'CERCATO', nome: 'TRE', marca: 'SUZUKI', modello: 'GSX', targa: 'ZX954CC', stato: 'special', special_cat: 'incidentate', data: oggi, clientId: 'c-cerc3' },
      'db/k955': { id: 955, cognome: 'FERMO', nome: 'QUATTRO', targa: 'ZX955DD', stato: 'archived', data: '2026-03-01', data_chiusura: '2026-03-05', clientId: 'c-cerc4' },
      'db/k956': { id: 956, cognome: '<img src=x onerror="window.__xssRg=1">', nome: 'CERCATO', targa: 'ZX956EE', stato: 'done', data: oggi, totale_lordo: 10 },
      'ordini/k961': { id: 961, desc: 'CUPOLINO', cliente: 'CERCATO CINQUE', tel_cliente: '3330000000', stato: 'doing', data_consegna: oggi, qta: 1, data: oggi },
      'ordini/k962': { id: 962, desc: 'PASTIGLIE CERC', jobId: 951, targa: 'ZX951AA', cliente: 'CERCATO UNO', stato: 'doing', qta: 2, data: oggi },
      'ordini/k963': { id: 963, desc: 'VECCHIO CERC', cliente: 'CERCATO SEI', stato: 'consegnato', qta: 1, data: oggi }
    }, false);
    switchView('board');
    toggleBoardSearch();
    const box = document.getElementById('ricerca-globale');
    const cerca = q => { campo('board-search-input', q); aggiornaRicercaGlobale(); return box.textContent.replace(/\s+/g, ' '); };
    ok(box && box.closest('#board-search-wrapper'), 'Ricerca globale: riquadro dentro la barra del pulsante Cerca della Bacheca');
    cerca('c');
    ok(box.style.display === 'none', 'Ricerca globale: con una sola lettera il riquadro resta chiuso');
    let t = cerca('cercato');
    ok(box.style.display === 'block' && box.querySelectorAll('.rg-moto').length === 4, 'Ricerca globale: 4 moto trovate (' + box.querySelectorAll('.rg-moto').length + '), i due lavori della stessa targa in una riga sola');
    ok(t.split('ZX951AA').length === 2, 'Ricerca globale: la targa ZX951AA compare una volta sola');
    ok(t.includes('Sul ponte') && t.includes('conto € 200,00') && t.includes('acconti € 50,00') && t.includes('da pagare € 150,00'), 'Ricerca globale: sul ponte con conto, acconti e da pagare');
    ok(t.includes('📦 1 ricambio in attesa') && !t.includes('PASTIGLIE CERC'), 'Ricerca globale: ricambio della moto indicato sulla sua riga, non ripetuto sotto');
    ok(t.includes('Appuntamento ' + ita(oggi) + ' ore 15:30'), 'Ricerca globale: appuntamento con data e ora dall\'Agenda');
    ok(t.includes('Incidentata') && t.includes('Pronta da ritirare'), 'Ricerca globale: incidentata e moto pronta');
    ok(box.querySelectorAll('.rg-ordine').length === 1 && t.includes('CUPOLINO') && t.includes('Ordinato · previsto ' + ita(oggi)) && !t.includes('VECCHIO CERC'), 'Ricerca globale: ricambio ordinato a nome del cliente (senza moto), esclusi quelli già consegnati');
    ok(!!box.querySelector('a[href="https://wa.me/393471234567"]') && !!box.querySelector('a[href="tel:3471234567"]'), 'Ricerca globale: pulsanti Chiama e WhatsApp');
    ok(!box.querySelector('img') && !window.__xssRg, 'Ricerca globale: i nomi non eseguono codice');
    t = cerca('zx951');
    ok(box.querySelectorAll('.rg-moto').length === 1 && t.includes('CERCATO UNO'), 'Ricerca globale: ricerca per targa');
    t = cerca('fermo');
    ok(t.includes('Nessun lavoro aperto · ultimo il 05/03/2026'), 'Ricerca globale: moto senza lavori aperti mostra l\'ultimo lavoro');
    t = cerca('zzqq nessuno');
    ok(t.includes('Nessun risultato'), 'Ricerca globale: nessun risultato');
    cerca('cercato uno'); refreshBoard();
    ok(document.getElementById('list-doing').textContent.includes('CERCATO'), 'Ricerca globale: la Bacheca continua a filtrare le sue schede');
    box.querySelector('.rg-stato').click();
    ok(!document.getElementById('modal-storico').classList.contains('hidden'), 'Ricerca globale: clic sulla riga apre la scheda');
    closeModal('modal-storico');
    cerca('cercato due');
    fb.scritturaRemota({ 'db/k953/stato': 'doing' }, false);
    await attendi(400);
    ok(box.textContent.includes('Sul ponte'), 'Ricerca globale: si aggiorna da sola quando un altro dispositivo cambia la scheda');
    cerca('cinque');
    apriOrdineDaRicerca('961');
    ok(currentView === 'ordini' && currentOrdTab === 'doing', 'Ricerca globale: clic sul ricambio apre gli Ordini sulla scheda giusta');
    switchView('board');
    chiudiBoardSearch();
    ok(box.innerHTML === '' && box.style.display === 'none' && document.getElementById('board-search-input').value === '', 'Ricerca globale: chiudendo la ricerca il riquadro si svuota');
    fb.scritturaRemota({ 'db/k951': null, 'db/k952': null, 'db/k953': null, 'agenda/k953': null, 'db/k954': null, 'db/k955': null, 'db/k956': null, 'ordini/k961': null, 'ordini/k962': null, 'ordini/k963': null }, false);
    await attendi(300);
  });

  await passo('Cerca cliente esistente', async () => {
    fb.scritturaRemota({
      'db/k971': { id: 971, cognome: 'LEONTI', nome: 'MARIANO', tel: '3330001111', marca: 'SUZUKI', modello: 'GS 400', targa: 'RG 42836', km: '10000', stato: 'archived', data: '2025-05-01', clientId: 'c-leo' },
      'db/k972': { id: 972, cognome: 'LEONTI', nome: 'MARIANO', tel: '3339998888', marca: 'SUZUKI', modello: 'GS 400', targa: 'RG42836', km: '25000', stato: 'archived', data: '2026-09-01', clientId: 'c-leo' },
      'db/k973': { id: 973, cognome: 'MARIANO', nome: 'GIOVANNI', marca: 'HONDA', targa: 'ZZ0001', stato: 'archived', data: '2026-01-01' },
      'db/k974': { id: 974, cognome: 'LEONTINI', nome: 'PAOLA', targa: 'ZZ0002', stato: 'archived', data: '2026-01-01' },
      'db/k975': { id: 975, cognome: 'LEONTINI', nome: 'PAOLA', targa: 'ZZ0002', stato: 'archived', data: '2026-02-01' },
      'db/k976': { id: 976, cognome: 'LEONTINI', nome: 'PAOLA', targa: 'ZZ0002', stato: 'archived', data: '2026-03-01' },
      'db/k977': { id: 977, cognome: "D'ANGELO", nome: '<b>X</b>', targa: 'ZZ0003', stato: 'archived', data: '2026-03-01' }
    }, false);
    switchView('nuova');
    const res = document.getElementById('nuova-cliente-results');
    const righe = () => [...res.querySelectorAll('div[onmousedown]')];
    const nomi = () => righe().map(r => r.querySelector('span').textContent.trim());
    const cerca = q => { campo('f_search_cliente', q); cercaClienteNuova(); return nomi(); };
    let n = cerca('LEONTI');
    ok(n[0] === 'LEONTI MARIANO' && n.includes('LEONTINI PAOLA'), 'Cerca cliente: cognome scritto per intero non blocca la ricerca, il cliente esatto è primo anche con meno lavori (' + n.join(', ') + ')');
    ok(n.filter(x => x === 'LEONTI MARIANO').length === 1, 'Cerca cliente: stessa targa scritta con e senza spazio = una riga sola');
    ok(righe()[0].textContent.includes('STESSO NOME') && !righe()[1].textContent.includes('STESSO NOME'), 'Cerca cliente: "stesso nome" solo sul cliente che combacia');
    ok(JSON.stringify(cerca('LEONTI MARIANO')) === '["LEONTI MARIANO"]', 'Cerca cliente: cognome e nome insieme');
    ok(JSON.stringify(cerca('mariano leonti')) === '["LEONTI MARIANO"]', 'Cerca cliente: nome e cognome al contrario, minuscolo');
    n = cerca('MARIANO');
    ok(n[0] === 'MARIANO GIOVANNI' && n.includes('LEONTI MARIANO'), 'Cerca cliente: una parola trova sia il cognome sia il nome, prima il cognome esatto');
    ok(cerca('rg 428')[0] === 'LEONTI MARIANO', 'Cerca cliente: per targa anche con lo spazio');
    cerca('LEONTI MARIANO');
    righe()[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ok(document.getElementById('f_tel').value === '3339998888' && document.getElementById('f_km').value === '25000' && document.getElementById('f_targa').value === 'RG42836', 'Cerca cliente: compila telefono, km e targa della scheda più recente');
    n = cerca("d'angelo");
    ok(n[0] === "D'ANGELO <b>X</b>" && !res.querySelector('span b'), 'Cerca cliente: apostrofi e simboli nel nome mostrati come testo');
    righe()[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ok(document.getElementById('f_cognome').value === "D'ANGELO" && document.getElementById('f_nome').value === '<b>X</b>', 'Cerca cliente: scelta di un cognome con apostrofo compila il modulo');
    clearForm();
    campo('p_search_cliente', 'mariano leonti'); cercaClientePreventivo();
    ok(document.querySelectorAll('#prev-cliente-results div[onmousedown]').length === 1, 'Cerca cliente nei Preventivi: nome e cognome al contrario');
    campo('app_search_cliente', 'mariano leonti'); cercaClienteAgenda('mariano leonti');
    ok(document.querySelectorAll('#app_search_results div[onclick^="selezionaClienteAgenda"]').length === 1, 'Cerca cliente nel Nuovo appuntamento: nome e cognome al contrario');
    campo('app_search_cliente', ''); cercaClienteAgenda('');
    campo('p_search_cliente', ''); cercaClientePreventivo();
    fb.scritturaRemota({ 'db/k971': null, 'db/k972': null, 'db/k973': null, 'db/k974': null, 'db/k975': null, 'db/k976': null, 'db/k977': null }, false);
    switchView('board');
    await attendi(300);
  });

  await passo('Cerca cliente: tanti risultati', async () => {
    const w = {};
    for (let i = 1; i <= 21; i++) w['db/kan' + i] = { id: 9800 + i, cognome: 'COGNOMEPROVA' + i, nome: 'ANGELO', targa: 'AN0' + String(i).padStart(2, '0'), stato: 'archived', data: '2026-01-' + String(i).padStart(2, '0') };
    for (let i = 0; i < 3; i++) w['db/kae' + i] = { id: 990 + i, cognome: 'ANGELONE', nome: 'ANTONIO', targa: 'AN0099', stato: 'archived', data: '2026-02-0' + (i + 1) };
    fb.scritturaRemota(w, false);
    switchView('nuova');
    const res = document.getElementById('nuova-cliente-results');
    const cerca = q => { campo('f_search_cliente', q); cercaClienteNuova(); return [...res.querySelectorAll('div[onmousedown]')].map(r => r.querySelector('span').textContent.trim()); };
    let n = cerca('ANGELO');
    const extra = res.querySelector('.altri-risultati');
    ok(n.length === 20 && n.every(x => x.endsWith(' ANGELO')), 'Cerca cliente: fino a 20 risultati, prima chi si chiama esattamente Angelo, poi Angelone (' + n.slice(0, 3).join(', ') + '…)');
    ok(extra && extra.textContent.includes('altri 2 risultati') && extra.textContent.includes('cognome'), 'Cerca cliente: avviso "altri 2 risultati, scrivi anche il cognome"');
    n = cerca('ANGELO COGNOMEPROVA21');
    ok(n.length === 1 && n[0] === 'COGNOMEPROVA21 ANGELO' && !res.querySelector('.altri-risultati'), 'Cerca cliente: aggiungendo il cognome resta un risultato e l\'avviso sparisce');
    campo('p_search_cliente', 'angelo'); cercaClientePreventivo();
    ok(!!document.querySelector('#prev-cliente-results .altri-risultati'), 'Cerca cliente nei Preventivi: avviso altri risultati');
    campo('app_search_cliente', 'angelo'); cercaClienteAgenda('angelo');
    ok(!!document.querySelector('#app_search_results .altri-risultati'), 'Cerca cliente nel Nuovo appuntamento: avviso altri risultati');
    campo('app_search_cliente', ''); cercaClienteAgenda(''); campo('p_search_cliente', ''); cercaClientePreventivo(); clearForm();
    const via = {}; Object.keys(w).forEach(k => { via[k] = null; });
    fb.scritturaRemota(via, false);
    switchView('board');
    await attendi(300);
  });

  await passo('Telefono: barra in basso e Bacheca a schede', async () => {
    const tb = [...document.querySelectorAll('#mob-tabbar button')];
    ok(tb.map(b => b.dataset.view).join(',') === 'board,nuova,agenda,ordini,altro', 'Telefono: barra in basso con Bacheca, Nuova, Agenda, Ordini, Altro');
    ok(getComputedStyle(document.getElementById('mob-tabbar')).display === 'none' && getComputedStyle(document.getElementById('board-tabs')).display === 'none', 'Sul Mac la barra in basso e le schede della Bacheca non compaiono');
    const accesi = () => tb.filter(b => b.classList.contains('on')).map(b => b.dataset.view).join(',');
    switchView('ordini'); ok(accesi() === 'ordini', 'Telefono: aprendo Ordini si accende il suo pulsante');
    switchView('archivio'); ok(accesi() === 'altro', 'Telefono: una sezione del menu accende "Altro"');
    switchView('board'); refreshBoard();
    ok(accesi() === 'board', 'Telefono: tornando alla Bacheca si accende Bacheca');
    const num = id => (document.getElementById(id).textContent.match(/\((\d+)\)/) || [])[1];
    const tab = [...document.querySelectorAll('#board-tabs button b')].map(b => b.textContent);
    ok(tab.join(',') === [num('title-todo'), num('title-doing'), num('title-done')].join(','), 'Telefono: le schede Oggi / Sul ponte / Pronte riportano i numeri delle colonne (' + tab.join(', ') + ')');
    ok(document.querySelectorAll('#board-tabs button.on').length === 1, 'Telefono: una sola scheda della Bacheca evidenziata');
  });

  await passo('Garanzie', async () => {
    const gar = () => Object.values(fb.leggi('garanzie') || {});
    const txt = id => (document.getElementById(id) || {}).textContent || '';
    switchView('garanzie'); await attendi(50);
    ok(!document.getElementById('view-garanzie').classList.contains('hidden') && document.querySelector('.topbar-qbtn[data-view="garanzie"]').classList.contains('tq-active'), 'Garanzie: pagina aperta dalla barra, pulsante evidenziato');
    ok(txt('gar-tabs').includes('Richieste') && txt('gar-tabs').includes('Da contattare') && txt('gar-tabs').includes('Storico') && /Nessuna garanzia in attesa/.test(txt('gar-lista')), 'Schede Richieste / Da contattare / Storico, nessuna garanzia');
    ok(document.getElementById('gar-badge').style.display === 'none' && document.getElementById('gar-badge-top').style.display === 'none', 'Nessun cliente da contattare: niente numero su menu e barra');

    // Nuova garanzia con il cliente cercato nell'anagrafica
    apriFormGaranzia();
    ok(document.getElementById('gar-form').style.display === 'block' && document.getElementById('g_data').value === oggi, 'Modulo aperto, data richiesta = oggi');
    campo('g_search_cliente', 'rossi'); cercaClienteGaranzia();
    const ris = [...document.querySelectorAll('#gar-cliente-results .gar-risultato')].find(d => d.textContent.includes('ROSSI MARIO'));
    ok(ris && ris.textContent.includes('AB12345'), 'Cerca cliente: trova ROSSI MARIO con la targa');
    if (ris) ris.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ok(document.getElementById('g_cognome').value === 'ROSSI' && document.getElementById('g_tel').value === '3331112222' && document.getElementById('g_targa').value === 'AB12345' && document.getElementById('g_marca').value === 'HONDA', 'Cliente scelto: cognome, telefono, moto e targa compilati');
    campo('g_cosa', '');
    const n0 = gar().length;
    salvaGaranzia();
    ok(gar().length === n0 && document.getElementById('gar-form').style.display === 'block', 'Senza "cosa è in garanzia" non si salva');
    campo('g_cosa', 'pompa freno anteriore che perde'); campo('g_fornitore', 'Honda Italia'); campo('g_pratica', '4512');
    const n1 = nScr();
    salvaGaranzia();
    const g1 = gar()[0];
    ok(gar().length === 1 && g1.stato === 'richiesta' && g1.cognome === 'ROSSI' && g1.targa === 'AB12345' && g1.data_richiesta === oggi && g1.pratica === '4512', 'Garanzia salvata in "Richieste" con cliente, moto, pratica e data');
    ok(uguali(chiaviDa(n1), ['garanzie']), 'Salvataggio: scritte solo le garanzie (' + chiaviDa(n1) + ')');
    ok(document.getElementById('gar-form').style.display === 'none' && txt('gar-lista').includes('ROSSI') && txt('gar-lista').includes('pompa freno') && txt('gar-lista').includes('richiesta oggi'), 'Riga in Richieste: cliente, cosa, "richiesta oggi"');
    toggleDettaglioGaranzia(g1.id);
    ok(document.getElementById('gar-det-' + g1.id).style.display === 'grid' && txt('gar-det-' + g1.id).includes('pratica N° 4512') && txt('gar-det-' + g1.id).includes('Honda Italia'), 'Clic sulla riga: dettaglio con casa e numero di pratica');

    // Arriva il materiale → Da contattare
    garArrivato(g1.id);
    ok(gar()[0].stato === 'arrivata' && gar()[0].data_arrivo === oggi, 'Materiale arrivato: stato "Da contattare" con la data');
    ok(txt('gar-badge') === '1' && txt('gar-badge-top') === '1' && document.getElementById('gar-badge-top').style.display !== 'none', 'Numero dei clienti da contattare su menu e barra: 1');
    switchView('board'); switchView('garanzie');
    ok(currentGarTab === 'arrivata' && txt('gar-lista').includes('da chiamare'), 'Riaprendo la pagina si apre "Da contattare": "🔴 da chiamare"');
    const origOpen = window.open; let aperto = '';
    window.open = u => { aperto = u; return null; };
    try { garWhatsApp(g1.id); } finally { window.open = origOpen; }
    ok(aperto.startsWith('https://wa.me/393331112222') && decodeURIComponent(aperto).includes('pompa freno anteriore che perde'), 'WhatsApp al cliente con il messaggio del materiale arrivato');
    ok(gar()[0].contattato === oggi && txt('gar-lista').includes('avvisato'), 'Dopo WhatsApp: "avvisato oggi"');

    // Appuntamento dalla garanzia
    garAppuntamento(g1.id);
    ok(currentView === 'nuova-app' && document.getElementById('app_cognome').value === 'ROSSI' && document.getElementById('app_targa').value === 'AB12345' && /GARANZIA: pompa freno anteriore che perde \(pratica 4512\)/.test(document.getElementById('app_note').value), 'Appuntamento: modulo compilato con cliente, moto e "GARANZIA: …"');
    const dApp = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    campo('app_data', dApp);
    salvaAppuntamento();
    const app = agendaDB.find(a => String(a.garanzia_id) === String(g1.id));
    ok(app && app.data === dApp && db.some(j => String(j.id) === String(app.jobId) && j.stato === 'todo' && /GARANZIA/.test(j.lavori_richiesti)), 'Appuntamento salvato in Agenda, collegato alla garanzia, con la scheda in Bacheca');
    ok(currentView === 'garanzie' && txt('gar-lista').includes('app. ' + dApp.split('-').reverse().join('/').slice(0, 5)) && document.getElementById('gar-badge').style.display === 'none', 'Si torna alle Garanzie: "📅 app." sulla riga, nessun cliente da chiamare');
    apriModalApp();
    ok(document.getElementById('app_garanzia_id').value === '', 'Un appuntamento normale aperto dopo non resta collegato alla garanzia');
    switchView('garanzie');
    modificaApp(app.id); campo('m_app_note', 'GARANZIA pompa freno (spostato)'); salvaAppuntamento();
    ok(String(agendaDB.find(a => String(a.id) === String(app.id)).garanzia_id) === String(g1.id), 'Modificando l\'appuntamento il collegamento alla garanzia resta');
    const azione = document.querySelector('#gar-riga-' + g1.id + ' .gar-azione');
    ok(azione && azione.textContent.includes('Chiudi'), 'Con l\'appuntamento fissato il pulsante della riga diventa "✓ Chiudi"');

    // Chiusura → Storico, riapertura, rifiuto, modifica, eliminazione
    garChiudi(g1.id);
    ok(gar()[0].stato === 'chiusa' && gar()[0].esito === 'fatta' && gar()[0].data_chiusura === oggi, 'Chiudi: garanzia nello Storico come "fatta"');
    setGarTab('chiusa');
    ok(txt('gar-lista').includes('ROSSI') && txt('gar-lista').includes('✓ fatta'), 'Storico: la garanzia chiusa con "✓ fatta"');
    garRiapri(g1.id);
    ok(gar()[0].stato === 'arrivata' && !gar()[0].esito, 'Riapri: torna in "Da contattare"');
    garIndietro(g1.id);
    ok(gar()[0].stato === 'richiesta' && !gar()[0].data_arrivo, 'Riporta in Richieste: tolta la data di arrivo');
    garRifiutata(g1.id);
    ok(gar()[0].stato === 'chiusa' && gar()[0].esito === 'rifiutata', 'Garanzia rifiutata: nello Storico come "rifiutata"');
    apriFormGaranzia(g1.id);
    ok(document.getElementById('g_cosa').value === 'pompa freno anteriore che perde' && document.getElementById('g_id').value === String(g1.id), 'Modifica: il modulo si riapre con i dati');
    campo('g_cosa', 'pompa freno anteriore'); salvaGaranzia();
    ok(gar().length === 1 && gar()[0].cosa === 'pompa freno anteriore' && gar()[0].stato === 'chiusa' && gar()[0].esito === 'rifiutata', 'Modifica salvata: stesso stato, nessun doppione');
    campo('gar-cerca', 'mt07'); refreshGaranzie();
    ok(/Nessuna garanzia trovata/.test(txt('gar-lista')), 'Ricerca: niente per una moto diversa');
    campo('gar-cerca', 'honda'); refreshGaranzie();
    ok(txt('gar-lista').includes('ROSSI'), 'Ricerca per marca');
    campo('gar-cerca', '');
    garElimina(g1.id);
    ok(gar().length === 0, 'Elimina: garanzia tolta');

    fb.scritturaRemota({ 'garanzie': [{ id: 55, stato: 'arrivata', cognome: '<img src=x onerror="window.__xssGar=1">', cosa: '<b>X</b>', data_arrivo: oggi }] }, false);
    setGarTab('arrivata'); await attendi(50);
    ok(!window.__xssGar && txt('gar-lista').includes('<b>X</b>') && txt('gar-badge') === '1', 'Da un altro dispositivo: testi mostrati come testo, numero aggiornato');
    fb.scritturaRemota({ 'garanzie': [
      { id: 61, stato: 'arrivata', cognome: 'CONAPP', cosa: 'a', data_arrivo: '2026-01-01' },
      { id: 62, stato: 'arrivata', cognome: 'AVVISATO', cosa: 'b', data_arrivo: '2026-01-02', contattato: '2026-01-03' },
      { id: 63, stato: 'arrivata', cognome: 'DACHIAMARE', cosa: 'c', data_arrivo: '2026-01-05' }
    ], 'agenda/kg61': { id: 6161, tipo: 'officina', data: '2099-01-01', ora: '09:00', cliente: 'CONAPP', garanzia_id: '61' } }, false);
    setGarTab('arrivata'); await attendi(50);
    const ordineGar = [...document.querySelectorAll('#gar-lista .gar-riga')].map(r => r.textContent.match(/CONAPP|AVVISATO|DACHIAMARE/)[0]);
    ok(uguali(ordineGar, ['DACHIAMARE', 'AVVISATO', 'CONAPP']), 'Da contattare: prima da chiamare, poi avvisati, poi con appuntamento (' + ordineGar + ')');
    fb.scritturaRemota({ 'garanzie': null, 'agenda/kg61': null }, false);
    switchView('board');
  });

  await passo('Vendite', async () => {
    const anno = String(new Date().getFullYear());
    const N1 = anno + '/001', K1 = anno + '_001', K2 = anno + '_002', K3 = anno + '_003';
    const val = id => document.getElementById(id).value;
    const txt = id => (document.getElementById(id) || {}).textContent || '';
    const eur = x => String(x).replace(/\s/g, '');
    const led = () => Object.values(fb.leggi('ledger') || {}).filter(Boolean);
    const imp = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    const cid = (db.find(j => j.id === 1001) || {}).clientId || 'ROSSI MARIO';
    fb.scritturaRemota({ ['billing/' + cid]: { cf: 'RSSMRA80A01H163X', indirizzo: 'VIA ROMA 1', citta: 'RAGUSA', cap: '97100' } }, false);
    switchView('vendite'); await attendi(50);
    ok(!document.getElementById('view-vendite').classList.contains('hidden') && /Nessun documento/.test(txt('vend-lista')), 'Vendite: pagina aperta, nessun documento');

    nuovaVendita('ordine');
    ok(document.getElementById('vend-editor').style.display === '' && val('vd-numero') === N1 && val('vd-data') === oggi.split('-').reverse().join('/') && document.getElementById('vd-logo').src.startsWith('data:image/jpeg') && txt('vd-titolo') === "Conferma d'Ordine", 'Nuova conferma d\'ordine: numero ' + N1 + ', data di oggi, logo');
    campo('vd-cerca-cliente', 'rossi'); cercaClienteVendita();
    const ris = [...document.querySelectorAll('#vd-cliente-results .vend-risultato')].find(d => d.textContent.includes('ROSSI MARIO'));
    if (ris) ris.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ok(val('vd-cognome') === 'ROSSI' && val('vd-nome') === 'MARIO' && val('vd-telefono') === '3331112222' && val('vd-cf') === 'RSSMRA80A01H163X' && val('vd-indirizzo') === 'VIA ROMA 1' && val('vd-cap') === '97100', 'Cliente dall\'anagrafica con i dati di fatturazione (codice fiscale, indirizzo, CAP)');
    imp('vd-citta', 'Modica');
    ok(val('vd-cap') === '97015', 'Città Modica: CAP 97015 da solo');
    campo('vd-marca', 'honda'); campo('vd-modello', 'africa twin');
    imp('vd-prezzo', '12.500');
    ok(eur(val('vd-totale')) === '12.500,00€', 'Prezzo "12.500" = 12.500,00 € (il vecchio programma lo leggeva 12,50): ' + val('vd-totale'));
    imp('vd-spese', '350'); imp('vd-permuta', '2.000');
    aggiungiRigaVendita();
    const ultima = [...document.querySelectorAll('#vd-righe tr.vd-extra')].pop();
    ultima.querySelector('.vd-desc').value = 'bauletto';
    const am = ultima.querySelector('.vd-amount'); am.value = '199,90'; am.dispatchEvent(new Event('input', { bubbles: true }));
    imp('vd-acconto', '1.000');
    ok(eur(val('vd-totale')) === '11.049,90€' && eur(val('vd-saldo')) === '10.049,90€', 'Totale 12.500 + 350 − 2.000 + 199,90 = 11.049,90 €, saldo 10.049,90 € (' + val('vd-totale') + ' / ' + val('vd-saldo') + ')');
    const n0 = nScr(), led0 = led().length;
    salvaVendita();
    const v1 = fb.leggi('vendite/' + K1);
    ok(v1 && v1.cognome === 'ROSSI' && v1.marca === 'HONDA' && v1.prezzoVeicolo === '12.500' && v1.totale === 11049.9 && Object.values(v1.vociExtra || {})[0].desc === 'BAULETTO', 'Salvato nel gestionale: dati in maiuscolo, importi come scritti, totale 11.049,90');
    const mov = led().find(m => String(m.id) === String(v1 && v1.acconto_ledger_id));
    ok(mov && mov.importo === 1000 && mov.tipo === 'in' && mov.cat === 'vendita' && mov.collab === 'INTERNO' && mov.desc.includes('ACCONTO ORDINE ' + N1) && mov.desc.includes('ROSSI') && led().length === led0 + 1, 'Acconto di 1.000 € nella Prima Nota (Cassa INTERNA, vendita)');
    ok(fb.scritture.length === n0 + 1 && uguali(ordina(chiaviDa(n0)), ['ledger', 'vendite/' + K1]), 'Un solo salvataggio: documento + Prima Nota (' + chiaviDa(n0) + ')');
    imp('vd-acconto', '1.500'); salvaVendita();
    ok(led().length === led0 + 1 && led().find(m => String(m.id) === String(v1.acconto_ledger_id)).importo === 1500, 'Acconto cambiato in 1.500: stesso movimento aggiornato, nessun doppione');

    nuovaVendita('preventivo');
    ok(val('vd-numero') === anno + '/002' && txt('vd-titolo') === 'Preventivo' && txt('vd-note-legali').includes('15 giorni'), 'Nuovo preventivo: numero successivo, titolo e validità di 15 giorni');
    campo('vd-numero', N1); campo('vd-cognome', 'bianchi'); campo('vd-modello', 'mt07'); imp('vd-prezzo', '7200'); imp('vd-acconto', '500');
    const n1 = nScr(); salvaVendita();
    ok(nScr() === n1, 'Numero già usato da un altro documento: non si salva');
    campo('vd-numero', anno + '/002'); salvaVendita();
    const v2 = fb.leggi('vendite/' + K2);
    ok(v2 && v2.tipoDocumento === 'preventivo' && !v2.acconto_ledger_id && led().length === led0 + 1, 'Preventivo salvato senza movimento in Prima Nota');
    chiudiVendita();
    ok(currentVendTab === 'preventivo' && /Conferme d'ordine\s*1/.test(txt('vend-tabs')) && /Preventivi\s*1/.test(txt('vend-tabs')), 'Schede "Conferme d\'ordine" (1) e "Preventivi" (1); dopo un preventivo si torna sui Preventivi');
    let righe = [...document.querySelectorAll('#vend-lista .vend-riga')];
    ok(righe.length === 1 && righe[0].textContent.includes(anno + '/002') && txt('vend-lista').includes('Esito') && !/€/.test(txt('vend-lista')), 'Scheda Preventivi: solo il preventivo, colonna "Esito", niente prezzi');
    setVendTab('ordine');
    fb.scritturaRemota({ 'vendite/T_9': { id: 'T/9', chiave: 'T_9', tipoDocumento: 'ordine', cognome: 'PROVA', prezzoVeicolo: '6600' } }, false);
    righe = [...document.querySelectorAll('#vend-lista .vend-riga')];
    ok(righe.length === 2 && !txt('vend-lista').includes(anno + '/002') && righe.some(r => r.textContent.includes('ROSSI')) && !/€|Totale|Acconto/.test(txt('vend-lista')), 'Scheda Conferme d\'ordine: solo gli ordini, senza colonne di prezzi');
    const testa = document.querySelector('#vend-lista .vend-testa');
    const colonne = r => [...r.children].map(c => Math.round(c.getBoundingClientRect().left));
    ok(testa && testa.textContent.includes('Cliente') && uguali(colonne(righe[0]), colonne(righe[1])) && uguali(colonne(righe[0]), colonne(testa)), 'Elenco a colonne: intestazione e righe allineate (' + colonne(righe[0]) + ')');
    fb.scritturaRemota({ 'vendite/T_9': null }, false);
    campo('vend-cerca', 'africa'); refreshVendite();
    ok(document.querySelectorAll('#vend-lista .vend-riga').length === 1, 'Ricerca per modello');
    campo('vend-cerca', 'mt07'); refreshVendite();
    ok(document.querySelectorAll('#vend-lista .vend-riga').length === 0 && /Trovato 1 nei Preventivi/.test(txt('vend-lista')), 'Ricerca: se il documento è nell\'altra scheda lo dice');
    campo('vend-cerca', ''); refreshVendite();

    apriVendita(K1);
    ok(val('vd-prezzo') === '12.500' && document.querySelectorAll('#vd-righe tr.vd-extra').length === 1 && val('vd-stato') === 'NUOVO' && val('vd-pagamento') === 'BONIFICO BANCARIO' && val('vd-cf') === 'RSSMRA80A01H163X', 'Riapertura: importi, voce extra, stato, pagamento e codice fiscale');
    campo('vd-consegna', 'fine mese'); document.getElementById('vend-foglio').dispatchEvent(new Event('input'));
    const conf = window.confirm; window.confirm = () => false;
    try { chiudiVendita(); } finally { window.confirm = conf; }
    ok(document.getElementById('vend-editor').style.display === '', 'Modifiche non salvate: chiudendo chiede conferma, con "Annulla" si resta nel foglio');

    const pr = window.print; let stampato = false; window.print = () => { stampato = true; };
    try { stampaVendita(); await attendi(250); } finally { window.print = pr; }
    const pa = document.getElementById('print-area');
    ok(stampato && pa.textContent.includes("Conferma d'Ordine") && pa.textContent.includes('ROSSI') && pa.textContent.includes('FINE MESE') && pa.querySelector('img').src.startsWith('data:image/jpeg') && eur(pa.textContent).includes('9549,90€'), 'Stampa: documento con logo, cliente, consegna e saldo 9549,90 €');
    let pdf = null;
    window.html2pdf = () => { const c = { set(o) { pdf = { o }; return c; }, from(x, t) { pdf.x = x; pdf.t = t; return c; }, save() { pdf.salvato = true; return Promise.resolve(); } }; return c; };
    try { await pdfVendita(); } finally { delete window.html2pdf; }
    ok(pdf && pdf.salvato && pdf.o.filename === 'Ordine_' + anno + '-001_MARIO_ROSSI.pdf' && pdf.t === 'string' && pdf.x.includes('vdoc'), 'PDF: ' + (pdf && pdf.o.filename));
    const op = window.open; let wa = '';
    window.open = u => { wa = u; return null; };
    window.html2pdf = () => { const c = { set() { return c; }, from() { return c; }, save() { return Promise.resolve(); } }; return c; };
    try { whatsappVendita(); await attendi(30); } finally { window.open = op; delete window.html2pdf; }
    ok(wa.startsWith('https://wa.me/393331112222') && decodeURIComponent(wa).includes("conferma d'ordine"), 'WhatsApp al cliente con il messaggio e il PDF da allegare');

    fb.scritturaRemota({ 'moto_usate/4242': { id: 4242, marca: 'YAMAHA', modello: 'MT07', anno: 2019, km: 15000, targa: 'GH123AB', colore: 'NERO', prezzo: 6500, stato: 'disponibile', cognome: 'PROPRIETARIO', data_ins: oggi } }, false);
    switchView('usate'); await attendi(50);
    ok([...document.querySelectorAll('#view-usate button')].some(b => b.getAttribute('onclick') === "venditaDaUsata('4242')"), 'Moto Usate: pulsante "📄 Conferma d\'ordine" sulla scheda');
    venditaDaUsata(4242);
    ok(currentView === 'vendite' && val('vd-marca') === 'YAMAHA' && val('vd-targa') === 'GH123AB / 2019' && val('vd-km') === '15.000 km' && val('vd-stato') === 'USATO' && val('vd-prezzo') === '6500,00' && val('vd-numero') === anno + '/003', 'Dalla moto usata: veicolo compilato (targa / anno, km, Usato, prezzo 6500,00)');
    campo('vd-cognome', 'verdi'); salvaVendita();
    ok(fb.leggi('vendite/' + K3).usata_id === '4242' && fb.leggi('moto_usate/4242').stato === 'riservata', 'Salvando l\'ordine la moto usata diventa Riservata');
    venditaDaUsata(4242);
    ok(_vend && _vend.chiave === K3, 'Dalla stessa moto si riapre l\'ordine già fatto');
    eliminaVendita();
    ok(fb.leggi('vendite/' + K3) == null && fb.leggi('moto_usate/4242').stato === 'disponibile' && document.getElementById('vend-elenco').style.display === '', 'Elimina: documento tolto, moto di nuovo Disponibile, si torna all\'elenco');
    apriVendita(K1); const idMov = _vend.acconto_ledger_id;
    eliminaVendita();
    ok(fb.leggi('vendite/' + K1) == null && !led().some(m => String(m.id) === String(idMov)) && led().length === led0, 'Elimina l\'ordine con acconto: tolto anche il movimento dalla Prima Nota');

    _importaVendite({ '2025_007': { id: '2025/007', tipoDocumento: 'ordine', dataOrdine: '10/05/2025', nome: 'LUCA', cognome: 'BIANCHI', marca: 'KTM', modello: 'DUKE', stato: 'NUOVO', pagamento: 'CONTANTI', prezzoVeicolo: '9.800,00', acconto: '1000', vociExtra: [{ desc: 'CASCO', amount: '150' }] }, 'rotto': 'x' });
    const v7 = fb.leggi('vendite/2025_007');
    ok(v7 && v7.importato && v7.totale === 9950 && v7.acconto_registrato === 1000 && led().length === led0, 'Importazione dal vecchio programma: documento con il totale, acconto non aggiunto alla Prima Nota');
    apriVendita('2025_007');
    ok(val('vd-stato') === 'NUOVO' && val('vd-pagamento') === 'CONTANTI' && val('vd-numero') === '2025/007' && document.querySelectorAll('#vd-righe tr.vd-extra').length === 1, 'Documento importato: si apre con stato, pagamento e voce extra');
    salvaVendita();
    ok(led().length === led0, 'Risalvando un documento importato l\'acconto non finisce in Prima Nota');
    nuovaVendita('ordine');
    ok(val('vd-numero') === anno + '/003', 'La numerazione dell\'anno in corso non è toccata dai documenti del 2025');
    chiudiVendita();

    switchView('stats'); await attendi(30);
    const statsPrima = document.getElementById('view-stats').textContent;
    fb.scritturaRemota({ 'vendite/S_1': { id: 'S/1', chiave: 'S_1', tipoDocumento: 'ordine', dataOrdine: oggi.split('-').reverse().join('/'), cognome: 'STAT', prezzoVeicolo: '99999', acconto: '5000' } }, false);
    refreshStats();
    ok(document.getElementById('view-stats').textContent === statsPrima, 'Le vendite non cambiano le Statistiche');
    fb.scritturaRemota({ 'vendite/S_1': null }, false);
    switchView('vendite');
    // Preventivo accettato → conferma d'ordine
    apriVendita(K2);
    ok(document.getElementById('vd-btn-trasforma').style.display === '', 'Nel preventivo c\'è "➡️ Trasforma in conferma d\'ordine"');
    const nV = Object.keys(fb.leggi('vendite') || {}).length, ledT = led().length;
    trasformaInOrdine();
    ok(val('vd-tipo') === 'ordine' && val('vd-numero') === anno + '/003' && val('vd-data') === oggi.split('-').reverse().join('/') && val('vd-cognome') === 'BIANCHI' && val('vd-prezzo') === '7200' && txt('vd-legame').includes('preventivo N° ' + anno + '/002') && Object.keys(fb.leggi('vendite') || {}).length === nV, 'Trasforma: conferma d\'ordine compilata dal preventivo, numero e data nuovi, non ancora salvata');
    ok(document.getElementById('vd-btn-trasforma').style.display === 'none', 'Nella nuova conferma d\'ordine il pulsante Trasforma non c\'è');
    salvaVendita();
    const o3 = fb.leggi('vendite/' + K3), p2 = fb.leggi('vendite/' + K2);
    ok(o3 && o3.tipoDocumento === 'ordine' && o3.da_preventivo === K2 && p2 && p2.tipoDocumento === 'preventivo' && p2.ordine_chiave === K3 && p2.ordine_id === anno + '/003' && p2.cognome === 'BIANCHI', 'Salvata: il preventivo resta e ricorda l\'ordine ' + anno + '/003');
    ok(led().length === ledT + 1 && led().some(m => String(m.id) === String(o3.acconto_ledger_id) && m.importo === 500), 'L\'acconto del preventivo accettato va in Prima Nota con l\'ordine');
    setVendTab('preventivo');
    const rP = [...document.querySelectorAll('#vend-lista .vend-riga')].find(r => r.textContent.includes(anno + '/002'));
    ok(rP && rP.querySelector('.vg-esito').textContent.includes('→ ordine ' + anno + '/003'), 'Scheda Preventivi: esito "→ ordine ' + anno + '/003"');
    apriVendita(K2);
    ok(txt('vd-legame').includes("conferma d'ordine N° " + anno + '/003'), 'Riaprendo il preventivo si vede l\'ordine nato da lui');
    trasformaInOrdine();
    ok(_vend && _vend.chiave === K3 && txt('vd-legame').includes('preventivo N° ' + anno + '/002'), 'Trasformarlo di nuovo apre l\'ordine già fatto');
    eliminaVendita();
    const p2b = fb.leggi('vendite/' + K2);
    ok(fb.leggi('vendite/' + K3) == null && p2b && !p2b.ordine_chiave && led().length === ledT, 'Eliminando l\'ordine il preventivo torna senza esito e l\'acconto esce dalla Prima Nota');
    fb.scritturaRemota({ 'vendite/X_1': { id: 'X/1', cognome: '<img src=x onerror="window.__xssV=1">', marca: '<b>M</b>' } }, false);
    await attendi(30);
    ok(!window.__xssV && txt('vend-lista').includes('<b>M</b>'), 'Testi dei documenti mostrati come testo (nessun codice eseguito)');
    fb.scritturaRemota({ 'vendite': null, 'moto_usate/4242': null }, false);
    switchView('board');
  });

  await passo('Vendite: consegna e primo tagliando', async () => {
    const anno = String(new Date().getFullYear());
    const val = id => document.getElementById(id).value;
    const txt = id => (document.getElementById(id) || {}).textContent || '';
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const piuAnno = x => { const d = new Date(x); d.setFullYear(d.getFullYear() + 1); return iso(d); };
    const ita = x => x.split('-').reverse().join('/');
    const evento = id => document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }));
    switchView('stats'); await attendi(30);
    const statPrima = txt('stat-mese-lordo') + '|' + txt('stat-sett-lordo') + '|' + txt('stat-mese-count');

    // Cliente nuovo, moto nuova
    nuovaVendita('ordine');
    campo('vd-cognome', 'ferro'); campo('vd-nome', 'luca'); campo('vd-telefono', '3209998877'); campo('vd-cf', 'FRRLCU90A01H163Z'); campo('vd-indirizzo', 'via etna 5'); campo('vd-citta', 'ragusa'); campo('vd-cap', '97100');
    campo('vd-marca', 'honda'); campo('vd-modello', 'transalp'); campo('vd-prezzo', '12.900'); evento('vd-cognome');
    ok(document.getElementById('vd-anagrafica').style.display === 'none', 'Cliente nuovo: nessun "già cliente"');
    ok(document.getElementById('vd-btn-consegna').style.display === 'none', 'Prima di salvare il pulsante "Moto consegnata" non c\'è');
    salvaVendita();
    const KF = _vend.chiave;
    ok(document.getElementById('vd-btn-consegna').style.display === '', 'Ordine salvato: pulsante "🏁 Moto consegnata"');
    consegnaVendita();
    ok(!document.getElementById('modal-consegna-vendita').classList.contains('hidden') && val('vc-data') === oggi && val('vc-targa') === '' && /nuovo in Anagrafica/.test(txt('vc-info')) && txt('vc-info').includes(ita(piuAnno(oggi))), 'Finestra consegna: data di oggi, cliente nuovo, primo tagliando tra un anno');
    const nDb = db.length;
    confermaConsegnaVendita();
    ok(db.length === nDb && !document.getElementById('modal-consegna-vendita').classList.contains('hidden'), 'Senza targa non si conferma');
    const dCons = anno + '-01-15';
    campo('vc-data', dCons); campo('vc-targa', 'gh 123 ab'); campo('vc-km', '12');
    const n0 = nScr();
    confermaConsegnaVendita();
    const rec = db.find(j => j.vendita_chiave === KF);
    ok(rec && rec.stato === 'cliente' && rec.targa === 'GH123AB' && rec.cognome === 'FERRO' && rec.tel === '3209998877' && rec.data === dCons && rec.clientId && rec.totale_lordo === 0, 'Consegna: scheda in Anagrafica (FERRO LUCA, GH123AB) come "Nuovo Cliente"');
    const tg = fb.leggi('tagliandi/GH123AB');
    ok(tg && tg.data === piuAnno(dCons) && tg.origine === 'vendita' && tg.dal === dCons, 'Scadenze tagliando: primo tagliando entro il ' + ita(piuAnno(dCons)));
    const bil = rec ? fb.leggi('billing/' + rec.clientId) : null;
    ok(bil && bil.cf === 'FRRLCU90A01H163Z' && bil.indirizzo === 'VIA ETNA 5' && bil.cap === '97100', 'Dati di fatturazione salvati per il cliente');
    const vd = fb.leggi('vendite/' + KF);
    ok(vd && vd.consegnata_il === dCons && vd.consegna_targa === 'GH123AB' && rec && vd.anagrafica_id === rec.id && vd.targa === 'GH123AB', 'Documento: consegnata il ' + ita(dCons) + ', targa riportata nel foglio');
    const ch = chiaviDa(n0);
    ok(fb.scritture.length === n0 + 1 && ch.includes('vendite/' + KF) && ch.includes('tagliandi/GH123AB') && ch.some(k => k.startsWith('db/')) && !ch.includes('db'), 'Un solo salvataggio, nell\'archivio solo la scheda nuova (' + ch + ')');
    ok(txt('vd-anagrafica').includes('Consegnata il') && txt('vd-btn-consegna').includes('Consegnata il'), 'Nel foglio: "🏁 Consegnata il …"');
    switchView('stats'); await attendi(30);
    ok(txt('stat-mese-lordo') + '|' + txt('stat-sett-lordo') + '|' + txt('stat-mese-count') === statPrima, 'Statistiche: incassi e lavori chiusi non cambiano');
    switchView('tagliandi'); await attendi(30);
    ok(txt('tagliandi-results').includes('GH123AB') && txt('tagliandi-results').includes('FERRO'), 'La moto compare nelle Scadenze tagliando');
    switchView('archivio'); campo('search-input', 'ferro'); refreshArchive(); await attendi(30);
    ok(txt('archive-results').includes('FERRO'), 'Il cliente compare in Anagrafica');
    campo('search-input', ''); refreshArchive();

    // Tagliando fatto prima della scadenza → logica normale
    autoRilevaTagliando({ targa: 'GH123AB', lavori_richiesti: 'TAGLIANDO 1000 KM', conto: [], data_chiusura: oggi });
    const tg2 = fb.leggi('tagliandi/GH123AB');
    ok(tg2 && tg2.data === piuAnno(oggi) && !tg2.origine && !tg2.note, 'Tagliando fatto prima: si riparte con la logica normale (' + ita(piuAnno(oggi)) + ')');
    fb.scritturaRemota({ 'tagliandi/AB12345': { data: '2099-01-01', km: '', note: 'MANUALE' } }, false);
    autoRilevaTagliando({ targa: 'AB12345', lavori_richiesti: 'TAGLIANDO', conto: [], data_chiusura: oggi });
    ok(fb.leggi('tagliandi/AB12345').data === '2099-01-01', 'Una scadenza futura messa a mano resta com\'era (come prima)');
    fb.scritturaRemota({ 'tagliandi/AB12345': null }, false);

    // Già cliente
    nuovaVendita('ordine');
    campo('vd-cerca-cliente', 'rossi'); cercaClienteVendita();
    const ris = [...document.querySelectorAll('#vd-cliente-results .vend-risultato')].find(d => d.textContent.includes('ROSSI MARIO'));
    if (ris) ris.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ok(/Già cliente/.test(txt('vd-anagrafica')) && txt('vd-anagrafica').includes('ROSSI') && !!document.querySelector('#vd-anagrafica button'), 'Cliente scelto dall\'anagrafica: "👤 Già cliente" con il pulsante Storico');
    campo('vd-marca', 'bmw'); campo('vd-modello', 'r 1300 gs');
    salvaVendita();
    const KR = _vend.chiave;
    ok(fb.leggi('vendite/' + KR).clientId, 'Il documento ricorda il cliente scelto');
    chiudiVendita(); setVendTab('ordine');
    const riga = k => [...document.querySelectorAll('#vend-lista .vend-riga')].find(r => (r.getAttribute('onclick') || '').includes("'" + k + "'"));
    ok(riga(KR) && riga(KR).querySelector('.vg-gia') && riga(KF) && !riga(KF).querySelector('.vg-gia') && riga(KF).textContent.includes('🏁'), 'Elenco: "👤 già cliente" per ROSSI, non per FERRO (nuovo); 🏁 sulla moto consegnata');
    nuovaVendita('ordine'); campo('vd-cognome', 'bianchi'); campo('vd-nome', 'luca'); evento('vd-cognome');
    ok(/Già cliente/.test(txt('vd-anagrafica')) && txt('vd-anagrafica').includes('BIANCHI'), 'Cliente scritto a mano già in anagrafica: riconosciuto');
    campo('vd-targa', 'AB12345'); evento('vd-targa');
    ok(/già in Anagrafica/.test(txt('vd-anagrafica')), 'Moto con targa già in anagrafica: indica l\'ultimo proprietario');
    chiudiVendita();

    // Moto usata consegnata → Venduta
    fb.scritturaRemota({ 'moto_usate/4343': { id: 4343, marca: 'KAWASAKI', modello: 'Z900', anno: 2020, km: 9000, targa: 'GH999ZZ', prezzo: 7000, stato: 'disponibile', cognome: 'VECCHIO', data_ins: oggi } }, false);
    venditaDaUsata(4343);
    campo('vd-cognome', 'nuovo'); campo('vd-nome', 'proprietario'); salvaVendita();
    consegnaVendita();
    ok(val('vc-targa') === 'GH999ZZ' && val('vc-km') === '9000', 'Moto usata: targa e km proposti dal documento');
    confermaConsegnaVendita();
    const mu = fb.leggi('moto_usate/4343');
    ok(mu && mu.stato === 'venduta' && mu.data_vendita === oggi && mu.prezzo_vendita === 7000 && fb.leggi('tagliandi/GH999ZZ').origine === 'vendita', 'Consegna della moto usata: "Venduta" nelle Moto Usate e primo tagliando');
    const KU = _vend.chiave;
    eliminaVendita();
    ok(fb.leggi('vendite/' + KU) == null && !db.some(j => j.vendita_chiave === KU) && fb.leggi('tagliandi/GH999ZZ') == null, 'Eliminando l\'ordine consegnato si tolgono anche la scheda in Anagrafica e il primo tagliando');
    nuovaVendita('preventivo'); campo('vd-cognome', 'x'); salvaVendita();
    ok(document.getElementById('vd-btn-consegna').style.display === 'none', 'Nei preventivi il pulsante "Moto consegnata" non c\'è');
    eliminaVendita();
    fb.scritturaRemota({ 'vendite': null, 'moto_usate/4343': null }, false);
    switchView('board');
  });

  await passo('Stampa pre-conto', async () => {
    const txt = id => (document.getElementById(id) || {}).textContent || '';
    fb.scritturaRemota({
      'db/kPC': { id: 7702, stato: 'doing', data: oggi, cognome: 'PRECONTO', nome: 'TEST', tel: '3330001111', marca: 'APRILIA', modello: 'RS 457', targa: 'PC111AA', km: '3000',
        conto: [{ desc: 'PASTIGLIE', price: 60, qty: 1, iva: 22 }, { desc: 'OLIO', price: 15, qty: 3, iva: 22 }, { desc: '<img src=x onerror="window.__xssPC=1">', price: 0, qty: 1, iva: 22 }],
        acconti: [{ val: 50, date: oggi }], totale_lordo: 105 },
      'db/kLL': { id: 7701, stato: 'special', special_cat: 'restauri', data: oggi, cognome: 'LUNGO', marca: 'GUZZI', modello: 'V7', conto: [{ desc: 'RESTAURO', price: 500, qty: 1, iva: 22 }], totale_lordo: 500 }
    }, false);
    switchView('board'); await attendi(50);
    const pr = window.print; let stampe = 0; window.print = () => { stampe++; };
    try {
      openClosingModal(7702);
      ok(!!document.getElementById('btn-stampa-preconto'), 'Finestra del conto: pulsante "🖨️ Stampa"');
      addVoceConto('LAVAGGIO', 10, 22, false, '', 1);
      const n0 = nScr();
      stampaPrecontoFinestra(); await attendi(200);
      const pa = txt('print-area');
      ok(stampe === 1 && pa.includes('PRE-CONTO') && pa.includes('NON FISCALE') && pa.includes('PRECONTO') && pa.includes('PC111AA') && pa.includes('LAVAGGIO') && pa.includes('×3') && pa.includes('45.00 €') && pa.includes('115.00 €') && pa.includes('65.00 €') && pa.includes('provvisorio'), 'Stampa dalla finestra: voci (anche quella appena aggiunta), totale 115, acconto 50, da pagare 65');
      ok(nScr() === n0 && !db.find(j => j.id === 7702).conto.some(c => c.desc === 'LAVAGGIO'), 'Stampare non salva niente');
      ok(!window.__xssPC && pa.includes('<img src=x'), 'Le voci sono stampate come testo');
      closeModal('modal-conto');
      printPreconto(7702); await attendi(200);
      const pb = txt('print-area');
      ok(stampe === 2 && pb.includes('PRE-CONTO') && !pb.includes('LAVAGGIO') && pb.includes('105.00 €') && pb.includes('55.00 €'), 'Stampa dal menu: il pre-conto salvato (totale 105, da pagare 55)');
      refreshBoard(); await attendi(30);
      const board = document.getElementById('view-board').innerHTML;
      ok(board.includes('printPreconto(7702)') && board.includes('Stampa pre-conto'), 'Menu ⋯ della scheda sul ponte: "🖨️ Stampa pre-conto"');
      ok(board.includes('printInvoice(1003)') && !board.includes('printPreconto(1003)'), 'Moto pronta: resta "Stampa Ricevuta / Conto", niente pre-conto');
      switchView('specials'); await attendi(50);
      ok(document.getElementById('view-specials').innerHTML.includes('printPreconto(7701)'), 'Lavori Lunghi: "🖨️ Stampa pre-conto" nel menu ⋯');
    } finally { window.print = pr; }
    const regolePrint = [...document.styleSheets].flatMap(f => { try { return [...f.cssRules]; } catch (e) { return []; } })
      .filter(r => r.media && /print/.test(r.media.mediaText)).flatMap(r => [...r.cssRules]);
    const shell = regolePrint.find(r => (r.selectorText || '').includes('#app-shell') && r.style.overflow === 'visible' && r.style.height === 'auto');
    ok(!!shell && regolePrint.some(r => r.selectorText === '#print-area' && r.style.maxWidth === 'none'), 'Stampa: niente altezza fissa né tagli (le pagine lunghe continuano sul foglio dopo)');
    fb.scritturaRemota({ 'db/kPC': null, 'db/kLL': null }, false);
    switchView('board');
  });

  await passo('Lavori Lunghi a schede', async () => {
    const txt = id => (document.getElementById(id) || {}).textContent || '';
    fb.scritturaRemota({
      'db/kSA': { id: 7801, stato: 'special', special_cat: 'specials', data: '2026-10-03', cognome: 'OCCHIPINTI', nome: 'SARO', tel: '3339246240', marca: 'HONDA', modello: 'VT 1100', targa: '', lavori_richiesti: 'TRASFORMAZIONE\nCAFE RACER', conto: [{ desc: 'TELAIETTO', price: 2008, qty: 1, iva: 22 }], acconti: [{ val: 550, date: '2026-10-03' }], totale_lordo: 2008 },
      'db/kSB': { id: 7802, stato: 'special', special_cat: 'specials', data: '2026-09-29', cognome: 'MONACO', nome: 'ANDREA', tel: '3346370654', marca: 'BMW', modello: 'K 1100', targa: 'AA05526', lavori_richiesti: 'TRASFORMARE', acconti: [{ val: 500, date: '2026-09-29' }] },
      'db/kSC': { id: 7803, stato: 'special', special_cat: 'restauri', data: '2026-09-24', cognome: 'ALFANO', nome: 'SALVATORE', marca: '<img src=x onerror="window.__xssSp=1">', modello: 'DRAGSTAR', lavori_richiesti: 'METTERE IN FUNZIONE' }
    }, false);
    switchView('specials'); setSpTab('specials'); await attendi(50);
    ok(/Restauri\s*\d/.test(txt('sp-tabs')) && /Specials\s*\d/.test(txt('sp-tabs')) && /Attesa ricambi\s*\d/.test(txt('sp-tabs')), 'Lavori Lunghi: schede Restauri, Specials, Attesa ricambi con i numeri');
    ok(document.getElementById('sp-col-specials').style.display === '' && document.getElementById('sp-col-restauri').style.display === 'none' && document.getElementById('sp-col-ricambi').style.display === 'none', 'Si vede solo la scheda scelta (Specials)');
    const rA = document.getElementById('sp-riga-7801'), rB = document.getElementById('sp-riga-7802');
    ok(rA && rA.textContent.includes('HONDA VT 1100') && rA.textContent.includes('OCCHIPINTI SARO') && rA.querySelector('a[href="tel:3339246240"]') && rA.textContent.includes('TRASFORMAZIONE · CAFE RACER') && rA.textContent.includes('resta € 1458.00'), 'Riga corta: moto, cliente, 📞 telefono, note e "resta € 1458.00"');
    ok(rB && rB.textContent.includes('acconto € 500.00') && rB.querySelector('.sp-azione button').textContent.includes('Ponte'), 'Senza pre-conto: "acconto € 500.00"; pulsante ⚙️ Ponte sulla riga');
    const testa = document.querySelector('#sp-col-specials .sp-testa');
    const colonne = r => [...r.children].map(c => Math.round(c.getBoundingClientRect().left));
    ok(testa && uguali(colonne(rA), colonne(rB)) && uguali(colonne(rA), colonne(testa)), 'Colonne allineate tra intestazione e righe');
    ok(document.getElementById('sp-det-7801').style.display === 'none', 'Il dettaglio è chiuso finché non si clicca');
    rA.click();
    const dA = document.getElementById('sp-det-7801');
    ok(dA.style.display === 'grid' && dA.textContent.includes('Pre-conto') && dA.textContent.includes('€ 2008.00') && dA.textContent.includes('Acconti € 550.00') && dA.textContent.includes('Resta € 1458.00') && dA.textContent.includes('Sposta in') && dA.innerHTML.includes('openClosingModal(7801)') && dA.innerHTML.includes('printPreconto(7801)'), 'Clic sulla riga: pre-conto, acconti, resta e tutte le azioni (Pre-conto, Stampa, Sposta…)');
    rB.click();
    ok(document.getElementById('sp-det-7801').style.display === 'none' && document.getElementById('sp-det-7802').style.display === 'grid', 'Aprendo un\'altra moto la prima si chiude');
    spostaCategoriaSp(7802, 'ricambi');
    ok(recordDi('db', 7802).special_cat === 'ricambi' && /Attesa ricambi\s*\d/.test(txt('sp-tabs')) && document.getElementById('sp-col-ricambi').textContent.includes('BMW K 1100'), '"Sposta in Attesa ricambi": la moto cambia scheda');
    fb.scritturaRemota({ 'db/kSD': { id: 7804, stato: 'special', special_cat: 'ricambi', data: '2026-10-20', cognome: 'FARNISI', marca: 'ROYAL ENFIELD', modello: 'SUPER METEOR 650', targa: 'FH14077', lavori_richiesti: 'LEVA FRIZIONE', totale_lordo: 156.47, conto: [{ desc: 'LEVA', price: 156.47, qty: 1 }] } }, false);
    ordiniDB.push({ id: 99801, desc: 'LEVA FRIZIONE', qta: 1, stato: 'doing', jobId: 7804, data: '2026-10-20', data_consegna: '2026-10-28' });
    setSpTab('ricambi');
    const rD = document.getElementById('sp-riga-7804'), rB2 = document.getElementById('sp-riga-7802');
    ok(rD && rD.textContent.includes('Attesa ricambi') && uguali(colonne(rD), colonne(rB2)) && uguali(colonne(rD), colonne(document.querySelector('#sp-col-ricambi .sp-testa'))), 'Attesa ricambi: con l\'etichetta "⏳ Attesa ricambi" le colonne restano allineate');
    ordiniDB = ordiniDB.filter(o => o.id !== 99801);
    fb.scritturaRemota({ 'db/kSD': null }, false);
    const tabR = document.getElementById('sp-tab-restauri');
    dropSp({ preventDefault() {}, target: tabR, dataTransfer: { getData: () => '7801' } }, 'restauri');
    ok(recordDi('db', 7801).special_cat === 'restauri', 'Trascinata sulla scheda Restauri: cambia categoria');
    setSpTab('restauri');
    ok(!window.__xssSp && document.getElementById('sp-col-restauri').textContent.includes('<img src=x'), 'Testi mostrati come testo, anche nei suggerimenti di targhe e clienti (nessun codice eseguito)');
    fb.scritturaRemota({ 'db/kSA': null, 'db/kSB': null, 'db/kSC': null }, false);
    switchView('board');
  });

  await passo('Telefono: struttura del conto', async () => {
    // le regole del telefono per il conto contano sulla posizione delle celle e dei blocchi
    const j = db.find(x => ['todo', 'doing', 'done'].includes(x.stato));
    openClosingModal(j.id);
    addVoceConto('PROVA STRUTTURA', 10, 22, false, '', 2);
    const tr = [...document.querySelectorAll('#conto-rows tr.voce-row')].pop();
    const td = [...tr.children];
    ok(td.length === 6 && !!td[0].querySelector('.r-desc') && !!td[1].querySelector('.r-price') && !!td[2].querySelector('.r-qty') && td[3].classList.contains('r-tot-display') && td[4].classList.contains('r-imp-display') && !!td[5].querySelector('button'), 'Conto: celle della voce nell\'ordine descrizione, prezzo, quantità, totale, imponibile, ×');
    const mc = document.querySelector('#modal-conto .modal-content');
    ok(!!mc.querySelector(':scope > div[style*="grid-template-columns: 1fr 1fr"] #conto-totale'), 'Conto: acconti e riepilogo nel blocco a due colonne');
    const btn = [...mc.querySelectorAll(':scope > .flex-row.mt-15 > button')];
    ok(btn.length === 4 && /Pre-Conto/.test(btn[2].textContent) && /Chiudi/.test(btn[3].textContent), 'Conto: pulsanti Annulla, Stampa, Salva Pre-Conto, Chiudi e Archivia');
    ok(td[3].textContent.trim() === '20.00 €', 'Conto: totale della voce 10 € × 2 = ' + td[3].textContent.trim());
    closeModal('modal-conto');
  });

  await passo('Backup e ripristino', async () => {
    let blob = null;
    const cou = URL.createObjectURL, clk = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = b => { blob = b; return 'blob:prova'; };
    HTMLAnchorElement.prototype.click = function () {};
    try { await exportData(); } finally { URL.createObjectURL = cou; HTMLAnchorElement.prototype.click = clk; }
    ok(!!blob, 'Backup: file creato');
    const bk = JSON.parse(await blob.text());
    const attese = ['db', 'agenda', 'ledger', 'ordini', 'rubrica', 'note', 'magazzino', 'lista_ordini', 'billing', 'scadenze', 'tagliandi', 'lista_attesa', 'moto_usate', 'ordini_abb', 'garanzie', 'vendite', 'periti', 'libretti_info', 'storico_casse'];
    ok(attese.every(k => k in bk), 'Backup: tutte le 19 sezioni' + (attese.some(k => !(k in bk)) ? ' (mancano: ' + attese.filter(k => !(k in bk)).join(', ') + ')' : ''));
    ok(!('libretti' in bk) && bk._backup && bk._backup.creato && bk.db.length === db.length, 'Backup: lavori presenti, data del backup, file dei libretti esclusi');

    const imp = async (obj, risposta = true) => {
      const conf = window.confirm; let msg = '';
      window.confirm = m => { if (!msg) msg = m; return risposta; };
      const ev = { target: { files: [new File([JSON.stringify(obj)], 'b.json')], value: 'x' } };
      try { importData(ev); for (let i = 0; i < 150 && ev.target.value !== ''; i++) await attendi(20); await attendi(50); } finally { window.confirm = conf; }
      return { msg, ev };
    };
    const ordiniPrima = JSON.stringify(fb.leggi('ordini'));
    const job = { id: 7001, cognome: 'RIPRISTINO', nome: 'PROVA', stato: 'archived', data: '2026-01-01', totale_lordo: 0 };
    const gar = { id: 7002, cognome: 'GARANZIA RIPRISTINATA', stato: 'richiesta' };
    let n = nScr(), r = await imp({ db: [job], garanzie: [gar] }, false);
    ok(nScr() === n && db.some(j => j.id === 1001), 'Ripristino annullato: non cambia niente');
    ok(r.msg.includes('Lavori, preventivi e clienti (1)') && r.msg.includes('Garanzie (1)') && !r.msg.includes('Ordini ricambi') && r.msg.includes('restano come sono'), 'Ripristino: chiede conferma con l\'elenco delle sezioni del file');
    n = nScr(); r = await imp({ pippo: 1 });
    ok(nScr() === n && !r.msg && r.ev.target.value === '', 'Ripristino: un file che non è un backup non cambia niente');
    r = await imp({ db: [job], garanzie: [gar] });
    ok(db.length === 1 && db[0].id === 7001 && Object.values(fb.leggi('db') || {}).length === 1, 'Ripristino parziale: lavori sostituiti nel cloud');
    const gg = Object.values(fb.leggi('garanzie') || {});
    ok(gg.length === 1 && gg[0].id === 7002 && gg[0].cognome === 'GARANZIA RIPRISTINATA', 'Ripristino parziale: garanzie sostituite');
    ok(JSON.stringify(fb.leggi('ordini')) === ordiniPrima, 'Ripristino parziale: gli Ordini, assenti nel file, restano come erano (prima venivano svuotati)');
    r = await imp(bk);
    ok(db.length === bk.db.length && JSON.stringify(fb.leggi('garanzie') ?? null) === JSON.stringify(bk.garanzie ?? null), 'Ripristino completo: tutto torna com\'era');
    switchView('board');
  });

  await passo('Nomi con simboli in tutte le pagine', async () => {
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const lun = new Date(); lun.setDate(lun.getDate() - (lun.getDay() + 6) % 7);
    const X = "D'ANGELO & <xss1>FIGLI</xss1>";
    const orig = window.print; window.print = () => {};
    fb.scritturaRemota({
      'db/kx1': { id: 8101, cognome: X, nome: '<xss1>N</xss1>', tel: '333<xss1>', marca: 'A&B <xss1>', modello: 'M<xss1>', targa: 'ZZ999X', stato: 'archived', data: '2026-02-01', data_chiusura: '2026-02-02', lavori_richiesti: 'CAMBIO <xss1>OLIO</xss1>', conto: [{ desc: '<xss1>VOCE</xss1> & CO', price: 10, qty: 1, iva: 22 }], totale_lordo: 10, clientId: 'c-xss' },
      'db/kx2': { id: 8102, cognome: X, nome: 'APP', marca: 'A&B', modello: '<xss1>', targa: 'ZZ998X', stato: 'todo', data: iso(lun), lavori_richiesti: '<xss1>', totale_lordo: 0, clientId: 'c-xss2' },
      'agenda/kx2': { id: 8103, tipo: 'officina', jobId: 8102, data: iso(lun), ora: '10:00', cliente: X, moto: 'A&B <xss1> - ZZ998X', raw_targa: 'ZZ998X', tel: '333<xss1>' },
      'rubrica/kx': { id: 8104, nome: X, tel: '333<xss1>' },
      'lista_attesa/kx': { id: 8105, cognome: X, nome: '<xss1>', tel: '333', marca: 'A&B', modello: 'M', colore: '<xss1>ROSSO', stato: 'in_attesa', data: iso(lun) },
      'scadenze/kx': { id: 8106, desc: X, categoria: 'altro', importo: 10, scadenza: iso(lun), stato: 'aperta', note: '<xss1>NOTA' }
    }, false);
    const nessuno = dove => {
      const el = [...document.querySelectorAll('xss1')];
      const dovesta = el.map(e => { let p = e.parentElement, str = ''; while (p && !p.id) { str = p.tagName + '>' + str; p = p.parentElement; } return (p ? '#' + p.id : '?') + ' ' + str + ' «' + (e.parentElement.outerHTML || '').slice(0, 90) + '»'; });
      ok(el.length === 0, 'Nomi con simboli: ' + dove + ' mostra il testo senza eseguirlo' + (el.length ? ' — ' + dovesta.slice(0, 2).join(' | ') : ''));
      el.forEach(e => e.remove());
      ok(!/&amp;|&lt;|&#39;/.test(document.body.innerText), 'Nomi con simboli: ' + dove + ' senza simboli doppi (&amp; al posto di &)');
    };
    try {
      switchView('archivio'); refreshArchive();
      nessuno('Anagrafica'); ok(document.getElementById('archive-results').textContent.includes("D'ANGELO & <xss1>FIGLI</xss1>"), 'Nomi con simboli: in Anagrafica si legge il nome intero con apostrofo e &');
      const ba = [...document.querySelectorAll('#archive-results [onclick*="openBillingModal"]')].find(x => x.getAttribute('onclick').includes('c-xss'));
      if (ba) ba.click();
      ok(!!ba && !document.getElementById('modal-billing').classList.contains('hidden') && document.getElementById('billing-cliente-info').textContent.toUpperCase().includes(X.toUpperCase()), 'Nomi con simboli: in Anagrafica il pulsante dati di fatturazione funziona con l\'apostrofo');
      closeModal('modal-billing');
      viewHistoryCognome(safeEncode('c-xss')); nessuno('storico del cliente'); closeModal('modal-storico');
      previewJob(8101); nessuno('anteprima della scheda');
      const bp = document.querySelector('#modal-storico [onclick*="openBillingModal"]');
      if (bp) bp.click();
      ok(!!bp && !document.getElementById('modal-billing').classList.contains('hidden') && document.getElementById('billing-cliente-info').textContent.toUpperCase().includes(X.toUpperCase()), 'Nomi con simboli: nell\'anteprima il pulsante dati di fatturazione funziona con l\'apostrofo');
      closeModal('modal-billing'); closeModal('modal-storico');
      printJobSheet(8101); nessuno('stampa della scheda'); ok(document.getElementById('print-area').textContent.includes('CAMBIO <xss1>OLIO</xss1>'), 'Nomi con simboli: la stampa della scheda riporta i lavori così come sono scritti');
      printInvoice(8101); nessuno('stampa della ricevuta'); ok(document.getElementById('print-area').textContent.includes('<xss1>VOCE</xss1> & CO'), 'Nomi con simboli: la ricevuta riporta la voce così com\'è scritta');
      document.getElementById('print-area').innerHTML = '';
      switchView('agenda'); nessuno('Agenda');
      switchView('tagliandi'); nessuno('Tagliandi');
      switchView('rubrica'); nessuno('Rubrica');
      switchView('lista-attesa'); nessuno('Lista attesa moto');
      switchView('scadenze'); nessuno('Scadenzario');
    } finally {
      window.print = orig;
      fb.scritturaRemota({ 'db/kx1': null, 'db/kx2': null, 'agenda/kx2': null, 'rubrica/kx': null, 'lista_attesa/kx': null, 'scadenze/kx': null }, false);
      switchView('board'); await attendi(200);
    }
  });

  await passo('Scadenze ricorrenti', async () => {
    const casi = [['2026-01-15', 3, null, '2026-04-15'], ['2026-03-10', 1, null, '2026-04-10'], ['2026-01-31', 1, null, '2026-02-28'], ['2028-01-31', 1, null, '2028-02-29'],
      ['2026-02-28', 1, 31, '2026-03-31'], ['2026-03-31', 1, null, '2026-04-30'], ['2026-08-31', 1, null, '2026-09-30'], ['2026-12-31', 2, null, '2027-02-28'], ['2026-11-30', 12, null, '2027-11-30']];
    const sbagliati = casi.filter(([d, m, g, att]) => _aggiungiMesi(d, m, g) !== att).map(([d, m, g, att]) => d + '+' + m + ' = ' + _aggiungiMesi(d, m, g) + ' (atteso ' + att + ')');
    ok(!sbagliati.length, 'Scadenze: date dopo 1–12 mesi giuste anche a fine mese, con l\'ora legale e negli anni bisestili' + (sbagliati.length ? ' — ' + sbagliati.join('; ') : ''));
    const aff = () => scadenzeDB.filter(x => x.desc === 'AFFITTO PROVA').sort((a, b) => a.scadenza.localeCompare(b.scadenza));
    const paga = async id => { await attendi(650); togglePagataScadenza(id); };
    scadenzeDB.push({ id: 9901, desc: 'AFFITTO PROVA', categoria: 'altro', importo: 500, scadenza: '2026-01-31', note: '', ricorrenza: 'mensile', stato: 'aperta' });
    saveScadenzeDB();
    await paga(9901);
    let a = aff();
    ok(a.length === 2 && a[1].scadenza === '2026-02-28' && a[0].stato === 'pagata', 'Scadenze: pagando quella del 31/01 la successiva è il 28/02 (prima veniva il 03/03, saltando febbraio)');
    const feb = a[1].id;
    await paga(feb);
    a = aff();
    ok(a.length === 3 && a[2].scadenza === '2026-03-31', 'Scadenze: dopo febbraio si torna al 31 (31/03, non 28/03)');
    await paga(feb);
    a = aff();
    ok(a.length === 2 && a[1].stato === 'aperta' && a[1].scadenza === '2026-02-28', 'Scadenze: rimessa "da pagare" per sbaglio, la successiva creata dal pagamento viene tolta');
    await paga(feb);
    a = aff();
    ok(a.length === 3 && a.filter(x => x.scadenza === '2026-03-31').length === 1, 'Scadenze: ripagandola non nascono doppioni');
    ok(Object.values(fb.leggi('scadenze') || {}).filter(x => x && x.desc === 'AFFITTO PROVA').length === 3, 'Scadenze: salvate nel cloud');
    // modifica di una scadenza pagata: la data del pagamento resta
    const gen = a[0];
    campo('scad-edit-id', gen.id); campo('scad-desc', 'AFFITTO PROVA'); campo('scad-data', gen.scadenza); campo('scad-importo', '550'); campo('scad-note', ''); campo('scad-ricorrenza', 'mensile');
    salvaScadenza();
    const g2 = scadenzeDB.find(x => x.id === gen.id);
    ok(g2.importo === 550 && g2.stato === 'pagata' && !!g2.data_pagamento && String(g2.prossima_id) === String(feb), 'Scadenze: modificando una scadenza pagata restano la data del pagamento e il collegamento alla successiva');
    scadenzeDB = scadenzeDB.filter(x => x.desc !== 'AFFITTO PROVA'); saveScadenzeDB();
    await attendi(650);
    switchView('board');
  });

  await passo('Telefono: avvisi su Altro, Lavori Lunghi, Vendite', async () => {
    const gb = document.getElementById('gar-badge'), sb = document.getElementById('scadenze-badge'), tb = document.getElementById('tb-badge-altro');
    const g0 = [gb.style.display, gb.textContent], s0 = [sb.style.display, sb.textContent];
    gb.style.display = 'inline'; gb.textContent = '2'; sb.style.display = 'inline'; sb.textContent = '1';
    await attendi(30);
    ok(!tb.hidden && tb.textContent === '3', 'Altro: pallino con garanzie da contattare + scadenze (' + tb.textContent + ')');
    gb.style.display = 'none'; sb.style.display = 'none';
    await attendi(30);
    ok(tb.hidden, 'Altro: senza avvisi il pallino sparisce');
    gb.style.display = g0[0]; gb.textContent = g0[1]; sb.style.display = s0[0]; sb.textContent = s0[1];
    await attendi(30);

    fb.scritturaRemota({
      'db/kLA': { id: 8201, stato: 'special', special_cat: 'restauri', data: oggi, cognome: 'ANTICIPO', marca: 'GUZZI', modello: 'V7', conto: [{ desc: 'X', price: 350, qty: 1, iva: 22 }], totale_lordo: 350, acconti: [{ val: 500, date: oggi }] },
      'db/kLB': { id: 8202, stato: 'special', special_cat: 'restauri', data: oggi, cognome: 'PARI', marca: 'GUZZI', modello: 'V7', conto: [{ desc: 'X', price: 200, qty: 1, iva: 22 }], totale_lordo: 200, acconti: [{ val: 200, date: oggi }] }
    }, false);
    switchView('specials'); setSpTab('restauri');
    const testo = document.getElementById('view-specials').textContent;
    ok(testo.includes('anticipo in più € 150.00') && testo.includes('acconti = totale attuale') && !/saldato/i.test(testo), 'Lavori Lunghi: niente "saldato" sui lavori aperti; anticipo in più o acconti = totale attuale come in Bacheca');
    fb.scritturaRemota({ 'db/kLA': null, 'db/kLB': null }, false);

    switchView('vendite');
    const vis = e => !!e && e.style.display !== 'none' && e.offsetParent !== null;
    ok(venditeDB.length > 0 ? (!vis(document.getElementById('vend-btn-import')) && vis(document.getElementById('vend-import-link'))) : vis(document.getElementById('vend-btn-import')), 'Vendite: "Importa dal vecchio programma" in evidenza solo finché l\'archivio è vuoto, poi un link discreto in fondo');
    ok(!!document.getElementById('vd-btn-salva-mob') && getComputedStyle(document.getElementById('vd-btn-salva-mob')).display === 'none', 'Vendite: il Salva fisso del telefono non compare sul Mac');
    switchView('board');
  });

  await passo('Passaporto della moto', async () => {
    fb.scritturaRemota({
      'db/kp1': { id: 8301, cognome: 'PASSA', nome: 'PORTO', tel: '3331234567', marca: 'HONDA', modello: 'SH 300', targa: 'PP 123 AA', km: '9.800', stato: 'archived', data: '2025-03-01', data_chiusura: '2025-03-03', lavori_richiesti: 'NOTA PRIVATA CLIENTE', conto: [{ desc: 'TAGLIANDO', price: 140, qty: 1, iva: 22 }], totale_lordo: 140, clientId: 'c-pp' },
      'db/kp2': { id: 8302, cognome: 'PASSA', nome: 'PORTO', tel: '3331234567', marca: 'HONDA', modello: 'SH 300', targa: 'PP123AA', km: '20300', stato: 'done', data: '2026-04-08', data_chiusura: '2026-04-10', conto: [{ desc: 'Tagliando completo', price: 180, qty: 1, iva: 22 }, { desc: 'OLIO MOTUL 7100', price: 15, qty: 2, iva: 22 }, { desc: 'SCONTO FEDELTA', price: -10, qty: 1, iva: 22 }], totale_lordo: 200, clientId: 'c-pp' },
      'db/kp3': { id: 8303, cognome: 'PASSA', targa: 'PP123AA', stato: 'doing', data: oggi, conto: [{ desc: 'IN CORSO', price: 50, qty: 1 }], clientId: 'c-pp' },
      'tagliandi/PP123AA': { data: '2027-04-10', km: '20300' }
    }, false);
    await attendi(50);
    apriPassaporto(safeEncode('PP123AA'));
    ok(!document.getElementById('modal-passaporto').classList.contains('hidden') && document.getElementById('pp-corpo').textContent.includes('Attiva passaporto'), 'Passaporto: si apre la finestra con "Attiva passaporto"');
    window.QRCode = function (el) { const c = document.createElement('canvas'); c.width = c.height = 10; el.appendChild(c); };
    window.QRCode.CorrectLevel = { M: 0 };
    attivaPassaporto(safeEncode('PP123AA'));
    await attendi(80);
    const idx = fb.leggi('passaporti_idx/PP123AA') || {};
    ok(/^[A-HJ-NP-Z2-9]{12}$/.test(idx.codice || '') && idx.attivo === true, 'Passaporto: attivato con un codice di 12 caratteri impossibile da indovinare');
    const pag = fb.leggi('passaporti/' + idx.codice) || {};
    ok(pag.moto === 'HONDA SH 300' && pag.targa === 'PP1••AA' && pag.km === 20300 && pag.dal === '2025-03' && pag.prossimo === '2027-04-10', 'Passaporto: moto, targa parziale, km, "seguita dal" e prossimo tagliando (' + [pag.moto, pag.targa, pag.km, pag.dal, pag.prossimo].join(' | ') + ')');
    const iv = Object.values(pag.interventi || {});
    ok(iv.length === 2 && iv[0].data === '2026-04-10' && iv[0].titolo === 'TAGLIANDO COMPLETO' && JSON.stringify(Object.values(iv[0].voci || {})) === '["OLIO MOTUL 7100 ×2"]' && iv[1].km === 9800, 'Passaporto: solo i lavori chiusi, dal più recente, con le voci del conto e le quantità');
    ok(!/PASSA|PORTO\b|3331234567|NOTA PRIVATA|SCONTO|price|IN CORSO/i.test(JSON.stringify(pag)), 'Passaporto: online niente nome, telefono, note, sconti, prezzi né lavori in corso');
    ok(!!document.querySelector('#pp-corpo a[href="https://motogaragemarcello.github.io/passaporto/#' + idx.codice + '"]'), 'Passaporto: il link porta al nuovo indirizzo motogaragemarcello.github.io/passaporto');
    ok((document.getElementById('pp-codice') || {}).textContent === _codiceLeggibile(idx.codice) && /^MGM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(_codiceLeggibile(idx.codice)), 'Passaporto: la finestra mostra il codice da scrivere a mano ' + _codiceLeggibile(idx.codice));
    fb.scritturaRemota({ 'db/kp4': { id: 8304, cognome: 'PASSA', targa: 'PP123AA', km: '25000', stato: 'archived', data: '2026-09-01', data_chiusura: '2026-09-02', conto: [{ desc: 'PASTIGLIE', price: 60, qty: 1 }], clientId: 'c-pp' } }, false);
    await attendi(1900);
    const pag2 = fb.leggi('passaporti/' + idx.codice) || {};
    ok(Object.values(pag2.interventi || {}).length === 3 && pag2.km === 25000, 'Passaporto: si aggiorna da solo quando si chiude un altro lavoro della moto');
    ok(!('anno' in pag2), 'Passaporto: senza anno della moto il campo non c\'è');
    fb.scritturaRemota({ 'db/kp4/anno': '2019' });
    await attendi(1900);
    ok((fb.leggi('passaporti/' + idx.codice) || {}).anno === '2019', 'Passaporto: scritto l\'anno della moto, il passaporto si aggiorna da solo');
    let n = nScr();
    fb.scritturaRemota({ 'db/kp5': { id: 8305, cognome: 'ALTRO', targa: 'ZZ000ZZ', stato: 'archived', data: '2026-01-01' } }, false);
    await attendi(1900);
    ok(!chiaviDa(n).some(k => String(k).startsWith('passaporti')), 'Passaporto: una modifica a un\'altra moto non lo riscrive');
    viewHistoryCognome(safeEncode('c-pp'));
    const st = document.getElementById('st-corpo').textContent;
    ok(st.includes('PP123AA') && st.includes('passaporto attivo'), 'Passaporto: nello storico del cliente c\'è il pulsante della moto');
    closeModal('modal-storico');
    switchView('board'); refreshBoard();
    ok(document.getElementById('view-board').innerHTML.includes("apriPassaporto('PP123AA')"), 'Passaporto: voce nel menu ⋯ della Bacheca');
    ok((fb.leggi('passaporti_idx/PP123AA') || {}).da_stampare === true, 'Passaporto: appena attivato, l\'adesivo è nel foglio da stampare');
    const pg = _impaginaAdesivi(13, 5);
    ok(pg.length === 2 && pg[0].slice(0, 4).every(c => c === null) && pg[0][4] === 0 && pg[0][11] === 7 && pg[1][0] === 8 && pg[1][4] === 12 && pg[1][5] === null, 'Foglio adesivi: 12 per foglio, si parte dalla casella scelta e si continua sul foglio dopo');
    scegliPartenzaFoglio(5);
    ok(document.querySelectorAll('#pp-griglia .pp-casella').length === 12 && document.getElementById('pp-corpo').textContent.includes('Le prime 4 caselle restano vuote'), 'Foglio adesivi: griglia di 12 caselle, partenza dalla casella 5');
    const orig = window.print, conf = window.confirm; window.print = () => {}; window.confirm = () => true;
    stampaFoglioAdesivi(); await attendi(300);
    const pa = document.getElementById('print-area');
    const celle = [...pa.querySelectorAll('.pp-pagina .pp-cella')];
    ok(celle.length === 12 && celle.findIndex(c => c.querySelector('.pp-ad')) === 4 && pa.querySelectorAll('.pp-ad').length === 1 && pa.textContent.includes(_codiceLeggibile(idx.codice)) && pa.textContent.includes('HONDA SH 300 · PP123AA') && !pa.textContent.includes('PASSA PORTO'), 'Foglio adesivi: l\'adesivo è nella casella 5 con codice e moto, senza il nome del cliente');
    window.dispatchEvent(new Event('afterprint')); await attendi(500);
    ok(!(fb.leggi('passaporti_idx/PP123AA') || {}).da_stampare && _ppPartenza === 1, 'Foglio adesivi: dopo la stampa confermata l\'adesivo esce dall\'elenco');
    window.print = orig; window.confirm = conf;
    const ti = (v, l) => _titoloIntervento(v, l);
    const t1 = ti(['FILTRO OLIO', 'LAVORO', 'OLIO MOTORE']);
    ok(t1.titolo === 'TAGLIANDO' && JSON.stringify(t1.voci) === '["FILTRO OLIO","LAVORO","OLIO MOTORE"]', 'Passaporto: olio motore + filtro olio = TAGLIANDO come prima riga, con le voci sotto');
    ok(ti(['LAVORO', 'TAGLIANDO 20.000 KM', 'CANDELA']).titolo === 'TAGLIANDO 20.000 KM' && ti(['LAVORO'], 'fare il tagliando e controllo freni').titolo === 'TAGLIANDO' && ti(['GOMME', 'LAVORO']).titolo === 'GOMME' && ti(['OLIO FORCELLA', 'LAVORO']).titolo === 'OLIO FORCELLA', 'Passaporto: "tagliando" nelle voci o nei lavori diventa il titolo; senza tagliando resta la prima voce');
    disattivaPassaporto(safeEncode('PP123AA')); await attendi(80);
    ok(fb.leggi('passaporti/' + idx.codice) == null && (fb.leggi('passaporti_idx/PP123AA') || {}).attivo === false, 'Passaporto: disattivato, la pagina online sparisce');
    attivaPassaporto(safeEncode('PP123AA')); await attendi(80);
    ok((fb.leggi('passaporti_idx/PP123AA') || {}).codice === idx.codice && !!fb.leggi('passaporti/' + idx.codice), 'Passaporto: riattivato con lo stesso codice, l\'adesivo già attaccato torna a funzionare');
    closeModal('modal-passaporto');
    delete window.QRCode;
    fb.scritturaRemota({ 'db/kp1': null, 'db/kp2': null, 'db/kp3': null, 'db/kp4': null, 'db/kp5': null, 'tagliandi/PP123AA': null, 'passaporti_idx/PP123AA': null, ['passaporti/' + idx.codice]: null }, false);
    await attendi(1900);
  });

  await passo('Meteo in Agenda', async () => {
    const riga = (time, sym, mm, sei) => ({ time, data: { instant: { details: { air_temperature: 15 } }, [sei ? 'next_6_hours' : 'next_1_hours']: { summary: { symbol_code: sym }, details: { precipitation_amount: mm } } } });
    const serie = r => ({ properties: { timeseries: r } });
    // Lettura dei dati del servizio
    const g = _meteoDaServizio(serie([
      riga('2026-11-03T09:00:00Z', 'rain', 3), riga('2026-11-03T10:00:00Z', 'lightrain', 2),
      riga('2026-11-04T02:00:00Z', 'heavyrain', 20), riga('2026-11-04T09:00:00Z', 'clearsky_day', 0),
      riga('2026-11-05T09:00:00Z', 'lightrain', 0.5),
      riga('2026-11-06T06:00:00Z', 'rainandthunder', 4, true), riga('2026-11-06T12:00:00Z', 'cloudy', 0, true), riga('2026-11-06T18:00:00Z', 'heavyrain', 30, true),
      riga('2026-11-07T09:00:00Z', 'partlycloudy_day', 0), riga('2026-11-07T10:00:00Z', 'partlycloudy_day', 0), riga('2026-11-07T11:00:00Z', 'cloudy', 0),
      riga('2026-07-03T04:00:00Z', 'rain', 9), riga('2026-07-03T05:00:00Z', 'fog', 0),
      riga('2026-11-08T23:00:00Z', 'fair_night', 0)
    ]));
    ok(g['2026-11-03'].pioggia && g['2026-11-03'].mm === 5 && g['2026-11-03'].testo === '🌧️ Pioggia 5 mm · 15°', 'Meteo: pioggia nelle ore di lavoro sommata (5 mm)');
    ok(!g['2026-11-04'].pioggia && g['2026-11-04'].testo.includes('Sereno'), 'Meteo: la pioggia di notte non conta');
    ok(!g['2026-11-05'].pioggia && g['2026-11-05'].poca && g['2026-11-05'].testo.includes('Poca pioggia'), 'Meteo: sotto 1 mm è "poca pioggia"');
    ok(!g['2026-11-03'].poca && !g['2026-11-04'].poca, 'Meteo: "poca pioggia" né sui giorni di pioggia né su quelli asciutti');
    ok(g['2026-11-06'].pioggia && g['2026-11-06'].mm === 4 && g['2026-11-06'].testo.includes('⛈️ Temporali'), 'Meteo: blocchi di 6 ore, quello della sera escluso');
    ok(g['2026-11-07'].testo.includes('Variabile'), 'Meteo: senza pioggia vale il tempo prevalente');
    ok(!g['2026-07-03'].pioggia && g['2026-07-03'].testo.includes('Nebbia'), 'Meteo: ora italiana anche d\'estate (le 04 UTC sono le 6, le 05 UTC sono le 7)');
    ok(!g['2026-11-08'] && !g['2026-11-09'], 'Meteo: le 23 UTC sono le 0 del giorno dopo, fuori dalle ore di lavoro');
    ok(_classeMeteo('lightssleetshowersandthunder_day') === 'temporale' && _classeMeteo('partlycloudy_night') === 'variabile' && _classeMeteo('fair_day') === 'sereno', 'Meteo: simboli del servizio riconosciuti');

    // Giorno di pioggia e giorno asciutto nella stessa settimana o dopo
    const piu = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return formatDateISO(x); };
    const nonDom = d => new Date(d + 'T12:00:00').getDay() === 0 ? piu(d, 1) : d;
    const dP = nonDom(piu(oggi, 1)), dA = nonDom(piu(dP, 1)), dL = nonDom(piu(dA, 1));
    const lun = new Date(dP + 'T12:00:00'); lun.setDate(lun.getDate() - ((lun.getDay() + 6) % 7)); lun.setHours(0, 0, 0, 0);
    const settPrima = dataInizioSettimana; dataInizioSettimana = lun;
    const apDati = (id, cliente, extra) => Object.assign({ id, tipo: 'officina', data: dP, ora: '09:00', cliente, moto: 'HONDA CB - MT0001', tel: '3331230000', note: '', raw_nome: 'MARIO', raw_cognome: 'ROSSI', raw_marca: 'HONDA', raw_modello: 'CB', raw_targa: 'MT0001', jobId: null }, extra || {});
    fb.scritturaRemota({
      'db/-Nmt9': { id: 7799, stato: 'doing', data: dP, cognome: 'GIAPONTE', nome: 'A', targa: 'MT0009', conto: [], totale_lordo: 0, clientId: 'c-mt9' },
      'agenda/-Nmt1': apDati(7701, 'ROSSI MARIO'),
      'agenda/-Nmt2': apDati(7702, 'SENZA <b>TEL</b>', { tel: '', ora: '08:00' }),
      'agenda/-Nmt3': apDati(7703, 'BOLLO', { tipo: 'personale', tel: '3331230003' }),
      'agenda/-Nmt4': apDati(7704, 'GIAPONTE A', { jobId: 7799, tel: '3331230004' }),
      'agenda/-Nmt5': apDati(7705, 'OGGI PIOGGIA', { data: oggi, tel: '3331230005' }),
      'agenda/-Nmt6': apDati(7706, 'LONTANO PIOGGIA', { data: dL, tel: '3331230006' }),
      'agenda/-Nmt7': apDati(7707, 'SECONDO GIORNO', { data: dA, tel: '3331230007' })
    }, false);

    // Servizio non raggiungibile: l'Agenda funziona lo stesso
    window.__meteoRisposta = null; _meteo = null; _meteoProva = 0;
    switchView('agenda'); await attendi(60);
    const griglia = () => document.getElementById('agenda-grid');
    ok(griglia().textContent.includes('ROSSI MARIO') && !griglia().querySelector('.agenda-meteo') && !griglia().querySelector('.agenda-meteo-btn'), 'Meteo non raggiungibile: Agenda normale, senza riga del meteo né errori');
    const provePrima = window.__meteoChiamate;
    refreshAgenda(); await attendi(30);
    ok(window.__meteoChiamate === provePrima, 'Meteo non raggiungibile: non richiama il servizio a ogni aggiornamento (riprova dopo 5 minuti)');

    // Risposta senza senso: nessun blocco
    window.__meteoRisposta = { errore: true }; _meteoProva = 0; refreshAgenda(); await attendi(30);
    ok(griglia().textContent.includes('ROSSI MARIO') && !griglia().querySelector('.agenda-meteo'), 'Meteo con risposta sbagliata: Agenda normale');

    // Servizio che risponde
    window.__meteoRisposta = serie([riga(dP + 'T09:00:00Z', 'rain', 3), riga(dP + 'T10:00:00Z', 'rain', 2), riga(dA + 'T09:00:00Z', 'clearsky_day', 0), riga(oggi + 'T09:00:00Z', 'rain', 4), riga(dL + 'T09:00:00Z', 'rain', 4)]);
    _meteoProva = 0; refreshAgenda(); await attendi(60);
    const colonna = d => [...griglia().querySelectorAll('.agenda-day')].find(c => (c.getAttribute('ondrop') || '').includes(d));
    const cP = colonna(dP);
    ok(cP.querySelector('.agenda-meteo.pioggia') && cP.querySelector('.agenda-meteo').textContent.includes('🌧️ Pioggia 5 mm'), 'Agenda: il giorno di pioggia mostra pioggia e millimetri');
    ok(cP.querySelector('.agenda-meteo-btn').textContent.includes('Chiedi conferma (2)'), 'Agenda: "Chiedi conferma" conta solo i clienti con la moto non ancora in officina (no scadenze personali, no moto sul ponte)');
    ok(_meteoDelGiorno(oggi).pioggia && _htmlMeteoGiorno(oggi).includes('Pioggia') && !_htmlMeteoGiorno(oggi).includes('agenda-meteo-btn'), 'Chiedi conferma: mai sul giorno di oggi, anche se piove e ci sono clienti');
    ok(_meteoDelGiorno(dL).pioggia && _htmlMeteoGiorno(dL).includes('Pioggia') && !_htmlMeteoGiorno(dL).includes('agenda-meteo-btn'), 'Chiedi conferma: non dal terzo giorno di lavoro in poi');
    {
      const asciutto = _meteo.giorni[dA]; _meteo.giorni[dA] = _meteo.giorni[dP];
      ok(_htmlMeteoGiorno(dA).includes('agenda-meteo-btn'), 'Chiedi conferma: compare anche sul secondo giorno di lavoro, se piove');
      _meteo.giorni[dA] = asciutto;
      const due = (da, a, b) => uguali(_giorniConfermaMeteo(da), [a, b]);
      ok(due('2026-11-02', '2026-11-03', '2026-11-04') && due('2026-11-05', '2026-11-06', '2026-11-07'), 'Chiedi conferma: in settimana i 2 giorni successivi');
      ok(due('2026-11-06', '2026-11-07', '2026-11-09') && due('2026-11-07', '2026-11-09', '2026-11-10') && due('2026-11-08', '2026-11-09', '2026-11-10'), 'Chiedi conferma: la domenica non conta (venerdì → sabato e lunedì, sabato → lunedì e martedì)');
      ok(due('2026-10-30', '2026-10-31', '2026-11-02'), 'Chiedi conferma: anche a cavallo del mese');
      // Poca pioggia: pulsante sì, messaggio più leggero, nessun avviso nei moduli
      _meteo.giorni[dA] = _meteoDaServizio(serie([riga(dA + 'T09:00:00Z', 'lightrain', 0.3)]))[dA];
      ok(_htmlMeteoGiorno(dA).includes('agenda-meteo-btn') && !_htmlMeteoGiorno(dA).includes('agenda-meteo pioggia'), 'Poca pioggia: pulsante "Chiedi conferma" presente, riga del meteo normale');
      const mPoca = _testoConfermaMeteo(agendaDB.find(a => a.id === 7707));
      ok(mPoca.includes("è prevista un po' di pioggia: mi confermi che porti la moto alle 09:00?"), 'Poca pioggia: il messaggio dice "un po\' di pioggia"');
      ok(_testoConfermaMeteo(agendaDB.find(a => a.id === 7701)).includes('è prevista pioggia:'), 'Pioggia: il messaggio resta "è prevista pioggia"');
      apriConfermeMeteo(dA);
      ok(document.getElementById('cm-titolo').textContent.includes('Poca pioggia') && document.getElementById('cm-elenco').textContent.includes('SECONDO GIORNO'), 'Poca pioggia: la finestra si apre con il titolo giusto');
      closeModal('modal-conferme-meteo');
      apriModalApp(dA); await attendi(20);
      ok(document.getElementById('app-meteo-avviso').classList.contains('hidden'), 'Poca pioggia: nessun avviso quando fissi un appuntamento');
      switchView('agenda'); await attendi(20);
      ok(!!localStorage.getItem('mgMeteo2'), 'Meteo: previsioni ricordate sul dispositivo');
      _meteo.giorni[dA] = asciutto;
      refreshAgenda();
    }
    const cA = colonna(dA);
    if (cA) ok(!cA.querySelector('.agenda-meteo.pioggia') && !cA.querySelector('.agenda-meteo-btn'), 'Agenda: giorno asciutto senza pulsante');
    const chiamate = window.__meteoChiamate;
    refreshAgenda(); refreshAgenda(); await attendi(30);
    ok(window.__meteoChiamate === chiamate, 'Meteo: al massimo una richiesta all\'ora');
    ok(document.getElementById('view-agenda').textContent.includes('MET Norway') && document.getElementById('view-agenda').textContent.includes('CC BY 4.0'), 'Agenda: fonte dei dati indicata (richiesta dalla licenza)');
    ok(_meteoDelGiorno('2020-01-01') === null, 'Meteo: niente previsioni per i giorni passati');

    // Finestra e messaggio
    apriConfermeMeteo(dP);
    const elenco = document.getElementById('cm-elenco');
    ok(!document.getElementById('modal-conferme-meteo').classList.contains('hidden') && elenco.textContent.includes('ROSSI MARIO') && !elenco.textContent.includes('BOLLO') && !elenco.textContent.includes('GIAPONTE'), 'Chiedi conferma: elenco giusto');
    ok(elenco.textContent.includes('SENZA <b>TEL</b>') && !elenco.querySelector('b') && elenco.textContent.includes('Manca il telefono'), 'Chiedi conferma: nomi con simboli come scritti, avviso se manca il telefono');
    const op = window.open; let wa = '';
    window.open = u => { wa = String(u); return null; };
    const nW = nScr();
    try { scriviConfermaMeteo(7701); } finally { window.open = op; }
    await attendi(30);
    const msg = decodeURIComponent(wa);
    ok(wa.startsWith('https://wa.me/393331230000') && msg.includes('Ciao MARIO, ' + _quandoMeteo(dP) + ' è prevista pioggia: mi confermi che porti la moto alle 09:00?'), 'Chiedi conferma: messaggio che chiede solo di confermare');
    ok(!msg.toLowerCase().includes('spostare'), 'Chiedi conferma: il messaggio non propone di spostare');
    ok(recordDi('agenda', 7701).meteo_chiesto === dP, 'Chiedi conferma: resta segnato nel cloud');
    ok(chiaviDa(nW).length > 0 && chiaviDa(nW).every(k => k.startsWith('agenda/-Nmt1')), 'Chiedi conferma: salva solo quell\'appuntamento');
    ok(elenco.textContent.includes('Scritto'), 'Chiedi conferma: la riga diventa "Scritto"');
    const cP2 = colonna(dP);
    ok(cP2.querySelector('.agenda-meteo-btn').textContent.includes('Chiedi conferma (1)') && cP2.textContent.includes('Conferma chiesta'), 'Agenda: il numero scende e la scheda mostra "Conferma chiesta"');
    closeModal('modal-conferme-meteo');

    // Avviso nei moduli
    const avv = id => document.getElementById(id);
    apriModalApp(dP); await attendi(20);
    ok(!avv('app-meteo-avviso').classList.contains('hidden') && avv('app-meteo-avviso').textContent.includes('prevista pioggia (5 mm)') && avv('app-meteo-avviso').textContent.includes('Primo giorno con poca o nessuna pioggia: ' + _giornoMeteo(dA)) && /^\S+ [A-ZÀ-Ú]/.test(avv('app-meteo-avviso').textContent), 'Nuovo appuntamento: avviso di pioggia con il primo giorno con poca o nessuna pioggia, giorno con la maiuscola');
    campo('app_tipo', 'personale'); toggleAppFields();
    ok(avv('app-meteo-avviso').classList.contains('hidden'), 'Nuovo appuntamento: nessun avviso sulle scadenze personali');
    campo('app_tipo', 'officina'); toggleAppFields();
    campo('app_data', dA); refreshMiniAppAgenda();
    ok(avv('app-meteo-avviso').classList.contains('hidden'), 'Nuovo appuntamento: nessun avviso nei giorni asciutti');
    switchView('agenda'); await attendi(30);

    // Modificare l'appuntamento conserva la conferma; cambiando giorno non vale più
    modificaApp(7701); await attendi(20);
    ok(!avv('m_app-meteo-avviso').classList.contains('hidden'), 'Finestra appuntamento: avviso di pioggia anche qui');
    campo('m_app_note', 'NOTA METEO'); salvaAppuntamento(); await attendi(30);
    ok(recordDi('agenda', 7701).meteo_chiesto === dP && recordDi('agenda', 7701).note === 'NOTA METEO', 'Modificando l\'appuntamento la conferma chiesta non si perde');
    modificaApp(7701); await attendi(20);
    campo('m_app_data', dA); salvaAppuntamento(); await attendi(30);
    const spostato = agendaDB.find(a => a.id === 7701);
    ok(spostato.data === dA && !_clientiConfermaMeteo(dP).some(a => a.id === 7701) && !_renderAgendaCard(spostato).includes('Conferma chiesta'), 'Spostando l\'appuntamento a un altro giorno "Conferma chiesta" sparisce');

    // Previsioni troppo vecchie
    const ora = _meteo.ora; _meteo.ora = Date.now() - 25 * 3600000;
    ok(_meteoDelGiorno(dP) === null, 'Meteo: previsioni di oltre 24 ore fa non si mostrano');
    _meteo.ora = ora;

    // Pulizia
    const jobNuovi = db.filter(j => String(j.cognome || '') === 'ROSSI' && j.targa === 'MT0001');
    const pul = { 'db/-Nmt9': null, 'agenda/-Nmt1': null, 'agenda/-Nmt2': null, 'agenda/-Nmt3': null, 'agenda/-Nmt4': null, 'agenda/-Nmt5': null, 'agenda/-Nmt6': null, 'agenda/-Nmt7': null };
    jobNuovi.forEach(j => { const k = chiaveDi('db', j.id); if (k) pul['db/' + k] = null; });
    fb.scritturaRemota(pul, false);
    dataInizioSettimana = settPrima; window.__meteoRisposta = null; _meteo = null;
    try { localStorage.removeItem('mgMeteo2'); } catch (e) {}
    switchView('board'); await attendi(50);
  });

  await passo('Ordini e Anagrafica', async () => {
    fb.scritturaRemota({ 'db/kra1': { id: 8401, cognome: 'RICAMBIO', nome: 'ATTESO', tel: '3331112222', marca: 'YAMAHA', modello: 'TMAX', targa: 'RC 123 AA', stato: 'archived', data: '2026-05-01', data_chiusura: '2026-05-03', clientId: 'c-rc', conto: [], totale_lordo: 0 } }, false);
    await attendi(50);
    switchView('ordini'); svuotaModuloOrdine();
    campo('ord_cerca', 'ricambio atteso'); cercaClienteOrdine();
    const righe = [...document.querySelectorAll('#ord-cerca-results .ord-cerca-riga')];
    ok(righe.length === 1 && righe[0].textContent.includes('RICAMBIO ATTESO') && righe[0].textContent.includes('nessun lavoro aperto'), 'Ordine: la ricerca trova il cliente dell\'Anagrafica anche senza lavori aperti');
    righe[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const val = id => document.getElementById(id).value;
    ok(val('ord_cliente') === 'RICAMBIO ATTESO' && val('ord_tel_cliente') === '3331112222' && val('ord_client_id') === 'c-rc' && chiaveTarga(val('ord_targa')) === 'RC123AA' && val('ord_job') === '' && document.getElementById('ord-collegato').textContent.includes('si collegherà da solo'), 'Ordine: scelto il cliente si compilano nome, telefono e moto, con l\'avviso che si collegherà alla scheda');
    campo('ord_desc', 'pastiglie attese'); campo('ord_prezzo_cliente', '40'); addOrdine();
    let o = ordiniDB.find(x => x.desc === 'PASTIGLIE ATTESE');
    ok(o && o.clientId === 'c-rc' && chiaveTarga(o.targa) === 'RC123AA' && o.moto === 'YAMAHA TMAX' && (o.jobId == null || o.jobId === ''), 'Ordine: salvato con cliente e moto anche senza lavoro aperto');
    switchView('archivio'); campo('search-input', 'ricambio atteso'); refreshArchive();
    ok(document.getElementById('archive-results').textContent.includes('1 ricambio in attesa'), 'Anagrafica: nella scheda del cliente "📦 1 ricambio in attesa"');
    viewHistoryCognome(safeEncode('c-rc'));
    ok(((document.getElementById('st-ricambi') || {}).textContent || '').includes('PASTIGLIE ATTESE'), 'Anagrafica: lo storico del cliente elenca i ricambi ordinati');
    closeModal('modal-storico'); campo('search-input', ''); refreshArchive();
    fb.scritturaRemota({ 'db/kra2': { id: 8402, cognome: 'RICAMBIO', nome: 'ATTESO', tel: '3331112222', marca: 'YAMAHA', modello: 'TMAX', targa: 'RC123AA', stato: 'todo', data: oggi, clientId: 'c-rc', conto: [], totale_lordo: 0 } }, false);
    await attendi(200);
    o = ordiniDB.find(x => x.desc === 'PASTIGLIE ATTESE');
    ok(o && String(o.jobId) === '8402' && _ordiniDelJob(8402).length === 1, 'Arriva la moto: il ricambio si collega da solo alla scheda nuova ("Attesa ricambi")');
    ok((recordDi('db', 8402).conto || []).some(c => String(c.ordine_id) === String(o.id)), 'Arriva la moto: il ricambio entra nel conto della scheda');
    const toast = document.querySelector('.toast-msg');
    ok(!!toast && /Collegato 1 ricambio già ordinato per YAMAHA TMAX RC123AA/.test(toast.textContent), 'Arriva la moto: avviso "Collegato 1 ricambio già ordinato" (' + (toast ? toast.textContent : '') + ')');
    ok(_ordiniDelCliente('c-x', 'VECCHIO', 'ORDINE', [], []).length === 0 && (ordiniDB.push({ id: 8499, desc: 'PROVA NOME', cliente: 'ordine  vecchio', stato: 'todo' }), _ordiniDelCliente('c-x', 'VECCHIO', 'ORDINE', [], []).length === 1), 'Anagrafica: anche gli ordini vecchi senza cliente collegato si ritrovano dal nome (in qualsiasi ordine)');
    ordiniDB = ordiniDB.filter(x => x.desc !== 'PASTIGLIE ATTESE' && x.id !== 8499); saveOrdini();
    fb.scritturaRemota({ 'db/kra1': null, 'db/kra2': null }, false);
    await attendi(150);
    cancelEditOrdine(); switchView('board');
  });

  await passo('Menu laterale senza doppioni', async () => {
    toggleSidebar();
    const voce = id => document.querySelector('.sidebar .nav-link[data-nav-id="' + id + '"]');
    const nascosta = id => getComputedStyle(voce(id)).display === 'none';
    ok(['board', 'nuova', 'agenda', 'archivio', 'magazzino', 'ordini', 'garanzie', 'preventivi', 'nuovo-cliente', 'specials', 'incidentate'].every(nascosta), 'Menu: sul Mac le sezioni già nella barra in alto non si ripetono');
    ok(['tagliandi', 'ledger', 'scadenze', 'lista-attesa', 'usate', 'vendite', 'stats', 'appunti', 'rubrica', 'export', 'backup', 'ripristina'].every(id => !nascosta(id)), 'Menu: restano le sezioni che non sono in alto e gli strumenti');
    const esci = document.getElementById('btn-logout'), tema = document.querySelector('.sidebar .tema-sfondo');
    ok(!!(tema.compareDocumentPosition(esci) & Node.DOCUMENT_POSITION_FOLLOWING), 'Menu: "Esci" in fondo, sotto i colori del tema');
    toggleSidebar();
  });

  await passo('Trascinare in Fatto apre il conto', async () => {
    switchView('board');
    db.push({ id: 1990, stato: 'doing', data: getOggiLocale(), cognome: 'TRASCINA', nome: 'PROVA', targa: 'TR123AA', marca: 'HONDA', modello: 'SH', lavori_richiesti: 'TAGLIANDO',
      conto: [{ desc: 'OLIO 10W40', price: 15, qty: 2, iva: 22, mag_codice: 'OLIO-01' }], acconti: [] });
    saveDB();
    await attendi(50);
    const prima = fb.leggi('magazzino/OLIO-01').giacenza;
    const ev = { preventDefault() {}, target: document.body, dataTransfer: { getData: () => '1990' } };
    dropBoard(ev, 'done');
    ok(!document.getElementById('modal-conto').classList.contains('hidden'), 'Trascina in Fatto: si apre la finestra del conto');
    ok(db.find(x => x.id === 1990).stato === 'doing', 'Trascina in Fatto: finché non chiudi il conto la scheda resta sul ponte');
    saveJobConConto('done');
    const r = recordDi('db', 1990);
    ok(r.stato === 'done' && !!r.data_chiusura, 'Trascina in Fatto: dopo il conto la scheda è chiusa con la data di chiusura');
    ok(fb.leggi('magazzino/OLIO-01').giacenza === prima - 2, 'Trascina in Fatto: olio scalato dal magazzino (' + prima + ' → ' + fb.leggi('magazzino/OLIO-01').giacenza + ')');
    ok(!!taggliandiDB['TR123AA'], 'Trascina in Fatto: prossimo tagliando registrato');
    moveStatus(1990, 'doing');
    dropBoard(ev, 'todo');
    ok(db.find(x => x.id === 1990).stato === 'todo' && document.getElementById('modal-conto').classList.contains('hidden'), 'Trascina in Da Fare: spostamento normale, senza conto');
    moveStatus(1990, 'doing');
    cambiaStatoDaArchivio(1990, 'done', safeEncode(r.clientId || ''));
    ok(!document.getElementById('modal-conto').classList.contains('hidden') && db.find(x => x.id === 1990).stato === 'doing', 'Storico → Lavoro Fatto: apre il conto invece di spostare e basta');
    closeModal('modal-conto');
  });

  await passo('Lavori consigliati', async () => {
    switchView('board');
    db.push({ id: 1991, stato: 'doing', data: getOggiLocale(), cognome: 'CONSIGLIO', nome: 'MARIO', tel: '3331112222', targa: 'CS111AA', marca: 'YAMAHA', modello: 'TMAX', lavori_richiesti: 'FRENI', conto: [], acconti: [] });
    saveDB();
    await attendi(50);
    openClosingModal(1991);
    ok(document.getElementById('conto-consigli-prima').style.display === 'none', 'Consigli: prima volta, nessun consiglio delle volte precedenti');
    addConsiglioConto('GOMMA POSTERIORE AL 20%', 3);
    addConsiglioConto('PASTIGLIE <ANT>', 0);
    addConsiglioConto('', 1);
    saveJobConConto('done');
    let r = recordDi('db', 1991);
    const cs = Object.values(r.consigli || {});
    ok(cs.length === 2 && cs[0].testo === 'GOMMA POSTERIORE AL 20%' && cs[0].mesi === 3 && cs[1].mesi === 0 && cs[0].dal === getOggiLocale(), 'Consigli: salvati con il conto (vuoti scartati, mesi e data)');
    openClosingModal(1991);
    ok(document.querySelectorAll('#conto-consigli .consiglio-row').length === 2, 'Consigli: riaprendo il conto ci sono ancora');
    closeModal('modal-conto');

    db.push({ id: 1992, stato: 'todo', data: getOggiLocale(), cognome: 'CONSIGLIO', nome: 'MARIO', tel: '3331112222', targa: 'CS 111 AA', marca: 'YAMAHA', modello: 'TMAX', lavori_richiesti: 'TAGLIANDO', conto: [], acconti: [] });
    saveDB();
    await attendi(50);
    refreshBoard();
    const card = [...document.querySelectorAll('.card-compact')].find(c => c.textContent.includes('CS 111 AA'));
    ok(card && card.textContent.includes('Consigliato: GOMMA POSTERIORE AL 20%') && card.textContent.includes('(+1)'), 'Consigli: la moto rientra e la Bacheca mostra il consiglio');
    ok(card && !card.innerHTML.includes('<ANT>'), 'Consigli: testo con simboli mostrato in sicurezza');

    openClosingModal(1992);
    const prima = document.getElementById('conto-consigli-prima');
    ok(prima.style.display === '' && prima.textContent.includes('GOMMA POSTERIORE') && prima.textContent.includes('PASTIGLIE'), 'Consigli: nel conto della nuova volta compaiono quelli di prima');
    const c0 = cs[0], c1 = cs[1];
    consiglioNelConto(1991, c0.id);
    chiudiConsiglioConto(1991, c1.id, 'no');
    ok([...document.querySelectorAll('#conto-rows .r-desc')].some(i => i.value === 'GOMMA POSTERIORE AL 20%') && prima.style.display === 'none', 'Consigli: "+ Nel conto" aggiunge la voce, i consigli chiusi spariscono');
    closeModal('modal-conto');
    r = recordDi('db', 1991);
    ok(Object.values(r.consigli).every(c => !c.fatto), 'Consigli: chiudendo il conto con Annulla non cambia niente');
    openClosingModal(1992);
    ok(document.querySelectorAll('#conto-consigli-prima button').length === 6, 'Consigli: riaprendo, i due consigli sono ancora lì');
    consiglioNelConto(1991, c0.id);
    saveJobConConto('doing');
    r = recordDi('db', 1991);
    const dopo = Object.values(r.consigli);
    ok(dopo[0].fatto === getOggiLocale() && dopo[0].esito === 'fatto' && !dopo[1].fatto, 'Consigli: salvando il conto il consiglio messo nel conto risulta fatto, l\'altro resta aperto');
    ok((recordDi('db', 1992).conto || []).some(v => v.desc === 'GOMMA POSTERIORE AL 20%'), 'Consigli: la voce è nel conto della nuova scheda');

    db.push({ id: 1993, stato: 'archived', data: _aggiungiMesi(getOggiLocale(), -4), data_chiusura: _aggiungiMesi(getOggiLocale(), -4), cognome: 'RICORDA', nome: 'ANNA', tel: '333 444 5555', targa: 'CS222BB', marca: 'HONDA', modello: 'SH', conto: [], acconti: [],
      consigli: [{ id: 'k1', testo: 'CATENA LENTA', mesi: 3, dal: _aggiungiMesi(getOggiLocale(), -4) }, { id: 'k2', testo: 'GOMME TRA UN ANNO', mesi: 6, dal: _aggiungiMesi(getOggiLocale(), -4) }] });
    saveDB();
    await attendi(50);
    ok(document.getElementById('consigli-badge').textContent === '1' && document.getElementById('consigli-badge').style.display !== 'none', 'Consigli: nel menu il contatore dei consigli da ricordare (1)');
    switchView('tagliandi');
    const box = document.getElementById('consigli-promemoria');
    ok(box.textContent.includes('CATENA LENTA') && !box.textContent.includes('GOMME TRA UN ANNO') && !box.textContent.includes('GOMMA POSTERIORE'), 'Consigli: in Tagliandi solo quelli arrivati alla data (non quelli di una moto in officina)');
    const aperte = [], wo = window.open;
    window.open = u => { aperte.push(u); return null; };
    try { waConsiglio(1993, 'k1'); } finally { window.open = wo; }
    ok(aperte.length === 1 && aperte[0].includes('wa.me/393334445555') && decodeURIComponent(aperte[0]).includes('CATENA LENTA'), 'Consigli: WhatsApp al cliente con il consiglio');
    ok(!!Object.values(recordDi('db', 1993).consigli)[0].avvisato && !box.textContent.includes('CATENA LENTA') && document.getElementById('consigli-badge').style.display === 'none', 'Consigli: dopo il WhatsApp segnato come avvisato e tolto dalla lista');
    switchView('board');
  });

  await passo('Ritocchi a Bacheca e Agenda', async () => {
    const piu = (n) => { const x = new Date(oggi + 'T12:00:00'); x.setDate(x.getDate() + n); return formatDateISO(x); };
    const J = (id, stato, data, extra) => Object.assign({ id, stato, data, targa: 'RT' + id, marca: 'HONDA', modello: 'SH', cognome: 'RITOCCO', nome: 'N' + id, tel: '3330009' + id, lavori_richiesti: 'LAVORO ' + id, conto: [], totale_lordo: 0, acconti: [], clientId: 'c-rt' + id }, extra || {});
    fb.scritturaRemota({
      'db/-Nrt1': J(901, 'doing', piu(-20), { conto: [{ desc: 'X', price: 300, qty: 1, iva: 22 }], totale_lordo: 300, acconti: [{ val: 100, date: piu(-20) }], lavori_richiesti: 'RIGA UNO\nRIGA DUE\nRIGA "TRE" <b>QUATTRO</b>' }),
      'db/-Nrt2': J(902, 'doing', piu(-10), { conto: [{ desc: 'X', price: 50, qty: 1, iva: 22 }], totale_lordo: 50, acconti: [{ val: 50, date: piu(-10) }] }),
      'db/-Nrt3': J(903, 'todo', oggi, { targa: '' }),
      'db/-Nrt4': J(904, 'done', piu(-30), { conto: [{ desc: 'X', price: 80, qty: 1, iva: 22 }], totale_lordo: 80 }),
      'agenda/-Nrt5': { id: 9905, tipo: 'officina', data: oggi, ora: '09:00', cliente: 'RITOCCO N903', moto: 'HONDA SH - ', tel: '3330009903', note: 'NOTA LUNGA', jobId: 903, raw_nome: 'N903', raw_cognome: 'RITOCCO', raw_marca: 'HONDA', raw_modello: 'SH', raw_targa: '' }
    }, false);
    switchView('board'); await attendi(80);
    const scheda = id => [...document.querySelectorAll('.card-compact')].find(c => c.innerHTML.includes('previewJob(' + id + ')'));
    // Giorni in officina
    ok(scheda(901).querySelector('.giorni-ponte') && scheda(901).querySelector('.giorni-ponte').textContent === 'da 20 gg', 'Bacheca: "da 20 gg" sulla moto sul ponte da 20 giorni');
    ok(!scheda(902).querySelector('.giorni-ponte'), 'Bacheca: niente giorni sotto le 2 settimane');
    ok(!scheda(904).querySelector('.giorni-ponte'), 'Bacheca: niente giorni sulle moto pronte');
    // Note su 2 righe con il testo intero al passaggio del mouse, testo protetto
    const box = scheda(901).querySelector('.work-box-compact');
    ok(box.querySelector('.wb-2righe') && box.getAttribute('title') === 'RIGA UNO\nRIGA DUE\nRIGA "TRE" <b>QUATTRO</b>' && !box.querySelector('b'), 'Bacheca: note su 2 righe, testo intero nel suggerimento, simboli come scritti');
    const righe = box.querySelector('.wb-2righe');
    ok(righe.getBoundingClientRect().height < parseFloat(getComputedStyle(righe).lineHeight || '16') * 2.6 + 1 || righe.clientHeight < 45, 'Bacheca: le note occupano al massimo 2 righe');
    // Totali da incassare (conto meno acconti)
    const tDoing = document.getElementById('title-doing').textContent, tDone = document.getElementById('title-done').textContent;
    const atteso = db.filter(j => j.stato === 'doing').reduce((s, j) => { const l = parseFloat(j.totale_lordo) || 0, a = (j.acconti || []).reduce((x, y) => x + (parseFloat(y.val) || 0), 0); return s + (l > 0 && l - a > 0.009 ? l - a : 0); }, 0);
    ok(tDoing.includes('€ ' + new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Math.round(atteso)) + ' da incassare') && atteso >= 200, 'Bacheca: totale da incassare nel titolo Sul ponte (' + tDoing + ')');
    ok(/da incassare/.test(tDone) && !/da incassare/i.test(document.getElementById('title-todo').textContent), 'Bacheca: totale anche sulle Pronte, non sugli appuntamenti');
    // Targa scritta al volo
    const etichetta = scheda(903).querySelector('.targa-al-volo');
    ok(etichetta && etichetta.textContent.includes('TARGA MANCANTE'), 'Targa mancante: etichetta cliccabile');
    etichetta.click();
    let inp = scheda(903).querySelector('.targa-al-volo-box input');
    ok(!!inp, 'Targa mancante: al clic compare la casella');
    inp.value = ''; scheda(903).querySelector('.targa-al-volo-box button').click(); await attendi(30);
    ok(!recordDi('db', 903).targa && scheda(903).querySelector('.targa-al-volo'), 'Targa mancante: vuota non salva niente');
    scheda(903).querySelector('.targa-al-volo').click();
    inp = scheda(903).querySelector('.targa-al-volo-box input');
    inp.value = 'zz'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await attendi(30);
    ok(!recordDi('db', 903).targa, 'Targa mancante: Esc annulla');
    scheda(903).querySelector('.targa-al-volo').click();
    inp = scheda(903).querySelector('.targa-al-volo-box input');
    const n0 = nScr();
    inp.value = ' fx 123ab '; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await attendi(40);
    ok(recordDi('db', 903).targa === 'FX 123AB', 'Targa mancante: Invio salva la targa in maiuscolo nel cloud');
    const app = recordDi('agenda', 9905);
    ok(app.raw_targa === 'FX 123AB' && app.moto === 'HONDA SH - FX 123AB', 'Targa mancante: aggiornato anche l\'appuntamento in Agenda');
    ok(chiaviDa(n0).every(k => /^(db|agenda)\//.test(k)), 'Targa mancante: salva solo schede e appuntamenti');
    ok(scheda(903).querySelector('.targa-badge').textContent.includes('FX 123AB'), 'Targa mancante: la scheda mostra la targa');
    // Agenda compatta
    const lun = new Date(oggi + 'T12:00:00'); lun.setDate(lun.getDate() - ((lun.getDay() + 6) % 7)); lun.setHours(0, 0, 0, 0);
    const settPrima = dataInizioSettimana; dataInizioSettimana = lun;
    switchView('agenda'); await attendi(60);
    const card = _renderAgendaCard(agendaDB.find(a => a.id === 9905));
    ok(card.includes('📞 3330009903') && card.includes('ag-note') && card.includes('ag-moto') && !card.includes('| 📞'), 'Agenda: telefono sulla riga dell\'ora, note su 2 righe');
    ok(_motoAgenda({ moto: 'HONDA SH - AB123', raw_targa: 'AB123' }) === 'HONDA SH' && _motoAgenda({ moto: 'BMW R 45 -' }) === 'BMW R 45' && _motoAgenda({ raw_marca: 'KTM', raw_modello: '890', moto: 'X' }) === 'KTM 890', 'Agenda: moto senza targa ripetuta né trattino finale');
    const giorni = [...document.querySelectorAll('#agenda-grid .agenda-day')];
    const passati = giorni.filter(g => g.classList.contains('passato')).length;
    const attesi = [0, 1, 2, 3, 4, 5].filter(n => { const d = new Date(lun); d.setDate(d.getDate() + n); return formatDateISO(d) < oggi; }).length;
    ok(giorni.length === 6 && passati === attesi, 'Agenda: giorni passati più tenui (' + passati + ' su 6), oggi e i prossimi normali');
    dataInizioSettimana = new Date(lun); dataInizioSettimana.setDate(dataInizioSettimana.getDate() - 7); refreshAgenda();
    ok([...document.querySelectorAll('#agenda-grid .agenda-day')].every(g => g.classList.contains('passato')), 'Agenda: la settimana scorsa tutta tenue');
    dataInizioSettimana = settPrima;
    // Pulizia
    const pul = { 'db/-Nrt1': null, 'db/-Nrt2': null, 'db/-Nrt3': null, 'db/-Nrt4': null, 'agenda/-Nrt5': null };
    fb.scritturaRemota(pul, false);
    switchView('board'); await attendi(50);
  });

  await passo('Ritocchi a Nuova scheda e Conto', async () => {
    const piu = (n) => { const x = new Date(oggi + 'T12:00:00'); x.setDate(x.getDate() + n); return formatDateISO(x); };
    const base = { targa: 'NC 1001', marca: 'ROYAL ENFIELD', modello: 'GT 650', cognome: 'D<b>X', nome: 'MICHELE', tel: '3310001001', clientId: 'c-nc' };
    fb.scritturaRemota({
      'db/-Nnc1': Object.assign({}, base, { id: 951, stato: 'doing', data: piu(-5), km: '18500', lavori_richiesti: 'KIT', conto: [{ desc: 'KIT', price: 122, qty: 1, iva: 22 }, { desc: 'BOLLO', price: 10, qty: 1, iva: 0 }], totale_lordo: 132, acconti: [{ val: 32, date: piu(-5) }] }),
      'db/-Nnc2': Object.assign({}, base, { id: 952, stato: 'archived', data: piu(-200), data_chiusura: piu(-199), lavori_richiesti: 'TAGLIANDO', conto: [{ desc: 'T', price: 200, qty: 1, iva: 22 }], totale_lordo: 200, acconti: [{ val: 80, date: piu(-199) }], consigli: [{ id: 'kk1', testo: 'GOMMA POSTERIORE', mesi: 3, dal: piu(-199) }] }),
      'db/-Nnc3': { id: 953, stato: 'archived', data: piu(-100), targa: 'NC9999', cognome: 'SOLO', nome: 'ARCHIVIO', conto: [], totale_lordo: 0, acconti: [], clientId: 'c-nc3' },
      'tagliandi/NC 1001': { data: piu(160), km: '18500', note: '' }
    }, false);
    const ordPrima = JSON.parse(JSON.stringify(ordiniDB));
    fb.scritturaRemota({ 'ordini': ordPrima.concat([{ id: 95101, jobId: 951, targa: 'NC 1001', desc: 'KIT', qta: 1, stato: 'doing', data: piu(-4) }]) }, false);
    await attendi(60);

    // Conto: intestazione, IVA 0%, barra con il totale
    openClosingModal(951); await attendi(30);
    const testa = document.getElementById('conto-header-info');
    ok(testa.textContent.includes('D<B>X MICHELE') && testa.textContent.includes('ROYAL ENFIELD GT 650') && testa.textContent.includes('NC 1001') && testa.textContent.includes('18500 km') && testa.textContent.includes('3310001001') && !testa.querySelector('b'), 'Conto: intestazione con cliente, moto, targa, km e telefono (nomi con simboli come scritti)');
    const righe = [...document.querySelectorAll('#conto-rows tr.voce-row')];
    ok(righe[1].dataset.iva === '0' && _ivaRiga(righe[1]) === 0 && _ivaRiga(righe[0]) === 22 && _ivaRiga({ dataset: {} }) === 22, 'Conto: la voce al 0% resta 0% (22% solo se manca)');
    const riep = document.getElementById('conto-iva-breakdown').textContent;
    ok(riep.includes('Imponibile:') && riep.includes((122 / 1.22 + 10).toFixed(2)) && riep.includes('IVA 22%:') && riep.includes((122 - 122 / 1.22).toFixed(2)), 'Conto: riepilogo IVA giusto con una voce al 0%');
    const barra = document.getElementById('conto-barra-totale');
    ok(barra.textContent.includes('Totale 132.00 €') && barra.textContent.includes('Acconti 32.00 €') && barra.textContent.includes('Da incassare 100.00 €'), 'Conto: barra in fondo con totale, acconti e da incassare');
    const fondo = document.querySelector('#modal-conto .modal-content > .flex-row.mt-15');
    ok(getComputedStyle(fondo).position === 'sticky' && getComputedStyle(barra).display !== 'none', 'Conto: totale e pulsanti fissi in fondo alla finestra sul Mac');
    righe[0].querySelector('.r-price').value = '22'; calcContoTotal();
    ok(barra.textContent.includes('Da incassare') === false && barra.textContent.includes('Saldato'), 'Conto: la barra si aggiorna (saldato)');
    righe.forEach(r => { r.querySelector('.r-price').dataset.prima = r.querySelector('.r-price').value; r.querySelector('.r-price').value = ''; });
    const accPrima = [...document.querySelectorAll('#conto-acconti-container .c_acc_val')].map(x => x.value);
    document.querySelectorAll('#conto-acconti-container .c_acc_val').forEach(x => { x.value = ''; }); calcContoTotal();
    ok(barra.textContent.includes('Nessuna voce') && !barra.textContent.includes('Saldato'), 'Conto: con il conto vuoto la barra non dice "Saldato"');
    document.querySelectorAll('#conto-acconti-container .c_acc_val').forEach((x, k) => { x.value = accPrima[k]; }); calcContoTotal();
    ok(barra.textContent.includes('Solo acconti'), 'Conto: senza voci ma con un acconto dice "Solo acconti"');
    righe.forEach(r => { r.querySelector('.r-price').value = r.querySelector('.r-price').dataset.prima; });
    righe[0].querySelector('.r-price').value = '122'; calcContoTotal();
    saveJobConConto('doing'); await attendi(40);
    const salvato = Object.values(recordDi('db', 951).conto);
    ok(salvato.find(c => c.desc === 'BOLLO').iva === 0 && salvato.find(c => c.desc === 'KIT').iva === 22, 'Conto: salvando la voce al 0% resta 0%');
    closeModal('modal-conto');

    // Nuova: moto già in officina
    switchView('nuova'); await attendi(30);
    const avviso = document.getElementById('nuova-doppione');
    ok(avviso.classList.contains('hidden'), 'Nuova: nessun avviso a modulo vuoto');
    campo('f_targa', 'nc1001'); _avvisoMotoInOfficina();
    ok(!avviso.classList.contains('hidden') && avviso.textContent.includes('è già sul ponte dal ' + formattaData(piu(-5))) && avviso.innerHTML.includes('previewJob(951)') && !avviso.querySelector('b'), 'Nuova: avviso "già sul ponte" anche scrivendo la targa senza spazio, con il pulsante per aprirla');
    campo('f_id', '951'); _avvisoMotoInOfficina();
    ok(avviso.classList.contains('hidden'), 'Nuova: nessun avviso modificando la stessa scheda');
    campo('f_id', ''); campo('f_targa', 'NC9999'); _avvisoMotoInOfficina();
    ok(avviso.classList.contains('hidden'), 'Nuova: nessun avviso per una moto con solo lavori chiusi');
    // Più notizie sul cliente
    switchView('board'); switchView('nuova'); await attendi(20);
    selezionaClienteNuova({ targa: 'NC 1001', nome: 'MICHELE', cognome: 'D<b>X', tel: '3310001001', marca: 'ROYAL ENFIELD', modello: 'GT 650', km: '18500', clientId: 'c-nc' });
    const info = document.getElementById('nuova-cliente-info').textContent;
    ok(info.includes('Prossimo tagliando ' + formattaData(piu(160))) && info.includes('1 ricambio in attesa') && info.includes('1 lavoro consigliato da fare') && info.includes('Da saldare 120.00 €'), 'Nuova: tagliando, ricambi, consigliati e da saldare del cliente già presente');
    ok(!avviso.classList.contains('hidden'), 'Nuova: scegliendo il cliente compare anche l\'avviso "già in officina"');
    // Lavori frequenti
    const chips = [...document.querySelectorAll('#f-lavori-frequenti .chip-lavoro')];
    ok(chips.length === 8 && chips.some(c => c.dataset.t === 'TAGLIANDO'), 'Nuova: 8 lavori frequenti');
    ok(_lavoriFrequenti.toString().includes('RIAPERTO') && (() => { const prima = db.length; db.push({ id: 'x1', stato: 'archived', lavori_richiesti: '[RIF. OFFICINA] ZZETICHETTA' }, { id: 'x2', stato: 'archived', lavori_richiesti: '[RIAPERTO] ZZETICHETTA' }, { id: 'x3', stato: 'archived', lavori_richiesti: 'ZZETICHETTA' }); const l = _lavoriFrequenti(); db.splice(prima, 3); return l.includes('ZZETICHETTA') && !l.some(x => x.startsWith('[')); })(), 'Nuova: lavori frequenti senza etichette davanti come [RIAPERTO] (contano come lo stesso lavoro)');
    campo('f_lavori', '');
    const tag = chips.find(c => c.dataset.t === 'TAGLIANDO');
    tag.click(); tag.click();
    const gomme = chips.find(c => c.dataset.t !== 'TAGLIANDO'); gomme.click();
    ok(document.getElementById('f_lavori').value === 'TAGLIANDO\n' + gomme.dataset.t && tag.classList.contains('usato'), 'Nuova: un clic aggiunge la riga, senza doppioni; il pulsante usato si schiarisce');
    // Pulizia
    fb.scritturaRemota({ 'db/-Nnc1': null, 'db/-Nnc2': null, 'db/-Nnc3': null, 'tagliandi/NC 1001': null, 'ordini': ordPrima }, false);
    switchView('board'); await attendi(50);
  });

  await passo('Ritocchi all\'Anagrafica', async () => {
    const piu = (n) => { const x = new Date(oggi + 'T12:00:00'); x.setDate(x.getDate() + n); return formatDateISO(x); };
    fb.scritturaRemota({
      'db/-Nan1': { id: 961, stato: 'archived', data: piu(-40), data_chiusura: piu(-38), cognome: 'ZZANAG', nome: 'UNO', tel: '333 100 0961', targa: 'AN961', marca: 'HONDA', modello: 'SH', conto: [], totale_lordo: 100, acconti: [{ val: 40, date: piu(-38) }], clientId: 'c-an1' },
      'db/-Nan2': { id: 962, stato: 'archived', data: piu(-90), cognome: 'ZZANAG', nome: 'UNO', tel: '333 100 0961', targa: 'AN961', marca: 'HONDA', modello: 'SH', conto: [], totale_lordo: 0, acconti: [], clientId: 'c-an1' },
      'db/-Nan3': { id: 963, stato: 'todo', data: piu(3), cognome: 'ZZANAG', nome: 'DUE', tel: '', targa: 'AN963', marca: 'KTM', modello: 'DUKE', conto: [], totale_lordo: 0, acconti: [], clientId: 'c-an2' }
    }, false);
    switchView('archivio'); setArchiveFilter('all'); await attendi(80);
    const righe = () => [...document.querySelectorAll('#archive-results .archive-card-row')];
    const num = id => parseInt((document.getElementById('filt-' + id).textContent.match(/\((\d+)\)/) || [])[1], 10);
    ok(document.querySelectorAll('#archive-results .arch-testata').length === 1 && !document.querySelector('#archive-results').textContent.includes('VEICOLI INTESTATI'), 'Anagrafica: un\'unica intestazione al posto delle scritte su ogni cliente');
    ok(num('all') === righe().length && righe().length > 2, 'Anagrafica: "Tutti (N)" conta i clienti in elenco');
    for (const f of ['dafare', 'dapagare', 'fatti', 'special']) { setArchiveFilter(f); await attendi(20); ok(num(f) === righe().length, 'Anagrafica: il numero sul filtro ' + f + ' corrisponde all\'elenco (' + righe().length + ')'); }
    setArchiveFilter('all'); campo('search-input', 'zzanag'); refreshArchive();
    ok(num('all') === 2 && num('dapagare') === 1 && num('dafare') === 1 && righe().length === 2, 'Anagrafica: con la ricerca i numeri contano solo i clienti trovati');
    const uno = righe().find(r => r.textContent.includes('ZZANAG UNO')), due = righe().find(r => r.textContent.includes('ZZANAG DUE'));
    ok(uno.textContent.includes('Ultima visita ' + formattaData(piu(-38))), 'Anagrafica: ultima visita = data di chiusura dell\'ultimo lavoro');
    ok(!due.textContent.includes('Ultima visita'), 'Anagrafica: un appuntamento futuro non conta come visita');
    const wa = uno.querySelector('.arch-tel a[href^="https://wa.me/"]'), tel = uno.querySelector('.arch-tel a[href^="tel:"]');
    ok(wa && wa.getAttribute('href') === 'https://wa.me/393331000961' && tel && tel.getAttribute('href') === 'tel:3331000961', 'Anagrafica: 💬 e 📞 accanto al telefono');
    ok(!due.querySelector('.arch-tel a'), 'Anagrafica: senza telefono niente pulsantini');
    ok(uno.querySelector('.dropdown-content').style.minWidth === '250px' && uno.querySelector('.dropdown-content').innerHTML.includes('openStatoLavoriModal'), 'Anagrafica: menu Azioni più largo, stesse voci');
    const ri = uno.getBoundingClientRect(), hd = document.querySelector('.arch-testata span:nth-child(2)').getBoundingClientRect(), veic = uno.children[1].getBoundingClientRect();
    ok(Math.abs(hd.left - veic.left) < 3, 'Anagrafica: l\'intestazione VEICOLI sta sopra la colonna dei veicoli');
    ok(ri.height < 95, 'Anagrafica: righe compatte (' + Math.round(ri.height) + ' px)');
    campo('search-input', ''); refreshArchive();
    fb.scritturaRemota({ 'db/-Nan1': null, 'db/-Nan2': null, 'db/-Nan3': null }, false);
    switchView('board'); await attendi(50);
  });

  await passo('Ritocchi ai Preventivi', async () => {
    const piu = (n) => { const x = new Date(oggi + 'T12:00:00'); x.setDate(x.getDate() + n); return formatDateISO(x); };
    const P = (id, d, cog, extra) => Object.assign({ id, stato: 'preventivo', data: piu(d), cognome: cog, nome: 'PV', marca: 'HONDA', modello: 'SH', targa: 'PR' + id, tel: '333 200 ' + id, era_preventivo: true, lavori_richiesti: 'Vedi voci preventivo', conto: [{ desc: 'X', price: 100, qty: 1, iva: 22 }], totale_lordo: 100, clientId: 'c-pr' + id }, extra || {});
    fb.scritturaRemota({ 'db/-Npr1': P(971, -20, 'ZZPREVA'), 'db/-Npr2': P(972, -5, 'ZZPREVB'), 'db/-Npr3': P(973, -60, 'ZZPREVC', { stato: 'archived', data_accettazione: piu(-50) }) }, false);
    switchView('preventivi'); setPrevTab('aperti'); await attendi(60);
    const lista = () => document.getElementById('preventivi-results');
    const riga = cog => [...lista().querySelectorAll('.prev-card-row')].find(r => r.textContent.includes(cog));
    ok(lista().querySelectorAll('.prev-testata').length === 1 && !lista().textContent.includes('MOTO:') && !lista().textContent.includes('TOTALE:'), 'Preventivi: un\'unica intestazione al posto di MOTO:/TOTALE: su ogni riga');
    ok(riga('ZZPREVA').querySelector('.giorni-ponte') && riga('ZZPREVA').querySelector('.giorni-ponte').textContent === 'da 20 gg' && !riga('ZZPREVB').querySelector('.giorni-ponte'), 'Preventivi: "da 20 gg" sul preventivo fermo da 20 giorni, niente sotto le 2 settimane');
    const wa = riga('ZZPREVA').querySelector('.arch-tel a[href^="https://wa.me/"]');
    ok(wa && wa.getAttribute('href') === 'https://wa.me/39333200971' && riga('ZZPREVA').querySelector('.arch-tel a[href="tel:333200971"]'), 'Preventivi: 💬 e 📞 accanto al telefono');
    ok(riga('ZZPREVA').querySelector('.dropdown-content').style.minWidth === '250px', 'Preventivi: menu Azioni più largo');
    // Ricerca
    campo('prev-search', 'zzpreva'); refreshPreventivi();
    ok(lista().querySelectorAll('.prev-card-row').length === 1 && riga('ZZPREVA'), 'Preventivi: la ricerca trova il preventivo giusto');
    campo('prev-search', 'pr973'); refreshPreventivi();
    ok(lista().textContent.includes('Nessun preventivo aperto trovato') && /Storico\s*1/.test(document.getElementById('prev-tab-bar').textContent), 'Preventivi: la ricerca vale anche per lo storico (numero sulla scheda)');
    setPrevTab('storico');
    ok(lista().querySelectorAll('.prev-card-row').length === 1 && riga('ZZPREVC') && lista().querySelectorAll('.prev-testata').length === 1, 'Preventivi: nello storico solo il preventivo cercato, con l\'intestazione');
    campo('prev-search', ''); setPrevTab('aperti');
    // ✅ Accettato
    const btn = riga('ZZPREVA').querySelector('.prev-accettato');
    ok(btn && btn.getAttribute('onclick') === 'accettaPreventivo(971)', 'Preventivi: pulsante ✅ Accettato sulla riga');
    btn.click(); await attendi(20);
    ok(!document.getElementById('modal-accetta-prev').classList.contains('hidden') && document.getElementById('ap_job_id').value === '971', 'Preventivi: ✅ Accettato apre la stessa conferma di "Converti in Commessa"');
    closeModal('modal-accetta-prev');
    fb.scritturaRemota({ 'db/-Npr1': null, 'db/-Npr2': null, 'db/-Npr3': null }, false);
    switchView('board'); await attendi(50);
  });

  await passo('Ritocchi alla Prima Nota', async () => {
    const piu = (n) => { const x = new Date(oggi + 'T12:00:00'); x.setDate(x.getDate() + n); return formatDateISO(x); };
    const ledgerPrima = JSON.parse(JSON.stringify(ledgerDB));
    const meseScorso = (() => { const x = new Date(oggi.slice(0, 7) + '-15T12:00:00'); x.setMonth(x.getMonth() - 1); return formatDateISO(x); })();
    let id = 98000; const M = (data, tipo, cat, collab, desc, imp, qta) => ({ id: id++, data, tipo, cat, collab, desc, importo: imp, qta: qta || 1 });
    const L = [M(oggi, 'in', 'officina', 'ZZCASSA', 'ENTRATA OGGI', 100), M(meseScorso, 'out', 'accessori', 'ZZCASSA', 'USCITA MESE SCORSO', 30, 2), M(oggi, 'out', 'officina', 'ZZCASSA', 'USCITA OGGI', 20), M(oggi, 'in', 'officina', '<B>Z</B>', 'X', 5)];
    fb.scritturaRemota({ ledger: ledgerPrima.concat(L) }, false);
    switchView('ledger'); await attendi(60);
    const tutti = ledgerDB.reduce((a, m) => { const t = (m.importo || 0) * (m.qta || 1); a[m.tipo === 'in' ? 'in' : 'out'] += t; return a; }, { in: 0, out: 0 });
    const bil = document.getElementById('ledger-balance').textContent;
    const atteso = tutti.out - tutti.in;
    ok(bil.includes('€ ' + Math.abs(atteso).toFixed(2)) && bil.includes(atteso < 0 ? 'ci devono' : atteso > 0 ? 'dobbiamo' : 'in pari') && !bil.includes('-'), 'Prima Nota: bilancio generale con "ci devono"/"dobbiamo" invece del segno meno (' + bil + ')');
    ok(document.getElementById('collab-summary-grid').textContent.includes('<B>Z</B>') && !document.querySelector('#collab-summary-grid b'), 'Prima Nota: nome della cassa con simboli scritto così com\'è');
    openCollabDetail(safeEncode('ZZCASSA')); await attendi(30);
    const righe = [...document.querySelectorAll('#mc-rows tr')].map(tr => tr.textContent);
    ok(righe.length === 3 && righe[2].includes('USCITA MESE SCORSO') && righe.slice(0, 2).every(r => r.includes(formattaData(oggi))), 'Cassa: movimenti in ordine di data, i più recenti in alto');
    const chips = document.getElementById('mc-cat-totali').textContent;
    ok(chips.includes('OFFICINA') && chips.includes('+ € 100.00') && chips.includes('− € 20.00') && chips.includes('ACCESSORI') && chips.includes('− € 60.00'), 'Cassa: totali per categoria (entrate e uscite)');
    const sel = document.getElementById('mc-mese');
    ok(sel.options.length === 3 && sel.value === '' && sel.options[1].value === oggi.slice(0, 7), 'Cassa: filtro con "Tutti i mesi" e i mesi dei movimenti, dal più recente');
    sel.value = oggi.slice(0, 7); sel.onchange(); await attendi(20);
    ok(document.querySelectorAll('#mc-rows tr').length === 2 && document.getElementById('mc-in').textContent.includes('100.00') && document.getElementById('mc-out').textContent.includes('20.00') && document.getElementById('mc-cat-totali').textContent.includes('Solo ' + _nomeMese(oggi.slice(0, 7))), 'Cassa: scegliendo il mese restano i suoi movimenti e i totali di quel mese');
    campo('ld_desc', 'NUOVO DEL MESE'); campo('ld_importo', '7'); saveLedgerEntry(); await attendi(30);
    openCollabDetail(currentCollabView); await attendi(20);
    ok(document.getElementById('mc-mese').value === oggi.slice(0, 7) && document.querySelectorAll('#mc-rows tr').length === 3, 'Cassa: dopo un movimento nuovo il mese scelto resta');
    // cambiando mese non si perde quello che si sta scrivendo
    campo('ld_desc', 'SCRITTO A META'); campo('ld_importo', '12');
    sel.value = ''; sel.onchange(); await attendi(20);
    ok(document.getElementById('ld_desc').value === 'SCRITTO A META' && document.getElementById('ld_importo').value === '12', 'Cassa: cambiando mese il modulo non si svuota');
    sel.value = oggi.slice(0, 7); sel.onchange(); await attendi(20);
    // movimento di un altro mese con il filtro attivo: si torna a "Tutti i mesi"
    campo('ld_data', meseScorso); campo('ld_desc', 'MESE SCORSO NUOVO'); campo('ld_importo', '3'); saveLedgerEntry(); await attendi(30);
    openCollabDetail(currentCollabView); await attendi(20);
    ok(document.getElementById('mc-mese').value === '' && document.getElementById('mc-rows').textContent.includes('MESE SCORSO NUOVO'), 'Cassa: un movimento di un altro mese fa tornare a "Tutti i mesi" e si vede');
    // chiudendo e riaprendo la stessa cassa si riparte da "Tutti i mesi"
    sel.value = oggi.slice(0, 7); sel.onchange(); await attendi(20);
    closeModal('modal-collab'); openCollabDetail(safeEncode('ZZCASSA')); await attendi(20);
    ok(document.getElementById('mc-mese').value === '' && document.getElementById('ld_desc').value === '', 'Cassa: riaprendo la stessa cassa si riparte da "Tutti i mesi" e modulo vuoto');
    openCollabDetail(safeEncode('INTERNO')); await attendi(20);
    ok(document.getElementById('mc-mese').value === '', 'Cassa: cambiando cassa si torna a "Tutti i mesi"');
    showCollabTab('archivio');
    ok(document.getElementById('mc-mese').style.display === 'none' && document.getElementById('mc-cat-totali').style.display === 'none', 'Cassa: filtro e totali nascosti nell\'Archivio schede');
    showCollabTab('corrente'); closeModal('modal-collab');
    ok(document.getElementById('ld_tipo').style.width === '215px' && document.getElementById('ld_importo').placeholder === 'Importo €', 'Cassa: campi del modulo interi');
    // Importi con al massimo 2 decimali
    ok(!/minimumFractionDigits: ?2 ?\}/.test(document.documentElement.innerHTML.replace(/<script[^>]*src[^>]*><\/script>/g, '')) , 'Importi: tutti con al massimo 2 decimali');
    ok((1627.602).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) === '1627,60', 'Importi: 1627,602 diventa 1627,60');
    fb.scritturaRemota({ ledger: ledgerPrima }, false);
    switchView('board'); await attendi(50);
  });

  await passo('Km dei lavori passati nello Storico', async () => {
    const piu = (n) => { const x = new Date(oggi + 'T12:00:00'); x.setDate(x.getDate() + n); return formatDateISO(x); };
    const J = (id, d, km, extra) => Object.assign({ id, stato: 'archived', data: piu(d), data_chiusura: piu(d), cognome: 'ZZKM', nome: 'PROVA', targa: 'KM 001', marca: 'HONDA', modello: 'SH', km, conto: [{ desc: 'TAGLIANDO', price: 150, qty: 1, iva: 22, mag_codice: 'OLIO-01' }, { desc: 'BOLLO', price: 10, qty: 1, iva: 0 }], totale_lordo: 160, acconti: [{ val: 160, date: piu(d) }], clientId: 'c-zzkm' }, extra || {});
    fb.scritturaRemota({ 'db/-Nkm1': J(991, -300, '12000'), 'db/-Nkm2': J(992, -100, ''), 'db/-Nkm3': J(993, -10, '21000') }, false);
    viewHistoryCognome(safeEncode('c-zzkm')); await attendi(30);
    const card = id => [...document.querySelectorAll('#st-corpo > div')].find(d => d.innerHTML.includes('openEditStorico(' + id + ','));
    ok(card(992).querySelector('.km-manca') && !card(991).querySelector('.km-manca') && card(991).textContent.includes('KM: 12000'), 'Storico: "+ km" sui lavori senza km, i km negli altri');
    const contoPrima = JSON.stringify(recordDi('db', 992).conto), accPrima = JSON.stringify(recordDi('db', 992).acconti);
    card(992).querySelector('.km-manca').click();
    let inp = card(992).querySelector('.km-storico input');
    ok(!!inp, 'Storico: cliccando "+ km" compare la casella');
    const errPrima = (window.__errori || []).length;
    inp.value = 'abc'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await attendi(20);
    ok(!recordDi('db', 992).km && card(992).querySelector('.km-storico input'), 'Storico: testo non numerico non si salva');
    inp.value = '15.500'; const n0 = nScr(); inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await attendi(30);
    ok(recordDi('db', 992).km === '15500' && card(992).textContent.includes('KM: 15500'), 'Storico: Invio salva i km (anche scritti con il punto)');
    ok(JSON.stringify(recordDi('db', 992).conto) === contoPrima && JSON.stringify(recordDi('db', 992).acconti) === accPrima && Object.values(recordDi('db', 992).conto)[0].mag_codice === 'OLIO-01' && Object.values(recordDi('db', 992).conto)[1].iva === 0, 'Storico: conto, acconti, collegamento al magazzino e IVA restano com\'erano');
    ok(chiaviDa(n0).length > 0 && chiaviDa(n0).every(k => k.startsWith('db/-Nkm2')), 'Storico: salva solo quel lavoro');
    // km fuori ordine: chiede conferma
    const conf = window.confirm; let chiesto = '';
    window.confirm = m => { chiesto = m; return false; };
    try {
      card(992).querySelector('.km-storico button').click();
      inp = card(992).querySelector('.km-storico input'); inp.value = '9000'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await attendi(20);
      ok(chiesto.includes('12000 km') && recordDi('db', 992).km === '15500', 'Storico: km più bassi di un lavoro precedente chiedono conferma (annullato: non salva)');
      window.confirm = m => { chiesto = m; return true; };
      inp.value = '25000'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await attendi(20);
      ok(chiesto.includes('21000 km') && recordDi('db', 992).km === '25000', 'Storico: km più alti di un lavoro successivo chiedono conferma (confermato: salva)');
    } finally { window.confirm = conf; }
    card(992).querySelector('.km-storico button').click();
    inp = card(992).querySelector('.km-storico input'); inp.value = '55555'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await attendi(20);
    ok(recordDi('db', 992).km === '25000' && card(992).textContent.includes('KM: 25000'), 'Storico: Esc annulla');
    closeModal('modal-storico');
    fb.scritturaRemota({ 'db/-Nkm1': null, 'db/-Nkm2': null, 'db/-Nkm3': null }, false);
    switchView('board'); await attendi(50);
  });

  await passo('Tagliandi: ricorda chi hai avvisato', async () => {
    const oggi = getOggiLocale();
    db.push({ id: 1995, stato: 'archived', data: _aggiungiMesi(oggi, -13), data_chiusura: _aggiungiMesi(oggi, -13), cognome: 'AVVISO', nome: 'PAOLO', tel: '3335556666', targa: 'AV111AA', marca: 'BMW', modello: 'GS', conto: [], acconti: [] });
    db.push({ id: 1996, stato: 'archived', data: _aggiungiMesi(oggi, -12), data_chiusura: _aggiungiMesi(oggi, -12), cognome: 'AVVISO', nome: 'LUCA', tel: '3335557777', targa: 'AV222BB', marca: 'BMW', modello: 'R 1250', conto: [], acconti: [] });
    saveDB();
    taggliandiDB['AV111AA'] = { data: _aggiungiMesi(oggi, -1), km: '', note: '' };
    taggliandiDB['AV222BB'] = { data: _aggiungiMesi(oggi, -1), km: '', note: '' };
    saveTagliandi();
    await attendi(50);
    switchView('tagliandi');
    const righe = () => [...document.querySelectorAll('#tagliandi-results .tag-card-row')];
    const riga = t => righe().find(r => r.textContent.includes(t));
    const pos = t => righe().indexOf(riga(t));
    const ordineIniziale = pos('AV111AA') < pos('AV222BB');
    const primo = ordineIniziale ? 'AV111AA' : 'AV222BB', secondo = ordineIniziale ? 'AV222BB' : 'AV111AA';
    const aperte = [], wo = window.open;
    window.open = u => { aperte.push(u); return null; };
    try { sendWhatsAppTagliando(safeEncode(primo)); } finally { window.open = wo; }
    ok(aperte.length === 1 && aperte[0].includes('wa.me/39'), 'Tagliandi avvisati: il WhatsApp si apre come prima');
    const t = fb.leggi('tagliandi/' + primo);
    ok(t.avvisato === oggi && t.avvisato_per === taggliandiDB[primo].data && t.data === taggliandiDB[primo].data, 'Tagliandi avvisati: salvati data dell\'avviso e scadenza, senza toccare il resto');
    ok(riga(primo).textContent.includes('avvisato il ' + formattaData(oggi)) && riga(primo).classList.contains('tag-avvisato'), 'Tagliandi avvisati: la riga mostra "avvisato il" ed è più tenue');
    ok(pos(primo) > pos(secondo), 'Tagliandi avvisati: scende sotto quelli ancora da avvisare');
    openModalTagliando(safeEncode(primo));
    document.getElementById('mt_note').value = 'TELEFONARE';
    salvaTagliandoModal();
    ok(riga(primo).textContent.includes('avvisato il'), 'Tagliandi avvisati: cambiando solo la nota l\'avviso resta');
    taggliandiDB[primo] = { ...taggliandiDB[primo], data: _aggiungiMesi(oggi, 11) };
    saveTagliandi();
    await attendi(50);
    refreshTagliandi();
    ok(!riga(primo).textContent.includes('avvisato il') && !riga(primo).classList.contains('tag-avvisato'), 'Tagliandi avvisati: con la nuova scadenza torna da avvisare');
    taggliandiDB[primo] = { ...taggliandiDB[primo], data: _aggiungiMesi(oggi, -1) };
    saveTagliandi();
    await attendi(50);
    window.open = () => null;
    try { sendWhatsAppTagliando(safeEncode(secondo)); } finally { window.open = wo; }
    const cf = window.confirm; window.confirm = () => true;
    try { togliAvvisoTagliando(safeEncode(secondo)); } finally { window.confirm = cf; }
    ok(!fb.leggi('tagliandi/' + secondo).avvisato && !riga(secondo).textContent.includes('avvisato il'), 'Tagliandi avvisati: cliccando la scritta torna da avvisare');
    switchView('board');
  });

  await passo('Anno della moto', async () => {
    switchView('nuova');
    clearForm();
    ok(!!document.getElementById('f_anno'), 'Anno: campo presente nella Nuova scheda');
    document.getElementById('f_cognome').value = 'ANNATA';
    document.getElementById('f_nome').value = 'PIERO';
    document.getElementById('f_targa').value = 'AN123NO';
    document.getElementById('f_marca').value = 'APRILIA';
    document.getElementById('f_modello').value = 'TUONO';
    document.getElementById('f_anno').value = '2019';
    saveJob('todo');
    const j1 = db.find(x => x.targa === 'AN123NO');
    ok(j1 && j1.anno === '2019' && recordDi('db', j1.id).anno === '2019', 'Anno: salvato con la scheda');
    refreshBoard();
    const card = [...document.querySelectorAll('.card-compact')].find(c => c.textContent.includes('AN123NO'));
    ok(card && card.querySelector('.anno-moto') && card.querySelector('.anno-moto').textContent === '2019', 'Anno: compare sulla Bacheca accanto al modello');
    openClosingModal(j1.id);
    ok(document.getElementById('conto-header-info').textContent.includes('TUONO · 2019'), 'Anno: compare nell\'intestazione del conto');
    closeModal('modal-conto');
    switchView('nuova');
    clearForm();
    document.getElementById('f_targa').value = 'an123no';
    autoFillForm('f');
    ok(document.getElementById('f_anno').value === '2019', 'Anno: scrivendo una targa già vista si ricompila da solo');
    clearForm();
    document.getElementById('f_cognome').value = 'ANNATA';
    document.getElementById('f_targa').value = 'AN123NO';
    saveJob('todo');
    const j2 = db.filter(x => x.targa === 'AN123NO').pop();
    ok(j2 !== j1 && j2.anno === '2019', 'Anno: una nuova scheda della stessa targa lo riprende anche se il campo è rimasto vuoto');
    editJob(j2.id);
    ok(document.getElementById('f_anno').value === '2019', 'Anno: modificando la scheda il campo è compilato');
    document.getElementById('f_anno').value = '1850';
    saveJob('todo');
    ok(db.find(x => x.id === j2.id).anno === '2019', 'Anno: un anno impossibile non viene salvato (resta quello noto)');
    openPreventivoForm(j2.id, true);
    savePreventivo();
    ok(db.find(x => x.id === j2.id).anno === '2019', 'Anno: modificando la scheda dai Preventivi l\'anno resta');
    taggliandiDB['AN123NO'] = { data: _aggiungiMesi(getOggiLocale(), -1), km: '', note: '', avvisato: getOggiLocale(), avvisato_per: _aggiungiMesi(getOggiLocale(), -1) };
    saveTagliandi();
    await attendi(50);
    openEditClienteCognome(safeEncode(j2.clientId));
    const riga = [...document.querySelectorAll('.vehicle-edit-row')].find(r => r.querySelector('.edit_v_targa').value === 'AN123NO');
    ok(riga && riga.querySelector('.edit_v_anno').value === '2019', 'Anno: in Anagrafica, Modifica cliente, il campo Anno della moto è compilato');
    riga.querySelector('.edit_v_anno').value = '2018';
    saveClienteGlobale();
    ok(db.filter(x => x.targa === 'AN123NO').every(x => x.anno === '2018') && recordDi('db', j1.id).anno === '2018', 'Anno: cambiato dall\'Anagrafica vale per tutto lo storico della moto');
    ok(taggliandiDB['AN123NO'].avvisato === getOggiLocale(), 'Anno: salvando il cliente l\'avviso del tagliando resta');
    switchView('archivio');
    refreshArchive();
    ok([...document.querySelectorAll('#archive-results .anno-moto')].some(e => e.textContent === '2018'), 'Anno: nell\'elenco dell\'Anagrafica accanto alla moto');
    switchView('nuovo-cliente');
    const nv = (id, x) => document.getElementById(id).value = x;
    nv('nc-cognome', 'NUOVANNO'); nv('nc-nome', 'ELSA'); nv('nc-targa', 'NA999AA'); nv('nc-marca', 'BMW'); nv('nc-modello', 'F 900'); nv('nc-anno', '2022');
    salvaNuovoCliente();
    ok((db.find(x => x.targa === 'NA999AA') || {}).anno === '2022' && document.getElementById('nc-anno').value === '', 'Anno: anche nella pagina Nuovo cliente');
    switchView('nuova-app');
    apriModalApp(getOggiLocale());
    ok(!!document.getElementById('app_anno') && !!document.getElementById('m_app_anno'), 'Anno: campo presente nel nuovo appuntamento e nella finestra dell\'Agenda');
    campo('app_tipo', 'officina'); campo('app_cognome', 'AGENDANNO'); campo('app_nome', 'RINO'); campo('app_targa', 'AG555GA');
    campo('app_marca', 'SUZUKI'); campo('app_modello', 'V-STROM'); campo('app_anno', '2017'); campo('app_ora', '11:00');
    salvaAppuntamento();
    const ja = db.find(x => x.targa === 'AG555GA');
    const aa = agendaDB.find(x => String(x.jobId) === String(ja && ja.id));
    ok(ja && ja.anno === '2017' && recordDi('db', ja.id).anno === '2017', 'Anno: l\'appuntamento crea la scheda con l\'anno');
    modificaApp(aa.id);
    ok(document.getElementById('m_app_anno').value === '2017', 'Anno: aprendo l\'appuntamento il campo è compilato');
    campo('m_app_anno', '2016');
    salvaAppuntamento();
    ok(db.find(x => x.id === ja.id).anno === '2016', 'Anno: corretto dalla finestra dell\'Agenda si aggiorna la scheda');
    switchView('nuova-app');
    apriModalApp(getOggiLocale());
    campo('app_targa', 'AG555GA');
    autoFillAgenda();
    ok(document.getElementById('app_anno').value === '2016', 'Anno: nel nuovo appuntamento scrivendo una targa già vista si compila da solo');
    openPreventivoForm();
    ok(!!document.getElementById('p_anno') && document.getElementById('p_anno').value === '', 'Anno: campo presente (vuoto) nel nuovo preventivo');
    campo('p_cognome', 'PREVANNO'); campo('p_nome', 'GINO'); campo('p_targa', 'PR777EV'); campo('p_marca', 'TRIUMPH'); campo('p_modello', 'STREET TRIPLE'); campo('p_anno', '2015');
    savePreventivo();
    const jp = db.find(x => x.targa === 'PR777EV');
    ok(jp && jp.anno === '2015' && recordDi('db', jp.id).anno === '2015', 'Anno: salvato con il preventivo');
    openPreventivoForm(jp.id);
    ok(document.getElementById('p_anno').value === '2015', 'Anno: riaprendo il preventivo il campo è compilato');
    campo('p_anno', '2014');
    savePreventivo();
    ok(db.find(x => x.id === jp.id).anno === '2014', 'Anno: corretto nel preventivo si aggiorna');
    openPreventivoForm();
    campo('p_targa', 'PR777EV');
    autoFillForm('p');
    ok(document.getElementById('p_anno').value === '2014', 'Anno: nel preventivo scrivendo una targa già vista si compila da solo');
    switchView('garanzie');
    apriFormGaranzia();
    ok(!!document.getElementById('g_anno'), 'Anno: campo presente nella nuova garanzia');
    campo('g_cognome', 'PREVANNO'); campo('g_targa', 'PR777EV'); campo('g_cosa', 'POMPA BENZINA');
    salvaGaranzia();
    const gg = garanzieDB.find(x => x.cosa === 'POMPA BENZINA');
    ok(gg && gg.anno === '2014', 'Anno: la garanzia lo riprende dalla targa anche se il campo è vuoto');
    apriFormGaranzia(gg.id);
    ok(document.getElementById('g_anno').value === '2014', 'Anno: riaprendo la garanzia il campo è compilato');
    chiudiFormGaranzia();
    switchView('board');
  });

  await passo('Marche e modelli', async () => {
    const J = (k, id, marca, modello, targa) => ({ ['db/' + k]: { id, cognome: 'MARCHE', nome: k, marca, modello, targa, stato: 'archived', data: '2026-01-0' + (id % 9 + 1), clientId: 'c-mm' + id } });
    fb.scritturaRemota(Object.assign({},
      J('mm1', 8501, 'KAWASAKY', 'Z 650', 'MM001AA'), J('mm2', 8502, 'KAWASAKI', 'Z 650', 'MM002AA'), J('mm3', 8503, 'Kawasaki', 'Z 650', 'MM003AA'),
      J('mm4', 8504, 'YAMAHA', 'T-MAX 530', 'MM004AA'), J('mm5', 8505, 'YAMAHA', 'TMAX 530', 'MM005AA'), J('mm6', 8506, 'Yamaha', 'TMAX 530', 'MM006AA'),
      J('mm7', 8507, 'YAMAHA', 'NMAX 125', 'MM007AA'), J('mm8', 8508, 'YAMAHA', 'XMAX 125', 'MM008AA'), J('mm9', 8509, 'Harley Davidson', 'SPORTSTER', 'MM009AA'),
      J('mm10', 8510, 'FIAT', 'PANDA', 'MM010AA'), J('mm11', 8511, 'AFRICA TWIN', '', 'MM011AA'), J('mm12', 8512, 'ZXQW', 'BOH', 'MM012AA'),
      { 'agenda/mm': { id: 8599, tipo: 'officina', jobId: 8504, data: '2026-01-05', ora: '09:00', cliente: 'MARCHE MM4', moto: 'YAMAHA T-MAX 530 - MM004AA', raw_marca: 'YAMAHA', raw_modello: 'T-MAX 530', raw_targa: 'MM004AA' } }), false);
    await attendi(50);
    switchView('nuova');
    clearForm();
    const fm = document.getElementById('f_marca'), fmo = document.getElementById('f_modello');
    const voci = () => [...document.querySelectorAll('#moto-tendina [data-v]')].map(o => o.dataset.v);
    const scrivi = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    ok(!fm.getAttribute('list') && fm.getAttribute('autocomplete') === 'off', 'Marche: niente tendina del browser sul campo Marca');
    fm.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    const marche = voci();
    ok(marche.length > 40 && marche.every((v, i) => !i || marche[i - 1].localeCompare(v) <= 0), 'Marche: entrando nel campo si apre la tendina con tutte le marche in ordine alfabetico');
    scrivi(fm, 'k');
    ok(voci().length >= 4 && voci().every(v => v.startsWith('K')) && voci()[0] === 'KAWASAKI', 'Marche: scrivendo K solo le marche che iniziano con K, in ordine (' + voci().join(', ') + ')');
    scrivi(fm, 'a');
    ok(voci().includes('APRILIA') && !voci().includes('HONDA') && !voci().includes('YAMAHA'), 'Marche: scrivendo A niente HONDA o YAMAHA (la A sta dentro il nome, non all\'inizio)');
    fm.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    ok(fm.value === 'APRILIA' && !document.getElementById('moto-tendina'), 'Marche: freccia giù + Invio sceglie la prima (APRILIA) e chiude la tendina');
    scrivi(fm, 'mo');
    ok(voci().includes('MOTO GUZZI') && voci().includes('MOTO MORINI') && !voci().includes('BMW'), 'Marche: scrivendo MO compaiono MOTO GUZZI e MOTO MORINI');
    document.querySelector('#moto-tendina [data-v="MOTO GUZZI"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ok(fm.value === 'MOTO GUZZI' && !document.getElementById('moto-hint'), 'Marche: un clic sulla voce la scrive, senza avvisi');
    fm.value = '';
    ok(marche.includes('KAWASAKI') && marche.includes('MOTO GUZZI') && !marche.includes('FIAT') && !marche.includes('KAWASAKY') && !marche.includes('HARLEY DAVIDSON') && !marche.includes('AFRICA TWIN'), 'Marche: suggerite solo le marche vere (non i refusi, non i modelli, non le marche mai aggiunte)');
    fm.value = 'YAMAHA';
    fmo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    const modelli = voci();
    scrivi(fmo, 't');
    const conT = voci();
    scrivi(fmo, '');
    _chiudiTendinaMoto();
    ok(modelli.includes('TMAX 530') && !modelli.includes('T-MAX 530') && modelli.includes('NMAX 125') && modelli.includes('XMAX 125') && !modelli.includes('Z 650'), 'Modelli: solo quelli della marca scelta, una volta sola nella scrittura più usata');
    ok(conT.includes('TMAX 530') && conT.every(v => v.startsWith('T')), 'Modelli: scrivendo T solo i modelli che iniziano con T');
    const hint = () => document.getElementById('moto-hint');
    fm.value = 'kawasaky'; fm.dispatchEvent(new Event('change', { bubbles: true }));
    ok(hint() && hint().textContent.includes('Intendevi KAWASAKI?'), 'Marche: scrivendo KAWASAKY compare "Intendevi KAWASAKI?"');
    hint().querySelector('.mh-si').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ok(fm.value === 'KAWASAKI' && !hint(), 'Marche: "Correggi" scrive KAWASAKI e chiude l\'avviso');
    fm.value = 'Honda'; fm.dispatchEvent(new Event('change', { bubbles: true }));
    ok(!hint(), 'Marche: una marca giusta non dà avvisi');
    fm.value = 'BENDA'; fm.dispatchEvent(new Event('change', { bubbles: true }));
    ok(!hint() && marche.includes('BENDA'), 'Marche: BENDA è una marca, non un errore per HONDA');
    fm.value = 'HODNA'; fm.dispatchEvent(new Event('change', { bubbles: true }));
    ok(hint() && hint().textContent.includes('Intendevi HONDA?'), 'Marche: lettere invertite (HODNA) propongono HONDA');
    fm.value = 'KAWAZAKY'; fm.dispatchEvent(new Event('change', { bubbles: true }));
    ok(hint() && hint().textContent.includes('Intendevi KAWASAKI?'), 'Marche: su un nome lungo anche due lettere sbagliate (KAWAZAKY)');
    fm.value = 'KIA'; fm.dispatchEvent(new Event('change', { bubbles: true }));
    ok(hint() && !hint().textContent.includes('Intendevi') && hint().textContent.includes('non è nell\'elenco'), 'Marche: una marca sconosciuta (KIA) non viene "corretta" ma si può aggiungere');
    fm.value = 'FIAT'; fm.dispatchEvent(new Event('change', { bubbles: true }));
    hint().querySelector('.mh-si').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ok(fb.leggi('marche_extra/FIAT') === 'FIAT' && fm.value === 'FIAT', 'Marche: "➕ Aggiungi all\'elenco" salva la marca per tutti i Mac');
    fm.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    scrivi(fm, 'fi');
    ok(voci().includes('FIAT'), 'Marche: la marca aggiunta compare nei suggerimenti');
    _chiudiTendinaMoto();
    fm.value = 'FIAT'; fm.dispatchEvent(new Event('change', { bubbles: true }));
    ok(!hint(), 'Marche: la marca aggiunta non dà più avvisi');
    fm.value = 'africa twin'; fmo.value = '1100'; fm.dispatchEvent(new Event('change', { bubbles: true }));
    ok(hint() && hint().textContent.includes('HONDA · AFRICA TWIN 1100'), 'Marche: AFRICA TWIN nella marca propone HONDA · AFRICA TWIN 1100');
    hint().querySelector('.mh-si').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ok(fm.value === 'HONDA' && fmo.value === 'AFRICA TWIN 1100', '"Sistema" scrive HONDA nella marca e sposta AFRICA TWIN nel modello');
    fm.value = 'YAMAHA'; fmo.value = 't max 530'; fmo.dispatchEvent(new Event('change', { bubbles: true }));
    ok(hint() && hint().textContent.includes('Intendevi TMAX 530?'), 'Modelli: "T MAX 530" propone la scrittura già usata TMAX 530');
    fmo.value = 'XMAX 125'; fmo.dispatchEvent(new Event('change', { bubbles: true }));
    ok(!hint(), 'Modelli: XMAX e NMAX restano due modelli diversi');
    fmo.value = 'MT 09'; fmo.dispatchEvent(new Event('change', { bubbles: true }));
    ok(!hint(), 'Modelli: un modello nuovo non dà avvisi');
    switchView('archivio');
    refreshArchive();
    ok(!document.getElementById('btn-pulizia-moto').classList.contains('hidden'), 'Pulizia: in Anagrafica compare "Sistema marche e modelli"');
    apriPuliziaMoto();
    const idx = (tipo, proposta) => _gruppiPulizia.findIndex(g => g.tipo === tipo && g.proposta === proposta);
    ok(idx('marca', 'KAWASAKI') > -1 && idx('marca', 'HARLEY-DAVIDSON') > -1 && idx('modello', 'TMAX 530') > -1, 'Pulizia: trovati KAWASAKY/KAWASAKI, Harley Davidson e T-MAX/TMAX');
    ok(!_gruppiPulizia.some(g => g.tipo === 'modello' && ('NMAX 125' in g.varianti)), 'Pulizia: NMAX e XMAX non vengono messi insieme');
    const cf = window.confirm; window.confirm = () => true;
    try {
      unificaGruppoMoto(idx('marca', 'KAWASAKI'));
      ok(['8501', '8502', '8503'].every(id => recordDi('db', +id).marca === 'KAWASAKI'), 'Pulizia: "Unifica" scrive KAWASAKI in tutte le schede (anche quelle in minuscolo)');
      unificaGruppoMoto(idx('modello', 'TMAX 530'));
      ok(recordDi('db', 8504).modello === 'TMAX 530' && Object.values(fb.nodo('agenda')).find(a => a.id === 8599).moto === 'YAMAHA TMAX 530 - MM004AA', 'Pulizia: unificato il modello, aggiornato anche l\'appuntamento');
    } finally { window.confirm = cf; }
    ok(!_gruppiPulizia.some(g => g.proposta === 'FIAT'), 'Pulizia: la marca aggiunta (FIAT) non è più tra quelle da sistemare');
    const iS = _gruppiPulizia.findIndex(g => g.tipo === 'scambio' && g.nomeModello === 'AFRICA TWIN');
    const iN = _gruppiPulizia.findIndex(g => g.tipo === 'nuova' && g.proposta === 'ZXQW');
    ok(iS > -1 && _gruppiPulizia[iS].proposta === 'HONDA' && iN > -1, 'Pulizia: trovati il modello scritto nella marca (AFRICA TWIN → HONDA) e la marca sconosciuta ZXQW');
    window.confirm = () => true;
    try { unificaGruppoMoto(iS); } finally { window.confirm = cf; }
    ok(recordDi('db', 8511).marca === 'HONDA' && recordDi('db', 8511).modello === 'AFRICA TWIN', 'Pulizia: "Sistema" scrive HONDA e sposta AFRICA TWIN nel modello');
    marcaNuovaDaPulizia(_gruppiPulizia.findIndex(g => g.tipo === 'nuova' && g.proposta === 'ZXQW'));
    ok(fb.leggi('marche_extra/ZXQW') === 'ZXQW' && !_gruppiPulizia.some(g => g.proposta === 'ZXQW'), 'Pulizia: "➕ È una marca" la aggiunge all\'elenco');
    ignoraGruppoMoto(idx('marca', 'HARLEY-DAVIDSON'));
    ok(idx('marca', 'HARLEY-DAVIDSON') === -1 && recordDi('db', 8509).marca === 'Harley Davidson', 'Pulizia: "Lascia così" toglie il gruppo senza cambiare niente');
    try { localStorage.removeItem('mgm_pulizia_moto_ignorati'); } catch (e) {}
    closeModal('modal-pulizia-moto');
    switchView('board');
  });

  await passo('Schede tecniche', async () => {
    const oggi = getOggiLocale();
    const JJ = (k, id, targa, stato, anno) => ({ ['db/' + k]: { id, cognome: 'TECNICA', nome: k, marca: 'SUZUKI', modello: 'BURGMAN 400', targa, stato, data: oggi, anno, conto: [], acconti: [], clientId: 'c-st' + id } });
    fb.scritturaRemota(Object.assign({}, JJ('st1', 8601, 'ST001AA', 'archived', '2014'), JJ('st2', 8602, 'ST002AA', 'archived', '2018'),
      JJ('st3', 8603, 'ST003AA', 'todo', '2018'), JJ('st4', 8604, 'ST004AA', 'todo', '2014'),
      { 'schede_tecniche/vecchia': { id: 'vecchia', marca: 'HONDA', modello: 'SH 125', filtro_olio: 'HF113', candela: 'CPR7EA', olio: '10W30', gomme: '100/80-16 · 120/80-16' } }), false);
    await attendi(50);
    switchView('schede');
    const el = document.getElementById('st-elenco');
    ok(el.textContent.includes('SUZUKI BURGMAN 400') && el.textContent.includes('SENZA SCHEDA'), 'Schede: tra i modelli frequenti senza scheda c\'è SUZUKI BURGMAN 400');
    nuovaSchedaPer(safeEncode('SUZUKI'), safeEncode('BURGMAN 400'));
    const righe = () => [...document.querySelectorAll('#st-codici-righe .st-riga-codice')];
    ok(!document.getElementById('modal-scheda-tecnica').classList.contains('hidden') && document.getElementById('st_marca').value === 'SUZUKI' && document.getElementById('st_modello').value === 'BURGMAN 400', 'Schede: "➕" apre una scheda nuova con marca e modello già scritti');
    ok(righe().length === 8 && righe()[0].querySelector('.stc-nome').value === 'Filtro olio' && !document.getElementById('st-ricambi-usati'), 'Schede: la scheda nuova ha già le righe dei ricambi comuni da completare con i codici');
    righe()[0].querySelector('.stc-codice').value = 'hf147';
    righe()[0].querySelector('.stc-alt').value = 'MAHLE OC 575';
    righe()[2].querySelector('.stc-codice').value = 'CR7E';
    aggiungiRigaCodice();
    righe()[8].querySelector('.stc-nome').value = 'Kit frizione'; righe()[8].querySelector('.stc-codice').value = 'FR-400';
    campo('st_olio_tipo', '10W40'); campo('st_olio_qta', '1,7'); campo('st_note', 'Togliere il pannello <centrale>');
    campo('st_gomma_ant', '120/80-14'); campo('st_press_ant', '2,0'); campo('st_gomma_post', '150/70-13'); campo('st_press_post', '2,25');
    salvaSchedaTecnica();
    const sc1 = Object.values(fb.nodo('schede_tecniche') || {}).find(x => x.modello === 'BURGMAN 400' && !x.anno_da);
    const ric = sc1 ? Object.values(sc1.ricambi || {}) : [];
    ok(sc1 && ric.length === 3 && ric[0].nome === 'Filtro olio' && ric[0].codice === 'HF147' && ric[0].alternativo === 'MAHLE OC 575' && ric[2].nome === 'Kit frizione' && sc1.olio_tipo === '10W40' && sc1.olio_qta === '1,7', 'Schede: salvati solo i ricambi con il codice (anche quelli aggiunti), con codice alternativo');
    const vista = document.getElementById('st-vista');
    ok(vista.textContent.includes('Olio motore10W40 · 1,7 L'), 'Schede: olio con tipo e quantità in litri');
    ok(_litri('2,7 con filtro') === '2,7 L con filtro' && _litri('2,5 litri') === '2,5 litri' && _litri('2,4–2,7') === '2,4–2,7 L', 'Schede: la L dei litri aggiunta solo quando manca');
    ok(sc1.gomma_ant === '120/80-14' && sc1.press_ant === '2,0' && sc1.gomma_post === '150/70-13' && sc1.press_post === '2,25', 'Schede: misure e pressioni salvate divise tra anteriore e posteriore');
    ok(vista.textContent.includes('Gomma anteriore120/80-14 · 2,0 bar') && vista.textContent.includes('Gomma posteriore150/70-13 · 2,25 bar'), 'Schede: nella scheda gomma anteriore e posteriore con la pressione in bar');
    ok(vista.textContent.includes('CODICI RICAMBI') && vista.textContent.includes('HF147') && vista.textContent.includes('FR-400') && !vista.textContent.includes('USATI') && vista.innerHTML.includes('&lt;centrale&gt;'), 'Schede: la scheda mostra la tabella dei codici, senza i ricambi dei conti');
    inventarioMag.push({ codice: 'HF-147', nome: 'FILTRO OLIO', giacenza: 4 });
    apriSchedaTecnica(sc1.id);
    ok(document.getElementById('st-vista').textContent.includes('4 in magazzino'), 'Schede: se il codice c\'è in Magazzino mostra quanti pezzi ci sono');
    inventarioMag.pop();
    refreshSchedeTecniche();
    ok(el.textContent.includes('SUZUKI BURGMAN 400') && el.textContent.includes('Filtro olio HF147'), 'Schede: nell\'elenco con i primi codici');
    campo('st-cerca', 'cr7e'); refreshSchedeTecniche();
    ok(el.textContent.includes('BURGMAN 400') && !el.textContent.includes('SH 125'), 'Schede: si cerca anche per codice ricambio');
    campo('st-cerca', ''); refreshSchedeTecniche();
    apriSchedaTecnica('vecchia');
    ok(document.getElementById('st-vista').textContent.includes('HF113') && document.getElementById('st-vista').textContent.includes('CPR7EA'), 'Schede: le schede della prima versione mostrano i codici scritti nei vecchi campi');
    apriSchedaTecnica('vecchia', true);
    ok(righe().length === 2 && righe()[0].querySelector('.stc-codice').value === 'HF113', 'Schede: modificandole i vecchi codici passano nella tabella');
    ok(document.getElementById('st-campi').textContent.includes('Prima era scritto: «100/80-16 · 120/80-16»') && document.getElementById('st-campi').textContent.includes('Prima era scritto: «10W30»'), 'Schede: i vecchi campi unici di gomme e olio vengono mostrati da dividere');
    closeModal('modal-scheda-tecnica');
    apriSchedaTecnica(null, true);
    campo('st_marca', 'suzuki'); campo('st_modello', 'BURGMAN 400'); campo('st_olio_tipo', 'ALTRO');
    salvaSchedaTecnica();
    ok(Object.values(fb.nodo('schede_tecniche') || {}).filter(x => x.modello === 'BURGMAN 400').length === 1, 'Schede: non si crea una seconda scheda uguale');
    campo('st_anno_da', '2017'); campo('st_anno_a', '2020'); campo('st_olio_tipo', '5W40'); campo('st_olio_qta', '1,9 con filtro');
    salvaSchedaTecnica();
    closeModal('modal-scheda-tecnica');
    await attendi(30);
    ok((_schedaTecnicaPer('SUZUKI', 'BURGMAN 400', '2018') || {}).olio_tipo === '5W40' && (_schedaTecnicaPer('Suzuki', 'burgman 400', '2014') || {}).olio_tipo === '10W40', 'Schede: con gli anni si sceglie la scheda giusta per l\'anno della moto');
    switchView('board');
    refreshBoard();
    const card = [...document.querySelectorAll('.card-compact')].find(c => c.textContent.includes('ST003AA'));
    ok(card && card.querySelector('.st-chip'), 'Schede: sulla Bacheca il simbolo 🔧 accanto al modello');
    apriSchedaTecnicaJob(8603);
    ok(document.getElementById('st-vista').textContent.includes('5W40'), 'Schede: il 🔧 apre la scheda giusta per quella moto (2018)');
    closeModal('modal-scheda-tecnica');
    openClosingModal(8604);
    const cs = document.getElementById('conto-scheda-tecnica').textContent;
    ok(cs.includes('HF147') && cs.includes('10W40 · 1,7 L'), 'Schede: nel conto il riquadro con codici e dati principali');
    closeModal('modal-conto');
    const sc2 = _schedaTecnicaPer('SUZUKI', 'BURGMAN 400', '2018');
    apriSchedaTecnica(sc2.id, true);
    const cf = window.confirm; window.confirm = () => true;
    try { eliminaSchedaTecnica(); } finally { window.confirm = cf; }
    ok(!(fb.nodo('schede_tecniche') || {})[sc2.id], 'Schede: si può eliminare');
    switchView('board');
  });

  await passo('Offline', async () => {
    switchView('board');
    fb.setConnesso(false);
    ok(ovVisibile() && ovTitolo() === 'Connessione assente', 'Offline: pannello "Connessione assente"');
    const n = nScr();
    db.find(x => x.id === 1002).note_offline = 'NO';
    saveDB();
    ok(nScr() === n, 'Offline: salvataggio bloccato, niente messo in coda');
    ok(ovTesto().includes('NON è stata salvata'), 'Offline: il pannello avvisa che la modifica non è stata salvata');
    const timer = [], st = window.setTimeout;
    window.setTimeout = (f, ms) => { timer.push(ms); return 0; };
    try { fb.setConnesso(true); } finally { window.setTimeout = st; }
    ok(ovVisibile() && ovTitolo() === 'Connessione tornata', 'Offline: al ritorno della rete pannello "Connessione tornata"');
    ok(timer.includes(1500), 'Offline: ricarica della pagina programmata per riallinearsi');
  });

  const intere = fb.scritture.filter(w => !w.remota && w.chiavi.some(k => k === 'db' || k === 'agenda'));
  ok(intere.length === 0, 'Nessuna riscrittura dell\'intero archivio o dell\'agenda in tutte le prove');
  ok(fb.scritture.every(w => !w.offline), 'Nessuna scrittura fatta senza connessione');
  const idsFin = Object.values(fb.nodo('db')).map(x => x.id);
  ok(new Set(idsFin).size === idsFin.length && Object.values(fb.nodo('db')).every(x => x && typeof x === 'object'), 'Archivio finale: nessuna scheda doppia o vuota');
  ok(window.__errori.length === 0, 'Nessun errore JavaScript' + (window.__errori.length ? ': ' + window.__errori.join(' | ') : ''));

  R.unshift('ESITO: ' + (falliti ? falliti + ' prove FALLITE su ' + totali : 'tutte le ' + totali + ' prove superate'), '');
  R.push('', 'Avvisi mostrati: ' + fb.alerts.length + (fb.alerts.length ? ' → ' + fb.alerts.join(' | ') : ''));
  R.push('console.error: ' + window.__consoleErrori.length + (window.__consoleErrori.length ? ' → ' + window.__consoleErrori.slice(0, 5).join(' | ') : ''));
  R.push('Scritture sul finto cloud: ' + fb.scritture.length);
  document.getElementById('e2e-risultati').textContent = R.join('\n');
  document.title = 'E2E-FINE';
})();
