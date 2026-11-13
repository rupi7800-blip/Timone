/* Timone · interfaccia
   Tutta la logica di calcolo sta in motore.js: qui si leggono i dati, si chiamano
   le funzioni del motore e si disegnano i risultati. */
(function () {
  'use strict';
  var VERSIONE = '1.0.0';
  var M = window.Motore, Sim = window.Simulatore, Imp = window.Importa, Arch = window.Archivio;
  var $ = function (s) { return document.querySelector(s); };

  var SCHEDE = [['cruscotto', 'Cruscotto'], ['bilancio', 'Bilancio'], ['indici', 'Indici'], ['diagnosi', 'Diagnosi'], ['budget', 'Budget'], ['scenari', 'Scenari'], ['collaudo', 'Simulazione'], ['impostazioni', 'Impostazioni']];
  var stato = { az: null, anno: null, scheda: 'cruscotto', sub: 'dati', utente: null, importazione: null, esitoCollaudo: null, esitoMassivo: null, scenAperto: 'centrale' };

  // ------------------------------------------------------------ utilità
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function eur(x) { return (x === null || x === undefined || !isFinite(x)) ? '—' : '€ ' + nf0.format(Math.round(x)); }
  function fmt(x, unita) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    if (unita === 'eur') return eur(x);
    if (unita === 'pct') return nf1.format(x * 100) + '%';
    if (unita === 'giorni') return nf0.format(x) + ' gg';
    if (unita === 'x') return nf2.format(x) + 'x';
    return nf0.format(x);
  }
  function toast(t) { var e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove('on'); }, 2600); }
  function anni() { return stato.az ? Object.keys(stato.az.esercizi).map(Number).sort(function (a, b) { return a - b; }) : []; }
  function serie() { return Sim.serieDi(stato.az); }
  function nDi(anno) { return stato.az.esercizi[anno] ? M.numeri(stato.az.esercizi[anno]) : null; }
  function completo(anno, sezione) { var n = nDi(anno); return !!n && M.mancantiSezione(n, sezione || 'tutto').length === 0; }
  // esercizio corrente più i precedenti consecutivi completi: i confronti non usano mai anni con vuoti
  function serieCompleta(anno) {
    var a = anni(), i = a.indexOf(anno), out = [];
    for (var k = i; k >= 0 && completo(a[k]); k--) out.unshift({ anno: a[k], n: nDi(a[k]) });
    return out;
  }
  function bloccoIncompleto(anno, cosa) {
    var man = M.mancanti(nDi(anno) || {});
    return '<div class="avviso rosso">' + cosa + ' non disponibile per il ' + anno + ': mancano ' + man.length + ' voci di bilancio (' + esc(man.slice(0, 4).map(function (k) { return M.VOCE[k].nome; }).join('; ')) + (man.length > 4 ? '…' : '') + '). I vuoti non vengono trattati come zero.</div><button class="b" data-a="vai" data-scheda="bilancio" data-sub="dati">Completa il bilancio</button>';
  }
  function scrivibile() { return !stato.az || !stato.az.ruolo || stato.az.ruolo !== 'sola_lettura'; }
  function scarica(nome, testo, tipo) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([testo], { type: tipo || 'text/plain;charset=utf-8' }));
    a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  var timerSalva = null;
  function salva(subito) {
    if (!stato.az) return Promise.resolve();
    clearTimeout(timerSalva);
    var fai = function () { return Arch.salva(stato.az).catch(function (e) { toast('Salvataggio non riuscito: ' + e.message); }); };
    if (subito) return fai();
    timerSalva = setTimeout(fai, 500);
    return Promise.resolve();
  }

  // qualità dei dati dell'esercizio: decide il livello di affidabilità mostrato accanto alle analisi
  function qualita(anno) {
    var val = (stato.az.esercizi[anno] || { valori: {} }).valori, n = nDi(anno) || {};
    var man = M.mancanti(n), sim = 0, daVer = 0, ver = 0;
    Object.keys(val).forEach(function (k) { var x = val[k]; if (x.origine === 'simulato') sim++; else if (x.stato === 'verificato') ver++; else daVer++; });
    var conf = M.COSTI_OPERATIVI.every(function (k) { var c = stato.az.classificazione && stato.az.classificazione[k]; return c && c.confermata; });
    var livello, testo;
    if (sim && !daVer && !ver) { livello = 'simulata'; testo = 'Dati simulati: i risultati servono a provare la piattaforma, non descrivono un\'azienda reale.'; }
    else if (man.length) { livello = 'bassa'; testo = 'Affidabilità bassa: mancano ' + man.length + ' voci di bilancio. Le voci assenti non vengono stimate.'; }
    else if (daVer) { livello = 'media'; testo = 'Affidabilità media: ' + daVer + ' valori non ancora verificati.'; }
    else { livello = 'alta'; testo = 'Affidabilità alta: tutti i valori risultano verificati.'; }
    return { livello: livello, testo: testo, mancanti: man, daVerificare: daVer, simulati: sim, classificazioneConfermata: conf };
  }
  function bannerQualita(anno, conClassificazione) {
    var q = qualita(anno), cls = q.livello === 'alta' ? 'ok' : q.livello === 'bassa' ? 'rosso' : '';
    var h = '<div class="avviso ' + cls + '">' + esc(q.testo) + '</div>';
    if (conClassificazione && !q.classificazioneConfermata) h += '<div class="avviso">Le quote di costi fissi e variabili sono ipotesi predefinite non confermate: punto di pareggio, margine di contribuzione e scenari sono solo indicativi. <button class="b p s" data-a="vai" data-scheda="bilancio" data-sub="costi">Conferma le quote</button></div>';
    return h;
  }

  // ------------------------------------------------------------ navigazione
  function disegnaNav() {
    $('#nav').innerHTML = SCHEDE.map(function (s) { return '<button data-a="scheda" data-scheda="' + s[0] + '" class="' + (stato.scheda === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('');
    $('#azBtn').textContent = stato.az ? stato.az.nome : 'Scegli azienda';
    var on = $('#nav .on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function selAnno() {
    var a = anni();
    if (!a.length) return '';
    return '<select data-c="anno" aria-label="Esercizio">' + a.map(function (x) { return '<option' + (x === stato.anno ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>';
  }
  function disegna() {
    disegnaNav();
    var m = $('#main');
    if (Arch.remoto() && !stato.utente && stato.scheda !== 'impostazioni') { m.innerHTML = vistaAccesso(); return; }
    if (!stato.az && ['collaudo', 'impostazioni'].indexOf(stato.scheda) < 0) { m.innerHTML = vistaBenvenuto(); return; }
    if (stato.az && !anni().length && ['bilancio', 'collaudo', 'impostazioni'].indexOf(stato.scheda) < 0) {
      m.innerHTML = '<h2>' + esc(stato.az.nome) + '</h2><div class="carta"><p>Non ci sono ancora esercizi. Inserisci o importa un bilancio per iniziare.</p><div class="riga"><button class="b" data-a="vai" data-scheda="bilancio" data-sub="dati">Vai al bilancio</button></div></div>';
      return;
    }
    m.innerHTML = ({ cruscotto: vistaCruscotto, bilancio: vistaBilancio, indici: vistaIndici, diagnosi: vistaDiagnosi, budget: vistaBudget, scenari: vistaScenari, collaudo: vistaCollaudo, impostazioni: vistaImpostazioni })[stato.scheda]();
  }

  function vistaBenvenuto() {
    return '<h2>Benvenuto</h2>' +
      '<div class="carta"><h3 style="margin-top:0">Prova subito con un\'azienda simulata</h3><p class="muto">Crea un\'azienda di fantasia con bilanci coerenti su più anni: serve a vedere e collaudare tutte le funzioni senza usare dati reali.</p><button class="b" data-a="scheda" data-scheda="collaudo">Apri la simulazione</button></div>' +
      '<div class="carta"><h3 style="margin-top:0">Azienda reale</h3><p class="muto">Crea l\'azienda e poi inserisci il bilancio a mano oppure importalo da Excel o CSV.</p><button class="b s" data-a="nuovaAzienda">Nuova azienda</button></div>';
  }
  function vistaAccesso() {
    return '<h2>Accesso</h2><div class="carta"><p class="muto">I dati sono su un database remoto: serve un account.</p>' +
      '<div class="campo"><label>Email</label><input type="email" id="lEmail" autocomplete="username"></div>' +
      '<div class="campo" style="margin-top:8px"><label>Password</label><input type="password" id="lPass" autocomplete="current-password"></div>' +
      '<div class="riga" style="margin-top:12px"><button class="b" data-a="accedi">Accedi</button><button class="b s" data-a="registra">Crea account</button></div></div>' +
      '<p class="muto">Per tornare ai dati su questo dispositivo apri Impostazioni.</p>';
  }

  // ------------------------------------------------------------ cruscotto
  function grafico(ser) {
    var W = 320, H = 150, pad = 22, max = 0;
    var dati = ser.filter(function (s) { return completo(s.anno, 'ce'); }).map(function (s) { var r = M.riclassifica(s.n, stato.az.classificazione); max = Math.max(max, r.valore_produzione, Math.abs(r.ebitda)); return { anno: s.anno, a: r.valore_produzione, b: r.ebitda }; });
    if (!max) return '<p class="muto">Nessun esercizio con conto economico completo.</p>';
    var passo = (W - pad) / dati.length, lb = Math.min(26, passo * 0.32), base = H - 20, sc = (base - 8) / max, out = '';
    dati.forEach(function (d, i) {
      var x = pad + i * passo + (passo - lb * 2 - 4) / 2;
      out += '<rect x="' + x + '" y="' + (base - d.a * sc) + '" width="' + lb + '" height="' + Math.max(1, d.a * sc) + '" rx="3" fill="var(--acc)"/>';
      var hb = Math.abs(d.b) * sc;
      out += '<rect x="' + (x + lb + 4) + '" y="' + (d.b >= 0 ? base - hb : base) + '" width="' + lb + '" height="' + Math.max(1, hb) + '" rx="3" fill="' + (d.b >= 0 ? '#e0a100' : 'var(--rosso)') + '"/>';
      out += '<text x="' + (x + lb) + '" y="' + (H - 4) + '" text-anchor="middle">' + d.anno + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Valore della produzione ed EBITDA per anno"><line x1="' + pad + '" x2="' + W + '" y1="' + base + '" y2="' + base + '" stroke="var(--linea)"/>' + out + '</svg>' +
      '<div class="leg"><span><i style="background:var(--acc)"></i>Valore della produzione</span><span><i style="background:#e0a100"></i>EBITDA</span></div>';
  }
  function vistaCruscotto() {
    var ser = serie(), i = anni().indexOf(stato.anno), n = nDi(stato.anno), p = (i > 0 && completo(ser[i - 1].anno)) ? ser[i - 1].n : null;
    var cl = stato.az.classificazione, r = M.riclassifica(n, cl), rp = p ? M.riclassifica(p, cl) : null;
    var tutto = completo(stato.anno), ceOk = completo(stato.anno, 'ce'), spOk = completo(stato.anno, 'sp');
    var diag = tutto ? M.diagnosi(serieCompleta(stato.anno), cl) : [];
    var ha = function (k) { return n[k] !== undefined; };
    function tile(nome, v, vp, scheda, sub, inverso, ok) {
      var d = '';
      if (ok === false) return '<button data-a="vai" data-scheda="bilancio" data-sub="dati"><div class="n">' + nome + '</div><div class="v">—</div><div class="d muto">dati mancanti</div></button>';
      if (vp !== null && vp !== undefined && isFinite(vp) && vp !== 0) {
        var dv = (v - vp) / Math.abs(vp), buono = inverso ? dv <= 0 : dv >= 0;
        d = '<div class="d ' + (buono ? 'su' : 'giu') + '">' + (dv >= 0 ? '▲ ' : '▼ ') + nf1.format(Math.abs(dv) * 100) + '% sul ' + ser[i - 1].anno + '</div>';
      }
      return '<button data-a="vai" data-scheda="' + scheda + '" data-sub="' + (sub || '') + '"><div class="n">' + nome + '</div><div class="v">' + eur(v) + '</div>' + d + '</button>';
    }
    var h = '<div class="riga"><h2 style="margin:0">' + esc(stato.az.nome) + '</h2><span class="sp"></span>' + selAnno() + '</div>' + bannerQualita(stato.anno);
    h += '<div class="kpi">' +
      tile('Ricavi', r.ricavi, rp && rp.ricavi, 'bilancio', 'riclassificato', false, ha('ricavi')) +
      tile('Costi totali', r.costi_totali, rp && rp.costi_totali, 'bilancio', 'riclassificato', true, ceOk) +
      tile('EBITDA', r.ebitda, rp && rp.ebitda, 'indici', '', false, ceOk) +
      tile('EBIT', r.ebit, rp && rp.ebit, 'indici', '', false, ceOk) +
      tile('Utile netto', r.utile, rp && rp.utile, 'indici', '', false, ceOk) +
      tile('Liquidità', n.liquidita, p && p.liquidita, 'bilancio', 'rendiconto', false, ha('liquidita')) +
      tile('Debito finanziario netto', r.pfn, rp && rp.pfn, 'indici', '', true, spOk) +
      tile('Crediti verso clienti', n.crediti_clienti, p && p.crediti_clienti, 'indici', '', true, ha('crediti_clienti')) +
      tile('Magazzino', n.rimanenze, p && p.rimanenze, 'indici', '', true, ha('rimanenze')) +
      tile('Costo del personale', r.personale, rp && rp.personale, 'indici', '', true, ha('personale')) +
      tile('Patrimonio netto', r.patrimonio_netto, rp && rp.patrimonio_netto, 'bilancio', 'riclassificato', false, tutto) +
      '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Andamento</h3>' + grafico(ser) + '</div>';
    var rossi = diag.filter(function (d) { return d.gravita === 'rosso'; }).length;
    h += '<div class="carta"><div class="riga"><h3 style="margin:0">Criticità ' + stato.anno + '</h3><span class="sp"></span>' +
      (!tutto ? '<span class="tag">non eseguita</span>' : diag.length ? '<span class="tag rosso">' + rossi + ' gravi</span><span class="tag giallo">' + (diag.length - rossi) + ' di attenzione</span>' : '<span class="tag ok">nessuna</span>') + '</div>';
    if (!tutto) h += '<p class="muto">Diagnosi non eseguita: il bilancio ' + stato.anno + ' è incompleto.</p>';
    else if (!diag.length) h += '<p class="muto">Nessuna delle regole di controllo ha rilevato criticità. Non è una garanzia: le regole usano soglie generali e solo i dati di bilancio.</p>';
    diag.slice(0, 3).forEach(function (d) { h += '<p><span class="tag ' + d.gravita + '">' + d.priorita + '</span> <b>' + esc(d.titolo) + '</b><br><span class="muto">' + esc(d.dati) + '</span></p>'; });
    if (diag.length) h += '<button class="b s p" data-a="scheda" data-scheda="diagnosi">Vedi diagnosi completa</button>';
    h += '</div>';
    var b = stato.az.budget && stato.az.budget[stato.anno];
    if (b && ceOk) { var sc = M.scostamenti(b.voci, n, cl); h += '<div class="carta"><h3 style="margin-top:0">Budget ' + stato.anno + '</h3><p>EBITDA a consuntivo ' + eur(sc.righe[7].consuntivo) + ' contro ' + eur(sc.righe[7].budget) + ' a budget: <b class="' + (sc.deltaEbitda >= 0 ? 'su' : 'giu') + '">' + (sc.deltaEbitda >= 0 ? '+' : '−') + eur(Math.abs(sc.deltaEbitda)) + '</b></p><button class="b s p" data-a="scheda" data-scheda="budget">Vedi scostamenti</button></div>'; }
    return h;
  }

  // ------------------------------------------------------------ bilancio
  var SUB_BIL = [['dati', 'Dati'], ['riclassificato', 'Riclassificato'], ['costi', 'Fissi e variabili'], ['rendiconto', 'Rendiconto'], ['importa', 'Importa / esporta'], ['storico', 'Storico']];
  function vistaBilancio() {
    var h = '<div class="riga"><h2 style="margin:0">Bilancio</h2><span class="sp"></span>' + selAnno() + '</div>';
    h += '<div class="sub">' + SUB_BIL.map(function (s) { return '<button data-a="sub" data-sub="' + s[0] + '" class="' + (stato.sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
    var f = { dati: bilDati, riclassificato: bilRicl, costi: bilCosti, rendiconto: bilRend, importa: bilImporta, storico: bilStorico }[stato.sub] || bilDati;
    return h + f();
  }
  function bilDati() {
    var h = '<div class="riga">' + (scrivibile() ? '<button class="b p s" data-a="nuovoAnno">Aggiungi esercizio</button>' : '') +
      (stato.anno && scrivibile() ? '<button class="b p s" data-a="verificaTutti">Segna tutto come verificato</button>' + (M.mancanti(nDi(stato.anno)).length ? '<button class="b p s" data-a="azzeraMancanti">Le voci vuote valgono zero</button>' : '') + '<button class="b p peri" data-a="eliminaAnno">Elimina ' + stato.anno + '</button>' : '') + '</div>';
    if (!stato.anno) return h + '<p class="muto">Aggiungi un esercizio oppure importa un file dalla scheda “Importa / esporta”.</p>';
    var val = stato.az.esercizi[stato.anno].valori, n = nDi(stato.anno), r = M.riclassifica(n, stato.az.classificazione);
    h += bannerQualita(stato.anno);
    if (Math.abs(r.quadratura) > 1) h += '<div class="avviso rosso">Lo stato patrimoniale non quadra: attivo ' + eur(r.totale_attivo) + ', passivo e netto ' + eur(r.totale_passivo) + ' (differenza ' + eur(r.quadratura) + ').</div>';
    else if (!M.mancanti(n).length) h += '<div class="avviso ok">Attivo e passivo quadrano: ' + eur(r.totale_attivo) + '.</div>';
    var sez = { ce: 'Conto economico (i costi si inseriscono in positivo)', att: 'Stato patrimoniale · attivo', pas: 'Stato patrimoniale · passivo e netto', ges: 'Dati gestionali (non presenti nel bilancio)' };
    ['ce', 'att', 'pas', 'ges'].forEach(function (t) {
      h += '<div class="carta"><h3 style="margin-top:0">' + sez[t] + '</h3>';
      M.VOCI.filter(function (v) { return v.tipo === t; }).forEach(function (v) {
        var x = val[v.id], c = x && typeof x.v === 'number';
        h += '<div class="voce"><label for="v_' + v.id + '">' + esc(v.nome) + (v.rif ? ' <span class="muto">(' + v.rif + ')</span>' : '') + '</label>' +
          '<input type="text" inputmode="decimal" id="v_' + v.id + '" data-c="valore" data-voce="' + v.id + '" value="' + (c ? nf0.format(x.v) : '') + '" placeholder="mancante"' + (scrivibile() ? '' : ' disabled') + '>';
        if (c) h += '<div class="meta"><span class="tag ' + esc(x.origine) + '">' + esc(x.origine) + '</span>' + (x.fonte ? '<span class="muto">' + esc(x.fonte) + '</span>' : '') +
          (x.origine !== 'simulato' ? '<label><input type="checkbox" data-c="verificato" data-voce="' + v.id + '"' + (x.stato === 'verificato' ? ' checked' : '') + (scrivibile() ? '' : ' disabled') + '> verificato</label>' : '') + '</div>';
        h += '</div>';
      });
      h += '</div>';
    });
    return h;
  }
  function tabella(righe, ser, valore) {
    var h = '<div class="scorri"><table><tr><th></th>' + ser.map(function (s) { return '<th>' + s.anno + '</th>'; }).join('') + '</tr>';
    righe.forEach(function (x) {
      if (x.length === 1) { h += '<tr class="sez"><td colspan="' + (ser.length + 1) + '">' + x[0] + '</td></tr>'; return; }
      h += '<tr class="' + (x[2] ? 'tot' : '') + '"><td>' + x[1] + '</td>' + ser.map(function (s) { return '<td>' + valore(s, x[0], x[3]) + '</td>'; }).join('') + '</tr>';
    });
    return h + '</table></div>';
  }
  function bilRicl() {
    var ser = serie(), cl = stato.az.classificazione;
    var cache = {}; ser.forEach(function (s) { cache[s.anno] = M.riclassifica(s.n, cl); });
    var val = function (s, k, tipo) { var r = cache[s.anno]; if (tipo === 'n') return fmt(s.n[k] === undefined ? null : s.n[k], 'eur'); if (tipo === 'neg') return fmt(s.n[k] === undefined ? null : -s.n[k], 'eur'); return fmt(r[k], 'eur'); };
    var ce = [['Conto economico a valore aggiunto'], ['ricavi', 'Ricavi delle vendite', 0, 'n'], ['var_rim_prodotti', 'Variazione rimanenze prodotti', 0, 'n'], ['altri_ricavi', 'Altri ricavi', 0, 'n'], ['valore_produzione', 'Valore della produzione', 1],
      ['consumi_materie', 'Consumi di materie'], ['servizi', 'Servizi', 0, 'n'], ['godimento', 'Godimento beni di terzi', 0, 'n'], ['oneri_diversi', 'Oneri diversi di gestione', 0, 'n'], ['valore_aggiunto', 'Valore aggiunto', 1],
      ['personale', 'Costo del personale'], ['ebitda', 'EBITDA', 1], ['ammortamenti_acc', 'Ammortamenti, svalutazioni, accantonamenti'], ['ebit', 'EBIT', 1],
      ['gestione_finanziaria', 'Gestione finanziaria'], ['risultato_ante_imposte', 'Risultato ante imposte', 1], ['imposte', 'Imposte'], ['utile', 'Utile netto', 1]];
    var sp = [['Stato patrimoniale finanziario'], ['immobilizzazioni', 'Immobilizzazioni'], ['rimanenze', 'Rimanenze', 0, 'n'], ['crediti_clienti', 'Crediti verso clienti', 0, 'n'], ['altri_crediti', 'Altri crediti', 0, 'n'], ['liquidita', 'Disponibilità liquide', 0, 'n'], ['attivo_corrente', 'Attivo corrente', 1], ['totale_attivo', 'Totale attivo', 1],
      ['patrimonio_netto', 'Patrimonio netto', 1], ['passivo_consolidato', 'Passivo consolidato (fondi, TFR, debiti a lungo)'], ['passivo_corrente', 'Passivo corrente'], ['totale_passivo', 'Totale passivo e netto', 1],
      ['Grandezze di sintesi'], ['debiti_finanziari', 'Debiti finanziari'], ['pfn', 'Posizione finanziaria netta', 1], ['ccn', 'Capitale circolante netto'], ['capitale_investito', 'Capitale investito netto'], ['quadratura', 'Quadratura (attivo − passivo)']];
    return '<div class="carta">' + tabella(ce, ser, val) + '</div><div class="carta">' + tabella(sp, ser, val) + '</div><p class="muto">Il passivo corrente comprende debiti bancari entro 12 mesi, fornitori, debiti tributari e previdenziali, altri debiti e ratei: nel bilancio abbreviato la ripartizione per scadenza va verificata in nota integrativa.</p>';
  }
  function bilCosti() {
    var n = nDi(stato.anno), cl = stato.az.classificazione || {}, r = M.riclassifica(n, cl);
    var h = '<div class="avviso info">Il bilancio non dice quali costi sono fissi e quali variabili. Per ogni voce indica la quota che cresce con i volumi, in base a come funziona davvero l\'azienda (contratti, turni, provvigioni, consumi). Finché una quota non è confermata resta un\'ipotesi.</div><div class="carta">';
    M.COSTI_OPERATIVI.forEach(function (k) {
      var q = M.quota(cl, k), conf = cl[k] && cl[k].confermata;
      h += '<div class="cursore"><div class="et">' + esc(M.VOCE[k].nome) + ' · <span class="muto">' + eur(n[k] || 0) + '</span> ' + (conf ? '<span class="tag ok">confermata</span>' : '<span class="tag giallo">ipotesi</span>') + '</div>' +
        '<input type="range" min="0" max="100" step="5" value="' + Math.round(q * 100) + '" data-c="quota" data-voce="' + k + '" aria-label="Quota variabile"' + (scrivibile() ? '' : ' disabled') + '><output>' + Math.round(q * 100) + '% var.</output></div>';
    });
    h += '<div class="riga" style="margin-top:12px">' + (scrivibile() ? '<button class="b p" data-a="confermaQuote">Conferma tutte le quote</button>' : '') + '</div></div>';
    h += '<div class="carta"><table><tr><th>' + stato.anno + '</th><th></th></tr><tr><td>Costi variabili</td><td>' + eur(r.costi_variabili) + '</td></tr><tr><td>Costi fissi operativi</td><td>' + eur(r.costi_fissi) + '</td></tr><tr><td>Margine di contribuzione</td><td>' + eur(r.margine_contribuzione) + ' (' + fmt(r.mc_pct, 'pct') + ')</td></tr><tr class="tot"><td>Punto di pareggio</td><td>' + eur(r.bep) + '</td></tr><tr><td>Margine di sicurezza</td><td>' + fmt(r.margine_sicurezza, 'pct') + '</td></tr></table></div>';
    return h;
  }
  function bilRend() {
    var a = anni(), ser = serie();
    if (a.length < 2) return '<p class="muto">Il rendiconto finanziario si ricostruisce dalle variazioni tra due esercizi: servono almeno due anni.</p>';
    var cl = stato.az.classificazione, coppie = ser.slice(1).map(function (s, i) { return { anno: s.anno, rd: M.rendiconto(s.n, ser[i].n, cl) }; });
    var righe = [['Flussi della gestione operativa'], ['autofinanziamento', 'Utile + ammortamenti + variazione fondi e TFR'], ['var_ccn', 'Variazione capitale circolante operativo (− se assorbe cassa)', 0, 'neg'], ['flusso_operativo', 'Flusso operativo', 1],
      ['Investimenti e finanziamenti'], ['flusso_investimenti', 'Flusso degli investimenti'], ['var_debiti_fin', 'Variazione debiti finanziari'], ['mezzi_propri', 'Apporti dei soci meno dividendi'], ['flusso_finanziario', 'Flusso finanziario', 1],
      ['Liquidità'], ['variazione_liquidita', 'Variazione della liquidità', 1], ['differenza', 'Differenza non spiegata']];
    var h = '<div class="carta"><div class="scorri"><table><tr><th></th>' + coppie.map(function (c) { return '<th>' + c.anno + '</th>'; }).join('') + '</tr>';
    righe.forEach(function (x) {
      if (x.length === 1) { h += '<tr class="sez"><td colspan="9">' + x[0] + '</td></tr>'; return; }
      h += '<tr class="' + (x[2] ? 'tot' : '') + '"><td>' + x[1] + '</td>' + coppie.map(function (c) { return '<td>' + eur(x[3] === 'neg' ? -c.rd[x[0]] : c.rd[x[0]]) + '</td>'; }).join('') + '</tr>';
    });
    return h + '</table></div></div><p class="muto">Rendiconto ricostruito con il metodo indiretto dalle variazioni di stato patrimoniale: è una stima, non sostituisce il rendiconto redatto dall\'azienda. Una “differenza non spiegata” diversa da zero indica bilanci che non quadrano.</p>';
  }
  function bilImporta() {
    var h = '<div class="carta"><h3 style="margin-top:0">Importa da Excel o CSV</h3><p class="muto">Una riga per voce, una colonna per anno. Scarica il modello, compilalo e ricaricalo. Le righe non riconosciute non vengono scartate né indovinate: le assegni tu.</p>' +
      '<div class="riga"><button class="b p s" data-a="modello">Scarica il modello</button>' + (scrivibile() ? '<label class="b p" style="color:#fff;cursor:pointer">Scegli file<input type="file" accept=".csv,.txt,.xlsx,.xls" data-c="file" hidden></label>' : '') + '</div></div>';
    var im = stato.importazione;
    if (im) {
      h += '<div class="carta"><h3 style="margin-top:0">Anteprima · ' + esc(im.nome) + '</h3>';
      im.avvisi.forEach(function (a) { h += '<div class="avviso">' + esc(a) + '</div>'; });
      if (!im.righe.length) h += '<p>Nessuna riga con valori numerici trovata.</p>';
      else {
        var opz = function (sel) { return '<option value="">— non importare —</option>' + M.VOCI.map(function (v) { return '<option value="' + v.id + '"' + (v.id === sel ? ' selected' : '') + '>' + esc(v.nome) + '</option>'; }).join(''); };
        h += '<p class="muto">Anni trovati: ' + im.anni.join(', ') + ' · riconosciute ' + im.righe.filter(function (r) { return r.voce; }).length + ' righe su ' + im.righe.length + '.</p>';
        im.righe.forEach(function (r, i) {
          h += '<div class="voce" style="grid-template-columns:1fr"><div><b>' + esc(r.etichetta) + '</b> <span class="muto">' + im.anni.map(function (a) { return r.valori[a] === undefined ? '' : a + ': ' + nf0.format(r.valori[a]); }).filter(Boolean).join(' · ') + '</span></div><select data-c="assegna" data-i="' + i + '">' + opz(r.voce) + '</select></div>';
        });
        h += '<div class="riga" style="margin-top:12px"><button class="b" data-a="confermaImport">Importa</button><button class="b s" data-a="annullaImport">Annulla</button></div>';
      }
      h += '</div>';
    }
    h += '<div class="carta"><h3 style="margin-top:0">Esporta</h3><div class="riga"><button class="b p s" data-a="esportaCsv">Bilanci in CSV</button><button class="b p s" data-a="esportaJson">Azienda completa (JSON)</button></div><p class="muto">Il file JSON contiene tutto (dati, storico, budget, scenari) e si può reimportare da Impostazioni: serve per copie di sicurezza e per spostare un\'azienda da un archivio all\'altro.</p></div>';
    h += '<div class="carta"><h3 style="margin-top:0">Altri formati</h3><p class="muto">Bilancio XBRL, PDF con riconoscimento del testo e bilancio di verifica dal gestionale sono previsti ma non ancora attivi: per ciascuno serve almeno un file reale di esempio su cui costruire e verificare la lettura.</p></div>';
    return h;
  }
  function bilStorico() {
    var st = (stato.az.storico || []).slice(-200).reverse();
    if (!st.length) return '<p class="muto">Nessuna modifica registrata.</p>';
    var h = '<div class="carta"><div class="scorri"><table><tr><th>Voce</th><th>Anno</th><th>Da</th><th>A</th><th>Origine</th><th>Quando</th></tr>';
    st.forEach(function (s) { h += '<tr><td>' + esc(M.VOCE[s.voce] ? M.VOCE[s.voce].nome : s.voce) + '</td><td>' + s.anno + '</td><td>' + (s.da === null || s.da === undefined ? '—' : nf0.format(s.da)) + '</td><td>' + (s.a === null || s.a === undefined ? '—' : nf0.format(s.a)) + '</td><td>' + esc(s.origine || '') + '</td><td>' + esc(new Date(s.quando).toLocaleString('it-IT')) + '</td></tr>'; });
    return h + '</table></div></div>';
  }

  // ------------------------------------------------------------ indici
  function vistaIndici() {
    var a = anni(), i = a.indexOf(stato.anno), n = nDi(stato.anno), p = i > 0 ? nDi(a[i - 1]) : null, pp = i > 1 ? nDi(a[i - 2]) : null;
    var cl = stato.az.classificazione, ix = M.calcolaIndici(n, p, cl), ixp = p ? M.calcolaIndici(p, pp, cl) : null;
    var h = '<div class="riga"><h2 style="margin:0">Indici</h2><span class="sp"></span>' + selAnno() + '</div>' + bannerQualita(stato.anno, true) +
      '<p class="muto">Tocca un indice per vedere formula, voci usate, significato, limiti e azioni possibili. I valori di riferimento settoriali arriveranno con il modulo di benchmarking: qui non vengono inventati.</p>';
    var gruppi = [];
    M.INDICI.forEach(function (d) { if (gruppi.indexOf(d.gruppo) < 0) gruppi.push(d.gruppo); });
    gruppi.forEach(function (g) {
      h += '<div class="carta"><h3 style="margin-top:0">' + g + '</h3>';
      M.INDICI.filter(function (d) { return d.gruppo === g; }).forEach(function (d) {
        var x = ix[d.id];
        h += '<details><summary><span class="nome">' + esc(d.nome) + ' <span class="tag">' + (d.fonte === 'bilancio' ? 'da bilancio' : 'richiede dati gestionali') + '</span>' + (x.incompleto ? ' <span class="tag giallo">dati mancanti</span>' : '') + '</span>' +
          '<span><span class="val">' + fmt(x.v, d.unita) + '</span>' + (ixp ? '<br><span class="pre">' + a[i - 1] + ': ' + fmt(ixp[d.id].v, d.unita) + '</span>' : '') + '</span></summary><div class="spiega">' +
          (x.motivo ? '<div class="avviso">' + esc(x.motivo) + '</div>' : '') +
          '<b>Formula</b>' + esc(d.formula) + '<b>Voci di bilancio usate</b>' + d.usa.map(function (k) { return esc(M.VOCE[k].nome) + ': ' + (n[k] === undefined ? 'mancante' : (M.VOCE[k].unita === 'n' ? nf0.format(n[k]) : eur(n[k]))); }).join(' · ') +
          '<b>Perché queste voci</b>' + esc(d.perche) + '<b>Significato</b>' + esc(d.significato) + '<b>Come leggerlo</b>' + esc(d.lettura) + '<b>Limiti</b>' + esc(d.limiti) + '<b>Azioni possibili</b>' + esc(d.azioni) + '</div></details>';
      });
      h += '</div>';
    });
    return h;
  }

  // ------------------------------------------------------------ diagnosi
  function vistaDiagnosi() {
    var testa = '<div class="riga"><h2 style="margin:0">Diagnosi</h2><span class="sp"></span>' + selAnno() + '</div>';
    if (!completo(stato.anno)) return testa + bloccoIncompleto(stato.anno, 'Diagnosi');
    var d = M.diagnosi(serieCompleta(stato.anno), stato.az.classificazione), q = qualita(stato.anno);
    var h = testa + bannerQualita(stato.anno, true) +
      '<p class="muto">Criticità ordinate per priorità. Le soglie sono regole generali di prudenza, non medie del settore; ogni importo è calcolato dai dati inseriti con la formula indicata nella scheda Indici.</p>';
    if (!d.length) return h + '<div class="avviso ok">Nessuna regola ha rilevato criticità sull\'esercizio ' + stato.anno + '.</div>';
    var aff = { simulata: 'dati simulati', alta: 'alta', media: 'media (dati non verificati)', bassa: 'bassa (dati incompleti)' }[q.livello];
    d.forEach(function (c) {
      var gest = ['pareggio'].indexOf(c.id) >= 0 && !q.classificazioneConfermata;
      h += '<div class="carta crit ' + c.gravita + '"><h3><span class="tag ' + c.gravita + '">Priorità ' + c.priorita + '</span> ' + esc(c.titolo) + '</h3><dl>' +
        '<div><dt>Dati che lo dimostrano</dt><dd>' + esc(c.dati) + '</dd></div><div><dt>Causa probabile (ipotesi)</dt><dd>' + esc(c.causa) + '</dd></div>' +
        '<div><dt>Intervento consigliato</dt><dd>' + esc(c.intervento) + '</dd></div><div><dt>Quanto pesa</dt><dd>' + esc(c.effetto) + '</dd></div>' +
        '<div><dt>Affidabilità</dt><dd>' + aff + (gest ? ' · basata su quote fissi/variabili non confermate' : '') + '</dd></div></dl></div>';
    });
    return h + '<p class="muto">Costo dell\'intervento, investimento necessario e tempo di recupero richiedono dati che il bilancio non contiene (preventivi, contratti, piani): verranno chiesti dal modulo investimenti, non stimati a caso.</p>';
  }

  // ------------------------------------------------------------ budget
  var IP_BUDGET = [['ricavi', 'Ricavi'], ['materie', 'Materie'], ['servizi', 'Servizi'], ['godimento', 'Godimento beni di terzi'], ['personale', 'Personale'], ['oneri_diversi', 'Oneri diversi'], ['ammortamenti', 'Ammortamenti'], ['oneri_fin', 'Oneri finanziari']];
  function vistaBudget() {
    var a = anni(), ultimo = a[a.length - 1], bud = stato.az.budget || {}, annoB = stato.annoBudget || (Object.keys(bud).length ? Math.max.apply(null, Object.keys(bud).map(Number)) : ultimo + 1);
    stato.annoBudget = annoB;
    var b = bud[annoB], cl = stato.az.classificazione;
    var scelte = []; for (var y = a[0] + 1; y <= ultimo + 3; y++) scelte.push(y);
    var h = '<div class="riga"><h2 style="margin:0">Budget</h2><span class="sp"></span><select data-c="annoBudget">' + scelte.map(function (x) { return '<option' + (x === annoB ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>';
    var base = b ? b.base : (a.filter(function (x) { return x < annoB; }).pop() || ultimo), ip = (b && b.ipotesi) || {};
    h += '<div class="carta"><h3 style="margin-top:0">Ipotesi per il ' + annoB + ' <span class="muto">(variazioni % sul ' + base + ')</span></h3><div class="riga">';
    IP_BUDGET.forEach(function (x) { h += '<div class="campo"><label>' + x[1] + ' %</label><input type="number" step="0.5" data-ip="' + x[0] + '" value="' + (ip[x[0]] !== undefined ? ip[x[0]] * 100 : 0) + '"></div>'; });
    h += '</div><div class="riga" style="margin-top:12px">' + (scrivibile() ? '<button class="b" data-a="creaBudget" data-base="' + base + '">' + (b ? 'Ricalcola budget' : 'Crea budget') + '</button>' + (b ? '<button class="b peri" data-a="eliminaBudget">Elimina</button>' : '') : '') + '</div>' +
      '<p class="muto">Il budget è una previsione costruita sulle ipotesi che dichiari: le voci non indicate restano uguali all\'anno base.</p></div>';
    if (!b) return h;
    var rb = M.riclassifica(b.voci, cl), cons = completo(annoB, 'ce') ? nDi(annoB) : null;
    if (nDi(annoB) && !cons) h += '<div class="avviso">Il bilancio ' + annoB + ' è presente ma il conto economico è incompleto: il confronto con il consuntivo comparirà quando sarà completo.</div>';
    if (cons) {
      var sc = M.scostamenti(b.voci, cons, cl);
      h += '<div class="carta"><h3 style="margin-top:0">Budget e consuntivo ' + annoB + '</h3><div class="scorri"><table><tr><th></th><th>Budget</th><th>Consuntivo</th><th>Scostamento</th><th>%</th></tr>';
      sc.righe.forEach(function (x) { h += '<tr class="' + (['ebitda', 'ebit', 'utile', 'valore_produzione'].indexOf(x.id) >= 0 ? 'tot' : '') + '"><td>' + x.nome + '</td><td>' + eur(x.budget) + '</td><td>' + eur(x.consuntivo) + '</td><td class="' + (x.favorevole ? 'su' : 'giu') + '">' + (x.delta >= 0 ? '+' : '−') + nf0.format(Math.abs(Math.round(x.delta))) + '</td><td>' + fmt(x.deltaPct, 'pct') + '</td></tr>'; });
      h += '</table></div></div><div class="carta"><h3 style="margin-top:0">Cosa spiega lo scostamento di EBITDA (' + (sc.deltaEbitda >= 0 ? '+' : '−') + eur(Math.abs(sc.deltaEbitda)) + ')</h3>';
      if (!sc.cause.length) h += '<p class="muto">Nessuno scostamento rilevante.</p>';
      sc.cause.forEach(function (x) { h += '<p><span class="tag ' + (x.effettoEbitda >= 0 ? 'ok' : 'rosso') + '">' + (x.effettoEbitda >= 0 ? '+' : '−') + eur(Math.abs(x.effettoEbitda)) + '</span> ' + x.nome + ': ' + eur(x.consuntivo) + ' contro ' + eur(x.budget) + ' previsti</p>'; });
      h += '<p class="muto">La scomposizione indica quali voci hanno generato lo scostamento. Distinguere l\'effetto prezzo dall\'effetto volume richiede i dati di vendita e di acquisto, non il solo bilancio.</p></div>';
    } else {
      var nb = nDi(base), r0 = nb ? M.riclassifica(nb, cl) : null;
      h += '<div class="carta"><h3 style="margin-top:0">Budget ' + annoB + ' <span class="tag">previsto</span></h3><div class="scorri"><table><tr><th></th><th>' + base + '</th><th>Budget ' + annoB + '</th></tr>';
      [['valore_produzione', 'Valore della produzione'], ['costi_esterni', 'Costi esterni'], ['personale', 'Personale'], ['ebitda', 'EBITDA'], ['ebit', 'EBIT'], ['utile', 'Utile netto (imposte invariate)']].forEach(function (x) { h += '<tr class="' + (x[0] === 'ebitda' ? 'tot' : '') + '"><td>' + x[1] + '</td><td>' + (r0 ? eur(r0[x[0]]) : '—') + '</td><td>' + eur(rb[x[0]]) + '</td></tr>'; });
      h += '</table></div><p class="muto">Quando inserirai il bilancio ' + annoB + ', qui comparirà il confronto con il consuntivo e la spiegazione degli scostamenti.</p></div>';
    }
    return h;
  }

  // ------------------------------------------------------------ scenari
  var LEVE = [['volumi', 'Volumi venduti', -30, 30], ['prezzi', 'Prezzi di vendita', -15, 15], ['materie', 'Costo delle materie', -20, 30], ['servizi', 'Costo dei servizi (energia compresa)', -20, 30], ['personale', 'Costo del personale', -10, 20], ['altri', 'Affitti e altri costi', -10, 20], ['oneri_fin', 'Interessi passivi', -30, 60]];
  function scenario(k) { return Object.assign({}, M.SCENARI_PREDEFINITI[k], (stato.az.scenari || {})[k] || {}); }
  function vistaScenari() {
    if (!completo(stato.anno)) return '<div class="riga"><h2 style="margin:0">Scenari</h2><span class="sp"></span>' + selAnno() + '</div>' + bloccoIncompleto(stato.anno, 'Simulazione degli scenari');
    var n = nDi(stato.anno), cl = stato.az.classificazione, r0 = M.riclassifica(n, cl);
    var ch = ['prudenziale', 'centrale', 'favorevole'], ris = {};
    ch.forEach(function (k) { ris[k] = M.simula(n, cl, scenario(k)); });
    var h = '<div class="riga"><h2 style="margin:0">Scenari</h2><span class="sp"></span>' + selAnno() + '</div>' + bannerQualita(stato.anno, true) +
      '<p class="muto">Cosa succederebbe ai conti del ' + stato.anno + ' cambiando prezzi, volumi e costi. Sono simulazioni su ipotesi dichiarate, non previsioni certe.</p>';
    h += '<div class="carta"><div class="scorri"><table id="tabScen"><tr><th></th><th>' + stato.anno + '</th>' + ch.map(function (k) { return '<th>' + scenario(k).nome + '</th>'; }).join('') + '</tr>';
    var righe = [['Valore della produzione', function (s) { return s.r.valore_produzione; }, r0.valore_produzione], ['EBITDA', function (s) { return s.r.ebitda; }, r0.ebitda, 1], ['EBIT', function (s) { return s.r.ebit; }, r0.ebit],
      ['Utile netto', function (s) { return s.r.utile; }, r0.utile, 1], ['Flusso di cassa stimato', function (s) { return s.flusso_cassa; }, null], ['Debito finanziario netto previsto', function (s) { return s.pfn_prevista; }, r0.pfn]];
    righe.forEach(function (x) { h += '<tr class="' + (x[3] ? 'tot' : '') + '"><td>' + x[0] + '</td><td>' + eur(x[2]) + '</td>' + ch.map(function (k) { return '<td>' + eur(x[1](ris[k])) + '</td>'; }).join('') + '</tr>'; });
    h += '<tr><td>PFN / EBITDA</td><td>' + fmt(r0.ebitda > 0 ? r0.pfn / r0.ebitda : null, 'x') + '</td>' + ch.map(function (k) { return '<td>' + fmt(ris[k].pfn_ebitda, 'x') + '</td>'; }).join('') + '</tr></table></div></div>';
    h += '<div class="sub">' + ch.map(function (k) { return '<button data-a="scenAperto" data-k="' + k + '" class="' + (stato.scenAperto === k ? 'on' : '') + '">Ipotesi ' + scenario(k).nome.toLowerCase() + '</button>'; }).join('') + '</div><div class="carta">';
    var sc = scenario(stato.scenAperto);
    LEVE.forEach(function (l) {
      var v = Math.round((sc[l[0]] || 0) * 100);
      h += '<div class="cursore"><div class="et">' + l[1] + '</div><input type="range" min="' + l[2] + '" max="' + l[3] + '" step="1" value="' + v + '" data-c="leva" data-leva="' + l[0] + '" aria-label="' + l[1] + '"><output>' + (v > 0 ? '+' : '') + v + '%</output></div>';
    });
    h += '<div class="riga" style="margin-top:12px"><button class="b p s" data-a="ripristinaScenario">Ripristina ipotesi predefinite</button></div></div>';
    var al = ris.centrale;
    h += '<div class="carta"><h3 style="margin-top:0">Quanto devo produrre per ottenere un certo utile?</h3><div class="riga"><div class="campo"><label>Utile netto desiderato (€)</label><input type="text" inputmode="numeric" id="utileObiettivo" value="' + (stato.utileObiettivo !== undefined ? nf0.format(stato.utileObiettivo) : '') + '"></div><button class="b" data-a="calcolaObiettivo">Calcola</button></div><div id="esitoObiettivo">' + esitoObiettivo() + '</div></div>';
    h += '<p class="muto"><b>Ipotesi di calcolo.</b> I costi variabili seguono i volumi secondo le quote impostate; il capitale circolante commerciale segue i ricavi; ammortamenti invariati; imposte al ' + fmt(al.aliquota, 'pct') + (al.aliquotaStimata ? ' (aliquota ipotizzata: IRES 24% + IRAP 3,9%, perché quella effettiva dell\'anno non è utilizzabile)' : ' (aliquota effettiva dell\'anno)') + '. Non sono considerati nuovi investimenti, reazioni dei clienti ai prezzi né limiti di capacità produttiva.</p>';
    return h;
  }
  function esitoObiettivo() {
    if (stato.utileObiettivo === undefined) return '';
    var n = nDi(stato.anno), cl = stato.az.classificazione, r = M.riclassifica(n, cl), o = M.produzionePerUtile(n, cl, stato.utileObiettivo);
    if (!o) return '<div class="avviso rosso">Non calcolabile: il margine di contribuzione è nullo o negativo, quindi produrre di più non migliora il risultato.</div>';
    return '<div class="avviso info">Per un utile netto di ' + eur(stato.utileObiettivo) + ' serve un valore della produzione di <b>' + eur(o.valore_produzione) + '</b> (' + (o.aumento >= 0 ? '+' : '') + fmt(o.aumento, 'pct') + ' rispetto a ' + eur(r.valore_produzione) + '), a prezzi e struttura dei costi invariati.<br>Formula: (costi fissi ' + eur(r.costi_fissi) + ' − gestione finanziaria ' + eur(r.gestione_finanziaria) + ' + utile ante imposte) ÷ margine di contribuzione ' + fmt(r.mc_pct, 'pct') + '.</div>';
  }

  // ------------------------------------------------------------ simulazione e collaudo
  function vistaCollaudo() {
    var s = stato.simForm || { settore: 'manifatturiera', profilo: 'sana', ricavi: 2000000, anni: 4, seme: '' };
    stato.simForm = s;
    var h = '<h2>Simulazione generale</h2><p class="muto">Serve a provare e collaudare la piattaforma: crea aziende di fantasia con bilanci coerenti, oppure verifica i calcoli su un\'azienda con dati inseriti o importati.</p>';
    h += '<div class="carta"><h3 style="margin-top:0">1 · Crea un\'azienda simulata</h3><div class="riga">' +
      '<div class="campo"><label>Settore</label><select data-sim="settore">' + Object.keys(Sim.SETTORI).map(function (k) { return '<option value="' + k + '"' + (s.settore === k ? ' selected' : '') + '>' + Sim.SETTORI[k].nome + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Situazione da simulare</label><select data-sim="profilo">' + Object.keys(Sim.PROFILI).map(function (k) { return '<option value="' + k + '"' + (s.profilo === k ? ' selected' : '') + '>' + Sim.PROFILI[k].nome + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Ricavi ultimo anno (€)</label><input type="number" min="50000" step="50000" data-sim="ricavi" value="' + s.ricavi + '"></div>' +
      '<div class="campo"><label>Anni di storia</label><select data-sim="anni">' + [2, 3, 4, 5, 6].map(function (x) { return '<option' + (Number(s.anni) === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Seme (vuoto = casuale)</label><input type="number" data-sim="seme" value="' + esc(s.seme) + '"></div></div>' +
      '<p class="muto">' + esc(Sim.PROFILI[s.profilo].descr) + ' Lo stesso seme ricrea sempre la stessa azienda. I parametri dei settori sono di fantasia e non rappresentano medie reali.</p>' +
      '<button class="b" data-a="generaSim">Crea azienda simulata</button></div>';
    h += '<div class="carta"><h3 style="margin-top:0">2 · Collauda l\'azienda aperta</h3>';
    if (!stato.az || !anni().length) h += '<p class="muto">Apri o crea un\'azienda con almeno un esercizio.</p>';
    else {
      h += '<p class="muto">Controlli di coerenza su <b>' + esc(stato.az.nome) + '</b>: quadrature, identità contabili, rendiconto, punto di pareggio' + (stato.az.simulata ? ', e verifica che la diagnosi riconosca il problema introdotto di proposito' : '') + '.</p><button class="b" data-a="collauda">Esegui il collaudo</button>';
      var e = stato.esitoCollaudo;
      if (e) {
        h += '<div class="avviso ' + (e.superati === e.totale ? 'ok' : 'rosso') + '" style="margin-top:12px">' + e.superati + ' controlli superati su ' + e.totale + '</div>';
        e.esiti.filter(function (x) { return !x.ok; }).concat(e.esiti.filter(function (x) { return x.ok; })).forEach(function (x) { h += '<div class="esito ' + (x.ok ? 'ok' : 'ko') + '"><i>' + (x.ok ? '✓' : '✗') + '</i><div>' + esc(x.nome) + '<br><span class="muto">' + esc(x.dettaglio) + '</span></div></div>'; });
      }
    }
    h += '</div><div class="carta"><h3 style="margin-top:0">3 · Collaudo massivo del motore</h3><p class="muto">Genera 150 aziende (tutti i settori e tutte le situazioni, 5 semi ciascuna) ed esegue su ognuna tutti i controlli. Non salva nulla.</p><button class="b s" data-a="massivo">Esegui</button>';
    var m = stato.esitoMassivo;
    if (m) {
      h += '<div class="avviso ' + (m.falliti.length ? 'rosso' : 'ok') + '" style="margin-top:12px">' + m.aziende + ' aziende, ' + nf0.format(m.superati) + ' controlli superati su ' + nf0.format(m.totale) + ' in ' + m.ms + ' ms</div>';
      m.falliti.slice(0, 20).forEach(function (x) { h += '<div class="esito ko"><i>✗</i><div>' + esc(x.settore + ' · ' + x.profilo + ' · seme ' + x.seme) + '<br><span class="muto">' + esc(x.nome + ' — ' + x.dettaglio) + '</span></div></div>'; });
    }
    return h + '</div>';
  }

  // ------------------------------------------------------------ impostazioni
  function vistaImpostazioni() {
    var c = Arch.configurazione(), az = stato.az;
    var h = '<h2>Impostazioni</h2>';
    if (az) {
      h += '<div class="carta"><h3 style="margin-top:0">Azienda</h3><div class="riga">' +
        '<div class="campo"><label>Nome</label><input type="text" data-c="azCampo" data-k="nome" value="' + esc(az.nome) + '"></div>' +
        '<div class="campo"><label>Tipo di attività</label><select data-c="azCampo" data-k="settore">' + Object.keys(Sim.SETTORI).map(function (k) { return '<option value="' + k + '"' + (az.settore === k ? ' selected' : '') + '>' + Sim.SETTORI[k].nome + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Forma giuridica</label><input type="text" data-c="azCampo" data-k="forma" value="' + esc(az.forma || '') + '"></div>' +
        '<div class="campo"><label>Codice ATECO</label><input type="text" data-c="azCampo" data-k="ateco" value="' + esc(az.ateco || '') + '"></div></div>' +
        '<div class="riga" style="margin-top:12px"><button class="b p s" data-a="esportaJson">Esporta copia (JSON)</button><button class="b p peri" data-a="eliminaAzienda">Elimina azienda</button></div></div>';
      if (Arch.remoto() && az.ruolo === 'titolare') h += '<div class="carta"><h3 style="margin-top:0">Utenti dell\'azienda</h3><div id="membri" class="muto">Caricamento…</div><div class="riga" style="margin-top:8px"><div class="campo"><label>Email (già registrata)</label><input type="email" id="invEmail"></div><div class="campo"><label>Ruolo</label><select id="invRuolo"><option value="amministrazione">Amministrazione</option><option value="consulente">Consulente esterno</option><option value="sola_lettura">Sola lettura</option><option value="titolare">Titolare</option></select></div><button class="b p" data-a="invita">Aggiungi</button></div></div>';
    }
    h += '<div class="carta"><h3 style="margin-top:0">Importa un\'azienda da copia JSON</h3><label class="b p s" style="cursor:pointer">Scegli file<input type="file" accept=".json" data-c="fileJson" hidden></label></div>';
    h += '<div class="carta"><h3 style="margin-top:0">Dove salvare i dati</h3><p class="muto">Ogni installazione sceglie il proprio archivio. Lo schema del database è lo stesso per il cloud e per il server aziendale.</p>' +
      '<div class="campo"><label>Archivio</label><select id="aTipo" data-c="aTipo"><option value="locale"' + (c.tipo === 'locale' ? ' selected' : '') + '>Questo dispositivo (prove e simulazioni)</option><option value="supabase"' + (c.tipo === 'supabase' ? ' selected' : '') + '>Supabase in cloud</option><option value="server"' + (c.tipo === 'server' ? ' selected' : '') + '>Server dell\'azienda (Supabase auto-ospitato)</option></select></div>' +
      '<div id="aRemoto" style="' + (c.tipo === 'locale' ? 'display:none' : '') + '"><div class="campo" style="margin-top:8px"><label>Indirizzo (URL del progetto o del server)</label><input type="text" id="aUrl" value="' + esc(c.url) + '" placeholder="https://…"></div><div class="campo" style="margin-top:8px"><label>Chiave pubblica (anon / publishable)</label><input type="text" id="aChiave" value="' + esc(c.chiave) + '"></div><p class="muto">Prima esegui il file supabase-setup.sql sul database. Usa solo la chiave pubblica, mai la chiave “service role”.</p></div>' +
      '<div class="riga" style="margin-top:12px"><button class="b" data-a="salvaArchivio">Salva e ricarica</button>' + (stato.utente ? '<button class="b s" data-a="esci">Esci (' + esc(stato.utente.email) + ')</button>' : '') + '</div>' +
      (c.tipo === 'locale' ? '<p class="muto">In questa modalità i dati restano nel browser di questo dispositivo: non sono condivisi, non c\'è accesso con password e si perdono cancellando i dati del browser. Fai copie con l\'esportazione JSON.</p>' : '') + '</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Informazioni</h3><p>Timone versione ' + VERSIONE + ' · motore di calcolo ' + M.VERSIONE_MOTORE + '</p><p class="muto">Le analisi sono un supporto alle decisioni e non sostituiscono il parere del commercialista o del consulente. La piattaforma non esegue pagamenti, dichiarazioni o altre operazioni con effetti economici o legali.</p><button class="b p s" data-a="controllaVersione">Controlla aggiornamenti</button></div>';
    return h;
  }
  function caricaMembri() {
    var e = $('#membri'); if (!e || !stato.az) return;
    Arch.membri(stato.az.id).then(function (r) { e.innerHTML = (r || []).map(function (m) { return esc(m.email) + ' · <b>' + esc(m.ruolo) + '</b>'; }).join('<br>') || 'Nessun utente.'; }).catch(function (x) { e.textContent = x.message; });
  }

  // ------------------------------------------------------------ azioni
  function apriAzienda(id) {
    return Arch.carica(id).then(function (az) {
      if (!az) { toast('Azienda non trovata'); return; }
      az.esercizi = az.esercizi || {}; az.classificazione = az.classificazione || {}; az.budget = az.budget || {}; az.scenari = az.scenari || {}; az.storico = az.storico || [];
      stato.az = az; var a = anni(); stato.anno = a.length ? a[a.length - 1] : null;
      stato.esitoCollaudo = null; stato.importazione = null; stato.annoBudget = null; stato.utileObiettivo = undefined;
      try { localStorage.setItem('timone.ultima', id); } catch (e) { /* salvataggio locale non disponibile */ }
      disegna();
    }).catch(function (e) { toast(e.message); });
  }
  function dialogoAziende() {
    Arch.elenco().then(function (el) {
      var h = '<h3 style="margin-top:0">Aziende</h3><div class="lista">' + (el.length ? el.map(function (a) { return '<button data-a="apri" data-id="' + esc(a.id) + '"><span style="flex:1">' + esc(a.nome) + '</span>' + (a.simulata ? '<span class="tag simulato">simulata</span>' : '') + (a.ruolo && a.ruolo !== 'titolare' ? '<span class="tag">' + esc(a.ruolo) + '</span>' : '') + '</button>'; }).join('') : '<p class="muto">Nessuna azienda.</p>') + '</div>' +
        '<div class="riga" style="margin-top:14px"><button class="b" data-a="nuovaAzienda">Nuova azienda</button><button class="b s" data-a="vai" data-scheda="collaudo">Azienda simulata</button><span class="sp"></span><button class="b s" data-a="chiudi">Chiudi</button></div>';
      $('#dlgCorpo').innerHTML = h; $('#dlg').showModal();
    }).catch(function (e) { toast(e.message); });
  }
  function chiudiDlg() { var d = $('#dlg'); if (d.open) d.close(); if (dlgRisolvi) { var f = dlgRisolvi; dlgRisolvi = null; f(null); } }
  // finestre di domanda e conferma interne alla pagina (niente prompt/confirm del browser)
  var dlgRisolvi = null;
  function chiedi(titolo, valore, numerico) {
    chiudiDlg();
    $('#dlgCorpo').innerHTML = '<h3 style="margin-top:0">' + esc(titolo) + '</h3><input type="text" id="dlgInput" style="width:100%" ' + (numerico ? 'inputmode="numeric" ' : '') + 'value="' + esc(valore === undefined ? '' : valore) + '"><div class="riga" style="margin-top:14px"><span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="dlgOk">Conferma</button></div>';
    $('#dlg').showModal(); var i = $('#dlgInput'); i.focus(); i.select();
    return new Promise(function (ok) { dlgRisolvi = ok; });
  }
  function conferma(testo, etichetta) {
    chiudiDlg();
    $('#dlgCorpo').innerHTML = '<p style="margin-top:0">' + esc(testo) + '</p><div class="riga" style="margin-top:14px"><span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b peri" data-a="dlgOk">' + esc(etichetta || 'Conferma') + '</button></div>';
    $('#dlg').showModal();
    return new Promise(function (ok) { dlgRisolvi = ok; });
  }
  function nuovaAziendaVuota(nome) {
    return { nome: nome, settore: 'manifatturiera', forma: '', ateco: '', simulata: false, esercizi: {}, classificazione: {}, budget: {}, scenari: {}, storico: [] };
  }
  function impostaValore(voce, testo) {
    var es = stato.az.esercizi[stato.anno], vecchio = es.valori[voce], adesso = new Date().toISOString();
    var v = String(testo).trim() === '' ? null : Imp.numero(testo);
    if (String(testo).trim() !== '' && v === null) { toast('Valore non numerico: non salvato'); return false; }
    if ((vecchio ? vecchio.v : null) === v) return false;
    stato.az.storico.push({ quando: adesso, anno: stato.anno, voce: voce, da: vecchio ? vecchio.v : null, a: v, origine: 'manuale', fonte: 'Inserimento manuale' });
    if (stato.az.storico.length > 1000) stato.az.storico = stato.az.storico.slice(-1000);
    if (v === null) delete es.valori[voce];
    else es.valori[voce] = { v: v, origine: 'manuale', fonte: 'Inserimento manuale', acquisito: adesso, stato: 'da verificare' };
    return true;
  }
  function caricaScript(src) { return new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('Lettore Excel non disponibile (serve la connessione). In alternativa salva il file come CSV.')); }; document.head.appendChild(s); }); }
  function leggiFile(file) {
    var nome = file.name;
    var fine = function (matrice) { var r = Imp.interpreta(matrice); r.nome = nome; stato.importazione = r; disegna(); };
    if (/\.xlsx?$/i.test(nome)) {
      (window.XLSX ? Promise.resolve() : caricaScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js')).then(function () { return file.arrayBuffer(); }).then(function (buf) {
        var wb = window.XLSX.read(buf, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
        fine(window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }));
      }).catch(function (e) { toast(e.message); });
    } else file.text().then(function (t) { fine(Imp.csv(t)); }).catch(function (e) { toast(e.message); });
  }

  var AZIONI = {
    scheda: function (d) { stato.scheda = d.scheda; chiudiDlg(); disegna(); window.scrollTo(0, 0); if (stato.scheda === 'impostazioni') caricaMembri(); },
    vai: function (d) { stato.scheda = d.scheda; if (d.sub) stato.sub = d.sub; chiudiDlg(); disegna(); window.scrollTo(0, 0); },
    sub: function (d) { stato.sub = d.sub; disegna(); },
    aziende: dialogoAziende,
    chiudi: chiudiDlg,
    dlgOk: function () { var i = $('#dlgInput'), v = i ? i.value : true, f = dlgRisolvi; dlgRisolvi = null; $('#dlg').close(); if (f) f(v); },
    apri: function (d) { chiudiDlg(); stato.scheda = 'cruscotto'; apriAzienda(d.id); },
    nuovaAzienda: function () {
      chiedi('Nome dell\'azienda', '').then(function (nome) {
        nome = String(nome || '').trim(); if (!nome) return;
        return Arch.salva(nuovaAziendaVuota(nome.slice(0, 120))).then(function (az) { stato.scheda = 'bilancio'; stato.sub = 'dati'; return apriAzienda(az.id); });
      }).catch(function (e) { toast(e.message); });
    },
    nuovoAnno: function () {
      var a = anni(), prop = a.length ? a[a.length - 1] + 1 : new Date().getFullYear() - 1;
      chiedi('Anno dell\'esercizio', prop, true).then(function (t) {
        if (t === null) return;
        var y = parseInt(t, 10);
        if (!y || y < 1990 || y > 2100) { toast('Anno non valido'); return; }
        if (stato.az.esercizi[y]) { toast('Esercizio già presente'); } else { stato.az.esercizi[y] = { valori: {} }; salva(); }
        stato.anno = y; disegna();
      });
    },
    eliminaAnno: function () {
      conferma('Eliminare l\'esercizio ' + stato.anno + ' con tutti i suoi valori?', 'Elimina').then(function (si) {
        if (!si) return;
        delete stato.az.esercizi[stato.anno]; var a = anni(); stato.anno = a.length ? a[a.length - 1] : null; salva(); disegna();
      });
    },
    verificaTutti: function () {
      var val = stato.az.esercizi[stato.anno].valori, k = 0;
      Object.keys(val).forEach(function (v) { if (val[v].origine !== 'simulato' && val[v].stato !== 'verificato') { val[v].stato = 'verificato'; k++; } });
      salva(); disegna(); toast(k ? k + ' valori segnati come verificati' : 'Niente da verificare');
    },
    azzeraMancanti: function () {
      var man = M.mancanti(nDi(stato.anno));
      conferma('Confermi che le ' + man.length + ' voci vuote del ' + stato.anno + ' valgono zero? Fallo solo se quelle voci nel bilancio non esistono davvero.', 'Valgono zero').then(function (si) {
        if (!si) return;
        man.forEach(function (k) { impostaValore(k, '0'); });
        salva(); disegna();
      });
    },
    confermaQuote: function () {
      M.COSTI_OPERATIVI.forEach(function (k) { stato.az.classificazione[k] = { quota: M.quota(stato.az.classificazione, k), confermata: true }; });
      salva(); disegna(); toast('Quote confermate');
    },
    modello: function () { scarica('timone-modello-bilancio.csv', '﻿' + Imp.modelloCsv(), 'text/csv;charset=utf-8'); },
    esportaCsv: function () { scarica('timone-' + stato.az.nome.replace(/[^\w]+/g, '-') + '.csv', '﻿' + Imp.esportaCsv(stato.az), 'text/csv;charset=utf-8'); },
    esportaJson: function () { scarica('timone-' + stato.az.nome.replace(/[^\w]+/g, '-') + '.json', JSON.stringify({ formato: 'timone-azienda', versione: 1, azienda: stato.az }, null, 1), 'application/json'); },
    confermaImport: function () {
      var k = Imp.applica(stato.az, stato.importazione, stato.importazione.nome);
      stato.importazione = null; var a = anni(); if (a.length) stato.anno = a[a.length - 1];
      salva(); stato.sub = 'dati'; disegna(); toast(k + ' valori importati: restano “da verificare”');
    },
    annullaImport: function () { stato.importazione = null; disegna(); },
    creaBudget: function (d) {
      var ip = {}; document.querySelectorAll('[data-ip]').forEach(function (e) { var v = parseFloat(e.value); if (isFinite(v) && v !== 0) ip[e.dataset.ip] = v / 100; });
      if (ip.materie !== undefined) ip.var_rim_materie = ip.materie;
      var base = Number(d.base), nb = nDi(base); if (!nb || !completo(base, 'ce')) { toast('Il conto economico ' + base + ' è incompleto: completalo prima di creare il budget'); return; }
      stato.az.budget[stato.annoBudget] = { base: base, ipotesi: ip, voci: M.creaBudget(nb, ip), creato: new Date().toISOString() };
      salva(); disegna(); toast('Budget ' + stato.annoBudget + ' calcolato');
    },
    eliminaBudget: function () { conferma('Eliminare il budget ' + stato.annoBudget + '?', 'Elimina').then(function (si) { if (si) { delete stato.az.budget[stato.annoBudget]; salva(); disegna(); } }); },
    scenAperto: function (d) { stato.scenAperto = d.k; disegna(); },
    ripristinaScenario: function () { delete stato.az.scenari[stato.scenAperto]; salva(); disegna(); },
    calcolaObiettivo: function () {
      var v = Imp.numero($('#utileObiettivo').value); if (v === null) { toast('Inserisci un importo'); return; }
      stato.utileObiettivo = v; $('#esitoObiettivo').innerHTML = esitoObiettivo();
    },
    generaSim: function () {
      var s = stato.simForm, az = Sim.genera({ settore: s.settore, profilo: s.profilo, ricavi: Number(s.ricavi), anni: Number(s.anni), seme: s.seme });
      delete az.id; // l'archivio assegna l'identificativo
      Arch.salva(az).then(function (salvata) { return apriAzienda(salvata.id); }).then(function () {
        stato.esitoCollaudo = Sim.collauda(stato.az); stato.scheda = 'cruscotto'; disegna(); window.scrollTo(0, 0);
        toast('Creata ' + stato.az.nome + ' · collaudo ' + stato.esitoCollaudo.superati + '/' + stato.esitoCollaudo.totale);
      }).catch(function (e) { toast(e.message); });
    },
    collauda: function () { stato.esitoCollaudo = Sim.collauda(stato.az); disegna(); },
    massivo: function () { var t = Date.now(), m = Sim.collaudoMassivo(5); m.ms = Date.now() - t; stato.esitoMassivo = m; disegna(); },
    eliminaAzienda: function () {
      conferma('Eliminare definitivamente “' + stato.az.nome + '” e tutti i suoi dati?', 'Elimina').then(function (si) {
        if (!si) return;
        return Arch.elimina(stato.az.id).then(function () { stato.az = null; stato.anno = null; stato.scheda = 'cruscotto'; disegna(); toast('Azienda eliminata'); });
      }).catch(function (e) { toast(e.message); });
    },
    salvaArchivio: function () {
      var tipo = $('#aTipo').value, url = $('#aUrl').value.trim(), ch = $('#aChiave').value.trim();
      if (tipo !== 'locale' && (!/^https?:\/\//.test(url) || !ch)) { toast('Servono indirizzo (https://…) e chiave'); return; }
      Arch.configura({ tipo: tipo, url: url, chiave: ch }); location.reload();
    },
    accedi: function () { Arch.accedi($('#lEmail').value.trim(), $('#lPass').value).then(function (u) { stato.utente = u; return avviaDati(); }).catch(function (e) { toast(e.message); }); },
    registra: function () {
      var pw = $('#lPass').value; if (pw.length < 8) { toast('Password di almeno 8 caratteri'); return; }
      Arch.registra($('#lEmail').value.trim(), pw).then(function (r) { if (r.session) { stato.utente = r.user; return avviaDati(); } toast('Account creato: conferma l\'email e poi accedi'); }).catch(function (e) { toast(e.message); });
    },
    esci: function () { Arch.esci().then(function () { stato.utente = null; stato.az = null; disegna(); }); },
    invita: function () { Arch.invita(stato.az.id, $('#invEmail').value.trim(), $('#invRuolo').value).then(function () { toast('Utente aggiunto'); caricaMembri(); }).catch(function (e) { toast(e.message); }); },
    aggiorna: function () {
      var p = [];
      if (window.caches) p.push(caches.keys().then(function (k) { return Promise.all(k.map(function (x) { return caches.delete(x); })); }));
      if (navigator.serviceWorker) p.push(navigator.serviceWorker.getRegistrations().then(function (r) { return Promise.all(r.map(function (x) { return x.unregister(); })); }));
      Promise.all(p).then(function () { location.reload(); }, function () { location.reload(); });
    },
    controllaVersione: function () { controllaVersione(true); }
  };

  var CAMBI = {
    anno: function (e) { stato.anno = Number(e.value); stato.utileObiettivo = undefined; disegna(); },
    annoBudget: function (e) { stato.annoBudget = Number(e.value); disegna(); },
    valore: function (e) { if (impostaValore(e.dataset.voce, e.value)) { salva(); var y = window.scrollY; disegna(); window.scrollTo(0, y); } },
    verificato: function (e) { var x = stato.az.esercizi[stato.anno].valori[e.dataset.voce]; if (x) { x.stato = e.checked ? 'verificato' : 'da verificare'; salva(); } },
    quota: function (e) { stato.az.classificazione[e.dataset.voce] = { quota: Number(e.value) / 100, confermata: true }; salva(); var y = window.scrollY; disegna(); window.scrollTo(0, y); },
    leva: function (e) {
      var k = stato.scenAperto; stato.az.scenari[k] = stato.az.scenari[k] || {};
      stato.az.scenari[k][e.dataset.leva] = Number(e.value) / 100; salva(); var y = window.scrollY; disegna(); window.scrollTo(0, y);
    },
    assegna: function (e) { stato.importazione.righe[Number(e.dataset.i)].voce = e.value || null; },
    file: function (e) { if (e.files[0]) leggiFile(e.files[0]); },
    fileJson: function (e) {
      if (!e.files[0]) return;
      e.files[0].text().then(function (t) {
        var o = JSON.parse(t); if (!o || o.formato !== 'timone-azienda' || !o.azienda || typeof o.azienda.esercizi !== 'object') throw new Error('File non riconosciuto');
        var az = o.azienda; delete az.id; delete az.ruolo; az.nome = String(az.nome || 'Azienda importata').slice(0, 120);
        return Arch.salva(az);
      }).then(function (az) { stato.scheda = 'cruscotto'; return apriAzienda(az.id); }).then(function () { toast('Azienda importata'); }).catch(function (x) { toast('Importazione non riuscita: ' + x.message); });
    },
    azCampo: function (e) { stato.az[e.dataset.k] = e.value.trim().slice(0, 120) || (e.dataset.k === 'nome' ? stato.az.nome : ''); salva(); disegnaNav(); },
    aTipo: function (e) { $('#aRemoto').style.display = e.value === 'locale' ? 'none' : ''; }
  };

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-a]'); if (!b) return;
    var f = AZIONI[b.dataset.a]; if (f) f(b.dataset, b);
  });
  document.addEventListener('change', function (ev) {
    var e = ev.target;
    if (e.dataset.sim) { stato.simForm[e.dataset.sim] = e.value; if (e.dataset.sim === 'profilo') disegna(); return; }
    var f = CAMBI[e.dataset.c]; if (f) f(e);
  });
  document.addEventListener('input', function (ev) { // aggiorna l'etichetta dei cursori mentre si trascina
    var e = ev.target; if (e.type !== 'range') return;
    var o = e.parentNode.querySelector('output'); if (!o) return;
    o.textContent = e.dataset.c === 'quota' ? e.value + '% var.' : (e.value > 0 ? '+' : '') + e.value + '%';
  });
  $('#dlg').addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.id === 'dlgInput') AZIONI.dlgOk(); });
  $('#dlg').addEventListener('cancel', function () { if (dlgRisolvi) { var f = dlgRisolvi; dlgRisolvi = null; f(null); } });
  $('#dlg').addEventListener('click', function (ev) { if (ev.target === ev.currentTarget) chiudiDlg(); });

  // ------------------------------------------------------------ aggiornamenti
  // L'app resta sulla versione installata finché non si preme "Aggiorna".
  function piuRecente(a, b) { var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (var i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
  function controllaVersione(manuale) {
    fetch('versione.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.versione && piuRecente(j.versione, VERSIONE)) { $('#aggiornaBtn').style.display = 'inline-block'; toast('Disponibile la versione ' + j.versione + ': premi Aggiorna'); }
      else if (manuale) toast('Stai usando l\'ultima versione (' + VERSIONE + ')');
    }).catch(function () { if (manuale) toast('Controllo non riuscito (connessione assente?)'); });
  }

  // ------------------------------------------------------------ avvio
  function avviaDati() {
    return Arch.elenco().then(function (el) {
      var ultima = null; try { ultima = localStorage.getItem('timone.ultima'); } catch (e) { /* non disponibile */ }
      var scelta = el.filter(function (a) { return a.id === ultima; })[0] || (el.length === 1 ? el[0] : null);
      if (scelta) return apriAzienda(scelta.id);
      disegna();
    }).catch(function (e) { disegna(); toast(e.message); });
  }
  function avvia() {
    disegnaNav();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { /* l'app funziona anche senza */ });
    if (location.protocol.indexOf('http') === 0) { controllaVersione(false); setInterval(function () { controllaVersione(false); }, 30 * 60 * 1000); }
    var p = Arch.remoto() ? Arch.utente().then(function (u) { stato.utente = u; }).catch(function (e) { toast(e.message); }) : Promise.resolve();
    p.then(function () { if (Arch.remoto() && !stato.utente) { disegna(); return; } return avviaDati(); });
  }
  avvia();
})();
