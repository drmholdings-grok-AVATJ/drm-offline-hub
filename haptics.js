// DRM Hub haptics: Xbox/PlayStation controllers (Gamepad API) + Android phones (navigator.vibrate).
// A pattern is [vibrate ms, pause ms, vibrate ms, ...] — same format as navigator.vibrate.
(function(){
  const H = { strength: 0.8, enabled: true, log: [] };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function pads(){
    const list = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(Boolean);
    return list.filter(p => p.vibrationActuator || (p.hapticActuators && p.hapticActuators.length));
  }
  H.devices = function(){
    const out = pads().map(p => p.id);
    if (typeof navigator.vibrate === 'function' && /Android|Mobi/i.test(navigator.userAgent)) out.push('Phone vibration');
    return out;
  };

  async function pulsePad(p, ms){
    const s = H.strength;
    try{
      if (p.vibrationActuator && p.vibrationActuator.playEffect){
        await p.vibrationActuator.playEffect(p.vibrationActuator.type || 'dual-rumble',
          {startDelay:0, duration:ms, strongMagnitude:s, weakMagnitude:Math.min(1,s*0.9)});
        return true;
      }
      if (p.hapticActuators && p.hapticActuators[0] && p.hapticActuators[0].pulse){
        await p.hapticActuators[0].pulse(s, ms); return true;
      }
    }catch(e){ console.warn('pad haptic failed', e); }
    return false;
  }

  // Plays the pattern on every haptic device found. Returns list of channels used.
  H.play = async function(pattern, opts={}){
    if (!H.enabled && !opts.force) return [];
    pattern = (pattern || []).map(n => Math.max(0, Math.min(2000, Number(n)||0)));
    if (!pattern.length) return [];
    const used = [];
    if (typeof navigator.vibrate === 'function'){
      try{ if (navigator.vibrate(pattern)) used.push('navigator.vibrate'); }catch(e){}
    }
    const ps = pads();
    if (ps.length){
      used.push(...ps.map(p => 'gamepad:' + p.id));
      (async () => {
        for (let i=0;i<pattern.length;i++){
          if (i % 2 === 0) await Promise.all(ps.map(p => pulsePad(p, pattern[i])));
          else await sleep(pattern[i]);
        }
      })();
    }
    H.log.push({t:Date.now(), pattern, used});
    window.dispatchEvent(new CustomEvent('haptic', {detail:{pattern, used}}));
    return used;
  };

  H.parse = s => String(s||'').split(/[ ,]+/).map(Number).filter(n => !isNaN(n) && n >= 0).slice(0, 20);
  H.presets = [
    {name:'Double tap', pattern:[60,80,60]},
    {name:'Heartbeat 108 BPM', pattern:[120,160,60,215]},
    {name:'Flutter', pattern:[30,40,30,40,30,40,90]},
    {name:'Long-short-long stamp', pattern:[250,100,70,100,250]},
    {name:'Rising triple', pattern:[40,70,80,70,140]},
    {name:'Wave (Cane Bay)', pattern:[50,50,100,50,150,50,100,50,50]},
    {name:'Single long', pattern:[400]},
    {name:'SOS', pattern:[80,60,80,60,80,150,240,60,240,60,240,150,80,60,80,60,80]},
  ];
  window.DRMHaptics = H;
})();
