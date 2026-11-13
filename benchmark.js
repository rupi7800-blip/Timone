/* Timone · modulo Confronti (benchmarking) e ISA
   Funzioni pure. Confronta gli indici di bilancio dell'azienda con termini di confronto scelti dall'utente:
     - concorrenti di cui si è caricato il bilancio depositato (XBRL): gli indici sono calcolati dal loro bilancio;
     - riferimenti di settore inseriti a mano (studi, statistiche, associazioni), sempre con la fonte.
   Per ogni indice calcola mediana, minimo e massimo dei termini, la posizione dell'azienda e, dove ha senso,
   quanto vale in euro lo scarto dalla mediana. Senza fonte un riferimento non entra nel confronto.
   ISA (indici sintetici di affidabilità fiscale): il punteggio NON viene calcolato (lo calcola il software
   dell'Agenzia delle Entrate); si registra quello della dichiarazione e si confronta con le soglie del
   provvedimento annuale. Il modulo non contiene medie di settore e non ne inventa. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'), require('./simulatore.js'));
  else root.Benchmark = factory(root.Motore, root.Simulatore);
})(typeof self !== 'undefined' ? self : this, function (M, Sim) {
  'use strict';

  /* Indici confrontabili (rapporti, non importi) e verso: 'alto' = meglio se più alto, 'basso' = meglio se più basso,
     null = dipende dal modello di impresa (si mostra lo scarto senza giudizio). */
  var VERSO = { crescita: 'alto', ebitda_margin: 'alto', ebit_margin: 'alto', ros: 'alto', roi: 'alto', roe: 'alto', roa: 'alto', incidenza_personale: null, incidenza_materie: null, current_ratio: 'alto', quick_ratio: 'alto',
    dso: 'basso', dpo: null, giorni_magazzino: 'basso', rotazione_magazzino: 'alto', ccc: 'basso', pfn_ebitda: 'basso', debt_equity: 'basso', indebitamento: 'basso', copertura_interessi: 'alto' };
  var CRESCITA = { id: 'crescita', gruppo: 'Crescita', nome: 'Crescita dei ricavi sull\'anno precedente', unita: 'pct' };
  var ELENCO = [CRESCITA].concat(M.INDICI.filter(function (d) { return VERSO[d.id] !== undefined; }));
  var CHIAVE = ['ebitda_margin', 'roi', 'dso', 'giorni_magazzino', 'pfn_ebitda'];       // indici usati per la criticità
  /* Soglie ISA: provvedimento del Direttore dell'Agenzia delle Entrate n. 123160 del 22 aprile 2026 (periodo d'imposta 2025).
     Le soglie sono fissate ogni anno con un provvedimento: per altri anni vanno verificate. */
  var ISA = { pieno: 9, ridotto: 8, mediaPieno: 9, mediaRidotto: 8.5, controlli: 6, fonte: 'Provvedimento Agenzia delle Entrate n. 123160 del 22 aprile 2026', periodo: 2025 };
  var PARAM = { tolleranza: 0.10, scartoForte: 0.25, dimensione: 5 };

  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function z(x) { return num(x) || 0; }
  function vuoto() { return { termini: [], isa: [] }; }
  function dati(az) { var d = az.benchmark || vuoto(); d.termini = d.termini || []; d.isa = d.isa || []; return d; }
  function mediana(l) { var s = l.slice().sort(function (a, b) { return a - b; }), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; }

  // indici confrontabili da due esercizi di bilancio (n = numeri dell'anno, p = anno precedente o null)
  function indiciDa(n, p) {
    var ix = M.calcolaIndici(n, p || null, {}), o = {};
    ELENCO.forEach(function (d) { if (d.id === 'crescita') o.crescita = (p && num(p.ricavi) !== null && p.ricavi > 0 && num(n.ricavi) !== null) ? n.ricavi / p.ricavi - 1 : null; else o[d.id] = ix[d.id].v; });
    return o;
  }
  /* Bilanci abbreviati e micro: crediti e debiti sono un'unica voce. Per gli indici che usano solo i totali si
     ricostruisce un bilancio con il totale dei crediti tra i crediti correnti e i debiti divisi, se il file lo dice,
     tra entro e oltre 12 mesi. Non sono ricavabili gli indici che richiedono di distinguere clienti, fornitori e banche. */
  var NON_DA_TOTALI = ['dso', 'dpo', 'ccc', 'pfn_ebitda', 'debt_equity', 'roi'];
  function completaDaTotali(n, vincoli) {
    var q = Object.assign({}, n), note = true;
    (vincoli || []).forEach(function (w) {
      var presenti = (w.voci || []).reduce(function (t, k) { return t + z(n[k]); }, 0), resto = z(w.totale) - presenti;
      (w.voci || []).forEach(function (k) { if (q[k] === undefined) q[k] = 0; });
      if (w.gruppo === 'crediti') q.altri_crediti = z(q.altri_crediti) + resto;
      else if (w.gruppo === 'debiti') {
        if (num(w.entro) === null) { note = false; q.altri_debiti = z(q.altri_debiti) + resto; }
        else { var lungo = Math.max(0, Math.min(resto, z(w.oltre))); q.debiti_banche_lungo = z(q.debiti_banche_lungo) + lungo; q.altri_debiti = z(q.altri_debiti) + resto - lungo; }
      }
    });
    return { n: q, scadenzeNote: note };
  }
  // valori di un termine per l'anno richiesto: l'anno stesso oppure il più recente precedente (segnalato)
  function valoriTermine(t, anno) {
    var anni = Object.keys(t.anni || {}).map(Number).filter(function (y) { return y <= anno; }).sort(function (a, b) { return a - b; }); if (!anni.length) return null;
    var y = anni[anni.length - 1], x = t.anni[y], o = { anno: y, vecchio: y < anno };
    if (x.n) {
      var prec = t.anni[y - 1] && t.anni[y - 1].n ? t.anni[y - 1].n : null; o.ricavi = num(x.n.ricavi); o.daBilancio = true; o.incompleto = M.mancanti(x.n).length;
      var c = o.incompleto && x.vincoli ? completaDaTotali(x.n, x.vincoli) : null;
      if (c && !M.mancanti(c.n).length) {       // bilancio abbreviato o micro: indici ricavati dai totali, esclusi quelli che richiedono il dettaglio
        o.indici = indiciDa(c.n, prec); o.daTotali = true;
        NON_DA_TOTALI.concat(c.scadenzeNote ? [] : ['current_ratio', 'quick_ratio']).forEach(function (k) { o.indici[k] = null; });
      } else o.indici = indiciDa(x.n, prec);
    }
    else { o.indici = {}; ELENCO.forEach(function (d) { o.indici[d.id] = num((x.indici || {})[d.id]); }); o.ricavi = num(x.ricavi); }
    return o;
  }

  /* Confronto per un anno. propri = { n, p } numeri dell'azienda (anno e precedente), completo = bilancio dell'anno completo. */
  function analizza(az, anno, propri) {
    var d = dati(az), a = { anno: anno, termini: [], esclusi: [], righe: [], avvisi: [], forza: [], debolezza: [] };
    a.completo = !!(propri && propri.n && propri.completo); a.propri = a.completo ? indiciDa(propri.n, propri.p) : null; a.ricavi = propri && propri.n ? num(propri.n.ricavi) : null;
    d.termini.forEach(function (t) {
      var v = valoriTermine(t, anno), x = { t: t, v: v };
      if (!String(t.fonte || '').trim()) { x.motivo = 'manca la fonte'; a.esclusi.push(x); return; }
      if (!v) { x.motivo = 'nessun dato fino al ' + anno; a.esclusi.push(x); return; }
      x.dimensione = (a.ricavi > 0 && v.ricavi > 0) ? v.ricavi / a.ricavi : null; x.lontano = x.dimensione !== null && (x.dimensione > PARAM.dimensione || x.dimensione < 1 / PARAM.dimensione);
      x.disponibili = ELENCO.filter(function (i) { return v.indici[i.id] !== null; }).length;
      a.termini.push(x);
    });
    ELENCO.forEach(function (i) {
      var vals = a.termini.map(function (x) { return x.v.indici[i.id]; }), ok = vals.filter(function (v) { return v !== null; }), r = { i: i, verso: VERSO[i.id], valori: vals, n: ok.length, proprio: a.propri ? a.propri[i.id] : null };
      if (ok.length) { r.mediana = mediana(ok); r.min = Math.min.apply(null, ok); r.max = Math.max.apply(null, ok); }
      if (ok.length && r.proprio !== null) {
        r.scarto = r.proprio - r.mediana;
        var tol = Math.abs(r.mediana) * PARAM.tolleranza, migliore = r.verso === 'alto' ? r.scarto > tol : r.verso === 'basso' ? r.scarto < -tol : false, peggiore = r.verso === 'alto' ? r.scarto < -tol : r.verso === 'basso' ? r.scarto > tol : false;
        r.giudizio = !r.verso ? 'neutro' : migliore ? 'meglio' : peggiore ? 'peggio' : 'in linea';
        if (r.verso) { var davanti = ok.filter(function (v) { return r.verso === 'alto' ? v > r.proprio : v < r.proprio; }).length; r.posizione = davanti + 1; r.su = ok.length + 1; }
        r.forte = r.giudizio === 'peggio' && Math.abs(r.scarto) > Math.abs(r.mediana) * PARAM.scartoForte;
        // valore in euro dello scarto, solo dove il calcolo è diretto
        if (r.giudizio === 'peggio' && propri.n) {
          var n = propri.n;
          if (['ebitda_margin', 'ebit_margin', 'ros'].indexOf(i.id) >= 0 && num(n.ricavi) !== null) { r.euro = -r.scarto * n.ricavi; r.euroTesto = 'di margine in più l\'anno con la stessa incidenza della mediana'; }
          else if (i.id === 'dso' && r.proprio > 0 && num(n.crediti_clienti) !== null) { r.euro = n.crediti_clienti * (1 - r.mediana / r.proprio); r.euroTesto = 'di crediti in meno (liquidità liberata) con i tempi di incasso della mediana'; }
          else if (i.id === 'giorni_magazzino' && r.proprio > 0 && num(n.rimanenze) !== null) { r.euro = n.rimanenze * (1 - r.mediana / r.proprio); r.euroTesto = 'di scorte in meno (liquidità liberata) con i giorni di scorta della mediana'; }
        }
        if (r.giudizio === 'meglio') a.forza.push(r); else if (r.giudizio === 'peggio') a.debolezza.push(r);
      }
      a.righe.push(r);
    });
    a.debolezza.sort(function (x, y) { return z(y.euro) - z(x.euro) || Math.abs(y.scarto / (y.mediana || 1)) - Math.abs(x.scarto / (x.mediana || 1)); });
    if (d.termini.length && !a.termini.length) a.avvisi.push('Nessun termine di confronto utilizzabile per il ' + anno + '.');
    if (a.termini.length && a.termini.length < 3) a.avvisi.push('Solo ' + a.termini.length + (a.termini.length === 1 ? ' termine' : ' termini') + ' di confronto: la mediana è poco significativa, il confronto è indicativo.');
    if (a.esclusi.length) a.avvisi.push(a.esclusi.length + (a.esclusi.length === 1 ? ' termine escluso' : ' termini esclusi') + ' dal confronto: ' + a.esclusi.map(function (x) { return (x.t.nome || 'senza nome') + ' (' + x.motivo + ')'; }).join('; ') + '.');
    var vecchi = a.termini.filter(function (x) { return x.v.vecchio; }); if (vecchi.length) a.avvisi.push('Dati di un anno precedente per: ' + vecchi.map(function (x) { return x.t.nome + ' (' + x.v.anno + ')'; }).join(', ') + '.');
    var lontani = a.termini.filter(function (x) { return x.lontano; }); if (lontani.length) a.avvisi.push('Dimensione molto diversa dalla tua (ricavi oltre ' + PARAM.dimensione + ' volte più grandi o più piccoli): ' + lontani.map(function (x) { return x.t.nome; }).join(', ') + '. Il confronto va letto con prudenza.');
    if (a.termini.length && !a.completo) a.avvisi.push('Il bilancio ' + anno + ' dell\'azienda è incompleto: sono mostrati solo i valori dei termini di confronto.');
    return a;
  }

  /* Termine di confronto da un bilancio XBRL letto con Xbrl.righeImport: le voci non presenti nel file (per esempio
     i debiti non ripartiti dei bilanci abbreviati) restano mancanti e gli indici che le usano non vengono calcolati. */
  function termineDaImport(imp, nomeFile) {
    var an = imp.anagrafica || {}, t = { nome: String(an.denominazione || nomeFile || 'Concorrente').slice(0, 120), tipo: 'concorrente', fonte: 'Bilancio XBRL depositato' + (nomeFile ? ' · file ' + nomeFile : ''), origine: 'importato', anni: {} };
    if (an.codiceFiscale) t.codiceFiscale = an.codiceFiscale; if (an.ateco) t.ateco = an.ateco; if (imp.descrizione) t.descrizione = imp.descrizione;
    (imp.anni || []).forEach(function (y) { var n = {}; imp.righe.forEach(function (r) { if (r.voce && num(r.valori[y]) !== null) n[r.voce] = r.valori[y]; }); if (!Object.keys(n).length) return; t.anni[y] = { n: n }; if (imp.vincoli && imp.vincoli[y] && imp.vincoli[y].length) t.anni[y].vincoli = imp.vincoli[y].map(function (w) { return { gruppo: w.gruppo, totale: w.totale, entro: w.entro, oltre: w.oltre, voci: w.voci }; }); });
    return t;
  }

  // ------------------------------------------------------------ ISA
  function analizzaIsa(az) {
    var d = dati(az), l = d.isa.filter(function (x) { return num(x.punteggio) !== null && x.anno; }).slice().sort(function (a, b) { return a.anno - b.anno; }), o = { righe: [], ultimo: null };
    l.forEach(function (x, k) {
      var prec = l[k - 1] && l[k - 1].anno === x.anno - 1 ? l[k - 1] : null, r = { x: x, punteggio: x.punteggio, media: prec ? (x.punteggio + prec.punteggio) / 2 : null, variazione: prec ? x.punteggio - prec.punteggio : null };
      r.livello = (x.punteggio >= ISA.pieno || (r.media !== null && r.media >= ISA.mediaPieno)) ? 'pieno' : (x.punteggio >= ISA.ridotto || (r.media !== null && r.media >= ISA.mediaRidotto)) ? 'ridotto' : 'nessuno';
      r.perMedia = (r.livello === 'pieno' && x.punteggio < ISA.pieno) || (r.livello === 'ridotto' && x.punteggio < ISA.ridotto);
      r.controlli = x.punteggio <= ISA.controlli; r.mancaPieno = Math.max(0, ISA.pieno - x.punteggio); r.mancaRidotto = Math.max(0, ISA.ridotto - x.punteggio);
      r.deboli = (x.indicatori || []).filter(function (i) { return num(i.valore) !== null; }).slice().sort(function (a, b) { return a.valore - b.valore; });
      r.sogliePeriodo = x.anno === ISA.periodo; r.senzaFonte = !String(x.fonte || '').trim();
      o.righe.push(r);
    });
    o.ultimo = o.righe.length ? o.righe[o.righe.length - 1] : null;
    return o;
  }

  // ------------------------------------------------------------ criticità
  function criticita(a, isa, eur, fmtIndice) {
    var c = [];
    var gravi = a.debolezza.filter(function (r) { return r.forte && CHIAVE.indexOf(r.i.id) >= 0; });
    if (a.termini.length >= 2 && gravi.length) { var tot = gravi.reduce(function (t, r) { return t + z(r.euro); }, 0);
      c.push({ gravita: 'giallo', titolo: 'Risultati sotto i termini di confronto', dati: gravi.map(function (r) { return r.i.nome + ': ' + fmtIndice(r.proprio, r.i.unita) + ' contro una mediana di ' + fmtIndice(r.mediana, r.i.unita); }).join('; ') + ' (' + a.termini.length + ' termini di confronto, ' + a.anno + ').',
        causa: 'Da approfondire: prezzi, costi, tempi di incasso o livello delle scorte diversi da quelli dei concorrenti scelti.', intervento: 'Capire come lavorano i termini migliori su questi punti; verificare che siano davvero confrontabili per attività e dimensione.', effetto: tot > 0 ? 'Allinearsi alla mediana varrebbe circa ' + eur(tot) + ' tra margine e liquidità.' : 'Scarto non quantificabile in euro con i soli dati di bilancio.' }); }
    if (isa && isa.ultimo && isa.ultimo.controlli) c.push({ gravita: 'giallo', titolo: 'Punteggio ISA basso', dati: 'Punteggio ISA ' + String(isa.ultimo.punteggio).replace('.', ',') + ' per il ' + isa.ultimo.x.anno + ': fino a ' + ISA.controlli + ' il punteggio è usato dall\'Agenzia delle Entrate per orientare i controlli (' + ISA.fonte + ').',
      causa: 'Indicatori elementari o anomalie segnalati dal software ISA.', intervento: 'Esaminare con il commercialista gli indicatori più bassi e le anomalie; verificare la correttezza dei dati dichiarati.', effetto: 'Maggiore probabilità di controlli; nessun beneficio premiale.' });
    return c;
  }

  // ------------------------------------------------------------ simulazione
  /* Tre concorrenti di fantasia dello stesso settore (generati con il simulatore, quindi con bilanci completi e coerenti),
     un riferimento di settore di fantasia e due punteggi ISA di fantasia. */
  function simula(az, seme) {
    var anni = Object.keys(az.esercizi).map(Number).sort(function (a, b) { return a - b; }); if (!anni.length || !Sim) return vuoto();
    var Y = anni[anni.length - 1], n = M.numeri(az.esercizi[Y]), ric = z(n.ricavi) || 1000000, s = Number(seme) || 1, out = { simulato: true, termini: [], isa: [] };
    [['Concorrente Uno (di fantasia)', 'sana', 0.7], ['Concorrente Due (di fantasia)', 'margini_in_calo', 1.5], ['Concorrente Tre (di fantasia)', 'sana', 1.1]].forEach(function (c, k) {
      var q = Sim.genera({ settore: az.settore, profilo: c[1], ricavi: Math.round(ric * c[2]), anni: 2, annoFinale: Y, seme: s * 7 + 311 + k * 97 }), t = { id: 'sb-' + (k + 1), nome: c[0], tipo: 'concorrente', fonte: 'Dato simulato: bilancio di fantasia', origine: 'simulato', anni: {} };
      Object.keys(q.esercizi).forEach(function (y) { t.anni[y] = { n: M.numeri(q.esercizi[y]) }; }); out.termini.push(t);
    });
    var rif = { id: 'sb-rif', nome: 'Studio di settore di fantasia', tipo: 'riferimento', fonte: 'Dato simulato: nessuna statistica reale', origine: 'simulato', anni: {} };
    rif.anni[Y] = { indici: { ebitda_margin: 0.11, roi: 0.09, dso: 78, giorni_magazzino: 62, pfn_ebitda: 2.4, current_ratio: 1.35 } }; out.termini.push(rif);
    var buono = az.simulazione && az.simulazione.profilo === 'sana', p1 = buono ? 8.2 : 6.9, p2 = buono ? 8.9 : 5.8;
    if (anni.length > 1) out.isa.push({ anno: Y - 1, punteggio: p1, codice: 'ISA di fantasia', fonte: 'Dato simulato', origine: 'simulato', indicatori: [{ nome: 'Ricavi per addetto', valore: buono ? 8 : 6 }, { nome: 'Valore aggiunto per addetto', valore: buono ? 9 : 7 }, { nome: 'Reddito per addetto', valore: buono ? 7.5 : 7.5 }] });
    out.isa.push({ anno: Y, punteggio: p2, codice: 'ISA di fantasia', fonte: 'Dato simulato', origine: 'simulato', indicatori: [{ nome: 'Ricavi per addetto', valore: buono ? 9 : 5 }, { nome: 'Valore aggiunto per addetto', valore: buono ? 9.5 : 6 }, { nome: 'Reddito per addetto', valore: buono ? 8 : 6.5 }], anomalie: buono ? '' : 'Durata delle scorte (di fantasia)' });
    return out;
  }

  // ------------------------------------------------------------ collaudo
  function collaudo(az) {
    var esiti = [], d = dati(az);
    function t(nome, ok, dettaglio) { esiti.push({ nome: nome, ok: !!ok, dettaglio: dettaglio || '' }); }
    if (!d.termini.length && !d.isa.length) return esiti;
    var anni = Object.keys(az.esercizi || {}).map(Number).sort(function (a, b) { return a - b; }), Y = anni[anni.length - 1];
    if (Y && d.termini.length) {
      var n = M.numeri(az.esercizi[Y]), p = az.esercizi[Y - 1] ? M.numeri(az.esercizi[Y - 1]) : null, a = analizza(az, Y, { n: n, p: p, completo: M.mancanti(n).length === 0 }), cfr = a.righe.filter(function (r) { return r.n && r.proprio !== null; });
      var ix = M.calcolaIndici(n, p, {});
      t('confronti: i valori dell\'azienda sono quelli della scheda Indici', !a.propri || a.righe.every(function (r) { return r.i.id === 'crescita' || r.proprio === ix[r.i.id].v; }), cfr.length + ' indici confrontati');
      t('confronti: la mediana sta tra il minimo e il massimo dei termini', a.righe.every(function (r) { return !r.n || (r.mediana >= r.min - 1e-12 && r.mediana <= r.max + 1e-12); }), a.termini.length + ' termini');
      t('confronti: la posizione è tra 1 e il numero dei termini più uno', cfr.every(function (r) { return !r.verso || (r.posizione >= 1 && r.posizione <= r.n + 1); }), '');
      t('confronti: chi è meglio di tutti i termini è primo e mai «peggio»; chi è peggio di tutti è ultimo e mai «meglio»', cfr.every(function (r) { if (!r.verso) return r.giudizio === 'neutro'; var best = r.verso === 'alto' ? r.proprio >= r.max : r.proprio <= r.min, worst = r.verso === 'alto' ? r.proprio <= r.min : r.proprio >= r.max; return (!best || (r.posizione === 1 && r.giudizio !== 'peggio')) && (!worst || r.giudizio !== 'meglio'); }), '');
      t('confronti: il valore in euro dello scarto è calcolato solo per gli indici peggiori ed è positivo', a.righe.every(function (r) { return r.euro === undefined || (r.giudizio === 'peggio' && r.euro > 0); }), '');
      t('confronti: i termini senza fonte non entrano nel confronto', a.termini.every(function (x) { return String(x.t.fonte || '').trim(); }), a.esclusi.length + ' esclusi');
      if (d.simulato) t('confronti simulati: tre concorrenti con gli indici calcolati dal bilancio e un riferimento parziale', a.termini.length === 4 && a.termini.slice(0, 3).every(function (x) { return x.disponibili >= ELENCO.length - 3 && x.v.daBilancio && !x.v.incompleto; }) && a.termini[3].disponibili === 6 && a.righe.filter(function (r) { return r.i.id === 'ebitda_margin'; })[0].n === 4, a.termini.map(function (x) { return x.disponibili; }).join(', '));
    }
    var isa = analizzaIsa(az);
    t('ISA: livello coerente con le soglie del provvedimento', isa.righe.every(function (r) { return (r.livello === 'pieno') === (r.punteggio >= ISA.pieno || (r.media !== null && r.media >= ISA.mediaPieno)) && (r.livello !== 'nessuno' || r.punteggio < ISA.ridotto) && r.controlli === (r.punteggio <= ISA.controlli); }), isa.righe.length + ' anni');
    if (d.simulato && isa.righe.length === 2) { var buono = az.simulazione && az.simulazione.profilo === 'sana', u = isa.ultimo;
      t('ISA simulato: azienda in equilibrio → benefici ridotti per la media del biennio; altrimenti punteggio da controlli', buono ? (u.livello === 'ridotto' && !u.perMedia && Math.abs(u.media - 8.55) < 1e-9 && !u.controlli) : (u.livello === 'nessuno' && u.controlli), u.livello + ', media ' + u.media); }
    return esiti;
  }

  return { VERSO: VERSO, ELENCO: ELENCO, ISA: ISA, PARAM: PARAM, vuoto: vuoto, dati: dati, mediana: mediana, indiciDa: indiciDa, valoriTermine: valoriTermine, termineDaImport: termineDaImport, completaDaTotali: completaDaTotali, analizza: analizza, analizzaIsa: analizzaIsa, criticita: criticita, simula: simula, collaudo: collaudo };
});
