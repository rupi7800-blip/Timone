/* Timone · interfaccia del modulo Investimenti (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, V = window.Investimenti;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };
  var ESITO = { si: ['Conviene', 'ok'], riserva: ['Conviene con riserva', 'giallo'], no: ['Non conviene', 'rosso'] };

  function d() { if (!st.az.investimenti) st.az.investimenti = V.vuoto(); return V.dati(st.az); }
  function ctx() { return st.anno ? V.contesto(st.az, st.anno, T.nDi(st.anno), T.completo(st.anno, 'ce'), T.completo(st.anno)) : {}; }
  function nfx(x, dec) { if (x === undefined || x === null) return ''; if (dec === 0) return nf0.format(Math.round(x)); var m = Math.pow(10, dec === undefined ? 2 : dec); return String(Math.round(x * m) / m).replace('.', ','); }
  function anni(x) { return x === null || x === undefined ? 'mai, nella vita utile' : nfx(x, 1) + ' anni'; }
  function campo(et, id, val, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function scelta(et, id, opz, sel) { return '<div class="campo"><label for="' + id + '">' + et + '</label><select id="' + id + '">' + opz.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(sel) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td>' + v + '</td></tr>'; }
  function pc(x) { return x === undefined || x === null ? '' : nfx(x * 100, 2); }

  function vista() {
    var a = V.analisi(st.az, ctx());
    if (st.invAperto) { var x = a.righe.filter(function (r) { return r.inv.id === st.invAperto; })[0]; if (x) return dettaglio(x, a); st.invAperto = null; }
    var h = '<div class="riga"><h2 style="margin:0">Investimenti</h2><span class="sp"></span>' + T.selAnno() + '</div>';
    if (d().simulato) h += '<div class="avviso">Investimenti simulati: sono esempi di fantasia per provare il modulo.</div>';
    h += '<p class="muto">Inserisci un investimento che stai valutando: Timone calcola se si ripaga, in quanto tempo, quanto rischia e che effetto ha sui conti. Risparmi e maggiori ricavi sono le tue ipotesi: il risultato vale quanto valgono quelle.</p>' +
      '<div class="riga">' + (T.scrivibile() ? '<button class="b p" data-a="inNuovo">Nuovo investimento</button>' : '') + '<button class="b p s" data-a="inParametri">Tasso di sconto e imposte</button></div>';
    if (!a.contabile) h += '<div class="avviso">Il bilancio ' + (st.anno || '') + ' manca o è incompleto: l\'effetto sui conti dell\'azienda e il controllo sulla liquidità non vengono calcolati.</div>';
    if (!a.righe.length) return h + '<div class="carta"><p>Nessun investimento inserito.</p><p class="muto">Esempi: un nuovo macchinario, un impianto fotovoltaico, un software, un veicolo, un capannone, una nuova linea.</p></div>';
    a.righe.forEach(function (x) {
      var k = x.k, e = k.valido ? ESITO[k.esito] : ['Dati mancanti', ''];
      h += '<div class="carta" style="border-left:5px solid var(--' + (k.valido ? (k.esito === 'si' ? 'verde' : k.esito === 'riserva' ? 'giallo' : 'rosso') : 'linea') + ')"><div class="riga"><h3 style="margin:0">' + esc(x.inv.nome || 'Investimento') + '</h3><span class="sp"></span><span class="tag ' + e[1] + '">' + e[0] + '</span></div>' +
        '<p class="muto">' + (V.TIPI[x.inv.tipo] || 'Altro') + ' · ' + (V.STATI[x.inv.stato] || 'Ipotesi') + (x.inv.origine === 'simulato' ? ' · simulato' : '') + '</p>';
      if (!k.valido) h += k.errori.map(function (m) { return '<div class="avviso">' + esc(m) + '</div>'; }).join('');
      else h += '<table>' + riga('Investimento netto', eur(k.uscita)) + riga('VAN al ' + fmt(a.parametri.tassoSconto, 'pct'), '<span class="' + (k.van < 0 ? 'giu' : 'su') + '">' + eur(k.van) + '</span>', 1) + riga('TIR', k.tir === null ? '—' : fmt(k.tir, 'pct')) + riga('Tempo di recupero', anni(k.recupero)) + riga('Rischio', k.rischio) + '</table>' +
        (k.riserve.length ? '<p class="muto">Riserve: ' + esc(k.riserve.join('; ')) + '.</p>' : '');
      h += '<div class="riga" style="margin-top:8px">' + (k.valido ? '<button class="b p" data-a="inApri" data-id="' + esc(x.inv.id) + '">Analisi completa</button>' : '') + (T.scrivibile() ? '<button class="b p s" data-a="inModifica" data-id="' + esc(x.inv.id) + '">Modifica</button>' : '') + '</div></div>';
    });
    if (a.classifica.length > 1) { h += '<div class="carta"><h3 style="margin-top:0">Confronto</h3><div class="scorri"><table><tr><th></th><th>Investimento</th><th>VAN</th><th>VAN per €</th><th>TIR</th><th>Recupero</th></tr>';
      a.classifica.forEach(function (x) { h += '<tr><td>' + x.k.posizione + '. ' + esc(x.inv.nome) + '</td><td>' + eur(x.k.uscita) + '</td><td class="' + (x.k.van < 0 ? 'giu' : '') + '">' + eur(x.k.van) + '</td><td>' + nfx(x.k.indice, 2) + '</td><td>' + (x.k.tir === null ? '—' : fmt(x.k.tir, 'pct')) + '</td><td>' + (x.k.recupero === null ? '—' : nfx(x.k.recupero, 1)) + '</td></tr>'; });
      h += '</table></div><p class="muto">Ordinati per VAN creato da ogni euro investito: è il criterio corretto quando le risorse non bastano per tutto.</p></div>'; }
    return h;
  }

  function dettaglio(x, a) {
    var inv = x.inv, k = x.k, par = a.parametri, e = ESITO[k.esito];
    var h = '<div class="riga noprint"><button class="b p s" data-a="inChiudi">← Investimenti</button><span class="sp"></span>' + (T.scrivibile() ? '<button class="b p s" data-a="inModifica" data-id="' + esc(inv.id) + '">Modifica</button>' : '') + '</div>' +
      '<h2>' + esc(inv.nome || 'Investimento') + '</h2><p class="muto">' + (V.TIPI[inv.tipo] || 'Altro') + ' · vita utile ' + k.anni + ' anni</p>';
    h += '<div class="avviso ' + (k.esito === 'si' ? 'ok' : k.esito === 'no' ? 'rosso' : '') + '"><b>' + e[0] + '.</b> ' + (k.esito === 'no' ? 'Con queste ipotesi l\'investimento rende meno del ' + fmt(par.tassoSconto, 'pct') + ' richiesto: il valore creato è negativo per ' + eur(-k.van) + '.' :
      'Crea ' + eur(k.van) + ' di valore oltre il rendimento del ' + fmt(par.tassoSconto, 'pct') + ' richiesto' + (k.riserve.length ? ', ma ' + esc(k.riserve.join('; ')) + '.' : '.')) + '</div>';
    h += '<div class="kpi"><button><div class="n">Valore creato (VAN)</div><div class="v ' + (k.van < 0 ? 'giu' : '') + '">' + eur(k.van) + '</div><div class="d muto">' + nfx(k.indice, 2) + ' € per euro investito</div></button><button><div class="n">Rendimento (TIR)</div><div class="v">' + (k.tir === null ? '—' : fmt(k.tir, 'pct')) + '</div><div class="d muto">richiesto ' + fmt(par.tassoSconto, 'pct') + '</div></button>' +
      '<button><div class="n">Tempo di recupero</div><div class="v">' + (k.recupero === null ? '—' : nfx(k.recupero, 1) + ' anni') + '</div><div class="d muto">attualizzato: ' + anni(k.recuperoAttualizzato) + '</div></button><button><div class="n">Rischio</div><div class="v">' + k.rischio + '</div><div class="d muto">' + (k.margineSicurezza === null ? '' : k.margineSicurezza > 0 ? 'regge un calo dei benefici del ' + fmt(k.margineSicurezza, 'pct') : 'i benefici non bastano') + '</div></button></div>';
    h += '<div class="carta"><h3 style="margin-top:0">Quanto costa e quanto rende</h3><table>' + riga('Importo e costi accessori', eur(k.spesa)) + (k.contributo ? riga('− Contributi', eur(k.contributo)) : '') + riga('Investimento netto', eur(k.uscita), 1) + riga('Beneficio annuo (risparmi + margine sui maggiori ricavi − nuovi costi)', eur(k.beneficioBase)) + riga('Ammortamento annuo', eur(k.ammortamento)) +
      riga('Benefici totali nella vita utile', eur(k.totaleBenefici)) + riga('Redditività media annua (utile ÷ investimento)', fmt(k.redditivitaMedia, 'pct')) + '</table></div>';
    h += '<div class="carta"><h3 style="margin-top:0">Flussi di cassa per anno</h3><div class="scorri"><table><tr><th>Anno</th><th>Beneficio</th><th>Imposte</th><th>Flusso</th>' + (k.finanziato ? '<th>Rata</th><th>Dopo la rata</th>' : '') + '<th>Cumulato</th></tr><tr><td>0</td><td></td><td></td><td class="giu">' + eur(-k.uscita) + '</td>' + (k.finanziato ? '<td></td><td class="giu">' + eur(-k.contanti) + '</td>' : '') + '<td class="giu">' + eur(-k.contanti) + '</td></tr>';
    k.righe.forEach(function (r) { h += '<tr><td>' + r.anno + '</td><td>' + eur(r.beneficio) + '</td><td>' + eur(r.imposte) + '</td><td>' + eur(r.flusso) + '</td>' + (k.finanziato ? '<td>' + eur(r.rata) + '</td><td class="' + (r.dopoDebito < 0 ? 'giu' : '') + '">' + eur(r.dopoDebito) + '</td>' : '') + '<td class="' + (r.cumulato < 0 ? 'giu' : 'su') + '">' + eur(r.cumulato) + '</td></tr>'; });
    h += '</table></div><p class="muto">I flussi sono incrementali: misurano la differenza rispetto a non fare l\'investimento.' + (k.righe[k.anni - 1].residuo ? ' L\'ultimo anno comprende il valore residuo.' : '') + '</p></div>';
    if (k.finanziato) h += '<div class="carta"><h3 style="margin-top:0">Finanziamento</h3><table>' + riga('Importo finanziato', eur(k.finanziato)) + riga('Da pagare in contanti', eur(k.contanti)) + riga('Rata annua', eur(k.piano.rata), 1) + riga('Interessi totali', eur(k.piano.interessi)) + riga('Copertura minima della rata', k.coperturaMinima === null ? '—' : fmt(k.coperturaMinima, 'x')) + riga('Esposizione massima di cassa', eur(k.fabbisogno)) + '</table>' +
      '<p class="muto">Copertura = flusso generato dall\'investimento ÷ rata: sotto 1 la rata va pagata con altre risorse dell\'azienda.</p></div>';
    h += '<div class="carta"><h3 style="margin-top:0">E se le cose andassero peggio?</h3><table>' + k.sensibilita.map(function (s) { return riga('Benefici ' + Math.round(s.variazione * 100) + '%', '<span class="' + (s.van < 0 ? 'giu' : 'su') + '">VAN ' + eur(s.van) + '</span>'); }).join('') + riga('Costo dell\'investimento +10%', '<span class="' + (k.vanCostoPiu10 < 0 ? 'giu' : 'su') + '">VAN ' + eur(k.vanCostoPiu10) + '</span>') +
      (k.sogliaBenefici !== null && k.van > 0 ? riga('Il vantaggio si annulla se i benefici scendono al', fmt(k.sogliaBenefici, 'pct') + ' del previsto', 1) : '') + '</table></div>';
    if (k.azienda) { var z = k.azienda;
      h += '<div class="carta"><h3 style="margin-top:0">Effetto sui conti dell\'azienda (' + st.anno + ')</h3><table>' + riga('EBITDA: da → a', eur(z.ebitdaPrima) + ' → ' + eur(z.ebitdaDopo)) + riga('Debito finanziario netto: da → a', eur(z.pfnPrima) + ' → ' + eur(z.pfnDopo)) + riga('Debito netto / EBITDA: da → a', fmt(z.rapportoPrima, 'x') + ' → <span class="' + (z.rapportoDopo > 3 ? 'giu' : '') + '">' + fmt(z.rapportoDopo, 'x') + '</span>') +
        riga('Utile del primo anno', (z.utileDelta >= 0 ? '+' : '') + eur(z.utileDelta)) + riga('Liquidità disponibile / da pagare in contanti', eur(z.liquidita) + ' / <span class="' + (z.cassaInsufficiente ? 'giu' : '') + '">' + eur(z.contanti) + '</span>') + '</table>' +
        (z.cassaInsufficiente ? '<div class="avviso rosso">La parte in contanti supera la liquidità di bilancio: serve più finanziamento o altra cassa.</div>' : '') + '<p class="muto">Il debito netto sale dell\'intero investimento sia pagando in contanti sia finanziandosi; l\'EBITDA sale del beneficio del primo anno.</p></div>'; }
    h += '<div class="carta"><h3 style="margin-top:0">Ipotesi usate</h3><p class="muto">Tasso di sconto ' + fmt(par.tassoSconto, 'pct') + ' · imposte ' + fmt(par.aliquota, 'pct') + ' · ammortamento a quote costanti sulla vita utile · benefici ' + (inv.crescita ? 'in crescita del ' + fmt(inv.crescita, 'pct') + ' l\'anno' : 'costanti') + ' e pieni dal primo anno.</p>' + k.ipotesi.map(function (m) { return '<p class="muto">' + esc(m) + '</p>'; }).join('') +
      '<p class="muto">Non sono considerati: agevolazioni fiscali specifiche, capitale circolante aggiuntivo, tempi di avviamento, inflazione. Il risultato è un supporto alla decisione, non una garanzia.</p></div>';
    return h;
  }

  function modulo(id) {
    var inv = id ? d().elenco.filter(function (x) { return x.id === id; })[0] : { tipo: 'macchinario', stato: 'ipotesi', vitaUtile: 8 };
    $('#dlgCorpo').innerHTML = '<h3 style="margin-top:0">' + (id ? 'Modifica investimento' : 'Nuovo investimento') + '</h3><div class="riga">' + campo('Nome', 'inNome', inv.nome, '') + scelta('Tipo', 'inTipo', Object.keys(V.TIPI).map(function (k) { return [k, V.TIPI[k]]; }), inv.tipo) + scelta('Stato', 'inStato', Object.keys(V.STATI).map(function (k) { return [k, V.STATI[k]]; }), inv.stato || 'ipotesi') + '</div>' +
      '<h3>Costo</h3><div class="riga">' + campo('Importo (€)', 'in_importo', nfx(inv.importo)) + campo('Costi accessori: installazione, formazione… (€)', 'in_accessori', nfx(inv.accessori)) + campo('Contributi a fondo perduto, se ottenuti (€)', 'in_contributo', nfx(inv.contributo)) + campo('Vita utile (anni)', 'in_vitaUtile', nfx(inv.vitaUtile, 0)) + campo('Valore residuo a fine vita (€)', 'in_valoreResiduo', nfx(inv.valoreResiduo)) + '</div>' +
      '<h3>Benefici previsti ogni anno</h3><div class="riga">' + campo('Costi risparmiati (€)', 'in_risparmioAnnuo', nfx(inv.risparmioAnnuo)) + campo('Maggiori ricavi (€)', 'in_ricaviAnnui', nfx(inv.ricaviAnnui)) + campo('Margine sui maggiori ricavi (%) · vuoto = margine attuale', 'in_margineRicavi', pc(inv.margineRicavi)) + campo('Nuovi costi di gestione (€)', 'in_costiAnnui', nfx(inv.costiAnnui)) + campo('Crescita annua dei benefici (%)', 'in_crescita', pc(inv.crescita)) + '</div>' +
      '<h3>Finanziamento</h3><div class="riga">' + campo('Quota finanziata (%)', 'in_finanziamentoQuota', pc(inv.finanziamentoQuota)) + campo('Tasso annuo (%)', 'in_finanziamentoTasso', pc(inv.finanziamentoTasso)) + campo('Durata (anni)', 'in_finanziamentoAnni', nfx(inv.finanziamentoAnni, 0)) + '</div>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="inElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="inSalva" data-id="' + esc(id || '') + '">Salva</button></div>';
    if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0;
  }
  var EURO = ['importo', 'accessori', 'contributo', 'vitaUtile', 'valoreResiduo', 'risparmioAnnuo', 'ricaviAnnui', 'costiAnnui', 'finanziamentoAnni'], PERC = ['margineRicavi', 'crescita', 'finanziamentoQuota', 'finanziamentoTasso'];

  var azioni = {
    inNuovo: function () { modulo(null); },
    inModifica: function (x) { modulo(x.id); },
    inApri: function (x) { st.invAperto = x.id; T.disegna(); window.scrollTo(0, 0); },
    inChiudi: function () { st.invAperto = null; T.disegna(); },
    inSalva: function (x) {
      var D = d(), nome = $('#inNome').value.trim().slice(0, 80); if (!nome) { T.toast('Serve un nome'); return; }
      var inv = x.id ? D.elenco.filter(function (y) { return y.id === x.id; })[0] : { id: 'i' + Date.now().toString(36) };
      inv.nome = nome; inv.tipo = $('#inTipo').value; inv.stato = $('#inStato').value;
      EURO.forEach(function (k) { var v = leggi('in_' + k); if (v === null) delete inv[k]; else inv[k] = v; });
      PERC.forEach(function (k) { var v = leggi('in_' + k); if (v === null) delete inv[k]; else inv[k] = v / 100; });
      if (inv.finanziamentoQuota > 1) { T.toast('La quota finanziata non può superare il 100%'); return; }
      inv.origine = 'manuale'; if (!x.id) D.elenco.push(inv);
      if (D.simulato && !D.elenco.some(function (y) { return y.origine === 'simulato'; })) delete D.simulato;
      T.salva(); T.chiudiDlg(); T.disegna(); T.toast('Investimento salvato');
    },
    inElimina: function (x) { T.conferma('Eliminare questo investimento?', 'Elimina').then(function (si) { if (!si) return; st.az.investimenti.elenco = d().elenco.filter(function (y) { return y.id !== x.id; }); if (st.invAperto === x.id) st.invAperto = null; T.salva(); T.disegna(); }); },
    inParametri: function () {
      var par = V.parametri(d());
      $('#dlgCorpo').innerHTML = '<h3 style="margin-top:0">Tasso di sconto e imposte</h3><div class="riga">' + campo('Rendimento minimo richiesto (% annuo)', 'inTasso', pc(par.tassoSconto)) + campo('Aliquota d\'imposta (%) · 0 = ignora le imposte', 'inAliq', pc(par.aliquota)) + '</div>' +
        '<p class="muto">Il rendimento richiesto è il tasso con cui si attualizzano i flussi: almeno il costo dei tuoi finanziamenti, più un margine per il rischio. Il valore iniziale dell\'8% e l\'aliquota del 27,9% (IRES 24% + IRAP 3,9%) sono ipotesi generali da adattare.</p>' +
        '<div class="riga" style="margin-top:14px"><span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button>' + (T.scrivibile() ? '<button class="b" data-a="inParametriSalva">Salva</button>' : '') + '</div>';
      if (!$('#dlg').open) $('#dlg').showModal();
    },
    inParametriSalva: function () {
      var t = leggi('inTasso'), a = leggi('inAliq'); if (t === null || t < 0 || t > 100 || a === null || a < 0 || a > 90) { T.toast('Valori non validi'); return; }
      d().parametri = { tassoSconto: t / 100, aliquota: a / 100 }; T.salva(); T.chiudiDlg(); T.disegna();
    }
  };

  T.registra({
    id: 'investimenti', titolo: 'Investimenti', senzaEsercizi: true,
    descrizione: 'Valutazione degli investimenti ipotizzati: flussi di cassa, VAN, TIR, tempo di recupero, finanziamento, rischio ed effetto sui conti dell\'azienda.',
    vista: vista, azioni: azioni,
    collaudo: function (az) { return az.investimenti ? V.collaudo(az) : []; },
    simula: function (az) { var m = V.simula(az); if (m.elenco.length) az.investimenti = m; }
  });
})();
