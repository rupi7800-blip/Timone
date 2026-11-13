/* Timone · modulo Piano pluriennale (pianificazione strategica)
   Funzioni pure. Partendo dall'ultimo bilancio completo proietta anno per anno, fino a 10 anni, conto economico,
   stato patrimoniale e flussi di cassa secondo ipotesi dichiarate: volumi, prezzi, costi, giorni di incasso,
   pagamento e scorta, investimenti, nuovi finanziamenti, rimborso dei debiti, dividendi, aumenti di capitale.
   Ogni anno previsto è un bilancio completo nelle stesse voci del motore: riclassificazione, indici e rendiconto
   sono quelli di motore.js. La liquidità è la voce che fa quadrare il bilancio: se scende sotto il minimo voluto
   il piano ricorre a debito bancario a breve e lo segnala come fabbisogno; se avanza, lo rimborsa.
   Tutti i valori sono previsioni su ipotesi dell'utente: il modulo non stima la crescita né l'inflazione. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Piano = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var IPOTESI = { volumi: 0, prezzi: 0, inflMaterie: 0, inflServizi: 0, inflPersonale: 0, inflAltri: 0, dividendi: 0, liquiditaMinima: 0, anniRimborso: 5 };
  var ORIZZONTI = [1, 3, 5, 10];
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function z(x) { return num(x) || 0; }
  function vuoto() { return { piani: [] }; }
  function dati(az) { var d = az.piano || vuoto(); d.piani = d.piani || []; return d; }
  function ipotesi(ip) { var o = Object.assign({}, IPOTESI, ip || {}); o.investimenti = (ip && ip.investimenti) || []; o.finanziamenti = (ip && ip.finanziamenti) || []; o.aumenti = (ip && ip.aumenti) || []; return o; }

  function valida(n0, anni, ip) {
    var e = [], man = M.mancanti(n0 || {});
    if (!n0) { e.push('Manca il bilancio dell\'anno di partenza.'); return e; }
    if (man.length) e.push('Il bilancio di partenza è incompleto: mancano ' + man.length + ' voci. Il piano non parte da dati parziali.');
    else if (Math.abs(M.riclassifica(n0, {}).quadratura) > 1) e.push('Il bilancio di partenza non quadra: attivo e passivo differiscono.');
    if (!(anni >= 1 && anni <= 10)) e.push('L\'orizzonte va da 1 a 10 anni.');
    ['volumi', 'prezzi', 'inflMaterie', 'inflServizi', 'inflPersonale', 'inflAltri'].forEach(function (k) { if (num(ip[k]) !== null && (ip[k] < -0.5 || ip[k] > 1)) e.push('Variazione annua fuori dai limiti (da −50% a +100%): ' + k + '.'); });
    return e;
  }

  /* Proiezione. n0 = numeri del bilancio di partenza; opz.rimborsi = quote capitale dei debiti a lungo esistenti per
     ciascun anno del piano (per esempio dal modulo Finanziamenti); se assenti: rimborso lineare in ip.anniRimborso anni. */
  function proietta(n0, classif, anni, ipIn, opz) {
    var ip = ipotesi(ipIn), r0 = M.riclassifica(n0, classif), out = { anni: [], avvisi: [], base: r0, ip: ip }, q = function (k) { return M.quota(classif, k); };
    var t0 = num(n0.imposte) !== null && r0.risultato_ante_imposte > 0 ? n0.imposte / r0.risultato_ante_imposte : null; out.aliquota = (t0 !== null && t0 >= 0 && t0 <= 0.6) ? t0 : M.ALIQUOTA_IPOTESI; out.aliquotaStimata = out.aliquota !== t0;
    var tm = r0.debiti_finanziari > 0 ? z(n0.oneri_fin) / r0.debiti_finanziari : null; out.tasso = (tm !== null && tm >= 0.005 && tm <= 0.15) ? tm : 0.05; out.tassoStimato = out.tasso !== tm;
    var cons0 = z(n0.materie) + z(n0.var_rim_materie), acq0 = z(n0.materie) + z(n0.servizi) + z(n0.godimento);
    var gI = num(ip.giorniIncasso) !== null ? ip.giorniIncasso : (z(n0.ricavi) > 0 ? z(n0.crediti_clienti) / n0.ricavi * 365 : null);
    var gS = num(ip.giorniScorta) !== null ? ip.giorniScorta : (cons0 > 0 ? z(n0.rimanenze) / cons0 * 365 : null);
    var gP = num(ip.giorniPagamento) !== null ? ip.giorniPagamento : (acq0 > 0 ? z(n0.debiti_fornitori) / acq0 * 365 : null);
    out.giorni = { incasso: gI, scorta: gS, pagamento: gP };
    var prev = n0, cons = cons0, utilePrec = r0.utile, residuoAmm = z(n0.imm_immateriali) + z(n0.imm_materiali), esistente = z(n0.debiti_banche_lungo), quotaLin = esistente / Math.max(1, Math.round(z(ip.anniRimborso) || 5));
    var nuovi = ip.finanziamenti.map(function (f) { return { anno: Math.round(z(f.anno)), importo: z(f.importo), durata: Math.max(1, Math.round(z(f.durata) || 5)), tasso: num(f.tasso) !== null ? f.tasso : out.tasso, residuo: 0 }; }).filter(function (f) { return f.importo > 0 && f.anno >= 1; });
    var v = 1 + z(ip.volumi), p = 1 + z(ip.prezzi), cresce = function (k, infl) { return z(prev[k]) * (1 + z(infl)) * (q(k) * v + 1 - q(k)); };
    for (var t = 1; t <= anni; t++) {
      var m = Object.assign({}, prev), y = { t: t };
      // conto economico
      m.ricavi = z(prev.ricavi) * v * p; m.var_rim_prodotti = 0; m.rettifiche_fin = 0;
      cons = cons * (1 + z(ip.inflMaterie)) * (q('materie') * v + 1 - q('materie'));
      m.servizi = cresce('servizi', ip.inflServizi); m.godimento = cresce('godimento', ip.inflAltri); m.oneri_diversi = cresce('oneri_diversi', ip.inflAltri); m.personale = cresce('personale', ip.inflPersonale);
      // investimenti e ammortamenti
      y.investimenti = ip.investimenti.reduce(function (s, i) { return s + (Math.round(z(i.anno)) === t ? z(i.importo) : 0); }, 0);
      var ammEs = Math.min(z(n0.ammortamenti), Math.max(0, residuoAmm)); residuoAmm -= ammEs;
      var ammNuovi = ip.investimenti.reduce(function (s, i) { var a = Math.round(z(i.anno)), vita = Math.max(1, Math.round(z(i.vita) || 5)); return s + (z(i.importo) > 0 && t >= a && t < a + vita ? z(i.importo) / vita : 0); }, 0);
      m.ammortamenti = ammEs + ammNuovi; y.ammortamenti = m.ammortamenti;
      var immBase = z(prev.imm_immateriali) + z(prev.imm_materiali), quotaImm = immBase > 0 ? z(prev.imm_immateriali) / immBase : 0, daImm = Math.min(z(prev.imm_immateriali), ammEs * quotaImm);
      m.imm_immateriali = z(prev.imm_immateriali) - daImm; m.imm_materiali = z(prev.imm_materiali) - (ammEs - daImm) - ammNuovi + y.investimenti;
      // capitale circolante: giorni di scorta, incasso e pagamento
      m.rimanenze = gS === null ? z(prev.rimanenze) : cons * gS / 365;
      var dRim = m.rimanenze - z(prev.rimanenze); m.materie = cons + dRim; m.var_rim_materie = -dRim;        // acquisti = consumi + aumento delle scorte
      m.crediti_clienti = gI === null ? z(prev.crediti_clienti) : m.ricavi * gI / 365;
      var acq = m.materie + m.servizi + m.godimento; m.debiti_fornitori = gP === null ? z(prev.debiti_fornitori) : Math.max(0, acq) * gP / 365;
      m.tfr = z(prev.personale) > 0 ? z(prev.tfr) * m.personale / prev.personale : z(prev.tfr);
      // debiti finanziari a lungo: rimborso degli esistenti, rimborso ed erogazione dei nuovi; interessi sui saldi iniziali
      var rimbEs = Math.min(esistente, opz && opz.rimborsi ? z(opz.rimborsi[t - 1]) : quotaLin), interessi = out.tasso * (esistente + z(prev.altri_debiti_fin) + z(prev.debiti_banche_breve)), rimbNuovi = 0, erogati = 0;
      nuovi.forEach(function (f) { interessi += f.residuo * f.tasso; if (t > f.anno && f.residuo > 0) { var qc = Math.min(f.residuo, f.importo / f.durata); f.residuo -= qc; rimbNuovi += qc; } if (t === f.anno) { f.residuo = f.importo; erogati += f.importo; } });
      esistente -= rimbEs; m.debiti_banche_lungo = esistente + nuovi.reduce(function (s, f) { return s + f.residuo; }, 0);
      m.oneri_fin = interessi; y.rimborsi = rimbEs + rimbNuovi; y.erogati = erogati;
      // imposte, patrimonio netto
      m.imposte = 0; var rai = M.riclassifica(m, classif).risultato_ante_imposte; m.imposte = Math.max(0, rai) * out.aliquota;
      y.dividendi = Math.max(0, utilePrec) * Math.max(0, Math.min(1, z(ip.dividendi)));
      y.aumento = ip.aumenti.reduce(function (s, a) { return s + (Math.round(z(a.anno)) === t ? z(a.importo) : 0); }, 0);
      m.capitale_riserve = z(prev.capitale_riserve) + utilePrec - y.dividendi + y.aumento;
      // liquidità: voce che fa quadrare; sotto il minimo si ricorre al debito a breve, sopra lo si rimborsa
      m.liquidita = 0; var r = M.riclassifica(m, classif), cassa = -r.quadratura, min = Math.max(0, z(ip.liquiditaMinima)), breve0 = z(prev.debiti_banche_breve);
      if (cassa < min) { y.nuovoBreve = min - cassa; m.debiti_banche_breve = breve0 + y.nuovoBreve; m.liquidita = min; }
      else { var rb = Math.min(breve0, cassa - min); y.nuovoBreve = -rb; m.debiti_banche_breve = breve0 - rb; m.liquidita = cassa - rb; }
      r = M.riclassifica(m, classif);
      y.n = m; y.r = r; y.flussi = M.rendiconto(m, prev, classif); y.servizio = y.rimborsi + m.oneri_fin; y.copertura = y.servizio > 0 ? r.ebitda / y.servizio : null; y.pfnEbitda = r.ebitda > 0 ? r.pfn / r.ebitda : null;
      out.anni.push(y); utilePrec = r.utile; prev = m;
    }
    var ult = out.anni[out.anni.length - 1], S = M.SOGLIE, som = function (f) { return out.anni.reduce(function (s, a) { return s + f(a); }, 0); };
    out.sintesi = { ricaviFinali: ult.r.ricavi, crescitaMedia: r0.ricavi > 0 ? Math.pow(ult.r.ricavi / r0.ricavi, 1 / anni) - 1 : null, ebitdaFinale: ult.r.ebitda, utileCumulato: som(function (a) { return a.r.utile; }), investimenti: som(function (a) { return a.investimenti; }), flussoOperativo: som(function (a) { return a.flussi.flusso_operativo; }),
      variazionePfn: ult.r.pfn - r0.pfn, pfnFinale: ult.r.pfn, pnFinale: ult.r.patrimonio_netto, breveFinale: z(ult.n.debiti_banche_breve), breveMax: Math.max.apply(null, out.anni.map(function (a) { return z(a.n.debiti_banche_breve); })), fabbisogno: Math.max(0, Math.max.apply(null, out.anni.map(function (a) { return z(a.n.debiti_banche_breve); })) - z(n0.debiti_banche_breve)) };
    // segnali: primo anno in cui si verifica ciascun problema
    var primo = function (f) { var a = out.anni.filter(f)[0]; return a ? a.t : null; };
    out.segnali = { pnNegativo: primo(function (a) { return a.r.patrimonio_netto < 0; }), perdita: primo(function (a) { return a.r.utile < 0; }), copertura: primo(function (a) { return a.copertura !== null && a.copertura < 1; }), debito: primo(function (a) { return a.r.ebitda <= 0 ? a.r.pfn > 0 : a.pfnEbitda > S.pfn_ebitda_rosso; }), nuovaFinanza: primo(function (a) { return a.nuovoBreve > 0.5; }) };
    if (out.aliquotaStimata) out.avvisi.push('Imposte calcolate con l\'aliquota ipotizzata del ' + (M.ALIQUOTA_IPOTESI * 100).toFixed(1).replace('.', ',') + '% (IRES + IRAP), perché quella effettiva dell\'anno di partenza non è utilizzabile.');
    if (out.tassoStimato) out.avvisi.push('Interessi calcolati con un tasso ipotizzato del 5%, perché quello medio dell\'anno di partenza non è ricavabile dal bilancio.');
    if (residuoAmm <= 0 && z(n0.ammortamenti) > 0) out.avvisi.push('Nel corso del piano i beni esistenti risultano completamente ammortizzati: senza nuovi investimenti gli ammortamenti si azzerano e la capacità produttiva potrebbe non reggere i volumi previsti.');
    return out;
  }

  /* Crescita annua dei volumi necessaria per ottenere un utile netto obiettivo nell'ultimo anno (le altre ipotesi restano). */
  function crescitaPerUtile(n0, classif, anni, ip, opz, utile) {
    var f = function (g) { var x = proietta(n0, classif, anni, Object.assign({}, ip, { volumi: g }), opz); return x.anni[anni - 1].r.utile - utile; };
    var a = -0.5, b = 1; if (f(a) > 0 || f(b) < 0) return null;
    for (var i = 0; i < 60; i++) { var c = (a + b) / 2; if (f(c) > 0) b = c; else a = c; }
    return (a + b) / 2;
  }
  /* Varianti prudenziale e favorevole di un piano: tre punti di volumi e un punto di prezzi e di costi in meno o in più. */
  function variante(ip, tipo) {
    var s = tipo === 'favorevole' ? 1 : -1, o = JSON.parse(JSON.stringify(ip || {}));
    o.volumi = z(o.volumi) + s * 0.03; o.prezzi = z(o.prezzi) + s * 0.01; ['inflMaterie', 'inflServizi', 'inflPersonale', 'inflAltri'].forEach(function (k) { o[k] = z(o[k]) - s * 0.01; });
    return o;
  }

  function analizza(az, piano, opz) {
    var es = az.esercizi && az.esercizi[piano.base], n0 = es ? M.numeri(es) : null, anni = Math.round(z(piano.anni)), e = valida(n0, anni, piano.ip || {});
    if (e.length) return { valido: false, errori: e };
    var x = proietta(n0, az.classificazione, anni, piano.ip, opz); x.valido = true; x.n0 = n0; x.baseAnno = piano.base; return x;
  }

  function criticita(piano, x, eur) {
    var c = [], s = x.segnali, anno = function (t) { return piano.base + t; };
    if (s.pnNegativo) c.push({ gravita: 'rosso', titolo: 'Piano «' + piano.nome + '»: patrimonio netto negativo nel ' + anno(s.pnNegativo), dati: 'Con le ipotesi del piano le perdite azzerano il patrimonio netto nel ' + anno(s.pnNegativo) + ' (' + eur(x.anni[s.pnNegativo - 1].r.patrimonio_netto) + ').', causa: 'Perdite previste superiori ai mezzi propri.', intervento: 'Rivedere costi e ipotesi di vendita; valutare un aumento di capitale prima che le perdite lo impongano.', effetto: 'Obblighi di legge per la riduzione del capitale per perdite: da valutare con il commercialista.' });
    if (s.copertura) c.push({ gravita: s.copertura <= 2 ? 'rosso' : 'giallo', titolo: 'Piano «' + piano.nome + '»: rate non coperte dal margine nel ' + anno(s.copertura), dati: 'Nel ' + anno(s.copertura) + ' l\'EBITDA previsto (' + eur(x.anni[s.copertura - 1].r.ebitda) + ') è inferiore a rimborsi e interessi (' + eur(x.anni[s.copertura - 1].servizio) + ').', causa: 'Debito da rimborsare troppo concentrato rispetto ai margini previsti.', intervento: 'Allungare le scadenze, ridurre o rinviare gli investimenti, rafforzare i mezzi propri.', effetto: 'Mancano ' + eur(x.anni[s.copertura - 1].servizio - x.anni[s.copertura - 1].r.ebitda) + ' in quell\'anno, prima di imposte e investimenti.' });
    if (x.sintesi.fabbisogno > Math.abs(x.base.ricavi) * 0.05 && x.sintesi.fabbisogno > 1) c.push({ gravita: 'giallo', titolo: 'Piano «' + piano.nome + '»: serve nuova finanza a breve', dati: 'Per non scendere sotto la liquidità minima il piano aumenta il debito bancario a breve fino a ' + eur(x.sintesi.breveMax) + ' (' + eur(x.sintesi.fabbisogno) + ' più di oggi), a partire dal ' + anno(s.nuovaFinanza) + '.', causa: 'Investimenti, rimborsi e capitale circolante assorbono più cassa di quanta la gestione ne produce.', intervento: 'Verificare la disponibilità delle linee di credito o coprire il fabbisogno con finanziamenti a medio termine o mezzi propri.', effetto: 'Fabbisogno aggiuntivo massimo: ' + eur(x.sintesi.fabbisogno) + '.' });
    return c;
  }

  // ------------------------------------------------------------ simulazione
  function simula(az) {
    var anni = Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }); if (!anni.length) return vuoto();
    var Y = anni[anni.length - 1], n = M.numeri(az.esercizi[Y]); if (M.mancanti(n).length) return vuoto();
    var inv = Math.max(20000, Math.round(z(n.ricavi) * 0.08 / 5000) * 5000), ip = { volumi: 0.03, prezzi: 0.02, inflMaterie: 0.02, inflServizi: 0.02, inflPersonale: 0.025, inflAltri: 0.02, dividendi: 0, liquiditaMinima: Math.round(z(n.ricavi) * 0.02 / 1000) * 1000, anniRimborso: 6,
      investimenti: [{ anno: 2, importo: inv, vita: 8, descrizione: 'Nuova linea (di fantasia)' }], finanziamenti: [{ anno: 2, importo: Math.round(inv * 0.7), durata: 5, tasso: 0.05 }], aumenti: [] };
    return { simulato: true, piani: [{ id: 'sp-1', nome: 'Centrale', base: Y, anni: 5, ip: ip, origine: 'simulato' }, { id: 'sp-2', nome: 'Prudenziale', base: Y, anni: 5, ip: variante(ip, 'prudenziale'), origine: 'simulato' }, { id: 'sp-3', nome: 'Favorevole', base: Y, anni: 5, ip: variante(ip, 'favorevole'), origine: 'simulato' }] };
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az);
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    var val = d.piani.map(function (p) { return { p: p, x: analizza(az, p) }; }).filter(function (o) { return o.x.valido; }); if (!val.length) return esiti;
    var ogni = function (f) { return val.every(function (o) { var prev = o.x.n0, pu = o.x.base.utile; return o.x.anni.every(function (a) { var ok = f(a, prev, o, pu); prev = a.n; pu = a.r.utile; return ok; }); }); }, tol = function (o) { return Math.max(0.5, Math.abs(o.x.base.totale_attivo) * 1e-9); };
    t('piano: in ogni anno previsto attivo e passivo quadrano', ogni(function (a, p, o) { return Math.abs(a.r.quadratura) < tol(o); }), val.length + ' piani, ' + val.reduce(function (s, o) { return s + o.x.anni.length; }, 0) + ' anni previsti');
    t('piano: il rendiconto spiega per intero la variazione della liquidità', ogni(function (a, p, o) { return Math.abs(a.flussi.differenza) < tol(o); }), '');
    t('piano: la liquidità non scende mai sotto il minimo impostato', ogni(function (a, p, o) { return a.n.liquidita >= Math.max(0, z(o.x.ip.liquiditaMinima)) - tol(o); }), '');
    t('piano: patrimonio netto = quello dell\'anno prima + utile − dividendi + aumenti di capitale', ogni(function (a, p, o) { var rp = M.riclassifica(p, az.classificazione); return Math.abs(a.r.patrimonio_netto - (rp.patrimonio_netto + a.r.utile - a.dividendi + a.aumento)) < tol(o); }), '');
    t('piano: immobilizzazioni = quelle dell\'anno prima + investimenti − ammortamenti', ogni(function (a, p, o) { var rp = M.riclassifica(p, az.classificazione); return Math.abs(a.r.immobilizzazioni - (rp.immobilizzazioni + a.investimenti - a.ammortamenti)) < tol(o) && a.n.imm_immateriali >= -tol(o); }), '');
    t('piano: debiti a lungo = quelli dell\'anno prima − rimborsi + nuovi finanziamenti', ogni(function (a, p, o) { return Math.abs(z(a.n.debiti_banche_lungo) - (z(p.debiti_banche_lungo) - a.rimborsi + a.erogati)) < tol(o) && a.n.debiti_banche_lungo >= -tol(o) && a.n.debiti_banche_breve >= -tol(o); }), '');
    t('piano: imposte mai negative e pari all\'aliquota sul risultato positivo', ogni(function (a, p, o) { return Math.abs(a.n.imposte - Math.max(0, a.r.risultato_ante_imposte) * o.x.aliquota) < tol(o); }), '');
    var o0 = val[0], fermo = proietta(o0.x.n0, az.classificazione, 3, { anniRimborso: 5 });
    t('piano: con tutte le variazioni a zero ricavi e costi operativi restano quelli di partenza', fermo.anni.every(function (a) { return Math.abs(a.r.ricavi - o0.x.base.ricavi) < 1e-6 && Math.abs(a.r.costi_esterni + a.r.personale - o0.x.base.costi_esterni - o0.x.base.personale) < tol(o0); }), '');
    if (d.simulato && val.length === 3) {
      var f = function (k) { return val[k].x.anni[val[k].x.anni.length - 1].r; };
      t('piano simulato: favorevole > centrale > prudenziale per ricavi ed EBITDA finali', f(2).ricavi > f(0).ricavi && f(0).ricavi > f(1).ricavi && f(2).ebitda > f(0).ebitda && f(0).ebitda > f(1).ebitda, Math.round(f(1).ebitda) + ' < ' + Math.round(f(0).ebitda) + ' < ' + Math.round(f(2).ebitda));
      var a2 = val[0].x.anni[1]; t('piano simulato: investimento e finanziamento del secondo anno registrati', a2.investimenti > 0 && a2.erogati > 0 && val[0].x.anni[2].rimborsi > val[0].x.anni[0].rimborsi - 1e-6 && val[0].x.anni[2].ammortamenti > val[0].x.anni[0].ammortamenti - 1e-6, Math.round(a2.investimenti) + ' / ' + Math.round(a2.erogati));
      var g = crescitaPerUtile(val[0].x.n0, az.classificazione, 5, val[0].p.ip, null, f(0).utile); t('piano simulato: la crescita necessaria per l\'utile del piano è quella del piano', g !== null && Math.abs(g - val[0].p.ip.volumi) < 1e-6, g === null ? 'non trovata' : (g * 100).toFixed(3) + '%');
    }
    return esiti;
  }

  return { IPOTESI: IPOTESI, ORIZZONTI: ORIZZONTI, vuoto: vuoto, dati: dati, ipotesi: ipotesi, valida: valida, proietta: proietta, crescitaPerUtile: crescitaPerUtile, variante: variante, analizza: analizza, criticita: criticita, simula: simula, collaudo: collaudo };
});
