/* Timone · modulo Ricerca bandi (comunali, regionali, nazionali, europei)
   Funzioni pure. Prepara la ricerca (filtri per livello, tipo di bando, settore, solo bandi aperti, profilo
   dell'azienda) in due modi: ricerca semplice sul web (link al motore di ricerca con tutti i criteri) e ricerca con
   il motore AI. Controlla e normalizza i bandi trovati dal motore AI, li filtra e ordina per scadenza, gestisce l'archivio dei
   bandi salvati e ne ricava le criticità (scadenze vicine) e la scheda da passare al registro agevolazioni.
   Regole: un bando senza link alla fonte viene scartato; date non valide restano vuote; nulla viene stimato.
   Ogni bando trovato resta "da verificare sulla fonte ufficiale". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Bandi = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIVELLI = { comunale: 'Comunale', regionale: 'Regionale', nazionale: 'Nazionale', europeo: 'Europeo' };
  var TIPI = { fondo_perduto: 'Contributo a fondo perduto', credito_imposta: 'Credito d\'imposta', finanziamento_agevolato: 'Finanziamento agevolato', garanzia: 'Garanzia pubblica',
    voucher: 'Voucher', premio: 'Premio o concorso', gara: 'Gara o appalto pubblico', altro: 'Altro' };
  var SETTORI = { agricoltura: 'Agricoltura e agroalimentare', manifattura: 'Manifattura e industria', commercio: 'Commercio', turismo: 'Turismo e ristorazione', servizi: 'Servizi alle imprese',
    edilizia: 'Edilizia e costruzioni', digitale: 'Digitale e ICT', energia: 'Energia e ambiente', ricerca: 'Ricerca e innovazione', cultura: 'Cultura e creatività',
    sociale: 'Sociale e terzo settore', trasporti: 'Trasporti e logistica', artigianato: 'Artigianato', formazione: 'Formazione e lavoro' };
  var STATI = { aperto: 'Aperto', in_arrivo: 'In arrivo', scaduto: 'Scaduto', sconosciuto: 'Date da verificare' };
  var VALUTAZIONI = { valutare: 'Da valutare', interessa: 'Interessa', non_adatto: 'Non adatto', domanda: 'Domanda in preparazione', presentata: 'Domanda presentata' };
  var DIMENSIONI = { micro: 'Micro impresa (< 10 addetti)', piccola: 'Piccola impresa (< 50 addetti)', media: 'Media impresa (< 250 addetti)', grande: 'Grande impresa' };
  var REGIONI = ['Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto'];
  // corrispondenza con i tipi del registro agevolazioni (modulo Finanziamenti)
  var TIPO_AGEVOLAZIONE = { fondo_perduto: 'fondo_perduto', voucher: 'fondo_perduto', premio: 'fondo_perduto', credito_imposta: 'credito_imposta', finanziamento_agevolato: 'tasso_agevolato', garanzia: 'garanzia' };
  // settore dell'azienda (Impostazioni) → settore dei bandi proposto
  var DA_SETTORE_AZIENDA = { manifatturiera: 'manifattura', commerciale: 'commercio', servizi: 'servizi', artigiana: 'artigianato', professionista: 'servizi' };
  var PARAM = { giorniScadenza: 30 };
  var MOTORI = { google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo' };
  // parole usate nella ricerca semplice sul web per rispettare i criteri scelti
  var PAROLE_TIPO = { fondo_perduto: '"fondo perduto"', credito_imposta: '"credito d\'imposta"', finanziamento_agevolato: '"finanziamento agevolato"', garanzia: 'garanzia', voucher: 'voucher',
    premio: '(premio OR concorso)', gara: '(gara OR appalto)', altro: '' };
  var PAROLE_SETTORE = { agricoltura: '(agricoltura OR agricole)', manifattura: '(manifattura OR manifatturiere OR industria)', commercio: 'commercio', turismo: '(turismo OR turistiche)', servizi: 'servizi',
    edilizia: 'edilizia', digitale: '(digitale OR digitalizzazione)', energia: '(energia OR energetica OR ambiente)', ricerca: '(ricerca OR innovazione)', cultura: 'cultura',
    sociale: '("terzo settore" OR sociale)', trasporti: '(trasporti OR logistica)', artigianato: '(artigianato OR artigiane)', formazione: '(formazione OR assunzioni)' };
  var PAROLE_APERTI = '(aperto OR scadenza OR "domande entro" OR sportello) -graduatoria -"bando chiuso" -scaduto';

  // portali ufficiali sempre consultabili (per comune e regione c'è la ricerca semplice sul web)
  var PORTALI = [
    { livello: 'nazionale', nome: 'Incentivi.gov.it (Ministero delle Imprese)', url: 'https://www.incentivi.gov.it/' },
    { livello: 'nazionale', nome: 'Invitalia', url: 'https://www.invitalia.it/' },
    { livello: 'nazionale', nome: 'Fondo di garanzia per le PMI', url: 'https://www.fondidigaranzia.it/' },
    { livello: 'nazionale', nome: 'Acquisti in rete PA (gare e MePA)', url: 'https://www.acquistinretepa.it/' },
    { livello: 'europeo', nome: 'Portale UE Funding & Tenders', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home' },
    { livello: 'europeo', nome: 'OpenCoesione (fondi europei in Italia)', url: 'https://opencoesione.gov.it/' }
  ];

  function testo(x) { return String(x === null || x === undefined ? '' : x).trim(); }
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function dataIso(x) { var p = /^(\d{4})-(\d{2})-(\d{2})/.exec(testo(x)); if (!p) return null; var d = new Date(Date.UTC(+p[1], +p[2] - 1, +p[3])); return d.getUTCMonth() === +p[2] - 1 ? p[1] + '-' + p[2] + '-' + p[3] : null; }
  function giorniTra(a, b) { var x = Date.parse(a), y = Date.parse(b); return (isNaN(x) || isNaN(y)) ? null : Math.round((y - x) / 86400000); }
  function chiave(b) { return testo(b.url).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/+$/, '') + '|' + testo(b.titolo).toLowerCase(); }
  function vuoto() { return { profilo: {}, salvati: [] }; }
  function dati(az) { var d = az.bandi || vuoto(); d.profilo = d.profilo || {}; d.salvati = d.salvati || []; return d; }

  // profilo usato nella ricerca: regione, comune e dimensione dell'azienda, settore proposto
  function profilo(az) {
    var p = dati(az).profilo;
    return { regione: testo(p.regione), comune: testo(p.comune), dimensione: DIMENSIONI[p.dimensione] ? p.dimensione : '', ateco: testo(az.ateco), forma: testo(az.forma),
      settore: SETTORI[p.settore] ? p.settore : (DA_SETTORE_AZIENDA[az.settore] || '') };
  }

  // ------------------------------------------------------------ ricerca
  function filtriValidi(f) {
    f = f || {};
    var livelli = (f.livelli || []).filter(function (l) { return LIVELLI[l]; });
    return { livelli: livelli.length ? livelli : Object.keys(LIVELLI), tipo: TIPI[f.tipo] ? f.tipo : '', settore: SETTORI[f.settore] ? f.settore : '', testo: testo(f.testo).slice(0, 200), soloAperti: f.soloAperti !== false };
  }
  // controlli prima di lanciare la ricerca
  function avvisiRicerca(f, p) {
    var a = []; f = filtriValidi(f);
    if (f.livelli.indexOf('comunale') >= 0 && !p.comune) a.push('Per i bandi comunali indica il comune della sede.');
    if ((f.livelli.indexOf('comunale') >= 0 || f.livelli.indexOf('regionale') >= 0) && !p.regione) a.push('Per i bandi regionali (e comunali) indica la regione della sede.');
    return a;
  }
  var SCHEMA = { type: 'object', additionalProperties: false, required: ['bandi', 'nota'], properties: {
    bandi: { type: 'array', description: 'Bandi trovati sul web, al massimo 12. Solo bandi realmente esistenti con pagina ufficiale.', items: { type: 'object', additionalProperties: false,
      required: ['titolo', 'ente', 'livello', 'tipo', 'settori', 'territorio', 'apertura', 'scadenza', 'importo_max', 'percentuale', 'beneficiari', 'requisiti', 'descrizione', 'url'],
      properties: {
        titolo: { type: 'string', description: 'Nome ufficiale del bando o della misura' }, ente: { type: 'string', description: 'Ente che lo emana' },
        livello: { type: 'string', enum: Object.keys(LIVELLI) }, tipo: { type: 'string', enum: Object.keys(TIPI) },
        settori: { type: 'array', items: { type: 'string', enum: Object.keys(SETTORI) }, description: 'Settori ammessi; vuoto se aperto a tutti' },
        territorio: { type: 'string', description: 'Territorio ammesso (comune, regione, Italia, UE)' },
        apertura: { type: 'string', description: 'Data di apertura AAAA-MM-GG, vuota se non indicata' }, scadenza: { type: 'string', description: 'Termine per la domanda AAAA-MM-GG, vuota se a sportello o non indicata' },
        importo_max: { type: 'number', description: 'Contributo massimo per impresa in euro; 0 se non indicato' }, percentuale: { type: 'number', description: 'Intensità dell\'aiuto in percentuale delle spese; 0 se non indicata' },
        beneficiari: { type: 'string', description: 'Chi può partecipare (dimensione, forma, anzianità…)' }, requisiti: { type: 'array', items: { type: 'string' }, description: 'Requisiti principali dal testo ufficiale' },
        descrizione: { type: 'string', description: 'Cosa finanzia, in due frasi' }, url: { type: 'string', description: 'Link alla pagina ufficiale del bando (ente o portale istituzionale)' } } } },
    nota: { type: 'string', description: 'Limiti della ricerca o avvertenze; vuota se nessuna' } } };

  function richiesta(f, p, oggi) {
    f = filtriValidi(f);
    var dove = f.livelli.map(function (l) { return l === 'comunale' ? 'Comune di ' + (p.comune || '(non indicato)') : l === 'regionale' ? 'Regione ' + (p.regione || '(non indicata)') : l === 'nazionale' ? 'Stato italiano (ministeri, Invitalia, Camere di commercio…)' : 'Unione europea (programmi a gestione diretta)'; });
    var r = ['Cerca sul web bandi e agevolazioni pubblici per un\'impresa italiana. Oggi è il ' + oggi + '.',
      'Livelli: ' + dove.join('; ') + '.',
      'Tipo di bando: ' + (f.tipo ? TIPI[f.tipo] : 'qualsiasi') + '.', 'Settore: ' + (f.settore ? SETTORI[f.settore] : 'qualsiasi') + '.',
      'Impresa: ' + [p.dimensione ? DIMENSIONI[p.dimensione] : '', p.forma, p.ateco ? 'ATECO ' + p.ateco : '', p.comune ? 'sede a ' + p.comune : '', p.regione].filter(Boolean).join(', ') + '.'];
    if (f.testo) r.push('Parole chiave: ' + f.testo + '.');
    r.push(f.soloAperti ? 'Solo bandi aperti o in apertura (termine non ancora scaduto).' : 'Includi anche bandi chiusi di recente.');
    r.push('Regole: riporta solo bandi esistenti, con il link alla pagina ufficiale dell\'ente; non inventare date, importi o requisiti: se non li trovi lasciali vuoti (0 per i numeri). Se non trovi bandi adatti restituisci un elenco vuoto e spiegalo nella nota.');
    return r.join('\n');
  }

  // ------------------------------------------------------------ risultati
  // controlla e normalizza un bando ricevuto dal motore AI; restituisce null se va scartato
  function normalizza(x, origine) {
    x = x || {};
    var url = testo(x.url), titolo = testo(x.titolo);
    if (!titolo || !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return null;
    var imp = num(x.importo_max !== undefined ? x.importo_max : x.importo), pc = num(x.percentuale);
    return {
      titolo: titolo.slice(0, 200), ente: testo(x.ente).slice(0, 160), livello: LIVELLI[x.livello] ? x.livello : '', tipo: TIPI[x.tipo] ? x.tipo : 'altro',
      settori: (Array.isArray(x.settori) ? x.settori : []).filter(function (s, i, a) { return SETTORI[s] && a.indexOf(s) === i; }),
      territorio: testo(x.territorio).slice(0, 120), apertura: dataIso(x.apertura), scadenza: dataIso(x.scadenza),
      importo: imp !== null && imp > 0 ? imp : null, percentuale: pc !== null && pc > 0 && pc <= 100 ? pc : null,
      beneficiari: testo(x.beneficiari).slice(0, 400), requisiti: (Array.isArray(x.requisiti) ? x.requisiti : []).map(testo).filter(Boolean).slice(0, 12).map(function (t) { return t.slice(0, 300); }),
      descrizione: testo(x.descrizione).slice(0, 600), url: url, origine: origine || 'ricerca AI'
    };
  }
  // unisce i risultati togliendo i doppioni e quelli senza fonte
  // i bandi senza link non entrano nei risultati: restano in «senzaLink» solo per poterne cercare la fonte
  function risultati(grezzi, origine) {
    var visti = {}, out = [], senzaLink = [];
    (grezzi || []).forEach(function (x) {
      var b = normalizza(x, origine);
      if (!b) { if (x && testo(x.titolo)) senzaLink.push({ titolo: testo(x.titolo).slice(0, 200), ente: testo(x.ente).slice(0, 160), cerca: 'https://www.google.com/search?q=' + encodeURIComponent('"' + testo(x.titolo).slice(0, 150) + '" ' + testo(x.ente).slice(0, 80)) }); return; }
      var k = chiave(b); if (visti[k]) return; visti[k] = 1; out.push(b);
    });
    return { bandi: out, scartati: senzaLink.length, senzaLink: senzaLink };
  }
  // suggerimenti per i guasti della ricerca con l'AI (codici del motore AI)
  var CONSIGLI = {
    quota: 'Limite del piano gratuito raggiunto: riprova più tardi, oppure attiva un secondo servizio con ricerca web (Groq è gratuito) così Timone passa da solo all\'altro.',
    chiave: 'La chiave è stata rifiutata: ricopiala in Servizi AI e premi «Prova collegamento».',
    modello: 'Il modello scelto non esiste più o non può cercare sul web: nel menu Modello scegli «Predefinito».',
    richiesta: 'Il servizio non ha accettato la ricerca web con questo modello: nel menu Modello scegli «Predefinito» o attiva un altro servizio con ricerca web.',
    rete: 'Servizio non raggiungibile dal browser: controlla la connessione. Alcune reti aziendali o estensioni bloccano i servizi AI; prova da un\'altra rete.',
    server: 'Il servizio ha un problema temporaneo: riprova tra qualche minuto.',
    rifiuto: 'Il servizio non ha prodotto una risposta: restringi i criteri (meno livelli, un settore) e riprova.',
    formato: 'Il servizio non ha restituito un elenco leggibile: restringi i criteri e riprova, oppure usa un altro servizio.',
    nessuno: 'Attiva in Servizi AI almeno un servizio con ricerca web: Google Gemini o Groq (gratuiti) oppure Claude.',
    offline: 'Sei offline: la ricerca richiede una connessione.'
  };
  function consiglio(codice) { return CONSIGLI[codice] || 'Riprova; se il problema resta usa la ricerca semplice nel web.'; }
  function statoDi(b, oggi) {
    if (b.scadenza && giorniTra(oggi, b.scadenza) < 0) return 'scaduto';
    if (b.apertura && giorniTra(oggi, b.apertura) > 0) return 'in_arrivo';
    return b.scadenza || b.apertura ? 'aperto' : 'sconosciuto';
  }
  function filtra(lista, f, oggi) {
    f = filtriValidi(f);
    var parole = f.testo.toLowerCase().split(/\s+/).filter(Boolean);
    return lista.filter(function (b) {
      var dove = (b.titolo + ' ' + b.ente + ' ' + b.descrizione).toLowerCase();
      if (b.livello && f.livelli.indexOf(b.livello) < 0) return false;
      if (f.tipo && b.tipo !== f.tipo) return false;
      if (f.settore && b.settori.length && b.settori.indexOf(f.settore) < 0) return false; // senza settori = aperto a tutti
      if (f.soloAperti && statoDi(b, oggi) === 'scaduto') return false;
      return parole.every(function (w) { return dove.indexOf(w) >= 0; });
    });
  }
  // prima le scadenze più vicine, poi i bandi senza scadenza, in fondo gli scaduti
  function ordina(lista, oggi) {
    var peso = function (b) { var s = statoDi(b, oggi); return s === 'scaduto' ? 3 : b.scadenza ? 0 : s === 'in_arrivo' ? 1 : 2; };
    return lista.slice().sort(function (a, b) { return peso(a) - peso(b) || String(a.scadenza || '9999').localeCompare(String(b.scadenza || '9999')) || a.titolo.localeCompare(b.titolo); });
  }
  // portali ufficiali dei livelli scelti
  function portali(f) { f = filtriValidi(f); return PORTALI.filter(function (x) { return f.livelli.indexOf(x.livello) >= 0; }); }

  /* Ricerca semplice sul web: per ogni livello scelto una ricerca che rispetta i criteri (tipo, settore, parole chiave,
     solo aperti) e restringe il campo al territorio o ai siti istituzionali. Si apre nel motore di ricerca scelto. */
  function ricercaWeb(f, p, oggi, motore) {
    f = filtriValidi(f); motore = MOTORI[motore] ? motore : 'google';
    var anno = Number(String(oggi).slice(0, 4)), comuni = ['bando', f.tipo ? PAROLE_TIPO[f.tipo] : '', f.settore ? PAROLE_SETTORE[f.settore] : '', f.testo,
      f.soloAperti && anno ? '(' + anno + ' OR ' + (anno + 1) + ')' : '', f.soloAperti ? PAROLE_APERTI : ''];
    var ambito = {
      comunale: p.comune ? '"Comune di ' + p.comune + '" imprese' : null,
      regionale: p.regione ? '"Regione ' + p.regione + '" imprese' : null,
      nazionale: 'imprese (site:gov.it OR site:invitalia.it OR site:camcom.it)',
      europeo: '(bando OR call) site:europa.eu'
    };
    return f.livelli.map(function (l) {
      if (!ambito[l]) return { livello: l, query: '', url: '', manca: l === 'comunale' ? 'Indica il comune della sede.' : 'Indica la regione della sede.' };
      var q = [ambito[l]].concat(comuni).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(), e = encodeURIComponent(q);
      var url = motore === 'bing' ? 'https://www.bing.com/search?q=' + e : motore === 'duckduckgo' ? 'https://duckduckgo.com/?q=' + e
        : 'https://www.google.com/search?q=' + e + (f.soloAperti ? '&tbs=qdr:y' : ''); // con Google, per i bandi aperti solo pagine dell'ultimo anno
      return { livello: l, query: q, url: url, manca: '' };
    });
  }

  // ------------------------------------------------------------ archivio
  function trova(az, b) { var k = chiave(b); return dati(az).salvati.filter(function (x) { return chiave(x) === k; })[0] || null; }
  function salva(az, b, oggi) {
    var d = dati(az); az.bandi = d;
    var gia = trova(az, b); if (gia) return gia;
    var x = Object.assign({}, b, { id: 'b' + Date.now().toString(36) + d.salvati.length, salvato: oggi, valutazione: 'valutare', note: '' });
    d.salvati.push(x); return x;
  }
  function analizza(az, oggi, param) {
    var P = Object.assign({}, PARAM, param || {}), o = { righe: [], aperti: 0, urgenti: [], potenziale: 0 };
    ordina(dati(az).salvati, oggi).forEach(function (b) {
      var x = { b: b, stato: statoDi(b, oggi), giorni: b.scadenza ? giorniTra(oggi, b.scadenza) : null };
      x.attivo = ['non_adatto', 'presentata'].indexOf(b.valutazione) < 0 && x.stato !== 'scaduto';
      if (x.attivo) { o.aperti++; if (b.importo) o.potenziale += b.importo; if (x.giorni !== null && x.giorni >= 0 && x.giorni <= P.giorniScadenza) o.urgenti.push(x); }
      o.righe.push(x);
    });
    return o;
  }
  function criticita(a, eur) {
    return a.urgenti.map(function (x) {
      return { gravita: 'giallo', titolo: 'Bando in scadenza: ' + x.b.titolo, dati: 'Mancano ' + x.giorni + ' giorni al termine (' + x.b.scadenza + ')' + (x.b.ente ? ' · ' + x.b.ente : '') + (x.b.importo ? '; contributo massimo ' + eur(x.b.importo) : '') + '.',
        causa: 'Bando salvato e non ancora presentato né scartato.', intervento: 'Verificare requisiti e documenti sulla fonte ufficiale, poi decidere se presentare la domanda o segnarlo come non adatto.',
        effetto: x.b.importo ? 'Contributo potenziale: ' + eur(x.b.importo) + ' (non certo finché non concesso).' : 'Beneficio non quantificato.' };
    });
  }
  // scheda per il registro agevolazioni del modulo Finanziamenti
  function agevolazione(b, oggi) {
    return { id: 'g' + Date.now().toString(36), nome: b.titolo, ente: b.ente, tipo: TIPO_AGEVOLAZIONE[b.tipo] || 'altro', importo: b.importo === null ? undefined : b.importo, scadenza: b.scadenza || undefined,
      stato: 'valutare', fonte: b.url, verificata: oggi, origine: 'manuale', note: 'Da Ricerca bandi: dati da verificare sulla fonte ufficiale.',
      requisiti: (b.requisiti || []).map(function (t) { return { t: t, esito: '' }; }) };
  }

  // ------------------------------------------------------------ simulazione e collaudo
  function aggiungiGiorni(iso, n) { var d = new Date(Date.parse(iso) + n * 86400000); return d.toISOString().slice(0, 10); }
  function simula(az, oggi) {
    var reg = 'Lombardia', d = { simulato: true, oggiSimulato: oggi, profilo: { regione: reg, comune: 'Comune di fantasia', dimensione: 'piccola', settore: DA_SETTORE_AZIENDA[az.settore] || 'manifattura' }, salvati: [] };
    var es = [
      { titolo: 'Bando di fantasia per la digitalizzazione delle PMI', ente: 'Regione di fantasia', livello: 'regionale', tipo: 'voucher', settori: [], scadenza: aggiungiGiorni(oggi, 12), importo_max: 10000, percentuale: 50, requisiti: ['Sede operativa in regione', 'Micro, piccola o media impresa'] },
      { titolo: 'Credito d\'imposta di fantasia per la formazione', ente: 'Ministero di fantasia', livello: 'nazionale', tipo: 'credito_imposta', settori: [], apertura: aggiungiGiorni(oggi, -60), importo_max: 0, requisiti: ['Spese di formazione documentate'] },
      { titolo: 'Programma europeo di fantasia per l\'efficienza energetica', ente: 'Agenzia europea di fantasia', livello: 'europeo', tipo: 'fondo_perduto', settori: ['energia', 'manifattura'], scadenza: aggiungiGiorni(oggi, 90), importo_max: 150000, percentuale: 60, requisiti: ['Partenariato con imprese di almeno due Stati membri'] },
      { titolo: 'Contributo comunale di fantasia per le vetrine', ente: 'Comune di fantasia', livello: 'comunale', tipo: 'fondo_perduto', settori: ['commercio'], scadenza: aggiungiGiorni(oggi, -5), importo_max: 3000 }
    ];
    es.forEach(function (x, i) { var b = normalizza(Object.assign({ url: 'https://esempio.invalid/bando-' + (i + 1), descrizione: 'Bando di fantasia: nessun bando reale.' }, x), 'simulato'); d.salvati.push(Object.assign(b, { id: 'sb-' + (i + 1), salvato: oggi, valutazione: 'valutare', note: '' })); });
    return d;
  }
  function collaudo(az) {
    var esiti = [], t = function (n, ok, dett) { esiti.push({ nome: 'Bandi · ' + n, ok: !!ok, dettaglio: dett || '' }); };
    var d = dati(az), oggi = d.oggiSimulato || new Date().toISOString().slice(0, 10), a = analizza(az, oggi);
    t('ogni bando salvato ha titolo e fonte', d.salvati.every(function (b) { return b.titolo && /^https?:\/\//.test(b.url); }), d.salvati.length + ' bandi');
    t('le date sono valide o vuote', d.salvati.every(function (b) { return (!b.scadenza || dataIso(b.scadenza)) && (!b.apertura || dataIso(b.apertura)); }));
    t('i bandi in scadenza sono segnalati', a.urgenti.every(function (x) { return x.giorni >= 0 && x.giorni <= PARAM.giorniScadenza; }) && (!d.simulato || a.urgenti.some(function (x) { return x.b.id === 'sb-1'; })), a.urgenti.length + ' in scadenza');
    t('gli scaduti non contano come aperti', a.righe.filter(function (x) { return x.stato === 'scaduto' && x.attivo; }).length === 0);
    return esiti;
  }

  return { LIVELLI: LIVELLI, TIPI: TIPI, SETTORI: SETTORI, STATI: STATI, VALUTAZIONI: VALUTAZIONI, DIMENSIONI: DIMENSIONI, REGIONI: REGIONI, PORTALI: PORTALI, SCHEMA: SCHEMA, PARAM: PARAM, MOTORI: MOTORI,
    vuoto: vuoto, dati: dati, profilo: profilo, filtriValidi: filtriValidi, avvisiRicerca: avvisiRicerca, richiesta: richiesta, normalizza: normalizza, risultati: risultati,
    statoDi: statoDi, filtra: filtra, ordina: ordina, portali: portali, ricercaWeb: ricercaWeb, consiglio: consiglio, trova: trova, salva: salva, analizza: analizza, criticita: criticita, agevolazione: agevolazione,
    simula: simula, collaudo: collaudo, dataIso: dataIso };
});
