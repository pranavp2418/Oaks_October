import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Merge only explicitly admitted static objects, retaining material and world transforms.
export function batchStatic(parent,objects) {
  parent.updateWorldMatrix(true,true);
  const inverse=parent.matrixWorld.clone().invert(),buckets=new Map();
  for(const object of objects){
    if(!object.isMesh||object.isInstancedMesh||Array.isArray(object.material)||object.material.transparent||!object.visible)continue;
    const signature=Object.keys(object.geometry.attributes).sort().map(k=>`${k}:${object.geometry.attributes[k].itemSize}`).join('|');
    const key=`${object.material.uuid}|${object.castShadow}|${object.receiveShadow}|${signature}`;
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(object);
  }
  let removed=0;
  for(const objects of buckets.values()){
    if(objects.length<2)continue;
    const geometries=objects.map(object=>{
      const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      return geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));
    });
    const geometry=mergeGeometries(geometries,false);for(const part of geometries)part.dispose();
    if(!geometry)continue;
    geometry.computeBoundingSphere();const first=objects[0],mesh=new THREE.Mesh(geometry,first.material);
    mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.name='static-batch';parent.add(mesh);
    for(const object of objects)object.removeFromParent();for(const geometry of new Set(objects.map(o=>o.geometry)))geometry.dispose();removed+=objects.length-1;
  }
  return removed;
}

export function batchPaths(parent,paths,material) {
  if(paths.length<2)return 0;
  parent.updateWorldMatrix(true,true);const inverse=parent.matrixWorld.clone().invert(),points=[],distances=[];
  for(const path of paths){
    const transform=new THREE.Matrix4().multiplyMatrices(inverse,path.matrixWorld),position=path.geometry.attributes.position,distance=path.geometry.attributes.lineDistance;
    for(let i=1;i<position.count;i++)for(const j of [i-1,i]){
      const point=new THREE.Vector3().fromBufferAttribute(position,j).applyMatrix4(transform);points.push(point.x,point.y,point.z);distances.push(distance.getX(j));
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('lineDistance',new THREE.Float32BufferAttribute(distances,1));
  const lines=new THREE.LineSegments(geometry,material);lines.name='static-road-markings';parent.add(lines);for(const path of paths){path.removeFromParent();path.geometry.dispose();}return paths.length-1;
}
