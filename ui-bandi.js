/* Timone · interfaccia del modulo Ricerca bandi (si registra in app.js)
   La ricerca usa il motore AI con ricerca web (Google Gemini o Claude): ogni bando trovato ha il link alla fonte
   e resta "da verificare". I bandi utili si salvano nell'archivio dell'azienda e, se serve, passano al registro
   agevolazioni del modulo Finanziamenti. */
(function () {
  'use strict';
  var T = window.Timone, B = window.Bandi, AI = window.TimoneAI;
  var esc = T.esc, eur = T.eur, st = T.stato;
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

  function d() { if (!st.az.bandi) st.az.bandi = B.vuoto(); return B.dati(st.az); }
  function oggiIso() { var x = new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 101).slice(1) + '-' + String(x.getDate() + 100).slice(1); }
  function oggi(az) { var D = (az || st.az).bandi || {}; return (D.simulato && D.oggiSimulato) ? D.oggiSimulato : oggiIso(); }
  function giorno(g) { var p = String(g || '').split('-'); return p.length < 3 ? '' : Number(p[2]) + ' ' + MESI[Number(p[1]) - 1] + ' ' + p[0]; }
  function filtri() { if (!st.bandiFiltri) st.bandiFiltri = { livelli: Object.keys(B.LIVELLI), tipo: '', settore: B.profilo(st.az).settore, testo: '', soloAperti: true }; return st.bandiFiltri; }
  function opzioni(mappa, scelto, vuota) { return (vuota ? '<option value="">' + vuota + '</option>' : '') + Object.keys(mappa).map(function (k) { return '<option value="' + k + '"' + (k === scelto ? ' selected' : '') + '>' + esc(mappa[k]) + '</option>'; }).join(''); }
  function finanziamentiAttivo() { return T.moduliAttivi().some(function (m) { return m.id === 'finanziamenti'; }); }

  // ------------------------------------------------------------ vista
  function vista() {
    var sub = st.bandiSub || 'cerca';
    var h = '<h2>Ricerca bandi</h2>';
    if (d().simulato) h += '<div class="avviso">Bandi simulati: sono di fantasia e servono a provare il modulo. Le scadenze sono calcolate come se oggi fosse il ' + giorno(d().oggiSimulato) + '.</div>';
    h += '<div class="sub">' + [['cerca', 'Cerca'], ['salvati', 'Salvati (' + d().salvati.length + ')']].map(function (s) { return '<button data-a="baSub" data-k="' + s[0] + '" class="' + (sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
    return h + (sub === 'salvati' ? vistaSalvati() : vistaCerca());
  }

  function cartaFiltri(conAi) {
    var f = filtri(), p = B.profilo(st.az);
    var h = '<div class="carta"><h3 style="margin-top:0">Sede e dimensione dell\'azienda</h3><div class="riga">' +
      '<div class="campo"><label>Regione</label><select data-c="baProfilo" data-k="regione"' + (T.scrivibile() ? '' : ' disabled') + '><option value="">—</option>' + B.REGIONI.map(function (r) { return '<option' + (r === p.regione ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Comune</label><input type="text" data-c="baProfilo" data-k="comune" value="' + esc(p.comune) + '"' + (T.scrivibile() ? '' : ' disabled') + '></div>' +
      '<div class="campo"><label>Dimensione</label><select data-c="baProfilo" data-k="dimensione"' + (T.scrivibile() ? '' : ' disabled') + '>' + opzioni(B.DIMENSIONI, p.dimensione, '—') + '</select></div></div>' +
      '<p class="muto">ATECO e forma giuridica si prendono da Impostazioni' + (p.ateco ? ' (ATECO ' + esc(p.ateco) + ')' : '') + '.</p></div>';
    h += '<div class="carta"><h3 style="margin-top:0">Che bandi cerchi</h3><div class="riga">' + Object.keys(B.LIVELLI).map(function (l) {
      return '<label style="display:flex;gap:5px;align-items:center;font-size:14px;color:var(--ink)"><input type="checkbox" data-c="baLivello" value="' + l + '"' + (f.livelli.indexOf(l) >= 0 ? ' checked' : '') + '>' + B.LIVELLI[l] + '</label>'; }).join('') + '</div>' +
      '<div class="riga" style="margin-top:8px"><div class="campo"><label>Tipo di bando</label><select data-c="baFiltro" data-k="tipo">' + opzioni(B.TIPI, f.tipo, 'Tutti i tipi') + '</select></div>' +
      '<div class="campo"><label>Settore</label><select data-c="baFiltro" data-k="settore">' + opzioni(B.SETTORI, f.settore, 'Tutti i settori') + '</select></div>' +
      '<div class="campo"><label>Parole chiave</label><input type="text" data-c="baFiltro" data-k="testo" value="' + esc(f.testo) + '" placeholder="es. macchinari, export, assunzioni"></div></div>' +
      '<label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" data-c="baFiltro" data-k="soloAperti"' + (f.soloAperti ? ' checked' : '') + '> Solo bandi aperti o in arrivo</label>';
    if (conAi) B.avvisiRicerca(f, p).forEach(function (a) { h += '<div class="avviso">' + esc(a) + '</div>'; });
    return h + '<p class="muto">Gli stessi criteri valgono per la ricerca semplice nel web e per quella con l\'AI.</p></div>';
  }

  // ricerca semplice: per ogni livello una ricerca sul web con tutti i criteri, nel motore scelto
  function cartaWeb() {
    var f = filtri(), motore = st.bandiMotore || 'google', righe = B.ricercaWeb(f, B.profilo(st.az), oggi(), motore);
    return '<div class="carta"><h3 style="margin-top:0">Ricerca semplice nel web</h3><p class="muto">Non serve l\'AI: si apre una ricerca per ogni livello scelto, con tipo, settore, parole chiave e «solo bandi aperti». I risultati sono quelli del motore di ricerca: controlla sempre la pagina dell\'ente.</p>' +
      '<div class="riga"><div class="campo"><label>Motore di ricerca</label><select data-c="baMotore">' + opzioni(B.MOTORI, motore) + '</select></div></div>' +
      righe.map(function (r) {
        return '<div style="margin-top:10px">' + (r.url ? '<a class="b p" href="' + esc(r.url) + '" target="_blank" rel="noopener">Cerca bandi ' + esc(B.LIVELLI[r.livello].toLowerCase()) + '</a><p class="muto" style="word-break:break-word;margin-top:4px">' + esc(r.query) + '</p>'
          : '<span class="tag">' + esc(B.LIVELLI[r.livello]) + '</span> <span class="muto">' + esc(r.manca) + '</span>') + '</div>';
      }).join('') + '</div>';
  }
  function cartaAi() {
    var h = '<div class="carta"><h3 style="margin-top:0">Ricerca con l\'AI</h3><p class="muto">Il motore AI cerca sul web e restituisce schede con scadenza, importo, requisiti e link alla fonte, già filtrate secondo i criteri.</p>';
    if (!AI.disponibile(true)) h += '<div class="avviso info">Serve un servizio AI con ricerca web: attiva <b>Google Gemini</b> o <b>Groq</b> (gratuiti) oppure Claude in <button class="b p s" data-a="aiApriServizi">Assistente AI → Servizi AI</button>. Nel frattempo usa la ricerca semplice qui sopra.</div>';
    return h + '<div class="riga"><button class="b" data-a="baCerca"' + (st.bandiAttesa || !AI.disponibile(true) ? ' disabled' : '') + '>' + (st.bandiAttesa ? 'Ricerca in corso…' : 'Cerca con l\'AI') + '</button></div></div>';
  }

  function vistaCerca() {
    var f = filtri(), R = st.bandiRis, h = cartaFiltri(true) + cartaWeb() + cartaAi();
    var E = st.bandiErrore;
    if (st.bandiAttesa) h += '<div class="carta"><p id="baAttesa">' + esc(st.bandiAttesa === true ? 'Ricerca sul web in corso' : st.bandiAttesa) + '…</p><p class="muto">Può richiedere fino a due minuti. Se un servizio non risponde Timone passa da solo a un altro di quelli attivi.</p></div>';
    else if (E) {
      h += '<div class="carta crit rosso"><h3 style="margin-top:0">La ricerca con l\'AI non è riuscita</h3><p>' + esc(E.messaggio) + '</p>';
      if (E.tentativi && E.tentativi.length) h += E.tentativi.map(function (t) { return '<p style="border-top:1px solid var(--linea);padding-top:8px"><b>' + esc(AI.nome(t.servizio)) + '</b>: ' + esc(t.motivo) + '<br><span class="muto">' + esc(B.consiglio(t.codice)) + '</span></p>'; }).join('');
      else h += '<p class="muto">' + esc(B.consiglio(E.codice)) + '</p>';
      h += '<div class="riga" style="margin-top:8px"><button class="b p" data-a="baCerca">Riprova</button><button class="b p s" data-a="aiApriServizi">Servizi AI</button></div><p class="muto">Nel frattempo puoi usare la ricerca semplice nel web, che non richiede l\'AI.</p></div>';
    }
    else if (R) {
      var lista = B.ordina(B.filtra(R.bandi, f, oggi()), oggi());
      h += '<div class="carta"><div class="riga"><h3 style="margin:0">Risultati</h3><span class="sp"></span><span class="tag">' + esc(AI.nome(R.servizio)) + '</span></div>' +
        '<p class="muto">' + lista.length + ' bandi trovati il ' + giorno(R.quando) + (R.scartati ? ' · ' + R.scartati + ' senza link alla fonte (in fondo)' : '') + (R.bandi.length > lista.length ? ' · ' + (R.bandi.length - lista.length) + ' nascosti dai filtri' : '') + '.</p>' +
        '<div class="avviso">Risultati trovati dall\'AI sul web: date, importi e requisiti vanno verificati sulla fonte ufficiale prima di qualsiasi decisione. Un bando può mancare dall\'elenco.</div>' +
        (R.recuperata ? '<p class="muto">La risposta del servizio era incompleta: sono mostrati i bandi arrivati per intero.</p>' : '') +
        (R.saltati && R.saltati.length ? '<p class="muto">Ha risposto ' + esc(AI.nome(R.servizio)) + ' al posto di ' + esc(R.saltati.map(function (x) { return AI.nome(x.servizio) + ' (' + x.motivo + ')'; }).join(', ')) + '.</p>' : '') +
        (R.nota ? '<p class="muto">' + esc(R.nota) + '</p>' : '') + (!R.bandi.length && !R.scartati ? '<p>Nessun bando trovato con questi criteri: prova ad allargarli (più livelli, tutti i tipi, meno parole chiave) o usa la ricerca semplice nel web.</p>' : '') + '</div>';
      lista.forEach(function (b) { h += scheda(b, false); });
      if (R.senzaLink && R.senzaLink.length) h += '<details class="carta"><summary><span class="nome"><b>Bandi citati senza link alla fonte</b></span><span class="pre">' + R.senzaLink.length + '</span></summary><div class="spiega"><p class="muto">L\'AI li ha nominati ma senza la pagina ufficiale: non si possono salvare finché non trovi la fonte.</p>' +
        R.senzaLink.map(function (x) { return '<p><b>' + esc(x.titolo) + '</b>' + (x.ente ? ' · ' + esc(x.ente) : '') + ' <a class="b p s" href="' + esc(x.cerca) + '" target="_blank" rel="noopener">Cerca la fonte</a></p>'; }).join('') + '</div></details>';
      if (R.fonti && R.fonti.length) h += '<div class="carta"><h3 style="margin-top:0">Pagine consultate</h3><p class="muto">' + R.fonti.map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.titolo || 'fonte') + '</a>'; }).join(' · ') + '</p></div>';
    }
    var po = B.portali(f);
    if (po.length) h += '<div class="carta"><h3 style="margin-top:0">Portali ufficiali</h3><p class="muto">Portali istituzionali dei livelli scelti, da consultare direttamente.</p><div class="lista">' +
      po.map(function (x) { return '<a class="b s p" style="display:block;margin:6px 0" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(B.LIVELLI[x.livello]) + ' · ' + esc(x.nome) + '</a>'; }).join('') + '</div></div>';
    return h;
  }

  function vistaSalvati() {
    var a = B.analizza(st.az, oggi()), f = filtri(), mostra = B.filtra(a.righe.map(function (x) { return x.b; }), f, oggi());
    var h = '<div class="carta"><table>' + riga('Bandi da seguire (aperti, non scartati né presentati)', String(a.aperti)) + riga('In scadenza entro ' + B.PARAM.giorniScadenza + ' giorni', String(a.urgenti.length), a.urgenti.length) +
      riga('Contributi massimi dichiarati dai bandi da seguire', eur(a.potenziale)) + '</table><p class="muto">Il contributo massimo è quello del bando, non quello spettante all\'azienda: non va contato nei piani finché non è concesso.</p></div>';
    if (!a.righe.length) return h + '<div class="carta"><p>Nessun bando salvato.</p><p class="muto">Cerca nella scheda «Cerca» e salva i bandi che interessano: le scadenze vicine compariranno nella Diagnosi.</p></div>';
    h += '<details class="carta"><summary><span class="nome"><b>Filtri</b></span><span class="pre">' + mostra.length + ' di ' + a.righe.length + '</span></summary>' + cartaFiltri(false) + '</details>';
    a.righe.filter(function (x) { return mostra.indexOf(x.b) >= 0; }).forEach(function (x) { h += scheda(x.b, true); });
    return h;
  }

  function riga(et, v, forte) { return '<tr class="' + (forte ? 'tot' : '') + '"><td>' + et + '</td><td style="white-space:normal">' + v + '</td></tr>'; }
  function scheda(b, salvato) {
    var s = B.statoDi(b, oggi()), gg = b.scadenza ? Math.round((Date.parse(b.scadenza) - Date.parse(oggi())) / 86400000) : null;
    var gia = salvato ? b : B.trova(st.az, b);
    var h = '<div class="carta' + (s === 'aperto' && gg !== null && gg <= B.PARAM.giorniScadenza ? ' crit' : '') + '"><div class="riga"><h3 style="margin:0">' + esc(b.titolo) + '</h3><span class="sp"></span>' +
      (b.livello ? '<span class="tag">' + esc(B.LIVELLI[b.livello]) + '</span>' : '') + '<span class="tag ' + (s === 'aperto' ? 'ok' : s === 'scaduto' ? 'rosso' : s === 'in_arrivo' ? 'giallo' : '') + '">' + B.STATI[s] + '</span>' + (b.origine === 'simulato' ? '<span class="tag simulato">simulato</span>' : '') + '</div>' +
      '<p class="muto">' + esc([B.TIPI[b.tipo], b.ente, b.territorio].filter(Boolean).join(' · ')) + '</p>' + (b.descrizione ? '<p>' + esc(b.descrizione) + '</p>' : '') + '<table>' +
      (b.scadenza ? riga('Termine per la domanda', giorno(b.scadenza) + (gg !== null && gg >= 0 ? ' · tra ' + gg + ' giorni' : '')) : riga('Termine per la domanda', 'non indicato (a sportello o da verificare)')) +
      (b.apertura ? riga('Apertura', giorno(b.apertura)) : '') + riga('Contributo massimo', b.importo ? eur(b.importo) : 'non indicato') + (b.percentuale ? riga('Intensità', String(b.percentuale).replace('.', ',') + '% delle spese') : '') +
      (b.beneficiari ? riga('Beneficiari', esc(b.beneficiari)) : '') + riga('Settori', b.settori.length ? esc(b.settori.map(function (k) { return B.SETTORI[k]; }).join(', ')) : 'tutti') + '</table>' +
      (b.requisiti.length ? '<p class="muto" style="margin-top:8px">Requisiti principali</p><ul style="margin:4px 0;padding-left:18px">' + b.requisiti.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '');
    h += '<div class="riga" style="margin-top:8px"><a class="b p s" href="' + esc(b.url) + '" target="_blank" rel="noopener">Fonte ufficiale</a>';
    if (salvato && T.scrivibile()) {
      h += '<select data-c="baValuta" data-id="' + esc(b.id) + '" aria-label="Valutazione">' + opzioni(B.VALUTAZIONI, b.valutazione) + '</select>' +
        (finanziamentiAttivo() ? '<button class="b p s" data-a="baAgevolazione" data-id="' + esc(b.id) + '">Aggiungi alle agevolazioni</button>' : '') + '<button class="b p peri" data-a="baElimina" data-id="' + esc(b.id) + '">Elimina</button>';
    } else if (T.scrivibile()) h += gia ? '<span class="tag ok">salvato</span>' : '<button class="b p" data-a="baSalva" data-k="' + esc(B.ordina(st.bandiRis.bandi, oggi()).indexOf(b)) + '">Salva</button>';
    return h + '</div></div>';
  }

  // ------------------------------------------------------------ azioni
  function ridisegna() { var y = window.scrollY; T.disegna(); window.scrollTo(0, y); }
  var azioni = {
    baSub: function (x) { st.bandiSub = x.k; T.disegna(); },
    baCerca: function () {
      var f = B.filtriValidi(filtri()), p = B.profilo(st.az), oggiR = oggi(), primo = AI.attivi(true)[0];
      st.bandiAttesa = 'Ricerca con ' + AI.nome(primo); st.bandiErrore = null; T.disegna();
      AI.chiedi({ sistema: 'Ruolo: esperto di finanza agevolata italiana ed europea. Cerca con lo strumento di ricerca web e usa solo pagine ufficiali (enti, ministeri, regioni, comuni, Camere di commercio, Commissione europea). Per ogni bando riporta l\'indirizzo completo (https://…) della pagina ufficiale trovata nella ricerca.', testo: B.richiesta(f, p, oggiR), schema: B.SCHEMA, web: true, maxToken: 12000,
        suCambio: function (da, a, motivo) { st.bandiAttesa = AI.nome(da) + ' non utilizzabile (' + motivo + '): ricerca con ' + AI.nome(a); var e = document.getElementById('baAttesa'); if (e) e.textContent = st.bandiAttesa + '…'; } })
        .then(function (x) {
          var r = B.risultati(x.json.bandi, 'ricerca AI · ' + AI.nome(x.servizio));
          st.bandiRis = { bandi: B.ordina(r.bandi, oggiR), scartati: r.scartati, senzaLink: r.senzaLink, nota: x.json.nota, fonti: x.fonti || [], servizio: x.servizio, saltati: x.saltati, recuperata: x.recuperata, quando: oggiR };
          T.toast(r.bandi.length ? r.bandi.length + ' bandi trovati: verifica sempre la fonte' : 'Nessun bando con link alla fonte');
        })
        .catch(function (e) { st.bandiErrore = { messaggio: e.message, codice: e.codice, tentativi: e.tentativi || [] }; })
        .then(function () { st.bandiAttesa = false; if (st.scheda === 'bandi') ridisegna(); });
    },

    baSalva: function (x) { var b = B.ordina(st.bandiRis.bandi, oggi())[Number(x.k)]; if (!b) return; B.salva(st.az, b, oggi()); T.salva(); ridisegna(); T.toast('Bando salvato'); },
    baElimina: function (x) { T.conferma('Eliminare questo bando dai salvati?', 'Elimina').then(function (si) { if (!si) return; d().salvati = d().salvati.filter(function (b) { return b.id !== x.id; }); T.salva(); ridisegna(); }); },
    baAgevolazione: function (x) {
      var b = d().salvati.filter(function (y) { return y.id === x.id; })[0]; if (!b) return;
      var F = st.az.finanziamenti = st.az.finanziamenti || { prestiti: [], agevolazioni: [] }; F.agevolazioni = F.agevolazioni || [];
      if (F.agevolazioni.some(function (g) { return g.fonte === b.url && g.nome === b.titolo; })) { T.toast('Già presente tra le agevolazioni'); return; }
      F.agevolazioni.push(B.agevolazione(b, oggi())); b.valutazione = b.valutazione === 'valutare' ? 'interessa' : b.valutazione;
      T.salva(); ridisegna(); T.toast('Aggiunto al registro agevolazioni (Finanziamenti): verifica i requisiti');
    }
  };
  var cambi = {
    baProfilo: function (e) { var p = d().profilo; p[e.dataset.k] = String(e.value).trim().slice(0, 80); T.salva(); ridisegna(); },
    baFiltro: function (e) { var f = filtri(); f[e.dataset.k] = e.type === 'checkbox' ? e.checked : String(e.value).trim(); ridisegna(); },
    baMotore: function (e) { st.bandiMotore = e.value; ridisegna(); },
    baLivello: function (e) { var f = filtri(); f.livelli = f.livelli.filter(function (l) { return l !== e.value; }); if (e.checked) f.livelli.push(e.value); ridisegna(); },
    baValuta: function (e) { var b = d().salvati.filter(function (y) { return y.id === e.dataset.id; })[0]; if (b && B.VALUTAZIONI[e.value]) { b.valutazione = e.value; T.salva(); ridisegna(); } }
  };

  T.registra({
    id: 'bandi', titolo: 'Bandi', senzaEsercizi: true,
    descrizione: 'Ricerca di bandi comunali, regionali, nazionali ed europei per tipo e settore con il motore AI (ricerca web con fonti), portali ufficiali, archivio dei bandi salvati con scadenze, collegamento al registro agevolazioni.',
    vista: vista, azioni: azioni, cambi: cambi,
    criticita: function (az) { return az.bandi ? B.criticita(B.analizza(az, oggi(az)), eur) : []; },
    collaudo: function (az) { return az.bandi ? B.collaudo(az) : []; },
    simula: function (az) { az.bandi = B.simula(az, oggiIso()); }
  });
})();
