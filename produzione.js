/* Timone · modulo Produzione e controllo industriale
   Funzioni pure. Parte dalle registrazioni mensili per macchina (ore disponibili, fermi, attrezzaggi, manutenzione,
   pezzi prodotti e scartati, tempo ciclo standard, kWh) e calcola disponibilità, performance, qualità e OEE,
   produttività oraria, saturazione, costo dei fermi e della non qualità, confronti con commesse e bollette.
   Regole: l'OEE non viene calcolato se manca il tempo ciclo standard (nessuna performance inventata);
   il costo dei fermi è "inserito" se la macchina ha un costo orario di fermo, altrimenti "stimato" dal margine
   di contribuzione di bilancio, altrimenti assente. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Produzione = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var PARAMETRI = { obiettivoOee: 0.65, sogliaFermi: 0.10, sogliaAttrezzaggi: 0.10, sogliaScarti: 0.05, sogliaSaturazione: 0.50 };
  var MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function z(x) { return num(x) || 0; }
  function div(a, b) { return (isFinite(a) && isFinite(b) && b !== 0) ? a / b : null; }
  function vuoto() { return { parametri: {}, macchine: [], registrazioni: [] }; }
  function dati(az) { var d = az.produzione || vuoto(); d.parametri = d.parametri || {}; d.macchine = d.macchine || []; d.registrazioni = d.registrazioni || []; return d; }
  function parametri(d) { return Object.assign({}, PARAMETRI, d.parametri || {}); }

  // ------------------------------------------------------------ aggregazione di più registrazioni
  function aggrega(righe) {
    var o = { n: righe.length, disponibili: 0, manutenzione: 0, fermo: 0, attrezzaggio: 0, pezzi: 0, scarti: 0, secondiStd: 0, operativeConCiclo: 0, senzaCiclo: 0, kwh: 0, conKwh: 0, acqua: 0, incoerenti: 0, valoreScarti: 0, scartiValorizzati: 0 };
    righe.forEach(function (r) {
      var disp = z(r.oreDisponibili), man = z(r.oreManutenzione), fermo = z(r.oreFermo), attr = z(r.oreAttrezzaggio), op = disp - man - fermo - attr, pezzi = z(r.pezziProdotti), sc = z(r.pezziScartati);
      if (op < -0.001 || sc > pezzi + 0.001) o.incoerenti++;
      o.disponibili += disp; o.manutenzione += man; o.fermo += fermo; o.attrezzaggio += attr; o.pezzi += pezzi; o.scarti += sc;
      if (num(r.tempoCiclo) !== null && r.tempoCiclo > 0) { o.secondiStd += pezzi * r.tempoCiclo; o.operativeConCiclo += Math.max(0, op); } else if (pezzi > 0 || op > 0) o.senzaCiclo++;
      if (num(r.kwh) !== null) { o.kwh += r.kwh; o.conKwh++; }
      o.acqua += z(r.acqua);
      if (num(r.valorePezzo) !== null) { o.valoreScarti += sc * r.valorePezzo; o.scartiValorizzati += sc; }
    });
    o.pianificate = o.disponibili - o.manutenzione;                       // tempo in cui si doveva produrre
    o.operative = o.pianificate - o.fermo - o.attrezzaggio;               // tempo in cui si è prodotto
    o.disponibilita = o.pianificate > 0 ? Math.max(0, o.operative) / o.pianificate : null;
    o.performance = (o.senzaCiclo === 0 && o.operativeConCiclo > 0) ? (o.secondiStd / 3600) / o.operativeConCiclo : null;
    o.qualita = o.pezzi > 0 ? (o.pezzi - o.scarti) / o.pezzi : null;
    o.oee = (o.disponibilita !== null && o.performance !== null && o.qualita !== null) ? o.disponibilita * o.performance * o.qualita : null;
    o.buoni = o.pezzi - o.scarti;
    o.pezziOra = o.operative > 0 ? o.buoni / o.operative : null;
    o.cicloEffettivo = o.pezzi > 0 && o.operative > 0 ? o.operative * 3600 / o.pezzi : null;
    o.cicloStandard = (o.senzaCiclo === 0 && o.pezzi > 0) ? o.secondiStd / o.pezzi : null;
    o.quotaFermi = o.pianificate > 0 ? o.fermo / o.pianificate : null; o.quotaAttrezzaggi = o.pianificate > 0 ? o.attrezzaggio / o.pianificate : null; o.quotaScarti = o.pezzi > 0 ? o.scarti / o.pezzi : null;
    o.kwhPezzo = (o.conKwh === o.n && o.buoni > 0) ? o.kwh / o.buoni : null; o.kwhOra = (o.conKwh === o.n && o.operative > 0) ? o.kwh / o.operative : null;
    // perdite in ore equivalenti: dove si perde di più
    o.perdite = { disponibilita: o.fermo + o.attrezzaggio, performance: o.performance !== null ? Math.max(0, o.operative) * (1 - Math.min(1, o.performance)) : null,
      qualita: (o.performance !== null && o.qualita !== null) ? Math.max(0, o.operative) * Math.min(1, o.performance) * (1 - o.qualita) : (o.qualita !== null ? Math.max(0, o.operative) * (1 - o.qualita) : null) };
    var p = o.perdite, mag = [['disponibilita', p.disponibilita], ['performance', p.performance], ['qualita', p.qualita]].filter(function (x) { return x[1] !== null; }).sort(function (a, b) { return b[1] - a[1]; });
    o.perditaPrincipale = mag.length && mag[0][1] > 0 ? mag[0][0] : null;
    return o;
  }

  // ------------------------------------------------------------ analisi dell'anno
  function analisi(az, anno, n, ceCompleto) {
    var d = dati(az), par = parametri(d), righe = d.registrazioni.filter(function (r) { return Number(r.anno) === Number(anno); });
    var out = { anno: anno, parametri: par, presente: righe.length > 0, macchine: [], criticita: [] };
    if (!out.presente) return out;
    var Mm = {}; d.macchine.forEach(function (m) { Mm[m.id] = m; });
    out.orfane = righe.filter(function (r) { return !Mm[r.macchina]; }).length;
    righe = righe.filter(function (r) { return Mm[r.macchina]; });
    out.totale = aggrega(righe);
    out.mesi = {}; for (var k = 1; k <= 12; k++) { var rm = righe.filter(function (r) { return Number(r.mese) === k; }); if (rm.length) out.mesi[k] = aggrega(rm); }
    // valore di un'ora di produzione: margine di contribuzione di bilancio ÷ ore operative (stima)
    out.contabile = !!(n && ceCompleto);
    if (out.contabile && out.totale.operative > 0) { var r0 = M.riclassifica(n, az.classificazione); out.margineOra = r0.margine_contribuzione > 0 ? r0.margine_contribuzione / out.totale.operative : null; }
    else out.margineOra = null;
    var R = {}; ((az.commesse && az.commesse.risorse) || []).forEach(function (x) { R[x.id] = x; });
    d.macchine.forEach(function (m) {
      var rr = righe.filter(function (r) { return r.macchina === m.id; }); if (!rr.length) return;
      var a = aggrega(rr), x = { m: m, a: a, mesi: {} };
      rr.forEach(function (r) { (x.mesi[r.mese] = x.mesi[r.mese] || []).push(r); });
      Object.keys(x.mesi).forEach(function (k) { x.mesi[k] = aggrega(x.mesi[k]); });
      x.mesiPresenti = Object.keys(x.mesi).length;
      // costo dei fermi
      if (num(m.costoFermoOra) !== null) { x.costoFermo = a.fermo * m.costoFermoOra; x.costoFermoOrigine = 'inserito'; }
      else if (out.margineOra) { x.costoFermo = a.fermo * out.margineOra; x.costoFermoOrigine = 'stimato'; }
      else { x.costoFermo = null; x.costoFermoOrigine = null; }
      // saturazione rispetto alla capacità dichiarata della macchina
      x.saturazione = num(m.capacitaOreMese) ? div(Math.max(0, a.operative), m.capacitaOreMese * x.mesiPresenti) : null;
      // ore attribuite alle commesse dalla risorsa collegata
      if (m.risorsaCommesse && R[m.risorsaCommesse]) {
        var ore = 0; az.commesse.elenco.forEach(function (c) { if (Number(c.anno) !== Number(anno)) return; (c.ore || []).forEach(function (o) { if (o.risorsa === m.risorsaCommesse) ore += z(o.ore); }); });
        x.oreCommesse = ore; x.quotaCommesse = div(ore, Math.max(0, a.operative)); x.commesseOltre = ore > Math.max(0, a.operative) * 1.02 + 1;
      }
      out.macchine.push(x);
    });
    out.macchine.sort(function (x, y) { return (x.a.oee === null ? 2 : x.a.oee) - (y.a.oee === null ? 2 : y.a.oee); });
    out.costoFermi = out.macchine.reduce(function (s, x) { return s + (x.costoFermo || 0); }, 0);
    out.costoFermiStimato = out.macchine.some(function (x) { return x.costoFermoOrigine === 'stimato'; });
    out.costoFermiParziale = out.macchine.some(function (x) { return x.a.fermo > 0 && x.costoFermo === null; });
    // collegamento con le bollette: kWh registrati sulle macchine rispetto alle utenze di produzione
    if (az.energia && az.energia.bollette && out.totale.conKwh) {
      var up = {}; (az.energia.utenze || []).forEach(function (u) { if (u.vettore === 'elettricita' && (u.uso === 'produzione' || u.uso === 'misto')) up[u.id] = true; });
      var kb = 0, nb = 0; az.energia.bollette.forEach(function (b) { if (Number(b.anno) === Number(anno) && up[b.utenza] && num(b.consumo) !== null) { kb += b.consumo; nb++; } });
      if (nb) out.energia = { kwhMacchine: out.totale.kwh, kwhBollette: kb, quota: div(out.totale.kwh, kb), oltre: out.totale.kwh > kb * 1.02 + 1 };
    }
    out.criticita = criticita(out);
    return out;
  }

  function criticita(a) {
    var eur = M.fmt.eur, pct = M.fmt.pct, par = a.parametri, T = a.totale, out = [], h = function (x) { return Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ore'; };
    var NOMI = { disponibilita: 'fermi e attrezzaggi', performance: 'velocità inferiore allo standard', qualita: 'scarti' };
    if (T.incoerenti) out.push({ id: 'produzione_incoerente', gravita: 'rosso', peso: 1e12, titolo: T.incoerenti + ' registrazioni incoerenti',
      dati: 'Fermi, attrezzaggi e manutenzione superano le ore disponibili, oppure gli scarti superano i pezzi prodotti.', causa: 'Errore di inserimento o di esportazione.', intervento: 'Correggere le registrazioni segnalate nell\'elenco.', effetto: 'Disponibilità e OEE delle macchine coinvolte non sono affidabili.' });
    var oltre = a.macchine.filter(function (x) { return x.commesseOltre; });
    if (oltre.length) out.push({ id: 'ore_commesse_oltre', gravita: 'rosso', peso: 1e11, titolo: 'Ore macchina attribuite alle commesse superiori a quelle di produzione',
      dati: oltre.map(function (x) { return x.m.nome + ': ' + h(x.oreCommesse) + ' nelle commesse, ' + h(x.a.operative) + ' operative'; }).join(' · ') + '.', causa: 'Ore contate due volte nelle commesse oppure registrazioni di produzione incomplete.',
      intervento: 'Riallineare le ore: una macchina non può lavorare per le commesse più ore di quante ne ha lavorate.', effetto: 'Il costo macchina delle commesse è sovrastimato oppure la produzione è sottostimata.' });
    if (a.energia && a.energia.oltre) out.push({ id: 'kwh_oltre_bollette', gravita: 'rosso', peso: 1e10, titolo: 'I kWh registrati sulle macchine superano quelli delle bollette',
      dati: 'Macchine ' + Math.round(a.energia.kwhMacchine) + ' kWh, bollette delle utenze di produzione ' + Math.round(a.energia.kwhBollette) + ' kWh.', causa: 'Stime di consumo troppo alte, contatori non allineati o bollette mancanti.', intervento: 'Verificare le letture per macchina e la completezza delle bollette.', effetto: 'Il consumo per pezzo non è affidabile.' });
    a.macchine.forEach(function (x) {
      var m = x.a, nome = x.m.nome;
      if (m.oee !== null && m.oee < par.obiettivoOee) {
        var pp = m.perditaPrincipale, ore = pp ? m.perdite[pp] : 0, valore = a.margineOra ? ore * a.margineOra : null;
        out.push({ id: 'oee_basso', macchina: x.m.id, gravita: m.oee < par.obiettivoOee * 0.8 ? 'rosso' : 'giallo', peso: valore || ore, titolo: nome + ': OEE ' + pct(m.oee) + ', sotto l\'obiettivo del ' + pct(par.obiettivoOee),
          dati: 'Disponibilità ' + pct(m.disponibilita) + ' × performance ' + pct(m.performance) + ' × qualità ' + pct(m.qualita) + '. La perdita maggiore è per ' + (NOMI[pp] || 'cause non distinguibili') + ': ' + h(ore) + ' equivalenti.',
          causa: pp === 'disponibilita' ? 'Guasti, attese di materiale o di personale, cambi di produzione lunghi.' : pp === 'performance' ? 'Microfermate, velocità ridotta oppure tempo ciclo standard non realistico.' : 'Difetti di lavorazione, materiali o attrezzature.',
          intervento: pp === 'disponibilita' ? 'Registrare le cause dei fermi e intervenire sulle prime due; ridurre i tempi di attrezzaggio.' : pp === 'performance' ? 'Verificare il tempo ciclo standard, poi cercare microfermate e rallentamenti.' : 'Analizzare i difetti per tipo e per prodotto.',
          effetto: valore !== null ? 'Le ore perse valgono circa ' + eur(valore) + ' di margine di contribuzione (stima dal bilancio), se la produzione in più fosse venduta.' : h(ore) + ' di produzione equivalente perse.' });
      } else if (m.quotaFermi !== null && m.quotaFermi > par.sogliaFermi) out.push({ id: 'fermi_elevati', macchina: x.m.id, gravita: 'giallo', peso: x.costoFermo || m.fermo, titolo: nome + ': fermi al ' + pct(m.quotaFermi) + ' del tempo pianificato',
        dati: h(m.fermo) + ' di fermo su ' + h(m.pianificate) + ' pianificate.', causa: 'Guasti, mancanza di materiale o di personale: servono le cause registrate per distinguere.', intervento: 'Registrare la causa di ogni fermo e valutare la manutenzione preventiva.',
        effetto: x.costoFermo !== null ? 'Costo dei fermi circa ' + eur(x.costoFermo) + ' (' + x.costoFermoOrigine + ').' : 'Costo non calcolabile: manca il costo orario di fermo della macchina.' });
      if (m.quotaScarti !== null && m.quotaScarti > par.sogliaScarti && !(m.oee !== null && m.oee < par.obiettivoOee && m.perditaPrincipale === 'qualita')) out.push({ id: 'scarti_elevati', macchina: x.m.id, gravita: 'giallo', peso: m.valoreScarti || m.scarti, titolo: nome + ': scarti al ' + pct(m.quotaScarti),
        dati: Math.round(m.scarti) + ' pezzi scartati su ' + Math.round(m.pezzi) + '.', causa: 'Difetti di lavorazione, materiali o attrezzature.', intervento: 'Analizzare gli scarti per prodotto e per causa.',
        effetto: m.scartiValorizzati ? 'Costo dei pezzi scartati circa ' + eur(m.valoreScarti) + (m.scartiValorizzati < m.scarti ? ' (solo sui pezzi con valore indicato)' : '') + '.' : 'Costo non calcolabile: manca il valore per pezzo nelle registrazioni.' });
      if (m.quotaAttrezzaggi !== null && m.quotaAttrezzaggi > par.sogliaAttrezzaggi) out.push({ id: 'attrezzaggi_elevati', macchina: x.m.id, gravita: 'giallo', peso: m.attrezzaggio, titolo: nome + ': attrezzaggi al ' + pct(m.quotaAttrezzaggi) + ' del tempo pianificato',
        dati: h(m.attrezzaggio) + ' di attrezzaggio.', causa: 'Lotti piccoli e cambi frequenti, oppure cambi lenti.', intervento: 'Raggruppare i lotti simili e standardizzare il cambio di produzione.', effetto: a.margineOra ? 'Ore che valgono circa ' + eur(m.attrezzaggio * a.margineOra) + ' di margine (stima).' : h(m.attrezzaggio) + ' non produttive.' });
      if (m.performance !== null && m.performance > 1.05) out.push({ id: 'ciclo_da_verificare', macchina: x.m.id, gravita: 'giallo', peso: 1, titolo: nome + ': performance oltre il 100%', dati: 'Performance ' + pct(m.performance) + ': la macchina avrebbe prodotto più dello standard.', causa: 'Tempo ciclo standard troppo prudente, oppure ore o pezzi registrati male.', intervento: 'Aggiornare il tempo ciclo standard: finché non è corretto, l\'OEE è sovrastimato.', effetto: 'OEE non affidabile per questa macchina.' });
      if (x.saturazione !== null && x.saturazione < par.sogliaSaturazione) out.push({ id: 'capacita_inutilizzata', macchina: x.m.id, gravita: 'giallo', peso: 0.5, titolo: nome + ': capacità utilizzata al ' + pct(x.saturazione), dati: h(m.operative) + ' operative su ' + h(x.m.capacitaOreMese * x.mesiPresenti) + ' di capacità dichiarata.', causa: 'Carico di lavoro insufficiente o macchina sovradimensionata.',
        intervento: 'Valutare lavorazioni per conto terzi, spostamento di produzioni o dismissione: è una decisione da simulare, non un automatismo.', effetto: 'Costi fissi della macchina ripartiti su poche ore.' });
      if (m.senzaCiclo) out.push({ id: 'ciclo_mancante', macchina: x.m.id, gravita: 'giallo', peso: 0.2, titolo: nome + ': tempo ciclo standard mancante', dati: m.senzaCiclo + ' registrazioni senza tempo ciclo.', causa: 'Dato non inserito.', intervento: 'Inserire il tempo ciclo standard: senza, performance e OEE non vengono calcolati né stimati.', effetto: 'Per questa macchina sono disponibili solo disponibilità e qualità.' });
    });
    out.sort(function (x, y) { return x.gravita === y.gravita ? y.peso - x.peso : (x.gravita === 'rosso' ? -1 : 1); });
    return out;
  }

  // ------------------------------------------------------------ importazione delle registrazioni
  var COLONNE = { macchina: ['macchina', 'impianto', 'pressa', 'centro di lavoro', 'linea'], anno: ['anno'], mese: ['mese'], prodotto: ['prodotto', 'articolo'], commessa: ['commessa', 'ordine'], oreDisponibili: ['ore disponibili', 'ore turno', 'ore pianificate', 'ore apertura'],
    oreFermo: ['ore fermo', 'fermi', 'ore di fermo', 'guasti'], oreAttrezzaggio: ['ore attrezzaggio', 'attrezzaggio', 'setup', 'ore setup', 'cambio stampo'], oreManutenzione: ['ore manutenzione', 'manutenzione'],
    pezziProdotti: ['pezzi prodotti', 'pezzi', 'quantita prodotta', 'prodotti'], pezziScartati: ['pezzi scartati', 'scarti', 'scartati'], tempoCiclo: ['tempo ciclo', 'tempo ciclo s', 'ciclo', 'ciclo standard', 'tempo ciclo standard'], kwh: ['kwh', 'energia'], acqua: ['acqua', 'm3'], valorePezzo: ['valore pezzo', 'costo pezzo'] };
  function norm(s) { return String(s === null || s === undefined ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function meseDa(x, numero) { var v = numero(x); if (v !== null && v >= 1 && v <= 12) return Math.round(v); var i = MESI.indexOf(norm(x).slice(0, 3)); return i >= 0 ? i + 1 : null; }
  function daTabella(matrice, numero, macchineEsistenti) {
    var testa = -1, mappa = {}, avvisi = [];
    for (var i = 0; i < Math.min(matrice.length, 15) && testa < 0; i++) {
      var m = {};
      matrice[i].forEach(function (c, j) { var n = norm(c); Object.keys(COLONNE).forEach(function (k) { if (m[k] === undefined && COLONNE[k].indexOf(n) >= 0) m[k] = j; }); });
      if (m.macchina !== undefined && m.anno !== undefined && m.mese !== undefined && m.oreDisponibili !== undefined) { testa = i; mappa = m; }
    }
    if (testa < 0) return { registrazioni: [], macchine: [], colonne: [], avvisi: ['Non trovo l\'intestazione: servono almeno “Macchina”, “Anno”, “Mese” e “Ore disponibili”. Scarica il modello per vedere i nomi accettati.'] };
    var es = {}, nuove = [], reg = [], scartate = 0;
    (macchineEsistenti || []).forEach(function (x) { es[norm(x.nome)] = x; });
    for (var r = testa + 1; r < matrice.length; r++) {
      var riga = matrice[r], v = function (k) { return mappa[k] === undefined ? undefined : riga[mappa[k]]; }, nome = String(v('macchina') === undefined ? '' : v('macchina')).trim();
      if (!nome) continue;
      var anno = numero(v('anno')), mese = meseDa(v('mese'), numero), disp = numero(v('oreDisponibili'));
      if (!anno || !mese || disp === null) { scartate++; continue; }
      var mc = es[norm(nome)];
      if (!mc) { mc = { id: 'k' + nuove.length + '-' + Date.now().toString(36), nome: nome.slice(0, 60), origine: 'importato' }; es[norm(nome)] = mc; nuove.push(mc); }
      var x = { id: 'g' + reg.length + '-' + Date.now().toString(36), macchina: mc.id, anno: Math.round(anno), mese: mese, oreDisponibili: disp, origine: 'importato' };
      ['oreFermo', 'oreAttrezzaggio', 'oreManutenzione', 'pezziProdotti', 'pezziScartati', 'tempoCiclo', 'kwh', 'acqua', 'valorePezzo'].forEach(function (k) { if (mappa[k] === undefined) return; var q = numero(v(k)); if (q !== null) x[k] = q; });
      ['prodotto', 'commessa'].forEach(function (k) { var t = v(k); if (t !== undefined && String(t).trim()) x[k] = String(t).trim().slice(0, 60); });
      reg.push(x);
    }
    if (scartate) avvisi.push(scartate + ' righe senza anno, mese o ore disponibili non sono state importate.');
    if (nuove.length) avvisi.push('Verranno create ' + nuove.length + ' nuove macchine: ' + nuove.map(function (x) { return x.nome; }).join(', ') + '.');
    if (mappa.tempoCiclo === undefined) avvisi.push('Il file non contiene il tempo ciclo standard: performance e OEE non saranno calcolabili (solo disponibilità e qualità).');
    if (mappa.pezziProdotti === undefined) avvisi.push('Il file non contiene i pezzi prodotti: qualità, produttività e OEE non saranno calcolabili.');
    return { registrazioni: reg, macchine: nuove, colonne: Object.keys(mappa), avvisi: avvisi };
  }
  function modelloCsv() { return 'Macchina;Anno;Mese;Prodotto;Commessa;Ore disponibili;Ore manutenzione;Ore fermo;Ore attrezzaggio;Pezzi prodotti;Pezzi scartati;Tempo ciclo;kWh;Valore pezzo\r\nPressa 1;2025;1;Coperchio;25/001;352;8;30;22;31500;630;30;7800;0,85\r\n'; }

  // ------------------------------------------------------------ simulazione
  function rng(seme) { var a = seme >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // profilo di ogni macchina: disponibilità, performance, scarti. La seconda ha molti fermi, la terza molti scarti (di proposito).
  var PROFILI = [{ fermo: 0.07, attr: 0.05, perf: 0.93, scarti: 0.02, ciclo: 28 }, { fermo: 0.24, attr: 0.07, perf: 0.86, scarti: 0.03, ciclo: 36 }, { fermo: 0.04, attr: 0.04, perf: 0.95, scarti: 0.09, ciclo: 20 }];

  /* Registrazioni mensili degli ultimi due esercizi per le macchine delle commesse simulate:
     le ore operative coprono (con un margine) le ore attribuite alle commesse; i kWh restano entro le bollette simulate. */
  function simula(az, seme) {
    var R = rng((seme === undefined || seme === null ? 1 : Number(seme)) + 97), out = { parametri: {}, macchine: [], registrazioni: [], simulato: true };
    var mac = ((az.commesse && az.commesse.risorse) || []).filter(function (x) { return x.tipo === 'macchina'; });
    if (!mac.length) return out;
    mac.forEach(function (x, i) { out.macchine.push({ id: 'pm' + (i + 1), nome: x.nome, reparto: i < 2 ? 'Stampaggio' : 'Finitura', risorsaCommesse: x.id, potenzaKw: x.potenzaKw, capacitaOreMese: 352, origine: 'simulato' }); });
    Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }).slice(-2).forEach(function (anno) {
      mac.forEach(function (x, i) {
        var P = PROFILI[i % PROFILI.length], oreC = 0;
        az.commesse.elenco.forEach(function (c) { if (Number(c.anno) !== anno) return; (c.ore || []).forEach(function (o) { if (o.risorsa === x.id) oreC += z(o.ore); }); });
        if (!oreC) return;
        var opAnno = oreC * 1.08, pesi = [], sp = 0;
        for (var m = 0; m < 12; m++) { var w = (m === 7 ? 0.55 : 1) * (0.92 + R() * 0.16); pesi.push(w); sp += w; }
        for (m = 1; m <= 12; m++) {
          var op = opAnno * pesi[m - 1] / sp, pian = op / (1 - P.fermo - P.attr), fermo = Math.round(pian * P.fermo * (0.85 + R() * 0.3)), attr = Math.round(pian * P.attr), man = Math.round(pian * 0.03);
          var disp = Math.ceil(op) + fermo + attr + man, operative = disp - man - fermo - attr;
          var pezzi = Math.round(operative * 3600 / P.ciclo * P.perf * (0.98 + R() * 0.04)), scarti = Math.round(pezzi * P.scarti * (0.85 + R() * 0.3));
          out.registrazioni.push({ id: 'sg-' + anno + '-' + (i + 1) + '-' + m, macchina: 'pm' + (i + 1), anno: anno, mese: m, oreDisponibili: disp, oreManutenzione: man, oreFermo: fermo, oreAttrezzaggio: attr, pezziProdotti: pezzi, pezziScartati: scarti, tempoCiclo: P.ciclo,
            kwh: Math.round(operative * z(x.potenzaKw) * (num(x.fattoreCarico) === null ? 1 : x.fattoreCarico) * 1.05), valorePezzo: Math.round((0.3 + i * 0.25) * 100) / 100, origine: 'simulato' });
        }
      });
    });
    return out;
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az), eur = M.fmt.eur, pct = M.fmt.pct;
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    var anni = d.registrazioni.map(function (r) { return Number(r.anno); }).filter(function (a, i, s) { return s.indexOf(a) === i; }).sort();
    anni.forEach(function (anno, idx) {
      var n = az.esercizi[anno] ? M.numeri(az.esercizi[anno]) : null, a = analisi(az, anno, n, !!n && M.mancantiSezione(n, 'ce').length === 0);
      if (!a.presente) return;
      var T = a.totale;
      t(anno + ' · produzione: ore disponibili = manutenzione + fermi + attrezzaggi + operative', Math.abs(T.disponibili - T.manutenzione - T.fermo - T.attrezzaggio - T.operative) < 0.01, Math.round(T.disponibili) + ' ore disponibili');
      t(anno + ' · produzione: registrazioni coerenti', T.incoerenti === 0, T.incoerenti ? T.incoerenti + ' da correggere' : 'Tutte coerenti');
      t(anno + ' · produzione: OEE = disponibilità × performance × qualità', a.macchine.every(function (x) { return x.a.oee === null || Math.abs(x.a.oee - x.a.disponibilita * x.a.performance * x.a.qualita) < 1e-9; }) && a.macchine.every(function (x) { return x.a.oee === null || (x.a.oee >= 0 && x.a.oee <= 1.2); }), a.macchine.map(function (x) { return x.m.nome + ' ' + (x.a.oee === null ? '—' : pct(x.a.oee)); }).join(' · '));
      t(anno + ' · produzione: le macchine sommano al totale dello stabilimento', Math.abs(a.macchine.reduce(function (s, x) { return s + x.a.operative; }, 0) - T.operative) < 0.01 && Math.abs(a.macchine.reduce(function (s, x) { return s + x.a.pezzi; }, 0) - T.pezzi) < 0.01, Math.round(T.pezzi) + ' pezzi');
      t(anno + ' · produzione: ore delle commesse entro le ore operative delle macchine', !a.macchine.some(function (x) { return x.commesseOltre; }), a.macchine.filter(function (x) { return x.oreCommesse !== undefined; }).map(function (x) { return x.m.nome + ' ' + pct(x.quotaCommesse); }).join(' · ') || 'Nessuna macchina collegata alle commesse');
      if (a.energia) t(anno + ' · produzione: kWh delle macchine entro le bollette', !a.energia.oltre, Math.round(a.energia.kwhMacchine) + ' su ' + Math.round(a.energia.kwhBollette) + ' kWh');
      if (d.simulato && idx === anni.length - 1 && a.macchine.length >= 3) {
        var ids = a.criticita.map(function (x) { return x.id + ':' + (x.macchina || ''); });
        t(anno + ' · produzione simulata: macchina con molti fermi trovata', ids.indexOf('oee_basso:pm2') >= 0 && a.macchine.filter(function (x) { return x.m.id === 'pm2'; })[0].a.perditaPrincipale === 'disponibilita', ids.join(', '));
        t(anno + ' · produzione simulata: macchina con molti scarti trovata', ids.indexOf('scarti_elevati:pm3') >= 0, ids.join(', '));
        t(anno + ' · produzione simulata: nessun allarme di OEE sulla macchina regolare', ids.indexOf('oee_basso:pm1') < 0, ids.join(', '));
      }
    });
    return esiti;
  }

  return { PARAMETRI: PARAMETRI, MESI: MESI, vuoto: vuoto, dati: dati, parametri: parametri, aggrega: aggrega, analisi: analisi, daTabella: daTabella, modelloCsv: modelloCsv, simula: simula, collaudo: collaudo };
});
