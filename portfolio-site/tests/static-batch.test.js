import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchStatic,batchPaths} from '../src/static-batch.js';
test('batching preserves transformed geometry, material, shadows and independent picking',()=>{
 const parent=new THREE.Group();parent.position.set(14,3,-8);const material=new THREE.MeshStandardMaterial();
 const solids=[0,1,2].map(i=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,3,4),material);mesh.position.set(i*5,2,i);mesh.rotation.y=i*.2;mesh.castShadow=true;parent.add(mesh);return mesh;});
 const hit=new THREE.Mesh(new THREE.BoxGeometry(4,8,4),new THREE.MeshBasicMaterial({transparent:true,opacity:0}));hit.userData.slug='project';parent.add(hit);
 parent.updateMatrixWorld(true);const before=new THREE.Box3();for(const mesh of solids)before.union(new THREE.Box3().setFromObject(mesh));
 assert.equal(batchStatic(parent,[...solids,hit]),2);assert.equal(hit.parent,parent);assert.equal(hit.userData.slug,'project');
 const merged=parent.children.find(x=>x.name==='static-batch');assert.equal(merged.material,material);assert.equal(merged.castShadow,true);
 const after=new THREE.Box3().setFromObject(merged);assert.ok(before.min.distanceTo(after.min)<1e-5);assert.ok(before.max.distanceTo(after.max)<1e-5);
 assert.equal(merged.geometry.attributes.position.count,3*36);
});
test('road batching keeps disconnected paths separate and preserves dash distances',()=>{
 const scene=new THREE.Scene(),material=new THREE.LineDashedMaterial({dashSize:1,gapSize:1});
 const paths=[0,10].map(x=>{const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,0,0),new THREE.Vector3(x+2,0,0),new THREE.Vector3(x+3,0,0)]),material);line.computeLineDistances();scene.add(line);return line;});
 assert.equal(batchPaths(scene,paths,material),1);const lines=scene.children[0];assert.equal(lines.isLineSegments,true);
 assert.deepEqual([...lines.geometry.attributes.lineDistance.array],[0,2,2,3,0,2,2,3]);assert.equal(lines.geometry.attributes.position.count,8);
});
