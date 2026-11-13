/* Timone · modulo Sviluppo commerciale e clienti
   Funzioni pure. Dalle vendite per cliente e per mese (importate o inserite) calcola: ricavi, margine e quota di ogni
   cliente, classi ABC, concentrazione, clienti nuovi, persi, in calo e fermi, mantenimento dei ricavi, stagionalità,
   segmenti più forti (settore, zona, famiglia di prodotto), tempi di pagamento e loro costo, confronto con i ricavi di
   bilancio. Gestisce le trattative in corso (valore, probabilità, fase, chiusura prevista, fonte del contatto) e simula
   la perdita di un cliente e l'effetto di uno sconto.
   Il modulo non cerca clienti su fonti esterne e non inventa nominativi: indica in quali segmenti l'azienda rende
   di più e tiene il registro dei contatti con la loro fonte. Periodi nel formato "AAAA-MM". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Commerciale = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var FASI = { contatto: 'Primo contatto', qualificata: 'Interesse verificato', offerta: 'Offerta inviata', negoziazione: 'In negoziazione', vinta: 'Vinta', persa: 'Persa' };
  var PROB_FASE = { contatto: 0.1, qualificata: 0.25, offerta: 0.5, negoziazione: 0.75 };
  var PARAM = { caloForte: 0.3, crescita: 0.2, mesiFermo: 3, top1: 0.3, top1Grave: 0.5, top3: 0.6, ritardo: 30, costoCapitale: 0.06, minChiuse: 5 };

  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function z(x) { return num(x) || 0; }
  function norm(s) { return String(s === null || s === undefined ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function ix(ym) { var p = /^(\d{4})-(\d{2})/.exec(String(ym || '')); if (!p) return null; var m = Number(p[2]); return (m >= 1 && m <= 12) ? Number(p[1]) * 12 + m - 1 : null; }
  function ymDi(i) { var m = i % 12 + 1; return Math.floor(i / 12) + '-' + (m < 10 ? '0' : '') + m; }
  function vuoto() { return { vendite: [], clienti: [], trattative: [] }; }
  function dati(az) { var d = az.commerciale || vuoto(); d.vendite = d.vendite || []; d.clienti = d.clienti || []; d.trattative = d.trattative || []; return d; }
  function parametri(d) { return Object.assign({}, PARAM, (d && d.param) || {}); }
  function anniDi(az) { var s = {}; dati(az).vendite.forEach(function (v) { var k = ix(v.periodo); if (k !== null) s[Math.floor(k / 12)] = 1; }); return Object.keys(s).map(Number).sort(function (a, b) { return a - b; }); }

  /* Analisi di un anno. bil = { n, classificazione, ceOk } se l'esercizio è presente (confronto con il bilancio). */
  function analizza(az, anno, bil) {
    var d = dati(az), P = parametri(d), ana = {}, cl = {}, a = { anno: anno, P: P, ricavi: 0, costo: 0, ricaviConCosto: 0, ordini: 0, mesi: [], mesiPrec: [], avvisi: [] };
    d.clienti.forEach(function (c) { ana[norm(c.nome)] = c; });
    for (var m = 0; m < 12; m++) { a.mesi.push(0); a.mesiPrec.push(0); }
    var mesiConDati = {}, precPresente = false, scartate = 0;
    d.vendite.forEach(function (v) {
      var k = ix(v.periodo), key = norm(v.cliente), r = num(v.ricavi);
      if (k === null || !key || r === null) { scartate++; return; }
      var y = Math.floor(k / 12), mm = k % 12; if (y !== anno && y !== anno - 1) return;
      var c = cl[key] = cl[key] || { key: key, nome: String(v.cliente).trim(), ricavi: 0, costo: 0, senzaCosto: 0, ordini: 0, mesi: {}, ricaviPrec: 0, mesiPrec: {}, famiglie: {}, ultimo: null, ana: ana[key] || {} };
      if (y === anno) {
        c.ricavi += r; a.mesi[mm] += r; mesiConDati[mm] = 1; if (r > 0) { c.mesi[mm] = 1; c.ultimo = c.ultimo === null ? mm : Math.max(c.ultimo, mm); }
        if (num(v.costo) !== null) c.costo += v.costo; else c.senzaCosto += r;
        c.ordini += z(v.ordini); var f = String(v.famiglia || '').trim() || 'Non indicata'; c.famiglie[f] = c.famiglie[f] || { ricavi: 0, costo: 0, senzaCosto: 0 }; c.famiglie[f].ricavi += r; if (num(v.costo) !== null) c.famiglie[f].costo += v.costo; else c.famiglie[f].senzaCosto += r;
      } else { c.ricaviPrec += r; a.mesiPrec[mm] += r; precPresente = true; if (r > 0) c.mesiPrec[mm] = 1; }
    });
    a.scartate = scartate; a.precPresente = precPresente; a.mensile = Object.keys(mesiConDati).length >= 6;
    var tutti = Object.keys(cl).map(function (k) { return cl[k]; });
    a.clienti = tutti.filter(function (c) { return c.ricavi > 0; }).sort(function (x, y) { return y.ricavi - x.ricavi; });
    a.persi = tutti.filter(function (c) { return !(c.ricavi > 0) && c.ricaviPrec > 0; }).sort(function (x, y) { return y.ricaviPrec - x.ricaviPrec; });
    a.ricavi = a.clienti.reduce(function (t, c) { return t + c.ricavi; }, 0);
    a.ricaviPrec = tutti.reduce(function (t, c) { return t + c.ricaviPrec; }, 0);
    var cum = 0, ultimoMese = Math.max.apply(null, Object.keys(mesiConDati).map(Number).concat([-1]));
    a.clienti.forEach(function (c) {
      c.quota = a.ricavi > 0 ? c.ricavi / a.ricavi : 0; cum += c.quota; c.abc = cum - c.quota < 0.8 ? 'A' : cum - c.quota < 0.95 ? 'B' : 'C';
      c.margine = c.senzaCosto > 0 ? null : c.ricavi - c.costo; c.marginePct = c.margine === null || !(c.ricavi > 0) ? null : c.margine / c.ricavi;
      if (c.margine !== null) { a.costo += c.costo; a.ricaviConCosto += c.ricavi; }
      a.ordini += c.ordini; c.ordineMedio = c.ordini > 0 ? c.ricavi / c.ordini : null; c.mesiAttivi = Object.keys(c.mesi).length;
      c.variazione = c.ricaviPrec > 0 ? c.ricavi / c.ricaviPrec - 1 : null;
      c.stato = !precPresente ? 'attivo' : !(c.ricaviPrec > 0) ? 'nuovo' : c.variazione <= -P.caloForte ? 'in calo' : c.variazione >= P.crescita ? 'in crescita' : 'stabile';
      c.mesiFermo = (a.mensile && c.ultimo !== null) ? ultimoMese - c.ultimo : 0;
      c.fermo = a.mensile && c.mesiAttivi >= 4 && c.mesiFermo >= P.mesiFermo;         // comprava con regolarità e ha smesso
      c.rischio = c.fermo ? 'fermo da ' + c.mesiFermo + ' mesi' : c.stato === 'in calo' ? 'ricavi in calo del ' + Math.round(-c.variazione * 100) + '%' : null;
    });
    a.margine = a.ricaviConCosto > 0 ? a.ricaviConCosto - a.costo : null; a.marginePct = a.margine === null ? null : a.margine / a.ricaviConCosto; a.coperturaCosti = a.ricavi > 0 ? a.ricaviConCosto / a.ricavi : 0;
    a.top1 = a.clienti.length ? a.clienti[0].quota : null; a.top3 = a.clienti.slice(0, 3).reduce(function (t, c) { return t + c.quota; }, 0);
    a.hhi = a.clienti.reduce(function (t, c) { return t + c.quota * c.quota; }, 0);
    // movimenti rispetto all'anno precedente
    if (precPresente) {
      var mant = a.clienti.filter(function (c) { return c.ricaviPrec > 0; }), nuovi = a.clienti.filter(function (c) { return !(c.ricaviPrec > 0); }), nPrec = mant.length + a.persi.length;
      a.mov = { mantenuti: mant.length, nuovi: nuovi.length, persi: a.persi.length, clientiPrec: nPrec, ricaviMantenuti: mant.reduce(function (t, c) { return t + c.ricavi; }, 0), ricaviNuovi: nuovi.reduce(function (t, c) { return t + c.ricavi; }, 0), ricaviPersi: a.persi.reduce(function (t, c) { return t + c.ricaviPrec; }, 0) };
      a.mov.mantenimentoClienti = nPrec > 0 ? mant.length / nPrec : null; a.mov.mantenimentoRicavi = a.ricaviPrec > 0 ? a.mov.ricaviMantenuti / a.ricaviPrec : null; a.mov.variazione = a.ricaviPrec > 0 ? a.ricavi / a.ricaviPrec - 1 : null;
    }
    a.aRischio = a.clienti.filter(function (c) { return c.rischio; }); a.ricaviARischio = a.aRischio.reduce(function (t, c) { return t + c.ricavi; }, 0);
    a.inPerdita = a.clienti.filter(function (c) { return c.margine !== null && c.margine < 0; });
    // segmenti
    function segmenti(chiave) {
      var s = {}; a.clienti.forEach(function (c) { var k = String(chiave(c) || '').trim() || 'Non indicato', x = s[k] = s[k] || { nome: k, ricavi: 0, margine: 0, ricaviConCosto: 0, clienti: 0 }; x.ricavi += c.ricavi; x.clienti++; if (c.margine !== null) { x.margine += c.margine; x.ricaviConCosto += c.ricavi; } });
      return Object.keys(s).map(function (k) { var x = s[k]; x.quota = a.ricavi > 0 ? x.ricavi / a.ricavi : 0; x.marginePct = x.ricaviConCosto > 0 ? x.margine / x.ricaviConCosto : null; x.ricavoMedio = x.ricavi / x.clienti; if (!x.ricaviConCosto) x.margine = null; return x; }).sort(function (x, y) { return y.ricavi - x.ricavi; });
    }
    a.settori = segmenti(function (c) { return c.ana.settore; }); a.zone = segmenti(function (c) { return c.ana.zona; });
    var fam = {}; a.clienti.forEach(function (c) { Object.keys(c.famiglie).forEach(function (k) { var x = fam[k] = fam[k] || { nome: k, ricavi: 0, costo: 0, senzaCosto: 0 }; x.ricavi += c.famiglie[k].ricavi; x.costo += c.famiglie[k].costo; x.senzaCosto += c.famiglie[k].senzaCosto; }); });
    a.famiglie = Object.keys(fam).map(function (k) { var x = fam[k]; x.quota = a.ricavi > 0 ? x.ricavi / a.ricavi : 0; x.margine = x.senzaCosto > 0 ? null : x.ricavi - x.costo; x.marginePct = x.margine === null || !(x.ricavi > 0) ? null : x.margine / x.ricavi; return x; }).sort(function (x, y) { return y.ricavi - x.ricavi; });
    // segmenti forti: almeno due clienti, margine sopra la media (oppure, senza costi, ricavo medio per cliente sopra la media)
    var medio = a.clienti.length ? a.ricavi / a.clienti.length : 0;
    a.settoriForti = a.settori.filter(function (s) { return s.nome !== 'Non indicato' && s.clienti >= 2 && (a.marginePct !== null && s.marginePct !== null ? s.marginePct > a.marginePct : s.ricavoMedio > medio); }).map(function (s) { return s.nome; });
    // pagamenti
    var pg = { righe: [], ricavi: 0, pesoEff: 0, pesoConc: 0, costoRitardo: 0, creditoStimato: 0 };
    a.clienti.forEach(function (c) { var e = num(c.ana.ggEffettivi), k = num(c.ana.ggConcordati); if (e === null) return; var rit = k === null ? null : e - k;
      pg.righe.push({ c: c, effettivi: e, concordati: k, ritardo: rit, credito: c.ricavi * e / 365, costo: rit !== null && rit > 0 ? c.ricavi * rit / 365 * P.costoCapitale : 0 });
      pg.ricavi += c.ricavi; pg.pesoEff += c.ricavi * e; pg.creditoStimato += c.ricavi * e / 365; if (k !== null) { pg.pesoConc += c.ricavi * k; pg.ricaviConc = (pg.ricaviConc || 0) + c.ricavi; pg.pesoEffConc = (pg.pesoEffConc || 0) + c.ricavi * e; if (rit > 0) pg.costoRitardo += c.ricavi * rit / 365 * P.costoCapitale; } });
    if (pg.righe.length) { pg.giorniMedi = pg.pesoEff / pg.ricavi; pg.ritardoMedio = pg.ricaviConc ? (pg.pesoEffConc - pg.pesoConc) / pg.ricaviConc : null; pg.copertura = a.ricavi > 0 ? pg.ricavi / a.ricavi : 0; pg.righe.sort(function (x, y) { return (y.ritardo || 0) * y.c.ricavi - (x.ritardo || 0) * x.c.ricavi; }); a.pagamenti = pg; }
    // bilancio
    if (bil && bil.n && bil.n.ricavi !== undefined) {
      a.bilancio = { ricavi: bil.n.ricavi, differenza: bil.n.ricavi - a.ricavi, quota: bil.n.ricavi ? a.ricavi / bil.n.ricavi : null };
      if (bil.ceOk) { var r = M.riclassifica(bil.n, bil.classificazione); a.bilancio.ebitda = r.ebitda; a.bilancio.mcPct = r.mc_pct; }
    }
    if (scartate) a.avvisi.push(scartate + ' righe di vendita senza cliente, periodo o importo: non conteggiate.');
    if (a.clienti.length && a.coperturaCosti < 1) a.avvisi.push(a.coperturaCosti > 0 ? 'Il costo diretto è indicato solo per il ' + Math.round(a.coperturaCosti * 100) + '% dei ricavi: i margini riguardano solo quella parte.' : 'Nessun costo diretto indicato: i margini per cliente non sono calcolabili.');
    if (a.clienti.length && !a.mensile) a.avvisi.push('Dati non mensili: stagionalità e clienti fermi non sono calcolabili.');
    return a;
  }

  /* Cosa succede se si perde un cliente: ricavi e margine che vengono a mancare. Se il costo diretto del cliente non
     è noto il margine è stimato con il margine di contribuzione medio di bilancio (e segnalato). */
  function perdita(a, key) {
    var c = a.clienti.filter(function (x) { return x.key === key; })[0]; if (!c) return null;
    var b = a.bilancio || {}, o = { cliente: c, ricavi: c.ricavi, quota: c.quota, stimato: false };
    if (c.margine !== null) o.margine = c.margine; else if (num(b.mcPct) !== null) { o.margine = c.ricavi * b.mcPct; o.stimato = true; } else o.margine = null;
    if (o.margine !== null && num(b.ebitda) !== null) { o.ebitda = b.ebitda; o.ebitdaDopo = b.ebitda - o.margine; }
    o.top1Dopo = a.clienti.length > 1 ? (a.clienti[0] === c ? a.clienti[1].ricavi : a.clienti[0].ricavi) / (a.ricavi - c.ricavi) : null;
    return o;
  }
  /* Sconto: quanto volume in più serve per ottenere lo stesso margine. margine e sconto come frazioni del prezzo. */
  function sconto(marginePct, s) {
    if (num(marginePct) === null || num(s) === null || !(s > 0) || !(marginePct > 0)) return null;
    if (s >= marginePct) return { possibile: false, margineDopo: marginePct - s };
    return { possibile: true, margineDopo: marginePct - s, volume: s / (marginePct - s) };
  }

  // ------------------------------------------------------------ trattative
  function analizzaTrattative(az, oggi, settoriForti) {
    var d = dati(az), P = parametri(d), o = { righe: [], aperte: 0, valore: 0, ponderato: 0, fasi: {}, mesi: {}, scadute: 0, senzaFonte: 0, vinte: 0, perse: 0, valoreVinte: 0, valorePerse: 0, nuovi: 0 }, k0 = ix(oggi);
    Object.keys(FASI).forEach(function (f) { o.fasi[f] = { n: 0, valore: 0, ponderato: 0 }; });
    d.trattative.forEach(function (t) {
      var f = FASI[t.fase] ? t.fase : 'contatto', v = z(t.valore), x = { t: t, fase: f, valore: v, aperta: f !== 'vinta' && f !== 'persa', avvisi: [] };
      o.fasi[f].n++; o.fasi[f].valore += v;
      if (f === 'vinta') { o.vinte++; o.valoreVinte += v; } else if (f === 'persa') { o.perse++; o.valorePerse += v; }
      else {
        x.probPredefinita = num(t.probabilita) === null; x.prob = x.probPredefinita ? PROB_FASE[f] : Math.max(0, Math.min(1, t.probabilita)); x.ponderato = v * x.prob;
        o.aperte++; o.valore += v; o.ponderato += x.ponderato; o.fasi[f].ponderato += x.ponderato; if (t.nuovo !== false) o.nuovi++;
        var k = ix(t.chiusura); if (k !== null) { o.mesi[t.chiusura.slice(0, 7)] = (o.mesi[t.chiusura.slice(0, 7)] || 0) + x.ponderato; if (k0 !== null && k < k0) { x.scaduta = true; o.scadute++; x.avvisi.push('La chiusura prevista è già passata: aggiorna la data o chiudi la trattativa.'); } }
        else x.avvisi.push('Manca la data di chiusura prevista.');
        if (!(v > 0)) x.avvisi.push('Manca il valore stimato.');
        if (!String(t.fonte || '').trim()) { o.senzaFonte++; x.avvisi.push('Manca la fonte del contatto.'); }
        x.segmentoForte = !!(t.settore && settoriForti && settoriForti.indexOf(String(t.settore).trim()) >= 0);
      }
      o.righe.push(x);
    });
    var chiuse = o.vinte + o.perse; o.chiuse = chiuse;
    o.successo = chiuse >= P.minChiuse ? o.vinte / chiuse : null; o.successoValore = chiuse >= P.minChiuse && (o.valoreVinte + o.valorePerse) > 0 ? o.valoreVinte / (o.valoreVinte + o.valorePerse) : null;
    o.perMese = Object.keys(o.mesi).sort().map(function (m) { return { mese: m, ponderato: o.mesi[m] }; });
    return o;
  }

  // ------------------------------------------------------------ criticità
  function criticita(a, tr, eur, pct) {
    var c = [], P = a.P, b = a.bilancio || {};
    if (!a.clienti.length) return c;
    if (a.clienti.length > 1 && a.top1 >= P.top1) { var c0 = a.clienti[0], pe = perdita(a, c0.key);
      c.push({ gravita: a.top1 >= P.top1Grave ? 'rosso' : 'giallo', titolo: 'Dipendenza dal primo cliente', dati: c0.nome + ' vale ' + eur(c0.ricavi) + ', il ' + pct(c0.quota) + ' dei ricavi ' + a.anno + '; i primi tre clienti il ' + pct(a.top3) + '.',
        causa: 'Portafoglio clienti poco diversificato.', intervento: 'Sviluppare altri clienti nei segmenti più redditizi; verificare durata e condizioni del rapporto con il cliente principale.', effetto: pe && pe.margine !== null ? 'Se venisse a mancare: ' + eur(pe.margine) + ' di margine in meno' + (pe.stimato ? ' (stima con il margine medio di bilancio)' : '') + '.' : 'Ricavi esposti: ' + eur(c0.ricavi) + '.' }); }
    else if (a.clienti.length > 3 && a.top3 >= P.top3) c.push({ gravita: 'giallo', titolo: 'Ricavi concentrati su tre clienti', dati: 'I primi tre clienti valgono il ' + pct(a.top3) + ' dei ricavi ' + a.anno + '.', causa: 'Portafoglio clienti poco diversificato.', intervento: 'Ampliare la base clienti nei segmenti più redditizi.', effetto: 'Ricavi esposti: ' + eur(a.top3 * a.ricavi) + '.' });
    if (a.aRischio.length && a.ricaviARischio >= a.ricavi * 0.05) c.push({ gravita: a.ricaviARischio >= a.ricavi * 0.2 ? 'rosso' : 'giallo', titolo: 'Clienti a rischio di perdita', dati: a.aRischio.length + (a.aRischio.length === 1 ? ' cliente' : ' clienti') + ' in forte calo o senza acquisti recenti, per ' + eur(a.ricaviARischio) + ' di ricavi ' + a.anno + ' (' + pct(a.ricaviARischio / a.ricavi) + '): ' + a.aRischio.slice(0, 3).map(function (x) { return x.nome + ' (' + x.rischio + ')'; }).join('; ') + '.',
      causa: 'Da verificare con il cliente: prezzo, servizio, concorrenza, calo della sua attività.', intervento: 'Contattare questi clienti in ordine di ricavi e capire la causa prima di perderli.', effetto: 'Ricavi a rischio: ' + eur(a.ricaviARischio) + '.' });
    if (a.mov && a.mov.ricaviPersi >= a.ricaviPrec * 0.1 && a.mov.persi > 0) c.push({ gravita: 'giallo', titolo: 'Clienti persi rispetto all\'anno precedente', dati: a.mov.persi + (a.mov.persi === 1 ? ' cliente attivo' : ' clienti attivi') + ' nel ' + (a.anno - 1) + ' non ha più comprato nel ' + a.anno + ': valevano ' + eur(a.mov.ricaviPersi) + ' (' + pct(a.mov.ricaviPersi / a.ricaviPrec) + ' dei ricavi di allora). Ricavi da clienti nuovi: ' + eur(a.mov.ricaviNuovi) + '.',
      causa: 'Da verificare caso per caso.', intervento: 'Ricontattare i clienti persi di maggior valore; capire se la causa è comune.', effetto: 'Ricavi non rinnovati: ' + eur(a.mov.ricaviPersi) + '.' });
    if (a.inPerdita.length) { var tot = a.inPerdita.reduce(function (t, x) { return t + x.margine; }, 0);
      c.push({ gravita: 'giallo', titolo: 'Clienti serviti sotto costo', dati: a.inPerdita.length + (a.inPerdita.length === 1 ? ' cliente ha' : ' clienti hanno') + ' ricavi inferiori ai costi diretti: ' + a.inPerdita.slice(0, 3).map(function (x) { return x.nome + ' (' + eur(x.margine) + ')'; }).join('; ') + '.', causa: 'Prezzi troppo bassi, sconti o costi di servizio elevati per questi clienti.', intervento: 'Rivedere prezzi e condizioni; valutare se il rapporto ha altre ragioni per essere mantenuto.', effetto: 'Margine negativo complessivo: ' + eur(tot) + '.' }); }
    if (a.pagamenti && a.pagamenti.ritardoMedio !== null && a.pagamenti.ritardoMedio >= P.ritardo) c.push({ gravita: 'giallo', titolo: 'Clienti che pagano in ritardo', dati: 'Ritardo medio ' + Math.round(a.pagamenti.ritardoMedio) + ' giorni oltre i termini concordati (media pesata sui ricavi dei clienti con dati di pagamento).', causa: 'Solleciti tardivi o condizioni non fatte rispettare.', intervento: 'Solleciti sistematici a partire dai clienti con più ricavi e più ritardo; rivedere i termini con chi ritarda sempre.', effetto: 'Costo finanziario stimato del ritardo: ' + eur(a.pagamenti.costoRitardo) + ' l\'anno (al ' + pct(P.costoCapitale) + ').' });
    if (b.differenza !== undefined && b.ricavi > 0 && Math.abs(b.differenza) > b.ricavi * 0.05) c.push({ gravita: 'giallo', titolo: 'Le vendite per cliente non coincidono con i ricavi di bilancio', dati: 'Vendite registrate ' + eur(a.ricavi) + ', ricavi di bilancio ' + eur(b.ricavi) + ': differenza ' + eur(b.differenza) + '.', causa: 'Vendite non importate per intero, periodi mancanti, oppure importi con IVA.', intervento: 'Completare l\'importazione delle vendite (imponibile, senza IVA).', effetto: 'Quote e concentrazione sono calcolate su dati parziali.' });
    if (tr && tr.scadute >= 3) c.push({ gravita: 'giallo', titolo: 'Trattative non aggiornate', dati: tr.scadute + ' trattative aperte hanno una chiusura prevista già passata.', causa: 'Elenco delle trattative non aggiornato.', intervento: 'Aggiornare date e fasi o chiudere le trattative ferme: la previsione ponderata ne dipende.', effetto: 'Previsione delle vendite poco affidabile.' });
    return c;
  }

  // ------------------------------------------------------------ importazione
  var COLONNE = { cliente: ['cliente', 'ragione sociale', 'nome cliente', 'denominazione'], periodo: ['periodo', 'mese', 'data', 'data fattura', 'data documento'], anno: ['anno'], ricavi: ['ricavi', 'fatturato', 'importo', 'imponibile', 'vendite', 'totale'], costo: ['costo', 'costo diretto', 'costi diretti', 'costo del venduto'],
    ordini: ['ordini', 'numero ordini', 'n ordini', 'documenti', 'fatture'], famiglia: ['famiglia', 'prodotto', 'categoria', 'linea', 'famiglia di prodotto'], settore: ['settore', 'settore cliente'], zona: ['zona', 'provincia', 'regione', 'area'] };
  var MESI_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  function periodo(x, anno) {
    if (typeof x === 'number' && x > 20000 && x < 80000) return new Date(Math.round((x - 25569) * 86400000)).toISOString().slice(0, 7);   // data di Excel
    var s = String(x === null || x === undefined ? '' : x).trim().toLowerCase(), m, y = Number(anno), dueC = function (q) { return ('0' + q).slice(-2); };
    if ((m = /^(\d{4})[-\/.](\d{1,2})/.exec(s)) && m[2] >= 1 && m[2] <= 12) return m[1] + '-' + dueC(m[2]);
    if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(s)) && m[2] >= 1 && m[2] <= 12) return m[3] + '-' + dueC(m[2]);
    if ((m = /^(\d{1,2})[-\/.](\d{4})$/.exec(s)) && m[1] >= 1 && m[1] <= 12) return m[2] + '-' + dueC(m[1]);
    var im = MESI_IT.indexOf(s.slice(0, 3)), ya = (m = /(\d{4})/.exec(s)) ? Number(m[1]) : y;
    if (im >= 0 && ya > 1990) return ya + '-' + dueC(im + 1);
    if ((m = /^(\d{1,2})$/.exec(s)) && m[1] >= 1 && m[1] <= 12 && y > 1990) return y + '-' + dueC(m[1]);
    if (!s && y > 1990 && y < 2200) return y + '-12';                                 // solo l'anno: dato annuale
    if ((m = /^(\d{4})$/.exec(s)) && m[1] > 1990 && m[1] < 2200) return m[1] + '-12';
    return null;
  }
  function daTabella(matrice, numero) {
    var testa = -1, mappa = {}, avvisi = [];
    for (var i = 0; i < Math.min(matrice.length, 15) && testa < 0; i++) {
      var m = {}; matrice[i].forEach(function (c, j) { var n = norm(c); Object.keys(COLONNE).forEach(function (k) { if (m[k] === undefined && COLONNE[k].indexOf(n) >= 0) m[k] = j; }); });
      if (m.cliente !== undefined && m.ricavi !== undefined && (m.periodo !== undefined || m.anno !== undefined)) { testa = i; mappa = m; }
    }
    if (testa < 0) return { vendite: [], clienti: [], avvisi: ['Non trovo l\'intestazione: servono le colonne “Cliente”, “Periodo” (mese o data) e “Ricavi”. Scarica il modello per vedere i nomi accettati.'] };
    var vendite = [], cli = {}, scartate = 0, annuali = 0, anni = {};
    for (var r = testa + 1; r < matrice.length; r++) {
      var riga = matrice[r], v = function (k) { return mappa[k] === undefined ? undefined : riga[mappa[k]]; }, t = function (k) { var x = v(k); return x === undefined || x === null ? '' : String(x).trim(); };
      var nome = t('cliente'); if (!nome) continue;
      var ric = numero(v('ricavi')), per = periodo(v('periodo'), mappa.anno === undefined ? undefined : numero(v('anno')));
      if (ric === null || per === null) { scartate++; continue; }
      if (mappa.periodo === undefined || t('periodo') === '' || /^\d{4}$/.test(t('periodo'))) annuali++;
      var x = { cliente: nome.slice(0, 80), periodo: per, ricavi: ric, origine: 'importato' }, co = mappa.costo === undefined ? null : numero(v('costo')), or = mappa.ordini === undefined ? null : numero(v('ordini'));
      if (co !== null) x.costo = co; if (or !== null) x.ordini = or; if (t('famiglia')) x.famiglia = t('famiglia').slice(0, 60);
      vendite.push(x); anni[per.slice(0, 4)] = 1;
      var k = norm(nome); cli[k] = cli[k] || { nome: x.cliente }; if (t('settore')) cli[k].settore = t('settore').slice(0, 60); if (t('zona')) cli[k].zona = t('zona').slice(0, 60);
    }
    if (scartate) avvisi.push(scartate + ' righe scartate perché senza importo o con periodo non riconosciuto.');
    if (annuali) avvisi.push(annuali + ' righe hanno solo l\'anno: sono registrate a dicembre e non permettono di calcolare stagionalità e clienti fermi.');
    if (mappa.costo === undefined) avvisi.push('Manca la colonna del costo diretto: i margini per cliente non saranno calcolabili.');
    return { vendite: vendite, clienti: Object.keys(cli).map(function (k) { return cli[k]; }), anni: Object.keys(anni).map(Number).sort(), colonne: Object.keys(mappa), avvisi: avvisi };
  }
  /* Applica un'importazione: sostituisce le vendite degli anni presenti nel file e aggiorna settore e zona dei clienti. */
  function applica(az, imp) {
    var d = dati(az), anni = {}; imp.anni.forEach(function (y) { anni[y] = 1; });
    d.vendite = d.vendite.filter(function (v) { return !anni[String(v.periodo).slice(0, 4)]; }).concat(imp.vendite);
    var per = {}; d.clienti.forEach(function (c) { per[norm(c.nome)] = c; });
    imp.clienti.forEach(function (c) { var k = norm(c.nome), e = per[k]; if (!e) { e = per[k] = { nome: c.nome }; d.clienti.push(e); } if (c.settore) e.settore = c.settore; if (c.zona) e.zona = c.zona; });
    if (d.simulato && !d.vendite.some(function (v) { return v.origine === 'simulato'; })) { delete d.simulato; delete d.oggiSimulato; d.trattative = d.trattative.filter(function (t) { return t.origine !== 'simulato'; }); d.clienti = d.clienti.filter(function (c) { return c.origine !== 'simulato' || imp.clienti.some(function (q) { return norm(q.nome) === norm(c.nome); }); }); }
    az.commerciale = d; return imp.vendite.length;
  }
  function modelloCsv() { return 'Cliente;Periodo;Ricavi;Costo diretto;Ordini;Famiglia;Settore;Zona\r\nRossi Impianti Srl;01/2025;18500,00;12400,00;3;Ricambi;Impiantistica;Varese\r\nRossi Impianti Srl;02/2025;9200,00;6100,00;2;Ricambi;Impiantistica;Varese\r\n'; }

  // ------------------------------------------------------------ simulazione
  function rng(seme) { var a = seme >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var NOMI = ['Alfa', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Omicron', 'Sigma', 'Omega'];
  /* Vendite di fantasia coerenti con il bilancio simulato: per ognuno degli ultimi due esercizi la somma delle vendite
     è pari ai ricavi di bilancio. Contiene di proposito: un cliente perso, uno nuovo, uno che ha smesso di comprare
     a metà anno, uno servito sotto costo, clienti che pagano in ritardo e una decina di trattative. */
  function simula(az, seme) {
    var anni = Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }); if (!anni.length) return vuoto();
    var Y = anni[anni.length - 1], R = rng((Number(seme) || 1) + 9173), out = { simulato: true, vendite: [], clienti: [], trattative: [], oggiSimulato: (Y + 1) + '-01' };
    var pesi = [0.2, 0.14, 0.12, 0.1, 0.08, 0.07, 0.06, 0.05, 0.045, 0.04, 0.035, 0.03, 0.03, 0.03], sett = ['Meccanica', 'Alimentare', 'Edilizia', 'Commercio'], zone = ['Lombardia', 'Piemonte', 'Emilia-Romagna'];
    var stag = [0.9, 0.95, 1.05, 1.05, 1.1, 1.05, 1.0, 0.6, 1.1, 1.15, 1.1, 0.95], tardi = az.simulazione && az.simulazione.profilo === 'tensione_liquidita' ? 45 : 0, fam = ['Linea standard', 'Su misura', 'Ricambi e assistenza'];
    NOMI.forEach(function (nm, i) { var conc = [30, 60, 60, 90][i % 4], rit = i % 5 === 1 ? 35 + Math.round(R() * 20) : Math.round(R() * 12);
      out.clienti.push({ nome: 'Cliente ' + nm + ' (di fantasia)', settore: sett[i % 4], zona: zone[i % 3], ggConcordati: conc, ggEffettivi: conc + rit + tardi, origine: 'simulato' }); });
    [Y - 1, Y].forEach(function (y) {
      if (!az.esercizi[y]) return;
      var n = M.numeri(az.esercizi[y]), r = M.riclassifica(n, az.classificazione), tot = z(n.ricavi); if (!(tot > 0)) return;
      var cv = Math.min(0.85, Math.max(0.3, r.valore_produzione > 0 ? r.costi_variabili / r.valore_produzione : 0.6)), righe = [], somma = 0;
      NOMI.forEach(function (nm, i) {
        if (y === Y && i === 11) return;            // Omicron: perso nell'ultimo anno
        if (y === Y - 1 && i === 13) return;        // Omega: nuovo nell'ultimo anno
        var quotaCosto = i === 9 ? 1.06 : cv * ([0.92, 1.0, 1.08, 0.96][i % 4] + (i % 4 === 0 ? -0.04 : 0));    // Kappa: sotto costo; la Meccanica rende di più
        for (var m = 0; m < 12; m++) {
          if (y === Y && i === 5 && m >= 7) continue;   // Zeta: nessun acquisto da agosto
          if (i >= 10 && m % 2 === (i % 2)) continue;   // i clienti piccoli comprano a mesi alterni
          var v = pesi[i] * stag[m] * (0.8 + 0.4 * R()) * (y === Y && i === 3 ? 0.55 : 1);   // Delta: in forte calo
          righe.push({ cliente: 'Cliente ' + nm + ' (di fantasia)', periodo: y + '-' + ('0' + (m + 1)).slice(-2), _v: v, _q: quotaCosto, ordini: 1 + Math.floor(R() * (i < 4 ? 5 : 2)), famiglia: fam[(i + m) % 3], origine: 'simulato' }); somma += v;
        }
      });
      var fatto = 0; righe.forEach(function (x, k) { x.ricavi = k === righe.length - 1 ? Math.round((tot - fatto) * 100) / 100 : Math.round(x._v / somma * tot * 100) / 100; fatto += x.ricavi; x.costo = Math.round(x.ricavi * x._q * 100) / 100; delete x._v; delete x._q; out.vendite.push(x); });
    });
    var base = out.vendite.length ? z(M.numeri(az.esercizi[Y]).ricavi) : 0, tv = function (q) { return Math.round(base * q / 1000) * 1000; };
    [['Nuovo cliente Rho (di fantasia)', 0.05, 'offerta', 2, 'Meccanica', true, null], ['Nuovo cliente Tau (di fantasia)', 0.03, 'negoziazione', 1, 'Meccanica', true, 0.8], ['Cliente Beta (di fantasia) · ampliamento', 0.04, 'qualificata', 4, 'Alimentare', false, null],
      ['Nuovo cliente Phi (di fantasia)', 0.06, 'contatto', 6, 'Edilizia', true, null], ['Nuovo cliente Chi (di fantasia)', 0.02, 'offerta', -2, 'Commercio', true, null], ['Cliente Gamma (di fantasia) · contratto annuale', 0.05, 'negoziazione', 3, 'Edilizia', false, 0.6],
      ['Nuovo cliente Psi (di fantasia)', 0.03, 'vinta', -3, 'Meccanica', true, null], ['Cliente Omega (di fantasia) · primo ordine', 0.03, 'vinta', -8, 'Alimentare', true, null], ['Nuovo cliente Ypsilon (di fantasia)', 0.02, 'vinta', -5, 'Meccanica', true, null], ['Cliente Alfa (di fantasia) · rinnovo', 0.08, 'vinta', -1, 'Meccanica', false, null],
      ['Nuovo cliente Xi (di fantasia)', 0.04, 'persa', -4, 'Commercio', true, null], ['Nuovo cliente Ni (di fantasia)', 0.05, 'persa', -6, 'Edilizia', true, null]].forEach(function (t, i) {
      var x = { id: 'st-' + (i + 1), nome: t[0], valore: tv(t[1]), fase: t[2], chiusura: ymDi(ix(out.oggiSimulato) + t[3]), settore: t[4], nuovo: t[5], fonte: 'Dato simulato: contatto di fantasia', origine: 'simulato' }; if (t[6] !== null) x.probabilita = t[6]; out.trattative.push(x); });
    return out;
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az), anni = anniDi(az);
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    if (!anni.length && !d.trattative.length) return esiti;
    var tol = function (x) { return Math.max(0.01, Math.abs(x) * 1e-9); }, an = anni.map(function (y) { return analizza(az, y, az.esercizi && az.esercizi[y] ? { n: M.numeri(az.esercizi[y]), classificazione: az.classificazione, ceOk: true } : null); });
    var ogni = function (f) { return an.every(f); }, som = function (l, k) { return l.reduce(function (s, x) { return s + (typeof k === 'function' ? k(x) : x[k]); }, 0); };
    if (anni.length) {
      t('commerciale: la somma dei ricavi per cliente dà il totale dell\'anno', ogni(function (a) { return Math.abs(som(a.clienti, 'ricavi') - a.ricavi) < tol(a.ricavi) && Math.abs(som(a.mesi, function (x) { return x; }) - a.ricavi) < tol(a.ricavi) * 10; }), anni.join(', '));
      t('commerciale: le quote dei clienti sommano a 100% e ogni cliente ha una classe ABC', ogni(function (a) { return !a.clienti.length || (Math.abs(som(a.clienti, 'quota') - 1) < 1e-9 && a.clienti.every(function (c) { return 'ABC'.indexOf(c.abc) >= 0; }) && a.clienti[0].abc === 'A'); }), '');
      t('commerciale: clienti mantenuti + nuovi = clienti dell\'anno; mantenuti + persi = clienti dell\'anno prima', ogni(function (a) { return !a.mov || (a.mov.mantenuti + a.mov.nuovi === a.clienti.length && a.mov.mantenuti + a.mov.persi === a.mov.clientiPrec && Math.abs(a.mov.ricaviMantenuti + a.mov.ricaviNuovi - a.ricavi) < tol(a.ricavi) * 10); }), '');
      t('commerciale: settori, zone e famiglie ripartiscono tutti i ricavi', ogni(function (a) { return [a.settori, a.zone, a.famiglie].every(function (l) { return Math.abs(som(l, 'ricavi') - a.ricavi) < tol(a.ricavi) * 100; }); }), '');
      t('commerciale: il margine totale è la somma dei margini dei clienti con costo noto', ogni(function (a) { return a.margine === null || Math.abs(som(a.clienti.filter(function (c) { return c.margine !== null; }), 'margine') - a.margine) < tol(a.ricavi) * 100; }), '');
      t('commerciale: perdere un cliente toglie esattamente i suoi ricavi e il suo margine', ogni(function (a) { if (!a.clienti.length) return true; var p = perdita(a, a.clienti[0].key); return p.ricavi === a.clienti[0].ricavi && (a.clienti[0].margine === null || p.margine === a.clienti[0].margine); }), '');
    }
    var tr = analizzaTrattative(az, d.oggiSimulato || '2026-01', []);
    t('commerciale: il valore ponderato delle trattative non supera il valore totale e le fasi lo ripartiscono', tr.ponderato <= tr.valore + 1e-6 && Math.abs(som(['contatto', 'qualificata', 'offerta', 'negoziazione'], function (f) { return tr.fasi[f].valore; }) - tr.valore) < 1e-6 && som(Object.keys(FASI), function (f) { return tr.fasi[f].n; }) === d.trattative.length, tr.aperte + ' aperte');
    if (d.simulato && anni.length) {
      var a = an[an.length - 1], per = function (s) { return a.clienti.concat(a.persi).filter(function (c) { return c.nome.indexOf(s) >= 0; })[0]; };
      t('commerciale simulato: le vendite danno i ricavi di bilancio di ogni anno', ogni(function (x) { return x.bilancio && Math.abs(x.bilancio.differenza) < 1; }), an.map(function (x) { return Math.round(x.ricavi); }).join(', '));
      if (a.precPresente) {
        t('commerciale simulato: riconosciuti il cliente perso e quello nuovo', a.persi.length === 1 && a.persi[0].nome.indexOf('Omicron') >= 0 && per('Omega').stato === 'nuovo' && a.mov.nuovi === 1, a.persi.map(function (c) { return c.nome; }).join());
        t('commerciale simulato: riconosciuti il cliente fermo e quello in forte calo', per('Zeta').fermo && per('Zeta').mesiFermo === 5 && per('Delta').stato === 'in calo' && a.aRischio.length >= 2, a.aRischio.map(function (c) { return c.nome.split(' ')[1] + ': ' + c.rischio; }).join('; '));
      }
      t('commerciale simulato: riconosciuto il cliente servito sotto costo', a.inPerdita.length === 1 && a.inPerdita[0].nome.indexOf('Kappa') >= 0, a.inPerdita.length + ' in perdita');
      t('commerciale simulato: il settore più redditizio è tra i segmenti forti', a.settoriForti.indexOf('Meccanica') >= 0, a.settoriForti.join(', '));
      t('commerciale simulato: trattative scadute e tasso di successo calcolati', tr.scadute === 1 && tr.chiuse === 6 && Math.abs(tr.successo - 4 / 6) < 1e-9 && tr.aperte === 6, tr.scadute + ' scadute');
    }
    return esiti;
  }

  return { FASI: FASI, PROB_FASE: PROB_FASE, PARAM: PARAM, norm: norm, ix: ix, ymDi: ymDi, vuoto: vuoto, dati: dati, parametri: parametri, anniDi: anniDi, analizza: analizza, perdita: perdita, sconto: sconto, analizzaTrattative: analizzaTrattative,
    criticita: criticita, periodo: periodo, daTabella: daTabella, applica: applica, modelloCsv: modelloCsv, simula: simula, collaudo: collaudo };
});
