/* Timone · interfaccia del modulo Energia e utenze (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, E = window.Energia;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };
  var SUB = [['sintesi', 'Sintesi'], ['bollette', 'Bollette'], ['offerte', 'Offerte'], ['dati', 'Utenze e importazione']];

  function d() { if (!st.az.energia) st.az.energia = E.vuoto(); return E.dati(st.az); }
  function oggi() { return new Date().toISOString().slice(0, 10); }
  function analisi() { return E.analisi(st.az, st.anno, T.nDi(st.anno), T.completo(st.anno, 'ce'), oggi()); }
  function nfx(x, dec) { if (x === undefined || x === null) return ''; if (dec === 0) return nf0.format(Math.round(x)); var m = Math.pow(10, dec === undefined ? 2 : dec); return String(Math.round(x * m) / m).replace('.', ','); }
  function e3(x) { return (x === null || x === undefined) ? '—' : (Math.round(x * 1000) / 1000).toFixed(3).replace('.', ',') + ' €'; }
  function campo(et, id, val, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function scelta(et, id, opz, sel) { return '<div class="campo"><label for="' + id + '">' + et + '</label><select id="' + id + '">' + opz.map(function (o) { return '<option value="' + o[0] + '"' + (String(sel) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function testo(id, n) { return document.getElementById(id).value.trim().slice(0, n); }
  function dataIt(s) { return s ? s.split('-').reverse().join('/') : '—'; }
  function dataDa(s) { var m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(String(s).trim()); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : (/^\d{4}-\d{2}-\d{2}$/.test(String(s).trim()) ? String(s).trim() : null); }
  function apri(html) { $('#dlgCorpo').innerHTML = html; if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0; }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td>' + v + '</td></tr>'; }
  var OPZ_VET = Object.keys(E.VETTORI).map(function (k) { return [k, E.VETTORI[k].nome]; }), OPZ_USO = Object.keys(E.USI).map(function (k) { return [k, E.USI[k]]; });

  function vista() {
    var sub = st.subEnergia || 'sintesi';
    var h = '<div class="riga"><h2 style="margin:0">Energia e utenze</h2><span class="sp"></span>' + T.selAnno() + '</div>';
    h += '<div class="sub">' + SUB.map(function (s) { return '<button data-a="enSub" data-sub="' + s[0] + '" class="' + (sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (d().simulato) h += '<div class="avviso">Utenze, bollette e offerte simulate: servono a provare il modulo, non sono dati né offerte reali.</div>';
    return h + ({ sintesi: vSintesi, bollette: vBollette, offerte: vOfferte, dati: vDati }[sub] || vSintesi)();
  }
  function senza() {
    return '<div class="carta"><p>Nessuna bolletta per il ' + st.anno + '.</p><p class="muto">Servono le bollette mensili di ogni utenza (elettricità, gas, acqua), IVA esclusa: consumo e, se possibile, le quattro componenti della spesa (materia, trasporto, oneri, imposte).</p>' +
      '<div class="riga"><button class="b" data-a="enSub" data-sub="dati">Importa o crea le utenze</button></div></div>';
  }
  function grafico(mesi, unita) {
    var W = 320, H = 120, max = 0; for (var m = 1; m <= 12; m++) if (mesi[m]) max = Math.max(max, mesi[m].consumo);
    if (!max) return '';
    var out = '', lb = 18, passo = W / 12, base = H - 18;
    for (m = 1; m <= 12; m++) { var x = (m - 1) * passo + (passo - lb) / 2, v = mesi[m] ? mesi[m].consumo : 0, hh = v / max * (base - 6);
      out += (mesi[m] ? '<rect x="' + x + '" y="' + (base - hh) + '" width="' + lb + '" height="' + Math.max(1, hh) + '" rx="3" fill="var(--acc)"/>' : '<rect x="' + x + '" y="' + (base - 3) + '" width="' + lb + '" height="3" fill="var(--linea)"/>') + '<text x="' + (x + lb / 2) + '" y="' + (H - 4) + '" text-anchor="middle">' + E.MESI[m - 1][0].toUpperCase() + '</text>'; }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Consumi mensili in ' + unita + '">' + out + '</svg>';
  }

  function vSintesi() {
    var a = analisi(); if (!a.presente) return senza();
    var h = '<div class="kpi"><button><div class="n">Spesa per utenze</div><div class="v">' + eur(a.spesaTotale) + '</div><div class="d muto">IVA esclusa</div></button>' +
      (a.contabile ? '<button><div class="n">Incidenza sulla produzione</div><div class="v">' + fmt(a.incidenzaProduzione, 'pct') + '</div><div class="d muto">' + fmt(a.quotaServizi, 'pct') + ' dei costi per servizi</div></button>' : '') + '</div>';
    if (!a.contabile) h += '<div class="avviso">Incidenza sul bilancio non calcolata: il conto economico ' + st.anno + ' manca o è incompleto.</div>';
    Object.keys(a.vettori).forEach(function (k) {
      var V = a.vettori[k], info = E.VETTORI[k];
      h += '<div class="carta"><h3 style="margin-top:0">' + info.nome + '</h3>' + (V.completo ? '' : '<div class="avviso">Mancano alcune bollette mensili: i totali riguardano solo i mesi presenti e non sono riportati all\'anno.</div>') + grafico(V.mesi, info.unita) + '<table>' +
        riga('Consumo', V.senzaConsumo ? 'incompleto' : nfx(V.consumo, 0) + ' ' + info.unita) + riga('Spesa', eur(V.spesa), 1) + riga('Costo per ' + info.unita + ' (tutto compreso)', e3(V.costoMedio)) +
        (V.varCosto !== undefined && V.varCosto !== null ? riga('Costo unitario rispetto al ' + (st.anno - 1), '<span class="' + (V.varCosto > 0 ? 'giu' : 'su') + '">' + (V.varCosto > 0 ? '+' : '') + fmt(V.varCosto, 'pct') + '</span>') + riga('Consumi rispetto al ' + (st.anno - 1), (V.varConsumo > 0 ? '+' : '') + fmt(V.varConsumo, 'pct')) : '') + '</table>';
      if (V.dettaglio) h += '<h3>Com\'è composta la spesa</h3><table>' + [['materia', 'Energia o materia prima (dipende dal fornitore)'], ['trasporto', 'Trasporto e gestione del contatore'], ['oneri', 'Oneri di sistema'], ['imposte', 'Imposte e accise']].map(function (c) { return riga(c[1], eur(V[c[0]]) + ' · ' + fmt(V.spesa ? V[c[0]] / V.spesa : null, 'pct')); }).join('') + '</table><p class="muto">Solo la prima componente cambia scegliendo un altro fornitore: è quella che viene confrontata con le offerte.</p>';
      else h += '<p class="muto">Le bollette non riportano le quattro componenti: composizione e confronto con le offerte non sono calcolabili.</p>';
      if (V.fasce && V.consumo) h += '<p class="muto">Fasce orarie: F1 ' + fmt(V.f1 / V.consumo, 'pct') + ' · F2 ' + fmt(V.f2 / V.consumo, 'pct') + ' · F3 ' + fmt(V.f3 / V.consumo, 'pct') + '.</p>';
      h += '</div>';
    });
    var usi = Object.keys(a.usi).map(function (k) { return a.usi[k]; });
    h += '<div class="carta"><h3 style="margin-top:0">Per utilizzo</h3><div class="scorri"><table><tr><th></th><th>Consumo</th><th>Spesa</th></tr>' + usi.sort(function (x, y) { return y.spesa - x.spesa; }).map(function (g) { return '<tr><td>' + E.VETTORI[g.vettore].nome + ' · ' + E.USI[g.uso] + '</td><td>' + nfx(g.consumo, 0) + ' ' + E.VETTORI[g.vettore].unita + '</td><td>' + eur(g.spesa) + '</td></tr>'; }).join('') + '</table></div></div>';
    if (a.commesse) h += '<div class="carta"><h3 style="margin-top:0">Collegamento con le commesse</h3><table>' + riga('Prezzo del kWh usato nelle commesse', e3(a.commesse.prezzoUsato)) + riga('Prezzo effettivo dalle bollette', e3(a.commesse.prezzoReale), 1) + riga('kWh attribuiti alle commesse', nfx(a.commesse.kwhAttribuiti, 0)) +
      riga('kWh delle utenze di produzione', nfx(a.commesse.kwhProduzione, 0)) + (a.commesse.quota !== null ? riga('Quota spiegata dalle commesse', fmt(a.commesse.quota, 'pct')) : '') + '</table><p class="muto">La parte non attribuita è consumo di base: macchine in attesa, servizi generali, fermi e sprechi. Con i dati per macchina del modulo produzione si potrà distinguere.</p></div>';
    if (a.anomalie.length) { h += '<div class="carta"><h3 style="margin-top:0">Consumi anomali</h3><div class="scorri"><table><tr><th></th><th>Consumo</th><th>Riferimento</th><th>Scarto</th><th>Costo</th></tr>';
      a.anomalie.forEach(function (x) { h += '<tr><td>' + esc(x.utenza.nome) + ' · ' + E.MESI[x.mese - 1] + '</td><td>' + nfx(x.consumo, 0) + '</td><td>' + nfx(x.riferimento, 0) + '</td><td class="giu">+' + fmt(x.scarto, 'pct') + '</td><td>' + eur(x.costo) + '</td></tr>'; });
      h += '</table></div><p class="muto">Riferimento: lo stesso mese dell\'anno precedente se disponibile, altrimenti la mediana dell\'anno. Un conguaglio in bolletta può apparire come anomalia.</p></div>'; }
    a.criticita.forEach(function (x) { h += '<div class="carta crit ' + x.gravita + '"><h3>' + esc(x.titolo) + '</h3><dl><div><dt>Dati</dt><dd>' + esc(x.dati) + '</dd></div><div><dt>Causa probabile</dt><dd>' + esc(x.causa) + '</dd></div><div><dt>Intervento</dt><dd>' + esc(x.intervento) + '</dd></div><div><dt>Quanto pesa</dt><dd>' + esc(x.effetto) + '</dd></div></dl></div>'; });
    return h;
  }

  function vBollette() {
    var D = d(); if (!D.utenze.length) return senza();
    var h = '<div class="riga">' + (T.scrivibile() ? '<button class="b p" data-a="enBolletta">Nuova bolletta</button>' : '') + '</div>';
    D.utenze.forEach(function (u) {
      var m = E.perMese(D, u.id, st.anno), info = E.VETTORI[u.vettore] || E.VETTORI.altro;
      h += '<div class="carta"><h3 style="margin-top:0">' + esc(u.nome) + ' <span class="muto">· ' + info.nome + '</span></h3>';
      var bb = D.bollette.filter(function (b) { return b.utenza === u.id && Number(b.anno) === st.anno; }).sort(function (x, y) { return x.mese - y.mese; });
      if (!bb.length) h += '<p class="muto">Nessuna bolletta nel ' + st.anno + '.</p>';
      else { h += '<div class="lista">'; bb.forEach(function (b) { var k = E.bolletta(b);
        h += '<button data-a="enBolletta" data-id="' + esc(b.id) + '"><span style="flex:1"><b>' + E.MESI[b.mese - 1] + ' ' + b.anno + '</b><br><span class="muto">' + (k.consumo === null ? 'consumo mancante' : nfx(k.consumo, 0) + ' ' + info.unita) + (k.dettaglio ? '' : ' · senza dettaglio') + '</span></span><span style="text-align:right">' + eur(k.totale) + (k.coerente ? '' : '<br><span class="tag rosso">non somma</span>') + '</span></button>'; });
        h += '</div>'; var manca = []; for (var i = 1; i <= 12; i++) if (!m[i]) manca.push(E.MESI[i - 1]); if (manca.length) h += '<p class="muto">Mesi mancanti: ' + manca.join(', ') + '.</p>'; }
      h += '</div>';
    });
    return h;
  }

  function vOfferte() {
    var a = analisi(), D = d();
    var h = '<div class="avviso info">Timone non cerca le offerte da solo: le inserisci tu, con fornitore, prezzo, fonte e data. Per trovarle puoi usare il Portale Offerte pubblico di ARERA o i preventivi dei fornitori. Il confronto è sul costo complessivo della parte che cambia con il fornitore, sugli stessi consumi delle bollette inserite.</div>' +
      (T.scrivibile() ? '<div class="riga"><button class="b p" data-a="enOfferta">Nuova offerta</button></div>' : '');
    if (!D.offerte.length) return h + '<p class="muto">Nessuna offerta inserita.</p>';
    if (!a.presente) return h + '<p class="muto">Servono le bollette del ' + st.anno + ' per fare il confronto.</p>';
    a.offerte.forEach(function (x) {
      var o = x.o, info = E.VETTORI[o.vettore];
      h += '<div class="carta" style="border-left:5px solid ' + (x.calcolabile ? (x.conviene ? 'var(--verde)' : 'var(--linea)') : 'var(--giallo)') + '"><div class="riga"><h3 style="margin:0">' + esc(o.fornitore || 'Fornitore') + ' · ' + esc(o.nome || '') + '</h3><span class="sp"></span>' + (T.scrivibile() ? '<button class="b p s" data-a="enOfferta" data-id="' + esc(o.id) + '">Modifica</button>' : '') + '</div>' +
        '<p class="muto">' + info.nome + ' · ' + (o.tipo === 'variabile' ? 'prezzo variabile' : 'prezzo fisso') + ' · ' + e3(o.prezzo) + ' per ' + info.unita + (o.fissoMese ? ' + ' + nfx(o.fissoMese, 2) + ' € al mese' : '') + (o.durataMesi ? ' · ' + o.durataMesi + ' mesi' : '') + '<br>Fonte: ' + esc(o.fonte || 'non indicata') + ' · rilevata il ' + dataIt(o.data) + '</p>';
      if (x.daRiverificare) h += '<div class="avviso">' + (x.eta === null ? 'Data di rilevazione mancante' : 'Offerta rilevata ' + x.eta + ' giorni fa') + ': i prezzi cambiano spesso, va riverificata alla fonte.</div>';
      if (o.tipo === 'variabile') h += '<div class="avviso">Prezzo indicizzato: il confronto usa il prezzo inserito oggi, che cambierà con il mercato.</div>';
      if (!x.calcolabile) h += '<div class="avviso">Confronto non calcolabile: le bollette non riportano la componente energia separata o mancano i consumi.</div>';
      else h += '<table>' + riga('Componente energia attuale', eur(x.attuale)) + riga('Con questa offerta, stessi consumi', eur(x.costo)) + riga('Differenza', '<span class="' + (x.risparmio >= 0 ? 'su' : 'giu') + '">' + eur(x.risparmio) + '</span>') + riga('Costi di cambio', eur(o.costiCambio || 0)) + riga('Penali del contratto in corso', eur(x.penali)) +
        riga(x.conviene ? 'Risparmio netto' : 'Maggior costo netto', eur(Math.abs(x.netto)), 1) + riga('Spesa complessiva: da → a', eur(x.totaleDopo + x.risparmio) + ' → ' + eur(x.totaleDopo)) + '</table><p class="muto">Trasporto, oneri e imposte restano uguali con qualsiasi fornitore.</p>';
      h += '</div>';
    });
    return h;
  }

  function vDati() {
    var D = d(), im = st.importEnergia;
    var h = '<div class="carta"><h3 style="margin-top:0">Utenze e contratti</h3>' + (D.utenze.length ? '<div class="lista">' + D.utenze.map(function (u) { var c = u.contratto || {};
      return '<button data-a="enUtenza" data-id="' + esc(u.id) + '"><span style="flex:1"><b>' + esc(u.nome) + '</b><br><span class="muto">' + (E.VETTORI[u.vettore] || E.VETTORI.altro).nome + ' · ' + (E.USI[u.uso] || E.USI.misto) + (c.fornitore ? ' · ' + esc(c.fornitore) : '') + (c.scadenza ? ' · scade il ' + dataIt(c.scadenza) : '') + '</span></span></button>'; }).join('') + '</div>' : '<p class="muto">Nessuna utenza.</p>') +
      (T.scrivibile() ? '<button class="b p s" style="margin-top:10px" data-a="enUtenza">Nuova utenza</button>' : '') + '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Importa le bollette</h3><p class="muto">File Excel o CSV con una riga per bolletta. Colonne: Utenza, Vettore, Anno, Mese, Consumo, F1, F2, F3, Potenza max, Materia, Trasporto, Oneri, Imposte, Totale (importi IVA esclusa). Le utenze non ancora presenti vengono create.</p>' +
      '<div class="riga"><button class="b p s" data-a="enModello">Scarica il modello</button>' + (T.scrivibile() ? '<label class="b p" style="cursor:pointer">Scegli file<input type="file" accept=".csv,.txt,.xlsx,.xls" data-c="enFile" hidden></label>' : '') + '</div>';
    if (im) { h += '<h3>Anteprima · ' + esc(im.nome) + '</h3>'; im.avvisi.forEach(function (x) { h += '<div class="avviso">' + esc(x) + '</div>'; });
      if (im.bollette.length) h += '<p>' + im.bollette.length + ' bollette, totale ' + eur(im.bollette.reduce(function (s, b) { return s + (E.bolletta(b).totale || 0); }, 0)) + '. Le bollette già presenti per la stessa utenza e lo stesso mese vengono sostituite.</p><div class="riga"><button class="b" data-a="enImporta">Importa</button><button class="b s" data-a="enAnnulla">Annulla</button></div>';
      else h += '<button class="b s" data-a="enAnnulla">Chiudi</button>'; }
    return h + '</div>';
  }

  function moduloUtenza(id) {
    var u = id ? d().utenze.filter(function (x) { return x.id === id; })[0] : { vettore: 'elettricita', uso: 'produzione', contratto: {} }, c = u.contratto || {};
    apri('<h3 style="margin-top:0">' + (id ? 'Modifica utenza' : 'Nuova utenza') + '</h3><div class="riga">' + campo('Nome (es. Stabilimento, Uffici)', 'enUNome', u.nome, '') + scelta('Tipo', 'enUVet', OPZ_VET, u.vettore) + scelta('Utilizzo', 'enUUso', OPZ_USO, u.uso) + '</div><h3>Contratto</h3><div class="riga">' +
      campo('Fornitore', 'enUFor', c.fornitore, '') + scelta('Prezzo', 'enUTipo', [['', '—'], ['fisso', 'Fisso'], ['variabile', 'Variabile']], c.tipo || '') + campo('Scadenza (gg/mm/aaaa)', 'enUSca', c.scadenza ? dataIt(c.scadenza) : '', '') + campo('Potenza impegnata (kW)', 'enUPot', nfx(c.potenza)) + campo('Penale di recesso (€)', 'enUPen', nfx(c.penale)) + '</div>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="enUtenzaElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="enUtenzaSalva" data-id="' + esc(id || '') + '">Salva</button></div>');
  }
  var CAMPI_B = [['consumo', 'Consumo'], ['materia', 'Energia o materia prima (€)'], ['trasporto', 'Trasporto e contatore (€)'], ['oneri', 'Oneri di sistema (€)'], ['imposte', 'Imposte e accise (€)'], ['totale', 'Totale IVA esclusa (€)'], ['f1', 'F1'], ['f2', 'F2'], ['f3', 'F3'], ['potenzaMax', 'Potenza massima prelevata (kW)']];
  function moduloBolletta(id) {
    var D = d(), b = id ? D.bollette.filter(function (x) { return x.id === id; })[0] : { anno: st.anno, utenza: D.utenze[0] && D.utenze[0].id };
    if (!D.utenze.length) { T.toast('Crea prima un\'utenza'); return; }
    apri('<h3 style="margin-top:0">' + (id ? 'Modifica bolletta' : 'Nuova bolletta') + '</h3><div class="riga">' + scelta('Utenza', 'enBUt', D.utenze.map(function (u) { return [u.id, u.nome]; }), b.utenza) + campo('Anno', 'enBAnno', b.anno, 'inputmode="numeric"') + scelta('Mese', 'enBMese', E.MESI.map(function (m, i) { return [i + 1, m]; }), b.mese || 1) +
      CAMPI_B.map(function (c) { return campo(c[1], 'enB_' + c[0], nfx(b[c[0]], 2)); }).join('') + '</div><p class="muto">Importi IVA esclusa. Se inserisci le quattro componenti devono sommare al totale; se lasci vuoto il totale viene calcolato da quelle.</p>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="enBollettaElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="enBollettaSalva" data-id="' + esc(id || '') + '">Salva</button></div>');
  }
  function moduloOfferta(id) {
    var o = id ? d().offerte.filter(function (x) { return x.id === id; })[0] : { vettore: 'elettricita', tipo: 'fisso', data: oggi() };
    apri('<h3 style="margin-top:0">' + (id ? 'Modifica offerta' : 'Nuova offerta') + '</h3><div class="riga">' + scelta('Tipo di fornitura', 'enOVet', OPZ_VET, o.vettore) + campo('Fornitore', 'enOFor', o.fornitore, '') + campo('Nome dell\'offerta', 'enONome', o.nome, '') + scelta('Prezzo', 'enOTipo', [['fisso', 'Fisso'], ['variabile', 'Variabile (indicizzato)']], o.tipo) +
      campo('Prezzo dell\'energia per unità (€, IVA esclusa)', 'enOPrezzo', nfx(o.prezzo, 5)) + campo('Quota fissa al mese (€)', 'enOFisso', nfx(o.fissoMese)) + campo('Durata (mesi)', 'enODur', nfx(o.durataMesi, 0)) + campo('Costi di cambio (€)', 'enOCambio', nfx(o.costiCambio)) + campo('Fonte (sito, preventivo, persona)', 'enOFonte', o.fonte, '') + campo('Data di rilevazione (gg/mm/aaaa)', 'enOData', o.data ? dataIt(o.data) : '', '') + '</div>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="enOffertaElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="enOffertaSalva" data-id="' + esc(id || '') + '">Salva</button></div>');
  }
  function nonSimulato(D) { if (D.simulato && ![D.utenze, D.bollette, D.offerte].some(function (l) { return l.some(function (x) { return x.origine === 'simulato'; }); })) delete D.simulato; }

  var azioni = {
    enSub: function (x) { st.subEnergia = x.sub; T.disegna(); },
    enUtenza: function (x) { if (x.id || T.scrivibile()) moduloUtenza(x.id); },
    enUtenzaSalva: function (x) {
      var D = d(), nome = testo('enUNome', 60); if (!nome) { T.toast('Serve un nome'); return; }
      var sca = testo('enUSca', 12), ds = sca ? dataDa(sca) : null; if (sca && !ds) { T.toast('Scadenza non valida: usa gg/mm/aaaa'); return; }
      var u = x.id ? D.utenze.filter(function (y) { return y.id === x.id; })[0] : { id: 'u' + Date.now().toString(36) };
      u.nome = nome; u.vettore = $('#enUVet').value; u.uso = $('#enUUso').value; u.origine = 'manuale';
      u.contratto = { fornitore: testo('enUFor', 60), tipo: $('#enUTipo').value || undefined, scadenza: ds || undefined, potenza: leggi('enUPot') === null ? undefined : leggi('enUPot'), penale: leggi('enUPen') === null ? undefined : leggi('enUPen') };
      if (!x.id) D.utenze.push(u); nonSimulato(D); T.salva(); T.chiudiDlg(); T.disegna();
    },
    enUtenzaElimina: function (x) { var D = d(), nb = D.bollette.filter(function (b) { return b.utenza === x.id; }).length;
      T.conferma('Eliminare questa utenza' + (nb ? ' e le sue ' + nb + ' bollette' : '') + '?', 'Elimina').then(function (si) { if (!si) return; st.az.energia.utenze = D.utenze.filter(function (u) { return u.id !== x.id; }); st.az.energia.bollette = D.bollette.filter(function (b) { return b.utenza !== x.id; }); T.salva(); T.disegna(); }); },
    enBolletta: function (x) { if (x.id || T.scrivibile()) moduloBolletta(x.id); },
    enBollettaSalva: function (x) {
      var D = d(), anno = parseInt($('#enBAnno').value, 10); if (!anno || anno < 1990 || anno > 2100) { T.toast('Anno non valido'); return; }
      var b = x.id ? D.bollette.filter(function (y) { return y.id === x.id; })[0] : { id: 'b' + Date.now().toString(36) };
      b.utenza = $('#enBUt').value; b.anno = anno; b.mese = Number($('#enBMese').value);
      CAMPI_B.forEach(function (c) { var v = leggi('enB_' + c[0]); if (v === null) delete b[c[0]]; else b[c[0]] = v; });
      var k = E.bolletta(b); if (k.totale === null) { T.toast('Serve il totale oppure le quattro componenti'); return; }
      b.origine = 'manuale'; if (!x.id) D.bollette.push(b); nonSimulato(D); T.salva(); T.chiudiDlg(); T.disegna(); T.toast(k.coerente ? 'Bolletta salvata' : 'Salvata, ma le componenti non sommano al totale');
    },
    enBollettaElimina: function (x) { T.conferma('Eliminare questa bolletta?', 'Elimina').then(function (si) { if (!si) return; st.az.energia.bollette = d().bollette.filter(function (b) { return b.id !== x.id; }); T.salva(); T.disegna(); }); },
    enOfferta: function (x) { if (x.id || T.scrivibile()) moduloOfferta(x.id); },
    enOffertaSalva: function (x) {
      var D = d(), prezzo = leggi('enOPrezzo'), dt = dataDa(testo('enOData', 12)), fornitore = testo('enOFor', 60);
      if (!fornitore || prezzo === null || prezzo < 0) { T.toast('Servono fornitore e prezzo'); return; }
      if (!dt) { T.toast('Serve la data di rilevazione (gg/mm/aaaa)'); return; }
      var o = x.id ? D.offerte.filter(function (y) { return y.id === x.id; })[0] : { id: 'o' + Date.now().toString(36) };
      o.vettore = $('#enOVet').value; o.fornitore = fornitore; o.nome = testo('enONome', 60); o.tipo = $('#enOTipo').value; o.prezzo = prezzo; o.fissoMese = leggi('enOFisso') || 0; o.durataMesi = leggi('enODur') || undefined; o.costiCambio = leggi('enOCambio') || 0; o.fonte = testo('enOFonte', 200); o.data = dt; o.origine = 'manuale';
      if (!x.id) D.offerte.push(o); nonSimulato(D); T.salva(); T.chiudiDlg(); T.disegna();
    },
    enOffertaElimina: function (x) { T.conferma('Eliminare questa offerta?', 'Elimina').then(function (si) { if (!si) return; st.az.energia.offerte = d().offerte.filter(function (o) { return o.id !== x.id; }); T.salva(); T.disegna(); }); },
    enModello: function () { T.scarica('timone-modello-bollette.csv', '﻿' + E.modelloCsv(), 'text/csv;charset=utf-8'); },
    enImporta: function () {
      var im = st.importEnergia, D = d(), chiave = function (b) { return b.utenza + '|' + b.anno + '|' + b.mese; }, nuove = {};
      im.bollette.forEach(function (b) { nuove[chiave(b)] = true; });
      D.utenze = D.utenze.concat(im.utenze); D.bollette = D.bollette.filter(function (b) { return !nuove[chiave(b)]; }).concat(im.bollette);
      st.az.energia.utenze = D.utenze; st.az.energia.bollette = D.bollette; nonSimulato(D);
      var anni = im.bollette.map(function (b) { return b.anno; }); st.importEnergia = null; st.subEnergia = 'sintesi';
      if (anni.indexOf(st.anno) < 0 && st.az.esercizi[Math.max.apply(null, anni)]) st.anno = Math.max.apply(null, anni);
      T.salva(); T.disegna(); T.toast(im.bollette.length + ' bollette importate');
    },
    enAnnulla: function () { st.importEnergia = null; T.disegna(); }
  };
  var cambi = { enFile: function (e) { var f = e.files[0]; if (!f) return; e.value = ''; T.tabellaDa(f).then(function (m) { var r = E.daTabella(m, T.numero, d().utenze); r.nome = f.name; st.importEnergia = r; T.disegna(); }).catch(function (x) { T.toast('File non letto: ' + x.message); }); } };

  T.registra({
    id: 'energia', titolo: 'Energia',
    descrizione: 'Bollette di elettricità, gas e acqua: consumi, costo unitario reale, composizione della spesa, mesi anomali, potenza impegnata, scadenze dei contratti e confronto con le offerte inserite.',
    vista: vista, azioni: azioni, cambi: cambi,
    criticita: function (az, anno) { return az.energia ? E.analisi(az, anno, T.nDi(anno), T.completo(anno, 'ce'), oggi()).criticita : []; },
    collaudo: function (az) { return az.energia ? E.collaudo(az) : []; },
    simula: function (az, seme) { var m = E.simula(az, seme); if (m.bollette.length) az.energia = m; }
  });
})();
