/* Timone · interfaccia del modulo Confronti (benchmarking) e ISA (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, B = window.Benchmark, X = window.Xbrl;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };

  function d() { if (!st.az.benchmark) st.az.benchmark = B.vuoto(); return B.dati(st.az); }
  function nfx(x, dec) { if (x === undefined || x === null) return ''; var m = Math.pow(10, dec === undefined ? 2 : dec); return String(Math.round(x * m) / m).replace('.', ','); }
  function val(x, u) { return (x === null || x === undefined) ? '—' : fmt(x, u); }
  function campo(et, id, v, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(v === undefined || v === null ? '' : v) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function testo(id, max) { var e = document.getElementById(id); return e ? String(e.value).trim().slice(0, max || 120) : ''; }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td style="white-space:normal">' + v + '</td></tr>'; }
  function metti(o, k, v) { if (v === null || v === '') delete o[k]; else o[k] = v; }
  function propri(anno) { var n = T.nDi(anno); return n ? { n: n, p: T.nDi(anno - 1), completo: T.completo(anno) } : null; }
  function quadro() { return B.analizza(st.az, st.anno, propri(st.anno)); }
  function punti(x) { return String(Math.round(x * 100) / 100).replace('.', ','); }
  var TAG = { meglio: ['ok', 'meglio'], peggio: ['rosso', 'peggio'], 'in linea': ['', 'in linea'], neutro: ['', 'diverso'] };

  var SUB = [['confronto', 'Confronto'], ['termini', 'Con chi mi confronto'], ['isa', 'ISA']];
  function vista() {
    var sub = st.bmSub || 'confronto', h = '<div class="riga"><h2 style="margin:0">Confronti</h2><span class="sp"></span>' + T.selAnno() + '</div>';
    if (d().simulato) h += '<div class="avviso">Concorrenti, studio di settore e punteggi ISA simulati: sono di fantasia e servono a provare il modulo.</div>';
    h += '<div class="sub">' + SUB.map(function (x) { return '<button data-a="bmSub" data-sub="' + x[0] + '" class="' + (sub === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
    return h + (sub === 'termini' ? vistaTermini() : sub === 'isa' ? vistaIsa() : vistaConfronto());
  }

  function vistaConfronto() {
    var a = quadro(), h = '';
    if (!d().termini.length) return '<div class="carta"><p>Nessun termine di confronto.</p><p class="muto">Timone non contiene medie di settore e non ne inventa. Il confronto si fa con dati verificabili che scegli tu: i <b>bilanci depositati dei concorrenti</b> (file XBRL del Registro delle Imprese) oppure <b>studi e statistiche</b> di cui indichi la fonte.</p><button class="b p" data-a="bmSub" data-sub="termini">Aggiungi un termine di confronto</button></div>';
    h += a.avvisi.map(function (m) { return '<div class="avviso">' + esc(m) + '</div>'; }).join('');
    if (!a.termini.length) return h;
    if (a.propri) {
      h += '<div class="carta"><h3 style="margin-top:0">In sintesi · ' + a.anno + '</h3><p class="muto">Confronto con ' + a.termini.length + (a.termini.length === 1 ? ' termine' : ' termini') + ': ' + a.termini.map(function (x) { return esc(x.t.nome); }).join(', ') + '.</p>';
      h += '<h3>Dove sei più debole</h3>' + (a.debolezza.length ? a.debolezza.map(function (r) { return '<p><b>' + esc(r.i.nome) + '</b>: ' + val(r.proprio, r.i.unita) + ' contro una mediana di ' + val(r.mediana, r.i.unita) + (r.euro ? '<br><span class="muto">Vale circa <b>' + eur(r.euro) + '</b> ' + r.euroTesto + '.</span>' : '') + '</p>'; }).join('') : '<p class="muto">Nessun indice peggiore della mediana oltre la tolleranza.</p>');
      h += '<h3>Dove sei più forte</h3>' + (a.forza.length ? '<p>' + a.forza.map(function (r) { return esc(r.i.nome) + ' (' + val(r.proprio, r.i.unita) + ' contro ' + val(r.mediana, r.i.unita) + ')'; }).join('; ') + '.</p>' : '<p class="muto">Nessun indice migliore della mediana oltre la tolleranza.</p>');
      h += '<p class="muto">«Meglio» e «peggio»: oltre il ' + Math.round(B.PARAM.tolleranza * 100) + '% di distanza dalla mediana dei termini di confronto. Il valore in euro è un ordine di grandezza a parità di ricavi, non un obiettivo garantito.</p></div>';
    }
    var g0 = ''; h += '<div class="carta">';
    a.righe.forEach(function (r) {
      if (r.i.gruppo !== g0) { g0 = r.i.gruppo; h += '<h3' + (h.slice(-19) === '<div class="carta">' ? ' style="margin-top:0"' : '') + '>' + esc(g0) + '</h3>'; }
      var tg = r.giudizio ? TAG[r.giudizio] : null;
      h += '<details><summary><span class="nome">' + esc(r.i.nome) + (tg ? ' <span class="tag ' + tg[0] + '">' + tg[1] + '</span>' : '') + '</span><span><span class="val">' + val(r.proprio, r.i.unita) + '</span><br><span class="pre">mediana ' + (r.n ? val(r.mediana, r.i.unita) : '—') + '</span></span></summary><div class="spiega">' +
        (r.n ? '<table>' + a.termini.map(function (x, k) { return riga(esc(x.t.nome) + (x.v.vecchio ? ' <span class="muto">(' + x.v.anno + ')</span>' : ''), val(r.valori[k], r.i.unita)); }).join('') + riga('Mediana · minimo · massimo', val(r.mediana, r.i.unita) + ' · ' + val(r.min, r.i.unita) + ' · ' + val(r.max, r.i.unita), 1) +
          (r.posizione ? riga('La tua posizione', r.posizione + 'ª su ' + r.su) : '') + '</table>' + (r.verso === null ? '<p class="muto">Per questo indice non c\'è un verso migliore in assoluto: dipende da come è organizzata l\'impresa.</p>' : '') : '<p class="muto">Nessun termine di confronto ha questo dato.</p>') +
        (r.proprio === null && a.propri ? '<p class="muto">Il tuo valore non è calcolabile con i dati di bilancio disponibili.</p>' : '') + '</div></details>';
    });
    return h + '</div><p class="muto">Gli indici sono calcolati con le stesse formule della scheda Indici, sul bilancio di ciascuno. Bilanci abbreviati e micro non separano clienti, fornitori e banche: per quei concorrenti restano vuoti giorni di incasso e di pagamento, ciclo monetario, PFN/EBITDA, Debt/Equity e ROI; gli altri indici sono ricavati dai totali.</p>';
  }

  function vistaTermini() {
    var a = quadro(), h = '<div class="avviso info">Usa solo dati che puoi verificare. I bilanci dei concorrenti si scaricano dal Registro delle Imprese in formato XBRL; per studi e statistiche indica sempre la <b>fonte</b>: senza fonte un riferimento non entra nel confronto.</div>' +
      (T.scrivibile() ? '<div class="riga"><label class="b p" style="cursor:pointer">Carica il bilancio XBRL di un concorrente<input type="file" accept=".xbrl,.xml,.p7m" data-c="bmFile" hidden></label><button class="b p s" data-a="bmNuovo">Riferimento inserito a mano</button></div>' : '');
    if (!d().termini.length) return h + '<div class="carta"><p>Nessun termine di confronto.</p></div>';
    d().termini.forEach(function (t) {
      var x = a.termini.concat(a.esclusi).filter(function (y) { return y.t === t; })[0] || {}, anni = Object.keys(t.anni || {}).sort();
      h += '<div class="carta"><div class="riga"><h3 style="margin:0">' + esc(t.nome || 'Senza nome') + '</h3><span class="sp"></span><span class="tag">' + (t.tipo === 'concorrente' ? 'concorrente' : 'riferimento') + '</span>' + (t.origine === 'simulato' ? '<span class="tag simulato">simulato</span>' : '') + '</div><table>' +
        riga('Fonte', t.fonte ? esc(t.fonte) : '<span class="giu">mancante: escluso dal confronto</span>') + riga('Anni disponibili', anni.join(', ') || '—') + (t.descrizione ? riga('Tipo di bilancio', esc(t.descrizione)) : '') + (t.ateco ? riga('ATECO', esc(t.ateco)) : '') +
        (x.v ? riga('Ricavi ' + x.v.anno, x.v.ricavi === null ? '—' : eur(x.v.ricavi) + (x.dimensione ? ' · ' + nfx(x.dimensione, 1) + ' volte i tuoi' : '')) + riga('Indici disponibili', x.disponibili + ' su ' + B.ELENCO.length + (x.v.daTotali ? ' · bilancio abbreviato: indici ricavati dai totali, senza quelli che richiedono il dettaglio di clienti, fornitori e banche' : x.v.incompleto ? ' · ' + x.v.incompleto + ' voci di bilancio mancanti nel file' : '')) : '') + '</table>' +
        (x.motivo ? '<div class="avviso">Non usato nel confronto ' + st.anno + ': ' + esc(x.motivo) + '.</div>' : '') + (T.scrivibile() ? '<div class="riga" style="margin-top:8px"><button class="b p s" data-a="bmModifica" data-id="' + esc(t.id) + '">Modifica</button></div>' : '') + '</div>';
    });
    return h;
  }

  var LIV = { pieno: ['ok', 'benefici premiali pieni'], ridotto: ['ok', 'benefici premiali ridotti'], nessuno: ['', 'nessun beneficio premiale'] };
  function vistaIsa() {
    var I = B.ISA, q = B.analizzaIsa(st.az), h = '<div class="avviso info">Il punteggio ISA <b>non è calcolato da Timone</b>: lo calcola il software dell\'Agenzia delle Entrate con i dati della dichiarazione. Registra qui il punteggio e gli indicatori che trovi nella dichiarazione o che ti dà il commercialista.</div>' +
      (T.scrivibile() ? '<div class="riga"><button class="b p" data-a="bmIsaNuovo">Aggiungi un punteggio</button></div>' : '');
    if (!q.righe.length) return h + '<div class="carta"><p>Nessun punteggio ISA registrato.</p></div>';
    q.righe.slice().reverse().forEach(function (r) { var x = r.x, lv = LIV[r.livello];
      h += '<div class="carta"><div class="riga"><h3 style="margin:0">Periodo d\'imposta ' + x.anno + '</h3><span class="sp"></span>' + (x.origine === 'simulato' ? '<span class="tag simulato">simulato</span>' : '') + '</div><table>' + riga('Punteggio ISA', '<b>' + punti(r.punteggio) + '</b> su 10' + (r.variazione !== null ? ' · ' + (r.variazione >= 0 ? '+' : '') + punti(r.variazione) + ' sull\'anno prima' : ''), 1) +
        (r.media !== null ? riga('Media con il ' + (x.anno - 1), punti(r.media)) : '') + riga('Livello', '<span class="tag ' + lv[0] + '">' + lv[1] + '</span>' + (r.perMedia ? ' <span class="muto">grazie alla media dei due anni</span>' : '')) +
        (r.livello !== 'pieno' ? riga('Per il livello pieno (' + I.pieno + ')', 'mancano ' + punti(r.mancaPieno) + ' punti') : '') + (r.livello === 'nessuno' ? riga('Per il livello ridotto (' + I.ridotto + ')', 'mancano ' + punti(r.mancaRidotto) + ' punti') : '') + (x.codice ? riga('Codice ISA', esc(x.codice)) : '') + riga('Fonte', x.fonte ? esc(x.fonte) : '<span class="giu">non indicata</span>') + '</table>' +
        (r.controlli ? '<div class="avviso rosso">Con un punteggio fino a ' + I.controlli + ' la posizione può essere selezionata per i controlli basati sul rischio di evasione.</div>' : '') +
        (!r.sogliePeriodo ? '<div class="avviso">Le soglie usate sono quelle fissate per il periodo d\'imposta ' + I.periodo + ': per il ' + x.anno + ' verifica il provvedimento di quell\'anno.</div>' : '');
      if (r.deboli.length) h += '<h3>Indicatori elementari, dal più basso</h3><table>' + r.deboli.map(function (i) { return riga(esc(i.nome), '<span class="' + (i.valore < 6 ? 'giu' : '') + '">' + punti(i.valore) + '</span>'); }).join('') + '</table>';
      if (x.anomalie) h += '<p><b>Anomalie segnalate:</b> ' + esc(x.anomalie) + '</p>';
      h += (T.scrivibile() ? '<div class="riga" style="margin-top:8px"><button class="b p s" data-a="bmIsaModifica" data-y="' + x.anno + '">Modifica</button></div>' : '') + '</div>'; });
    return h + '<p class="muto">Soglie: almeno ' + I.pieno + ' (o media dei due anni almeno ' + I.mediaPieno + ') per i benefici pieni; almeno ' + I.ridotto + ' (o media almeno ' + String(I.mediaRidotto).replace('.', ',') + ') per quelli ridotti; fino a ' + I.controlli + ' per l\'analisi del rischio. Fonte: ' + esc(I.fonte) + ', periodo d\'imposta ' + I.periodo + '. Quali benefici spettano e con quali limiti lo stabilisce il provvedimento: chiedi conferma al commercialista. Se l\'impresa ha più attività soggette a ISA le soglie vanno rispettate per tutte.</p>';
  }

  // ------------------------------------------------------------ moduli di inserimento
  function apri(h) { $('#dlgCorpo').innerHTML = h; if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0; }
  function bottoni(elimina, salva, id) { return '<div class="riga" style="margin-top:14px">' + (elimina && id ? '<button class="b p peri" data-a="' + elimina + '" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="' + salva + '" data-id="' + esc(id || '') + '">Salva</button></div>'; }
  function unita(i) { return i.unita === 'pct' ? '%' : i.unita === 'giorni' ? 'giorni' : 'volte'; }
  function moduloTermine(id) {
    var t = id ? d().termini.filter(function (x) { return x.id === id; })[0] : { tipo: 'riferimento', anni: {} }, bil = t.tipo === 'concorrente' && Object.keys(t.anni || {}).some(function (y) { return t.anni[y].n; });
    var anni = Object.keys(t.anni || {}).map(Number).sort(function (a, b) { return a - b; }), y = anni.length ? anni[anni.length - 1] : st.anno, x = (t.anni || {})[y] || {}, ind = x.indici || {};
    var h = '<h3 style="margin-top:0">' + (id ? 'Modifica' : 'Nuovo riferimento') + '</h3><div class="riga">' + campo('Nome (studio, statistica, concorrente)', 'bmNome', t.nome, '') + campo('Fonte (titolo, ente, anno, indirizzo web)', 'bmFonte', t.fonte, '') + '</div>';
    if (bil) h += '<p class="muto">Gli indici di questo concorrente sono calcolati dal bilancio caricato (anni ' + anni.join(', ') + '): per aggiornarli carica un nuovo file.</p>';
    else h += '<div class="riga" style="margin-top:8px">' + campo('Anno dei dati', 'bmAnno', y, 'inputmode="numeric"') + campo('Ricavi (€) · facoltativo, per valutare la dimensione', 'bmRicavi', x.ricavi === undefined ? '' : nf0.format(x.ricavi)) + '</div><h3>Valori di riferimento</h3><p class="muto">Compila solo quelli che la fonte riporta davvero; gli altri restano vuoti.</p><div class="riga">' +
      B.ELENCO.map(function (i) { var v = ind[i.id]; return campo(esc(i.nome) + ' (' + unita(i) + ')', 'bm_' + i.id, v === undefined || v === null ? '' : nfx(i.unita === 'pct' ? v * 100 : v, 2)); }).join('') + '</div>';
    apri(h + '<input type="hidden" id="bmBil" value="' + (bil ? '1' : '') + '">' + bottoni('bmElimina', 'bmSalva', id));
  }
  function moduloIsa(anno) {
    var x = anno ? d().isa.filter(function (r) { return String(r.anno) === String(anno); })[0] : { anno: st.anno };
    apri('<h3 style="margin-top:0">Punteggio ISA</h3><div class="riga">' + campo('Periodo d\'imposta (anno)', 'isAnno', x.anno, 'inputmode="numeric"') + campo('Punteggio (da 1 a 10)', 'isPunti', x.punteggio === undefined ? '' : punti(x.punteggio)) + campo('Codice ISA', 'isCodice', x.codice, '') + campo('Fonte (dichiarazione, software, commercialista)', 'isFonte', x.fonte, '') + '</div>' +
      '<div class="campo" style="margin-top:8px"><label for="isInd">Indicatori elementari: uno per riga, nome e punteggio separati da punto e virgola</label><textarea id="isInd" rows="5" style="font:inherit;background:var(--carta);color:var(--ink);border:1px solid var(--linea);border-radius:9px;padding:8px 10px;width:100%" placeholder="Ricavi per addetto; 7,5">' + esc((x.indicatori || []).map(function (i) { return i.nome + '; ' + (i.valore === undefined || i.valore === null ? '' : punti(i.valore)); }).join('\n')) + '</textarea></div>' +
      '<div class="campo" style="margin-top:8px"><label for="isAnom">Anomalie segnalate</label><input type="text" id="isAnom" value="' + esc(x.anomalie || '') + '"></div>' + bottoni('bmIsaElimina', 'bmIsaSalva', anno ? String(anno) : ''));
  }
  function pulisciSimulato() { var D = d(); if (D.simulato && !D.termini.concat(D.isa).some(function (y) { return y.origine === 'simulato'; })) delete D.simulato; }

  var azioni = {
    bmSub: function (x) { st.bmSub = x.sub; T.disegna(); window.scrollTo(0, 0); },
    bmNuovo: function () { moduloTermine(null); },
    bmModifica: function (x) { moduloTermine(x.id); },
    bmSalva: function (x) {
      var D = d(), nome = testo('bmNome', 120); if (!nome) { T.toast('Serve un nome'); return; }
      var t = x.id ? D.termini.filter(function (y) { return y.id === x.id; })[0] : { id: 'b' + Date.now().toString(36), tipo: 'riferimento', anni: {} };
      t.nome = nome; metti(t, 'fonte', testo('bmFonte', 300));
      if (!$('#bmBil').value) {
        var y = Math.round(leggi('bmAnno') || 0); if (!(y > 1990 && y < 2200)) { T.toast('Anno dei dati non valido'); return; }
        var ind = {}; B.ELENCO.forEach(function (i) { var v = leggi('bm_' + i.id); if (v !== null) ind[i.id] = i.unita === 'pct' ? v / 100 : v; });
        t.anni = t.anni || {}; t.anni[y] = { indici: ind }; var ric = leggi('bmRicavi'); if (ric !== null) t.anni[y].ricavi = ric;
      }
      if (t.origine === 'simulato' || !t.origine) t.origine = 'manuale'; if (!x.id) D.termini.push(t); pulisciSimulato();
      T.salva(); T.chiudiDlg(); T.disegna(); T.toast(t.fonte ? 'Salvato' : 'Salvato, ma senza fonte non entra nel confronto');
    },
    bmElimina: function (x) { T.conferma('Eliminare questo termine di confronto?', 'Elimina').then(function (si) { if (!si) return; st.az.benchmark.termini = d().termini.filter(function (y) { return y.id !== x.id; }); pulisciSimulato(); T.salva(); T.disegna(); }); },
    bmIsaNuovo: function () { moduloIsa(null); },
    bmIsaModifica: function (x) { moduloIsa(x.y); },
    bmIsaSalva: function (x) {
      var D = d(), y = Math.round(leggi('isAnno') || 0), pt = leggi('isPunti'); if (!(y > 2015 && y < 2200)) { T.toast('Anno non valido'); return; } if (pt === null || pt < 1 || pt > 10) { T.toast('Il punteggio va da 1 a 10'); return; }
      D.isa = D.isa.filter(function (r) { return String(r.anno) !== String(y) && String(r.anno) !== x.id; });
      var r = { anno: y, punteggio: pt, origine: 'manuale' }; metti(r, 'codice', testo('isCodice', 40)); metti(r, 'fonte', testo('isFonte', 200)); metti(r, 'anomalie', testo('isAnom', 300));
      r.indicatori = $('#isInd').value.split('\n').map(function (l) { var p = l.split(';'), nome = (p[0] || '').trim().slice(0, 100), v = p.length > 1 ? T.numero(p.slice(1).join(';')) : null; return nome ? (v === null ? { nome: nome } : { nome: nome, valore: Math.max(1, Math.min(10, v)) }) : null; }).filter(Boolean).slice(0, 40);
      D.isa.push(r); st.az.benchmark.isa = D.isa; pulisciSimulato(); T.salva(); T.chiudiDlg(); T.disegna(); T.toast('Punteggio ISA salvato');
    },
    bmIsaElimina: function (x) { T.conferma('Eliminare il punteggio ISA ' + x.id + '?', 'Elimina').then(function (si) { if (!si) return; st.az.benchmark.isa = d().isa.filter(function (r) { return String(r.anno) !== x.id; }); pulisciSimulato(); T.salva(); T.chiudiDlg(); T.disegna(); }); }
  };
  var cambi = {
    bmFile: function (e) {
      var f = e.files[0]; if (!f) return; e.value = '';
      f.arrayBuffer().then(function (buf) { return X.righeImport(X.leggi(new Uint8Array(buf)), f.name); }).then(function (imp) {
        var t = B.termineDaImport(imp, f.name), D = d(); if (!Object.keys(t.anni).length) throw new Error('nessun valore di bilancio nel file');
        if (st.az.codiceFiscale && t.codiceFiscale && st.az.codiceFiscale === t.codiceFiscale) { T.toast('Questo è il bilancio della tua azienda: va caricato nella scheda Bilancio'); return; }
        var es = D.termini.filter(function (y) { return (t.codiceFiscale && y.codiceFiscale === t.codiceFiscale) || (y.tipo === 'concorrente' && y.nome === t.nome); })[0];
        if (es) { Object.keys(t.anni).forEach(function (y) { es.anni[y] = t.anni[y]; }); es.fonte = t.fonte; es.origine = 'importato'; if (t.descrizione) es.descrizione = t.descrizione; }
        else { t.id = 'b' + Date.now().toString(36); D.termini.push(t); }
        pulisciSimulato(); T.salva(); T.disegna(); T.toast((es ? 'Aggiornato ' : 'Aggiunto ') + t.nome + ' · anni ' + Object.keys(t.anni).join(', '));
      }).catch(function (x) { T.toast('XBRL non letto: ' + x.message); });
    }
  };

  T.registra({
    id: 'benchmark', titolo: 'Confronti',
    descrizione: 'Confronto degli indici con i bilanci depositati dei concorrenti (XBRL) e con riferimenti di settore di cui si indica la fonte; registro dei punteggi ISA con le soglie del regime premiale.',
    vista: vista, azioni: azioni, cambi: cambi,
    criticita: function (az, anno) { if (!az.benchmark) return []; var q = B.analizzaIsa(az); return B.criticita(B.analizza(az, anno, propri(anno)), q.ultimo && q.ultimo.x.anno === anno ? q : null, eur, val); },
    collaudo: function (az) { return az.benchmark ? B.collaudo(az) : []; },
    simula: function (az, seme) { var m = B.simula(az, seme); if (m.termini.length) az.benchmark = m; }
  });
})();
