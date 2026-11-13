/* Timone · interfaccia del modulo Magazzino e scorte (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, G = window.Magazzino;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };
  var SUB = [['sintesi', 'Sintesi'], ['articoli', 'Articoli'], ['riordini', 'Riordini'], ['dati', 'Importa e parametri']];
  var COLORE = { obsoleto: 'rosso', fermo: 'giallo', eccesso: 'giallo', sotto_scorta: 'giallo', ok: 'ok', incompleto: '' };

  function d() { if (!st.az.magazzino) st.az.magazzino = G.vuoto(); return G.dati(st.az); }
  function analisi() { return G.analisi(st.az, st.anno, T.nDi(st.anno)); }
  function nfx(x, dec) { if (dec === 0 && x !== undefined && x !== null) return nf0.format(Math.round(x)); return (x === undefined || x === null) ? '' : String(Math.round(x * Math.pow(10, dec === undefined ? 3 : dec)) / Math.pow(10, dec === undefined ? 3 : dec)).replace('.', ','); }
  function campo(et, id, val, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function dataIt(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—'; }
  function apri(html) { $('#dlgCorpo').innerHTML = html; if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0; }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td>' + v + '</td></tr>'; }

  function vista() {
    var sub = st.subMagazzino || 'sintesi';
    var h = '<div class="riga"><h2 style="margin:0">Magazzino</h2><span class="sp"></span>' + T.selAnno() + '</div>';
    h += '<div class="sub">' + SUB.map(function (s) { return '<button data-a="mgSub" data-sub="' + s[0] + '" class="' + (sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (d().simulato) h += '<div class="avviso">Inventario simulato: serve a provare il modulo, non descrive scorte reali.</div>';
    return h + ({ sintesi: vSintesi, articoli: vArticoli, riordini: vRiordini, dati: vDati }[sub] || vSintesi)();
  }
  function senzaInventario() {
    return '<div class="carta"><p>Nessun inventario per il ' + st.anno + '.</p><p class="muto">Serve l\'elenco degli articoli alla data di chiusura, con giacenza, costo, consumo degli ultimi 12 mesi e data dell\'ultimo movimento: di solito si esporta dal gestionale in Excel o CSV.</p>' +
      '<div class="riga"><button class="b" data-a="mgSub" data-sub="dati">Importa l\'inventario</button>' + (T.scrivibile() ? '<button class="b s" data-a="mgNuovo">Aggiungi un articolo a mano</button>' : '') + '</div></div>';
  }

  function vSintesi() {
    var a = analisi(); if (!a.presente || !a.righe.length) return senzaInventario();
    var par = a.parametri, c = a.classi, h = '<p class="muto">Inventario al ' + dataIt(a.data) + ' · ' + a.righe.length + ' articoli</p>';
    if (a.bilancio === null) h += '<div class="avviso">Nel bilancio ' + st.anno + ' manca la voce rimanenze: non posso confrontare l\'inventario con la contabilità.</div>';
    else h += '<div class="avviso ' + (a.riconciliato ? 'ok' : 'rosso') + '">' + (a.riconciliato ? 'L\'inventario coincide con le rimanenze di bilancio (' + eur(a.bilancio) + ').' : 'Inventario ' + eur(a.valore) + ', rimanenze di bilancio ' + eur(a.bilancio) + ': differenza ' + eur(a.differenza) + ' da spiegare.') + '</div>';
    var tile = function (n, v, sotto, classe) { return '<button data-a="mgFiltro" data-classe="' + (classe || '') + '"><div class="n">' + n + '</div><div class="v">' + v + '</div><div class="d muto">' + (sotto || '') + '</div></button>'; };
    h += '<div class="kpi">' + tile('Valore del magazzino', eur(a.valore), a.coperturaMedia ? nf0.format(a.coperturaMedia) + ' giorni di copertura media' : '') +
      tile('Obsoleto', eur(c.obsoleto.valore), c.obsoleto.n + ' articoli · ' + fmt(a.valore ? c.obsoleto.valore / a.valore : null, 'pct'), 'obsoleto') + tile('Fermo', eur(c.fermo.valore), c.fermo.n + ' articoli', 'fermo') +
      tile('Eccedenze', eur(a.valoreEccedenze), c.eccesso.n + ' articoli oltre ' + par.coperturaMax + ' gg', 'eccesso') + tile('Sotto scorta', String(c.sotto_scorta.n), 'articoli da riordinare', 'sotto_scorta') +
      tile('Costo finanziario annuo', eur(a.costoFinanziario), 'al ' + fmt(par.tasso, 'pct') + ' · di cui evitabile ' + eur(a.costoFinanziarioInutile)) + '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Capitale che si può liberare</h3><table>' + riga('Articoli fermi', eur(c.fermo.valore)) + riga('Eccedenze oltre ' + par.coperturaMax + ' giorni', eur(a.valoreEccedenze)) + riga('Liberabile a valore contabile', eur(a.liberabile), 1) + riga('Obsoleto (valore di realizzo incerto)', eur(c.obsoleto.valore)) + '</table>' +
      '<p class="muto">Gli importi sono a valore contabile: quanto si incasserà davvero dipende dal prezzo di realizzo, che Timone non stima.</p></div>';
    a.criticita.forEach(function (x) {
      h += '<div class="carta crit ' + x.gravita + '"><h3>' + esc(x.titolo) + '</h3><dl><div><dt>Dati</dt><dd>' + esc(x.dati) + '</dd></div><div><dt>Causa probabile</dt><dd>' + esc(x.causa) + '</dd></div><div><dt>Intervento</dt><dd>' + esc(x.intervento) + '</dd></div><div><dt>Quanto pesa</dt><dd>' + esc(x.effetto) + '</dd></div></dl></div>';
    });
    h += '<div class="carta"><h3 style="margin-top:0">Per categoria</h3><div class="scorri"><table><tr><th></th><th>Articoli</th><th>Valore</th><th>Rotazione</th></tr>';
    Object.keys(a.categorie).forEach(function (k) { var x = a.categorie[k]; h += '<tr><td>' + G.CATEGORIE[k] + '</td><td>' + x.n + '</td><td>' + eur(x.valore) + '</td><td>' + fmt(x.valore ? x.consumi / x.valore : null, 'x') + '</td></tr>'; });
    h += '</table></div></div><div class="carta"><h3 style="margin-top:0">Classi ABC per valore</h3><table><tr><th></th><th>Articoli</th><th>Valore</th><th>Quota</th></tr>' +
      ['A', 'B', 'C'].map(function (k) { return '<tr><td>Classe ' + k + '</td><td>' + a.abc[k].n + '</td><td>' + eur(a.abc[k].valore) + '</td><td>' + fmt(a.valore ? a.abc[k].valore / a.valore : null, 'pct') + '</td></tr>'; }).join('') +
      '</table><p class="muto">Classe A: i pochi articoli che fanno l\'80% del valore. È lì che un controllo più stretto rende di più.</p></div>';
    return h;
  }

  function vArticoli() {
    var a = analisi(); if (!a.presente || !a.righe.length) return senzaInventario();
    if (st.filtroMagazzino && !(a.classi[st.filtroMagazzino] && a.classi[st.filtroMagazzino].n)) st.filtroMagazzino = '';
    var f = st.filtroMagazzino || '', righe = a.righe.filter(function (x) { return !f || x.k.classe === f; }).sort(function (x, y) { return (y.k.valore || 0) - (x.k.valore || 0); });
    var h = '<div class="sub"><button data-a="mgFiltro" data-classe="" class="' + (!f ? 'on' : '') + '">Tutti ' + a.righe.length + '</button>' + Object.keys(G.CLASSI).filter(function (k) { return a.classi[k].n; }).map(function (k) { return '<button data-a="mgFiltro" data-classe="' + k + '" class="' + (f === k ? 'on' : '') + '">' + G.CLASSI[k] + ' ' + a.classi[k].n + '</button>'; }).join('') + '</div>';
    h += '<div class="riga">' + (T.scrivibile() ? '<button class="b p" data-a="mgNuovo">Nuovo articolo</button>' : '') + '<button class="b p s" data-a="mgEsporta">Esporta CSV</button></div><div class="carta"><div class="lista">';
    righe.slice(0, 200).forEach(function (x) {
      var r = x.a, k = x.k;
      h += '<button data-a="mgApri" data-id="' + esc(r.id) + '"><span style="flex:1;min-width:0"><b>' + esc(r.codice || '—') + '</b> ' + esc(r.descrizione || '') + '<br><span class="muto">' + nfx(r.giacenza, 0) + ' ' + esc(r.um || '') + (k.copertura !== null ? ' · ' + nf0.format(k.copertura) + ' gg di copertura' : '') + (k.giorniFermo !== null && k.giorniFermo > 30 ? ' · fermo da ' + k.giorniFermo + ' gg' : '') + '</span></span>' +
        '<span style="text-align:right"><span class="tag ' + COLORE[k.classe] + '">' + G.CLASSI[k.classe] + '</span><br><span class="muto">' + eur(k.valore) + '</span></span></button>';
    });
    h += '</div>' + (righe.length > 200 ? '<p class="muto">Mostrati i primi 200 articoli per valore su ' + righe.length + ': l\'esportazione CSV li contiene tutti.</p>' : '') + '</div>';
    return h;
  }

  function vRiordini() {
    var a = analisi(); if (!a.presente || !a.righe.length) return senzaInventario();
    var righe = a.righe.filter(function (x) { return x.k.classe === 'sotto_scorta'; }).sort(function (x, y) { return (x.k.giorniAutonomia === null ? 1e9 : x.k.giorniAutonomia) - (y.k.giorniAutonomia === null ? 1e9 : y.k.giorniAutonomia); });
    if (!righe.length) return '<div class="avviso ok">Nessun articolo sotto scorta al ' + dataIt(a.data) + '.</div><p class="muto">Vengono segnalati gli articoli la cui giacenza, sommata agli ordini in arrivo, è inferiore alla scorta minima o al consumo previsto nel tempo di consegna.</p>';
    var h = '<p class="muto">Dal più urgente. Quantità da ordinare = consumo nel tempo di consegna + scorta minima − giacenza − ordini in arrivo.</p><div class="carta"><div class="scorri"><table><tr><th></th><th>Giacenza</th><th>Autonomia</th><th>Da ordinare</th><th>Valore</th></tr>';
    righe.forEach(function (x) { h += '<tr><td><b>' + esc(x.a.codice) + '</b> ' + esc(x.a.descrizione || '') + '</td><td>' + nfx(x.a.giacenza, 0) + '</td><td>' + (x.k.giorniAutonomia === null ? '—' : nfx(x.k.giorniAutonomia, 1) + ' gg') + '</td><td>' + nfx(Math.ceil(x.k.fabbisogno), 0) + ' ' + esc(x.a.um || '') + '</td><td>' + eur(x.k.valoreFabbisogno) + '</td></tr>'; });
    return h + '<tr class="tot"><td>Totale acquisti necessari</td><td></td><td></td><td></td><td>' + eur(a.valoreFabbisogni) + '</td></tr></table></div></div><p class="muto">È una proposta calcolata sui dati dell\'inventario: l\'ordine al fornitore resta una decisione tua.</p>';
  }

  function vDati() {
    var D = d(), par = G.parametri(D), inv = D.anni[st.anno], im = st.importMagazzino;
    var h = '<div class="carta"><h3 style="margin-top:0">Importa l\'inventario ' + st.anno + '</h3><p class="muto">File Excel o CSV esportato dal gestionale. Colonne riconosciute: Codice, Descrizione, Categoria, UM, Giacenza, Costo unitario (oppure Valore), Consumo annuo, Ultimo movimento, Scorta minima, Tempo di consegna, In ordine.</p>' +
      '<div class="riga"><button class="b p s" data-a="mgModello">Scarica il modello</button>' + (T.scrivibile() ? '<label class="b p" style="cursor:pointer">Scegli file<input type="file" accept=".csv,.txt,.xlsx,.xls" data-c="mgFile" hidden></label>' : '') + '</div>';
    if (im) {
      h += '<h3>Anteprima · ' + esc(im.nome) + '</h3>'; im.avvisi.forEach(function (x) { h += '<div class="avviso">' + esc(x) + '</div>'; });
      if (im.articoli.length) {
        var val = im.articoli.reduce(function (s, x) { return s + (x.giacenza || 0) * (x.costoUnitario || 0); }, 0);
        h += '<p>' + im.articoli.length + ' articoli, valore ' + eur(val) + '. Colonne lette: ' + esc(im.colonne.join(', ')) + '.</p>' + campo('Data dell\'inventario (gg/mm/aaaa)', 'mgData', dataIt((inv && inv.data) || st.anno + '-12-31'), '') +
          '<div class="riga" style="margin-top:12px"><button class="b" data-a="mgImporta">' + (inv && inv.articoli.length ? 'Sostituisci l\'inventario ' + st.anno : 'Importa') + '</button><button class="b s" data-a="mgAnnulla">Annulla</button></div>';
      } else h += '<button class="b s" data-a="mgAnnulla">Chiudi</button>';
    }
    h += '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Parametri</h3><div class="riga">' + campo('Costo del capitale (% annuo)', 'mgTasso', nfx(par.tasso * 100, 2)) + campo('Fermo dopo (giorni senza movimenti)', 'mgFermo', par.giorniFermo) + campo('Obsoleto dopo (giorni)', 'mgObs', par.giorniObsoleto) + campo('Copertura massima (giorni di consumo)', 'mgCop', par.coperturaMax) + '</div>' +
      (T.scrivibile() ? '<button class="b p" style="margin-top:12px" data-a="mgParametri">Salva parametri</button>' : '') + '<p class="muto">Il costo del capitale è il tasso a cui l\'azienda si finanzia (o il rendimento a cui rinuncia): usa quello dei tuoi finanziamenti. Le soglie dipendono dal settore e vanno adattate.</p></div>';
    if (inv && inv.articoli.length && T.scrivibile()) h += '<div class="carta"><h3 style="margin-top:0">Inventario ' + st.anno + '</h3><p class="muto">' + inv.articoli.length + ' articoli al ' + dataIt(inv.data) + '.</p><button class="b p peri" data-a="mgSvuota">Elimina l\'inventario ' + st.anno + '</button></div>';
    return h;
  }

  function scheda(id) {
    var a = analisi(), x = a.righe.filter(function (r) { return r.a.id === id; })[0]; if (!x) return;
    var r = x.a, k = x.k, par = a.parametri;
    var h = '<h3 style="margin-top:0">' + esc(r.codice || '') + ' · ' + esc(r.descrizione || '') + '</h3><p><span class="tag ' + COLORE[k.classe] + '">' + G.CLASSI[k.classe] + '</span> ' + (k.abc ? '<span class="tag">classe ' + k.abc + '</span> ' : '') + '<span class="tag ' + esc(r.origine || '') + '">' + esc(r.origine || 'manuale') + '</span></p><table>' +
      riga('Categoria', G.CATEGORIE[r.categoria] || '—') + riga('Giacenza', nfx(r.giacenza) + ' ' + esc(r.um || '')) + riga('Costo unitario', r.costoUnitario === undefined ? 'mancante' : nfx(r.costoUnitario, 4) + ' €') + riga('Valore', eur(k.valore), 1) +
      riga('Consumo ultimi 12 mesi', r.consumoAnnuo === undefined ? 'mancante' : nfx(r.consumoAnnuo, 0)) + riga('Giorni di copertura', k.copertura === null ? '—' : nf0.format(k.copertura)) + riga('Rotazione annua', fmt(k.rotazione, 'x')) +
      riga('Ultimo movimento', dataIt(r.ultimoMovimento) + (k.giorniFermo !== null ? ' (' + k.giorniFermo + ' giorni prima dell\'inventario)' : '')) + riga('Scorta minima', nfx(r.scortaMinima, 0) || '—') + riga('Tempo di consegna', r.leadTime === undefined ? '—' : r.leadTime + ' giorni') + riga('In ordine', nfx(r.inOrdine, 0) || '0') +
      riga('Costo finanziario annuo', eur(k.valore === null ? null : k.valore * par.tasso)) + '</table>';
    if (k.classe === 'eccesso') h += '<div class="avviso">Eccedenza di ' + nfx(k.eccedenza, 0) + ' ' + esc(r.um || '') + ' (' + eur(k.valoreEccedenza) + ') rispetto a ' + par.coperturaMax + ' giorni di consumo.</div>';
    if (k.classe === 'sotto_scorta') h += '<div class="avviso">Da ordinare: ' + nfx(Math.ceil(k.fabbisogno), 0) + ' ' + esc(r.um || '') + ' (' + eur(k.valoreFabbisogno) + ').</div>';
    if (k.classe === 'incompleto') h += '<div class="avviso rosso">Non classificabile: manca ' + esc(k.mancanti.join(', ')) + '.</div>';
    h += '<div class="riga" style="margin-top:14px">' + (T.scrivibile() ? '<button class="b p" data-a="mgModifica" data-id="' + esc(id) + '">Modifica</button><button class="b p peri" data-a="mgElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b p s" data-a="chiudi">Chiudi</button></div>';
    apri(h);
  }
  function modulo(id) {
    var inv = d().anni[st.anno], r = id ? inv.articoli.filter(function (x) { return x.id === id; })[0] : { categoria: 'materia' };
    var h = '<h3 style="margin-top:0">' + (id ? 'Modifica articolo' : 'Nuovo articolo · inventario ' + st.anno) + '</h3><div class="riga">' + campo('Codice', 'mgCod', r.codice, '') + campo('Descrizione', 'mgDes', r.descrizione, '') +
      '<div class="campo"><label for="mgCat">Categoria</label><select id="mgCat">' + Object.keys(G.CATEGORIE).map(function (k) { return '<option value="' + k + '"' + (r.categoria === k ? ' selected' : '') + '>' + G.CATEGORIE[k] + '</option>'; }).join('') + '</select></div>' + campo('Unità di misura', 'mgUm', r.um, '') +
      campo('Giacenza', 'mgGia', nfx(r.giacenza)) + campo('Costo unitario (€)', 'mgCos', nfx(r.costoUnitario, 4)) + campo('Consumo ultimi 12 mesi', 'mgCon', nfx(r.consumoAnnuo)) + campo('Ultimo movimento (gg/mm/aaaa)', 'mgMov', r.ultimoMovimento ? dataIt(r.ultimoMovimento) : '', '') +
      campo('Scorta minima', 'mgMin', nfx(r.scortaMinima)) + campo('Tempo di consegna (giorni)', 'mgLead', nfx(r.leadTime)) + campo('In ordine', 'mgOrd', nfx(r.inOrdine)) + '</div>' +
      '<div class="riga" style="margin-top:14px"><span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="mgSalva" data-id="' + esc(id || '') + '">Salva</button></div>';
    apri(h);
  }

  var azioni = {
    mgSub: function (x) { st.subMagazzino = x.sub; if (x.sub === 'articoli') st.filtroMagazzino = ''; T.disegna(); },
    mgFiltro: function (x) { st.filtroMagazzino = x.classe || ''; st.subMagazzino = 'articoli'; T.disegna(); window.scrollTo(0, 0); },
    mgApri: function (x) { scheda(x.id); },
    mgNuovo: function () { var D = d(); if (!D.anni[st.anno]) D.anni[st.anno] = { data: st.anno + '-12-31', articoli: [] }; modulo(null); },
    mgModifica: function (x) { modulo(x.id); },
    mgSalva: function (x) {
      var D = d(), inv = D.anni[st.anno], txt = function (id, n) { return document.getElementById(id).value.trim().slice(0, n); }, cod = txt('mgCod', 40);
      if (!cod) { T.toast('Serve il codice'); return; }
      if (inv.articoli.some(function (y) { return y.codice === cod && y.id !== x.id; })) { T.toast('Codice già presente'); return; }
      var r = x.id ? inv.articoli.filter(function (y) { return y.id === x.id; })[0] : { id: 'm' + Date.now().toString(36) };
      r.codice = cod; r.descrizione = txt('mgDes', 120); r.categoria = document.getElementById('mgCat').value; r.um = txt('mgUm', 10);
      [['giacenza', 'mgGia'], ['costoUnitario', 'mgCos'], ['consumoAnnuo', 'mgCon'], ['scortaMinima', 'mgMin'], ['leadTime', 'mgLead'], ['inOrdine', 'mgOrd']].forEach(function (p) { var v = leggi(p[1]); if (v === null) delete r[p[0]]; else r[p[0]] = v; });
      var mov = txt('mgMov', 12);
      if (mov) { var dd = G.data(mov); if (!dd) { T.toast('Data non valida: usa gg/mm/aaaa'); return; } r.ultimoMovimento = dd; } else delete r.ultimoMovimento;
      r.origine = 'manuale';
      if (!x.id) inv.articoli.push(r);
      if (D.simulato && !Object.keys(D.anni).some(function (a) { return D.anni[a].articoli.some(function (y) { return y.origine === 'simulato'; }); })) delete D.simulato;
      T.salva(); T.chiudiDlg(); T.disegna(); T.toast('Articolo salvato');
    },
    mgElimina: function (x) { T.conferma('Eliminare questo articolo dall\'inventario ' + st.anno + '?', 'Elimina').then(function (si) { if (!si) return; var inv = d().anni[st.anno]; inv.articoli = inv.articoli.filter(function (y) { return y.id !== x.id; }); T.salva(); T.disegna(); }); },
    mgModello: function () { T.scarica('timone-modello-inventario.csv', '﻿' + G.modelloCsv(), 'text/csv;charset=utf-8'); },
    mgEsporta: function () { T.scarica('timone-inventario-' + st.anno + '.csv', '﻿' + G.esportaCsv(analisi()), 'text/csv;charset=utf-8'); },
    mgImporta: function () {
      var im = st.importMagazzino, dd = G.data(document.getElementById('mgData').value);
      if (!dd) { T.toast('Data dell\'inventario non valida: usa gg/mm/aaaa'); return; }
      var D = d(); D.anni[st.anno] = { data: dd, articoli: im.articoli, fonte: im.nome, importato: new Date().toISOString() }; delete D.simulato;
      st.importMagazzino = null; st.subMagazzino = 'sintesi'; T.salva(); T.disegna(); T.toast(im.articoli.length + ' articoli importati');
    },
    mgAnnulla: function () { st.importMagazzino = null; T.disegna(); },
    mgSvuota: function () { T.conferma('Eliminare tutto l\'inventario ' + st.anno + '?', 'Elimina').then(function (si) { if (!si) return; delete d().anni[st.anno]; T.salva(); T.disegna(); }); },
    mgParametri: function () {
      var t = leggi('mgTasso'), f = leggi('mgFermo'), o = leggi('mgObs'), c = leggi('mgCop');
      if (t === null || t < 0 || !f || !o || !c || o < f) { T.toast('Valori non validi (obsoleto deve essere ≥ fermo)'); return; }
      d().parametri = { tasso: t / 100, giorniFermo: Math.round(f), giorniObsoleto: Math.round(o), coperturaMax: Math.round(c) }; T.salva(); T.disegna(); T.toast('Parametri salvati');
    }
  };
  var cambi = {
    mgFile: function (e) {
      var f = e.files[0]; if (!f) return; e.value = '';
      T.tabellaDa(f).then(function (m) { var r = G.daTabella(m, T.numero); r.nome = f.name; st.importMagazzino = r; T.disegna(); }).catch(function (x) { T.toast('File non letto: ' + x.message); });
    }
  };

  T.registra({
    id: 'magazzino', titolo: 'Magazzino',
    descrizione: 'Inventario per articolo: scorte ferme, obsolete e in eccesso, capitale immobilizzato e suo costo, riordini, confronto con le rimanenze di bilancio.',
    vista: vista, azioni: azioni, cambi: cambi,
    criticita: function (az, anno) { return az.magazzino ? G.analisi(az, anno, T.nDi(anno)).criticita : []; },
    collaudo: function (az) { return az.magazzino ? G.collaudo(az) : []; },
    simula: function (az, seme) { var m = G.simula(az, seme); if (Object.keys(m.anni).length) az.magazzino = m; }
  });
})();
