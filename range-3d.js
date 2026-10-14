import * as THREE from './vendor/three.module.min.js';

// World units are metres. +Y is up and all projectiles point along local -Z.
export function initRange() {
  const range = document.querySelector('#range');
  const canvas = document.querySelector('#three-canvas');
  const status = document.querySelector('#range-loading');
  const notice = document.querySelector('#hit-notice');
  const crosshair = document.querySelector('#crosshair');
  const autoOpen = document.querySelector('#auto-open');
  const labels = [...document.querySelectorAll('.range-label')];
  const radios = [...document.querySelectorAll('.weapon')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111b20');
  scene.fog = new THREE.Fog('#15262c', 20, 55);
  const camera = new THREE.PerspectiveCamera(48, 1, .06, 75);
  scene.add(camera);
  const ray = new THREE.Raycaster();
  const forward = new THREE.Vector3(0,0,-1);
  const mouse = new THREE.Vector2(0,0);
  const aimPoint = new THREE.Vector3(0,2.1,-3);
  const localAim=new THREE.Vector3(),anchorStates=new WeakMap(),anchorTempPosition=new THREE.Vector3(),anchorTempScale=new THREE.Vector3();
  let anchorFrame=0;
  const colliders = [], targets = [], shots = [], debris = [], marks = [], flashes = [];
  const props = [], fragments = [], wallSurfaces = [];
  const wallDurability=6;
  const maxFragments=64;
  const laneSpacing=3.5,laneXs=labels.map((_,i)=>(i-(labels.length-1)/2)*laneSpacing);
  function registerProp(root,kind,extra={}) {
    const prop={root,kind,hp:3,state:'intact',age:0,swing:0,velocity:new THREE.Vector3(),home:root.position.clone(),...extra};
    root.traverse(o=>{if(o.isMesh){o.userData.prop=prop;colliders.push(o);}});
    prop.maxHp=prop.hp;props.push(prop);return prop;
  }
  const meshes = {
    box: new THREE.BoxGeometry(1,1,1),
    ball: new THREE.SphereGeometry(1,20,14),
    cylinder: new THREE.CylinderGeometry(1,1,1,16),
    cone: new THREE.ConeGeometry(1,1,12),
    plane: new THREE.PlaneGeometry(1,1),
    ring: new THREE.TorusGeometry(1,.035,8,40),
    slash:new THREE.TorusGeometry(1,.025,4,32,Math.PI*1.35),
  };
  const mat = (color, extra={}) => new THREE.MeshStandardMaterial({color,roughness:.75,metalness:.15,...extra});
  const materials = {
    wall:mat('#263a42'),floor:mat('#344044',{roughness:.85}),metal:mat('#283941',{metalness:.65,roughness:.35}),
    edge:mat('#658084',{metalness:.75,roughness:.3}),dark:mat('#102129'),
    brass:mat('#bf965d',{metalness:.7,roughness:.35}),wood:mat('#6c4930'),
    blade:mat('#c6dfe2',{metalness:.85,roughness:.22}),rope:mat('#d1b78b'),
    red:mat('#cf8650'),bull:mat('#183737'),cloth:mat('#b49a73',{roughness:1,metalness:0}),
    glow:mat('#d0efdc',{emissive:'#b6e7d8',emissiveIntensity:3}),
    amber:mat('#d6ae6a',{emissive:'#ffb455',emissiveIntensity:.7}),
    fire: new THREE.MeshBasicMaterial({color:'#ffbd54'}),spark:new THREE.MeshBasicMaterial({color:'#ffdf9d'}),
    weaponShell:mat('#667782',{metalness:.45,roughness:.38}),
    weaponSteel:mat('#c0d0d5',{metalness:.5,roughness:.24}),
    leather:mat('#293039',{metalness:.05,roughness:.9}),
    rune:mat('#73d9ee',{emissive:'#39b8e1',emissiveIntensity:1.7,metalness:.25,roughness:.3}),
  };
  function mesh(parent, shape, material, pos, scale, shadow=true) {
    const object = new THREE.Mesh(meshes[shape],material);
    if (pos) object.position.set(...pos);
    if (scale) object.scale.set(...scale);
    object.castShadow=shadow;object.receiveShadow=shadow;
    parent.add(object);return object;
  }
  function box(parent, material, pos, scale, collision=false) {
    const object=mesh(parent,'box',material,pos,scale);
    if(collision)colliders.push(object);return object;
  }
  function tiledWall(position,size,material=materials.wall,cellSize=1.6) {
    const thin=size.indexOf(Math.min(...size));
    const axes=[0,1,2].filter(axis=>axis!==thin);
    const counts=axes.map(axis=>Math.ceil(size[axis]/cellSize));
    const step=axes.map((axis,i)=>size[axis]/counts[i]);
    const tiles=[];
    const wall=new THREE.InstancedMesh(meshes.box,material,counts[0]*counts[1]);
    wall.position.set(...position);wall.castShadow=false;wall.receiveShadow=true;
    const matrix=new THREE.Matrix4(),center=new THREE.Vector3(),scale=new THREE.Vector3(...size);
    scale.setComponent(axes[0],step[0]-.012);scale.setComponent(axes[1],step[1]-.012);
    for(let row=0;row<counts[1];row++)for(let col=0;col<counts[0];col++){
      const id=tiles.length;
      center.set(0,0,0);
      center.setComponent(axes[0],-size[axes[0]]/2+(col+.5)*step[0]);
      center.setComponent(axes[1],-size[axes[1]]/2+(row+.5)*step[1]);
      tiles.push({local:center.clone(),hp:wallDurability,broken:false});
      wall.setMatrixAt(id,matrix.compose(center,new THREE.Quaternion(),scale));
      wall.setColorAt(id,new THREE.Color(0xffffff));
    }
    wall.userData.wallSurface={tiles,scale:scale.clone(),thin};
    wall.instanceMatrix.needsUpdate=true;
    scene.add(wall);colliders.push(wall);wallSurfaces.push(wall);
    return wall;
  }
  function rod(parent,a,b,r,material) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const object=mesh(parent,'cylinder',material,start.clone().add(end).multiplyScalar(.5).toArray(),[r,start.distanceTo(end),r]);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return object;
  }
  function texture(width,height,draw) {
    const c=document.createElement('canvas');c.width=width;c.height=height;
    draw(c.getContext('2d'),width,height);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  }
  const clothTex=texture(128,128,(c,w,h)=>{
    c.fillStyle='#c4ab82';c.fillRect(0,0,w,h);
    for(let x=0;x<w;x+=4){c.fillStyle=x%8?'#b29a7370':'#ebd2a755';c.fillRect(x,0,1,h);}
    for(let y=0;y<h;y+=4){c.fillStyle='#4a3b2333';c.fillRect(0,y,w,1);}
  });
  materials.cloth.map=clothTex;
  function sign(text,x,y,z,w=3,h=.65) {
    const map=texture(768,128,(c,cw,ch)=>{
      c.fillStyle='#15292f';c.fillRect(0,0,cw,ch);
      c.strokeStyle='#65827c';c.lineWidth=4;c.strokeRect(2,2,cw-4,ch-4);
      c.fillStyle='#c4d9bd';c.textAlign='center';c.textBaseline='middle';c.font='500 54px monospace';c.fillText(text,cw/2,ch/2);
    });
    return mesh(scene,'plane',new THREE.MeshBasicMaterial({map}),[x,y,z],[w,h,1],false);
  }
  // A solid architectural room, not a background illustration.
  box(scene,materials.floor,[0,-.18,-3],[24,.35,40],true);
  tiledWall([0,4,-12],[24,8,.5]);
  tiledWall([-12,4,-3],[.5,8,20]);
  tiledWall([12,4,-3],[.5,8,20]);
  tiledWall([0,8,-3],[24,.25,24],materials.dark,2.4);
  for(let x=-12;x<=12;x+=2)box(scene,materials.metal,[x,.007,-3],[.022,.009,38]);
  for(let z=-12;z<=16;z+=2)box(scene,materials.metal,[0,.01,z],[24,.01,.025]);
  [-7.2,7.2].forEach(x=>box(scene,materials.amber,[x,.018,-2],[.045,.015,25]));
  for(let z=-10;z<=9;z+=5) {
    tiledWall([0,7.45,z],[24,.32,.28],materials.metal);
    [-11.7,11.7].forEach(x=>tiledWall([x,3.75,z],[.38,7.5,.38],materials.metal));
  }
  // Back plates and raised lanes make depth, occlusion and cast shadows readable.
  laneXs.forEach((x,i)=>{
    tiledWall([x,2.5,-10.9],[3.35,4.6,.35],materials.dark,1.1);
    for(let y=.5;y<5;y+=.65)box(scene,materials.edge,[x,y,-10.65],[3.3,.025,.07]);
    box(scene,materials.metal,[x,.075,-3],[3.1,.15,4.7]);
    box(scene,materials.amber,[x,.155,-.65],[3.05,.018,.035]);
    sign('LANE 0'+(i+1),x,5.45,-10.57,2.4,.42);
    const fixture=new THREE.Group();fixture.position.set(x,7.5,-3);scene.add(fixture);
    box(fixture,materials.metal,[0,-1.25,0],[2.4,.17,.55]);
    const bulb=box(fixture,materials.glow,[0,-1.37,0],[2.15,.035,.38]);
    const cables=[-.7,.7].map(dx=>{
      const cable=rod(fixture,[dx,-1.2,0],[dx,0,0],.035,materials.edge);
      cable.userData.cable=true;return cable;
    });
    const light=new THREE.SpotLight('#d9f4e8',100,16,Math.PI/5,.7,1.6);
    light.position.set(0,-1.5,.3);light.target.position.set(0,-7.5,-.3);
    light.castShadow=true;light.shadow.mapSize.set(1024,1024);
    light.shadow.bias=-.0003;light.shadow.normalBias=.025;
    fixture.add(light,light.target);
    registerProp(fixture,'lamp',{light,bulb,cables});
  });
  sign('THE PROVING GROUND',0,6.75,-11.7,9,.75);
  sign('SECTOR / 07',-9.8,3.3,-11.65,2.5,.5);
  for(const [x,z,s] of [[-9,-3,1.3],[-9.5,-5,1.5],[9,-4,1.4],[9.3,-6,1]]) {
    const crate=new THREE.Group();crate.position.set(x,s/2,z);scene.add(crate);
    box(crate,materials.wood,[0,0,0],[s,s,s]);
    for(const dx of [-.42,.42])box(crate,materials.metal,[dx*s,0,s/2+.025],[.08,s,.05]);
    box(crate,materials.edge,[0,s*.3,s/2+.03],[s,.06,.055]);
    registerProp(crate,'crate',{size:s});
  }
  scene.add(new THREE.HemisphereLight('#cce5f5','#283134',2.1));
  const fill=new THREE.DirectionalLight('#b9cee8',2);fill.position.set(-5,5,10);scene.add(fill);
  const warm=new THREE.PointLight('#eab47a',22,18,2);warm.position.set(8,3,1);scene.add(warm);

  // Make the visible set dressing destructible; retain the floor as a safe stage.
  for(const object of [...scene.children]){
    if(object.isMesh&&!object.userData.prop&&!object.userData.wallSurface&&object.position.y>.2){
      registerProp(object,'structure',{hp:4,size:1.5});
      if(!colliders.includes(object))colliders.push(object);
    }
  }
  for(const [x,z] of [[-6,-4],[6,-4],[-7.5,-7],[7.5,-7]]){
    const barrel=new THREE.Group();barrel.position.set(x,.55,z);scene.add(barrel);
    mesh(barrel,'cylinder',materials.red,[0,0,0],[.42,1.1,.42]);
    for(const y of [-.38,.38])mesh(barrel,'cylinder',materials.metal,[0,y,0],[.44,.08,.44]);
    box(barrel,materials.amber,[0,0,.425],[.23,.32,.015]);
    registerProp(barrel,'barrel',{hp:2,size:1});
  }
  for(const x of [-5.8,5.8]){
    const glass=new THREE.Group();glass.position.set(x,2,-8);scene.add(glass);
    const pane=mat('#8edbdc',{transparent:true,opacity:.48,metalness:.3,roughness:.12});
    box(glass,pane,[0,0,0],[1.05,2.5,.10]);
    registerProp(glass,'glass',{hp:1,size:1.3,shardMaterial:pane});
  }

  labels.forEach((label,i)=>{
    const root=new THREE.Group();root.position.set(laneXs[i],0,-3);scene.add(root);
    mesh(root,'cylinder',materials.metal,[0,.22,0],[.85,.12,.65]);
    mesh(root,'cylinder',materials.edge,[0,.9,0],[.085,1.4,.085]);
    const body=new THREE.Group();body.position.y=1.35;root.add(body);
    mesh(body,'ball',materials.cloth,[0,.8,0],[.53,.8,.35]);
    mesh(body,'ball',materials.cloth,[0,1.9,0],[.37,.43,.33]);
    const arm=mesh(body,'cylinder',materials.cloth,[0,1.15,0],[.19,2.12,.19]);arm.rotation.z=Math.PI/2;
    for(const x of [-1,1]) {
      for(let n=0;n<5;n++)rod(body,[x,1.15,0],[x*(1.18+n*.03),1.12+(n-2)*.04,0],.014,materials.rope);
    }
    const chest=mesh(body,'cylinder',materials.bull,[0,.84,.338],[.34,.035,.34]);chest.rotation.x=Math.PI/2;
    const ring=mesh(body,'ring',materials.red,[0,.84,.368],[.255,.255,.255]);
    const core=mesh(body,'cylinder',materials.red,[0,.84,.379],[.078,.03,.078]);core.rotation.x=Math.PI/2;
    for(const x of [-.135,.135]) {
      rod(body,[x-.055,1.98,.304],[x+.055,1.88,.32],.012,materials.dark);
      rod(body,[x-.055,1.88,.32],[x+.055,1.98,.304],.012,materials.dark);
    }
    rod(body,[-.13,1.77,.31],[.13,1.77,.31],.012,materials.dark);
    for(const y of [.2,1.35]) {
      const belt=mesh(body,'ring',materials.rope,[0,y,0],[.48,.31,.48]);belt.rotation.x=Math.PI/2;
    }
    const target={root,body,label,ring,index:i,wobble:0,name:label.querySelector('strong').textContent};
    body.traverse(object=>{if(object.isMesh){object.userData.target=target;colliders.push(object);}});
    targets.push(target);
  });

  const configs={
    shotgun:{name:'BREACH / PUMP SHOTGUN',hint:'펌프액션 · 7발 산탄 · 나무 개머리판',time:.11,color:0xffcc88,icon:'M3 25L15 19H50V23H25L17 27L6 34ZM28 25H42V29H28ZM19 25L21 31H25'},
    hammer:{name:'QUAKE / HAMMER',hint:'충격파 · 주변 소품까지 함께 파괴',time:.4,color:0x9de4ff,icon:'M12 6H43V21H12ZM25 21V44H32V21'},
    sword:{name:'EDGE / LONGSWORD',hint:'검을 휘둘러 검기를 날립니다',time:.3,color:0x8feaff,icon:'M18 31L43 6L43 17L24 36M15 27L28 40M13 40L20 33'},
    bow:{name:'ASH / LONGBOW',hint:'비파괴 · 벽에 박혀 유지되는 화살',time:.75,color:0xd9c58c,icon:'M21 4Q52 24 21 44L29 24ZM8 24H49M42 18L49 24L42 30'},
    gun:{name:'VX-07 / AUTO RIFLE',hint:'클릭 유지 연사 · 총구 화염 · 반동',time:.095,color:0xffe0a0,icon:'M6 19H38V28H17L9 33L6 29ZM38 22H50M30 19V14H38M21 28L25 39H31L29 28'},
    staff:{name:'EMBER / FIRESTAFF',hint:'범위 충격 · 남아 있는 벽에 그을음',time:.9,color:0xff872a,icon:'M19 43L32 17M26 17L23 8L31 3L41 8L39 18L32 22Z'},
    dagger:{name:'FANG / THROWING KNIFE',hint:'비파괴 · 벽에 박혀 유지되는 단검',time:.65,color:0xb8dfe8,icon:'M23 30L26 8L36 3L38 15L29 34ZM19 29L32 37M16 41L23 33'}
  };
  const held=new THREE.Group();camera.add(held);
  // Grip and forearm share the weapon rig, including aim, recoil and swings.
  const hand=new THREE.Group();held.add(hand);
  box(hand,materials.dark,[0,-.06,.24],[.13,.16,.42]);
  box(hand,materials.weaponShell,[0,-.01,.24],[.145,.09,.13]);
  box(hand,materials.brass,[.075,-.01,.24],[.012,.065,.08]);
  mesh(hand,'ball',materials.leather,[0,0,0],[.095,.10,.10],false);
  for(let i=0;i<4;i++)box(hand,materials.dark,[-.055+i*.036,.035,-.06],[.027,.075,.10]);
  for(let i=0;i<3;i++)box(hand,materials.weaponShell,[-.04+i*.04,.079,-.01],[.028,.018,.045]);
  const nearLight=new THREE.PointLight('#d6ecff',5,4);nearLight.position.set(-.65,.55,-.25);camera.add(nearLight);
  const muzzleLight=new THREE.PointLight('#ffd59b',0,4);camera.add(muzzleLight);
  function makeArrow() {
    const group=new THREE.Group();
    rod(group,[0,0,.08],[0,0,.95],.016,materials.wood);
    const tip=mesh(group,'cone',materials.blade,[0,0,.035],[.055,.18,.055]);tip.rotation.x=-Math.PI/2;
    for(let i=0;i<3;i++){
      const feather=box(group,materials.rope,[0,0,.85],[.16,.012,.18]);feather.rotation.z=i*Math.PI/3;
    }
    return group;
  }
  function makeDagger(long=false) {
    const group=new THREE.Group(),length=long?1.25:.55;
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.09,length*.75);shape.lineTo(.06,length);shape.lineTo(-.06,length);shape.lineTo(-.09,length*.75);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.01,bevelThickness:.008,bevelSegments:1,steps:1});
    geometry.rotateX(Math.PI/2);
    const blade=new THREE.Mesh(geometry,materials.blade);group.add(blade);blade.userData.ownedGeometry=true;
    box(group,materials.brass,[0,0,length],[.29,.065,.045]);
    rod(group,[0,0,length],[0,0,length+.27],.042,materials.dark);
    rod(group,[0,-.018,length*.18],[0,-.018,length*.79],long?.014:.008,materials.rune);
    for(let i=0;i<5;i++)mesh(group,'ring',materials.brass,[0,0,length+.03+i*.046],[.044,.044,.044],false);
    mesh(group,'ball',materials.brass,[0,0,length+.28],[.061,.048,.052],false);
    return group;
  }
  function makeWeapon(type) {
    const group=new THREE.Group();
    if(type==='hammer'){
      rod(group,[0,-.3,.15],[0,.22,-.9],.055,materials.wood);
      box(group,materials.metal,[0,.22,-.9],[.65,.30,.30]);
      for(const x of [-.32,.32])box(group,materials.brass,[x,.22,-.9],[.06,.33,.33]);
      box(group,materials.rune,[0,.22,-1.055],[.32,.12,.018]);
      for(const x of [-.16,.16])box(group,materials.weaponSteel,[x,.22,-1.07],[.025,.28,.025]);
      for(let i=0;i<5;i++)mesh(group,'ring',materials.leather,[0,-.24+i*.06,.08-i*.12],[.065,.065,.065],false).rotation.x=1.1;
    } else if(type==='shotgun'){
      // Classic sporting shotgun silhouette: no rifle magazine, rail or tall sight.
      box(group,materials.weaponShell,[0,0,-.39],[.16,.16,.43]);
      box(group,materials.dark,[.083,.015,-.38],[.006,.065,.16]);
      rod(group,[0,.035,-.58],[0,.035,-1.78],.037,materials.metal);
      rod(group,[0,-.075,-.56],[0,-.075,-1.49],.034,materials.dark);
      const muzzle=mesh(group,'ring',materials.edge,[0,.035,-1.79],[.037,.037,.037]);
      mesh(group,'ball',materials.brass,[0,.079,-1.69],[.012,.012,.012],false);
      box(group,materials.metal,[0,-.023,-1.4],[.085,.15,.04]);
      const stock=box(group,materials.wood,[0,-.10,.10],[.16,.19,.53]);stock.rotation.x=-.19;
      const butt=box(group,materials.wood,[0,-.16,.42],[.20,.32,.23]);butt.rotation.x=-.12;
      box(group,materials.dark,[0,-.18,.55],[.205,.33,.035]);
      for(let i=0;i<3;i++){box(group,materials.red,[.12,-.055,-.22-i*.075],[.04,.11,.05]);box(group,materials.brass,[.12,.005,-.22-i*.075],[.042,.016,.05]);}
      const guard=mesh(group,'ring',materials.metal,[0,-.14,-.29],[.08,.11,.065]);guard.rotation.y=Math.PI/2;
      rod(group,[0,-.08,-.30],[0,-.16,-.28],.012,materials.dark);
      const pump=new THREE.Group();pump.position.set(0,-.073,-.99);group.add(pump);
      const wood=mesh(pump,'cylinder',materials.wood,[0,0,0],[.085,.38,.085]);wood.rotation.x=Math.PI/2;
      for(let i=0;i<8;i++)mesh(pump,'ring',materials.dark,[0,0,-.155+i*.044],[.086,.086,.086]);
      const support=new THREE.Group();pump.add(support);
      mesh(support,'ball',materials.metal,[-.05,-.066,.025],[.095,.072,.10],false);
      const forearm=box(support,materials.dark,[-.17,-.15,.20],[.13,.14,.38]);forearm.rotation.y=-.45;forearm.rotation.x=-.25;
      group.userData.pump=pump;
    } else if(type==='gun'){
      box(group,materials.weaponShell,[0,0,-.45],[.19,.23,.75]);
      box(group,materials.weaponSteel,[0,.125,-.42],[.16,.025,.63]);
      box(group,materials.dark,[0,-.23,-.2],[.13,.34,.19]);
      box(group,materials.metal,[0,-.16,-.52],[.15,.23,.25]);
      const barrel=mesh(group,'cylinder',materials.dark,[0,0,-1],[.047,.48,.047]);barrel.rotation.x=Math.PI/2;
      box(group,materials.brass,[.1,.025,-.5],[.014,.055,.2]);
      for(let i=0;i<5;i++)box(group,materials.edge,[0,.15,-.25-i*.1],[.19,.035,.027]);
      box(group,materials.dark,[0,.2,-.32],[.055,.12,.075]);
      box(group,materials.leather,[0,-.05,.13],[.16,.2,.37]);
      box(group,materials.weaponShell,[0,-.05,.33],[.2,.24,.07]);
      for(const side of [-1,1]){
        box(group,materials.brass,[side*.099,.055,-.35],[.009,.035,.34]);
        for(let i=0;i<3;i++)box(group,materials.dark,[side*.101,-.025,-.62+i*.065],[.01,.048,.033]);
      }
      const bolt=box(group,materials.weaponSteel,[.13,.055,-.52],[.1,.025,.07]);group.userData.bolt=bolt;
      const sight=mesh(group,'ring',materials.weaponSteel,[0,.2,-.82],[.055,.055,.055],false);
      box(group,materials.rune,[0,.2,-.83],[.012,.025,.008]);
      mesh(group,'ring',materials.weaponSteel,[0,0,-1.245],[.052,.052,.052],false);
    } else if(type==='bow'){
      const points=[];for(let i=0;i<=20;i++){const y=(i/20-.5)*1.5;points.push(new THREE.Vector3(0,y,-.6-Math.cos(y/1.5*Math.PI)*.38));}
      const bow=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.035,7,false),materials.wood);bow.userData.ownedGeometry=true;group.add(bow);
      rod(group,[0,-.75,-.6],[0,0,0],.004,materials.rope);rod(group,[0,0,0],[0,.75,-.6],.004,materials.rope);
      const arrow=makeArrow();arrow.position.z=-1;group.add(arrow);group.userData.arrow=arrow;
      for(const y of [-.6,.6])mesh(group,'ball',materials.brass,[0,y,-.72],[.052,.07,.06],false);
      for(let i=0;i<5;i++)mesh(group,'ring',materials.leather,[0,-.11+i*.055,-.97],[.05,.05,.05],false).rotation.x=Math.PI/2;
    } else if(type==='staff'){
      rod(group,[0,-.6,.1],[0,.34,-.7],.045,materials.wood);
      const crown=new THREE.Group();crown.position.set(0,.38,-.75);group.add(crown);group.userData.crown=crown;
      for(let i=0;i<3;i++){const cage=mesh(crown,'ring',materials.brass,null,[.18,.18,.18],false);cage.rotation.set(i*Math.PI/3,.5+i*.8,0);}
      mesh(crown,'ball',materials.fire,null,[.095,.095,.095],false);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;mesh(crown,'cone',materials.weaponSteel,[Math.cos(a)*.2,Math.sin(a)*.2,0],[.04,.18,.04],false).rotation.z=a-Math.PI/2;}
      for(let i=0;i<4;i++)mesh(group,'ball',materials.amber,[0,-.28+i*.13,-.15-i*.11],[.053,.035,.035],false);
    } else {
      const blade=makeDagger(type==='sword');blade.position.z=type==='sword'?-1.4:-.85;group.add(blade);
    }
    return group;
  }
  const weaponModels={};
  const weaponGrips={shotgun:[0,-.09,-.1],hammer:[0,-.18,-.28],gun:[0,-.2,-.17],bow:[0,0,-.98],staff:[0,-.18,-.28],sword:[0,0,-.015],dagger:[0,0,-.17]};
  // Each weapon has its own holster and draw path: x/y/z, then pitch/yaw/roll.
  const swapProfiles={
    gun:{out:[.18,-1.5,.1,-.5,.2,-.2],in:[.1,-1.5,.1,-.5,.15,-.3],outTime:.24,inTime:.46},
    shotgun:{out:[.25,-1.65,.1,-.55,.25,-.3],in:[.2,-1.65,.1,-.6,.2,-.4],outTime:.3,inTime:.55},
    bow:{out:[-.2,-1.6,.1,-.55,-.15,.35],in:[-.18,-1.6,.1,-.5,-.2,.55],outTime:.27,inTime:.52},
    staff:{out:[.2,-1.6,.1,-.6,.2,-.35],in:[.1,-1.6,.1,-.55,-.2,.6],outTime:.29,inTime:.58},
    sword:{out:[.3,-1.7,.1,-.65,.25,-.55],in:[.3,-1.7,.1,-.6,.2,.75],outTime:.26,inTime:.52},
    dagger:{out:[.2,-1.5,.1,-.4,.15,-.55],in:[.15,-1.5,.1,-.45,-.15,.9],outTime:.2,inTime:.44},
    hammer:{out:[.25,-1.75,.1,-.6,.3,-.4],in:[.2,-1.75,.1,-.65,.25,-.55],outTime:.32,inTime:.6}
  };
  const drawShowcase={
    gun:{pose:[-.045,.015,.025,-.03,-.08,-.18],settle:[0,-.012,0,.015,0,.025]},
    shotgun:{pose:[-.075,.025,.03,-.05,-.12,-.24],settle:[0,-.025,0,.025,0,.035]},
    bow:{pose:[-.1,.045,0,.025,.06,.22],settle:[0,.012,0,0,0,-.035]},
    sword:{pose:[-.1,.09,.025,-.15,-.12,-.28],settle:[.012,.012,0,.02,0,.05]},
    dagger:{pose:[-.065,.065,.025,-.06,0,-.28],settle:[.01,.015,0,0,0,.045]},
    staff:{pose:[-.06,.07,0,.02,-.08,-.22],settle:[0,.02,0,0,0,.03]},
    hammer:{pose:[-.07,.08,.025,-.14,-.1,-.16],settle:[.01,-.035,0,.045,0,.03]}
  };
  // Reveal, flourish, and a small settling overshoot make each draw readable.
  function drawPose(type,t){
    const d=drawShowcase[type],poses=[swapProfiles[type].in,d.pose,d.settle,[0,0,0,0,0,0]],times=[0,.6,.84,1];
    const i=t<.6?0:t<.84?1:2,span=times[i+1]-times[i];
    const u=THREE.MathUtils.clamp((t-times[i])/span,0,1),u2=u*u,u3=u2*u;
    return poses[i].map((value,j)=>{
      const m0=i===0?0:(poses[i+1][j]-poses[i-1][j])/(times[i+1]-times[i-1])*span;
      const m1=i===2?0:(poses[i+2][j]-value)/(times[i+2]-times[i])*span;
      return (2*u3-3*u2+1)*value+(u3-2*u2+u)*m0+(-2*u3+3*u2)*poses[i+1][j]+(u3-u2)*m1;
    });
  }
  for(const key of Object.keys(configs)){weaponModels[key]=makeWeapon(key);held.add(weaponModels[key]);weaponModels[key].visible=false;}
  held.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  let weapon='sword',recoil=0,pendingWeapon=null,swapFrom='sword',swapProgress=1,swapDuration=.7,swapTimer=0,navTimer=0,noticeTimer=0,lastFire=-100,shotId=0,triggerPointer=null,muzzleFlash=0;
  let pumpTime=1,drawPhase=1;
  let visible=false,paused=false,lowPower=false,frame=0,lastTime=0,elapsed=0,contextLost=false,sound=false,audio=null;
  function message(text){clearTimeout(noticeTimer);notice.textContent=text;noticeTimer=setTimeout(()=>notice.textContent='',2600);}
  function cancelNavigation(){clearTimeout(navTimer);navTimer=0;shots.forEach(s=>s.navigate=false);}
  function goTo(target) {
    const section=document.querySelector(target.label.dataset.destination);
    section?.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
    if(section){section.setAttribute('tabindex','-1');section.focus({preventScroll:true});}
  }
  function select(type) {
    if(!configs[type])return;
    cancelNavigation();triggerPointer=null;
    if(type!==weapon || pendingWeapon){
      recoil=0;muzzleFlash=0;
      trailCount=0;trailOpacity=0;
      swapFrom=weapon;
      pendingWeapon=type;
      swapDuration=swapProfiles[swapFrom].outTime+swapProfiles[type].inTime;
      swapProgress=reduced.matches||paused?1:0;
      if(swapProgress===1){weapon=type;pendingWeapon=null;}
      clearTimeout(swapTimer);
      range.classList.remove('is-equipping');
      if(!reduced.matches&&!paused){
        range.classList.add('is-equipping');
        swapTimer=setTimeout(()=>range.classList.remove('is-equipping'),swapDuration*1000);
        soundEffect('swap');
      }
    }
    range.dataset.weapon=type;
    document.querySelector('#weapon-readout').textContent=configs[type].name;
    document.querySelector('#weapon-hint').textContent=configs[type].hint;
    for(const key in weaponModels)weaponModels[key].visible=key===weapon;
    radios.forEach(b=>{const active=b.dataset.weapon===type;b.classList.toggle('is-selected',active);b.setAttribute('aria-checked',String(active));b.tabIndex=active?0:-1;});
    document.querySelectorAll('.range-quickbar [data-equip]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.equip===type)));
    requestFrame();
  }
  radios.forEach((b,i)=>{
    b.querySelector('.weapon-icon').innerHTML='<svg viewBox="0 0 56 48" aria-hidden="true"><path d="'+configs[b.dataset.weapon].icon+'"/></svg>';
    b.addEventListener('click',()=>select(b.dataset.weapon));
    b.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
      const n=e.key==='Home'?0:e.key==='End'?radios.length-1:(i+(e.key==='ArrowRight'?1:-1)+radios.length)%radios.length;
      select(radios[n].dataset.weapon);radios[n].focus();
    });
  });
  document.querySelectorAll('[data-equip]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.equip)));
  function soundEffect(type,impact=false) {
    if(!sound||!audio)return;
    const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();
    osc.type=type==='staff'?'sawtooth':'triangle';
    osc.frequency.setValueAtTime(impact?140:type==='bow'?570:type==='gun'?200:type==='swap'?760:400,t);
    osc.frequency.exponentialRampToValueAtTime(type==='swap'?190:30,t+.2);
    gain.gain.setValueAtTime(type==='swap'?.025:.055,t);gain.gain.exponentialRampToValueAtTime(.0001,t+.22);
    osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.23);
  }
  document.querySelector('#sound-toggle').addEventListener('click',async e=>{
    try{audio??=new(window.AudioContext||window.webkitAudioContext)();await audio.resume();sound=!sound;e.target.textContent=sound?'사운드 ON':'사운드 OFF';e.target.setAttribute('aria-pressed',String(sound));}
    catch{message('이 브라우저에서는 사운드를 사용할 수 없습니다.');}
  });
  const glowTexture=texture(64,64,(c,w,h)=>{
    const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fff9dd');g.addColorStop(.18,'#ffd173');g.addColorStop(.45,'#ff782866');g.addColorStop(1,'#ff500000');c.fillStyle=g;c.fillRect(0,0,w,h);
  });
  const flashTexture=texture(128,128,c=>{
    c.translate(64,64);
    const g=c.createRadialGradient(0,0,0,0,0,62);g.addColorStop(0,'#ffffff');g.addColorStop(.15,'#fff4bd');g.addColorStop(.48,'#ffc34cc0');g.addColorStop(1,'#ff782000');
    c.fillStyle=g;
    for(let i=0;i<6;i++){c.rotate(Math.PI/3);c.beginPath();c.moveTo(-7,-5);c.lineTo(0,-63);c.lineTo(9,-5);c.closePath();c.fill();}
    c.beginPath();c.arc(0,0,23,0,Math.PI*2);c.fill();
  });
  const smokeTexture=texture(64,64,c=>{
    const g=c.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'#ffffff70');g.addColorStop(.45,'#ffffff50');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,64,64);
  });
  const muzzleFlare=new THREE.Sprite(new THREE.SpriteMaterial({map:flashTexture,blending:THREE.AdditiveBlending,depthWrite:false}));
  muzzleFlare.visible=false;held.add(muzzleFlare);
  const tracerGlowMaterial=new THREE.SpriteMaterial({map:glowTexture,blending:THREE.AdditiveBlending,depthWrite:false});
  const equipGlint=new THREE.Sprite(new THREE.SpriteMaterial({map:flashTexture,blending:THREE.AdditiveBlending,depthWrite:false}));
  equipGlint.visible=false;held.add(equipGlint);
  const trailPoints=Array.from({length:10},()=>new THREE.Vector3()),trailVertices=new Float32Array(9*18);
  const trailGeometry=new THREE.BufferGeometry();
  trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailVertices,3).setUsage(THREE.DynamicDrawUsage));
  const equipTrail=new THREE.Mesh(trailGeometry,new THREE.MeshBasicMaterial({color:0xb8eaff,transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
  equipTrail.frustumCulled=false;equipTrail.visible=false;camera.add(equipTrail);
  let trailCount=0,trailOpacity=0;
  const equipTip=new THREE.Vector3();
  const equipTips={gun:[0,0,-1.24],shotgun:[0,.035,-1.79],bow:[0,.6,-.72],sword:[0,0,-1.4],dagger:[0,0,-.85],staff:[0,.38,-.75],hammer:[0,.22,-.9]};
  function updateEquipAccent(dt){
    const active=pendingWeapon&&drawPhase>.32&&drawPhase<.94&&!reduced.matches;
    equipGlint.visible=!!active;
    if(active){
      equipGlint.position.set(...equipTips[weapon]);
      equipGlint.scale.setScalar(weapon==='staff'?.18:.09);
      equipGlint.material.color.setHex(configs[weapon].color);
      equipGlint.material.opacity=Math.sin((drawPhase-.32)/.62*Math.PI)*.65;
      held.updateWorldMatrix(true,false);
      camera.worldToLocal(held.localToWorld(equipTip.copy(equipGlint.position)));
      for(let i=9;i>0;i--)trailPoints[i].copy(trailPoints[i-1]);
      trailPoints[0].copy(equipTip);trailCount=Math.min(10,trailCount+1);
      trailOpacity=['sword','dagger','staff'].includes(weapon)?.25:.08;
      equipTrail.material.color.setHex(configs[weapon].color);
      let offset=0;
      for(let i=0;i<trailCount-1;i++){
        const a=trailPoints[i],b=trailPoints[i+1],width=.018*(1-i/10),nextWidth=.018*(1-(i+1)/10);
        for(const [p,w] of [[a,width],[a,-width],[b,nextWidth],[b,nextWidth],[a,-width],[b,-nextWidth]]){
          trailVertices[offset++]=p.x;trailVertices[offset++]=p.y+w;trailVertices[offset++]=p.z;
        }
      }
      trailGeometry.setDrawRange(0,offset/3);trailGeometry.attributes.position.needsUpdate=true;
    }else{trailOpacity=Math.max(0,trailOpacity-dt*2);if(!trailOpacity)trailCount=0;}
    equipTrail.visible=trailOpacity>0;equipTrail.material.opacity=trailOpacity;
  }
  const vfx=[],vfxPool=[];
  function puff(point,color,size,life,smoke=false){
    if(reduced.matches||vfx.length>=(lowPower?12:28))return;
    let item=vfxPool.pop();
    if(!item){const material=new THREE.SpriteMaterial({transparent:true,depthWrite:false});item={sprite:new THREE.Sprite(material)};}
    const material=item.sprite.material;
    material.map=smoke?smokeTexture:glowTexture;material.blending=smoke?THREE.NormalBlending:THREE.AdditiveBlending;
    material.color.setHex(color);material.opacity=smoke?.55:.95;material.rotation=Math.random()*Math.PI;
    item.sprite.position.copy(point);item.sprite.scale.setScalar(size);scene.add(item.sprite);
    Object.assign(item,{size,life,max:life,smoke});vfx.push(item);
  }
  const scorchTexture=texture(128,128,(c,w,h)=>{
    const g=c.createRadialGradient(64,64,5,64,64,64);
    g.addColorStop(0,'#160d09e8');g.addColorStop(.48,'#24140ec0');g.addColorStop(.78,'#38201570');g.addColorStop(1,'#38201500');
    c.fillStyle=g;c.fillRect(0,0,w,h);
  });
  const scorchMaterial=new THREE.MeshBasicMaterial({map:scorchTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  const bulletMarkGeometry=new THREE.CircleGeometry(.035,12);
  const bulletMarkMaterial=new THREE.MeshBasicMaterial({color:'#0c171c',side:THREE.DoubleSide});
  const bulletMarkPool=[],debrisPool=[];
  function fireball(){
    const group=new THREE.Group();mesh(group,'ball',materials.fire,null,[.16,.16,.16],false);
    const corona=mesh(group,'ring',materials.amber,[0,0,.01],[.23,.23,.23],false);corona.rotation.x=Math.PI/2;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,blending:THREE.AdditiveBlending,depthWrite:false}));
    sprite.scale.set(1.4,1.4,1.4);sprite.userData.ownedMaterial=true;group.add(sprite);
    const light=new THREE.PointLight('#ff8e35',17,5,2);group.add(light);return group;
  }
  function disposeObject(object) {
    object.removeFromParent();
    object.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose();if(o.userData.ownedMaterial)o.material.dispose();});
  }
  function releaseMark(mark) {
    const object=mark.object;
    if(object.geometry===bulletMarkGeometry&&bulletMarkPool.length<12){object.removeFromParent();bulletMarkPool.push(object);}
    else disposeObject(object);
  }
  function particle(point,color,count=15,speed=2) {
    const room=Math.max(0,140-debris.length);
    for(let i=0;i<Math.min(count,room);i++){
      const item=debrisPool.pop()||{mesh:mesh(scene,'box',materials.spark.clone(),null,[.035,.035,.035],false),v:new THREE.Vector3(),life:0};
      if(!item.mesh.parent)scene.add(item.mesh);
      item.mesh.material.color.setHex(color);item.mesh.scale.set(.018,.045,.018);
      item.mesh.position.copy(point);
      item.mesh.rotation.set(0,0,0);
      item.v.set((Math.random()-.5)*speed,(Math.random()+.1)*speed,(Math.random()-.5)*speed);
      item.life=.35+Math.random()*.5;debris.push(item);
    }
  }
  function restoreProps() {
    cancelNavigation();clearShots();
    for(const f of fragments)disposeObject(f.mesh);fragments.length=0;
    while(debris.length){const item=debris.pop();item.mesh.removeFromParent();debrisPool.push(item);}
    while(flashes.length)disposeObject(flashes.pop().mesh);
    while(vfx.length){const item=vfx.pop();item.sprite.removeFromParent();vfxPool.push(item);}
    for(const p of props){
      p.root.visible=true;p.root.position.copy(p.home);p.root.rotation.set(0,0,0);
      p.hp=p.maxHp;p.state='intact';p.age=0;p.swing=0;p.velocity.set(0,0,0);
      if(p.light){p.light.intensity=100;p.bulb.material=materials.glow;p.cables.forEach(c=>c.visible=true);}
    }
    const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
    for(const wall of wallSurfaces){
      const surface=wall.userData.wallSurface;
      surface.tiles.forEach((tile,id)=>{
        tile.hp=wallDurability;tile.broken=false;
        wall.setMatrixAt(id,matrix.compose(tile.local,rotation,surface.scale));
        wall.setColorAt(id,new THREE.Color(0xffffff));
      });
      wall.instanceMatrix.needsUpdate=true;wall.instanceColor.needsUpdate=true;
    }
    while(marks.length)releaseMark(marks.pop());
    message('RESET / 소품·벽·탄착 흔적을 복구했습니다');requestFrame();
  }
  document.querySelector('#reset-props').addEventListener('click',restoreProps);
  function damageWallTile(wall,id,point,shot) {
    const surface=wall.userData.wallSurface,tile=surface.tiles[id];
    if(!tile||tile.broken)return;
    tile.hp-=shot.type==='staff'?4:shot.type==='hammer'?5:shot.type==='sword'?2:1;
    if(tile.hp>0){
      const shade=.45+.55*tile.hp/wallDurability;
      wall.setColorAt(id,new THREE.Color().setRGB(shade,shade*.96,shade*.91));
      wall.instanceColor.needsUpdate=true;
      if(!shot.secondary)message('HIT / 벽 손상 · 남은 내구도 '+tile.hp);
      return;
    }
    tile.broken=true;
    wall.setMatrixAt(id,new THREE.Matrix4().makeScale(0,0,0));
    wall.instanceMatrix.needsUpdate=true;
    for(let i=marks.length-1;i>=0;i--){
      if(marks[i].wall===wall&&marks[i].tileId===id){releaseMark(marks[i]);marks.splice(i,1);}
    }
    for(let i=0;i<3&&fragments.length<maxFragments;i++){
      const shard=box(scene,wall.material,point.toArray(),[.12+Math.random()*.15,.08,.16+Math.random()*.2]);
      shard.castShadow=shard.receiveShadow=false;
      fragments.push({mesh:shard,v:shot.direction.clone().multiplyScalar(2).add(new THREE.Vector3((Math.random()-.5)*3,2+Math.random()*2,(Math.random()-.5)*3)),spin:new THREE.Vector3(4,3,5),life:4});
    }
    if(!shot.secondary)message('BREAK / 명중한 벽 구획 파괴');
  }
  function damageWallsInRadius(center,radius,shot) {
    for(const wall of wallSurfaces){
      const surface=wall.userData.wallSurface;
      wall.updateWorldMatrix(true,false);
      for(let id=0;id<surface.tiles.length;id++){
        const tile=surface.tiles[id];if(tile.broken)continue;
        const point=tile.local.clone().applyMatrix4(wall.matrixWorld);
        if(point.distanceTo(center)<=radius)damageWallTile(wall,id,point,shot);
      }
    }
  }
  function damageProp(p,shot) {
    if(p.state==='broken'||shot.type==='bow'||shot.type==='dagger')return;
    const explosive=shot.type==='staff'||shot.type==='hammer';
    p.hp-=explosive?4:shot.type==='sword'?2:1;p.swing=explosive?.4:.18;
    if(p.kind==='lamp'){
      if(p.state==='falling')return;
      if(shot.hitObject.userData.cable||p.hp<=0){
        p.state='falling';p.age=0;p.cables.forEach(c=>c.visible=false);
        p.light.intensity=0;p.bulb.material=materials.dark;
        p.velocity.copy(shot.direction).multiplyScalar(explosive?4:1.3);
        particle(shot.end,0xffdd99,28,4);
        message('CABLE CUT / 전등 추락');
      }else message('HIT / 전등 흔들림 · '+p.hp+'회 더 명중하면 파괴');
    }else if(p.hp<=0){
      p.state='broken';p.root.visible=false;
      for(let i=0;i<7;i++){
        const shard=box(scene,p.shardMaterial||(p.kind==='crate'?materials.wood:materials.metal),p.root.position.toArray(),[.12+Math.random()*.25,.08,.35+Math.random()*.4]);
        shard.castShadow=shard.receiveShadow=false;
        shard.position.add(new THREE.Vector3((Math.random()-.5)*p.size,(Math.random()-.5)*p.size,(Math.random()-.5)*p.size));
        fragments.push({mesh:shard,v:shot.direction.clone().multiplyScalar(explosive?5:2).add(new THREE.Vector3((Math.random()-.5)*5,3+Math.random()*4,(Math.random()-.5)*5)),spin:new THREE.Vector3(Math.random()*6,Math.random()*6,Math.random()*6),life:4.5});
      }
      while(fragments.length>maxFragments)disposeObject(fragments.shift().mesh);
      const names={crate:'상자',structure:'시설물',barrel:'폭발통',glass:'유리'};
      message((explosive?'BLAST / ':'BREAK / ')+names[p.kind]+' 파괴');
      if(p.kind==='barrel'){
        particle(p.root.position,0xffaa44,40,7);
        blast(p.root.position,3.8,{...shot,type:'staff',navigate:false});
      }
    }else message('HIT / 소품 손상 · 남은 내구도 '+p.hp);
  }
  function blast(center,radius,shot){
    const material=new THREE.MeshBasicMaterial({color:0xffba66,transparent:true,opacity:.65,wireframe:true});
    const wave=mesh(scene,'ball',material,center.toArray(),[radius*.25,radius*.25,radius*.25],false);
    wave.userData.ownedMaterial=true;flashes.push({mesh:wave,life:.55,max:.55});
    for(const p of props){
      if(p.state==='intact'&&p.root.position.distanceTo(center)<radius)damageProp(p,{...shot,hitObject:p.root,end:center});
    }
    damageWallsInRadius(center,radius,shot);
  }
  function updateProps(dt) {
    for(const p of props){
      if(p.state==='intact'){
        p.swing*=Math.exp(-dt*2.4);
        p.root.rotation.z=reduced.matches?0:Math.sin(elapsed*(p.kind==='lamp'?5:20))*p.swing;
        if(p.light)p.light.intensity=p.swing>.06?(Math.sin(elapsed*38)>0?25:100):100;
      }else if(p.state==='falling'){
        p.velocity.y-=9.8*dt;p.root.position.addScaledVector(p.velocity,dt);
        if(!reduced.matches)p.root.rotation.z+=dt*1.4;
        // Stop the fixture at floor height after a short bounce.
        if(p.root.position.y<1.55){p.root.position.y=1.55;p.velocity.y=Math.abs(p.velocity.y)*.2;p.velocity.x*=.55;p.velocity.z*=.55;p.age+=dt;if(p.age>.4)p.state='broken';}
      }
    }
    for(let i=fragments.length-1;i>=0;i--){
      const f=fragments[i];f.life-=dt;f.v.y-=9.8*dt;f.mesh.position.addScaledVector(f.v,dt);
      if(!reduced.matches){f.mesh.rotation.x+=f.spin.x*dt;f.mesh.rotation.y+=f.spin.y*dt;f.mesh.rotation.z+=f.spin.z*dt;}
      if(f.mesh.position.y<.12){f.mesh.position.y=.12;f.v.y=Math.abs(f.v.y)*.25;f.v.x*=.9;f.v.z*=.9;f.spin.multiplyScalar(.85);}
      if(f.life<0){disposeObject(f.mesh);fragments.splice(i,1);}
    }
  }
  function hit(shot) {
    const {end,target,type,object,hitObject}=shot;
    soundEffect(type,true);
    particle(end,configs[type].color,type==='staff'?36:type==='gun'?5:16,type==='staff'?4:2);
    if(!shot.secondary){
      puff(end,configs[type].color,type==='staff'?2.5:type==='hammer'?1.9:.7,type==='staff'?.42:.2);
      if(type==='staff'||type==='gun'||type==='shotgun')puff(end,type==='staff'?0x65544c:0x84959b,type==='staff'?1.2:.35,.75,true);
    }
    if(type==='bow'||type==='dagger'){
      object.position.copy(end).addScaledVector(shot.direction,.06);
      object.quaternion.setFromUnitVectors(forward,shot.direction);
      object.children[0].rotation.set(0,0,0);
      marks.push({object,life:Infinity,anchor:makeWorldScaleAnchor(object,hitObject),wall:hitObject?.userData.wallSurface?hitObject:null,tileId:shot.instanceId});
    } else {
      disposeObject(object);
      const scorch=type==='staff';
      const mark=scorch?new THREE.Mesh(meshes.plane,scorchMaterial):bulletMarkPool.pop()||new THREE.Mesh(bulletMarkGeometry,bulletMarkMaterial);
      if(scorch)mark.scale.set(.72,.72,1);
      mark.visible=true;
      scene.add(mark);
      mark.position.copy(end).addScaledVector(shot.normal,scorch?.022:.016);
      mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),shot.normal);
      marks.push({object:mark,life:scorch?Infinity:type==='gun'?4:10,anchor:makeWorldScaleAnchor(mark,hitObject),wall:hitObject?.userData.wallSurface?hitObject:null,tileId:shot.instanceId});
    }
    if(!shot.secondary&&flashes.length<12){
      const heavy=type==='staff'||type==='sword'||type==='hammer';
      const life=heavy?.5:.22;
      const material=new THREE.MeshBasicMaterial({color:configs[type].color,transparent:true,opacity:heavy?.8:.58,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
      const ring=mesh(scene,'ring',material,end.toArray(),heavy?[.3,.3,.3]:[.09,.09,.09],false);ring.userData.ownedMaterial=true;ring.lookAt(camera.position);
      flashes.push({mesh:ring,life,max:life});
    }
    while(marks.filter(mark=>Number.isFinite(mark.life)).length>12){
      const index=marks.findIndex(mark=>Number.isFinite(mark.life));
      releaseMark(marks[index]);marks.splice(index,1);
    }
    const prop=hitObject?.userData.prop;
    if(prop)damageProp(prop,shot);
    const wall=hitObject?.userData.wallSurface?hitObject:null;
    if(wall&&type!=='bow'&&type!=='dagger'&&type!=='staff'&&type!=='hammer')damageWallTile(wall,shot.instanceId,end,shot);
    if(type==='hammer'||type==='staff')blast(end,type==='hammer'?3.2:2.3,shot);
    if(prop||wall)return;
    if(!target){if(!shot.secondary)message(type==='bow'||type==='dagger'?'STUCK / 화살·단검이 박혔습니다':'IMPACT / 바닥·벽 탄착');return;}
    target.wobble=.18;crosshair.classList.add('confirmed');setTimeout(()=>crosshair.classList.remove('confirmed'),180);
    const shouldNavigate=shot.navigate&&autoOpen.checked;
    if(!shot.secondary)message((type==='dagger'?'STUCK':type==='staff'?'DIRECT HIT':'HIT CONFIRMED')+' / '+target.name+(shouldNavigate?' — 이동합니다':''));
    if(shouldNavigate)navTimer=setTimeout(()=>goTo(target),950);
  }
  function makeWorldScaleAnchor(object,parent) {
    if(!parent||parent.userData.wallSurface)return null;
    parent.updateWorldMatrix(true,false);
    const localPosition=parent.worldToLocal(object.position.clone());
    const parentRotation=parent.getWorldQuaternion(new THREE.Quaternion());
    const localRotation=parentRotation.clone().invert().multiply(object.quaternion.clone());
    // Keep the projectile under the unscaled scene root. Only position and rotation
    // follow the collider, so differently scaled props cannot resize embedded models.
    return {parent,localPosition,localRotation,scale:object.scale.clone()};
  }
  function updateWorldScaleAnchor(mark) {
    const anchor=mark.anchor;
    if(!anchor)return;
    let state=anchorStates.get(anchor.parent);
    if(!state){
      state={matrix:anchor.parent.matrixWorld,rotation:new THREE.Quaternion(),visible:true,frame:-1};
      anchorStates.set(anchor.parent,state);
    }
    if(state.frame!==anchorFrame){
      anchor.parent.updateWorldMatrix(true,false);
      anchor.parent.matrixWorld.decompose(anchorTempPosition,state.rotation,anchorTempScale);
      let visible=true,node=anchor.parent;
      while(node){visible=visible&&node.visible;node=node.parent;}
      state.visible=visible;state.frame=anchorFrame;
    }
    mark.object.position.copy(anchor.localPosition).applyMatrix4(state.matrix);
    mark.object.quaternion.copy(state.rotation).multiply(anchor.localRotation);
    mark.object.scale.copy(anchor.scale);
    mark.object.visible=state.visible;
  }
  function shoot(hitData,secondary=false) {
    if(paused||contextLost||pendingWeapon&&!secondary)return;
    requestFrame();
    const now=performance.now()/1000;
    if(!secondary&&now-lastFire<(weapon==='gun'?.18:weapon==='shotgun'?.7:.55))return;
    if(!secondary){lastFire=now;cancelNavigation();}shotId++;
    const type=weapon,end=hitData.point.clone();
    held.updateWorldMatrix(true,true);
    const start=held.localToWorld(new THREE.Vector3(0,type==='staff'?.35:type==='shotgun'?.035:0,type==='staff'?-.75:type==='shotgun'?-1.79:-1.15));
    const direction=end.clone().sub(start).normalize();
    let object=new THREE.Group(),model;
    if(type==='bow')model=makeArrow();
    else if(type==='dagger')model=makeDagger();
    else if(type==='staff')model=fireball();
    else if(type==='sword'||type==='hammer'){
      model=new THREE.Group();const arc=mesh(model,type==='sword'?'slash':'ring',materials.rune,null,type==='hammer'?[.6,.6,.6]:[.85,.28,.7],false);arc.rotation.z=.6;
      if(type==='sword'){const edge=mesh(model,'slash',materials.glow,[0,.06,.09],[.7,.24,.7],false);edge.rotation.z=.6;}
    }
    else {model=new THREE.Group();box(model,materials.spark,[0,0,.17],[.025,.025,.35]);if(!secondary){const glow=new THREE.Sprite(tracerGlowMaterial);glow.position.z=.12;glow.scale.set(.22,.22,.22);model.add(glow);}}
    object.add(model);scene.add(object);object.position.copy(start);object.quaternion.setFromUnitVectors(forward,direction);
    const normal=hitData.face?hitData.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hitData.object.matrixWorld)).normalize():direction.clone().negate();
    shots.push({id:shotId,type,secondary,object,model,start,end,direction,normal,hitObject:hitData.object,instanceId:hitData.instanceId,target:hitData.object?.userData.target,startAt:performance.now(),duration:reduced.matches?.12:configs[type].time,navigate:!secondary&&autoOpen.checked,trail:0});
    recoil=1;
    if(type==='shotgun'&&!secondary)pumpTime=0;
    if(!secondary)soundEffect(type);
    if(!secondary&&(type==='gun'||type==='shotgun'||type==='staff')){
      muzzleFlash=type==='shotgun'?.12:type==='staff'?.28:.075;
      muzzleFlare.material.map=type==='staff'?glowTexture:flashTexture;
      muzzleFlare.material.rotation=Math.random()*Math.PI;
      muzzleFlare.position.set(0,type==='staff'?.35:type==='shotgun'?.035:0,type==='staff'?-.75:type==='shotgun'?-1.79:-1.15);
      const size=type==='shotgun'?1.05:type==='staff'?.85:.65;
      muzzleFlare.scale.set(size,size,size);
      muzzleFlare.material.color.setHex(configs[type].color);
      muzzleFlare.visible=true;
      muzzleLight.color.setHex(configs[type].color);
      muzzleLight.position.copy(camera.worldToLocal(start.clone()));
      muzzleLight.intensity=type==='staff'?8:12;
      puff(start,0x9daab0,type==='shotgun'?.36:.2,.5,true);
    }
    if(!secondary&&(type==='gun'||type==='shotgun')){muzzleLight.position.copy(camera.worldToLocal(start.clone()));muzzleLight.intensity=12;particle(start,0xffe6a0,type==='gun'?2:6,.5);}
    if(type==='shotgun'&&!secondary){
      for(let i=0;i<6;i++){
        const spread=end.clone().add(new THREE.Vector3((Math.random()-.5)*1.6,(Math.random()-.5)*1.6,0));
        const pelletRay=new THREE.Raycaster(camera.position,spread.sub(camera.position).normalize());
        const pelletHit=pelletRay.intersectObjects(activeColliders(),false)[0];if(pelletHit)shoot(pelletHit,true);
      }
    }
  }
  function pointerPosition(e) {
    const rect=canvas.getBoundingClientRect();
    mouse.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    crosshair.style.left=(e.clientX-rect.left)+'px';crosshair.style.top=(e.clientY-rect.top)+'px';
  }
  function cast() {
    scene.updateMatrixWorld(true);ray.setFromCamera(mouse,camera);
    return ray.intersectObjects(activeColliders(),false)[0];
  }
  function gunReady(){return performance.now()/1000-lastFire>=.18;}
  function activeColliders(){return colliders.filter(o=>o.visible&&(!o.userData.prop||o.userData.prop.state==='intact'));}
  range.addEventListener('pointermove',e=>{
    pointerPosition(e);const h=cast();if(h)aimPoint.copy(h.point);
    crosshair.classList.toggle('on-target',!!(h?.object.userData.target||h?.object.userData.prop));
  });
  let touchStart=null;
  function fireAtPointer(e) {
    if(pendingWeapon)return;
    pointerPosition(e);const h=cast();
    if(h){aimPoint.copy(h.point);shoot(h);}
  }
  function releaseTrigger(e) {
    if(triggerPointer===null||e&&e.pointerId!==triggerPointer)return;
    try{if(e&&canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);}catch{}
    triggerPointer=null;
  }
  canvas.addEventListener('pointerdown',e=>{
    touchStart={x:e.clientX,y:e.clientY};
    if(e.button!==0||weapon!=='gun'||pendingWeapon)return;
    triggerPointer=e.pointerId;try{canvas.setPointerCapture?.(e.pointerId);}catch{}fireAtPointer(e);
  });
  canvas.addEventListener('pointerup',releaseTrigger);
  canvas.addEventListener('pointercancel',releaseTrigger);
  canvas.addEventListener('lostpointercapture',()=>triggerPointer=null);
  canvas.addEventListener('click',e=>{
    if(e.button!==0)return;
    if(weapon==='gun')return;
    if(touchStart&&Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y)>12)return;
    fireAtPointer(e);
  });
  labels.forEach((label,i)=>label.addEventListener('click',()=>{
    if(paused){goTo(targets[i]);return;}
    if(pendingWeapon)return;
    const p=targets[i].body.localToWorld(new THREE.Vector3(0,.84,.38));
    aimPoint.copy(p);const projected=p.clone().project(camera);mouse.set(projected.x,projected.y);
    const h=cast();if(h)shoot(h);
  }));
  for(const event of ['wheel','touchmove'])window.addEventListener(event,cancelNavigation,{passive:true});
  window.addEventListener('keydown',e=>{
    if(['Escape','PageDown','PageUp','ArrowDown','ArrowUp','Home','End',' '].includes(e.key))cancelNavigation();
  });
  autoOpen.addEventListener('change',cancelNavigation);
  function clearShots(){while(shots.length)disposeObject(shots.pop().object);}
  function resize() {
    cancelNavigation();clearShots();
    const w=range.clientWidth,h=range.clientHeight;
    camera.aspect=w/h;
    // Fit all three targets horizontally at every viewport size.
    const distance=Math.max(15,11.7/(Math.tan(THREE.MathUtils.degToRad(24))*camera.aspect));
    camera.position.set(0,3.7,distance-3);camera.lookAt(0,2.35,-3);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,lowPower?1:1.6));renderer.setSize(w,h,false);
    projectLabels();requestFrame();
  }
  function projectLabels() {
    camera.updateMatrixWorld();
    targets.forEach(t=>{
      const p=t.root.localToWorld(new THREE.Vector3(0,.2,1)).project(camera);
      t.label.style.left=((p.x*.5+.5)*100)+'%';
      t.label.style.top=((-p.y*.5+.5)*100)+'%';
    });
  }
  document.querySelector('#quality-toggle').addEventListener('click',e=>{
    lowPower=!lowPower;renderer.shadowMap.enabled=!lowPower;
    e.target.textContent=lowPower?'절전 ON':'절전 OFF';e.target.setAttribute('aria-pressed',String(lowPower));resize();
  });
  document.querySelector('#pause-toggle').addEventListener('click',e=>{
    paused=!paused;cancelNavigation();clearShots();e.target.textContent=paused?'다시 시작':'일시정지';e.target.setAttribute('aria-pressed',String(paused));
    range.classList.toggle('is-paused',paused);if(!paused)requestFrame();
    message(paused?'PAUSED / 프로젝트 버튼으로 바로 이동할 수 있습니다.':'READY / 조준하고 클릭하세요.');
  });
  function update(dt) {
    elapsed+=dt;
    recoil=Math.max(0,recoil-dt*5);
    let swapPose=null;
    drawPhase=1;
    held.visible=true;
    if(pendingWeapon){
      swapProgress=Math.min(1,swapProgress+dt/swapDuration);
      const boundary=swapProfiles[swapFrom].outTime/swapDuration;
      if(swapProgress>=boundary && weapon!==pendingWeapon){
        weapon=pendingWeapon;
        for(const key in weaponModels)weaponModels[key].visible=key===weapon;
      }
      const drawing=swapProgress>=boundary;
      const phase=drawing?(swapProgress-boundary)/(1-boundary):swapProgress/boundary;
      const eased=phase*phase*(3-2*phase);
      drawPhase=drawing?phase:0;
      swapPose=drawing?drawPose(pendingWeapon,phase):swapProfiles[swapFrom].out.map(value=>value*eased);
      if(swapProgress===1)pendingWeapon=null;
    }
    pumpTime=Math.min(1,pumpTime+dt);
    const pumpPhase=THREE.MathUtils.clamp((pumpTime-.12)/.48,0,1);
    const drawAction=pendingWeapon?Math.sin(THREE.MathUtils.clamp((drawPhase-.5)/.45,0,1)*Math.PI):0;
    weaponModels.shotgun.userData.pump.position.z=-.99+(reduced.matches?0:Math.max(Math.sin(pumpPhase*Math.PI),drawAction)*.24);
    weaponModels.gun.userData.bolt.position.z=-.52+(reduced.matches?0:Math.max(recoil,drawAction)*.14);
    weaponModels.bow.userData.arrow.visible=recoil<.5&&(!pendingWeapon||drawPhase>.45);
    weaponModels.staff.userData.crown.rotation.set(0,reduced.matches?0:elapsed*.7,reduced.matches?0:elapsed*.25);
    weaponModels.staff.userData.crown.scale.setScalar(reduced.matches?1:1+Math.sin(elapsed*3)*.06+recoil*.2);
    held.scale.setScalar(.88);
    held.position.set(camera.aspect<1?.38:.58,-.4-(reduced.matches?0:recoil*.06),-1.05+recoil*.12);
    camera.worldToLocal(localAim.copy(aimPoint));
    held.quaternion.setFromUnitVectors(forward,localAim.sub(held.position).normalize());
    if(swapPose&&!reduced.matches){held.position.x+=swapPose[0];held.position.y+=swapPose[1];held.position.z+=swapPose[2];held.rotateX(swapPose[3]);held.rotateY(swapPose[4]);held.rotateZ(swapPose[5]);}
    if((weapon==='sword'||weapon==='hammer')&&!reduced.matches)held.rotateZ(-recoil*1.15);
    if((weapon==='gun'||weapon==='shotgun')&&!reduced.matches)held.rotateX(recoil*(weapon==='shotgun'?.25:.12));
    if((weapon==='staff'||weapon==='dagger')&&!reduced.matches)held.rotateX(-recoil*.35);
    if(weapon==='hammer'&&!reduced.matches)held.rotateX(recoil*.32);
    if(weapon==='staff'&&!reduced.matches)held.rotateZ(-recoil*.26);
    if(weapon==='dagger'&&!reduced.matches)held.rotateZ(recoil*.75);
    if(weapon==='bow'&&!reduced.matches){held.rotateX(-recoil*.18);held.rotateY(-recoil*.28);}
    hand.position.set(...weaponGrips[weapon]);
    if(weapon==='bow'&&!reduced.matches)held.position.z+=recoil*.15;
    if(weapon==='dagger')weaponModels.dagger.visible=recoil<.45;
    updateEquipAccent(dt);
    if(triggerPointer!==null&&weapon==='gun'&&gunReady()){
      const h=cast();if(h){aimPoint.copy(h.point);shoot(h);}
    }
    muzzleFlash=Math.max(0,muzzleFlash-dt);
    muzzleFlare.visible=muzzleFlash>0;
    if(muzzleFlare.visible)muzzleFlare.material.opacity=Math.min(1,muzzleFlash*25);
    muzzleLight.intensity=Math.max(0,muzzleLight.intensity-dt*65);
    for(const t of targets){t.wobble*=Math.exp(-dt*7);t.body.rotation.z=reduced.matches?0:Math.sin(elapsed*38)*t.wobble;}
    updateProps(dt);
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i];const t=Math.min((performance.now()-s.startAt)/(s.duration*1000),1);
      const previous=s.object.position.clone();
      s.object.position.lerpVectors(s.start,s.end,t);
      const arc=s.type==='bow'?.85:s.type==='dagger'?.3:0;
      s.object.position.y+=Math.sin(t*Math.PI)*arc;
      const direction=s.object.position.clone().sub(previous);
      if(direction.lengthSq()>.000001)s.object.quaternion.setFromUnitVectors(forward,direction.normalize());
      if(s.type==='dagger')s.model.rotation.x=reduced.matches?0:t*Math.PI*4;
      if(s.type==='staff'){s.model.rotation.z+=dt*3;s.trail+=dt;if(s.trail>.065){puff(s.object.position,0xff842e,.5,.24);particle(s.object.position,0xffa750,1,.35);s.trail=0;}}
      if(t===1){shots.splice(i,1);hit(s);}
    }
    for(let i=debris.length-1;i>=0;i--){const p=debris[i];p.life-=dt;p.mesh.position.addScaledVector(p.v,dt);p.v.y-=dt*4;p.mesh.rotation.x+=dt*5;if(p.life<0){p.mesh.removeFromParent();debris.splice(i,1);debrisPool.push(p);}}
    for(let i=vfx.length-1;i>=0;i--){
      const p=vfx[i];p.life-=dt;const t=Math.max(0,p.life/p.max);
      p.sprite.material.opacity=(p.smoke?.55:.95)*t*t;
      p.sprite.scale.setScalar(p.size*(1+(1-t)*(p.smoke?2.2:1.4)));
      if(p.smoke){p.sprite.position.y+=dt*.3;p.sprite.material.rotation+=dt*.2;}
      if(p.life<=0){p.sprite.removeFromParent();vfx.splice(i,1);vfxPool.push(p);}
    }
    anchorFrame++;
    for(let i=marks.length-1;i>=0;i--){const mark=marks[i];mark.life-=dt;updateWorldScaleAnchor(mark);if(mark.life<0){releaseMark(mark);marks.splice(i,1);}}
    for(let i=flashes.length-1;i>=0;i--){const f=flashes[i];f.life-=dt;f.mesh.scale.addScalar(dt*2);f.mesh.material.opacity=Math.max(0,f.life/f.max);if(f.life<=0){disposeObject(f.mesh);flashes.splice(i,1);}}
  }
  function animate(now) {
    frame=0;
    if(contextLost||document.hidden||!visible)return;
    const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;
    if(!paused)update(dt);
    renderer.render(scene,camera);
    if(!paused)frame=requestAnimationFrame(animate);
  }
  function requestFrame(){
    const rect=range.getBoundingClientRect();
    visible=rect.bottom>0&&rect.top<innerHeight;
    if(!frame&&visible&&!document.hidden&&!contextLost){lastTime=performance.now();frame=requestAnimationFrame(animate);}
  }
  new ResizeObserver(resize).observe(range);
  new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;if(visible)requestFrame();else{cancelNavigation();clearShots();}
  },{threshold:.02}).observe(range);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelNavigation();clearShots();}else requestFrame();});
  canvas.addEventListener('webglcontextlost',e=>{
    e.preventDefault();contextLost=true;cancelNavigation();status.hidden=false;status.textContent='3D 연결이 중단되었습니다. 프로젝트 버튼으로 이동하거나 페이지를 새로고침하세요.';
    range.dataset.engine='fallback';labels.forEach((b,i)=>b.onclick=()=>goTo(targets[i]));
  });
  select('sword');resize();update(0);scene.updateMatrixWorld(true);renderer.render(scene,camera);
  range.dataset.engine='three';status.hidden=true;
}
