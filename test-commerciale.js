/* Test del modulo Sviluppo commerciale e clienti.  Avvio:  node test-commerciale.js */
const M = require('./motore.js'), S = require('./simulatore.js'), I = require('./importa.js'), C = require('./commerciale.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 0.01)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }
const eur = x => '€ ' + Math.round(x), pct = x => (x * 100).toFixed(1) + '%';

// --- 1. caso calcolato a mano ------------------------------------------------------------------
// 2025: A 600 + 400 (costi 300 + 200), B 300 (costo 330), C 100 (costo non indicato) → totale 1.400
// 2024: A 800, B 500, D 200 → totale 1.500
const az = { commerciale: { vendite: [
  { cliente: 'A', periodo: '2025-01', ricavi: 600, costo: 300, ordini: 2, famiglia: 'X' }, { cliente: 'a ', periodo: '2025-02', ricavi: 400, costo: 200, ordini: 2, famiglia: 'Y' }, { cliente: 'B', periodo: '2025-03', ricavi: 300, costo: 330, ordini: 1, famiglia: 'X' }, { cliente: 'C', periodo: '2025-01', ricavi: 100 },
  { cliente: 'A', periodo: '2024-01', ricavi: 800 }, { cliente: 'B', periodo: '2024-03', ricavi: 500 }, { cliente: 'D', periodo: '2024-06', ricavi: 200 }, { cliente: '', periodo: '2025-01', ricavi: 50 }, { cliente: 'E', periodo: 'boh', ricavi: 50 }],
  clienti: [{ nome: 'A', settore: 'Meccanica', zona: 'Nord', ggConcordati: 30, ggEffettivi: 60 }, { nome: 'B', settore: 'Meccanica', zona: 'Sud', ggConcordati: 60, ggEffettivi: 50 }, { nome: 'C', settore: 'Edilizia' }], trattative: [] } };
let a = C.analizza(az, 2025), cl = k => a.clienti.filter(c => c.nome.trim().toUpperCase() === k)[0];
vicino('ricavi 2025', a.ricavi, 1400); vicino('ricavi 2024', a.ricaviPrec, 1500); vero('tre clienti, nomi unificati senza badare a maiuscole e spazi', a.clienti.length === 3 && a.clienti[0].ricavi === 1000); vero('righe incomplete scartate e segnalate', a.scartate === 2 && a.avvisi.some(x => /2 righe/.test(x)));
vicino('quota del primo cliente', a.top1, 1000 / 1400, 1e-9); vicino('quota dei primi tre', a.top3, 1, 1e-9); vicino('indice di concentrazione', a.hhi, (1000 * 1000 + 300 * 300 + 100 * 100) / (1400 * 1400), 1e-9);
vero('classi ABC: A, A, B', a.clienti.map(c => c.abc).join('') === 'AAB');
vicino('margine di A', cl('A').margine, 500); vicino('margine di B (sotto costo)', cl('B').margine, -30); vero('C senza costo: margine non calcolato', cl('C').margine === null && cl('C').marginePct === null);
vicino('margine totale sui ricavi con costo', a.margine, 470); vicino('margine %', a.marginePct, 470 / 1300, 1e-9); vicino('quota di ricavi con costo noto', a.coperturaCosti, 1300 / 1400, 1e-9); vero('avviso sui costi parziali', a.avvisi.some(x => /93%/.test(x)));
vero('A in crescita (+25%), B in calo (−40%), C nuovo', cl('A').stato === 'in crescita' && cl('B').stato === 'in calo' && cl('C').stato === 'nuovo'); vicino('variazione di B', cl('B').variazione, -0.4, 1e-9);
vero('D perso', a.persi.length === 1 && a.persi[0].nome === 'D'); vero('movimenti: 2 mantenuti, 1 nuovo, 1 perso', a.mov.mantenuti === 2 && a.mov.nuovi === 1 && a.mov.persi === 1);
vicino('mantenimento dei clienti 2 su 3', a.mov.mantenimentoClienti, 2 / 3, 1e-9); vicino('mantenimento dei ricavi 1.300 ÷ 1.500', a.mov.mantenimentoRicavi, 1300 / 1500, 1e-9); vicino('ricavi persi', a.mov.ricaviPersi, 200); vicino('ricavi dai nuovi', a.mov.ricaviNuovi, 100);
vero('B a rischio per il calo', a.aRischio.length === 1 && /40%/.test(a.aRischio[0].rischio)); vero('dati non mensili: nessun cliente «fermo» e avviso', !a.mensile && a.clienti.every(c => !c.fermo) && a.avvisi.some(x => /mensili/.test(x)));
vicino('ordine medio di A', cl('A').ordineMedio, 250); vero('mesi: gennaio 700, febbraio 400, marzo 300', a.mesi[0] === 700 && a.mesi[1] === 400 && a.mesi[2] === 300 && a.mesiPrec[5] === 200);
let me = a.settori.filter(s => s.nome === 'Meccanica')[0]; vicino('settore Meccanica: ricavi', me.ricavi, 1300); vicino('settore Meccanica: margine', me.margine, 470); vero('settore senza costi: margine non calcolato', a.settori.filter(s => s.nome === 'Edilizia')[0].margine === null);
vero('zona non indicata raccolta a parte', a.zone.some(s => s.nome === 'Non indicato' && s.ricavi === 100)); let fx = a.famiglie.filter(f => f.nome === 'X')[0]; vicino('famiglia X: ricavi', fx.ricavi, 900); vicino('famiglia X: margine', fx.margine, 270); vero('famiglia non indicata', a.famiglie.some(f => f.nome === 'Non indicata' && f.margine === null));
// pagamenti: A 30 → 60 giorni (ritardo 30), B 60 → 50 (in anticipo)
vicino('giorni medi di incasso', a.pagamenti.giorniMedi, (1000 * 60 + 300 * 50) / 1300, 1e-9); vicino('ritardo medio pesato', a.pagamenti.ritardoMedio, (30 * 1000 - 10 * 300) / 1300, 1e-9); vicino('costo del ritardo: 1.000 × 30 ÷ 365 × 6%', a.pagamenti.costoRitardo, 1000 * 30 / 365 * 0.06, 1e-9); vicino('credito stimato', a.pagamenti.creditoStimato, 1000 * 60 / 365 + 300 * 50 / 365, 1e-9);
vero('senza anno precedente nessun confronto inventato', C.analizza(az, 2024).mov === undefined && C.analizza(az, 2024).clienti.every(c => c.stato === 'attivo'));
vero('anni presenti', C.anniDi(az).join() === '2024,2025');
// cliente fermo: comprava ogni mese e ha smesso a giugno
const azF = { commerciale: { vendite: [], clienti: [], trattative: [] } }; for (let m = 1; m <= 12; m++) { azF.commerciale.vendite.push({ cliente: 'Sempre', periodo: '2025-' + ('0' + m).slice(-2), ricavi: 100 }); if (m <= 6) azF.commerciale.vendite.push({ cliente: 'Fermo', periodo: '2025-' + ('0' + m).slice(-2), ricavi: 100 }); if (m === 2) azF.commerciale.vendite.push({ cliente: 'Occasionale', periodo: '2025-02', ricavi: 100 }); }
a = C.analizza(azF, 2025); vero('cliente fermo da 6 mesi riconosciuto; l\'occasionale no', a.mensile && a.clienti.filter(c => c.fermo).length === 1 && a.clienti.filter(c => c.fermo)[0].nome === 'Fermo' && a.clienti.filter(c => c.fermo)[0].mesiFermo === 6);

// --- 2. simulazioni ----------------------------------------------------------------------------
a = C.analizza(az, 2025); let p = C.perdita(a, 'a');
vicino('perdita di A: ricavi', p.ricavi, 1000); vicino('perdita di A: margine', p.margine, 500); vero('perdita di A: non stimata', !p.stimato && p.ebitdaDopo === undefined); vicino('dopo la perdita il primo cliente pesa 300 ÷ 400', p.top1Dopo, 0.75, 1e-9);
vero('perdita di C senza costo e senza bilancio: margine non stimato', C.perdita(a, 'c').margine === null); vero('cliente inesistente', C.perdita(a, 'zzz') === null);
const azS = S.genera({ settore: 'commerciale', profilo: 'sana', seme: 8, anni: 3 }), YS = Math.max(...Object.keys(azS.esercizi).map(Number)), nS = M.numeri(azS.esercizi[YS]), rS = M.riclassifica(nS, azS.classificazione);
a = C.analizza(az, 2025, { n: nS, classificazione: azS.classificazione, ceOk: true }); p = C.perdita(a, 'c');
vicino('perdita di C: margine stimato con il margine medio di bilancio', p.margine, 100 * rS.mc_pct, 1e-6); vero('…ed è segnalato come stima', p.stimato && Math.abs(p.ebitdaDopo - (rS.ebitda - p.margine)) < 1e-6); vicino('differenza con il bilancio', a.bilancio.differenza, nS.ricavi - 1400, 1e-6);
let s = C.sconto(0.3, 0.1); vicino('sconto del 10% con margine 30%: +50% di volume', s.volume, 0.5, 1e-9); vero('sconto pari al margine: impossibile recuperare', C.sconto(0.3, 0.3).possibile === false && C.sconto(0.3, 0.4).possibile === false); vero('sconto senza margine noto', C.sconto(null, 0.1) === null);

// --- 3. trattative -----------------------------------------------------------------------------
az.commerciale.trattative = [{ id: '1', nome: 'T1', valore: 1000, fase: 'offerta', chiusura: '2026-03', fonte: 'fiera', settore: 'Meccanica' }, { id: '2', nome: 'T2', valore: 2000, fase: 'negoziazione', probabilita: 0.9, chiusura: '2026-03', fonte: 'passaparola' },
  { id: '3', nome: 'T3', valore: 500, fase: 'contatto', chiusura: '2025-11' }, { id: '4', nome: 'T4', fase: 'qualificata', fonte: 'sito' }, { id: '5', nome: 'T5', valore: 300, fase: 'vinta' }, { id: '6', nome: 'T6', valore: 700, fase: 'persa' }];
let tr = C.analizzaTrattative(az, '2026-01', ['Meccanica']);
vicino('valore delle trattative aperte', tr.valore, 3500); vicino('valore ponderato: 500 + 1.800 + 50 + 0', tr.ponderato, 2350); vero('quattro aperte', tr.aperte === 4 && tr.fasi.offerta.n === 1 && tr.fasi.vinta.valore === 300);
vero('probabilità predefinita della fase dichiarata', tr.righe[0].probPredefinita && tr.righe[0].prob === 0.5 && !tr.righe[1].probPredefinita); vero('scaduta e senza fonte segnalate', tr.scadute === 1 && tr.senzaFonte === 1 && tr.righe[2].avvisi.length === 2);
vero('senza valore e senza data segnalate', tr.righe[3].avvisi.length === 2); vero('trattativa in un segmento forte', tr.righe[0].segmentoForte && !tr.righe[1].segmentoForte); vicino('previsione di marzo', tr.perMese.filter(x => x.mese === '2026-03')[0].ponderato, 2300);
vero('poche trattative chiuse: tasso di successo non calcolato', tr.successo === null && tr.chiuse === 2);

// --- 4. criticità ------------------------------------------------------------------------------
let cr = C.criticita(C.analizza(az, 2025), tr, eur, pct);
vero('criticità: dipendenza grave dal primo cliente (71%)', cr.some(x => /primo cliente/.test(x.titolo) && x.gravita === 'rosso' && /500/.test(x.effetto))); vero('criticità: cliente a rischio', cr.some(x => /rischio di perdita/.test(x.titolo))); vero('criticità: clienti persi', cr.some(x => /persi/.test(x.titolo)));
vero('criticità: cliente sotto costo', cr.some(x => /sotto costo/.test(x.titolo))); vero('nessuna vendita: nessuna criticità', C.criticita(C.analizza({ commerciale: { vendite: [] } }, 2025), null, eur, pct).length === 0);
az.commerciale.clienti[0].ggEffettivi = 90; vero('criticità: pagamenti in ritardo', C.criticita(C.analizza(az, 2025), tr, eur, pct).some(x => /ritardo/.test(x.titolo)));
vero('criticità: vendite diverse dal bilancio', C.criticita(a, tr, eur, pct).some(x => /non coincidono/.test(x.titolo)));

// --- 5. importazione ---------------------------------------------------------------------------
vero('periodi riconosciuti', C.periodo('2025-03') === '2025-03' && C.periodo('03/2025') === '2025-03' && C.periodo('15/03/2025') === '2025-03' && C.periodo('marzo 2025') === '2025-03' && C.periodo('mar', 2025) === '2025-03' && C.periodo(3, 2025) === '2025-03' && C.periodo('', 2025) === '2025-12' && C.periodo('2025') === '2025-12' && C.periodo(45731) === '2025-03');
vero('periodi non validi', C.periodo('13/2025') === null && C.periodo('boh') === null && C.periodo('') === null);
let im = C.daTabella(I.csv('Elenco vendite;;;\r\nRagione sociale;Mese;Fatturato;Costo diretto;N. ordini;Prodotto;Settore;Provincia\r\nRossi Srl;01/2025;1.234,50;800,00;3;Ricambi;Meccanica;Varese\r\nRossi Srl;02/2025;1.000;600;1;Ricambi;Meccanica;Varese\r\nBianchi Spa;15/01/2025;500;;;;Edilizia;Como\r\nVerdi;01/2025;;;;;;\r\n;01/2025;10;;;;;\r\nNeri;trimestre;10;;;;;\r\n'), I.numero);
vero('importazione: 3 righe, 2 scartate', im.vendite.length === 3 && im.avvisi.some(x => /2 righe scartate/.test(x)), JSON.stringify(im.avvisi)); vicino('numeri italiani', im.vendite[0].ricavi, 1234.5); vero('costo vuoto resta mancante, non zero', im.vendite[2].costo === undefined && im.vendite[0].costo === 800);
vero('anagrafica dei clienti dal file', im.clienti.length === 2 && im.clienti[0].settore === 'Meccanica' && im.clienti[1].zona === 'Como' && im.anni.join() === '2025');
vero('intestazione mancante: errore chiaro', C.daTabella(I.csv('a;b\r\n1;2\r\n'), I.numero).avvisi.length === 1); vero('solo anno: avviso dati annuali', C.daTabella(I.csv('Cliente;Anno;Ricavi\r\nX;2025;100\r\n'), I.numero).avvisi.some(x => /solo l.anno/.test(x)));
const azI = { commerciale: { vendite: [{ cliente: 'Vecchio', periodo: '2025-05', ricavi: 9 }, { cliente: 'Storico', periodo: '2024-05', ricavi: 7 }], clienti: [{ nome: 'ROSSI SRL', ggConcordati: 30 }], trattative: [] } };
vero('applica: sostituisce l\'anno importato, conserva gli altri e i dati di pagamento', C.applica(azI, im) === 3 && azI.commerciale.vendite.length === 4 && !azI.commerciale.vendite.some(v => v.cliente === 'Vecchio') && azI.commerciale.clienti.length === 2 && azI.commerciale.clienti[0].ggConcordati === 30 && azI.commerciale.clienti[0].settore === 'Meccanica');
im = C.daTabella(I.csv(C.modelloCsv()), I.numero); vero('il modello si reimporta', im.vendite.length === 2 && im.avvisi.length === 0);

// --- 6. dati simulati --------------------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [2, 53, 707]) {
  const zz = S.genera({ settore, profilo, seme, anni: 3 }); zz.commerciale = C.simula(zz, seme); aziende++;
  const es = C.collaudo(zz); tot += es.length; sup += es.filter(x => x.ok).length;
  es.filter(x => !x.ok).forEach(x => { (falliti[x.nome] = falliti[x.nome] || []).push(settore + '/' + profilo + '/' + seme + ' ' + x.dettaglio); });
}
vero('collaudo dati commerciali simulati ' + sup + '/' + tot, Object.keys(falliti).length === 0);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest commerciale superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con vendite simulate: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
