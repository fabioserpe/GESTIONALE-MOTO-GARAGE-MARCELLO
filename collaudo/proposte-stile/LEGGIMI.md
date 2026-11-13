# Proposte di stile (13/11/2026, in attesa della scelta di Fabio)

Non pubblicate (la cartella non è copiata da `deploy.yml`). Tre stili, solo estetica, layout invariato:
`body.tema-a` Ardesia (scuro di oggi più curato), `body.tema-b` Chiaro (da rifinire pagina per pagina:
molti colori scuri sono scritti a mano negli `style=""`), `body.tema-c` Officina (grafite + arancione).

Per rifare le anteprime: copiare `index.html` sostituendo gli script Firebase con `fake-firebase.js` +
`dati.js` (come fa `collauda.sh`), aggiungere in `<head>` Google Fonts Inter/JetBrains Mono e `temi.css`,
in fondo `scena.js`, e aprire `app.html?s=board|agenda|archivio|conto|collab|nuova&t=a|b|c` con Chrome
senza finestra (`--screenshot`). Idea di messa in opera: opzione in ☰ → Aspetto (classe su `body`,
salvata in `mgTema` come gli altri colori), stile di oggi sempre disponibile.
