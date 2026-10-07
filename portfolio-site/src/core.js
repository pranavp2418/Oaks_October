import * as THREE from 'three';
export function initCore(motion){
 const host=document.querySelector('#orb');if(!host)return;
 const choices=[{title:'AI products',description:'Idea to production: explore CraftsmanAI and the workflows behind it.',href:'#craft-explorer',color:0x79beff},{title:'Systems',description:'Reliable services: financial workflows, events, and cloud infrastructure.',href:'#experience',color:0xc5a0ff},{title:'Interfaces',description:'Human-facing software: dashboards, customer journeys, and useful interactions.',href:'#work',color:0x77dfce}];
 let selected=0;const buttons=[...document.querySelectorAll('[data-core]')];
 function choose(i){selected=i;buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));document.querySelector('#core-description').textContent=choices[i].description;const a=document.querySelector('#core-link');a.href=choices[i].href;a.textContent='Explore '+choices[i].title.toLowerCase()}
 buttons.forEach((b,i)=>b.addEventListener('click',()=>choose(i)));
 try{
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.z=10.2;
 scene.add(new THREE.AmbientLight(0x689adc,2));const key=new THREE.DirectionalLight(0xc2e6ff,5);key.position.set(-2,4,5);scene.add(key);const fill=new THREE.PointLight(0x477bff,70);fill.position.set(3,-2,3);scene.add(fill);
 const root=new THREE.Group();scene.add(root);root.rotation.z=-.2;
 const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.03,1),new THREE.MeshPhysicalMaterial({color:0x204e94,emissive:0x174780,emissiveIntensity:.6,metalness:.7,roughness:.22,clearcoat:1}));root.add(core);
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(core.geometry),new THREE.LineBasicMaterial({color:0xb0dfff,transparent:true,opacity:.7}));core.add(edges);
 const rings=[],nodes=[];
 for(let i=0;i<3;i++){
 const orbit=new THREE.Group();orbit.rotation.set(.4+i*.68,i*.7,.2+i*.45);root.add(orbit);rings.push(orbit);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.65+i*.39,.025,8,120),new THREE.MeshBasicMaterial({color:choices[i].color,transparent:true,opacity:.6}));orbit.add(ring);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(1.72+i*.39,.009,6,100,Math.PI*1.25),new THREE.MeshBasicMaterial({color:choices[i].color,transparent:true,opacity:.25}));orbit.add(rim);
 const node=new THREE.Mesh(new THREE.IcosahedronGeometry(.14,1),new THREE.MeshBasicMaterial({color:choices[i].color}));node.position.x=1.65+i*.39;node.userData.mode=i;orbit.add(node);nodes.push(node);
 for(let j=0;j<24;j++){const a=j/24*Math.PI*2;const mark=new THREE.Mesh(new THREE.BoxGeometry(.065,.012,.015),new THREE.MeshBasicMaterial({color:choices[i].color,transparent:true,opacity:.3}));mark.position.set(Math.cos(a)*(1.79+i*.39),Math.sin(a)*(1.79+i*.39),0);mark.rotation.z=a;orbit.add(mark)}
 }
 const raycaster=new THREE.Raycaster();let drag=null,rx=.2,ry=-.4,dirty=true,visible=true,last=0;
 host.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,rx,ry,moved:false};host.setPointerCapture(e.pointerId);host.classList.add('dragging')});
 host.addEventListener('pointermove',e=>{if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;ry=drag.ry+dx*.006;rx=drag.rx+dy*.006;dirty=true}});
 host.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const r=host.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=raycaster.intersectObjects(nodes,true)[0];choose(hit?hit.object.userData.mode:(selected+1)%3);dirty=true}drag=null;host.classList.remove('dragging')});host.addEventListener('pointercancel',()=>{drag=null;host.classList.remove('dragging')});buttons.forEach(b=>b.addEventListener('click',()=>dirty=true));
 new IntersectionObserver(([e])=>{visible=e.isIntersecting;dirty=true}).observe(host);
 const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();dirty=true};new ResizeObserver(resize).observe(host);resize();
 function frame(t){requestAnimationFrame(frame);if(!visible||document.hidden||t-last<32||(!motion()&&!dirty))return;last=t;root.rotation.x=rx;root.rotation.y=ry;
 if(motion()&&!drag){core.rotation.y=t*.00017;core.rotation.z=t*.0001;rings.forEach((r,i)=>{r.rotation.z=t*.00008*(i%2?-1:1)+i*.5})}
 nodes.forEach((n,i)=>{n.scale.setScalar(i===selected?1.8:1);rings[i].children[0].material.opacity=i===selected?.95:.25});core.material.emissive.setHex(choices[selected].color);core.material.emissiveIntensity=.16;renderer.render(scene,camera);dirty=false}requestAnimationFrame(frame);
 }catch{host.classList.add('orb-fallback')}
}
