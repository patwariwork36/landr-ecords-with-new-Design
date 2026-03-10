
        // Direct URL (kept for reference; fetching via proxy chain below)
        // const CSV_URL = "...";

        let records = [];
        let currentTab = 'khasra';

        // ── Halka Mapping ──────────────────────────────
        const HALKA_MAP = {
            'गबौद': 43, 'तिल्दा': 43,
            'छड़िया': 28, 'छेरकापुर': 28
        };
        function getHalka(village) {
            const h = HALKA_MAP[village];
            return h ? `हल्का ${h}` : '';
        }

        // ── Toast ──────────────────────────────────────
        function toast(msg, type = 'success') {
            const bg = { success: 'linear-gradient(to right,#059669,#047857)', error: 'linear-gradient(to right,#dc2626,#b91c1c)', info: 'linear-gradient(to right,#2563eb,#1a1a6e)' };
            Toastify({ text: msg, duration: 3500, gravity: 'top', position: 'right', style: { background: bg[type] || bg.info, borderRadius: '10px', fontWeight: '700', fontSize: '14px' } }).showToast();
        }

        // ── CSV Loader ─────────────────────────────────────────────
        const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7w0RI9RMbD3vx841C6CHzFyHwwbX2L5zyhjabc2ov7AvR7OWzJfXgvbiPvV6oXvhJZj5RCmcOzq2r/pub?gid=1832973148&single=true&output=csv";

        function processCSVResults(results) {
            if (!results.data || results.data.length === 0) return false;
            records = results.data.map((o, i) => {
                // owner: raw CSV value (full, for display in khasra/basra results)
                let ownerRaw = o['भूमिस्वामी का नाम'] || 'अज्ञात';
                // ownerKey: cleaned single-line (normalized spaces, for search & escJS)
                let ownerKey = ownerRaw.replace(/\r/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                // ownerNames: all individual names extracted (for naam search datalist & matching)
                const nameMatches = [...ownerRaw.matchAll(/नाम\s*[-–]\s*([^\n\r]+)/g)];
                let ownerNames = nameMatches.map(m => m[1].trim()).filter(Boolean);
                if (ownerNames.length === 0) {
                    // Fallback: use first line without leading (1) prefix
                    const fallback = ownerRaw.split(/\r?\n/)[0].replace(/^\(\d+\)/, '').trim();
                    if (fallback) ownerNames = [fallback];
                }

                let v = o['ग्राम'] || '';
                if (v === 'गबौद' || v === 'तिल्दा') v += ' (हल्का 43)';
                else if (v === 'छड़िया' || v === 'छेरकापुर') v += ' (हल्का 28)';

                return {
                    id: i + 1,
                    v: v,
                    kn: o['खसरा नंबर'] || '',
                    bn: o['बसरा नंबर'] || '',
                    owner: ownerRaw || 'अज्ञात',
                    ownerKey: ownerKey || 'अज्ञात',
                    ownerNames: ownerNames.length ? ownerNames : ['अज्ञात'],
                    area: parseFloat(o['क्षेत्रफल'] || 0).toFixed(3),
                    type: o['सिंचित / असिंचित'] || '',
                    nistar: o['निस्तार पत्रक विवरण'] || '',
                    charai: o['चराई भूमि है ?'] || '',
                    ceiling: o['सीलिंग भूमि है ?'] || ''
                };
            }).filter(r => r.v && r.kn);
            return records.length > 0;
        }

        function loadData() {
            const badge = document.getElementById('recordCountBadge');
            badge.textContent = '⏳ डेटा लोड हो रहा है...';

            function onSuccess() {
                fillVillages();
                badge.textContent = `✅ ${records.length} रिकॉर्ड लोड`;
                toast(`${records.length} रिकॉर्ड सफलतापूर्वक लोड हुए`, 'success');
            }
            function onError(msg) {
                badge.innerHTML = `❌ लोड विफल &nbsp;<button onclick="loadData()" style="background:#1a1a6e;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;font-weight:700;">🔄 पुनः प्रयास</button>`;
                toast(msg || 'नेटवर्क त्रुटि — कृपया इंटरनेट जांचें', 'error');
            }

            // CORS-safe proxy chain for file:// protocol support
            function tryParse(csvText) {
                const r = Papa.parse(csvText, { header: true, skipEmptyLines: 'greedy' });
                return processCSVResults(r);
            }

            const PROXY1 = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(SHEET_URL);
            const PROXY2 = 'https://corsproxy.io/?' + encodeURIComponent(SHEET_URL);

            // Step 1: Try allorigins.win proxy
            fetch(PROXY1)
                .then(res => { if (!res.ok) throw new Error('p1'); return res.text(); })
                .then(csv => { if (tryParse(csv)) onSuccess(); else throw new Error('parse'); })
                .catch(() => {
                    // Step 2: Try corsproxy.io
                    fetch(PROXY2)
                        .then(res => { if (!res.ok) throw new Error('p2'); return res.text(); })
                        .then(csv => { if (tryParse(csv)) onSuccess(); else throw new Error('parse'); })
                        .catch(() => {
                            // Step 3: PapaParse direct download (last resort)
                            Papa.parse(SHEET_URL, {
                                download: true, header: true, worker: false,
                                skipEmptyLines: 'greedy',
                                complete: function (results) {
                                    if (processCSVResults(results)) onSuccess();
                                    else onError('डेटा लोड विफल — "पुनः प्रयास" बटन दबाएं');
                                },
                                error: function () { onError('नेटवर्क त्रुटि — कृपया इंटरनेट जांचें'); }
                            });
                        });
                });
        }

        function fillVillages() {
            const desiredOrder = ['छेरकापुर (हल्का 28)', 'छड़िया (हल्का 28)', 'तिल्दा (हल्का 43)', 'गबौद (हल्का 43)'];
            const sel = document.getElementById('villageInput');
            const vals = [...new Set(records.map(r => r.v).filter(Boolean))].sort((a, b) => {
                const idxA = desiredOrder.indexOf(a);
                const idxB = desiredOrder.indexOf(b);
                return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
            });
            while (sel.options.length > 1) sel.remove(1);
            vals.forEach(v => { const o = document.createElement('option'); o.value = o.text = v; sel.appendChild(o); });
        }

        // ── Village change → fill basra & farmers ───────────────
        document.getElementById('villageInput').addEventListener('change', function () {
            const v = this.value;

            // 1. Populate Basra
            const sel = document.getElementById('basraVal');
            const basras = [...new Set(records.filter(r => r.v === v).map(r => r.bn).filter(Boolean))].sort((a, b) => {
                const [a1, a2 = '0'] = a.split('/'); const [b1, b2 = '0'] = b.split('/');
                return (parseInt(a1) - parseInt(b1)) || (parseInt(a2) - parseInt(b2));
            });
            sel.innerHTML = '<option value="" disabled selected>— बसरा चुनें —</option>';
            basras.forEach(b => { const o = document.createElement('option'); o.value = o.text = b; sel.appendChild(o); });
            sel.disabled = false;
            sel.classList.remove('form-select');
            sel.className = 'form-select';

            // 2. Populate Farmer Names
            const farmerList = document.getElementById('farmerList');
            const namInput = document.getElementById('namVal');
            if (farmerList && namInput) {
                // Collect ALL individual owner names across all records for this village
                const names = [...new Set(
                    records.filter(r => r.v === v).flatMap(r => r.ownerNames).filter(Boolean)
                )].sort((a, b) => a.localeCompare(b, 'hi'));
                farmerList.innerHTML = '';
                names.forEach(n => { const o = document.createElement('option'); o.value = n; farmerList.appendChild(o); });
                namInput.disabled = false;
                namInput.placeholder = 'नाम टाइप करें या चुनें';
            }

            if (currentTab === 'basra') toast(`${basras.length} बसरा उपलब्ध`, 'info');
            else if (currentTab === 'nam') toast(`${farmerList.options.length} भूमिस्वामी उपलब्ध`, 'info');
        });

        // ── Tab Switch ────────────────────────────────
        function switchTab(tab) {
            currentTab = tab;
            const isSearch = ['khasra', 'basra', 'nam'].includes(tab);
            const isStat = tab === 'statistics';
            const isGov = tab === 'gov';

            // Show/hide search form
            const searchFormWrapper = document.getElementById('searchForm').closest('.glass-card');
            if (searchFormWrapper) searchFormWrapper.style.display = isSearch ? '' : 'none';

            document.getElementById('khasraGroup').style.display = tab === 'khasra' ? '' : 'none';
            document.getElementById('basraGroup').style.display = tab === 'basra' ? '' : 'none';
            document.getElementById('namGroup').style.display = tab === 'nam' ? '' : 'none';

            ['khasra', 'basra', 'nam', 'statistics', 'gov'].forEach(t => {
                const elDesktop = document.getElementById('tab-' + t);
                const elMobile = document.getElementById('mob-tab-' + t);
                const elBottom = document.getElementById('bot-tab-' + t);
                
                if (elDesktop) elDesktop.className = 'nav-btn' + (tab === t ? ' active' : '');
                if (elMobile) elMobile.className = 'nav-btn' + (tab === t ? ' active' : '');
                if (elBottom) elBottom.className = 'bottom-nav-btn' + (tab === t ? ' active' : '');
            });

            // Show/hide panels
            document.getElementById('resultsDiv').innerHTML = '';
            document.getElementById('emptyDiv').style.display = 'none';
            document.getElementById('statisticsDiv').style.display = isStat ? '' : 'none';
            document.getElementById('govDiv').style.display = isGov ? '' : 'none';

            if (isStat) { showStatistics(); return; }
            if (isGov) { showGovRecords(); return; }

            // If village already chosen, re-populate basra / farmerList
            if (tab === 'basra' || tab === 'nam') {
                const v = document.getElementById('villageInput').value;
                if (v) document.getElementById('villageInput').dispatchEvent(new Event('change'));
            }
        }



        // ── Search ────────────────────────────────────
        function handleSearch(e) {
            e.preventDefault();
            const v = document.getElementById('villageInput').value;
            let val = '';

            if (currentTab === 'khasra') val = document.getElementById('khasraVal').value.trim();
            else if (currentTab === 'basra') val = document.getElementById('basraVal').value;
            else if (currentTab === 'nam') val = document.getElementById('namVal').value.trim();

            if (!v) { toast('कृपया ग्राम चुनें', 'error'); return; }
            if (!val) {
                const lbl = currentTab === 'khasra' ? 'खसरा नंबर' : currentTab === 'basra' ? 'बसरा नंबर' : 'भूमिस्वामी का नाम';
                toast(`कृपया ${lbl} चुनें/दर्ज करें`, 'error');
                return;
            }

            setLoading(true);
            setTimeout(() => {
                let found = [];
                if (currentTab === 'khasra') found = records.filter(r => r.v === v && r.kn == val);
                else if (currentTab === 'basra') found = records.filter(r => r.v === v && r.bn == val);
                else if (currentTab === 'nam') {
                    const nval = val.replace(/\s+/g, ' ').trim();
                    // Step 1: exact name match
                    const nameMatched = records.filter(r => r.v === v && r.ownerNames.includes(nval));
                    // Step 2: collect basra numbers from matched records
                    const basraSet = new Set(nameMatched.map(r => r.bn).filter(Boolean));
                    // Step 3: show ALL khasras of those basras
                    found = basraSet.size > 0
                        ? records.filter(r => r.v === v && basraSet.has(r.bn))
                        : nameMatched; // if no basra, just show name-matched records
                }

                setLoading(false);
                renderResults(found, v, val);
            }, 60);
        }

        function setLoading(on) {
            document.getElementById('loadingDiv').style.display = on ? '' : 'none';
            document.getElementById('searchBtn').disabled = on;
            document.getElementById('btnLabel').textContent = on ? 'खोज रहे हैं...' : 'खोजें';
        }

        // ── Render ────────────────────────────────────
        function renderResults(found, v, val) {
            const res = document.getElementById('resultsDiv');
            const emp = document.getElementById('emptyDiv');
            res.innerHTML = '';

            if (!found.length) {
                emp.style.display = '';
                toast('कोई रिकॉर्ड नहीं मिला', 'error');
                return;
            }
            emp.style.display = 'none';
            toast(`${found.length} रिकॉर्ड मिले`, 'success');

            // Portfolio banner for basra or nam
            if (currentTab === 'basra' || currentTab === 'nam') {
                const totalArea = found.reduce((s, r) => s + parseFloat(r.area), 0).toFixed(3);
                const banner = document.createElement('div');
                banner.className = 'portfolio-banner';
                banner.style.marginBottom = '24px';

                const subtitle = currentTab === 'basra'
                    ? `ग्राम: ${v} &nbsp;|&nbsp; बसरा: ${val}`
                    : `ग्राम: ${v} &nbsp;|&nbsp; भूमिस्वामी: ${val}`;

                const ownerName = currentTab === 'basra' ? found[0].owner : val;

                const printFn = currentTab === 'basra'
                    ? `printPortfolio('${escJS(ownerName)}','${escJS(v)}','${escJS(val)}')`
                    : `printFarmerPortfolio('${escJS(ownerName)}','${escJS(v)}')`;

                banner.innerHTML = `
        <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-size:11px; font-weight:700; opacity:0.6; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">भूमिस्वामी पोर्टफोलियो</div>
            <div style="font-size:22px; font-weight:900; line-height:1.1;">${ownerName}</div>
            <div style="margin-top:6px; opacity:0.75; font-size:14px;">${subtitle}</div>
          </div>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <div class="pf-stat">
              <div class="pf-stat-label">कुल खसरा</div>
              <div class="pf-stat-val">${found.length}</div>
            </div>
            <div class="pf-stat">
              <div class="pf-stat-label">कुल क्षेत्रफल</div>
              <div class="pf-stat-val">${totalArea} <span style="font-size:14px;font-weight:600;opacity:0.7;">हे.</span></div>
            </div>
          </div>
          <button onclick="${printFn}" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:10px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;align-self:center;">🖨 Portfolio Print</button>
          
        </div>`;
                res.appendChild(banner);
            }

            // Cards grid
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:20px;';
            found.forEach((r, idx) => {
                const card = document.createElement('div');
                card.className = 'result-card';
                card.style.animationDelay = `${idx * 0.06}s`;
                const hdrClass = currentTab === 'nam' ? 'card-header-khasra' : `card-header-${currentTab}`;
                const typeBadgeClass = r.type.includes('असिंचित') ? 'badge-warning' : 'badge-success';
                card.innerHTML = `
        <div class="${hdrClass}" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="font-size:10px; font-weight:700; color:rgba(255,255,255,0.65); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">
              ${currentTab === 'khasra' ? 'खसरा नंबर' : currentTab === 'basra' ? 'बसरा नंबर' : 'खसरा नंबर'}
            </div>
            <div class="card-kn" style="color:#fff;">${currentTab === 'basra' ? r.bn : r.kn}</div>
            <div style="font-size:13px; color:rgba(255,255,255,0.7); margin-top:4px; font-weight:600;">${r.v}${getHalka(r.v) ? ` &nbsp;<span style="background:rgba(255,255,255,0.18);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:800;letter-spacing:0.05em;">${getHalka(r.v)}</span>` : ''}</div>
          </div>
          <button onclick="event.stopPropagation();printSingleRecord(${JSON.stringify(r).replace(/"/g, '&quot;')})" class="nav-btn" style="background:rgba(255,255,255,0.1); padding:6px 14px; border:1px solid rgba(255,255,255,0.2); color:#fff;">🖨 Print</button>
        </div>
        <div style="padding:18px 20px; display:flex; flex-direction:column; gap:14px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div class="stat-chip">
              <div class="stat-chip-label">खसरा नं.</div>
              <div class="stat-chip-val">${r.kn}</div>
            </div>
            <div class="stat-chip">
              <div class="stat-chip-label">बसरा नं.</div>
              <div class="stat-chip-val">${r.bn}</div>
            </div>
          </div>
          <div style="border-top:1px solid var(--border); padding-top:12px;">
            <div style="font-size:10px; font-weight:700; color:var(--muted-fg); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:6px;">भूमिस्वामी</div>
            <div style="font-size:14px; font-weight:700; color:var(--fg); line-height:1.4;">${r.owner}</div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; border-top:1px solid var(--border); padding-top:12px;">
            <div>
              <div style="font-size:10px; font-weight:700; color:var(--muted-fg); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:4px;">क्षेत्रफल (हे.)</div>
              <div style="font-size:18px; font-weight:900; color:var(--fg);">${r.area}</div>
            </div>
            <div>
              <div style="font-size:10px; font-weight:700; color:var(--muted-fg); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:6px;">प्रकार</div>
              <span class="${typeBadgeClass}">${r.type || '—'}</span>
            </div>
          </div>
          ${(r.charai || r.ceiling) ? `
          <div style="display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid var(--border); padding-top:12px;">
            ${r.charai ? `<span class="badge-warning">🌿 चराई: ${r.charai}</span>` : ''}
            ${r.ceiling ? `<span class="badge-error">⚖️ सीलिंग: ${r.ceiling}</span>` : ''}
          </div>` : ''}
          ${r.nistar ? `
          <div style="background:var(--muted); border:1px solid var(--border); border-radius:10px; padding:10px 14px; border-top:1px solid var(--border); padding-top:12px;">
            <div style="font-size:10px; font-weight:700; color:var(--warning); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:6px;">निस्तार विवरण</div>
            <div style="font-size:14px; font-weight:700; color:var(--fg); line-height:1.5; font-family:'Noto Sans Devanagari',Arial,sans-serif;">${r.nistar}</div>
          </div>` : ''}
        </div>`;
                grid.appendChild(card);
            });
            res.appendChild(grid);
        }

        function escJS(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, ' '); }

        // ══════════════════════════════════════════════
        // �️ PRINT / PDF  (Lovable-style: window.open + window.print)
        // ══════════════════════════════════════════════

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
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: hsl(224, 71%, 4%);
  --fg: hsl(213, 31%, 91%);
  --card: hsl(224, 60%, 7%);
  --primary: hsl(230, 70%, 60%);
  --primary-h: 230;
  --muted: hsl(220, 45%, 12%);
  --muted-fg: hsl(215, 20%, 55%);
  --border: hsl(220, 40%, 18%);
  --accent: hsl(262, 60%, 55%);
  --success: hsl(142, 70%, 40%);
  --warning: hsl(38, 85%, 50%);
  --info: hsl(200, 75%, 50%);
  --gradient-primary: linear-gradient(135deg, hsl(230, 70%, 55%) 0%, hsl(262, 60%, 50%) 100%);
  --glass-bg: hsla(224, 60%, 10%, 0.7);
  --glass-border: hsla(213, 31%, 91%, 0.08);
  --glass-shadow: 0 8px 32px hsla(224, 71%, 4%, 0.6);
  --shadow-glow: 0 0 40px hsla(230, 70%, 60%, 0.25);
  --shadow-card: 0 4px 24px hsla(224, 71%, 4%, 0.5);
}

body {
  font-family: 'Noto Sans Devanagari', 'Inter', sans-serif;
  background: linear-gradient(135deg, hsl(224, 71%, 4%) 0%, hsl(240, 60%, 8%) 50%, hsl(262, 50%, 10%) 100%);
  min-height: 100vh;
  color: var(--fg);
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--muted); }
::-webkit-scrollbar-thumb { background: hsla(230, 70%, 60%, 0.5); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--primary); }

/* Utilities */
.glass-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(20px);
}

.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.btn-primary {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  color: white;
  font-weight: 600;
  border-radius: 12px;
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  font-family: inherit;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 60px hsla(230, 70%, 60%, 0.4);
}

.btn-primary:active { transform: translateY(0); }

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.stat-card {
  background: linear-gradient(135deg, hsl(224, 60%, 9%) 0%, hsl(230, 55%, 12%) 100%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-glow);
  border-color: hsla(230, 70%, 60%, 0.3);
}

.badge-success { background: hsla(142, 70%, 40%, 0.2); color: hsl(142, 70%, 65%); border: 1px solid hsla(142, 70%, 40%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-warning { background: hsla(38, 85%, 50%, 0.2); color: hsl(38, 85%, 70%); border: 1px solid hsla(38, 85%, 50%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-error { background: hsla(0, 72%, 51%, 0.2); color: hsl(0, 72%, 75%); border: 1px solid hsla(0, 72%, 51%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-info { background: hsla(200, 75%, 50%, 0.2); color: hsl(200, 75%, 75%); border: 1px solid hsla(200, 75%, 50%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }

.input-glass {
  background: hsla(220, 40%, 10%, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--fg);
  border-radius: 12px;
  padding: 12px 16px;
  width: 100%;
  transition: all 0.2s;
  outline: none;
  font-family: inherit;
  font-size: 14px;
}

.input-glass:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}

.input-glass:disabled {
  background: hsla(220, 40%, 10%, 0.4);
  color: var(--muted-fg);
  cursor: not-allowed;
}

/* Header */
header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: hsla(224, 65%, 5%, 0.85);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(20px);
}

.header-inner {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 16px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.logo-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  flex-shrink: 0;
}

.logo-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--fg);
  line-height: 1.2;
}

.logo-sub {
  font-size: 13px;
  color: var(--muted-fg);
  font-weight: 600;
  font-family: serif;
}

nav.desktop {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  color: var(--muted-fg);
  background: transparent;
}

.nav-btn:hover:not(.active) {
  background: hsla(220, 50%, 15%, 0.6);
  color: var(--fg);
}

.nav-btn.active {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  color: white;
}

.menu-btn {
  display: none;
  padding: 8px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  font-size: 20px;
}

.mobile-nav {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: hsl(224, 65%, 5%);
  border-top: 1px solid var(--border);
}

.mobile-nav .nav-btn {
  width: 100%;
  text-align: left;
  justify-content: flex-start;
}

/* Bottom Nav */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: hsla(224, 65%, 5%, 0.95);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(20px);
}

.bottom-nav-inner {
  display: flex;
}

.bottom-nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  font-size: 11px;
  font-weight: 500;
  color: var(--muted-fg);
}

.bottom-nav-btn.active {
  color: var(--primary);
}


/* Form Labels and Select */
.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--muted-fg);
  margin-bottom: 8px;
}

.form-select, .form-input {
  background: hsla(220, 40%, 10%, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--fg);
  border-radius: 12px;
  padding: 14px 18px;
  width: 100%;
  font-size: 15px;
  font-weight: 500;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
}

.form-select:focus, .form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}

.form-select:disabled, .form-input:disabled {
  background: hsla(220, 40%, 10%, 0.4);
  color: var(--muted-fg);
  cursor: not-allowed;
}

.select-wrap {
  position: relative;
}
.select-wrap::after {
  content: '▼';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-fg);
  font-size: 12px;
  pointer-events: none;
}

/* Spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid hsla(230, 70%, 60%, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Empty State */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
  background: hsla(224, 60%, 10%, 0.5);
  border: 1px dashed var(--border);
  border-radius: 24px;
  animation: fadeUp 0.4s ease;
}

/* Result Cards Layout Grid */
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

/* Individual Result Card mimicking the new design's glass-card inside */
.result-card, .dash-section {
  background: hsla(220, 40%, 10%, 0.6);
  border-radius: 20px;
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: all 0.3s;
  animation: fadeUp 0.4s ease both;
}
.result-card:hover { border-color: hsla(230, 70%, 60%, 0.3); box-shadow: var(--shadow-glow); transform: translateY(-3px); }

.card-header-khasra { background: var(--gradient-primary); }
.card-header-basra { background: linear-gradient(135deg, hsl(142, 60%, 45%), hsl(142, 70%, 35%)); }
.card-header-nam { background: linear-gradient(135deg, hsl(280, 60%, 55%), hsl(280, 70%, 45%)); }

.card-kn {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  color: #fff;
}

.stat-chip {
  background: hsla(224, 60%, 15%, 0.6);
  border-radius: 12px;
  padding: 12px 14px;
  text-align: center;
  border: 1px solid var(--border);
}

.stat-chip-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-fg);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-chip-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--fg);
  margin-top: 4px;
}

/* Portfolio Banner */
.portfolio-banner {
  background: var(--gradient-primary);
  border-radius: 24px;
  color: #fff;
  padding: 24px;
  box-shadow: var(--shadow-glow);
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.4s ease both;
}
.portfolio-banner::before {
  content: '';
  position: absolute;
  top: -60%;
  right: -10%;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%);
  pointer-events: none;
}
.pf-stat {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  padding: 12px 18px;
  text-align: center;
}
.pf-stat-label { font-size: 11px; font-weight: 700; opacity: 0.8; text-transform: uppercase; }
.pf-stat-val { font-size: 24px; font-weight: 800; margin-top: 4px; }


/* Dashboard Counters and Charts */
.dash-counter {
  animation: fadeUp 0.6s ease both;
}
.dash-section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--fg);
  margin-bottom: 16px;
}
.dash-search-wrap {
  position: relative;
  margin-bottom: 24px;
}
.dash-search-input {
  width: 100%;
  padding: 14px 18px 14px 44px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: var(--fg);
  background: hsla(220, 40%, 10%, 0.8);
  outline: none;
  transition: all 0.2s;
}
.dash-search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}
.dash-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-fg);
  pointer-events: none;
}

.bar-chart-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.bar-label {
  width: 120px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bar-track {
  flex: 1;
  height: 24px;
  background: hsla(220, 40%, 15%, 0.8);
  border-radius: 6px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 1s cubic-bezier(.4, 0, .2, 1);
}
.bar-val {
  width: 60px;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted-fg);
  text-align: right;
}
.lb-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: hsla(220, 40%, 15%, 0.4);
  border: 1px solid var(--border);
  transition: background 0.2s;
  margin-bottom: 10px;
  animation: fadeUp 0.4s ease both;
}
.lb-row:hover { background: hsla(220, 40%, 20%, 0.6); }
.lb-rank {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--gradient-primary);
  color: #fff; font-size: 15px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.lb-rank.gold { background: linear-gradient(135deg, hsl(38, 90%, 55%), hsl(38, 90%, 45%)); }
.lb-rank.silver { background: linear-gradient(135deg, hsl(220, 20%, 65%), hsl(220, 20%, 50%)); }
.lb-rank.bronze { background: linear-gradient(135deg, hsl(25, 75%, 50%), hsl(25, 75%, 35%)); }
.lb-name {
  flex: 1; font-size: 15px; font-weight: 600; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lb-stat-val { font-size: 15px; font-weight: 800; color: var(--primary); }
.lb-stat-lbl { font-size: 11px; font-weight: 600; color: var(--muted-fg); }


@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeUp 0.4s ease both; }

@media (max-width: 768px) {
  nav.desktop { display: none; }
  .menu-btn { display: block; }
  .bottom-nav { display: block; }
  main { padding-bottom: 80px; }
  .dash-counter { padding: 14px; }
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .results-grid { grid-template-columns: 1fr; }
}
@media (min-width: 769px) {
  .mobile-nav { display: none !important; }
}

</style></head><body>
<h1>🌾 भूमि रिकॉर्ड विवरण</h1>
<p class="subtitle">${r.v}${getHalka(r.v) ? ' (' + getHalka(r.v) + ')' : ''} — खसरा ${r.kn} | दिनांक: ${new Date().toLocaleDateString('hi-IN')}</p>
<div class="badges">
  <span class="badge ${sinchType}">${r.type || '—'}</span>
</div>
<table>
  <tr><th>🏘️ ग्राम</th><td>${r.v}${getHalka(r.v) ? ' &nbsp;<strong>(' + getHalka(r.v) + ')</strong>' : ''}</td></tr>
  <tr><th>📋 खसरा नंबर</th><td>${r.kn}</td></tr>
  <tr><th>📄 बसरा नंबर</th><td>${r.bn}</td></tr>
  <tr><th>👤 भूमिस्वामी</th><td>${r.owner}</td></tr>
  <tr><th>📐 क्षेत्रफल (हेक्टेयर)</th><td>${r.area} हे.</td></tr>
  <tr><th>🌱 भूमि का प्रकार</th><td>${r.type || '—'}</td></tr>
  ${r.charai ? `<tr><th>🌿 चराई भूमि</th><td>${r.charai}</td></tr>` : ''}
  ${r.ceiling ? `<tr><th>⚖️ सीलिंग भूमि</th><td>${r.ceiling}</td></tr>` : ''}
  ${r.nistar ? `<tr><th>📝 निस्तार विवरण</th><td>${r.nistar}</td></tr>` : ''}
</table>
<p class="footer">भूमि रिकॉर्ड डैशबोर्ड — हल्का 43 एवं 28</p>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
            pw.document.close();
        }

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
                <td>${r.charai || '—'}</td>
                <td>${r.ceiling || '—'}</td>
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
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: hsl(224, 71%, 4%);
  --fg: hsl(213, 31%, 91%);
  --card: hsl(224, 60%, 7%);
  --primary: hsl(230, 70%, 60%);
  --primary-h: 230;
  --muted: hsl(220, 45%, 12%);
  --muted-fg: hsl(215, 20%, 55%);
  --border: hsl(220, 40%, 18%);
  --accent: hsl(262, 60%, 55%);
  --success: hsl(142, 70%, 40%);
  --warning: hsl(38, 85%, 50%);
  --info: hsl(200, 75%, 50%);
  --gradient-primary: linear-gradient(135deg, hsl(230, 70%, 55%) 0%, hsl(262, 60%, 50%) 100%);
  --glass-bg: hsla(224, 60%, 10%, 0.7);
  --glass-border: hsla(213, 31%, 91%, 0.08);
  --glass-shadow: 0 8px 32px hsla(224, 71%, 4%, 0.6);
  --shadow-glow: 0 0 40px hsla(230, 70%, 60%, 0.25);
  --shadow-card: 0 4px 24px hsla(224, 71%, 4%, 0.5);
}

body {
  font-family: 'Noto Sans Devanagari', 'Inter', sans-serif;
  background: linear-gradient(135deg, hsl(224, 71%, 4%) 0%, hsl(240, 60%, 8%) 50%, hsl(262, 50%, 10%) 100%);
  min-height: 100vh;
  color: var(--fg);
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--muted); }
::-webkit-scrollbar-thumb { background: hsla(230, 70%, 60%, 0.5); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--primary); }

/* Utilities */
.glass-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(20px);
}

.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.btn-primary {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  color: white;
  font-weight: 600;
  border-radius: 12px;
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  font-family: inherit;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 60px hsla(230, 70%, 60%, 0.4);
}

.btn-primary:active { transform: translateY(0); }

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.stat-card {
  background: linear-gradient(135deg, hsl(224, 60%, 9%) 0%, hsl(230, 55%, 12%) 100%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-glow);
  border-color: hsla(230, 70%, 60%, 0.3);
}

.badge-success { background: hsla(142, 70%, 40%, 0.2); color: hsl(142, 70%, 65%); border: 1px solid hsla(142, 70%, 40%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-warning { background: hsla(38, 85%, 50%, 0.2); color: hsl(38, 85%, 70%); border: 1px solid hsla(38, 85%, 50%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-error { background: hsla(0, 72%, 51%, 0.2); color: hsl(0, 72%, 75%); border: 1px solid hsla(0, 72%, 51%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-info { background: hsla(200, 75%, 50%, 0.2); color: hsl(200, 75%, 75%); border: 1px solid hsla(200, 75%, 50%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }

.input-glass {
  background: hsla(220, 40%, 10%, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--fg);
  border-radius: 12px;
  padding: 12px 16px;
  width: 100%;
  transition: all 0.2s;
  outline: none;
  font-family: inherit;
  font-size: 14px;
}

.input-glass:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}

.input-glass:disabled {
  background: hsla(220, 40%, 10%, 0.4);
  color: var(--muted-fg);
  cursor: not-allowed;
}

/* Header */
header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: hsla(224, 65%, 5%, 0.85);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(20px);
}

.header-inner {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 16px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.logo-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  flex-shrink: 0;
}

.logo-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--fg);
  line-height: 1.2;
}

.logo-sub {
  font-size: 13px;
  color: var(--muted-fg);
  font-weight: 600;
  font-family: serif;
}

nav.desktop {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  color: var(--muted-fg);
  background: transparent;
}

.nav-btn:hover:not(.active) {
  background: hsla(220, 50%, 15%, 0.6);
  color: var(--fg);
}

.nav-btn.active {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  color: white;
}

.menu-btn {
  display: none;
  padding: 8px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  font-size: 20px;
}

.mobile-nav {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: hsl(224, 65%, 5%);
  border-top: 1px solid var(--border);
}

.mobile-nav .nav-btn {
  width: 100%;
  text-align: left;
  justify-content: flex-start;
}

/* Bottom Nav */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: hsla(224, 65%, 5%, 0.95);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(20px);
}

.bottom-nav-inner {
  display: flex;
}

.bottom-nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  font-size: 11px;
  font-weight: 500;
  color: var(--muted-fg);
}

.bottom-nav-btn.active {
  color: var(--primary);
}


/* Form Labels and Select */
.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--muted-fg);
  margin-bottom: 8px;
}

.form-select, .form-input {
  background: hsla(220, 40%, 10%, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--fg);
  border-radius: 12px;
  padding: 14px 18px;
  width: 100%;
  font-size: 15px;
  font-weight: 500;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
}

.form-select:focus, .form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}

.form-select:disabled, .form-input:disabled {
  background: hsla(220, 40%, 10%, 0.4);
  color: var(--muted-fg);
  cursor: not-allowed;
}

.select-wrap {
  position: relative;
}
.select-wrap::after {
  content: '▼';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-fg);
  font-size: 12px;
  pointer-events: none;
}

/* Spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid hsla(230, 70%, 60%, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Empty State */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
  background: hsla(224, 60%, 10%, 0.5);
  border: 1px dashed var(--border);
  border-radius: 24px;
  animation: fadeUp 0.4s ease;
}

/* Result Cards Layout Grid */
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

/* Individual Result Card mimicking the new design's glass-card inside */
.result-card, .dash-section {
  background: hsla(220, 40%, 10%, 0.6);
  border-radius: 20px;
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: all 0.3s;
  animation: fadeUp 0.4s ease both;
}
.result-card:hover { border-color: hsla(230, 70%, 60%, 0.3); box-shadow: var(--shadow-glow); transform: translateY(-3px); }

.card-header-khasra { background: var(--gradient-primary); }
.card-header-basra { background: linear-gradient(135deg, hsl(142, 60%, 45%), hsl(142, 70%, 35%)); }
.card-header-nam { background: linear-gradient(135deg, hsl(280, 60%, 55%), hsl(280, 70%, 45%)); }

.card-kn {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  color: #fff;
}

.stat-chip {
  background: hsla(224, 60%, 15%, 0.6);
  border-radius: 12px;
  padding: 12px 14px;
  text-align: center;
  border: 1px solid var(--border);
}

.stat-chip-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-fg);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-chip-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--fg);
  margin-top: 4px;
}

/* Portfolio Banner */
.portfolio-banner {
  background: var(--gradient-primary);
  border-radius: 24px;
  color: #fff;
  padding: 24px;
  box-shadow: var(--shadow-glow);
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.4s ease both;
}
.portfolio-banner::before {
  content: '';
  position: absolute;
  top: -60%;
  right: -10%;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%);
  pointer-events: none;
}
.pf-stat {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  padding: 12px 18px;
  text-align: center;
}
.pf-stat-label { font-size: 11px; font-weight: 700; opacity: 0.8; text-transform: uppercase; }
.pf-stat-val { font-size: 24px; font-weight: 800; margin-top: 4px; }


/* Dashboard Counters and Charts */
.dash-counter {
  animation: fadeUp 0.6s ease both;
}
.dash-section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--fg);
  margin-bottom: 16px;
}
.dash-search-wrap {
  position: relative;
  margin-bottom: 24px;
}
.dash-search-input {
  width: 100%;
  padding: 14px 18px 14px 44px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: var(--fg);
  background: hsla(220, 40%, 10%, 0.8);
  outline: none;
  transition: all 0.2s;
}
.dash-search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}
.dash-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-fg);
  pointer-events: none;
}

.bar-chart-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.bar-label {
  width: 120px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bar-track {
  flex: 1;
  height: 24px;
  background: hsla(220, 40%, 15%, 0.8);
  border-radius: 6px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 1s cubic-bezier(.4, 0, .2, 1);
}
.bar-val {
  width: 60px;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted-fg);
  text-align: right;
}
.lb-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: hsla(220, 40%, 15%, 0.4);
  border: 1px solid var(--border);
  transition: background 0.2s;
  margin-bottom: 10px;
  animation: fadeUp 0.4s ease both;
}
.lb-row:hover { background: hsla(220, 40%, 20%, 0.6); }
.lb-rank {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--gradient-primary);
  color: #fff; font-size: 15px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.lb-rank.gold { background: linear-gradient(135deg, hsl(38, 90%, 55%), hsl(38, 90%, 45%)); }
.lb-rank.silver { background: linear-gradient(135deg, hsl(220, 20%, 65%), hsl(220, 20%, 50%)); }
.lb-rank.bronze { background: linear-gradient(135deg, hsl(25, 75%, 50%), hsl(25, 75%, 35%)); }
.lb-name {
  flex: 1; font-size: 15px; font-weight: 600; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lb-stat-val { font-size: 15px; font-weight: 800; color: var(--primary); }
.lb-stat-lbl { font-size: 11px; font-weight: 600; color: var(--muted-fg); }


@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeUp 0.4s ease both; }

@media (max-width: 768px) {
  nav.desktop { display: none; }
  .menu-btn { display: block; }
  .bottom-nav { display: block; }
  main { padding-bottom: 80px; }
  .dash-counter { padding: 14px; }
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .results-grid { grid-template-columns: 1fr; }
}
@media (min-width: 769px) {
  .mobile-nav { display: none !important; }
}

</style></head><body>
<h1>🌾 बसरा पोर्टफोलियो रिपोर्ट</h1>
<p class="subtitle">${village}${getHalka(village) ? ' (' + getHalka(village) + ')' : ''} — बसरा ${basraNo} | भूमिस्वामी: ${owner} | दिनांक: ${new Date().toLocaleDateString('hi-IN')}</p>
<div class="summary">
  <div class="summary-item"><div class="val">${basraRecs.length}</div><div class="lbl">कुल खसरे</div></div>
  <div class="summary-item"><div class="val">${totalArea} हे.</div><div class="lbl">कुल क्षेत्रफल</div></div>
  <div class="summary-item green"><div class="val">${sinchai}</div><div class="lbl">सिंचित</div></div>
  <div class="summary-item orange"><div class="val">${asinchai}</div><div class="lbl">असिंचित</div></div>
</div>
<table>
  <thead><tr><th>#</th><th>खसरा</th><th>भूमिस्वामी</th><th>क्षेत्रफल (हे.)</th><th>भूमि प्रकार</th><th>चराई भूमि</th><th>सीलिंग भूमि</th><th>निस्तार विवरण</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<p class="footer">भूमि रिकॉर्ड डैशबोर्ड — हल्का 43 एवं 28 | कम्प्यूटर जनित रिकॉर्ड — सत्यापन हेतु पटवारी कार्यालय से संपर्क करें</p>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
            pw.document.close();
        }

        // ─── Farmer Portfolio Print ───────────────────────────────
        function printFarmerPortfolio(owner, village) {
            // Exact name match → basra numbers → all khasras of those basras
            const ownerNorm = owner.replace(/\s+/g, ' ').trim();
            const nameMatched = records.filter(r => r.v === village && r.ownerNames.includes(ownerNorm));
            const basraSet = new Set(nameMatched.map(r => r.bn).filter(Boolean));
            const farmerRecs = basraSet.size > 0
                ? records.filter(r => r.v === village && basraSet.has(r.bn))
                : nameMatched;
            if (!farmerRecs.length) return;

            const totalArea = farmerRecs.reduce((s, r) => s + parseFloat(r.area || 0), 0).toFixed(3);
            const sinchai = farmerRecs.filter(r => r.type && r.type.includes('सिंचित') && !r.type.includes('असिंचित')).length;
            const asinchai = farmerRecs.length - sinchai;

            // Optional: Get unique basras logic
            const uniqueBasras = [...new Set(farmerRecs.map(r => r.bn).filter(Boolean))].join(', ');

            const rowsHtml = farmerRecs.map((r, i) => `
              <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
                <td style="text-align:center;font-weight:800;">${i + 1}</td>
                <td style="font-weight:800;text-align:center;">${r.kn}</td>
                <td style="text-align:center;">${r.bn}</td>
                <td style="text-align:center;">${r.area}</td>
                <td>${r.type || '—'}</td>
                <td>${r.charai || '—'}</td>
                <td>${r.ceiling || '—'}</td>
                <td>${r.nistar || '—'}</td>
              </tr>`).join('');

            const pw = window.open('', '_blank');
            if (!pw) { toast('Popup blocked! Allow popups and try again.', 'error'); return; }

            pw.document.write(`<!DOCTYPE html>
<html lang="hi"><head>
<meta charset="UTF-8">
<title>किसान पोर्टफोलियो – ${village} – ${owner}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: hsl(224, 71%, 4%);
  --fg: hsl(213, 31%, 91%);
  --card: hsl(224, 60%, 7%);
  --primary: hsl(230, 70%, 60%);
  --primary-h: 230;
  --muted: hsl(220, 45%, 12%);
  --muted-fg: hsl(215, 20%, 55%);
  --border: hsl(220, 40%, 18%);
  --accent: hsl(262, 60%, 55%);
  --success: hsl(142, 70%, 40%);
  --warning: hsl(38, 85%, 50%);
  --info: hsl(200, 75%, 50%);
  --gradient-primary: linear-gradient(135deg, hsl(230, 70%, 55%) 0%, hsl(262, 60%, 50%) 100%);
  --glass-bg: hsla(224, 60%, 10%, 0.7);
  --glass-border: hsla(213, 31%, 91%, 0.08);
  --glass-shadow: 0 8px 32px hsla(224, 71%, 4%, 0.6);
  --shadow-glow: 0 0 40px hsla(230, 70%, 60%, 0.25);
  --shadow-card: 0 4px 24px hsla(224, 71%, 4%, 0.5);
}

body {
  font-family: 'Noto Sans Devanagari', 'Inter', sans-serif;
  background: linear-gradient(135deg, hsl(224, 71%, 4%) 0%, hsl(240, 60%, 8%) 50%, hsl(262, 50%, 10%) 100%);
  min-height: 100vh;
  color: var(--fg);
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--muted); }
::-webkit-scrollbar-thumb { background: hsla(230, 70%, 60%, 0.5); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--primary); }

/* Utilities */
.glass-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(20px);
}

.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.btn-primary {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  color: white;
  font-weight: 600;
  border-radius: 12px;
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  font-family: inherit;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 60px hsla(230, 70%, 60%, 0.4);
}

.btn-primary:active { transform: translateY(0); }

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.stat-card {
  background: linear-gradient(135deg, hsl(224, 60%, 9%) 0%, hsl(230, 55%, 12%) 100%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-glow);
  border-color: hsla(230, 70%, 60%, 0.3);
}

.badge-success { background: hsla(142, 70%, 40%, 0.2); color: hsl(142, 70%, 65%); border: 1px solid hsla(142, 70%, 40%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-warning { background: hsla(38, 85%, 50%, 0.2); color: hsl(38, 85%, 70%); border: 1px solid hsla(38, 85%, 50%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-error { background: hsla(0, 72%, 51%, 0.2); color: hsl(0, 72%, 75%); border: 1px solid hsla(0, 72%, 51%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-info { background: hsla(200, 75%, 50%, 0.2); color: hsl(200, 75%, 75%); border: 1px solid hsla(200, 75%, 50%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }

.input-glass {
  background: hsla(220, 40%, 10%, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--fg);
  border-radius: 12px;
  padding: 12px 16px;
  width: 100%;
  transition: all 0.2s;
  outline: none;
  font-family: inherit;
  font-size: 14px;
}

.input-glass:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}

.input-glass:disabled {
  background: hsla(220, 40%, 10%, 0.4);
  color: var(--muted-fg);
  cursor: not-allowed;
}

/* Header */
header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: hsla(224, 65%, 5%, 0.85);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(20px);
}

.header-inner {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 16px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.logo-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  flex-shrink: 0;
}

.logo-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--fg);
  line-height: 1.2;
}

.logo-sub {
  font-size: 13px;
  color: var(--muted-fg);
  font-weight: 600;
  font-family: serif;
}

nav.desktop {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  color: var(--muted-fg);
  background: transparent;
}

.nav-btn:hover:not(.active) {
  background: hsla(220, 50%, 15%, 0.6);
  color: var(--fg);
}

.nav-btn.active {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  color: white;
}

.menu-btn {
  display: none;
  padding: 8px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  font-size: 20px;
}

.mobile-nav {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: hsl(224, 65%, 5%);
  border-top: 1px solid var(--border);
}

.mobile-nav .nav-btn {
  width: 100%;
  text-align: left;
  justify-content: flex-start;
}

/* Bottom Nav */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: hsla(224, 65%, 5%, 0.95);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(20px);
}

.bottom-nav-inner {
  display: flex;
}

.bottom-nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  font-size: 11px;
  font-weight: 500;
  color: var(--muted-fg);
}

.bottom-nav-btn.active {
  color: var(--primary);
}


/* Form Labels and Select */
.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--muted-fg);
  margin-bottom: 8px;
}

.form-select, .form-input {
  background: hsla(220, 40%, 10%, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--fg);
  border-radius: 12px;
  padding: 14px 18px;
  width: 100%;
  font-size: 15px;
  font-weight: 500;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
}

.form-select:focus, .form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}

.form-select:disabled, .form-input:disabled {
  background: hsla(220, 40%, 10%, 0.4);
  color: var(--muted-fg);
  cursor: not-allowed;
}

.select-wrap {
  position: relative;
}
.select-wrap::after {
  content: '▼';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-fg);
  font-size: 12px;
  pointer-events: none;
}

/* Spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid hsla(230, 70%, 60%, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Empty State */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
  background: hsla(224, 60%, 10%, 0.5);
  border: 1px dashed var(--border);
  border-radius: 24px;
  animation: fadeUp 0.4s ease;
}

/* Result Cards Layout Grid */
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

/* Individual Result Card mimicking the new design's glass-card inside */
.result-card, .dash-section {
  background: hsla(220, 40%, 10%, 0.6);
  border-radius: 20px;
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: all 0.3s;
  animation: fadeUp 0.4s ease both;
}
.result-card:hover { border-color: hsla(230, 70%, 60%, 0.3); box-shadow: var(--shadow-glow); transform: translateY(-3px); }

.card-header-khasra { background: var(--gradient-primary); }
.card-header-basra { background: linear-gradient(135deg, hsl(142, 60%, 45%), hsl(142, 70%, 35%)); }
.card-header-nam { background: linear-gradient(135deg, hsl(280, 60%, 55%), hsl(280, 70%, 45%)); }

.card-kn {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  color: #fff;
}

.stat-chip {
  background: hsla(224, 60%, 15%, 0.6);
  border-radius: 12px;
  padding: 12px 14px;
  text-align: center;
  border: 1px solid var(--border);
}

.stat-chip-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-fg);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-chip-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--fg);
  margin-top: 4px;
}

/* Portfolio Banner */
.portfolio-banner {
  background: var(--gradient-primary);
  border-radius: 24px;
  color: #fff;
  padding: 24px;
  box-shadow: var(--shadow-glow);
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.4s ease both;
}
.portfolio-banner::before {
  content: '';
  position: absolute;
  top: -60%;
  right: -10%;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%);
  pointer-events: none;
}
.pf-stat {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  padding: 12px 18px;
  text-align: center;
}
.pf-stat-label { font-size: 11px; font-weight: 700; opacity: 0.8; text-transform: uppercase; }
.pf-stat-val { font-size: 24px; font-weight: 800; margin-top: 4px; }


/* Dashboard Counters and Charts */
.dash-counter {
  animation: fadeUp 0.6s ease both;
}
.dash-section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--fg);
  margin-bottom: 16px;
}
.dash-search-wrap {
  position: relative;
  margin-bottom: 24px;
}
.dash-search-input {
  width: 100%;
  padding: 14px 18px 14px 44px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: var(--fg);
  background: hsla(220, 40%, 10%, 0.8);
  outline: none;
  transition: all 0.2s;
}
.dash-search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}
.dash-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-fg);
  pointer-events: none;
}

.bar-chart-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.bar-label {
  width: 120px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bar-track {
  flex: 1;
  height: 24px;
  background: hsla(220, 40%, 15%, 0.8);
  border-radius: 6px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 1s cubic-bezier(.4, 0, .2, 1);
}
.bar-val {
  width: 60px;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted-fg);
  text-align: right;
}
.lb-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: hsla(220, 40%, 15%, 0.4);
  border: 1px solid var(--border);
  transition: background 0.2s;
  margin-bottom: 10px;
  animation: fadeUp 0.4s ease both;
}
.lb-row:hover { background: hsla(220, 40%, 20%, 0.6); }
.lb-rank {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--gradient-primary);
  color: #fff; font-size: 15px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.lb-rank.gold { background: linear-gradient(135deg, hsl(38, 90%, 55%), hsl(38, 90%, 45%)); }
.lb-rank.silver { background: linear-gradient(135deg, hsl(220, 20%, 65%), hsl(220, 20%, 50%)); }
.lb-rank.bronze { background: linear-gradient(135deg, hsl(25, 75%, 50%), hsl(25, 75%, 35%)); }
.lb-name {
  flex: 1; font-size: 15px; font-weight: 600; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lb-stat-val { font-size: 15px; font-weight: 800; color: var(--primary); }
.lb-stat-lbl { font-size: 11px; font-weight: 600; color: var(--muted-fg); }


@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeUp 0.4s ease both; }

@media (max-width: 768px) {
  nav.desktop { display: none; }
  .menu-btn { display: block; }
  .bottom-nav { display: block; }
  main { padding-bottom: 80px; }
  .dash-counter { padding: 14px; }
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .results-grid { grid-template-columns: 1fr; }
}
@media (min-width: 769px) {
  .mobile-nav { display: none !important; }
}

</style></head><body>

<h1>🌾 किसान पोर्टफोलियो रिपोर्ट</h1>
<p class="subtitle">${village}${getHalka(village) ? ' (' + getHalka(village) + ')' : ''} | भूमिस्वामी: ${owner} | दिनांक: ${new Date().toLocaleDateString('hi-IN')}</p>
${uniqueBasras ? `<p style="text-align:center;font-size:13px;margin-top:-15px;margin-bottom:20px;color:#059669;"><strong>संबंधित बसरा:</strong> ${uniqueBasras}</p>` : ''}

<div class="summary">
  <div class="summary-item">          <div class="val">${farmerRecs.length}</div><div class="lbl">कुल खसरे</div></div>
  <div class="summary-item">          <div class="val">${totalArea} हे.</div> <div class="lbl">कुल क्षेत्रफल</div></div>
  <div class="summary-item green">   <div class="val">${sinchai}</div>          <div class="lbl">सिंचित</div></div>
  <div class="summary-item orange">  <div class="val">${asinchai}</div>         <div class="lbl">असिंचित</div></div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>खसरा</th>
      <th>बसरा</th>
      <th>क्षेत्रफल (हे.)</th>
      <th>भूमि प्रकार</th>
      <th>चराई भूमि</th>
      <th>सीलिंग भूमि</th>
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


        // ══════════════════════════════════════════════

        const GRAM_GRADIENTS = [
            'linear-gradient(135deg,#1a1a6e,#3b5bdb)',
            'linear-gradient(135deg,#065f46,#059669)',
            'linear-gradient(135deg,#7c2d12,#ea580c)',
            'linear-gradient(135deg,#4c1d95,#7c3aed)',
            'linear-gradient(135deg,#831843,#db2777)',
            'linear-gradient(135deg,#1e3a5f,#0ea5e9)',
            'linear-gradient(135deg,#14532d,#16a34a)',
            'linear-gradient(135deg,#7f1d1d,#dc2626)',
            'linear-gradient(135deg,#134e4a,#0d9488)',
            'linear-gradient(135deg,#312e81,#6366f1)',
        ];

        function showDashboard() {
            const dash = document.getElementById('dashboardDiv');
            dash.style.display = '';

            if (!records.length) {
                dash.innerHTML = `<div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:16px;font-weight:600;">⏳ पहले डेटा लोड होने दें...</div>`;
                return;
            }

            // ── Aggregate gram-wise stats ──
            const gramMap = {};
            records.forEach(r => {
                const g = r.v || 'अज्ञात';
                if (!gramMap[g]) gramMap[g] = { recs: [], owners: {} };
                gramMap[g].recs.push(r);
                const ow = r.owner || 'अज्ञात';
                gramMap[g].owners[ow] = (gramMap[g].owners[ow] || 0) + 1;
            });

            const grams = Object.keys(gramMap).sort((a, b) => a.localeCompare(b, 'hi'));

            // ── Global totals ──
            const totalRec = records.length;
            const totalArea = records.reduce((s, r) => s + parseFloat(r.area || 0), 0).toFixed(2);
            const sinchai = records.filter(r => r.type && r.type.includes('सिंचित') && !r.type.includes('असिंचित')).length;
            const asinchai = totalRec - sinchai;
            const sinchaiPctGlobal = totalRec ? Math.round((sinchai / totalRec) * 100) : 0;

            // ── Top 5 farmers (global) ──
            const farmerMap = {};
            records.forEach(r => {
                const k = r.owner || 'अज्ञात';
                if (!farmerMap[k]) farmerMap[k] = { area: 0, khasras: 0, village: r.v };
                farmerMap[k].area += parseFloat(r.area || 0);
                farmerMap[k].khasras += 1;
            });
            const top5 = Object.entries(farmerMap)
                .sort((a, b) => b[1].area - a[1].area)
                .slice(0, 5);

            // ── Max area for bar chart ──
            const maxGramArea = Math.max(...grams.map(g =>
                gramMap[g].recs.reduce((s, r) => s + parseFloat(r.area || 0), 0)
            ));

            const now = new Date().toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            // ── Build HTML ──
            let html = `

            <!-- ▸ Header row -->
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
                <h2 style="font-size:22px;font-weight:900;color:var(--royal);font-family:'Noto Sans Devanagari',sans-serif;">
                    📊 ग्रामवार भूमि सारांश
                </h2>
                <div style="font-size:12px;color:var(--text-muted);font-weight:600;">🕐 ${now}</div>
            </div>

            <!-- ▸ Animated Summary Counters -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:28px;">
                <div class="dash-counter" style="background:linear-gradient(135deg,#1a1a6e,#3b5bdb);color:#fff;border-radius:16px;padding:18px 20px;text-align:center;box-shadow:0 4px 20px rgba(26,26,110,0.3);animation-delay:0s;">
                    <div style="font-size:11px;font-weight:700;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">कुल ग्राम</div>
                    <div class="dash-num" data-target="${grams.length}" style="font-size:38px;font-weight:900;line-height:1;">0</div>
                </div>
                <div class="dash-counter" style="background:linear-gradient(135deg,#065f46,#059669);color:#fff;border-radius:16px;padding:18px 20px;text-align:center;box-shadow:0 4px 20px rgba(5,150,105,0.3);animation-delay:0.1s;">
                    <div style="font-size:11px;font-weight:700;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">कुल रिकॉर्ड</div>
                    <div class="dash-num" data-target="${totalRec}" style="font-size:38px;font-weight:900;line-height:1;">0</div>
                </div>
                <div class="dash-counter" style="background:linear-gradient(135deg,#7c2d12,#ea580c);color:#fff;border-radius:16px;padding:18px 20px;text-align:center;box-shadow:0 4px 20px rgba(234,88,12,0.3);animation-delay:0.2s;">
                    <div style="font-size:11px;font-weight:700;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">कुल क्षेत्रफल (हे.)</div>
                    <div class="dash-num" data-target="${Math.round(totalArea)}" data-decimal="${totalArea}" style="font-size:34px;font-weight:900;line-height:1;">0</div>
                </div>
                <div class="dash-counter" style="background:linear-gradient(135deg,#1e3a5f,#0ea5e9);color:#fff;border-radius:16px;padding:18px 20px;text-align:center;box-shadow:0 4px 20px rgba(14,165,233,0.3);animation-delay:0.3s;">
                    <div style="font-size:11px;font-weight:700;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">सिंचित खसरे</div>
                    <div class="dash-num" data-target="${sinchai}" style="font-size:38px;font-weight:900;line-height:1;">0</div>
                </div>
            </div>

            <!-- ▸ Sinchai vs Asinchai Ring + Stats Row -->
            <div class="dash-section" style="animation-delay:0.1s;">
                <div class="dash-section-title">🌊 सिंचित बनाम असिंचित अनुपात</div>
                <div class="ring-wrap">
                    <div style="position:relative;flex-shrink:0;">
                        <svg class="ring-svg" width="140" height="140" viewBox="0 0 140 140">
                            <circle cx="70" cy="70" r="54" stroke="#fef3c7" stroke-width="16" fill="none"/>
                            <circle cx="70" cy="70" r="54"
                                stroke="#059669"
                                stroke-dasharray="${(sinchaiPctGlobal / 100 * 339.3).toFixed(1)} 339.3"
                                stroke-dashoffset="84.8"
                                stroke-linecap="round"
                                stroke-width="16" fill="none"
                                style="transition:stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1);"/>
                        </svg>
                        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                            <div style="font-size:26px;font-weight:900;color:var(--royal);">${sinchaiPctGlobal}%</div>
                            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">सिंचित</div>
                        </div>
                    </div>
                    <div style="flex:1;display:flex;flex-direction:column;gap:12px;">
                        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#d1fae5;border-radius:12px;">
                            <div style="width:14px;height:14px;border-radius:50%;background:#059669;flex-shrink:0;"></div>
                            <div style="flex:1;">
                                <div style="font-size:12px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.06em;">सिंचित</div>
                                <div style="font-size:22px;font-weight:900;color:#065f46;line-height:1.1;">${sinchai} <span style="font-size:12px;font-weight:600;">खसरे</span></div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fef3c7;border-radius:12px;">
                            <div style="width:14px;height:14px;border-radius:50%;background:#d97706;flex-shrink:0;"></div>
                            <div style="flex:1;">
                                <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;">असिंचित</div>
                                <div style="font-size:22px;font-weight:900;color:#92400e;line-height:1.1;">${asinchai} <span style="font-size:12px;font-weight:600;">खसरे</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ▸ Area Bar Chart -->
            <div class="dash-section" style="animation-delay:0.15s;">
                <div class="dash-section-title">📏 ग्रामवार क्षेत्रफल (हेक्टेयर)</div>
                ${grams.map((g, i) => {
                const area = gramMap[g].recs.reduce((s, r) => s + parseFloat(r.area || 0), 0);
                const pct = maxGramArea > 0 ? (area / maxGramArea * 100).toFixed(1) : 0;
                const grad = GRAM_GRADIENTS[i % GRAM_GRADIENTS.length];
                return `
                    <div class="bar-chart-row">
                        <div class="bar-label" title="${g}">${g}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width:${pct}%;background:${grad};"></div>
                        </div>
                        <div class="bar-val">${area.toFixed(2)}</div>
                    </div>`;
            }).join('')}
            </div>

            <!-- ▸ Top Farmers Leaderboard -->
            <div class="dash-section" style="animation-delay:0.2s;">
                <div class="dash-section-title">🏆 शीर्ष 5 भूमिस्वामी (क्षेत्रफल अनुसार)</div>
                ${top5.map(([name, info], i) => {
                const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
                return `
                    <div class="lb-row" style="animation-delay:${0.05 * i}s;">
                        <div class="lb-rank ${rankClass}">${medal}</div>
                        <div style="flex:1;min-width:0;">
                            <div class="lb-name">${name}</div>
                            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-top:2px;">ग्राम: ${info.village}</div>
                        </div>
                        <div class="lb-stat">
                            <div class="lb-stat-val">${info.area.toFixed(2)} हे.</div>
                            <div class="lb-stat-lbl">${info.khasras} खसरे</div>
                        </div>
                    </div>`;
            }).join('')}
            </div>

            <!-- ▸ Village Search + Cards Grid -->
            <div style="margin-bottom:6px;">
                <div class="dash-section-title" style="margin-bottom:14px;">🏘️ ग्रामवार विवरण</div>
                <div class="dash-search-wrap">
                    <svg class="dash-search-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input type="text" id="dashSearchInput" class="dash-search-input"
                        placeholder="ग्राम खोजें..." oninput="filterDashCards(this.value)">
                </div>
            </div>

            <div id="dashCardsGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:20px;margin-bottom:8px;">
            ${grams.map((g, i) => {
                const d = gramMap[g];
                const recs = d.recs;
                const area = recs.reduce((s, r) => s + parseFloat(r.area || 0), 0).toFixed(2);
                const sCount = recs.filter(r => r.type && r.type.includes('सिंचित') && !r.type.includes('असिंचित')).length;
                const aCount = recs.length - sCount;
                const sPct = recs.length ? Math.round((sCount / recs.length) * 100) : 0;
                const topOwner = Object.entries(d.owners).sort((a, b) => b[1] - a[1])[0];
                const grad = GRAM_GRADIENTS[i % GRAM_GRADIENTS.length];
                const uBasras = new Set(recs.map(r => r.bn)).size;

                return `
                <div class="result-card dash-gram-card" data-gram="${g}" style="overflow:hidden;border-radius:20px;animation:slideUp 0.4s ease both;animation-delay:${i * 0.04}s;">
                    <div style="background:${grad};padding:18px 20px;position:relative;overflow:hidden;">
                        <div style="position:absolute;top:-20px;right:-20px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.08);"></div>
                        <div style="position:absolute;bottom:-30px;left:-10px;width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,0.05);"></div>
                        <div style="position:relative;z-index:1;">
                            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">ग्राम</div>
                            <div style="font-size:20px;font-weight:900;color:#fff;font-family:'Noto Sans Devanagari',sans-serif;line-height:1.2;">${g}</div>
                            <div style="font-size:11px;color:rgba(255,255,255,0.65);margin-top:4px;font-weight:600;">${uBasras} बसरे</div>
                        </div>
                    </div>
                    <div style="padding:16px 20px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div class="stat-chip">
                            <div class="stat-chip-label">कुल खसरे</div>
                            <div class="stat-chip-val">${recs.length}</div>
                        </div>
                        <div class="stat-chip">
                            <div class="stat-chip-label">क्षेत्रफल (हे.)</div>
                            <div class="stat-chip-val" style="font-size:16px;">${area}</div>
                        </div>
                        <div class="stat-chip" style="background:#d1fae5;">
                            <div class="stat-chip-label" style="color:#065f46;">सिंचित</div>
                            <div class="stat-chip-val" style="color:#065f46;">${sCount}</div>
                        </div>
                        <div class="stat-chip" style="background:#fef3c7;">
                            <div class="stat-chip-label" style="color:#92400e;">असिंचित</div>
                            <div class="stat-chip-val" style="color:#92400e;">${aCount}</div>
                        </div>
                    </div>
                    <div style="padding:0 20px 14px;">
                        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">
                            <span>सिंचित अनुपात</span><span>${sPct}%</span>
                        </div>
                        <div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;">
                            <div style="width:${sPct}%;height:100%;background:${grad};border-radius:99px;transition:width 0.8s ease;"></div>
                        </div>
                    </div>
                    <div style="padding:12px 20px 16px;border-top:1px solid var(--border);">
                        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">शीर्ष भूमिस्वामी</div>
                        <div style="font-size:13px;font-weight:700;color:var(--text-main);font-family:'Noto Sans Devanagari',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${topOwner ? topOwner[0] : '—'}</div>
                        ${topOwner ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${topOwner[1]} खसरे</div>` : ''}
                    </div>
                </div>`;
            }).join('')}
            </div>
            `;

            dash.innerHTML = html;

            // ── Animate counters ──
            document.querySelectorAll('.dash-num').forEach(el => {
                const target = parseInt(el.dataset.target, 10);
                const isDecimal = el.dataset.decimal;
                const duration = 900;
                const startTime = performance.now();
                function tick(now) {
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const current = Math.round(eased * target);
                    el.textContent = isDecimal && progress >= 1 ? parseFloat(isDecimal).toFixed(2) : current;
                    if (progress < 1) requestAnimationFrame(tick);
                }
                requestAnimationFrame(tick);
            });
        }

        // ── Filter village cards in dashboard/statistics ──
        function filterDashCards(query) {
            const q = query.trim().toLowerCase();
            document.querySelectorAll('.dash-gram-card').forEach(card => {
                const gram = (card.dataset.gram || '').toLowerCase();
                card.style.display = gram.includes(q) ? '' : 'none';
            });
        }

        // ── Statistics Page ────────────────────────────
        function showStatistics() {
            const statDiv = document.getElementById('statisticsDiv');
            statDiv.style.display = '';

            if (!records.length) {
                statDiv.innerHTML = `<div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:16px;font-weight:600;">⏳ पहले डेटा लोड होने दें...</div>`;
                return;
            }

            // Aggregate gram-wise stats
            const gramMap = {};
            records.forEach(r => {
                const g = r.v || 'अज्ञात';
                if (!gramMap[g]) gramMap[g] = { recs: [], owners: {} };
                gramMap[g].recs.push(r);
                const ow = r.owner || 'अज्ञात';
                gramMap[g].owners[ow] = (gramMap[g].owners[ow] || 0) + 1;
            });
            const grams = Object.keys(gramMap).sort((a, b) => a.localeCompare(b, 'hi'));

            // Global totals
            const totalRec = records.length;
            const totalArea = records.reduce((s, r) => s + parseFloat(r.area || 0), 0).toFixed(2);
            const sinchai = records.filter(r => r.type && r.type.includes('सिंचित') && !r.type.includes('असिंचित')).length;
            const asinchai = totalRec - sinchai;

            // Top 5 farmers (by area)
            const farmerMap = {};
            records.forEach(r => {
                const k = r.owner || 'अज्ञात';
                if (!farmerMap[k]) farmerMap[k] = { area: 0, khasras: 0, village: r.v };
                farmerMap[k].area += parseFloat(r.area || 0);
                farmerMap[k].khasras += 1;
            });
            const top5 = Object.entries(farmerMap)
                .sort((a, b) => b[1].area - a[1].area)
                .slice(0, 5);

            const now = new Date().toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' });

            let html = `
            <div style="animation:slideUp 0.4s ease both;">

              <!-- Header -->
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
                <h2 style="font-size:22px;font-weight:900;color:var(--fg);font-family:'Noto Sans Devanagari',sans-serif;">
                  📊 विस्तृत आँकड़े
                </h2>
                <div style="font-size:12px;color:var(--muted-fg);font-weight:600;">🕐 ${now}</div>
              </div>

              <!-- Summary Counters -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:28px;">
                <div class="stat-card" style="padding:18px 20px;text-align:center;">
                  <div style="font-size:11px;font-weight:700;color:var(--muted-fg);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">कुल ग्राम</div>
                  <div style="font-size:36px;font-weight:900;line-height:1;color:var(--primary);">${grams.length}</div>
                </div>
                <div class="stat-card" style="padding:18px 20px;text-align:center;">
                  <div style="font-size:11px;font-weight:700;color:var(--muted-fg);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">कुल रिकॉर्ड</div>
                  <div style="font-size:36px;font-weight:900;line-height:1;color:var(--success);">${totalRec}</div>
                </div>
                <div class="stat-card" style="padding:18px 20px;text-align:center;">
                  <div style="font-size:11px;font-weight:700;color:var(--muted-fg);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">कुल क्षेत्रफल (हे.)</div>
                  <div style="font-size:32px;font-weight:900;line-height:1;color:var(--warning);">${totalArea}</div>
                </div>
                <div class="stat-card" style="padding:18px 20px;text-align:center;">
                  <div style="font-size:11px;font-weight:700;color:var(--muted-fg);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">सिंचित खसरे</div>
                  <div style="font-size:36px;font-weight:900;line-height:1;color:var(--info);">${sinchai}</div>
                </div>
              </div>

              <!-- Sinchai/Asinchai simple stat row (no chart) -->
              <div class="dash-section" style="margin-bottom:24px;">
                <div class="dash-section-title">🌊 सिंचित / असिंचित विवरण</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                  <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:hsla(142,70%,40%,0.15);border-radius:14px;border:1px solid hsla(142,70%,40%,0.3);">
                    <div style="width:40px;height:40px;border-radius:12px;background:hsla(142,70%,40%,0.2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">💧</div>
                    <div>
                      <div style="font-size:11px;font-weight:700;color:hsl(142,70%,55%);text-transform:uppercase;letter-spacing:0.06em;">सिंचित</div>
                      <div style="font-size:26px;font-weight:900;color:hsl(142,70%,65%);line-height:1.1;">${sinchai} <span style="font-size:13px;font-weight:600;">खसरे</span></div>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:hsla(38,85%,50%,0.15);border-radius:14px;border:1px solid hsla(38,85%,50%,0.3);">
                    <div style="width:40px;height:40px;border-radius:12px;background:hsla(38,85%,50%,0.2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🏜</div>
                    <div>
                      <div style="font-size:11px;font-weight:700;color:hsl(38,85%,65%);text-transform:uppercase;letter-spacing:0.06em;">असिंचित</div>
                      <div style="font-size:26px;font-weight:900;color:hsl(38,85%,70%);line-height:1.1;">${asinchai} <span style="font-size:13px;font-weight:600;">खसरे</span></div>
                    </div>
                  </div>
                </div>

                <!-- NEW: Village-wise Ring Charts -->
                <div style="margin-top: 24px;">
                  <div style="font-size:14px;font-weight:800;color:var(--primary);margin-bottom:12px;border-top:1px dashed var(--border);padding-top:16px;">ग्राम-वार सिंचित / असिंचित स्थिति</div>
                  <div style="display:flex; gap:16px; overflow-x:auto; padding-bottom:10px;">
                    ${grams.map((g) => {
                      const d = gramMap[g];
                      const recs = d.recs;
                      const totalArea = recs.reduce((s, r) => s + parseFloat(r.area || 0), 0).toFixed(2);
                      const sRecs = recs.filter(r => r.type && r.type.includes('सिंचित') && !r.type.includes('असिंचित'));
                      const aRecs = recs.filter(r => !(r.type && r.type.includes('सिंचित') && !r.type.includes('असिंचित')));
                      const sArea = sRecs.reduce((s, r) => s + parseFloat(r.area || 0), 0).toFixed(2);
                      const aArea = aRecs.reduce((s, r) => s + parseFloat(r.area || 0), 0).toFixed(2);
                      
                      const sCount = sRecs.length;
                      const aCount = aRecs.length;
                      const total = recs.length || 1;
                      const sPct = Math.round((sCount / total) * 100);
                      const strokeDashArea = 226.19; // 2 * Math.PI * 36
                      const strokeDashSinchai = (sPct / 100) * strokeDashArea;
                      
                      return `
                        <div class="stat-card" style="flex:1; min-width:180px; display:flex; flex-direction:column; align-items:center; text-align:center; padding:16px;">
                          <div style="font-weight:800; font-size:15px; color:var(--fg); margin-bottom:12px; font-family:'Noto Sans Devanagari',sans-serif;">${g}</div>
                          
                          <div style="position:relative; width:80px; height:80px; margin-bottom:12px;">
                            <svg class="ring-svg" width="80" height="80" viewBox="0 0 100 100" style="transform: rotate(-90deg);">
                              <circle cx="50" cy="50" r="36" stroke="hsla(38,85%,50%,0.3)" stroke-width="14" fill="none"></circle>
                              <circle cx="50" cy="50" r="36" stroke="hsl(142,70%,55%)" stroke-width="14" fill="none" stroke-dasharray="${strokeDashSinchai} ${strokeDashArea}" style="transition: stroke-dasharray 1s ease-out; stroke-linecap:round;"></circle>
                            </svg>
                            <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column;">
                              <span style="font-size:16px; font-weight:900; color:hsl(142,70%,55%); line-height:1;">${sPct}%</span>
                            </div>
                          </div>
                          
                          <div style="width:100%; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                            <div style="background:hsla(142,70%,40%,0.15); border:1px solid hsla(142,70%,40%,0.3); border-radius:10px; padding:8px 4px;">
                              <div style="font-size:10px; font-weight:700; color:hsl(142,70%,55%); text-transform:uppercase; margin-bottom:2px;">सिंचित</div>
                              <div style="font-size:13px; font-weight:800; color:hsl(142,70%,65%);">${sCount} खसरे</div>
                              <div style="font-size:14px; font-weight:900; color:hsl(142,70%,60%);">${sArea} हे.</div>
                            </div>
                            <div style="background:hsla(38,85%,50%,0.15); border:1px solid hsla(38,85%,50%,0.3); border-radius:10px; padding:8px 4px;">
                              <div style="font-size:10px; font-weight:700; color:hsl(38,85%,65%); text-transform:uppercase; margin-bottom:2px;">असिंचित</div>
                              <div style="font-size:13px; font-weight:800; color:hsl(38,85%,70%);">${aCount} खसरे</div>
                              <div style="font-size:14px; font-weight:900; color:hsl(38,85%,60%);">${aArea} हे.</div>
                            </div>
                          </div>
                          
                          <div style="margin-top:10px; font-size:12px; font-weight:700; color:var(--muted-fg); background:var(--muted); padding:6px 12px; border-radius:20px; border:1px solid var(--border);">
                            कुल रकबा: <span style="color:var(--primary); font-weight:900;">${totalArea} हे.</span>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>

              <!-- Village wise ring graphs ends here -->

            </div>`;

            statDiv.innerHTML = html;
        }

        // ── Government Records Page ────────────────────────────
        function showGovRecords() {
            const govDiv = document.getElementById('govDiv');
            govDiv.style.display = '';

            if (!records.length) {
                govDiv.innerHTML = `<div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:16px;font-weight:600;">⏳ पहले डेटा लोड होने दें...</div>`;
                return;
            }

            // Identify unique villages for dropdown and sort by custom order
            const desiredOrder = ['छेरकापुर (हल्का 28)', 'छड़िया (हल्का 28)', 'तिल्दा (हल्का 43)', 'गबौद (हल्का 43)'];
            const grams = [...new Set(records.map(r => r.v).filter(Boolean))].sort((a, b) => {
                const idxA = desiredOrder.indexOf(a);
                const idxB = desiredOrder.indexOf(b);
                return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
            });

            let html = `
            <div style="animation:slideUp 0.4s ease both; max-width:900px; margin:0 auto;">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
                <h2 style="font-size:22px;font-weight:900;color:var(--royal);font-family:'Noto Sans Devanagari',sans-serif;">
                  🏛️ शासकीय भूमि रिकॉर्ड्स (हल्का 28 एवं 43)
                </h2>
              </div>

              <!-- Search Card for Govt Records -->
              <div class="search-card fade-in" style="margin-bottom:32px;">
                 <div style="display:grid; gap:18px;">
                    <!-- Village -->
                    <div>
                        <label class="form-label">🏘️ ग्राम चुनें</label>
                        <div class="select-wrap">
                            <select id="govVillageSelect" class="form-select" onchange="populateGovNistarDropdown()">
                                <option value="" disabled selected>— ग्राम चुनें —</option>
                                ${grams.map(g => `<option value="${g}">${g}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <!-- Govt Land Type -->
                    <div>
                        <label class="form-label">🏞️ भूमि का प्रकार</label>
                        <div class="select-wrap">
                            <select id="govTypeSelect" class="form-select" onchange="handleGovTypeChange()">
                                <option value="" disabled selected>— प्रकार चुनें —</option>
                                <option value="charai">चराई भूमि</option>
                                <option value="ceiling">सीलिंग भूमि</option>
                                <option value="nistar">निस्तार/वाजिबुल अर्ज़ का विवरण (हल्का 28 एवं 43)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Nistar Details -->
                    <div id="govNistarDiv" style="display:none;">
                        <label class="form-label">📜 निस्तार विवरण चुनें</label>
                        <div class="select-wrap">
                            <select id="govNistarSelect" class="form-select">
                                <option value="" disabled selected>— पहले ग्राम चुनें —</option>
                            </select>
                        </div>
                    </div>

                    <button type="button" class="btn-search" onclick="handleGovSearch()" style="margin-top:4px;">
                        <span id="btnLabelGov">खोजें</span>
                    </button>
                 </div>
              </div>

              <!-- Results Area -->
              <div id="govTableContainer" style="display:none; animation:slideUp 0.4s ease both;">
                 <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
                    <h3 id="govTableTitle" style="font-size:18px; font-weight:800; color:var(--royal);"></h3>
                    <div style="display:flex; gap:10px;">
                       <button onclick="exportGovTableCSV()" style="background:#059669;color:#fff;border:none;border-radius:10px;padding:8px 16px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(5,150,105,0.3);display:flex;align-items:center;gap:6px;">
                         📊 Excel/CSV
                       </button>
                       <button onclick="exportGovTablePDF()" style="background:#dc2626;color:#fff;border:none;border-radius:10px;padding:8px 16px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(220,38,38,0.3);display:flex;align-items:center;gap:6px;">
                         🖨️ PDF Print
                       </button>
                    </div>
                 </div>
                 
                 <!-- Summary Cards -->
                 <div id="govSummaryCards" style="display:none; gap:14px; margin-bottom:20px; flex-wrap:wrap;">
                    <div class="stat-chip" style="flex:1; min-width:120px; background:#f0f4ff; border:1px solid #d1d9ff; padding:16px 20px;">
                        <div class="stat-chip-label" style="color:#1a1a6e; opacity:0.8; font-size:14px;">कुल खसरे</div>
                        <div class="stat-chip-val" id="govSumCount" style="color:#1a1a6e; font-size:32px;">0</div>
                    </div>
                    <div class="stat-chip" style="flex:1; min-width:120px; background:#f8fafc; border:1px solid #cbd5e1; padding:16px 20px;">
                        <div class="stat-chip-label" style="color:#0f766e; opacity:0.8; font-size:14px;">कुल रकबा (हे.)</div>
                        <div class="stat-chip-val" id="govSumArea" style="color:#0f766e; font-size:32px;">0</div>
                    </div>
                 </div>
                 
                 <div style="background:#fff; border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-card); overflow-x:auto;">
                   <table style="width:100%; border-collapse:collapse; min-width:700px; font-size:14px;">
                     <thead>
                       <tr style="background:linear-gradient(135deg,#1a1a6e,#2d2db0); color:#fff; text-align:left;">
                         <th style="padding:16px; font-weight:700; border-bottom:2px solid #000;">क्र.</th>
                         <th style="padding:16px; font-weight:700; border-bottom:2px solid #000;">खसरा नं.</th>
                         <th style="padding:16px; font-weight:700; border-bottom:2px solid #000;">बसरा नं.</th>
                         <th style="padding:16px; font-weight:700; border-bottom:2px solid #000;">रकबा (हे.)</th>
                         <th style="padding:16px; font-weight:700; border-bottom:2px solid #000;">भूमिस्वामी का नाम</th>
                         <th style="padding:16px; font-weight:700; border-bottom:2px solid #000;">निस्तार विवरण</th>
                       </tr>
                     </thead>
                     <tbody id="govTableBody">
                     </tbody>
                   </table>
                 </div>
                 
                 <!-- Empty Result message specific to Govt Tab -->
                 <div id="govEmptyMsg" style="display:none; text-align:center; padding:40px; background:#fff; border-radius:16px; border:1px dashed var(--border); margin-top:20px;">
                    <div style="font-size:40px; margin-bottom:10px;">🔍</div>
                    <div style="font-weight:700; color:var(--text-muted);">इस प्रकार की कोई भूमि नहीं मिली।</div>
                 </div>

              </div>
            </div>`;
            govDiv.innerHTML = html;
        }

        let currentGovData = [];
        let currentGovTitle = '';

        function handleGovTypeChange() {
            const type = document.getElementById('govTypeSelect').value;
            const nistarDiv = document.getElementById('govNistarDiv');
            if (type === 'nistar') {
                nistarDiv.style.display = 'block';
                populateGovNistarDropdown();
            } else {
                nistarDiv.style.display = 'none';
            }
        }

        function populateGovNistarDropdown() {
            const vill = document.getElementById('govVillageSelect').value;
            const type = document.getElementById('govTypeSelect')?.value;
            const nistarSelect = document.getElementById('govNistarSelect');
            if (!nistarSelect) return;

            if (type === 'nistar' && vill) {
                const vals = [...new Set(records.filter(r => r.v === vill && r.nistar && r.nistar.trim().length > 0 && r.nistar.trim() !== 'नहीं' && r.nistar.trim() !== '-').map(r => r.nistar.trim()))].sort((a, b) => a.localeCompare(b, 'hi'));
                if (vals.length > 0) {
                    nistarSelect.innerHTML = `<option value="" disabled selected>— निस्तार विवरण चुनें —</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
                } else {
                    nistarSelect.innerHTML = `<option value="" disabled selected>— कोई विवरण नहीं —</option>`;
                }
            } else if (!vill) {
                nistarSelect.innerHTML = `<option value="" disabled selected>— पहले ग्राम चुनें —</option>`;
            }
        }

        function handleGovSearch() {
            const vill = document.getElementById('govVillageSelect').value;
            const type = document.getElementById('govTypeSelect').value;

            if (!vill) { toast('कृपया ग्राम चुनें', 'error'); return; }
            if (!type) { toast('कृपया भूमि का प्रकार चुनें', 'error'); return; }

            let nistarVal = '';
            if (type === 'nistar') {
                nistarVal = document.getElementById('govNistarSelect').value;
                if (!nistarVal) { toast('कृपया निस्तार विवरण चुनें', 'error'); return; }
            }

            // Filter logic
            if (type === 'charai') {
                currentGovTitle = `चराई भूमि रिकॉर्ड्स - ${vill}`;
                // Using simple string match - adjust if the exact CSV column format differs. 
                // e.g., if 'हाँ' or specific text is stored there. 
                currentGovData = records.filter(r => r.v === vill && r.charai && r.charai.trim().length > 0 && r.charai !== 'नहीं');
            } else if (type === 'ceiling') {
                currentGovTitle = `सीलिंग भूमि रिकॉर्ड्स - ${vill}`;
                currentGovData = records.filter(r => r.v === vill && r.ceiling && r.ceiling.trim().length > 0 && r.ceiling !== 'नहीं');
            } else if (type === 'nistar') {
                currentGovTitle = `निस्तार विवरण: ${nistarVal} - ${vill}`;
                currentGovData = records.filter(r => r.v === vill && r.nistar && r.nistar.trim() === nistarVal);
            }

            // Render table
            const cont = document.getElementById('govTableContainer');
            const tbody = document.getElementById('govTableBody');
            const emptyMsg = document.getElementById('govEmptyMsg');
            const titleEl = document.getElementById('govTableTitle');
            const sumCards = document.getElementById('govSummaryCards');

            cont.style.display = 'block';
            titleEl.textContent = `${currentGovTitle} (${currentGovData.length})`;
            tbody.innerHTML = '';

            if (currentGovData.length === 0) {
                emptyMsg.style.display = 'block';
                document.querySelector('#govTableContainer table').style.display = 'none';
                if (sumCards) sumCards.style.display = 'none';
                return;
            }

            emptyMsg.style.display = 'none';
            document.querySelector('#govTableContainer table').style.display = 'table';

            if (sumCards) {
                sumCards.style.display = 'flex';
                document.getElementById('govSumCount').textContent = currentGovData.length;
                const totalArea = currentGovData.reduce((s, r) => s + parseFloat(r.area || 0), 0);
                document.getElementById('govSumArea').textContent = totalArea.toFixed(4);
            }

            // Sorting by khasra (basic numeric sort)
            currentGovData.sort((a, b) => {
                const a1 = parseInt(a.kn) || 0;
                const b1 = parseInt(b.kn) || 0;
                return a1 - b1;
            });

            currentGovData.forEach((r, idx) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border)';
                tr.style.background = idx % 2 === 0 ? '#f8fafc' : '#fff';
                tr.innerHTML = `
                    <td style="padding:14px 16px; font-weight:800; color:var(--text-muted);">${idx + 1}</td>
                    <td style="padding:14px 16px; font-weight:800; color:var(--royal);">${r.kn}</td>
                    <td style="padding:14px 16px; font-weight:600;">${r.bn || '—'}</td>
                    <td style="padding:14px 16px; font-weight:800;">${r.area}</td>
                    <td style="padding:14px 16px; font-weight:700; color:var(--text-main);">${r.owner}</td>
                    <td style="padding:14px 16px; font-size:13px; color:var(--text-muted); max-width:250px;">${r.nistar || '—'}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Export CSV Function
        function exportGovTableCSV() {
            if (!currentGovData.length) return;
            // Standard CSV Build Strategy using PapaParse logic or manual encoding
            let csvContent = "\uFEFF"; // BOM for excel UTF-8
            csvContent += "क्र.,खसरा नं.,बसरा नं.,रकबा (हे.),भूमिस्वामी का नाम,निस्तार विवरण\n";

            currentGovData.forEach((r, i) => {
                let row = [
                    i + 1,
                    `"${r.kn}"`,
                    `"${r.bn || ''}"`,
                    `"${r.area}"`,
                    `"${(r.owner || '').replace(/"/g, '""')}"`,
                    `"${(r.nistar || '').replace(/"/g, '""')}"`
                ];
                csvContent += row.join(",") + "\n";
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${currentGovTitle.replace(/\s+/g, '_')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Export PDF Function (Similar to Lovable styling logic)
        function exportGovTablePDF() {
            if (!currentGovData.length) return;

            const rowsHtml = currentGovData.map((r, i) => `
              <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
                <td style="text-align:center;font-weight:800;">${i + 1}</td>
                <td style="font-weight:800;text-align:center;">${r.kn}</td>
                <td style="text-align:center;">${r.bn || '—'}</td>
                <td style="text-align:center;font-weight:800;">${r.area}</td>
                <td>${r.owner}</td>
                <td style="font-size:12px;">${r.nistar || '—'}</td>
              </tr>`).join('');

            const totalArea = currentGovData.reduce((s, r) => s + parseFloat(r.area || 0), 0).toFixed(3);

            const pw = window.open('', '_blank');
            if (!pw) { toast('Popup blocked! Allow popups and try again.', 'error'); return; }

            pw.document.write(`<!DOCTYPE html>
<html lang="hi"><head>
<meta charset="UTF-8">
<title>${currentGovTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: hsl(224, 71%, 4%);
  --fg: hsl(213, 31%, 91%);
  --card: hsl(224, 60%, 7%);
  --primary: hsl(230, 70%, 60%);
  --primary-h: 230;
  --muted: hsl(220, 45%, 12%);
  --muted-fg: hsl(215, 20%, 55%);
  --border: hsl(220, 40%, 18%);
  --accent: hsl(262, 60%, 55%);
  --success: hsl(142, 70%, 40%);
  --warning: hsl(38, 85%, 50%);
  --info: hsl(200, 75%, 50%);
  --gradient-primary: linear-gradient(135deg, hsl(230, 70%, 55%) 0%, hsl(262, 60%, 50%) 100%);
  --glass-bg: hsla(224, 60%, 10%, 0.7);
  --glass-border: hsla(213, 31%, 91%, 0.08);
  --glass-shadow: 0 8px 32px hsla(224, 71%, 4%, 0.6);
  --shadow-glow: 0 0 40px hsla(230, 70%, 60%, 0.25);
  --shadow-card: 0 4px 24px hsla(224, 71%, 4%, 0.5);
}

body {
  font-family: 'Noto Sans Devanagari', 'Inter', sans-serif;
  background: linear-gradient(135deg, hsl(224, 71%, 4%) 0%, hsl(240, 60%, 8%) 50%, hsl(262, 50%, 10%) 100%);
  min-height: 100vh;
  color: var(--fg);
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--muted); }
::-webkit-scrollbar-thumb { background: hsla(230, 70%, 60%, 0.5); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--primary); }

/* Utilities */
.glass-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(20px);
}

.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.btn-primary {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  color: white;
  font-weight: 600;
  border-radius: 12px;
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  font-family: inherit;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 60px hsla(230, 70%, 60%, 0.4);
}

.btn-primary:active { transform: translateY(0); }

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.stat-card {
  background: linear-gradient(135deg, hsl(224, 60%, 9%) 0%, hsl(230, 55%, 12%) 100%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-glow);
  border-color: hsla(230, 70%, 60%, 0.3);
}

.badge-success { background: hsla(142, 70%, 40%, 0.2); color: hsl(142, 70%, 65%); border: 1px solid hsla(142, 70%, 40%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-warning { background: hsla(38, 85%, 50%, 0.2); color: hsl(38, 85%, 70%); border: 1px solid hsla(38, 85%, 50%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-error { background: hsla(0, 72%, 51%, 0.2); color: hsl(0, 72%, 75%); border: 1px solid hsla(0, 72%, 51%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.badge-info { background: hsla(200, 75%, 50%, 0.2); color: hsl(200, 75%, 75%); border: 1px solid hsla(200, 75%, 50%, 0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }

.input-glass {
  background: hsla(220, 40%, 10%, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--fg);
  border-radius: 12px;
  padding: 12px 16px;
  width: 100%;
  transition: all 0.2s;
  outline: none;
  font-family: inherit;
  font-size: 14px;
}

.input-glass:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}

.input-glass:disabled {
  background: hsla(220, 40%, 10%, 0.4);
  color: var(--muted-fg);
  cursor: not-allowed;
}

/* Header */
header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: hsla(224, 65%, 5%, 0.85);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(20px);
}

.header-inner {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 16px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.logo-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  flex-shrink: 0;
}

.logo-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--fg);
  line-height: 1.2;
}

.logo-sub {
  font-size: 13px;
  color: var(--muted-fg);
  font-weight: 600;
  font-family: serif;
}

nav.desktop {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  color: var(--muted-fg);
  background: transparent;
}

.nav-btn:hover:not(.active) {
  background: hsla(220, 50%, 15%, 0.6);
  color: var(--fg);
}

.nav-btn.active {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow);
  color: white;
}

.menu-btn {
  display: none;
  padding: 8px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  font-size: 20px;
}

.mobile-nav {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: hsl(224, 65%, 5%);
  border-top: 1px solid var(--border);
}

.mobile-nav .nav-btn {
  width: 100%;
  text-align: left;
  justify-content: flex-start;
}

/* Bottom Nav */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: hsla(224, 65%, 5%, 0.95);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(20px);
}

.bottom-nav-inner {
  display: flex;
}

.bottom-nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  font-size: 11px;
  font-weight: 500;
  color: var(--muted-fg);
}

.bottom-nav-btn.active {
  color: var(--primary);
}


/* Form Labels and Select */
.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--muted-fg);
  margin-bottom: 8px;
}

.form-select, .form-input {
  background: hsla(220, 40%, 10%, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--fg);
  border-radius: 12px;
  padding: 14px 18px;
  width: 100%;
  font-size: 15px;
  font-weight: 500;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
}

.form-select:focus, .form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}

.form-select:disabled, .form-input:disabled {
  background: hsla(220, 40%, 10%, 0.4);
  color: var(--muted-fg);
  cursor: not-allowed;
}

.select-wrap {
  position: relative;
}
.select-wrap::after {
  content: '▼';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-fg);
  font-size: 12px;
  pointer-events: none;
}

/* Spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid hsla(230, 70%, 60%, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Empty State */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
  background: hsla(224, 60%, 10%, 0.5);
  border: 1px dashed var(--border);
  border-radius: 24px;
  animation: fadeUp 0.4s ease;
}

/* Result Cards Layout Grid */
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

/* Individual Result Card mimicking the new design's glass-card inside */
.result-card, .dash-section {
  background: hsla(220, 40%, 10%, 0.6);
  border-radius: 20px;
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: all 0.3s;
  animation: fadeUp 0.4s ease both;
}
.result-card:hover { border-color: hsla(230, 70%, 60%, 0.3); box-shadow: var(--shadow-glow); transform: translateY(-3px); }

.card-header-khasra { background: var(--gradient-primary); }
.card-header-basra { background: linear-gradient(135deg, hsl(142, 60%, 45%), hsl(142, 70%, 35%)); }
.card-header-nam { background: linear-gradient(135deg, hsl(280, 60%, 55%), hsl(280, 70%, 45%)); }

.card-kn {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  color: #fff;
}

.stat-chip {
  background: hsla(224, 60%, 15%, 0.6);
  border-radius: 12px;
  padding: 12px 14px;
  text-align: center;
  border: 1px solid var(--border);
}

.stat-chip-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-fg);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-chip-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--fg);
  margin-top: 4px;
}

/* Portfolio Banner */
.portfolio-banner {
  background: var(--gradient-primary);
  border-radius: 24px;
  color: #fff;
  padding: 24px;
  box-shadow: var(--shadow-glow);
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.4s ease both;
}
.portfolio-banner::before {
  content: '';
  position: absolute;
  top: -60%;
  right: -10%;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%);
  pointer-events: none;
}
.pf-stat {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  padding: 12px 18px;
  text-align: center;
}
.pf-stat-label { font-size: 11px; font-weight: 700; opacity: 0.8; text-transform: uppercase; }
.pf-stat-val { font-size: 24px; font-weight: 800; margin-top: 4px; }


/* Dashboard Counters and Charts */
.dash-counter {
  animation: fadeUp 0.6s ease both;
}
.dash-section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--fg);
  margin-bottom: 16px;
}
.dash-search-wrap {
  position: relative;
  margin-bottom: 24px;
}
.dash-search-input {
  width: 100%;
  padding: 14px 18px 14px 44px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: var(--fg);
  background: hsla(220, 40%, 10%, 0.8);
  outline: none;
  transition: all 0.2s;
}
.dash-search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 70%, 60%, 0.15);
}
.dash-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-fg);
  pointer-events: none;
}

.bar-chart-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.bar-label {
  width: 120px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bar-track {
  flex: 1;
  height: 24px;
  background: hsla(220, 40%, 15%, 0.8);
  border-radius: 6px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 1s cubic-bezier(.4, 0, .2, 1);
}
.bar-val {
  width: 60px;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted-fg);
  text-align: right;
}
.lb-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: hsla(220, 40%, 15%, 0.4);
  border: 1px solid var(--border);
  transition: background 0.2s;
  margin-bottom: 10px;
  animation: fadeUp 0.4s ease both;
}
.lb-row:hover { background: hsla(220, 40%, 20%, 0.6); }
.lb-rank {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--gradient-primary);
  color: #fff; font-size: 15px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.lb-rank.gold { background: linear-gradient(135deg, hsl(38, 90%, 55%), hsl(38, 90%, 45%)); }
.lb-rank.silver { background: linear-gradient(135deg, hsl(220, 20%, 65%), hsl(220, 20%, 50%)); }
.lb-rank.bronze { background: linear-gradient(135deg, hsl(25, 75%, 50%), hsl(25, 75%, 35%)); }
.lb-name {
  flex: 1; font-size: 15px; font-weight: 600; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lb-stat-val { font-size: 15px; font-weight: 800; color: var(--primary); }
.lb-stat-lbl { font-size: 11px; font-weight: 600; color: var(--muted-fg); }


@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeUp 0.4s ease both; }

@media (max-width: 768px) {
  nav.desktop { display: none; }
  .menu-btn { display: block; }
  .bottom-nav { display: block; }
  main { padding-bottom: 80px; }
  .dash-counter { padding: 14px; }
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .results-grid { grid-template-columns: 1fr; }
}
@media (min-width: 769px) {
  .mobile-nav { display: none !important; }
}

</style></head><body>
<h1>🏛️ ${currentGovTitle}</h1>
<p class="subtitle">दिनांक: ${new Date().toLocaleDateString('hi-IN')}</p>
<div class="summary">
  <div class="summary-item"><div class="val">${currentGovData.length}</div><div class="lbl">कुल खसरे</div></div>
  <div class="summary-item"><div class="val">${totalArea} हे.</div><div class="lbl">कुल क्षेत्रफल</div></div>
</div>
<table>
  <thead><tr>
     <th style="width:50px;">क्र.</th>
     <th>खसरा नं.</th>
     <th>बसरा नं.</th>
     <th>रकबा (हे.)</th>
     <th style="width:30%;">भूमिस्वामी का नाम</th>
     <th style="width:30%;">निस्तार विवरण</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<p class="footer">भूमि रिकॉर्ड डैशबोर्ड — हल्का 43 एवं 28 | कम्प्यूटर जनित रिकॉर्ड</p>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
            pw.document.close();
        }

        // ── Init ──────────────────────────────────────
        switchTab('dashboard'); // Ensure dashboard is shown on load (hides search form)
        loadData();

    