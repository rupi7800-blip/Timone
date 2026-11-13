/* Timone · modulo Magazzino e scorte
   Funzioni pure. Parte da un inventario a una data (di solito la chiusura dell'esercizio) e risponde a:
   quanto capitale è fermo, quali articoli non ruotano, cosa è in eccesso, cosa rischia di mancare,
   quanto costa finanziariamente tenere queste scorte. Riconcilia il valore con le rimanenze di bilancio.
   Ogni articolo: giacenza, costo unitario, consumo degli ultimi 12 mesi, data dell'ultimo movimento,
   scorta minima, tempo di consegna, quantità in ordine. Nessuna grandezza mancante viene stimata. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Magazzino = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var PARAMETRI = { tasso: 0.06, giorniFermo: 180, giorniObsoleto: 365, coperturaMax: 120 };
  var CATEGORIE = { materia: 'Materie prime', semilavorato: 'Semilavorati', prodotto: 'Prodotti finiti', merce: 'Merci' };
  var CLASSI = { obsoleto: 'Obsoleto', fermo: 'Fermo', eccesso: 'In eccesso', sotto_scorta: 'Sotto scorta', ok: 'Regolare', incompleto: 'Dati incompleti' };

  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function div(a, b) { return (isFinite(a) && isFinite(b) && b !== 0) ? a / b : null; }
  function vuoto() { return { parametri: {}, anni: {} }; }
  function dati(az) { var d = az.magazzino || vuoto(); d.parametri = d.parametri || {}; d.anni = d.anni || {}; return d; }
  function parametri(d) { return Object.assign({}, PARAMETRI, d.parametri || {}); }
  function giorniTra(a, b) { var x = Date.parse(a), y = Date.parse(b); return (isFinite(x) && isFinite(y)) ? Math.round((y - x) / 86400000) : null; }

  // ------------------------------------------------------------ singolo articolo
  function articolo(a, dataInventario, par) {
    var g = num(a.giacenza), costo = num(a.costoUnitario), cons = num(a.consumoAnnuo);
    var o = { valore: (g !== null && costo !== null) ? g * costo : null, mancanti: [] };
    if (g === null) o.mancanti.push('giacenza');
    if (costo === null) o.mancanti.push('costo unitario');
    o.consumoGiorno = cons !== null ? cons / 365 : null;
    o.copertura = (g !== null && cons !== null && cons > 0) ? g / (cons / 365) : null;      // giorni di consumo coperti
    o.rotazione = (g !== null && g > 0 && cons !== null) ? cons / g : null;
    o.giorniFermo = a.ultimoMovimento ? giorniTra(a.ultimoMovimento, dataInventario) : null;
    o.eccedenza = 0; o.valoreEccedenza = 0; o.fabbisogno = 0;
    var min = num(a.scortaMinima), lead = num(a.leadTime), inOrdine = num(a.inOrdine) || 0;
    if (o.valore === null) { o.classe = 'incompleto'; return o; }
    if (g <= 0) { o.classe = (min !== null && min > 0) ? 'sotto_scorta' : 'ok'; }
    else if ((cons !== null && cons === 0 && (o.giorniFermo === null || o.giorniFermo >= par.giorniFermo)) || (o.giorniFermo !== null && o.giorniFermo >= par.giorniObsoleto)) o.classe = 'obsoleto';
    else if (o.giorniFermo !== null && o.giorniFermo >= par.giorniFermo) o.classe = 'fermo';
    else if (o.copertura !== null && o.copertura > par.coperturaMax) o.classe = 'eccesso';
    else if ((min !== null && g + inOrdine < min) || (lead !== null && o.copertura !== null && (g + inOrdine) / o.consumoGiorno < lead)) o.classe = 'sotto_scorta';
    else if (cons === null && o.giorniFermo === null) { o.classe = 'incompleto'; o.mancanti.push('consumo annuo o data dell\'ultimo movimento'); }
    else o.classe = 'ok';
    if (o.classe === 'eccesso') { o.eccedenza = g - o.consumoGiorno * par.coperturaMax; o.valoreEccedenza = o.eccedenza * costo; }
    if (o.classe === 'sotto_scorta') {
      // quantità per coprire il tempo di consegna e ricostituire la scorta minima
      o.fabbisogno = Math.max(0, (o.consumoGiorno || 0) * (lead || 0) + (min || 0) - g - inOrdine);
      o.valoreFabbisogno = o.fabbisogno * costo;
      o.giorniAutonomia = o.consumoGiorno ? g / o.consumoGiorno : null;
    }
    return o;
  }

  // ------------------------------------------------------------ analisi dell'inventario di un anno
  function analisi(az, anno, n) {
    var d = dati(az), par = parametri(d), inv = d.anni[anno];
    var out = { anno: anno, parametri: par, presente: !!inv, righe: [], classi: {}, categorie: {}, criticita: [] };
    if (!inv) return out;
    out.data = inv.data || (anno + '-12-31');
    Object.keys(CLASSI).forEach(function (k) { out.classi[k] = { n: 0, valore: 0 }; });
    var tot = 0, consumiValore = 0, eccedenze = 0, fabbisogni = 0;
    (inv.articoli || []).forEach(function (a) {
      var k = articolo(a, out.data, par);
      out.righe.push({ a: a, k: k });
      out.classi[k.classe].n++;
      if (k.valore !== null) {
        tot += k.valore; out.classi[k.classe].valore += k.valore; eccedenze += k.valoreEccedenza; fabbisogni += k.valoreFabbisogno || 0;
        var cat = CATEGORIE[a.categoria] ? a.categoria : 'materia';
        var c = out.categorie[cat] || (out.categorie[cat] = { n: 0, valore: 0, consumi: 0 });
        c.n++; c.valore += k.valore;
        if (num(a.consumoAnnuo) !== null) { c.consumi += a.consumoAnnuo * a.costoUnitario; consumiValore += a.consumoAnnuo * a.costoUnitario; }
      }
    });
    out.valore = tot; out.consumiValore = consumiValore; out.valoreEccedenze = eccedenze; out.valoreFabbisogni = fabbisogni;
    out.rotazione = div(consumiValore, tot); out.coperturaMedia = consumiValore > 0 ? tot / (consumiValore / 365) : null;
    out.valoreNonRuota = out.classi.obsoleto.valore + out.classi.fermo.valore;
    out.liberabile = out.classi.fermo.valore + eccedenze;                 // escluso l'obsoleto: il suo valore di realizzo è incerto
    out.costoFinanziario = tot * par.tasso;
    out.costoFinanziarioInutile = (out.valoreNonRuota + eccedenze) * par.tasso;
    // classi ABC per valore
    var ord = out.righe.filter(function (x) { return x.k.valore !== null; }).sort(function (x, y) { return y.k.valore - x.k.valore; }), cum = 0;
    out.abc = { A: { n: 0, valore: 0 }, B: { n: 0, valore: 0 }, C: { n: 0, valore: 0 } };
    ord.forEach(function (x) { var prima = tot > 0 ? cum / tot : 0; cum += x.k.valore; x.k.abc = prima < 0.8 ? 'A' : prima < 0.95 ? 'B' : 'C'; out.abc[x.k.abc].n++; out.abc[x.k.abc].valore += x.k.valore; });
    // riconciliazione con il bilancio
    out.bilancio = (n && typeof n.rimanenze === 'number') ? n.rimanenze : null;
    out.differenza = out.bilancio !== null ? out.bilancio - tot : null;
    out.riconciliato = out.bilancio !== null && Math.abs(out.differenza) <= Math.max(1, Math.abs(out.bilancio) * 0.02);
    out.criticita = criticita(out);
    return out;
  }

  function criticita(a) {
    var eur = M.fmt.eur, pct = M.fmt.pct, par = a.parametri, out = [], tot = a.valore;
    if (!a.righe.length || !(tot > 0)) return out;
    function primi(classe, n) {
      return a.righe.filter(function (x) { return x.k.classe === classe; }).sort(function (x, y) { return (y.k.valore || 0) - (x.k.valore || 0); }).slice(0, n || 3)
        .map(function (x) { return (x.a.codice || '?') + ' ' + (x.a.descrizione || '') + ' ' + eur(x.k.valore); }).join(' · ');
    }
    var ob = a.classi.obsoleto, fe = a.classi.fermo, ec = a.classi.eccesso, ss = a.classi.sotto_scorta, inc = a.classi.incompleto;
    if (a.bilancio !== null && !a.riconciliato) out.push({ id: 'magazzino_bilancio', gravita: 'rosso', peso: 1e12, titolo: 'L\'inventario non coincide con le rimanenze di bilancio',
      dati: 'Inventario ' + eur(tot) + ', rimanenze di bilancio ' + eur(a.bilancio) + ': differenza ' + eur(a.differenza) + ' (' + pct(Math.abs(a.differenza) / Math.abs(a.bilancio || 1)) + ').',
      causa: 'Inventario parziale o a un\'altra data, criteri di valutazione diversi (costo medio, ultimo costo, LIFO/FIFO), lavori in corso non inclusi.',
      intervento: 'Chiarire la differenza con chi tiene la contabilità prima di usare questi dati per le decisioni.',
      effetto: 'Finché la differenza non è spiegata, capitale fermo ed eccedenze sono indicativi.' });
    if (ob.n) out.push({ id: 'scorte_obsolete', gravita: ob.valore > tot * 0.10 ? 'rosso' : 'giallo', peso: ob.valore, titolo: ob.n + ' articoli obsoleti o senza consumi',
      dati: 'Valore ' + eur(ob.valore) + ', pari al ' + pct(ob.valore / tot) + ' del magazzino. I maggiori: ' + primi('obsoleto') + '.',
      causa: 'Nessun consumo negli ultimi 12 mesi oppure nessun movimento da oltre ' + par.giorniObsoleto + ' giorni: fine serie, modifiche tecniche, acquisti sbagliati.',
      intervento: 'Per ogni articolo decidere tra vendita in stock, reso al fornitore, uso alternativo o rottamazione; bloccare i riordini. Valutare con il commercialista la svalutazione in bilancio.',
      effetto: 'Capitale immobilizzato ' + eur(ob.valore) + ', con un costo finanziario di ' + eur(ob.valore * par.tasso) + ' l\'anno. Il valore di realizzo è probabilmente inferiore al valore contabile.' });
    if (fe.n) out.push({ id: 'scorte_ferme', gravita: 'giallo', peso: fe.valore, titolo: fe.n + ' articoli fermi da oltre ' + par.giorniFermo + ' giorni',
      dati: 'Valore ' + eur(fe.valore) + ' (' + pct(fe.valore / tot) + ' del magazzino). I maggiori: ' + primi('fermo') + '.',
      causa: 'Articoli a lenta rotazione o acquistati in lotti troppo grandi.',
      intervento: 'Proporli ai clienti abituali, usarli in sostituzione di codici equivalenti, ridurre i lotti d\'acquisto.',
      effetto: 'Smaltirli libererebbe fino a ' + eur(fe.valore) + ' di cassa.' });
    if (ec.n) out.push({ id: 'scorte_eccesso', gravita: 'giallo', peso: a.valoreEccedenze, titolo: ec.n + ' articoli con scorte oltre ' + par.coperturaMax + ' giorni di consumo',
      dati: 'Eccedenza ' + eur(a.valoreEccedenze) + ' rispetto a una copertura di ' + par.coperturaMax + ' giorni. I maggiori: ' + primi('eccesso') + '.',
      causa: 'Acquisti superiori ai consumi o consumi in calo.',
      intervento: 'Sospendere i riordini di questi codici finché la copertura non rientra; rivedere lotti e scorte minime.',
      effetto: 'Riportarli a ' + par.coperturaMax + ' giorni libererebbe ' + eur(a.valoreEccedenze) + ' e ' + eur(a.valoreEccedenze * par.tasso) + ' l\'anno di costo finanziario.' });
    if (ss.n) out.push({ id: 'sotto_scorta', gravita: 'giallo', peso: a.valoreFabbisogni, titolo: ss.n + ' articoli sotto scorta',
      dati: primi('sotto_scorta', 4) + '.',
      causa: 'Giacenza e ordini in arrivo inferiori alla scorta minima o al consumo previsto nel tempo di consegna.',
      intervento: 'Riordinare le quantità indicate nell\'elenco riordini, partendo dagli articoli con meno giorni di autonomia.',
      effetto: 'Acquisti necessari per circa ' + eur(a.valoreFabbisogni) + '; in mancanza, rischio di fermo o di ritardi di consegna.' });
    if (inc.n) out.push({ id: 'magazzino_incompleto', gravita: 'giallo', peso: 1, titolo: inc.n + ' articoli con dati insufficienti',
      dati: 'Mancano giacenza, costo, consumo annuo o data dell\'ultimo movimento.',
      causa: 'Esportazione dal gestionale incompleta.', intervento: 'Completare i dati: questi articoli non sono classificati e non vengono stimati.',
      effetto: 'Valore non classificato: ' + eur(inc.valore) + '.' });
    out.sort(function (x, y) { return x.gravita === y.gravita ? y.peso - x.peso : (x.gravita === 'rosso' ? -1 : 1); });
    return out;
  }

  // ------------------------------------------------------------ importazione da tabella (CSV / Excel)
  var COLONNE = {
    codice: ['codice', 'cod', 'codice articolo', 'articolo', 'sku'], descrizione: ['descrizione', 'descrizione articolo', 'nome'], categoria: ['categoria', 'tipo', 'famiglia'], um: ['um', 'unita di misura', 'u m'],
    giacenza: ['giacenza', 'quantita', 'qta', 'esistenza', 'giacenza finale'], costoUnitario: ['costo unitario', 'costo', 'costo medio', 'prezzo medio', 'ultimo costo'], valore: ['valore', 'valore giacenza', 'importo'],
    consumoAnnuo: ['consumo annuo', 'consumo 12 mesi', 'scarichi 12 mesi', 'venduto 12 mesi', 'uscite 12 mesi', 'consumi'], ultimoMovimento: ['ultimo movimento', 'data ultimo movimento', 'ultimo scarico', 'data ultimo scarico'],
    scortaMinima: ['scorta minima', 'scorta min', 'punto di riordino'], leadTime: ['tempo di consegna', 'lead time', 'giorni consegna'], inOrdine: ['in ordine', 'ordinato', 'ordini fornitori']
  };
  function norm(s) { return String(s === null || s === undefined ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function data(x) {
    if (typeof x === 'number' && x > 20000 && x < 80000) return new Date(Math.round((x - 25569) * 86400000)).toISOString().slice(0, 10); // data di Excel
    var s = String(x === null || x === undefined ? '' : x).trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(s))) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return null;
  }
  function categoria(x) {
    var s = norm(x);
    if (/semilav|wip|corso/.test(s)) return 'semilavorato';
    if (/finit|prodott/.test(s)) return 'prodotto';
    if (/merc/.test(s)) return 'merce';
    return 'materia';
  }
  // matrice (righe × colonne) → { articoli, colonne riconosciute, avvisi }; numero = funzione di lettura dei numeri italiani
  function daTabella(matrice, numero) {
    var avvisi = [], testa = -1, mappa = {};
    for (var i = 0; i < Math.min(matrice.length, 15) && testa < 0; i++) {
      var m = {};
      matrice[i].forEach(function (c, j) { var n = norm(c); Object.keys(COLONNE).forEach(function (k) { if (m[k] === undefined && COLONNE[k].indexOf(n) >= 0) m[k] = j; }); });
      if (m.codice !== undefined && (m.giacenza !== undefined || m.valore !== undefined)) { testa = i; mappa = m; }
    }
    if (testa < 0) return { articoli: [], colonne: [], avvisi: ['Non trovo l\'intestazione: servono almeno le colonne “Codice” e “Giacenza”. Scarica il modello per vedere i nomi accettati.'] };
    var articoli = [], visti = {}, scartate = 0;
    for (var r = testa + 1; r < matrice.length; r++) {
      var riga = matrice[r], v = function (k) { return mappa[k] === undefined ? undefined : riga[mappa[k]]; }, n = function (k) { var x = v(k); return x === undefined ? null : numero(x); };
      var cod = String(v('codice') === undefined ? '' : v('codice')).trim();
      if (!cod) continue;
      var g = n('giacenza'), costo = n('costoUnitario'), val = n('valore');
      if (costo === null && val !== null && g) costo = val / g;                      // costo ricavato da valore ÷ giacenza
      if (g === null && val === null) { scartate++; continue; }
      if (visti[cod]) { avvisi.push('Il codice ' + cod + ' compare più volte: tenuta la prima riga.'); continue; }
      visti[cod] = true;
      var a = { id: 'a' + articoli.length + '-' + cod.replace(/[^\w-]/g, '').slice(0, 20), codice: cod.slice(0, 40), descrizione: String(v('descrizione') === undefined ? '' : v('descrizione')).trim().slice(0, 120), categoria: categoria(v('categoria')), um: String(v('um') === undefined ? '' : v('um')).trim().slice(0, 10), origine: 'importato' };
      if (g !== null) a.giacenza = g; if (costo !== null) a.costoUnitario = costo;
      ['consumoAnnuo', 'scortaMinima', 'leadTime', 'inOrdine'].forEach(function (k) { var x = n(k); if (x !== null) a[k] = x; });
      var dm = v('ultimoMovimento'); if (dm !== undefined && dm !== '') { var dd = data(dm); if (dd) a.ultimoMovimento = dd; }
      articoli.push(a);
    }
    if (scartate) avvisi.push(scartate + ' righe senza giacenza né valore non sono state importate.');
    if (mappa.consumoAnnuo === undefined && mappa.ultimoMovimento === undefined) avvisi.push('Il file non contiene né il consumo annuo né la data dell\'ultimo movimento: gli articoli non potranno essere classificati (fermi, in eccesso, obsoleti).');
    return { articoli: articoli, colonne: Object.keys(mappa), avvisi: avvisi };
  }
  function modelloCsv() { return 'Codice;Descrizione;Categoria;UM;Giacenza;Costo unitario;Consumo annuo;Ultimo movimento;Scorta minima;Tempo di consegna;In ordine\r\nMP-001;Granulo PP nero;Materie prime;kg;12000;1,35;48000;15/12/2025;4000;20;0\r\n'; }
  function esportaCsv(a) {
    var out = ['Codice;Descrizione;Categoria;UM;Giacenza;Costo unitario;Valore;Consumo annuo;Ultimo movimento;Scorta minima;Tempo di consegna;In ordine;Classe;ABC;Giorni di copertura'];
    var f = function (x) { return (x === null || x === undefined) ? '' : String(Math.round(x * 1000) / 1000).replace('.', ','); };
    a.righe.forEach(function (x) { var r = x.a, k = x.k; out.push([r.codice, (r.descrizione || '').replace(/;/g, ','), CATEGORIE[r.categoria] || '', r.um || '', f(r.giacenza), f(r.costoUnitario), f(k.valore), f(r.consumoAnnuo), r.ultimoMovimento || '', f(r.scortaMinima), f(r.leadTime), f(r.inOrdine), CLASSI[k.classe], k.abc || '', f(k.copertura)].join(';')); });
    return out.join('\r\n');
  }

  // ------------------------------------------------------------ simulazione
  function rng(seme) { var a = seme >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var NOMI = { materia: ['Granulo PP', 'Granulo ABS', 'Masterbatch', 'Lamiera', 'Barra acciaio', 'Vernice', 'Resina', 'Tessuto tecnico'], semilavorato: ['Semilavorato stampato', 'Corpo grezzo', 'Sottogruppo'], prodotto: ['Coperchio', 'Scocca', 'Supporto', 'Kit completo'], merce: ['Minuteria', 'Imballo', 'Ricambio', 'Articolo a listino'] };

  /* Inventari degli ultimi due esercizi con valore totale uguale alle rimanenze di bilancio.
     Contiene di proposito articoli obsoleti, fermi, in eccesso e sotto scorta. */
  function simula(az, seme) {
    var R = rng((seme === undefined || seme === null ? 1 : Number(seme)) + 31), out = { parametri: {}, anni: {}, simulato: true };
    var anni = Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }).slice(-2);
    var pesante = az.simulazione && az.simulazione.profilo === 'magazzino_eccessivo';
    var cats = az.settore === 'commerciale' ? ['merce'] : az.settore === 'servizi' || az.settore === 'professionista' ? ['merce', 'materia'] : ['materia', 'materia', 'semilavorato', 'prodotto', 'merce'];
    anni.forEach(function (anno) {
      var n = M.numeri(az.esercizi[anno]), rim = n.rimanenze || 0;
      if (rim < 1000) return;
      var N = 36, dataInv = anno + '-12-31', pesi = [], tipi = [];
      for (var i = 0; i < N; i++) {
        pesi.push(Math.pow(R(), 2.2) + 0.02);
        var u = R();
        tipi.push(i === 0 ? 'ok' : i === 1 ? 'obsoleto' : i === 2 ? 'sotto' : i === 3 ? 'fermo' : i === 4 ? 'eccesso' : u < (pesante ? 0.40 : 0.62) ? 'ok' : u < (pesante ? 0.70 : 0.78) ? 'eccesso' : u < 0.88 ? 'fermo' : u < 0.95 ? 'obsoleto' : 'sotto');
      }
      var sp = pesi.reduce(function (s, x) { return s + x; }, 0), assegnato = 0, articoli = [];
      for (var j = 0; j < N; j++) {
        var tipo = tipi[j], cat = cats[Math.floor(R() * cats.length)], nomi = NOMI[cat];
        var valore = j === N - 1 ? rim - assegnato : Math.round(rim * pesi[j] / sp * (tipo === 'sotto' ? 0.15 : 1));
        if (valore < 1) valore = 1;
        var costo = Math.round((0.4 + Math.pow(R(), 2) * 60) * 100) / 100, g = Math.max(1, Math.round(valore / costo));
        costo = valore / g; assegnato += valore;                                // il costo si adatta: giacenza × costo = valore esatto
        var a = { id: 's' + anno + '-' + j, codice: cat.slice(0, 2).toUpperCase() + '-' + String(100 + j), descrizione: nomi[Math.floor(R() * nomi.length)] + ' ' + String.fromCharCode(65 + (j % 26)), categoria: cat, um: cat === 'materia' ? 'kg' : 'pz', giacenza: g, costoUnitario: costo, origine: 'simulato', leadTime: 10 + Math.floor(R() * 30), inOrdine: 0 };
        var giorniFa = function (gg) { return new Date(Date.parse(dataInv) - gg * 86400000).toISOString().slice(0, 10); };
        if (tipo === 'ok') { a.consumoAnnuo = Math.round(g * 365 / (25 + R() * 70)); a.ultimoMovimento = giorniFa(1 + Math.floor(R() * 20)); a.scortaMinima = Math.round(g * 0.3); a.leadTime = 10; }
        else if (tipo === 'eccesso') { a.consumoAnnuo = Math.max(1, Math.round(g * 365 / (220 + R() * 400))); a.ultimoMovimento = giorniFa(5 + Math.floor(R() * 60)); a.scortaMinima = Math.round(g * 0.05); }
        else if (tipo === 'fermo') { a.consumoAnnuo = Math.max(1, Math.round(g * 365 / (500 + R() * 600))); a.ultimoMovimento = giorniFa(200 + Math.floor(R() * 140)); a.scortaMinima = 0; }
        else if (tipo === 'obsoleto') { a.consumoAnnuo = 0; a.ultimoMovimento = giorniFa(420 + Math.floor(R() * 600)); a.scortaMinima = 0; }
        else { a.consumoAnnuo = Math.round(g * 365 / (4 + R() * 5)); a.ultimoMovimento = giorniFa(1); a.scortaMinima = Math.round(g * 3); a.leadTime = 20; }
        articoli.push(a);
      }
      out.anni[anno] = { data: dataInv, articoli: articoli };
    });
    return out;
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az), eur = M.fmt.eur;
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    Object.keys(d.anni).map(Number).sort().forEach(function (anno) {
      var n = az.esercizi[anno] ? M.numeri(az.esercizi[anno]) : null, a = analisi(az, anno, n);
      var sommaClassi = Object.keys(a.classi).reduce(function (s, k) { return s + a.classi[k].valore; }, 0), nClassi = Object.keys(a.classi).reduce(function (s, k) { return s + a.classi[k].n; }, 0);
      t(anno + ' · magazzino: ogni articolo ha una sola classe e i valori sommano al totale', nClassi === a.righe.length && Math.abs(sommaClassi - a.valore) < 0.5, a.righe.length + ' articoli, ' + eur(a.valore));
      t(anno + ' · magazzino: le classi ABC coprono tutto il valore', Math.abs(a.abc.A.valore + a.abc.B.valore + a.abc.C.valore - a.valore) < 0.5, 'A ' + a.abc.A.n + ', B ' + a.abc.B.n + ', C ' + a.abc.C.n);
      t(anno + ' · magazzino: eccedenze non superiori al valore degli articoli in eccesso', a.valoreEccedenze <= a.classi.eccesso.valore + 0.5 && a.valoreEccedenze >= 0, eur(a.valoreEccedenze) + ' su ' + eur(a.classi.eccesso.valore));
      t(anno + ' · magazzino: costo finanziario = valore × tasso', Math.abs(a.costoFinanziario - a.valore * a.parametri.tasso) < 0.01, eur(a.costoFinanziario));
      if (a.bilancio === null) t(anno + ' · magazzino: rimanenze di bilancio disponibili per il confronto', false, 'Voce rimanenze assente nel bilancio ' + anno);
      else t(anno + ' · magazzino: inventario riconciliato con le rimanenze di bilancio', a.riconciliato, 'Inventario ' + eur(a.valore) + ', bilancio ' + eur(a.bilancio));
      if (d.simulato) {
        var ids = a.criticita.map(function (x) { return x.id; });
        t(anno + ' · magazzino simulato: valore uguale alle rimanenze', Math.abs(a.differenza) < 1, 'Differenza ' + eur(a.differenza));
        ['scorte_obsolete', 'scorte_ferme', 'scorte_eccesso', 'sotto_scorta'].forEach(function (id) { t(anno + ' · magazzino simulato: trovata la situazione introdotta (' + id + ')', ids.indexOf(id) >= 0, ids.join(', ')); });
      }
    });
    return esiti;
  }

  return { PARAMETRI: PARAMETRI, CATEGORIE: CATEGORIE, CLASSI: CLASSI, vuoto: vuoto, dati: dati, parametri: parametri, articolo: articolo, analisi: analisi, daTabella: daTabella, data: data,
    modelloCsv: modelloCsv, esportaCsv: esportaCsv, simula: simula, collaudo: collaudo };
});
