# Timone · piattaforma di controllo e analisi aziendale

Versione 1.1.0 — **nucleo finanziario** e **lettura dei bilanci XBRL**.
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
| `dati.js` | archivio: dispositivo, Supabase cloud, server aziendale |
| `supabase-setup.sql` | schema del database con isolamento per azienda |
| `sw.js`, `manifest.json`, `icona.svg`, `versione.json` | installazione e aggiornamenti |
| `test.js`, `test-xbrl.js` | test automatici: `node test.js` e `node test-xbrl.js` |

## Pubblicazione

Caricare tutti i file nella stessa cartella di un sito statico (GitHub Pages va bene).
Ad ogni modifica: aumentare `VERSIONE` in `app.js` **e** `versione.json`.

## Dove stanno i dati (scelta per azienda / installazione)

1. **Questo dispositivo** — predefinito, senza account: per prove e simulazioni.
2. **Supabase in cloud** — creare un progetto, eseguire `supabase-setup.sql` nel SQL Editor, poi in Impostazioni inserire URL e chiave pubblica.
3. **Server dell'azienda** — installare Supabase auto-ospitato (Docker) sul server, eseguire lo stesso `supabase-setup.sql`, inserire in Impostazioni l'indirizzo del server. Stesso schema, stesso codice.

Il passaggio da un archivio all'altro si fa con esporta/importa JSON.

## Stato delle verifiche

- Motore: 43 test su un caso calcolato a mano + 7.680 controlli su 240 aziende simulate, tutti superati.
- XBRL: 225 test su bilanci generati da aziende simulate (ordinario, abbreviato, micro, `.p7m` in tre codifiche, totali alterati, voci mancanti) e prova su un bilancio micro reale depositato: tutti i controlli sui totali ufficiali superati.
- Interfaccia: percorso completo provato in un browser a dimensione telefono (archivio sul dispositivo).
- Database: schema, isolamento tra aziende, ruoli e storico provati su PostgreSQL 16 con autenticazione simulata.
- **Non ancora provato**: il collegamento dell'app a un progetto Supabase reale (accesso, lettura, salvataggio). Va verificato al primo collegamento.

## Non ancora presente (prossimi passi)

- Lettura di PDF e bilanci di verifica.
- XBRL: numero dei dipendenti e dettaglio dei debiti dalla nota integrativa (oggi si leggono solo i prospetti); la firma digitale dei `.p7m` non viene verificata.
- Abbonamenti e pagamenti, condizioni contrattuali, informativa privacy e nomina a responsabile del trattamento.
- Motore AI conversazionale (predisposto: il motore di calcolo espone già dati, formule e affidabilità da passare al modello).
- Benchmark di settore, moduli operativi (produzione, commesse, magazzino, personale, energia), app per dipendenti.
