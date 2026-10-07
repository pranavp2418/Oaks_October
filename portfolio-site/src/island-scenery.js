import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp,TAU=Math.PI*2;
export const randomSeed=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
export function shoreline(landHeight,count=144){
  return Array.from({length:count},(_,i)=>{const a=i/count*TAU;let low=.45,high=1.24;for(let j=0;j<18;j++){const r=(low+high)/2;if(landHeight(Math.cos(a)*206*r,Math.sin(a)*163*r)>.45)low=r;else high=r;}const r=(low+high)/2;return new THREE.Vector3(Math.cos(a)*206*r,.45,Math.sin(a)*163*r);});
}
function typedColor(g,color){const c=new Float32Array(g.attributes.position.count*3);for(let i=0;i<g.attributes.position.count;i++)color.toArray(c,i*3);g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;}
function mergeInto(scene,geometries,material){if(!geometries.length)return null;const joined=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();const mesh=new THREE.Mesh(joined,material);mesh.receiveShadow=true;scene.add(mesh);return mesh;}
export function loadIslandTextures(software,host){
  if(software){host.dataset.surfaceDetail='geometry';return {};}
  const loader=new THREE.TextureLoader(),maps={},names=['sand-color','sand-normal','rock-color','rock-normal','grass-color','foliage-color','foliage-alpha','bark-color'];let remaining=names.length,failed=false;
  host.dataset.surfaceDetail='loading';
  for(const name of names){const t=loader.load('/assets/island/'+name+'.webp',()=>{if(!--remaining)host.dataset.surfaceDetail=failed?'partial':'photographic';},()=>{failed=true;if(!--remaining)host.dataset.surfaceDetail='partial';});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(name.endsWith('color'))t.colorSpace=THREE.SRGBColorSpace;maps[name]=t;}
  return maps;
}
export function terrainSurface(maps,software){
  const material=new THREE.MeshStandardMaterial({color:software?'#c5ceaa':'#fff',vertexColors:true,roughness:.96});
  if(software)return material;
  maps['sand-normal'].repeat.set(36,30);material.normalMap=maps['sand-normal'];material.normalScale=new THREE.Vector2(.32,.32);
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{islandSand:{value:maps['sand-color']},islandRock:{value:maps['rock-color']},islandGrass:{value:maps['grass-color']}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vIslandPosition;varying vec3 vIslandNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvIslandPosition=position;vIslandNormal=normal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vIslandPosition;varying vec3 vIslandNormal;uniform sampler2D islandSand;uniform sampler2D islandRock;uniform sampler2D islandGrass;').replace('#include <map_fragment>',`#include <map_fragment>
      vec2 islandUV=vIslandPosition.xz/18.;
      float sandWeight=1.-smoothstep(2.7,5.7,vIslandPosition.y);
      float rockWeight=max(smoothstep(13.,35.,vIslandPosition.y),smoothstep(.22,.68,1.-abs(normalize(vIslandNormal).y)));
      vec3 islandSurface=mix(texture2D(islandGrass,islandUV*.65).rgb,texture2D(islandRock,islandUV*.8).rgb,rockWeight);
      islandSurface=mix(islandSurface,texture2D(islandSand,islandUV).rgb,sandWeight);
      diffuseColor.rgb*=islandSurface;`);
  };material.customProgramCacheKey=()=> 'island-surface-v2';return material;
}
export function curvedTowerGeometry(width,height,depth,{software=false,bend=.12}={}){
  const geometry=new THREE.CylinderGeometry(.43,.52,1,software?10:32,software?2:12,false),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const t=p.getY(i)+.5;p.setXYZ(i,p.getX(i)*width+Math.sin(t*Math.PI/2)*width*bend,p.getY(i)*height,p.getZ(i)*depth);}
  geometry.computeVertexNormals();geometry.type='BufferGeometry';return geometry;
}
export function addSkyline(scene,{software,mobile,landHeight,districts,buildings,facadeMats}){
  const random=randomSeed(90210),byDistrict=new Map(districts.map(d=>[d.id,[]])),edges=[],count=software?100:mobile?180:260;
  for(let i=0,attempts=0;i<count&&attempts<count*40;attempts++){
    const district=districts[Math.floor(random()*districts.length)],x=district.x+(random()-.5)*67,z=district.z+(random()-.5)*67;
    if(buildings.some(p=>Math.hypot(p.x-x,p.z-z)<10)||Math.hypot(x-district.x,z-district.z)<9)continue;
    i++;const width=2.4+random()*3,height=4+random()**2*28,depth=width*(.65+random()*.35),curved=random()>.38&&height>11;
    const geometry=curved?curvedTowerGeometry(width,height,depth,{software,bend:.15+random()*.12}):new THREE.BoxGeometry(width,height,depth),base=landHeight(x,z);
    geometry.translate(x,base+height/2,z);byDistrict.get(district.id).push(geometry);
    // Actual facade floor joints and vertical mullions remain legible without texture support.
    const floors=Math.floor(height/1.35),radial=curved?(software?8:12):4;
    for(let f=1;f<floors;f++){const y=base+f*1.35,t=f/floors,rx=curved?width*(.52-.09*t):width*.51,rz=curved?depth*(.52-.09*t):depth*.51,cx=x+(curved?Math.sin(t*Math.PI/2)*width*.19:0);for(let j=0;j<radial;j++){const a=j/radial*TAU,b=(j+1)/radial*TAU;edges.push(cx+Math.cos(a)*rx,y,z+Math.sin(a)*rz,cx+Math.cos(b)*rx,y,z+Math.sin(b)*rz);}}
    for(let j=0;j<(curved?6:4);j++){const a=j/(curved?6:4)*TAU;edges.push(x+Math.cos(a)*width*.52,base,z+Math.sin(a)*depth*.52,x+Math.cos(a)*width*.43+(curved?width*.19:0),base+height,z+Math.sin(a)*depth*.43);}
    if(!curved&&random()>.5){const roof=new THREE.BoxGeometry(width*.65,.65,depth*.7);roof.translate(x,base+height+.32,z);byDistrict.get(district.id).push(roof);}
  }
  for(const [id,geometries]of byDistrict){const mesh=mergeInto(scene,geometries,facadeMats.get(id));if(mesh)mesh.castShadow=!mobile;}
  const mullions=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(edges,3)),new THREE.LineBasicMaterial({color:software?'#a6bfca':'#9cadb9',transparent:true,opacity:software?.52:.35}));scene.add(mullions);
}
export function addOcean(scene,{software,mobile,landHeight,maps}){
  const coast=shoreline(landHeight),random=randomSeed(781026),foam=[];
  const uniforms={uTime:{value:0},uNight:{value:0},uDay:{value:1},uCloud:{value:0},uWind:{value:new THREE.Vector2(.4,.8)},uWave:{value:.4},uSun:{value:new THREE.Vector3(-.5,.6,.6)},uWarm:{value:0}};
  const waterMaterial=software?new THREE.MeshBasicMaterial({color:'#168dab'}):new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:`
    uniform float uTime;uniform float uWave;uniform vec2 uWind;varying vec3 vWorld;
    float wave(vec2 p){return (sin(dot(p,uWind)*.09+uTime*1.1)*.65+sin(p.x*.17+p.y*.12-uTime*.7)*.35)*uWave;}
    void main(){vec3 p=position;p.z+=wave(p.xy);vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}
  `,fragmentShader:`
    uniform float uTime;uniform float uNight;uniform float uDay;uniform float uCloud;uniform float uWave;uniform vec2 uWind;uniform vec3 uSun;uniform float uWarm;varying vec3 vWorld;
    float ripple(vec2 p){return sin(dot(p,uWind)*.09+uTime*1.1)*.65+sin(p.x*.17+p.y*.12-uTime*.7)*.35;}
    void main(){vec2 p=vWorld.xz;float a=atan(p.y/163.,p.x/206.);float coast=1.+.058*sin(a*5.)+.035*cos(a*9.)-.028*sin(a*13.);
      float offshore=length(vec2(p.x/206.,p.y/163.))-coast;float shallow=exp(-max(offshore,0.)*7.5);
      vec3 normal=normalize(vec3((ripple(p+vec2(1.,0.))-ripple(p))*uWave,1.,(ripple(p+vec2(0.,1.))-ripple(p))*uWave));
      vec3 eye=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(normal,eye),0.),4.);float reflection=pow(max(dot(reflect(-uSun,normal),eye),0.),180.);
      vec3 deep=vec3(.016,.26,.39),lagoon=vec3(.20,.77,.73);vec3 color=mix(deep,lagoon,shallow*.85);
      float caustic=pow(abs(sin(p.x*.47+uTime*.7)*cos(p.y*.52-uTime*.45)),10.)+pow(abs(sin((p.x+p.y)*.33-uTime*.5)),16.);
      color+=caustic*shallow*.075;
      vec3 sky=mix(vec3(.58,.79,.91),vec3(.34,.42,.46),uCloud);sky=mix(sky,vec3(.92,.51,.26),uWarm*.5);
      color=mix(color,sky,fresnel*.65)+reflection*vec3(1.,.85,.60)*uDay*(1.-uCloud*.8)*.9;
      color=mix(color,vec3(.008,.028,.06)+color*.10,uNight);
      float surf=(1.-smoothstep(.01,.075,abs(offshore-.027)))*pow(.5+.5*sin(offshore*270.-uTime*1.8+sin(a*19.)*.4),8.);
      color=mix(color,mix(vec3(.93,.99,.97),vec3(.24,.35,.46),uNight),surf*.72);
      gl_FragColor=vec4(color,mix(.97,.72,shallow)*(1.-surf*.1));}
  `});
  // Smaller software faces survive SVGRenderer's near-plane clipping around the camera.
  const water=new THREE.Mesh(new THREE.PlaneGeometry(4200,4200,software?32:mobile?128:220,software?32:mobile?128:220),waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=.4;if(software)water.renderOrder=-1000;scene.add(water);
  // Five bands follow the actual sampled shoreline; their phases give incoming, receding surf.
  for(let band=0;band<(software?3:5);band++){
    const geom=new THREE.BufferGeometry(),positions=new Float32Array(coast.length*2*3),indices=[];
    for(let i=0;i<coast.length;i++){const j=(i+1)%coast.length;indices.push(i*2,j*2,i*2+1,i*2+1,j*2,j*2+1);}
    geom.setAttribute('position',new THREE.BufferAttribute(positions,3));geom.setIndex(indices);
    const mat=new THREE.MeshBasicMaterial({color:'#e9fcf5',transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geom,mat);mesh.frustumCulled=false;scene.add(mesh);foam.push({geom,mat,band});
  }
  const rockMat=new THREE.MeshStandardMaterial({color:'#9d9b86',roughness:.95,map:software?null:maps['rock-color'],normalMap:software?null:maps['rock-normal'],normalScale:new THREE.Vector2(.8,.8)}),rocks=[];
  // Limestone headlands and offshore crags, each with a different erosion silhouette.
  for(let i=0;i<(software?22:65);i++){const point=coast[Math.floor(random()*coast.length)],angle=Math.atan2(point.z,point.x),offset=2+random()*11,x=point.x+Math.cos(angle)*offset,z=point.z+Math.sin(angle)*offset;if(landHeight(x,z)>3)continue;const g=new THREE.SphereGeometry(1,software?7:16,software?5:12),p=g.attributes.position;
    for(let j=0;j<p.count;j++){const k=.78+random()*.38;p.setXYZ(j,p.getX(j)*k,p.getY(j)*(.8+random()*.25),p.getZ(j)*k);}g.computeVertexNormals();g.scale(1.5+random()*2.7,2+random()*5,1.5+random()*2.5);g.translate(x,-.5,z);rocks.push(g);
  }mergeInto(scene,rocks,rockMat);
  const coral=[];
  for(let i=0;i<(software?25:100);i++){const c=coast[Math.floor(random()*coast.length)].clone(),a=Math.atan2(c.z,c.x),r=5+random()*22;c.x+=Math.cos(a)*r;c.z+=Math.sin(a)*r;if(landHeight(c.x,c.z)>-.8)continue;const g=new THREE.IcosahedronGeometry(1,software?0:1);g.scale(2+random()*2.5,.35+random()*.7,1.2+random()*2);g.translate(c.x,software?.24:-1.1,c.z);typedColor(g,new THREE.Color().setHSL(.43+random()*.2,.24,.33+random()*.16));coral.push(g);}
  mergeInto(scene,coral,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  let environment={night:0,daylight:1,cloudCover:0,altitude:35,wind:8,windDirection:150};
  return {setEnvironment(e){environment=e;},update(t){
    const e=environment,dark=e.night||0,warm=(1-dark)*(1-clamp((e.altitude-1)/15,0,1));
    if(software)waterMaterial.color.set('#168dab').lerp(new THREE.Color('#06152f'),dark).lerp(new THREE.Color('#bf9974'),warm*.21);
    else{uniforms.uTime.value=t;uniforms.uNight.value=dark;uniforms.uDay.value=e.daylight;uniforms.uCloud.value=e.cloudCover;uniforms.uWave.value=.25+e.wind*.018+(e.storm?.55:0);uniforms.uSun.value.set(e.sunDirection.x,e.sunDirection.y,e.sunDirection.z);uniforms.uWind.value.set(Math.sin(e.windDirection*Math.PI/180),Math.cos(e.windDirection*Math.PI/180));uniforms.uWarm.value=warm;}
    for(const f of foam){const cycle=(t*.095+f.band/(software?3:5))%1,offset=(1-cycle)*7+.25,width=.3+Math.sin(cycle*Math.PI)*.55,attr=f.geom.attributes.position;
      for(let i=0;i<coast.length;i++){const c=coast[i],dx=c.x/Math.hypot(c.x,c.z),dz=c.z/Math.hypot(c.x,c.z),j=i*2;attr.setXYZ(j,c.x+dx*offset,.58+Math.sin(t*1.8+i*.3)*.045,c.z+dz*offset);attr.setXYZ(j+1,c.x+dx*(offset+width),.58+Math.sin(t*1.8+i*.3)*.045,c.z+dz*(offset+width));}attr.needsUpdate=true;f.mat.opacity=Math.sin(cycle*Math.PI)*mix(.48,.12,dark);f.mat.color.set(dark>.5?'#698aab':'#eefef9');
    }
  }};
}
function palmGeometry(detail=8){
  const trunk=[],leaves=[],curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.2,2,0),new THREE.Vector3(.55,4.7,.15),new THREE.Vector3(.35,6,.3)]);trunk.push(new THREE.TubeGeometry(curve,detail,.18,6,false));
  for(let a=0;a<9;a++){const angle=a/9*TAU,verts=[],idx=[];for(let k=0;k<=detail;k++){const t=k/detail,r=t*3.3,y=6.2+Math.sin(t*Math.PI)*.9-t*t*1.2,width=Math.sin(t*Math.PI)*.45;for(const side of [-1,1])verts.push(Math.cos(angle)*r+Math.sin(angle)*width*side,y,Math.sin(angle)*r-Math.cos(angle)*width*side);if(k){const q=(k-1)*2;idx.push(q,q+1,q+2,q+1,q+3,q+2)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();leaves.push(g);}
  return {trunk:mergeGeometries(trunk),leaves:mergeGeometries(leaves)};
}
export function addVegetation(scene,{software,mobile,landHeight,maps,districts,buildings}){
  const random=randomSeed(425773),trunks=[],palms=[],crowns=[],palm=palmGeometry(software?4:12),count=software?60:mobile?360:700;
  const bark=new THREE.MeshStandardMaterial({color:'#887657',roughness:.93,map:software?null:maps['bark-color']}),leafMat=new THREE.MeshStandardMaterial({vertexColors:true,color:'#759c58',roughness:.82,side:THREE.DoubleSide});
  for(let i=0,tries=0;i<count&&tries<count*25;tries++){const x=(random()-.5)*385,z=(random()-.5)*305,h=landHeight(x,z);if(h<3||h>38||districts.some(d=>Math.abs(x-d.x)<40&&Math.abs(z-d.z)<40)||buildings.some(p=>Math.hypot(p.x-x,p.z-z)<9))continue;i++;
    const size=.65+random()*.65,matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,h,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),random()*TAU),new THREE.Vector3(size,size,size));
    if(random()<.55){trunks.push(palm.trunk.clone().applyMatrix4(matrix));palms.push(typedColor(palm.leaves.clone().applyMatrix4(matrix),new THREE.Color().setHSL(.23+random()*.1,.32+random()*.25,.25+random()*.11)));}
    else{const g=new THREE.CylinderGeometry(.09,.25,3.9,software?5:8).translate(0,1.9,0).applyMatrix4(matrix);trunks.push(g);
      for(let b=0;b<(software?3:7);b++){const crown=new THREE.SphereGeometry(1,software?5:10,software?3:7);crown.scale(1.2+random(),.8+random()*.7,1.1+random());crown.translate((random()-.5)*2,3.5+random()*1.7,(random()-.5)*2);crown.applyMatrix4(matrix);typedColor(crown,new THREE.Color().setHSL(.25+random()*.09,.35+random()*.2,.21+random()*.13));crowns.push(crown);}
    }
  }
  // Small palms line the district plazas without hiding the project buildings.
  for(const d of districts)for(let i=0;i<4;i++){const angle=i*TAU/4,x=d.x+Math.cos(angle)*10,z=d.z+Math.sin(angle)*10;if(buildings.some(p=>Math.hypot(p.x-x,p.z-z)<8))continue;const m=new THREE.Matrix4().makeScale(.65,.65,.65);m.setPosition(x,landHeight(x,z),z);trunks.push(palm.trunk.clone().applyMatrix4(m));palms.push(typedColor(palm.leaves.clone().applyMatrix4(m),new THREE.Color('#5b8c48')));}
  mergeInto(scene,trunks,bark);const palmMesh=mergeInto(scene,palms,leafMat),crownMat=new THREE.MeshStandardMaterial({color:'#69944f',vertexColors:true,roughness:.94});
  if(!software){crownMat.map=maps['foliage-color'];crownMat.normalScale=new THREE.Vector2(.2,.2);}
  const crownMesh=mergeInto(scene,crowns,crownMat);if(palmMesh)palmMesh.castShadow=!mobile;if(crownMesh)crownMesh.castShadow=!mobile;
  // Texture-backed leaf cards add irregular edges and real leaf detail to close canopy surfaces.
  if(!software){const material=new THREE.MeshStandardMaterial({map:maps['foliage-color'],alphaMap:maps['foliage-alpha'],alphaTest:.45,side:THREE.DoubleSide,roughness:.9,color:'#d1e8b7'}),cards=[];for(let i=0;i<(mobile?160:500);i++){const x=(random()-.5)*365,z=(random()-.5)*280,h=landHeight(x,z);if(h<5||h>30||districts.some(d=>Math.abs(x-d.x)<41&&Math.abs(z-d.z)<41))continue;const g=new THREE.PlaneGeometry(3.5,2.8);g.rotateY(random()*TAU);g.rotateX((random()-.5));g.translate(x,h+3.8,z);cards.push(g);}const leaves=mergeInto(scene,cards,material);if(leaves)leaves.castShadow=!mobile;}
  // The vertices are deformed in a shader, preserving roots while crowns sway with reported wind.
  const wind={value:0},strength={value:.025};if(!software)for(const m of [leafMat,crownMat]){m.onBeforeCompile=shader=>{shader.uniforms.islandWind=wind;shader.uniforms.islandWindStrength=strength;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float islandWind;uniform float islandWindStrength;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(islandWind+position.z*.4+position.x*.15)*islandWindStrength*max(0.,sin(position.y*.6));');};}
  return {update(t,e){wind.value=t;strength.value=.035+(e.wind||8)*.005;}};
}
export function scannedTreePlacements({mobile,landHeight,districts,buildings}){
  const random=randomSeed(762821),placements=[],count=mobile?12:42;
  for(let i=0;i<count*40&&placements.length<count;i++){
    const x=(random()-.5)*350,z=(random()-.5)*265,h=landHeight(x,z);
    if(h<4||h>34||districts.some(d=>Math.abs(x-d.x)<42&&Math.abs(z-d.z)<42)||buildings.some(p=>Math.hypot(p.x-x,p.z-z)<12)||placements.some(p=>Math.hypot(p.x-x,p.z-z)<9))continue;
    placements.push({x,z,y:h,scale:1.6+random()*1.1,rotation:random()*TAU});
  }return placements;
}
export async function addScannedTrees(scene,{software,mobile,landHeight,districts,buildings,host}){
  if(software){host.dataset.treeDetail='procedural';return;}
  host.dataset.treeDetail='loading';
  try{
    const [{GLTFLoader},{MeshoptDecoder}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/libs/meshopt_decoder.module.js')]);
    const model=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/assets/island/coastal-tree.glb');
    model.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model.scene),center=bounds.getCenter(new THREE.Vector3());
    const placements=scannedTreePlacements({mobile,landHeight,districts,buildings}),baseMatrices=placements.map(p=>new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.rotation),new THREE.Vector3(p.scale,p.scale,p.scale)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z)));
    model.scene.traverse(part=>{if(!part.isMesh)return;const material=part.material.clone();if(material.alphaTest){material.transparent=false;material.depthWrite=true;}
      const trees=new THREE.InstancedMesh(part.geometry,material,placements.length);
      // Keep quantized vertices intact; compose the source node transform into each instance.
      for(let i=0;i<placements.length;i++)trees.setMatrixAt(i,baseMatrices[i].clone().multiply(part.matrixWorld));
      trees.instanceMatrix.needsUpdate=true;trees.computeBoundingSphere();trees.castShadow=!mobile;trees.receiveShadow=true;scene.add(trees);
    });host.dataset.treeDetail='photogrammetry';
  }catch(error){host.dataset.treeDetail='procedural-fallback';console.warn('Coastal tree detail could not load; the procedural forest remains available.',error);}
}
function cloudTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d'),random=randomSeed(7281);for(let i=0;i<65;i++){const x=60+random()*392,y=100+random()*310,r=30+random()*90,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}return new THREE.CanvasTexture(canvas);}
export function addAtmosphere(scene,{software,mobile,camera}){
  const random=randomSeed(128910),clouds=[],cloudGroup=new THREE.Group();scene.add(cloudGroup);let sky=null;
  if(!software){sky=new Sky();sky.scale.setScalar(2200);sky.material.uniforms.turbidity.value=3;sky.material.uniforms.rayleigh.value=1.8;sky.material.uniforms.mieCoefficient.value=.004;sky.material.uniforms.mieDirectionalG.value=.82;scene.add(sky);const texture=cloudTexture();for(let i=0;i<22;i++){const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:0,color:'#fff'}),cloud=new THREE.Mesh(new THREE.PlaneGeometry(100+random()*160,50+random()*65),material);cloud.position.set((random()-.5)*950,100+random()*90,(random()-.5)*950);cloud.userData.initial=cloud.position.clone();clouds.push(cloud);cloudGroup.add(cloud);}}
  else for(let i=0;i<10;i++){const cloud=new THREE.Mesh(new THREE.SphereGeometry(1,8,5),new THREE.MeshLambertMaterial({color:'#e6edf1',transparent:true,opacity:0,depthWrite:false}));cloud.scale.set(34+random()*18,5+random()*4,15+random()*15);cloud.position.set((random()-.5)*550,95+random()*35,(random()-.5)*420);cloud.userData.initial=cloud.position.clone();clouds.push(cloud);cloudGroup.add(cloud);}
  const starGeometry=new THREE.BufferGeometry(),starPositions=[];for(let i=0;i<(software?75:650);i++){const a=random()*TAU,r=1000+random()*300,y=300+random()*900;starPositions.push(Math.cos(a)*r,y,Math.sin(a)*r);}starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#c9e3ff',size:software?2:1.4,transparent:true,opacity:0,depthWrite:false}));scene.add(stars);
  const count=software?110:mobile?450:1000,rainPositions=new Float32Array(count*6),seeds=Array.from({length:count},()=>({x:(random()-.5)*510,z:(random()-.5)*400,y:random()*140}));
  const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#b4d5df',transparent:true,opacity:0,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);
  return {update(t,e){
    const dark=e.night||0,cloud=e.cloudCover||0;stars.material.opacity=dark*(1-cloud*.9)*.7;cloudGroup.visible=cloud>.1;
    if(sky){sky.material.uniforms.sunPosition.value.set(e.sunDirection.x,e.sunDirection.y,e.sunDirection.z).multiplyScalar(1000);sky.material.uniforms.turbidity.value=2.5+cloud*10;sky.material.uniforms.rayleigh.value=mix(1.8,.25,dark);}
    for(const c of clouds){c.material.opacity=cloud*.72;c.material.color.set('#eef7fb').lerp(new THREE.Color('#334151'),dark*.8).lerp(new THREE.Color('#778089'),e.storm?.8:cloud*.28);const wind=(e.wind||8)*.12;c.position.x=((c.userData.initial.x+t*wind+500)%1000)-500;if(!software)c.quaternion.copy(camera.quaternion);}
    rain.visible=e.rain>0||e.snow>0;rain.material.opacity=(e.rain||e.snow||0)*mix(.4,.21,dark);const attr=rainGeo.attributes.position,wind=Math.sin(e.windDirection*Math.PI/180)*e.wind*.02;
    if(rain.visible)for(let i=0;i<count;i++){const s=seeds[i],y=((s.y-t*(e.snow?7:65))%140+140)%140,x=s.x+Math.sin(t*.3+i)*wind;attr.setXYZ(i*2,x,y,s.z);attr.setXYZ(i*2+1,x-wind,y+(e.snow?.5:3.5),s.z+.3);}attr.needsUpdate=rain.visible;
  }};
}
