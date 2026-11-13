/* Timone · modulo Personale
   Funzioni pure. Costo aziendale effettivo per persona e per reparto, ore e produttività,
   riconciliazione con il costo del personale di bilancio, simulazioni (assunzione, straordinari, esternalizzazione).
   Dati annuali per persona. Contributi e TFR, se non inseriti, sono CALCOLATI (aliquota media, RAL ÷ 13,5)
   e restano etichettati come tali. Le ore mancanti non vengono stimate.
   Il modulo analizza costi e reparti: non produce classifiche di rendimento individuale. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Personale = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var PARAMETRI = { aliquotaContributi: 0.30, maggiorazione: 0.25, sogliaStraordinari: 0.10, sogliaAssenze: 0.18 };
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function z(x) { return num(x) || 0; }
  function div(a, b) { return (isFinite(a) && isFinite(b) && b !== 0) ? a / b : null; }
  function vuoto() { return { parametri: {}, anni: {} }; }
  function dati(az) { var d = az.personale || vuoto(); d.parametri = d.parametri || {}; d.anni = d.anni || {}; return d; }
  function parametri(d) { return Object.assign({}, PARAMETRI, d.parametri || {}); }

  // ------------------------------------------------------------ singola persona
  // ral = retribuzione lorda dell'anno, straordinari compresi
  function persona(p, par) {
    var o = { calcolati: [], mancanti: [] }, ral = num(p.ral);
    if (ral === null) { o.mancanti.push('retribuzione lorda'); ral = 0; }
    o.ral = ral;
    if (num(p.contributi) !== null) o.contributi = p.contributi; else { o.contributi = ral * par.aliquotaContributi; if (ral) o.calcolati.push('contributi'); }
    if (num(p.tfr) !== null) o.tfr = p.tfr; else { o.tfr = ral / 13.5; if (ral) o.calcolati.push('TFR'); }
    o.inail = z(p.inail); o.premi = z(p.premi); o.altri = z(p.altri); o.benefit = z(p.benefit); o.formazione = z(p.formazione);
    o.costoBilancio = o.ral + o.contributi + o.tfr + o.inail + o.premi + o.altri;      // ciò che normalmente sta nella voce B9
    o.costo = o.costoBilancio + o.benefit + o.formazione;                              // costo aziendale pieno
    o.fte = num(p.fte) === null ? 1 : p.fte;
    o.oreContratto = num(p.oreContratto); o.oreLavorate = num(p.oreLavorate); o.oreStraordinario = z(p.oreStraordinario); o.oreAssenza = num(p.oreAssenza);
    if (o.oreLavorate === null) o.mancanti.push('ore lavorate');
    o.costoOra = o.oreLavorate ? o.costo / o.oreLavorate : null;                        // per ora effettivamente lavorata
    o.costoOraContratto = o.oreContratto ? o.costo / o.oreContratto : null;
    o.quotaStraordinari = (o.oreLavorate && o.oreStraordinario) ? o.oreStraordinario / o.oreLavorate : (o.oreLavorate ? 0 : null);
    o.quotaAssenze = (o.oreContratto && o.oreAssenza !== null) ? o.oreAssenza / o.oreContratto : null;
    o.oneri = div(o.costo - o.ral, o.ral);                                              // quanto costa in più rispetto al lordo
    return o;
  }

  // ------------------------------------------------------------ analisi dell'anno
  function analisi(az, anno, n, ceCompleto) {
    var d = dati(az), par = parametri(d), an = d.anni[anno];
    var out = { anno: anno, parametri: par, presente: !!(an && an.persone && an.persone.length), righe: [], reparti: [], criticita: [] };
    if (!out.presente) return out;
    function nuovo(nome) { return { nome: nome, n: 0, fte: 0, costo: 0, costoBilancio: 0, ral: 0, ore: 0, oreStraordinario: 0, oreContratto: 0, oreAssenza: 0, costoConOre: 0, senzaOre: 0, contrattoConAssenze: 0 }; }
    var T = nuovo('Totale'), rep = {}, tipi = { diretto: nuovo('Diretti'), indiretto: nuovo('Indiretti') }, calcolati = 0;
    function somma(g, k) {
      g.n++; g.fte += k.fte; g.costo += k.costo; g.costoBilancio += k.costoBilancio; g.ral += k.ral; g.oreStraordinario += k.oreStraordinario;
      if (k.oreLavorate !== null) { g.ore += k.oreLavorate; g.costoConOre += k.costo; } else g.senzaOre++;
      if (k.oreContratto !== null) g.oreContratto += k.oreContratto;
      if (k.oreAssenza !== null && k.oreContratto) { g.oreAssenza += k.oreAssenza; g.contrattoConAssenze += k.oreContratto; }
    }
    an.persone.forEach(function (p) {
      var k = persona(p, par); out.righe.push({ p: p, k: k });
      if (k.calcolati.length) calcolati++;
      var nome = String(p.reparto || '').trim() || '(senza reparto)';
      somma(T, k); somma(rep[nome] || (rep[nome] = nuovo(nome)), k); somma(tipi[p.tipo === 'indiretto' ? 'indiretto' : 'diretto'], k);
    });
    function chiudi(g) {
      g.costoOra = g.ore ? g.costoConOre / g.ore : null; g.costoMedio = div(g.costo, g.fte);
      g.quotaStraordinari = g.ore ? g.oreStraordinario / g.ore : null; g.quotaAssenze = g.contrattoConAssenze ? g.oreAssenza / g.contrattoConAssenze : null;
      g.orePerFte = div(g.ore, g.fte); return g;
    }
    chiudi(T); out.totali = T; out.tipi = { diretto: chiudi(tipi.diretto), indiretto: chiudi(tipi.indiretto) };
    out.reparti = Object.keys(rep).map(function (k) { return chiudi(rep[k]); }).sort(function (a, b) { return b.costo - a.costo; });
    out.conValoriCalcolati = calcolati;
    out.quotaIndiretti = div(out.tipi.indiretto.costo, T.costo);
    // riconciliazione con il bilancio (voce B9)
    out.bilancio = (n && typeof n.personale === 'number') ? n.personale : null;
    out.differenza = out.bilancio !== null ? out.bilancio - T.costoBilancio : null;
    out.riconciliato = out.bilancio !== null && Math.abs(out.differenza) <= Math.max(1, Math.abs(out.bilancio) * 0.02);
    out.fuoriB9 = T.costo - T.costoBilancio;                                             // benefit e formazione, di solito tra i servizi
    // produttività (richiede il conto economico completo)
    out.contabile = !!(n && ceCompleto);
    if (out.contabile) {
      var r = M.riclassifica(n, az.classificazione); out.r = r;
      out.ricaviFte = div(r.ricavi, T.fte); out.vaFte = div(r.valore_aggiunto, T.fte);
      out.incidenzaRicavi = div(r.personale, r.ricavi); out.costoSuVa = div(r.personale, r.valore_aggiunto);
      out.vaOra = div(r.valore_aggiunto, T.ore); out.ebitdaOra = div(r.ebitda, T.ore);
    }
    // confronto con i costi orari usati nel modulo Commesse
    out.commesse = [];
    var cm = az.commesse && az.commesse.risorse ? az.commesse.risorse.filter(function (x) { return x.tipo !== 'macchina'; }) : [];
    if (cm.length && out.tipi.diretto.costoOra) {
      var medio = cm.reduce(function (s, x) { return s + z(x.costoOrario); }, 0) / cm.length;
      out.commesse = cm; out.costoOraCommesse = medio; out.scartoCommesse = div(medio - out.tipi.diretto.costoOra, out.tipi.diretto.costoOra);
    }
    out.criticita = criticita(out);
    return out;
  }

  function criticita(a) {
    var eur = M.fmt.eur, pct = M.fmt.pct, par = a.parametri, T = a.totali, out = [];
    var e2 = function (x) { return x === null ? '—' : (Math.round(x * 100) / 100).toFixed(2).replace('.', ',') + ' €'; };
    if (a.bilancio !== null && !a.riconciliato) out.push({ id: 'personale_bilancio', gravita: 'rosso', peso: 1e12, titolo: 'Il costo del personale non coincide con il bilancio',
      dati: 'Somma delle persone ' + eur(T.costoBilancio) + ', voce di bilancio ' + eur(a.bilancio) + ': differenza ' + eur(a.differenza) + '.',
      causa: 'Elenco incompleto, persone cessate o assunte in corso d\'anno non inserite, contributi e TFR calcolati con aliquote medie invece che reali, costi di altre voci.',
      intervento: 'Confrontare l\'elenco con il riepilogo annuale dei cedolini; inserire contributi e TFR effettivi dove sono stati calcolati.',
      effetto: 'Finché la differenza non è spiegata, costi orari e simulazioni sono indicativi.' });
    var rs = a.reparti.filter(function (r) { return r.quotaStraordinari !== null && r.quotaStraordinari > par.sogliaStraordinari; });
    if (rs.length) {
      var ore = rs.reduce(function (s, r) { return s + r.oreStraordinario; }, 0), extra = rs.reduce(function (s, r) { return s + r.oreStraordinario * (r.costoOra || 0) * par.maggiorazione; }, 0);
      out.push({ id: 'straordinari', gravita: 'giallo', peso: extra, titolo: 'Straordinari elevati in ' + rs.length + (rs.length === 1 ? ' reparto' : ' reparti'),
        dati: rs.map(function (r) { return r.nome + ': ' + pct(r.quotaStraordinari) + ' delle ore (' + Math.round(r.oreStraordinario) + ' h)'; }).join(' · ') + '.',
        causa: 'Carico di lavoro stabilmente superiore alla capacità ordinaria, picchi stagionali o assenze da coprire.',
        intervento: 'Confrontare con la simulazione «straordinari o assunzione»: oltre una certa soglia di ore una persona in più costa meno.',
        effetto: ore.toFixed(0) + ' ore di straordinario; la sola maggiorazione stimata vale circa ' + eur(extra) + ' l\'anno.' });
    }
    var ra = a.reparti.filter(function (r) { return r.quotaAssenze !== null && r.quotaAssenze > par.sogliaAssenze; });
    if (ra.length) out.push({ id: 'assenze', gravita: 'giallo', peso: ra.reduce(function (s, r) { return s + r.oreAssenza * (r.costoOra || 0); }, 0), titolo: 'Ore di assenza elevate in ' + ra.length + (ra.length === 1 ? ' reparto' : ' reparti'),
      dati: ra.map(function (r) { return r.nome + ': ' + pct(r.quotaAssenze) + ' delle ore contrattuali'; }).join(' · ') + '.',
      causa: 'Il dato comprende ferie, permessi, malattia e infortuni: da solo non indica un problema. Va letto per reparto e nel tempo.',
      intervento: 'Verificare la composizione delle assenze e la pianificazione delle ferie; nessuna valutazione individuale va basata su questo dato.',
      effetto: 'Ore non lavorate pari a circa ' + eur(ra.reduce(function (s, r) { return s + r.oreAssenza * (r.costoOra || 0); }, 0)) + ' di costo.' });
    if (a.scartoCommesse !== null && a.scartoCommesse !== undefined && Math.abs(a.scartoCommesse) > 0.10) out.push({ id: 'costo_orario_commesse', gravita: 'giallo', peso: Math.abs(a.scartoCommesse) * a.tipi.diretto.costo,
      titolo: 'Il costo orario usato nelle commesse non corrisponde al costo reale',
      dati: 'Costo orario medio nelle commesse ' + e2(a.costoOraCommesse) + ', costo effettivo dei diretti ' + e2(a.tipi.diretto.costoOra) + ' per ora lavorata (' + (a.scartoCommesse > 0 ? '+' : '') + pct(a.scartoCommesse) + ').',
      causa: 'Tariffe orarie non aggiornate o calcolate sulle ore contrattuali invece che su quelle lavorate.',
      intervento: 'Aggiornare i costi orari delle risorse nel modulo Commesse con quelli calcolati qui per reparto.',
      effetto: a.scartoCommesse < 0 ? 'I costi diretti delle commesse sono sottostimati: i preventivi rischiano di essere troppo bassi.' : 'I costi diretti delle commesse sono sovrastimati: i preventivi rischiano di essere fuori mercato.' });
    if (T.senzaOre) out.push({ id: 'personale_ore', gravita: 'giallo', peso: 1, titolo: T.senzaOre + ' persone senza ore lavorate',
      dati: 'Per queste persone il costo orario non è calcolabile.', causa: 'Dato non inserito.', intervento: 'Inserire le ore lavorate dal riepilogo presenze: non vengono stimate.',
      effetto: 'Costo orario e produttività dei reparti coinvolti sono calcolati solo su chi ha le ore.' });
    out.sort(function (x, y) { return x.gravita === y.gravita ? y.peso - x.peso : (x.gravita === 'rosso' ? -1 : 1); });
    return out;
  }

  // ------------------------------------------------------------ simulazioni
  // Assunzione di "numero" persone con una certa RAL.
  function simulaAssunzione(a, ip) {
    var par = a.parametri, nP = Math.max(0, z(ip.numero)), ral = z(ip.ral);
    var unitario = ral * (1 + par.aliquotaContributi) + ral / 13.5, costo = nP * unitario;
    var o = { numero: nP, costoUnitario: unitario, costo: costo, ore: a.totali.orePerFte ? nP * a.totali.orePerFte : null, ipotesi: 'Contributi al ' + M.fmt.pct(par.aliquotaContributi) + ', TFR = RAL ÷ 13,5; ore lavorabili pari alla media attuale per persona; nessun incentivo considerato; costi di selezione e formazione esclusi.' };
    if (a.contabile) {
      var r = a.r;
      o.ebitdaPrima = r.ebitda; o.ebitdaDopo = r.ebitda - costo;
      o.incidenzaPrima = div(r.personale, r.valore_produzione); o.incidenzaDopo = div(r.personale + costo, r.valore_produzione);
      o.produzioneNecessaria = (r.mc_pct && r.mc_pct > 0) ? costo / r.mc_pct : null;   // produzione aggiuntiva che ripaga il costo
      o.mcPct = r.mc_pct;
    }
    return o;
  }
  // Coprire "ore" in più: con straordinari oppure con nuove assunzioni.
  function simulaStraordinari(a, ip) {
    var par = a.parametri, ore = Math.max(0, z(ip.ore)), base = a.tipi.diretto.costoOra || a.totali.costoOra, orePerFte = a.tipi.diretto.orePerFte || a.totali.orePerFte;
    var costoFte = a.tipi.diretto.costoMedio || a.totali.costoMedio;
    if (!base || !orePerFte || !costoFte) return null;
    var o = { ore: ore, costoOraStraordinario: base * (1 + par.maggiorazione), costoStraordinari: ore * base * (1 + par.maggiorazione) };
    o.persone = Math.ceil(ore / orePerFte - 1e-9); o.costoAssunzioni = o.persone * costoFte; o.oreCoperte = o.persone * orePerFte;
    o.soglia = costoFte / o.costoOraStraordinario;                                     // ore oltre le quali una persona in più costa meno
    o.conviene = o.costoStraordinari <= o.costoAssunzioni ? 'straordinari' : 'assunzione';
    o.differenza = Math.abs(o.costoStraordinari - o.costoAssunzioni);
    o.ipotesi = 'Straordinario = costo orario medio dei diretti × (1 + ' + M.fmt.pct(par.maggiorazione) + '); una persona nuova costa e lavora quanto la media attuale dei diretti. Non considera limiti di legge e di contratto sugli straordinari, né il tempo di inserimento.';
    return o;
  }
  // Affidare "ore" all'esterno a una tariffa oraria; solo una quota del costo interno è davvero evitabile.
  function simulaEsternalizzazione(a, ip) {
    var ore = Math.max(0, z(ip.ore)), tariffa = z(ip.tariffa), quota = Math.max(0, Math.min(1, num(ip.quotaEvitabile) === null ? 1 : ip.quotaEvitabile));
    var base = a.tipi.diretto.costoOra || a.totali.costoOra; if (!base) return null;
    var o = { ore: ore, costoEsterno: ore * tariffa, costoInterno: ore * base, risparmioInterno: ore * base * quota };
    o.effetto = o.risparmioInterno - o.costoEsterno;                                   // positivo = conviene
    o.tariffaPareggio = base * quota;
    o.ipotesi = 'Il costo interno si riduce solo per la quota realmente evitabile (' + M.fmt.pct(quota) + '): il personale che resta in organico continua a costare. Non considera qualità, tempi e costi di coordinamento.';
    return o;
  }

  // ------------------------------------------------------------ importazione da tabella
  var COLONNE = {
    codice: ['codice', 'matricola', 'cod', 'id'], nome: ['nome', 'nominativo', 'dipendente', 'cognome e nome', 'cognome nome'], reparto: ['reparto', 'centro di costo', 'area', 'ufficio'], qualifica: ['qualifica', 'mansione', 'livello', 'ruolo'],
    tipo: ['tipo', 'diretto indiretto', 'diretto/indiretto'], fte: ['fte', 'tempo', 'part time', 'percentuale'], ral: ['ral', 'retribuzione lorda', 'lordo', 'retribuzione', 'imponibile'], contributi: ['contributi', 'oneri sociali', 'contributi azienda'],
    tfr: ['tfr', 'trattamento fine rapporto'], inail: ['inail'], premi: ['premi', 'bonus'], benefit: ['benefit', 'welfare'], formazione: ['formazione'], altri: ['altri', 'altri costi', 'altri oneri'],
    oreContratto: ['ore contratto', 'ore contrattuali', 'ore teoriche'], oreLavorate: ['ore lavorate', 'ore', 'ore effettive'], oreStraordinario: ['ore straordinario', 'straordinari', 'ore straordinarie'], oreAssenza: ['ore assenza', 'assenze', 'ore di assenza']
  };
  function norm(s) { return String(s === null || s === undefined ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function daTabella(matrice, numero) {
    var testa = -1, mappa = {}, avvisi = [];
    for (var i = 0; i < Math.min(matrice.length, 15) && testa < 0; i++) {
      var m = {};
      matrice[i].forEach(function (c, j) { var n = norm(c); Object.keys(COLONNE).forEach(function (k) { if (m[k] === undefined && COLONNE[k].indexOf(n) >= 0) m[k] = j; }); });
      if (m.ral !== undefined && (m.codice !== undefined || m.nome !== undefined)) { testa = i; mappa = m; }
    }
    if (testa < 0) return { persone: [], colonne: [], avvisi: ['Non trovo l\'intestazione: servono almeno “Codice” (o “Nome”) e “RAL”. Scarica il modello per vedere i nomi accettati.'] };
    var persone = [], scartate = 0;
    for (var r = testa + 1; r < matrice.length; r++) {
      var riga = matrice[r], v = function (k) { return mappa[k] === undefined ? '' : String(riga[mappa[k]] === undefined ? '' : riga[mappa[k]]).trim(); };
      var ral = mappa.ral === undefined ? null : numero(riga[mappa.ral]);
      if (!v('codice') && !v('nome')) continue;
      if (ral === null) { scartate++; continue; }
      var p = { id: 'p' + persone.length + '-' + Date.now().toString(36), codice: v('codice').slice(0, 30), nome: v('nome').slice(0, 80), reparto: v('reparto').slice(0, 60), qualifica: v('qualifica').slice(0, 60), tipo: /indir/i.test(v('tipo')) ? 'indiretto' : 'diretto', ral: ral, origine: 'importato' };
      ['contributi', 'tfr', 'inail', 'premi', 'benefit', 'formazione', 'altri', 'oreContratto', 'oreLavorate', 'oreStraordinario', 'oreAssenza'].forEach(function (k) { if (mappa[k] === undefined) return; var x = numero(riga[mappa[k]]); if (x !== null) p[k] = x; });
      if (mappa.fte !== undefined) { var f = numero(riga[mappa.fte]); if (f !== null) p.fte = f > 1 ? f / 100 : f; }
      persone.push(p);
    }
    if (scartate) avvisi.push(scartate + ' righe senza retribuzione non sono state importate.');
    if (mappa.oreLavorate === undefined) avvisi.push('Il file non contiene le ore lavorate: costo orario e produttività non saranno calcolabili.');
    if (mappa.contributi === undefined) avvisi.push('Il file non contiene i contributi: verranno calcolati con l\'aliquota media impostata nei parametri ed etichettati come calcolati.');
    return { persone: persone, colonne: Object.keys(mappa), avvisi: avvisi };
  }
  function modelloCsv() { return 'Codice;Nome;Reparto;Qualifica;Tipo;FTE;RAL;Contributi;TFR;INAIL;Premi;Benefit;Formazione;Altri;Ore contratto;Ore lavorate;Ore straordinario;Ore assenza\r\nD001;;Produzione;Operaio;diretto;1;28000;8400;2074;420;0;0;300;0;2080;1810;90;270\r\n'; }

  // ------------------------------------------------------------ simulazione
  function rng(seme) { var a = seme >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var REPARTI = { manifatturiera: [['Produzione', 'diretto', 0.5], ['Finitura', 'diretto', 0.2], ['Magazzino', 'indiretto', 0.1], ['Uffici', 'indiretto', 0.2]], artigiana: [['Laboratorio', 'diretto', 0.6], ['Posa e cantieri', 'diretto', 0.25], ['Uffici', 'indiretto', 0.15]],
    commerciale: [['Vendite', 'diretto', 0.45], ['Magazzino', 'indiretto', 0.3], ['Uffici', 'indiretto', 0.25]], servizi: [['Operativi', 'diretto', 0.7], ['Commerciale', 'indiretto', 0.12], ['Uffici', 'indiretto', 0.18]], professionista: [['Studio', 'diretto', 0.7], ['Segreteria', 'indiretto', 0.3]] };

  /* Elenco del personale degli ultimi due esercizi: la somma dei costi coincide con la voce di bilancio.
     Il primo reparto ha straordinari elevati di proposito. */
  function simula(az, seme) {
    var R = rng((seme === undefined || seme === null ? 1 : Number(seme)) + 53), out = { parametri: {}, anni: {}, simulato: true };
    var reparti = REPARTI[az.settore] || REPARTI.manifatturiera;
    Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }).slice(-2).forEach(function (anno) {
      var n = M.numeri(az.esercizi[anno]), tot = n.personale || 0;
      if (tot < 15000) return;
      var N = Math.max(2, Math.min(60, Math.round(tot / 40000))), persone = [], pesi = [], sp = 0;
      for (var i = 0; i < N; i++) { var w = 0.75 + R() * 0.7; pesi.push(w); sp += w; }
      var assegnato = 0;
      for (var j = 0; j < N; j++) {
        // reparto in proporzione alle quote; le prime persone vanno al primo reparto
        var u = (j + 0.5) / N, acc = 0, rep = reparti[reparti.length - 1];
        for (var q = 0; q < reparti.length; q++) { acc += reparti[q][2]; if (u <= acc) { rep = reparti[q]; break; } }
        var costo = j === N - 1 ? tot - assegnato : Math.round(tot * pesi[j] / sp); assegnato += costo;
        // scomposizione del costo: RAL, contributi 29-31%, TFR = RAL ÷ 13,5, INAIL; il resto va in "altri" (arrotondamenti)
        var aliq = 0.29 + R() * 0.02, ral = Math.round(costo / (1 + aliq + 1 / 13.5 + 0.012)), contributi = Math.round(ral * aliq), tfr = Math.round(ral / 13.5), inail = Math.round(ral * 0.012);
        var contratto = 2080, primo = rep === reparti[0], assenza = Math.round(contratto * (0.12 + R() * 0.03) * (rep[0] === 'Magazzino' ? 1 : 0.95)), straord = Math.round(contratto * (primo ? 0.14 + R() * 0.05 : R() * 0.03));
        persone.push({ id: 's' + anno + '-' + j, codice: (rep[1] === 'diretto' ? 'D' : 'I') + String(101 + j), nome: '', reparto: rep[0], qualifica: rep[1] === 'diretto' ? 'Operativo' : 'Impiegato', tipo: rep[1], fte: 1,
          ral: ral, contributi: contributi, tfr: tfr, inail: inail, altri: costo - ral - contributi - tfr - inail, formazione: Math.round(R() * 400), oreContratto: contratto, oreLavorate: contratto - assenza + straord, oreStraordinario: straord, oreAssenza: assenza, origine: 'simulato' });
      }
      out.anni[anno] = { persone: persone };
    });
    return out;
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az), eur = M.fmt.eur;
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    Object.keys(d.anni).map(Number).sort().forEach(function (anno) {
      var n = az.esercizi[anno] ? M.numeri(az.esercizi[anno]) : null, a = analisi(az, anno, n, !!n && M.mancantiSezione(n, 'ce').length === 0);
      if (!a.presente) return;
      var T = a.totali, sr = a.reparti.reduce(function (s, r) { return s + r.costo; }, 0), st = a.tipi.diretto.costo + a.tipi.indiretto.costo, sp = a.righe.reduce(function (s, x) { return s + x.k.costo; }, 0);
      t(anno + ' · personale: reparti, diretti/indiretti e persone sommano allo stesso totale', Math.abs(sr - T.costo) < 0.5 && Math.abs(st - T.costo) < 0.5 && Math.abs(sp - T.costo) < 0.5, a.righe.length + ' persone, ' + eur(T.costo));
      t(anno + ' · personale: costo pieno = costo di bilancio + benefit e formazione', Math.abs(T.costo - T.costoBilancio - a.fuoriB9) < 0.5 && a.fuoriB9 >= 0, eur(a.fuoriB9) + ' fuori dalla voce B9');
      t(anno + ' · personale: costo orario = costo ÷ ore lavorate', T.ore ? Math.abs(T.costoOra * T.ore - T.costoConOre) < 0.5 : T.costoOra === null, T.costoOra === null ? 'Ore assenti: non calcolato' : (Math.round(T.costoOra * 100) / 100) + ' €/h');
      if (a.bilancio === null) t(anno + ' · personale: voce di bilancio disponibile per il confronto', false, 'Costo del personale assente nel bilancio ' + anno);
      else t(anno + ' · personale: elenco riconciliato con il costo del personale di bilancio', a.riconciliato, 'Elenco ' + eur(T.costoBilancio) + ', bilancio ' + eur(a.bilancio));
      var sa = simulaAssunzione(a, { numero: 1, ral: 30000 });
      t(anno + ' · personale: simulazione assunzione coerente', Math.abs(sa.costo - (30000 * (1 + a.parametri.aliquotaContributi) + 30000 / 13.5)) < 0.01 && (!a.contabile || Math.abs(sa.ebitdaPrima - sa.ebitdaDopo - sa.costo) < 0.01), eur(sa.costo));
      var ss = simulaStraordinari(a, { ore: 1000 });
      if (ss) { var alla = simulaStraordinari(a, { ore: ss.soglia });
        t(anno + ' · personale: alla soglia di indifferenza straordinari e assunzione costano uguale', ss.soglia <= (a.tipi.diretto.orePerFte || T.orePerFte) ? Math.abs(alla.costoStraordinari - alla.costoAssunzioni) < 1 : true, Math.round(ss.soglia) + ' ore'); }
      if (d.simulato) {
        t(anno + ' · personale simulato: costo uguale al bilancio', Math.abs(a.differenza) < 1, 'Differenza ' + eur(a.differenza));
        t(anno + ' · personale simulato: straordinari elevati trovati', a.criticita.some(function (x) { return x.id === 'straordinari'; }), a.criticita.map(function (x) { return x.id; }).join(', '));
      }
    });
    return esiti;
  }

  return { PARAMETRI: PARAMETRI, vuoto: vuoto, dati: dati, parametri: parametri, persona: persona, analisi: analisi, simulaAssunzione: simulaAssunzione, simulaStraordinari: simulaStraordinari,
    simulaEsternalizzazione: simulaEsternalizzazione, daTabella: daTabella, modelloCsv: modelloCsv, simula: simula, collaudo: collaudo };
});
