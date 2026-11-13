/* Timone · interfaccia del modulo Commesse e marginalità (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, C = window.Commesse, M = window.Motore;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };
  var SUB = [['elenco', 'Commesse'], ['gruppi', 'Clienti e prodotti'], ['riconc', 'Riconciliazione'], ['risorse', 'Risorse e parametri']];

  function d() { if (!st.az.commesse) st.az.commesse = C.vuoto(); return C.dati(st.az); }
  function analisi() { var n = T.nDi(st.anno); return C.analisi(st.az, st.anno, n, T.completo(st.anno, 'ce')); }
  function nuovoId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function campo(et, id, val, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function nfx(x) { return x === undefined || x === null ? '' : String(x).replace('.', ','); }
  function tagMargine(p, soglia) { return p === null ? '' : p < 0 ? 'rosso' : p < soglia ? 'giallo' : 'ok'; }

  // ------------------------------------------------------------ viste
  function vista() {
    var sub = st.subCommesse || 'elenco';
    var h = '<div class="riga"><h2 style="margin:0">Commesse</h2><span class="sp"></span>' + T.selAnno() + '</div>';
    h += '<div class="sub">' + SUB.map(function (s) { return '<button data-a="cmSub" data-sub="' + s[0] + '" class="' + (sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (d().simulato) h += '<div class="avviso">Commesse simulate: servono a provare il modulo, non descrivono lavori reali.</div>';
    return h + ({ elenco: vElenco, gruppi: vGruppi, riconc: vRiconc, risorse: vRisorse }[sub] || vElenco)();
  }

  function vElenco() {
    var a = analisi(), Tt = a.totali, par = a.parametri, h = '';
    h += '<div class="riga">' + (T.scrivibile() ? '<button class="b p" data-a="cmNuova">Nuova commessa</button>' : '') + (a.righe.length ? '<button class="b p s" data-a="cmEsporta">Esporta CSV</button>' : '') + '</div>';
    if (!d().risorse.length) h += '<div class="avviso info">Per calcolare il costo del lavoro e delle macchine servono le risorse con il loro costo orario. <button class="b p s" data-a="cmSub" data-sub="risorse">Imposta le risorse</button></div>';
    if (!a.righe.length) return h + '<div class="carta"><p>Nessuna commessa per il ' + st.anno + '.</p><p class="muto">Una commessa raccoglie ricavo, materiali, ore di lavoro e di macchina, energia, lavorazioni esterne e trasporti di un ordine, di un progetto o di un incarico.</p></div>';
    if (!a.contabile) h += '<div class="avviso">Il conto economico ' + st.anno + ' manca o è incompleto: vedi solo il margine lordo (ricavo − costi diretti). I costi indiretti non vengono stimati.</div>';
    h += '<div class="kpi"><button><div class="n">Ricavi delle commesse</div><div class="v">' + eur(Tt.ricavi) + '</div></button><button><div class="n">Costi diretti</div><div class="v">' + eur(Tt.costoDiretto) + '</div></button>' +
      '<button><div class="n">Margine lordo</div><div class="v">' + eur(Tt.margineLordo) + '</div><div class="d muto">' + fmt(Tt.ricavi ? Tt.margineLordo / Tt.ricavi : null, 'pct') + '</div></button>' +
      (a.contabile ? '<button data-a="cmSub" data-sub="riconc"><div class="n">Costi indiretti ribaltati</div><div class="v">' + eur(a.indiretti) + '</div><div class="d muto">dal bilancio</div></button><button><div class="n">Margine operativo</div><div class="v">' + eur(a.margineOperativoTotale) + '</div><div class="d muto">' + fmt(Tt.ricavi ? a.margineOperativoTotale / Tt.ricavi : null, 'pct') + '</div></button>' : '') + '</div>';
    a.criticita.forEach(function (c) { h += '<div class="avviso ' + (c.gravita === 'rosso' ? 'rosso' : '') + '"><b>' + esc(c.titolo) + '.</b> ' + esc(c.effetto) + '</div>'; });
    var mrg = function (k) { return a.contabile ? k.margineOperativo : k.margineLordo; };
    var righe = a.righe.slice().sort(function (x, y) { return (mrg(x.k) / (x.k.ricavo || 1)) - (mrg(y.k) / (y.k.ricavo || 1)); });
    h += '<div class="carta"><p class="muto">Dalla meno redditizia. Tocca una commessa per la scheda completa.</p><div class="lista">';
    righe.forEach(function (x) {
      var p = x.k.ricavo ? mrg(x.k) / x.k.ricavo : null;
      h += '<button data-a="cmApri" data-id="' + esc(x.c.id) + '"><span style="flex:1;min-width:0"><b>' + esc(x.c.codice || '—') + '</b> ' + esc(x.c.cliente || '') + '<br><span class="muto">' + esc(x.c.prodotto || '') + ' · ricavo ' + eur(x.k.ricavo) + '</span></span>' +
        '<span style="text-align:right"><span class="tag ' + tagMargine(p, par.sogliaMargine) + '">' + fmt(p, 'pct') + '</span><br><span class="muto">' + eur(mrg(x.k)) + '</span></span></button>';
    });
    h += '</div><p class="muto">Margine ' + (a.contabile ? 'operativo: ricavo − costi diretti − quota di costi indiretti (' + esc(C.BASI[a.baseUsata].toLowerCase()) + ').' : 'lordo: ricavo − costi diretti.') + ' Soglia aziendale ' + fmt(par.sogliaMargine, 'pct') + '.</p></div>';
    return h;
  }

  function vGruppi() {
    var a = analisi();
    if (!a.righe.length) return '<p class="muto">Nessuna commessa per il ' + st.anno + '.</p>';
    function tab(titolo, righe) {
      var h = '<div class="carta"><h3 style="margin-top:0">' + titolo + '</h3><div class="scorri"><table><tr><th></th><th>Ricavi</th><th>Quota</th><th>Margine lordo</th>' + (a.contabile ? '<th>Margine operativo</th><th>%</th>' : '') + '<th>N.</th></tr>';
      righe.forEach(function (g) {
        h += '<tr><td>' + esc(g.nome) + '</td><td>' + eur(g.ricavi) + '</td><td>' + fmt(g.quota, 'pct') + '</td><td>' + fmt(g.margineLordoPct, 'pct') + '</td>' +
          (a.contabile ? '<td class="' + (g.margineOperativo < 0 ? 'giu' : '') + '">' + eur(g.margineOperativo) + '</td><td><span class="tag ' + tagMargine(g.margineOperativoPct, a.parametri.sogliaMargine) + '">' + fmt(g.margineOperativoPct, 'pct') + '</span></td>' : '') + '<td>' + g.commesse + '</td></tr>';
      });
      return h + '</table></div></div>';
    }
    var h = tab('Per cliente', a.clienti);
    var top3 = a.clienti.slice(0, 3).reduce(function (s, x) { return s + (x.quota || 0); }, 0);
    h += '<p class="muto">Il primo cliente vale ' + fmt(a.clienti[0].quota, 'pct') + ' dei ricavi delle commesse, i primi tre ' + fmt(top3, 'pct') + '.</p>';
    return h + tab('Per prodotto o servizio', a.prodotti) + '<p class="muto">Tempi di pagamento, frequenza degli ordini e rischio di perdita del cliente richiedono lo scadenziario e lo storico degli ordini: arriveranno con il modulo commerciale.</p>';
  }

  function vRiconc() {
    var a = analisi();
    var h = '<div class="avviso info">Il bilancio dice quanto si è speso in totale; le commesse dicono dove. Qui i due livelli vengono messi a confronto: ciò che non è attribuito a una commessa diventa costo indiretto e viene ribaltato, così nessun costo è contato due volte né dimenticato.</div>';
    if (!a.righe.length) return h + '<p class="muto">Nessuna commessa per il ' + st.anno + '.</p>';
    if (!a.contabile) return h + '<div class="avviso rosso">Riconciliazione non disponibile: il conto economico ' + st.anno + ' manca o è incompleto.</div><button class="b" data-a="vai" data-scheda="bilancio" data-sub="dati">Completa il bilancio</button>';
    h += '<div class="carta"><div class="scorri"><table><tr><th></th><th>Commesse</th><th>Bilancio</th><th>Non attribuito</th><th>Attribuito</th></tr>';
    a.riconciliazione.forEach(function (r) {
      h += '<tr><td>' + esc(r.voce) + (r.stato !== 'ok' ? ' <span class="tag ' + (r.stato === 'errore' ? 'rosso' : 'giallo') + '">' + (r.stato === 'errore' ? 'oltre il bilancio' : 'da verificare') + '</span>' : '') + '</td><td>' + eur(r.gestionale) + '</td><td>' + eur(r.contabile) + '</td><td>' + eur(r.differenza) + '</td><td>' + fmt(r.quota, 'pct') + '</td></tr>';
    });
    h += '</table></div>';
    a.riconciliazione.forEach(function (r) { h += '<p class="muto"><b>' + esc(r.voce) + '.</b> ' + esc(r.nota) + '</p>'; });
    h += '</div><div class="carta"><h3 style="margin-top:0">Dai costi di bilancio ai margini delle commesse</h3><table>' +
      '<tr><td>Costi operativi di bilancio (esterni, personale, ammortamenti)</td><td>' + eur(a.costiOperativi) + '</td></tr><tr><td>− Costi diretti attribuiti alle commesse</td><td>' + eur(a.totali.costoDiretto) + '</td></tr>' +
      '<tr class="tot"><td>= Costi indiretti da ribaltare</td><td>' + eur(a.indiretti) + '</td></tr><tr><td>Criterio</td><td style="white-space:normal">' + esc(C.BASI[a.baseUsata]) + '</td></tr>' +
      '<tr><td>Margine operativo delle commesse</td><td>' + eur(a.margineOperativoTotale) + '</td></tr><tr><td>+ Ricavi e proventi fuori commessa</td><td>' + eur(a.fuoriCommessa) + '</td></tr>' +
      '<tr class="tot"><td>= Risultato operativo (EBIT) di bilancio</td><td>' + eur(a.r.ebit) + '</td></tr><tr><td>Differenza non spiegata</td><td>' + eur(a.quadraturaEbit) + '</td></tr></table>' +
      '<p class="muto">Energia attribuita: ' + nf0.format(Math.round(a.totali.kwh)) + ' kWh, di cui ' + nf0.format(Math.round(a.totali.kwhStimati)) + ' stimati da potenza, fattore di carico e ore (non misurati).</p></div>';
    return h;
  }

  function vRisorse() {
    var D = d(), par = C.parametri(D), h = '<div class="carta"><h3 style="margin-top:0">Persone e reparti</h3><p class="muto">Costo orario aziendale pieno (retribuzione, contributi, TFR, ratei) diviso per le ore effettivamente lavorate.</p><div class="lista">';
    var pers = D.risorse.filter(function (r) { return r.tipo !== 'macchina'; }), mac = D.risorse.filter(function (r) { return r.tipo === 'macchina'; });
    pers.forEach(function (r) { h += '<button data-a="cmRisorsa" data-id="' + esc(r.id) + '"><span style="flex:1">' + esc(r.nome) + '</span><span class="muto">' + fmt(r.costoOrario, 'eur') + '/h</span></button>'; });
    h += '</div>' + (T.scrivibile() ? '<button class="b p s" style="margin-top:10px" data-a="cmRisorsa" data-tipo="persona">Aggiungi</button>' : '') + '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Macchine e impianti</h3><p class="muto">Costo orario (ammortamento e manutenzione) e potenza. Se per una lavorazione non inserisci i kWh misurati, il consumo viene stimato come potenza × fattore di carico × ore e resta etichettato “stimato”.</p><div class="lista">';
    mac.forEach(function (r) { h += '<button data-a="cmRisorsa" data-id="' + esc(r.id) + '"><span style="flex:1">' + esc(r.nome) + '</span><span class="muto">' + nfx(r.costoOrario) + ' €/h · ' + nfx(r.potenzaKw) + ' kW · carico ' + Math.round((r.fattoreCarico === undefined ? 1 : r.fattoreCarico) * 100) + '%</span></button>'; });
    h += '</div>' + (T.scrivibile() ? '<button class="b p s" style="margin-top:10px" data-a="cmRisorsa" data-tipo="macchina">Aggiungi</button>' : '') + '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Parametri</h3><div class="riga">' + campo('Prezzo dell\'energia (€/kWh, tutto compreso)', 'cmPrezzo', nfx(par.prezzoKwh)) + campo('Soglia minima di margine (%)', 'cmSoglia', nfx(Math.round(par.sogliaMargine * 1000) / 10)) +
      '<div class="campo"><label for="cmBase">Ribaltamento dei costi indiretti</label><select id="cmBase">' + Object.keys(C.BASI).map(function (k) { return '<option value="' + k + '"' + (par.base === k ? ' selected' : '') + '>' + C.BASI[k] + '</option>'; }).join('') + '</select></div></div>' +
      (T.scrivibile() ? '<button class="b p" style="margin-top:12px" data-a="cmParametri">Salva parametri</button>' : '') +
      '<p class="muto">Il criterio di ribaltamento è una scelta gestionale: cambia il margine operativo delle singole commesse, non il totale.</p></div>';
    return h;
  }

  // ------------------------------------------------------------ finestre
  function apri(html) { $('#dlgCorpo').innerHTML = html; if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0; }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td>' + v + '</td></tr>'; }

  function scheda(id) {
    var a = analisi(), x = a.righe.filter(function (r) { return r.c.id === id; })[0]; if (!x) return;
    var c = x.c, k = x.k, par = a.parametri;
    var h = '<h3 style="margin-top:0">' + esc(c.codice || 'Commessa') + ' · ' + esc(c.cliente || '') + '</h3><p class="muto">' + esc(c.prodotto || '') + ' · ' + c.anno + (c.origine === 'simulato' ? ' · <span class="tag simulato">simulato</span>' : '') + '</p><table>' +
      riga('Ricavo', eur(k.ricavo), 1) + riga('Materiali', eur(k.materiali)) + riga('Lavoro (' + nf0.format(k.oreLavoro) + ' h)', eur(k.lavoro)) + riga('Macchine (' + nf0.format(k.oreMacchina) + ' h)', eur(k.macchine)) +
      riga('Energia (' + nf0.format(Math.round(k.kwh)) + ' kWh) ' + (k.energiaOrigine === 'assente' ? '' : '<span class="tag ' + (k.energiaOrigine === 'misurata' ? 'ok' : 'giallo') + '">' + k.energiaOrigine + '</span>'), eur(k.energia)) +
      riga('Lavorazioni esterne', eur(k.esterni)) + riga('Trasporti', eur(k.trasporti)) + riga('Costo diretto', eur(k.costoDiretto), 1) + riga('Margine lordo', eur(k.margineLordo) + ' (' + fmt(k.margineLordoPct, 'pct') + ')') +
      (a.contabile ? riga('Quota di costi indiretti', eur(k.quotaIndiretti)) + riga('Margine operativo <span class="tag ' + tagMargine(k.margineOperativoPct, par.sogliaMargine) + '">' + fmt(k.margineOperativoPct, 'pct') + '</span>', eur(k.margineOperativo), 1) : '') + '</table>';
    if (k.preventivo !== null) h += '<h3>Preventivo e consuntivo</h3><table>' + riga('Costo diretto preventivato', eur(k.preventivo)) + riga('Costo diretto effettivo', eur(k.costoDiretto)) + riga('Scostamento', '<span class="' + (k.scostamento > 0 ? 'giu' : 'su') + '">' + eur(k.scostamento) + ' (' + fmt(k.scostamentoPct, 'pct') + ')</span>', 1) + '</table>';
    if (k.pezziBuoni > 0) {
      h += '<h3>Per unità</h3><table>' + riga('Quantità ordinata / prodotta / scartata', nf0.format(c.qOrdinata || 0) + ' / ' + nf0.format(c.qProdotta || 0) + ' / ' + nf0.format(c.qScartata || 0)) + riga('Scarto', fmt(k.scartoPct, 'pct') + ' · costo ' + eur(k.costoScarti)) +
        riga('Prezzo per unità buona', nfx(Math.round(k.prezzoUnitario * 1000) / 1000) + ' €') + riga('Costo diretto per unità', nfx(Math.round(k.costoUnitario * 1000) / 1000) + ' €') +
        (a.contabile ? riga('Costo pieno per unità (prezzo di pareggio)', nfx(Math.round(k.costoPienoUnitario * 1000) / 1000) + ' €', 1) + riga('Prezzo per un margine del ' + fmt(par.sogliaMargine, 'pct'), nfx(Math.round(k.costoPienoUnitario / (1 - par.sogliaMargine) * 1000) / 1000) + ' €') : '') +
        (k.kwhPezzo ? riga('Energia per unità', nfx(Math.round(k.kwhPezzo * 1000) / 1000) + ' kWh') : '') + '</table>';
      if (a.contabile) h += '<p class="muto">Il prezzo che copre i costi non è detto che sia accettato dal mercato: va confrontato con i prezzi dei concorrenti.</p>';
    }
    if (k.risorseMancanti) h += '<div class="avviso rosso">Alcune ore fanno riferimento a risorse eliminate: non sono state valorizzate.</div>';
    h += '<div class="riga" style="margin-top:14px">' + (T.scrivibile() ? '<button class="b p" data-a="cmModifica" data-id="' + esc(id) + '">Modifica</button><button class="b p peri" data-a="cmElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b p s" data-a="chiudi">Chiudi</button></div>';
    apri(h);
  }

  function modulo(id) {
    var D = d(), c = id ? D.elenco.filter(function (x) { return x.id === id; })[0] : { anno: st.anno, ore: [] };
    var ore = {}; (c.ore || []).forEach(function (o) { ore[o.risorsa] = o; });
    var h = '<h3 style="margin-top:0">' + (id ? 'Modifica commessa' : 'Nuova commessa') + '</h3><div class="riga">' + campo('Codice', 'cmCodice', c.codice, '') + campo('Anno', 'cmAnno', c.anno, 'inputmode="numeric"') + campo('Cliente', 'cmCliente', c.cliente, '') + campo('Prodotto o servizio', 'cmProdotto', c.prodotto, '') +
      campo('Ricavo (€)', 'cmRicavo', nfx(c.ricavo)) + campo('Costo diretto preventivato (€)', 'cmPrev', nfx(c.preventivo && c.preventivo.costo)) + '</div>' +
      '<h3>Quantità</h3><div class="riga">' + campo('Ordinata', 'cmQo', nfx(c.qOrdinata)) + campo('Prodotta', 'cmQp', nfx(c.qProdotta)) + campo('Scartata', 'cmQs', nfx(c.qScartata)) + '</div>' +
      '<h3>Costi diretti (€)</h3><div class="riga">' + campo('Materiali', 'cmMat', nfx(c.materiali)) + campo('Lavorazioni esterne', 'cmEst', nfx(c.esterni)) + campo('Trasporti', 'cmTra', nfx(c.trasporti)) + '</div><h3>Ore</h3>';
    if (!D.risorse.length) h += '<p class="muto">Nessuna risorsa definita: aggiungile in “Risorse e parametri” per registrare le ore.</p>';
    D.risorse.forEach(function (r, i) {
      var o = ore[r.id] || {};
      h += '<div class="riga">' + campo(esc(r.nome) + ' · ore', 'cmOre' + i, nfx(o.ore)) + (r.tipo === 'macchina' ? campo('kWh misurati (vuoto = stima)', 'cmKwh' + i, nfx(o.kwh)) : '') + '</div>';
    });
    h += '<div class="riga" style="margin-top:14px"><span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="cmSalva" data-id="' + esc(id || '') + '">Salva</button></div>';
    apri(h);
  }

  function moduloRisorsa(id, tipo) {
    var r = id ? d().risorse.filter(function (x) { return x.id === id; })[0] : { tipo: tipo };
    var mac = r.tipo === 'macchina';
    var h = '<h3 style="margin-top:0">' + (id ? esc(r.nome) : (mac ? 'Nuova macchina' : 'Nuova persona o reparto')) + '</h3><div class="riga">' + campo('Nome', 'cmRNome', r.nome, '') + campo(mac ? 'Costo orario: ammortamento e manutenzione (€/h)' : 'Costo orario aziendale (€/h)', 'cmRCosto', nfx(r.costoOrario)) +
      (mac ? campo('Potenza nominale (kW)', 'cmRKw', nfx(r.potenzaKw)) + campo('Fattore di carico (%)', 'cmRFc', nfx(r.fattoreCarico === undefined ? 100 : Math.round(r.fattoreCarico * 100))) : '') + '</div>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="cmRisorsaElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="cmRisorsaSalva" data-id="' + esc(id || '') + '" data-tipo="' + r.tipo + '">Salva</button></div>';
    apri(h);
  }

  // ------------------------------------------------------------ azioni
  var azioni = {
    cmSub: function (x) { st.subCommesse = x.sub; T.disegna(); },
    cmApri: function (x) { scheda(x.id); },
    cmNuova: function () { modulo(null); },
    cmModifica: function (x) { modulo(x.id); },
    cmSalva: function (x) {
      var D = d(), anno = parseInt(document.getElementById('cmAnno').value, 10), ricavo = leggi('cmRicavo');
      if (!anno || anno < 1990 || anno > 2100) { T.toast('Anno non valido'); return; }
      if (ricavo === null) { T.toast('Inserisci il ricavo (anche 0)'); return; }
      var txt = function (id) { return document.getElementById(id).value.trim().slice(0, 120); };
      var c = x.id ? D.elenco.filter(function (y) { return y.id === x.id; })[0] : { id: nuovoId('c') };
      c.codice = txt('cmCodice'); c.anno = anno; c.cliente = txt('cmCliente'); c.prodotto = txt('cmProdotto'); c.ricavo = ricavo; c.stato = c.stato || 'chiusa';
      [['materiali', 'cmMat'], ['esterni', 'cmEst'], ['trasporti', 'cmTra'], ['qOrdinata', 'cmQo'], ['qProdotta', 'cmQp'], ['qScartata', 'cmQs']].forEach(function (p) { var v = leggi(p[1]); if (v === null) delete c[p[0]]; else c[p[0]] = v; });
      var prev = leggi('cmPrev'); if (prev === null) delete c.preventivo; else c.preventivo = { costo: prev };
      c.ore = [];
      D.risorse.forEach(function (r, i) {
        var ore = leggi('cmOre' + i), kwh = r.tipo === 'macchina' ? leggi('cmKwh' + i) : null;
        if (ore === null && kwh === null) return;
        var o = { risorsa: r.id, ore: ore || 0 }; if (kwh !== null) o.kwh = kwh; c.ore.push(o);
      });
      c.origine = 'manuale'; c.aggiornato = new Date().toISOString();
      if (!x.id) D.elenco.push(c);
      if (D.simulato && !D.elenco.some(function (y) { return y.origine === 'simulato'; })) delete D.simulato;
      T.salva(); T.chiudiDlg(); st.anno = st.az.esercizi[anno] ? anno : st.anno; T.disegna(); T.toast('Commessa salvata');
    },
    cmElimina: function (x) {
      T.conferma('Eliminare questa commessa?', 'Elimina').then(function (si) { if (!si) return; var D = d(); D.elenco = D.elenco.filter(function (y) { return y.id !== x.id; }); st.az.commesse.elenco = D.elenco; T.salva(); T.disegna(); });
    },
    cmRisorsa: function (x) { if (x.id || T.scrivibile()) moduloRisorsa(x.id, x.tipo); },
    cmRisorsaSalva: function (x) {
      var D = d(), nome = document.getElementById('cmRNome').value.trim().slice(0, 80), costo = leggi('cmRCosto');
      if (!nome || costo === null || costo < 0) { T.toast('Servono nome e costo orario'); return; }
      var r = x.id ? D.risorse.filter(function (y) { return y.id === x.id; })[0] : { id: nuovoId('r'), tipo: x.tipo };
      r.nome = nome; r.costoOrario = costo;
      if (r.tipo === 'macchina') { r.potenzaKw = leggi('cmRKw') || 0; var fc = leggi('cmRFc'); r.fattoreCarico = fc === null ? 1 : Math.max(0, Math.min(100, fc)) / 100; }
      if (!x.id) D.risorse.push(r);
      T.salva(); T.chiudiDlg(); T.disegna();
    },
    cmRisorsaElimina: function (x) {
      var D = d(), usata = D.elenco.filter(function (c) { return (c.ore || []).some(function (o) { return o.risorsa === x.id; }); }).length;
      T.conferma(usata ? 'Questa risorsa è usata in ' + usata + ' commesse: eliminandola, quelle ore non saranno più valorizzate. Eliminare?' : 'Eliminare questa risorsa?', 'Elimina').then(function (si) {
        if (!si) return; st.az.commesse.risorse = D.risorse.filter(function (y) { return y.id !== x.id; }); T.salva(); T.disegna();
      });
    },
    cmParametri: function () {
      var D = d(), p = leggi('cmPrezzo'), s = leggi('cmSoglia');
      if (p === null || p < 0 || s === null) { T.toast('Valori non validi'); return; }
      D.parametri = Object.assign({}, D.parametri, { prezzoKwh: p, sogliaMargine: s / 100, base: document.getElementById('cmBase').value });
      st.az.commesse.parametri = D.parametri; T.salva(); T.disegna(); T.toast('Parametri salvati');
    },
    cmEsporta: function () {
      var a = analisi(), out = ['Codice;Cliente;Prodotto;Ricavo;Materiali;Lavoro;Macchine;Energia;Esterni;Trasporti;Costo diretto;Margine lordo;Quota indiretti;Margine operativo'];
      a.righe.forEach(function (x) { var k = x.k; out.push([x.c.codice, x.c.cliente, x.c.prodotto].map(function (t) { return String(t || '').replace(/;/g, ','); }).concat([k.ricavo, k.materiali, k.lavoro, k.macchine, k.energia, k.esterni, k.trasporti, k.costoDiretto, k.margineLordo, a.contabile ? k.quotaIndiretti : '', a.contabile ? k.margineOperativo : ''].map(function (v) { return v === '' ? '' : String(Math.round(v * 100) / 100).replace('.', ','); })).join(';')); });
      T.scarica('timone-commesse-' + st.anno + '.csv', '﻿' + out.join('\r\n'), 'text/csv;charset=utf-8');
    }
  };

  T.registra({
    id: 'commesse', titolo: 'Commesse',
    descrizione: 'Costo e margine di ogni commessa, ordine o incarico; costi indiretti dal bilancio; analisi per cliente e prodotto; riconciliazione con la contabilità.',
    vista: vista, azioni: azioni,
    criticita: function (az, anno) { if (!az.commesse || !C.dati(az).elenco.length) return []; var n = T.nDi(anno); return C.analisi(az, anno, n, T.completo(anno, 'ce')).criticita; },
    collaudo: function (az) { return az.commesse ? C.collaudo(az) : []; },
    simula: function (az, seme) { az.commesse = C.simula(az, seme); }
  });
})();
