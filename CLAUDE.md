# Gestionale Moto Garage Marcello

Gestionale web dell'officina moto di Fabio (Ragusa), usato ogni giorno su Mac (app Chrome installata) e telefono.
Tutto in un unico file `index.html` (HTML + CSS + JS vanilla), dati su Firebase Realtime Database, pubblicato su GitHub Pages.
Fabio scrive in italiano e non è uno sviluppatore: rispondi in italiano semplice, senza gergo.

## Regole di lavoro con Fabio

- **Non rompere niente**: il gestionale è in produzione. Ogni modifica va collaudata (`./collaudo/collauda.sh`) prima della pubblicazione.
- **Prima di proporre una funzione nuova, cerca nel codice se esiste già** (`grep`). È già successo di proporre "Export dati" che c'era.
- Interventi piccoli e mirati. Un restyling completo è stato proposto e rifiutato (2026-10-05, "troppo impegnativo"); refactor grossi (es. dividere `index.html` in più file) sconsigliati.
- Se una richiesta ha più interpretazioni, chiedi con opzioni concrete (AskUserQuestion) prima di scrivere codice.
- Quando trovi un difetto preesistente collegato al lavoro, correggilo e diglielo chiaramente (cosa succedeva, cosa controllare a mano).
- Dopo ogni pubblicazione ricordagli `Cmd+Shift+R` (il Service Worker tiene la versione vecchia).

## Pubblicare una modifica

1. Modifica `index.html`. Per più sostituzioni usa uno script Python con `assert html.count(VECCHIO) == 1` per ognuna (le funzioni lunghe sono su una sola riga, l'Edit tool sbaglia facilmente).
2. Incrementa la versione cache in `sw.js` (`const CACHE = 'garage-vNNN'`), altrimenti i dispositivi non si aggiornano.
3. Collaudo: `./collaudo/collauda.sh` (3 secondi; `-v` mostra tutte le prove). Aggiungi scenari per la funzione nuova in `collaudo/scenari.js`.
4. Commit su `main` (messaggio in italiano, con la versione: `... (garage-vNNN)`), poi push. Il push via SSH a volte resta appeso:
   `GIT_SSH_COMMAND="ssh -o ConnectTimeout=15 -o BatchMode=yes" perl -e 'alarm 90; exec @ARGV' git push`
5. Il push su `main` pubblica il sito (GitHub Actions copia solo index.html, sw.js, manifest, icone, README nel branch `gh-pages`; non toccare `gh-pages`). Verifica che sia online:
   `curl -s https://fabioserpe.github.io/GESTIONALE-MOTO-GARAGE-MARCELLO/sw.js | head -1` deve mostrare la nuova versione (di solito 40 s).

Se la pubblicazione fallisce per un guasto di GitHub (controlla https://www.githubstatus.com, voce Actions/Pages) non riparte da sola: quando il servizio torna operativo, ricarica una modifica a un file pubblicato (basta alzare la versione in `sw.js`). Stato delle esecuzioni senza login: `curl -s https://api.github.com/repos/fabioserpe/GESTIONALE-MOTO-GARAGE-MARCELLO/actions/runs?per_page=3`.

In modalità automatica un push su `main` (= rilascio in produzione) può essere bloccato se Fabio non l'ha chiesto esplicitamente: in quel caso chiediglielo.

## Collaudo (`collaudo/`)

- `fake-firebase.js`: finto Firebase v8 (auth + database) con la stessa semantica del vero: array salvati con chiavi numeriche, `null` cancella, eventi sincroni, `once`, `push`. Espone `window.__fb` (scritture, `leggi(path)`, `setConnesso`, `scritturaRemota` per simulare un altro dispositivo).
- `dati-iniziali.js`: dati finti di partenza. `scenari.js`: le prove (oltre 130), raggruppate con `passo('nome', async () => …)`.
- Il test aspetta che tutti i listener siano registrati: se aggiungi un `database.ref('/nuovo').on('value')`, aggiorna il numero (oggi **15**) in `scenari.js`.
- Per vedere una schermata: genera la pagina come fa `collauda.sh` e usa Chrome headless con `--screenshot`. Per i PDF generati: `sips -s format png file.pdf --out file.png`.
- Node non è installato; per JS isolato c'è `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`.

## Architettura di `index.html`

- 3 blocchi `<script>` inline; il principale contiene quasi tutto. Le funzioni sono globali (chiamate dagli `onclick` nell'HTML).
- Variabili globali per sezione: `db` (lavori, preventivi, incidentate: tutto in `/db`), `agendaDB`, `ledgerDB`, `ordiniDB`, `rubricaDB`, `noteDB`, `billingDB`, `taggliandiDB`, `scadenzeDB`, `motoUsateDB`, `listaAttesaDB`, `inventarioMag`, `listaOrdiniMag`, `peritiDB`, `librettiInfo`.
- `initFirebaseListeners()`: un listener `.on('value')` per sezione, attivati dopo il login (`auth.onAuthStateChanged`). Il listener `/db` esegue anche migrazioni silenziose una tantum (con `_dbMigrateGuard`).
- `switchView(viewId)`: mostra una sezione e chiama il suo `refresh…()`; `currentView` dice quale è aperta.
- **Salvataggi**: ogni `save…()` comincia con `_puoSalvare('sezione', …)`, che blocca se manca la connessione o se la sezione non è ancora arrivata dal cloud (pannello `#offline-banner`, gestito da `_aggiornaOverlayCloud`). Ogni listener chiama `_segnaCaricato('sezione')`. Una funzione di salvataggio nuova deve rispettare entrambe le cose.
- `db` e `agenda` si salvano **per singola scheda**: `_leggiSezione` ricorda le chiavi del cloud, `_salvaSezioni` scrive solo le schede cambiate/nuove/eliminate in un unico `update`. Le altre sezioni riscrivono l'intera sezione.
- Annulla: `saveSnapshot()` prima di una modifica, `eseguiUndo()`.
- Finestre: `openModal(id)` / `closeModal(id)` (classe `hidden`). Per controllare che nessun pulsante chiami funzioni inesistenti: confronta i nomi negli `onclick` con le `function` definite.
- Utilità: `$`, `htmlEsc` (usarlo su ogni testo inserito dall'utente dentro innerHTML), `genId` (numero), `genClientId`, `formattaData`, `getOggiLocale`, `mostraToast`/`mostraErrore`, `chiaveTarga` (targa → solo A-Z0-9).

### Sezioni → funzioni principali

| Sezione | Funzioni |
|---|---|
| Bacheca | `refreshBoard`, `moveStatus`, `saveJob` (scheda), `openClosingModal` + `saveJobConConto` (conto; "Salva Pre-Conto" = `'doing'`), `previewJob` (anteprima) |
| Lavori Lunghi / Incidentate | `refreshSpecials`, `refreshIncidentate`, `apriPreventivoIncidentata` (apre il preventivo aperto della targa o ne crea uno) |
| Preventivi | `refreshPreventivi`, `openPreventivoForm`, `savePreventivo` (una riga lunghissima), `nuovoPreventivoStessaMoto`, `printPreventivo`, `creaPdfPreventivo` (jsPDF), `openInvioPerito`/`inviaAlPerito` |
| Periti e libretti | `openPeritiModal`, `salvaPerito`, `caricaLibretto`, `apriLibretto`, `aggiornaLibrettoBox` |
| Anagrafica | `refreshArchive`, `viewHistoryCognome`, `openEditStorico`/`saveEditStorico`, `sincronizzaAnagrafica` |
| Prima Nota | `refreshLedger`, `openCollabDetail`, `archiviaSoloScheda` (→ `/storico_casse`), `azzeraCassa` |
| Magazzino | `initMagazzino`, `renderAllMag`, `magSave`, `modificaArticoloMag`; il conto usa `prezzo_pubblico` se > 0. Sotto scorta = `magDaRiordinare` (esaurito o giacenza ≤ `min_stock`, default 1): stessa regola per righe colorate, riquadro "Da Riordinare", filtro e `apriRiordino`/`confermaRiordino` (→ lista da ordinare, senza doppioni per codice). `spostaInMagazzino` ricarica la merce arrivata |
| Ordini ricambi | Fabio vuole poche informazioni per riga: una riga corta per ricambio (`_rigaOrdine`: qtà, ricambio, moto · cognome, un'indicazione, un pulsante ✓), tutto il resto nel dettaglio che si apre al clic (`toggleDettaglioOrdine`, `_ordAperti`). Elenco con schede per stato (`currentOrdTab`: `todo` → `doing` → `done` → `consegnato` = Storico), `_rigaOrdine`, "Da ordinare" raggruppato per fornitore (`copiaElencoFornitore`, `segnaOrdinatiFornitore`), `consegnaOrdine`/`segnaTuttiConsegnati`, `_consegnaOrdiniMotoChiuse` (arrivati di moto pronte/archiviate → Storico da soli, chiamata dai listener `/db` e `/ordini`); `moveOrdine` registra `data_ordinato`/`data_arrivo`; "in attesa" = `_ordineInAttesa` (todo/doing). `refreshOrdini`, `addOrdine` (in modifica conserva stato e data e chiude il modulo; un ordine nuovo lascia il modulo aperto per il ricambio successivo con `_prontoPerProssimoRicambio`, elenco dei ricambi della moto in `_elencoRicambiJob`), `moveOrdine`, `waOrdineArrivato`. Collegamento alla moto: campo `jobId` (+ `targa`, `moto`) scelto con `popolaSelectJobOrdine`; `ordinaRicambioPerJob` dal menu ⋯ delle schede; `_badgeRicambi(jobId, dataAppuntamento)` mostra "Attesa ricambi"/"Ricambi arrivati" su bacheca, Lavori Lunghi, Incidentate e schede dell'Agenda (`_renderAgendaCard`, pulsante 📦), in rosso se la consegna prevista è dopo l'appuntamento (`_appuntamentoDelJob`, `aggiornaInfoJobOrdine`) |
| Moto usate | `refreshUsate`, `saveUsateDB`, `compressImgUsata` (foto in base64) |
| Backup manuale | `exportData`/`importData` (salvano solo 8 sezioni su 14: c'è il backup automatico, vedi sotto) |

## Convenzioni dati e trappole note

- **Id**: `genId()` restituisce un numero, negli `onclick` arriva come stringa → confronta sempre con `String(a.id) === String(id)`.
- **Firebase trasforma gli array in oggetti** (`{"0":…,"1":…}`) e lascia buchi dopo le cancellazioni: leggi con `Object.values(...)`/`Array.isArray` e non fidarti degli indici.
- **Prezzi nel conto**: nei preventivi aperti (`stato === 'preventivo'`) `c.price` è il **totale di riga**; nelle commesse è il **prezzo unitario** (totale = price × qty). Per mostrare il totale di riga usa sempre `_totaleRiga(j, c)`. Una migrazione nel listener `/db` converte le commesse nate da preventivi.
- Stati di una scheda in `db`: `todo` (appuntamento), `doing` (sul ponte), `done` (pronta), `archived`, `preventivo`, `special` (+ `special_cat`: `restauri` / `specials` / `ricambi` / `incidentate`). Il pre-conto di una scheda `special` non cambia lo stato. `_pendingSpecialCat` ("incidentata" in attesa) vale solo dentro la vista `nuova`: `switchView` lo azzera, `saveJob` lo consuma; "Salva in Lavori Lunghi" su un'incidentata toglie `special_cat`. `spostaInLavoriLunghi` dal menu delle Incidentate.
- **Ricambi ordinati nel conto**: un ordine collegato a una moto aperta crea nel suo conto una riga con `ordine_id` (prezzo = `prezzo_cliente` dell'ordine, senza `mag_codice`: non scala il magazzino). `_sincronizzaContoOrdine` aggiorna solo i campi cambiati nell'ordine; `in_conto` sull'ordine evita di rimettere una riga tolta a mano. `addVoceConto`/`saveJobConConto` devono conservare `ordine_id` (dataset `ordineId`), altrimenti il legame si perde e nascono doppioni.
- Preventivo assicurativo: campi `assicurativo`, `perito_id`, `n_sinistro`, `inviato_perito`. `savePreventivo` ricostruisce l'oggetto da zero: un campo nuovo va aggiunto lì o si perde al salvataggio.
- Nei form, i campi vuoti vanno impostati con `valore || ''`, altrimenti compare e si salva la parola "undefined".
- Libretti: `/libretti/{TARGA}` contiene il file (letto solo con `.once` quando serve), `/libretti_info/{TARGA}` l'elenco leggero (con listener). Massimo 7 MB.
- Nodi Firebase: `/db`, `/agenda`, `/ledger`, `/ordini`, `/lista_ordini`, `/rubrica`, `/note`, `/billing`, `/scadenze`, `/tagliandi`, `/lista_attesa`, `/moto_usate`, `/magazzino/{codice}`, `/storico_casse/{collab}`, `/periti/{id}`, `/libretti`, `/libretti_info`.
- Il CSS globale rende maiuscoli i campi di testo (solo a video): per le email aggiungi `text-transform:none`.

## Servizi esterni

- **Firebase** progetto `motogaragemarcello-18f47`, piano gratuito Spark. Un solo account (email/password di Fabio) usato da tutti i dispositivi; registrazione nuovi account disattivata; regole `auth != null` (Fabio non ha voluto legarle all'UID). Non attivare altri metodi di accesso né riaprire la registrazione senza prima restringere le regole.
- **Backup automatico**: Google Apps Script "Backup Gestionale" sull'account Google di Fabio, ogni notte 3–4 salva tutto il database nella cartella Drive "Backup Gestionale" (30 giorni + il primo del mese per 12 mesi), email solo in caso di errore o se i lavori calano di oltre il 10%. Ripristino: console Firebase → Realtime Database → Importa JSON.
- **GitHub**: `git@github.com:fabioserpe/GESTIONALE-MOTO-GARAGE-MARCELLO.git`, sito `https://fabioserpe.github.io/GESTIONALE-MOTO-GARAGE-MARCELLO/`.
- **jsPDF 2.5.1** da cdnjs, caricato solo al primo PDF.

## Ultime versioni

| Versione | Cosa |
|---|---|
| v131–v133 | Moto usate cliccabili (id numero/stringa), archivio schede collaboratore senza doppioni |
| v134 | 11 correzioni (Prima Nota come lista, acconti preventivo, duplicati agenda, …) |
| v135 | Anteprima conto: totale riga = prezzo × quantità |
| v136–v137 | Protezione salvataggi (offline/caricamento) e salvataggio per singola scheda |
| v138 | Lavori Lunghi: pre-conto sulla scheda senza spostarla |
| v139 | "Lavori Lunghi" nella barra in alto, barra senza voci tagliate |
| v140 | Bacheca: importo invece di "SALDATO" quando gli acconti coprono il totale |
| v141–v142 | Preventivi assicurativi: rubrica periti, libretti per targa, invio al perito; fix quantità nei preventivi |
| v143 | Incidentate come l'Anagrafica, ricerca, Preventivo apre quello esistente; fix "undefined" |
| v144 | Magazzino: "Riordina sotto scorta" in un clic; regola sotto scorta unificata (prima il riquadro usava "≤ 3 pezzi") |
| v145 | Ordini ricambi collegati alla moto, indicazione "Attesa ricambi" sulle schede; fix: modificare un ordine non lo rimanda più in "Da ordinare" |
| v146 | Solo ripubblicazione: la pubblicazione di v144–v145 era fallita per il guasto GitHub Actions del 5/10 sera |
| v147 | Ordina ricambio dagli appuntamenti in Agenda; confronto consegna prevista / data appuntamento |
| v148 | Ricambio ordinato per una moto → riga nel suo conto (prezzo al cliente nell'ordine, preso dal magazzino se il codice esiste) |
| v149 | Più ricambi di fila: il modulo ordine resta aperto sulla stessa moto, con l'elenco dei ricambi già inseriti |
| v150 | Modulo ordine: "Chiudi Form" lo svuota, pulsante 🧹 per svuotarlo senza chiuderlo (`svuotaModuloOrdine`) |
| v151 | Fix: moto spostate nei Lavori Lunghi che finivano tra le Incidentate (promemoria "incidentata" rimasto attivo); "Sposta in Lavori Lunghi" nelle Incidentate |
| v152 | Fix: "Converti in Commessa" dalle righe dei preventivi aperti non apriva la conferma dal 23/09 (v53): chiamava `openModal`, che non esisteva |
| v153 | Ordini ricambi rifatti: elenco a righe con schede Da ordinare/Ordinati/Arrivati/Storico, raggruppati per fornitore, "Consegnato", ricerca, date di ordine/arrivo |
| v154 | Ordini: una riga corta per ricambio, dettagli e azioni secondarie al clic ("troppe informazioni") |
