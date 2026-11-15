/* Timone · Assistente AI (si registra in app.js)
   Chat con il motore AI che conosce i dati dell'azienda aperta (bilanci riclassificati, indici, criticità di tutti
   i moduli) e scelta dei servizi AI, come in Garden Manager AI. La conversazione resta su questo dispositivo. */
(function () {
  'use strict';
  var T = window.Timone, AI = window.TimoneAI, M = window.Motore, Sim = window.Simulatore;
  var esc = T.esc, eur = T.eur, fmt = T.fmt, st = T.stato;
  var $ = function (s) { return document.querySelector(s); };
  var SUGGERIMENTI = ['Come sta andando l\'azienda? Riassumi punti di forza e debolezza.', 'Quali sono le tre azioni più urgenti per migliorare la liquidità?', 'Spiegami le criticità della diagnosi in parole semplici.',
    'Perché l\'EBITDA è cambiato rispetto all\'anno precedente?', 'Come posso ridurre i giorni di incasso dei clienti?', 'Che cosa dovrei chiedere al commercialista prima della chiusura del bilancio?'];

  // ------------------------------------------------------------ conversazione (solo su questo dispositivo)
  function chiaveChat() { return 'timone.chat.' + (st.az ? st.az.id : 'nessuna'); }
  function messaggi() { if (st.aiChat && st.aiChat.id === chiaveChat()) return st.aiChat.m; var m = []; try { m = JSON.parse(localStorage.getItem(chiaveChat())) || []; } catch (e) { /* non disponibile */ } st.aiChat = { id: chiaveChat(), m: m }; return m; }
  function salvaChat() { try { localStorage.setItem(chiaveChat(), JSON.stringify(messaggi().slice(-40))); } catch (e) { /* non disponibile */ } }

  // ------------------------------------------------------------ contesto dell'azienda per il motore AI
  function contesto() {
    var az = st.az, a = T.anni(), cl = az.classificazione, out = [];
    out.push('Data odierna: ' + new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) + '.');
    out.push('Azienda: ' + az.nome + (az.simulata ? ' (AZIENDA SIMULATA: dati di fantasia)' : '') + '; attività: ' + ((Sim.SETTORI[az.settore] || {}).nome || az.settore || 'n.d.') + (az.forma ? '; forma: ' + az.forma : '') + (az.ateco ? '; ATECO ' + az.ateco : '') + '.');
    out.push('Moduli attivi: ' + T.moduliAttivi().map(function (m) { return m.titolo; }).join(', ') + '.');
    if (!a.length) { out.push('Nessun esercizio di bilancio inserito.'); return out.join('\n'); }
    a.slice(-3).forEach(function (anno) {
      var n = T.nDi(anno), man = M.mancanti(n);
      if (!T.completo(anno, 'ce')) { out.push('Esercizio ' + anno + ': conto economico incompleto (mancano ' + man.length + ' voci).'); return; }
      var r = M.riclassifica(n, cl), sp = T.completo(anno, 'sp');
      out.push('Esercizio ' + anno + ': ricavi ' + eur(r.ricavi) + ', valore della produzione ' + eur(r.valore_produzione) + ', costo del personale ' + eur(r.personale) + ', EBITDA ' + eur(r.ebitda) + ', EBIT ' + eur(r.ebit) + ', utile netto ' + eur(r.utile) +
        (sp ? ', patrimonio netto ' + eur(r.patrimonio_netto) + ', debito finanziario netto ' + eur(r.pfn) + ', liquidità ' + eur(n.liquidita) + ', crediti clienti ' + eur(n.crediti_clienti) + ', magazzino ' + eur(n.rimanenze) : ', stato patrimoniale incompleto') + '. ' + T.qualita(anno).testo);
    });
    var ult = a[a.length - 1];
    if (T.completo(ult)) {
      var i = a.indexOf(ult), ix = M.calcolaIndici(T.nDi(ult), i > 0 ? T.nDi(a[i - 1]) : null, cl);
      out.push('Indici ' + ult + ': ' + M.INDICI.filter(function (x) { return ix[x.id] && ix[x.id].v !== null; }).map(function (x) { return x.nome + ' ' + fmt(ix[x.id].v, x.unita); }).join('; ') + '.');
      var dg = M.diagnosi(T.serieCompleta(ult), cl);
      out.push(dg.length ? 'Criticità di bilancio ' + ult + ': ' + dg.map(function (x) { return '[' + x.gravita + '] ' + x.titolo + ' (' + x.dati + ')'; }).join('; ') + '.' : 'Nessuna criticità di bilancio rilevata dalle regole.');
    }
    var cm = T.criticitaModuli(ult);
    if (cm.length) out.push('Criticità dei moduli operativi: ' + cm.slice(0, 15).map(function (x) { return '[' + x.modulo + '] ' + x.titolo + ' (' + x.dati + ')'; }).join('; ') + '.');
    return out.join('\n');
  }

  // testo semplice → HTML sicuro (grassetto, elenchi, a capo)
  function ricco(t) {
    return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n/).map(function (r) { return /^\s*[-•*] /.test(r) ? '<li>' + r.replace(/^\s*[-•*] /, '') + '</li>' : r ? '<p>' + r + '</p>' : ''; }).join('').replace(/(<li>.*?<\/li>)+/g, function (x) { return '<ul style="margin:4px 0;padding-left:18px">' + x + '</ul>'; });
  }
  function fumetto(m) {
    var io = m.role === 'user';
    return '<div class="carta" style="' + (io ? 'background:var(--acc2);margin-left:15%' : 'margin-right:5%') + '">' + (io ? '<p>' + esc(m.content) + '</p>' : ricco(m.content)) +
      (m.fonti && m.fonti.length ? '<p class="muto"><b>Fonti:</b> ' + m.fonti.map(function (f) { return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.titolo || 'fonte') + '</a>'; }).join(' · ') + '</p>' : '') +
      (m.servizio ? '<p class="muto" style="font-size:11px">' + esc(AI.nome(m.servizio)) + (m.saltati && m.saltati.length ? ' · al posto di ' + esc(m.saltati.map(function (x) { return AI.nome(x.servizio) + ' (' + x.motivo + ')'; }).join(', ')) : '') + '</p>' : '') + '</div>';
  }

  // ------------------------------------------------------------ viste
  function vista() {
    var sub = st.aiSub || 'chiedi';
    return '<h2>Assistente AI</h2><div class="sub">' + [['chiedi', 'Chiedi'], ['servizi', 'Servizi AI']].map(function (s) { return '<button data-a="aiSub" data-k="' + s[0] + '" class="' + (sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      (sub === 'servizi' ? vistaServizi() : vistaChiedi());
  }
  function vistaChiedi() {
    var m = messaggi(), pronto = AI.disponibile();
    var h = pronto ? '' : '<div class="avviso">L\'assistente usa un servizio AI: attivane uno (ad esempio <b>Google Gemini</b>, gratuito) in <button class="b p s" data-a="aiSub" data-k="servizi">Servizi AI</button>.</div>';
    h += '<p class="muto">L\'assistente conosce i bilanci riclassificati, gli indici e le criticità di <b>' + esc(st.az.nome) + '</b>. I dati dell\'azienda vengono inviati al servizio AI scelto: per la massima riservatezza usa Ollama sul tuo computer.</p>';
    h += '<div id="aiChat">' + (m.length ? m.map(fumetto).join('') : '<div class="carta"><p class="muto">Fai una domanda sull\'azienda: le risposte distinguono fatti, ipotesi e consigli.</p></div>') + '</div>';
    if (!m.length) h += '<div class="riga" style="margin:8px 0">' + SUGGERIMENTI.map(function (s, i) { return '<button class="b p s" data-a="aiSuggerito" data-i="' + i + '"' + (pronto ? '' : ' disabled') + '>' + esc(s) + '</button>'; }).join('') + '</div>';
    h += '<div class="carta"><textarea id="aiDomanda" rows="3" style="width:100%;font:inherit;background:var(--carta);color:var(--ink);border:1px solid var(--linea);border-radius:9px;padding:8px" placeholder="Scrivi la tua domanda…"></textarea>' +
      '<div class="riga" style="margin-top:8px">' + (AI.disponibile(true) ? '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="aiWeb"' + (st.aiWeb ? ' checked' : '') + '> Cerca fonti sul web</label>' : '') +
      '<span class="sp"></span>' + (m.length ? '<button class="b p s" data-a="aiNuova">Nuova conversazione</button>' : '') + '<button class="b" id="aiInvia" data-a="aiInvia"' + (pronto && !st.aiAttesa ? '' : ' disabled') + '>Invia</button></div></div>';
    return h;
  }
  function vistaServizi() {
    var c = AI.config();
    var h = '<div class="carta"><div class="riga"><h3 style="margin:0">Servizi AI</h3><span class="sp"></span>' + (AI.disponibile() ? '<span class="tag ok">attivo</span>' : '<span class="tag giallo">non configurato</span>') + '</div>' +
      '<p class="muto">Per iniziare gratis: crea una chiave su <a href="' + AI.SERVIZI.gemini.link + '" target="_blank" rel="noopener">Google AI Studio</a> (un minuto, senza carta) e incollala in Google Gemini. Le chiavi restano solo su questo dispositivo e non entrano nelle esportazioni. La ricerca bandi richiede Gemini o Claude (ricerca web).</p>' +
      '<div class="riga"><div class="campo"><label>Servizio principale</label><select id="aiPrincipale">' + AI.ORDINE.map(function (id) { return '<option value="' + id + '"' + (c.principale === id ? ' selected' : '') + '>' + esc(AI.SERVIZI[id].nome) + ' · ' + esc(AI.SERVIZI[id].costo) + '</option>'; }).join('') + '</select></div></div>' +
      '<label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="aiRiserva"' + (c.riserva ? ' checked' : '') + '> Se un servizio non è utilizzabile, passa in automatico a un altro dei servizi attivi</label>' +
      '<p class="muto">Il servizio che non risponde (limite raggiunto, chiave rifiutata, modello non trovato, errore) resta in pausa per qualche minuto e le richieste partono dagli altri. Cambiando chiave o modello la pausa si annulla.</p></div>';
    AI.ORDINE.forEach(function (id) {
      var s = AI.SERVIZI[id], x = c.servizi[id], mostraBase = id === 'custom' || id === 'ollama';
      h += '<details class="carta" data-servizio="' + id + '"' + (x.attivo ? ' open' : '') + '><summary><span class="nome"><b>' + esc(s.nome) + '</b> <span class="muto">' + esc(s.costo) + (s.web ? ' · ricerca web' : '') + '</span></span>' + (x.attivo ? (AI.pausa(id) ? '<span class="tag giallo">in pausa</span>' : AI.disponibile() ? '<span class="tag ok">attivo</span>' : '') : '') + '</summary><div class="spiega">' +
        (x.attivo && AI.pausa(id) ? '<div class="avviso">Non utilizzabile (' + esc(AI.pausa(id).motivo) + '): in pausa fino alle ' + new Date(AI.pausa(id).fino).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) + ', intanto rispondono gli altri servizi attivi. <button class="b p s" data-a="aiRiattiva" data-id="' + id + '">Riprova ora</button></div>' : '') +
        '<p class="muto">' + esc(s.nota) + (s.link ? ' <a href="' + esc(s.link) + '" target="_blank" rel="noopener">Ottieni la chiave</a>' : '') + '</p>' +
        '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="aiAttivo"' + (x.attivo ? ' checked' : '') + '> Usa questo servizio</label><div class="riga" style="margin-top:6px">' +
        (s.chiave || id === 'custom' ? '<div class="campo"><label>Chiave API</label><input type="password" class="aiChiave" autocomplete="off" value="' + esc(x.chiave) + '"></div>' : '') +
        '<div class="campo"><label>Modello</label>' + tendinaModelli(id, x.modello, AI.elencoModelli(id, c)) + '</div>' +
        (mostraBase ? '<div class="campo"><label>Indirizzo</label><input type="text" class="aiBase" placeholder="' + esc(s.base || 'https://…/v1') + '" value="' + esc(x.base) + '"></div>' : '') + '</div>' +
        '<div class="riga" style="margin-top:8px"><button class="b p s" data-a="aiProva" data-id="' + id + '">Prova collegamento</button>' + (id === 'pollinations' ? '' : '<button class="b p s" data-a="aiModelli" data-id="' + id + '">Aggiorna elenco modelli</button>') + '</div><div class="muto" id="aiEsito_' + id + '"></div></div></details>';
    });
    return h + '<div class="riga"><button class="b" data-a="aiSalva">Salva servizi AI</button></div>';
  }

  /* Menu a tendina dei modelli, uguale per ogni servizio AI (anche per quelli aggiunti in futuro): «predefinito»,
     i modelli noti e memorizzati, e «Altro modello…» per scriverne uno a mano. */
  function tendinaModelli(id, scelto, elenco) {
    var pred = AI.SERVIZI[id].modello, altro = !!scelto && elenco.indexOf(scelto) < 0;
    return '<select class="aiModello" data-c="aiModelloScelta" id="aiMod_' + id + '">' +
      (pred ? '<option value="">Predefinito (' + esc(pred) + ')</option>' : '<option value="">— scegli —</option>') +
      elenco.map(function (m) { return '<option value="' + esc(m) + '"' + (m === scelto ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') +
      '<option value="__altro"' + (altro ? ' selected' : '') + '>Altro modello…</option></select>' +
      '<input type="text" class="aiModelloAltro" placeholder="nome del modello" value="' + esc(altro ? scelto : '') + '" style="margin-top:6px;' + (altro ? '' : 'display:none') + '">';
  }
  function modelloScelto(el) { var t = el.querySelector('.aiModello'); if (!t) return ''; return t.value === '__altro' ? el.querySelector('.aiModelloAltro').value.trim() : t.value; }

  // configurazione letta dalla pagina (anche prima di salvarla)
  function raccogli() {
    var servizi = {};
    document.querySelectorAll('[data-servizio]').forEach(function (el) {
      var v = function (c) { var i = el.querySelector(c); return i ? i.value.trim() : ''; };
      servizi[el.dataset.servizio] = { attivo: el.querySelector('.aiAttivo').checked, chiave: v('.aiChiave'), modello: modelloScelto(el), base: v('.aiBase'), elenco: AI.config().servizi[el.dataset.servizio].elenco };
    });
    return { principale: $('#aiPrincipale').value, riserva: $('#aiRiserva').checked, servizi: servizi };
  }

  function invia(testo) {
    testo = String(testo || '').trim(); if (!testo || st.aiAttesa) return;
    var m = messaggi(), web = !!($('#aiWeb') && $('#aiWeb').checked); st.aiWeb = web;
    m.push({ role: 'user', content: testo }); st.aiAttesa = true; T.disegna();
    var box = document.createElement('div'); box.className = 'carta'; box.style.marginRight = '5%'; box.innerHTML = '<p class="muto">Sto pensando…</p>';
    var chat = $('#aiChat'); if (chat) { chat.appendChild(box); box.scrollIntoView({ block: 'end' }); }
    var acc = '';
    AI.chat({ storia: m.slice(-12), contesto: contesto(), web: web, suTesto: function (t) { acc += t; box.innerHTML = ricco(acc); },
      suRicomincia: function () { acc = ''; },
      suCambio: function (da, a, motivo) { box.innerHTML = '<p class="muto">' + esc(AI.nome(da)) + ' non utilizzabile (' + esc(motivo) + '): passo a ' + esc(AI.nome(a)) + '…</p>'; } })
      .then(function (r) { m.push({ role: 'assistant', content: r.testo || acc, fonti: r.fonti, servizio: r.servizio, saltati: r.saltati }); salvaChat(); })
      .catch(function (e) { m.pop(); T.toast(e.message); st.aiBozza = testo; })
      .then(function () { st.aiAttesa = false; if (st.scheda !== 'assistente') return; T.disegna(); var d = $('#aiDomanda'); if (d && st.aiBozza) { d.value = st.aiBozza; st.aiBozza = null; } var c = $('#aiChat'); if (c && c.lastElementChild) c.lastElementChild.scrollIntoView({ block: 'end' }); });
  }

  var azioni = {
    aiSub: function (x) { st.aiSub = x.k; T.disegna(); },
    aiApriServizi: function () { st.aiSub = 'servizi'; st.scheda = 'assistente'; T.disegna(); window.scrollTo(0, 0); },
    aiInvia: function () { invia($('#aiDomanda').value); },
    aiSuggerito: function (x) { invia(SUGGERIMENTI[Number(x.i)]); },
    aiNuova: function () { T.conferma('Iniziare una nuova conversazione? Quella attuale sarà cancellata da questo dispositivo.', 'Nuova').then(function (si) { if (!si) return; messaggi().length = 0; salvaChat(); T.disegna(); }); },
    aiSalva: function () {
      var c = raccogli(); c.servizi[c.principale].attivo = true;
      if (!AI.salvaConfig(c)) { T.toast('Impossibile salvare su questo dispositivo'); return; }
      T.disegna(); T.toast(AI.disponibile() ? 'Servizi AI salvati' : 'Salvato: manca ancora una chiave valida');
    },
    aiRiattiva: function (x) { AI.riattiva(x.id); T.disegna(); T.toast(AI.nome(x.id) + ' di nuovo disponibile'); },
    aiProva: function (x) {
      var out = $('#aiEsito_' + x.id); out.textContent = 'Prova in corso…';
      AI.prova(x.id, raccogli()).then(function (r) { AI.riattiva(x.id); out.innerHTML = '<span class="su">✓ Collegato</span> · ' + esc(r.modello) + ' · ' + r.secondi + ' s · «' + esc(r.risposta) + '»'; })
        .catch(function (e) { out.innerHTML = '<span class="giu">' + esc(e.message) + '</span>'; });
    },
    aiModelli: function (x) {
      var out = $('#aiEsito_' + x.id); out.textContent = 'Lettura dei modelli…';
      AI.modelli(x.id, raccogli()).then(function (l) {
        AI.memorizzaElenco(x.id, l); // l'elenco resta nel menu a tendina anche le volte successive
        var el = document.querySelector('[data-servizio="' + x.id + '"]'), scelto = modelloScelto(el), box = el.querySelector('.aiModello').parentNode;
        box.innerHTML = '<label>Modello</label>' + tendinaModelli(x.id, scelto, AI.elencoModelli(x.id));
        out.textContent = l.length + ' modelli disponibili e memorizzati: scegli dal menu Modello.';
      }).catch(function (e) { out.innerHTML = '<span class="giu">' + esc(e.message) + '</span>'; });
    }

  };
  document.addEventListener('keydown', function (ev) { if (ev.target && ev.target.id === 'aiDomanda' && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); azioni.aiInvia(); } });

  var cambi = {
    aiModelloScelta: function (e) { var a = e.parentNode.querySelector('.aiModelloAltro'); a.style.display = e.value === '__altro' ? '' : 'none'; if (e.value === '__altro') a.focus(); }
  };

  T.registra({
    id: 'assistente', titolo: 'Assistente AI', senzaEsercizi: true,
    descrizione: 'Domande in linguaggio naturale sull\'azienda: il motore AI (Gemini, Groq, OpenRouter, Mistral, Claude, Ollama…) conosce bilanci, indici e criticità. Servizi scelti dall\'utente, chiavi solo su questo dispositivo.',
    vista: vista, azioni: azioni, cambi: cambi,
    contesto: contesto
  });
})();
