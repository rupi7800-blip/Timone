/* Test del lettore XBRL.  Avvio:  node test-xbrl.js
   I file XBRL di prova sono generati qui da aziende simulate: si verifica che, rileggendoli,
   si ottengano esattamente i valori di partenza. Nessun bilancio reale è incluso nel repository. */
const M = require('./motore.js'), S = require('./simulatore.js'), X = require('./xbrl.js'), I = require('./importa.js');
let ok = 0, ko = 0;
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }

const CTX = a => ({ d: 'D_' + a, i: 'I_' + a });
function contesti(anni) {
  return anni.map(a => `<context id="D_${a}"><entity><identifier scheme="http://www.infocamere.it">01234567890</identifier></entity><period><startDate>${a}-01-01</startDate><endDate>${a}-12-31</endDate></period></context>
<context id="I_${a}"><entity><identifier scheme="http://www.infocamere.it">01234567890</identifier></entity><period><instant>${a}-12-31</instant></period></context>`).join('\n');
}
function fatto(nome, ctx, v) { return `<itcc-ci:${nome} contextRef="${ctx}" unitRef="EUR" decimals="0">${Math.round(v)}</itcc-ci:${nome}>`; }

// Scrive i prospetti di un esercizio nella forma richiesta, partendo dalle voci di Timone
function prospetti(n, a, formaBil) {
  const c = CTX(a), r = M.riclassifica(n), f = [], d = (k, v) => f.push(fatto(k, c.d, v)), i = (k, v) => f.push(fatto(k, c.i, v));
  const pers = n.personale, salari = Math.round(pers * 0.7), oneri = Math.round(pers * 0.23);
  d('ValoreProduzioneRicaviVenditePrestazioni', n.ricavi);
  if (n.var_rim_prodotti) d('ValoreProduzioneVariazioniRimanenzeProdottiCorsoLavorazioneSemilavoratiFiniti', n.var_rim_prodotti);
  d('ValoreProduzioneAltriRicaviProventiAltri', n.altri_ricavi); d('ValoreProduzioneAltriRicaviProventiTotaleAltriRicaviProventi', n.altri_ricavi);
  d('TotaleValoreProduzione', r.valore_produzione);
  d('CostiProduzioneMateriePrimeSussidiarieConsumoMerci', n.materie); d('CostiProduzioneServizi', n.servizi); d('CostiProduzioneGodimentoBeniTerzi', n.godimento);
  d('CostiProduzionePersonaleSalariStipendi', salari); d('CostiProduzionePersonaleOneriSociali', oneri);
  if (formaBil === 'ordinario') d('CostiProduzionePersonaleTrattamentoFineRapporto', pers - salari - oneri);
  else d('CostiProduzionePersonaleTrattamentoFineRapportoTrattamentoQuiescenzaAltriCostiPersonale', pers - salari - oneri);
  d('CostiProduzionePersonaleTotaleCostiPersonale', pers);
  if (formaBil === 'ordinario') {
    const imm = Math.round(n.ammortamenti * 0.1);
    d('CostiProduzioneAmmortamentiSvalutazioniAmmortamentoImmobilizzazioniImmateriali', imm);
    d('CostiProduzioneAmmortamentiSvalutazioniAmmortamentoImmobilizzazioniMateriali', n.ammortamenti - imm);
  } else d('CostiProduzioneAmmortamentiSvalutazioniAmmortamentoImmobilizzazioniImmaterialiMaterialiAltreSvalutazioniImmobilizzazioni', n.ammortamenti);
  d('CostiProduzioneAmmortamentiSvalutazioniSvalutazioniCreditiCompresiAttivoCircolanteDisponibilitaLiquide', n.svalutazioni_acc);
  d('CostiProduzioneAmmortamentiSvalutazioniTotaleAmmortamentiSvalutazioni', n.ammortamenti + n.svalutazioni_acc);
  if (n.var_rim_materie) d('CostiProduzioneVariazioniRimanenzeMateriePrimeSussidiarieConsumoMerci', n.var_rim_materie);
  d('CostiProduzioneOneriDiversiGestione', n.oneri_diversi);
  const cp = r.valore_produzione - r.ebit; d('TotaleCostiProduzione', cp); d('DifferenzaValoreCostiProduzione', r.ebit);
  if (n.proventi_fin) { d('ProventiOneriFinanziariAltriProventiFinanziariProventiDiversiPrecedentiAltri', n.proventi_fin); d('ProventiOneriFinanziariAltriProventiFinanziariTotaleAltriProventiFinanziari', n.proventi_fin); }
  d('ProventiOneriFinanziariInteressiAltriOneriFinanziariAltri', n.oneri_fin); d('ProventiOneriFinanziariInteressiAltriOneriFinanziariTotaleInteressiAltriOneriFinanziari', n.oneri_fin);
  d('TotaleProventiOneriFinanziari', (n.proventi_fin || 0) - n.oneri_fin);
  d('RisultatoPrimaImposte', r.risultato_ante_imposte);
  d('ImposteRedditoEsercizioCorrentiDifferiteAnticipateImposteCorrenti', n.imposte);
  d('ImposteRedditoEsercizioCorrentiDifferiteAnticipateTotaleImposteRedditoEsercizioCorrentiDifferiteAnticipate', n.imposte);
  d('UtilePerditaEsercizio', r.utile);
  // stato patrimoniale
  i('TotaleImmobilizzazioniImmateriali', n.imm_immateriali); i('TotaleImmobilizzazioniMateriali', n.imm_materiali); i('TotaleImmobilizzazioniFinanziarie', n.imm_finanziarie);
  i('TotaleImmobilizzazioni', r.immobilizzazioni); i('TotaleRimanenze', n.rimanenze);
  const crediti = n.crediti_clienti + n.altri_crediti;
  if (formaBil === 'ordinario') {
    i('CreditiVersoClientiEsigibiliEntroEsercizioSuccessivo', n.crediti_clienti); i('CreditiVersoClientiTotaleCreditiVersoClienti', n.crediti_clienti);
    i('CreditiVersoAltriEsigibiliEntroEsercizioSuccessivo', n.altri_crediti); i('CreditiVersoAltriTotaleCreditiVersoAltri', n.altri_crediti);
  } else i('CreditiEsigibiliEntroEsercizioSuccessivo', crediti);
  i('TotaleCrediti', crediti);
  if (n.attivita_fin_breve) i('TotaleAttivitaFinanziarieNonCostituisconoImmobilizzazioni', n.attivita_fin_breve);
  i('DisponibilitaLiquideDepositiBancariPostali', n.liquidita); i('TotaleDisponibilitaLiquide', n.liquidita);
  i('TotaleAttivoCircolante', n.rimanenze + crediti + n.attivita_fin_breve + n.liquidita);
  i('AttivoRateiRisconti', n.ratei_attivi); i('TotaleAttivo', r.totale_attivo);
  i('PatrimonioNettoCapitale', 10000); i('PatrimonioNettoRiservaLegale', n.capitale_riserve - 10000);
  i('PatrimonioNettoUtilePerditaEsercizio', r.utile); i('TotalePatrimonioNetto', r.patrimonio_netto);
  i('FondiRischiOneriAltri', n.fondi_rischi); i('TotaleFondiRischiOneri', n.fondi_rischi);
  i('TrattamentoFineRapportoLavoroSubordinato', n.tfr);
  const debiti = n.debiti_banche_breve + n.debiti_banche_lungo + n.altri_debiti_fin + n.debiti_fornitori + n.debiti_tributari + n.altri_debiti;
  if (formaBil === 'ordinario') {
    i('DebitiDebitiVersoBancheEsigibiliEntroEsercizioSuccessivo', n.debiti_banche_breve); i('DebitiDebitiVersoBancheEsigibiliOltreEsercizioSuccessivo', n.debiti_banche_lungo);
    i('DebitiDebitiVersoBancheTotaleDebitiVersoBanche', n.debiti_banche_breve + n.debiti_banche_lungo);
    i('DebitiDebitiVersoFornitoriEsigibiliEntroEsercizioSuccessivo', n.debiti_fornitori); i('DebitiDebitiVersoFornitoriTotaleDebitiVersoFornitori', n.debiti_fornitori);
    const trib = Math.round(n.debiti_tributari * 0.6);
    i('DebitiDebitiTributariTotaleDebitiTributari', trib);
    i('DebitiDebitiVersoIstitutiPrevidenzaSicurezzaSocialeTotaleDebitiVersoIstitutiPrevidenzaSicurezzaSociale', n.debiti_tributari - trib);
    i('DebitiAltriDebitiTotaleAltriDebiti', n.altri_debiti);
  } else {
    i('DebitiEsigibiliEntroEsercizioSuccessivo', debiti - n.debiti_banche_lungo); i('DebitiEsigibiliOltreEsercizioSuccessivo', n.debiti_banche_lungo);
  }
  i('TotaleDebiti', debiti);
  i('PassivoRateiRisconti', n.ratei_passivi); i('TotalePassivo', r.totale_passivo);
  return f.join('\n');
}
function istanza(serie, formaBil, extra) {
  const schema = formaBil === 'ordinario' ? 'itcc-ci-2018-11-04.xsd' : formaBil === 'abbreviato' ? 'itcc-ci-abb-2018-11-04.xsd' : 'itcc-ci-micr-2018-11-04.xsd';
  return `<?xml version="1.0" encoding="UTF-8"?>
<xbrl xmlns="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:itcc-ci="http://www.infocamere.it/itnn/fr/itcc/ci/2018-11-04">
<link:schemaRef xlink:type="simple" xlink:href="${schema}"/>
${contesti(serie.map(s => s.anno))}
<context id="dim"><entity><identifier scheme="http://www.infocamere.it">01234567890</identifier><segment><xbrldi:explicitMember dimension="itcc-ci:X">itcc-ci:Y</xbrldi:explicitMember></segment></entity><period><instant>${serie[serie.length - 1].anno}-12-31</instant></period></context>
<unit id="EUR"><measure>iso4217:EUR</measure></unit>
<itcc-ci:DatiAnagraficiDenominazione contextRef="I_${serie[serie.length - 1].anno}">PROVA STAMPAGGIO S.R.L.</itcc-ci:DatiAnagraficiDenominazione>
<itcc-ci:DatiAnagraficiSettoreAttivitaPrevalenteAteco contextRef="I_${serie[serie.length - 1].anno}">22.29.09</itcc-ci:DatiAnagraficiSettoreAttivitaPrevalenteAteco>
<itcc-ci:TotaleDebiti contextRef="dim" unitRef="EUR" decimals="0">999999999</itcc-ci:TotaleDebiti>
<itcc-ci:TotaleImmobilizzazioniMateriali contextRef="I_${serie[serie.length - 1].anno}" unitRef="EUR" xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
${serie.map(s => prospetti(s.n, s.anno, formaBil)).join('\n')}
${extra || ''}
</xbrl>`;
}

// busta .p7m minima (CMS SignedData) con il contenuto spezzato in più OCTET STRING, codifica BER
function der(tag, corpo) {
  const L = corpo.length, len = L < 128 ? [L] : L < 256 ? [0x81, L] : L < 65536 ? [0x82, L >> 8, L & 255] : [0x83, L >> 16, (L >> 8) & 255, L & 255];
  return Buffer.concat([Buffer.from([tag].concat(len)), corpo]);
}
function p7m(xml, aPezzi) {
  const dati = Buffer.from(xml, 'utf8');
  let contenuto;
  if (aPezzi) {
    const pezzi = []; for (let i = 0; i < dati.length; i += 1000) pezzi.push(der(0x04, dati.subarray(i, i + 1000)));
    contenuto = Buffer.concat([Buffer.from([0x24, 0x80]), ...pezzi, Buffer.from([0, 0])]);
  } else contenuto = der(0x04, dati);
  const oidData = der(0x06, Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]));
  const encap = der(0x30, Buffer.concat([oidData, der(0xa0, contenuto)]));
  const firmati = der(0x30, Buffer.concat([der(0x02, Buffer.from([1])), der(0x31, Buffer.alloc(0)), encap, der(0x31, der(0x04, Buffer.from('firma finta')))]));
  const oidSigned = der(0x06, Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]));
  return der(0x30, Buffer.concat([oidSigned, der(0xa0, firmati)]));
}

// --- 1. bilancio ordinario: tutte le voci devono tornare identiche -----------------------------
let aziende = 0;
for (const settore of Object.keys(S.SETTORI)) for (const profilo of ['sana', 'sovraindebitata', 'in_perdita', 'magazzino_eccessivo']) {
  const az = S.genera({ settore, profilo, seme: 101, anni: 2 }), serie = S.serieDi(az);
  const r = X.leggi(istanza(serie, 'ordinario')); aziende++;
  const nome = settore + '/' + profilo;
  vero(nome + ' anni', r.anni.join() === serie.map(s => s.anno).join(), r.anni);
  vero(nome + ' forma', r.forma.tipo === 'ordinario' && r.forma.versione === '2018-11-04', JSON.stringify(r.forma));
  for (const s of serie) {
    const p = r.perAnno[s.anno], ctl = p.controlli.filter(c => !c.ok);
    vero(nome + ' ' + s.anno + ' controlli', ctl.length === 0 && p.controlli.length >= 7, JSON.stringify(ctl));
    vero(nome + ' ' + s.anno + ' nessun vincolo', p.vincoli.length === 0);
    const diverse = M.VOCI.filter(v => v.tipo !== 'ges').filter(v => !p.valori[v.id] || Math.abs(p.valori[v.id].v - (s.n[v.id] || 0)) > 0.5);
    vero(nome + ' ' + s.anno + ' voci identiche', diverse.length === 0, diverse.map(v => v.id + ': ' + (p.valori[v.id] && p.valori[v.id].v) + ' vs ' + s.n[v.id]).join(', '));
    const ri = M.riclassifica(Object.fromEntries(Object.entries(p.valori).map(([k, x]) => [k, x.v])));
    vero(nome + ' ' + s.anno + ' quadratura', Math.abs(ri.quadratura) < 1);
  }
}
// valore nella tabella di nota integrativa (contesto con dimensioni) ignorato; elemento nil ignorato
const az0 = S.genera({ settore: 'manifatturiera', profilo: 'sana', seme: 7, anni: 2 }), serie0 = S.serieDi(az0);
const xml0 = istanza(serie0, 'ordinario'), r0 = X.leggi(xml0), ult = serie0[1].anno;
vero('contesti con dimensioni ignorati', r0.perAnno[ult].valori.altri_debiti.v === serie0[1].n.altri_debiti);
vero('anagrafica', r0.anagrafica.denominazione === 'PROVA STAMPAGGIO S.R.L.' && r0.anagrafica.ateco === '22.29.09');

// --- 2. forma abbreviata: crediti e debiti aggregati diventano vincoli, nulla viene indovinato ---
const rA = X.leggi(istanza(serie0, 'abbreviato'));
const pA = rA.perAnno[ult];
vero('abbreviato: forma', rA.forma.tipo === 'abbreviato');
vero('abbreviato: controlli', pA.controlli.every(c => c.ok), JSON.stringify(pA.controlli.filter(c => !c.ok)));
vero('abbreviato: vincolo debiti', pA.vincoli.some(w => w.gruppo === 'debiti' && Math.abs(w.totale - (serie0[1].n.debiti_banche_breve + serie0[1].n.debiti_banche_lungo + serie0[1].n.altri_debiti_fin + serie0[1].n.debiti_fornitori + serie0[1].n.debiti_tributari + serie0[1].n.altri_debiti)) < 1));
vero('abbreviato: vincolo crediti', pA.vincoli.some(w => w.gruppo === 'crediti'));
vero('abbreviato: voci da ripartire non inventate', ['debiti_fornitori', 'debiti_banche_breve', 'crediti_clienti', 'altri_crediti'].every(k => !pA.valori[k]));
vero('abbreviato: ammortamenti aggregati letti', Math.abs(pA.valori.ammortamenti.v - serie0[1].n.ammortamenti) < 1 && !!pA.note.ammortamenti);
vero('abbreviato: personale da totale', Math.abs(pA.valori.personale.v - serie0[1].n.personale) < 1);
// applicazione all'azienda: vincoli salvati, poi ripartizione esatta → bilancio completo e quadrato
const imp = X.righeImport(rA, 'prova-abb.xbrl'), azA = { esercizi: {}, storico: [] };
I.applica(azA, imp, imp.nome);
vero('vincoli salvati', azA.esercizi[ult].vincoli && azA.esercizi[ult].vincoli.length === 2);
vero('fonte con elementi XBRL', /XBRL prova-abb\.xbrl · /.test(azA.esercizi[ult].valori.ricavi.fonte));
const nU = serie0[1].n;
['debiti_banche_breve', 'debiti_banche_lungo', 'altri_debiti_fin', 'debiti_fornitori', 'debiti_tributari', 'altri_debiti', 'crediti_clienti', 'altri_crediti']
  .forEach(k => { azA.esercizi[ult].valori[k] = { v: nU[k], origine: 'manuale' }; });
const nA = M.numeri(azA.esercizi[ult]);
vero('abbreviato ripartito: completo', M.mancanti(nA).length === 0, M.mancanti(nA));
vero('abbreviato ripartito: quadra', Math.abs(M.riclassifica(nA).quadratura) < 1);

// --- 3. forma micro -----------------------------------------------------------------------------
const rM = X.leggi(istanza(serie0, 'micro'));
vero('micro: forma e controlli', rM.forma.tipo === 'micro' && rM.perAnno[ult].controlli.every(c => c.ok));

// --- 4. file firmati .p7m ----------------------------------------------------------------------
for (const [nome, buf] of [['p7m DER', p7m(xml0, false)], ['p7m BER a pezzi', p7m(xml0, true)], ['p7m base64', Buffer.from(p7m(xml0, true).toString('base64'))]]) {
  try {
    const r = X.leggi(new Uint8Array(buf));
    vero(nome + ': firmato', r.firmato === true);
    vero(nome + ': stessi valori', r.perAnno[ult].valori.ricavi.v === r0.perAnno[ult].valori.ricavi.v && r.perAnno[ult].controlli.every(c => c.ok));
  } catch (e) { vero(nome, false, e.message); }
}

// --- 5. errori: un totale alterato viene segnalato, le voci assenti non diventano zero ----------
const alterato = xml0.replace(new RegExp('(<itcc-ci:TotaleCostiProduzione contextRef="D_' + ult + '"[^>]*>)(\\d+)'), (m, a, v) => a + (Number(v) + 5000));
const rT = X.leggi(alterato);
vero('totale alterato: controllo fallito', rT.perAnno[ult].controlli.some(c => !c.ok && /Costi della produzione/.test(c.nome)));
vero('totale alterato: avviso', rT.avvisi.some(a => a.tipo === 'rosso'));
const senzaServizi = xml0.replace(new RegExp('<itcc-ci:CostiProduzioneServizi contextRef="D_' + ult + '"[^>]*>\\d+</itcc-ci:CostiProduzioneServizi>'), '');
const rS = X.leggi(senzaServizi);
vero('voce tolta: non diventa zero', !rS.perAnno[ult].valori.servizi && rS.perAnno[ult].controlli.some(c => !c.ok));
let errore = ''; try { X.leggi('<html><body>non è un bilancio</body></html>'); } catch (e) { errore = e.message; }
vero('file non XBRL rifiutato', /xbrl/i.test(errore), errore);
errore = ''; try { X.leggi(new Uint8Array([1, 2, 3, 4, 5])); } catch (e) { errore = e.message; }
vero('file binario qualsiasi rifiutato', errore.length > 0);

console.log('\nTest XBRL superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende simulate esportate e rilette: ' + aziende);
process.exit(ko ? 1 : 0);
