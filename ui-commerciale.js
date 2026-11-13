/* Timone · interfaccia del modulo Sviluppo commerciale e clienti (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, C = window.Commerciale;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };
  var MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  function d() { if (!st.az.commerciale) st.az.commerciale = C.vuoto(); return C.dati(st.az); }
  function nfx(x, dec) { if (x === undefined || x === null) return ''; if (dec === 0) return nf0.format(Math.round(x)); var m = Math.pow(10, dec === undefined ? 2 : dec); return String(Math.round(x * m) / m).replace('.', ','); }
  function pct(x) { return (x === null || x === undefined || !isFinite(x)) ? '—' : fmt(x, 'pct'); }
  function mese(ym) { var p = String(ym || '').split('-'); return p.length < 2 ? '' : MESI[Number(p[1]) - 1] + ' ' + p[0]; }
  function campo(et, id, val, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function campoM(et, id, val) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="month" id="' + id + '" value="' + esc(val || '') + '" style="font:inherit;background:var(--carta);color:var(--ink);border:1px solid var(--linea);border-radius:9px;padding:8px 10px;max-width:100%"></div>'; }
  function scelta(et, id, opz, val) { return '<div class="campo"><label for="' + id + '">' + et + '</label><select id="' + id + '">' + Object.keys(opz).map(function (k) { return '<option value="' + k + '"' + (String(val) === k ? ' selected' : '') + '>' + esc(opz[k]) + '</option>'; }).join('') + '</select></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function testo(id, max) { var e = document.getElementById(id); return e ? String(e.value).trim().slice(0, max || 120) : ''; }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td style="white-space:normal">' + v + '</td></tr>'; }
  function metti(o, k, v) { if (v === null || v === '') delete o[k]; else o[k] = v; }
  function oggiYm() { var D = d(); if (D.simulato && D.oggiSimulato) return D.oggiSimulato; var x = new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 101).slice(1); }

  function anni() { return C.anniDi(st.az); }
  function annoScelto() { var a = anni(); if (a.indexOf(Number(st.comAnno)) < 0) st.comAnno = a.length ? a[a.length - 1] : null; return st.comAnno; }
  function bilDi(anno) { return (anno && T.nDi(anno)) ? { n: T.nDi(anno), classificazione: st.az.classificazione, ceOk: T.completo(anno, 'ce') } : null; }
  function quadro(anno) { return C.analizza(st.az, anno, bilDi(anno)); }
  function trattative(a) { return C.analizzaTrattative(st.az, oggiYm(), a ? a.settoriForti : []); }
  function tagStato(c) { var m = { nuovo: 'ok', 'in crescita': 'ok', 'in calo': 'rosso' }; return (c.fermo ? '<span class="tag rosso">fermo da ' + c.mesiFermo + ' mesi</span> ' : '') + (c.stato !== 'attivo' && c.stato !== 'stabile' ? '<span class="tag ' + (m[c.stato] || '') + '">' + c.stato + '</span>' : ''); }

  var SUB = [['sintesi', 'Sintesi'], ['clienti', 'Clienti'], ['segmenti', 'Dove rendi di più'], ['trattative', 'Trattative'], ['dati', 'Dati']];
  function vista() {
    var anno = annoScelto(), sub = st.comSub || 'sintesi', a = anno ? quadro(anno) : null;
    if (st.comCliente && a) { var c = a.clienti.concat(a.persi).filter(function (x) { return x.key === st.comCliente; })[0]; if (c) return dettaglio(a, c); st.comCliente = null; }
    var h = '<div class="riga"><h2 style="margin:0">Commerciale</h2><span class="sp"></span>' + (anni().length ? '<select data-c="coAnno" aria-label="Anno">' + anni().map(function (y) { return '<option' + (y === anno ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' : '') + '</div>';
    if (d().simulato) h += '<div class="avviso">Clienti, vendite e trattative simulati: sono di fantasia e servono a provare il modulo.</div>';
    h += '<div class="sub">' + SUB.map(function (x) { return '<button data-a="coSub" data-sub="' + x[0] + '" class="' + (sub === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (sub === 'trattative') return h + vistaTrattative(a);
    if (sub === 'dati') return h + vistaDati(a);
    if (!a || !a.clienti.length) return h + '<div class="carta"><p>Nessuna vendita registrata.</p><p class="muto">Importa le vendite per cliente e per mese (dal gestionale o dal registro delle fatture, senza IVA) dalla scheda Dati: il modulo calcola quote, margini, clienti nuovi, persi e a rischio, e i segmenti in cui l\'azienda rende di più.</p><button class="b p" data-a="coSub" data-sub="dati">Vai ai dati</button></div>';
    return h + a.avvisi.map(function (m) { return '<div class="avviso">' + esc(m) + '</div>'; }).join('') + (sub === 'clienti' ? vistaClienti(a) : sub === 'segmenti' ? vistaSegmenti(a) : vistaSintesi(a));
  }

  function grafico(a) {
    var W = 320, H = 130, base = H - 18, max = Math.max.apply(null, a.mesi.concat(a.mesiPrec).concat([1])), passo = W / 12, lb = passo * 0.34, out = '';
    for (var m = 0; m < 12; m++) { var x = m * passo + passo * 0.12;
      if (a.precPresente) out += '<rect x="' + x + '" y="' + (base - a.mesiPrec[m] / max * (base - 6)) + '" width="' + lb + '" height="' + Math.max(0.5, a.mesiPrec[m] / max * (base - 6)) + '" rx="2" fill="var(--linea)"/>';
      out += '<rect x="' + (x + lb + 1) + '" y="' + (base - a.mesi[m] / max * (base - 6)) + '" width="' + lb + '" height="' + Math.max(0.5, a.mesi[m] / max * (base - 6)) + '" rx="2" fill="var(--acc)"/><text x="' + (x + lb) + '" y="' + (H - 4) + '" text-anchor="middle">' + MESI[m][0].toUpperCase() + '</text>'; }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Vendite per mese"><line x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '" stroke="var(--linea)"/>' + out + '</svg><div class="leg">' + (a.precPresente ? '<span><i style="background:var(--linea)"></i>' + (a.anno - 1) + '</span>' : '') + '<span><i style="background:var(--acc)"></i>' + a.anno + '</span></div>';
  }
  function vistaSintesi(a) {
    var b = a.bilancio, mv = a.mov, h = '<div class="carta"><h3 style="margin-top:0">Vendite ' + a.anno + '</h3><table>' + riga('Ricavi registrati', eur(a.ricavi) + (mv && mv.variazione !== null ? ' · <span class="' + (mv.variazione >= 0 ? 'su' : 'giu') + '">' + (mv.variazione >= 0 ? '+' : '') + pct(mv.variazione) + '</span> sul ' + (a.anno - 1) : ''), 1) + riga('Clienti attivi', nf0.format(a.clienti.length)) +
      riga('Margine sui costi diretti', a.margine === null ? 'non calcolabile' : eur(a.margine) + ' · ' + pct(a.marginePct)) + riga('Primo cliente', pct(a.top1) + ' dei ricavi · ' + esc(a.clienti[0].nome)) + riga('Primi tre clienti', pct(a.top3)) + '</table>' +
      (b ? '<p class="muto">Ricavi di bilancio ' + a.anno + ': ' + eur(b.ricavi) + ' · differenza ' + eur(b.differenza) + (Math.abs(b.differenza) > Math.abs(b.ricavi) * 0.05 ? ' <span class="giu">(oltre il 5%: vendite incomplete o con IVA?)</span>' : '') + '</p>' : '<p class="muto">Nessun bilancio ' + a.anno + ' con cui confrontare le vendite.</p>') + '</div>';
    if (mv) h += '<div class="carta"><h3 style="margin-top:0">Rispetto al ' + (a.anno - 1) + '</h3><table>' + riga('Clienti mantenuti', mv.mantenuti + ' su ' + mv.clientiPrec + ' · ' + pct(mv.mantenimentoClienti)) + riga('Ricavi dai clienti già presenti', eur(mv.ricaviMantenuti) + ' · ' + pct(mv.mantenimentoRicavi) + ' dei ricavi ' + (a.anno - 1), 1) +
      riga('Clienti nuovi', mv.nuovi + ' · ' + eur(mv.ricaviNuovi)) + riga('Clienti persi', mv.persi + ' · valevano ' + eur(mv.ricaviPersi)) + riga('A rischio di perdita', a.aRischio.length + ' · ' + eur(a.ricaviARischio) + ' di ricavi ' + a.anno) + '</table>' +
      '<p class="muto">«A rischio»: clienti con ricavi in calo di almeno il ' + Math.round(a.P.caloForte * 100) + '% oppure che compravano con regolarità e non acquistano da almeno ' + a.P.mesiFermo + ' mesi. È un segnale dai numeri, non una previsione: la causa va chiesta al cliente.</p>' +
      '<div class="riga"><button class="b p s" data-a="coFiltro" data-f="rischio">Vedi i clienti a rischio</button><button class="b p s" data-a="coFiltro" data-f="persi">Vedi i clienti persi</button></div></div>';
    h += '<div class="carta"><h3 style="margin-top:0">Vendite per mese</h3>' + grafico(a) + '</div>';
    if (a.pagamenti) { var p = a.pagamenti;
      h += '<div class="carta"><h3 style="margin-top:0">Tempi di pagamento</h3><table>' + riga('Giorni medi di incasso', nfx(p.giorniMedi, 0) + ' giorni') + riga('Ritardo medio sui termini concordati', p.ritardoMedio === null ? '—' : nfx(p.ritardoMedio, 0) + ' giorni') + riga('Costo finanziario del ritardo (stima)', eur(p.costoRitardo) + ' l\'anno', 1) + '</table><div class="scorri"><table><tr><th>Cliente</th><th>Concordati</th><th>Effettivi</th><th>Ritardo</th><th>Costo</th></tr>' +
        p.righe.slice(0, 8).map(function (x) { return '<tr><td>' + esc(x.c.nome) + '</td><td>' + (x.concordati === null ? '—' : x.concordati) + '</td><td>' + x.effettivi + '</td><td class="' + (x.ritardo > 0 ? 'giu' : '') + '">' + (x.ritardo === null ? '—' : x.ritardo) + '</td><td>' + eur(x.costo) + '</td></tr>'; }).join('') + '</table></div>' +
        '<p class="muto">Giorni inseriti da te nella scheda di ogni cliente (coprono il ' + pct(p.copertura) + ' dei ricavi). Costo = ricavi × giorni di ritardo ÷ 365 × ' + pct(a.P.costoCapitale) + ' di costo del capitale. Non è uno scadenziario: non mostra le singole fatture.</p></div>'; }
    else h += '<p class="muto">Per analizzare i tempi di pagamento indica i giorni concordati ed effettivi nella scheda dei clienti principali.</p>';
    var mg = a.marginePct !== null ? a.marginePct : (b && b.mcPct !== undefined ? b.mcPct : null), sc = st.comSconto, rs = sc ? C.sconto(mg, sc) : null;
    h += '<div class="carta"><h3 style="margin-top:0">Quanto costa uno sconto?</h3>' + (mg === null ? '<p class="muto">Serve il margine: indica i costi diretti delle vendite o completa il conto economico.</p>' :
      '<p class="muto">Margine usato: ' + pct(mg) + (a.marginePct !== null ? ' (dai costi diretti delle vendite)' : ' (margine di contribuzione medio di bilancio: stima)') + '.</p><div class="riga">' + campo('Sconto sul prezzo (%)', 'coSconto', sc ? nfx(sc * 100, 1) : '') + '<button class="b p" data-a="coSconta">Calcola</button></div>' +
      (rs ? (rs.possibile ? '<div class="avviso info">Con uno sconto del ' + pct(sc) + ' il margine scende al ' + pct(rs.margineDopo) + ': per guadagnare quanto prima bisogna vendere il <b>' + pct(rs.volume) + ' in più</b> di volume.</div>' : '<div class="avviso rosso">Uno sconto del ' + pct(sc) + ' azzera o supera il margine (' + pct(mg) + '): nessun aumento di volume lo recupera.</div>') : '')) + '</div>';
    return h;
  }

  var FILTRI = { tutti: 'Tutti', rischio: 'A rischio', nuovi: 'Nuovi', persi: 'Persi', perdita: 'Sotto costo' };
  function vistaClienti(a) {
    var f = FILTRI[st.comFiltro] ? st.comFiltro : 'tutti', el = f === 'rischio' ? a.aRischio : f === 'nuovi' ? a.clienti.filter(function (c) { return c.stato === 'nuovo'; }) : f === 'persi' ? a.persi : f === 'perdita' ? a.inPerdita : a.clienti;
    var h = '<div class="sub">' + Object.keys(FILTRI).map(function (k) { return '<button data-a="coFiltro" data-f="' + k + '" class="' + (f === k ? 'on' : '') + '">' + FILTRI[k] + '</button>'; }).join('') + '</div>';
    if (!el.length) return h + '<div class="carta"><p class="muto">Nessun cliente in questo elenco.</p></div>';
    h += '<div class="carta"><div class="scorri"><table><tr><th>Cliente</th><th>Ricavi ' + (f === 'persi' ? a.anno - 1 : a.anno) + '</th>' + (f === 'persi' ? '' : '<th>Quota</th><th>Classe</th><th>Margine</th><th>Sul ' + (a.anno - 1) + '</th>') + '</tr>';
    el.forEach(function (c) { h += '<tr><td><button data-a="coCliente" data-k="' + esc(c.key) + '" style="background:none;border:0;padding:0;font:inherit;color:var(--acc);text-align:left;cursor:pointer">' + esc(c.nome) + '</button><br>' + (f === 'persi' ? '<span class="tag rosso">perso</span>' : tagStato(c)) + '</td><td>' + eur(f === 'persi' ? c.ricaviPrec : c.ricavi) + '</td>' +
      (f === 'persi' ? '' : '<td>' + pct(c.quota) + '</td><td>' + c.abc + '</td><td class="' + (c.margine !== null && c.margine < 0 ? 'giu' : '') + '">' + (c.marginePct === null ? '—' : pct(c.marginePct)) + '</td><td class="' + (c.variazione !== null && c.variazione < 0 ? 'giu' : 'su') + '">' + (c.variazione === null ? '—' : (c.variazione >= 0 ? '+' : '') + pct(c.variazione)) + '</td>') + '</tr>'; });
    return h + '</table></div><p class="muto">Classe A: i clienti che insieme fanno l\'80% dei ricavi; B il successivo 15%; C il resto. Tocca un cliente per la sua scheda.</p></div>';
  }

  function tabSeg(tit, l, col) {
    return '<div class="carta"><h3 style="margin-top:0">' + tit + '</h3><div class="scorri"><table><tr><th>' + col + '</th><th>Ricavi</th><th>Quota</th>' + (l[0].clienti !== undefined ? '<th>Clienti</th>' : '') + '<th>Margine</th></tr>' + l.map(function (s) { return '<tr><td>' + esc(s.nome) + '</td><td>' + eur(s.ricavi) + '</td><td>' + pct(s.quota) + '</td>' + (s.clienti !== undefined ? '<td>' + s.clienti + '</td>' : '') + '<td class="' + (s.margine !== null && s.margine < 0 ? 'giu' : '') + '">' + (s.marginePct === null ? '—' : pct(s.marginePct)) + '</td></tr>'; }).join('') + '</table></div></div>';
  }
  function vistaSegmenti(a) {
    var h = '<div class="carta"><h3 style="margin-top:0">Dove cercare nuovi clienti</h3>';
    if (a.settoriForti.length) h += '<p>Dai tuoi numeri i settori in cui rendi di più sono: <b>' + a.settoriForti.map(esc).join(', ') + '</b> (' + (a.marginePct !== null ? 'margine sopra la tua media del ' + pct(a.marginePct) : 'ricavo medio per cliente sopra la media') + ', con almeno due clienti).</p>';
    else h += '<p class="muto">' + (a.settori.length === 1 && a.settori[0].nome === 'Non indicato' ? 'Indica il settore dei clienti (nel file delle vendite o nella scheda cliente) per vedere dove rendi di più.' : 'Nessun settore con almeno due clienti rende più della media: i dati non indicano una direzione chiara.') + '</p>';
    h += '<p class="muto">Timone non cerca nominativi e non ne propone: cerca aziende simili in fonti verificabili (registro delle imprese, associazioni di categoria, fiere, segnalazioni dei clienti) e registrale tra le <b>Trattative</b> indicando la fonte. Un settore che rende oggi non garantisce che renda con clienti nuovi.</p><button class="b p s" data-a="coSub" data-sub="trattative">Vai alle trattative</button></div>';
    return h + tabSeg('Per settore del cliente', a.settori, 'Settore') + tabSeg('Per zona', a.zone, 'Zona') + tabSeg('Per famiglia di prodotto', a.famiglie, 'Famiglia') + '<p class="muto">Margine = ricavi meno costi diretti indicati nelle vendite; «—» dove i costi mancano.</p>';
  }

  function dettaglio(a, c) {
    var perso = !(c.ricavi > 0), an = c.ana || {}, h = '<div class="riga noprint"><button class="b p s" data-a="coChiudi">← Clienti</button><span class="sp"></span>' + (T.scrivibile() ? '<button class="b p s" data-a="coAnagrafica" data-k="' + esc(c.key) + '">Modifica scheda</button>' : '') + '</div><h2>' + esc(c.nome) + '</h2><p>' + (perso ? '<span class="tag rosso">perso nel ' + a.anno + '</span>' : tagStato(c)) + ' <span class="muto">' + esc([an.settore, an.zona].filter(Boolean).join(' · ')) + '</span></p>';
    h += '<div class="carta"><table>' + riga('Ricavi ' + a.anno, eur(c.ricavi) + (perso ? '' : ' · ' + pct(c.quota) + ' del totale · classe ' + c.abc), 1) + riga('Ricavi ' + (a.anno - 1), a.precPresente ? eur(c.ricaviPrec) + (c.variazione !== null && !perso ? ' · ' + (c.variazione >= 0 ? '+' : '') + pct(c.variazione) : '') : 'nessun dato');
    if (!perso) h += riga('Margine sui costi diretti', c.margine === null ? 'costi non indicati' : '<span class="' + (c.margine < 0 ? 'giu' : '') + '">' + eur(c.margine) + ' · ' + pct(c.marginePct) + '</span>') + (c.ordini ? riga('Ordini · ordine medio', nf0.format(c.ordini) + ' · ' + eur(c.ordineMedio)) : '') + (a.mensile ? riga('Mesi con acquisti', c.mesiAttivi + ' su 12' + (c.ultimo !== null ? ' · ultimo: ' + MESI[c.ultimo] : '')) : '');
    h += riga('Pagamento: concordato / effettivo', (an.ggConcordati === undefined ? '—' : an.ggConcordati + ' gg') + ' / ' + (an.ggEffettivi === undefined ? '—' : an.ggEffettivi + ' gg')) + '</table></div>';
    if (!perso) {
      var p = C.perdita(a, c.key);
      h += '<div class="carta"><h3 style="margin-top:0">E se lo perdessi?</h3><table>' + riga('Ricavi in meno', eur(p.ricavi)) + riga('Margine in meno', p.margine === null ? 'non calcolabile: mancano i costi diretti e il bilancio' : eur(p.margine) + (p.stimato ? ' <span class="tag giallo">stima</span>' : ''), 1) +
        (p.ebitdaDopo !== undefined ? riga('EBITDA ' + a.anno + ': oggi → senza il cliente', eur(p.ebitda) + ' → <span class="' + (p.ebitdaDopo < 0 ? 'giu' : '') + '">' + eur(p.ebitdaDopo) + '</span>') : '') + (p.top1Dopo !== null ? riga('Peso del primo cliente dopo', pct(p.top1Dopo)) : '') + '</table>' +
        '<p class="muto">' + (p.stimato ? 'Margine stimato con il margine di contribuzione medio di bilancio, perché i costi diretti di questo cliente non sono indicati. ' : '') + 'Ipotesi: i costi fissi restano invariati e il volume non viene sostituito da altri clienti.</p></div>';
      var fam = Object.keys(c.famiglie); if (fam.length > 1 || fam[0] !== 'Non indicata') h += '<div class="carta"><h3 style="margin-top:0">Cosa compra</h3><table>' + fam.sort(function (x, y) { return c.famiglie[y].ricavi - c.famiglie[x].ricavi; }).map(function (k) { return riga(esc(k), eur(c.famiglie[k].ricavi)); }).join('') + '</table></div>';
    }
    return h;
  }

  function vistaTrattative(a) {
    var tr = trattative(a), h = '<p class="muto">Le opportunità di vendita in corso, con valore stimato, fase e fonte del contatto. Il valore ponderato (valore × probabilità) è una previsione, non un ordine.</p>' + (T.scrivibile() ? '<div class="riga"><button class="b p" data-a="coTrNuova">Nuova trattativa</button></div>' : '');
    if (!tr.righe.length) return h + '<div class="carta"><p>Nessuna trattativa registrata.</p></div>';
    h += '<div class="carta"><table>' + riga('Trattative aperte', tr.aperte + ' · di cui ' + tr.nuovi + ' con clienti nuovi') + riga('Valore totale', eur(tr.valore)) + riga('Valore ponderato <span class="tag">previsto</span>', eur(tr.ponderato), 1) +
      riga('Tasso di successo', tr.successo === null ? 'servono almeno ' + C.PARAM.minChiuse + ' trattative chiuse (ora ' + tr.chiuse + ')' : pct(tr.successo) + ' per numero · ' + pct(tr.successoValore) + ' per valore (' + tr.vinte + ' vinte, ' + tr.perse + ' perse)') + '</table>' +
      (tr.scadute ? '<div class="avviso">' + tr.scadute + (tr.scadute === 1 ? ' trattativa ha' : ' trattative hanno') + ' la chiusura prevista già passata.</div>' : '') + (tr.senzaFonte ? '<div class="avviso">' + tr.senzaFonte + ' senza fonte del contatto.</div>' : '') +
      '<div class="scorri"><table><tr><th>Fase</th><th>N.</th><th>Valore</th><th>Ponderato</th></tr>' + ['contatto', 'qualificata', 'offerta', 'negoziazione'].map(function (f) { var x = tr.fasi[f]; return '<tr><td>' + C.FASI[f] + '</td><td>' + x.n + '</td><td>' + eur(x.valore) + '</td><td>' + eur(x.ponderato) + '</td></tr>'; }).join('') + '</table></div>' +
      (tr.perMese.length ? '<h3>Chiusure previste</h3><table>' + tr.perMese.map(function (m) { return riga(mese(m.mese), eur(m.ponderato)); }).join('') + '</table>' : '') +
      '<p class="muto">Dove la probabilità non è indicata si usa quella predefinita della fase (' + ['contatto', 'qualificata', 'offerta', 'negoziazione'].map(function (f) { return Math.round(C.PROB_FASE[f] * 100) + '%'; }).join(', ') + '): è un\'ipotesi generale, non una statistica della tua azienda.</p></div>';
    var ord = { negoziazione: 0, offerta: 1, qualificata: 2, contatto: 3, vinta: 4, persa: 5 };
    tr.righe.slice().sort(function (x, y) { return ord[x.fase] - ord[y.fase] || y.valore - x.valore; }).forEach(function (x) { var t = x.t;
      h += '<div class="carta"><div class="riga"><b>' + esc(t.nome || 'Trattativa') + '</b><span class="sp"></span><span class="tag ' + (x.fase === 'vinta' ? 'ok' : x.fase === 'persa' ? 'rosso' : '') + '">' + C.FASI[x.fase] + '</span>' + (t.origine === 'simulato' ? '<span class="tag simulato">simulato</span>' : '') + '</div>' +
        '<p class="muto">' + eur(x.valore) + (x.aperta ? ' × ' + Math.round(x.prob * 100) + '%' + (x.probPredefinita ? ' (predefinita)' : '') + ' = ' + eur(x.ponderato) + (t.chiusura ? ' · chiusura ' + mese(t.chiusura) : '') : '') + (t.settore ? ' · ' + esc(t.settore) : '') + (x.segmentoForte ? ' <span class="tag ok">settore in cui rendi di più</span>' : '') + (t.fonte ? '<br>Fonte: ' + esc(t.fonte) : '') + '</p>' +
        x.avvisi.map(function (m) { return '<div class="avviso">' + esc(m) + '</div>'; }).join('') + (T.scrivibile() ? '<button class="b p s" data-a="coTrModifica" data-id="' + esc(t.id) + '">Modifica</button>' : '') + '</div>'; });
    return h;
  }

  function vistaDati(a) {
    var D = d(), im = st.comImport, h = '<div class="carta"><h3 style="margin-top:0">Importa le vendite da Excel o CSV</h3><p class="muto">Una riga per cliente e per mese (o per fattura): cliente, periodo, ricavi senza IVA e, se li hai, costo diretto, numero di ordini, famiglia di prodotto, settore e zona del cliente. Gli anni presenti nel file sostituiscono quelli già registrati.</p>' +
      '<div class="riga"><button class="b p s" data-a="coModello">Scarica il modello</button>' + (T.scrivibile() ? '<label class="b p" style="cursor:pointer">Scegli file<input type="file" accept=".csv,.txt,.xlsx,.xls" data-c="coFile" hidden></label>' : '') + '</div></div>';
    if (im) { h += '<div class="carta" id="coAnteprima"><h3 style="margin-top:0">Anteprima · ' + esc(im.nome) + '</h3>' + im.avvisi.map(function (m) { return '<div class="avviso">' + esc(m) + '</div>'; }).join('');
      if (im.vendite.length) h += '<p>' + im.vendite.length + ' righe · ' + im.clienti.length + ' clienti · anni ' + im.anni.join(', ') + ' · totale ' + eur(im.vendite.reduce(function (t, v) { return t + v.ricavi; }, 0)) + '</p><div class="riga"><button class="b" data-a="coImporta">Importa</button><button class="b s" data-a="coAnnulla">Annulla</button></div>'; else h += '<button class="b s" data-a="coAnnulla">Chiudi</button>';
      h += '</div>'; }
    h += '<div class="carta"><h3 style="margin-top:0">Dati registrati</h3>';
    if (!D.vendite.length) h += '<p class="muto">Nessuna vendita.</p>';
    else h += '<table>' + anni().map(function (y) { var q = quadro(y); return riga(String(y), eur(q.ricavi) + ' · ' + q.clienti.length + ' clienti' + (T.scrivibile() ? ' <button class="b p peri" data-a="coEliminaAnno" data-y="' + y + '">Elimina</button>' : '')); }).join('') + '</table>';
    h += (T.scrivibile() ? '<div class="riga" style="margin-top:10px"><button class="b p s" data-a="coVendita">Aggiungi una vendita a mano</button></div>' : '') + '</div>';
    return h;
  }

  // ------------------------------------------------------------ moduli di inserimento
  function apri(h) { $('#dlgCorpo').innerHTML = h; if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0; }
  function bottoni(elimina, salva, id) { return '<div class="riga" style="margin-top:14px">' + (elimina && id ? '<button class="b p peri" data-a="' + elimina + '" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="' + salva + '" data-id="' + esc(id || '') + '">Salva</button></div>'; }
  function moduloTr(id) {
    var t = id ? d().trattative.filter(function (x) { return x.id === id; })[0] : { fase: 'contatto', nuovo: true };
    apri('<h3 style="margin-top:0">' + (id ? 'Modifica trattativa' : 'Nuova trattativa') + '</h3><div class="riga">' + campo('Cliente o potenziale cliente', 'trNome', t.nome, '') + scelta('Fase', 'trFase', C.FASI, t.fase) + campo('Valore stimato (€)', 'trValore', nfx(t.valore, 0)) + campo('Probabilità (%) · vuoto = predefinita della fase', 'trProb', t.probabilita === undefined ? '' : nfx(t.probabilita * 100, 0)) +
      campoM('Chiusura prevista', 'trChiusura', t.chiusura) + scelta('Tipo', 'trNuovo', { si: 'cliente nuovo', no: 'cliente già attivo' }, t.nuovo === false ? 'no' : 'si') + campo('Settore', 'trSettore', t.settore, '') + campo('Zona', 'trZona', t.zona, '') + campo('Fonte del contatto (fiera, segnalazione, elenco…)', 'trFonte', t.fonte, '') + campo('Note', 'trNote', t.note, '') + '</div>' +
      '<p class="muto">Scrivi il settore come lo hai indicato per i clienti: serve a riconoscere le trattative nei settori in cui rendi di più.</p>' + bottoni('coTrElimina', 'coTrSalva', id));
  }
  function moduloAnagrafica(key) {
    var D = d(), c = D.clienti.filter(function (x) { return C.norm(x.nome) === key; })[0] || {}, nome = c.nome || (D.vendite.filter(function (v) { return C.norm(v.cliente) === key; })[0] || {}).cliente || '';
    apri('<h3 style="margin-top:0">' + esc(nome) + '</h3><div class="riga">' + campo('Settore', 'anSettore', c.settore, '') + campo('Zona', 'anZona', c.zona, '') + campo('Pagamento concordato (giorni)', 'anConc', nfx(c.ggConcordati, 0)) + campo('Pagamento effettivo medio (giorni)', 'anEff', nfx(c.ggEffettivi, 0)) + '</div>' +
      '<p class="muto">I giorni effettivi sono quelli che il cliente impiega davvero a pagare, in media: dal gestionale o dagli estratti conto.</p><input type="hidden" id="anNome" value="' + esc(nome) + '">' + bottoni(null, 'coAnSalva', key));
  }
  function moduloVendita() {
    apri('<h3 style="margin-top:0">Aggiungi una vendita</h3><div class="riga">' + campo('Cliente', 'veCliente', '', 'list="veElenco"') + '<datalist id="veElenco">' + d().clienti.map(function (c) { return '<option value="' + esc(c.nome) + '">'; }).join('') + '</datalist>' + campoM('Mese', 'vePeriodo', oggiYm()) + campo('Ricavi senza IVA (€)', 'veRicavi', '') + campo('Costo diretto (€) · facoltativo', 'veCosto', '') + campo('Numero di ordini', 'veOrdini', '') + campo('Famiglia di prodotto', 'veFamiglia', '', '') + '</div>' + bottoni(null, 'coVeSalva', ''));
  }
  function pulisciSimulato() { var D = d(); if (D.simulato && !D.vendite.concat(D.trattative).some(function (y) { return y.origine === 'simulato'; })) { delete D.simulato; delete D.oggiSimulato; } }

  var azioni = {
    coSub: function (x) { st.comSub = x.sub; T.disegna(); window.scrollTo(0, 0); },
    coFiltro: function (x) { st.comSub = 'clienti'; st.comFiltro = x.f; T.disegna(); },
    coCliente: function (x) { st.comCliente = x.k; T.disegna(); window.scrollTo(0, 0); },
    coChiudi: function () { st.comCliente = null; T.disegna(); },
    coSconta: function () { var v = leggi('coSconto'); st.comSconto = v === null ? null : Math.max(0, Math.min(100, v)) / 100; var y = window.scrollY; T.disegna(); window.scrollTo(0, y); },
    coAnagrafica: function (x) { moduloAnagrafica(x.k); },
    coAnSalva: function (x) {
      var D = d(), c = D.clienti.filter(function (y) { return C.norm(y.nome) === x.id; })[0]; if (!c) { c = { nome: $('#anNome').value }; D.clienti.push(c); }
      metti(c, 'settore', testo('anSettore', 60)); metti(c, 'zona', testo('anZona', 60)); metti(c, 'ggConcordati', leggi('anConc')); metti(c, 'ggEffettivi', leggi('anEff')); T.salva(); T.chiudiDlg(); T.disegna(); T.toast('Scheda salvata');
    },
    coTrNuova: function () { moduloTr(null); },
    coTrModifica: function (x) { moduloTr(x.id); },
    coTrSalva: function (x) {
      var D = d(), nome = testo('trNome', 100); if (!nome) { T.toast('Serve un nome'); return; }
      var t = x.id ? D.trattative.filter(function (y) { return y.id === x.id; })[0] : { id: 't' + Date.now().toString(36) }, pr = leggi('trProb');
      t.nome = nome; t.fase = $('#trFase').value; metti(t, 'valore', leggi('trValore')); metti(t, 'probabilita', pr === null ? null : Math.max(0, Math.min(100, pr)) / 100); metti(t, 'chiusura', testo('trChiusura', 7)); t.nuovo = $('#trNuovo').value === 'si';
      metti(t, 'settore', testo('trSettore', 60)); metti(t, 'zona', testo('trZona', 60)); metti(t, 'fonte', testo('trFonte', 200)); metti(t, 'note', testo('trNote', 300)); t.origine = 'manuale'; if (!x.id) D.trattative.push(t); pulisciSimulato();
      T.salva(); T.chiudiDlg(); T.disegna(); T.toast(t.fonte ? 'Trattativa salvata' : 'Salvata: manca la fonte del contatto');
    },
    coTrElimina: function (x) { T.conferma('Eliminare questa trattativa?', 'Elimina').then(function (si) { if (!si) return; st.az.commerciale.trattative = d().trattative.filter(function (y) { return y.id !== x.id; }); pulisciSimulato(); T.salva(); T.disegna(); }); },
    coVendita: function () { moduloVendita(); },
    coVeSalva: function () {
      var cli = testo('veCliente', 80), per = testo('vePeriodo', 7), ric = leggi('veRicavi'); if (!cli || C.ix(per) === null || ric === null) { T.toast('Servono cliente, mese e ricavi'); return; }
      var v = { cliente: cli, periodo: per, ricavi: ric, origine: 'manuale' }; metti(v, 'costo', leggi('veCosto')); metti(v, 'ordini', leggi('veOrdini')); metti(v, 'famiglia', testo('veFamiglia', 60)); d().vendite.push(v); st.comAnno = Number(per.slice(0, 4));
      T.salva(); T.chiudiDlg(); T.disegna(); T.toast('Vendita aggiunta');
    },
    coEliminaAnno: function (x) { T.conferma('Eliminare tutte le vendite del ' + x.y + '?', 'Elimina').then(function (si) { if (!si) return; st.az.commerciale.vendite = d().vendite.filter(function (v) { return String(v.periodo).slice(0, 4) !== String(x.y); }); pulisciSimulato(); T.salva(); T.disegna(); }); },
    coModello: function () { T.scarica('timone-modello-vendite.csv', '﻿' + C.modelloCsv(), 'text/csv;charset=utf-8'); },
    coImporta: function () { var im = st.comImport, k = C.applica(st.az, im); st.comImport = null; st.comAnno = im.anni[im.anni.length - 1]; st.comSub = 'sintesi'; T.salva(); T.disegna(); T.toast(k + ' righe di vendita importate'); },
    coAnnulla: function () { st.comImport = null; T.disegna(); }
  };
  var cambi = {
    coAnno: function (e) { st.comAnno = Number(e.value); T.disegna(); },
    coFile: function (e) { var f = e.files[0]; if (!f) return; e.value = ''; T.tabellaDa(f).then(function (m) { var r = C.daTabella(m, T.numero); r.nome = f.name; st.comImport = r; T.disegna(); var el = document.getElementById('coAnteprima'); if (el) el.scrollIntoView(); }).catch(function (x) { T.toast('File non letto: ' + x.message); }); }
  };

  T.registra({
    id: 'commerciale', titolo: 'Commerciale', senzaEsercizi: true,
    descrizione: 'Vendite per cliente: quote, margini, concentrazione, clienti nuovi, persi e a rischio, segmenti più redditizi, tempi di pagamento; trattative in corso con valore ponderato; simulazione della perdita di un cliente e di uno sconto.',
    vista: vista, azioni: azioni, cambi: cambi,
    criticita: function (az, anno) { if (!az.commerciale || C.anniDi(az).indexOf(anno) < 0) return []; var a = C.analizza(az, anno, bilDi(anno)), ult = C.anniDi(az); return C.criticita(a, anno === ult[ult.length - 1] ? trattative(a) : null, eur, function (x) { return fmt(x, 'pct'); }); },
    collaudo: function (az) { return az.commerciale ? C.collaudo(az) : []; },
    simula: function (az, seme) { var m = C.simula(az, seme); if (m.vendite.length) az.commerciale = m; }
  });
})();
