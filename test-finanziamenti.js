/* Test del modulo Finanziamenti, mutui e agevolazioni.  Avvio:  node test-finanziamenti.js */
const M = require('./motore.js'), S = require('./simulatore.js'), F = require('./finanziamenti.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 0.01)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }
const eur = x => '€ ' + Math.round(x), pct = x => (x * 100).toFixed(1) + '%';

// --- 1. piani calcolati a mano -----------------------------------------------------------------
// rata costante: 12.000 € in 12 mesi al 6% → 0,5% al mese → rata 12.000 × 0,005 ÷ (1 − 1,005^−12) = 1.032,80; interessi 393,57
let pl = F.piano({ tipo: 'mutuo', importo: 12000, inizio: '2024-01', durataMesi: 12, tasso: 0.06 });
vicino('francese: rata', pl.rataTipo, 1032.80); vicino('francese: interessi totali', pl.interessi, 393.57); vicino('francese: prima quota interessi', pl.righe[0].interessi, 60); vicino('francese: capitale rimborsato', pl.rimborsato, 12000, 1e-6);
vero('francese: 12 rate, ultima a gennaio 2025', pl.righe.length === 12 && pl.righe[0].data === '2024-02' && pl.fine === '2025-01'); vicino('francese senza spese: tasso effettivo = 1,005^12 − 1', pl.tassoEffettivo, Math.pow(1.005, 12) - 1, 1e-7);
// quota capitale costante: 12.000 € in 12 mesi al 12% → 1.000 di capitale; interessi 1% × (12.000 + 11.000 + … + 1.000) = 780
pl = F.piano({ tipo: 'mutuo', importo: 12000, inizio: '2024-01', durataMesi: 12, tasso: 0.12, metodo: 'italiano' });
vicino('italiano: interessi totali', pl.interessi, 780); vicino('italiano: prima rata', pl.righe[0].rata, 1120); vicino('italiano: ultima rata', pl.righe[11].rata, 1010);
// capitale alla scadenza: 10.000 € in 24 mesi, rate trimestrali all'8% → 2% a trimestre: 8 rate, 200 di interessi ciascuna
pl = F.piano({ tipo: 'mutuo', importo: 10000, inizio: '2024-03', durataMesi: 24, tasso: 0.08, periodicitaMesi: 3, metodo: 'bullet' });
vero('bullet trimestrale: 8 rate, date ogni tre mesi', pl.righe.length === 8 && pl.righe[0].data === '2024-06' && pl.fine === '2026-03'); vicino('bullet: interessi', pl.interessi, 1600); vicino('bullet: ultima rata', pl.righe[7].rata, 10200); vicino('bullet: tasso effettivo 1,02^4 − 1', pl.tassoEffettivo, 0.08243216, 1e-7);
// preammortamento: 6 mesi di soli interessi (60), poi 12 rate da 1.032,80
pl = F.piano({ tipo: 'mutuo', importo: 12000, inizio: '2024-01', durataMesi: 18, preammortamentoMesi: 6, tasso: 0.06 });
vero('preammortamento: 6 rate di soli interessi', pl.righe.slice(0, 6).every(r => r.pre && Math.abs(r.rata - 60) < 1e-9 && r.capitale === 0)); vicino('preammortamento: poi rata piena', pl.righe[6].rata, 1032.80); vicino('preammortamento: interessi', pl.interessi, 360 + 393.57);
// tasso zero e spese: 10.000 € rimborsati in un'unica rata annuale al 5% con 100 € di istruttoria → incasso 9.900, rimborso 10.500 → 6,06%
pl = F.piano({ tipo: 'mutuo', importo: 1200, inizio: '2024-01', durataMesi: 12, tasso: 0 }); vicino('tasso zero: rata', pl.rataTipo, 100); vicino('tasso zero: effettivo', pl.tassoEffettivo, 0, 1e-7);
pl = F.piano({ tipo: 'mutuo', importo: 10000, inizio: '2024-01', durataMesi: 12, tasso: 0.05, periodicitaMesi: 12, speseIniziali: 100 });
vicino('spese iniziali: tasso effettivo 10.500 ÷ 9.900 − 1', pl.tassoEffettivo, 10500 / 9900 - 1, 1e-7); vicino('costo totale = interessi + spese', pl.costoTotale, 600);
pl = F.piano({ tipo: 'mutuo', importo: 1200, inizio: '2024-01', durataMesi: 12, tasso: 0, spesePerRata: 2 }); vicino('spese per rata', pl.spese, 24); vero('con spese il tasso effettivo supera il nominale', pl.tassoEffettivo > 0.03);
// leasing: bene 10.000, anticipo 1.000, riscatto 900, tasso zero, 9 mesi → canone (9.000 − 900) ÷ 9 = 900, poi riscatto 900
pl = F.piano({ tipo: 'leasing', importo: 10000, anticipo: 1000, valoreResiduo: 900, inizio: '2024-01', durataMesi: 9, tasso: 0 });
vicino('leasing: capitale finanziato', pl.capitale, 9000); vicino('leasing: canone', pl.rataTipo, 900); vero('leasing: riscatto finale', pl.righe.length === 10 && pl.righe[9].riscatto && pl.righe[9].rata === 900 && pl.righe[9].data === '2024-10'); vicino('leasing: rimborsato', pl.rimborsato, 9000, 1e-6);
pl = F.piano({ tipo: 'leasing', importo: 10000, anticipo: 1000, valoreResiduo: 900, inizio: '2024-01', durataMesi: 36, tasso: 0.06 });
vicino('leasing con interessi: residuo prima del riscatto = riscatto', pl.righe[35].residuo, 900, 1e-6);

// --- 2. situazione a una data ------------------------------------------------------------------
// 24.000 € in 24 mesi, quota capitale 1.000, 1% al mese, erogato a giugno 2024. Al 31/12/2024: pagate 6 rate
const p8 = { tipo: 'mutuo', importo: 24000, inizio: '2024-06', durataMesi: 24, tasso: 0.12, metodo: 'italiano', variabile: true };
let s = F.situazione(p8, F.piano(p8), '2024-12');
vicino('residuo a fine 2024', s.residuo, 18000); vicino('entro 12 mesi', s.entro12, 12000); vicino('oltre 12 mesi', s.oltre12, 6000); vicino('interessi dei 12 mesi successivi: 1% × 150.000', s.interessi12, 1500); vicino('rate dei 12 mesi successivi', s.rate12, 13500);
vicino('interessi pagati nel 2024: 1% × 129.000', s.interessiAnno, 1290); vicino('un punto di tasso in più: 150.000 × 1% ÷ 12', s.stress1, 125); vero('prossima rata gennaio 2025', s.prossima.data === '2025-01' && Math.abs(s.prossima.rata - 1180) < 1e-9);
vero('prima dell\'erogazione: non ancora erogato', F.situazione(p8, F.piano(p8), '2024-05').stato === 'non ancora erogato'); s = F.situazione(p8, F.piano(p8), '2026-06'); vero('dopo l\'ultima rata: estinto', s.stato === 'estinto' && s.residuo === 0 && s.rate12 === 0);
vicino('tasso fisso: nessun effetto dei tassi', F.situazione(Object.assign({}, p8, { variabile: false }), F.piano(p8), '2024-12').stress1, 0);
// fido: 100.000 accordati, 60.000 usati in media, 7% + 1% di commissione sull'accordato → 4.200 + 1.000
let f = F.fido({ tipo: 'fido', accordato: 100000, utilizzoMedio: 60000, tasso: 0.07, commissione: 0.01 });
vicino('fido: costo annuo', f.costoAnno, 5200); vicino('fido: costo effettivo sull\'utilizzato', f.costoEffettivo, 5200 / 60000, 1e-9); vicino('fido: quota utilizzata', f.quota, 0.6); vicino('fido: un punto di tasso', f.stress1, 600);

// --- 3. estinzione e rinegoziazione ------------------------------------------------------------
let e = F.estinzione(p8, '2024-12', 0.01);   // interessi futuri 1% × (18.000 + … + 1.000) = 1.710; penale 180
vicino('estinzione: residuo', e.residuo, 18000); vicino('estinzione: penale', e.penale, 180); vicino('estinzione: interessi evitati', e.interessiFuturi, 1710); vicino('estinzione: risparmio netto', e.risparmio, 1530); vicino('estinzione: esborso', e.esborso, 18180); vero('estinzione: 18 rate restanti', e.rateRestanti === 18);
vicino('estinzione: penale del contratto se non indicata', F.estinzione(Object.assign({ penaleEstinzione: 0.02 }, p8), '2024-12').penale, 360);
let rn = F.rinegozia(p8, '2024-12', { tasso: 0.06, durataMesi: 18, costi: 200 });   // 0,5% × 171.000 = 855 + 200
vicino('rinegoziazione: costo nuovo', rn.nuovo.costo, 1055); vicino('rinegoziazione: costo vecchio', rn.vecchio.costo, 1710); vicino('rinegoziazione: risparmio', rn.risparmio, 655); vero('rinegoziazione: stessa scadenza', !rn.allunga && rn.nuovo.fine === '2026-06');
rn = F.rinegozia(p8, '2024-12', { tasso: 0.12, durataMesi: 36, costi: 0 }); vero('allungare la durata abbassa la rata ma costa di più', rn.allunga && rn.risparmio < 0 && rn.rate12dopo < rn.rate12prima, rn.risparmio);
vero('finanziamento estinto: niente rinegoziazione', F.rinegozia(p8, '2026-12', { tasso: 0.05, durataMesi: 12 }) === null);

// --- 4. quadro complessivo e bilancio ----------------------------------------------------------
const az = S.genera({ settore: 'manifatturiera', profilo: 'sana', seme: 5, anni: 3 }), Y = Math.max(...Object.keys(az.esercizi).map(Number)), n = M.numeri(az.esercizi[Y]), r = M.riclassifica(n, az.classificazione);
az.finanziamenti = { prestiti: [Object.assign({ id: 'a', stato: 'in corso' }, p8, { inizio: (Y) + '-06' }), { id: 'b', tipo: 'fido', accordato: 100000, utilizzoMedio: 60000, tasso: 0.07, commissione: 0.01 },
  { id: 'c', tipo: 'leasing', importo: 10000, anticipo: 1000, valoreResiduo: 900, inizio: Y + '-12', durataMesi: 9, tasso: 0 }, { id: 'd', tipo: 'mutuo', stato: 'offerta', importo: 10000, inizio: (Y + 1) + '-01', durataMesi: 12, tasso: 0.05, periodicitaMesi: 12, speseIniziali: 100 }, { id: 'x', tipo: 'mutuo', nome: 'incompleto' }], agevolazioni: [] };
let a = F.analizza(az, Y + '-12', { n, classificazione: az.classificazione, ceOk: true, spOk: true });
vicino('debito = mutui + fidi (leasing e offerte esclusi)', a.debito, 78000); vicino('entro 12 mesi + fidi', a.breve, 72000); vicino('rate + costo dei fidi', a.servizio, 13500 + 5200); vicino('leasing a parte', a.leasingResiduo, 9000); vicino('canoni leasing 12 mesi', a.canoni12, 9000);
vicino('costo medio ponderato', a.costoMedio, (18000 * 0.12 + 60000 * 0.07) / 78000, 1e-9); vicino('quota variabile', a.quotaVariabile, 1); vicino('un punto di tasso', a.stress1, 725); vero('un finanziamento incompleto è segnalato, non stimato', a.nonValidi === 1);
vero('scadenze per anno: 12.000 e 6.000', a.scadenze.length === 2 && Math.abs(a.scadenze[0].capitale - 12000) < 1e-6 && Math.abs(a.scadenze[1].capitale - 6000) < 1e-6 && a.scadenze[0].da === (Y + 1) + '-01');
vicino('copertura = EBITDA ÷ servizio del debito', a.bilancio.copertura, r.ebitda / 18700, 1e-9); vicino('differenza con il bilancio', a.bilancio.differenza, r.debiti_finanziari - 78000, 1e-6); vicino('interessi calcolati per l\'anno', a.bilancio.interessiCalcolati, 1290 + 5200);
vero('offerta: sostenibilità dopo il nuovo finanziamento', a.offerte.length === 1 && Math.abs(a.offerte[0].coperturaDopo - r.ebitda / (18700 + 10500)) < 1e-9);
vero('senza bilancio nessun confronto inventato', F.analizza(az, Y + '-12').bilancio === undefined);
a = F.analizza(az, Y + '-12', { n, classificazione: az.classificazione, ceOk: false, spOk: true }); vero('conto economico incompleto: niente copertura', a.bilancio.copertura === undefined && a.bilancio.differenza !== undefined);
// criticità: rate molto superiori al margine
az.finanziamenti.prestiti.push({ id: 'g', tipo: 'mutuo', stato: 'in corso', importo: Math.max(100000, r.ebitda * 3), inizio: Y + '-12', durataMesi: 12, tasso: 0.05, variabile: true });
a = F.analizza(az, Y + '-12', { n, classificazione: az.classificazione, ceOk: true, spOk: true }); let c = F.criticita(a, null, eur, pct);
vero('criticità: rate non coperte (grave)', c.some(x => /non copre/.test(x.titolo) && x.gravita === 'rosso')); vero('criticità: debito concentrato a breve', c.some(x => /entro 12 mesi/.test(x.titolo))); vero('criticità: finanziamenti diversi dal bilancio', c.some(x => /non spiegano/.test(x.titolo)));
vero('nessun finanziamento: nessuna criticità', F.criticita(F.analizza({ esercizi: az.esercizi }, Y + '-12', { n, classificazione: az.classificazione, ceOk: true, spOk: true }), null, eur, pct).length === 0);

// --- 5. controlli sui dati ---------------------------------------------------------------------
vero('dati mancanti elencati', F.valida({ tipo: 'mutuo' }).length === 4 && F.valida({ tipo: 'fido' }).length === 2);
vero('periodicità e preammortamento non validi', F.valida({ tipo: 'mutuo', importo: 1, inizio: '2024-01', durataMesi: 12, tasso: 0.05, periodicitaMesi: 5 }).length === 1 && F.valida({ tipo: 'mutuo', importo: 1, inizio: '2024-01', durataMesi: 12, preammortamentoMesi: 12, tasso: 0.05 }).length === 1);
vero('data non valida', F.ix('2024-13') === null && F.ix('gennaio') === null && F.ymDi(F.ix('2024-11') + 3) === '2025-02');

// --- 6. agevolazioni ---------------------------------------------------------------------------
const azG = { agevolazioni: null, finanziamenti: { prestiti: [], agevolazioni: [
  { id: '1', nome: 'A', importo: 10000, stato: 'valutare', scadenza: '2026-04-10', fonte: 'https://esempio.invalid/bando', verificata: '2026-03-20', requisiti: [{ t: 'x', esito: 'si' }, { t: 'y', esito: '?' }] },
  { id: '2', nome: 'B', importo: 5000, stato: 'valutare', scadenza: '2026-09-30', fonte: '', requisiti: [] },
  { id: '3', nome: 'C', importo: 7000, stato: 'presentata', fonte: 'Gazzetta', verificata: '2025-01-01' }, { id: '4', nome: 'D', importo: 3000, stato: 'concessa', fonte: 'Decreto' }, { id: '5', nome: 'E', importo: 2000, stato: 'incassata', fonte: 'Decreto' },
  { id: '6', nome: 'F', importo: 9000, stato: 'preparazione', scadenza: '2026-03-01', fonte: 'Bando', verificata: '2025-10-01', requisiti: [{ t: 'z', esito: 'no' }] }, { id: '7', nome: 'G', importo: 4000, stato: 'respinta', fonte: 'Bando' }] } };
let g = F.analizzaAgevolazioni(azG, '2026-03-31');
vicino('potenziale: solo con fonte e termine non scaduto', g.potenziale, 10000); vicino('richiesto', g.richiesto, 7000); vicino('concesso', g.concesso, 3000); vicino('incassato', g.incassato, 2000);
vero('in scadenza entro 30 giorni', g.urgenti.length === 1 && g.urgenti[0].giorni === 10 && g.righe[0].requisitiDaVerificare === 1); vero('senza fonte: non conteggiata e segnalata', g.senzaFonte === 1 && /fonte/.test(g.righe[1].avvisi[0]));
vero('termine scaduto, fonte vecchia e requisito mancante segnalati', g.righe[5].avvisi.length === 3 && g.righe[5].giorni === -30); vero('domanda presentata: nessun avviso sulla verifica', g.righe[2].avvisi.length === 0);
vero('criticità per l\'agevolazione in scadenza', F.criticita(F.analizza(azG, '2026-03'), g, eur, pct).some(x => /scadenza/.test(x.titolo)));

// --- 7. finanziamenti simulati -----------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [4, 61, 909]) {
  const zz = S.genera({ settore, profilo, seme, anni: 3 }); zz.finanziamenti = F.simula(zz, seme); aziende++;
  const es = F.collaudo(zz); tot += es.length; sup += es.filter(x => x.ok).length;
  es.filter(x => !x.ok).forEach(x => { (falliti[x.nome] = falliti[x.nome] || []).push(settore + '/' + profilo + '/' + seme + ' ' + x.dettaglio); });
}
vero('collaudo finanziamenti simulati ' + sup + '/' + tot, Object.keys(falliti).length === 0);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest finanziamenti superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con finanziamenti simulati: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
