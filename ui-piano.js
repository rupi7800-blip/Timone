/* Timone · interfaccia del modulo Piano pluriennale (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, P = window.Piano, F = window.Finanziamenti, M = window.Motore;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };

  function d() { if (!st.az.piano) st.az.piano = P.vuoto(); return P.dati(st.az); }
  function nfx(x, dec) { if (x === undefined || x === null) return ''; if (dec === 0) return nf0.format(Math.round(x)); var m = Math.pow(10, dec === undefined ? 2 : dec); return String(Math.round(x * m) / m).replace('.', ','); }
  function pc(x) { return x === undefined || x === null ? '' : nfx(x * 100, 2); }
  function pct(x) { return (x === null || x === undefined || !isFinite(x)) ? '—' : (x > 0 ? '+' : '') + nfx(x * 100, 1) + '%'; }
  function campo(et, id, v, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(v === undefined || v === null ? '' : v) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function scelta(et, id, opz, val) { return '<div class="campo"><label for="' + id + '">' + et + '</label><select id="' + id + '">' + opz.map(function (k) { return '<option value="' + k[0] + '"' + (String(val) === String(k[0]) ? ' selected' : '') + '>' + esc(k[1]) + '</option>'; }).join('') + '</select></div>'; }
  function area(et, id, v, ph) { return '<div class="campo" style="margin-top:8px"><label for="' + id + '">' + et + '</label><textarea id="' + id + '" rows="2" placeholder="' + esc(ph) + '" style="font:inherit;background:var(--carta);color:var(--ink);border:1px solid var(--linea);border-radius:9px;padding:8px 10px;width:100%">' + esc(v) + '</textarea></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td style="white-space:normal">' + v + '</td></tr>'; }
  function anniCompleti() { return T.anni().filter(function (y) { return T.completo(y); }); }

  /* Rimborsi dei debiti esistenti presi dai piani del modulo Finanziamenti, se quei piani spiegano i debiti di bilancio. */
  function opzDi(p) {
    var o = { rimborsi: null, nota: 'Debiti a lungo esistenti rimborsati in quote uguali in ' + Math.round((p.ip && p.ip.anniRimborso) || 5) + ' anni (ipotesi).' };
    if (!F || !st.az.finanziamenti || (p.ip && p.ip.usaFinanziamenti === false)) return o;
    var n = T.nDi(p.base); if (!n) return o;
    var a = F.analizza(st.az, p.base + '-12', null), atteso = (n.debiti_banche_lungo || 0) + (n.altri_debiti_fin || 0); if (!(a.residuo > 0)) return o;
    if (Math.abs(a.residuo - atteso) > Math.max(1000, atteso * 0.05)) { o.nota += ' I piani del modulo Finanziamenti non sono stati usati perché il loro debito residuo (' + eur(a.residuo) + ') non corrisponde ai debiti a lungo di bilancio (' + eur(atteso) + ').'; return o; }
    var r = []; for (var t = 1; t <= p.anni; t++) r.push(0);
    a.righe.forEach(function (x) { if (!x.piano || x.p.tipo !== 'mutuo' || x.p.finanziatore === 'Soci') return; x.piano.righe.forEach(function (q) { var k = Number(q.data.slice(0, 4)) - p.base; if (k >= 1 && k <= p.anni) r[k - 1] += q.capitale; }); });
    o.rimborsi = r; o.nota = 'Rimborsi dei debiti esistenti presi dai piani del modulo Finanziamenti.'; return o;
  }
  function calcola(p) { var o = opzDi(p), x = P.analizza(st.az, p, o); x.nota = o.nota; x.opz = o; return x; }
  function segnali(p, x) {
    var s = x.segnali, y = function (t) { return p.base + t; }, l = [];
    if (s.pnNegativo) l.push(['rosso', 'Patrimonio netto negativo dal ' + y(s.pnNegativo)]);
    if (s.copertura) l.push(['rosso', 'Rate non coperte dal margine nel ' + y(s.copertura)]);
    if (s.debito) l.push(['giallo', 'Debito oltre 5 volte l\'EBITDA dal ' + y(s.debito)]);
    if (s.perdita) l.push(['giallo', 'Perdita nel ' + y(s.perdita)]);
    if (x.sintesi.fabbisogno > 1) l.push(['giallo', 'Serve nuova finanza a breve dal ' + y(s.nuovaFinanza) + ': fino a ' + eur(x.sintesi.fabbisogno) + ' più di oggi']);
    return l;
  }

  function vista() {
    var D = d(), tutti = D.piani.map(function (p) { return { p: p, x: calcola(p) }; });
    if (st.piAperto) { var o = tutti.filter(function (k) { return k.p.id === st.piAperto && k.x.valido; })[0]; if (o) return dettaglio(o.p, o.x); st.piAperto = null; }
    var h = '<h2>Piano pluriennale</h2>';
    if (D.simulato) h += '<div class="avviso">Piani simulati: le ipotesi sono di fantasia e servono a provare il modulo.</div>';
    h += '<p class="muto">Dall\'ultimo bilancio completo proietta conto economico, stato patrimoniale e cassa fino a 10 anni, con le ipotesi che dichiari tu. Sono previsioni, non promesse: valgono quanto le ipotesi.</p>';
    if (!anniCompleti().length) return h + '<div class="avviso rosso">Serve almeno un esercizio con bilancio completo: il piano non parte da dati parziali.</div><button class="b" data-a="vai" data-scheda="bilancio" data-sub="dati">Completa il bilancio</button>';
    if (T.scrivibile()) h += '<div class="riga"><button class="b p" data-a="piNuovo">Nuovo piano</button></div>';
    if (!tutti.length) return h + '<div class="carta"><p>Nessun piano.</p><p class="muto">Crea un piano centrale con le ipotesi che ritieni più probabili: poi con un tocco puoi aggiungere le varianti prudenziale e favorevole.</p></div>';
    var val = tutti.filter(function (k) { return k.x.valido; });
    if (val.length > 1) h += '<div class="carta"><h3 style="margin-top:0">Piani a confronto</h3><div class="scorri"><table><tr><th></th><th>Ricavi finali</th><th>EBITDA finale</th><th>Utile cumulato</th><th>Debito netto finale</th><th>Nuova finanza</th></tr>' + val.map(function (k) { var s = k.x.sintesi; return '<tr><td>' + esc(k.p.nome) + '<br><span class="muto">' + k.p.base + ' → ' + (k.p.base + k.p.anni) + '</span></td><td>' + eur(s.ricaviFinali) + '</td><td class="' + (s.ebitdaFinale < 0 ? 'giu' : '') + '">' + eur(s.ebitdaFinale) + '</td><td class="' + (s.utileCumulato < 0 ? 'giu' : '') + '">' + eur(s.utileCumulato) + '</td><td>' + eur(s.pfnFinale) + '</td><td>' + (s.fabbisogno > 1 ? eur(s.fabbisogno) : '—') + '</td></tr>'; }).join('') + '</table></div></div>';
    tutti.forEach(function (k) { var p = k.p, x = k.x;
      h += '<div class="carta"><div class="riga"><h3 style="margin:0">' + esc(p.nome || 'Piano') + '</h3><span class="sp"></span><span class="tag">' + p.base + ' → ' + (p.base + p.anni) + '</span>' + (p.origine === 'simulato' ? '<span class="tag simulato">simulato</span>' : '') + '</div>';
      if (!x.valido) h += x.errori.map(function (m) { return '<div class="avviso rosso">' + esc(m) + '</div>'; }).join('');
      else { var s = x.sintesi, sg = segnali(p, x);
        h += '<table>' + riga('Ricavi: oggi → ' + (p.base + p.anni), eur(x.base.ricavi) + ' → ' + eur(s.ricaviFinali) + ' · ' + pct(s.crescitaMedia) + ' l\'anno') + riga('EBITDA: oggi → ' + (p.base + p.anni), eur(x.base.ebitda) + ' → <span class="' + (s.ebitdaFinale < 0 ? 'giu' : '') + '">' + eur(s.ebitdaFinale) + '</span>', 1) + riga('Debito netto: oggi → ' + (p.base + p.anni), eur(x.base.pfn) + ' → ' + eur(s.pfnFinale)) + '</table>' +
          (sg.length ? sg.map(function (q) { return '<div class="avviso ' + (q[0] === 'rosso' ? 'rosso' : '') + '">' + esc(q[1]) + '</div>'; }).join('') : '<div class="avviso ok">Nessun segnale di rischio con queste ipotesi.</div>'); }
      h += '<div class="riga" style="margin-top:8px">' + (x.valido ? '<button class="b p" data-a="piApri" data-id="' + esc(p.id) + '">Anno per anno</button>' : '') + (T.scrivibile() ? '<button class="b p s" data-a="piModifica" data-id="' + esc(p.id) + '">Ipotesi</button>' + (x.valido ? '<button class="b p s" data-a="piVarianti" data-id="' + esc(p.id) + '">Crea varianti</button>' : '') : '') + '</div></div>'; });
    return h;
  }

  function dettaglio(p, x) {
    var ip = x.ip, cols = [{ anno: p.base, r: x.base, n: x.n0, base: true }].concat(x.anni.map(function (a) { return { anno: p.base + a.t, r: a.r, n: a.n, a: a }; }));
    var h = '<div class="riga noprint"><button class="b p s" data-a="piChiudi">← Piani</button><span class="sp"></span>' + (T.scrivibile() ? '<button class="b p s" data-a="piModifica" data-id="' + esc(p.id) + '">Ipotesi</button>' : '') + '</div><h2>' + esc(p.nome) + ' · ' + p.base + ' → ' + (p.base + p.anni) + '</h2>';
    var sg = segnali(p, x); h += sg.length ? sg.map(function (q) { return '<div class="avviso ' + (q[0] === 'rosso' ? 'rosso' : '') + '">' + esc(q[1]) + '</div>'; }).join('') : '<div class="avviso ok">Nessun segnale di rischio con queste ipotesi.</div>';
    var tab = function (tit, righe) { return '<div class="carta"><h3 style="margin-top:0">' + tit + '</h3><div class="scorri"><table><tr><th></th>' + cols.map(function (c) { return '<th>' + c.anno + (c.base ? '' : ' <span class="tag">previsto</span>') + '</th>'; }).join('') + '</tr>' + righe.map(function (q) { return '<tr class="' + (q[2] ? 'tot' : '') + '"><td>' + q[0] + '</td>' + cols.map(function (c) { var v = q[1](c); return '<td class="' + (typeof v === 'number' && v < 0 && q[3] ? 'giu' : '') + '">' + (typeof v === 'number' ? (q[4] ? nfx(v, 2).replace(/^(-?\d+)$/, '$1,00') : eur(v)) : (v === null || v === undefined ? '—' : v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div></div>'; };
    h += tab('Conto economico', [['Ricavi', function (c) { return c.r.ricavi; }], ['Costi esterni', function (c) { return c.r.costi_esterni; }], ['Personale', function (c) { return c.r.personale; }], ['EBITDA', function (c) { return c.r.ebitda; }, 1, 1], ['Ammortamenti', function (c) { return c.r.ammortamenti_acc; }], ['EBIT', function (c) { return c.r.ebit; }, 0, 1], ['Interessi', function (c) { return c.n.oneri_fin; }], ['Imposte', function (c) { return c.r.imposte; }], ['Utile netto', function (c) { return c.r.utile; }, 1, 1]]);
    h += tab('Cassa e investimenti', [['Flusso della gestione operativa', function (c) { return c.a ? c.a.flussi.flusso_operativo : null; }, 0, 1], ['Investimenti', function (c) { return c.a ? c.a.investimenti : null; }], ['Rimborso dei debiti a lungo', function (c) { return c.a ? c.a.rimborsi : null; }], ['Nuovi finanziamenti', function (c) { return c.a ? c.a.erogati : null; }], ['Dividendi', function (c) { return c.a ? c.a.dividendi : null; }], ['Nuova finanza a breve (− = rimborso)', function (c) { return c.a ? c.a.nuovoBreve : null; }], ['Liquidità a fine anno', function (c) { return c.n.liquidita; }, 1]]);
    h += tab('Stato patrimoniale', [['Immobilizzazioni', function (c) { return c.r.immobilizzazioni; }], ['Scorte', function (c) { return c.n.rimanenze; }], ['Crediti verso clienti', function (c) { return c.n.crediti_clienti; }], ['Debiti verso fornitori', function (c) { return c.n.debiti_fornitori; }], ['Debiti bancari a breve', function (c) { return c.n.debiti_banche_breve; }], ['Debiti bancari a lungo', function (c) { return c.n.debiti_banche_lungo; }], ['Debito finanziario netto', function (c) { return c.r.pfn; }, 1], ['Patrimonio netto', function (c) { return c.r.patrimonio_netto; }, 1, 1]]);
    h += tab('Sostenibilità', [['Debito netto ÷ EBITDA', function (c) { return c.r.ebitda > 0 ? c.r.pfn / c.r.ebitda : null; }, 0, 0, 1], ['EBITDA ÷ rimborsi e interessi', function (c) { return c.a ? c.a.copertura : null; }, 0, 0, 1], ['EBITDA sui ricavi (%)', function (c) { return c.r.ricavi > 0 ? c.r.ebitda / c.r.ricavi * 100 : null; }, 0, 1, 1]]);
    var ob = st.piObiettivo, g = (ob !== undefined && ob !== null) ? P.crescitaPerUtile(x.n0, st.az.classificazione, p.anni, p.ip, x.opz, ob) : undefined;
    h += '<div class="carta"><h3 style="margin-top:0">Quanto devo crescere per un certo utile nel ' + (p.base + p.anni) + '?</h3><div class="riga">' + campo('Utile netto desiderato (€)', 'piUtile', ob === undefined || ob === null ? '' : nf0.format(ob)) + '<button class="b p" data-a="piObiettivo">Calcola</button></div>' +
      (g === undefined ? '' : g === null ? '<div class="avviso rosso">Non raggiungibile con una crescita dei volumi tra −50% e +100% l\'anno, a parità delle altre ipotesi.</div>' : '<div class="avviso info">Serve una crescita dei volumi del <b>' + pct(g) + ' l\'anno</b> (nel piano: ' + pct(ip.volumi) + '), ferme le altre ipotesi. Non sono considerati i limiti di capacità produttiva.</div>') + '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Ipotesi del piano</h3><table>' + riga('Volumi venduti', pct(ip.volumi) + ' l\'anno') + riga('Prezzi di vendita', pct(ip.prezzi) + ' l\'anno') + riga('Costo di materie · servizi · personale · altri', [ip.inflMaterie, ip.inflServizi, ip.inflPersonale, ip.inflAltri].map(pct).join(' · ')) +
      riga('Giorni di incasso · scorta · pagamento', [x.giorni.incasso, x.giorni.scorta, x.giorni.pagamento].map(function (v) { return v === null ? '—' : nfx(v, 0); }).join(' · ')) + riga('Dividendi', nfx(ip.dividendi * 100, 0) + '% dell\'utile') + riga('Liquidità minima', eur(ip.liquiditaMinima)) +
      riga('Investimenti', ip.investimenti.length ? ip.investimenti.map(function (i) { return (p.base + Math.round(i.anno)) + ': ' + eur(i.importo) + ' in ' + Math.round(i.vita || 5) + ' anni' + (i.descrizione ? ' (' + esc(i.descrizione) + ')' : ''); }).join('<br>') : 'nessuno') +
      riga('Nuovi finanziamenti', ip.finanziamenti.length ? ip.finanziamenti.map(function (i) { return (p.base + Math.round(i.anno)) + ': ' + eur(i.importo) + ' in ' + Math.round(i.durata || 5) + ' anni' + (i.tasso !== undefined && i.tasso !== null ? ' al ' + nfx(i.tasso * 100, 2) + '%' : ''); }).join('<br>') : 'nessuno') +
      (ip.aumenti.length ? riga('Aumenti di capitale', ip.aumenti.map(function (i) { return (p.base + Math.round(i.anno)) + ': ' + eur(i.importo); }).join('<br>')) : '') + riga('Imposte', nfx(x.aliquota * 100, 1) + '% del risultato positivo' + (x.aliquotaStimata ? ' (ipotesi)' : ' (aliquota effettiva ' + p.base + ')')) + riga('Tasso sui debiti esistenti', nfx(x.tasso * 100, 2) + '%' + (x.tassoStimato ? ' (ipotesi)' : ' (medio ' + p.base + ')')) + '</table>' +
      x.avvisi.map(function (m) { return '<div class="avviso">' + esc(m) + '</div>'; }).join('') + '<p class="muto">' + esc(x.nota) + '</p>' +
      '<p class="muto"><b>Come è calcolato.</b> I costi seguono i volumi per la quota variabile impostata nel Bilancio; scorte, crediti e fornitori seguono i giorni indicati; gli interessi di ogni anno sono calcolati sui debiti di inizio anno; le imposte si pagano nell\'anno. La liquidità è ciò che resta: se scende sotto il minimo il piano aggiunge debito bancario a breve, se avanza lo rimborsa. Il piano non separa la quota dei mutui in scadenza entro 12 mesi e non considera limiti di capacità produttiva, IVA, stagionalità.</p></div>';
    return h;
  }

  // ------------------------------------------------------------ modulo delle ipotesi
  var PERC = [['volumi', 'Volumi venduti (% l\'anno)'], ['prezzi', 'Prezzi di vendita (% l\'anno)'], ['inflMaterie', 'Costo delle materie (% l\'anno)'], ['inflServizi', 'Costo dei servizi, energia compresa (% l\'anno)'], ['inflPersonale', 'Costo del personale (% l\'anno)'], ['inflAltri', 'Affitti e altri costi (% l\'anno)'], ['dividendi', 'Dividendi (% dell\'utile dell\'anno prima)']];
  function righeDi(l, f) { return (l || []).map(f).join('\n'); }
  function modulo(id) {
    var ac = anniCompleti(), p = id ? d().piani.filter(function (x) { return x.id === id; })[0] : { base: ac[ac.length - 1], anni: 5, ip: {} }, ip = p.ip || {}, x = P.proietta(T.nDi(ac.indexOf(p.base) >= 0 ? p.base : ac[ac.length - 1]), st.az.classificazione, 1, {}), g = x.giorni;
    var h = '<h3 style="margin-top:0">' + (id ? 'Ipotesi del piano' : 'Nuovo piano') + '</h3><div class="riga">' + campo('Nome', 'piNome', p.nome || (id ? '' : 'Centrale'), '') + scelta('Bilancio di partenza', 'piBase', ac.map(function (y) { return [y, String(y)]; }), p.base) + scelta('Orizzonte', 'piAnni', P.ORIZZONTI.map(function (n) { return [n, n === 1 ? '1 anno' : n + ' anni']; }), p.anni) + '</div>' +
      '<h3>Vendite e costi</h3><div class="riga">' + PERC.map(function (f) { return campo(f[1], 'pi_' + f[0], pc(ip[f[0]] === undefined ? 0 : ip[f[0]])); }).join('') + '</div>' +
      '<h3>Capitale circolante e cassa</h3><div class="riga">' + campo('Giorni di incasso · oggi ' + (g.incasso === null ? '—' : nfx(g.incasso, 0)), 'pi_giorniIncasso', nfx(ip.giorniIncasso, 0)) + campo('Giorni di scorta · oggi ' + (g.scorta === null ? '—' : nfx(g.scorta, 0)), 'pi_giorniScorta', nfx(ip.giorniScorta, 0)) + campo('Giorni di pagamento · oggi ' + (g.pagamento === null ? '—' : nfx(g.pagamento, 0)), 'pi_giorniPagamento', nfx(ip.giorniPagamento, 0)) +
      campo('Liquidità minima da mantenere (€)', 'pi_liquiditaMinima', nfx(ip.liquiditaMinima, 0)) + campo('Anni per rimborsare i debiti a lungo esistenti', 'pi_anniRimborso', nfx(ip.anniRimborso === undefined ? 5 : ip.anniRimborso, 0)) + (F && st.az.finanziamenti ? scelta('Rimborsi dei debiti esistenti', 'piUsaFin', [['si', 'dai piani del modulo Finanziamenti'], ['no', 'in quote uguali']], ip.usaFinanziamenti === false ? 'no' : 'si') : '') + '</div><p class="muto">Giorni vuoti = restano quelli di oggi.</p>' +
      '<h3>Investimenti e finanza</h3>' + area('Investimenti: uno per riga · anno; importo; anni di ammortamento; descrizione', 'piInv', righeDi(ip.investimenti, function (i) { return (p.base + Math.round(i.anno)) + '; ' + nfx(i.importo, 0) + '; ' + Math.round(i.vita || 5) + (i.descrizione ? '; ' + i.descrizione : ''); }), (p.base + 1) + '; 150000; 8; Nuova linea') +
      area('Nuovi finanziamenti: uno per riga · anno; importo; durata in anni; tasso %', 'piFin', righeDi(ip.finanziamenti, function (i) { return (p.base + Math.round(i.anno)) + '; ' + nfx(i.importo, 0) + '; ' + Math.round(i.durata || 5) + (i.tasso !== undefined && i.tasso !== null ? '; ' + nfx(i.tasso * 100, 2) : ''); }), (p.base + 1) + '; 100000; 5; 5,5') +
      area('Aumenti di capitale: uno per riga · anno; importo', 'piAum', righeDi(ip.aumenti, function (i) { return (p.base + Math.round(i.anno)) + '; ' + nfx(i.importo, 0); }), (p.base + 2) + '; 50000') +
      '<p class="muto">Gli importi si scrivono senza punti delle migliaia oppure con il punto (150.000). I nuovi finanziamenti si rimborsano in quote uguali dall\'anno successivo all\'erogazione.</p>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="piElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="piSalva" data-id="' + esc(id || '') + '">Salva</button></div>';
    $('#dlgCorpo').innerHTML = h; if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0;
  }
  // righe "anno; importo; …": l'anno può essere quello di calendario oppure il numero d'ordine (1 = primo anno del piano)
  function righe(id, base, anni, fn) {
    var out = [], scarti = 0;
    $('#' + id).value.split('\n').forEach(function (l) { if (!l.trim()) return; var q = l.split(';').map(function (s) { return s.trim(); }), a = T.numero(q[0]), imp = T.numero(q[1] || ''); if (a === null || imp === null || !(imp > 0)) { scarti++; return; }
      a = Math.round(a > 1900 ? a - base : a); if (a < 1 || a > anni) { scarti++; return; } out.push(fn(a, imp, q)); });
    return { l: out.slice(0, 30), scarti: scarti };
  }

  var azioni = {
    piNuovo: function () { modulo(null); },
    piModifica: function (x) { modulo(x.id); },
    piApri: function (x) { st.piAperto = x.id; st.piObiettivo = undefined; T.disegna(); window.scrollTo(0, 0); },
    piChiudi: function () { st.piAperto = null; T.disegna(); },
    piObiettivo: function () { st.piObiettivo = leggi('piUtile'); var y = window.scrollY; T.disegna(); window.scrollTo(0, y); },
    piSalva: function (x) {
      var D = d(), nome = $('#piNome').value.trim().slice(0, 60); if (!nome) { T.toast('Serve un nome'); return; }
      var p = x.id ? D.piani.filter(function (y) { return y.id === x.id; })[0] : { id: 'p' + Date.now().toString(36) }, ip = {}, base = Number($('#piBase').value), anni = Number($('#piAnni').value);
      PERC.forEach(function (f) { var v = leggi('pi_' + f[0]); ip[f[0]] = v === null ? 0 : v / 100; });
      ['giorniIncasso', 'giorniScorta', 'giorniPagamento', 'liquiditaMinima', 'anniRimborso'].forEach(function (k) { var v = leggi('pi_' + k); if (v !== null && v >= 0) ip[k] = v; });
      if ($('#piUsaFin') && $('#piUsaFin').value === 'no') ip.usaFinanziamenti = false;
      var a = righe('piInv', base, anni, function (an, imp, q) { var o = { anno: an, importo: imp, vita: Math.max(1, Math.round(T.numero(q[2] || '') || 5)) }; if (q[3]) o.descrizione = q.slice(3).join('; ').slice(0, 80); return o; }),
        b = righe('piFin', base, anni, function (an, imp, q) { var o = { anno: an, importo: imp, durata: Math.max(1, Math.round(T.numero(q[2] || '') || 5)) }, t = T.numero(q[3] || ''); if (t !== null) o.tasso = Math.max(0, Math.min(50, t)) / 100; return o; }),
        c = righe('piAum', base, anni, function (an, imp) { return { anno: an, importo: imp }; });
      ip.investimenti = a.l; ip.finanziamenti = b.l; ip.aumenti = c.l;
      p.nome = nome; p.base = base; p.anni = anni; p.ip = ip; p.origine = 'manuale'; if (!x.id) D.piani.push(p);
      if (D.simulato && !D.piani.some(function (y) { return y.origine === 'simulato'; })) delete D.simulato;
      var scarti = a.scarti + b.scarti + c.scarti, err = P.valida(T.nDi(base), anni, ip); T.salva(); T.chiudiDlg(); T.disegna();
      T.toast(err.length ? err[0] : scarti ? 'Piano salvato, ma ' + scarti + ' righe non valide o fuori dal periodo sono state scartate' : 'Piano salvato');
    },
    piVarianti: function (x) {
      var D = d(), p = D.piani.filter(function (y) { return y.id === x.id; })[0]; if (!p) return;
      ['prudenziale', 'favorevole'].forEach(function (tp, k) { D.piani.push({ id: 'p' + Date.now().toString(36) + k, nome: p.nome + ' · ' + tp, base: p.base, anni: p.anni, ip: P.variante(p.ip, tp), origine: 'manuale' }); });
      T.salva(); T.disegna(); T.toast('Create le varianti: ±3 punti di volumi, ±1 punto di prezzi e di costi');
    },
    piElimina: function (x) { T.conferma('Eliminare questo piano?', 'Elimina').then(function (si) { if (!si) return; var D = d(); st.az.piano.piani = D.piani.filter(function (y) { return y.id !== x.id; }); if (D.simulato && !st.az.piano.piani.some(function (y) { return y.origine === 'simulato'; })) delete st.az.piano.simulato; if (st.piAperto === x.id) st.piAperto = null; T.salva(); T.chiudiDlg(); T.disegna(); }); }
  };

  T.registra({
    id: 'piano', titolo: 'Piano',
    descrizione: 'Pianificazione pluriennale: conto economico, stato patrimoniale e cassa previsti fino a 10 anni con ipotesi dichiarate, investimenti e finanziamenti; piani a confronto e segnali di rischio.',
    vista: vista, azioni: azioni,
    criticita: function (az, anno) { if (!az.piano) return []; var p = P.dati(az).piani.filter(function (y) { return y.base === anno; })[0]; if (!p) return []; var x = calcola(p); return x.valido ? P.criticita(p, x, eur) : []; },
    collaudo: function (az) { return az.piano ? P.collaudo(az) : []; },
    simula: function (az) { var m = P.simula(az); if (m.piani.length) az.piano = m; }
  });
})();
