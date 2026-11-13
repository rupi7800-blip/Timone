/* Test del modulo Decisioni produttive.  Avvio:  node test-decisioni.js */
const M = require('./motore.js'), S = require('./simulatore.js'), D = require('./decisioni.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 0.01)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }

// --- 1. caso calcolato a mano -----------------------------------------------------------------
// 4 mesi, capacità 1.000/mese, domanda 2.000 (500/mese), prezzo 10, costo variabile 6, fissi 2.000/mese di cui 50% evitabili,
// nessuna scorta iniziale, nessun costo di mantenimento, finanziario o di obsolescenza
const c = { mesi: 4, capacitaMese: 1000, prezzo: 10, costoVariabile: 6, ordiniConfermati: 2000, scortaIniziale: 0, costiFissiMese: 2000, quotaEvitabile: 0.5, costoFermo: 300, costoRiavvio: 700, mesiFermo: 2, riduzione: 0.5, prezzoEsterno: 8 };
let k = D.analizza(c), s = k.scenari;
vicino('margine unitario', k.margineUnitario, 4); vicino('saturazione 2.000 / 4.000', k.saturazione, 0.5); vicino('fissi evitabili al mese', k.fissiEvitabiliMese, 1000); vicino('mesi di fermo per ripagare fermo e riavvio', k.mesiPareggioFermo, 1);
// continuare: produce 4.000, vende 2.000, scorta 2.000 (12.000 €). Cassa = 20.000 − 24.000 − 8.000 = −12.000; economico = −12.000 + 12.000 = 0
vicino('continuare: prodotti', s.continuare.prodotti, 4000); vicino('continuare: scorta finale', s.continuare.scortaFinale, 2000); vicino('continuare: cassa', s.continuare.cassa, -12000); vicino('continuare: economico', s.continuare.economico, 0); vicino('continuare: capitale immobilizzato', s.continuare.capitaleFinale, 12000);
// su ordinazione (e ridurre al 50%): produce 2.000, vende 2.000. Cassa = economico = 20.000 − 12.000 − 8.000 = 0
vicino('su ordinazione: prodotti', s.ordinazione.prodotti, 2000); vicino('su ordinazione: cassa', s.ordinazione.cassa, 0); vicino('su ordinazione: economico', s.ordinazione.economico, 0); vicino('ridurre al 50%: come su ordinazione', s.ridurre.economico, 0);
// anticipare: 2 mesi a pieno ritmo (2.000), poi 2 mesi di fermo: fissi 4.000 + 2.000 = 6.000, una tantum 1.000 → 20.000 − 12.000 − 6.000 − 1.000 = 1.000
vicino('anticipare: mesi di fermo', s.anticipare.mesiFermo, 2); vicino('anticipare: fissi pagati', s.anticipare.fissi, 6000); vicino('anticipare: economico', s.anticipare.economico, 1000); vicino('anticipare: scorta massima', s.anticipare.scortaMax, 1000);
// fermare 2 mesi senza scorte: perse 1.000 unità; poi su ordinazione 1.000: ricavi 10.000 − 6.000 − fissi 6.000 − 1.000 = −3.000
vicino('fermare: vendite perse', s.fermare.perse, 1000); vicino('fermare: margine perso', s.fermare.marginePerso, 4000); vicino('fermare: economico', s.fermare.economico, -3000);
// esternalizzare: 2.000 × 8 = 16.000, fissi 4.000, una tantum 1.000 → 20.000 − 16.000 − 4.000 − 1.000 = −1.000
vicino('esternalizzare: costo', s.esternalizzare.costoEsterni, 16000); vicino('esternalizzare: economico', s.esternalizzare.economico, -1000);
vero('scelta migliore: produrre in anticipo, poi fermare', k.migliore === 'anticipare' && k.classifica[0].delta === 1000, k.migliore);
// con costi di mantenimento, finanziari e obsolescenza continuare peggiora: scorta media 250, 750, 1.250, 1.750 → 4.000 × 6 = 24.000 € · mese
k = D.analizza(Object.assign({}, c, { costoMantenimento: 0.12, tassoFinanziario: 0.06, rischioObsolescenza: 0.1 })); s = k.scenari;
vicino('continuare: costo di mantenimento 24.000 × 1%', s.continuare.mantenimento, 240); vicino('continuare: costo finanziario 24.000 × 0,5%', s.continuare.finanziario, 120); vicino('continuare: obsolescenza 12.000 × 10%', s.continuare.obsolescenza, 1200);
vicino('continuare: economico con i costi delle scorte', s.continuare.economico, -1560); vicino('continuare: cassa (senza costi non monetari)', s.continuare.cassa, -12240);
vero('con i costi delle scorte continuare è peggio che produrre su ordinazione', s.continuare.economico < s.ordinazione.economico);
// con scorta iniziale di 1.000 il fermo di 2 mesi non perde vendite: ricavi 20.000, produce 1.000 (6.000), fissi 6.000, una tantum 1.000;
// scorte da 1.000 a 0 → economico = cassa 7.000 − 6.000 = 1.000
k = D.analizza(Object.assign({}, c, { scortaIniziale: 1000 })); s = k.scenari;
vicino('fermare con scorte: nessuna vendita persa', s.fermare.perse, 0); vicino('fermare con scorte: cassa', s.fermare.cassa, 7000); vicino('fermare con scorte: economico', s.fermare.economico, 1000);
// margine negativo: avviso; produrre meno è sempre meglio
k = D.analizza(Object.assign({}, c, { prezzo: 5 }));
vero('prezzo sotto il costo variabile: avviso', k.margineUnitario === -1 && k.avvisi.length >= 1 && k.scenari.continuare.economico <= k.scenari.ordinazione.economico);
// domanda oltre la capacità: vendite perse anche a pieno ritmo
k = D.analizza(Object.assign({}, c, { ordiniConfermati: 6000 }));
vicino('domanda oltre la capacità: perse 2.000', k.scenari.continuare.perse, 2000); vero('avviso di capacità', k.avvisi.some(x => /capacità/.test(x)) && k.migliore === 'continuare');
// previsioni incerte: confronto con i soli ordini confermati
k = D.analizza(Object.assign({}, c, { ordiniConfermati: 1000, previsioneVendite: 3000 }));
vero('con le previsioni conviene continuare; con i soli ordini no', k.migliore !== k.soloOrdini.migliore && k.soloOrdini.cambia, k.migliore + ' / ' + k.soloOrdini.migliore);
// senza prezzo esterno lo scenario non compare; dati mancanti
vero('senza prezzo esterno: nessuna esternalizzazione', D.analizza(Object.assign({}, c, { prezzoEsterno: undefined })).scenari.esternalizzare === undefined);
vero('dati mancanti: errori elencati', D.analizza({ mesi: 6 }).errori.length === 4);
vero('quota evitabile non indicata: avviso', D.analizza(Object.assign({}, c, { quotaEvitabile: undefined })).avvisi.some(x => /evitabile/.test(x)));

// --- 2. casi simulati --------------------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0, senza = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [6, 77, 808]) {
  const zz = S.genera({ settore, profilo, seme, anni: 3 }); zz.decisioni = D.simulaCasi(zz);
  if (!zz.decisioni.casi.length) { senza++; continue; } aziende++;
  const e = D.collaudo(zz); tot += e.length; sup += e.filter(x => x.ok).length;
  e.filter(x => !x.ok).forEach(x => { (falliti[x.nome] = falliti[x.nome] || []).push(settore + '/' + profilo + '/' + seme + ' ' + x.dettaglio); });
}
vero('collaudo casi simulati ' + sup + '/' + tot, Object.keys(falliti).length === 0);
vero('settori senza produzione: nessun caso inventato', senza === 54, senza);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest decisioni superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con casi simulati: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
