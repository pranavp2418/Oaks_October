import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {addOcean,addVegetation,addScannedTrees,addAtmosphere,addSkyline,loadIslandTextures,terrainSurface,curvedTowerGeometry} from './island-scenery.js';
import {environmentState} from './island-environment.js';
import { DISTRICTS, ROAD_LINKS, hash, routeBetween } from './city-model.js';

const clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp;
export function landHeight(x,z) {
  const angle=Math.atan2(z/163,x/206), r=Math.hypot(x/206,z/163);
  const coast=1+.058*Math.sin(angle*5)+.035*Math.cos(angle*9)-.028*Math.sin(angle*13);
  const mask=clamp((coast-r)*8,0,1);
  const n=Math.sin(x*.041+Math.cos(z*.06))*Math.cos(z*.047)+.45*Math.sin(x*.115+z*.075)+.18*Math.cos(x*.34-z*.23);
  let h=5+n*1.3;
  // An eroded northern range and western foothills keep the city in a connected basin.
  h+=45*Math.exp(-(((x+30)/105)**2+((z+120)/33)**2))*(0.57+0.43*Math.abs(Math.sin(x*.059+z*.027)));
  h+=22*Math.exp(-(((x+143)/39)**2+((z+20)/94)**2))*(0.65+.35*Math.sin(z*.06));
  h+=16*Math.exp(-(((x-125)/50)**2+((z+110)/34)**2));
  const relief=clamp((h-9)/20,0,1);
  h+=relief*(Math.sin(x*.23+Math.sin(z*.16))*Math.cos(z*.21)*2.3+Math.sin(x*.67-z*.49)*.65+Math.sin(x*1.49+z*.92)*.2);
  const bay=Math.exp(-(((x-70)/45)**2+((z-137)/25)**2));
  h-=bay*12;
  for(const d of DISTRICTS){const s=Math.exp(-(((x-d.x)/36)**6+((z-d.z)/36)**6));h=mix(h,5.5,s*.98)}
  return mix(-7, h, mask);
}
const seeded=s=>()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};
function noiseTexture() {
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),data=ctx.createImageData(256,256),random=seeded(7102026);
  for(let i=0;i<data.data.length;i+=4){const n=100+random()*145;data.data[i]=n;data.data[i+1]=n;data.data[i+2]=n;data.data[i+3]=255}ctx.putImageData(data,0,0);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(40,40);return t;
}
function facadeTextures(color) {
  const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#214354';ctx.fillRect(0,0,512,1024);
  const e=document.createElement('canvas');e.width=512;e.height=1024;const glow=e.getContext('2d');glow.fillStyle='#000';glow.fillRect(0,0,512,1024);
  const random=seeded(hash(color));
  for(let y=6;y<1024;y+=24)for(let x=4;x<512;x+=32){const lit=random()>.43;ctx.fillStyle=lit?'#91b7cb':'#466a82';ctx.fillRect(x,y,26,17);ctx.fillStyle='#b6ccda';ctx.globalAlpha=.2;ctx.fillRect(x+2,y+1,3,14);ctx.globalAlpha=1;if(lit){glow.fillStyle=color;glow.globalAlpha=.35+random()*.6;glow.fillRect(x,y,26,17)}}
  ctx.strokeStyle='#60737a';ctx.lineWidth=2;for(let x=0;x<512;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1024);ctx.stroke()}
  const map=new THREE.CanvasTexture(c),emissiveMap=new THREE.CanvasTexture(e);map.colorSpace=emissiveMap.colorSpace=THREE.SRGBColorSpace;
  return {map,emissiveMap};
}
const v3=(x,y,z)=>new THREE.Vector3(x,y,z);

export function buildWorld(host, buildings, callbacks) {
  const mobile=matchMedia('(max-width:700px)').matches;
  const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
  const software=!context;
  const renderer=software?new SVGRenderer():new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false,powerPreference:'high-performance'});
  if(software){renderer.setPrecision(1);renderer.setQuality('high');}
  host.dataset.renderer=software?'software-3d':'webgl-3d';
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.35:1.65));renderer.setSize(host.clientWidth,host.clientHeight);
  if(!software){renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  host.append(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene();scene.background=new THREE.Color(software?'#80c6e7':'#86b4d8');scene.fog=new THREE.FogExp2('#86b4d8',.00065);
  const camera=new THREE.PerspectiveCamera(mobile?45:40,host.clientWidth/host.clientHeight,.3,6000);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.screenSpacePanning=false;controls.minDistance=12;controls.maxDistance=mobile?1200:760;controls.minPolarAngle=.035;controls.maxPolarAngle=1.34;controls.zoomSpeed=.72;controls.rotateSpeed=.65;
  controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  const overviewPosition=mobile?v3(500,650,720):v3(295,360,350),overviewTarget=v3(0,3,0);
  camera.position.copy(overviewPosition);controls.target.copy(overviewTarget);controls.update();
  const sun=new THREE.DirectionalLight('#fff0dc',software?1.25:3.25);sun.position.set(-135,230,90);sun.castShadow=!mobile&&!software;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-210;sun.shadow.camera.right=210;sun.shadow.camera.top=210;sun.shadow.camera.bottom=-210;sun.shadow.camera.near=1;sun.shadow.camera.far=620;sun.shadow.normalBias=.35;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
  const hemi=new THREE.HemisphereLight('#cbe9fc','#6a7b55',1.5);scene.add(hemi);
  const softAmbient=software?new THREE.AmbientLight('#c4deef',.6):null;
  if(!software){const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();scene.environment=pmrem.fromScene(environment,.04).texture;environment.dispose();pmrem.dispose();}else scene.add(softAmbient);
  let composer,bloom;
  if(software){composer={render:()=>renderer.render(scene,camera),setSize:()=>{}};bloom={strength:0};}
  else{composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));bloom=new UnrealBloomPass(new THREE.Vector2(host.clientWidth,host.clientHeight),.24,.7,1.15);composer.addPass(bloom);composer.addPass(new OutputPass());}
  const terrainGeometry=new THREE.PlaneGeometry(490,410,software?64:mobile?180:300,software?54:mobile?150:250);terrainGeometry.rotateX(-Math.PI/2);
  const position=terrainGeometry.attributes.position,colors=new Float32Array(position.count*3);
  const forest=new THREE.Color(software?'#71945f':'#bac7ab'),rock=new THREE.Color(software?'#a7a08a':'#d0cdc0'),sand=new THREE.Color(software?'#e2d8b6':'#fbf3db'),undersea=new THREE.Color('#54bcb0');
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),z=position.getZ(i),h=landHeight(x,z);position.setY(i,h);
    const color=forest.clone();if(h<2.2)color.copy(sand).lerp(undersea,clamp((2.2-h)/10,0,1));else if(h>14)color.lerp(rock,clamp((h-14)/12,0,1));if(h>35)color.lerp(rock,.3);
    const grain=.91+.09*Math.sin(x*1.3+z*.74);color.multiplyScalar(grain);color.toArray(colors,i*3);
  }
  terrainGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  if(software){const old=terrainGeometry.index.array,land=[];for(let i=0;i<old.length;i+=3)if(position.getY(old[i])>.4||position.getY(old[i+1])>.4||position.getY(old[i+2])>.4)land.push(old[i],old[i+1],old[i+2]);terrainGeometry.setIndex(land);}
  terrainGeometry.computeVertexNormals();
  const maps=loadIslandTextures(software,host);
  const terrain=new THREE.Mesh(terrainGeometry,terrainSurface(maps,software));terrain.receiveShadow=true;scene.add(terrain);
  const ocean=addOcean(scene,{software,mobile,landHeight,maps});
  const atmosphere=addAtmosphere(scene,{software,mobile,camera});
  const concrete=new THREE.MeshStandardMaterial({color:'#a0a69c',roughness:.88}),roadMaterial=new THREE.MeshStandardMaterial({color:'#384748',roughness:.9}),metal=new THREE.MeshStandardMaterial({color:'#73898e',metalness:.65,roughness:.32});
  const lightMaterials=[];
  const lightMat=color=>{const m=software?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.8,roughness:.4});lightMaterials.push(m);return m;};
  function mesh(geometry,material,parent=scene){
    if(software){const p=geometry.parameters;let reduced;if(geometry.type==='TorusGeometry')reduced=new THREE.TorusGeometry(p.radius,p.tube,3,16);else if(geometry.type==='SphereGeometry')reduced=new THREE.SphereGeometry(p.radius,10,6,p.phiStart,p.phiLength,p.thetaStart,p.thetaLength);else if(geometry.type==='CylinderGeometry')reduced=new THREE.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,8);if(reduced){geometry.dispose();geometry=reduced;}}
    const m=new THREE.Mesh(geometry,material);m.castShadow=!mobile&&!software;m.receiveShadow=true;parent.add(m);return m;
  }
  function box(parent,w,h,d,x,y,z,mat){
    const geometry=h>4&&!software?new RoundedBoxGeometry(w,h,d,3,Math.min(.28,w*.05,d*.05)):new THREE.BoxGeometry(w,h,d);
    const m=mesh(geometry,mat,parent);m.position.set(x,y,z);
    if(software&&mat.userData.facade){const lines=[];for(let level=1;level<h;level+=1.6){const py=y-h/2+level;for(const side of [-1,1]){const pz=z+side*(d/2+.015);lines.push(x-w/2+.25,py,pz,x+w/2-.25,py,pz);const px=x+side*(w/2+.015);lines.push(px,py,z-d/2+.25,px,py,z+d/2-.25);}}const bands=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(lines,3)),new THREE.LineBasicMaterial({color:'#7da7b1',transparent:true,opacity:.7}));parent.add(bands);}
    return m;
  }
  function linePath(points,material,radius=.12,parent=scene){const c=new THREE.CatmullRomCurve3(points);return mesh(new THREE.TubeGeometry(c,Math.max(12,points.length*7),radius,5,false),material,parent)}
  function road(points,width=3.1){
    const dense=new THREE.CatmullRomCurve3(points.map(p=>v3(p.x,0,p.z))).getPoints(software?14:60).map(p=>v3(p.x,landHeight(p.x,p.z)+.25,p.z));
    const geom=new THREE.BufferGeometry(),vertices=[],indices=[];
    for(let i=0;i<dense.length;i++){const prev=dense[Math.max(0,i-1)],next=dense[Math.min(dense.length-1,i+1)],normal=v3(next.z-prev.z,0,prev.x-next.x).normalize().multiplyScalar(width/2);for(const sign of [-1,1]){const p=dense[i].clone().addScaledVector(normal,sign);vertices.push(p.x,p.y,p.z)}if(i){const a=(i-1)*2,b=i*2;indices.push(a,b,a+1,a+1,b,b+1)}}
    geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.setIndex(indices);geom.computeVertexNormals();mesh(geom,roadMaterial).receiveShadow=true;
    const stripe=new THREE.LineDashedMaterial({color:'#b5b8a0',dashSize:1.2,gapSize:1.2});const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(dense.map(p=>p.clone().add(v3(0,.04,0)))),stripe);l.computeLineDistances();scene.add(l);
    return dense;
  }
  const roads=[];for(const [a,b]of ROAD_LINKS){const p=DISTRICTS.find(d=>d.id===a),q=DISTRICTS.find(d=>d.id===b);roads.push(road([p,q],3.5))}
  for(const d of DISTRICTS){
    // Street grids on the basin floor; district tint is a wayfinding cue, not a separate map layer.
    for(let offset=-32;offset<=32;offset+=16){road([{x:d.x-36,z:d.z+offset},{x:d.x+36,z:d.z+offset}],1.55);road([{x:d.x+offset,z:d.z-36},{x:d.x+offset,z:d.z+36}],1.55)}
    const rim=lightMat(d.color),pad=mesh(new THREE.CylinderGeometry(5.7,5.7,.5,48),concrete);pad.position.set(d.x,landHeight(d.x,d.z)+.25,d.z);
    const ring=mesh(new THREE.TorusGeometry(5.4,.07,5,48),rim);ring.rotation.x=Math.PI/2;ring.position.set(d.x,pad.position.y+.28,d.z);
  }
  const facadeMats=new Map();
  for(const d of DISTRICTS){const textures=facadeTextures(d.color),material=new THREE.MeshStandardMaterial({color:software?'#709fb6':'#a9c7db',...textures,emissive:software?'#03080b':'#fff',emissiveIntensity:.12,metalness:.78,roughness:.19});material.userData.facade=true;facadeMats.set(d.id,material);}
  addSkyline(scene,{software,mobile,landHeight,districts:DISTRICTS,buildings,facadeMats});
  const vegetation=addVegetation(scene,{software,mobile,landHeight,maps,districts:DISTRICTS,buildings});
  addScannedTrees(scene,{software,mobile,landHeight,districts:DISTRICTS,buildings,host});
  const sites=new Map(),pickable=[],selectionRing=mesh(new THREE.TorusGeometry(6.2,.13,7,60),lightMat('#c8f8ff'));selectionRing.rotation.x=Math.PI/2;selectionRing.visible=false;
  for(const p of buildings){
    const group=new THREE.Group(),base=Math.max(2,landHeight(p.x,p.z));group.position.set(p.x,base,p.z);scene.add(group);
    const facade=facadeMats.get(p.district),accent=lightMat(p.color),body=new THREE.MeshStandardMaterial({color:'#8c9b99',metalness:.3,roughness:.54});
    box(group,7.5,.6,7.5,0,.15,0,concrete);const kind=p.archetype;let height=22;
    if(kind==='gem'){
      height=47;box(group,6,10,6,0,5,0,facade);box(group,4.8,22,4.8,0,20,0,facade);box(group,3.5,8,3.5,0,35,0,facade);
      const gem=mesh(new THREE.OctahedronGeometry(6,0),new THREE.MeshPhysicalMaterial({color:'#b9c0ff',metalness:.45,roughness:.13,transparent:true,opacity:.84,emissive:'#625399',emissiveIntensity:.25}),group);gem.position.y=43;gem.rotation.y=Math.PI/4;
      const edge=new THREE.LineSegments(new THREE.EdgesGeometry(gem.geometry),new THREE.LineBasicMaterial({color:'#e1d3ff'}));edge.position.copy(gem.position);edge.rotation.copy(gem.rotation);group.add(edge);
      for(const y of [9,19,29,38])box(group,5.8,.1,5.8,0,y,0,accent);
    }else if(kind==='care'){
      height=18;box(group,6.8,5,6.8,0,2.9,0,body);box(group,6,8,2,0,9.3,2,facade);box(group,6,8,2,0,9.3,-2,facade);box(group,2,11,3.2,0,10.8,0,facade);
      const glass=mesh(new THREE.SphereGeometry(3,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshPhysicalMaterial({color:'#8cc5b5',roughness:.1,metalness:.35,transparent:true,opacity:.6}),group);glass.position.y=5.5;
      box(group,2,.2,.65,0,16.5,0,accent);box(group,.65,.2,2,0,16.51,0,accent);
    }else if(kind==='factory'){
      height=17;box(group,7,5,6,0,3,0,body);for(let x=-2.5;x<=2.5;x+=2.5){const roof=mesh(new THREE.CylinderGeometry(1.5,1.5,6,3),metal,group);roof.rotation.z=Math.PI/2;roof.position.set(x,5.3,0)}
      for(const x of [-2.3,2.3]){const chimney=mesh(new THREE.CylinderGeometry(.45,.65,11,12),metal,group);chimney.position.set(x,10.5,-1.7);const lip=mesh(new THREE.TorusGeometry(.5,.08,5,12),accent,group);lip.rotation.x=Math.PI/2;lip.position.set(x,16,-1.7)}
      box(group,7,.12,.2,0,4.7,3.05,accent);box(group,2,3.5,2.5,2,7,1,facade);
    }else if(kind==='signal'){
      height=32;box(group,6.5,5,6.5,0,3,0,body);box(group,4.8,19,4.8,0,14,0,facade);box(group,3.5,5,3.5,0,26,0,metal);
      const antenna=mesh(new THREE.CylinderGeometry(.12,.3,6,8),metal,group);antenna.position.y=31;
      for(const y of [12,19,25]){const ring=mesh(new THREE.TorusGeometry(3.5,.11,6,36),accent,group);ring.rotation.x=Math.PI/2;ring.position.y=y}
    }else if(kind==='vault'){
      height=24;box(group,6,5,6,0,3,0,body);box(group,4.8,17,4.8,0,13,0,facade);for(const x of [-2.7,2.7])box(group,.25,22,.25,x,12,2.7,metal);box(group,6.2,.2,6.2,0,22,0,accent);
      const dome=mesh(new THREE.SphereGeometry(2.5,24,12,0,Math.PI*2,0,Math.PI/2),metal,group);dome.position.y=22;
    }else if(kind==='campus'){
      height=15;for(const x of [-2.2,2.2])box(group,2,9,6,x,5,0,facade);box(group,6.5,3,2,0,9,0,body);box(group,6.5,.15,2,0,10.6,0,accent);
      const dome=mesh(new THREE.SphereGeometry(2.1,20,12,0,Math.PI*2,0,Math.PI/2),metal,group);dome.position.y=11;
    }else if(kind==='exchange'){
      height=39;box(group,7,5,7,0,3,0,body);
      for(const sign of [-1,1]){const h=sign<0?34:29,tower=mesh(curvedTowerGeometry(3.2,h,4.5,{software,bend:sign*.25}),facade,group);tower.position.set(sign*1.8,5+h/2,0);const ribs=[];for(let level=0;level<h;level+=1.4){const t=level/h,cx=sign*1.8+Math.sin(t*Math.PI/2)*3.2*sign*.25;for(let a=0;a<12;a++){const theta=a/12*Math.PI*2,next=(a+1)/12*Math.PI*2,rx=3.2*(.52-.09*t),rz=4.5*(.52-.09*t);ribs.push(cx+Math.cos(theta)*rx,5+level,Math.sin(theta)*rz,cx+Math.cos(next)*rx,5+level,Math.sin(next)*rz);}}group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(ribs,3)),new THREE.LineBasicMaterial({color:'#bfd2de',transparent:true,opacity:.6})));}
      box(group,7,.12,7,0,5.5,0,accent);
    }else{
      height=22;box(group,6.4,5,6.4,0,3,0,body);box(group,5,height*.6,5,0,5+height*.3,0,facade);box(group,3.6,height*.23,3.6,0,height*.8,0,facade);
      for(const y of [5,height*.63,height*.92])box(group,5.5,.12,5.5,0,y,0,accent);box(group,.18,4,.18,0,height,0,metal);
    }
    // The invisible pick volume belongs to the project; surrounding skyline never opens a false project.
    const hit=mesh(new THREE.BoxGeometry(8,height+5,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),group);hit.position.y=(height+5)/2;hit.userData.slug=p.slug;pickable.push(hit);
    const beacon=mesh(new THREE.CylinderGeometry(.14,.14,5,8),accent,group);beacon.position.set(0,height+3.5,0);
    let lod=null,details=null;if(buildings.length>40){details=group.children.filter(c=>c!==hit&&c!==beacon);lod=mesh(new THREE.BoxGeometry(6,height,6),facade,group);lod.position.y=height/2;lod.visible=false;}
    sites.set(p.slug,{p,group,height,base,beacon,lod,details});road([{x:p.x,z:p.z},{x:p.x,z:DISTRICTS.find(d=>d.id===p.district).z},{x:DISTRICTS.find(d=>d.id===p.district).x,z:DISTRICTS.find(d=>d.id===p.district).z}],1.4);
  }
  // Pip is a physical guide in the scene; its route follows the connected district roads.
  const pip=new THREE.Group(),pipShell=new THREE.MeshStandardMaterial({color:'#e1eded',metalness:.3,roughness:.25}),pipFace=new THREE.MeshStandardMaterial({color:'#102731',roughness:.3}),pipLight=lightMat('#88efff');
  mesh(new THREE.SphereGeometry(1.5,24,16),pipShell,pip);box(pip,2.3,.9,.25,0,.15,1.3,pipFace);for(const x of [-.58,.58])box(pip,.35,.28,.1,x,.2,1.48,pipLight);
  const halo=mesh(new THREE.TorusGeometry(1.8,.06,6,40),pipLight,pip);halo.rotation.x=Math.PI/2;halo.position.y=-.6;scene.add(pip);
  pip.position.set(-18,landHeight(-18,-5)+3.5,-5);
  let pipDistrict='creative',pipTrip=null,routeLine=null,flight=null,environment=environmentState(new Date(),null),enabledMotion=true,selected=null,visibleSlugs=new Set(buildings.map(p=>p.slug)),lastDraw=0,hover=null;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
  function cast(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(pickable,false).find(hit=>visibleSlugs.has(hit.object.userData.slug))?.object.userData.slug;}
  renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,time:performance.now()}});
  renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7&&performance.now()-down.time<900){const slug=cast(e);if(slug)callbacks.select(slug)}down=null;});
  renderer.domElement.addEventListener('pointermove',e=>{if(down)return;const slug=cast(e);if(slug!==hover){hover=slug;renderer.domElement.style.cursor=slug?'pointer':'grab';callbacks.hover?.(slug)}});
  controls.addEventListener('start',()=>{flight=null;});
  function fly(position,target,duration=1400){flight={from:camera.position.clone(),targetFrom:controls.target.clone(),to:position,target,start:performance.now(),duration:enabledMotion?duration:0};}
  function focus(slug,{guide=true}={}){
    const site=sites.get(slug);if(!site)return;selected=slug;selectionRing.visible=true;selectionRing.position.set(site.p.x,site.base+.7,site.p.z);
    if(mobile)camera.setViewOffset(host.clientWidth,host.clientHeight,0,host.clientHeight*.15,host.clientWidth,host.clientHeight);
    const target=v3(site.p.x,site.base+site.height*.36,site.p.z),distance=mobile?site.height*2.5+30:site.height*1.5+28;
    fly(target.clone().add(v3(distance*.85,distance*.82,distance)),target);
    if(guide)navigatePip(site);callbacks.view?.(site.p.title);
  }
  function navigatePip(site){
    const route=routeBetween(pipDistrict,site.p.district),points=[pip.position.clone(),...route.map(d=>v3(d.x,landHeight(d.x,d.z)+3.5,d.z)),v3(site.p.x,site.base+3.5,site.p.z)];
    pipDistrict=site.p.district;const curve=new THREE.CatmullRomCurve3(points);if(routeLine){scene.remove(routeLine);routeLine.geometry.dispose();routeLine.material.dispose();}
    const trace=curve.getPoints(130).map(p=>v3(p.x,Math.max(landHeight(p.x,p.z)+.6,1),p.z));routeLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(trace),new THREE.LineDashedMaterial({color:'#99f0ff',dashSize:1.2,gapSize:.7,transparent:true,opacity:.8}));routeLine.computeLineDistances();scene.add(routeLine);
    pipTrip={curve,start:performance.now(),duration:enabledMotion?clamp(curve.getLength()*27,1800,6000):0};callbacks.travel?.('Pip is taking you to '+site.p.title+'.');
  }
  function overview(top=false){selected=null;selectionRing.visible=false;camera.clearViewOffset();fly(top?v3(0,mobile?1120:520,.5):overviewPosition.clone(),overviewTarget.clone(),1600);callbacks.view?.(top?'TOP DOWN':'COUNTRY VIEW');}
  function setEnvironment(value){
    environment=value;const dark=value.night,light=value.daylight,warm=(1-dark)*(1-clamp((value.altitude-1)/15,0,1)),cloud=value.cloudCover;
    const skyColor=new THREE.Color('#8fc6e9').lerp(new THREE.Color('#ecb289'),warm*.65).lerp(new THREE.Color('#050d25'),dark).lerp(new THREE.Color('#7c8a99'),cloud*(1-dark)*.45);
    scene.background.copy(skyColor);scene.fog.color.copy(skyColor);scene.fog.density=value.fog?.0038:.00065+cloud*.00065;
    sun.position.set(value.sunDirection.x*270,Math.max(10,value.sunDirection.y*270),value.sunDirection.z*270);sun.intensity=(software?1.6:3.8)*light*(1-cloud*.7);sun.color.set('#fff4db').lerp(new THREE.Color('#ffb076'),warm*.8);
    hemi.intensity=mix(software?.38:.25,1.55,light)*(1-cloud*.2);hemi.color.set('#c9ebff').lerp(new THREE.Color('#315787'),dark);if(softAmbient)softAmbient.intensity=mix(.18,.45,light);
    renderer.toneMappingExposure=mix(.78,1.05,light);bloom.strength=mix(.48,.19,light);
    scene.environmentIntensity=mix(.15,.9,light)*(1-cloud*.45);
    for(const material of facadeMats.values()){material.emissiveIntensity=.06+dark*1.2;if(software){material.emissive.set('#163348').lerp(new THREE.Color('#254b62'),dark);material.color.set('#76a9c0').lerp(new THREE.Color('#183451'),dark*.85);}}
    for(const material of lightMaterials)if(material.emissive)material.emissiveIntensity=.9+dark*2.4;
    host.dataset.lighting=dark>.45?'night':'day';host.dataset.weather=value.weatherStatus==='unavailable'?'unavailable':value.weather?.kind||'unavailable';
    ocean.setEnvironment(value);
  }
  setEnvironment(environment);
  function panTo(x,z){const target=v3(clamp(x,-210,210),landHeight(x,z)+3,clamp(z,-160,160)),offset=camera.position.clone().sub(controls.target);fly(target.clone().add(offset),target,800);}
  function zoom(factor){const diff=camera.position.clone().sub(controls.target),distance=clamp(diff.length()*factor,controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(diff.setLength(distance));flight=null;controls.update();}
  function setVisible(slugs){visibleSlugs=new Set(slugs);for(const [slug,s]of sites)s.beacon.visible=visibleSlugs.has(slug);}
  function labelPositions(){const result=[];for(const [slug,s]of sites){if(!visibleSlugs.has(slug))continue;const w=v3(s.p.x,s.base+s.height+7,s.p.z),screen=w.clone().project(camera);result.push({slug,x:(screen.x*.5+.5)*host.clientWidth,y:(-.5*screen.y+.5)*host.clientHeight,visible:screen.z<1&&screen.z>-1&&Math.abs(screen.x)<.94&&Math.abs(screen.y)<.94,distance:w.distanceTo(camera.position)})}return result.sort((a,b)=>a.distance-b.distance);}
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;if(camera.view?.enabled)camera.setViewOffset(w,h,0,h*.15,w,h);camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setSize(w,h);};const observer=new ResizeObserver(resize);observer.observe(host);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();callbacks.contextLost?.();});
  renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
  function animate(now){requestAnimationFrame(animate);if(document.hidden||now-lastDraw<(software?65:mobile?33:22))return;lastDraw=now;
    if(flight){const t=flight.duration?clamp((now-flight.start)/flight.duration,0,1):1,e=1-(1-t)**3;camera.position.lerpVectors(flight.from,flight.to,e);controls.target.lerpVectors(flight.targetFrom,flight.target,e);if(t===1)flight=null;}
    if(pipTrip){const t=pipTrip.duration?clamp((now-pipTrip.start)/pipTrip.duration,0,1):1,pos=pipTrip.curve.getPointAt(t);pos.y=Math.max(landHeight(pos.x,pos.z)+3.5,pos.y);pip.position.copy(pos);const next=pipTrip.curve.getPointAt(Math.min(1,t+.005));pip.rotation.y=Math.atan2(next.x-pos.x,next.z-pos.z);if(t===1){pipTrip=null;callbacks.travel?.('You have arrived. Select Step inside to open the project.');}}
    ocean.update(now*.001);vegetation.update(now*.001,environment);atmosphere.update(now*.001,environment);
    pip.position.y+=Math.sin(now*.002)*.006;if(selectionRing.material.emissive)selectionRing.material.emissiveIntensity=1.8+Math.sin(now*.003)*.4;
    controls.update();for(const s of sites.values())if(s.lod){const near=s.p.slug===selected||camera.position.distanceTo(s.group.position)<130;s.lod.visible=!near;for(const child of s.details)child.visible=near;}composer.render();callbacks.frame?.(labelPositions(),camera.position,controls.target,renderer.info.render);
    // Leave a real input-processing gap after expensive software drawing, while motion stays active.
    if(software)lastDraw=performance.now();
  }
  requestAnimationFrame(animate);
  return {focus,overview,setEnvironment,zoom,panTo,setVisible,sites,camera,controls,renderer,
    north(){const offset=camera.position.clone().sub(controls.target);fly(controls.target.clone().add(v3(0,offset.y,Math.hypot(offset.x,offset.z))),controls.target.clone(),800);},
    rotate(x,y){const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));s.theta+=x;s.phi=clamp(s.phi+y,.04,1.3);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));flight=null;controls.update();}
  };
}
