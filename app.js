/* DRM Offline Agent Hub — pure static, no network except the local Ollama API. */
(function(){
'use strict';
const P = window.DRM_PROFILES, HAP = window.DRMHaptics;
const LS = { agents:'drmhub.agents.v1', hist:'drmhub.history.', settings:'drmhub.settings.v1', active:'drmhub.active' };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const load = (k, d) => { try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } };
const save = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ toast('Storage full — export a backup and remove big uploads.'); return false; } };

let settings = Object.assign({url:'http://localhost:11434', model:'llama3.2:3b', ctx:16, strength:0.8, haptics:true}, load(LS.settings, {}));
let agents = load(LS.agents, null);
if (!Array.isArray(agents) || !agents.length) agents = starterAgents();
let active = localStorage.getItem(LS.active) || agents[0].id;
let llmOk = false, abortCtl = null, editing = null, chosenAvatar = null;

function starterAgents(){
  return P.agents.map(a => ({ id:a.id, name:a.name, role:a.role, agency:a.agency, avatar:a.avatar, color:a.color,
    prompt:a.prompt, duties:a.duties, greeting:a.greeting, haptic:a.haptic.pattern, hapticName:a.haptic.name,
    memory:'', starter:true, created:Date.now() }));
}
function persistAgents(){ save(LS.agents, agents); }
function hist(id){ return load(LS.hist + id, []); }
function setHist(id, h){ save(LS.hist + id, h.slice(-200)); }
function agent(id){ return agents.find(a => a.id === id); }
function toast(t){ const d = document.createElement('div'); d.className='toast'; d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(), 2600); }

/* ---------- Tabs / views ---------- */
function show(view){
  ['chatView','adoptView','settingsView'].forEach(v => $(v).hidden = v !== view);
}
function renderTabs(){
  const t = $('tabs'); t.innerHTML = '';
  agents.forEach(a => {
    const b = document.createElement('button');
    b.className = 'tab' + (a.id === active && !$('chatView').hidden ? ' active' : '');
    b.style.setProperty('--c', a.color || '#40e0d0');
    b.dataset.agent = a.id; b.setAttribute('role','tab');
    b.innerHTML = `<img src="${esc(a.avatar)}" alt=""><span>${esc(a.name)}</span><i class="dot"></i>`;
    b.onclick = () => openAgent(a.id);
    t.appendChild(b);
  });
  const ad = document.createElement('button'); ad.className = 'tab adopt'; ad.id = 'tabAdopt';
  ad.innerHTML = '＋ Adopt an agent'; ad.onclick = () => openAdopt(null); t.appendChild(ad);
}
function openAgent(id){
  if (!agent(id)) id = agents[0].id;
  active = id; localStorage.setItem(LS.active, id);
  show('chatView'); renderTabs(); renderCard(); renderMessages();
  $('chatInput').focus();
}

/* ---------- Agent card (independent agency) ---------- */
function renderCard(){
  const a = agent(active); document.documentElement.style.setProperty('--accent', a.color || '#40e0d0');
  $('agentCard').innerHTML = `
    <img src="${esc(a.avatar)}" alt="${esc(a.name)} avatar">
    <h3>${esc(a.name)}</h3><div class="role">${esc(a.role)}</div><div class="agency">${esc(a.agency||'')}</div>
    ${a.duties && a.duties.length ? '<ul>' + a.duties.map(d => '<li>'+esc(d)+'</li>').join('') + '</ul>' : ''}
    <div class="lbl">Haptic: ${esc(a.hapticName||'Custom')} <code>${esc((a.haptic||[]).join(','))}</code></div>
    <div class="lbl">Agent memory (pinned notes only ${esc(a.name)} sees)</div>
    <textarea id="memBox" rows="4" placeholder="e.g. Release date for SWID single: …">${esc(a.memory||'')}</textarea>
    <div class="btns">
      <button class="ghost" id="btnHapticAgent">▶ Buzz</button>
      <button class="ghost" id="btnEditAgent">✎ Edit</button>
      <button class="ghost" id="btnClear">🧹 Clear chat</button>
    </div>`;
  $('memBox').onchange = e => { a.memory = e.target.value; persistAgents(); toast('Memory saved for ' + a.name); };
  $('btnHapticAgent').onclick = () => buzz(a, true);
  $('btnEditAgent').onclick = () => openAdopt(a.id);
  $('btnClear').onclick = () => { if (confirm('Clear chat history with ' + a.name + '?')) { setHist(a.id, []); renderMessages(); } };
}

/* ---------- Messages ---------- */
function msgEl(a, m){
  const d = document.createElement('div');
  d.className = 'msg ' + (m.role === 'user' ? 'user' : 'bot') + (m.offline ? ' offline' : '');
  const av = m.role === 'user' ? '' : `<img src="${esc(a.avatar)}" alt="">`;
  const when = m.t ? new Date(m.t).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '';
  d.innerHTML = `${av}<div><div class="bubble"></div><div class="meta">${m.role==='user'?'You':esc(a.name)} · ${when}${m.offline?' · offline fallback':''}</div></div>`;
  d.querySelector('.bubble').textContent = m.content;
  return d;
}
function renderMessages(){
  const a = agent(active), box = $('messages'); box.innerHTML = '';
  let h = hist(a.id);
  if (!h.length && a.greeting){ h = [{role:'assistant', content:a.greeting, t:Date.now()}]; setHist(a.id, h); }
  h.forEach(m => box.appendChild(msgEl(a, m)));
  box.scrollTop = box.scrollHeight;
}

/* ---------- Local LLM (Ollama) ---------- */
async function checkOllama(){
  const pill = $('llmStatus'); pill.className = 'pill pill-wait'; pill.textContent = 'Checking Ollama…';
  try{
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(settings.url.replace(/\/$/,'') + '/api/tags', {signal:ctl.signal});
    const j = await r.json();
    const names = (j.models||[]).map(m => m.name);
    $('modelList').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
    llmOk = true;
    const has = names.includes(settings.model);
    pill.className = 'pill ' + (has ? 'pill-ok' : 'pill-wait');
    pill.textContent = has ? `Local AI: ${settings.model}` : `Ollama on · model "${settings.model}" not pulled`;
    pill.title = has ? 'Ollama running at ' + settings.url : 'Run: ollama pull ' + settings.model + '  (installed: ' + (names.join(', ')||'none') + ')';
  }catch(e){
    llmOk = false; pill.className = 'pill pill-bad'; pill.textContent = 'Ollama offline · fallback mode';
    pill.title = 'Could not reach ' + settings.url + '. Start it with start_hub.bat or "ollama serve".';
  }
  return llmOk;
}
function systemFor(a){
  return [a.prompt, P.hub_rules,
    a.memory ? 'Pinned memory from Jett:\n' + a.memory : '',
    'You are talking with Jett (RBJ), the human principal, in real time on his offline laptop. Keep replies short.'
  ].filter(Boolean).join('\n\n');
}
const CANNED = {
  'klaudia': 'Klaudia here. My local brain (Ollama) is off right now, so I can only take notes. Start it with start_hub.bat and ask me again — your message is saved.',
  'swid': 'SWID: local AI is offline. Your note is logged in my history. Fire up Ollama (start_hub.bat) and I\'ll pick it up. Masters stay on the red HP.',
  'jett-girlfriend': 'Aww my brain\'s napping 💨 (Ollama is off). I saved what you said — start the hub launcher and I\'m right back. Drink some water meanwhile!',
  'drm-label-desk': 'Label desk: local AI is offline. Message logged. Start Ollama to get drafts back.',
  'drm-house-promo': 'DRM House promo: local AI is offline. Logged. Start Ollama and we pick it up. we are 1.'
};
function canned(a){ return CANNED[a.id] || `${a.name}: my local AI (Ollama) is offline right now. Your message is saved here — run start_hub.bat or "ollama serve" and ask again.`; }

async function send(text){
  const a = agent(active); if (!text.trim()) return;
  const h = hist(a.id); h.push({role:'user', content:text, t:Date.now()}); setHist(a.id, h);
  const box = $('messages'); box.appendChild(msgEl(a, h[h.length-1]));
  const reply = {role:'assistant', content:'', t:Date.now()};
  const el = msgEl(a, reply); const bub = el.querySelector('.bubble'); bub.classList.add('typing');
  box.appendChild(el); box.scrollTop = box.scrollHeight;
  setBusy(true);
  if (!llmOk) await checkOllama();
  if (!llmOk){
    reply.content = canned(a); reply.offline = true; bub.textContent = reply.content; bub.classList.remove('typing');
    el.classList.add('offline'); el.querySelector('.meta').textContent += ' · offline fallback';
    finish(a, reply); return;
  }
  const msgs = [{role:'system', content:systemFor(a)}].concat(
    h.slice(-Math.max(2, settings.ctx|0)).map(m => ({role:m.role, content:m.content})));
  abortCtl = new AbortController();
  try{
    const r = await fetch(settings.url.replace(/\/$/,'') + '/api/chat', {method:'POST', signal:abortCtl.signal,
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:settings.model, messages:msgs, stream:true})});
    if (!r.ok){ const t = await r.text(); throw new Error('HTTP ' + r.status + ' ' + t.slice(0,200)); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for(;;){
      const {value, done} = await rd.read(); if (done) break;
      buf += dec.decode(value, {stream:true}); let i;
      while ((i = buf.indexOf('\n')) >= 0){
        const line = buf.slice(0, i).trim(); buf = buf.slice(i+1); if (!line) continue;
        const j = JSON.parse(line);
        if (j.error) throw new Error(j.error);
        if (j.message && j.message.content){ reply.content += j.message.content; bub.textContent = reply.content; box.scrollTop = box.scrollHeight; }
      }
    }
  }catch(e){
    if (e.name === 'AbortError') reply.content += (reply.content ? '' : '') + ' [stopped]';
    else {
      console.warn(e);
      const notPulled = /not found/i.test(e.message);
      reply.content = (reply.content ? reply.content + '\n\n' : '') + (notPulled
        ? `⚠ Model "${settings.model}" isn't installed. Open a terminal and run: ollama pull ${settings.model}` : canned(a));
      reply.offline = true; el.classList.add('offline'); llmOk = false; checkOllama();
    }
    bub.textContent = reply.content;
  }
  bub.classList.remove('typing'); finish(a, reply);
}
function finish(a, reply){
  const h = hist(a.id); h.push(reply); setHist(a.id, h); setBusy(false); abortCtl = null;
  buzz(a);
  if (a.id !== active){ const t = document.querySelector(`.tab[data-agent="${a.id}"]`); if (t) t.classList.add('unread'); }
}
function setBusy(b){ $('btnSend').disabled = b; $('btnStop').hidden = !b; }
function buzz(a, force){ HAP.strength = settings.strength; HAP.enabled = settings.haptics;
  HAP.play(a.haptic, {force}).then(used => { if (force) toast(used.length ? `Buzz → ${used.join(', ')}` : 'No haptic device found (connect a controller and press a button, or use an Android phone).'); }); }

/* ---------- Adopt / edit ---------- */
function openAdopt(id){
  editing = id ? agent(id) : null;
  show('adoptView'); renderTabs(); document.getElementById('tabAdopt').classList.toggle('active', !id);
  $('adoptTitle').textContent = editing ? 'Edit ' + editing.name : 'Adopt an agent';
  $('btnSaveAgent').textContent = editing ? 'Save changes' : 'Adopt agent';
  $('btnDeleteAgent').hidden = !editing;
  const a = editing || {name:'', role:'', agency:'', color:'#40e0d0', prompt:'', greeting:'', haptic:[60,80,60], avatar:P.bundled_avatars[0].file};
  $('fId').value = editing ? editing.id : ''; $('fName').value = a.name; $('fRole').value = a.role; $('fAgency').value = a.agency||'';
  $('fColor').value = a.color || '#40e0d0'; $('fPrompt').value = a.prompt; $('fGreeting').value = a.greeting||'';
  $('fHaptic').value = (a.haptic||[]).join(','); chosenAvatar = a.avatar;
  $('fHapticPreset').innerHTML = '<option value="">— preset —</option>' + HAP.presets.map((p,i) => `<option value="${i}">${esc(p.name)} (${p.pattern.join(',')})</option>`).join('');
  renderAvatarGrid();
  $('fName').focus();
}
function renderAvatarGrid(){
  const g = $('avatarGrid'); g.innerHTML = '';
  const list = P.bundled_avatars.slice();
  if (chosenAvatar && chosenAvatar.startsWith('data:')) list.unshift({file:chosenAvatar, label:'Your upload'});
  list.forEach(av => {
    const b = document.createElement('button'); b.type = 'button'; b.className = av.file === chosenAvatar ? 'sel' : '';
    b.innerHTML = `<img src="${esc(av.file)}" alt=""><span>${esc(av.label)}</span>`; b.title = av.label;
    b.onclick = () => { chosenAvatar = av.file; renderAvatarGrid(); };
    g.appendChild(b);
  });
}
$('fUpload').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const rdr = new FileReader();
  rdr.onload = () => { const img = new Image(); img.onload = () => {
      const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
      const m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width-m)/2, (img.height-m)/2, m, m, 0, 0, s, s);
      chosenAvatar = c.toDataURL('image/jpeg', 0.85); renderAvatarGrid(); };
    img.src = rdr.result; };
  rdr.readAsDataURL(f);
};
$('fHapticPreset').onchange = e => { const p = HAP.presets[e.target.value]; if (p) $('fHaptic').value = p.pattern.join(','); };
$('btnTestHapticForm').onclick = () => { HAP.strength = settings.strength;
  HAP.play(HAP.parse($('fHaptic').value), {force:true}).then(u => toast(u.length ? 'Buzz → ' + u.join(', ') : 'No haptic device found')); };
$('adoptForm').onsubmit = e => {
  e.preventDefault();
  const pat = HAP.parse($('fHaptic').value); const preset = HAP.presets.find(p => p.pattern.join() === pat.join());
  const data = { name:$('fName').value.trim(), role:$('fRole').value.trim(), agency:$('fAgency').value.trim(), color:$('fColor').value,
    prompt:$('fPrompt').value.trim(), greeting:$('fGreeting').value.trim(), haptic:pat.length ? pat : [100],
    hapticName: preset ? preset.name : 'Custom', avatar: chosenAvatar || P.bundled_avatars[0].file };
  if (editing){ Object.assign(editing, data); }
  else {
    let id = data.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'agent';
    while (agent(id)) id += '-2';
    agents.push(Object.assign({id, duties:[], memory:'', starter:false, created:Date.now()}, data));
    editing = agent(id);
  }
  persistAgents(); toast((data.name) + ' saved to your team'); openAgent(editing.id);
};
$('btnCancelAdopt').onclick = () => openAgent(active);
$('btnDeleteAgent').onclick = () => {
  if (!editing || agents.length < 2) return toast('Keep at least one agent.');
  if (!confirm('Release ' + editing.name + '? Their chat history is deleted too.')) return;
  localStorage.removeItem(LS.hist + editing.id); agents = agents.filter(a => a !== editing); persistAgents(); openAgent(agents[0].id);
};

/* ---------- Settings ---------- */
function openSettings(){
  show('settingsView'); renderTabs();
  $('sUrl').value = settings.url; $('sModel').value = settings.model; $('sCtx').value = settings.ctx;
  $('sStrength').value = settings.strength; $('sHaptics').checked = settings.haptics;
}
$('btnSettings').onclick = openSettings;
$('btnSaveSettings').onclick = () => {
  settings = {url:$('sUrl').value.trim() || 'http://localhost:11434', model:$('sModel').value.trim() || 'llama3.2:3b',
    ctx:Math.max(2, +$('sCtx').value || 16), strength:+$('sStrength').value, haptics:$('sHaptics').checked};
  save(LS.settings, settings); toast('Settings saved'); checkOllama();
};
$('btnRecheck').onclick = checkOllama;
$('btnTestHaptic').onclick = () => { HAP.strength = +$('sStrength').value;
  HAP.play([200,100,200], {force:true}).then(u => toast(u.length ? 'Buzz → ' + u.join(', ') : 'No haptic device found. Plug in an Xbox/PS controller and press any button on it first.')); };
$('btnExport').onclick = () => {
  const dump = {exported:new Date().toISOString(), settings, agents, history:Object.fromEntries(agents.map(a => [a.id, hist(a.id)]))};
  const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], {type:'application/json'}));
  const l = document.createElement('a'); l.href = url; l.download = 'drm-hub-backup-' + new Date().toISOString().slice(0,10) + '.json'; l.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('fImport').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { const d = JSON.parse(t);
    if (!Array.isArray(d.agents)) throw new Error('No agents in file');
    agents = d.agents; persistAgents(); if (d.history) Object.entries(d.history).forEach(([k,v]) => setHist(k, v));
    toast('Imported ' + agents.length + ' agents'); openAgent(agents[0].id);
  }).catch(err => toast('Import failed: ' + err.message));
};
$('btnReset').onclick = () => {
  if (!confirm('Reset to the 5 starter agents? Adopted agents and all chat history are removed.')) return;
  agents.forEach(a => localStorage.removeItem(LS.hist + a.id)); agents = starterAgents(); persistAgents(); openAgent(agents[0].id);
};

/* ---------- Chat input ---------- */
$('chatForm').onsubmit = e => { e.preventDefault(); const t = $('chatInput').value; $('chatInput').value = ''; send(t); };
$('chatInput').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); $('chatForm').requestSubmit(); } };
$('btnStop').onclick = () => abortCtl && abortCtl.abort();

/* ---------- Controller status ---------- */
function updatePads(){
  const d = HAP.devices(), p = $('padStatus');
  p.className = 'pill ' + (d.length ? 'pill-ok' : 'pill-off');
  p.textContent = d.length ? '🎮 ' + d[0].slice(0, 28) : 'No controller';
  p.title = d.length ? d.join('\n') : 'Plug in an Xbox/PlayStation controller and press a button. Android phones vibrate too.';
}
window.addEventListener('gamepadconnected', updatePads); window.addEventListener('gamepaddisconnected', updatePads);
setInterval(updatePads, 3000);

/* ---------- Boot ---------- */
persistAgents(); renderTabs(); openAgent(active); updatePads(); checkOllama(); setInterval(checkOllama, 30000);
window.DRMHub = { agents:() => agents, hist, send, checkOllama, settings:() => settings };
})();
