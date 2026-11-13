/* Timone · motore di calcolo economico-finanziario
   Funzioni pure: nessun accesso a rete, archivio o interfaccia.
   Funziona nel browser (window.Motore) e in Node (module.exports) per i test. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Motore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- voci
  // tipo: ce = conto economico, att = attivo, pas = passivo, ges = dato gestionale (extra bilancio)
  // segno: i costi si inseriscono come numeri positivi.
  var VOCI = [
    { id: 'ricavi', tipo: 'ce', nome: 'Ricavi delle vendite e delle prestazioni', rif: 'A1' },
    { id: 'var_rim_prodotti', tipo: 'ce', nome: 'Variazione rimanenze prodotti e lavori in corso (+/−)', rif: 'A2-A3' },
    { id: 'altri_ricavi', tipo: 'ce', nome: 'Altri ricavi e incrementi per lavori interni', rif: 'A4-A5' },
    { id: 'materie', tipo: 'ce', costo: true, nome: 'Materie prime, sussidiarie, di consumo e merci', rif: 'B6' },
    { id: 'var_rim_materie', tipo: 'ce', costo: true, nome: 'Variazione rimanenze materie (+ = diminuzione scorte)', rif: 'B11' },
    { id: 'servizi', tipo: 'ce', costo: true, nome: 'Servizi', rif: 'B7' },
    { id: 'godimento', tipo: 'ce', costo: true, nome: 'Godimento beni di terzi (affitti, leasing, noleggi)', rif: 'B8' },
    { id: 'personale', tipo: 'ce', costo: true, nome: 'Costi del personale', rif: 'B9' },
    { id: 'ammortamenti', tipo: 'ce', costo: true, nome: 'Ammortamenti', rif: 'B10a-c' },
    { id: 'svalutazioni_acc', tipo: 'ce', costo: true, nome: 'Svalutazioni e accantonamenti', rif: 'B10d-B12-B13' },
    { id: 'oneri_diversi', tipo: 'ce', costo: true, nome: 'Oneri diversi di gestione', rif: 'B14' },
    { id: 'proventi_fin', tipo: 'ce', nome: 'Proventi finanziari', rif: 'C15-C16' },
    { id: 'oneri_fin', tipo: 'ce', costo: true, nome: 'Interessi e altri oneri finanziari', rif: 'C17' },
    { id: 'rettifiche_fin', tipo: 'ce', nome: 'Rettifiche di valore di attività finanziarie (+/−)', rif: 'D' },
    { id: 'imposte', tipo: 'ce', costo: true, nome: 'Imposte sul reddito', rif: '20' },

    { id: 'imm_immateriali', tipo: 'att', nome: 'Immobilizzazioni immateriali', rif: 'B.I' },
    { id: 'imm_materiali', tipo: 'att', nome: 'Immobilizzazioni materiali', rif: 'B.II' },
    { id: 'imm_finanziarie', tipo: 'att', nome: 'Immobilizzazioni finanziarie', rif: 'B.III' },
    { id: 'rimanenze', tipo: 'att', nome: 'Rimanenze', rif: 'C.I' },
    { id: 'crediti_clienti', tipo: 'att', nome: 'Crediti verso clienti', rif: 'C.II.1' },
    { id: 'altri_crediti', tipo: 'att', nome: 'Altri crediti', rif: 'C.II' },
    { id: 'attivita_fin_breve', tipo: 'att', nome: 'Attività finanziarie non immobilizzate', rif: 'C.III' },
    { id: 'liquidita', tipo: 'att', nome: 'Disponibilità liquide', rif: 'C.IV' },
    { id: 'ratei_attivi', tipo: 'att', nome: 'Ratei e risconti attivi', rif: 'D' },

    { id: 'capitale_riserve', tipo: 'pas', nome: 'Capitale e riserve (patrimonio netto escluso il risultato)', rif: 'A.I-VIII' },
    { id: 'fondi_rischi', tipo: 'pas', nome: 'Fondi per rischi e oneri', rif: 'B' },
    { id: 'tfr', tipo: 'pas', nome: 'Trattamento di fine rapporto', rif: 'C' },
    { id: 'debiti_banche_breve', tipo: 'pas', nome: 'Debiti verso banche entro 12 mesi', rif: 'D4' },
    { id: 'debiti_banche_lungo', tipo: 'pas', nome: 'Debiti verso banche oltre 12 mesi', rif: 'D4' },
    { id: 'altri_debiti_fin', tipo: 'pas', nome: 'Altri debiti finanziari (soci, obbligazioni, altri finanziatori)', rif: 'D1-D3-D5' },
    { id: 'debiti_fornitori', tipo: 'pas', nome: 'Debiti verso fornitori', rif: 'D7' },
    { id: 'debiti_tributari', tipo: 'pas', nome: 'Debiti tributari e previdenziali', rif: 'D12-D13' },
    { id: 'altri_debiti', tipo: 'pas', nome: 'Altri debiti', rif: 'D14' },
    { id: 'ratei_passivi', tipo: 'pas', nome: 'Ratei e risconti passivi', rif: 'E' },

    { id: 'dipendenti', tipo: 'ges', nome: 'Numero medio di dipendenti', unita: 'n' },
    { id: 'quota_capitale', tipo: 'ges', nome: 'Quote capitale di finanziamenti rimborsate nell\'anno', unita: 'eur' }
  ];
  var VOCE = {};
  VOCI.forEach(function (v) { VOCE[v.id] = v; });

  var COSTI_OPERATIVI = ['materie', 'var_rim_materie', 'servizi', 'godimento', 'personale', 'ammortamenti', 'svalutazioni_acc', 'oneri_diversi'];

  // Quote variabili PREDEFINITE: sono ipotesi di partenza, non una classificazione.
  // L'utente deve confermarle o correggerle con criteri gestionali.
  var QUOTE_PREDEFINITE = { materie: 1, var_rim_materie: 1, servizi: 0.5, godimento: 0, personale: 0, ammortamenti: 0, svalutazioni_acc: 0, oneri_diversi: 0 };

  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : 0; }
  function div(a, b) { return (isFinite(a) && isFinite(b) && b !== 0) ? a / b : null; }

  // Estrae {voce: numero} da un esercizio {valori:{voce:{v,...}}}; le voci mai inserite restano undefined.
  function numeri(esercizio) {
    var out = {};
    var val = (esercizio && esercizio.valori) || {};
    Object.keys(val).forEach(function (k) {
      var x = val[k];
      var v = (x && typeof x === 'object') ? x.v : x;
      if (typeof v === 'number' && isFinite(v)) out[k] = v;
    });
    return out;
  }

  function mancanti(n) {
    return VOCI.filter(function (v) { return v.tipo !== 'ges' && n[v.id] === undefined; }).map(function (v) { return v.id; });
  }

  function quota(classif, voce) {
    var c = classif && classif[voce];
    var q = (c && typeof c === 'object') ? c.quota : c;
    return (typeof q === 'number' && q >= 0 && q <= 1) ? q : QUOTE_PREDEFINITE[voce];
  }

  // ------------------------------------------------------- riclassificazione
  function riclassifica(n, classif) {
    var g = function (k) { return num(n[k]); };
    var r = {};
    r.ricavi = g('ricavi');
    r.valore_produzione = g('ricavi') + g('var_rim_prodotti') + g('altri_ricavi');
    r.consumi_materie = g('materie') + g('var_rim_materie');
    r.costi_esterni = r.consumi_materie + g('servizi') + g('godimento') + g('oneri_diversi');
    r.valore_aggiunto = r.valore_produzione - r.costi_esterni;
    r.personale = g('personale');
    r.ebitda = r.valore_aggiunto - r.personale;
    r.ammortamenti_acc = g('ammortamenti') + g('svalutazioni_acc');
    r.ebit = r.ebitda - r.ammortamenti_acc;
    r.gestione_finanziaria = g('proventi_fin') - g('oneri_fin') + g('rettifiche_fin');
    r.risultato_ante_imposte = r.ebit + r.gestione_finanziaria;
    r.imposte = g('imposte');
    r.utile = r.risultato_ante_imposte - r.imposte;
    r.costi_totali = r.costi_esterni + r.personale + r.ammortamenti_acc + g('oneri_fin') + r.imposte;

    r.immobilizzazioni = g('imm_immateriali') + g('imm_materiali') + g('imm_finanziarie');
    r.attivo_corrente = g('rimanenze') + g('crediti_clienti') + g('altri_crediti') + g('attivita_fin_breve') + g('liquidita') + g('ratei_attivi');
    r.totale_attivo = r.immobilizzazioni + r.attivo_corrente;
    r.patrimonio_netto = g('capitale_riserve') + r.utile;
    r.debiti_finanziari = g('debiti_banche_breve') + g('debiti_banche_lungo') + g('altri_debiti_fin');
    r.passivo_corrente = g('debiti_banche_breve') + g('debiti_fornitori') + g('debiti_tributari') + g('altri_debiti') + g('ratei_passivi');
    r.passivo_consolidato = g('fondi_rischi') + g('tfr') + g('debiti_banche_lungo') + g('altri_debiti_fin');
    r.totale_passivo = r.patrimonio_netto + r.passivo_corrente + r.passivo_consolidato;
    r.quadratura = r.totale_attivo - r.totale_passivo;
    r.pfn = r.debiti_finanziari - g('liquidita') - g('attivita_fin_breve');
    r.ccn = r.attivo_corrente - r.passivo_corrente;
    r.ccn_commerciale = g('rimanenze') + g('crediti_clienti') - g('debiti_fornitori');
    r.capitale_investito = r.patrimonio_netto + r.pfn;
    r.acquisti_esterni = g('materie') + g('servizi') + g('godimento');

    // costi fissi e variabili (operativi)
    var cv = 0, cf = 0;
    COSTI_OPERATIVI.forEach(function (k) {
      var q = quota(classif, k);
      cv += g(k) * q; cf += g(k) * (1 - q);
    });
    r.costi_variabili = cv;
    r.costi_fissi = cf;
    r.margine_contribuzione = r.valore_produzione - cv;
    r.mc_pct = div(r.margine_contribuzione, r.valore_produzione);
    r.bep = (r.mc_pct !== null && r.mc_pct > 0) ? cf / r.mc_pct : null;
    r.margine_sicurezza = (r.bep !== null) ? div(r.valore_produzione - r.bep, r.valore_produzione) : null;
    r.leva_operativa = (r.ebit > 0) ? div(r.margine_contribuzione, r.ebit) : null;
    return r;
  }

  // ------------------------------------------------- rendiconto (2 esercizi)
  // Metodo indiretto semplificato, ricostruito dalle variazioni di stato patrimoniale.
  function rendiconto(n, nPrec, classif) {
    if (!n || !nPrec) return null;
    var r = riclassifica(n, classif), p = riclassifica(nPrec, classif);
    var d = function (k) { return num(n[k]) - num(nPrec[k]); };
    var out = {};
    out.autofinanziamento = r.utile + num(n.ammortamenti) + d('fondi_rischi') + d('tfr');
    out.var_ccn = d('rimanenze') + d('crediti_clienti') + d('altri_crediti') + d('ratei_attivi')
      - d('debiti_fornitori') - d('debiti_tributari') - d('altri_debiti') - d('ratei_passivi');
    out.flusso_operativo = out.autofinanziamento - out.var_ccn;
    out.investimenti_netti = (r.immobilizzazioni - p.immobilizzazioni) + num(n.ammortamenti);
    out.flusso_investimenti = -out.investimenti_netti - d('attivita_fin_breve');
    out.var_debiti_fin = r.debiti_finanziari - p.debiti_finanziari;
    out.mezzi_propri = d('capitale_riserve') - p.utile; // aumenti di capitale meno dividendi
    out.flusso_finanziario = out.var_debiti_fin + out.mezzi_propri;
    out.variazione_liquidita = out.flusso_operativo + out.flusso_investimenti + out.flusso_finanziario;
    out.variazione_liquidita_bilancio = d('liquidita');
    out.differenza = out.variazione_liquidita - out.variazione_liquidita_bilancio;
    return out;
  }

  // ---------------------------------------------------------------- indici
  // fonte: 'bilancio' = calcolabile dal bilancio civilistico; 'gestionale' = richiede dati extra-contabili.
  var INDICI = [
    { id: 'ebitda', gruppo: 'Redditività', nome: 'EBITDA (margine operativo lordo)', unita: 'eur', fonte: 'bilancio',
      formula: 'Valore della produzione − costi esterni − costo del personale',
      usa: ['ricavi', 'materie', 'servizi', 'godimento', 'personale', 'oneri_diversi'],
      perche: 'Si escludono ammortamenti, accantonamenti, interessi e imposte per isolare il risultato della sola gestione operativa.',
      significato: 'Quanto la gestione caratteristica produce prima di ammortamenti, interessi e imposte. È un\'approssimazione della cassa operativa.',
      lettura: 'Negativo: la gestione corrente brucia risorse. Va letto in rapporto ai ricavi e al debito.',
      limiti: 'Non è cassa: ignora investimenti e capitale circolante. I canoni di leasing lo abbassano, gli ammortamenti no.',
      azioni: 'Rivedere prezzi, mix di vendita, acquisti e costi di struttura.',
      calc: function (r) { return r.ebitda; } },
    { id: 'ebitda_margin', gruppo: 'Redditività', nome: 'EBITDA margin', unita: 'pct', fonte: 'bilancio',
      formula: 'EBITDA ÷ Valore della produzione', usa: ['ricavi', 'materie', 'servizi', 'personale'],
      perche: 'Rapportare al valore della produzione rende confrontabili anni e aziende di dimensioni diverse.',
      significato: 'Quota del valore prodotto che resta dopo i costi operativi monetari.',
      lettura: 'Dipende molto dal settore: il confronto corretto è con il proprio storico e con aziende comparabili.',
      limiti: 'Sensibile alla scelta tra acquisto e leasing/noleggio dei beni.',
      azioni: 'Agire sulle voci di costo con incidenza crescente.',
      calc: function (r) { return div(r.ebitda, r.valore_produzione); } },
    { id: 'ebit', gruppo: 'Redditività', nome: 'EBIT (risultato operativo)', unita: 'eur', fonte: 'bilancio',
      formula: 'EBITDA − ammortamenti − svalutazioni e accantonamenti', usa: ['ammortamenti', 'svalutazioni_acc'],
      perche: 'Gli ammortamenti rappresentano il consumo degli investimenti: vanno coperti dalla gestione.',
      significato: 'Risultato della gestione operativa prima di interessi e imposte.',
      lettura: 'Deve coprire con margine gli oneri finanziari.',
      limiti: 'Dipende dalle politiche di ammortamento adottate.',
      azioni: 'Verificare la produttività degli investimenti e la saturazione degli impianti.',
      calc: function (r) { return r.ebit; } },
    { id: 'ebit_margin', gruppo: 'Redditività', nome: 'EBIT margin', unita: 'pct', fonte: 'bilancio',
      formula: 'EBIT ÷ Valore della produzione', usa: ['ricavi', 'ammortamenti'],
      perche: 'Misura la redditività operativa sull\'intera produzione, incluse variazioni di rimanenze.',
      significato: 'Margine operativo per ogni euro prodotto.', lettura: 'Da confrontare nel tempo e con il settore.',
      limiti: 'Come EBIT.', azioni: 'Come EBIT.',
      calc: function (r) { return div(r.ebit, r.valore_produzione); } },
    { id: 'ros', gruppo: 'Redditività', nome: 'ROS', unita: 'pct', fonte: 'bilancio',
      formula: 'EBIT ÷ Ricavi delle vendite', usa: ['ricavi'],
      perche: 'Usa i soli ricavi di vendita: misura quanto margine operativo lascia ogni euro venduto.',
      significato: 'Redditività delle vendite.', lettura: 'In calo: i prezzi non seguono i costi o i volumi non assorbono i costi fissi.',
      limiti: 'Distorto se le variazioni di rimanenze sono rilevanti.', azioni: 'Prezzi, sconti, mix prodotti e clienti.',
      calc: function (r) { return div(r.ebit, r.ricavi); } },
    { id: 'roi', gruppo: 'Redditività', nome: 'ROI', unita: 'pct', fonte: 'bilancio',
      formula: 'EBIT ÷ Capitale investito netto (patrimonio netto + PFN)', usa: ['capitale_riserve', 'debiti_banche_breve', 'debiti_banche_lungo', 'liquidita'],
      perche: 'Il capitale investito netto è quello finanziato da soci e finanziatori: è la base su cui misurare il rendimento operativo.',
      significato: 'Rendimento del capitale impiegato nell\'attività, indipendente da come è finanziato.',
      lettura: 'Se inferiore al costo medio del debito, indebitarsi distrugge valore.',
      limiti: 'Usa valori contabili di fine anno, non valori di mercato né medie.', azioni: 'Aumentare i margini o ridurre il capitale impiegato (scorte, crediti, beni poco usati).',
      calc: function (r) { return r.capitale_investito > 0 ? div(r.ebit, r.capitale_investito) : null; } },
    { id: 'roe', gruppo: 'Redditività', nome: 'ROE', unita: 'pct', fonte: 'bilancio',
      formula: 'Utile netto ÷ Patrimonio netto', usa: ['capitale_riserve', 'imposte'],
      perche: 'Confronta ciò che resta ai soci con il capitale che vi hanno lasciato.',
      significato: 'Rendimento per i soci.', lettura: 'Va confrontato con rendimenti alternativi a rischio simile.',
      limiti: 'Un patrimonio netto molto basso lo gonfia artificialmente; privo di significato se il patrimonio è negativo.',
      azioni: 'Migliorare l\'utile o riequilibrare la struttura finanziaria.',
      calc: function (r) { return r.patrimonio_netto > 0 ? div(r.utile, r.patrimonio_netto) : null; } },
    { id: 'roa', gruppo: 'Redditività', nome: 'ROA', unita: 'pct', fonte: 'bilancio',
      formula: 'EBIT ÷ Totale attivo', usa: ['imm_materiali', 'rimanenze', 'crediti_clienti', 'liquidita'],
      perche: 'Considera tutte le attività, comunque finanziate.',
      significato: 'Rendimento operativo dell\'insieme delle attività.', lettura: 'Basso con attivo elevato: beni poco produttivi.',
      limiti: 'Valori contabili, non correnti.', azioni: 'Smobilizzare attività non produttive.',
      calc: function (r) { return div(r.ebit, r.totale_attivo); } },
    { id: 'utile', gruppo: 'Redditività', nome: 'Utile netto', unita: 'eur', fonte: 'bilancio',
      formula: 'EBIT ± gestione finanziaria − imposte', usa: ['oneri_fin', 'proventi_fin', 'imposte'],
      perche: 'È il risultato finale dopo tutte le gestioni.', significato: 'Ciò che resta ai soci.',
      lettura: 'Va letto insieme alla cassa generata.', limiti: 'Risente di poste non monetarie e valutazioni.',
      azioni: 'Dipende dalla gestione che lo penalizza: operativa, finanziaria o fiscale.',
      calc: function (r) { return r.utile; } },
    { id: 'incidenza_personale', gruppo: 'Struttura dei costi', nome: 'Incidenza del personale', unita: 'pct', fonte: 'bilancio',
      formula: 'Costo del personale ÷ Valore della produzione', usa: ['personale', 'ricavi'],
      perche: 'Misura quanta parte del valore prodotto è assorbita dal lavoro dipendente.',
      significato: 'Peso del lavoro sul valore prodotto.', lettura: 'In aumento a parità di organico: produttività o prezzi in calo.',
      limiti: 'Non comprende lavoro esternalizzato o dei soci non dipendenti.', azioni: 'Analizzare produttività per reparto e saturazione, prima di ogni valutazione sull\'organico.',
      calc: function (r) { return div(r.personale, r.valore_produzione); } },
    { id: 'incidenza_materie', gruppo: 'Struttura dei costi', nome: 'Incidenza dei consumi di materie', unita: 'pct', fonte: 'bilancio',
      formula: '(Acquisti di materie ± variazione rimanenze) ÷ Valore della produzione', usa: ['materie', 'var_rim_materie', 'ricavi'],
      perche: 'La variazione delle rimanenze trasforma gli acquisti in consumi effettivi.',
      significato: 'Peso dei materiali consumati.', lettura: 'In aumento: prezzi d\'acquisto, scarti o prezzi di vendita non adeguati.',
      limiti: 'Dipende dai criteri di valutazione del magazzino.', azioni: 'Fornitori alternativi, riduzione scarti, revisione listini.',
      calc: function (r) { return div(r.consumi_materie, r.valore_produzione); } },
    { id: 'margine_contribuzione', gruppo: 'Struttura dei costi', nome: 'Margine di contribuzione', unita: 'pct', fonte: 'gestionale',
      formula: '(Valore della produzione − costi variabili) ÷ Valore della produzione', usa: ['ricavi', 'materie', 'servizi'],
      perche: 'Separa i costi che crescono con i volumi da quelli di struttura.',
      significato: 'Quanto ogni euro prodotto contribuisce a coprire i costi fissi.', lettura: 'Più è alto, più l\'utile reagisce ai volumi.',
      limiti: 'Dipende interamente dalla classificazione fissi/variabili: il bilancio non la contiene.', azioni: 'Confermare le quote variabili nella sezione Bilancio.',
      calc: function (r) { return r.mc_pct; } },
    { id: 'bep', gruppo: 'Struttura dei costi', nome: 'Punto di pareggio (break-even)', unita: 'eur', fonte: 'gestionale',
      formula: 'Costi fissi operativi ÷ Margine di contribuzione %', usa: ['ricavi', 'personale', 'ammortamenti', 'godimento'],
      perche: 'I costi fissi si coprono solo con il margine lasciato da ogni euro prodotto.',
      significato: 'Valore della produzione a cui il risultato operativo è zero.', lettura: 'Va confrontato con il valore della produzione effettivo.',
      limiti: 'Ipotizza prezzi e mix costanti; non considera oneri finanziari e imposte.', azioni: 'Ridurre i costi fissi o aumentare il margine unitario.',
      calc: function (r) { return r.bep; } },
    { id: 'margine_sicurezza', gruppo: 'Struttura dei costi', nome: 'Margine di sicurezza', unita: 'pct', fonte: 'gestionale',
      formula: '(Valore della produzione − punto di pareggio) ÷ Valore della produzione', usa: ['ricavi'],
      perche: 'Dice di quanto può scendere l\'attività prima di andare in perdita operativa.',
      significato: 'Distanza dal pareggio.', lettura: 'Negativo: si opera sotto il pareggio.',
      limiti: 'Come il punto di pareggio.', azioni: 'Come il punto di pareggio.',
      calc: function (r) { return r.margine_sicurezza; } },
    { id: 'leva_operativa', gruppo: 'Struttura dei costi', nome: 'Leva operativa', unita: 'x', fonte: 'gestionale',
      formula: 'Margine di contribuzione ÷ EBIT', usa: ['ricavi', 'ammortamenti'],
      perche: 'Misura quanto pesano i costi fissi sul risultato.',
      significato: 'Di quante volte varia l\'EBIT rispetto alla variazione percentuale dei volumi.', lettura: 'Alta: piccoli cali di volume producono forti cali di risultato.',
      limiti: 'Non calcolabile con EBIT nullo o negativo.', azioni: 'Rendere variabili parte dei costi fissi.',
      calc: function (r) { return r.leva_operativa; } },
    { id: 'current_ratio', gruppo: 'Liquidità', nome: 'Current ratio (indice di disponibilità)', unita: 'x', fonte: 'bilancio',
      formula: 'Attivo corrente ÷ Passivo corrente', usa: ['rimanenze', 'crediti_clienti', 'liquidita', 'debiti_banche_breve', 'debiti_fornitori', 'debiti_tributari'],
      perche: 'Confronta ciò che diventerà denaro entro l\'anno con ciò che va pagato entro l\'anno.',
      significato: 'Capacità di far fronte agli impegni a breve.', lettura: 'Sotto 1 l\'attivo a breve non copre il passivo a breve.',
      limiti: 'Presuppone che scorte e crediti siano realmente realizzabili; nel bilancio abbreviato la quota a breve dei debiti va verificata.',
      azioni: 'Consolidare il debito a breve, accelerare incassi, ridurre scorte.',
      calc: function (r) { return div(r.attivo_corrente, r.passivo_corrente); } },
    { id: 'quick_ratio', gruppo: 'Liquidità', nome: 'Quick ratio (indice di liquidità)', unita: 'x', fonte: 'bilancio',
      formula: '(Attivo corrente − rimanenze) ÷ Passivo corrente', usa: ['rimanenze', 'crediti_clienti', 'liquidita', 'debiti_fornitori'],
      perche: 'Le rimanenze sono la parte meno rapidamente liquidabile dell\'attivo a breve.',
      significato: 'Copertura del passivo a breve senza dover vendere il magazzino.', lettura: 'Molto inferiore al current ratio: forte dipendenza dal magazzino.',
      limiti: 'Come il current ratio.', azioni: 'Come il current ratio.',
      calc: function (r, n) { return div(r.attivo_corrente - num(n.rimanenze), r.passivo_corrente); } },
    { id: 'ccn', gruppo: 'Liquidità', nome: 'Capitale circolante netto', unita: 'eur', fonte: 'bilancio',
      formula: 'Attivo corrente − Passivo corrente', usa: ['rimanenze', 'crediti_clienti', 'liquidita', 'debiti_fornitori', 'debiti_banche_breve'],
      perche: 'Stesse grandezze del current ratio, espresse in valore assoluto.',
      significato: 'Margine di attività a breve finanziato con fonti durevoli.', lettura: 'Negativo: parte delle immobilizzazioni è finanziata a breve.',
      limiti: 'Come il current ratio.', azioni: 'Riequilibrare le scadenze del debito.',
      calc: function (r) { return r.ccn; } },
    { id: 'dso', gruppo: 'Ciclo monetario', nome: 'Giorni medi di incasso (DSO)', unita: 'giorni', fonte: 'bilancio',
      formula: 'Crediti verso clienti ÷ Ricavi × 365', usa: ['crediti_clienti', 'ricavi'],
      perche: 'I crediti a fine anno rapportati alle vendite giornaliere stimano i giorni di dilazione.',
      significato: 'Tempo medio tra vendita e incasso.', lettura: 'In crescita: clienti che pagano più lentamente o crediti incagliati.',
      limiti: 'I crediti includono l\'IVA e i ricavi no: il valore è sovrastimato. Usa il saldo di fine anno, sensibile alla stagionalità.',
      azioni: 'Solleciti, condizioni di pagamento, anticipo o cessione crediti, selezione dei clienti.',
      calc: function (r, n) { return div(num(n.crediti_clienti) * 365, r.ricavi); } },
    { id: 'dpo', gruppo: 'Ciclo monetario', nome: 'Giorni medi di pagamento (DPO)', unita: 'giorni', fonte: 'bilancio',
      formula: 'Debiti verso fornitori ÷ (Acquisti di materie + servizi + godimento beni di terzi) × 365', usa: ['debiti_fornitori', 'materie', 'servizi', 'godimento'],
      perche: 'I debiti verso fornitori nascono da questi acquisti.',
      significato: 'Tempo medio di pagamento dei fornitori.', lettura: 'Molto alto può indicare tensione di cassa, non forza contrattuale.',
      limiti: 'I debiti includono l\'IVA; non distingue debiti scaduti.', azioni: 'Negoziare termini coerenti con i tempi di incasso.',
      calc: function (r, n) { return div(num(n.debiti_fornitori) * 365, r.acquisti_esterni); } },
    { id: 'giorni_magazzino', gruppo: 'Ciclo monetario', nome: 'Giorni di scorta', unita: 'giorni', fonte: 'bilancio',
      formula: 'Rimanenze ÷ Consumi di materie × 365', usa: ['rimanenze', 'materie', 'var_rim_materie'],
      perche: 'Rapporta il magazzino al ritmo con cui i materiali vengono consumati.',
      significato: 'Per quanti giorni basterebbero le scorte.', lettura: 'In crescita: acquisti eccessivi, vendite in calo o materiale fermo.',
      limiti: 'Le rimanenze includono prodotti finiti valutati a costo pieno: stima grossolana senza dati di magazzino.',
      azioni: 'Analisi delle giacenze ferme, riduzione lotti d\'acquisto.',
      calc: function (r, n) { return r.consumi_materie > 0 ? div(num(n.rimanenze) * 365, r.consumi_materie) : null; } },
    { id: 'rotazione_magazzino', gruppo: 'Ciclo monetario', nome: 'Rotazione del magazzino', unita: 'x', fonte: 'bilancio',
      formula: 'Consumi di materie ÷ Rimanenze', usa: ['rimanenze', 'materie', 'var_rim_materie'],
      perche: 'È l\'inverso dei giorni di scorta.', significato: 'Quante volte l\'anno il magazzino si rinnova.',
      lettura: 'Più è alta, meno capitale è fermo.', limiti: 'Come i giorni di scorta.', azioni: 'Come i giorni di scorta.',
      calc: function (r, n) { return num(n.rimanenze) > 0 ? div(r.consumi_materie, num(n.rimanenze)) : null; } },
    { id: 'ccc', gruppo: 'Ciclo monetario', nome: 'Ciclo monetario (CCC)', unita: 'giorni', fonte: 'bilancio',
      formula: 'Giorni di scorta + DSO − DPO', usa: ['rimanenze', 'crediti_clienti', 'debiti_fornitori', 'ricavi', 'materie'],
      perche: 'Somma i tempi in cui il denaro è fermo e sottrae la dilazione ottenuta dai fornitori.',
      significato: 'Giorni tra il pagamento dei fornitori e l\'incasso dai clienti.', lettura: 'Più è lungo, più cassa serve per crescere.',
      limiti: 'Somma i limiti dei tre indicatori.', azioni: 'Agire sul più sbilanciato dei tre.',
      calc: function (r, n) {
        var a = r.consumi_materie > 0 ? div(num(n.rimanenze) * 365, r.consumi_materie) : 0;
        var b = div(num(n.crediti_clienti) * 365, r.ricavi), c = div(num(n.debiti_fornitori) * 365, r.acquisti_esterni);
        return (b === null || c === null) ? null : a + b - c;
      } },
    { id: 'pfn', gruppo: 'Indebitamento', nome: 'Posizione finanziaria netta (PFN)', unita: 'eur', fonte: 'bilancio',
      formula: 'Debiti finanziari − disponibilità liquide − attività finanziarie a breve', usa: ['debiti_banche_breve', 'debiti_banche_lungo', 'altri_debiti_fin', 'liquidita', 'attivita_fin_breve'],
      perche: 'Si considerano solo i debiti onerosi, al netto di ciò che è già disponibile per rimborsarli.',
      significato: 'Debito finanziario netto. Positivo = debito, negativo = cassa netta.', lettura: 'Va rapportata a EBITDA e patrimonio netto.',
      limiti: 'Non include leasing fuori bilancio, debiti commerciali o tributari scaduti.', azioni: 'Generare cassa operativa, smobilizzare circolante, rinegoziare.',
      calc: function (r) { return r.pfn; } },
    { id: 'pfn_ebitda', gruppo: 'Indebitamento', nome: 'PFN / EBITDA', unita: 'x', fonte: 'bilancio',
      formula: 'PFN ÷ EBITDA', usa: ['debiti_banche_breve', 'debiti_banche_lungo', 'liquidita', 'ricavi', 'personale'],
      perche: 'L\'EBITDA approssima la cassa operativa con cui si rimborsa il debito.',
      significato: 'Anni teorici di margine operativo lordo necessari a rimborsare il debito.', lettura: 'È tra gli indicatori più osservati dalle banche: più è alto, più il debito è difficile da sostenere.',
      limiti: 'Non calcolabile con EBITDA nullo o negativo; l\'EBITDA non è cassa disponibile.', azioni: 'Migliorare i margini, allungare le scadenze, ridurre il circolante.',
      calc: function (r) { return r.ebitda > 0 ? div(r.pfn, r.ebitda) : null; } },
    { id: 'debt_equity', gruppo: 'Indebitamento', nome: 'Debt / Equity', unita: 'x', fonte: 'bilancio',
      formula: 'PFN ÷ Patrimonio netto', usa: ['debiti_banche_breve', 'debiti_banche_lungo', 'liquidita', 'capitale_riserve'],
      perche: 'Confronta i mezzi dei finanziatori con quelli dei soci.',
      significato: 'Grado di dipendenza dal debito finanziario.', lettura: 'Elevato: struttura fragile e minore capacità di ottenere nuovo credito.',
      limiti: 'Privo di significato con patrimonio netto negativo.', azioni: 'Capitalizzare, trattenere utili, ridurre il debito.',
      calc: function (r) { return r.patrimonio_netto > 0 ? div(r.pfn, r.patrimonio_netto) : null; } },
    { id: 'indebitamento', gruppo: 'Indebitamento', nome: 'Indice di indebitamento complessivo', unita: 'x', fonte: 'bilancio',
      formula: '(Totale passivo − Patrimonio netto) ÷ Patrimonio netto', usa: ['capitale_riserve', 'debiti_fornitori', 'debiti_banche_breve', 'debiti_banche_lungo', 'tfr'],
      perche: 'Include tutti i debiti, anche non finanziari.',
      significato: 'Euro di mezzi di terzi per ogni euro di mezzi propri.', lettura: 'Più è alto, minore è l\'autonomia finanziaria.',
      limiti: 'Privo di significato con patrimonio netto negativo.', azioni: 'Come Debt / Equity.',
      calc: function (r) { return r.patrimonio_netto > 0 ? div(r.totale_passivo - r.patrimonio_netto, r.patrimonio_netto) : null; } },
    { id: 'copertura_interessi', gruppo: 'Indebitamento', nome: 'Interest coverage ratio', unita: 'x', fonte: 'bilancio',
      formula: 'EBIT ÷ Oneri finanziari', usa: ['oneri_fin', 'ricavi', 'ammortamenti'],
      perche: 'Gli interessi si pagano con il risultato operativo.',
      significato: 'Quante volte il risultato operativo copre gli interessi.', lettura: 'Sotto 1 la gestione non paga nemmeno gli interessi.',
      limiti: 'Non considera il rimborso del capitale.', azioni: 'Ridurre debito o tasso, migliorare il risultato operativo.',
      calc: function (r, n) { return num(n.oneri_fin) > 0 ? div(r.ebit, num(n.oneri_fin)) : null; } },
    { id: 'flusso_operativo', gruppo: 'Cassa', nome: 'Cash flow operativo', unita: 'eur', fonte: 'bilancio', dueAnni: true,
      formula: 'Utile + ammortamenti + variazione fondi e TFR − variazione del capitale circolante operativo', usa: ['ammortamenti', 'rimanenze', 'crediti_clienti', 'debiti_fornitori', 'tfr', 'fondi_rischi'],
      perche: 'Corregge l\'utile per le poste non monetarie e per la cassa assorbita o liberata dal circolante.',
      significato: 'Cassa generata dalla gestione corrente nell\'anno.', lettura: 'Utile positivo con cash flow negativo: la crescita o i ritardi di incasso assorbono cassa.',
      limiti: 'Ricostruzione dalle variazioni di bilancio: richiede l\'esercizio precedente ed è approssimata.', azioni: 'Agire su incassi, scorte e pagamenti.',
      calc: function (r, n, ctx) { return ctx.rend ? ctx.rend.flusso_operativo : null; } },
    { id: 'dscr', gruppo: 'Cassa', nome: 'DSCR', unita: 'x', fonte: 'gestionale', dueAnni: true,
      formula: '(Cash flow operativo + oneri finanziari) ÷ (oneri finanziari + quote capitale rimborsate)', usa: ['oneri_fin', 'quota_capitale'],
      perche: 'Confronta la cassa disponibile per il debito con quanto il debito richiede nell\'anno.',
      significato: 'Capacità di servire il debito con la cassa generata.', lettura: 'Sotto 1 la cassa operativa non basta a pagare rate e interessi.',
      limiti: 'Richiede le quote capitale rimborsate, che il bilancio non riporta: vanno inserite dai piani di ammortamento.', azioni: 'Rinegoziare durata e rate, migliorare la cassa operativa.',
      calc: function (r, n, ctx) {
        if (!ctx.rend || n.quota_capitale === undefined) return null;
        return div(ctx.rend.flusso_operativo + num(n.oneri_fin), num(n.oneri_fin) + num(n.quota_capitale));
      } },
    { id: 'ricavi_dipendente', gruppo: 'Produttività', nome: 'Ricavi per dipendente', unita: 'eur', fonte: 'gestionale',
      formula: 'Ricavi ÷ numero medio dipendenti', usa: ['ricavi', 'dipendenti'],
      perche: 'Misura semplice della produttività commerciale del lavoro.',
      significato: 'Fatturato medio generato per addetto.', lettura: 'Da leggere nel tempo e con aziende comparabili.',
      limiti: 'Richiede il numero di dipendenti; ignora lavoro esterno e part-time.', azioni: 'Analisi per reparto.',
      calc: function (r, n) { return num(n.dipendenti) > 0 ? div(r.ricavi, num(n.dipendenti)) : null; } },
    { id: 'va_dipendente', gruppo: 'Produttività', nome: 'Valore aggiunto per dipendente', unita: 'eur', fonte: 'gestionale',
      formula: 'Valore aggiunto ÷ numero medio dipendenti', usa: ['ricavi', 'materie', 'servizi', 'dipendenti'],
      perche: 'Il valore aggiunto esclude ciò che è comprato all\'esterno: misura ciò che l\'azienda crea.',
      significato: 'Ricchezza creata per addetto.', lettura: 'Deve restare sopra il costo medio per dipendente.',
      limiti: 'Richiede il numero di dipendenti.', azioni: 'Analisi per reparto.',
      calc: function (r, n) { return num(n.dipendenti) > 0 ? div(r.valore_aggiunto, num(n.dipendenti)) : null; } }
  ];

  // Un indice si calcola solo se tutte le voci della sezione da cui dipende sono presenti:
  // 'ce' = conto economico, 'sp' = stato patrimoniale, 'tutto' = entrambi. Nessun vuoto viene trattato come zero.
  var SERVE = { ebitda: 'ce', ebitda_margin: 'ce', ebit: 'ce', ebit_margin: 'ce', ros: 'ce', utile: 'ce', incidenza_personale: 'ce', incidenza_materie: 'ce',
    margine_contribuzione: 'ce', bep: 'ce', margine_sicurezza: 'ce', leva_operativa: 'ce', current_ratio: 'sp', quick_ratio: 'sp', ccn: 'sp', pfn: 'sp' };
  function mancantiSezione(n, sezione) {
    return VOCI.filter(function (v) {
      if (v.tipo === 'ges' || n[v.id] !== undefined) return false;
      return sezione === 'tutto' || (sezione === 'ce' ? v.tipo === 'ce' : v.tipo !== 'ce');
    }).map(function (v) { return v.id; });
  }

  function calcolaIndici(n, nPrec, classif) {
    var r = riclassifica(n, classif);
    var rend = nPrec ? rendiconto(n, nPrec, classif) : null;
    var out = {};
    INDICI.forEach(function (d) {
      var v = d.calc(r, n, { rend: rend });
      if (v !== null && !isFinite(v)) v = null;
      var manca = mancantiSezione(n, SERVE[d.id] || 'tutto').concat(d.usa.filter(function (k) { return VOCE[k].tipo === 'ges' && n[k] === undefined; }));
      var motivo = null;
      if (manca.length) v = null;
      if (v === null) {
        if (manca.length) motivo = 'Non calcolato: mancano ' + manca.length + ' voci, tra cui ' + manca.slice(0, 3).map(function (k) { return VOCE[k].nome; }).join('; ') + '. Le voci assenti non vengono considerate zero.';
        else if (d.dueAnni && !nPrec) motivo = 'Serve anche l\'esercizio precedente.';
        else motivo = 'Non calcolabile con questi valori (denominatore nullo o negativo).';
      }
      out[d.id] = { v: v, incompleto: manca.length > 0, manca: manca, motivo: motivo };
    });
    return out;
  }

  // --------------------------------------------------------------- diagnosi
  // Soglie generali di prudenza, NON benchmark di settore. Sono modificabili.
  var SOGLIE = {
    pfn_ebitda_giallo: 3, pfn_ebitda_rosso: 5,
    copertura_giallo: 3, copertura_rosso: 1.5,
    current_giallo: 1.2, current_rosso: 1,
    de_giallo: 2, de_rosso: 4,
    dso_giallo: 90, dso_rosso: 120,
    scorta_giallo: 90, scorta_rosso: 150,
    sicurezza_giallo: 0.10,
    ebitda_margin_giallo: 0.05
  };

  function eur(x) { return (x < 0 ? '−' : '') + '€ ' + Math.round(Math.abs(x)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function pct(x) { return (x * 100).toFixed(1).replace('.', ',') + '%'; }
  function gg(x) { return Math.round(x) + ' giorni'; }
  function volte(x) { return x.toFixed(2).replace('.', ',') + 'x'; }

  // serie: [{anno, n}] in ordine crescente. Restituisce le criticità dell'ultimo esercizio.
  function diagnosi(serie, classif, soglie) {
    var S = Object.assign({}, SOGLIE, soglie || {});
    if (!serie.length) return [];
    var cur = serie[serie.length - 1], prev = serie.length > 1 ? serie[serie.length - 2] : null;
    var n = cur.n, r = riclassifica(n, classif), ix = calcolaIndici(n, prev && prev.n, classif);
    var rp = prev ? riclassifica(prev.n, classif) : null, ixp = prev ? calcolaIndici(prev.n, null, classif) : null;
    var rend = prev ? rendiconto(n, prev.n, classif) : null;
    var out = [];
    function add(o) { o.anno = cur.anno; out.push(o); }

    if (Math.abs(r.quadratura) > 1) add({ id: 'squadratura', gravita: 'rosso', peso: 1e12, titolo: 'Lo stato patrimoniale non quadra',
      dati: 'Attivo ' + eur(r.totale_attivo) + ', passivo e netto ' + eur(r.totale_passivo) + ': differenza ' + eur(r.quadratura) + '.',
      causa: 'Voce mancante, importo errato o utile di conto economico diverso da quello iscritto nel patrimonio netto.',
      intervento: 'Verificare i dati inseriti prima di usare qualsiasi analisi: gli indici patrimoniali non sono affidabili.',
      effetto: 'Nessun effetto economico: è un problema di qualità del dato.' });

    if (r.patrimonio_netto <= 0) add({ id: 'patrimonio_negativo', gravita: 'rosso', peso: 1e11, titolo: 'Patrimonio netto azzerato o negativo',
      dati: 'Patrimonio netto ' + eur(r.patrimonio_netto) + '.',
      causa: 'Perdite accumulate superiori ai mezzi propri.',
      intervento: 'Situazione con obblighi di legge per gli amministratori delle società di capitali: va esaminata subito con il commercialista (ricapitalizzazione, copertura perdite o altre misure).',
      effetto: 'Fabbisogno minimo di mezzi propri: ' + eur(-r.patrimonio_netto) + ' per tornare a zero.' });

    if (r.ebitda < 0) add({ id: 'ebitda_negativo', gravita: 'rosso', peso: -r.ebitda * 3, titolo: 'La gestione operativa è in perdita',
      dati: 'EBITDA ' + eur(r.ebitda) + ' su valore della produzione ' + eur(r.valore_produzione) + '.',
      causa: 'I ricavi non coprono i costi operativi monetari' + (r.margine_sicurezza !== null && r.margine_sicurezza < 0 ? ': l\'attività è sotto il punto di pareggio stimato (' + eur(r.bep) + ').' : '.'),
      intervento: 'Individuare con lo scenario quali leve (prezzi, volumi, costi) riportano l\'EBITDA in positivo.',
      effetto: 'Ogni anno a questi livelli assorbe circa ' + eur(-r.ebitda) + ' di cassa, prima di investimenti e debito.' });
    else if (ix.ebitda_margin.v !== null && ix.ebitda_margin.v < S.ebitda_margin_giallo) add({ id: 'ebitda_basso', gravita: 'giallo', peso: r.valore_produzione * (S.ebitda_margin_giallo - ix.ebitda_margin.v), titolo: 'Margine operativo lordo ridotto',
      dati: 'EBITDA margin ' + pct(ix.ebitda_margin.v) + ' (soglia generale di attenzione ' + pct(S.ebitda_margin_giallo) + ').',
      causa: 'Struttura dei costi che lascia poco margine: da verificare rispetto al settore.',
      intervento: 'Analizzare le incidenze di materie, servizi e personale e il loro andamento.',
      effetto: 'Arrivare al ' + pct(S.ebitda_margin_giallo) + ' significherebbe ' + eur(r.valore_produzione * (S.ebitda_margin_giallo - ix.ebitda_margin.v)) + ' di EBITDA in più.' });

    if (r.ebitda >= 0 && r.utile < 0) add({ id: 'perdita', gravita: 'rosso', peso: -r.utile * 2, titolo: 'Esercizio chiuso in perdita',
      dati: 'EBITDA ' + eur(r.ebitda) + ', ammortamenti e accantonamenti ' + eur(r.ammortamenti_acc) + ', oneri finanziari ' + eur(num(n.oneri_fin)) + ', utile ' + eur(r.utile) + '.',
      causa: r.ebit < 0 ? 'Il margine lordo non copre ammortamenti e accantonamenti.' : 'Il risultato operativo è assorbito da oneri finanziari e imposte.',
      intervento: r.ebit < 0 ? 'Verificare se gli investimenti sono sottoutilizzati e se il margine può crescere.' : 'Ridurre il costo del debito: rinegoziazione, consolidamento, riduzione del circolante.',
      effetto: 'La perdita riduce il patrimonio netto di ' + eur(-r.utile) + '.' });

    var pe = ix.pfn_ebitda.v;
    if (pe !== null && r.pfn > 0 && pe > S.pfn_ebitda_giallo) add({ id: 'indebitamento', gravita: pe > S.pfn_ebitda_rosso ? 'rosso' : 'giallo', peso: (pe - S.pfn_ebitda_giallo) * r.ebitda,
      titolo: 'Debito finanziario elevato rispetto ai margini',
      dati: 'PFN ' + eur(r.pfn) + ', EBITDA ' + eur(r.ebitda) + ': rapporto ' + volte(pe) + ' (soglie generali ' + S.pfn_ebitda_giallo + 'x e ' + S.pfn_ebitda_rosso + 'x).',
      causa: 'Debito cresciuto più dei margini, oppure margini scesi a debito invariato.',
      intervento: 'Piano di rientro: più cassa operativa, meno circolante, scadenze più lunghe. Nessun nuovo debito senza un ritorno dimostrato.',
      effetto: 'Per scendere a ' + S.pfn_ebitda_giallo + 'x servono ' + eur(r.pfn - S.pfn_ebitda_giallo * r.ebitda) + ' di debito in meno oppure ' + eur(r.pfn / S.pfn_ebitda_giallo - r.ebitda) + ' di EBITDA in più.' });
    else if (r.pfn > 0 && r.ebitda <= 0) add({ id: 'indebitamento', gravita: 'rosso', peso: r.pfn, titolo: 'Debito finanziario senza margini per rimborsarlo',
      dati: 'PFN ' + eur(r.pfn) + ' con EBITDA ' + eur(r.ebitda) + '.',
      causa: 'La gestione non genera le risorse per servire il debito.',
      intervento: 'Priorità assoluta al ritorno a un margine positivo; confronto immediato con i finanziatori.',
      effetto: 'Il debito può essere servito solo con nuova finanza o cessioni.' });

    var ci = ix.copertura_interessi.v;
    if (ci !== null && ci < S.copertura_giallo) add({ id: 'interessi', gravita: ci < S.copertura_rosso ? 'rosso' : 'giallo', peso: num(n.oneri_fin) * 2,
      titolo: 'Gli interessi assorbono gran parte del risultato operativo',
      dati: 'EBIT ' + eur(r.ebit) + ', oneri finanziari ' + eur(num(n.oneri_fin)) + ': copertura ' + volte(ci) + '.',
      causa: 'Debito elevato, tassi alti o risultato operativo debole.',
      intervento: 'Confrontare le condizioni dei finanziamenti con il mercato e valutare rinegoziazione o surroga.',
      effetto: 'Ogni punto percentuale di tasso in meno sul debito vale circa ' + eur(r.debiti_finanziari * 0.01) + ' l\'anno.' });

    var cr = ix.current_ratio.v;
    if (cr !== null && cr < S.current_giallo) add({ id: 'liquidita', gravita: cr < S.current_rosso ? 'rosso' : 'giallo', peso: Math.max(0, r.passivo_corrente * S.current_giallo - r.attivo_corrente),
      titolo: 'Equilibrio a breve termine fragile',
      dati: 'Attivo corrente ' + eur(r.attivo_corrente) + ', passivo corrente ' + eur(r.passivo_corrente) + ': current ratio ' + volte(cr) + '. Liquidità ' + eur(num(n.liquidita)) + '.',
      causa: 'Troppo debito a breve rispetto alle attività che diventano denaro entro l\'anno.',
      intervento: 'Spostare debito dal breve al medio termine, accelerare incassi, ridurre scorte.',
      effetto: 'Per arrivare a ' + S.current_giallo + ' servono ' + eur(Math.max(0, r.passivo_corrente * S.current_giallo - r.attivo_corrente)) + ' di attivo a breve in più o di passivo a breve in meno.' });

    var de = ix.debt_equity.v;
    if (de !== null && de > S.de_giallo) add({ id: 'sottocapitalizzazione', gravita: de > S.de_rosso ? 'rosso' : 'giallo', peso: (de - S.de_giallo) * r.patrimonio_netto * 0.5,
      titolo: 'Mezzi propri ridotti rispetto al debito',
      dati: 'PFN ' + eur(r.pfn) + ', patrimonio netto ' + eur(r.patrimonio_netto) + ': rapporto ' + volte(de) + '.',
      causa: 'Crescita finanziata a debito o utili non trattenuti.',
      intervento: 'Trattenere gli utili, valutare apporti dei soci.',
      effetto: 'Per scendere a ' + S.de_giallo + 'x: ' + eur(r.pfn / S.de_giallo - r.patrimonio_netto) + ' di patrimonio in più a debito invariato.' });

    var dso = ix.dso.v;
    if (dso !== null && dso > S.dso_giallo) add({ id: 'incassi', gravita: dso > S.dso_rosso ? 'rosso' : 'giallo', peso: (dso - S.dso_giallo) / 365 * r.ricavi,
      titolo: 'Tempi di incasso lunghi',
      dati: 'Crediti verso clienti ' + eur(num(n.crediti_clienti)) + ' su ricavi ' + eur(r.ricavi) + ': ' + gg(dso) + (ixp && ixp.dso.v !== null ? ' (anno precedente ' + gg(ixp.dso.v) + ')' : '') + '.',
      causa: 'Dilazioni concesse, ritardi dei clienti o crediti incagliati. Il dato include l\'IVA ed è quindi sovrastimato.',
      intervento: 'Scadenziario clienti, solleciti sistematici, revisione delle condizioni per i clienti lenti.',
      effetto: 'Riportare gli incassi a ' + S.dso_giallo + ' giorni libererebbe circa ' + eur((dso - S.dso_giallo) / 365 * r.ricavi) + ' di cassa.' });
    else if (dso !== null && ixp && ixp.dso.v !== null && dso - ixp.dso.v > 15) add({ id: 'incassi', gravita: 'giallo', peso: (dso - ixp.dso.v) / 365 * r.ricavi,
      titolo: 'Tempi di incasso in peggioramento',
      dati: 'DSO da ' + gg(ixp.dso.v) + ' a ' + gg(dso) + '.',
      causa: 'Clienti che pagano più lentamente o cambiamento del mix di clientela.',
      intervento: 'Analisi dei crediti per anzianità e per cliente.',
      effetto: 'Il peggioramento ha assorbito circa ' + eur((dso - ixp.dso.v) / 365 * r.ricavi) + ' di cassa.' });

    var gm = ix.giorni_magazzino.v, gmp = ixp ? ixp.giorni_magazzino.v : null;
    if (gm !== null && (gm > S.scorta_giallo || (gmp !== null && gm - gmp > 20))) {
      var obiettivo = gm > S.scorta_giallo ? S.scorta_giallo : gmp;
      add({ id: 'magazzino', gravita: gm > S.scorta_rosso ? 'rosso' : 'giallo', peso: Math.max(0, (gm - obiettivo) / 365 * r.consumi_materie),
        titolo: 'Magazzino elevato rispetto ai consumi',
        dati: 'Rimanenze ' + eur(num(n.rimanenze)) + ': ' + gg(gm) + ' di scorta' + (gmp !== null ? ' (anno precedente ' + gg(gmp) + ')' : '') + '.',
        causa: 'Acquisti superiori ai consumi, vendite in calo o materiale a lenta rotazione. Senza dati di magazzino non è possibile distinguere.',
        intervento: 'Analisi delle giacenze per data dell\'ultimo movimento; blocco dei riordini sugli articoli fermi.',
        effetto: 'Tornare a ' + gg(obiettivo) + ' libererebbe circa ' + eur(Math.max(0, (gm - obiettivo) / 365 * r.consumi_materie)) + ' di capitale immobilizzato.' });
    }

    var ms = r.margine_sicurezza;
    if (ms !== null && ms >= 0 && ms < S.sicurezza_giallo && r.ebitda >= 0) add({ id: 'pareggio', gravita: 'giallo', peso: r.valore_produzione * (S.sicurezza_giallo - ms) * (r.mc_pct || 0),
      titolo: 'Attività vicina al punto di pareggio',
      dati: 'Valore della produzione ' + eur(r.valore_produzione) + ', punto di pareggio stimato ' + eur(r.bep) + ': margine di sicurezza ' + pct(ms) + '.',
      causa: 'Costi fissi elevati rispetto ai volumi (stima basata sulle quote fissi/variabili impostate).',
      intervento: 'Verificare la classificazione dei costi, poi valutare volumi aggiuntivi o riduzione dei costi fissi.',
      effetto: 'Un calo dei volumi oltre il ' + pct(ms) + ' porterebbe il risultato operativo in negativo.' });

    if (rp) {
      var dr = div(r.ricavi - rp.ricavi, rp.ricavi);
      if (dr !== null && dr < -0.03) add({ id: 'ricavi_calo', gravita: dr < -0.10 ? 'rosso' : 'giallo', peso: (rp.ricavi - r.ricavi) * (r.mc_pct || 0.3),
        titolo: 'Ricavi in calo',
        dati: 'Ricavi da ' + eur(rp.ricavi) + ' a ' + eur(r.ricavi) + ' (' + pct(dr) + ').',
        causa: 'Perdita di volumi, di clienti o riduzione dei prezzi: servono i dati di vendita per distinguere.',
        intervento: 'Analisi per cliente e per prodotto; con i costi fissi attuali verificare il nuovo punto di pareggio.',
        effetto: 'Margine di contribuzione perso stimato: ' + eur((rp.ricavi - r.ricavi) * (r.mc_pct || 0)) + '.' });

      var m0 = div(rp.ebitda, rp.valore_produzione), m1 = div(r.ebitda, r.valore_produzione);
      if (m0 !== null && m1 !== null && m0 - m1 > 0.015) {
        var voci = [['consumi di materie', div(r.consumi_materie, r.valore_produzione) - div(rp.consumi_materie, rp.valore_produzione)],
          ['servizi', div(num(n.servizi), r.valore_produzione) - div(num(prev.n.servizi), rp.valore_produzione)],
          ['personale', div(r.personale, r.valore_produzione) - div(rp.personale, rp.valore_produzione)],
          ['godimento beni di terzi', div(num(n.godimento), r.valore_produzione) - div(num(prev.n.godimento), rp.valore_produzione)]]
          .filter(function (x) { return x[1] > 0.002; }).sort(function (a, b) { return b[1] - a[1]; });
        add({ id: 'marginalita_calo', gravita: m0 - m1 > 0.04 ? 'rosso' : 'giallo', peso: (m0 - m1) * r.valore_produzione,
          titolo: 'Marginalità in riduzione',
          dati: 'EBITDA margin da ' + pct(m0) + ' a ' + pct(m1) + '.',
          causa: voci.length ? 'Incidenze cresciute: ' + voci.map(function (x) { return x[0] + ' +' + pct(x[1]); }).join(', ') + '.' : 'Calo dei ricavi a parità di costi di struttura.',
          intervento: voci.length ? 'Intervenire prima su ' + voci[0][0] + ': è la voce che ha eroso più margine.' : 'Adeguare i costi fissi ai nuovi volumi o recuperare volumi.',
          effetto: 'Con la marginalità dell\'anno precedente l\'EBITDA sarebbe stato più alto di ' + eur((m0 - m1) * r.valore_produzione) + '.' });
      }
      if (rend && rend.flusso_operativo < 0 && r.utile > 0) add({ id: 'cassa_operativa', gravita: 'giallo', peso: -rend.flusso_operativo,
        titolo: 'Utile senza cassa',
        dati: 'Utile ' + eur(r.utile) + ' ma cash flow operativo ' + eur(rend.flusso_operativo) + '; il capitale circolante ha assorbito ' + eur(rend.var_ccn) + '.',
        causa: 'Crediti e scorte crescono più dei debiti di funzionamento.',
        intervento: 'Agire su incassi e scorte; verificare che la crescita sia finanziata con fonti adeguate.',
        effetto: 'La gestione corrente ha richiesto ' + eur(-rend.flusso_operativo) + ' di finanza esterna o di liquidità.' });
    }

    out.sort(function (a, b) { return (a.gravita === b.gravita) ? b.peso - a.peso : (a.gravita === 'rosso' ? -1 : 1); });
    out.forEach(function (o, i) { o.priorita = i + 1; });
    return out;
  }

  // ----------------------------------------------------------------- budget
  var VOCI_CE = VOCI.filter(function (v) { return v.tipo === 'ce'; }).map(function (v) { return v.id; });

  // ipotesi: {voce: variazione percentuale (es. 0.03)}; le voci non indicate restano uguali alla base.
  function creaBudget(nBase, ipotesi) {
    var b = {};
    VOCI_CE.forEach(function (k) { b[k] = Math.round(num(nBase[k]) * (1 + num(ipotesi && ipotesi[k]))); });
    return b;
  }

  var RIGHE_SCOST = [
    ['ricavi', 'Ricavi', 1], ['valore_produzione', 'Valore della produzione', 1], ['consumi_materie', 'Consumi di materie', -1],
    ['servizi', 'Servizi', -1], ['godimento', 'Godimento beni di terzi', -1], ['oneri_diversi', 'Oneri diversi', -1],
    ['personale', 'Personale', -1], ['ebitda', 'EBITDA', 1], ['ammortamenti_acc', 'Ammortamenti e accantonamenti', -1],
    ['ebit', 'EBIT', 1], ['gestione_finanziaria', 'Gestione finanziaria', 1], ['utile', 'Utile netto', 1]
  ];
  function scostamenti(nBudget, nCons, classif) {
    var b = riclassifica(nBudget, classif), c = riclassifica(nCons, classif);
    b.servizi = num(nBudget.servizi); c.servizi = num(nCons.servizi);
    b.godimento = num(nBudget.godimento); c.godimento = num(nCons.godimento);
    b.oneri_diversi = num(nBudget.oneri_diversi); c.oneri_diversi = num(nCons.oneri_diversi);
    var righe = RIGHE_SCOST.map(function (x) {
      var d = c[x[0]] - b[x[0]];
      return { id: x[0], nome: x[1], budget: b[x[0]], consuntivo: c[x[0]], delta: d, deltaPct: div(d, Math.abs(b[x[0]])), favorevole: d * x[2] >= 0, effettoEbitda: d * x[2] };
    });
    var cause = righe.filter(function (x) { return ['valore_produzione', 'consumi_materie', 'servizi', 'godimento', 'oneri_diversi', 'personale'].indexOf(x.id) >= 0 && Math.abs(x.effettoEbitda) >= 1; })
      .sort(function (a, b2) { return Math.abs(b2.effettoEbitda) - Math.abs(a.effettoEbitda); });
    return { righe: righe, cause: cause, deltaEbitda: c.ebitda - b.ebitda };
  }

  // ---------------------------------------------------------------- scenari
  var SCENARI_PREDEFINITI = {
    prudenziale: { nome: 'Prudenziale', volumi: -0.08, prezzi: 0, materie: 0.05, servizi: 0.04, personale: 0.03, altri: 0.03, oneri_fin: 0.10 },
    centrale: { nome: 'Centrale', volumi: 0.02, prezzi: 0.01, materie: 0.02, servizi: 0.02, personale: 0.02, altri: 0.02, oneri_fin: 0 },
    favorevole: { nome: 'Favorevole', volumi: 0.08, prezzi: 0.02, materie: 0, servizi: 0.01, personale: 0.02, altri: 0.01, oneri_fin: 0 }
  };
  var ALIQUOTA_IPOTESI = 0.279; // IRES 24% + IRAP 3,9%: ipotesi semplificata, dichiarata all'utente

  function aliquota(n, r) {
    var t = div(num(n.imposte), r.risultato_ante_imposte);
    return (r.risultato_ante_imposte > 0 && t !== null && t >= 0 && t <= 0.6) ? { t: t, stimata: false } : { t: ALIQUOTA_IPOTESI, stimata: true };
  }

  // ip: variazioni percentuali. volumi = quantità vendute; prezzi = prezzi di vendita;
  // materie/servizi/personale/altri = prezzi unitari dei costi; oneri_fin = variazione degli interessi.
  function simula(n, classif, ip) {
    ip = ip || {};
    var v = 1 + num(ip.volumi), p = 1 + num(ip.prezzi);
    var m = Object.assign({}, n);
    ['ricavi', 'altri_ricavi', 'var_rim_prodotti'].forEach(function (k) { m[k] = num(n[k]) * v * (k === 'altri_ricavi' ? 1 : p); });
    var infl = { materie: ip.materie, var_rim_materie: ip.materie, servizi: ip.servizi, personale: ip.personale, godimento: ip.altri, oneri_diversi: ip.altri, ammortamenti: 0, svalutazioni_acc: 0 };
    COSTI_OPERATIVI.forEach(function (k) {
      var q = quota(classif, k);
      m[k] = num(n[k]) * (1 + num(infl[k])) * (q * v + (1 - q));
    });
    m.oneri_fin = num(n.oneri_fin) * (1 + num(ip.oneri_fin));
    var r0 = riclassifica(n, classif), al = aliquota(n, r0);
    var r1 = riclassifica(m, classif);
    m.imposte = Math.max(0, r1.risultato_ante_imposte) * al.t;
    r1 = riclassifica(m, classif);
    // effetto sul circolante: il circolante commerciale segue i ricavi
    var varCcn = r0.ricavi > 0 ? r0.ccn_commerciale * (r1.ricavi / r0.ricavi - 1) : 0;
    var flusso = r1.utile + num(m.ammortamenti) - varCcn;
    return {
      n: m, r: r1, base: r0, aliquota: al.t, aliquotaStimata: al.stimata,
      var_ccn: varCcn, flusso_cassa: flusso, pfn_prevista: r0.pfn - flusso,
      pfn_ebitda: r1.ebitda > 0 ? (r0.pfn - flusso) / r1.ebitda : null
    };
  }

  // Valore della produzione necessario per un utile netto obiettivo (prezzi e struttura invariati).
  function produzionePerUtile(n, classif, utileObiettivo) {
    var r = riclassifica(n, classif), al = aliquota(n, r);
    if (r.mc_pct === null || r.mc_pct <= 0) return null;
    var ante = utileObiettivo > 0 ? utileObiettivo / (1 - al.t) : utileObiettivo;
    var vp = (r.costi_fissi - r.gestione_finanziaria + ante) / r.mc_pct;
    return { valore_produzione: vp, aumento: div(vp - r.valore_produzione, r.valore_produzione), aliquota: al.t, aliquotaStimata: al.stimata };
  }

  // -------------------------------------------------------------- collaudo
  // Verifiche di coerenza eseguibili su qualsiasi azienda, simulata o importata.
  function collaudo(serie, classif) {
    var esiti = [];
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    serie.forEach(function (s, i) {
      var n = s.n, r = riclassifica(n, classif), a = s.anno;
      var man = mancanti(n);
      t(a + ' · dati completi', man.length === 0, man.length ? 'Mancano ' + man.length + ' voci: ' + man.slice(0, 4).map(function (k) { return VOCE[k].nome; }).join('; ') + (man.length > 4 ? '…' : '') : 'Tutte le voci presenti');
      t(a + ' · quadratura attivo = passivo', Math.abs(r.quadratura) <= 1, 'Differenza ' + eur(r.quadratura));
      var somma = r.valore_produzione - r.costi_esterni - r.personale - r.ammortamenti_acc + r.gestione_finanziaria - r.imposte;
      t(a + ' · conto economico: i margini portano all\'utile', Math.abs(somma - r.utile) < 0.01, 'Utile ' + eur(r.utile));
      t(a + ' · costi fissi + variabili = costi operativi', Math.abs(r.costi_fissi + r.costi_variabili - (r.costi_esterni + r.personale + r.ammortamenti_acc)) < 0.01, 'Fissi ' + eur(r.costi_fissi) + ', variabili ' + eur(r.costi_variabili));
      var ix = calcolaIndici(n, i > 0 ? serie[i - 1].n : null, classif);
      var rotti = Object.keys(ix).filter(function (k) { return ix[k].v !== null && !isFinite(ix[k].v); });
      t(a + ' · indici: nessun valore non numerico', rotti.length === 0, Object.keys(ix).filter(function (k) { return ix[k].v !== null; }).length + ' indici calcolati su ' + INDICI.length);
      var s0 = simula(n, classif, {});
      t(a + ' · scenario a variazioni zero = dato di partenza', Math.abs(s0.r.ebit - r.ebit) < 0.01, 'EBIT ' + eur(s0.r.ebit));
      if (r.bep !== null && r.valore_produzione > 0) {
        var sb = simula(n, classif, { volumi: r.bep / r.valore_produzione - 1 });
        t(a + ' · al punto di pareggio l\'EBIT è zero', Math.abs(sb.r.ebit) < Math.max(1, r.valore_produzione * 1e-9), 'EBIT simulato ' + eur(sb.r.ebit) + ' a ' + eur(r.bep));
      }
      if (i > 0) {
        var rd = rendiconto(n, serie[i - 1].n, classif), rq = riclassifica(serie[i - 1].n, classif);
        var bil = Math.abs(r.quadratura) <= 1 && Math.abs(rq.quadratura) <= 1;
        t(a + ' · rendiconto: i flussi spiegano la variazione di liquidità', !bil || Math.abs(rd.differenza) <= 2, bil ? 'Differenza ' + eur(rd.differenza) : 'Non verificabile: uno dei due bilanci non quadra');
      }
    });
    return esiti;
  }

  return {
    VERSIONE_MOTORE: '1.0.0',
    VOCI: VOCI, VOCE: VOCE, VOCI_CE: VOCI_CE, COSTI_OPERATIVI: COSTI_OPERATIVI, QUOTE_PREDEFINITE: QUOTE_PREDEFINITE,
    INDICI: INDICI, SOGLIE: SOGLIE, SCENARI_PREDEFINITI: SCENARI_PREDEFINITI, ALIQUOTA_IPOTESI: ALIQUOTA_IPOTESI,
    numeri: numeri, mancanti: mancanti, mancantiSezione: mancantiSezione, quota: quota, riclassifica: riclassifica, rendiconto: rendiconto,
    calcolaIndici: calcolaIndici, diagnosi: diagnosi, creaBudget: creaBudget, scostamenti: scostamenti,
    simula: simula, produzionePerUtile: produzionePerUtile, collaudo: collaudo,
    fmt: { eur: eur, pct: pct, gg: gg, volte: volte }
  };
});
