/* Timone · modulo Finanziamenti, mutui e agevolazioni
   Funzioni pure. Per ogni finanziamento (mutuo o prestito, leasing, fido o anticipo) calcola il piano di rimborso,
   il costo complessivo e il tasso effettivo; a una data di riferimento calcola debito residuo, quota entro e oltre 12 mesi,
   rate dei 12 mesi successivi, effetto di un aumento dei tassi; confronta i piani con i debiti e gli interessi di bilancio.
   Simula estinzione anticipata e rinegoziazione e confronta le offerte di finanziamento.
   Le agevolazioni (bandi, contributi, crediti d'imposta, garanzie) sono un registro compilato dall'utente con fonte,
   data di verifica e requisiti: il modulo non cerca bandi e non ne inventa.
   Date dei finanziamenti nel formato "AAAA-MM"; tassi come frazione annua nominale (0,05 = 5%). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Finanziamenti = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var TIPI = { mutuo: 'Mutuo o prestito', leasing: 'Leasing', fido: 'Fido o anticipo' };
  var METODI = { francese: 'Rata costante (francese)', italiano: 'Quota capitale costante (italiano)', bullet: 'Capitale tutto alla scadenza' };
  var STATI_AG = { valutare: 'Da valutare', preparazione: 'Domanda in preparazione', presentata: 'Domanda presentata', concessa: 'Concessa', incassata: 'Incassata', respinta: 'Respinta o abbandonata' };
  var TIPI_AG = { fondo_perduto: 'Contributo a fondo perduto', credito_imposta: 'Credito d\'imposta', tasso_agevolato: 'Finanziamento agevolato', garanzia: 'Garanzia pubblica', altro: 'Altro' };
  var PARAM = { coperturaMinima: 1.3, giorniFonte: 90, giorniScadenza: 30 };

  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function z(x) { return num(x) || 0; }
  function ix(ym) { var p = /^(\d{4})-(\d{2})/.exec(String(ym || '')); if (!p) return null; var m = Number(p[2]); return (m >= 1 && m <= 12) ? Number(p[1]) * 12 + m - 1 : null; }
  function ymDi(i) { var m = i % 12 + 1; return Math.floor(i / 12) + '-' + (m < 10 ? '0' : '') + m; }
  function vuoto() { return { prestiti: [], agevolazioni: [] }; }
  function dati(az) { var d = az.finanziamenti || vuoto(); d.prestiti = d.prestiti || []; d.agevolazioni = d.agevolazioni || []; return d; }

  function valida(p) {
    var e = [];
    if (p.tipo === 'fido') {
      if (!(z(p.accordato) > 0)) e.push('Manca l\'importo accordato.');
      if (num(p.tasso) === null || p.tasso < 0) e.push('Manca il tasso annuo.');
      if (z(p.utilizzoMedio) > z(p.accordato) * 1.5) e.push('L\'utilizzo medio supera di molto l\'accordato: verifica i dati.');
      return e;
    }
    if (!(z(p.importo) > 0)) e.push(p.tipo === 'leasing' ? 'Manca il valore del bene.' : 'Manca l\'importo finanziato.');
    if (ix(p.inizio) === null) e.push('Manca la data di erogazione (mese e anno).');
    if (num(p.tasso) === null || p.tasso < 0) e.push('Manca il tasso annuo.');
    var per = z(p.periodicitaMesi) || 1;
    if ([1, 2, 3, 4, 6, 12].indexOf(per) < 0) e.push('Periodicità delle rate non valida.');
    if (!(z(p.durataMesi) >= per && z(p.durataMesi) <= 480)) e.push('Manca la durata in mesi.');
    else if (z(p.durataMesi) - z(p.preammortamentoMesi) < per) e.push('Il preammortamento copre tutta la durata.');
    if (p.tipo === 'leasing' && z(p.anticipo) + z(p.valoreResiduo) >= z(p.importo) && z(p.importo) > 0) e.push('Anticipo e riscatto coprono tutto il valore del bene.');
    return e;
  }

  // tasso interno per periodo di una serie di flussi (il primo positivo, i successivi negativi)
  function tirPeriodico(f) {
    if (!(f[0] > 0)) return null;
    var npv = function (r) { var t = 0; for (var k = 0; k < f.length; k++) t += f[k] / Math.pow(1 + r, k); return t; };
    var a = -0.9, b = 5; if (npv(a) > 0 || npv(b) < 0) return null;
    for (var i = 0; i < 200; i++) { var m = (a + b) / 2; if (npv(m) > 0) b = m; else a = m; }
    return (a + b) / 2;
  }

  /* Piano di rimborso. Interesse di periodo = tasso annuo nominale × mesi del periodo ÷ 12.
     Leasing: capitale finanziato = valore del bene − anticipo; il riscatto finale è l'ultima quota di capitale. */
  function piano(p) {
    var per = z(p.periodicitaMesi) || 1, i = z(p.tasso) * per / 12, nPre = Math.round(z(p.preammortamentoMesi) / per), n = Math.max(1, Math.round((z(p.durataMesi) - z(p.preammortamentoMesi)) / per));
    var leasing = p.tipo === 'leasing', C = z(p.importo) - (leasing ? z(p.anticipo) : 0), metodo = METODI[p.metodo] ? p.metodo : 'francese', VR = (leasing && metodo !== 'bullet') ? z(p.valoreResiduo) : 0;
    var spese = z(p.spesePerRata), i0 = ix(p.inizio), righe = [], res = C, k, int, cap;
    for (k = 1; k <= nPre; k++) { int = res * i; righe.push({ n: k, data: ymDi(i0 + k * per), interessi: int, capitale: 0, spese: spese, rata: int + spese, prima: res, residuo: res, pre: true }); }
    var R = metodo === 'francese' ? (i > 0 ? (C - VR * Math.pow(1 + i, -n)) * i / (1 - Math.pow(1 + i, -n)) : (C - VR) / n) : null;
    for (k = 1; k <= n; k++) {
      int = res * i;
      cap = metodo === 'francese' ? R - int : metodo === 'italiano' ? (C - VR) / n : 0;
      if (k === n) cap = res - VR;
      righe.push({ n: nPre + k, data: ymDi(i0 + (nPre + k) * per), interessi: int, capitale: cap, spese: spese, rata: int + cap + spese, prima: res, residuo: res - cap });
      res -= cap;
    }
    if (VR > 0) { righe.push({ n: nPre + n, data: ymDi(i0 + (nPre + n) * per), interessi: 0, capitale: VR, spese: 0, rata: VR, prima: VR, residuo: 0, riscatto: true }); }
    var flussi = [C - z(p.speseIniziali)]; for (k = 1; k <= nPre + n; k++) flussi.push(0);
    righe.forEach(function (r) { flussi[r.n] -= r.rata; });
    var tp = tirPeriodico(flussi), tot = function (c) { return righe.reduce(function (t, r) { return t + r[c]; }, 0); };
    var o = { righe: righe, capitale: C, anticipo: leasing ? z(p.anticipo) : 0, rataTipo: R !== null ? R + spese : null, periodi: nPre + n, per: per,
      interessi: tot('interessi'), spese: tot('spese') + z(p.speseIniziali), rimborsato: tot('capitale'), fine: righe[righe.length - 1].data,
      tassoPeriodo: i, tassoNominaleEffettivo: Math.pow(1 + i, 12 / per) - 1, tassoEffettivo: tp === null ? null : Math.pow(1 + tp, 12 / per) - 1 };
    o.costoTotale = o.interessi + o.spese;
    return o;
  }

  /* Situazione a una data di riferimento (fine del mese "rif"): conta le rate con scadenza fino a quel mese. */
  function situazione(p, pl, rif) {
    var r0 = ix(rif), i0 = ix(p.inizio), s = { residuo: 0, entro12: 0, oltre12: 0, rate12: 0, interessi12: 0, spese12: 0, interessiAnno: 0, rateAnno: 0, stress1: 0, prossima: null, stato: 'in corso' };
    if (i0 > r0) { s.stato = 'non ancora erogato'; return s; }
    var pagato = 0, anno = Math.floor(r0 / 12);
    pl.righe.forEach(function (r) {
      var k = ix(r.data);
      if (k <= r0) pagato += r.capitale;
      if (Math.floor(k / 12) === anno) { s.interessiAnno += r.interessi; s.rateAnno += r.rata; }
      if (k > r0 && k <= r0 + 12) { s.entro12 += r.capitale; s.rate12 += r.rata; s.interessi12 += r.interessi; s.spese12 += r.spese; if (!r.riscatto) s.stress1 += r.prima * 0.01 * pl.per / 12; }
      if (k > r0 && !s.prossima) s.prossima = r;
    });
    s.residuo = pl.capitale - pagato; if (Math.abs(s.residuo) < 0.005) { s.residuo = 0; s.stato = 'estinto'; }
    s.oltre12 = s.residuo - s.entro12; if (Math.abs(s.oltre12) < 0.005) s.oltre12 = 0;
    if (!p.variabile) s.stress1 = 0;
    return s;
  }

  function fido(p) {
    var u = z(p.utilizzoMedio), a = z(p.accordato);
    return { utilizzo: u, accordato: a, quota: a > 0 ? u / a : null, interessi: u * z(p.tasso), commissioni: a * z(p.commissione) + z(p.speseAnnue), costoAnno: u * z(p.tasso) + a * z(p.commissione) + z(p.speseAnnue),
      costoEffettivo: u > 0 ? (u * z(p.tasso) + a * z(p.commissione) + z(p.speseAnnue)) / u : null, stress1: p.variabile === false ? 0 : u * 0.01 };
  }

  /* Quadro complessivo alla data "rif" (AAAA-MM). bil = { n: numeri dell'esercizio, classificazione, ceOk, spOk } quando
     la data coincide con la fine di un esercizio presente: serve per i confronti con il bilancio. */
  function analizza(az, rif, bil) {
    var d = dati(az), a = { rif: rif, righe: [], offerte: [], residuo: 0, entro12: 0, oltre12: 0, rate12: 0, interessi12: 0, fidiUtilizzo: 0, fidiAccordato: 0, costoFidi: 0, leasingResiduo: 0, canoni12: 0, stress1: 0, variabile: 0, scadenze: [], avvisi: [] };
    var pesoTasso = 0, peso = 0, perAnno = {}, r0 = ix(rif);
    d.prestiti.forEach(function (p) {
      var x = { p: p, errori: valida(p) }; x.valido = !x.errori.length;
      if (p.stato === 'offerta') { if (x.valido && p.tipo !== 'fido') x.piano = piano(p); a.offerte.push(x); return; }
      a.righe.push(x); if (!x.valido) return;
      if (p.tipo === 'fido') {
        x.f = fido(p); a.fidiUtilizzo += x.f.utilizzo; a.fidiAccordato += x.f.accordato; a.costoFidi += x.f.costoAnno; a.stress1 += x.f.stress1;
        pesoTasso += x.f.utilizzo * z(p.tasso); peso += x.f.utilizzo; if (p.variabile !== false) a.variabile += x.f.utilizzo; return;
      }
      x.piano = piano(p); x.s = situazione(p, x.piano, rif);
      if (p.tipo === 'leasing') { a.leasingResiduo += x.s.residuo; a.canoni12 += x.s.rate12; a.stress1 += x.s.stress1; return; }
      a.residuo += x.s.residuo; a.entro12 += x.s.entro12; a.oltre12 += x.s.oltre12; a.rate12 += x.s.rate12; a.interessi12 += x.s.interessi12; a.stress1 += x.s.stress1;
      pesoTasso += x.s.residuo * z(p.tasso); peso += x.s.residuo; if (p.variabile) a.variabile += x.s.residuo;
      x.piano.righe.forEach(function (r) { var k = ix(r.data); if (k > r0) { var y = Math.floor((k - r0 - 1) / 12); perAnno[y] = (perAnno[y] || 0) + r.capitale; } });
    });
    a.debito = a.residuo + a.fidiUtilizzo;                       // ciò che deve comparire tra i debiti finanziari di bilancio
    a.breve = a.entro12 + a.fidiUtilizzo;
    a.servizio = a.rate12 + a.costoFidi;                         // uscite dei 12 mesi successivi per mutui e fidi (i fidi si considerano rinnovati)
    a.costoMedio = peso > 0 ? pesoTasso / peso : null;
    a.quotaVariabile = a.debito > 0 ? a.variabile / a.debito : null;
    a.quotaBreve = a.debito > 0 ? a.breve / a.debito : null;
    a.utilizzoFidi = a.fidiAccordato > 0 ? a.fidiUtilizzo / a.fidiAccordato : null;
    Object.keys(perAnno).map(Number).sort(function (x, y) { return x - y; }).forEach(function (y) { a.scadenze.push({ da: ymDi(r0 + 1 + y * 12), a: ymDi(r0 + 12 + y * 12), capitale: perAnno[y] }); });
    a.nonValidi = a.righe.filter(function (x) { return !x.valido; }).length;
    if (bil && bil.n) {
      var n = bil.n, b = a.bilancio = {}, r = M.riclassifica(n, bil.classificazione);
      if (bil.spOk) {
        b.debiti = r.debiti_finanziari; b.differenza = b.debiti - a.debito; b.breve = z(n.debiti_banche_breve); b.differenzaBreve = b.breve - a.breve; b.liquidita = z(n.liquidita); b.pfn = r.pfn;
      }
      if (bil.ceOk) {
        b.oneri = z(n.oneri_fin); b.interessiCalcolati = a.righe.reduce(function (t, x) { return t + (x.s && x.p.tipo !== 'leasing' ? x.s.interessiAnno : 0) + (x.f ? x.f.costoAnno : 0); }, 0); b.differenzaOneri = b.oneri - b.interessiCalcolati;
        b.ebitda = r.ebitda; b.copertura = a.servizio > 0 ? r.ebitda / a.servizio : null;
        if (bil.spOk) { b.roi = r.capitale_investito > 0 ? r.ebit / r.capitale_investito : null; b.pfnEbitda = r.ebitda > 0 ? r.pfn / r.ebitda : null; }
      }
    }
    // offerte: costo e sostenibilità se venissero accettate
    a.offerte.forEach(function (x) {
      if (!x.piano) return;
      var pl = x.piano, anno1 = pl.righe.filter(function (r) { return r.n * pl.per <= 12; }).reduce(function (t, r) { return t + r.rata; }, 0);
      x.rateAnno1 = anno1; x.rataMaxAnnua = (pl.rataTipo !== null ? pl.rataTipo : pl.righe[pl.righe.length - 1].rata) * 12 / pl.per;
      if (a.bilancio && a.bilancio.ebitda !== undefined && x.p.tipo !== 'leasing') x.coperturaDopo = (a.servizio + anno1) > 0 ? a.bilancio.ebitda / (a.servizio + anno1) : null;
    });
    var cl = a.offerte.filter(function (x) { return x.piano && x.piano.tassoEffettivo !== null; }).sort(function (x, y) { return x.piano.tassoEffettivo - y.piano.tassoEffettivo; });
    a.offertaMigliore = cl.length > 1 ? cl[0] : null;
    return a;
  }

  /* Estinzione anticipata alla data rif: si paga il debito residuo più la penale e si evitano interessi e spese future. */
  function estinzione(p, rif, penale) {
    var pl = piano(p), s = situazione(p, pl, rif), r0 = ix(rif), o = { residuo: s.residuo, interessiFuturi: 0, speseFuture: 0, rateRestanti: 0 };
    pl.righe.forEach(function (r) { if (ix(r.data) > r0) { o.interessiFuturi += r.interessi; o.speseFuture += r.spese; if (!r.riscatto) o.rateRestanti++; } });
    o.quotaPenale = num(penale) !== null ? penale : z(p.penaleEstinzione);
    o.penale = o.residuo * o.quotaPenale; o.esborso = o.residuo + o.penale; o.risparmio = o.interessiFuturi + o.speseFuture - o.penale;
    return o;
  }

  /* Rinegoziazione (o sostituzione con un altro finanziatore) alla data rif: il debito residuo viene rimborsato
     con nuovo tasso e nuova durata; costi = spese una tantum dell'operazione (istruttoria, penale, notaio). */
  function rinegozia(p, rif, nuovo) {
    var e = estinzione(p, rif, 0), pl0 = piano(p), s0 = situazione(p, pl0, rif);
    if (!(e.residuo > 0)) return null;
    var per = z(p.periodicitaMesi) || 1, durata = Math.max(per, Math.round(z(nuovo.durataMesi) / per) * per);
    var q = { tipo: 'mutuo', importo: e.residuo, inizio: rif, durataMesi: durata, tasso: z(nuovo.tasso), periodicitaMesi: per, metodo: p.metodo, spesePerRata: num(nuovo.spesePerRata) !== null ? nuovo.spesePerRata : z(p.spesePerRata) };
    var pl = piano(q), o = { residuo: e.residuo, costi: z(nuovo.costi), vecchio: { costo: e.interessiFuturi + e.speseFuture, rata: s0.prossima ? s0.prossima.rata : null, rate: e.rateRestanti, fine: pl0.fine },
      nuovo: { costo: pl.interessi + pl.spese + z(nuovo.costi), rata: pl.rataTipo !== null ? pl.rataTipo : pl.righe[0].rata, rate: pl.periodi, fine: pl.fine }, piano: pl };
    o.risparmio = o.vecchio.costo - o.nuovo.costo;
    o.rate12prima = s0.rate12; o.rate12dopo = pl.righe.filter(function (r) { return r.n * per <= 12; }).reduce(function (t, r) { return t + r.rata; }, 0);
    o.allunga = ix(pl.fine) > ix(pl0.fine);
    return o;
  }

  // ------------------------------------------------------------ agevolazioni
  function giorniTra(a, b) { var x = Date.parse(a), y = Date.parse(b); return (isNaN(x) || isNaN(y)) ? null : Math.round((y - x) / 86400000); }
  function analizzaAgevolazioni(az, oggi, param) {
    var P = Object.assign({}, PARAM, param || {}), d = dati(az), o = { righe: [], potenziale: 0, richiesto: 0, concesso: 0, incassato: 0, senzaFonte: 0, urgenti: [] };
    d.agevolazioni.forEach(function (g) {
      var x = { g: g, avvisi: [], giorni: g.scadenza ? giorniTra(oggi, g.scadenza) : null }, req = g.requisiti || [];
      x.requisitiNo = req.filter(function (r) { return r.esito === 'no'; }).length; x.requisitiDaVerificare = req.filter(function (r) { return r.esito !== 'si' && r.esito !== 'no'; }).length;
      var aperta = g.stato === 'valutare' || g.stato === 'preparazione' || !STATI_AG[g.stato];
      if (!String(g.fonte || '').trim()) { x.avvisi.push('Manca la fonte ufficiale: l\'agevolazione non è verificabile e non va considerata nei conti.'); o.senzaFonte++; }
      else if (aperta) { var gg = g.verificata ? giorniTra(g.verificata, oggi) : null; if (gg === null) x.avvisi.push('Manca la data dell\'ultima verifica della fonte.'); else if (gg > P.giorniFonte) x.avvisi.push('Fonte verificata ' + gg + ' giorni fa: condizioni e scadenze potrebbero essere cambiate.'); }
      if (aperta && x.requisitiNo) x.avvisi.push(x.requisitiNo + (x.requisitiNo === 1 ? ' requisito non soddisfatto' : ' requisiti non soddisfatti') + ': la domanda rischia di essere respinta.');
      if (aperta && !req.length) x.avvisi.push('Nessun requisito elencato: riporta quelli del bando e verificali uno per uno.');
      if (aperta && x.giorni !== null) { if (x.giorni < 0) x.avvisi.push('Termine per la domanda scaduto da ' + (-x.giorni) + ' giorni.'); else if (x.giorni <= P.giorniScadenza) { x.avvisi.push('Mancano ' + x.giorni + ' giorni al termine per la domanda.'); o.urgenti.push(x); } }
      x.aperta = aperta; x.contabile = !!String(g.fonte || '').trim();
      var imp = z(g.importo);
      if (x.contabile) { if (aperta && !(x.giorni !== null && x.giorni < 0)) o.potenziale += imp; else if (g.stato === 'presentata') o.richiesto += imp; else if (g.stato === 'concessa') o.concesso += imp; else if (g.stato === 'incassata') o.incassato += imp; }
      o.righe.push(x);
    });
    return o;
  }

  // ------------------------------------------------------------ criticità
  function criticita(a, ag, eur, pct) {
    var c = [], b = a.bilancio || {};
    if (b.copertura !== undefined && b.copertura !== null && a.servizio > 0 && b.copertura < PARAM.coperturaMinima) c.push({ gravita: b.copertura < 1 ? 'rosso' : 'giallo', titolo: b.copertura < 1 ? 'Il margine operativo non copre le rate dei prossimi 12 mesi' : 'Rate dei prossimi 12 mesi coperte con poco margine',
      dati: 'EBITDA ' + eur(b.ebitda) + ' contro ' + eur(a.servizio) + ' di rate e costo dei fidi nei 12 mesi successivi: copertura ' + (Math.round(b.copertura * 100) / 100).toString().replace('.', ',') + ' (soglia di prudenza ' + String(PARAM.coperturaMinima).replace('.', ',') + ').',
      causa: 'Debito elevato o concentrato nel breve periodo rispetto al margine prodotto dalla gestione.', intervento: 'Valutare allungamento delle scadenze, rinegoziazione o preammortamento; rinviare nuovi debiti; verificare con la simulazione di rinegoziazione nel modulo Finanziamenti.',
      effetto: b.copertura < 1 ? 'Mancano ' + eur(a.servizio - b.ebitda) + ' l\'anno, prima di imposte e investimenti.' : 'Margine residuo dopo le rate: ' + eur(b.ebitda - a.servizio) + ', prima di imposte e investimenti.' });
    if (b.liquidita !== undefined && a.quotaBreve !== null && a.quotaBreve > 0.5 && a.breve > b.liquidita && a.debito > 0) c.push({ gravita: 'giallo', titolo: 'Debito concentrato entro 12 mesi',
      dati: eur(a.breve) + ' su ' + eur(a.debito) + ' (' + pct(a.quotaBreve) + ') scadono o sono a revoca entro 12 mesi; liquidità disponibile ' + eur(b.liquidita) + '.',
      causa: 'Uso dei fidi a breve o di mutui in scadenza per coprire fabbisogni durevoli.', intervento: 'Consolidare parte del debito a breve su scadenze più lunghe.', effetto: 'Fabbisogno da rifinanziare: ' + eur(a.breve - b.liquidita) + '.' });
    if (a.quotaVariabile !== null && a.quotaVariabile > 0.5 && a.stress1 > 0 && b.ebitda !== undefined && a.stress1 * 2 > Math.max(0, b.ebitda) * 0.1) c.push({ gravita: 'giallo', titolo: 'Forte esposizione all\'aumento dei tassi',
      dati: pct(a.quotaVariabile) + ' del debito è a tasso variabile. Due punti di tasso in più costano ' + eur(a.stress1 * 2) + ' nei 12 mesi successivi, contro un EBITDA di ' + eur(b.ebitda) + '.',
      causa: 'Debito a tasso variabile senza copertura.', intervento: 'Valutare la conversione a tasso fisso o una copertura, confrontando il costo con il rischio.', effetto: 'Ogni punto di tasso: ' + eur(a.stress1) + ' l\'anno.' });
    if (a.costoMedio !== null && b.roi !== undefined && b.roi !== null && a.debito > 0 && a.costoMedio > b.roi) c.push({ gravita: 'giallo', titolo: 'Il debito costa più di quanto rende il capitale investito',
      dati: 'Costo medio del debito ' + pct(a.costoMedio) + ', rendimento del capitale investito (EBIT ÷ capitale investito) ' + pct(b.roi) + '.',
      causa: 'Redditività operativa bassa o tassi alti.', intervento: 'Non aumentare il debito finché la redditività non supera il suo costo; rinegoziare i finanziamenti più cari.', effetto: 'Ogni euro di debito in più riduce il rendimento per i soci.' });
    if (b.differenza !== undefined && a.righe.length && Math.abs(b.differenza) > Math.max(10000, b.debiti * 0.1)) c.push({ gravita: 'giallo', titolo: 'I finanziamenti registrati non spiegano i debiti finanziari di bilancio',
      dati: 'Debiti finanziari di bilancio ' + eur(b.debiti) + ', finanziamenti registrati ' + eur(a.debito) + ': differenza ' + eur(b.differenza) + '.',
      causa: b.differenza > 0 ? 'Finanziamenti non ancora inseriti nel modulo, oppure utilizzo dei fidi a fine anno diverso da quello medio.' : 'Piani inseriti con dati diversi da quelli reali, oppure bilancio non aggiornato.', intervento: 'Completare l\'elenco dei finanziamenti con i contratti e i piani della banca.', effetto: 'Finché la differenza resta, rate e scadenze calcolate sono incomplete.' });
    if (a.utilizzoFidi !== null && a.utilizzoFidi > 0.85) c.push({ gravita: 'giallo', titolo: 'Fidi quasi del tutto utilizzati',
      dati: 'Utilizzo medio ' + eur(a.fidiUtilizzo) + ' su ' + eur(a.fidiAccordato) + ' accordati (' + pct(a.utilizzoFidi) + ').', causa: 'Fabbisogno di cassa superiore alle linee disponibili.', intervento: 'Ridurre il fabbisogno (incassi, scorte) o chiedere l\'adeguamento delle linee prima di sconfinare.', effetto: 'Margine disponibile: ' + eur(a.fidiAccordato - a.fidiUtilizzo) + '.' });
    (ag ? ag.urgenti : []).forEach(function (x) { c.push({ gravita: 'giallo', titolo: 'Agevolazione in scadenza: ' + (x.g.nome || 'senza nome'),
      dati: 'Mancano ' + x.giorni + ' giorni al termine per la domanda' + (z(x.g.importo) ? '; beneficio atteso ' + eur(x.g.importo) : '') + '.', causa: 'Domanda non ancora presentata.', intervento: 'Verificare i requisiti sulla fonte ufficiale e decidere se presentare la domanda.', effetto: z(x.g.importo) ? 'Beneficio a rischio: ' + eur(x.g.importo) + '.' : 'Beneficio non quantificato.' }); });
    return c;
  }

  // ------------------------------------------------------------ simulazione
  function rng(seme) { var a = seme >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* Finanziamenti di fantasia coerenti con il bilancio simulato: alla fine dell'ultimo esercizio il debito residuo dei mutui è pari
     ai debiti verso banche a lungo e l'utilizzo dei fidi ai debiti verso banche a breve (il bilancio simulato non separa
     la quota dei mutui in scadenza entro 12 mesi); gli altri debiti finanziari
     diventano un finanziamento dei soci. In più un leasing (fuori bilancio), due offerte da confrontare e due agevolazioni. */
  function simula(az, seme) {
    var anni = Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }); if (!anni.length) return vuoto();
    var Y = anni[anni.length - 1], n = M.numeri(az.esercizi[Y]), r = M.riclassifica(n, az.classificazione), R = rng((Number(seme) || 1) + 4711), rif = Y + '-12';
    var L = z(n.debiti_banche_lungo), B = z(n.debiti_banche_breve), A = z(n.altri_debiti_fin), out = { simulato: true, prestiti: [], agevolazioni: [] };
    var tasso = Math.round(Math.min(0.09, Math.max(0.025, (L + B) > 0 ? z(n.oneri_fin) / (L + B) : 0.05)) * 1000) / 1000;
    function mutuo(nome, residuo, mesiFatti, durata, extra) {    // importo tale che il debito residuo alla data rif sia quello voluto
      var p = Object.assign({ id: 'sf-' + (out.prestiti.length + 1), tipo: 'mutuo', stato: 'in corso', nome: nome, importo: 1, inizio: ymDi(ix(rif) - mesiFatti), durataMesi: durata, periodicitaMesi: 1, metodo: 'francese', origine: 'simulato' }, extra);
      p.importo = residuo / situazione(p, piano(p), rif).residuo; out.prestiti.push(p);
    }
    if (L > 0) {
      mutuo('Mutuo chirografario', L * 0.6, 12 + Math.floor(R() * 24), 84, { finanziatore: 'Banca Alfa (di fantasia)', tasso: tasso, variabile: false, speseIniziali: Math.round(L * 0.004), spesePerRata: 2, penaleEstinzione: 0.01, garanzia: 'Fideiussione dei soci' });
      mutuo('Mutuo per macchinari', L * 0.4, 6 + Math.floor(R() * 18), 120, { finanziatore: 'Banca Beta (di fantasia)', tasso: Math.round((tasso + 0.008) * 1000) / 1000, variabile: true, speseIniziali: Math.round(L * 0.003), spesePerRata: 1.5, penaleEstinzione: 0, garanzia: 'Garanzia pubblica 80% (di fantasia)' });
    }
    var uso = B;
    if (uso > 0.005) out.prestiti.push({ id: 'sf-fido', tipo: 'fido', stato: 'in corso', nome: 'Fido di cassa e anticipo fatture', finanziatore: 'Banca Alfa (di fantasia)', accordato: Math.ceil(uso / (0.55 + R() * 0.4) / 5000) * 5000, utilizzoMedio: uso, tasso: Math.round((tasso + 0.025) * 1000) / 1000, commissione: 0.01, variabile: true, origine: 'simulato' });
    if (A > 0) out.prestiti.push({ id: 'sf-soci', tipo: 'mutuo', stato: 'in corso', nome: 'Finanziamento dei soci', finanziatore: 'Soci', importo: A, inizio: ymDi(ix(rif) - 36), durataMesi: 120, tasso: 0, periodicitaMesi: 12, metodo: 'bullet', variabile: false, origine: 'simulato' });
    if (az.settore === 'manifatturiera' || az.settore === 'artigiana' || az.settore === 'edile') {
      var bene = Math.max(20000, Math.round(r.ricavi * 0.04 / 1000) * 1000);
      out.prestiti.push({ id: 'sf-leasing', tipo: 'leasing', stato: 'in corso', nome: 'Leasing di un macchinario', finanziatore: 'Società di leasing (di fantasia)', importo: bene, anticipo: bene * 0.1, valoreResiduo: bene * 0.01, inizio: ymDi(ix(rif) - 14), durataMesi: 60, tasso: Math.round((tasso + 0.01) * 1000) / 1000, periodicitaMesi: 1, metodo: 'francese', variabile: false, speseIniziali: 300, spesePerRata: 3, origine: 'simulato' });
    }
    var nuovo = Math.max(30000, Math.round(r.ricavi * 0.08 / 5000) * 5000), base = { tipo: 'mutuo', stato: 'offerta', importo: nuovo, inizio: ymDi(ix(rif) + 2), durataMesi: 60, periodicitaMesi: 1, metodo: 'francese', origine: 'simulato' };
    // l'offerta A ha il tasso più basso ma spese più alte: il confronto va fatto sul tasso effettivo
    out.prestiti.push(Object.assign({ id: 'sf-off-a', nome: 'Offerta A · tasso basso, spese alte', finanziatore: 'Banca Alfa (di fantasia)', tasso: 0.045, variabile: false, speseIniziali: Math.round(nuovo * 0.03), spesePerRata: 5 }, base));
    out.prestiti.push(Object.assign({ id: 'sf-off-b', nome: 'Offerta B · tasso più alto, poche spese', finanziatore: 'Banca Beta (di fantasia)', tasso: 0.052, variabile: false, speseIniziali: Math.round(nuovo * 0.002), spesePerRata: 0 }, base));
    out.agevolazioni.push({ id: 'sa-1', nome: 'Bando di fantasia per la digitalizzazione', ente: 'Ente di fantasia', tipo: 'fondo_perduto', importo: Math.round(nuovo * 0.2), scadenza: (Y + 1) + '-03-20', stato: 'valutare', fonte: 'Dato simulato: nessun bando reale', verificata: (Y + 1) + '-03-01', origine: 'simulato',
      requisiti: [{ t: 'Sede operativa nel territorio previsto', esito: 'si' }, { t: 'Regolarità contributiva (DURC)', esito: 'si' }, { t: 'Spesa minima ammissibile', esito: '?' }] });
    out.agevolazioni.push({ id: 'sa-2', nome: 'Credito d\'imposta di fantasia per beni strumentali', ente: 'Ente di fantasia', tipo: 'credito_imposta', importo: Math.round(nuovo * 0.1), stato: 'concessa', fonte: 'Dato simulato: nessuna norma reale', verificata: Y + '-11-15', origine: 'simulato', requisiti: [{ t: 'Bene nuovo e interconnesso', esito: 'si' }] });
    out.oggiSimulato = (Y + 1) + '-03-05';
    return out;
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az);
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    var piani = d.prestiti.filter(function (p) { return p.tipo !== 'fido' && !valida(p).length; }).map(function (p) { return { p: p, pl: piano(p) }; });
    if (!piani.length && !d.prestiti.length) return esiti;
    var ogni = function (f) { return piani.every(function (x) { return f(x.p, x.pl); }); }, tol = function (p) { return Math.max(0.01, z(p.importo) * 1e-9); };
    t('finanziamenti: le quote capitale rimborsano esattamente il capitale finanziato', ogni(function (p, pl) { return Math.abs(pl.rimborsato - pl.capitale) < tol(p) && Math.abs(pl.righe[pl.righe.length - 1].residuo) < tol(p); }), piani.length + ' piani');
    t('finanziamenti: ogni rata = interessi + capitale + spese', ogni(function (p, pl) { return pl.righe.every(function (r) { return Math.abs(r.rata - r.interessi - r.capitale - r.spese) < 1e-6; }); }), '');
    t('finanziamenti: interessi di ogni rata = debito residuo × tasso di periodo', ogni(function (p, pl) { return pl.righe.every(function (r) { return r.riscatto || Math.abs(r.interessi - r.prima * pl.tassoPeriodo) < 1e-6; }); }), '');
    t('finanziamenti: il debito residuo non aumenta mai', ogni(function (p, pl) { return pl.righe.every(function (r) { return r.residuo <= r.prima + 1e-6 && r.residuo > -tol(p); }); }), '');
    t('finanziamenti: con rata costante le rate sono tutte uguali', ogni(function (p, pl) { return (p.metodo || 'francese') !== 'francese' || pl.righe.every(function (r) { return r.pre || r.riscatto || Math.abs(r.rata - pl.rataTipo) < tol(p) * 10 + 1e-6; }); }), '');
    t('finanziamenti: il tasso effettivo non è mai inferiore al tasso nominale', ogni(function (p, pl) { return pl.tassoEffettivo === null || pl.tassoEffettivo >= pl.tassoNominaleEffettivo - 1e-7; }), '');
    var anni = Object.keys(az.esercizi || {}).map(Number).sort(function (a, b) { return a - b; }), Y = anni[anni.length - 1], rif = Y ? Y + '-12' : ymDi(ix('2026-01'));
    t('finanziamenti: quota entro 12 mesi + quota oltre = debito residuo', ogni(function (p, pl) { var s = situazione(p, pl, rif); return Math.abs(s.entro12 + s.oltre12 - s.residuo) < 1e-6 && s.entro12 >= -1e-6 && s.oltre12 >= -1e-6; }), 'al ' + rif);
    t('finanziamenti: rinegoziare alle stesse condizioni non cambia il costo', ogni(function (p, pl) {
      if (p.tipo === 'leasing' || p.stato === 'offerta' || p.metodo === 'italiano' || z(p.preammortamentoMesi)) return true; var s = situazione(p, pl, rif); if (!(s.residuo > 0) || s.stato !== 'in corso') return true;
      var rn = rinegozia(p, rif, { tasso: p.tasso, durataMesi: ix(pl.fine) - ix(rif), costi: 0 }); return Math.abs(rn.risparmio) < tol(p) * 100 + 0.01; }), '');
    t('finanziamenti: estinguere senza penale fa risparmiare gli interessi futuri', ogni(function (p) { if (p.stato === 'offerta') return true; var e = estinzione(p, rif, 0); return e.risparmio >= -1e-6 && Math.abs(e.risparmio - e.interessiFuturi - e.speseFuture) < 1e-6; }), '');
    if (d.simulato && Y) {
      var n = M.numeri(az.esercizi[Y]), a = analizza(az, rif, { n: n, classificazione: az.classificazione, ceOk: true, spOk: true }), b = a.bilancio;
      t('finanziamenti simulati: mutui e fidi danno i debiti finanziari di bilancio', Math.abs(b.differenza) < 1, 'bilancio ' + Math.round(b.debiti) + ', piani e fidi ' + Math.round(a.debito));
      t('finanziamenti simulati: i fidi danno i debiti bancari a breve, i mutui quelli a lungo', Math.abs(a.fidiUtilizzo - b.breve) < 1 && a.entro12 > 0 === (z(n.debiti_banche_lungo) > 0), 'fidi ' + Math.round(a.fidiUtilizzo) + ', mutui ' + Math.round(a.residuo));
      t('finanziamenti simulati: il leasing resta fuori dai debiti di bilancio', a.righe.every(function (x) { return x.p.tipo !== 'leasing' || x.s.residuo > 0; }) && Math.abs(a.debito + a.leasingResiduo - b.debiti - a.leasingResiduo) < 1, 'leasing ' + Math.round(a.leasingResiduo));
      var oa = a.offerte.filter(function (x) { return x.p.id === 'sf-off-a'; })[0], ob = a.offerte.filter(function (x) { return x.p.id === 'sf-off-b'; })[0];
      t('finanziamenti simulati: l\'offerta con il tasso più basso non è la più conveniente', oa && ob && oa.p.tasso < ob.p.tasso && oa.piano.tassoEffettivo > ob.piano.tassoEffettivo && a.offertaMigliore === ob, oa && ob ? 'effettivo A ' + (oa.piano.tassoEffettivo * 100).toFixed(2) + '%, B ' + (ob.piano.tassoEffettivo * 100).toFixed(2) + '%' : '');
      var ag = analizzaAgevolazioni(az, d.oggiSimulato);
      t('agevolazioni simulate: la domanda in scadenza viene segnalata', ag.urgenti.length === 1 && ag.urgenti[0].giorni === 15 && ag.concesso > 0 && ag.potenziale > 0, ag.urgenti.length + ' in scadenza');
    }
    return esiti;
  }

  return { TIPI: TIPI, METODI: METODI, STATI_AG: STATI_AG, TIPI_AG: TIPI_AG, PARAM: PARAM, ix: ix, ymDi: ymDi, vuoto: vuoto, dati: dati, valida: valida, piano: piano, situazione: situazione, fido: fido,
    analizza: analizza, estinzione: estinzione, rinegozia: rinegozia, analizzaAgevolazioni: analizzaAgevolazioni, criticita: criticita, simula: simula, collaudo: collaudo };
});
