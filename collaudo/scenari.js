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

  await passo('Ordini collegati alla moto', async () => {
    const toast = () => (document.querySelector('.toast-msg') || {}).textContent || '';
    const ordine = desc => Object.values(fb.leggi('ordini') || {}).find(x => x.desc === desc);
    ordinaRicambioPerJob(1002);
    ok(currentView === 'ordini' && document.getElementById('ord-form-container').style.display === '', 'Dalla scheda (menu ⋯ → Ordina ricambio) si apre il modulo ordine');
    ok(document.getElementById('ord_job').value === '1002' && document.getElementById('ord_cliente').value === 'BIANCHI LUCA' && document.getElementById('ord_tel_cliente').value === '3334445555', 'Moto già scelta, cliente e telefono compilati');
    const opzioni = [...document.getElementById('ord_job').options].map(o => o.value);
    ok(!opzioni.includes('1004') && opzioni.includes('1401') && opzioni.includes('1002'), 'Elenco moto: solo quelle aperte (anche incidentate), non le archiviate');
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
    ok([...document.getElementById('ord_job').options].some(o => o.value === '1501' && o.textContent.includes('appuntamento ' + formattaData(dApp))), 'Elenco moto: indica la data dell\'appuntamento');
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
      // 🖨️ Stampa Preventivo
      printPreventivo(1903); await attendi(150);
      ok(stampe.length === 1 && document.getElementById('print-area').textContent.includes('ACTERZO') && document.getElementById('print-area').textContent.includes('260.00'), 'Stampa Preventivo: pagina di stampa con cliente e totale');
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
    ok(t.indexOf('LARSSON') < t.indexOf('PARTS EUROPE') && t.indexOf('PARTS EUROPE') < t.indexOf('Senza fornitore'), 'Da ordinare diviso per fornitore, "Senza fornitore" in fondo');
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
    segnaOrdinatiFornitore(safeEncode('LARSSON'));
    const leggi = id => Object.values(fb.leggi('ordini') || {}).find(o => o.id === id);
    ok(leggi(9101).stato === 'doing' && leggi(9102).stato === 'doing' && leggi(9101).data_ordinato === oggi && leggi(9103).stato === 'todo', 'Segna tutti ordinati: solo quelli del fornitore, con la data dell\'ordine');
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
