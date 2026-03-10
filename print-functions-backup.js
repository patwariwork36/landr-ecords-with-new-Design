/**
 * ═══════════════════════════════════════════════════════════
 *  BHUMI RECORD PRINT FUNCTIONS  (Lovable-style)
 *  window.open() + window.print() — No external libraries!
 *  Font: Noto Sans Devanagari + Inter (Google Fonts)
 * ═══════════════════════════════════════════════════════════
 *
 *  USAGE in index.html:
 *    printSingleRecord(r)             ← single khasra card
 *    printPortfolio(owner, v, basra)  ← basra portfolio banner
 *
 *  `r` = { kn, bn, v, owner, area, type, nistar }
 *  `records` = global array of all records (loaded from CSV)
 * ═══════════════════════════════════════════════════════════
 */

// ─── Single Khasra Print ─────────────────────────────────
function printSingleRecord(r) {
    const pw = window.open('', '_blank');
    if (!pw) { toast('Popup blocked! Allow popups and try again.', 'error'); return; }

    const sinchType = r.type && !r.type.includes('असिंचित') ? 'badge-green' : 'badge-orange';

    pw.document.write(`<!DOCTYPE html>
<html lang="hi"><head>
<meta charset="UTF-8">
<title>भूमि रिकॉर्ड – ${r.v} – खसरा ${r.kn}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { font-family:'Noto Sans Devanagari','Inter',sans-serif; padding:40px; color:#1a1a1a; background:#fff; }
  h1   { text-align:center; font-size:22px; font-weight:800; margin-bottom:4px; color:#1a1a6e; }
  .subtitle { text-align:center; font-size:14px; color:#555; margin-bottom:28px; }

  /* Badges */
  .badges { display:flex; gap:10px; margin-bottom:22px; flex-wrap:wrap; }
  .badge  { padding:5px 14px; border-radius:20px; font-size:13px; font-weight:700; }
  .badge-green  { background:#d1fae5; color:#065f46; }
  .badge-orange { background:#ffedd5; color:#9a3412; }

  /* Table */
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #e2e8f0; padding:12px 16px; font-size:14px; text-align:left; vertical-align:middle; }
  th { background:#f8fafc; font-weight:700; color:#374151; width:38%; }
  td { font-weight:600; color:#1a1a1a; }

  .footer { margin-top:30px; text-align:center; font-size:11px; color:#aaa; }
  @media print { body { padding:20px; } }
</style></head><body>

<h1>🌾 भूमि रिकॉर्ड विवरण</h1>
<p class="subtitle">${r.v} — खसरा ${r.kn} | दिनांक: ${new Date().toLocaleDateString('hi-IN')}</p>

<div class="badges">
  <span class="badge ${sinchType}">${r.type || '—'}</span>
</div>

<table>
  <tr><th>🏘️ ग्राम</th>              <td>${r.v}</td></tr>
  <tr><th>📋 खसरा नंबर</th>          <td>${r.kn}</td></tr>
  <tr><th>📄 बसरा नंबर</th>           <td>${r.bn}</td></tr>
  <tr><th>👤 भूमिस्वामी</th>          <td>${r.owner}</td></tr>
  <tr><th>📐 क्षेत्रफल (हेक्टेयर)</th><td>${r.area} हे.</td></tr>
  <tr><th>🌱 भूमि का प्रकार</th>      <td>${r.type || '—'}</td></tr>
  ${r.nistar ? `<tr><th>📝 निस्तार विवरण</th><td>${r.nistar}</td></tr>` : ''}
</table>

<p class="footer">भूमि रिकॉर्ड डैशबोर्ड — हल्का 43 एवं 28</p>
<script>window.onload = function() { window.print(); }<\/script>
</body></html>`);
    pw.document.close();
}


// ─── Basra Portfolio Print ───────────────────────────────
function printPortfolio(owner, village, basraNo) {
    const basraRecs = records.filter(r => r.v === village && r.bn === basraNo);
    if (!basraRecs.length) return;

    const totalArea = basraRecs.reduce((s, r) => s + parseFloat(r.area || 0), 0).toFixed(3);
    const sinchai = basraRecs.filter(r => r.type && r.type.includes('सिंचित') && !r.type.includes('असिंचित')).length;
    const asinchai = basraRecs.length - sinchai;

    const rowsHtml = basraRecs.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
        <td style="text-align:center;font-weight:800;">${i + 1}</td>
        <td style="font-weight:800;text-align:center;">${r.kn}</td>
        <td>${r.owner}</td>
        <td style="text-align:center;">${r.area}</td>
        <td>${r.type || '—'}</td>
        <td>${r.nistar || '—'}</td>
      </tr>`).join('');

    const pw = window.open('', '_blank');
    if (!pw) { toast('Popup blocked! Allow popups and try again.', 'error'); return; }

    pw.document.write(`<!DOCTYPE html>
<html lang="hi"><head>
<meta charset="UTF-8">
<title>बसरा पोर्टफोलियो – ${village} – बसरा ${basraNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { font-family:'Noto Sans Devanagari','Inter',sans-serif; padding:30px; color:#1a1a1a; background:#fff; }
  h1   { text-align:center; font-size:22px; font-weight:800; margin-bottom:4px; color:#1a1a6e; }
  .subtitle { text-align:center; font-size:14px; color:#555; margin-bottom:20px; }

  /* Summary strip */
  .summary { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:24px; justify-content:center; }
  .summary-item { background:#f0f4ff; border:1px solid #d1d9ff; border-radius:10px; padding:12px 20px; text-align:center; min-width:100px; }
  .summary-item .val { font-size:22px; font-weight:900; color:#1a1a6e; }
  .summary-item .lbl { font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-top:2px; }
  .green         { background:#d1fae5; border-color:#6ee7b7; }
  .green  .val   { color:#065f46; }
  .orange        { background:#ffedd5; border-color:#fdba74; }
  .orange .val   { color:#9a3412; }

  /* Table */
  table   { width:100%; border-collapse:collapse; font-size:13px; }
  th, td  { border:1px solid #e2e8f0; padding:10px 14px; text-align:left; vertical-align:middle; }
  th      { background:#1a1a6e; color:#fff; font-weight:700; font-size:13px; }

  .footer { margin-top:24px; text-align:center; font-size:11px; color:#aaa; border-top:1px solid #e2e8f0; padding-top:12px; }
  @media print { body { padding:15px; } }
</style></head><body>

<h1>🌾 बसरा पोर्टफोलियो रिपोर्ट</h1>
<p class="subtitle">${village} — बसरा ${basraNo} | भूमिस्वामी: ${owner} | दिनांक: ${new Date().toLocaleDateString('hi-IN')}</p>

<div class="summary">
  <div class="summary-item">          <div class="val">${basraRecs.length}</div><div class="lbl">कुल खसरे</div></div>
  <div class="summary-item">          <div class="val">${totalArea} हे.</div> <div class="lbl">कुल क्षेत्रफल</div></div>
  <div class="summary-item green">   <div class="val">${sinchai}</div>          <div class="lbl">सिंचित</div></div>
  <div class="summary-item orange">  <div class="val">${asinchai}</div>         <div class="lbl">असिंचित</div></div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>खसरा</th>
      <th>भूमिस्वामी</th>
      <th>क्षेत्रफल (हे.)</th>
      <th>भूमि प्रकार</th>
      <th>निस्तार विवरण</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

<p class="footer">
  भूमि रिकॉर्ड डैशबोर्ड — हल्का 43 एवं 28 |
  कम्प्यूटर जनित रिकॉर्ड — सत्यापन हेतु पटवारी कार्यालय से संपर्क करें
</p>
<script>window.onload = function() { window.print(); }<\/script>
</body></html>`);
    pw.document.close();
}
