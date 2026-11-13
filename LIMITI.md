# Timone · registro dei limiti

Elenco di tutto ciò che la piattaforma **non fa ancora, fa in modo approssimato o non è stato verificato**.
Si aggiorna a ogni rilascio. Comando di lavoro: **«richiama i limiti»** → l'elenco viene riproposto e si sceglie quali risolvere.

Stato: 🔴 aperto · 🟡 in parte risolto · 🟢 risolto (con versione).
Ultimo aggiornamento: versione 1.5.0.

## A. Verifiche mancanti (funzioni scritte ma non provate su casi reali)

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| A1 | Collegamento a un database Supabase reale mai provato (accesso, lettura, salvataggio, utenti). Lo schema SQL è provato solo su PostgreSQL con accessi simulati. | Progetto Supabase dedicato (previsto come ultimo passo). | 🔴 |
| A2 | Lettura XBRL di bilanci **ordinari** e **abbreviati** provata solo su file generati da noi; su file reali è provata solo la forma micro. | Un bilancio XBRL reale ordinario e uno abbreviato. | 🔴 |
| A3 | Lettura dei file **Excel (.xlsx)** mai provata con un file vero (bilancio, inventario, personale): provato solo il CSV. | Prova con file .xlsx reali o generati. | 🔴 |
| A4 | Tasto «Aggiorna»: riscritto senza vedere quello di AgendApp 1.6.0, può differire; mai provato su GitHub Pages con due versioni successive. | Confronto con AgendApp e prova online. | 🔴 |
| A5 | Stampa del report e download dei file provati solo in parte (nella pagina di prova sono bloccati). | Prova sulla versione pubblicata. | 🔴 |
| A6 | Non è noto se GitHub Pages sia stato attivato per il repository. | Attivazione da Settings → Pages. | 🔴 |

## B. Nucleo finanziario

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| B1 | Bilanci in **PDF** non letti (né testo né scansione/OCR). | Lettore PDF + riconoscimento delle voci, con verifica sui totali. | 🔴 |
| B2 | **Bilancio di verifica**, mastrini e libro giornale non importabili: manca la mappatura conto → voce. | Importazione con piano dei conti e regole di mappatura salvabili. | 🔴 |
| B3 | Le soglie della diagnosi sono regole generali, non valori di settore. Nessun **benchmark** (bilanci depositati, ISTAT, ISA, codice ATECO). | Modulo benchmarking con fonti verificabili. | 🔴 |
| B4 | La diagnosi non calcola costo dell'intervento, investimento necessario e tempo di recupero. | Modulo investimenti (VAN, TIR, payback). | 🔴 |
| B5 | Scostamenti di budget: non separano effetto prezzo ed effetto volume. Budget solo economico (mancano finanziario, patrimoniale, investimenti). | Dati di vendita per quantità; budget di cassa. | 🔴 |
| B6 | Scenari: un solo anno; non considerano investimenti, reazione dei clienti ai prezzi, limiti di capacità. Imposte con aliquota semplificata (effettiva dell'anno o 27,9%). | Pianificazione pluriennale (1-3-5-10 anni) con stato patrimoniale e cassa previsionali. | 🔴 |
| B7 | Rendiconto finanziario ricostruito dalle variazioni di bilancio (stima). | Dati di cassa o rendiconto dell'azienda. | 🔴 |
| B8 | DSO e DPO sovrastimati perché crediti e debiti includono l'IVA; usano i saldi di fine anno. | Aliquota IVA media o scadenziario. | 🔴 |
| B9 | Nel bilancio abbreviato la quota a breve dei debiti va inserita a mano (ripartizione assistita, non automatica). | Nota integrativa o bilancio di verifica (vedi B2, C2). | 🟡 |
| B10 | Nessuna previsione di cassa, scadenziario, esposizione bancaria. | Modulo tesoreria. | 🔴 |
| B11 | Classificazione costi fissi/variabili: solo una quota percentuale per voce di bilancio, non per singolo conto. | Bilancio di verifica (B2). | 🔴 |

## C. Lettura XBRL

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| C1 | La firma digitale dei file .p7m non viene verificata (il bilancio viene solo estratto). | Verifica crittografica della firma. | 🔴 |
| C2 | Non si leggono le tabelle di nota integrativa: numero dei dipendenti, dettaglio dei debiti per scadenza e natura. | Lettura dei contesti con dimensioni. | 🔴 |
| C3 | Tassonomie anteriori al 2016: la gestione straordinaria non ha una voce corrispondente. Bilancio consolidato: solo un avviso. | Mappatura dedicata. | 🔴 |

## D. Modulo Commesse

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| D1 | Commesse inseribili solo a mano: manca l'importazione da file. | Importazione Excel/CSV come per il magazzino. | 🔴 |
| D2 | Mancano i dati per macchina: fermi, attrezzaggi, tempi ciclo, OEE, saturazione. | Modulo produzione. | 🔴 |
| D3 | Le ore non arrivano dall'app per dipendenti (che non esiste ancora). | App mobile con QR code e modalità offline. | 🔴 |
| D4 | Analisi clienti senza tempi di pagamento, frequenza ordini, rischio di perdita. | Scadenziario e storico ordini (modulo commerciale). | 🔴 |
| D5 | Un solo costo orario per risorsa e un solo prezzo dell'energia per tutto l'anno. Dalla 1.5.0 il modulo Energia confronta il prezzo usato con quello reale delle bollette e segnala lo scarto, ma l'aggiornamento resta manuale e non è per mese o fascia. | Aggiornamento automatico del prezzo; tariffe per periodo e fasce orarie. | 🟡 |
| D6 | Preventivo come unico importo (costo diretto), non per singola componente. | Preventivo dettagliato. | 🔴 |

## E. Modulo Magazzino

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| E1 | Lavora su inventari a una data, non sui movimenti giorno per giorno. | Importazione dei movimenti di magazzino. | 🔴 |
| E2 | Mancano lotti e scadenze. | Campi e controlli dedicati. | 🔴 |
| E3 | Nessuna ricerca di fornitori o materiali alternativi. | Modulo fornitori con fonti verificabili. | 🔴 |
| E4 | Soglie predefinite (costo del capitale 6%, fermo 180 giorni, obsoleto 365, copertura 120) non adattate al settore. | Impostazione per azienda (già modificabili) o per settore. | 🟡 |
| E5 | Il valore di realizzo delle scorte ferme e obsolete non è stimato. | Prezzi di realizzo inseriti dall'utente. | 🔴 |
| E6 | Nessun collegamento con ordini clienti e previsioni di vendita. | Modulo commerciale / produzione. | 🔴 |

## F. Modulo Personale

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| F1 | Nessuna ricerca di incentivi e agevolazioni per le assunzioni. | Modulo agevolazioni con fonti ufficiali e verifica dei requisiti. | 🔴 |
| F2 | Contributi e TFR, se non inseriti, sono calcolati con aliquota media e formula standard (etichettati «calcolato»), non dal contratto collettivo. | Dati dal cedolino o dal consulente del lavoro. | 🟡 |
| F3 | Straordinari valorizzati con costo orario medio × maggiorazione unica. | Regole del CCNL applicato. | 🔴 |
| F4 | Dati annuali per persona: niente dettaglio mensile, turni, ferie maturate e residue, ratei. | Importazione dai cedolini mensili. | 🔴 |
| F5 | Simulazioni di riduzione d'orario, riorganizzazione dei turni e automazione non presenti (ci sono assunzione, straordinari, esternalizzazione). | Modulo produzione e investimenti. | 🔴 |
| F6 | Costi di selezione non rilevati separatamente. | Campo dedicato. | 🔴 |

## N. Modulo Energia e utenze

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| N1 | **Nessuna ricerca automatica delle offerte** dei fornitori: le offerte si inseriscono a mano con fonte e data. | Collegamento a una fonte pubblica verificabile (es. dati del Portale Offerte) da un server: il browser non può interrogarla direttamente. | 🔴 |
| N2 | Le **bollette in PDF** non vengono lette: i dati si importano da Excel/CSV o si inseriscono a mano. | Lettore PDF delle bollette (vedi B1). | 🔴 |
| N3 | Nessuna misura per macchina o reparto: i consumi sono quelli del contatore. La parte non attribuita alle commesse non è distinta tra consumo di base, fermi e sprechi. | Sensori / contatori divisionali (IoT) e modulo produzione. | 🔴 |
| N4 | Offerte a prezzo variabile confrontate con il prezzo inserito oggi, senza previsione dell'indice; offerte a fasce orarie o con prezzi diversi per F1/F2/F3 non gestite (un solo prezzo medio). | Prezzi per fascia e scenari sull'indice. | 🔴 |
| N5 | Potenza impegnata: il modulo segnala se è eccessiva o superata ma non calcola il risparmio, perché non conosce la quota potenza del contratto. Energia reattiva e relative penali non rilevate. | Campi dedicati in bolletta. | 🔴 |
| N6 | Dati mensili: un conguaglio può sembrare un'anomalia; nessun confronto con produzione o clima (gradi giorno). | Collegamento con il modulo produzione; dati climatici. | 🔴 |
| N7 | Acqua: mancano costi di depurazione e scarico separati e i consumi per reparto. | Campi dedicati. | 🔴 |
| N8 | Nessun avviso automatico alla scadenza del contratto o quando compare un'offerta migliore: l'avviso si vede solo aprendo l'app (vedi G7). | Notifiche da server. | 🔴 |
| N9 | Soglie delle anomalie (+25% sullo stesso mese dell'anno prima, +40% sulla mediana) e validità delle offerte (30 giorni) fissate nel codice, non modificabili dall'interfaccia. | Parametri in interfaccia. | 🔴 |
| N10 | Autoproduzione (fotovoltaico), incentivi per l'efficienza e valutazione di interventi di risparmio non presenti. | Modulo investimenti e agevolazioni. | 🔴 |

## G. Piattaforma, vendita e sicurezza

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| G1 | Mancano abbonamenti, pagamenti, piani tariffari. | Sistema di pagamento e gestione dei piani. | 🔴 |
| G2 | Mancano condizioni contrattuali, informativa privacy, nomina a responsabile del trattamento, registro dei trattamenti. | Testi da far verificare a un legale. | 🔴 |
| G3 | In modalità «questo dispositivo» i dati stanno nel browser, senza password né cifratura, e si perdono cancellando i dati del browser. | Database (A1) o cifratura locale. | 🔴 |
| G4 | Autenticazione a più fattori, registro degli accessi, backup automatici non realizzati. | Configurazione sul database (A1). | 🔴 |
| G5 | I dati dei moduli (commesse, magazzino, personale) nel database sono salvati in un unico campo dell'azienda, non in tabelle dedicate. | Tabelle per modulo al momento del collegamento a Supabase. | 🔴 |
| G6 | Motore AI conversazionale solo predisposto (richiede una chiave API a pagamento). | Chiave API e interfaccia domande/risposte. | 🔴 |
| G7 | Nessun avviso automatico (email, notifiche push) né report periodici. | Server o funzioni pianificate (A1). | 🔴 |
| G8 | Una sola valuta, una sola sede, un solo magazzino per azienda; fiscalità solo italiana. | Estensione del modello dati. | 🔴 |
| G9 | Viste per ruolo (imprenditore, produzione, commerciale…) e cruscotti personalizzabili non presenti. | Configurazione delle viste. | 🔴 |
| G10 | Parametri dei settori del simulatore di fantasia: servono al collaudo, non sono medie reali. | Benchmark (B3). | 🔴 |
| G11 | La pagina di prova non consente download, stampa, lettura Excel né database remoto (limite dell'ambiente di prova, non dell'app). | Usare la versione su GitHub Pages. | 🔴 |

## H. Moduli della specifica non ancora realizzati

Produzione e controllo industriale (OEE, fermi, scarti) · App mobile per dipendenti ·
Investimenti e analisi di convenienza · Finanziamenti, mutui, bandi e agevolazioni · Decisioni produttive (produrre o fermare) ·
Sviluppo commerciale e ricerca clienti · Benchmarking e ISA · Pianificazione strategica pluriennale · Collegamenti con gestionali, banche e sensori IoT.
