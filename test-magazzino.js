/* Test del modulo Magazzino.  Avvio:  node test-magazzino.js */
const M = require('./motore.js'), S = require('./simulatore.js'), G = require('./magazzino.js'), I = require('./importa.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 0.01)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }

// --- 1. caso calcolato a mano (inventario al 31/12/2024) ----------------------------------------
const par = G.PARAMETRI, D = '2024-12-31';
// regolare: 1.000 pz a 2 €, consumo 7.300/anno → 20 al giorno → 50 giorni di copertura
let k = G.articolo({ giacenza: 1000, costoUnitario: 2, consumoAnnuo: 7300, ultimoMovimento: '2024-12-20', scortaMinima: 200, leadTime: 10 }, D, par);
vicino('valore', k.valore, 2000); vicino('copertura', k.copertura, 50); vicino('rotazione', k.rotazione, 7.3); vero('classe regolare', k.classe === 'ok');
// eccesso: 3.650 pz, consumo 3.650/anno → 365 giorni; eccedenza oltre 120 giorni = 3.650 − 1.200 = 2.450 pz
k = G.articolo({ giacenza: 3650, costoUnitario: 4, consumoAnnuo: 3650, ultimoMovimento: '2024-12-01' }, D, par);
vero('classe eccesso', k.classe === 'eccesso'); vicino('eccedenza', k.eccedenza, 2450); vicino('valore eccedenza', k.valoreEccedenza, 9800);
// fermo: ultimo movimento 200 giorni prima
k = G.articolo({ giacenza: 10, costoUnitario: 100, consumoAnnuo: 5, ultimoMovimento: '2024-06-14' }, D, par);
vero('classe fermo', k.classe === 'fermo' && k.giorniFermo === 200, k.classe + ' ' + k.giorniFermo);
// obsoleto: nessun consumo e nessun movimento da oltre un anno; oppure consumo zero senza data
vero('obsoleto per data', G.articolo({ giacenza: 10, costoUnitario: 1, consumoAnnuo: 3, ultimoMovimento: '2023-10-01' }, D, par).classe === 'obsoleto');
vero('obsoleto per consumo zero', G.articolo({ giacenza: 10, costoUnitario: 1, consumoAnnuo: 0 }, D, par).classe === 'obsoleto');
// sotto scorta: giacenza 50 + ordine 0 < minima 200; fabbisogno = 20/giorno × 10 giorni + 200 − 50 = 350
k = G.articolo({ giacenza: 50, costoUnitario: 2, consumoAnnuo: 7300, ultimoMovimento: '2024-12-30', scortaMinima: 200, leadTime: 10, inOrdine: 0 }, D, par);
vero('classe sotto scorta', k.classe === 'sotto_scorta'); vicino('fabbisogno', k.fabbisogno, 350); vicino('autonomia', k.giorniAutonomia, 2.5);
vero('ordine in arrivo copre la scorta', G.articolo({ giacenza: 50, costoUnitario: 2, consumoAnnuo: 7300, ultimoMovimento: '2024-12-30', scortaMinima: 200, leadTime: 5, inOrdine: 400 }, D, par).classe === 'ok');
// dati insufficienti: mai classificato a caso
vero('senza costo: incompleto', G.articolo({ giacenza: 10 }, D, par).classe === 'incompleto');
vero('senza consumo né data: incompleto', G.articolo({ giacenza: 10, costoUnitario: 1 }, D, par).classe === 'incompleto');

// inventario completo e riconciliazione
const az = { esercizi: { 2024: { valori: { rimanenze: 15000 } } }, magazzino: { parametri: {}, anni: { 2024: { data: D, articoli: [
  { codice: 'A', giacenza: 1000, costoUnitario: 2, consumoAnnuo: 7300, ultimoMovimento: '2024-12-20' },
  { codice: 'B', giacenza: 3650, costoUnitario: 4, consumoAnnuo: 3650, ultimoMovimento: '2024-12-01' },
  { codice: 'C', giacenza: 10, costoUnitario: 100, consumoAnnuo: 5, ultimoMovimento: '2024-06-14' }] } } } };
let a = G.analisi(az, 2024, { rimanenze: 17600 });
vicino('valore inventario', a.valore, 17600); vero('riconciliato', a.riconciliato && a.differenza === 0);
vicino('costo finanziario 6%', a.costoFinanziario, 1056); vicino('liberabile = fermo + eccedenze', a.liberabile, 1000 + 9800);
vicino('consumi a valore', a.consumiValore, 14600 + 14600 + 500); vero('ABC: B (83%) in classe A', a.righe[1].k.abc === 'A' && a.righe[0].k.abc === 'B');
a = G.analisi(az, 2024, { rimanenze: 15000 });
vero('differenza con il bilancio segnalata', !a.riconciliato && a.criticita[0].id === 'magazzino_bilancio');
vero('anno senza inventario', G.analisi(az, 2023, null).presente === false);

// --- 2. importazione da tabella -------------------------------------------------------------------
const csv = 'Inventario al 31/12/2024\nCodice;Descrizione;Categoria;UM;Giacenza;Costo unitario;Consumo annuo;Ultimo movimento;Scorta minima\nMP-1;Granulo;Materie prime;kg;1.200,5;1,35;48.000;15/12/2024;400\nPF-9;Scocca;Prodotti finiti;pz;300;12;0;01/03/2023;\nMP-1;doppione;;;1;1;;;\n;riga vuota;;;;;;;\nXX;senza quantità;;;;;;;\n';
const imp = G.daTabella(I.csv(csv), I.numero);
vero('import: due articoli', imp.articoli.length === 2, imp.articoli.length);
vero('import: numeri e date italiani', imp.articoli[0].giacenza === 1200.5 && imp.articoli[0].costoUnitario === 1.35 && imp.articoli[0].ultimoMovimento === '2024-12-15');
vero('import: categoria riconosciuta', imp.articoli[1].categoria === 'prodotto' && imp.articoli[0].categoria === 'materia');
vero('import: doppione e riga senza quantità segnalati', imp.avvisi.length === 2, JSON.stringify(imp.avvisi));
const imp2 = G.daTabella(I.csv('Articolo;Quantità;Valore\nZ1;10;250\n'), I.numero);
vero('import: costo da valore ÷ giacenza', imp2.articoli[0].costoUnitario === 25 && imp2.avvisi.length === 1);
vero('import: intestazione mancante', G.daTabella(I.csv('a;b\n1;2\n'), I.numero).articoli.length === 0);
vero('data di Excel', G.data(45657) === '2024-12-31', G.data(45657));
vero('esportazione rileggibile', G.daTabella(I.csv(G.esportaCsv(G.analisi(az, 2024, null))), I.numero).articoli.length === 3);

// --- 3. inventari simulati --------------------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [5, 66, 777]) {
  const z = S.genera({ settore, profilo, seme, anni: 3 }); z.magazzino = G.simula(z, seme);
  if (!Object.keys(z.magazzino.anni).length) continue; aziende++;
  const e = G.collaudo(z); tot += e.length; sup += e.filter(x => x.ok).length;
  e.filter(x => !x.ok).forEach(x => { const kk = x.nome.replace(/^\d+ · /, ''); (falliti[kk] = falliti[kk] || []).push(settore + '/' + profilo + '/' + seme + ' ' + x.dettaglio); });
}
vero('collaudo magazzini simulati ' + sup + '/' + tot, Object.keys(falliti).length === 0);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest magazzino superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con inventario simulato: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
