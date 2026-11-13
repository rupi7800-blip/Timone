/* Test del modulo Confronti e ISA.  Avvio:  node test-benchmark.js */
const M = require('./motore.js'), S = require('./simulatore.js'), B = require('./benchmark.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 1e-9)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }
const eur = x => '€ ' + Math.round(x), fi = (x, u) => M.fmt ? String(Math.round(x * 1000) / 1000) : String(x);

// --- 1. confronto calcolato a mano -------------------------------------------------------------
const az = S.genera({ settore: 'manifatturiera', profilo: 'sana', seme: 3, anni: 2, ricavi: 1000000 }), Y = Math.max(...Object.keys(az.esercizi).map(Number)), n = M.numeri(az.esercizi[Y]), p = M.numeri(az.esercizi[Y - 1]), ix = M.calcolaIndici(n, p, {});
const pr = { n, p, completo: true }, rif = (id, nome, indici, extra) => Object.assign({ id, nome, tipo: 'riferimento', fonte: 'Studio X 2025', anni: { [Y]: { indici } } }, extra || {});
vero('mediana: dispari, pari, vuota', B.mediana([3, 1, 2]) === 2 && B.mediana([4, 1, 2, 3]) === 2.5 && B.mediana([]) === null);
az.benchmark = { termini: [rif('a', 'A', { ebitda_margin: 0.30, dso: 10, roi: 0.001, incidenza_personale: 0.2, current_ratio: ix.current_ratio.v }), rif('b', 'B', { ebitda_margin: 0.40, dso: 20, roi: 0.002, incidenza_personale: 0.3, current_ratio: ix.current_ratio.v * 1.05 }), rif('c', 'C', { ebitda_margin: 0.50, dso: 30, roi: 0.003, incidenza_personale: 0.4 }),
  rif('d', 'Senza fonte', { ebitda_margin: 9 }, { fonte: ' ' }), Object.assign(rif('e', 'Futuro', {}), { anni: { [Y + 1]: { indici: { ebitda_margin: 9 } } } })], isa: [] };
let a = B.analizza(az, Y, pr), r = id => a.righe.filter(x => x.i.id === id)[0];
vero('tre termini usati, due esclusi (senza fonte, senza dati)', a.termini.length === 3 && a.esclusi.length === 2 && a.avvisi.some(x => /manca la fonte/.test(x) && /nessun dato/.test(x)));
vicino('valore proprio = scheda Indici', r('ebitda_margin').proprio, ix.ebitda_margin.v); vicino('mediana EBITDA margin', r('ebitda_margin').mediana, 0.40); vicino('minimo', r('ebitda_margin').min, 0.30); vicino('massimo', r('ebitda_margin').max, 0.50);
vero('EBITDA margin: peggio, scarto forte, ultimo su 4', r('ebitda_margin').giudizio === 'peggio' && r('ebitda_margin').forte && r('ebitda_margin').posizione === 4 && r('ebitda_margin').su === 4);
vicino('valore dello scarto di margine: (40% − proprio) × ricavi', r('ebitda_margin').euro, (0.40 - ix.ebitda_margin.v) * n.ricavi, 1e-6);
vero('giorni di incasso: più alti della mediana = peggio', r('dso').giudizio === 'peggio' && r('dso').posizione === 4); vicino('crediti liberabili: crediti × (1 − 20 ÷ giorni propri)', r('dso').euro, n.crediti_clienti * (1 - 20 / ix.dso.v), 1e-6);
vero('ROI: meglio di tutti, primo su 4, nessun valore in euro', r('roi').giudizio === 'meglio' && r('roi').posizione === 1 && r('roi').euro === undefined);
vero('incidenza del personale: nessun giudizio (dipende dal modello)', r('incidenza_personale').giudizio === 'neutro' && r('incidenza_personale').posizione === undefined); vicino('…ma lo scarto è mostrato', r('incidenza_personale').scarto, ix.incidenza_personale.v - 0.3);
vero('current ratio entro il 10% dalla mediana: in linea', r('current_ratio').giudizio === 'in linea' && r('current_ratio').n === 2); vicino('mediana di due valori', r('current_ratio').mediana, ix.current_ratio.v * 1.025);
vero('indice senza termini: nessun confronto', r('roe').n === 0 && r('roe').giudizio === undefined && r('roe').mediana === undefined);
vero('punti deboli ordinati per valore in euro', a.debolezza.length === 2 && a.debolezza[0].euro >= a.debolezza[1].euro && a.forza.length === 1);
vicino('crescita dei ricavi', a.propri.crescita, n.ricavi / p.ricavi - 1);
// bilancio proprio incompleto: nessun giudizio, solo i valori dei termini
a = B.analizza(az, Y, { n, p, completo: false }); vero('bilancio incompleto: nessun giudizio inventato', a.propri === null && a.righe.every(x => x.proprio === null && x.giudizio === undefined) && a.avvisi.some(x => /incompleto/.test(x)) && r('ebitda_margin').mediana === 0.40);
// un solo termine: confronto indicativo; anno precedente segnalato
az.benchmark.termini = [Object.assign(rif('v', 'Vecchio', {}), { anni: { [Y - 1]: { indici: { ebitda_margin: 0.2 }, ricavi: n.ricavi * 8 } } })];
a = B.analizza(az, Y, pr); vero('un termine, dato dell\'anno prima, dimensione lontana: tre avvisi', a.termini.length === 1 && a.termini[0].v.vecchio && a.termini[0].lontano && a.avvisi.length === 3, a.avvisi.join(' | ')); vicino('rapporto di dimensione', a.termini[0].dimensione, 8, 1e-9);

// --- 2. concorrente con bilancio ---------------------------------------------------------------
const q = S.genera({ settore: 'manifatturiera', profilo: 'margini_in_calo', seme: 44, anni: 2, annoFinale: Y, ricavi: 1500000 }), qn = M.numeri(q.esercizi[Y]), qp = M.numeri(q.esercizi[Y - 1]), qix = M.calcolaIndici(qn, qp, {});
az.benchmark.termini = [{ id: 'q', nome: 'Concorrente', tipo: 'concorrente', fonte: 'Bilancio XBRL', anni: { [Y]: { n: qn }, [Y - 1]: { n: qp } } }];
a = B.analizza(az, Y, pr); vicino('indici del concorrente calcolati dal suo bilancio', r('roi').valori[0], qix.roi.v); vicino('crescita del concorrente', r('crescita').valori[0], qn.ricavi / qp.ricavi - 1); vero('tutti gli indici disponibili', a.termini[0].disponibili === B.ELENCO.length && a.termini[0].v.daBilancio);
// bilancio abbreviato: debiti non ripartiti → gli indici che li usano non sono calcolati
const abbr = Object.assign({}, qn); delete abbr.debiti_banche_breve; delete abbr.debiti_banche_lungo; delete abbr.debiti_fornitori; az.benchmark.termini[0].anni = { [Y]: { n: abbr } };
a = B.analizza(az, Y, pr); vero('voci mancanti: PFN/EBITDA e giorni di pagamento non calcolati, margine sì', r('pfn_ebitda').valori[0] === null && r('dpo').valori[0] === null && r('ebitda_margin').valori[0] !== null && a.termini[0].v.incompleto === 3 && r('crescita').valori[0] === null);
// da un'importazione XBRL
let t = B.termineDaImport({ anagrafica: { denominazione: 'Beta Srl', codiceFiscale: '123', ateco: '25.62' }, anni: [Y - 1, Y], descrizione: 'Bilancio abbreviato', righe: [{ voce: 'ricavi', valori: { [Y]: 100, [Y - 1]: 80 } }, { voce: 'personale', valori: { [Y]: 30 } }, { voce: null, valori: { [Y]: 5 } }] }, 'beta.xbrl');
vero('termine da XBRL: nome, fonte, anni e voci', t.nome === 'Beta Srl' && /beta\.xbrl/.test(t.fonte) && t.anni[Y].n.ricavi === 100 && t.anni[Y].n.personale === 30 && t.anni[Y - 1].n.personale === undefined && Object.keys(t.anni[Y].n).length === 2 && t.ateco === '25.62');

// bilancio abbreviato con i totali di crediti e debiti: indici dai totali
const vinc = [{ gruppo: 'crediti', totale: (qn.crediti_clienti || 0) + (qn.altri_crediti || 0), entro: null, oltre: null, voci: ['crediti_clienti', 'altri_crediti'] }, { gruppo: 'debiti', totale: ['debiti_banche_breve', 'debiti_banche_lungo', 'altri_debiti_fin', 'debiti_fornitori', 'debiti_tributari', 'altri_debiti'].reduce((t, k) => t + (qn[k] || 0), 0), entro: ['debiti_banche_breve', 'debiti_fornitori', 'debiti_tributari', 'altri_debiti'].reduce((t, k) => t + (qn[k] || 0), 0), oltre: (qn.debiti_banche_lungo || 0) + (qn.altri_debiti_fin || 0), voci: ['debiti_banche_breve', 'debiti_banche_lungo', 'altri_debiti_fin', 'debiti_fornitori', 'debiti_tributari', 'altri_debiti'] }];
const ab2 = Object.assign({}, qn); vinc[0].voci.concat(vinc[1].voci).forEach(k => delete ab2[k]);
az.benchmark.termini[0].anni = { [Y]: { n: ab2, vincoli: vinc }, [Y - 1]: { n: qp } }; a = B.analizza(az, Y, pr); const rq = M.riclassifica(qn, {});
vero('abbreviato: indici dai totali, senza quelli che richiedono il dettaglio', a.termini[0].v.daTotali && ['dso', 'dpo', 'ccc', 'pfn_ebitda', 'debt_equity', 'roi'].every(k => r(k).valori[0] === null) && a.termini[0].disponibili === B.ELENCO.length - 6, a.termini[0].disponibili);
vicino('abbreviato: ROE uguale a quello del bilancio completo', r('roe').valori[0], qix.roe.v, 1e-9); vicino('abbreviato: ROA uguale', r('roa').valori[0], qix.roa.v, 1e-9); vicino('abbreviato: indebitamento uguale', r('indebitamento').valori[0], qix.indebitamento.v, 1e-9);
vicino('abbreviato: current ratio uguale (scadenze note)', r('current_ratio').valori[0], qix.current_ratio.v, 1e-9); vicino('abbreviato: giorni di scorta uguali', r('giorni_magazzino').valori[0], qix.giorni_magazzino.v, 1e-9);
vinc[1].entro = null; vinc[1].oltre = null; a = B.analizza(az, Y, pr); vero('abbreviato senza scadenze dei debiti: niente current e quick ratio', r('current_ratio').valori[0] === null && r('quick_ratio').valori[0] === null && r('roe').valori[0] !== null);
t = B.termineDaImport({ anagrafica: {}, anni: [Y], righe: [{ voce: 'ricavi', valori: { [Y]: 1 } }], vincoli: { [Y]: [{ gruppo: 'debiti', titolo: 'x', testo: 'y', totale: 5, entro: 3, oltre: 2, voci: ['altri_debiti'] }] } }, 'f.xbrl'); vero('i totali da ripartire sono conservati nel termine', t.anni[Y].vincoli.length === 1 && t.anni[Y].vincoli[0].totale === 5 && t.anni[Y].vincoli[0].testo === undefined && t.nome === 'f.xbrl');

// --- 3. ISA ------------------------------------------------------------------------------------
const isa = l => B.analizzaIsa({ benchmark: { termini: [], isa: l } });
let u = isa([{ anno: 2025, punteggio: 9.1, fonte: 'x' }]).ultimo; vero('9,1: benefici pieni', u.livello === 'pieno' && !u.perMedia && !u.controlli && u.media === null && u.sogliePeriodo);
u = isa([{ anno: 2025, punteggio: 8.3 }]).ultimo; vero('8,3: benefici ridotti; manca 0,7 al livello pieno', u.livello === 'ridotto' && Math.abs(u.mancaPieno - 0.7) < 1e-9 && u.senzaFonte);
u = isa([{ anno: 2024, punteggio: 9.1 }, { anno: 2025, punteggio: 7.9 }]).ultimo; vero('7,9 con 9,1 l\'anno prima (media 8,5): ridotti grazie alla media', u.livello === 'ridotto' && u.perMedia && Math.abs(u.media - 8.5) < 1e-9 && Math.abs(u.variazione + 1.2) < 1e-9);
u = isa([{ anno: 2024, punteggio: 9.2 }, { anno: 2025, punteggio: 8.8 }]).ultimo; vero('8,8 con 9,2 (media 9): pieni grazie alla media', u.livello === 'pieno' && u.perMedia);
u = isa([{ anno: 2023, punteggio: 9.9 }, { anno: 2025, punteggio: 7.9 }]).ultimo; vero('anni non consecutivi: nessuna media', u.media === null && u.livello === 'nessuno' && !u.sogliePeriodo === false);
vero('6: controlli; 6,1: no', isa([{ anno: 2025, punteggio: 6 }]).ultimo.controlli && !isa([{ anno: 2025, punteggio: 6.1 }]).ultimo.controlli);
u = isa([{ anno: 2025, punteggio: 7, indicatori: [{ nome: 'a', valore: 8 }, { nome: 'b', valore: 3 }, { nome: 'c' }] }]).ultimo; vero('indicatori ordinati dal più basso', u.deboli.length === 2 && u.deboli[0].nome === 'b');
vero('nessun punteggio: niente', isa([{ anno: 2025 }]).ultimo === null);

// --- 4. criticità ------------------------------------------------------------------------------
az.benchmark.termini = [rif('a', 'A', { ebitda_margin: 0.30, dso: 10 }), rif('b', 'B', { ebitda_margin: 0.40, dso: 20 })]; a = B.analizza(az, Y, pr);
let c = B.criticita(a, isa([{ anno: 2025, punteggio: 5.5 }]), eur, fi); vero('criticità: sotto i termini di confronto, con valore in euro', c.some(x => /sotto i termini/.test(x.titolo) && /€/.test(x.effetto))); vero('criticità: ISA basso', c.some(x => /ISA basso/.test(x.titolo) && /123160/.test(x.dati)));
az.benchmark.termini = [rif('a', 'A', { ebitda_margin: 0.30 })]; vero('un solo termine: nessuna criticità', B.criticita(B.analizza(az, Y, pr), isa([{ anno: 2025, punteggio: 8 }]), eur, fi).length === 0);

// --- 5. dati simulati --------------------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [1, 37, 606]) {
  const zz = S.genera({ settore, profilo, seme, anni: 3 }); zz.benchmark = B.simula(zz, seme); aziende++;
  const es = B.collaudo(zz); tot += es.length; sup += es.filter(x => x.ok).length;
  es.filter(x => !x.ok).forEach(x => { (falliti[x.nome] = falliti[x.nome] || []).push(settore + '/' + profilo + '/' + seme + ' ' + x.dettaglio); });
}
vero('collaudo confronti simulati ' + sup + '/' + tot, Object.keys(falliti).length === 0);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest confronti superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con confronti simulati: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
