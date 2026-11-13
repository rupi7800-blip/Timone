# Timone · registro dei limiti

Elenco di tutto ciò che la piattaforma **non fa ancora, fa in modo approssimato o non è stato verificato**.
Si aggiorna a ogni rilascio. Comando di lavoro: **«richiama i limiti»** → l'elenco viene riproposto e si sceglie quali risolvere.

Stato: 🔴 aperto · 🟡 in parte risolto · 🟢 risolto (con versione).
Ultimo aggiornamento: versione 1.11.0.

## A. Verifiche mancanti (funzioni scritte ma non provate su casi reali)

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| A1 | Collegamento a un database Supabase reale mai provato (accesso, lettura, salvataggio, utenti). Lo schema SQL è provato solo su PostgreSQL con accessi simulati. | Progetto Supabase dedicato (previsto come ultimo passo). | 🔴 |
| A2 | Lettura XBRL di bilanci **ordinari** e **abbreviati** provata solo su file generati da noi; su file reali è provata solo la forma micro. | Un bilancio XBRL reale ordinario e uno abbreviato. | 🔴 |
| A3 | Lettura dei file **Excel (.xlsx)** mai provata con un file vero (bilancio, inventario, personale): provato solo il CSV. | Prova con file .xlsx reali o generati. | 🔴 |
| A4 | Tasto «Aggiorna»: riscritto senza vedere quello di AgendApp 1.6.0, può differire; mai provato su GitHub Pages con due versioni successive. | Confronto con AgendApp e prova online. | 🔴 |
| A5 | Stampa del report e download dei file provati solo in parte (nella pagina di prova sono bloccati). | Prova sulla versione pubblicata. | 🔴 |
| A6 | Non è noto se GitHub Pages sia stato attivato per il repository. | Attivazione da Settings → Pages. | 🔴 |
| A7 | Caricamento del bilancio XBRL di un concorrente provato solo con file generati da noi (ordinario e abbreviato), non con un bilancio reale di un'altra società. | Un bilancio XBRL reale di un concorrente. | 🔴 |

## B. Nucleo finanziario

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| B1 | Bilanci in **PDF** non letti (né testo né scansione/OCR). | Lettore PDF + riconoscimento delle voci, con verifica sui totali. | 🔴 |
| B2 | **Bilancio di verifica**, mastrini e libro giornale non importabili: manca la mappatura conto → voce. | Importazione con piano dei conti e regole di mappatura salvabili. | 🔴 |
| B3 | Le soglie della diagnosi sono regole generali, non valori di settore. Dalla 1.11.0 il modulo Confronti permette di confrontarsi con i bilanci dei concorrenti e con riferimenti di cui si indica la fonte, ma Timone non contiene dati di settore propri e la diagnosi non usa ancora i confronti per le sue soglie. | Banca dati di bilanci per codice ATECO (vedi T1); soglie della diagnosi ricavate dai confronti. | 🟡 |
| B4 | La diagnosi non calcola costo dell'intervento, investimento necessario e tempo di recupero. Dalla 1.7.0 il modulo Investimenti calcola VAN, TIR e recupero, ma va compilato a mano: le criticità della diagnosi non generano da sole una proposta di investimento. | Collegamento criticità → investimento precompilato (vedi V1). | 🟡 |
| B5 | Scostamenti di budget: non separano effetto prezzo ed effetto volume. Budget solo economico (mancano finanziario, patrimoniale, investimenti). | Dati di vendita per quantità; budget di cassa. | 🔴 |
| B6 | Scenari: un solo anno; non considerano investimenti, reazione dei clienti ai prezzi, limiti di capacità. Imposte con aliquota semplificata (effettiva dell'anno o 27,9%). | Pianificazione pluriennale (1-3-5-10 anni) con stato patrimoniale e cassa previsionali. | 🔴 |
| B7 | Rendiconto finanziario ricostruito dalle variazioni di bilancio (stima). | Dati di cassa o rendiconto dell'azienda. | 🔴 |
| B8 | DSO e DPO sovrastimati perché crediti e debiti includono l'IVA; usano i saldi di fine anno. | Aliquota IVA media o scadenziario. | 🔴 |
| B9 | Nel bilancio abbreviato la quota a breve dei debiti va inserita a mano (ripartizione assistita, non automatica). | Nota integrativa o bilancio di verifica (vedi B2, C2). | 🟡 |
| B10 | Nessuna previsione di cassa né scadenziario di clienti e fornitori. Dalla 1.9.0 il modulo Finanziamenti mostra esposizione bancaria, rate e scadenze dei debiti. | Modulo tesoreria. | 🟡 |
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
| D2 | Mancavano i dati per macchina: fermi, attrezzaggi, tempi ciclo, OEE, saturazione. Risolto con il modulo Produzione, che confronta anche le ore macchina delle commesse con le ore operative. | — | 🟢 1.6.0 |
| D3 | Le ore non arrivano dall'app per dipendenti (che non esiste ancora). | App mobile con QR code e modalità offline. | 🔴 |
| D4 | Nel modulo Commesse l'analisi clienti non ha tempi di pagamento, frequenza degli ordini e rischio di perdita. Dalla 1.10.0 li calcola il modulo Commerciale, ma sulle vendite importate lì: i due moduli non condividono i dati dei clienti. | Anagrafica clienti unica tra Commesse e Commerciale. | 🟡 |
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
| F5 | Simulazioni di riduzione d'orario, riorganizzazione dei turni e automazione non presenti (ci sono assunzione, straordinari, esternalizzazione). | Dati per turno (P1) e modulo investimenti. | 🔴 |
| F6 | Costi di selezione non rilevati separatamente. | Campo dedicato. | 🔴 |

## N. Modulo Energia e utenze

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| N1 | **Nessuna ricerca automatica delle offerte** dei fornitori: le offerte si inseriscono a mano con fonte e data. | Collegamento a una fonte pubblica verificabile (es. dati del Portale Offerte) da un server: il browser non può interrogarla direttamente. | 🔴 |
| N2 | Le **bollette in PDF** non vengono lette: i dati si importano da Excel/CSV o si inseriscono a mano. | Lettore PDF delle bollette (vedi B1). | 🔴 |
| N3 | I kWh per macchina si possono ora registrare nel modulo Produzione e vengono confrontati con le bollette, ma vanno inseriti o importati: non arrivano da contatori. Il consumo a macchina ferma o in attesa non è distinto da quello in produzione. | Sensori / contatori divisionali (IoT). | 🟡 |
| N4 | Offerte a prezzo variabile confrontate con il prezzo inserito oggi, senza previsione dell'indice; offerte a fasce orarie o con prezzi diversi per F1/F2/F3 non gestite (un solo prezzo medio). | Prezzi per fascia e scenari sull'indice. | 🔴 |
| N5 | Potenza impegnata: il modulo segnala se è eccessiva o superata ma non calcola il risparmio, perché non conosce la quota potenza del contratto. Energia reattiva e relative penali non rilevate. | Campi dedicati in bolletta. | 🔴 |
| N6 | Dati mensili: un conguaglio può sembrare un'anomalia; nessun confronto con produzione o clima (gradi giorno). | Collegamento con il modulo produzione; dati climatici. | 🔴 |
| N7 | Acqua: mancano costi di depurazione e scarico separati e i consumi per reparto. | Campi dedicati. | 🔴 |
| N8 | Nessun avviso automatico alla scadenza del contratto o quando compare un'offerta migliore: l'avviso si vede solo aprendo l'app (vedi G7). | Notifiche da server. | 🔴 |
| N9 | Soglie delle anomalie (+25% sullo stesso mese dell'anno prima, +40% sulla mediana) e validità delle offerte (30 giorni) fissate nel codice, non modificabili dall'interfaccia. | Parametri in interfaccia. | 🔴 |
| N10 | Autoproduzione (fotovoltaico), incentivi per l'efficienza e valutazione di interventi di risparmio non presenti. | Modulo investimenti e agevolazioni. | 🔴 |

## P. Modulo Produzione

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| P1 | Registrazioni **mensili** per macchina (anche per prodotto), non per giorno, turno, operatore o singolo fermo. Le **cause dei fermi** non sono registrate: il modulo dice quanto si è fermata una macchina, non perché. | Registrazioni per evento con causale; app per dipendenti. | 🔴 |
| P2 | Nessun collegamento con macchinari, sensori o sistemi di fabbrica: i dati si importano da Excel/CSV o si inseriscono a mano. | Integrazioni IoT / MES (dopo il database). | 🔴 |
| P3 | Costo dei fermi: se manca il costo orario di fermo della macchina è **stimato** dal margine di contribuzione medio di bilancio, uguale per tutte le macchine, e vale solo se la produzione persa sarebbe stata venduta. | Costo orario di fermo per macchina; ordini e saturazione reali. | 🟡 |
| P4 | Costo della non qualità calcolato solo se le registrazioni riportano il costo diretto del pezzo; non comprende rilavorazioni, resi e reclami. | Collegamento automatico al costo unitario delle commesse; dati di qualità. | 🔴 |
| P5 | La capacità utilizzata richiede la capacità mensile della macchina inserita a mano; nessuna pianificazione della produzione né calcolo dei carichi futuri. | Calendario dei turni e ordini da evadere. | 🔴 |
| P6 | Mancava il modulo «conviene produrre o fermare?». Risolto con il modulo Decisioni produttive (i suoi limiti sono nella sezione Q). | — | 🟢 1.8.0 |
| P7 | Obiettivo di OEE (65%) e soglie iniziali generali, non di settore (modificabili dall'interfaccia). | Benchmark (B3). | 🟡 |
| P8 | Produzione per dipendente e per turno non analizzata; consumi idrici per macchina registrabili ma non analizzati. | Dati per turno (P1). | 🔴 |
| P9 | Macchine e commesse si collegano a mano (una macchina ↔ una risorsa delle commesse); le registrazioni non sono legate alla singola commessa nei calcoli. | Collegamento per codice commessa. | 🔴 |
| P10 | Con più prodotti sulla stessa macchina la performance è corretta solo se ogni riga ha il proprio tempo ciclo standard. | Anagrafica prodotti con tempi ciclo. | 🔴 |

## V. Modulo Investimenti

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| V1 | **Risparmi e maggiori ricavi sono ipotesi inserite dall'utente**: il modulo non li stima dagli altri moduli (ad esempio il valore dei fermi evitati, dell'energia risparmiata o degli scarti ridotti) e non parte dalle criticità della diagnosi. | Proposte precompilate dai dati di produzione, energia, magazzino e commesse. | 🔴 |
| V2 | Imposte con un'unica aliquota semplificata (27,9% iniziale, modificabile). Non sono considerati crediti d'imposta e agevolazioni sugli investimenti, la deducibilità effettiva di ammortamenti e interessi, l'IVA. Il risparmio d'imposta negli anni in perdita è considerato utilizzabile. | Regole fiscali aggiornate e verificate; modulo agevolazioni. | 🔴 |
| V3 | Contributi a fondo perduto inseriti a mano e considerati incassati subito; non sono presi dal registro delle agevolazioni del modulo Finanziamenti; nessuna ricerca di bandi (R1). | Collegamento con il registro delle agevolazioni. | 🔴 |
| V4 | Nel modulo Investimenti il finanziamento è solo a rata annuale costante e tasso fisso. Dalla 1.9.0 il modulo Finanziamenti gestisce rate mensili, preammortamento, leasing e spese, ma i due moduli non sono collegati: il finanziamento va inserito in entrambi. | Collegamento Investimenti ↔ Finanziamenti (vedi R10). | 🟡 |
| V5 | Rischio misurato solo con la sensibilità sui benefici e sul costo; nessuno scenario combinato né probabilità. | Scenari prudenziale / centrale / favorevole anche sugli investimenti. | 🔴 |
| V6 | Benefici costanti o a crescita costante e pieni dal primo anno: niente avviamento graduale, capitale circolante aggiuntivo, inflazione, sostituzioni intermedie. | Benefici anno per anno. | 🔴 |
| V7 | Nessuna **verifica a consuntivo** degli investimenti realizzati: lo stato «realizzato» è solo un'etichetta, i risultati effettivi non vengono misurati. | Confronto tra previsto e ottenuto sui dati degli anni successivi. | 🔴 |
| V8 | Tasso di sconto unico per tutti gli investimenti, inserito dall'utente (8% iniziale): non è calcolato dal costo del capitale dell'azienda. | Calcolo del costo medio del capitale dai dati di bilancio. | 🟡 |
| V9 | Effetto sui conti dell'azienda limitato al primo anno e a pochi indicatori (EBITDA, debito netto, utile, liquidità): non entra nel budget né negli scenari. | Pianificazione pluriennale (B6). | 🔴 |
| V10 | Investimenti alternativi tra loro o collegati (uno esclude o richiede l'altro) non gestiti: la classifica li tratta come indipendenti. | Gruppi di alternative. | 🔴 |

## Q. Modulo Decisioni produttive («Produrre o fermare?»)

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| Q1 | **Tutti i dati del caso si inseriscono a mano**: capacità, costi variabili e fissi, scorte e ordini non vengono presi dai moduli Produzione, Magazzino, Commesse e Personale. Gli ordini dei clienti non esistono ancora come dato nella piattaforma. | Precompilazione dai moduli; portafoglio ordini (modulo commerciale). | 🔴 |
| Q2 | Un caso riguarda **una linea o un prodotto** con un solo prezzo e un solo costo variabile; la domanda è distribuita in parti uguali nei mesi (niente stagionalità, niente mix di prodotti, niente date di consegna). | Domanda mese per mese e per prodotto. | 🔴 |
| Q3 | Ciò che non si consegna nel mese è considerato **vendita persa**: non sono gestiti consegne in ritardo, penali contrattuali, perdita del cliente. | Regole per ritardi e penali. | 🔴 |
| Q4 | La quota di costi fissi evitabile con il fermo è un dato dell'utente: **ammortizzatori sociali** (cassa integrazione), ferie forzate, ricollocazione del personale non sono calcolati. | Regole lavoristiche verificate con un consulente del lavoro; collegamento al modulo Personale. | 🔴 |
| Q5 | Riducendo il ritmo i costi fissi sono considerati invariati; fermo e riavvio sono contati per intero anche se il riavvio cade dopo il periodo. | Costi fissi a scaglioni; orizzonte più lungo. | 🔴 |
| Q6 | Scorte valorizzate al costo variabile; il rischio di obsolescenza è una percentuale unica inserita dall'utente. | Collegamento alla classificazione del Magazzino. | 🔴 |
| Q7 | Esternalizzazione con un solo prezzo per unità: non considera capacità, tempi, qualità e minimi d'ordine del fornitore, né i costi di trasporto e controllo. | Dati dei fornitori (E3). | 🔴 |
| Q8 | Le sei alternative sono fisse: non si possono combinare (ad esempio ridurre per due mesi e poi fermare) né definire un piano personalizzato mese per mese. | Editor del piano di produzione. | 🔴 |
| Q9 | Le previsioni di vendita sono trattate con un solo confronto (con e senza previsioni), senza probabilità. | Scenari multipli sulla domanda. | 🔴 |
| Q10 | Il risultato non è collegato alla previsione di cassa né al bilancio dell'azienda: resta un confronto a sé. | Collegamento con previsione di cassa e budget. | 🔴 |

## R. Modulo Finanziamenti, mutui e agevolazioni

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| R1 | **Nessuna ricerca di bandi e agevolazioni**: è un registro compilato dall'utente con fonte e data di verifica. Timone non propone misure e non controlla che la fonte indicata sia ancora valida. | Collegamento da server a fonti ufficiali verificabili; aggiornamento periodico. | 🔴 |
| R2 | I requisiti sono trascritti e spuntati dall'utente: nessun controllo automatico di ammissibilità, cumulabilità tra aiuti, limiti «de minimis», spese ammissibili. | Regole per misura, verificate con un consulente. | 🔴 |
| R3 | **Tasso variabile**: il piano usa per tutta la durata il tasso inserito oggi; nessun indice (Euribor), nessuno storico delle variazioni. L'effetto di un aumento è calcolato solo come un punto in più sui 12 mesi successivi. | Indice + spread, aggiornamento del tasso, scenari sui tassi. | 🔴 |
| R4 | Il **tasso effettivo è calcolato da Timone**, non è il TAEG/ISC del contratto. Gli interessi sono calcolati a mesi interi (tasso annuo × mesi ÷ 12), non a giorni effettivi: rispetto al piano della banca possono esserci differenze di pochi euro. Il piano della banca non si può importare. | Convenzioni di calcolo per contratto; importazione del piano. | 🔴 |
| R5 | Finanziamenti inseriti **solo a mano**: nessuna importazione da file, contratto PDF o Centrale dei Rischi. | Importazione Excel/CSV e lettura dei documenti. | 🔴 |
| R6 | Fidi: un solo utilizzo medio annuo; non distingue cassa, anticipo fatture e altre linee con tassi diversi, né sconfinamenti e commissioni di istruttoria veloce. I fidi sono considerati sempre rinnovati. | Dati trimestrali dagli estratti conto. | 🔴 |
| R7 | Leasing semplificato (canoni costanti, anticipo, riscatto): IVA, deducibilità fiscale e costi accessori non considerati. | Regole fiscali verificate. | 🔴 |
| R8 | La **copertura delle rate** è EBITDA dell'anno ÷ rate dei 12 mesi successivi: non è il DSCR sui flussi di cassa previsti (non considera imposte, investimenti, capitale circolante) e usa un dato passato. | Previsione di cassa (B10) e budget. | 🔴 |
| R9 | Estinzione e rinegoziazione: risparmi non attualizzati, senza effetti fiscali; penale come percentuale unica; non disponibili per leasing e fidi. | Estensione delle simulazioni. | 🔴 |
| R10 | Nessun collegamento con il modulo Investimenti, con il budget e con una tesoreria; nessun avviso automatico per rate e termini dei bandi (si vedono aprendo l'app: G7). | Collegamenti tra moduli; notifiche da server. | 🔴 |
| R11 | Garanzie registrate solo come testo: non sono calcolati i costi (commissioni di garanzia, confidi) né gestiti i covenant del contratto. | Campi e controlli dedicati. | 🔴 |
| R12 | Moratorie, sospensioni, rate non pagate e rimborsi parziali non gestiti; le rate sono contate a mese intero. | Eventi sul piano di rimborso. | 🔴 |
| R13 | Per finanziamenti agevolati e garanzie pubbliche il beneficio è un importo inserito a mano, non calcolato (equivalente sovvenzione). | Calcolo del beneficio dal confronto con il tasso di mercato. | 🔴 |
| R14 | Soglie (copertura minima 1,3; fonte da riverificare dopo 90 giorni; avviso 30 giorni prima del termine) fissate nel codice. | Parametri in interfaccia. | 🔴 |
| R15 | Nel bilancio simulato la quota dei mutui in scadenza entro 12 mesi non è separata: nelle aziende di prova i debiti a breve di bilancio e quelli calcolati dai piani differiscono (i totali coincidono). | Simulatore con la quota corrente dei mutui. | 🔴 |

## S. Modulo Commerciale (sviluppo commerciale e clienti)

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| S1 | **Nessuna ricerca di nuovi clienti su fonti esterne** (registro delle imprese, banche dati, web): il modulo indica i settori in cui l'azienda rende di più e tiene il registro dei contatti con la fonte, ma i nominativi li trova l'utente. | Collegamento da server a fonti verificabili, nel rispetto delle regole sui dati personali. | 🔴 |
| S2 | Vendite importate da Excel/CSV o inserite a mano: nessun collegamento con il gestionale o con le fatture elettroniche (XML). | Lettura delle fatture elettroniche; integrazioni. | 🔴 |
| S3 | Il margine per cliente è ricavi meno il **costo diretto indicato nel file**: non è collegato ai costi del modulo Commesse e non comprende il costo di servire il cliente (trasporti, assistenza, resi, sconti di fine anno). | Collegamento con le commesse; costi di servizio per cliente. | 🔴 |
| S4 | Tempi di pagamento: due valori per cliente inseriti a mano (giorni concordati ed effettivi). Non c'è lo scadenziario delle fatture, né insoluti, fido per cliente, rischio di credito. | Scadenziario clienti (B10). | 🔴 |
| S5 | «A rischio di perdita» è una regola semplice (calo di almeno il 30% oppure nessun acquisto da 3 mesi per chi comprava con regolarità), con soglie fisse nel codice: non tiene conto della frequenza tipica e della stagionalità di ogni cliente e non dà una probabilità. | Soglie in interfaccia; regole sulla frequenza d'acquisto del singolo cliente. | 🔴 |
| S6 | Segmenti solo per settore, zona e famiglia, scritti come testo libero (due scritture diverse sono due segmenti). Nessun dato sul mercato potenziale, sulla dimensione dei clienti o sulle quote di mercato. | Elenchi guidati (ATECO, province); dati di mercato con fonte (B3). | 🔴 |
| S7 | Trattative: le probabilità predefinite per fase sono ipotesi generali; non ci sono storico dei passaggi di fase, durata media, attività svolte, venditore assegnato. Non sostituisce un CRM. | Storico e attività; probabilità ricavate dalle trattative chiuse dell'azienda. | 🔴 |
| S8 | La previsione delle vendite è solo il valore ponderato delle trattative: non considera ordini ricorrenti e stagionalità, e **non alimenta** budget, scenari, magazzino e decisioni produttive (il portafoglio ordini resta mancante: Q1, E6). | Portafoglio ordini e previsione collegati agli altri moduli. | 🔴 |
| S9 | Simulazione dello sconto a margine costante: non stima la reazione dei clienti al prezzo; listini e prezzi per cliente non gestiti; nessuna scomposizione prezzo/volume (B5). | Vendite per quantità e prezzo. | 🔴 |
| S10 | Confronto solo tra un anno e il precedente: manca l'andamento pluriennale del cliente e il suo valore nel tempo. | Serie storiche per cliente. | 🔴 |
| S11 | I clienti sono riconosciuti dal nome: lo stesso cliente scritto in due modi diversi risulta diviso, due omonimi uniti. | Codice cliente o partita IVA come chiave. | 🔴 |
| S12 | «Perdita di un cliente»: costi fissi invariati e nessuna sostituzione del volume; se mancano i costi diretti il margine è stimato con la media di bilancio (segnalato). | Costi per cliente (S3). | 🟡 |

## T. Modulo Confronti (benchmarking) e ISA

| N. | Limite | Cosa serve per chiuderlo | Stato |
|---|---|---|---|
| T1 | **Timone non contiene medie di settore** né banche dati: i termini di confronto li carica l'utente. Con meno di tre termini la mediana è poco significativa (viene segnalato). | Accesso a una banca dati di bilanci per codice ATECO, area e dimensione (di norma a pagamento), da server. | 🔴 |
| T2 | I bilanci dei concorrenti vanno scaricati uno per uno dal Registro delle Imprese e caricati a mano: nessuno scaricamento automatico. | Collegamento al Registro delle Imprese o a un fornitore di dati. | 🔴 |
| T3 | Per i concorrenti con **bilancio abbreviato o micro** non sono disponibili giorni di incasso e di pagamento, ciclo monetario, PFN/EBITDA, Debt/Equity e ROI; gli altri indici sono ricavati dai totali, con i crediti considerati tutti a breve. | Lettura della nota integrativa (C2). | 🔴 |
| T4 | La **confrontabilità non è verificata**: attività effettiva, area, modello d'impresa, scelte contabili (leasing, rivalutazioni, ammortamenti) possono rendere due bilanci non paragonabili. C'è solo un avviso quando i ricavi differiscono di oltre 5 volte. | Controlli su ATECO e dimensione; note di rettifica. | 🔴 |
| T5 | Riferimenti inseriti a mano: un solo valore per indice, digitato dall'utente; non si distinguono media, mediana e quartili della fonte, né il campione su cui è calcolata. | Campi per quartili e numerosità del campione. | 🔴 |
| T6 | Verso «meglio/peggio» e tolleranza (10% dalla mediana) fissati nel codice e uguali per tutti i settori; gli indici non sono pesati per importanza. | Parametri in interfaccia. | 🔴 |
| T7 | Il valore in euro dello scarto è calcolato solo per margini, giorni di incasso e giorni di scorta, a parità di ricavi: è un ordine di grandezza. | Stime più articolate con i dati degli altri moduli. | 🟡 |
| T8 | Solo indici di bilancio: nessun confronto su prezzi, produttività per addetto (i dipendenti non sono letti dall'XBRL), energia, efficienza produttiva. | Dati gestionali di settore con fonte. | 🔴 |
| T9 | Confronto su un anno alla volta: manca l'andamento pluriennale rispetto ai concorrenti. | Serie storiche del confronto. | 🔴 |
| T10 | **Il punteggio ISA non è calcolato** e non si può simulare come migliorarlo (richiederebbe le formule di ogni ISA): si registra il punteggio della dichiarazione. I file della dichiarazione non vengono letti. | Formule ISA per codice attività, verificate; lettura del file telematico. | 🔴 |
| T11 | Le soglie ISA nel codice sono quelle del provvedimento n. 123160/2026 (periodo d'imposta 2025): vanno aggiornate a mano ogni anno; per gli altri anni compare un avviso. I singoli benefici e i loro limiti non sono elencati; più attività soggette a ISA non sono gestite. | Tabella delle soglie per anno, verificata sui provvedimenti. | 🔴 |

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

App mobile per dipendenti ·
Pianificazione strategica pluriennale · Collegamenti con gestionali, banche e sensori IoT.
