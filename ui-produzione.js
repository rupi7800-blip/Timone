/* Timone · interfaccia del modulo Produzione (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, P = window.Produzione;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };
  var SUB = [['sintesi', 'Sintesi'], ['macchine', 'Macchine'], ['registrazioni', 'Registrazioni'], ['dati', 'Importa e parametri']];
  var PERDITE = { disponibilita: 'Fermi e attrezzaggi', performance: 'Velocità sotto lo standard', qualita: 'Scarti' };

  function d() { if (!st.az.produzione) st.az.produzione = P.vuoto(); return P.dati(st.az); }
  function analisi() { return P.analisi(st.az, st.anno, T.nDi(st.anno), T.completo(st.anno, 'ce')); }
  function nfx(x, dec) { if (x === undefined || x === null) return ''; if (dec === 0) return nf0.format(Math.round(x)); var m = Math.pow(10, dec === undefined ? 2 : dec); return String(Math.round(x * m) / m).replace('.', ','); }
  function ore(x) { return x === null || x === undefined ? '—' : nf0.format(Math.round(x)) + ' h'; }
  function campo(et, id, val, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function scelta(et, id, opz, sel) { return '<div class="campo"><label for="' + id + '">' + et + '</label><select id="' + id + '">' + opz.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(sel) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function testo(id, n) { return document.getElementById(id).value.trim().slice(0, n); }
  function apri(html) { $('#dlgCorpo').innerHTML = html; if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0; }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td>' + v + '</td></tr>'; }
  function tagOee(v, ob) { return v === null ? '' : v < ob * 0.8 ? 'rosso' : v < ob ? 'giallo' : 'ok'; }

  function vista() {
    var sub = st.subProduzione || 'sintesi';
    var h = '<div class="riga"><h2 style="margin:0">Produzione</h2><span class="sp"></span>' + T.selAnno() + '</div>';
    h += '<div class="sub">' + SUB.map(function (s) { return '<button data-a="prSub" data-sub="' + s[0] + '" class="' + (sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (d().simulato) h += '<div class="avviso">Macchine e registrazioni simulate: servono a provare il modulo, non descrivono impianti reali.</div>';
    return h + ({ sintesi: vSintesi, macchine: vMacchine, registrazioni: vRegistrazioni, dati: vDati }[sub] || vSintesi)();
  }
  function senza() {
    return '<div class="carta"><p>Nessuna registrazione di produzione per il ' + st.anno + '.</p><p class="muto">Per ogni macchina e mese servono: ore disponibili, ore di fermo, di attrezzaggio e di manutenzione, pezzi prodotti e scartati, tempo ciclo standard. Di solito arrivano dai rapportini di produzione o dal sistema di fabbrica, in Excel o CSV.</p>' +
      '<div class="riga"><button class="b" data-a="prSub" data-sub="dati">Importa le registrazioni</button></div><p class="muto">Il modulo serve alle aziende che producono con macchine o impianti: se non è il tuo caso puoi disattivarlo dalle Impostazioni.</p></div>';
  }
  function barre(mesi, ob) {
    var W = 320, H = 120, lb = 18, passo = W / 12, base = H - 18, out = '', c = function (v) { return v < ob * 0.8 ? 'var(--rosso)' : v < ob ? '#e0a100' : 'var(--acc)'; };
    for (var m = 1; m <= 12; m++) { var x = (m - 1) * passo + (passo - lb) / 2, v = mesi[m] ? mesi[m].oee : null;
      out += (v !== null ? '<rect x="' + x + '" y="' + (base - Math.min(1, v) * (base - 6)) + '" width="' + lb + '" height="' + Math.max(1, Math.min(1, v) * (base - 6)) + '" rx="3" fill="' + c(v) + '"/>' : '<rect x="' + x + '" y="' + (base - 3) + '" width="' + lb + '" height="3" fill="var(--linea)"/>') + '<text x="' + (x + lb / 2) + '" y="' + (H - 4) + '" text-anchor="middle">' + P.MESI[m - 1][0].toUpperCase() + '</text>'; }
    var y = base - ob * (base - 6);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="OEE mensile"><line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="var(--muto)" stroke-dasharray="4 4"/>' + out + '</svg><p class="muto">OEE per mese; la linea tratteggiata è l\'obiettivo del ' + fmt(ob, 'pct') + '.</p>';
  }
  function tempi(a) {
    return '<table>' + riga('Ore disponibili (turni)', ore(a.disponibili)) + riga('− Manutenzione pianificata', ore(a.manutenzione)) + riga('= Ore pianificate', ore(a.pianificate), 1) + riga('− Fermi', ore(a.fermo) + ' · ' + fmt(a.quotaFermi, 'pct')) + riga('− Attrezzaggi', ore(a.attrezzaggio) + ' · ' + fmt(a.quotaAttrezzaggi, 'pct')) + riga('= Ore operative', ore(a.operative), 1) + '</table>';
  }

  function vSintesi() {
    var a = analisi(); if (!a.presente) return senza();
    var Tt = a.totale, ob = a.parametri.obiettivoOee, h = '';
    var tile = function (n, v, sotto, cls) { return '<button><div class="n">' + n + '</div><div class="v ' + (cls || '') + '">' + v + '</div><div class="d muto">' + (sotto || '') + '</div></button>'; };
    h += '<div class="kpi">' + tile('OEE dello stabilimento', fmt(Tt.oee, 'pct'), Tt.oee === null ? 'manca il tempo ciclo standard' : 'obiettivo ' + fmt(ob, 'pct'), Tt.oee !== null && Tt.oee < ob ? 'giu' : '') + tile('Disponibilità', fmt(Tt.disponibilita, 'pct'), 'ore operative su pianificate') +
      tile('Performance', fmt(Tt.performance, 'pct'), 'velocità rispetto allo standard') + tile('Qualità', fmt(Tt.qualita, 'pct'), nf0.format(Tt.scarti) + ' pezzi scartati') + tile('Pezzi buoni', nf0.format(Tt.buoni), Tt.pezziOra === null ? '' : nfx(Tt.pezziOra, 1) + ' per ora operativa') +
      tile('Costo dei fermi', a.costoFermi ? eur(a.costoFermi) : '—', a.costoFermi ? (a.costoFermiStimato ? 'stimato dal margine di bilancio' : 'dal costo orario inserito') + (a.costoFermiParziale ? ' · parziale' : '') : 'non calcolabile') + '</div>';
    if (a.orfane) h += '<div class="avviso rosso">' + a.orfane + ' registrazioni fanno riferimento a macchine eliminate e non sono conteggiate.</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Andamento</h3>' + barre(a.mesi, ob) + '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Dove va il tempo</h3>' + tempi(Tt) + (Tt.perditaPrincipale ? '<h3>Perdite in ore equivalenti</h3><table>' + ['disponibilita', 'performance', 'qualita'].map(function (k) { return riga(PERDITE[k] + (Tt.perditaPrincipale === k ? ' <span class="tag rosso">la maggiore</span>' : ''), Tt.perdite[k] === null ? 'non calcolabile' : ore(Tt.perdite[k]) + (a.margineOra ? ' · ' + eur(Tt.perdite[k] * a.margineOra) : '')); }).join('') + '</table>' +
      (a.margineOra ? '<p class="muto">Valore in euro: ore × margine di contribuzione per ora operativa (' + eur(a.margineOra) + ', stima dal bilancio). Vale solo se la produzione in più sarebbe venduta.</p>' : '') : '') + '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Per macchina</h3><div class="scorri"><table><tr><th></th><th>OEE</th><th>Disp.</th><th>Perf.</th><th>Qual.</th><th>Fermi</th></tr>';
    a.macchine.forEach(function (x) { var m = x.a; h += '<tr><td>' + esc(x.m.nome) + '</td><td><span class="tag ' + tagOee(m.oee, ob) + '">' + fmt(m.oee, 'pct') + '</span></td><td>' + fmt(m.disponibilita, 'pct') + '</td><td>' + fmt(m.performance, 'pct') + '</td><td>' + fmt(m.qualita, 'pct') + '</td><td>' + ore(m.fermo) + '</td></tr>'; });
    h += '</table></div><p class="muto">Dalla macchina con OEE più basso. Tocca “Macchine” per il dettaglio.</p></div>';
    var conC = a.macchine.filter(function (x) { return x.oreCommesse !== undefined; });
    if (conC.length || a.energia) { h += '<div class="carta"><h3 style="margin-top:0">Collegamenti con gli altri moduli</h3><table>';
      conC.forEach(function (x) { h += riga(esc(x.m.nome) + ': ore attribuite alle commesse', ore(x.oreCommesse) + ' su ' + ore(x.a.operative) + ' · ' + fmt(x.quotaCommesse, 'pct')); });
      if (a.energia) h += riga('kWh registrati sulle macchine', nfx(a.energia.kwhMacchine, 0) + ' su ' + nfx(a.energia.kwhBollette, 0) + ' delle bollette · ' + fmt(a.energia.quota, 'pct'));
      h += '</table><p class="muto">Le ore operative non attribuite a commesse sono produzione senza commessa o ore non rilevate. I kWh delle bollette non registrati sulle macchine sono servizi generali, impianti ausiliari e consumi a macchina ferma.</p></div>'; }
    a.criticita.forEach(function (x) { h += '<div class="carta crit ' + x.gravita + '"><h3>' + esc(x.titolo) + '</h3><dl><div><dt>Dati</dt><dd>' + esc(x.dati) + '</dd></div><div><dt>Causa probabile</dt><dd>' + esc(x.causa) + '</dd></div><div><dt>Intervento</dt><dd>' + esc(x.intervento) + '</dd></div><div><dt>Quanto pesa</dt><dd>' + esc(x.effetto) + '</dd></div></dl></div>'; });
    return h;
  }

  function vMacchine() {
    var D = d(), a = analisi(), ob = a.parametri.obiettivoOee, perId = {}; (a.macchine || []).forEach(function (x) { perId[x.m.id] = x; });
    var h = (T.scrivibile() ? '<div class="riga"><button class="b p" data-a="prMacchina">Nuova macchina</button></div>' : '');
    if (!D.macchine.length) return h + '<p class="muto">Nessuna macchina.</p>';
    D.macchine.forEach(function (m) {
      var x = perId[m.id];
      h += '<div class="carta"><div class="riga"><h3 style="margin:0">' + esc(m.nome) + (m.reparto ? ' <span class="muto">· ' + esc(m.reparto) + '</span>' : '') + '</h3><span class="sp"></span>' + (x ? '<span class="tag ' + tagOee(x.a.oee, ob) + '">OEE ' + fmt(x.a.oee, 'pct') + '</span>' : '') + (T.scrivibile() ? '<button class="b p s" data-a="prMacchina" data-id="' + esc(m.id) + '">Modifica</button>' : '') + '</div>';
      if (!x) { h += '<p class="muto">Nessuna registrazione nel ' + st.anno + '.</p></div>'; return; }
      var k = x.a;
      h += barre(x.mesi, ob) + tempi(k) + '<table>' + riga('Pezzi prodotti / scartati', nf0.format(k.pezzi) + ' / ' + nf0.format(k.scarti) + ' · ' + fmt(k.quotaScarti, 'pct')) + riga('Pezzi buoni per ora operativa', k.pezziOra === null ? '—' : nfx(k.pezziOra, 1)) +
        riga('Tempo ciclo: standard → effettivo', (k.cicloStandard === null ? '—' : nfx(k.cicloStandard, 1) + ' s') + ' → ' + (k.cicloEffettivo === null ? '—' : nfx(k.cicloEffettivo, 1) + ' s')) + riga('Energia per pezzo buono', k.kwhPezzo === null ? '—' : nfx(k.kwhPezzo, 3) + ' kWh') + riga('Energia per ora operativa', k.kwhOra === null ? '—' : nfx(k.kwhOra, 1) + ' kWh') +
        riga('Capacità utilizzata', x.saturazione === null ? 'capacità non indicata' : fmt(x.saturazione, 'pct')) + riga('Costo dei fermi' + (x.costoFermoOrigine ? ' <span class="tag ' + (x.costoFermoOrigine === 'stimato' ? 'giallo' : 'ok') + '">' + x.costoFermoOrigine + '</span>' : ''), x.costoFermo === null ? 'non calcolabile' : eur(x.costoFermo)) +
        riga('Costo dei pezzi scartati', k.scartiValorizzati ? eur(k.valoreScarti) : 'manca il valore per pezzo') + (x.oreCommesse !== undefined ? riga('Ore attribuite alle commesse', ore(x.oreCommesse) + ' · ' + fmt(x.quotaCommesse, 'pct')) : '') + '</table></div>';
    });
    return h;
  }

  function vRegistrazioni() {
    var D = d(); if (!D.macchine.length) return senza();
    var h = (T.scrivibile() ? '<div class="riga"><button class="b p" data-a="prReg">Nuova registrazione</button></div>' : '');
    D.macchine.forEach(function (m) {
      var rr = D.registrazioni.filter(function (r) { return r.macchina === m.id && Number(r.anno) === st.anno; }).sort(function (x, y) { return x.mese - y.mese; });
      h += '<div class="carta"><h3 style="margin-top:0">' + esc(m.nome) + '</h3>';
      if (!rr.length) h += '<p class="muto">Nessuna registrazione nel ' + st.anno + '.</p>';
      else { h += '<div class="lista">'; rr.forEach(function (r) { var k = P.aggrega([r]);
        h += '<button data-a="prReg" data-id="' + esc(r.id) + '"><span style="flex:1"><b>' + P.MESI[r.mese - 1] + ' ' + r.anno + '</b>' + (r.prodotto ? ' · ' + esc(r.prodotto) : '') + '<br><span class="muto">' + ore(k.operative) + ' operative · ' + nf0.format(k.pezzi) + ' pezzi' + (k.fermo ? ' · ' + ore(k.fermo) + ' di fermo' : '') + '</span></span><span style="text-align:right">' + (k.incoerenti ? '<span class="tag rosso">incoerente</span>' : k.oee === null ? '<span class="tag">senza ciclo</span>' : '<span class="tag">' + fmt(k.oee, 'pct') + '</span>') + '</span></button>'; }); h += '</div>'; }
      h += '</div>';
    });
    return h;
  }

  function vDati() {
    var D = d(), par = P.parametri(D), im = st.importProduzione;
    var h = '<div class="carta"><h3 style="margin-top:0">Importa le registrazioni</h3><p class="muto">File Excel o CSV con una riga per macchina e mese (anche più righe per prodotto). Colonne: Macchina, Anno, Mese, Prodotto, Commessa, Ore disponibili, Ore manutenzione, Ore fermo, Ore attrezzaggio, Pezzi prodotti, Pezzi scartati, Tempo ciclo (secondi per pezzo), kWh, Valore pezzo.</p>' +
      '<div class="riga"><button class="b p s" data-a="prModello">Scarica il modello</button>' + (T.scrivibile() ? '<label class="b p" style="cursor:pointer">Scegli file<input type="file" accept=".csv,.txt,.xlsx,.xls" data-c="prFile" hidden></label>' : '') + '</div>';
    if (im) { h += '<h3>Anteprima · ' + esc(im.nome) + '</h3>'; im.avvisi.forEach(function (x) { h += '<div class="avviso">' + esc(x) + '</div>'; });
      if (im.registrazioni.length) h += '<p>' + im.registrazioni.length + ' registrazioni. Quelle già presenti per le stesse macchine e gli stessi mesi vengono sostituite.</p><div class="riga"><button class="b" data-a="prImporta">Importa</button><button class="b s" data-a="prAnnulla">Annulla</button></div>';
      else h += '<button class="b s" data-a="prAnnulla">Chiudi</button>'; }
    h += '</div><div class="carta"><h3 style="margin-top:0">Parametri</h3><div class="riga">' + campo('Obiettivo di OEE (%)', 'prOb', nfx(par.obiettivoOee * 100, 1)) + campo('Soglia fermi (% del tempo pianificato)', 'prSF', nfx(par.sogliaFermi * 100, 1)) + campo('Soglia attrezzaggi (%)', 'prSA', nfx(par.sogliaAttrezzaggi * 100, 1)) + campo('Soglia scarti (%)', 'prSS', nfx(par.sogliaScarti * 100, 1)) + campo('Capacità utilizzata minima (%)', 'prSC', nfx(par.sogliaSaturazione * 100, 1)) + '</div>' +
      (T.scrivibile() ? '<button class="b p" style="margin-top:12px" data-a="prParametri">Salva parametri</button>' : '') + '<p class="muto">Obiettivo e soglie dipendono dal tipo di produzione: i valori iniziali sono generali e vanno adattati.</p></div>';
    return h;
  }

  function moduloMacchina(id) {
    var m = id ? d().macchine.filter(function (x) { return x.id === id; })[0] : {}, ris = ((st.az.commesse && st.az.commesse.risorse) || []).filter(function (x) { return x.tipo === 'macchina'; });
    apri('<h3 style="margin-top:0">' + (id ? 'Modifica macchina' : 'Nuova macchina') + '</h3><div class="riga">' + campo('Nome', 'prMNome', m.nome, '') + campo('Reparto', 'prMRep', m.reparto, '') + campo('Capacità: ore operative possibili al mese', 'prMCap', nfx(m.capacitaOreMese, 0)) + campo('Costo di un\'ora di fermo (€) · vuoto = stima dal bilancio', 'prMFermo', nfx(m.costoFermoOra)) +
      scelta('Macchina corrispondente nelle commesse', 'prMRis', [['', '— nessuna —']].concat(ris.map(function (x) { return [x.id, x.nome]; })), m.risorsaCommesse || '') + '</div>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="prMacchinaElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="prMacchinaSalva" data-id="' + esc(id || '') + '">Salva</button></div>');
  }
  var CAMPI = [['oreDisponibili', 'Ore disponibili (turni)'], ['oreManutenzione', 'Ore di manutenzione pianificata'], ['oreFermo', 'Ore di fermo'], ['oreAttrezzaggio', 'Ore di attrezzaggio'], ['pezziProdotti', 'Pezzi prodotti'], ['pezziScartati', 'Pezzi scartati'], ['tempoCiclo', 'Tempo ciclo standard (secondi per pezzo)'], ['kwh', 'kWh consumati'], ['valorePezzo', 'Costo diretto di un pezzo (€)']];
  function moduloReg(id) {
    var D = d(), r = id ? D.registrazioni.filter(function (x) { return x.id === id; })[0] : { anno: st.anno, macchina: D.macchine[0] && D.macchine[0].id };
    if (!D.macchine.length) { T.toast('Crea prima una macchina'); return; }
    apri('<h3 style="margin-top:0">' + (id ? 'Modifica registrazione' : 'Nuova registrazione') + '</h3><div class="riga">' + scelta('Macchina', 'prRMac', D.macchine.map(function (m) { return [m.id, m.nome]; }), r.macchina) + campo('Anno', 'prRAnno', r.anno, 'inputmode="numeric"') + scelta('Mese', 'prRMese', P.MESI.map(function (m, i) { return [i + 1, m]; }), r.mese || 1) +
      campo('Prodotto (facoltativo)', 'prRProd', r.prodotto, '') + CAMPI.map(function (c) { return campo(c[1], 'prR_' + c[0], nfx(r[c[0]], 2)); }).join('') + '</div>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="prRegElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="prRegSalva" data-id="' + esc(id || '') + '">Salva</button></div>');
  }
  function nonSimulato(D) { if (D.simulato && ![D.macchine, D.registrazioni].some(function (l) { return l.some(function (x) { return x.origine === 'simulato'; }); })) delete D.simulato; }

  var azioni = {
    prSub: function (x) { st.subProduzione = x.sub; T.disegna(); },
    prMacchina: function (x) { if (x.id || T.scrivibile()) moduloMacchina(x.id); },
    prMacchinaSalva: function (x) {
      var D = d(), nome = testo('prMNome', 60); if (!nome) { T.toast('Serve un nome'); return; }
      var m = x.id ? D.macchine.filter(function (y) { return y.id === x.id; })[0] : { id: 'k' + Date.now().toString(36) };
      m.nome = nome; m.reparto = testo('prMRep', 60); m.origine = 'manuale';
      var cap = leggi('prMCap'), cf = leggi('prMFermo'); if (cap === null) delete m.capacitaOreMese; else m.capacitaOreMese = cap; if (cf === null) delete m.costoFermoOra; else m.costoFermoOra = cf;
      var ris = $('#prMRis').value; if (ris) m.risorsaCommesse = ris; else delete m.risorsaCommesse;
      if (!x.id) D.macchine.push(m); nonSimulato(D); T.salva(); T.chiudiDlg(); T.disegna();
    },
    prMacchinaElimina: function (x) { var D = d(), nr = D.registrazioni.filter(function (r) { return r.macchina === x.id; }).length;
      T.conferma('Eliminare questa macchina' + (nr ? ' e le sue ' + nr + ' registrazioni' : '') + '?', 'Elimina').then(function (si) { if (!si) return; st.az.produzione.macchine = D.macchine.filter(function (m) { return m.id !== x.id; }); st.az.produzione.registrazioni = D.registrazioni.filter(function (r) { return r.macchina !== x.id; }); T.salva(); T.disegna(); }); },
    prReg: function (x) { if (x.id || T.scrivibile()) moduloReg(x.id); },
    prRegSalva: function (x) {
      var D = d(), anno = parseInt($('#prRAnno').value, 10), disp = leggi('prR_oreDisponibili');
      if (!anno || anno < 1990 || anno > 2100) { T.toast('Anno non valido'); return; }
      if (disp === null || disp < 0) { T.toast('Servono le ore disponibili'); return; }
      var r = x.id ? D.registrazioni.filter(function (y) { return y.id === x.id; })[0] : { id: 'g' + Date.now().toString(36) };
      r.macchina = $('#prRMac').value; r.anno = anno; r.mese = Number($('#prRMese').value); var pr = testo('prRProd', 60); if (pr) r.prodotto = pr; else delete r.prodotto;
      CAMPI.forEach(function (c) { var v = leggi('prR_' + c[0]); if (v === null) delete r[c[0]]; else r[c[0]] = v; });
      r.origine = 'manuale'; if (!x.id) D.registrazioni.push(r); nonSimulato(D);
      var k = P.aggrega([r]); T.salva(); T.chiudiDlg(); T.disegna(); T.toast(k.incoerenti ? 'Salvata, ma i dati sono incoerenti: controlla ore e scarti' : 'Registrazione salvata');
    },
    prRegElimina: function (x) { T.conferma('Eliminare questa registrazione?', 'Elimina').then(function (si) { if (!si) return; st.az.produzione.registrazioni = d().registrazioni.filter(function (r) { return r.id !== x.id; }); T.salva(); T.disegna(); }); },
    prModello: function () { T.scarica('timone-modello-produzione.csv', '﻿' + P.modelloCsv(), 'text/csv;charset=utf-8'); },
    prImporta: function () {
      var im = st.importProduzione, D = d(), chiave = function (r) { return r.macchina + '|' + r.anno + '|' + r.mese; }, nuove = {};
      im.registrazioni.forEach(function (r) { nuove[chiave(r)] = true; });
      st.az.produzione.macchine = D.macchine.concat(im.macchine); st.az.produzione.registrazioni = D.registrazioni.filter(function (r) { return !nuove[chiave(r)]; }).concat(im.registrazioni); nonSimulato(d());
      var anni = im.registrazioni.map(function (r) { return r.anno; }); st.importProduzione = null; st.subProduzione = 'sintesi';
      if (anni.indexOf(st.anno) < 0 && st.az.esercizi[Math.max.apply(null, anni)]) st.anno = Math.max.apply(null, anni);
      T.salva(); T.disegna(); T.toast(im.registrazioni.length + ' registrazioni importate');
    },
    prAnnulla: function () { st.importProduzione = null; T.disegna(); },
    prParametri: function () {
      var v = ['prOb', 'prSF', 'prSA', 'prSS', 'prSC'].map(leggi);
      if (v.some(function (x) { return x === null || x < 0 || x > 100; })) { T.toast('Valori non validi (percentuali tra 0 e 100)'); return; }
      d().parametri = { obiettivoOee: v[0] / 100, sogliaFermi: v[1] / 100, sogliaAttrezzaggi: v[2] / 100, sogliaScarti: v[3] / 100, sogliaSaturazione: v[4] / 100 }; T.salva(); T.disegna(); T.toast('Parametri salvati');
    }
  };
  var cambi = { prFile: function (e) { var f = e.files[0]; if (!f) return; e.value = ''; T.tabellaDa(f).then(function (m) { var r = P.daTabella(m, T.numero, d().macchine); r.nome = f.name; st.importProduzione = r; T.disegna(); }).catch(function (x) { T.toast('File non letto: ' + x.message); }); } };

  T.registra({
    id: 'produzione', titolo: 'Produzione',
    descrizione: 'Per le aziende con macchine o impianti: OEE, disponibilità, performance e qualità per macchina, fermi, attrezzaggi, scarti, produttività oraria, capacità utilizzata, confronto con commesse e bollette.',
    vista: vista, azioni: azioni, cambi: cambi,
    criticita: function (az, anno) { return az.produzione ? P.analisi(az, anno, T.nDi(anno), T.completo(anno, 'ce')).criticita : []; },
    collaudo: function (az) { return az.produzione ? P.collaudo(az) : []; },
    simula: function (az, seme) { var m = P.simula(az, seme); if (m.registrazioni.length) az.produzione = m; }
  });
})();
