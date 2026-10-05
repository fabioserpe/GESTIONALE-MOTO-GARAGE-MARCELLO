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

  for (let i = 0; i < 300 && fb.inAttesa.length < 15; i++) await attendi(20);
  await attendi(50);

  await passo('Avvio', async () => {
    ok(document.getElementById('app-shell').style.display === 'flex', 'Avvio: accesso simulato, gestionale visibile');
    ok(fb.inAttesa.length === 15, 'Avvio: tutte le 15 sezioni in ascolto (' + fb.inAttesa.length + ')');
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
                   'specials', 'incidentate', 'magazzino', 'nuova-app', 'tagliandi', 'scadenze', 'lista-attesa', 'usate'];
    const conErrori = [];
    for (const v of viste) {
      const e0 = window.__errori.length;
      try { switchView(v); } catch (e) { conErrori.push(v + ': ' + e.message); }
      await attendi(150);
      if (window.__errori.length > e0) conErrori.push(v + ': ' + window.__errori.slice(e0).join(' | '));
    }
    ok(conErrori.length === 0, 'Tutte le 19 schermate si aprono senza errori' + (conErrori.length ? ' → ' + conErrori.join(' ; ') : ''));
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
