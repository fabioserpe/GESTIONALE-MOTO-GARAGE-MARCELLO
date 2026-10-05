(function () {
  const d = new Date();
  const oggi = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  window.__oggi = oggi;
  window.__fb.caricaDati({
    db: [
      { id: 1001, data: oggi, cognome: 'ROSSI', nome: 'MARIO', tel: '3331112222', marca: 'HONDA', modello: 'CB500', targa: 'AB12345', km: '12000', stato: 'todo', lavori_richiesti: 'TAGLIANDO', acconti: [], conto: [], totale_lordo: 0, clientId: 'c-rossi' },
      { id: 1002, data: oggi, cognome: 'BIANCHI', nome: 'LUCA', tel: '3334445555', marca: 'YAMAHA', modello: 'MT07', targa: 'CD67890', km: '30000', stato: 'doing', lavori_richiesti: 'FRENI', acconti: [{ val: 50, date: oggi }], conto: [{ desc: 'PASTIGLIE', price: 40, qty: 2, iva: 22 }], totale_lordo: 80, clientId: 'c-bianchi' },
      { id: 1003, data: '2026-09-01', cognome: 'VERDI', nome: 'ANNA', tel: '3337778888', marca: 'DUCATI', modello: 'MONSTER', targa: 'EF11111', stato: 'done', lavori_richiesti: 'GOMME', conto: [{ desc: 'GOMMA', price: 120, qty: 1, iva: 22 }], totale_lordo: 120, clientId: 'c-verdi' },
      { id: 1004, data: '2026-08-15', cognome: 'NERI', nome: 'PAOLO', marca: 'BMW', modello: 'GS', targa: 'GH22222', stato: 'archived', data_chiusura: '2026-08-20', lavori_richiesti: 'REVISIONE', conto: [], totale_lordo: 0 },
      { id: 1005, data: oggi, cognome: 'GIALLI', nome: 'SARA', tel: '3335556666', marca: 'KTM', modello: 'DUKE', targa: 'IL33333', km: '8000', stato: 'preventivo', era_preventivo: true, lavori_richiesti: 'Vedi voci preventivo', conto: [{ desc: 'KIT TRASMISSIONE', price: 300, qty: 1, iva: 22 }], totale_lordo: 300, clientId: 'c-gialli', acconti: [{ val: 100, date: oggi }] },
    ],
    agenda: [{ id: 2001, tipo: 'officina', jobId: 1001, data: oggi, ora: '09:00', cliente: 'ROSSI MARIO', moto: 'HONDA CB500 - AB12345', note: 'TAGLIANDO' }],
    ledger: { a1: { id: 3001, data: oggi, tipo: 'in', cat: 'officina', collab: 'INTERNO', desc: 'INCASSO PROVA', importo: 10, qta: 1 } },
    magazzino: { 'OLIO-01': { codice: 'OLIO-01', nome: 'OLIO 10W40', marca: 'MOTUL', categoria: 'LUBRIFICANTI', giacenza: 10, prezzo: 8, prezzo_pubblico: 15, min_stock: 2 } },
    note: 'nota di prova',
    moto_usate: { '9001': { id: 9001, marca: '<img src=x onerror="window.__xss=1">', modello: 'TEST', cognome: 'PROVA', stato: 'disponibile', data_ins: oggi } },
  });
})();
