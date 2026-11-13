/* Timone · modulo Decisioni produttive e scorte
   "Conviene continuare a produrre o fermare temporaneamente?"
   Funzioni pure. Per una linea o un prodotto, su un orizzonte di alcuni mesi, simula mese per mese sei alternative:
   continuare, ridurre, produrre solo su ordinazione, produrre in anticipo e poi fermare, fermare temporaneamente,
   esternalizzare. Per ciascuna calcola risultato economico, effetto sulla cassa, scorte e capitale immobilizzato.
   Distingue sempre i costi fissi evitabili con il fermo da quelli che restano comunque.
   I dati del caso (ordini, previsioni, costi) sono inseriti dall'utente: il modulo non li stima. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Decisioni = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var SCENARI = { continuare: 'Continuare a pieno ritmo', ridurre: 'Ridurre la produzione', ordinazione: 'Produrre solo su ordinazione', anticipare: 'Produrre in anticipo, poi fermare', fermare: 'Fermare temporaneamente', esternalizzare: 'Esternalizzare' };
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function z(x) { return num(x) || 0; }
  function vuoto() { return { casi: [] }; }
  function dati(az) { var d = az.decisioni || vuoto(); d.casi = d.casi || []; return d; }

  function valida(c) {
    var e = [];
    if (!(z(c.mesi) >= 1 && z(c.mesi) <= 36)) e.push('L\'orizzonte deve essere tra 1 e 36 mesi.');
    if (!(z(c.capacitaMese) > 0)) e.push('Manca la capacità produttiva mensile.');
    if (num(c.prezzo) === null || c.prezzo < 0) e.push('Manca il prezzo di vendita unitario.');
    if (num(c.costoVariabile) === null || c.costoVariabile < 0) e.push('Manca il costo variabile unitario.');
    if (num(c.ordiniConfermati) === null && num(c.previsioneVendite) === null) e.push('Servono gli ordini confermati o una previsione di vendita.');
    return e;
  }

  /* Simulazione mese per mese. piano(m, stato) restituisce {produzione, esterni, fermo} per il mese m (1..N).
     La domanda è distribuita in modo uniforme; ciò che non si riesce a consegnare nel mese è una vendita persa. */
  function simula(c, domandaTotale, piano, unaTantum) {
    var N = Math.round(c.mesi), cv = z(c.costoVariabile), dm = domandaTotale / N, fissi = z(c.costiFissiMese), ev = Math.max(0, Math.min(1, z(c.quotaEvitabile)));
    var mant = z(c.costoMantenimento) / 12, fin = z(c.tassoFinanziario) / 12, pe = z(c.prezzoEsterno);
    var o = { mesi: [], prodotti: 0, esterni: 0, venduti: 0, perse: 0, ricavi: 0, costiVariabili: 0, costoEsterni: 0, fissi: 0, fissiEvitati: 0, mantenimento: 0, finanziario: 0, mesiFermo: 0, scortaMax: z(c.scortaIniziale) };
    var scorta = z(c.scortaIniziale), stato = { scorta: scorta, prodottiFinora: 0, domandaResidua: domandaTotale, dm: dm };
    for (var m = 1; m <= N; m++) {
      stato.scorta = scorta; stato.mese = m;
      var p = piano(m, stato) || {}, prod = Math.max(0, Math.min(z(c.capacitaMese), z(p.produzione))), ext = Math.max(0, z(p.esterni)), fermo = !!p.fermo;
      if (fermo) prod = 0;
      var inizio = scorta, disp = scorta + prod + ext, vend = Math.min(dm, disp);
      scorta = disp - vend;
      var media = (inizio + scorta) / 2, f = fermo ? fissi * (1 - ev) : fissi;
      o.prodotti += prod; o.esterni += ext; o.venduti += vend; o.perse += dm - vend; o.ricavi += vend * z(c.prezzo); o.costiVariabili += prod * cv; o.costoEsterni += ext * pe;
      o.fissi += f; if (fermo) { o.fissiEvitati += fissi * ev; o.mesiFermo++; }
      o.mantenimento += media * cv * mant; o.finanziario += media * cv * fin; o.scortaMax = Math.max(o.scortaMax, scorta);
      stato.prodottiFinora += prod + ext; stato.domandaResidua -= dm;
      o.mesi.push({ mese: m, produzione: prod, esterni: ext, vendite: vend, perse: dm - vend, scorta: scorta, fermo: fermo });
    }
    o.scortaFinale = scorta; o.unaTantum = z(unaTantum);
    // le scorte sono valorizzate al costo variabile; per gli acquisti esterni al loro prezzo
    var valoreUnit = cv, variazioneScorte = (scorta - z(c.scortaIniziale)) * valoreUnit;
    o.capitaleFinale = scorta * valoreUnit; o.capitaleMax = o.scortaMax * valoreUnit;
    o.obsolescenza = scorta * valoreUnit * Math.max(0, Math.min(1, z(c.rischioObsolescenza)));
    o.cassa = o.ricavi - o.costiVariabili - o.costoEsterni - o.fissi - o.unaTantum - o.mantenimento;
    o.economico = o.cassa + variazioneScorte - o.finanziario - o.obsolescenza;
    o.variazioneScorte = variazioneScorte; o.marginePerso = o.perse * (z(c.prezzo) - cv);
    return o;
  }

  // ------------------------------------------------------------ le sei alternative
  function scenari(c, domanda) {
    var N = Math.round(c.mesi), cap = z(c.capacitaMese), stop = z(c.costoFermo), riavvio = z(c.costoRiavvio), out = {};
    var suOrdine = function (m, s) { return { produzione: Math.max(0, s.dm - s.scorta) }; };
    out.continuare = simula(c, domanda, function () { return { produzione: cap }; }, 0);
    var rid = num(c.riduzione) === null ? 0.5 : Math.max(0, Math.min(1, c.riduzione));
    out.ridurre = simula(c, domanda, function () { return { produzione: cap * rid }; }, 0); out.ridurre.ritmo = rid;
    out.ordinazione = simula(c, domanda, suOrdine, 0);
    // produrre a pieno ritmo finché scorta + produzione coprono tutta la domanda dell'orizzonte, poi fermare
    var fermato = false;
    out.anticipare = simula(c, domanda, function (m, s) { if (s.scorta >= s.domandaResidua - 1e-9) { fermato = true; return { fermo: true }; } return { produzione: Math.min(cap, s.domandaResidua - s.scorta) }; }, 0);
    if (fermato) out.anticipare.unaTantum = stop + riavvio; ricalcola(out.anticipare, stop + riavvio, fermato);
    // fermare per i primi mesi indicati, vendendo dalle scorte, poi produrre su ordinazione
    var mf = Math.max(0, Math.min(N, Math.round(num(c.mesiFermo) === null ? N : c.mesiFermo)));
    out.fermare = simula(c, domanda, function (m, s) { return m <= mf ? { fermo: true } : suOrdine(m, s); }, mf > 0 ? stop + riavvio : 0); out.fermare.mesiPrevisti = mf;
    // esternalizzare: linea ferma per tutto l'orizzonte, acquisto all'esterno di ciò che serve
    if (num(c.prezzoEsterno) !== null && c.prezzoEsterno > 0) out.esternalizzare = simula(c, domanda, function (m, s) { return { fermo: true, esterni: Math.max(0, s.dm - s.scorta) }; }, stop + riavvio);
    return out;
  }
  function ricalcola(o, unaTantum, applica) { if (!applica) return; o.cassa -= unaTantum; o.economico -= unaTantum; }

  // ------------------------------------------------------------ analisi di un caso
  function analizza(c) {
    var err = valida(c); if (err.length) return { valido: false, errori: err };
    var ordini = z(c.ordiniConfermati), prev = z(c.previsioneVendite), domanda = ordini + prev, N = Math.round(c.mesi);
    var o = { valido: true, mesi: N, domanda: domanda, ordini: ordini, previsione: prev, capacita: z(c.capacitaMese) * N, margineUnitario: z(c.prezzo) - z(c.costoVariabile) };
    o.saturazione = o.capacita > 0 ? domanda / o.capacita : null;
    o.fissiEvitabiliMese = z(c.costiFissiMese) * Math.max(0, Math.min(1, z(c.quotaEvitabile))); o.fissiInevitabiliMese = z(c.costiFissiMese) - o.fissiEvitabiliMese;
    o.mesiPareggioFermo = o.fissiEvitabiliMese > 0 ? (z(c.costoFermo) + z(c.costoRiavvio)) / o.fissiEvitabiliMese : null;   // mesi di fermo necessari a ripagare fermo e riavvio
    o.scenari = scenari(c, domanda);
    function classifica(S) { return Object.keys(S).map(function (k) { return { id: k, s: S[k] }; }).sort(function (a, b) { return b.s.economico - a.s.economico; }); }
    o.classifica = classifica(o.scenari); o.migliore = o.classifica[0].id;
    var base = o.scenari.continuare; o.classifica.forEach(function (x) { x.delta = x.s.economico - base.economico; x.deltaCassa = x.s.cassa - base.cassa; });
    o.miglioreCassa = Object.keys(o.scenari).sort(function (a, b) { return o.scenari[b].cassa - o.scenari[a].cassa; })[0];
    // e se le previsioni non si realizzano? stessi scenari con i soli ordini confermati
    if (prev > 0 && ordini > 0) { var S2 = scenari(c, ordini), c2 = classifica(S2); o.soloOrdini = { scenari: S2, migliore: c2[0].id, classifica: c2, cambia: c2[0].id !== o.migliore }; }
    o.avvisi = [];
    if (o.margineUnitario <= 0) o.avvisi.push('Il prezzo non copre il costo variabile: ogni unità prodotta e venduta peggiora il risultato di ' + M.fmt.eur(-o.margineUnitario) + ', a qualsiasi volume.');
    if (o.saturazione !== null && o.saturazione > 1) o.avvisi.push('La domanda supera la capacità: anche a pieno ritmo restano vendite non servite.');
    if (prev > 0 && ordini === 0) o.avvisi.push('Non ci sono ordini confermati: tutto il risultato dipende dalla previsione di vendita.');
    if (num(c.quotaEvitabile) === null && z(c.costiFissiMese) > 0) o.avvisi.push('Non è indicata la quota di costi fissi evitabile con il fermo: è considerata zero, quindi fermare non fa risparmiare costi fissi.');
    return o;
  }
  function analisi(az) { return dati(az).casi.map(function (c) { return { c: c, k: analizza(c) }; }); }

  // ------------------------------------------------------------ simulazione
  /* Due casi per le aziende che producono: uno con domanda debole e scorte alte (continuare non è la scelta migliore),
     uno con domanda piena (continuare è la scelta migliore). */
  function simulaCasi(az) {
    if (az.settore !== 'manifatturiera' && az.settore !== 'artigiana') return vuoto();
    var anni = Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }), n = M.numeri(az.esercizi[anni[anni.length - 1]]), r = M.riclassifica(n, az.classificazione);
    if (!(r.ricavi > 50000)) return vuoto();
    var prezzo = 2, cvQuota = Math.min(0.85, Math.max(0.3, r.valore_produzione > 0 ? r.costi_variabili / r.valore_produzione : 0.6)), cap = Math.round(r.ricavi * 0.4 / prezzo / 12 / 100) * 100, fissi = Math.round(Math.max(0, r.costi_fissi) * 0.3 / 12 / 100) * 100;
    var base = { prezzo: prezzo, costoVariabile: Math.round(prezzo * cvQuota * 100) / 100, capacitaMese: cap, costiFissiMese: fissi, quotaEvitabile: 0.4, costoFermo: Math.round(fissi * 0.3), costoRiavvio: Math.round(fissi * 0.5), costoMantenimento: 0.04, tassoFinanziario: 0.06, rischioObsolescenza: 0.10, riduzione: 0.5, origine: 'simulato' };
    return { simulato: true, casi: [
      Object.assign({ id: 'sd-1', nome: 'Linea 2 · domanda debole', mesi: 6, ordiniConfermati: Math.round(cap * 6 * 0.25), previsioneVendite: Math.round(cap * 6 * 0.15), scortaIniziale: Math.round(cap * 1.5), mesiFermo: 3, prezzoEsterno: Math.round(prezzo * 0.92 * 100) / 100 }, base),
      Object.assign({ id: 'sd-2', nome: 'Linea 1 · domanda piena', mesi: 6, ordiniConfermati: Math.round(cap * 6 * 0.9), previsioneVendite: Math.round(cap * 6 * 0.15), scortaIniziale: Math.round(cap * 0.2), mesiFermo: 1 }, base)] };
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az);
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    var validi = analisi(az).filter(function (x) { return x.k.valido; }); if (!validi.length) return esiti;
    var ogni = function (f) { return validi.every(function (x) { return Object.keys(x.k.scenari).every(function (id) { return f(x.k.scenari[id], x.c, x.k, id); }); }); };
    t('decisioni: scorta iniziale + prodotto + acquistato − venduto = scorta finale', ogni(function (s, c) { return Math.abs(z(c.scortaIniziale) + s.prodotti + s.esterni - s.venduti - s.scortaFinale) < 1e-6; }), validi.length + ' casi, ' + validi.reduce(function (n, x) { return n + Object.keys(x.k.scenari).length; }, 0) + ' scenari');
    t('decisioni: venduto + vendite perse = domanda', ogni(function (s, c, k) { return Math.abs(s.venduti + s.perse - k.domanda) < 1e-6; }), '');
    t('decisioni: risultato economico = cassa + variazione scorte − costo finanziario − obsolescenza', ogni(function (s) { return Math.abs(s.economico - (s.cassa + s.variazioneScorte - s.finanziario - s.obsolescenza)) < 1e-6; }), '');
    t('decisioni: costi fissi pagati + evitati = costi fissi dell\'orizzonte', ogni(function (s, c, k) { return Math.abs(s.fissi + s.fissiEvitati - z(c.costiFissiMese) * k.mesi) < 1e-6; }), '');
    t('decisioni: mai prodotto oltre la capacità', ogni(function (s, c, k) { return s.prodotti <= k.capacita + 1e-6; }), '');
    t('decisioni: su ordinazione non si accumulano scorte', validi.every(function (x) { return x.k.scenari.ordinazione.scortaFinale <= Math.max(z(x.c.scortaIniziale), 0) + 1e-6; }), '');
    if (d.simulato && d.casi.length === 2) {
      var k1 = validi.filter(function (x) { return x.c.id === 'sd-1'; })[0].k, k2 = validi.filter(function (x) { return x.c.id === 'sd-2'; })[0].k;
      t('decisioni simulate: con domanda debole continuare a pieno ritmo non è la scelta migliore', k1.migliore !== 'continuare', SCENARI[k1.migliore]);
      t('decisioni simulate: con domanda piena fermare non è la scelta migliore', k2.migliore !== 'fermare' && k2.migliore !== 'esternalizzare' && k2.scenari.fermare.economico < k2.scenari.ordinazione.economico, SCENARI[k2.migliore]);
    }
    return esiti;
  }

  return { SCENARI: SCENARI, vuoto: vuoto, dati: dati, valida: valida, simula: simula, scenari: scenari, analizza: analizza, analisi: analisi, simulaCasi: simulaCasi, collaudo: collaudo };
});
