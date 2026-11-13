/* Timone · interfaccia del modulo Finanziamenti, mutui e agevolazioni (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, F = window.Finanziamenti;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };
  var MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  function d() { if (!st.az.finanziamenti) st.az.finanziamenti = F.vuoto(); return F.dati(st.az); }
  function nfx(x, dec) { if (x === undefined || x === null) return ''; if (dec === 0) return nf0.format(Math.round(x)); var m = Math.pow(10, dec === undefined ? 2 : dec); return String(Math.round(x * m) / m).replace('.', ','); }
  function p2(x) { return (x === null || x === undefined || !isFinite(x)) ? '—' : nfx(x * 100, 2) + '%'; }
  function pc(x) { return x === undefined || x === null ? '' : nfx(x * 100, 3); }
  function e2(x) { return (x === null || x === undefined || !isFinite(x)) ? '—' : '€ ' + (Math.round(x * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }); }
  function mese(ym) { var p = String(ym || '').split('-'); return p.length < 2 ? '' : MESI[Number(p[1]) - 1] + ' ' + p[0]; }
  function giorno(g) { var p = String(g || '').split('-'); return p.length < 3 ? '' : Number(p[2]) + ' ' + MESI[Number(p[1]) - 1] + ' ' + p[0]; }
  function campo(et, id, val, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function campoT(et, id, val, tipo) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="' + tipo + '" id="' + id + '" value="' + esc(val || '') + '" style="font:inherit;background:var(--carta);color:var(--ink);border:1px solid var(--linea);border-radius:9px;padding:8px 10px;max-width:100%"></div>'; }
  function scelta(et, id, opz, val) { return '<div class="campo"><label for="' + id + '">' + et + '</label><select id="' + id + '">' + Object.keys(opz).map(function (k) { return '<option value="' + k + '"' + (String(val) === k ? ' selected' : '') + '>' + esc(opz[k]) + '</option>'; }).join('') + '</select></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function testo(id, max) { var e = document.getElementById(id); return e ? String(e.value).trim().slice(0, max || 120) : ''; }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td style="white-space:normal">' + v + '</td></tr>'; }
  function oggiIso() { var x = new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 101).slice(1) + '-' + String(x.getDate() + 100).slice(1); }
  function oggi() { var D = d(); return (D.simulato && D.oggiSimulato) ? D.oggiSimulato : oggiIso(); }

  // data di riferimento: fine di un esercizio presente (per i confronti con il bilancio) oppure oggi
  function scelteRif() { return T.anni().map(String).concat(['oggi']); }
  function rifScelto() { var s = scelteRif(); if (s.indexOf(String(st.finRif)) < 0) st.finRif = s.length > 1 ? s[s.length - 2] : 'oggi'; return String(st.finRif); }
  function rifDi(scelto) { return scelto === 'oggi' ? oggiIso().slice(0, 7) : scelto + '-12'; }
  function bilDi(anno) { return (anno && T.nDi(anno)) ? { n: T.nDi(anno), classificazione: st.az.classificazione, ceOk: T.completo(anno, 'ce'), spOk: T.completo(anno, 'sp') } : null; }
  function quadro() { var s = rifScelto(); return F.analizza(st.az, rifDi(s), s === 'oggi' ? null : bilDi(Number(s))); }
  function etRif(s) { return s === 'oggi' ? 'oggi' : 'fine ' + s; }

  var SUB = [['debiti', 'Debiti in corso'], ['offerte', 'Offerte a confronto'], ['agevolazioni', 'Agevolazioni']];
  function vista() {
    if (st.finAperto) { var x = quadro().righe.filter(function (r) { return r.p.id === st.finAperto && r.piano; })[0]; if (x) return dettaglio(x); st.finAperto = null; }
    var sub = st.finSub || 'debiti', s = rifScelto();
    var h = '<div class="riga"><h2 style="margin:0">Finanziamenti</h2><span class="sp"></span><select data-c="fiRif" aria-label="Situazione al">' + scelteRif().map(function (k) { return '<option value="' + k + '"' + (k === s ? ' selected' : '') + '>' + etRif(k) + '</option>'; }).join('') + '</select></div>';
    if (d().simulato) h += '<div class="avviso">Finanziamenti, banche e agevolazioni simulati: sono di fantasia e servono a provare il modulo.</div>';
    h += '<div class="sub">' + SUB.map(function (x) { return '<button data-a="fiSub" data-sub="' + x[0] + '" class="' + (sub === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
    return h + (sub === 'offerte' ? vistaOfferte() : sub === 'agevolazioni' ? vistaAgevolazioni() : vistaDebiti());
  }

  function vistaDebiti() {
    var a = quadro(), b = a.bilancio, s = rifScelto(), h = T.scrivibile() ? '<div class="riga"><button class="b p" data-a="fiNuovo" data-stato="in corso">Nuovo finanziamento</button></div>' : '';
    if (!a.righe.length) return h + '<div class="carta"><p>Nessun finanziamento inserito.</p><p class="muto">Inserisci mutui, prestiti, leasing e fidi con i dati del contratto: il modulo ricostruisce il piano di rimborso, calcola il costo effettivo, le rate dei prossimi 12 mesi e le confronta con il margine dell\'azienda.</p></div>';
    if (a.nonValidi) h += '<div class="avviso">' + a.nonValidi + (a.nonValidi === 1 ? ' finanziamento ha' : ' finanziamenti hanno') + ' dati incompleti e non entra nei totali: i dati mancanti non vengono stimati.</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Situazione a ' + etRif(s) + '</h3><table>' +
      riga('Debito residuo di mutui e prestiti', eur(a.residuo)) + riga('Fidi e anticipi utilizzati (media)', eur(a.fidiUtilizzo) + (a.fidiAccordato ? ' su ' + eur(a.fidiAccordato) + ' accordati' : '')) + riga('Debito finanziario totale', eur(a.debito), 1) +
      riga('di cui entro 12 mesi (fidi compresi)', eur(a.breve) + (a.quotaBreve !== null ? ' · ' + fmt(a.quotaBreve, 'pct') : '')) + riga('Rate di mutui e prestiti nei 12 mesi successivi', eur(a.rate12)) + riga('Costo annuo dei fidi', eur(a.costoFidi)) +
      riga('Tasso medio del debito', p2(a.costoMedio)) + riga('Quota a tasso variabile', a.quotaVariabile === null ? '—' : fmt(a.quotaVariabile, 'pct')) + riga('Un punto di tasso in più costa (12 mesi)', eur(a.stress1)) +
      (a.leasingResiduo || a.canoni12 ? riga('Leasing: canoni dei 12 mesi successivi', eur(a.canoni12)) + riga('Leasing: capitale ancora da rimborsare', eur(a.leasingResiduo)) : '') + '</table>' +
      '<p class="muto">I fidi sono contati per l\'utilizzo medio indicato e considerati rinnovati. I leasing sono mostrati a parte: nel bilancio italiano non compaiono tra i debiti, i canoni sono già tra i costi.</p></div>';
    if (b) {
      h += '<div class="carta"><h3 style="margin-top:0">Confronto con il bilancio ' + s + '</h3><table>';
      if (b.debiti !== undefined) h += riga('Debiti finanziari di bilancio', eur(b.debiti)) + riga('Finanziamenti registrati qui', eur(a.debito)) + riga('Differenza', '<span class="' + (Math.abs(b.differenza) > Math.max(10000, b.debiti * 0.1) ? 'giu' : '') + '">' + eur(b.differenza) + '</span>', 1) + riga('Debiti bancari a breve: bilancio / calcolati', eur(b.breve) + ' / ' + eur(a.breve));
      else h += riga('Debiti finanziari di bilancio', 'stato patrimoniale incompleto');
      if (b.oneri !== undefined) {
        h += riga('Interessi e oneri finanziari di bilancio', eur(b.oneri)) + riga('Interessi e costi calcolati dai piani per il ' + s, eur(b.interessiCalcolati));
        h += riga('Copertura delle rate (EBITDA ÷ rate e costo dei fidi)', b.copertura === null ? '—' : '<b class="' + (b.copertura < 1 ? 'giu' : b.copertura >= F.PARAM.coperturaMinima ? 'su' : '') + '">' + nfx(b.copertura, 2) + '</b> · EBITDA ' + eur(b.ebitda) + ' ÷ ' + eur(a.servizio), 1);
        if (b.roi !== undefined && b.roi !== null) h += riga('Rendimento del capitale investito / tasso medio del debito', p2(b.roi) + ' / ' + p2(a.costoMedio));
      } else h += riga('Copertura delle rate', 'conto economico incompleto');
      h += '</table><p class="muto">La copertura confronta il margine operativo dell\'anno con le uscite dei 12 mesi successivi: sotto 1 il margine non basta, tra 1 e ' + String(F.PARAM.coperturaMinima).replace('.', ',') + ' il margine è stretto. Se il bilancio non separa la quota dei mutui in scadenza entro 12 mesi, i debiti a breve di bilancio e quelli calcolati differiscono. È una misura semplificata: non considera imposte, investimenti e variazioni del capitale circolante.</p></div>';
    } else h += '<p class="muto">Per il confronto con debiti, interessi e margine di bilancio scegli in alto la fine di un esercizio presente.</p>';
    if (a.scadenze.length) {
      h += '<div class="carta"><h3 style="margin-top:0">Capitale da rimborsare, anno per anno</h3><div class="scorri"><table><tr><th>Periodo</th><th>Capitale</th></tr>' + a.scadenze.map(function (x) { return '<tr><td>' + mese(x.da) + ' – ' + mese(x.a) + '</td><td>' + eur(x.capitale) + '</td></tr>'; }).join('') + '</table></div><p class="muto">Solo mutui e prestiti; i fidi non hanno scadenza di rimborso.</p></div>';
    }
    a.righe.forEach(function (x) {
      var p = x.p;
      h += '<div class="carta"><div class="riga"><h3 style="margin:0">' + esc(p.nome || 'Finanziamento') + '</h3><span class="sp"></span><span class="tag">' + esc(F.TIPI[p.tipo] || F.TIPI.mutuo) + '</span>' + (p.origine === 'simulato' ? '<span class="tag simulato">simulato</span>' : '') + '</div>' + (p.finanziatore ? '<p class="muto">' + esc(p.finanziatore) + '</p>' : '');
      if (!x.valido) h += x.errori.map(function (m) { return '<div class="avviso">' + esc(m) + '</div>'; }).join('');
      else if (x.f) h += '<table>' + riga('Utilizzo medio', eur(x.f.utilizzo) + ' su ' + eur(x.f.accordato) + (x.f.quota !== null ? ' (' + fmt(x.f.quota, 'pct') + ')' : '')) + riga('Tasso', p2(p.tasso) + (p.variabile === false ? ' fisso' : ' variabile')) + riga('Costo annuo (interessi + commissioni)', eur(x.f.costoAnno)) + riga('Costo effettivo sull\'utilizzato', p2(x.f.costoEffettivo), 1) + '</table>';
      else h += '<table>' + riga(x.s.stato === 'in corso' ? 'Debito residuo' : 'Stato', x.s.stato === 'in corso' ? eur(x.s.residuo) : x.s.stato, 1) + riga('Tasso', p2(p.tasso) + (p.variabile ? ' variabile' : ' fisso') + ' · effettivo ' + p2(x.piano.tassoEffettivo)) +
        (x.s.prossima ? riga('Prossima rata', e2(x.s.prossima.rata) + ' · ' + mese(x.s.prossima.data)) : '') + riga('Ultima rata', mese(x.piano.fine)) + '</table>';
      h += '<div class="riga" style="margin-top:8px">' + (x.piano ? '<button class="b p" data-a="fiApri" data-id="' + esc(p.id) + '">Piano e simulazioni</button>' : '') + (T.scrivibile() ? '<button class="b p s" data-a="fiModifica" data-id="' + esc(p.id) + '">Modifica</button>' : '') + '</div></div>';
    });
    return h;
  }

  function vistaOfferte() {
    var a = quadro(), h = '<p class="muto">Inserisci le proposte ricevute dalle banche: il confronto si fa sul <b>tasso effettivo</b>, che comprende spese di istruttoria e spese per rata, non sul tasso dichiarato. Le offerte non entrano nei debiti in corso.</p>' +
      (T.scrivibile() ? '<div class="riga"><button class="b p" data-a="fiNuovo" data-stato="offerta">Nuova offerta</button></div>' : '');
    if (!a.offerte.length) return h + '<div class="carta"><p>Nessuna offerta inserita.</p></div>';
    var val = a.offerte.filter(function (x) { return x.piano; });
    if (a.offertaMigliore) { var m = a.offertaMigliore, basso = val.slice().sort(function (x, y) { return x.p.tasso - y.p.tasso; })[0];
      h += '<div class="avviso ok"><b>' + esc(m.p.nome || 'Offerta') + '</b> ha il tasso effettivo più basso: ' + p2(m.piano.tassoEffettivo) + '.' + (basso !== m ? ' Non è quella con il tasso dichiarato più basso (' + esc(basso.p.nome || '') + ', ' + p2(basso.p.tasso) + '): le spese fanno la differenza.' : '') + '</div>'; }
    if (val.length) {
      h += '<div class="carta"><div class="scorri"><table><tr><th></th><th>Importo</th><th>Tasso</th><th>Tasso effettivo</th><th>Rata</th><th>Interessi</th><th>Spese</th><th>Costo totale</th><th>Copertura dopo</th></tr>';
      val.slice().sort(function (x, y) { return (x.piano.tassoEffettivo === null ? 9 : x.piano.tassoEffettivo) - (y.piano.tassoEffettivo === null ? 9 : y.piano.tassoEffettivo); }).forEach(function (x) { var pl = x.piano;
        h += '<tr class="' + (x === a.offertaMigliore ? 'tot' : '') + '"><td>' + esc(x.p.nome || 'Offerta') + '<br><span class="muto">' + esc(x.p.finanziatore || '') + ' · ' + x.p.durataMesi + ' mesi</span></td><td>' + eur(pl.capitale) + '</td><td>' + p2(x.p.tasso) + (x.p.variabile ? ' var.' : '') + '</td><td>' + p2(pl.tassoEffettivo) + '</td><td>' + (pl.rataTipo !== null ? e2(pl.rataTipo) : 'variabile') + '</td><td>' + eur(pl.interessi) + '</td><td>' + eur(pl.spese) + '</td><td>' + eur(pl.costoTotale) + '</td><td>' + (x.coperturaDopo === undefined || x.coperturaDopo === null ? '—' : '<span class="' + (x.coperturaDopo < 1 ? 'giu' : '') + '">' + nfx(x.coperturaDopo, 2) + '</span>') + '</td></tr>'; });
      h += '</table></div><p class="muto">Copertura dopo: EBITDA dell\'esercizio scelto ÷ (rate e costo dei fidi attuali + rate del primo anno dell\'offerta). Non considera il margine che l\'investimento finanziato potrà generare. Offerte con importi o durate diverse non sono confrontabili sul costo totale, solo sul tasso effettivo.</p></div>';
    }
    a.offerte.forEach(function (x) { h += '<div class="carta"><div class="riga"><b>' + esc(x.p.nome || 'Offerta') + '</b><span class="sp"></span>' + (x.p.origine === 'simulato' ? '<span class="tag simulato">simulato</span>' : '') + '</div>' + (x.valido ? '' : x.errori.map(function (m) { return '<div class="avviso">' + esc(m) + '</div>'; }).join('')) +
      (T.scrivibile() ? '<div class="riga" style="margin-top:8px"><button class="b p s" data-a="fiModifica" data-id="' + esc(x.p.id) + '">Modifica</button>' + (x.valido ? '<button class="b p s" data-a="fiAccetta" data-id="' + esc(x.p.id) + '">Accettata: sposta tra i debiti</button>' : '') + '</div>' : '') + '</div>'; });
    return h;
  }

  function vistaAgevolazioni() {
    var g = F.analizzaAgevolazioni(st.az, oggi());
    var h = '<div class="avviso info">Timone non cerca bandi e non ne propone: registra qui le agevolazioni che hai trovato o che ti ha segnalato il consulente, sempre con la <b>fonte ufficiale</b> e la data in cui l\'hai verificata. Senza fonte un\'agevolazione non viene conteggiata.</div>' +
      (d().simulato && d().oggiSimulato ? '<p class="muto">Dati simulati: le scadenze sono calcolate come se oggi fosse il ' + giorno(d().oggiSimulato) + '.</p>' : '') + (T.scrivibile() ? '<div class="riga"><button class="b p" data-a="fiAgNuova">Nuova agevolazione</button></div>' : '');
    if (!g.righe.length) return h + '<div class="carta"><p>Nessuna agevolazione registrata.</p></div>';
    h += '<div class="carta"><table>' + riga('Da valutare o in preparazione', eur(g.potenziale)) + riga('Domande presentate', eur(g.richiesto)) + riga('Concesse, da incassare', eur(g.concesso), 1) + riga('Incassate', eur(g.incassato)) + '</table><p class="muto">Solo le agevolazioni concesse sono un beneficio certo: le altre sono possibilità e non vanno contate nei piani.</p></div>';
    g.righe.forEach(function (x) { var a = x.g, req = a.requisiti || [];
      h += '<div class="carta"><div class="riga"><h3 style="margin:0">' + esc(a.nome || 'Agevolazione') + '</h3><span class="sp"></span><span class="tag ' + (a.stato === 'concessa' || a.stato === 'incassata' ? 'ok' : a.stato === 'respinta' ? 'rosso' : '') + '">' + esc(F.STATI_AG[a.stato] || F.STATI_AG.valutare) + '</span>' + (a.origine === 'simulato' ? '<span class="tag simulato">simulato</span>' : '') + '</div>' +
        '<p class="muto">' + esc([F.TIPI_AG[a.tipo] || '', a.ente || ''].filter(Boolean).join(' · ')) + '</p><table>' + riga('Beneficio atteso', a.importo === undefined || a.importo === null ? 'non quantificato' : eur(a.importo)) + (a.scadenza ? riga('Termine per la domanda', giorno(a.scadenza) + (x.aperta && x.giorni !== null && x.giorni >= 0 ? ' · tra ' + x.giorni + ' giorni' : '')) : '') +
        riga('Fonte', a.fonte ? esc(a.fonte) + (a.verificata ? '<br><span class="muto">verificata il ' + giorno(a.verificata) + '</span>' : '') : '<span class="giu">mancante</span>') + '</table>';
      x.avvisi.forEach(function (m) { h += '<div class="avviso">' + esc(m) + '</div>'; });
      if (req.length) { h += '<h3>Requisiti</h3>'; req.forEach(function (r, i) { h += '<div class="voce" style="grid-template-columns:1fr 130px"><div>' + esc(r.t) + '</div><select data-c="fiReq" data-id="' + esc(a.id) + '" data-i="' + i + '"' + (T.scrivibile() ? '' : ' disabled') + '><option value="?"' + (r.esito !== 'si' && r.esito !== 'no' ? ' selected' : '') + '>da verificare</option><option value="si"' + (r.esito === 'si' ? ' selected' : '') + '>soddisfatto</option><option value="no"' + (r.esito === 'no' ? ' selected' : '') + '>non soddisfatto</option></select></div>'; }); }
      if (a.note) h += '<p class="muto">' + esc(a.note) + '</p>';
      h += (T.scrivibile() ? '<div class="riga" style="margin-top:8px"><button class="b p s" data-a="fiAgModifica" data-id="' + esc(a.id) + '">Modifica</button></div>' : '') + '</div>'; });
    return h;
  }

  function dettaglio(x) {
    var p = x.p, pl = x.piano, s = x.sit = x.s, rif = quadro().rif, sim = st.finSim || {};
    var h = '<div class="riga noprint"><button class="b p s" data-a="fiChiudi">← Finanziamenti</button><span class="sp"></span>' + (T.scrivibile() ? '<button class="b p s" data-a="fiModifica" data-id="' + esc(p.id) + '">Modifica</button>' : '') + '</div><h2>' + esc(p.nome || 'Finanziamento') + '</h2>' + (p.finanziatore ? '<p class="muto">' + esc(p.finanziatore) + (p.garanzia ? ' · garanzia: ' + esc(p.garanzia) : '') + '</p>' : '');
    h += '<div class="carta"><table>' + (p.tipo === 'leasing' ? riga('Valore del bene', eur(p.importo)) + riga('Anticipo', eur(pl.anticipo)) : '') + riga('Capitale finanziato', eur(pl.capitale)) + riga('Erogazione · ultima rata', mese(p.inizio) + ' · ' + mese(pl.fine)) +
      riga('Tasso annuo dichiarato', p2(p.tasso) + (p.variabile ? ' variabile' : ' fisso')) + riga('Tasso effettivo con le spese (calcolato)', p2(pl.tassoEffettivo), 1) + riga(pl.rataTipo !== null ? 'Rata' : 'Prima rata', e2(pl.rataTipo !== null ? pl.rataTipo : pl.righe[0].rata) + ' ogni ' + (pl.per === 1 ? 'mese' : pl.per + ' mesi')) +
      riga('Interessi totali', eur(pl.interessi)) + riga('Spese totali', eur(pl.spese)) + riga('Costo totale del finanziamento', eur(pl.costoTotale), 1) + '</table>' +
      '<p class="muto">Il tasso effettivo è calcolato da Timone sui flussi inseriti (incasso al netto delle spese iniziali, rate comprese le spese): non è il TAEG o l\'ISC del contratto, che può comprendere altre voci.' + (p.variabile ? ' Tasso variabile: il piano usa il tasso indicato oggi per tutta la durata.' : '') + '</p></div>';
    h += '<div class="carta"><h3 style="margin-top:0">Situazione a ' + etRif(rifScelto()) + '</h3><table>' + riga('Debito residuo', s.stato === 'in corso' ? eur(s.residuo) : s.stato, 1) + riga('Da rimborsare entro 12 mesi', eur(s.entro12)) + riga('Oltre 12 mesi', eur(s.oltre12)) + riga('Rate dei 12 mesi successivi', eur(s.rate12) + ' · di cui interessi ' + eur(s.interessi12)) + (p.variabile ? riga('Un punto di tasso in più (12 mesi)', eur(s.stress1)) : '') + '</table></div>';
    var anni = {}; pl.righe.forEach(function (r) { var y = r.data.slice(0, 4); anni[y] = anni[y] || { rate: 0, interessi: 0, capitale: 0, residuo: 0 }; anni[y].rate += r.rata; anni[y].interessi += r.interessi; anni[y].capitale += r.capitale; anni[y].residuo = r.residuo; });
    h += '<div class="carta"><h3 style="margin-top:0">Piano per anno</h3><div class="scorri"><table><tr><th>Anno</th><th>Rate</th><th>Interessi</th><th>Capitale</th><th>Residuo a fine anno</th></tr>' + Object.keys(anni).map(function (y) { var k = anni[y]; return '<tr><td>' + y + '</td><td>' + eur(k.rate) + '</td><td>' + eur(k.interessi) + '</td><td>' + eur(k.capitale) + '</td><td>' + eur(k.residuo) + '</td></tr>'; }).join('') + '</table></div>' +
      '<details><summary><span class="nome">Tutte le rate (' + pl.righe.length + ')</span></summary><div class="scorri"><table><tr><th>Scadenza</th><th>Rata</th><th>Interessi</th><th>Capitale</th><th>Residuo</th></tr>' + pl.righe.map(function (r) { return '<tr><td>' + mese(r.data) + (r.pre ? ' <span class="tag">preamm.</span>' : r.riscatto ? ' <span class="tag">riscatto</span>' : '') + '</td><td>' + e2(r.rata) + '</td><td>' + e2(r.interessi) + '</td><td>' + e2(r.capitale) + '</td><td>' + e2(r.residuo) + '</td></tr>'; }).join('') + '</table></div></details></div>';
    if (p.tipo === 'mutuo' && s.stato === 'in corso' && s.residuo > 0) {
      var e = F.estinzione(p, rif, sim.penale === undefined ? null : sim.penale);
      h += '<div class="carta"><h3 style="margin-top:0">E se lo estinguessi in anticipo?</h3><div class="riga">' + campo('Penale di estinzione (% del debito residuo)', 'fiPenale', pc(e.quotaPenale)) + '<button class="b p" data-a="fiSimula">Calcola</button></div><table>' +
        riga('Da pagare subito (residuo + penale)', eur(e.esborso)) + riga('Interessi e spese future evitati', eur(e.interessiFuturi + e.speseFuture)) + riga('Penale', eur(e.penale)) + riga('Risparmio netto', '<span class="' + (e.risparmio >= 0 ? 'su' : 'giu') + '">' + eur(e.risparmio) + '</span>', 1) + '</table>' +
        '<p class="muto">Il risparmio non è attualizzato e non considera quanto renderebbe o costerebbe la liquidità usata per estinguere: conviene solo se quella liquidità non serve all\'azienda.</p></div>';
      var ms = F.ix(pl.fine) - F.ix(rif), rn = (sim.tasso !== undefined && sim.durata) ? F.rinegozia(p, rif, { tasso: sim.tasso, durataMesi: sim.durata, costi: sim.costi || 0 }) : null;
      h += '<div class="carta"><h3 style="margin-top:0">E se lo rinegoziassi o lo spostassi in un\'altra banca?</h3><div class="riga">' + campo('Nuovo tasso annuo (%)', 'fiRnTasso', sim.tasso === undefined ? '' : pc(sim.tasso)) + campo('Nuova durata residua (mesi) · oggi ' + ms, 'fiRnDurata', sim.durata || ms) + campo('Costi dell\'operazione (€)', 'fiRnCosti', sim.costi === undefined ? '' : nfx(sim.costi, 0)) + '<button class="b p" data-a="fiSimula">Calcola</button></div>';
      if (rn) h += '<table><tr><th></th><th>Oggi</th><th>Dopo</th></tr><tr><td>Rata</td><td>' + e2(rn.vecchio.rata) + '</td><td>' + e2(rn.nuovo.rata) + '</td></tr><tr><td>Rate dei primi 12 mesi</td><td>' + eur(rn.rate12prima) + '</td><td>' + eur(rn.rate12dopo) + '</td></tr><tr><td>Ultima rata</td><td>' + mese(rn.vecchio.fine) + '</td><td>' + mese(rn.nuovo.fine) + '</td></tr><tr><td>Interessi, spese e costi ancora da pagare</td><td>' + eur(rn.vecchio.costo) + '</td><td>' + eur(rn.nuovo.costo) + '</td></tr><tr class="tot"><td>Risparmio complessivo</td><td></td><td class="' + (rn.risparmio >= 0 ? 'su' : 'giu') + '">' + eur(rn.risparmio) + '</td></tr></table>' +
        (rn.allunga && rn.risparmio < 0 ? '<div class="avviso">Allungare la durata alleggerisce le rate ma fa pagare più interessi in totale: è una scelta di liquidità, non un risparmio.</div>' : '');
      else h += '<p class="muto">Indica il nuovo tasso per vedere rata, costo complessivo e risparmio.</p>';
      h += '</div>';
    }
    return h;
  }

  // ------------------------------------------------------------ moduli di inserimento
  var PERIODI = { 1: 'mensile', 3: 'trimestrale', 6: 'semestrale', 12: 'annuale' };
  function modulo(id, tipo, stato) {
    var p = id ? d().prestiti.filter(function (x) { return x.id === id; })[0] : { tipo: tipo || 'mutuo', stato: stato || 'in corso', periodicitaMesi: 1, metodo: 'francese' };
    if (tipo) p = Object.assign({}, p, { tipo: tipo });
    var t = p.tipo || 'mutuo', off = (p.stato || stato) === 'offerta';
    var h = '<h3 style="margin-top:0">' + (id ? 'Modifica' : off ? 'Nuova offerta' : 'Nuovo finanziamento') + '</h3><input type="hidden" id="fiStato" value="' + (off ? 'offerta' : 'in corso') + '"><div class="riga">' +
      '<div class="campo"><label for="fiTipo">Tipo</label><select id="fiTipo" data-c="fiTipo" data-id="' + esc(id || '') + '">' + Object.keys(F.TIPI).map(function (k) { return '<option value="' + k + '"' + (k === t ? ' selected' : '') + '>' + F.TIPI[k] + '</option>'; }).join('') + '</select></div>' +
      campo('Nome', 'fiNome', p.nome, '') + campo('Banca o finanziatore', 'fiFin', p.finanziatore, '') + '</div><div class="riga" style="margin-top:8px">';
    if (t === 'fido') h += campo('Importo accordato (€)', 'fi_accordato', nfx(p.accordato, 0)) + campo('Utilizzo medio (€)', 'fi_utilizzoMedio', nfx(p.utilizzoMedio, 0)) + campo('Tasso annuo (%)', 'fiTasso', pc(p.tasso)) + campo('Commissione annua sull\'accordato (%)', 'fiComm', pc(p.commissione)) + campo('Altre spese annue (€)', 'fi_speseAnnue', nfx(p.speseAnnue, 0)) + scelta('Tasso', 'fiVar', { si: 'variabile', no: 'fisso' }, p.variabile === false ? 'no' : 'si');
    else h += campo(t === 'leasing' ? 'Valore del bene (€)' : 'Importo finanziato (€)', 'fi_importo', nfx(p.importo, 2)) + (t === 'leasing' ? campo('Anticipo o maxicanone (€)', 'fi_anticipo', nfx(p.anticipo, 2)) + campo('Riscatto finale (€)', 'fi_valoreResiduo', nfx(p.valoreResiduo, 2)) : '') +
      campoT('Mese di erogazione', 'fiInizio', p.inizio, 'month') + campo('Durata totale (mesi)', 'fi_durataMesi', nfx(p.durataMesi, 0)) + campo('di cui preammortamento (mesi)', 'fi_preammortamentoMesi', nfx(p.preammortamentoMesi, 0)) + campo('Tasso annuo (%)', 'fiTasso', pc(p.tasso)) + scelta('Tasso', 'fiVar', { no: 'fisso', si: 'variabile' }, p.variabile ? 'si' : 'no') +
      scelta('Rate', 'fiPer', PERIODI, String(p.periodicitaMesi || 1)) + scelta('Rimborso', 'fiMetodo', F.METODI, p.metodo || 'francese') + campo('Spese iniziali: istruttoria, imposte, perizie (€)', 'fi_speseIniziali', nfx(p.speseIniziali, 2)) + campo('Spese per ogni rata (€)', 'fi_spesePerRata', nfx(p.spesePerRata, 2)) +
      (t === 'mutuo' ? campo('Penale di estinzione anticipata (%)', 'fiPen', pc(p.penaleEstinzione)) : '') + campo('Garanzie', 'fiGar', p.garanzia, '');
    h += '</div><p class="muto">Usa i dati del contratto o del piano della banca. ' + (t === 'fido' ? 'L\'utilizzo medio è quello tipico dell\'anno: dagli estratti conto trimestrali.' : 'Con tasso variabile indica il tasso applicato oggi.') + '</p>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="fiElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="fiSalva" data-id="' + esc(id || '') + '">Salva</button></div>';
    $('#dlgCorpo').innerHTML = h; if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0;
  }
  function moduloAg(id) {
    var a = id ? d().agevolazioni.filter(function (x) { return x.id === id; })[0] : { stato: 'valutare', tipo: 'fondo_perduto', verificata: oggiIso() };
    $('#dlgCorpo').innerHTML = '<h3 style="margin-top:0">' + (id ? 'Modifica agevolazione' : 'Nuova agevolazione') + '</h3><div class="riga">' + campo('Nome del bando o della misura', 'agNome', a.nome, '') + campo('Ente che la concede', 'agEnte', a.ente, '') + scelta('Tipo', 'agTipo', F.TIPI_AG, a.tipo) + scelta('Stato', 'agStato', F.STATI_AG, a.stato) +
      campo('Beneficio atteso (€)', 'agImporto', nfx(a.importo, 0)) + campoT('Termine per la domanda', 'agScadenza', a.scadenza, 'date') + campo('Fonte ufficiale (indirizzo web o estremi dell\'atto)', 'agFonte', a.fonte, '') + campoT('Fonte verificata il', 'agVerificata', a.verificata, 'date') + '</div>' +
      '<div class="campo" style="margin-top:8px"><label for="agReq">Requisiti del bando, uno per riga</label><textarea id="agReq" rows="5" style="font:inherit;background:var(--carta);color:var(--ink);border:1px solid var(--linea);border-radius:9px;padding:8px 10px;width:100%">' + esc((a.requisiti || []).map(function (r) { return r.t; }).join('\n')) + '</textarea></div>' +
      '<div class="campo" style="margin-top:8px"><label for="agNote">Note</label><input type="text" id="agNote" value="' + esc(a.note || '') + '"></div>' +
      '<p class="muto">Riporta i requisiti dal testo ufficiale e segnali poi uno per uno come soddisfatti o no. L\'importo è una tua stima finché l\'agevolazione non è concessa.</p>' +
      '<div class="riga" style="margin-top:14px">' + (id ? '<button class="b p peri" data-a="fiAgElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="fiAgSalva" data-id="' + esc(id || '') + '">Salva</button></div>';
    if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0;
  }
  function pulisciSimulato() { var D = d(); if (D.simulato && !D.prestiti.concat(D.agevolazioni).some(function (y) { return y.origine === 'simulato'; })) { delete D.simulato; delete D.oggiSimulato; } }
  function perc(id) { var v = leggi(id); return v === null ? null : Math.max(0, Math.min(100, v)) / 100; }
  function metti(o, k, v) { if (v === null || v === '') delete o[k]; else o[k] = v; }

  var azioni = {
    fiSub: function (x) { st.finSub = x.sub; T.disegna(); },
    fiNuovo: function (x) { modulo(null, null, x.stato); },
    fiModifica: function (x) { modulo(x.id); },
    fiApri: function (x) { st.finAperto = x.id; st.finSim = {}; T.disegna(); window.scrollTo(0, 0); },
    fiChiudi: function () { st.finAperto = null; T.disegna(); },
    fiSalva: function (x) {
      var D = d(), nome = testo('fiNome', 80); if (!nome) { T.toast('Serve un nome'); return; }
      var p = x.id ? D.prestiti.filter(function (y) { return y.id === x.id; })[0] : { id: 'f' + Date.now().toString(36), stato: $('#fiStato').value };
      var t = $('#fiTipo').value; p.tipo = t; p.nome = nome; metti(p, 'finanziatore', testo('fiFin', 80)); metti(p, 'tasso', perc('fiTasso')); p.variabile = $('#fiVar').value === 'si';
      ['importo', 'anticipo', 'valoreResiduo', 'durataMesi', 'preammortamentoMesi', 'speseIniziali', 'spesePerRata', 'accordato', 'utilizzoMedio', 'speseAnnue'].forEach(function (k) { if (document.getElementById('fi_' + k)) metti(p, k, leggi('fi_' + k)); });
      if (t === 'fido') metti(p, 'commissione', perc('fiComm'));
      else { metti(p, 'inizio', testo('fiInizio', 7)); p.periodicitaMesi = Number($('#fiPer').value); p.metodo = $('#fiMetodo').value; metti(p, 'garanzia', testo('fiGar', 120)); if (t === 'mutuo') metti(p, 'penaleEstinzione', perc('fiPen')); }
      p.origine = 'manuale'; if (!x.id) D.prestiti.push(p); pulisciSimulato();
      var err = F.valida(p); T.salva(); T.chiudiDlg(); T.disegna(); T.toast(err.length ? 'Salvato, ma mancano dati: ' + err[0] : 'Salvato');
    },
    fiElimina: function (x) { T.conferma('Eliminare questo finanziamento?', 'Elimina').then(function (si) { if (!si) return; st.az.finanziamenti.prestiti = d().prestiti.filter(function (y) { return y.id !== x.id; }); if (st.finAperto === x.id) st.finAperto = null; pulisciSimulato(); T.salva(); T.disegna(); }); },
    fiAccetta: function (x) { var p = d().prestiti.filter(function (y) { return y.id === x.id; })[0]; if (!p) return; p.stato = 'in corso'; st.finSub = 'debiti'; T.salva(); T.disegna(); T.toast('Spostata tra i debiti in corso'); },
    fiSimula: function () {
      var s = st.finSim = st.finSim || {}, v = perc('fiPenale'); if (v !== null) s.penale = v;
      var t = perc('fiRnTasso'), du = leggi('fiRnDurata'), co = leggi('fiRnCosti');
      if (t !== null) { if (!(du >= 1 && du <= 480)) { T.toast('Indica la nuova durata in mesi'); return; } s.tasso = t; s.durata = Math.round(du); s.costi = co || 0; } else { delete s.tasso; }
      var y = window.scrollY; T.disegna(); window.scrollTo(0, y);
    },
    fiAgNuova: function () { moduloAg(null); },
    fiAgModifica: function (x) { moduloAg(x.id); },
    fiAgSalva: function (x) {
      var D = d(), nome = testo('agNome', 120); if (!nome) { T.toast('Serve un nome'); return; }
      var a = x.id ? D.agevolazioni.filter(function (y) { return y.id === x.id; })[0] : { id: 'g' + Date.now().toString(36) }, vecchi = {};
      (a.requisiti || []).forEach(function (r) { vecchi[r.t] = r.esito; });
      a.nome = nome; metti(a, 'ente', testo('agEnte', 120)); a.tipo = $('#agTipo').value; a.stato = $('#agStato').value; metti(a, 'importo', leggi('agImporto')); metti(a, 'scadenza', testo('agScadenza', 10)); metti(a, 'fonte', testo('agFonte', 300)); metti(a, 'verificata', testo('agVerificata', 10)); metti(a, 'note', testo('agNote', 300));
      a.requisiti = $('#agReq').value.split('\n').map(function (t) { return t.trim().slice(0, 200); }).filter(Boolean).slice(0, 30).map(function (t) { return { t: t, esito: vecchi[t] || '?' }; });
      a.origine = 'manuale'; if (!x.id) D.agevolazioni.push(a); pulisciSimulato();
      T.salva(); T.chiudiDlg(); T.disegna(); T.toast(a.fonte ? 'Agevolazione salvata' : 'Salvata, ma senza fonte non viene conteggiata');
    },
    fiAgElimina: function (x) { T.conferma('Eliminare questa agevolazione?', 'Elimina').then(function (si) { if (!si) return; st.az.finanziamenti.agevolazioni = d().agevolazioni.filter(function (y) { return y.id !== x.id; }); pulisciSimulato(); T.salva(); T.disegna(); }); }
  };
  var cambi = {
    fiRif: function (e) { st.finRif = e.value; T.disegna(); },
    fiTipo: function (e) { modulo(e.dataset.id || null, e.value, $('#fiStato').value); },
    fiReq: function (e) { var a = d().agevolazioni.filter(function (y) { return y.id === e.dataset.id; })[0]; if (!a || !a.requisiti[Number(e.dataset.i)]) return; a.requisiti[Number(e.dataset.i)].esito = e.value; T.salva(); var y = window.scrollY; T.disegna(); window.scrollTo(0, y); }
  };

  T.registra({
    id: 'finanziamenti', titolo: 'Finanziamenti', senzaEsercizi: true,
    descrizione: 'Mutui, prestiti, leasing e fidi: piani di rimborso, costo effettivo, rate dei prossimi 12 mesi, copertura con il margine, confronto tra offerte, estinzione e rinegoziazione; registro delle agevolazioni con fonte e requisiti.',
    vista: vista, azioni: azioni, cambi: cambi,
    criticita: function (az, anno) { if (!az.finanziamenti) return []; return F.criticita(F.analizza(az, anno + '-12', bilDi(anno)), F.analizzaAgevolazioni(az, oggi()), eur, function (x) { return fmt(x, 'pct'); }); },
    collaudo: function (az) { return az.finanziamenti ? F.collaudo(az) : []; },
    simula: function (az, seme) { var m = F.simula(az, seme); if (m.prestiti.length || m.agevolazioni.length) az.finanziamenti = m; }
  });
})();
