/* Timone · modulo Commesse e marginalità (controllo di gestione)
   Funzioni pure. Collega i dati gestionali (ore, materiali, energia per commessa) al bilancio:
   - costo diretto e margine di ogni commessa, con confronto preventivo/consuntivo;
   - costi indiretti ricavati dal conto economico (costi operativi − costi diretti attribuiti)
     e ribaltati con una base scelta dall'utente;
   - riconciliazione tra livello gestionale e livello contabile, per evitare doppi conteggi;
   - analisi per cliente e per prodotto.
   L'energia è "misurata" se sono inseriti i kWh, altrimenti "stimata" da potenza × fattore di carico × ore. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Commesse = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var PARAMETRI = { prezzoKwh: 0.22, sogliaMargine: 0.10, base: 'costi_diretti', sogliaScarti: 0.05, sogliaCliente: 0.30 };
  var BASI = { costi_diretti: 'In proporzione ai costi diretti', ore: 'In proporzione alle ore di lavoro', ricavi: 'In proporzione ai ricavi' };

  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : 0; }
  function div(a, b) { return (isFinite(a) && isFinite(b) && b !== 0) ? a / b : null; }
  function vuoto() { return { risorse: [], parametri: {}, elenco: [] }; }
  function dati(az) { var d = az.commesse || vuoto(); d.risorse = d.risorse || []; d.elenco = d.elenco || []; d.parametri = d.parametri || {}; return d; }
  function parametri(d) { return Object.assign({}, PARAMETRI, d.parametri || {}); }

  // ------------------------------------------------------------ singola commessa
  function calcola(c, risorse, par) {
    var R = {}; risorse.forEach(function (r) { R[r.id] = r; });
    var o = { materiali: num(c.materiali), esterni: num(c.esterni), trasporti: num(c.trasporti), lavoro: 0, oreLavoro: 0, macchine: 0, oreMacchina: 0,
      energia: 0, kwh: 0, kwhStimati: 0, kwhMisurati: 0, risorseMancanti: 0 };
    (c.ore || []).forEach(function (x) {
      var r = R[x.risorsa], ore = num(x.ore);
      if (!r) { if (ore || num(x.kwh)) o.risorseMancanti++; return; }
      if (r.tipo === 'macchina') {
        o.oreMacchina += ore; o.macchine += ore * num(r.costoOrario);
        if (typeof x.kwh === 'number' && isFinite(x.kwh)) o.kwhMisurati += x.kwh;
        else o.kwhStimati += ore * num(r.potenzaKw) * (typeof r.fattoreCarico === 'number' ? r.fattoreCarico : 1);
      } else { o.oreLavoro += ore; o.lavoro += ore * num(r.costoOrario); }
    });
    o.kwh = o.kwhMisurati + o.kwhStimati;
    o.energia = o.kwh * num(par.prezzoKwh);
    o.energiaOrigine = o.kwh === 0 ? 'assente' : o.kwhStimati === 0 ? 'misurata' : o.kwhMisurati === 0 ? 'stimata' : 'mista';
    o.ricavo = num(c.ricavo);
    o.costoDiretto = o.materiali + o.lavoro + o.macchine + o.energia + o.esterni + o.trasporti;
    o.margineLordo = o.ricavo - o.costoDiretto;
    o.margineLordoPct = div(o.margineLordo, o.ricavo);
    var buoni = num(c.qProdotta) - num(c.qScartata);
    o.pezziBuoni = buoni;
    o.costoUnitario = buoni > 0 ? o.costoDiretto / buoni : null;
    o.prezzoUnitario = buoni > 0 ? o.ricavo / buoni : null;
    o.scartoPct = num(c.qProdotta) > 0 ? num(c.qScartata) / num(c.qProdotta) : null;
    o.costoScarti = o.scartoPct !== null ? o.costoDiretto * o.scartoPct : 0;
    o.kwhPezzo = buoni > 0 && o.kwh ? o.kwh / buoni : null;
    var prev = c.preventivo && typeof c.preventivo.costo === 'number' ? c.preventivo.costo : null;
    o.preventivo = prev;
    o.scostamento = prev !== null ? o.costoDiretto - prev : null;
    o.scostamentoPct = prev ? (o.costoDiretto - prev) / prev : null;
    return o;
  }

  // ------------------------------------------------------------ analisi dell'anno
  // n = valori di bilancio dell'anno (o null); ceCompleto = il conto economico non ha vuoti
  function analisi(az, anno, n, ceCompleto) {
    var d = dati(az), par = parametri(d), cl = az.classificazione;
    var righe = d.elenco.filter(function (c) { return Number(c.anno) === Number(anno); }).map(function (c) { return { c: c, k: calcola(c, d.risorse, par) }; });
    var T = { ricavi: 0, materiali: 0, lavoro: 0, oreLavoro: 0, macchine: 0, oreMacchina: 0, energia: 0, kwh: 0, kwhStimati: 0, esterni: 0, trasporti: 0, costoDiretto: 0, margineLordo: 0, costoScarti: 0 };
    righe.forEach(function (x) {
      var k = x.k; T.ricavi += k.ricavo; T.materiali += k.materiali; T.lavoro += k.lavoro; T.oreLavoro += k.oreLavoro; T.macchine += k.macchine; T.oreMacchina += k.oreMacchina;
      T.energia += k.energia; T.kwh += k.kwh; T.kwhStimati += k.kwhStimati; T.esterni += k.esterni; T.trasporti += k.trasporti; T.costoDiretto += k.costoDiretto; T.margineLordo += k.margineLordo; T.costoScarti += k.costoScarti;
    });
    var out = { anno: anno, parametri: par, righe: righe, totali: T, contabile: !!(n && ceCompleto), indiretti: null, riconciliazione: [], errori: 0 };

    // costi indiretti dal conto economico e ribaltamento
    if (out.contabile) {
      var r = M.riclassifica(n, cl);
      out.r = r;
      out.costiOperativi = r.costi_esterni + r.personale + r.ammortamenti_acc;
      out.indiretti = out.costiOperativi - T.costoDiretto;
      var base = function (k) { return par.base === 'ore' ? k.oreLavoro : par.base === 'ricavi' ? k.ricavo : k.costoDiretto; };
      var totBase = righe.reduce(function (s, x) { return s + base(x.k); }, 0);
      out.baseUsata = par.base;
      if (totBase <= 0) { totBase = T.costoDiretto; base = function (k) { return k.costoDiretto; }; out.baseUsata = 'costi_diretti'; }
      righe.forEach(function (x) {
        x.k.quotaIndiretti = totBase > 0 ? out.indiretti * base(x.k) / totBase : 0;
        x.k.margineOperativo = x.k.margineLordo - x.k.quotaIndiretti;
        x.k.margineOperativoPct = div(x.k.margineOperativo, x.k.ricavo);
        x.k.costoPieno = x.k.costoDiretto + x.k.quotaIndiretti;
        x.k.costoPienoUnitario = x.k.pezziBuoni > 0 ? x.k.costoPieno / x.k.pezziBuoni : null;
      });
      out.coefficiente = div(out.indiretti, totBase);

      // riconciliazione gestionale ↔ contabile
      var riga = function (id, voce, gest, cont, nota, tipo) {
        var diff = cont === null ? null : cont - gest, quota = cont ? gest / cont : null, stato = 'ok';
        if (cont !== null && tipo !== 'info') {
          if (gest > cont * 1.01 + 1) stato = 'errore';
          else if (tipo === 'ricavi' && Math.abs(diff) > Math.abs(cont) * 0.01 + 1) stato = 'attenzione';
        }
        if (stato === 'errore') out.errori++;
        out.riconciliazione.push({ id: id, voce: voce, gestionale: gest, contabile: cont, differenza: diff, quota: quota, stato: stato, nota: nota });
      };
      riga('ricavi', 'Ricavi', T.ricavi, num(n.ricavi), 'Ricavi delle commesse rispetto ai ricavi di bilancio. La differenza sono vendite non collegate a una commessa.', 'ricavi');
      riga('materiali', 'Materiali', T.materiali, r.consumi_materie, 'Materiali attribuiti rispetto ai consumi di materie di bilancio. La differenza sono materiali indiretti, scarti non rilevati, sfridi o differenze inventariali.');
      riga('lavoro', 'Lavoro', T.lavoro, r.personale, 'Ore attribuite × costo orario rispetto al costo del personale. La differenza è personale indiretto (uffici, magazzino) e ore non attribuite a commesse.');
      riga('servizi', 'Lavorazioni esterne, trasporti, energia', T.esterni + T.trasporti + T.energia, num(n.servizi), 'Rispetto alla voce servizi di bilancio, che comprende anche utenze, consulenze, manutenzioni e altri servizi generali.');
      riga('macchine', 'Costo orario macchine', T.macchine, num(n.ammortamenti), 'Costo orario delle macchine rispetto agli ammortamenti. Il costo orario può includere manutenzione: il confronto è indicativo.', 'info');
      out.saturazioneLavoro = div(T.lavoro, r.personale);
      // quadratura con il risultato operativo: somma dei margini operativi + ricavi fuori commessa = EBIT
      out.margineOperativoTotale = righe.reduce(function (s, x) { return s + x.k.margineOperativo; }, 0);
      out.fuoriCommessa = r.valore_produzione - T.ricavi;
      out.quadraturaEbit = out.margineOperativoTotale + out.fuoriCommessa - r.ebit;
    }

    // per cliente e per prodotto
    function gruppo(chiave) {
      var g = {};
      righe.forEach(function (x) {
        var nome = String(x.c[chiave] || '').trim() || '(non indicato)';
        var e = g[nome] || (g[nome] = { nome: nome, commesse: 0, ricavi: 0, margineLordo: 0, margineOperativo: 0 });
        e.commesse++; e.ricavi += x.k.ricavo; e.margineLordo += x.k.margineLordo; if (out.contabile) e.margineOperativo += x.k.margineOperativo;
      });
      return Object.keys(g).map(function (k) {
        var e = g[k]; e.quota = div(e.ricavi, T.ricavi); e.margineLordoPct = div(e.margineLordo, e.ricavi); e.margineOperativoPct = out.contabile ? div(e.margineOperativo, e.ricavi) : null; return e;
      }).sort(function (a, b) { return b.ricavi - a.ricavi; });
    }
    out.clienti = gruppo('cliente'); out.prodotti = gruppo('prodotto');
    out.criticita = criticita(out);
    return out;
  }

  // ------------------------------------------------------------ criticità gestionali
  function criticita(a) {
    var eur = M.fmt.eur, pct = M.fmt.pct, par = a.parametri, out = [];
    if (!a.righe.length) return out;
    var mrg = function (k) { return a.contabile ? k.margineOperativo : k.margineLordo; };
    var etichetta = a.contabile ? 'margine operativo (dopo i costi indiretti)' : 'margine lordo (solo costi diretti)';
    var perdite = a.righe.filter(function (x) { return mrg(x.k) < 0; }).sort(function (x, y) { return mrg(x.k) - mrg(y.k); });
    if (perdite.length) {
      var tot = perdite.reduce(function (s, x) { return s + mrg(x.k); }, 0);
      out.push({ id: 'commesse_in_perdita', gravita: 'rosso', peso: -tot, titolo: perdite.length + (perdite.length === 1 ? ' commessa in perdita' : ' commesse in perdita'),
        dati: perdite.slice(0, 4).map(function (x) { return (x.c.codice || '?') + ' ' + (x.c.cliente || '') + ': ricavo ' + eur(x.k.ricavo) + ', ' + etichetta.split(' (')[0] + ' ' + eur(mrg(x.k)); }).join(' · ') + (perdite.length > 4 ? ' · …' : '') + '.',
        causa: 'Prezzo insufficiente rispetto ai costi effettivi, consuntivo superiore al preventivo o scarti elevati: vedi la scheda di ogni commessa.',
        intervento: 'Rivedere il prezzo al prossimo ordine partendo dal costo pieno consuntivo; per le commesse ripetitive verificare tempi e scarti prima di riaccettarle.',
        effetto: 'Perdita complessiva di ' + eur(-tot) + ' sul ' + etichetta + '.' });
    }
    var sotto = a.righe.filter(function (x) { var p = div(mrg(x.k), x.k.ricavo); return mrg(x.k) >= 0 && p !== null && p < par.sogliaMargine; });
    if (sotto.length) {
      var manca = sotto.reduce(function (s, x) { return s + (x.k.ricavo * par.sogliaMargine - mrg(x.k)); }, 0);
      out.push({ id: 'commesse_sotto_soglia', gravita: 'giallo', peso: manca, titolo: sotto.length + ' commesse sotto la soglia di margine del ' + pct(par.sogliaMargine),
        dati: sotto.slice(0, 4).map(function (x) { return (x.c.codice || '?') + ': ' + pct(div(mrg(x.k), x.k.ricavo)); }).join(' · ') + (sotto.length > 4 ? ' · …' : '') + '.',
        causa: 'Marginalità inferiore alla soglia aziendale impostata nei parametri.',
        intervento: 'Confrontare prezzo e costo pieno unitario; valutare aumento di prezzo, riduzione dei tempi o quantità minime.',
        effetto: 'Per portarle alla soglia servono ' + eur(manca) + ' di margine in più.' });
    }
    var sforati = a.righe.filter(function (x) { return x.k.scostamentoPct !== null && x.k.scostamentoPct > 0.10; });
    if (sforati.length) {
      var extra = sforati.reduce(function (s, x) { return s + x.k.scostamento; }, 0);
      out.push({ id: 'preventivi_superati', gravita: 'giallo', peso: extra, titolo: sforati.length + ' commesse con costi oltre il preventivo',
        dati: sforati.slice(0, 4).map(function (x) { return (x.c.codice || '?') + ': +' + pct(x.k.scostamentoPct) + ' (' + eur(x.k.scostamento) + ')'; }).join(' · ') + '.',
        causa: 'Tempi, materiali o lavorazioni esterne superiori a quanto preventivato.',
        intervento: 'Aggiornare i parametri di preventivazione con i consuntivi reali di queste commesse.',
        effetto: 'Costi diretti superiori ai preventivi per ' + eur(extra) + '.' });
    }
    var scarti = a.righe.filter(function (x) { return x.k.scartoPct !== null && x.k.scartoPct > par.sogliaScarti; });
    if (scarti.length) {
      var cs = scarti.reduce(function (s, x) { return s + x.k.costoScarti; }, 0);
      out.push({ id: 'scarti', gravita: 'giallo', peso: cs, titolo: 'Scarti elevati su ' + scarti.length + ' commesse',
        dati: scarti.slice(0, 4).map(function (x) { return (x.c.codice || '?') + ': ' + pct(x.k.scartoPct) + ' di scarto'; }).join(' · ') + '.',
        causa: 'Difetti di lavorazione, materiali o attrezzaggi: servono i dati di produzione per distinguere.',
        intervento: 'Analizzare le cause sulle commesse indicate, partendo da quella con il costo degli scarti più alto.',
        effetto: 'Costo diretto assorbito dai pezzi scartati: circa ' + eur(cs) + '.' });
    }
    var c0 = a.clienti[0];
    if (c0 && c0.quota !== null && c0.quota > par.sogliaCliente && a.clienti.length > 1) {
      out.push({ id: 'concentrazione_clienti', gravita: c0.quota > 0.5 ? 'rosso' : 'giallo', peso: c0.ricavi * 0.1, titolo: 'Dipendenza da un singolo cliente',
        dati: c0.nome + ' vale ' + pct(c0.quota) + ' dei ricavi delle commesse (' + eur(c0.ricavi) + ')' + (a.clienti.length > 2 ? '; i primi tre clienti il ' + pct(a.clienti.slice(0, 3).reduce(function (s, x) { return s + x.quota; }, 0)) : '') + '.',
        causa: 'Portafoglio clienti concentrato.',
        intervento: 'Sviluppare gli altri clienti e verificare condizioni e durata dei rapporti con il cliente principale.',
        effetto: 'La perdita di questo cliente toglierebbe ' + eur(c0.margineLordo) + ' di margine lordo.' });
    }
    if (a.contabile && a.errori) {
      var er = a.riconciliazione.filter(function (x) { return x.stato === 'errore'; });
      out.push({ id: 'riconciliazione', gravita: 'rosso', peso: 1e12, titolo: 'Dati gestionali superiori ai dati di bilancio',
        dati: er.map(function (x) { return x.voce + ': attribuiti ' + eur(x.gestionale) + ', bilancio ' + eur(x.contabile); }).join(' · ') + '.',
        causa: 'Ore o materiali contati due volte, costi orari troppo alti, oppure commesse di un altro esercizio.',
        intervento: 'Correggere i dati delle commesse o i costi orari prima di usare i margini: così come sono, i costi indiretti risultano sottostimati.',
        effetto: 'I margini per commessa non sono affidabili finché la riconciliazione non torna.' });
    }
    if (a.contabile && a.saturazioneLavoro !== null && a.saturazioneLavoro < 0.5 && a.totali.oreLavoro > 0) {
      out.push({ id: 'ore_non_attribuite', gravita: 'giallo', peso: (0.5 - a.saturazioneLavoro) * a.r.personale, titolo: 'Gran parte del costo del lavoro non è attribuita a commesse',
        dati: 'Lavoro attribuito ' + eur(a.totali.lavoro) + ' su ' + eur(a.r.personale) + ' di costo del personale (' + pct(a.saturazioneLavoro) + ').',
        causa: 'Ore non registrate, personale indiretto numeroso oppure capacità non utilizzata: il dato da solo non permette di distinguere.',
        intervento: 'Verificare la completezza della rilevazione delle ore prima di qualsiasi valutazione sull\'organico.',
        effetto: eur(a.r.personale - a.totali.lavoro) + ' di costo del lavoro finiscono nei costi indiretti ribaltati.' });
    }
    out.sort(function (x, y) { return x.gravita === y.gravita ? y.peso - x.peso : (x.gravita === 'rosso' ? -1 : 1); });
    return out;
  }

  // ------------------------------------------------------------ simulazione
  function rng(seme) { var a = seme >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var CLIENTI = ['Alfa Componenti', 'Brianza Design', 'Centro Edile Verbano', 'Delta Automotive', 'Elettro Lario', 'Farmaplast', 'Gamma Arredo', 'Helios Impianti'];
  var QUOTE = [0.34, 0.18, 0.13, 0.10, 0.08, 0.07, 0.06, 0.04];
  var PRODOTTI = { manifatturiera: ['Scocca stampata', 'Coperchio tecnico', 'Supporto rinforzato', 'Contenitore', 'Particolare su disegno'], artigiana: ['Arredo su misura', 'Serramento', 'Riparazione', 'Installazione'],
    servizi: ['Progetto', 'Assistenza annuale', 'Consulenza', 'Formazione'], commerciale: ['Fornitura a listino', 'Fornitura a progetto', 'Ordine quadro'], professionista: ['Incarico', 'Consulenza continuativa', 'Perizia'] };

  /* Genera risorse e commesse coerenti con il bilancio degli ultimi due esercizi dell'azienda:
     i ricavi delle commesse coincidono con i ricavi di bilancio, i costi attribuiti restano entro i costi contabili.
     Due commesse per anno sono costruite in perdita e un cliente pesa il 34%: la diagnosi deve trovarli. */
  function simula(az, seme) {
    var R = rng((seme === undefined || seme === null ? 1 : Number(seme)) + 17);
    var anni = Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }).slice(-2);
    var settore = PRODOTTI[az.settore] ? az.settore : 'manifatturiera', conMacchine = settore === 'manifatturiera' || settore === 'artigiana';
    var ultimo = M.numeri(az.esercizi[anni[anni.length - 1]]);
    var risorse = [{ id: 'p1', nome: 'Operatori di produzione', tipo: 'persona', costoOrario: 24 }, { id: 'p2', nome: 'Tecnici specializzati', tipo: 'persona', costoOrario: 31 }];
    var par = { prezzoKwh: 0.22, sogliaMargine: 0.10, base: 'costi_diretti' };
    if (conMacchine) {
      // ore macchina dimensionate perché l'energia valga circa il 10% dei servizi; costo orario entro gli ammortamenti
      var energia = num(ultimo.servizi) * 0.10, potenze = [45, 30, 15], f = 0.6;
      var oreTot = energia / (par.prezzoKwh * f * (potenze[0] + potenze[1] + potenze[2]) / 3);
      var costoH = oreTot > 0 ? Math.max(1, Math.round(num(ultimo.ammortamenti) * 0.6 / oreTot * 100) / 100) : 5;
      ['Pressa 1', 'Pressa 2', 'Linea di finitura'].forEach(function (nome, i) { risorse.push({ id: 'm' + (i + 1), nome: nome, tipo: 'macchina', costoOrario: Math.round(costoH * [1.3, 1, 0.7][i] * 100) / 100, potenzaKw: potenze[i], fattoreCarico: f }); });
    }
    var elenco = [], prodotti = PRODOTTI[settore];
    anni.forEach(function (anno) {
      var n = M.numeri(az.esercizi[anno]), N = 14;
      var consumi = num(n.materie) + num(n.var_rim_materie);
      var obiettivi = { ricavi: num(n.ricavi), materiali: Math.max(0, consumi) * 0.92, lavoro: num(n.personale) * 0.72, esterni: num(n.servizi) * 0.22, trasporti: num(n.servizi) * 0.05,
        energia: conMacchine ? num(n.servizi) * 0.10 : 0 };
      // pesi: ogni cliente ha una quota, divisa tra le sue commesse
      var pesi = [], cl = [];
      for (var i = 0; i < N; i++) { var ci = i < CLIENTI.length ? i : Math.floor(R() * CLIENTI.length); cl.push(ci); }
      var perCliente = {}; cl.forEach(function (ci) { perCliente[ci] = (perCliente[ci] || 0) + 1; });
      cl.forEach(function (ci) { pesi.push(QUOTE[ci] / perCliente[ci]); });
      var inPerdita = [3, 9];
      var costiOp = consumi + num(n.servizi) + num(n.godimento) + num(n.personale) + num(n.ammortamenti) + num(n.svalutazioni_acc) + num(n.oneri_diversi);
      // moltiplicatore dei costi per le commesse in perdita: più alto dove i margini medi sono ampi
      var mPerdita = Math.min(8, Math.max(1.7, costiOp > 0 ? 1.9 * obiettivi.ricavi / costiOp : 1.7));
      var fattori = pesi.map(function (w, i) { var m = inPerdita.indexOf(i) >= 0 ? mPerdita : 1; return { mat: w * m * (0.8 + R() * 0.4), lav: w * m * (0.8 + R() * 0.4), est: w * m * (0.6 + R() * 0.8), ene: w * m * (0.8 + R() * 0.4) }; });
      var somma = function (k) { return fattori.reduce(function (s, x) { return s + x[k]; }, 0); };
      var S = { mat: somma('mat'), lav: somma('lav'), est: somma('est'), ene: somma('ene') };
      var ricaviAssegnati = 0;
      for (var j = 0; j < N; j++) {
        var fx = fattori[j], ultimoGiro = j === N - 1;
        var ricavo = ultimoGiro ? Math.round(obiettivi.ricavi - ricaviAssegnati) : Math.round(obiettivi.ricavi * pesi[j]);
        ricaviAssegnati += ricavo;
        var lavoro = obiettivi.lavoro * fx.lav / S.lav, quotaTecnici = 0.25 + R() * 0.2;
        var ore = [{ risorsa: 'p1', ore: Math.round(lavoro * (1 - quotaTecnici) / 24) }, { risorsa: 'p2', ore: Math.round(lavoro * quotaTecnici / 31) }];
        if (conMacchine) {
          var kwh = obiettivi.energia * fx.ene / S.ene / par.prezzoKwh, mi = j % 3, mac = risorse[2 + mi];
          var oreM = Math.round(kwh / (mac.potenzaKw * mac.fattoreCarico));
          // una macchina su tre ha il contatore: kWh misurati
          ore.push(mi === 0 ? { risorsa: mac.id, ore: oreM, kwh: Math.round(kwh * (0.95 + R() * 0.1)) } : { risorsa: mac.id, ore: oreM });
        }
        var scarto = inPerdita.indexOf(j) >= 0 ? 0.12 : 0.01 + R() * 0.03, qOrd = Math.round((500 + R() * 15000) / 50) * 50;
        var c = { id: 'c' + anno + '-' + (j + 1), codice: String(anno).slice(2) + '/' + String(j + 1).padStart(3, '0'), anno: anno, cliente: CLIENTI[cl[j]], prodotto: prodotti[Math.floor(R() * prodotti.length)], stato: 'chiusa',
          qOrdinata: qOrd, qProdotta: Math.round(qOrd / (1 - scarto)), qScartata: Math.round(qOrd / (1 - scarto)) - qOrd, ricavo: ricavo,
          materiali: Math.round(obiettivi.materiali * fx.mat / S.mat), esterni: Math.round(obiettivi.esterni * fx.est / S.est), trasporti: Math.round(obiettivi.trasporti * pesi[j]), ore: ore, origine: 'simulato' };
        var k = calcola(c, risorse, par);
        c.preventivo = { costo: Math.round(k.costoDiretto / (inPerdita.indexOf(j) >= 0 ? 1.45 : 0.97 + R() * 0.1)) };
        elenco.push(c);
      }
    });
    return { risorse: risorse, parametri: par, elenco: elenco, simulato: true };
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az);
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    var anni = d.elenco.map(function (c) { return Number(c.anno); }).filter(function (a, i, s) { return s.indexOf(a) === i; }).sort();
    anni.forEach(function (anno) {
      var n = az.esercizi[anno] ? M.numeri(az.esercizi[anno]) : null, completo = !!n && M.mancantiSezione(n, 'ce').length === 0;
      var a = analisi(az, anno, n, completo), T = a.totali, eur = M.fmt.eur;
      var sommaDiretti = a.righe.reduce(function (s, x) { return s + x.k.materiali + x.k.lavoro + x.k.macchine + x.k.energia + x.k.esterni + x.k.trasporti; }, 0);
      t(anno + ' · commesse: le componenti sommano al costo diretto', Math.abs(sommaDiretti - T.costoDiretto) < 0.01, a.righe.length + ' commesse, costo diretto ' + eur(T.costoDiretto));
      t(anno + ' · commesse: ricavi − costi diretti = margine lordo', Math.abs(T.ricavi - T.costoDiretto - T.margineLordo) < 0.01, 'Margine lordo ' + eur(T.margineLordo));
      t(anno + ' · commesse: nessuna risorsa inesistente nelle ore', a.righe.every(function (x) { return x.k.risorseMancanti === 0; }), '');
      if (!a.contabile) { t(anno + ' · commesse: bilancio disponibile per la riconciliazione', false, 'Conto economico mancante o incompleto'); return; }
      var quote = a.righe.reduce(function (s, x) { return s + x.k.quotaIndiretti; }, 0);
      t(anno + ' · commesse: i costi indiretti sono ribaltati per intero', Math.abs(quote - a.indiretti) < 0.5, 'Indiretti ' + eur(a.indiretti));
      t(anno + ' · commesse: margini operativi + ricavi fuori commessa = EBIT', Math.abs(a.quadraturaEbit) < 0.5, 'Differenza ' + eur(a.quadraturaEbit));
      t(anno + ' · commesse: costi attribuiti entro i costi di bilancio', a.errori === 0, a.riconciliazione.filter(function (x) { return x.stato === 'errore'; }).map(function (x) { return x.voce; }).join(', ') || 'Nessuna voce gestionale supera la voce contabile');
      if (d.simulato) {
        var ids = a.criticita.map(function (x) { return x.id; });
        t(anno + ' · commesse simulate: ricavi uguali al bilancio', Math.abs(T.ricavi - num(n.ricavi)) < 1, eur(T.ricavi) + ' / ' + eur(num(n.ricavi)));
        t(anno + ' · commesse simulate: le commesse in perdita vengono trovate', ids.indexOf('commesse_in_perdita') >= 0, ids.join(', '));
        t(anno + ' · commesse simulate: la concentrazione sul primo cliente viene trovata', ids.indexOf('concentrazione_clienti') >= 0, ids.join(', '));
      }
    });
    return esiti;
  }

  return { PARAMETRI: PARAMETRI, BASI: BASI, vuoto: vuoto, dati: dati, parametri: parametri, calcola: calcola, analisi: analisi, criticita: criticita, simula: simula, collaudo: collaudo };
});
