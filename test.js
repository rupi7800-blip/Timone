/* Test automatici del motore.  Avvio:  node test.js
   1) caso calcolato a mano: verifica le formule contro valori noti;
   2) collaudo massivo: 240 aziende simulate (settori × profili × semi). */
const M = require('./motore.js'), S = require('./simulatore.js'), I = require('./importa.js');
let ok = 0, ko = 0;
function vicino(nome, ottenuto, atteso, tol) {
  const passa = ottenuto !== null && Math.abs(ottenuto - atteso) <= (tol || 0.01);
  passa ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', ottenuto, 'atteso', atteso));
}
function vero(nome, c) { c ? ok++ : (ko++, console.log('FALLITO', nome)); }

// --- 1. caso a mano -------------------------------------------------------
const n = { ricavi: 1000, var_rim_prodotti: 0, altri_ricavi: 0, materie: 400, var_rim_materie: 0, servizi: 200, godimento: 50, personale: 200,
  ammortamenti: 50, svalutazioni_acc: 0, oneri_diversi: 10, proventi_fin: 0, oneri_fin: 20, rettifiche_fin: 0, imposte: 20,
  imm_immateriali: 0, imm_materiali: 500, imm_finanziarie: 0, rimanenze: 100, crediti_clienti: 250, altri_crediti: 0, attivita_fin_breve: 0, liquidita: 50, ratei_attivi: 0,
  capitale_riserve: 250, fondi_rischi: 0, tfr: 50, debiti_banche_breve: 100, debiti_banche_lungo: 200, altri_debiti_fin: 0, debiti_fornitori: 150, debiti_tributari: 50, altri_debiti: 50, ratei_passivi: 0 };
const cl = { materie: { quota: 1 }, servizi: { quota: 0.5 } };
const r = M.riclassifica(n, cl), ix = M.calcolaIndici(n, null, cl);
vicino('valore aggiunto', r.valore_aggiunto, 340);
vicino('EBITDA', r.ebitda, 140);
vicino('EBIT', r.ebit, 90);
vicino('utile', r.utile, 50);
vicino('totale attivo', r.totale_attivo, 900);
vicino('quadratura', r.quadratura, 0);
vicino('PFN', r.pfn, 250);
vicino('PFN/EBITDA', ix.pfn_ebitda.v, 250 / 140);
vicino('current ratio', ix.current_ratio.v, 400 / 350);
vicino('quick ratio', ix.quick_ratio.v, 300 / 350);
vicino('DSO', ix.dso.v, 91.25);
vicino('DPO', ix.dpo.v, 150 * 365 / 650);
vicino('giorni scorta', ix.giorni_magazzino.v, 91.25);
vicino('CCC', ix.ccc.v, 91.25 + 91.25 - 150 * 365 / 650);
vicino('ROE', ix.roe.v, 50 / 300);
vicino('ROI', ix.roi.v, 90 / 550);
vicino('ROS', ix.ros.v, 0.09);
vicino('copertura interessi', ix.copertura_interessi.v, 4.5);
vicino('costi variabili', r.costi_variabili, 500);
vicino('costi fissi', r.costi_fissi, 410);
vicino('break-even', r.bep, 820);
vicino('margine di sicurezza', r.margine_sicurezza, 0.18);
vicino('leva operativa', r.leva_operativa, 500 / 90);
vero('DSCR non calcolabile senza quote capitale', ix.dscr.v === null && !!ix.dscr.motivo);

// scenario: +10% prezzi → ricavi 1100, costi invariati → EBIT 190
const s1 = M.simula(n, cl, { prezzi: 0.10 });
vicino('scenario prezzi +10%: EBIT', s1.r.ebit, 190);
// scenario: +10% volumi → MC 550 − CF 410 = 140
const s2 = M.simula(n, cl, { volumi: 0.10 });
vicino('scenario volumi +10%: EBIT', s2.r.ebit, 140);
// utile obiettivo 100: aliquota effettiva 20/70; ante imposte 140; VP = (410 + 20 + 140) / 0,5 = 1140
vicino('produzione per utile 100', M.produzionePerUtile(n, cl, 100).valore_produzione, 1140);
vicino('verifica: utile a VP 1140', M.simula(n, cl, { volumi: 0.14 }).r.utile, 100);

// rendiconto su due anni: i flussi devono spiegare la variazione di cassa
const n2 = Object.assign({}, n, { ricavi: 1100, materie: 440, crediti_clienti: 300, rimanenze: 120, imm_materiali: 480, capitale_riserve: 300, debiti_banche_lungo: 170, debiti_fornitori: 160 });
n2.liquidita = 0; const q2 = M.riclassifica(n2, cl); n2.liquidita = q2.totale_passivo - q2.totale_attivo;
const rd = M.rendiconto(n2, n, cl);
vicino('rendiconto: differenza nulla', rd.differenza, 0);
vicino('rendiconto: investimenti netti', rd.investimenti_netti, 30);

// budget e scostamenti
const b = M.creaBudget(n, { ricavi: 0.10, materie: 0.10 });
vicino('budget ricavi', b.ricavi, 1100);
const sc = M.scostamenti(b, n2, cl);
vicino('scostamento EBITDA', sc.deltaEbitda, M.riclassifica(n2, cl).ebitda - M.riclassifica(b, cl).ebitda);

// dati mancanti: segnalati, mai inventati
const parziale = { ricavi: 1000, materie: 400 };
vero('voci mancanti elencate', M.mancanti(parziale).length === M.VOCI.filter(v => v.tipo !== 'ges').length - 2);
vero('indice incompleto segnalato', M.calcolaIndici(parziale, null, cl).ebitda.incompleto === true);

// importazione: numeri italiani e riconoscimento voci
vicino('numero italiano', I.numero('1.234.567,89'), 1234567.89);
vicino('numero negativo tra parentesi', I.numero('(1.500)'), -1500);
vicino('numero con simbolo', I.numero('€ 2.000'), 2000);
vero('testo non numerico', I.numero('n.d.') === null);
const imp = I.interpreta(I.csv('Voce;2023;2024\nRicavi delle vendite e delle prestazioni;1.000.000;1.100.000\nservizi;200.000;210.000\nVoce sconosciuta;5;6\n'));
vero('import: anni riconosciuti', imp.anni.join() === '2023,2024');
vero('import: voce per nome', imp.righe[0].voce === 'ricavi' && imp.righe[0].valori[2024] === 1100000);
vero('import: voce per codice', imp.righe[1].voce === 'servizi');
vero('import: voce non riconosciuta lasciata da assegnare', imp.righe[2].voce === null);

// --- 2. collaudo massivo --------------------------------------------------
const cm = S.collaudoMassivo(8);
vero('collaudo massivo ' + cm.superati + '/' + cm.totale + ' su ' + cm.aziende + ' aziende', cm.falliti.length === 0);
cm.falliti.slice(0, 10).forEach(f => console.log('  ', f.settore, f.profilo, f.seme, f.nome, f.dettaglio));

console.log('\nTest superati: ' + ok + '  ·  falliti: ' + ko + '  ·  collaudo massivo: ' + cm.superati + '/' + cm.totale);
process.exit(ko ? 1 : 0);
