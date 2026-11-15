/* Timone · motore AI multi-servizio (stessa impostazione di Garden Manager AI)
   Servizi selezionabili: Google Gemini, Groq, OpenRouter, Mistral, Cerebras, Hugging Face, DeepSeek, Pollinations,
   Ollama, OpenAI, Anthropic Claude, altro servizio compatibile OpenAI.
   - Le chiavi restano su questo dispositivo (localStorage) e non entrano nelle esportazioni dell'azienda.
   - Se il servizio principale esaurisce la quota o non risponde, la richiesta passa al successivo configurato.
   - La ricerca sul web (con fonti) è disponibile con Google Gemini e Claude.
   Uso: TimoneAI.chiedi({ sistema, testo, schema, web }) → { testo, json, fonti, servizio }
        TimoneAI.chat({ storia, contesto, web, suTesto }) → { testo, fonti, servizio } */
(function (root) {
  'use strict';
  var CHIAVE = 'timone.ai';

  // ------------------------------------------------------------ servizi
  // I nomi dei modelli sono modificabili: i piani gratuiti cambiano spesso.
  var SERVIZI = {
    gemini: { nome: 'Google Gemini', tipo: 'gemini', costo: 'gratuito', base: 'https://generativelanguage.googleapis.com/v1beta', modello: 'gemini-flash-latest',
      modelli: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'], web: true, chiave: true, link: 'https://aistudio.google.com/apikey',
      nota: 'Consigliato. Piano gratuito senza carta di credito, ricerca Google con fonti (necessaria per la ricerca bandi). Nel piano gratuito Google può usare i dati per migliorare i servizi.' },
    groq: { nome: 'Groq (Llama, Qwen…)', tipo: 'openai', costo: 'gratuito', base: 'https://api.groq.com/openai/v1', modello: 'llama-3.3-70b-versatile',
      modelli: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b', 'openai/gpt-oss-120b'], chiave: true, link: 'https://console.groq.com/keys',
      nota: 'Piano gratuito senza carta, molto veloce. Limiti per minuto e per giorno variabili.' },
    openrouter: { nome: 'OpenRouter (modelli :free)', tipo: 'openai', costo: 'gratuito con limiti', base: 'https://openrouter.ai/api/v1', modello: 'meta-llama/llama-3.3-70b-instruct:free',
      modelli: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3.1:free', 'qwen/qwen-2.5-72b-instruct:free', 'mistralai/mistral-small-3.2-24b-instruct:free'], chiave: true, link: 'https://openrouter.ai/keys',
      nota: 'Un\'unica chiave per molti modelli gratuiti (quelli che finiscono con ":free"). Circa 50 richieste gratuite al giorno.' },
    huggingface: { nome: 'Hugging Face', tipo: 'openai', costo: 'piccolo credito mensile', base: 'https://router.huggingface.co/v1', modello: 'meta-llama/Llama-3.3-70B-Instruct',
      modelli: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct'], chiave: true, link: 'https://huggingface.co/settings/tokens', nota: 'Credito gratuito mensile ridotto: adatto come riserva.' },
    pollinations: { nome: 'Pollinations (senza chiave)', tipo: 'openai', costo: 'gratuito, sperimentale', base: 'https://text.pollinations.ai/openai', modello: 'openai', modelli: ['openai', 'mistral'], chiave: false, link: 'https://pollinations.ai/',
      nota: 'Funziona senza chiave ma con limiti stretti. Sconsigliato per dati aziendali: le richieste passano da un servizio comunitario.' },
    ollama: { nome: 'Ollama (sul tuo computer)', tipo: 'openai', costo: 'gratuito, locale', base: 'http://localhost:11434/v1', modello: 'llama3.2', modelli: ['llama3.2', 'gemma3', 'qwen2.5'], chiave: false, link: 'https://ollama.com/download',
      nota: 'Modelli eseguiti sul tuo computer: gratuiti e privati, i dati non escono dall\'azienda. Avvia Ollama con OLLAMA_ORIGINS impostato all\'indirizzo dell\'app.' },
    mistral: { nome: 'Mistral AI', tipo: 'openai', costo: 'a pagamento', base: 'https://api.mistral.ai/v1', modello: 'mistral-small-latest', modelli: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'], chiave: true, link: 'https://console.mistral.ai/api-keys',
      nota: 'A consumo. Azienda europea, buona qualità in italiano.' },
    cerebras: { nome: 'Cerebras', tipo: 'openai', costo: 'a pagamento', base: 'https://api.cerebras.ai/v1', modello: 'llama-3.3-70b', modelli: ['llama-3.3-70b', 'qwen-3-32b', 'gpt-oss-120b'], chiave: true, link: 'https://cloud.cerebras.ai/', nota: 'A consumo, molto veloce.' },
    deepseek: { nome: 'DeepSeek', tipo: 'openai', costo: 'economico', base: 'https://api.deepseek.com', modello: 'deepseek-chat', modelli: ['deepseek-chat', 'deepseek-reasoner'], chiave: true, link: 'https://platform.deepseek.com/api_keys', nota: 'API molto economica.' },
    openai: { nome: 'OpenAI GPT', tipo: 'openai', costo: 'a pagamento', base: 'https://api.openai.com/v1', modello: 'gpt-4o-mini', modelli: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'], chiave: true, link: 'https://platform.openai.com/api-keys', nota: 'Nessun piano API gratuito.' },
    anthropic: { nome: 'Anthropic Claude', tipo: 'anthropic', costo: 'a pagamento', base: 'https://api.anthropic.com', modello: 'claude-opus-5-5', modelli: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'], web: true, chiave: true, link: 'https://console.anthropic.com/',
      nota: 'A consumo. Massima qualità per analisi di bilancio e ricerca bandi con fonti.' },
    custom: { nome: 'Altro servizio compatibile OpenAI', tipo: 'openai', costo: '—', base: '', modello: '', modelli: [], chiave: false, link: '', nota: 'Qualsiasi servizio con API compatibile OpenAI (LM Studio, Together, server aziendale…): indica indirizzo, chiave e modello.' }
  };
  var a_pagamento = function (id) { return /pagamento|economico/.test(SERVIZI[id].costo); };
  var ORDINE = Object.keys(SERVIZI).filter(function (id) { return !a_pagamento(id) && id !== 'custom'; }).concat(Object.keys(SERVIZI).filter(a_pagamento), ['custom']);

  // ------------------------------------------------------------ configurazione
  function leggiConf() { try { return JSON.parse(localStorage.getItem(CHIAVE)) || {}; } catch (e) { return {}; } }
  function config(grezza) {
    var c = grezza || leggiConf(), servizi = {};
    ORDINE.forEach(function (id) { servizi[id] = Object.assign({ attivo: false, chiave: '', modello: '', base: '' }, (c.servizi || {})[id]); });
    return { principale: SERVIZI[c.principale] ? c.principale : 'gemini', riserva: c.riserva !== false, servizi: servizi };
  }
  function salvaConfig(c) { try { localStorage.setItem(CHIAVE, JSON.stringify(c)); return true; } catch (e) { return false; } }
  function usabile(id, cfg) { var s = SERVIZI[id], c = cfg.servizi[id]; return c.attivo && (!s.chiave || !!c.chiave) && (id !== 'custom' || !!c.base); }
  function disponibile(conWeb) { var cfg = config(); return ORDINE.some(function (id) { return usabile(id, cfg) && (!conWeb || SERVIZI[id].web); }); }
  function attivi(conWeb, cfg) {
    cfg = cfg || config();
    var l = [cfg.principale].concat(ORDINE.filter(function (x) { return x !== cfg.principale; })).filter(function (id) { return usabile(id, cfg) && (!conWeb || SERVIZI[id].web); });
    return cfg.riserva ? l : l.slice(0, 1);
  }
  function nome(id) { return SERVIZI[id] ? SERVIZI[id].nome : id; }
  function modello(id, cfg) { return cfg.servizi[id].modello || SERVIZI[id].modello; }
  function base(id, cfg) { return (cfg.servizi[id].base || SERVIZI[id].base).replace(/\/+$/, ''); }

  // ------------------------------------------------------------ errori
  function ErroreAI(msg, codice, servizio) { var e = new Error(msg); e.codice = codice; e.servizio = servizio; return e; }
  var RIPROVABILI = ['quota', 'server', 'rete', 'modello', 'chiave', 'rifiuto', 'formato'];
  function erroreHttp(status, corpo, id) {
    var n = nome(id), msg = (corpo && ((corpo.error && corpo.error.message) || corpo.message || (typeof corpo.error === 'string' ? corpo.error : ''))) || '';
    if (status === 401 || status === 403) return ErroreAI(n + ': chiave non valida o senza accesso a questo modello.', 'chiave', id);
    if (status === 429) return ErroreAI(n + ': limite raggiunto per ora. Riprova più tardi o aggiungi un altro servizio come riserva.', 'quota', id);
    if (status === 404) return ErroreAI(n + ': modello non trovato. Aggiorna l\'elenco dei modelli nei servizi AI.', 'modello', id);
    if (status >= 500) return ErroreAI(n + ': servizio momentaneamente non disponibile (' + status + ').', 'server', id);
    return ErroreAI(n + ': richiesta non accettata (' + status + ') ' + String(msg).slice(0, 200), 'richiesta', id);
  }
  async function scarica(url, opz, id, ms) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw ErroreAI('Sei offline: le funzioni AI richiedono una connessione.', 'offline', id);
    ms = ms || 120000;
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, ms), r;
    try { r = await fetch(url, Object.assign({}, opz, { signal: ctrl.signal })); }
    catch (e) {
      if (e.name === 'AbortError') throw ErroreAI(nome(id) + ': nessuna risposta entro ' + Math.round(ms / 1000) + ' secondi.', 'rete', id);
      throw ErroreAI(nome(id) + ': servizio non raggiungibile dal browser (rete, blocco o CORS).', 'rete', id);
    } finally { clearTimeout(timer); }
    if (!r.ok) { var b = null; try { b = await r.json(); } catch (e) { /* corpo non JSON */ } throw erroreHttp(r.status, b, id); }
    return r;
  }
  async function leggiSSE(risposta, suDato) {
    var lettore = risposta.body.getReader(), dec = new TextDecoder(), buf = '';
    for (;;) {
      var x = await lettore.read(); if (x.done) break;
      buf += dec.decode(x.value, { stream: true });
      var i;
      while ((i = buf.indexOf('\n')) >= 0) {
        var riga = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (riga.indexOf('data:') === 0) { var d = riga.slice(5).trim(); if (d) { try { suDato(d); } catch (e) { /* frammento non valido */ } } }
      }
    }
  }

  // ------------------------------------------------------------ JSON robusto
  function leggiJSON(testo) {
    var t = String(testo || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    return JSON.parse(t);
  }
  // completa i campi mancanti secondo lo schema, così l'interfaccia non si interrompe
  function adatta(schema, v) {
    if (!schema) return v;
    var t = schema.type;
    if (t === 'object') { var o = v && typeof v === 'object' && !Array.isArray(v) ? v : {}, out = {}; Object.keys(schema.properties || {}).forEach(function (k) { out[k] = adatta(schema.properties[k], o[k]); }); return out; }
    if (t === 'array') return Array.isArray(v) ? v.map(function (x) { return adatta(schema.items, x); }) : [];
    if (t === 'number' || t === 'integer') { var n = Number(v); return isFinite(n) && v !== null && v !== '' ? (t === 'integer' ? Math.round(n) : n) : null; }
    if (t === 'boolean') return v === true || v === 'true';
    if (schema.enum) return schema.enum.indexOf(v) >= 0 ? v : schema.enum[0];
    return v === null || v === undefined ? '' : String(v);
  }
  function istruzioneSchema(schema) { return 'Rispondi esclusivamente con un oggetto JSON valido (nessun testo fuori dal JSON), conforme a questo JSON Schema; usa tutti i campi richiesti:\n' + JSON.stringify(schema); }

  // ------------------------------------------------------------ adattatori
  // r = { sistema, messaggi:[{role, content}], schema, web, flusso, suTesto, maxToken, ms }
  async function gemini(id, cfg, r) {
    var mod = modello(id, cfg), chiave = cfg.servizi[id].chiave, sistema = r.sistema;
    var corpo = { contents: r.messaggi.map(function (m) { return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }; }), generationConfig: { maxOutputTokens: Math.max(r.maxToken, 8192), temperature: 0.3 } };
    if (r.web) corpo.tools = [{ googleSearch: {} }];
    // con la ricerca web lo schema va nelle istruzioni (alcuni modelli non accettano strumenti e schema insieme)
    if (r.schema && !r.web) { corpo.generationConfig.responseMimeType = 'application/json'; corpo.generationConfig.responseJsonSchema = r.schema; }
    else if (r.schema) sistema += '\n\n' + istruzioneSchema(r.schema);
    corpo.systemInstruction = { parts: [{ text: sistema }] };
    var intest = { 'Content-Type': 'application/json', 'x-goog-api-key': chiave }, url = base(id, cfg) + '/models/' + encodeURIComponent(mod);
    if (!r.flusso) {
      var risp;
      try { risp = await scarica(url + ':generateContent', { method: 'POST', headers: intest, body: JSON.stringify(corpo) }, id, r.ms); }
      catch (e) { // modello che rifiuta lo schema: lo si passa nelle istruzioni
        if (e.codice !== 'richiesta' || !corpo.generationConfig.responseJsonSchema) throw e;
        delete corpo.generationConfig.responseJsonSchema; delete corpo.generationConfig.responseMimeType; corpo.systemInstruction.parts[0].text += '\n\n' + istruzioneSchema(r.schema);
        risp = await scarica(url + ':generateContent', { method: 'POST', headers: intest, body: JSON.stringify(corpo) }, id, r.ms);
      }
      var j = await risp.json();
      if (j.promptFeedback && j.promptFeedback.blockReason) throw ErroreAI(nome(id) + ': richiesta bloccata dai filtri del servizio.', 'rifiuto', id);
      var c = (j.candidates || [])[0], testo = testoGemini(c);
      if (!testo) throw ErroreAI(nome(id) + ': risposta vuota (' + ((c && c.finishReason) || 'sconosciuto') + ').', 'rifiuto', id);
      return { testo: testo, fonti: fontiGemini(c), modello: mod };
    }
    var flusso = await scarica(url + ':streamGenerateContent?alt=sse', { method: 'POST', headers: intest, body: JSON.stringify(corpo) }, id, r.ms), tutto = '', ultimo = null;
    await leggiSSE(flusso, function (d) { var c = (JSON.parse(d).candidates || [])[0]; if (!c) return; ultimo = c; var t = testoGemini(c); if (t) { tutto += t; r.suTesto(t); } });
    if (!tutto) throw ErroreAI(nome(id) + ': risposta vuota.', 'rifiuto', id);
    return { testo: tutto, fonti: fontiGemini(ultimo), modello: mod };
  }
  function testoGemini(c) { return ((c && c.content && c.content.parts) || []).filter(function (p) { return !p.thought; }).map(function (p) { return p.text || ''; }).join(''); }
  function fontiGemini(c) { return ((c && c.groundingMetadata && c.groundingMetadata.groundingChunks) || []).map(function (g) { return g.web; }).filter(Boolean).map(function (w) { return { url: w.uri, titolo: w.title }; }).slice(0, 10); }

  async function openai(id, cfg, r) {
    var mod = modello(id, cfg), chiave = cfg.servizi[id].chiave;
    if (!mod) throw ErroreAI(nome(id) + ': indica il modello nei servizi AI.', 'modello', id);
    var corpo = { model: mod, messages: [{ role: 'system', content: r.schema ? r.sistema + '\n\n' + istruzioneSchema(r.schema) : r.sistema }].concat(r.messaggi), max_tokens: r.maxToken, temperature: 0.3 };
    if (r.schema) corpo.response_format = { type: 'json_object' };
    if (r.flusso) corpo.stream = true;
    var intest = { 'Content-Type': 'application/json' };
    if (chiave) intest.Authorization = 'Bearer ' + chiave;
    if (id === 'openrouter') { intest['HTTP-Referer'] = location.origin; intest['X-Title'] = 'Timone'; }
    var url = id === 'pollinations' ? base(id, cfg) : base(id, cfg) + '/chat/completions', risp;
    try { risp = await scarica(url, { method: 'POST', headers: intest, body: JSON.stringify(corpo) }, id, r.ms); }
    catch (e) { // alcuni modelli non hanno la modalità JSON
      if (e.codice !== 'richiesta' || !corpo.response_format) throw e;
      delete corpo.response_format; risp = await scarica(url, { method: 'POST', headers: intest, body: JSON.stringify(corpo) }, id, r.ms);
    }
    var testo = '';
    if (!r.flusso) { var j = await risp.json(), c = ((j.choices || [])[0] || {}).message || {}; testo = Array.isArray(c.content) ? c.content.map(function (t) { return t.text || ''; }).join('') : (c.content || ''); }
    else await leggiSSE(risp, function (d) { if (d === '[DONE]') return; var t = ((JSON.parse(d).choices || [])[0] || {}).delta; t = t && t.content; if (t) { testo += t; r.suTesto(t); } });
    if (!testo) throw ErroreAI(nome(id) + ': risposta vuota.', 'rifiuto', id);
    return { testo: testo, fonti: [], modello: mod };
  }

  // Claude: SDK ufficiale (vendor/anthropic-sdk.js) caricato solo se scelto
  var SDK = null, claude = null, chiaveClaude = null;
  async function anthropic(id, cfg, r) {
    var chiave = cfg.servizi[id].chiave, mod = modello(id, cfg);
    if (!SDK) SDK = (await import('./vendor/anthropic-sdk.js')).default;
    if (!claude || chiaveClaude !== chiave) { claude = new SDK({ apiKey: chiave, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 180000 }); chiaveClaude = chiave; }
    var sistema = r.sistema;
    // con la ricerca web lo schema va nelle istruzioni: le citazioni delle fonti non sono compatibili con l'uscita strutturata
    if (r.schema && r.web) sistema += '\n\n' + istruzioneSchema(r.schema);
    var p = { model: mod, max_tokens: r.flusso ? 32000 : 16000, system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }], output_config: { effort: r.web ? 'medium' : 'low' }, messages: r.messaggi };
    if (/^claude-(opus|sonnet)/.test(mod)) { p.betas = ['server-side-fallback-2026-07-01']; p.fallbacks = 'default'; }
    if (r.schema && !r.web) p.output_config.format = { type: 'json_schema', schema: r.schema };
    if (r.web) p.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }];
    try {
      var msg;
      if (r.flusso) { var s = claude.beta.messages.stream(p); s.on('text', function (t) { r.suTesto(t); }); msg = await s.finalMessage(); }
      else msg = await claude.beta.messages.create(p);
      if (msg.stop_reason === 'refusal') throw ErroreAI('Claude non ha elaborato questa richiesta.', 'rifiuto', id);
      var fonti = [], agg = function (u, t) { if (u && !fonti.some(function (f) { return f.url === u; })) fonti.push({ url: u, titolo: t }); };
      msg.content.forEach(function (b) {
        if (b.type === 'text' && b.citations) b.citations.forEach(function (ci) { agg(ci.url, ci.title); });
        if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach(function (x) { agg(x.url, x.title); });
      });
      return { testo: msg.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(''), fonti: fonti.slice(0, 10), modello: mod };
    } catch (e) {
      if (e.codice) throw e;
      if (e.status) throw erroreHttp(e.status, e.error, id);
      throw ErroreAI('Claude: ' + (e.message || e), 'rete', id);
    }
  }
  var ADATTATORI = { gemini: gemini, openai: openai, anthropic: anthropic };

  // ------------------------------------------------------------ esecuzione con servizi di riserva
  async function esegui(r) {
    var cfg = config(), lista = attivi(r.web, cfg), errori = [], iniziato = false;
    if (!disponibile()) throw ErroreAI('Configura almeno un servizio AI (ad esempio Google Gemini, gratuito) nella scheda Assistente AI → Servizi AI.', 'nessuno');
    if (!lista.length) throw ErroreAI('Questa funzione cerca sul web: attiva Google Gemini (gratuito) o Claude nei servizi AI.', 'nessuno');
    var suTesto = r.suTesto;
    r = Object.assign({ maxToken: 8000 }, r, { suTesto: function (t) { iniziato = true; if (suTesto) suTesto(t); } });
    for (var i = 0; i < lista.length; i++) {
      var id = lista[i];
      try {
        var x = await ADATTATORI[SERVIZI[id].tipo](id, cfg, r);
        if (r.schema) { try { x.json = adatta(r.schema, leggiJSON(x.testo)); } catch (e) { throw ErroreAI(nome(id) + ': risposta non in formato JSON.', 'formato', id); } }
        x.servizio = id; return x;
      } catch (e) {
        var err = e.codice ? e : ErroreAI(e.message || String(e), 'sconosciuto', id);
        errori.push(err);
        if (iniziato || RIPROVABILI.indexOf(err.codice) < 0) break; // testo già mostrato o errore non recuperabile
      }
    }
    var ultimo = errori[errori.length - 1];
    if (errori.length > 1) ultimo.message += ' (provati: ' + errori.map(function (x) { return nome(x.servizio); }).join(', ') + ')';
    throw ultimo;
  }

  var SISTEMA = 'Sei l\'assistente di "Timone", piattaforma di controllo di gestione e analisi aziendale per imprese italiane: esperto di bilancio (OIC, riclassificazioni), analisi per indici, controllo di gestione, finanza d\'impresa, agevolazioni e bandi pubblici.\n' +
    'Regole:\n- Rispondi sempre in italiano, in modo concreto e applicabile all\'azienda descritta nel contesto.\n' +
    '- Non inventare dati. Usa solo i numeri del contesto; se un dato manca dillo e indica dove trovarlo. Distingui FATTI (dati dell\'azienda), IPOTESI e CONSIGLI.\n' +
    '- I valori segnati come simulati sono di fantasia: ricordalo quando li usi.\n' +
    '- Per norme, scadenze e bandi indica sempre la fonte ufficiale e invita a verificarla; non garantire l\'ammissibilità.\n' +
    '- Le tue risposte sono un supporto alle decisioni e non sostituiscono il commercialista o il consulente del lavoro.';

  // domanda singola, con risposta in testo o JSON secondo lo schema
  function chiedi(o) { return esegui({ sistema: SISTEMA + (o.sistema ? '\n\n' + o.sistema : '') + (o.contesto ? '\n\nCONTESTO DELL\'AZIENDA\n' + o.contesto : ''), messaggi: [{ role: 'user', content: o.testo }], schema: o.schema, web: !!o.web, maxToken: o.maxToken || 8000 }); }
  // conversazione in streaming
  function chat(o) {
    var sistema = SISTEMA + '\nRispondi in testo semplice (elenchi con trattino e **grassetto** consentiti), senza tabelle. Separa "Fatti", "Ipotesi" e "Consigli" quando utile.' + (o.contesto ? '\n\nCONTESTO DELL\'AZIENDA\n' + o.contesto : '');
    var storia = o.storia.map(function (m) { return { role: m.role, content: m.content }; });
    while (storia.length && storia[0].role !== 'user') storia.shift(); // la conversazione deve iniziare dall'utente
    return esegui({ sistema: sistema, messaggi: storia, web: !!o.web, flusso: true, suTesto: o.suTesto, maxToken: 8000 });
  }
  // prova di collegamento di un singolo servizio (con la configurazione non ancora salvata)
  async function prova(id, grezza) {
    var cfg = config(grezza); cfg.servizi[id].attivo = true;
    var schema = { type: 'object', additionalProperties: false, required: ['ok', 'risposta'], properties: { ok: { type: 'boolean' }, risposta: { type: 'string' } } };
    var t0 = Date.now(), x = await ADATTATORI[SERVIZI[id].tipo](id, cfg, { sistema: 'Test di collegamento. Rispondi in modo brevissimo.', messaggi: [{ role: 'user', content: 'Rispondi con ok=true e, in risposta, che cosa significa la sigla EBITDA in tre parole.' }], schema: schema, maxToken: 300, ms: 30000, suTesto: function () {} });
    var j; try { j = adatta(schema, leggiJSON(x.testo)); } catch (e) { j = { ok: true, risposta: String(x.testo).slice(0, 60) }; }
    return { ok: j.ok, risposta: j.risposta, modello: x.modello, secondi: ((Date.now() - t0) / 1000).toFixed(1) };
  }
  // elenco dei modelli disponibili presso il servizio
  async function modelli(id, grezza) {
    var cfg = config(grezza), s = SERVIZI[id], chiave = cfg.servizi[id].chiave;
    if (s.chiave && !chiave) throw ErroreAI('Inserisci prima la chiave API.', 'chiave', id);
    if (s.tipo === 'anthropic' || id === 'pollinations') return s.modelli.slice();
    if (s.tipo === 'gemini') {
      var j = await (await scarica(base(id, cfg) + '/models?pageSize=200', { headers: { 'x-goog-api-key': chiave } }, id, 20000)).json();
      return (j.models || []).filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0; }).map(function (m) { return m.name.replace('models/', ''); })
        .filter(function (n) { return /^(gemini|gemma)/.test(n) && !/(embedding|tts|image|audio|live|robotics|computer-use|veo|imagen)/.test(n); });
    }
    var k = await (await scarica(base(id, cfg) + '/models', { headers: chiave ? { Authorization: 'Bearer ' + chiave } : {} }, id, 20000)).json();
    var ids = (k.data || k.models || []).map(function (m) { return m.id || m.name; }).filter(Boolean);
    return id === 'openrouter' ? ids.filter(function (x) { return /:free$/.test(x); }) : ids;
  }

  root.TimoneAI = { SERVIZI: SERVIZI, ORDINE: ORDINE, config: config, salvaConfig: salvaConfig, disponibile: disponibile, attivi: attivi, nome: nome,
    chiedi: chiedi, chat: chat, prova: prova, modelli: modelli, leggiJSON: leggiJSON, adatta: adatta };
})(typeof self !== 'undefined' ? self : this);
