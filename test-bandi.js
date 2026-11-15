/* Test del modulo Ricerca bandi.  Avvio:  node test-bandi.js */
const S = require('./simulatore.js'), B = require('./bandi.js'), AI = (() => { global.self = global; require('./ai.js'); return global.TimoneAI; })();
let ok = 0, ko = 0;
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra === undefined ? '' : extra)); }
const OGGI = '2026-11-15';

// --- 1. normalizzazione: scarta i bandi senza fonte, non inventa date né importi -------------------------------
const grezzi = [
  { titolo: 'Voucher digitali', ente: 'Camera di commercio', livello: 'regionale', tipo: 'voucher', settori: ['digitale', 'boh', 'digitale'], scadenza: '2026-12-01', apertura: '', importo_max: 5000, percentuale: 50, requisiti: ['PMI', ''], url: 'https://www.esempio.it/voucher' },
  { titolo: 'Senza link', ente: 'X', livello: 'nazionale', tipo: 'fondo_perduto', url: '' },
  { titolo: 'Link non valido', url: 'www.esempio.it' },
  { titolo: 'Voucher digitali', url: 'https://esempio.it/voucher/' },           // doppione (stesso link e titolo)
  { titolo: 'Data impossibile', livello: 'marziano', tipo: 'boh', scadenza: '2026-02-30', importo_max: 0, percentuale: 140, url: 'http://ente.gov.it/bando' }
];
let r = B.risultati(grezzi);
vero('restano 2 bandi, 2 scartati senza fonte', r.bandi.length === 2 && r.scartati === 2, r.bandi.length + '/' + r.scartati);
let v = r.bandi[0], w = r.bandi[1];
vero('settori ripuliti e senza doppioni', v.settori.length === 1 && v.settori[0] === 'digitale');
vero('requisiti vuoti tolti', v.requisiti.length === 1);
vero('date valide conservate, vuote restano vuote', v.scadenza === '2026-12-01' && v.apertura === null);
vero('data impossibile → vuota', w.scadenza === null);
vero('livello e tipo sconosciuti → vuoto e "altro"', w.livello === '' && w.tipo === 'altro');
vero('importo 0 e percentuale oltre 100 → non indicati', w.importo === null && w.percentuale === null);

// --- 2. stato rispetto a oggi ----------------------------------------------------------------------------------
vero('stato aperto', B.statoDi({ scadenza: '2026-12-01' }, OGGI) === 'aperto');
vero('stato scaduto', B.statoDi({ scadenza: '2026-11-14' }, OGGI) === 'scaduto');
vero('scade oggi: ancora aperto', B.statoDi({ scadenza: OGGI }, OGGI) === 'aperto');
vero('stato in arrivo', B.statoDi({ apertura: '2027-01-10', scadenza: '2027-03-01' }, OGGI) === 'in_arrivo');
vero('senza date: da verificare', B.statoDi({}, OGGI) === 'sconosciuto');

// --- 3. filtri e ordinamento -----------------------------------------------------------------------------------
const L = B.risultati([
  { titolo: 'A europeo energia', livello: 'europeo', tipo: 'fondo_perduto', settori: ['energia'], scadenza: '2027-02-01', url: 'https://ue.eu/a' },
  { titolo: 'B nazionale tutti i settori', livello: 'nazionale', tipo: 'credito_imposta', settori: [], url: 'https://gov.it/b' },
  { titolo: 'C regionale scaduto', livello: 'regionale', tipo: 'fondo_perduto', settori: ['energia'], scadenza: '2026-10-01', url: 'https://regione.it/c' },
  { titolo: 'D comunale commercio', livello: 'comunale', tipo: 'voucher', settori: ['commercio'], scadenza: '2026-11-30', url: 'https://comune.it/d', descrizione: 'vetrine e insegne' }
]).bandi;
const nomi = (x) => x.map(b => b.titolo[0]).join('');
vero('nessun filtro: esclusi gli scaduti', nomi(B.filtra(L, {}, OGGI)) === 'ABD', nomi(B.filtra(L, {}, OGGI)));
vero('anche gli scaduti', nomi(B.filtra(L, { soloAperti: false }, OGGI)) === 'ABCD');
vero('solo europeo e nazionale', nomi(B.filtra(L, { livelli: ['europeo', 'nazionale'] }, OGGI)) === 'AB');
vero('tipo fondo perduto', nomi(B.filtra(L, { tipo: 'fondo_perduto', soloAperti: false }, OGGI)) === 'AC');
vero('settore energia: compresi i bandi aperti a tutti', nomi(B.filtra(L, { settore: 'energia' }, OGGI)) === 'AB');
vero('parole chiave in descrizione', nomi(B.filtra(L, { testo: 'Vetrine insegne' }, OGGI)) === 'D');
vero('filtri non validi ignorati', nomi(B.filtra(L, { livelli: ['lunare'], tipo: 'x', settore: 'y' }, OGGI)) === 'ABD');
vero('ordine: scadenze vicine, senza scadenza, scaduti', nomi(B.ordina(L, OGGI)) === 'DABC', nomi(B.ordina(L, OGGI)));

// --- 4. profilo, avvisi, richiesta e portali ---------------------------------------------------------------------
const az = { nome: 'Prova', settore: 'commerciale', ateco: '47.11', forma: 'S.r.l.', esercizi: {} };
let p = B.profilo(az);
vero('settore proposto dal tipo di attività', p.settore === 'commercio' && p.ateco === '47.11');
vero('avvisi: mancano comune e regione', B.avvisiRicerca({ livelli: ['comunale'] }, p).length === 2);
az.bandi = { profilo: { regione: 'Toscana', comune: 'Prato', dimensione: 'piccola' } }; p = B.profilo(az);
vero('nessun avviso con profilo completo', B.avvisiRicerca({}, p).length === 0);
const q = B.richiesta({ livelli: ['comunale', 'europeo'], tipo: 'voucher', settore: 'commercio', testo: 'vetrine' }, p, OGGI);
vero('la richiesta contiene comune, tipo, settore, data e regola sulle fonti', /Comune di Prato/.test(q) && /Voucher/.test(q) && /Commercio/.test(q) && q.indexOf(OGGI) >= 0 && /link alla pagina ufficiale/.test(q) && !/Regione Toscana/.test(q));
const po = B.portali({ livelli: ['comunale', 'regionale'] }, p);
vero('portali: ricerca guidata per comune e regione', po.length === 2 && /Prato/.test(decodeURIComponent(po[0].url)) && /Toscana/.test(decodeURIComponent(po[1].url)));
vero('portali nazionali ed europei', B.portali({ livelli: ['nazionale', 'europeo'] }, p).every(x => /^https:\/\//.test(x.url) && /nazionale|europeo/.test(x.livello)));
vero('lo schema accetta solo livelli, tipi e settori noti', B.SCHEMA.properties.bandi.items.properties.livello.enum.length === 4 && B.SCHEMA.properties.bandi.items.properties.tipo.enum.indexOf('gara') >= 0);

// --- 5. archivio, scadenze e registro agevolazioni ----------------------------------------------------------------
const az2 = { esercizi: {} };
const s1 = B.salva(az2, L[3], OGGI), s2 = B.salva(az2, L[3], OGGI);
vero('salvare due volte lo stesso bando non lo duplica', s1 === s2 && az2.bandi.salvati.length === 1);
B.salva(az2, L[0], OGGI); B.salva(az2, L[2], OGGI);
let a = B.analizza(az2, OGGI);
vero('in scadenza entro 30 giorni: solo D (15 giorni)', a.urgenti.length === 1 && a.urgenti[0].giorni === 15, a.urgenti.map(x => x.giorni));
vero('aperti: A e D (C scaduto)', a.aperti === 2);
s1.valutazione = 'non_adatto'; a = B.analizza(az2, OGGI);
vero('bando non adatto: niente criticità', a.urgenti.length === 0 && a.aperti === 1);
s1.valutazione = 'valutare'; a = B.analizza(az2, OGGI);
const cr = B.criticita(a, x => '€ ' + x);
vero('criticità del bando in scadenza', cr.length === 1 && /Bando in scadenza/.test(cr[0].titolo) && /15 giorni/.test(cr[0].dati));
const ag = B.agevolazione(Object.assign({}, L[0], { importo: 20000, requisiti: ['PMI'] }), OGGI);
vero('scheda per il registro agevolazioni con fonte e requisiti', ag.fonte === 'https://ue.eu/a' && ag.tipo === 'fondo_perduto' && ag.stato === 'valutare' && ag.verificata === OGGI && ag.requisiti[0].t === 'PMI' && ag.importo === 20000);
vero('voucher → contributo, credito d\'imposta resta tale', B.agevolazione(L[3], OGGI).tipo === 'fondo_perduto' && B.agevolazione(L[1], OGGI).tipo === 'credito_imposta' && B.agevolazione(L[1], OGGI).importo === undefined);

// --- 6. motore AI: lettura robusta delle risposte -------------------------------------------------------------------
vero('JSON dentro un blocco di codice', AI.leggiJSON('```json\n{"a":1}\n```').a === 1);
vero('JSON con testo intorno', AI.leggiJSON('Ecco: {"a":2} fine').a === 2);
const ad = AI.adatta(B.SCHEMA, { bandi: [{ titolo: 'X', importo_max: 'n.d.', livello: 'boh' }] });
vero('campi mancanti completati, numeri non validi restano vuoti', ad.nota === '' && ad.bandi[0].importo_max === null && ad.bandi[0].livello === 'comunale' && Array.isArray(ad.bandi[0].requisiti));
vero('servizi gratuiti prima di quelli a pagamento', AI.ORDINE[0] === 'gemini' && AI.ORDINE.indexOf('anthropic') > AI.ORDINE.indexOf('groq') && AI.ORDINE[AI.ORDINE.length - 1] === 'custom');
vero('ricerca web solo con Gemini e Claude', AI.ORDINE.filter(id => AI.SERVIZI[id].web).join() === 'gemini,anthropic');

// --- 7. aziende simulate --------------------------------------------------------------------------------------------
let tot = 0, superati = 0, n = 0;
['manifatturiera', 'commerciale', 'servizi', 'artigiana', 'professionista'].forEach(settore => {
  for (let seme = 1; seme <= 18; seme++) {
    const z = S.genera({ settore, profilo: 'sana', ricavi: 1500000, anni: 3, seme: 'b' + seme });
    z.bandi = B.simula(z, OGGI); n++;
    B.collaudo(z).forEach(e => { tot++; if (e.ok) superati++; else console.log('FALLITO collaudo', settore, seme, e.nome, e.dettaglio); });
  }
});
vero('collaudo aziende simulate', superati === tot && tot > 0);

console.log('\nTest bandi superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con bandi simulati: ' + n + ' (' + superati + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
