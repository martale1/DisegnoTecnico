# Disegno — laboratorio di assonometria cavaliera

La vista **Pianta → Cavaliera** dispone la pianta sotto l’assonometria in un unico foglio. Le linee blu riportano l’ascissa, quelle ocra riportano la profondità ridotta lungo l’angolo di fuga e quelle verdi elevano i punti alla quota corrispondente. Il riferimento è il piano alla minima quota Z della scena. La costruzione è la cavaliera ridotta: entrando nella vista la profondità torna a ½ (× ½ nell’intestazione) e resta modificabile dal menu «Riduzione profondità» per confronti con ¾ o 1. Le linee di collegamento sono tracciate per tutti i vertici e anche per i punti in cui gli spigoli di un solido attraversano le facce di un altro: è così che il quadrato piccolo della pianta (la sezione della piramide sul piano superiore della lastra) arriva fino alla cavaliera. Il menu «Segui un punto» isola un vertice; le lettere consentono di confrontarlo nelle due viste. La costruzione segue anche solidi spostati e ruotati ed è inclusa nell’esportazione SVG. Le otto proiezioni restano disponibili nella tavola completa.

Applicazione locale con frontend HTML/CSS/JavaScript e backend Node.js (18 o successivo), senza dipendenze npm.

## Avvio

```sh
npm start
```

Aprire http://localhost:3000. Per i controlli geometrici: `npm test`.

## Installazione sul Raspberry Pi

Con Node.js 18 o successivo già presente (sul Raspberry Pi OS bookworm c’è Node 20), il progetto si porta sul dispositivo con git e gira come servizio systemd:

```sh
git clone https://github.com/martale1/DisegnoTecnico.git ~/DisegnoTecnico
sudo install -m 0644 ~/DisegnoTecnico/deploy/disegno.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now disegno
```

Il servizio usa `HOST=0.0.0.0` e `PORT=3001` (la 3000 può essere occupata da altri programmi) e risponde su `http://<ip-del-raspberry>:3001`. Per aggiornare: `git pull` nella cartella del progetto e `sudo systemctl restart disegno`. Non servono virtualenv Python: l’applicazione è solo Node.js.

Solidi: parallelepipedo, cubo, piramide retta a base rettangolare e prisma triangolare. Dimensioni da 10 a 300 unità, angolo da 10° a 80°, profondità ridotta a ½, ¾ o intera. Spigoli nascosti tratteggiati, assi e download SVG. Il disegno si adatta alla finestra e non ha scala di stampa fissa.

Il backend espone `POST /api/project` con parametri JSON `shape`, `width`, `depth`, `height`, `angle`, `reduction`. Restituisce vertici proiettati, facce visibili e spigoli. Formula: X = x + k y cos(α), Y = −z − k y sin(α). La visibilità è calcolata con le normali delle facce per questi solidi convessi.

Composizioni: fino a 30 solidi, aggiunta, duplicazione, eliminazione, traslazione X/Y/Z e rotazione intorno a Z. Salvataggio automatico della scena nel localStorage del browser. Sei viste ortogonali (prospetto, retro, pianta, basso, profili destro e sinistro), cavaliera e isometrica. Tavole a quattro o otto viste con scala comune ed esportazione SVG della vista corrente.

Scenari pronti: torre di tre cubi, piramide su piedistallo, solidi affiancati, scalinata, casa con torre. I solidi impilati sono centrati e appoggiati a contatto; quelli affiancati hanno posizioni preimpostate. Ogni scenario resta modificabile e aggiorna tutte le viste. Il pulsante «Ripristina scena precedente» annulla l’ultimo caricamento di uno scenario durante la sessione.

L’API accetta anche `{solids: [...], angle: 45, reduction: 0.5}` e restituisce tutte le otto proiezioni. Ogni solido accetta `x`, `y`, `z`, `rotation`. Il motore ritaglia le facce visibili secondo la profondità, divide gli spigoli in tratti visibili e nascosti e calcola le intersezioni tra le facce rivolte all’osservatore. Le facce colorate sono disattivabili; il colore è modificabile per solido. Lo scenario «Piramide attraverso la lastra» riproduce la composizione della foto: la quota Z della lastra cambia l’altezza di attraversamento. SVG conserva facce e tratteggi come elementi vettoriali. Il modello mantiene i solidi separati: non genera una mesh booleana unificata o le linee di intersezione fra facce entrambe posteriori.

Nessuna autenticazione o persistenza sul server. Per impostazione predefinita il server ascolta solo su `127.0.0.1`; con `HOST=0.0.0.0` (e `PORT`, se serve) diventa raggiungibile dalla rete locale, come nell’installazione sul Raspberry Pi. I font online sono opzionali: senza connessione viene usato il font di sistema. In ambienti che impediscono la creazione di processi di test, usare Node.js 24 e `node --test --test-isolation=none`.
