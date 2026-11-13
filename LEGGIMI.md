# Timone · piattaforma di controllo e analisi aziendale

Versione 1.10.0 — **nucleo finanziario**, **lettura dei bilanci XBRL**, **report** e moduli operativi **Commesse e marginalità**, **Magazzino e scorte**, **Personale**, **Energia e utenze**, **Produzione**, **Investimenti**, **Decisioni produttive**, **Finanziamenti e agevolazioni**, **Commerciale**.

Tutto ciò che manca, è approssimato o non è stato verificato è elencato in [LIMITI.md](LIMITI.md).
"Timone" è un nome di lavoro: si cambia in `index.html` e `manifest.json`.

## Cosa fa oggi

- Aziende multiple, ognuna con i propri esercizi; ruoli per utente (titolare, amministrazione, consulente, sola lettura) quando si usa il database.
- **Bilancio XBRL** depositato al Registro delle Imprese (tassonomia itcc-ci, forme ordinaria, abbreviata e micro, anche firmato `.p7m`): crea l'azienda con denominazione, ATECO e forma giuridica, legge tutti gli esercizi presenti e controlla ogni voce con i totali ufficiali. Nei bilanci abbreviati e micro crediti e debiti sono in un'unica voce: Timone non li ripartisce da solo ma li mostra "da ripartire" con il totale ufficiale e un aiuto per assegnare il resto.
- Bilancio: inserimento manuale o importazione Excel/CSV; ogni valore conserva origine (manuale, importato, simulato), fonte, data, stato di verifica e storico delle modifiche.
- Riclassificazione: conto economico a valore aggiunto, stato patrimoniale finanziario, rendiconto ricostruito tra due esercizi.
- Costi fissi e variabili configurabili voce per voce (le quote predefinite restano "ipotesi" finché non vengono confermate).
- 32 indici, ciascuno con formula, voci usate, significato, lettura, limiti, azioni; distinzione tra indici da bilancio e indici che richiedono dati gestionali.
- Diagnosi: criticità ordinate per priorità, con dati, causa probabile, intervento, peso economico, affidabilità.
- Budget con ipotesi dichiarate, confronto con il consuntivo e scomposizione degli scostamenti.
- Scenari prudenziale / centrale / favorevole con leve modificabili; calcolo della produzione necessaria per un utile obiettivo.
- **Report** dell'esercizio (bilancio riclassificato, rendiconto, indici, criticità, budget) da stampare o salvare in PDF.
- **Modulo Commesse e marginalità** (attivabile per azienda): costo diretto di ogni commessa da materiali, ore di lavoro, ore macchina, energia (kWh misurati oppure stimati da potenza × fattore di carico × ore, sempre etichettati), lavorazioni esterne e trasporti; preventivo e consuntivo; costo e prezzo per unità; costi indiretti ricavati dal bilancio e ribaltati con criterio a scelta; analisi per cliente e per prodotto; **riconciliazione** tra dati gestionali e contabilità fino al risultato operativo; criticità (commesse in perdita, sotto soglia, preventivi superati, scarti, dipendenza da un cliente) riportate anche nella Diagnosi.
- **Modulo Magazzino e scorte** (attivabile per azienda): inventario per articolo importato da Excel/CSV o inserito a mano; ogni articolo è classificato come regolare, in eccesso, fermo, obsoleto o sotto scorta in base a consumi, copertura e data dell'ultimo movimento (se i dati non bastano resta "dati incompleti", non viene indovinato); capitale immobilizzato e suo costo finanziario, capitale liberabile, classi ABC, elenco dei riordini con quantità proposte, confronto con le rimanenze di bilancio; criticità riportate in Diagnosi e nel Report.
- **Modulo Personale** (attivabile per azienda): riepilogo annuale per persona importato da Excel/CSV o inserito a mano; costo aziendale effettivo (retribuzione, contributi, TFR, INAIL, premi, benefit, formazione), costo per ora lavorata per reparto, quota di straordinari e assenze, diretti e indiretti; produttività (ricavi e valore aggiunto per persona e per ora); confronto con il costo del personale di bilancio e con i costi orari usati nelle commesse; simulazioni «conviene assumere?», «straordinari o una persona in più?», «conviene esternalizzare?». Contributi e TFR non inseriti sono calcolati ed etichettati. Nessuna graduatoria individuale.
- **Modulo Energia e utenze** (attivabile per azienda): bollette mensili di elettricità, gas, acqua e altri combustibili, importate da Excel/CSV o inserite a mano, per utenza e per utilizzo (produzione, uffici, magazzino, riscaldamento…); consumi, costo unitario reale, composizione della spesa (energia, trasporto, oneri, imposte), fasce orarie, confronto con l'anno precedente; mesi con consumi anomali; potenza impegnata eccessiva o superata; contratti in scadenza; **confronto con le offerte** inserite dall'utente sul costo complessivo, al netto di costi di cambio e penali; collegamento con le commesse (prezzo del kWh usato e kWh attribuiti). I mesi mancanti non vengono stimati.
- **Modulo Produzione** (attivabile per azienda, per chi lavora con macchine o impianti): registrazioni mensili per macchina importate da Excel/CSV o inserite a mano; ore disponibili, pianificate, operative; disponibilità, performance, qualità e **OEE**; perdite in ore equivalenti con la principale in evidenza; produttività oraria, tempo ciclo effettivo, energia per pezzo, capacità utilizzata; costo dei fermi (inserito oppure stimato dal bilancio, sempre etichettato) e dei pezzi scartati; confronto con le ore macchina delle commesse e con i kWh delle bollette. Senza tempo ciclo standard l'OEE non viene calcolato.
- **Modulo Investimenti** (attivabile per azienda): per ogni investimento ipotizzato (macchinari, impianti, automazione, software, veicoli, immobili, ampliamenti) flussi di cassa anno per anno, VAN, TIR, tempo di recupero semplice e attualizzato, redditività media, piano di rimborso del finanziamento e copertura della rata, sensibilità («e se i benefici calassero del 10-20-30%?»), effetto su EBITDA, debito netto e liquidità dell'azienda, esito (conviene, conviene con riserva, non conviene) e classifica tra più investimenti. I benefici sono ipotesi dell'utente e sono dichiarati come tali.
- **Modulo Decisioni produttive – «Produrre o fermare?»** (attivabile per azienda): per una linea o un prodotto, su un periodo di alcuni mesi, simula mese per mese sei alternative (continuare a pieno ritmo, ridurre, produrre solo su ordinazione, produrre in anticipo e poi fermare, fermare temporaneamente, esternalizzare) e per ciascuna calcola risultato economico, effetto sulla cassa, scorte, capitale immobilizzato, costo finanziario, rischio di obsolescenza e vendite perse; distingue i costi fissi evitabili con il fermo da quelli che restano; ripete il confronto con i soli ordini confermati.
- **Modulo Finanziamenti, mutui e agevolazioni** (attivabile per azienda): mutui e prestiti (rata costante, quota capitale costante, capitale alla scadenza, preammortamento, rate mensili o periodiche), leasing e fidi; piano di rimborso, costo totale e tasso effettivo con le spese; a fine esercizio o a oggi: debito residuo, quota entro e oltre 12 mesi, rate dei 12 mesi successivi, tasso medio, effetto di un punto di tasso in più; confronto con debiti e interessi di bilancio e copertura delle rate con l'EBITDA; confronto tra offerte sul tasso effettivo; simulazione di estinzione anticipata e rinegoziazione; **registro delle agevolazioni** con fonte, data di verifica, termine e requisiti (Timone non cerca bandi e non ne inventa).
- **Modulo Commerciale** (attivabile per azienda): vendite per cliente e per mese importate da Excel/CSV o inserite a mano; ricavi, margine e quota di ogni cliente, classi ABC, concentrazione; clienti nuovi, persi, in calo e fermi; mantenimento dei ricavi; stagionalità; settori, zone e famiglie di prodotto più redditizi («dove cercare nuovi clienti», senza inventare nominativi); tempi di pagamento e costo del ritardo; confronto con i ricavi di bilancio; **trattative** con valore, probabilità, fase, chiusura prevista e fonte del contatto, valore ponderato e tasso di successo; simulazioni «e se perdessi questo cliente?» e «quanto costa uno sconto?».
- **Simulazione generale**: generatore di aziende di fantasia (5 settori × 6 situazioni, riproducibili con un seme), collaudo dell'azienda aperta e collaudo massivo del motore.
- Aggiornamento: l'app resta sulla versione installata finché non si preme "Aggiorna" (compare solo se `versione.json` indica una versione più recente).

Regole applicate ovunque: nessun dato inventato, i vuoti non valgono zero, le stime e le simulazioni sono sempre etichettate.

## File

| File | Contenuto |
|---|---|
| `index.html` | pagina e stile |
| `app.js` | interfaccia |
| `motore.js` | motore di calcolo (funzioni pure, usabile anche lato server) |
| `simulatore.js` | generatore di aziende simulate e collaudi |
| `importa.js` | lettura CSV/Excel, numeri in formato italiano |
| `xbrl.js` | lettura dei bilanci XBRL e dei file firmati `.p7m` |
| `commesse.js`, `ui-commesse.js` | modulo Commesse: calcolo (funzioni pure) e interfaccia |
| `magazzino.js`, `ui-magazzino.js` | modulo Magazzino: calcolo, importazione e interfaccia |
| `personale.js`, `ui-personale.js` | modulo Personale: calcolo, simulazioni, importazione e interfaccia |
| `energia.js`, `ui-energia.js` | modulo Energia e utenze: calcolo, importazione e interfaccia |
| `produzione.js`, `ui-produzione.js` | modulo Produzione: calcolo, importazione e interfaccia |
| `investimenti.js`, `ui-investimenti.js` | modulo Investimenti: calcolo e interfaccia |
| `decisioni.js`, `ui-decisioni.js` | modulo Decisioni produttive: calcolo e interfaccia |
| `finanziamenti.js`, `ui-finanziamenti.js` | modulo Finanziamenti, mutui e agevolazioni: calcolo e interfaccia |
| `commerciale.js`, `ui-commerciale.js` | modulo Commerciale: calcolo, importazione e interfaccia |
| `LIMITI.md` | registro dei limiti aperti |
| `dati.js` | archivio: dispositivo, Supabase cloud, server aziendale |
| `supabase-setup.sql` | schema del database con isolamento per azienda |
| `sw.js`, `manifest.json`, `icona.svg`, `versione.json` | installazione e aggiornamenti |
| `test.js`, `test-xbrl.js`, `test-commesse.js`, `test-magazzino.js`, `test-personale.js` | test automatici, uno per file: `node test.js` ecc. |

## Pubblicazione

Caricare tutti i file nella stessa cartella di un sito statico (GitHub Pages va bene).
Ad ogni modifica: aumentare `VERSIONE` in `app.js` **e** `versione.json`.

## Dove stanno i dati (scelta per azienda / installazione)

1. **Questo dispositivo** — predefinito, senza account: per prove e simulazioni.
2. **Supabase in cloud** — creare un progetto, eseguire `supabase-setup.sql` nel SQL Editor, poi in Impostazioni inserire URL e chiave pubblica.
3. **Server dell'azienda** — installare Supabase auto-ospitato (Docker) sul server, eseguire lo stesso `supabase-setup.sql`, inserire in Impostazioni l'indirizzo del server. Stesso schema, stesso codice.

Il passaggio da un archivio all'altro si fa con esporta/importa JSON.

## Come si aggiunge un modulo

Un modulo è una coppia di file: il calcolo (funzioni pure, testabili con Node) e l'interfaccia, che si registra con `Timone.registra({ id, titolo, descrizione, vista, azioni, criticita, collaudo, simula })`.
Il nucleo non va modificato: la scheda compare da sola, le criticità entrano nella Diagnosi e nel Report, i controlli nel collaudo, i dati di prova nel simulatore. I dati del modulo stanno in `azienda.<id>`.

## Stato delle verifiche

- Motore: 43 test su un caso calcolato a mano + 7.680 controlli su 240 aziende simulate, tutti superati.
- Commesse: 29 test su un caso calcolato a mano + 1.620 controlli su 90 aziende con commesse simulate (quadratura con l'EBIT, ribaltamento integrale, costi attribuiti entro il bilancio), tutti superati.
- Commerciale: 80 test (quote, margini, movimenti dei clienti, pagamenti, trattative e simulazioni calcolati a mano, importazione) + 1.170 controlli su 90 aziende con vendite simulate, tutti superati.
- Finanziamenti: 88 test (piani, tasso effettivo, situazione a una data, estinzione, rinegoziazione e agevolazioni calcolati a mano) + 1.260 controlli su 90 aziende con finanziamenti simulati, tutti superati.
- Decisioni produttive: 41 test (le sei alternative calcolate a mano su un caso) + 288 controlli su 36 aziende con casi simulati, tutti superati.
- Investimenti: 50 test (VAN, TIR, recupero, rata e casi completi calcolati a mano) + 720 controlli su 90 aziende con investimenti simulati, tutti superati.
- Produzione: 42 test (OEE, perdite, costo dei fermi e coerenze calcolati a mano, importazione) + 540 controlli su 36 aziende manifatturiere e artigiane simulate, tutti superati.
- Energia: 41 test (bollette, costo unitario, anomalie, potenza, offerte e penali calcolati a mano, importazione) + 2.772 controlli su 90 aziende con utenze simulate, tutti superati.
- Personale: 39 test (costi, produttività e simulazioni calcolati a mano, importazione) + 1.440 controlli su 90 aziende con personale simulato, tutti superati.
- Magazzino: 33 test (classificazione calcolata a mano, importazione con numeri e date italiani) + 1.500 controlli su 75 aziende con inventario simulato, tutti superati.
- XBRL: 225 test su bilanci generati da aziende simulate (ordinario, abbreviato, micro, `.p7m` in tre codifiche, totali alterati, voci mancanti) e prova su un bilancio micro reale depositato: tutti i controlli sui totali ufficiali superati.
- Interfaccia: percorso completo provato in un browser a dimensione telefono (archivio sul dispositivo).
- Database: schema, isolamento tra aziende, ruoli e storico provati su PostgreSQL 16 con autenticazione simulata.
- **Non ancora provato**: il collegamento dell'app a un progetto Supabase reale (accesso, lettura, salvataggio). Va verificato al primo collegamento.

## Non ancora presente

Vedi [LIMITI.md](LIMITI.md): è l'elenco completo e aggiornato.
