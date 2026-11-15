/* Test del motore AI: passaggio automatico tra i servizi attivi.  Avvio:  node test-ai.js */
global.self = global;
global.localStorage = { d: {}, getItem(k) { return this.d[k] === undefined ? null : this.d[k]; }, setItem(k, v) { this.d[k] = String(v); } };
require('./ai.js');
const AI = global.TimoneAI;
let ok = 0, ko = 0;
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra === undefined ? '' : extra)); }
function errore(codice, servizio) { const e = new Error('finto ' + codice); e.codice = codice; e.servizio = servizio; return e; }

// tre servizi attivi: Gemini (principale), Groq, Mistral; i servizi sono simulati sostituendo gli adattatori
function configura(riserva) {
  localStorage.d = {};
  AI.salvaConfig({ principale: 'gemini', riserva: riserva !== false, servizi: { gemini: { attivo: true, chiave: 'g' }, groq: { attivo: true, chiave: 'q' }, mistral: { attivo: true, chiave: 'm' } } });
  AI.riattiva();
}
let chiamate = [], guasti = {};
const finto = async (id, cfg, r) => {
  chiamate.push(id);
  const g = guasti[id];
  if (g === 'a_meta') { r.suTesto('testo parziale'); throw errore('rete', id); }
  if (g) throw errore(g, id);
  if (r.suTesto && r.flusso) r.suTesto('ok da ' + id);
  return { testo: r.schema ? '{"risposta":"da ' + id + '"}' : 'risposta da ' + id, fonti: [], modello: 'm' };
};
AI.ADATTATORI.gemini = finto; AI.ADATTATORI.openai = finto;
const schema = { type: 'object', properties: { risposta: { type: 'string' } } };
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ko++; console.log('FALLITO', nome, e.message); } };

(async () => {
  // 1. tutto funziona: risponde il principale
  configura(); chiamate = []; guasti = {};
  let x = await AI.chiedi({ testo: 'ciao' });
  vero('risponde il principale', x.servizio === 'gemini' && chiamate.join() === 'gemini' && x.saltati.length === 0);

  // 2. principale con limite raggiunto: passa al successivo e lo mette in pausa
  chiamate = []; guasti = { gemini: 'quota' };
  const cambi = [];
  x = await AI.chiedi({ testo: 'ciao', suCambio: (da, a, motivo) => cambi.push(da + '>' + a + ':' + motivo) });
  vero('passa a Groq', x.servizio === 'groq' && chiamate.join() === 'gemini,groq', chiamate.join());
  vero('indica il servizio saltato e il motivo', x.saltati.length === 1 && x.saltati[0].servizio === 'gemini' && x.saltati[0].motivo === 'limite raggiunto');
  vero('avvisa del cambio', cambi.join() === 'gemini>groq:limite raggiunto', cambi.join());
  const p = AI.pausa('gemini');
  vero('Gemini in pausa per 15 minuti', p && p.codice === 'quota' && Math.abs(p.fino - Date.now() - 15 * 60000) < 5000);

  // 3. la richiesta successiva parte subito dal servizio funzionante
  chiamate = []; guasti = {};
  x = await AI.chiedi({ testo: 'ciao' });
  vero('il servizio in pausa passa in fondo', x.servizio === 'groq' && chiamate.join() === 'groq', chiamate.join());
  vero('ordine con pausa: Groq, Mistral, poi Gemini', AI.attivi().join() === 'groq,mistral,gemini', AI.attivi().join());
  vero('dopo la pausa torna il principale', AI.attivi(false, null, Date.now() + 16 * 60000).join() === 'gemini,groq,mistral');

  // 4. cambiando la chiave la pausa decade
  const c = JSON.parse(localStorage.d['timone.ai']); c.servizi.gemini.chiave = 'nuova-chiave'; AI.salvaConfig(c);
  vero('nuova chiave: pausa annullata', !AI.pausa('gemini') && AI.attivi()[0] === 'gemini');

  // 5. ogni tipo di guasto fa passare al successivo (anche richiesta rifiutata ed errori sconosciuti)
  for (const codice of ['chiave', 'modello', 'server', 'rete', 'richiesta', 'rifiuto', 'formato', 'sconosciuto']) {
    configura(); chiamate = []; guasti = { gemini: codice };
    x = await AI.chiedi({ testo: 'ciao' });
    vero('guasto «' + codice + '»: risponde Groq', x.servizio === 'groq' && AI.pausa('gemini') && AI.pausa('gemini').codice === codice);
  }

  // 6. risposta non in JSON: passa al successivo
  configura(); chiamate = []; guasti = {};
  const vecchio = AI.ADATTATORI.gemini;
  AI.ADATTATORI.gemini = async (id) => { chiamate.push(id); return { testo: 'non è JSON', fonti: [], modello: 'm' }; };
  x = await AI.chiedi({ testo: 'ciao', schema });
  vero('JSON non valido: risponde Groq con JSON', x.servizio === 'groq' && x.json.risposta === 'da groq' && AI.pausa('gemini').codice === 'formato');
  AI.ADATTATORI.gemini = vecchio;

  // 7. due servizi guasti: risponde il terzo
  configura(); chiamate = []; guasti = { gemini: 'quota', groq: 'server' };
  x = await AI.chiedi({ testo: 'ciao' });
  vero('risponde Mistral', x.servizio === 'mistral' && chiamate.join() === 'gemini,groq,mistral' && x.saltati.length === 2);

  // 8. tutti guasti: errore con l'elenco dei servizi provati
  configura(); chiamate = []; guasti = { gemini: 'quota', groq: 'server', mistral: 'chiave' };
  await prova('tutti guasti', async () => {
    try { await AI.chiedi({ testo: 'ciao' }); vero('tutti guasti: errore', false); }
    catch (e) { vero('tutti guasti: errore con i servizi provati', /provati: Google Gemini, Groq/.test(e.message) && /Mistral/.test(e.message), e.message); }
  });

  // 9. senza connessione non si prova altro
  configura(); chiamate = []; guasti = { gemini: 'offline' };
  try { await AI.chiedi({ testo: 'ciao' }); vero('offline: errore', false); }
  catch (e) { vero('offline: nessun altro servizio provato, nessuna pausa', chiamate.join() === 'gemini' && !AI.pausa('gemini')); }

  // 10. risposta in streaming interrotta a metà: ricomincia con il successivo
  configura(); chiamate = []; guasti = { gemini: 'a_meta' };
  let testo = '', ricominciato = 0;
  x = await AI.chat({ storia: [{ role: 'user', content: 'ciao' }], suTesto: t => { testo += t; }, suRicomincia: () => { ricominciato++; testo = ''; } });
  vero('streaming interrotto: ricomincia e risponde Groq', x.servizio === 'groq' && ricominciato === 1 && testo === 'ok da groq', testo);
  // senza suRicomincia il testo parziale resta e non si cambia servizio
  configura(); chiamate = []; guasti = { gemini: 'a_meta' };
  try { await AI.esegui({ sistema: '', messaggi: [{ role: 'user', content: 'x' }], flusso: true, suTesto: () => {} }); vero('senza ricomincia: errore', false); }
  catch (e) { vero('senza ricomincia: si ferma', chiamate.join() === 'gemini'); }

  // 11. passaggio automatico disattivato dall'utente: solo il principale
  configura(false); chiamate = []; guasti = { gemini: 'quota' };
  try { await AI.chiedi({ testo: 'ciao' }); vero('riserva disattivata: errore', false); }
  catch (e) { vero('riserva disattivata: provato solo il principale', chiamate.join() === 'gemini'); }

  // 12. ricerca web: si passa solo tra servizi con ricerca web
  configura(); chiamate = []; guasti = {};
  vero('ricerca web: solo Gemini tra quelli attivi', AI.attivi(true).join() === 'gemini');

  // 13. un servizio tornato utilizzabile esce dalla pausa
  configura(); AI.sospendi('gemini', { codice: 'server' }, AI.config());
  vero('in pausa dopo un errore', !!AI.pausa('gemini'));
  AI.riattiva('gemini');
  vero('«Riprova ora» lo rimette in testa', !AI.pausa('gemini') && AI.attivi()[0] === 'gemini');

  console.log('\nTest motore AI superati: ' + ok + '  ·  falliti: ' + ko);
  process.exit(ko ? 1 : 0);
})();
