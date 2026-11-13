/* Timone · modulo Energia e utenze
   Funzioni pure. Parte dalle bollette mensili (elettricità, gas, acqua, altri combustibili) e risponde a:
   quanto si consuma e quanto costa davvero ogni unità, com'è composta la spesa, dove ci sono consumi anomali,
   se la potenza impegnata è adeguata, se un'offerta inserita dall'utente conviene sul costo complessivo.
   Gli importi sono IVA esclusa. I mesi mancanti non vengono stimati né riportati all'anno.
   Le offerte dei fornitori sono inserite dall'utente con fonte e data: il modulo non le cerca da solo. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Energia = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var VETTORI = { elettricita: { nome: 'Energia elettrica', unita: 'kWh' }, gas: { nome: 'Gas', unita: 'Smc' }, acqua: { nome: 'Acqua', unita: 'm³' }, altro: { nome: 'Altri combustibili', unita: 'unità' } };
  var USI = { produzione: 'Produzione', uffici: 'Uffici', magazzino: 'Magazzino', riscaldamento: 'Riscaldamento', raffrescamento: 'Raffrescamento', misto: 'Uso misto' };
  var PARAMETRI = { sogliaAnomaliaAnno: 0.25, sogliaAnomaliaMediana: 0.40, sogliaPotenza: 0.70, giorniValiditaOfferta: 30, giorniAvvisoScadenza: 90 };
  var MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function z(x) { return num(x) || 0; }
  function div(a, b) { return (isFinite(a) && isFinite(b) && b !== 0) ? a / b : null; }
  function vuoto() { return { parametri: {}, utenze: [], bollette: [], offerte: [] }; }
  function dati(az) { var d = az.energia || vuoto(); d.parametri = d.parametri || {}; d.utenze = d.utenze || []; d.bollette = d.bollette || []; d.offerte = d.offerte || []; return d; }
  function parametri(d) { return Object.assign({}, PARAMETRI, d.parametri || {}); }
  function giorniTra(a, b) { var x = Date.parse(a), y = Date.parse(b); return (isFinite(x) && isFinite(y)) ? Math.round((y - x) / 86400000) : null; }
  function mediana(v) { var s = v.slice().sort(function (a, b) { return a - b; }), m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; }

  // una bolletta ha il dettaglio se riporta le quattro componenti; in quel caso devono sommare al totale
  function bolletta(b) {
    var det = ['materia', 'trasporto', 'oneri', 'imposte'].every(function (k) { return num(b[k]) !== null; });
    var somma = det ? b.materia + b.trasporto + b.oneri + b.imposte : null, tot = num(b.totale);
    if (tot === null && det) tot = somma;
    return { dettaglio: det, totale: tot, coerente: !det || tot === null || Math.abs(somma - tot) <= Math.max(1, Math.abs(tot) * 0.005), consumo: num(b.consumo) };
  }

  // mesi (1-12) → {consumo, spesa, materia…} per un'utenza in un anno
  function perMese(d, utenzaId, anno) {
    var m = {};
    d.bollette.forEach(function (b) {
      if (b.utenza !== utenzaId || Number(b.anno) !== Number(anno)) return;
      var k = bolletta(b), mese = Number(b.mese);
      if (!(mese >= 1 && mese <= 12)) return;
      var e = m[mese] || (m[mese] = { consumo: 0, spesa: 0, materia: 0, trasporto: 0, oneri: 0, imposte: 0, dettaglio: true, f1: 0, f2: 0, f3: 0, fasce: false, potenzaMax: null, consumoPresente: true, incoerenti: 0 });
      if (k.consumo === null) e.consumoPresente = false; else e.consumo += k.consumo;
      e.spesa += z(k.totale);
      if (k.dettaglio) { e.materia += b.materia; e.trasporto += b.trasporto; e.oneri += b.oneri; e.imposte += b.imposte; } else e.dettaglio = false;
      if (!k.coerente) e.incoerenti++;
      if (num(b.f1) !== null || num(b.f2) !== null || num(b.f3) !== null) { e.fasce = true; e.f1 += z(b.f1); e.f2 += z(b.f2); e.f3 += z(b.f3); }
      if (num(b.potenzaMax) !== null) e.potenzaMax = Math.max(e.potenzaMax === null ? 0 : e.potenzaMax, b.potenzaMax);
    });
    return m;
  }

  // ------------------------------------------------------------ analisi dell'anno
  function analisi(az, anno, n, ceCompleto, oggi) {
    var d = dati(az), par = parametri(d);
    oggi = oggi || new Date().toISOString().slice(0, 10);
    var out = { anno: anno, parametri: par, presente: false, vettori: {}, usi: {}, utenze: [], anomalie: [], offerte: [], potenza: [], scadenze: [], incoerenti: 0, spesaTotale: 0, criticita: [] };
    function nuovo() { return { consumo: 0, spesa: 0, materia: 0, trasporto: 0, oneri: 0, imposte: 0, dettaglio: true, mesi: {}, utenzeMesi: 0, utenze: 0, f1: 0, f2: 0, f3: 0, fasce: false, senzaConsumo: 0, prec: { consumo: 0, spesa: 0, mesi: 0 } }; }
    d.utenze.forEach(function (u) {
      var m = perMese(d, u.id, anno), mp = perMese(d, u.id, anno - 1), mesi = Object.keys(m).map(Number).sort(function (a, b) { return a - b; });
      if (!mesi.length) return;
      out.presente = true;
      var vet = VETTORI[u.vettore] ? u.vettore : 'altro', V = out.vettori[vet] || (out.vettori[vet] = nuovo());
      var U = { u: u, vettore: vet, mesi: m, mesiPresenti: mesi.length, consumo: 0, spesa: 0, potenzaMax: null };
      V.utenze++;
      mesi.forEach(function (k) {
        var e = m[k];
        U.consumo += e.consumo; U.spesa += e.spesa; V.consumo += e.consumo; V.spesa += e.spesa; V.utenzeMesi++;
        if (e.dettaglio) { V.materia += e.materia; V.trasporto += e.trasporto; V.oneri += e.oneri; V.imposte += e.imposte; } else V.dettaglio = false;
        if (!e.consumoPresente) V.senzaConsumo++;
        if (e.fasce) { V.fasce = true; V.f1 += e.f1; V.f2 += e.f2; V.f3 += e.f3; }
        if (e.potenzaMax !== null) U.potenzaMax = Math.max(U.potenzaMax === null ? 0 : U.potenzaMax, e.potenzaMax);
        var vm = V.mesi[k] || (V.mesi[k] = { consumo: 0, spesa: 0 }); vm.consumo += e.consumo; vm.spesa += e.spesa;
        out.incoerenti += e.incoerenti;
        // confronto con lo stesso mese dell'anno precedente (solo mesi presenti in entrambi gli anni)
        if (mp[k]) { V.prec.consumo += mp[k].consumo; V.prec.spesa += mp[k].spesa; V.prec.mesi++; V.prec.consumoOra = (V.prec.consumoOra || 0) + e.consumo; V.prec.spesaOra = (V.prec.spesaOra || 0) + e.spesa; }
      });
      U.costoMedio = div(U.spesa, U.consumo);
      var uso = USI[u.uso] ? u.uso : 'misto', G = out.usi[vet + '|' + uso] || (out.usi[vet + '|' + uso] = { vettore: vet, uso: uso, consumo: 0, spesa: 0 });
      G.consumo += U.consumo; G.spesa += U.spesa;
      out.utenze.push(U);

      // consumi anomali: prima contro lo stesso mese dell'anno precedente, altrimenti contro la mediana dell'anno
      var valori = mesi.filter(function (k) { return m[k].consumoPresente; }).map(function (k) { return m[k].consumo; }), med = valori.length >= 6 ? mediana(valori) : null;
      mesi.forEach(function (k) {
        var e = m[k]; if (!e.consumoPresente) return;
        var rif = null, tipo = null;
        if (mp[k] && mp[k].consumoPresente && mp[k].consumo > 0) { if (e.consumo > mp[k].consumo * (1 + par.sogliaAnomaliaAnno)) { rif = mp[k].consumo; tipo = 'stesso mese del ' + (anno - 1); } }
        else if (med && (vet === 'elettricita' || vet === 'acqua') && e.consumo > med * (1 + par.sogliaAnomaliaMediana)) { rif = med; tipo = 'mediana dell\'anno'; }
        if (rif !== null) out.anomalie.push({ utenza: u, vettore: vet, mese: k, consumo: e.consumo, riferimento: rif, tipo: tipo, scarto: e.consumo / rif - 1, costo: (e.consumo - rif) * (div(e.spesa, e.consumo) || 0) });
      });
      // potenza impegnata rispetto alla potenza massima prelevata
      var pi = u.contratto ? num(u.contratto.potenza) : null;
      if (pi && U.potenzaMax !== null) {
        if (U.potenzaMax > pi) out.potenza.push({ utenza: u, tipo: 'superata', impegnata: pi, massima: U.potenzaMax });
        else if (U.potenzaMax < pi * par.sogliaPotenza && mesi.length >= 6) out.potenza.push({ utenza: u, tipo: 'eccessiva', impegnata: pi, massima: U.potenzaMax });
      }
      var sc = u.contratto && u.contratto.scadenza ? giorniTra(oggi, u.contratto.scadenza) : null;
      if (sc !== null && sc >= 0 && sc <= par.giorniAvvisoScadenza) out.scadenze.push({ utenza: u, giorni: sc, data: u.contratto.scadenza });
    });
    if (!out.presente) return out;
    Object.keys(out.vettori).forEach(function (k) {
      var V = out.vettori[k];
      V.costoMedio = V.senzaConsumo ? null : div(V.spesa, V.consumo); V.costoMateria = (V.dettaglio && !V.senzaConsumo) ? div(V.materia, V.consumo) : null;
      V.completo = V.utenzeMesi === V.utenze * 12;
      if (V.prec.mesi) { V.varConsumo = div(V.prec.consumoOra - V.prec.consumo, V.prec.consumo); var c0 = div(V.prec.spesa, V.prec.consumo), c1 = div(V.prec.spesaOra, V.prec.consumoOra); V.costoPrec = c0; V.varCosto = (c0 && c1) ? c1 / c0 - 1 : null; }
      out.spesaTotale += V.spesa;
    });
    out.anomalie.sort(function (a, b) { return b.costo - a.costo; });

    // offerte inserite dall'utente: confronto sul costo complessivo della parte che cambia con il fornitore
    d.offerte.forEach(function (o) {
      var V = out.vettori[o.vettore]; if (!V) return;
      var r = { o: o, calcolabile: V.dettaglio && !V.senzaConsumo && V.consumo > 0, eta: o.data ? giorniTra(o.data, oggi) : null };
      r.daRiverificare = r.eta === null || r.eta > par.giorniValiditaOfferta;
      if (r.calcolabile) {
        r.attuale = V.materia;
        r.costo = V.consumo * z(o.prezzo) + z(o.fissoMese) * V.utenzeMesi;
        r.risparmio = r.attuale - r.costo;
        r.penali = d.utenze.filter(function (u) { return (VETTORI[u.vettore] ? u.vettore : 'altro') === o.vettore && u.contratto && u.contratto.scadenza && giorniTra(oggi, u.contratto.scadenza) > 0; }).reduce(function (s, u) { return s + z(u.contratto.penale); }, 0);
        r.netto = r.risparmio - z(o.costiCambio) - r.penali;
        r.conviene = r.netto > 0;
        r.totaleDopo = V.spesa - r.risparmio;
      }
      out.offerte.push(r);
    });
    out.offerte.sort(function (a, b) { return (b.netto === undefined ? -1e18 : b.netto) - (a.netto === undefined ? -1e18 : a.netto); });

    // rapporto con il bilancio (il conto economico non separa l'energia: sta nei servizi)
    out.contabile = !!(n && ceCompleto);
    if (out.contabile) { var r0 = M.riclassifica(n, az.classificazione); out.incidenzaProduzione = div(out.spesaTotale, r0.valore_produzione); out.quotaServizi = div(out.spesaTotale, z(n.servizi)); out.oltreServizi = out.spesaTotale > z(n.servizi) * 1.01 + 1; out.servizi = z(n.servizi); }
    // collegamento con le commesse: prezzo del kWh usato e kWh attribuiti
    var E = out.vettori.elettricita;
    if (E && E.costoMedio && az.commesse && az.commesse.elenco && az.commesse.elenco.length) {
      var prezzo = (az.commesse.parametri && num(az.commesse.parametri.prezzoKwh) !== null) ? az.commesse.parametri.prezzoKwh : 0.22, kwh = 0, R = {};
      (az.commesse.risorse || []).forEach(function (x) { R[x.id] = x; });
      az.commesse.elenco.forEach(function (c) { if (Number(c.anno) !== Number(anno)) return; (c.ore || []).forEach(function (o) { var x = R[o.risorsa]; if (!x || x.tipo !== 'macchina') return; kwh += num(o.kwh) !== null ? o.kwh : z(o.ore) * z(x.potenzaKw) * (num(x.fattoreCarico) === null ? 1 : x.fattoreCarico); }); });
      var prod = out.utenze.filter(function (U) { return U.vettore === 'elettricita' && (U.u.uso === 'produzione' || U.u.uso === 'misto'); }).reduce(function (s, U) { return s + U.consumo; }, 0);
      out.commesse = { prezzoUsato: prezzo, prezzoReale: E.costoMedio, scarto: prezzo / E.costoMedio - 1, kwhAttribuiti: kwh, kwhProduzione: prod, quota: div(kwh, prod) };
    }
    out.criticita = criticita(out);
    return out;
  }

  function criticita(a) {
    var eur = M.fmt.eur, pct = M.fmt.pct, out = [], n3 = function (x) { return x === null ? '—' : (Math.round(x * 1000) / 1000).toFixed(3).replace('.', ','); };
    if (a.incoerenti) out.push({ id: 'bollette_incoerenti', gravita: 'rosso', peso: 1e12, titolo: a.incoerenti + ' bollette con componenti che non sommano al totale',
      dati: 'Materia, trasporto, oneri e imposte non corrispondono al totale inserito.', causa: 'Errore di inserimento oppure voci della bolletta non riportate (conguagli, ricalcoli, altre partite).',
      intervento: 'Correggere le bollette segnalate nell\'elenco prima di usare la composizione della spesa e il confronto delle offerte.', effetto: 'Il confronto con le offerte usa la componente materia: se è sbagliata, il risparmio calcolato non è affidabile.' });
    if (a.oltreServizi) out.push({ id: 'energia_bilancio', gravita: 'rosso', peso: 1e11, titolo: 'La spesa per utenze supera i costi per servizi di bilancio',
      dati: 'Bollette ' + eur(a.spesaTotale) + ', servizi di bilancio ' + eur(a.servizi) + '.', causa: 'Bollette di un altro periodo, importi IVA inclusa, oppure utenze contabilizzate in un\'altra voce.',
      intervento: 'Verificare periodo e importi (IVA esclusa) delle bollette.', effetto: 'Finché non torna, incidenze e confronti con il bilancio non sono affidabili.' });
    if (a.anomalie.length) { var tot = a.anomalie.reduce(function (s, x) { return s + x.costo; }, 0);
      out.push({ id: 'consumi_anomali', gravita: 'giallo', peso: tot, titolo: a.anomalie.length + (a.anomalie.length === 1 ? ' mese con consumi anomali' : ' mesi con consumi anomali'),
        dati: a.anomalie.slice(0, 4).map(function (x) { return x.utenza.nome + ' ' + MESI[x.mese - 1] + ': +' + pct(x.scarto) + ' rispetto a ' + x.tipo; }).join(' · ') + '.',
        causa: 'Più produzione, perdite (aria compressa, acqua), impianti lasciati accesi, guasti, clima, oppure conguagli in bolletta: i dati mensili non permettono di distinguere.',
        intervento: 'Confrontare con produzione e ore lavorate del mese; se non c\'è una spiegazione, verificare impianti e contatore.',
        effetto: 'Consumo in eccesso rispetto al riferimento per circa ' + eur(tot) + '.' }); }
    Object.keys(a.vettori).forEach(function (k) { var V = a.vettori[k];
      if (V.varCosto !== null && V.varCosto !== undefined && V.varCosto > 0.15) out.push({ id: 'costo_unitario_' + k, gravita: 'giallo', peso: V.varCosto * V.spesa / (1 + V.varCosto), titolo: VETTORI[k].nome + ': costo unitario in forte aumento',
        dati: 'Da ' + n3(V.costoPrec) + ' a ' + n3(div(V.prec.spesaOra, V.prec.consumoOra)) + ' € per ' + VETTORI[k].unita + ' (+' + pct(V.varCosto) + ') sugli stessi mesi dell\'anno precedente.',
        causa: 'Prezzi di mercato, rinnovo del contratto a condizioni peggiori, aumento di oneri e imposte.', intervento: 'Confrontare il contratto con le offerte disponibili e verificare la scadenza.',
        effetto: 'A consumi invariati, circa ' + eur(V.varCosto * V.spesa / (1 + V.varCosto)) + ' di spesa in più.' }); });
    var buone = a.offerte.filter(function (x) { return x.calcolabile && x.conviene; });
    if (buone.length) { var b = buone[0];
      out.push({ id: 'offerta_conveniente', gravita: 'giallo', peso: b.netto, titolo: 'Un\'offerta inserita risulta più conveniente del contratto attuale',
        dati: VETTORI[b.o.vettore].nome + ' · ' + (b.o.fornitore || 'fornitore') + ' ' + (b.o.nome || '') + ': componente energia ' + eur(b.costo) + ' contro ' + eur(b.attuale) + ' attuali, sugli stessi consumi.' + (b.daRiverificare ? ' Offerta rilevata da oltre ' + a.parametri.giorniValiditaOfferta + ' giorni: da riverificare.' : ''),
        causa: 'Prezzo della componente energia superiore a quello offerto.',
        intervento: 'Verificare l\'offerta alla fonte indicata, le condizioni (durata, indicizzazione, garanzie) e le penali del contratto in corso. Il cambio di fornitore è una decisione tua.',
        effetto: 'Risparmio ' + eur(b.risparmio) + ' sugli stessi consumi; al netto di costi di cambio e penali ' + eur(b.netto) + '. Trasporto, oneri e imposte non cambiano con il fornitore.' }); }
    a.potenza.forEach(function (p) { out.push(p.tipo === 'superata' ?
      { id: 'potenza_superata', gravita: 'giallo', peso: 2, titolo: p.utenza.nome + ': potenza impegnata superata', dati: 'Potenza massima prelevata ' + p.massima + ' kW, impegnata ' + p.impegnata + ' kW.', causa: 'Carichi contemporanei superiori alla potenza contrattuale.', intervento: 'Verificare con il fornitore penali e adeguamento della potenza, oppure sfalsare gli avviamenti.', effetto: 'Possibili penali o distacchi: l\'importo dipende dal contratto.' } :
      { id: 'potenza_eccessiva', gravita: 'giallo', peso: 1, titolo: p.utenza.nome + ': potenza impegnata superiore al necessario', dati: 'Potenza massima prelevata ' + p.massima + ' kW su ' + p.impegnata + ' kW impegnati (' + pct(p.massima / p.impegnata) + ').', causa: 'Potenza contrattuale dimensionata su carichi non più presenti.', intervento: 'Chiedere al fornitore il costo della quota potenza e valutare la riduzione, lasciando un margine sui picchi.', effetto: 'Il risparmio dipende dalla quota potenza del contratto, che il modulo non conosce.' }); });
    a.scadenze.forEach(function (s) { out.push({ id: 'contratto_in_scadenza', gravita: 'giallo', peso: 3, titolo: s.utenza.nome + ': contratto in scadenza tra ' + s.giorni + ' giorni', dati: 'Scadenza ' + s.data.split('-').reverse().join('/') + '.', causa: 'Termine del contratto di fornitura.', intervento: 'Raccogliere offerte ora: alla scadenza senza rinnovo si applicano di solito condizioni meno favorevoli.', effetto: 'Momento utile per cambiare senza penali.' }); });
    if (a.commesse && Math.abs(a.commesse.scarto) > 0.10) out.push({ id: 'prezzo_kwh_commesse', gravita: 'giallo', peso: Math.abs(a.commesse.scarto) * a.commesse.kwhAttribuiti * a.commesse.prezzoReale, titolo: 'Il prezzo dell\'energia usato nelle commesse non corrisponde alle bollette',
      dati: 'Nelle commesse ' + n3(a.commesse.prezzoUsato) + ' €/kWh, dalle bollette ' + n3(a.commesse.prezzoReale) + ' €/kWh (' + (a.commesse.scarto > 0 ? '+' : '') + pct(a.commesse.scarto) + ').', causa: 'Parametro non aggiornato.',
      intervento: 'Aggiornare il prezzo dell\'energia nei parametri del modulo Commesse.', effetto: 'Il costo energetico delle commesse è ' + (a.commesse.scarto < 0 ? 'sottostimato' : 'sovrastimato') + ' di circa ' + eur(Math.abs(a.commesse.scarto) * a.commesse.kwhAttribuiti * a.commesse.prezzoReale) + '.' });
    out.sort(function (x, y) { return x.gravita === y.gravita ? y.peso - x.peso : (x.gravita === 'rosso' ? -1 : 1); });
    return out;
  }

  // ------------------------------------------------------------ importazione delle bollette da tabella
  var COLONNE = { utenza: ['utenza', 'punto di fornitura', 'pod', 'pdr', 'contatore', 'fornitura'], vettore: ['vettore', 'tipo', 'servizio'], anno: ['anno'], mese: ['mese'], consumo: ['consumo', 'consumi', 'kwh', 'smc', 'mc', 'm3'],
    f1: ['f1'], f2: ['f2'], f3: ['f3'], potenzaMax: ['potenza max', 'potenza massima', 'potenza prelevata', 'picco'], materia: ['materia', 'materia energia', 'spesa energia', 'spesa materia', 'materia gas'], trasporto: ['trasporto', 'trasporto e gestione contatore', 'rete', 'distribuzione'],
    oneri: ['oneri', 'oneri di sistema'], imposte: ['imposte', 'accise'], totale: ['totale', 'imponibile', 'totale imponibile', 'totale iva esclusa'] };
  function norm(s) { return String(s === null || s === undefined ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function vettoreDa(s) { s = norm(s); return /gas|metano|smc/.test(s) ? 'gas' : /acqua|idric/.test(s) ? 'acqua' : /gasolio|gpl|combust/.test(s) ? 'altro' : 'elettricita'; }
  function meseDa(x, numero) { var v = numero(x); if (v !== null && v >= 1 && v <= 12) return Math.round(v); var s = norm(x).slice(0, 3), i = MESI.indexOf(s); return i >= 0 ? i + 1 : null; }
  function daTabella(matrice, numero, utenzeEsistenti) {
    var testa = -1, mappa = {}, avvisi = [];
    for (var i = 0; i < Math.min(matrice.length, 15) && testa < 0; i++) {
      var m = {};
      matrice[i].forEach(function (c, j) { var n = norm(c); Object.keys(COLONNE).forEach(function (k) { if (m[k] === undefined && COLONNE[k].indexOf(n) >= 0) m[k] = j; }); });
      if (m.utenza !== undefined && m.anno !== undefined && m.mese !== undefined && (m.totale !== undefined || m.materia !== undefined)) { testa = i; mappa = m; }
    }
    if (testa < 0) return { bollette: [], utenze: [], colonne: [], avvisi: ['Non trovo l\'intestazione: servono almeno “Utenza”, “Anno”, “Mese” e “Totale”. Scarica il modello per vedere i nomi accettati.'] };
    var es = {}, nuove = [], bollette = [], scartate = 0;
    (utenzeEsistenti || []).forEach(function (u) { es[norm(u.nome)] = u; });
    for (var r = testa + 1; r < matrice.length; r++) {
      var riga = matrice[r], v = function (k) { return mappa[k] === undefined ? undefined : riga[mappa[k]]; }, nome = String(v('utenza') === undefined ? '' : v('utenza')).trim();
      if (!nome) continue;
      var anno = numero(v('anno')), mese = meseDa(v('mese'), numero);
      if (!anno || !mese) { scartate++; continue; }
      var u = es[norm(nome)];
      if (!u) { u = { id: 'u' + nuove.length + '-' + Date.now().toString(36), nome: nome.slice(0, 60), vettore: vettoreDa(v('vettore') === undefined ? nome : v('vettore')), uso: 'misto', contratto: {}, origine: 'importato' }; es[norm(nome)] = u; nuove.push(u); }
      var b = { id: 'b' + bollette.length + '-' + Date.now().toString(36), utenza: u.id, anno: Math.round(anno), mese: mese, origine: 'importato' };
      ['consumo', 'f1', 'f2', 'f3', 'potenzaMax', 'materia', 'trasporto', 'oneri', 'imposte', 'totale'].forEach(function (k) { if (mappa[k] === undefined) return; var x = numero(v(k)); if (x !== null) b[k] = x; });
      if (b.totale === undefined && !bolletta(b).dettaglio) { scartate++; continue; }
      bollette.push(b);
    }
    if (scartate) avvisi.push(scartate + ' righe senza anno, mese o importo non sono state importate.');
    if (nuove.length) avvisi.push('Verranno create ' + nuove.length + ' nuove utenze: ' + nuove.map(function (u) { return u.nome + ' (' + VETTORI[u.vettore].nome.toLowerCase() + ')'; }).join(', ') + '. Controlla tipo e uso dopo l\'importazione.');
    if (mappa.materia === undefined) avvisi.push('Il file non separa la componente energia da trasporto, oneri e imposte: il confronto con le offerte non sarà calcolabile.');
    if (mappa.consumo === undefined) avvisi.push('Il file non contiene i consumi: il costo unitario non sarà calcolabile.');
    return { bollette: bollette, utenze: nuove, colonne: Object.keys(mappa), avvisi: avvisi };
  }
  function modelloCsv() { return 'Utenza;Vettore;Anno;Mese;Consumo;F1;F2;F3;Potenza max;Materia;Trasporto;Oneri;Imposte;Totale\r\nStabilimento;elettricità;2025;1;42000;21000;9000;12000;95;5460;1890;1260;525;9135\r\nRiscaldamento;gas;2025;1;3100;;;;;1705;465;155;527;2852\r\n'; }

  // ------------------------------------------------------------ simulazione
  function rng(seme) { var a = seme >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var STAGIONE_GAS = [0.21, 0.18, 0.13, 0.06, 0.02, 0.01, 0.01, 0.01, 0.02, 0.07, 0.12, 0.16];

  /* Utenze e bollette mensili degli ultimi due esercizi, coerenti con i servizi di bilancio e con le commesse simulate
     (prezzo dell'elettricità dell'ultimo anno 0,22 €/kWh). Contiene di proposito: un mese anomalo, una potenza impegnata
     eccessiva, un aumento del costo unitario e un'offerta più conveniente. */
  function simula(az, seme) {
    var R = rng((seme === undefined || seme === null ? 1 : Number(seme)) + 71), out = { parametri: {}, utenze: [], bollette: [], offerte: [], simulato: true };
    var anni = Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }).slice(-2), produttiva = az.settore === 'manifatturiera' || az.settore === 'artigiana';
    var ultimo = M.numeri(az.esercizi[anni[anni.length - 1]]);
    if (!(ultimo.servizi > 20000)) return out;
    var quote = produttiva ? { prod: 0.14, uff: 0.015, gas: 0.04, acqua: 0.008 } : { prod: 0, uff: 0.035, gas: 0.02, acqua: 0.004 };
    var kwhProd = ultimo.servizi * quote.prod / 0.22, potMax = Math.max(10, Math.round(kwhProd / 12 / 330 * 1.9));
    var U = [];
    if (produttiva) U.push({ id: 'e-prod', nome: 'Stabilimento', vettore: 'elettricita', uso: 'produzione', q: quote.prod, prezzo: [0.185, 0.22], contratto: { fornitore: 'Fornitore attuale', tipo: 'variabile', potenza: Math.round(potMax * 1.8), scadenza: (anni[anni.length - 1] + 1) + '-03-31', penale: 0 } });
    U.push({ id: 'e-uff', nome: 'Uffici', vettore: 'elettricita', uso: 'uffici', q: quote.uff, prezzo: [0.20, 0.24], contratto: { fornitore: 'Fornitore attuale', tipo: 'fisso' } });
    U.push({ id: 'g-risc', nome: 'Riscaldamento', vettore: 'gas', uso: 'riscaldamento', q: quote.gas, prezzo: [0.85, 0.92], contratto: { fornitore: 'Fornitore gas', tipo: 'variabile' } });
    U.push({ id: 'a-acq', nome: 'Acqua', vettore: 'acqua', uso: 'misto', q: quote.acqua, prezzo: [2.4, 2.5], contratto: {} });
    U.forEach(function (u) { out.utenze.push({ id: u.id, nome: u.nome, vettore: u.vettore, uso: u.uso, contratto: u.contratto, origine: 'simulato' }); });
    anni.forEach(function (anno, ai) {
      var n = M.numeri(az.esercizi[anno]), serv = n.servizi || 0, ip = anni.length === 1 ? 1 : ai;
      U.forEach(function (u) {
        var spesaAnno = serv * u.q, prezzo = u.prezzo[ip], assegnata = 0;
        for (var m = 1; m <= 12; m++) {
          var anomalo = u.id === 'e-prod' && ai === anni.length - 1;      // nell'anno con il mese anomalo gli altri mesi si riducono in proporzione
          var quota = u.vettore === 'gas' ? STAGIONE_GAS[m - 1] : (1 / 12) * (anomalo ? (12 - 1.75) / 11 : 1) * (m === 8 && u.id !== 'e-prod' ? 0.6 : 1) * (0.96 + R() * 0.08);
          var spesa = Math.round(spesaAnno * quota);
          if (u.id === 'e-prod' && m === 8 && ai === anni.length - 1) spesa = Math.round(spesaAnno / 12 * 1.75);        // mese anomalo introdotto di proposito
          if (m === 12 && u.vettore !== 'gas') spesa = Math.max(1, Math.round(spesaAnno - assegnata));
          if (m === 12 && u.vettore === 'gas') spesa = Math.round(spesaAnno - assegnata);
          assegnata += spesa;
          var consumo = Math.round(spesa / prezzo), materia = Math.round(spesa * 0.60), trasporto = Math.round(spesa * 0.20), oneri = Math.round(spesa * 0.14);
          var b = { id: 'sb-' + u.id + '-' + anno + '-' + m, utenza: u.id, anno: anno, mese: m, consumo: consumo, materia: materia, trasporto: trasporto, oneri: oneri, imposte: spesa - materia - trasporto - oneri, totale: spesa, origine: 'simulato' };
          if (u.vettore === 'elettricita') { b.f1 = Math.round(consumo * 0.55); b.f2 = Math.round(consumo * 0.22); b.f3 = consumo - b.f1 - b.f2; }
          if (u.id === 'e-prod') b.potenzaMax = Math.round(potMax * (0.85 + R() * 0.15));
          out.bollette.push(b);
        }
      });
    });
    var annoU = anni[anni.length - 1];
    out.offerte.push({ id: 'so-1', vettore: 'elettricita', fornitore: 'Fornitore simulato A', nome: 'Prezzo fisso 12 mesi', tipo: 'fisso', prezzo: 0.112, fissoMese: 12, durataMesi: 12, costiCambio: 0, fonte: 'Offerta di fantasia generata dal simulatore', data: annoU + '-12-15', origine: 'simulato' });
    out.offerte.push({ id: 'so-2', vettore: 'elettricita', fornitore: 'Fornitore simulato B', nome: 'Indicizzata', tipo: 'variabile', prezzo: 0.150, fissoMese: 8, durataMesi: 24, costiCambio: 0, fonte: 'Offerta di fantasia generata dal simulatore', data: annoU + '-12-15', origine: 'simulato' });
    return out;
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az, oggi) {
    var esiti = [], d = dati(az), eur = M.fmt.eur;
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    var anni = d.bollette.map(function (b) { return Number(b.anno); }).filter(function (a, i, s) { return s.indexOf(a) === i; }).sort();
    anni.forEach(function (anno, idx) {
      var n = az.esercizi[anno] ? M.numeri(az.esercizi[anno]) : null, a = analisi(az, anno, n, !!n && M.mancantiSezione(n, 'ce').length === 0, oggi || (anno + 1) + '-01-15');
      if (!a.presente) return;
      var sv = Object.keys(a.vettori).reduce(function (s, k) { return s + a.vettori[k].spesa; }, 0), su = a.utenze.reduce(function (s, u) { return s + u.spesa; }, 0), sb = d.bollette.filter(function (b) { return Number(b.anno) === anno; }).reduce(function (s, b) { return s + z(bolletta(b).totale); }, 0);
      t(anno + ' · energia: bollette, utenze e vettori sommano alla stessa spesa', Math.abs(sv - a.spesaTotale) < 0.5 && Math.abs(su - a.spesaTotale) < 0.5 && Math.abs(sb - a.spesaTotale) < 0.5, eur(a.spesaTotale));
      t(anno + ' · energia: componenti delle bollette coerenti con i totali', a.incoerenti === 0, a.incoerenti ? a.incoerenti + ' bollette da correggere' : 'Tutte coerenti');
      t(anno + ' · energia: costo unitario × consumo = spesa', Object.keys(a.vettori).every(function (k) { var V = a.vettori[k]; return V.costoMedio === null || Math.abs(V.costoMedio * V.consumo - V.spesa) < 0.5; }), '');
      t(anno + ' · energia: per ogni offerta, risparmio = componente energia attuale − costo offerta', a.offerte.every(function (x) { return !x.calcolabile || Math.abs(x.attuale - x.costo - x.risparmio) < 0.01; }), a.offerte.length + ' offerte');
      if (a.contabile) t(anno + ' · energia: spesa per utenze entro i servizi di bilancio', !a.oltreServizi, eur(a.spesaTotale) + ' su ' + eur(a.servizi));
      if (d.simulato && idx === anni.length - 1) {
        var ids = a.criticita.map(function (x) { return x.id; }), prod = d.utenze.some(function (u) { return u.id === 'e-prod'; });
        t(anno + ' · energia simulata: offerta più conveniente trovata', ids.indexOf('offerta_conveniente') >= 0, ids.join(', '));
        t(anno + ' · energia simulata: aumento del costo unitario trovato', ids.indexOf('costo_unitario_elettricita') >= 0, ids.join(', '));
        if (prod) { t(anno + ' · energia simulata: mese anomalo trovato', a.anomalie.some(function (x) { return x.utenza.id === 'e-prod' && x.mese === 8; }), a.anomalie.length + ' anomalie');
          t(anno + ' · energia simulata: potenza impegnata eccessiva trovata', ids.indexOf('potenza_eccessiva') >= 0, ids.join(', ')); }
      }
    });
    return esiti;
  }

  return { VETTORI: VETTORI, USI: USI, MESI: MESI, PARAMETRI: PARAMETRI, vuoto: vuoto, dati: dati, parametri: parametri, bolletta: bolletta, perMese: perMese, analisi: analisi, daTabella: daTabella, modelloCsv: modelloCsv, simula: simula, collaudo: collaudo };
});
