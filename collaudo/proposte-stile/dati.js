(function () {
  const d = new Date(), iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const oggi = iso(d), g = n => { const x = new Date(d); x.setDate(x.getDate() + n); return iso(x); };
  let n = 100;
  const J = (cog, nom, tel, mar, mod, tg, stato, lav, extra) => Object.assign({ id: ++n, cognome: cog, nome: nom, tel, marca: mar, modello: mod, targa: tg, stato, data: oggi, lavori_richiesti: lav, acconti: [], conto: [], totale_lordo: 0, clientId: 'c' + n }, extra || {});
  const db = [
    J('ROSSI', 'GIUSEPPE', '3341212121', 'YAMAHA', 'TMAX 560', 'FZ456CD', 'todo', 'TAGLIANDO 40.000 KM', { anno: '2021' }),
    J('BIANCHI', 'LUCA', '3334445555', 'HONDA', 'SH 300', 'EA555AB', 'todo', 'CAMBIO GOMME + FRENI'),
    J('CARUSO', 'MARCO', '3337778899', 'DUCATI', 'MULTISTRADA V4', 'GB321GH', 'doing', 'RUMORE FRIZIONE, CONTROLLO CATENA', { conto: [{ desc: 'MANODOPERA', price: 120, qty: 1, iva: 22 }], totale_lordo: 120, anno: '2023' }),
    J('NIGRO', 'SARA', '3290275688', 'KAWASAKI', 'Z 650', 'FX615AB', 'doing', 'TAGLIANDO', { acconti: [{ val: 50, date: oggi }], conto: [{ desc: 'OLIO', price: 15, qty: 3, iva: 22 }], totale_lordo: 45 }),
    J('VERDI', 'ANNA', '3337778888', 'BMW', 'R 1250 GS', 'EF11111', 'done', 'GOMME', { conto: [{ desc: 'PNEUMATICI', price: 320, qty: 1, iva: 22 }], totale_lordo: 320, data_chiusura: oggi }),
    J('LEONE', 'FRANCO', '3384445566', 'PIAGGIO', 'BEVERLY 300', 'GA778KL', 'archived', 'TAGLIANDO', { data: g(-40), data_chiusura: g(-40) }),
    J('AMATO', 'RITA', '3471112233', 'KYMCO', 'AGILITY 125', 'FY102ZZ', 'archived', 'BATTERIA', { data: g(-90), data_chiusura: g(-90) })
  ];
  const agenda = [
    { id: 1, tipo: 'officina', jobId: 101, data: oggi, ora: '09:00', cliente: 'ROSSI GIUSEPPE', moto: 'YAMAHA TMAX 560 - FZ456CD', tel: '3341212121', note: 'TAGLIANDO 40.000 KM' },
    { id: 2, tipo: 'officina', jobId: 102, data: oggi, ora: '11:30', cliente: 'BIANCHI LUCA', moto: 'HONDA SH 300 - EA555AB', tel: '3334445555', note: 'CAMBIO GOMME + FRENI' },
    { id: 3, tipo: 'officina', data: g(1), ora: '10:00', cliente: 'GRECO PAOLO', moto: 'SUZUKI V-STROM', tel: '3405556677', note: 'DIAGNOSI' },
    { id: 4, tipo: 'personale', data: g(2), ora: '15:00', cliente: 'PAGAMENTO F24', note: '' }
  ];
  const ledger = [{ id: 1, data: oggi, tipo: 'in', cat: 'officina', collab: 'MULTIMOTORS', desc: 'TAGLIANDO SH 300', importo: 80, qta: 1 }, { id: 2, data: oggi, tipo: 'out', cat: 'officina', collab: 'MULTIMOTORS', desc: 'ACCONTO', importo: 50, qta: 1 }, { id: 3, data: oggi, tipo: 'in', cat: 'officina', collab: 'GOMMISTA', desc: 'CERCHI', importo: 60, qta: 1 }];
  window.__fb.caricaDati({ db, agenda, ordini: [], ledger });
})();
