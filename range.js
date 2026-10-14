(() => {
  'use strict';
  const range = document.querySelector('#range');
  const canvas = document.querySelector('#combat-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const crosshair = document.querySelector('#crosshair');
  const notice = document.querySelector('#hit-notice');
  const autoOpen = document.querySelector('#auto-open');
  const soundButton = document.querySelector('#sound-toggle');
  const buttons = [...document.querySelectorAll('.weapon')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const configs = {
    sword: { name: 'EDGE / LONGSWORD', hint: '검기 · 베기 궤적', duration: 230, color: '#a5efff', icon: '<path d="M18 31L43 6L43 17L24 36M36 13L24 29M15 27L28 40M13 40L20 33M10 39L14 43"/>' },
    bow: { name: 'ASH / LONGBOW', hint: '플레이어 위치에서 발사 · 화살 관통', duration: 690, color: '#e5d39d', icon: '<path d="M21 4Q52 24 21 44L29 24ZM8 24H49M42 18L49 24L42 30M9 18L15 24L9 30"/>' },
    gun: { name: 'VX-07 / RIFLE', hint: '총구 화염 · 반동 · 탄피', duration: 110, color: '#ffe6a2', icon: '<path d="M6 19H38V28H17L9 33L6 29ZM38 22H50M30 19V14H38M21 28L25 39H31L29 28M10 19V15H15"/>' },
    staff: { name: 'EMBER / FIRESTAFF', hint: '파이어볼 · 불꽃 꼬리 · 폭발', duration: 850, color: '#ff862b', icon: '<path d="M19 43L32 17M26 17L23 8L31 3L41 8L39 18L32 22Z"/><path d="M31 14Q24 10 34 6Q32 10 38 12L34 17Z"/>' },
    dagger: { name: 'FANG / THROWING KNIFE', hint: '회전 투척 · 칼날 박힘 · 충격', duration: 620, color: '#c4e7e8', icon: '<path d="M23 30L26 8L36 3L38 15L29 34ZM19 29L32 37M16 41L23 33M14 42L18 45"/>' }
  };
  let weapon = 'gun', width = 1, height = 1, selectedAt = 0;
  let pointer = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
  let lastFire = -1000, lastFrame = 0, recoil = 0, flash = 0;
  let shots = [], particles = [], marks = [], rings = [], slashes = [];
  let raf = 0, visible = false, sound = false, audio = null, navigationTimer = 0, messageTimer = 0;
  let clock = performance.now();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const random = (a, b) => a + Math.random() * (b - a);

  function setNotice(text) {
    clearTimeout(messageTimer);
    notice.textContent = text;
    messageTimer = setTimeout(() => { notice.textContent = ''; }, 2200);
  }
  function cancelNavigation() {
    clearTimeout(navigationTimer);
    navigationTimer = 0;
    for (const shot of shots) shot.navigate = false;
  }
  // Scrolling always belongs to the visitor, including while a shot is in flight.
  window.addEventListener('wheel', cancelNavigation, { passive: true });
  window.addEventListener('touchmove', cancelNavigation, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (['Escape', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(e.key)) cancelNavigation();
  });
  autoOpen.addEventListener('change', cancelNavigation);

  function selectWeapon(key) {
    cancelNavigation();
    weapon = key;
    selectedAt = performance.now();
    range.dataset.weapon = key;
    document.querySelector('#weapon-readout').textContent = configs[key].name;
    document.querySelector('#weapon-hint').textContent = configs[key].hint;
    buttons.forEach((button) => {
      const selected = button.dataset.weapon === key;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }
  buttons.forEach((button, index) => {
    button.querySelector('.weapon-icon').innerHTML = '<svg viewBox="0 0 56 48" aria-hidden="true">' + configs[button.dataset.weapon].icon + '</svg>';
    button.addEventListener('click', () => selectWeapon(button.dataset.weapon));
    button.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
      selectWeapon(buttons[next].dataset.weapon);
    });
  });
  selectWeapon(weapon);

  function tone(type, impact = false) {
    if (!sound || !audio) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type === 'staff' ? 'sawtooth' : 'triangle';
    const freq = impact ? (type === 'dagger' ? 320 : 90) : ({gun:170, bow:480, dagger:650, staff:150, sword:780}[type]);
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, freq * .12), now + .18);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.08, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .22);
    osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + .24);
    // A short filtered noise layer gives wood impacts and fire a physical texture.
    const buffer = audio.createBuffer(1, audio.sampleRate * .22, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), noiseGain = audio.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = impact ? 1200 : 3500;
    noiseGain.gain.value = type === 'staff' ? .13 : .07;
    source.connect(filter); filter.connect(noiseGain); noiseGain.connect(audio.destination); source.start(now);
  }
  soundButton.addEventListener('click', async () => {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      await audio.resume();
      sound = !sound;
      soundButton.textContent = sound ? '사운드 ON' : '사운드 OFF';
      soundButton.setAttribute('aria-pressed', String(sound));
    } catch { setNotice('이 브라우저에서는 사운드를 사용할 수 없습니다.'); }
  });

  function resize() {
    const bounds = range.getBoundingClientRect();
    width = range.clientWidth; height = range.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    pointer = { x: width / 2, y: height * .45 }; aim = { ...pointer };
    shots = []; marks = []; particles = []; rings = []; slashes = [];
    cancelNavigation();
    draw(performance.now(), 0);
  }
  new ResizeObserver(resize).observe(range);
  function point(clientX, clientY) {
    const box = range.getBoundingClientRect();
    return { x: clamp(clientX - box.left - range.clientLeft, 0, width), y: clamp(clientY - box.top - range.clientTop, 0, height) };
  }
  range.addEventListener('pointermove', (e) => {
    pointer = point(e.clientX, e.clientY);
    crosshair.style.left = pointer.x + 'px'; crosshair.style.top = pointer.y + 'px';
  });
  function pose(now) {
    const scale = clamp(width / 1150, .55, 1.15);
    const sway = reducedMotion.matches ? 0 : Math.sin(now / 800) * 2;
    const x = width * .72 + (aim.x - width / 2) * .024;
    const y = height * .96 + sway + recoil * 20;
    const angle = Math.atan2(aim.y - y, aim.x - x);
    return { x, y, scale, angle, tipX: x + Math.cos(angle) * 140 * scale, tipY: y + Math.sin(angle) * 140 * scale };
  }
  function emit(x, y, count, color, force = 180, smoke = false) {
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2), speed = random(force * .2, force);
      particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:random(.3,.75),max:.75,size:random(1.2,smoke ? 13 : 4),color,smoke});
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }
  function fire(end, target) {
    const now = performance.now();
    if (now - lastFire < (weapon === 'gun' ? 200 : 520)) return;
    lastFire = now;
    cancelNavigation();
    aim = { ...end }; pointer = { ...end };
    const p = pose(now), config = configs[weapon];
    const duration = reducedMotion.matches ? 140 : config.duration;
    shots.push({ type:weapon, start:{x:p.tipX,y:p.tipY}, end, target, startAt:now, duration, trail:[], navigate:autoOpen.checked, angle:p.angle });
    recoil = reducedMotion.matches ? 0 : 1;
    tone(weapon);
    if (weapon === 'gun') {
      flash = 1;
      emit(p.tipX, p.tipY, 10, '#fff1b7', 90);
      particles.push({ x:p.x,y:p.y-45,vx:160,vy:-170,life:.8,max:.8,size:4,color:'#c3a967',shell:true });
    }
    if (weapon === 'sword') slashes.push({x:end.x,y:end.y,life:.3,max:.3});
    if (weapon === 'staff') emit(p.tipX, p.tipY, 10, '#ffad4f', 100);
  }
  range.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    const target = e.target.closest('.target');
    // Native button clicks cover keyboard Enter/Space as well as mouse and touch.
    if (e.detail === 0 && target) {
      const box = target.querySelector('.dummy').getBoundingClientRect();
      fire(point(box.left + box.width / 2, box.top + box.height * .47), target);
    } else fire(point(e.clientX, e.clientY), target);
  });
  function impact(shot, now) {
    const {type, end, target} = shot;
    const color = configs[type].color;
    tone(type, true);
    emit(end.x, end.y, reducedMotion.matches ? 5 : type === 'staff' ? 60 : 22, type === 'staff' ? '#ffb255' : '#d5b780', type === 'staff' ? 260 : 150);
    if (type === 'staff') {
      emit(end.x, end.y, 12, '#39434a', 90, true);
      rings.push({x:end.x,y:end.y,life:.55,max:.55,color});
    }
    marks.push({x:end.x,y:end.y,type,angle:shot.angle,at:now,life:target ? 18000 : 3000,target:!!target});
    if (marks.length > 24) marks.shift();
    if (!target) { setNotice('MISS / 다시 조준하세요'); return; }
    target.classList.remove('is-hit');
    void target.offsetWidth;
    target.classList.add('is-hit');
    target.addEventListener('animationend', () => target.classList.remove('is-hit'), { once:true });
    crosshair.classList.add('confirmed');
    setTimeout(() => crosshair.classList.remove('confirmed'), 220);
    const title = target.querySelector('strong').textContent;
    const navigate = shot.navigate && autoOpen.checked;
    setNotice((type === 'dagger' ? 'STUCK' : type === 'staff' ? 'DIRECT HIT' : 'HIT CONFIRMED') + ' / ' + title + (navigate ? ' — 이동합니다' : ''));
    if (navigate) {
      navigationTimer = setTimeout(() => {
        const destination = document.querySelector(target.dataset.destination);
        destination?.scrollIntoView({behavior:reducedMotion.matches ? 'instant' : 'smooth',block:'start'});
        if (destination) {
          destination.setAttribute('tabindex','-1');
          destination.focus({preventScroll:true});
        }
        navigationTimer = 0;
      }, 1000);
    }
  }
  function polygon(points, fill, stroke) {
    ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke(); }
  }
  function line(points, color, thickness=1) {
    ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.stroke();
  }
  function blade(length = 80) {
    polygon([[0,0],[-length*.67,-10],[-length*.76,0],[-length*.67,10]],'#c5d6d4','#eff9ed');
    polygon([[0,0],[-length*.76,0],[-length*.67,10]],'#526e74');
    ctx.fillStyle='#b39160';ctx.fillRect(-length*.8,-14,5,28);
    ctx.fillStyle='#263b40';ctx.fillRect(-length,-6,length*.22,12);
    for(let i=0;i<4;i++) line([[-length+i*4,-6],[-length+i*4,6]],'#728079');
  }
  function arrow(length=90) {
    line([[-length,0],[-7,0]],'#d4b27c',3);
    line([[-length,1],[-7,1]],'#53462b');
    polygon([[0,0],[-15,-5],[-12,0],[-15,5]],'#dce9df','#8aabae');
    polygon([[-length+8,0],[-length+19,-7],[-length+5,-6],[-length-2,0]],'#a5c9bd');
    polygon([[-length+8,0],[-length+19,7],[-length+5,6],[-length-2,0]],'#597976');
  }
  function fireball(radius, now) {
    ctx.save();ctx.globalCompositeOperation='lighter';
    const glow=ctx.createRadialGradient(0,0,0,0,0,radius*3);
    glow.addColorStop(0,'#fff8bf');glow.addColorStop(.2,'#ffd765');glow.addColorStop(.43,'#ff771ccc');glow.addColorStop(1,'#ff350000');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,radius*3,0,Math.PI*2);ctx.fill();
    for(let i=0;i<4;i++) {
      ctx.rotate(now/1500+i);
      ctx.strokeStyle=i%2?'#fff0a0':'#ff7c2d';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(0,0,radius,radius*.53,0,.3,4.8);ctx.stroke();
    }
    ctx.restore();
  }
  function drawWeapon(now) {
    const p=pose(now);
    const equip=reducedMotion.matches?0:Math.max(0,1-(now-selectedAt)/300)*90;
    ctx.save();ctx.translate(p.x,p.y+equip);ctx.rotate(p.angle);ctx.scale(p.scale,p.scale);
    // Sleeved forearm and glove in the same perspective as the held weapon.
    polygon([[-115,-32],[-10,-26],[25,-10],[22,29],[-115,48]],'#182b33','#3e555b');
    polygon([[-12,-25],[27,-18],[44,4],[19,29],[-10,26]],'#3c4847','#758077');
    if(weapon==='gun') {
      polygon([[-55,-31],[50,-26],[94,-13],[101,14],[42,26],[-51,26]],'#18252b','#5e7b7e');
      polygon([[18,-28],[87,-21],[105,-8],[41,-9]],'#667978','#93a69c');
      polygon([[35,24],[58,22],[44,66],[23,63]],'#202c31','#657572');
      ctx.fillStyle='#10191f';ctx.fillRect(83,-9,63,18);ctx.fillStyle='#587371';ctx.fillRect(111,-8,10,16);
      ctx.fillStyle='#12212a';ctx.fillRect(40,-38,23,18);ctx.strokeStyle='#acc0af';ctx.strokeRect(49,-39,9,12);
      for(let i=0;i<6;i++) line([[i*9,-13],[i*9,13]],'#3c5155',3);
      line([[-30,9],[4,9]],'#d2b279',3);
      if(flash>.05) {
        ctx.save();ctx.translate(148,0);ctx.globalAlpha=flash;fireball(13,now);ctx.restore();
      }
    } else if(weapon==='bow') {
      ctx.strokeStyle='#866b47';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(55,-110);ctx.quadraticCurveTo(136,0,55,110);ctx.stroke();
      ctx.strokeStyle='#c6ab74';ctx.lineWidth=3;ctx.stroke();
      line([[55,-110],[recoil>0.2?70:0,0],[55,110]],'#c4d0bd',1.4);
      if(recoil<.25) { ctx.save();ctx.translate(142,0);arrow(160);ctx.restore(); }
    } else if(weapon==='staff') {
      polygon([[-120,-8],[107,-9],[114,6],[-120,13]],'#6a4c30','#b79c65');
      for(let i=0;i<5;i++) line([[40+i*8,-9],[43+i*8,8]],'#b29b66',3);
      polygon([[100,-12],[123,-30],[149,-18],[158,0],[149,18],[123,30],[100,12],[122,15],[140,0],[122,-15]],'#846946','#ccae76');
      ctx.save();ctx.translate(137,0);fireball(11+Math.sin(now/250),now);ctx.restore();
    } else {
      ctx.save();ctx.translate(weapon==='sword'?235:140,0);
      if(weapon==='sword') { ctx.rotate(-recoil*.65);blade(265); } else if(recoil<.5) blade(148);
      ctx.restore();
    }
    ctx.restore();
  }
  function draw(now, dt) {
    ctx.clearRect(0,0,width,height);
    aim.x=mix(aim.x,pointer.x,Math.min(1,dt*13));aim.y=mix(aim.y,pointer.y,Math.min(1,dt*13));
    recoil=Math.max(0,recoil-dt*4);flash=Math.max(0,flash-dt*12);
    marks=marks.filter(m=>now-m.at<m.life);
    for(const mark of marks) {
      ctx.save();ctx.translate(mark.x,mark.y);ctx.rotate(mark.angle);
      ctx.globalAlpha=Math.min(1,(mark.life-(now-mark.at))/700);
      if(mark.type==='bow'||mark.type==='dagger') {
        // The tip stays anchored. Only the protruding shaft/handle vibrates on impact.
        const age=(now-mark.at)/1000;
        ctx.rotate(reducedMotion.matches?0:Math.sin(age*65)*Math.exp(-age*11)*.1);
        ctx.scale(.62,.62);
        if(mark.type==='bow') arrow(96); else blade(83);
      } else {
        ctx.fillStyle='#0b100dd9';ctx.beginPath();ctx.ellipse(0,0,mark.type==='staff'?20:4,mark.type==='staff'?13:4,0,0,Math.PI*2);ctx.fill();
        if(mark.type==='sword') line([[-28,14],[24,-17]],'#e9e0b7',2);
      }ctx.restore();
    }
    for(const ring of rings) {
      ring.life-=dt;const progress=1-ring.life/ring.max;
      ctx.save();ctx.globalAlpha=Math.max(0,1-progress);ctx.strokeStyle=ring.color;ctx.lineWidth=4*(1-progress);
      ctx.beginPath();ctx.arc(ring.x,ring.y,8+progress*75,0,Math.PI*2);ctx.stroke();ctx.restore();
    }rings=rings.filter(r=>r.life>0);
    shots=shots.filter(shot=>{
      const t=clamp((now-shot.startAt)/shot.duration,0,1);
      // Shrinking perspective makes the projectile travel away from the viewer.
      const arc=shot.type==='bow'?Math.sin(t*Math.PI)*height*.12:shot.type==='dagger'?Math.sin(t*Math.PI)*height*.055:0;
      const x=mix(shot.start.x,shot.end.x,t),y=mix(shot.start.y,shot.end.y,t)-arc;
      const angle=Math.atan2(shot.end.y-shot.start.y-(shot.type==='bow'?Math.cos(t*Math.PI)*height*.12*Math.PI:0),shot.end.x-shot.start.x);
      shot.trail.push({x,y});if(shot.trail.length>13)shot.trail.shift();
      for(let i=1;i<shot.trail.length;i++) {
        ctx.save();ctx.globalAlpha=(i/shot.trail.length)*.4;
        line([[shot.trail[i-1].x,shot.trail[i-1].y],[shot.trail[i].x,shot.trail[i].y]],configs[shot.type].color,shot.type==='staff'?12*(1-t)+3:2);ctx.restore();
      }
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);const scale=mix(1.55,.62,t);ctx.scale(scale,scale);
      if(shot.type==='bow') arrow();
      if(shot.type==='dagger') { ctx.rotate(reducedMotion.matches?0:-Math.PI*4*(1-t));blade(); }
      if(shot.type==='staff') { fireball(12,now); if(!reducedMotion.matches)emit(x,y,2,'#ff952c',35); }
      if(shot.type==='gun') line([[0,0],[-30,0]],'#fff8cb',3);
      ctx.restore();
      if(t>=1) {impact(shot,now);return false;}return true;
    });
    for(const slash of slashes) {
      slash.life-=dt;const t=1-slash.life/slash.max;
      ctx.save();ctx.translate(slash.x,slash.y);ctx.rotate(-.7);ctx.globalAlpha=Math.max(0,1-t);
      ctx.strokeStyle='#dbfcff';ctx.shadowColor='#57d4ff';ctx.shadowBlur=18;ctx.lineWidth=6*(1-t);
      ctx.beginPath();ctx.ellipse(0,0,140,40,0,Math.PI*(1-t),Math.PI*(2-t));ctx.stroke();ctx.restore();
    }slashes=slashes.filter(s=>s.life>0);
    for(const particle of particles) {
      particle.life-=dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.vy+=(particle.smoke?-35:240)*dt;
      ctx.save();ctx.globalAlpha=clamp(particle.life/particle.max,0,1);ctx.fillStyle=particle.color;
      if(particle.smoke) {ctx.beginPath();ctx.arc(particle.x,particle.y,particle.size+(1-particle.life/particle.max)*15,0,Math.PI*2);ctx.fill();}
      else {ctx.translate(particle.x,particle.y);ctx.rotate(now/100);ctx.fillRect(0,0,particle.size,particle.shell?particle.size*2:particle.size*.5);}
      ctx.restore();
    }particles=particles.filter(p=>p.life>0);
    drawWeapon(now);
  }
  function loop(now) {
    if(!visible||document.hidden) {raf=0;return;}
    if(now-lastFrame>=1000/60) {
      const dt=Math.min((now-clock)/1000,.05);clock=now;lastFrame=now;
      draw(now,dt);
    }
    raf=requestAnimationFrame(loop);
  }
  function start() {if(!raf&&visible&&!document.hidden){clock=performance.now();raf=requestAnimationFrame(loop);}}
  new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;
    if(visible)start();else{cancelNavigation();shots=[];}
  },{threshold:.05}).observe(range);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelNavigation();shots=[];}else start();
  });
  resize();
})();
