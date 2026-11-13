/* Timone · interfaccia del modulo Decisioni produttive (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, D = window.Decisioni;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };

  function d() { if (!st.az.decisioni) st.az.decisioni = D.vuoto(); return D.dati(st.az); }
  function nfx(x, dec) { if (x === undefined || x === null) return ''; if (dec === 0) return nf0.format(Math.round(x)); var m = Math.pow(10, dec === undefined ? 2 : dec); return String(Math.round(x * m) / m).replace('.', ','); }
  function campo(et, id, val, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td style="white-space:normal">' + v + '</td></tr>'; }
  function pc(x) { return x === undefined || x === null ? '' : nfx(x * 100, 1); }
  function segno(x) { return (x > 0 ? '+' : '') + eur(x); }
  function nomeScenario(id, k) { var s = k.scenari[id]; return D.SCENARI[id] + (id === 'ridurre' ? ' (al ' + Math.round(s.ritmo * 100) + '%)' : id === 'fermare' ? ' (' + s.mesiPrevisti + ' mesi)' : ''); }

  function vista() {
    var a = D.analisi(st.az);
    if (st.decAperto) { var x = a.filter(function (r) { return r.c.id === st.decAperto; })[0]; if (x && x.k.valido) return dettaglio(x); st.decAperto = null; }
    var h = '<h2>Produrre o fermare?</h2>';
    if (d().simulato) h += '<div class="avviso">Casi simulati: sono esempi di fantasia per provare il modulo.</div>';
    h += '<p class="muto">Per una linea o un prodotto, su un periodo di alcuni mesi, confronta sei alternative: continuare, ridurre, produrre solo su ordinazione, produrre in anticipo e poi fermare, fermare, esternalizzare. Ordini, previsioni e costi li inserisci tu.</p>' +
      (T.scrivibile() ? '<div class="riga"><button class="b p" data-a="deNuovo">Nuovo caso</button></div>' : '');
    if (!a.length) return h + '<div class="carta"><p>Nessun caso inserito.</p><p class="muto">Serve quando gli ordini calano, il magazzino si riempie o una linea lavora sotto ritmo: il modulo calcola quale scelta costa meno, distinguendo i costi fissi che il fermo elimina da quelli che restano.</p></div>';
    a.forEach(function (x) {
      var k = x.k;
      h += '<div class="carta"><div class="riga"><h3 style="margin:0">' + esc(x.c.nome || 'Caso') + '</h3><span class="sp"></span>' + (x.c.origine === 'simulato' ? '<span class="tag simulato">simulato</span>' : '') + '</div>';
      if (!k.valido) h += k.errori.map(function (m) { return '<div class="avviso">' + esc(m) + '</div>'; }).join('');
      else h += '<p class="muto">' + k.mesi + ' mesi · domanda ' + nfx(k.domanda, 0) + ' unità su ' + nfx(k.capacita, 0) + ' di capacità (' + fmt(k.saturazione, 'pct') + ')</p><table>' + riga('Scelta con il risultato migliore', '<b>' + esc(nomeScenario(k.migliore, k)) + '</b>', 1) +
        riga('Rispetto a continuare a pieno ritmo', '<span class="' + (k.classifica[0].delta > 0 ? 'su' : '') + '">' + segno(k.classifica[0].delta) + '</span>') + '</table>' + (k.soloOrdini && k.soloOrdini.cambia ? '<p class="muto">Con i soli ordini confermati la scelta migliore diventa: ' + esc(D.SCENARI[k.soloOrdini.migliore].toLowerCase()) + '.</p>' : '');
      h += '<div class="riga" style="margin-top:8px">' + (k.valido ? '<button class="b p" data-a="deApri" data-id="' + esc(x.c.id) + '">Confronto completo</button>' : '') + (T.scrivibile() ? '<button class="b p s" data-a="deModifica" data-id="' + esc(x.c.id) + '">Modifica</button>' : '') + '</div></div>';
    });
    return h;
  }

  function dettaglio(x) {
    var c = x.c, k = x.k, best = k.scenari[k.migliore];
    var h = '<div class="riga noprint"><button class="b p s" data-a="deChiudi">← Casi</button><span class="sp"></span>' + (T.scrivibile() ? '<button class="b p s" data-a="deModifica" data-id="' + esc(c.id) + '">Modifica</button>' : '') + '</div><h2>' + esc(c.nome || 'Caso') + '</h2>';
    k.avvisi.forEach(function (m) { h += '<div class="avviso rosso">' + esc(m) + '</div>'; });
    h += '<div class="avviso ok"><b>' + esc(nomeScenario(k.migliore, k)) + '</b> dà il risultato economico migliore nei ' + k.mesi + ' mesi: ' + eur(best.economico) + ', cioè ' + segno(k.classifica[0].delta) + ' rispetto a continuare a pieno ritmo.' +
      (k.miglioreCassa !== k.migliore ? ' Per la cassa, invece, la scelta migliore è: ' + esc(D.SCENARI[k.miglioreCassa].toLowerCase()) + '.' : '') + '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Il caso in sintesi</h3><table>' + riga('Domanda nel periodo', nfx(k.domanda, 0) + ' unità (' + nfx(k.ordini, 0) + ' ordini confermati + ' + nfx(k.previsione, 0) + ' previsti)') + riga('Capacità nel periodo', nfx(k.capacita, 0) + ' unità · utilizzo ' + fmt(k.saturazione, 'pct')) + riga('Scorta iniziale', nfx(c.scortaIniziale || 0, 0) + ' unità') +
      riga('Margine di contribuzione per unità', '<span class="' + (k.margineUnitario <= 0 ? 'giu' : '') + '">' + nfx(k.margineUnitario, 2) + ' €</span>') + riga('Costi fissi al mese', eur(c.costiFissiMese || 0)) + riga('· evitabili con il fermo', eur(k.fissiEvitabiliMese)) + riga('· che restano comunque', eur(k.fissiInevitabiliMese)) +
      riga('Costo di fermo e riavvio', eur((c.costoFermo || 0) + (c.costoRiavvio || 0))) + (k.mesiPareggioFermo !== null ? riga('Mesi di fermo necessari a ripagarlo', nfx(k.mesiPareggioFermo, 1), 1) : '') + '</table>' +
      '<p class="muto">Il fermo fa risparmiare solo i costi fissi evitabili: gli altri (affitti, ammortamenti, personale che resta in organico) si pagano anche a linea ferma.</p></div>';
    h += '<div class="carta"><h3 style="margin-top:0">Le alternative a confronto</h3><div class="scorri"><table><tr><th></th><th>Risultato economico</th><th>Rispetto a continuare</th><th>Cassa</th><th>Scorta finale</th><th>Vendite perse</th></tr>';
    k.classifica.forEach(function (r, i) { h += '<tr class="' + (i === 0 ? 'tot' : '') + '"><td>' + (i + 1) + '. ' + esc(nomeScenario(r.id, k)) + '</td><td class="' + (r.s.economico < 0 ? 'giu' : '') + '">' + eur(r.s.economico) + '</td><td>' + (r.id === 'continuare' ? '—' : segno(r.delta)) + '</td><td class="' + (r.s.cassa < 0 ? 'giu' : '') + '">' + eur(r.s.cassa) + '</td><td>' + nfx(r.s.scortaFinale, 0) + '</td><td>' + (r.s.perse > 0.5 ? '<span class="giu">' + nfx(r.s.perse, 0) + '</span>' : '0') + '</td></tr>'; });
    h += '</table></div><p class="muto">Risultato economico: ricavi meno tutti i costi del periodo, comprese la variazione delle scorte, il costo finanziario del capitale fermo e il rischio di obsolescenza. Cassa: entrate meno uscite effettive.</p></div>';
    k.classifica.forEach(function (r) { var s = r.s;
      h += '<details class="carta" style="border-bottom:1px solid var(--linea)"><summary><span class="nome"><b>' + esc(nomeScenario(r.id, k)) + '</b></span><span class="val">' + eur(s.economico) + '</span></summary><div class="spiega"><table>' + riga('Unità prodotte', nfx(s.prodotti, 0)) + (s.esterni ? riga('Unità acquistate all\'esterno', nfx(s.esterni, 0)) : '') + riga('Unità vendute', nfx(s.venduti, 0)) +
        riga('Ricavi', eur(s.ricavi)) + riga('− Costi variabili di produzione', eur(s.costiVariabili)) + (s.costoEsterni ? riga('− Acquisti esterni', eur(s.costoEsterni)) : '') + riga('− Costi fissi pagati', eur(s.fissi) + (s.fissiEvitati ? ' <span class="muto">(evitati ' + eur(s.fissiEvitati) + ' in ' + s.mesiFermo + ' mesi di fermo)</span>' : '')) + (s.unaTantum ? riga('− Fermo e riavvio', eur(s.unaTantum)) : '') +
        riga('− Mantenimento delle scorte', eur(s.mantenimento)) + riga('= Effetto sulla cassa', eur(s.cassa), 1) + riga('± Variazione delle scorte', segno(s.variazioneScorte)) + riga('− Costo finanziario del capitale fermo', eur(s.finanziario)) + riga('− Rischio di obsolescenza', eur(s.obsolescenza)) + riga('= Risultato economico', eur(s.economico), 1) +
        riga('Capitale immobilizzato in scorte a fine periodo', eur(s.capitaleFinale) + ' · massimo ' + eur(s.capitaleMax)) + (s.perse > 0.5 ? riga('Vendite non servite', nfx(s.perse, 0) + ' unità · margine perso ' + eur(s.marginePerso)) : '') + '</table>' +
        '<div class="scorri"><table><tr><th>Mese</th><th>Produzione</th><th>Vendite</th><th>Scorta</th></tr>' + s.mesi.map(function (m) { return '<tr><td>' + m.mese + (m.fermo ? ' <span class="tag">fermo</span>' : '') + '</td><td>' + nfx(m.produzione + m.esterni, 0) + '</td><td>' + nfx(m.vendite, 0) + '</td><td>' + nfx(m.scorta, 0) + '</td></tr>'; }).join('') + '</table></div></div></details>'; });
    if (k.soloOrdini) { h += '<div class="carta"><h3 style="margin-top:0">E se le previsioni non si realizzano?</h3><p class="muto">Stesse alternative con i soli ordini confermati (' + nfx(k.ordini, 0) + ' unità).</p><table>';
      k.soloOrdini.classifica.forEach(function (r, i) { h += riga((i + 1) + '. ' + esc(D.SCENARI[r.id]), '<span class="' + (r.s.economico < 0 ? 'giu' : '') + '">' + eur(r.s.economico) + '</span>', i === 0); });
      h += '</table>' + (k.soloOrdini.cambia ? '<div class="avviso">La scelta migliore cambia: conviene decidere guardando soprattutto gli ordini confermati, o scegliere un\'alternativa che vada bene in entrambi i casi.</div>' : '<p class="muto">La scelta migliore resta la stessa anche senza le vendite previste.</p>') + '</div>'; }
    h += '<div class="carta"><h3 style="margin-top:0">Ipotesi usate</h3><p class="muto">Domanda distribuita in parti uguali nei mesi; ciò che non si riesce a consegnare nel mese è considerato una vendita persa; scorte valorizzate al costo variabile; riducendo il ritmo i costi fissi restano invariati; fermo e riavvio sono contati per intero anche se il riavvio cade dopo il periodo. Non sono considerati ammortizzatori sociali, penali contrattuali, perdita di clienti, qualità e tempi dei fornitori esterni: è un confronto di costi, la decisione resta tua.</p></div>';
    return h;
  }

  var CAMPI = [['mesi', 'Periodo da valutare (mesi)', 0], ['capacitaMese', 'Capacità produttiva (unità al mese)', 0], ['ordiniConfermati', 'Ordini confermati nel periodo (unità)', 0], ['previsioneVendite', 'Altre vendite previste (unità)', 0], ['scortaIniziale', 'Scorta di prodotto finito oggi (unità)', 0],
    ['prezzo', 'Prezzo di vendita per unità (€)', 2], ['costoVariabile', 'Costo variabile per unità: materiali, energia, lavoro variabile (€)', 2], ['costiFissiMese', 'Costi fissi della linea al mese (€)', 0]];
  var CAMPI2 = [['costoFermo', 'Costo una tantum per fermare (€)', 0], ['costoRiavvio', 'Costo una tantum per riavviare (€)', 0], ['mesiFermo', 'Mesi di fermo da valutare', 0], ['prezzoEsterno', 'Prezzo per unità se acquistata all\'esterno (€) · vuoto = non valutare', 2]];
  var PERC = [['quotaEvitabile', 'Quota dei costi fissi evitabile con il fermo (%)'], ['riduzione', 'Ritmo nello scenario «ridurre» (% della capacità)'], ['costoMantenimento', 'Costo annuo di mantenimento delle scorte (% del valore)'], ['tassoFinanziario', 'Costo annuo del capitale (%)'], ['rischioObsolescenza', 'Quota delle scorte finali a rischio di obsolescenza (%)']];
  function modulo(id) {
    var c = id ? d().casi.filter(function (x) { return x.id === id; })[0] : { mesi: 6, riduzione: 0.5, tassoFinanziario: 0.06 };
    $('#dlgCorpo').innerHTML = '<h3 style="margin-top:0">' + (id ? 'Modifica caso' : 'Nuovo caso') + '</h3><div class="riga">' + campo('Nome (linea o prodotto)', 'deNome', c.nome, '') + CAMPI.map(function (f) { return campo(f[1], 'de_' + f[0], nfx(c[f[0]], f[2])); }).join('') + '</div>' +
      '<h3>Fermo ed esternalizzazione</h3><div class="riga">' + campo(PERC[0][1], 'de_quotaEvitabile', pc(c.quotaEvitabile)) + CAMPI2.map(function (f) { return campo(f[1], 'de_' + f[0], nfx(c[f[0]], f[2])); }).join('') + campo(PERC[1][1], 'de_riduzione', pc(c.riduzione)) + '</div>' +
      '<h3>Costo delle scorte</h3><div class="riga">' + PERC.slice(2).map(function (f) { return campo(f[1], 'de_' + f[0], pc(c[f[0]])); }).join('') + '</div>' +
      '<p class="muto">Costi fissi evitabili: quelli che smetti davvero di pagare a linea ferma (energia di base, contratti sospendibili, personale ricollocabile o sospeso). Chiedi conferma a chi segue il personale prima di contare il costo del lavoro come evitabile.</p>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="deElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="deSalva" data-id="' + esc(id || '') + '">Salva</button></div>';
    if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0;
  }

  var azioni = {
    deNuovo: function () { modulo(null); },
    deModifica: function (x) { modulo(x.id); },
    deApri: function (x) { st.decAperto = x.id; T.disegna(); window.scrollTo(0, 0); },
    deChiudi: function () { st.decAperto = null; T.disegna(); },
    deSalva: function (x) {
      var D2 = d(), nome = $('#deNome').value.trim().slice(0, 80); if (!nome) { T.toast('Serve un nome'); return; }
      var c = x.id ? D2.casi.filter(function (y) { return y.id === x.id; })[0] : { id: 'd' + Date.now().toString(36) };
      c.nome = nome;
      CAMPI.concat(CAMPI2).forEach(function (f) { var v = leggi('de_' + f[0]); if (v === null) delete c[f[0]]; else c[f[0]] = v; });
      PERC.forEach(function (f) { var v = leggi('de_' + f[0]); if (v === null) delete c[f[0]]; else c[f[0]] = Math.max(0, Math.min(100, v)) / 100; });
      c.origine = 'manuale'; if (!x.id) D2.casi.push(c);
      if (D2.simulato && !D2.casi.some(function (y) { return y.origine === 'simulato'; })) delete D2.simulato;
      var err = D.valida(c); T.salva(); T.chiudiDlg(); T.disegna(); T.toast(err.length ? 'Salvato, ma mancano dati: ' + err[0] : 'Caso salvato');
    },
    deElimina: function (x) { T.conferma('Eliminare questo caso?', 'Elimina').then(function (si) { if (!si) return; st.az.decisioni.casi = d().casi.filter(function (y) { return y.id !== x.id; }); if (st.decAperto === x.id) st.decAperto = null; T.salva(); T.disegna(); }); }
  };

  T.registra({
    id: 'decisioni', titolo: 'Produrre o fermare', senzaEsercizi: true,
    descrizione: 'Per le aziende che producono: confronto economico e di cassa tra continuare, ridurre, produrre su ordinazione, anticipare e fermare, fermare, esternalizzare.',
    vista: vista, azioni: azioni,
    collaudo: function (az) { return az.decisioni ? D.collaudo(az) : []; },
    simula: function (az) { var m = D.simulaCasi(az); if (m.casi.length) az.decisioni = m; }
  });
})();
