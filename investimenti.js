/* Timone · modulo Investimenti e analisi di convenienza
   Funzioni pure. Per ogni investimento ipotizzato calcola flussi di cassa, VAN, TIR, tempo di recupero (semplice e
   attualizzato), redditività media, costo e sostenibilità del finanziamento, sensibilità e impatto sui conti dell'azienda.
   I benefici (risparmi, maggiori ricavi) sono ipotesi inserite dall'utente e restano etichettati come tali:
   il modulo non li stima. Tutti i flussi sono incrementali, cioè già confrontati con l'alternativa di non investire. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Investimenti = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var PARAMETRI = { tassoSconto: 0.08, aliquota: 0.279 };
  var TIPI = { macchinario: 'Macchinario', impianto: 'Impianto energetico', automazione: 'Automazione', software: 'Software', veicolo: 'Veicolo', immobile: 'Immobile', ampliamento: 'Ampliamento produttivo', altro: 'Altro' };
  var STATI = { ipotesi: 'Ipotesi', approvato: 'Approvato', realizzato: 'Realizzato', scartato: 'Scartato' };
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function z(x) { return num(x) || 0; }
  function div(a, b) { return (isFinite(a) && isFinite(b) && b !== 0) ? a / b : null; }
  function vuoto() { return { parametri: {}, elenco: [] }; }
  function dati(az) { var d = az.investimenti || vuoto(); d.parametri = d.parametri || {}; d.elenco = d.elenco || []; return d; }
  function parametri(d) { return Object.assign({}, PARAMETRI, d.parametri || {}); }

  // ------------------------------------------------------------ matematica finanziaria
  function van(flussi, tasso) { var s = 0; for (var t = 0; t < flussi.length; t++) s += flussi[t] / Math.pow(1 + tasso, t); return s; }
  // TIR per bisezione; definito solo se i flussi cambiano segno una sola volta (uscita iniziale, poi entrate)
  function tir(flussi) {
    var cambi = 0, prec = 0;
    flussi.forEach(function (f) { var s = f > 0 ? 1 : f < 0 ? -1 : 0; if (s && prec && s !== prec) cambi++; if (s) prec = s; });
    if (cambi !== 1 || flussi[0] >= 0) return null;
    var lo = -0.99, hi = 10, flo = van(flussi, lo), fhi = van(flussi, hi);
    if (flo * fhi > 0) return null;
    for (var i = 0; i < 200; i++) { var mid = (lo + hi) / 2, fm = van(flussi, mid); if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; } if (hi - lo < 1e-10) break; }
    return (lo + hi) / 2;
  }
  // anni per recuperare l'uscita iniziale, con interpolazione nell'anno; null se non si recupera
  function recupero(flussi, tasso) {
    var cum = 0;
    for (var t = 0; t < flussi.length; t++) {
      var f = flussi[t] / Math.pow(1 + (tasso || 0), t), prima = cum; cum += f;
      if (t > 0 && cum >= 0 && prima < 0) return (t - 1) + (-prima / f);
      if (t === 0 && cum >= 0) return 0;
    }
    return null;
  }
  // piano a rata annuale costante (ammortamento alla francese)
  function piano(capitale, tasso, anni) {
    var out = { capitale: capitale, righe: [], rata: 0, interessi: 0 };
    if (!(capitale > 0) || !(anni >= 1)) return out;
    anni = Math.round(anni);
    out.rata = tasso > 0 ? capitale * tasso / (1 - Math.pow(1 + tasso, -anni)) : capitale / anni;
    var residuo = capitale;
    for (var t = 1; t <= anni; t++) { var int = residuo * tasso, cap = t === anni ? residuo : out.rata - int; residuo -= cap; out.righe.push({ anno: t, rata: cap + int, interessi: int, capitale: cap, residuo: Math.max(0, residuo) }); out.interessi += int; }
    return out;
  }

  // ------------------------------------------------------------ singolo investimento
  // ctx: { mcPct, r (riclassificato), n (valori di bilancio) } oppure {} se il bilancio non è disponibile
  function calcola(inv, par, ctx) {
    ctx = ctx || {};
    var o = { errori: [], ipotesi: [] }, N = Math.round(z(inv.vitaUtile));
    var spesa = z(inv.importo) + z(inv.accessori), contributo = z(inv.contributo);
    if (!(z(inv.importo) > 0)) o.errori.push('Manca l\'importo dell\'investimento.');
    if (!(N >= 1 && N <= 50)) o.errori.push('La vita utile deve essere tra 1 e 50 anni.');
    var margine = num(inv.margineRicavi), ricavi = z(inv.ricaviAnnui);
    if (ricavi > 0 && margine === null) {
      if (num(ctx.mcPct) !== null && ctx.mcPct > 0) { margine = ctx.mcPct; o.ipotesi.push('Sui maggiori ricavi è applicato il margine di contribuzione attuale dell\'azienda (' + M.fmt.pct(margine) + ').'); }
      else o.errori.push('Per i maggiori ricavi serve il margine percentuale: il bilancio non permette di ricavarlo.');
    }
    if (o.errori.length) { o.valido = false; return o; }
    o.valido = true; o.anni = N; o.spesa = spesa; o.contributo = contributo; o.uscita = spesa - contributo; o.margine = margine;
    var residuo = z(inv.valoreResiduo), g = z(inv.crescita), aliq = z(par.aliquota), base = z(inv.risparmioAnnuo) + ricavi * z(margine) - z(inv.costiAnnui);
    o.beneficioBase = base; o.ammortamento = (spesa - residuo) / N;
    var L = Math.min(spesa, Math.max(0, z(inv.finanziamentoQuota)) * spesa), P = piano(L, z(inv.finanziamentoTasso), z(inv.finanziamentoAnni) || N);
    o.finanziato = L; o.piano = P; o.contanti = o.uscita - L;
    // flussi anno per anno
    o.righe = []; var flussi = [-o.uscita], flussiSoci = [-(o.uscita - L)], cum = -(o.uscita - L), minimo = cum, utili = 0;
    for (var t = 1; t <= N; t++) {
      var ben = base * Math.pow(1 + g, t - 1), imp = (ben - o.ammortamento) * aliq, netto = ben - imp, res = t === N ? residuo : 0;
      var rata = P.righe[t - 1] || { rata: 0, interessi: 0, capitale: 0, residuo: 0 }, scudo = rata.interessi * aliq;
      var dopoDebito = netto + res - rata.rata + scudo;
      cum += dopoDebito; minimo = Math.min(minimo, cum); utili += ben - o.ammortamento - imp - rata.interessi + scudo;
      flussi.push(netto + res); flussiSoci.push(dopoDebito);
      o.righe.push({ anno: t, beneficio: ben, ammortamento: o.ammortamento, imposte: imp, flusso: netto + res, residuo: res, rata: rata.rata, interessi: rata.interessi, dopoDebito: dopoDebito, cumulato: cum, copertura: rata.rata > 0 ? (netto + res) / rata.rata : null });
    }
    o.flussi = flussi; o.flussiSoci = flussiSoci;
    o.van = van(flussi, par.tassoSconto); o.tir = tir(flussi);
    o.recupero = recupero(flussi, 0); o.recuperoAttualizzato = recupero(flussi, par.tassoSconto);
    o.indice = o.uscita > 0 ? o.van / o.uscita : null;                                  // VAN per euro investito
    o.redditivitaMedia = o.uscita > 0 ? (utili / N) / o.uscita : null;                 // utile medio annuo ÷ investimento
    o.totaleBenefici = o.righe.reduce(function (s, x) { return s + x.beneficio; }, 0);
    o.fabbisogno = -minimo;                                                            // massima esposizione di cassa dei soci
    o.coperturaMinima = o.righe.reduce(function (m, x) { return x.copertura === null ? m : Math.min(m === null ? Infinity : m, x.copertura); }, null);
    o.vanSoci = L > 0 ? van(flussiSoci, par.tassoSconto) : null;
    if (aliq > 0 && o.righe.some(function (x) { return x.imposte < 0; })) o.ipotesi.push('Negli anni in cui l\'ammortamento supera il beneficio si considera un risparmio d\'imposta: vale solo se l\'azienda ha altri redditi imponibili.');
    if (contributo > 0) o.ipotesi.push('Il contributo di ' + M.fmt.eur(contributo) + ' è considerato ottenuto e incassato subito: finché non è concesso resta un\'ipotesi.');
    if (L > 0) o.ipotesi.push('Finanziamento a rata annuale costante e tasso fisso; gli interessi sono dedotti all\'aliquota del ' + M.fmt.pct(aliq) + '.');

    // sensibilità: di quanto possono ridursi i benefici prima che il VAN si annulli (il VAN è lineare nei benefici)
    function conBenefici(k) { var inv2 = Object.assign({}, inv, { risparmioAnnuo: z(inv.risparmioAnnuo) * k, ricaviAnnui: ricavi * k, costiAnnui: z(inv.costiAnnui), margineRicavi: margine }); return flussiDi(inv2, par); }
    var v0 = van(conBenefici(0), par.tassoSconto), v1 = o.van;
    o.sogliaBenefici = (v1 !== v0) ? -v0 / (v1 - v0) : null;                           // quota dei benefici lordi che porta il VAN a zero
    o.margineSicurezza = o.sogliaBenefici !== null ? 1 - o.sogliaBenefici : null;
    o.sensibilita = [-0.1, -0.2, -0.3].map(function (d) { return { variazione: d, van: van(conBenefici(1 + d), par.tassoSconto) }; });
    o.vanCostoPiu10 = van(flussiDi(Object.assign({}, inv, { importo: z(inv.importo) * 1.1, accessori: z(inv.accessori) * 1.1, margineRicavi: margine }), par), par.tassoSconto);
    o.rischio = o.van <= 0 ? 'alto' : (o.margineSicurezza !== null && o.margineSicurezza < 0.15) ? 'alto' : (o.margineSicurezza !== null && o.margineSicurezza < 0.35) ? 'medio' : 'basso';

    // effetto sui conti dell'azienda (primo anno a regime)
    if (ctx.r) {
      var r = ctx.r, liq = z(ctx.n && ctx.n.liquidita), b1 = o.righe[0];
      o.azienda = { ebitdaPrima: r.ebitda, ebitdaDopo: r.ebitda + b1.beneficio, pfnPrima: r.pfn, pfnDopo: r.pfn + o.uscita, liquidita: liq, contanti: o.contanti, cassaInsufficiente: o.contanti > liq,
        rapportoPrima: r.ebitda > 0 ? r.pfn / r.ebitda : null, rapportoDopo: (r.ebitda + b1.beneficio) > 0 ? (r.pfn + o.uscita) / (r.ebitda + b1.beneficio) : null, utileDelta: b1.beneficio - o.ammortamento - b1.interessi - (b1.beneficio - o.ammortamento - b1.interessi) * aliq };
    }
    // esito, basato solo sui numeri
    var riserve = [];
    if (o.van > 0) {
      if (o.rischio === 'alto') riserve.push('basta un calo dei benefici del ' + M.fmt.pct(Math.max(0, o.margineSicurezza)) + ' per annullare il vantaggio');
      if (o.recuperoAttualizzato === null || o.recuperoAttualizzato > N * 0.7) riserve.push('il recupero arriva solo verso la fine della vita utile');
      if (o.azienda && o.azienda.cassaInsufficiente) riserve.push('la parte da pagare in contanti supera la liquidità disponibile');
      if (o.coperturaMinima !== null && o.coperturaMinima < 1) riserve.push('in almeno un anno il flusso generato non copre la rata');
    }
    o.riserve = riserve; o.esito = o.van <= 0 ? 'no' : riserve.length ? 'riserva' : 'si';
    return o;
  }
  // soli flussi (usata per la sensibilità)
  function flussiDi(inv, par) {
    var N = Math.round(z(inv.vitaUtile)), spesa = z(inv.importo) + z(inv.accessori), residuo = z(inv.valoreResiduo), amm = (spesa - residuo) / N, aliq = z(par.aliquota);
    var base = z(inv.risparmioAnnuo) + z(inv.ricaviAnnui) * z(inv.margineRicavi) - z(inv.costiAnnui), f = [-(spesa - z(inv.contributo))];
    for (var t = 1; t <= N; t++) { var ben = base * Math.pow(1 + z(inv.crescita), t - 1); f.push(ben - (ben - amm) * aliq + (t === N ? residuo : 0)); }
    return f;
  }

  // ------------------------------------------------------------ analisi dell'elenco
  function contesto(az, anno, n, ceCompleto, bilancioCompleto) {
    if (!n || !ceCompleto) return {};
    var r = M.riclassifica(n, az.classificazione);
    return bilancioCompleto ? { mcPct: r.mc_pct, r: r, n: n } : { mcPct: r.mc_pct };
  }
  function analisi(az, ctx) {
    var d = dati(az), par = parametri(d);
    var righe = d.elenco.map(function (inv) { return { inv: inv, k: calcola(inv, par, ctx) }; });
    var validi = righe.filter(function (x) { return x.k.valido && x.inv.stato !== 'scartato'; }).sort(function (a, b) { return (b.k.indice || -1e9) - (a.k.indice || -1e9); });
    validi.forEach(function (x, i) { x.k.posizione = i + 1; });
    return { parametri: par, righe: righe, classifica: validi, contabile: !!ctx.r };
  }

  // ------------------------------------------------------------ simulazione
  /* Tre ipotesi di investimento proporzionate ai ricavi: una conveniente, una con riserva (recupero lungo), una non conveniente. */
  function simula(az) {
    var anni = Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }), n = M.numeri(az.esercizi[anni[anni.length - 1]]), R = n.ricavi || 0;
    if (!(R > 50000)) return vuoto();
    var a = anni[anni.length - 1] + 1, k = function (x) { return Math.round(R * x / 100) * 100; };
    return { parametri: {}, simulato: true, elenco: [
      { id: 'si-1', nome: 'Nuova linea automatizzata', tipo: 'automazione', stato: 'ipotesi', anno: a, importo: k(0.050), accessori: k(0.004), vitaUtile: 8, valoreResiduo: k(0.005), risparmioAnnuo: k(0.011), ricaviAnnui: k(0.02), margineRicavi: 0.30, costiAnnui: k(0.002), finanziamentoQuota: 0.7, finanziamentoTasso: 0.055, finanziamentoAnni: 5, origine: 'simulato' },
      { id: 'si-2', nome: 'Impianto fotovoltaico', tipo: 'impianto', stato: 'ipotesi', anno: a, importo: k(0.020), accessori: k(0.001), vitaUtile: 20, valoreResiduo: 0, risparmioAnnuo: k(0.0031), costiAnnui: k(0.0003), finanziamentoQuota: 0, origine: 'simulato' },
      { id: 'si-3', nome: 'Nuovo software gestionale', tipo: 'software', stato: 'ipotesi', anno: a, importo: k(0.006), accessori: k(0.003), vitaUtile: 5, valoreResiduo: 0, risparmioAnnuo: k(0.0012), costiAnnui: k(0.0006), finanziamentoQuota: 0, origine: 'simulato' }] };
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az), eur = M.fmt.eur;
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    if (!d.elenco.length) return esiti;
    var a = analisi(az, {}), validi = a.righe.filter(function (x) { return x.k.valido; });
    t('investimenti: il VAN a tasso zero è la somma dei flussi', validi.every(function (x) { return Math.abs(van(x.k.flussi, 0) - x.k.flussi.reduce(function (s, f) { return s + f; }, 0)) < 0.01; }), validi.length + ' investimenti calcolati');
    t('investimenti: al tasso pari al TIR il VAN è zero', validi.every(function (x) { return x.k.tir === null || Math.abs(van(x.k.flussi, x.k.tir)) < Math.max(0.01, x.k.uscita * 1e-7); }), validi.map(function (x) { return x.inv.nome + ' ' + (x.k.tir === null ? '—' : M.fmt.pct(x.k.tir)); }).join(' · '));
    t('investimenti: VAN positivo se e solo se il TIR supera il tasso di sconto', validi.every(function (x) { return x.k.tir === null || (x.k.van > 0) === (x.k.tir > a.parametri.tassoSconto); }), 'Tasso di sconto ' + M.fmt.pct(a.parametri.tassoSconto));
    t('investimenti: il piano di rimborso restituisce tutto il capitale', validi.every(function (x) { var p = x.k.piano; return !p.righe.length || (Math.abs(p.righe.reduce(function (s, r) { return s + r.capitale; }, 0) - p.capitale) < 0.01 && p.righe[p.righe.length - 1].residuo < 0.01); }), '');
    t('investimenti: riducendo i benefici alla soglia calcolata il VAN si annulla', validi.every(function (x) { if (x.k.sogliaBenefici === null) return true; var inv2 = Object.assign({}, x.inv, { risparmioAnnuo: z(x.inv.risparmioAnnuo) * x.k.sogliaBenefici, ricaviAnnui: z(x.inv.ricaviAnnui) * x.k.sogliaBenefici, margineRicavi: x.k.margine }); return Math.abs(van(flussiDi(inv2, a.parametri), a.parametri.tassoSconto)) < Math.max(0.01, x.k.uscita * 1e-7); }), '');
    t('investimenti: il recupero attualizzato non precede quello semplice', validi.every(function (x) { return x.k.recupero === null || x.k.recuperoAttualizzato === null || x.k.recuperoAttualizzato >= x.k.recupero - 1e-9; }), '');
    if (d.simulato && d.elenco.length === 3) {
      var k = function (id) { return a.righe.filter(function (x) { return x.inv.id === id; })[0].k; };
      t('investimenti simulati: il primo conviene, il terzo no', k('si-1').van > 0 && k('si-3').van < 0, eur(k('si-1').van) + ' / ' + eur(k('si-3').van));
      t('investimenti simulati: il fotovoltaico ha un recupero lungo', k('si-2').recupero > 6, k('si-2').recupero === null ? 'non recuperato' : k('si-2').recupero.toFixed(1) + ' anni');
    }
    return esiti;
  }

  return { PARAMETRI: PARAMETRI, TIPI: TIPI, STATI: STATI, vuoto: vuoto, dati: dati, parametri: parametri, van: van, tir: tir, recupero: recupero, piano: piano, calcola: calcola, contesto: contesto, analisi: analisi, simula: simula, collaudo: collaudo };
});
