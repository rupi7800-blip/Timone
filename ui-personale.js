/* Timone · interfaccia del modulo Personale (si registra in app.js) */
(function () {
  'use strict';
  var T = window.Timone, P = window.Personale;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, nf0 = T.nf0, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };
  var SUB = [['sintesi', 'Sintesi'], ['persone', 'Persone'], ['simulazioni', 'Simulazioni'], ['dati', 'Importa e parametri']];

  function d() { if (!st.az.personale) st.az.personale = P.vuoto(); return P.dati(st.az); }
  function analisi() { return P.analisi(st.az, st.anno, T.nDi(st.anno), T.completo(st.anno, 'ce')); }
  function nfx(x, dec) { if (x === undefined || x === null) return ''; if (dec === 0) return nf0.format(Math.round(x)); var m = Math.pow(10, dec === undefined ? 2 : dec); return String(Math.round(x * m) / m).replace('.', ','); }
  function e2(x) { return (x === null || x === undefined) ? '—' : nfx(x, 2) + ' €'; }
  function campo(et, id, val, extra) { return '<div class="campo"><label for="' + id + '">' + et + '</label><input type="text" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || 'inputmode="decimal"') + '></div>'; }
  function leggi(id) { var e = document.getElementById(id); if (!e || String(e.value).trim() === '') return null; return T.numero(e.value); }
  function apri(html) { $('#dlgCorpo').innerHTML = html; if (!$('#dlg').open) $('#dlg').showModal(); $('#dlg').scrollTop = 0; }
  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td>' + v + '</td></tr>'; }
  function nomeDi(p) { return (p.codice || '') + (p.codice && p.nome ? ' · ' : '') + (p.nome || '') || '(senza codice)'; }

  function vista() {
    var sub = st.subPersonale || 'sintesi';
    var h = '<div class="riga"><h2 style="margin:0">Personale</h2><span class="sp"></span>' + T.selAnno() + '</div>';
    h += '<div class="sub">' + SUB.map(function (s) { return '<button data-a="peSub" data-sub="' + s[0] + '" class="' + (sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (d().simulato) h += '<div class="avviso">Personale simulato: serve a provare il modulo, non descrive persone reali.</div>';
    return h + ({ sintesi: vSintesi, persone: vPersone, simulazioni: vSimulazioni, dati: vDati }[sub] || vSintesi)();
  }
  function senza() {
    return '<div class="carta"><p>Nessun dato sul personale per il ' + st.anno + '.</p><p class="muto">Serve il riepilogo annuale per persona: retribuzione lorda, contributi, TFR, ore lavorate, straordinari e assenze. Di solito lo fornisce il consulente del lavoro in Excel o CSV.</p>' +
      '<div class="riga"><button class="b" data-a="peSub" data-sub="dati">Importa il riepilogo</button>' + (T.scrivibile() ? '<button class="b s" data-a="peNuova">Aggiungi una persona a mano</button>' : '') + '</div>' +
      '<p class="muto">Sono dati personali dei dipendenti: usa un codice o la matricola al posto del nome, se non ti serve. Il modulo analizza costi e reparti e non produce classifiche individuali.</p></div>';
  }

  function vSintesi() {
    var a = analisi(); if (!a.presente) return senza();
    var Tt = a.totali, h = '';
    if (a.bilancio === null) h += '<div class="avviso">Nel bilancio ' + st.anno + ' manca il costo del personale: non posso confrontare l\'elenco con la contabilità.</div>';
    else h += '<div class="avviso ' + (a.riconciliato ? 'ok' : 'rosso') + '">' + (a.riconciliato ? 'L\'elenco coincide con il costo del personale di bilancio (' + eur(a.bilancio) + ').' : 'Elenco ' + eur(Tt.costoBilancio) + ', bilancio ' + eur(a.bilancio) + ': differenza ' + eur(a.differenza) + ' da spiegare.') + '</div>';
    if (a.conValoriCalcolati) h += '<div class="avviso">Per ' + a.conValoriCalcolati + ' persone contributi o TFR non sono stati inseriti: sono calcolati (contributi al ' + fmt(a.parametri.aliquotaContributi, 'pct') + ', TFR = retribuzione ÷ 13,5) e non letti dai cedolini.</div>';
    var tile = function (n, v, sotto) { return '<button><div class="n">' + n + '</div><div class="v">' + v + '</div><div class="d muto">' + (sotto || '') + '</div></button>'; };
    h += '<div class="kpi">' + tile('Costo aziendale del personale', eur(Tt.costo), a.fuoriB9 ? 'di cui ' + eur(a.fuoriB9) + ' benefit e formazione' : '') + tile('Persone', nfx(Tt.fte, 1), 'equivalenti a tempo pieno · ' + Tt.n + ' in elenco') +
      tile('Costo medio per persona', eur(Tt.costoMedio), 'per equivalente a tempo pieno') + tile('Costo per ora lavorata', e2(Tt.costoOra), Tt.ore ? nf0.format(Tt.ore) + ' ore lavorate' : 'ore mancanti') +
      tile('Straordinari', fmt(Tt.quotaStraordinari, 'pct'), nf0.format(Tt.oreStraordinario) + ' ore') + tile('Personale indiretto', fmt(a.quotaIndiretti, 'pct'), 'del costo totale') + '</div>';
    if (a.contabile) h += '<div class="carta"><h3 style="margin-top:0">Produttività</h3><table>' + riga('Ricavi per persona', eur(a.ricaviFte)) + riga('Valore aggiunto per persona', eur(a.vaFte)) + riga('Costo medio per persona', eur(Tt.costoMedio)) +
      riga('Valore aggiunto per ora lavorata', e2(a.vaOra)) + riga('Costo per ora lavorata', e2(Tt.costoOra)) + riga('Margine lordo (EBITDA) per ora lavorata', e2(a.ebitdaOra), 1) + riga('Costo del personale sui ricavi', fmt(a.incidenzaRicavi, 'pct')) + riga('Costo del personale sul valore aggiunto', fmt(a.costoSuVa, 'pct')) + '</table>' +
      '<p class="muto">Il valore aggiunto per persona deve restare sopra il costo medio per persona: la differenza è ciò che resta per ammortamenti, interessi, imposte e utile.</p></div>';
    else h += '<div class="avviso">Produttività non calcolata: il conto economico ' + st.anno + ' manca o è incompleto.</div>';
    h += '<div class="carta"><h3 style="margin-top:0">Per reparto</h3><div class="scorri"><table><tr><th></th><th>Persone</th><th>Costo</th><th>€/ora</th><th>Straord.</th><th>Assenze</th></tr>';
    a.reparti.forEach(function (r) { h += '<tr><td>' + esc(r.nome) + '</td><td>' + nfx(r.fte, 1) + '</td><td>' + eur(r.costo) + '</td><td>' + e2(r.costoOra) + '</td><td><span class="' + (r.quotaStraordinari > a.parametri.sogliaStraordinari ? 'giu' : '') + '">' + fmt(r.quotaStraordinari, 'pct') + '</span></td><td>' + fmt(r.quotaAssenze, 'pct') + '</td></tr>'; });
    h += '<tr class="tot"><td>Totale</td><td>' + nfx(Tt.fte, 1) + '</td><td>' + eur(Tt.costo) + '</td><td>' + e2(Tt.costoOra) + '</td><td>' + fmt(Tt.quotaStraordinari, 'pct') + '</td><td>' + fmt(Tt.quotaAssenze, 'pct') + '</td></tr></table></div>' +
      '<p class="muto">Costo per ora effettivamente lavorata: è quello da usare per valorizzare le ore nelle commesse. Le assenze comprendono ferie, permessi, malattia e infortuni.</p></div>';
    if (a.commesse.length) h += '<div class="carta"><h3 style="margin-top:0">Costi orari usati nelle commesse</h3><table>' + a.commesse.map(function (x) { return riga(esc(x.nome), e2(x.costoOrario) + '/h'); }).join('') + riga('Costo effettivo dei diretti per ora lavorata', e2(a.tipi.diretto.costoOra) + '/h', 1) + '</table>' +
      (Math.abs(a.scartoCommesse) > 0.10 ? '<div class="avviso">La media delle tariffe usate nelle commesse si discosta del ' + fmt(Math.abs(a.scartoCommesse), 'pct') + ' dal costo effettivo: conviene aggiornarle nel modulo Commesse.</div>' : '<p class="muto">Le tariffe usate nelle commesse sono in linea con il costo effettivo.</p>') + '</div>';
    a.criticita.forEach(function (x) { h += '<div class="carta crit ' + x.gravita + '"><h3>' + esc(x.titolo) + '</h3><dl><div><dt>Dati</dt><dd>' + esc(x.dati) + '</dd></div><div><dt>Causa probabile</dt><dd>' + esc(x.causa) + '</dd></div><div><dt>Intervento</dt><dd>' + esc(x.intervento) + '</dd></div><div><dt>Quanto pesa</dt><dd>' + esc(x.effetto) + '</dd></div></dl></div>'; });
    return h;
  }

  function vPersone() {
    var a = analisi(); if (!a.presente) return senza();
    var h = '<div class="riga">' + (T.scrivibile() ? '<button class="b p" data-a="peNuova">Nuova persona</button>' : '') + '</div>';
    a.reparti.forEach(function (rep) {
      h += '<div class="carta"><h3 style="margin-top:0">' + esc(rep.nome) + ' <span class="muto">· ' + eur(rep.costo) + '</span></h3><div class="lista">';
      a.righe.filter(function (x) { return (String(x.p.reparto || '').trim() || '(senza reparto)') === rep.nome; }).forEach(function (x) {
        h += '<button data-a="peApri" data-id="' + esc(x.p.id) + '"><span style="flex:1;min-width:0"><b>' + esc(nomeDi(x.p)) + '</b><br><span class="muto">' + esc(x.p.qualifica || '') + (x.p.tipo === 'indiretto' ? ' · indiretto' : ' · diretto') + (x.k.fte !== 1 ? ' · ' + Math.round(x.k.fte * 100) + '%' : '') + '</span></span>' +
          '<span style="text-align:right">' + eur(x.k.costo) + (x.k.calcolati.length ? '<br><span class="tag giallo">in parte calcolato</span>' : '') + '</span></button>';
      });
      h += '</div></div>';
    });
    return h + '<p class="muto">L\'elenco mostra il costo aziendale di ogni posizione. Non vengono calcolate graduatorie di produttività o di assenza per singola persona.</p>';
  }

  function vSimulazioni() {
    var a = analisi(); if (!a.presente) return senza();
    var f = st.simPersonale || (st.simPersonale = { numero: 1, ral: 28000, ore: 1500, oreEst: 1000, tariffa: 30, quota: 60 });
    var h = '<p class="muto">Simulazioni numeriche sui dati del ' + st.anno + '. Sono ipotesi dichiarate, non previsioni: la decisione resta tua.</p>';
    // assunzione
    var s1 = P.simulaAssunzione(a, { numero: f.numero, ral: f.ral });
    h += '<div class="carta"><h3 style="margin-top:0">Conviene assumere?</h3><div class="riga">' + campo('Persone da assumere', 'peSNum', f.numero, 'inputmode="numeric"') + campo('Retribuzione lorda annua (€)', 'peSRal', nfx(f.ral, 0)) + '<button class="b p" data-a="peSimula">Calcola</button></div><table style="margin-top:10px">' +
      riga('Costo aziendale per persona', eur(s1.costoUnitario)) + riga('Costo annuo complessivo', eur(s1.costo), 1) + (s1.ore !== null ? riga('Ore lavorabili in più', nf0.format(s1.ore)) : '') +
      (a.contabile ? riga('EBITDA: da → a', eur(s1.ebitdaPrima) + ' → <span class="' + (s1.ebitdaDopo < 0 ? 'giu' : '') + '">' + eur(s1.ebitdaDopo) + '</span>') + riga('Incidenza del personale: da → a', fmt(s1.incidenzaPrima, 'pct') + ' → ' + fmt(s1.incidenzaDopo, 'pct')) +
        riga('Produzione in più per ripagare il costo', s1.produzioneNecessaria === null ? 'non calcolabile' : eur(s1.produzioneNecessaria), 1) : '') + '</table>' +
      (a.contabile && s1.produzioneNecessaria !== null ? '<p>L\'assunzione si ripaga se porta almeno <b>' + eur(s1.produzioneNecessaria) + '</b> di produzione in più all\'anno, con il margine di contribuzione attuale del ' + fmt(s1.mcPct, 'pct') + '.</p>' : '') + '<p class="muto">' + esc(s1.ipotesi) + '</p></div>';
    // straordinari o assunzione
    var s2 = P.simulaStraordinari(a, { ore: f.ore });
    h += '<div class="carta"><h3 style="margin-top:0">Straordinari o una persona in più?</h3><div class="riga">' + campo('Ore in più da coprire in un anno', 'peSOre', nfx(f.ore, 0)) + '<button class="b p" data-a="peSimula">Calcola</button></div>';
    if (!s2) h += '<div class="avviso">Non calcolabile: mancano le ore lavorate.</div>';
    else h += '<table style="margin-top:10px">' + riga('Con straordinari (' + e2(s2.costoOraStraordinario) + '/h)', eur(s2.costoStraordinari)) + riga('Con ' + s2.persone + (s2.persone === 1 ? ' assunzione' : ' assunzioni') + ' (' + nf0.format(s2.oreCoperte) + ' ore disponibili)', eur(s2.costoAssunzioni)) +
      riga('Costa meno', (s2.conviene === 'straordinari' ? 'gli straordinari' : 'l\'assunzione') + ' · differenza ' + eur(s2.differenza), 1) + riga('Soglia di indifferenza', nf0.format(s2.soglia) + ' ore l\'anno') + '</table><p class="muto">' + esc(s2.ipotesi) + '</p>';
    h += '</div>';
    // esternalizzazione
    var s3 = P.simulaEsternalizzazione(a, { ore: f.oreEst, tariffa: f.tariffa, quotaEvitabile: f.quota / 100 });
    h += '<div class="carta"><h3 style="margin-top:0">Conviene affidare una lavorazione all\'esterno?</h3><div class="riga">' + campo('Ore da esternalizzare', 'peSOreE', nfx(f.oreEst, 0)) + campo('Tariffa esterna (€/ora)', 'peSTar', nfx(f.tariffa, 2)) + campo('Costo interno davvero evitabile (%)', 'peSQuo', nfx(f.quota, 0)) + '<button class="b p" data-a="peSimula">Calcola</button></div>';
    if (!s3) h += '<div class="avviso">Non calcolabile: mancano le ore lavorate.</div>';
    else h += '<table style="margin-top:10px">' + riga('Costo esterno', eur(s3.costoEsterno)) + riga('Costo interno di quelle ore', eur(s3.costoInterno)) + riga('di cui risparmiato davvero', eur(s3.risparmioInterno)) + riga('Effetto sul risultato', '<span class="' + (s3.effetto < 0 ? 'giu' : 'su') + '">' + eur(s3.effetto) + '</span>', 1) + riga('Tariffa esterna di pareggio', e2(s3.tariffaPareggio) + '/h') + '</table><p class="muto">' + esc(s3.ipotesi) + '</p>';
    return h + '</div>';
  }

  function vDati() {
    var D = d(), par = P.parametri(D), an = D.anni[st.anno], im = st.importPersonale;
    var h = '<div class="carta"><h3 style="margin-top:0">Importa il riepilogo ' + st.anno + '</h3><p class="muto">File Excel o CSV con una riga per persona. Colonne riconosciute: Codice (o Matricola), Nome, Reparto, Qualifica, Tipo (diretto/indiretto), FTE, RAL, Contributi, TFR, INAIL, Premi, Benefit, Formazione, Altri, Ore contratto, Ore lavorate, Ore straordinario, Ore assenza.</p>' +
      '<div class="riga"><button class="b p s" data-a="peModello">Scarica il modello</button>' + (T.scrivibile() ? '<label class="b p" style="cursor:pointer">Scegli file<input type="file" accept=".csv,.txt,.xlsx,.xls" data-c="peFile" hidden></label>' : '') + '</div>';
    if (im) {
      h += '<h3>Anteprima · ' + esc(im.nome) + '</h3>'; im.avvisi.forEach(function (x) { h += '<div class="avviso">' + esc(x) + '</div>'; });
      if (im.persone.length) h += '<p>' + im.persone.length + ' persone, retribuzioni lorde ' + eur(im.persone.reduce(function (s, x) { return s + x.ral; }, 0)) + '. Colonne lette: ' + esc(im.colonne.join(', ')) + '.</p><div class="riga"><button class="b" data-a="peImporta">' + (an && an.persone.length ? 'Sostituisci il personale ' + st.anno : 'Importa') + '</button><button class="b s" data-a="peAnnulla">Annulla</button></div>';
      else h += '<button class="b s" data-a="peAnnulla">Chiudi</button>';
    }
    h += '</div><div class="carta"><h3 style="margin-top:0">Parametri</h3><div class="riga">' + campo('Aliquota media dei contributi (%)', 'peAliq', nfx(par.aliquotaContributi * 100, 1)) + campo('Maggiorazione straordinari (%)', 'peMagg', nfx(par.maggiorazione * 100, 1)) + campo('Soglia straordinari (% delle ore)', 'peSStr', nfx(par.sogliaStraordinari * 100, 1)) + campo('Soglia assenze (% delle ore contrattuali)', 'peSAss', nfx(par.sogliaAssenze * 100, 1)) + '</div>' +
      (T.scrivibile() ? '<button class="b p" style="margin-top:12px" data-a="peParametri">Salva parametri</button>' : '') + '<p class="muto">Aliquota e maggiorazione dipendono dal contratto collettivo applicato: chiedi i valori esatti al consulente del lavoro. L\'aliquota si usa solo quando i contributi non sono inseriti.</p></div>';
    if (an && an.persone.length && T.scrivibile()) h += '<div class="carta"><h3 style="margin-top:0">Personale ' + st.anno + '</h3><p class="muto">' + an.persone.length + ' persone in elenco.</p><button class="b p peri" data-a="peSvuota">Elimina l\'elenco ' + st.anno + '</button></div>';
    return h;
  }

  function scheda(id) {
    var a = analisi(), x = a.righe.filter(function (r) { return r.p.id === id; })[0]; if (!x) return;
    var p = x.p, k = x.k, calc = function (n) { return k.calcolati.indexOf(n) >= 0 ? ' <span class="tag giallo">calcolato</span>' : ''; };
    var h = '<h3 style="margin-top:0">' + esc(nomeDi(p)) + '</h3><p class="muto">' + esc([p.reparto, p.qualifica, p.tipo === 'indiretto' ? 'indiretto' : 'diretto'].filter(Boolean).join(' · ')) + '</p><table>' +
      riga('Retribuzione lorda', eur(k.ral)) + riga('Contributi' + calc('contributi'), eur(k.contributi)) + riga('TFR' + calc('TFR'), eur(k.tfr)) + riga('INAIL', eur(k.inail)) + riga('Premi', eur(k.premi)) + riga('Altri oneri', eur(k.altri)) + riga('Costo in bilancio (voce personale)', eur(k.costoBilancio), 1) +
      riga('Benefit', eur(k.benefit)) + riga('Formazione', eur(k.formazione)) + riga('Costo aziendale pieno', eur(k.costo), 1) + riga('Costo in più rispetto al lordo', fmt(k.oneri, 'pct')) +
      riga('Ore contrattuali', nfx(k.oreContratto, 0) || '—') + riga('Ore lavorate', k.oreLavorate === null ? 'mancanti' : nfx(k.oreLavorate, 0)) + riga('di cui straordinario', nfx(k.oreStraordinario, 0)) + riga('Ore di assenza', k.oreAssenza === null ? '—' : nfx(k.oreAssenza, 0)) + riga('Costo per ora lavorata', e2(k.costoOra), 1) + '</table>' +
      '<div class="riga" style="margin-top:14px">' + (T.scrivibile() ? '<button class="b p" data-a="peModifica" data-id="' + esc(id) + '">Modifica</button><button class="b p peri" data-a="peElimina" data-id="' + esc(id) + '">Elimina</button>' : '') + '<span class="sp"></span><button class="b p s" data-a="chiudi">Chiudi</button></div>';
    apri(h);
  }
  var CAMPI = [['ral', 'Retribuzione lorda dell\'anno, straordinari compresi (€)'], ['contributi', 'Contributi a carico azienda (€) · vuoto = calcolati'], ['tfr', 'TFR dell\'anno (€) · vuoto = calcolato'], ['inail', 'INAIL (€)'], ['premi', 'Premi non compresi nel lordo (€)'], ['altri', 'Altri oneri (€)'], ['benefit', 'Benefit e welfare (€)'], ['formazione', 'Formazione (€)'],
    ['fte', 'Tempo pieno = 1, part-time 50% = 0,5'], ['oreContratto', 'Ore contrattuali annue'], ['oreLavorate', 'Ore lavorate (straordinari compresi)'], ['oreStraordinario', 'di cui straordinario'], ['oreAssenza', 'Ore di assenza']];
  function modulo(id) {
    var an = d().anni[st.anno], p = id ? an.persone.filter(function (x) { return x.id === id; })[0] : { tipo: 'diretto', fte: 1 };
    var h = '<h3 style="margin-top:0">' + (id ? 'Modifica' : 'Nuova persona · ' + st.anno) + '</h3><div class="riga">' + campo('Codice o matricola', 'peCod', p.codice, '') + campo('Nome (facoltativo)', 'peNome', p.nome, '') + campo('Reparto', 'peRep', p.reparto, '') + campo('Qualifica', 'peQua', p.qualifica, '') +
      '<div class="campo"><label for="peTipo">Tipo</label><select id="peTipo"><option value="diretto"' + (p.tipo !== 'indiretto' ? ' selected' : '') + '>Diretto (lavora su commesse o produzione)</option><option value="indiretto"' + (p.tipo === 'indiretto' ? ' selected' : '') + '>Indiretto (uffici, magazzino, servizi)</option></select></div>' +
      CAMPI.map(function (c) { return campo(c[1], 'pe_' + c[0], nfx(p[c[0]], 2)); }).join('') + '</div><div class="riga" style="margin-top:14px"><span class="sp"></span><button class="b s" data-a="chiudi">Annulla</button><button class="b" data-a="peSalva" data-id="' + esc(id || '') + '">Salva</button></div>';
    apri(h);
  }

  var azioni = {
    peSub: function (x) { st.subPersonale = x.sub; T.disegna(); },
    peApri: function (x) { scheda(x.id); },
    peNuova: function () { var D = d(); if (!D.anni[st.anno]) D.anni[st.anno] = { persone: [] }; modulo(null); },
    peModifica: function (x) { modulo(x.id); },
    peSalva: function (x) {
      var D = d(), an = D.anni[st.anno], txt = function (id, n) { return document.getElementById(id).value.trim().slice(0, n); }, cod = txt('peCod', 30), nome = txt('peNome', 80), ral = leggi('pe_ral');
      if (!cod && !nome) { T.toast('Serve un codice o un nome'); return; }
      if (ral === null || ral < 0) { T.toast('Serve la retribuzione lorda'); return; }
      var p = x.id ? an.persone.filter(function (y) { return y.id === x.id; })[0] : { id: 'p' + Date.now().toString(36) };
      p.codice = cod; p.nome = nome; p.reparto = txt('peRep', 60); p.qualifica = txt('peQua', 60); p.tipo = document.getElementById('peTipo').value;
      CAMPI.forEach(function (c) { var v = leggi('pe_' + c[0]); if (v === null) delete p[c[0]]; else p[c[0]] = v; });
      p.origine = 'manuale';
      if (!x.id) an.persone.push(p);
      if (D.simulato && !Object.keys(D.anni).some(function (a) { return D.anni[a].persone.some(function (y) { return y.origine === 'simulato'; }); })) delete D.simulato;
      T.salva(); T.chiudiDlg(); T.disegna(); T.toast('Salvato');
    },
    peElimina: function (x) { T.conferma('Eliminare questa persona dall\'elenco ' + st.anno + '?', 'Elimina').then(function (si) { if (!si) return; var an = d().anni[st.anno]; an.persone = an.persone.filter(function (y) { return y.id !== x.id; }); T.salva(); T.disegna(); }); },
    peSimula: function () {
      var f = st.simPersonale, g = function (id, k) { var v = leggi(id); if (v !== null && v >= 0) f[k] = v; };
      g('peSNum', 'numero'); g('peSRal', 'ral'); g('peSOre', 'ore'); g('peSOreE', 'oreEst'); g('peSTar', 'tariffa'); g('peSQuo', 'quota'); f.quota = Math.min(100, f.quota);
      var y = window.scrollY; T.disegna(); window.scrollTo(0, y);
    },
    peModello: function () { T.scarica('timone-modello-personale.csv', '﻿' + P.modelloCsv(), 'text/csv;charset=utf-8'); },
    peImporta: function () { var im = st.importPersonale, D = d(); D.anni[st.anno] = { persone: im.persone, fonte: im.nome, importato: new Date().toISOString() }; delete D.simulato; st.importPersonale = null; st.subPersonale = 'sintesi'; T.salva(); T.disegna(); T.toast(im.persone.length + ' persone importate'); },
    peAnnulla: function () { st.importPersonale = null; T.disegna(); },
    peSvuota: function () { T.conferma('Eliminare tutto l\'elenco del personale ' + st.anno + '?', 'Elimina').then(function (si) { if (!si) return; delete d().anni[st.anno]; T.salva(); T.disegna(); }); },
    peParametri: function () {
      var a = leggi('peAliq'), m = leggi('peMagg'), s = leggi('peSStr'), z = leggi('peSAss');
      if (a === null || a < 0 || a > 100 || m === null || m < 0 || s === null || z === null) { T.toast('Valori non validi'); return; }
      d().parametri = { aliquotaContributi: a / 100, maggiorazione: m / 100, sogliaStraordinari: s / 100, sogliaAssenze: z / 100 }; T.salva(); T.disegna(); T.toast('Parametri salvati');
    }
  };
  var cambi = {
    peFile: function (e) { var f = e.files[0]; if (!f) return; e.value = ''; T.tabellaDa(f).then(function (m) { var r = P.daTabella(m, T.numero); r.nome = f.name; st.importPersonale = r; T.disegna(); }).catch(function (x) { T.toast('File non letto: ' + x.message); }); }
  };

  T.registra({
    id: 'personale', titolo: 'Personale',
    descrizione: 'Costo aziendale effettivo per persona e reparto, costo per ora lavorata, produttività, confronto con il bilancio, simulazioni di assunzione, straordinari ed esternalizzazione.',
    vista: vista, azioni: azioni, cambi: cambi,
    criticita: function (az, anno) { return az.personale ? P.analisi(az, anno, T.nDi(anno), T.completo(anno, 'ce')).criticita : []; },
    collaudo: function (az) { return az.personale ? P.collaudo(az) : []; },
    simula: function (az, seme) { var m = P.simula(az, seme); if (Object.keys(m.anni).length) az.personale = m; }
  });
})();
