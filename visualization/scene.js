import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {projectPosition} from './model.js';
import {frameCursor} from './education.js';
import {lessonFrame,buildLessonGeometry,lessonColors} from './lesson-visual.js';

export const strategyColors={X1:'#8bbde8',X2:'#b6a0e7',X3:'#edba85',X4:'#ea9bb8'};
const themes={SMA:'#b6e89d',AO:'#ffb88c'};
const vector=p=>new THREE.Vector3(...p);
function fitnessColor(score,lo,hi){const t=1-Math.max(0,Math.min(1,(score-lo)/Math.max(.00001,hi-lo)));return new THREE.Color('#55536d').lerp(new THREE.Color('#b9a6ff'),t);}
function label(text,color='#c3b8d5',size=1.7){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  ctx.font='500 28px Consolas,monospace';canvas.width=Math.max(64,Math.ceil(ctx.measureText(text).width)+24);canvas.height=64;
  ctx.font='500 28px Consolas,monospace';ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,canvas.width/2,41);
  const texture=new THREE.CanvasTexture(canvas);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.scale.set(size,size*64/canvas.width,1);return sprite;
}
function birdGeometry(){
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.22,-.06);shape.lineTo(.62,.04);shape.lineTo(.55,.13);shape.lineTo(.62,.16);shape.lineTo(.43,.22);shape.lineTo(.28,.19);shape.lineTo(.1,.09);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.026,bevelEnabled:false});geometry.rotateX(Math.PI/2);return geometry;
}
function makeCandidate(kind,id,ghost=false){
  const group=new THREE.Group();group.userData={id,kind,ghost};
  const material=new THREE.MeshStandardMaterial({color:themes[kind],roughness:.55,metalness:.15,transparent:ghost,opacity:ghost?.2:1,wireframe:ghost});
  group.userData.material=material;
  if(kind==='SMA'){
    const geometry=new THREE.IcosahedronGeometry(.24,2),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),scale=1+.12*Math.sin(17*x+9*y+11*z+id);positions.setXYZ(i,x*scale,y*scale,z*scale);}
    geometry.computeVertexNormals();group.add(new THREE.Mesh(geometry,material));
    for(let j=0;j<4;j++){const angle=j*Math.PI/2+.4;const lobe=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),material);lobe.position.set(Math.cos(angle)*.19,Math.sin(j*4)*.045,Math.sin(angle)*.19);lobe.scale.set(1.25,.7,1);group.add(lobe);}
    const nucleus=new THREE.Mesh(new THREE.SphereGeometry(.07,12,8),new THREE.MeshBasicMaterial({color:'#ede3ff',transparent:true,opacity:ghost?.1:.8}));nucleus.position.y=.15;group.add(nucleus);
  }else{
    const body=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),material);body.scale.set(.12,.12,.28);group.add(body);
    const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.085,1),material);head.position.set(0,.055,-.25);group.add(head);
    const beak=new THREE.Mesh(new THREE.ConeGeometry(.035,.1,4),new THREE.MeshStandardMaterial({color:'#ffd399',transparent:ghost,opacity:ghost?.2:1}));beak.rotation.x=-Math.PI/2;beak.position.set(0,.04,-.34);group.add(beak);
    const wings=[];const tips=new THREE.MeshBasicMaterial({color:'#8bbde8',transparent:ghost,opacity:ghost?.2:1});group.userData.tipMaterial=tips;
    for(const sign of [-1,1]){
      const wing=new THREE.Group();const mesh=new THREE.Mesh(birdGeometry(),material);mesh.scale.x=sign;wing.add(mesh);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.045,.15,3),tips);tip.rotation.z=sign*Math.PI/2;tip.position.set(sign*.5,.01,.105);wing.add(tip);group.add(wing);wings.push(wing);
    }
    const tail=new THREE.Mesh(new THREE.ConeGeometry(.12,.23,3),material);tail.rotation.x=Math.PI/2;tail.position.z=.3;group.add(tail);group.userData.wings=wings;
  }
  group.traverse(child=>{if(child.material){child.material.userData.originalOpacity=child.material.opacity;child.material.userData.originalTransparent=child.material.transparent;child.material.userData.originalDepthWrite=child.material.depthWrite;}});
  return group;
}
function setOpacity(group,ratio){group.traverse(child=>{const material=child.material;if(!material)return;const transparent=ratio<1||material.userData.originalTransparent;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=material.userData.originalOpacity*ratio;material.depthWrite=ratio<1?false:material.userData.originalDepthWrite;});}
function disposeObject(object){object.traverse(child=>{child.geometry?.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];for(const mat of materials){if(mat?.map)mat.map.dispose();mat?.dispose();}});}
function line(points,color,opacity=1){return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity}));}
function connection(a,b,color,radius=.012){
  const delta=b.clone().sub(a);if(delta.length()<1e-8)return new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.64}));mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;
}

export class SceneController {
  constructor(host,onSelect,onStatus){
    this.host=host;this.onSelect=onSelect;this.onStatus=onStatus;this.canvas=document.createElement('canvas');host.append(this.canvas);
    this.camera=new THREE.PerspectiveCamera(40,1,.1,100);this.scenes={};this.state=null;this.use2D=false;this.picking=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.pointerDown=null;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    try{
      if(!document.createElement('canvas').getContext('webgl2'))throw new Error('WebGL2 unavailable');
      this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor('#10111c',0);this.renderer.setScissorTest(true);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
      this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.minDistance=5;this.controls.maxDistance=48;this.controls.maxPolarAngle=Math.PI*.88;this.controls.enablePan=true;
      this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.fallback('Konteks grafis hilang · proyeksi 2D aktif');});
      this.onStatus('WebGL2 · 3D INTERAKTIF',false);
    }catch{this.fallback('WebGL2 tidak tersedia · proyeksi 2D aktif');}
    this.bindPointer();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();this.resetCamera();
  }
  resetCamera(){
    if(this.use2D)return;
    const damping=this.controls?.enableDamping;
    if(this.controls){this.controls.enableDamping=false;this.controls.update();}
    const target=new THREE.Vector3(0,3.8,0),direction=new THREE.Vector3(11,6.1,13).normalize();
    this.camera.position.copy(target).addScaledVector(direction,20);this.camera.lookAt(target);this.camera.updateMatrixWorld(true);
    const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
    const aspect=Math.min(...this.viewports().map(v=>v.w/v.h)),tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
    let distance=0;
    for(const x of [-4.4,4.4])for(const y of [.35,7.15])for(const z of [-4.4,4.4]){
      const point=new THREE.Vector3(x,y,z).sub(target),depth=point.dot(direction);
      distance=Math.max(distance,Math.abs(point.dot(right))/(tan*aspect)+depth,Math.abs(point.dot(up))/tan+depth);
    }
    this.camera.position.copy(target).addScaledVector(direction,distance*1.05);
    if(this.controls){this.controls.target.copy(target);this.controls.update();this.controls.enableDamping=damping;}
  }
  zoom(factor){
    if(this.use2D||!this.controls)return;
    const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();
    const offset=this.camera.position.clone().sub(this.controls.target),distance=THREE.MathUtils.clamp(offset.length()/factor,this.controls.minDistance,this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));this.controls.update();this.controls.enableDamping=damping;
  }
  focusLesson(){
    if(this.use2D||!this.state?.lesson.enabled)return;
    const frame=lessonFrame(this.state,this.state.lesson.algorithm);if(!frame)return;
    const box=new THREE.Box3().setFromPoints(frame.focusPoints),center=box.getCenter(new THREE.Vector3());
    // Extra room includes the labels above each exact coordinate.
    box.expandByScalar(.9);box.max.y+=.8;
    // A view along the displacement would hide the move through foreshortening.
    // Use a side view of the recorded before→clip vector, without moving data.
    const movement=frame.clip.clone().sub(frame.before),horizontal=Math.hypot(movement.x,movement.z);
    const direction=horizontal>.01?new THREE.Vector3(-movement.z,horizontal*.65,movement.x).normalize():new THREE.Vector3(11,6.1,13).normalize();
    const current=this.camera.position.clone().sub(this.controls.target);
    if(direction.x*current.x+direction.z*current.z<0){direction.x*=-1;direction.z*=-1;}
    const target=center.clone();target.y+=.65;
    this.camera.position.copy(target).addScaledVector(direction,20);this.camera.lookAt(target);this.camera.updateMatrixWorld(true);
    const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
    const aspect=Math.min(...this.viewports().map(v=>v.w/v.h)),tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));let distance=7;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const point=new THREE.Vector3(x,y,z).sub(target),depth=point.dot(direction);
      distance=Math.max(distance,Math.abs(point.dot(right))/(tan*aspect)+depth,Math.abs(point.dot(up))/tan+depth);
    }
    const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();
    this.camera.position.copy(target).addScaledVector(direction,distance*1.12);this.controls.target.copy(target);this.controls.update();this.controls.enableDamping=damping;
  }
  bindPointer(){
    if(this.boundCanvas===this.canvas)return;this.boundCanvas=this.canvas;
    this.canvas.addEventListener('pointerdown',event=>{this.pointerDown={x:event.clientX,y:event.clientY};});
    this.canvas.addEventListener('pointerup',event=>{if(!this.pointerDown)return;const distance=Math.hypot(event.clientX-this.pointerDown.x,event.clientY-this.pointerDown.y);this.pointerDown=null;if(distance>6)return;const hits=this.hitTestAll(event.clientX,event.clientY);if(hits.length)this.onSelect(hits[0].kind,hits[0].id,hits,{x:event.clientX,y:event.clientY});});
    this.canvas.setAttribute('aria-label','Ruang kandidat algoritma. Pilih kandidat melalui objek atau daftar inspector.');
  }
  fallback(message='Proyeksi 2D aktif'){
    if(this.use2D)return;this.use2D=true;this.controls?.dispose();this.renderer?.dispose();
    const canvas=document.createElement('canvas');this.canvas.replaceWith(canvas);this.canvas=canvas;this.context=canvas.getContext('2d');this.bindPointer();this.resize();this.onStatus(message,true);
  }
  toggle2D(){if(this.use2D)return false;this.fallback('Mode 2D dipilih · koordinat X/Y');return true;}
  resize(){const rect=this.host.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);if(this.use2D){const ratio=Math.min(devicePixelRatio,1.5);this.canvas.width=Math.round(this.width*ratio);this.canvas.height=Math.round(this.height*ratio);this.context?.setTransform(ratio,0,0,ratio,0,0);}else{this.renderer?.setSize(this.width,this.height,false);if(this.state?.lesson.enabled)this.focusLesson();}}
  viewports(){
    const w=this.width,h=Math.max(1,this.height-100),bottom=100;
    if(this.state?.view==='compare')return innerWidth<=850?[{kind:'SMA',x:0,y:bottom+h/2,w,h:h/2},{kind:'AO',x:0,y:bottom,w,h:h/2}]:[{kind:'SMA',x:0,y:bottom,w:w/2,h},{kind:'AO',x:w/2,y:bottom,w:w/2,h}];
    return [{kind:this.state?.view==='ao'?'AO':'SMA',x:0,y:bottom,w,h}];
  }
  makeScene(kind,count){
    const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#10111c',.022);scene.add(new THREE.HemisphereLight('#eee9ff','#211b35',2.3));
    const light=new THREE.DirectionalLight('#f1eaff',3);light.position.set(3,12,5);scene.add(light);const rim=new THREE.DirectionalLight(kind==='SMA'?'#b9a6ff':'#ffb88c',2);rim.position.set(-6,5,-5);scene.add(rim);
    const ground=new THREE.GridHelper(8,8,'#6d5b8e','#322b47');ground.position.y=.8;scene.add(ground);
    const cube=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(8,6,8)),new THREE.LineBasicMaterial({color:'#6c5b88',transparent:true,opacity:.28}));cube.position.y=3.8;scene.add(cube);
    const axisGroup=new THREE.Group();scene.add(axisGroup);
    const axes=[{start:[-4,.8,4],end:[4,.8,4],color:'#d59f94'},{start:[-4,.8,4],end:[-4,6.8,4],color:'#adc68e'},{start:[-4,.8,4],end:[-4,.8,-4],color:'#7eacbf'}];
    axes.forEach(a=>axisGroup.add(line([vector(a.start),vector(a.end)],a.color,.6)));
    const labels=[label('X · T1','#d59f94'),label('Y · T2','#adc68e'),label('Z · T3','#7eacbf')];labels[0].position.set(0,.42,4.5);labels[1].position.set(-4.7,4,4);labels[2].position.set(-4.8,.42,0);labels.forEach(x=>scene.add(x));
    for(const value of [0,1]){const marker=label(String(value),'#988ba9',1);marker.position.set(-4+value*8,.53,4.16);scene.add(marker);}
    const candidates=Array.from({length:count},(_,i)=>{const obj=makeCandidate(kind,i);scene.add(obj);return obj;});
    const halo=new THREE.Mesh(new THREE.IcosahedronGeometry(.43,1),new THREE.MeshBasicMaterial({color:'#dfceff',wireframe:true,transparent:true,opacity:.5}));scene.add(halo);
    const target=new THREE.Group();target.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.14,1),new THREE.MeshBasicMaterial({color:'#ffd68b'})));
    for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.42,.015,6,40),new THREE.MeshBasicMaterial({color:'#ffd68b',transparent:true,opacity:.85,depthTest:false}));ring.rotation.x=i?Math.PI/2:0;target.add(ring);}
    const targetLabel=label('TERBAIK','#ffd68b',2);targetLabel.position.y=.65;target.add(targetLabel);scene.add(target);
    const ghost=makeCandidate(kind,0,true);ghost.visible=false;const ghostLabel=label('PROPOSAL','#d2c0ff',1.8);ghostLabel.position.y=.6;ghost.add(ghostLabel);scene.add(ghost);
    const boundaryMarker=new THREE.Group();boundaryMarker.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.25,0),new THREE.MeshBasicMaterial({color:'#efa9b6',wireframe:true})));
    const boundaryLabel=label('MENTAH DI LUAR BATAS','#efa9b6',3.2);boundaryLabel.position.y=.5;boundaryMarker.add(boundaryLabel);boundaryMarker.visible=false;scene.add(boundaryMarker);
    const trails=new THREE.Group(),influences=new THREE.Group(),vmBoundaries=new THREE.Group(),lessonVisual=new THREE.Group();scene.add(trails,influences,vmBoundaries,lessonVisual);
    return {scene,candidates,halo,target,ghost,ghostLabel,boundaryMarker,vmBoundaries,trails,influences,lessonVisual,labels,camera:new THREE.PerspectiveCamera()};
  }
  updateVMBounds(view,m){
    if(view.vmCount===m)return;view.vmCount=m;
    for(const object of [...view.vmBoundaries.children]){view.vmBoundaries.remove(object);disposeObject(object);}
    const colors=['#badf82','#85bedb','#efba83','#ba9edb'];
    for(let k=1;k<m;k++)for(let axis=0;axis<3;axis++){
      const geometry=new THREE.PlaneGeometry(8,axis===1?8:6),material=new THREE.MeshBasicMaterial({color:'#b9a6ff',transparent:true,opacity:.045,side:THREE.DoubleSide,depthWrite:false});
      const plane=new THREE.Mesh(geometry,material);
      if(axis===0){plane.rotation.y=Math.PI/2;plane.position.set(-4+8*k/m,3.8,0);}
      if(axis===1){plane.rotation.x=-Math.PI/2;plane.position.set(0,.8+6*k/m,0);}
      if(axis===2)plane.position.set(0,3.8,-4+8*k/m);
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:'#b9a6ff',transparent:true,opacity:.22}));plane.add(edges);view.vmBoundaries.add(plane);
    }
    for(let j=0;j<m;j++){const text=label(`VM ${j+1}`,colors[j],1);text.position.set(-4+8*(j+.5)/m,.78,4.16);view.vmBoundaries.add(text);}
  }
  proposalState(kind){
    const state=this.state,snapshot=state.simulation.snapshot(kind),detail=snapshot.updates[state.selected[kind]],lesson=state.lesson;
    if(!detail)return null;
    if(lesson?.enabled){
      if(lesson.algorithm!==kind)return null;
      if(lesson.step===2)return {position:detail.rawProposal,boundary:detail.proposal,raw:true,label:'PROPOSAL MENTAH'};
      if(lesson.step===3)return {position:detail.proposal,label:'SETELAH CLIP'};
      if(lesson.step<4)return null;
    }
    return kind==='AO'&&!detail.accepted&&(state.showProposals||lesson?.enabled)?{position:detail.proposal,label:'DITOLAK'}:null;
  }
  colorForScore(score){const scale=this.state.fitnessScale;return fitnessColor(score,scale.min,scale.max).getHexString();}
  setState(state){
    const viewChanged=this.state?.view!==state.view;
    const wasLearning=this.state?.lesson.enabled;
    if(!wasLearning&&state.lesson.enabled&&!this.use2D)this.lessonCameraBackup={position:this.camera.position.clone(),target:this.controls.target.clone()};
    this.state=state;
    if(this.use2D)return;
    if(viewChanged){this.resize();this.resetCamera();}
    for(const kind of ['SMA','AO']){
      const display=frameCursor(state.cursor,state.lesson),optimizer=state.simulation.optimizers[kind],snap=optimizer.trace[display];
      if(!this.scenes[kind]||this.scenes[kind].candidates.length!==optimizer.options.population){if(this.scenes[kind])disposeObject(this.scenes[kind].scene);this.scenes[kind]=this.makeScene(kind,optimizer.options.population);}
      const view=this.scenes[kind];
      this.updateVMBounds(view,optimizer.vms.length);view.vmBoundaries.visible=!!state.showVMBounds;
      view.labels.forEach((old,i)=>{old.material.map.dispose();const next=label(`${'XYZ'[i]} · T${state.axes[i]+1}`,['#d59f94','#adc68e','#7eacbf'][i]);old.material.map=next.material.map;old.scale.copy(next.scale);next.material.dispose();});
      for(const group of [view.trails,view.influences,view.lessonVisual]){for(const child of [...group.children]){group.remove(child);disposeObject(child);}}
      const selected=state.selected[kind];
      const lessonActive=state.lesson.enabled&&state.lesson.algorithm===kind;
      const detail=lessonActive?optimizer.trace[state.cursor].updates[selected]:snap.updates[selected];
      buildLessonGeometry(view.lessonVisual,lessonFrame(state,kind),label);
      view.target.visible=!state.lesson.enabled;view.halo.visible=!lessonActive;
      const related=kind==='SMA'&&detail?.branch==='campuran'?new Set([detail.A,detail.B]):new Set();
      for(const [id,candidate] of view.candidates.entries())setOpacity(candidate,state.isolate?(id===selected?1:lessonActive?.035:related.has(id)?.45:.12):1);
      if(state.showTrails&&display>0){
        for(let id=0;id<snap.population.length;id++){
          if(state.isolate&&id!==selected)continue;
          const start=Math.max(0,display-(id===selected?16:5));
          const points=optimizer.trace.slice(start,display+1).map(row=>vector(projectPosition(row.population[id].position,state.axes)));
          view.trails.add(line(points,id===selected?themes[kind]:'#9c8db3',id===selected?.85:.12));
        }
      }
      if(kind==='SMA'&&detail&&!lessonActive&&detail.branch==='campuran'&&state.axes.some(d=>detail.dimensions[d]?.branch==='mendekat')){
        const source=vector(projectPosition(detail.before,state.axes)),previous=optimizer.trace[(lessonActive?state.cursor:display)-1];
        const weights=state.axes.map(d=>detail.dimensions[d]?.W||1),meanWeight=weights.reduce((a,b)=>a+b,0)/3;
        view.influences.add(connection(source,vector(projectPosition(detail.bestUsed,state.axes)),'#ffd68b',.012*meanWeight));
        view.influences.add(connection(source,vector(projectPosition(previous.population[detail.A].position,state.axes)),'#8bc5dc',.009*meanWeight));
        view.influences.add(connection(source,vector(projectPosition(previous.population[detail.B].position,state.axes)),'#b49de2',.009));
        for(const [text,position,color] of [['BEST',detail.bestUsed,'#ffd68b'],[`A${detail.A+1}`,previous.population[detail.A].position,'#8bc5dc'],[`B${detail.B+1}`,previous.population[detail.B].position,'#b49de2']]){
          const marker=label(text,color,1.35);marker.position.copy(vector(projectPosition(position,state.axes))).add(new THREE.Vector3(0,.42,0));view.influences.add(marker);
        }
      }
      if(kind==='AO'&&detail&&!detail.accepted&&state.showProposals&&(!lessonActive||state.lesson.step>=3)){
        view.influences.add(line([vector(projectPosition(detail.before,state.axes)),vector(projectPosition(detail.proposal,state.axes))],'#e79da0',.4));
      }
      const proposal=this.proposalState(kind),caption=proposal?.label||'PROPOSAL';
      if(view.ghostCaption!==caption){view.ghostLabel.material.map.dispose();const next=label(caption,'#d2c0ff',2);view.ghostLabel.material.map=next.material.map;view.ghostLabel.scale.copy(next.scale);next.material.dispose();view.ghostCaption=caption;}
    }
    const key=state.lesson.enabled?`${state.lesson.algorithm}:${state.cursor}:${state.selected[state.lesson.algorithm]}:${state.axes}:${state.lesson.step}:${state.view}`:null;
    if(key&&key!==this.lessonCameraKey)this.focusLesson();
    if(!key&&wasLearning&&this.lessonCameraBackup){const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.camera.position.copy(this.lessonCameraBackup.position);this.controls.target.copy(this.lessonCameraBackup.target);this.controls.update();this.controls.enableDamping=damping;this.lessonCameraBackup=null;}
    this.lessonCameraKey=key;
  }
  render(now,progress=1,fromCursor=null){
    if(!this.state)return;
    if(this.use2D){this.render2D(progress,fromCursor);return;}
    this.controls.update();const state=this.state;
    for(const viewport of this.viewports()){
      const display=frameCursor(state.cursor,state.lesson),{kind}=viewport,view=this.scenes[kind],optimizer=state.simulation.optimizers[kind],snap=optimizer.trace[display],before=optimizer.trace[state.lesson.enabled?display:(fromCursor??state.cursor)];
      const {min:lo,max:hi}=state.fitnessScale;
      for(let i=0;i<view.candidates.length;i++){
        const mesh=view.candidates[i],detail=snap.updates[i],end=vector(projectPosition(snap.population[i].position,state.axes)),start=vector(projectPosition(before.population[i].position,state.axes));
        let position=start.clone().lerp(end,progress);
        if(progress<1&&!state.lesson.enabled&&kind==='AO'&&detail&&!detail.accepted&&state.showProposals){const proposal=vector(projectPosition(detail.proposal,state.axes));position=progress<.55?start.clone().lerp(proposal,progress/.55):proposal.lerp(end,(progress-.55)/.45);}
        mesh.position.copy(position);mesh.userData.material.color.copy(fitnessColor(snap.population[i].score,lo,hi));
        mesh.scale.setScalar(i===state.selected[kind]?(state.lesson.enabled&&state.lesson.algorithm===kind?1.65:1.22):1);
        if(kind==='AO'){
          const action=state.lesson.enabled&&state.lesson.algorithm===kind&&i===state.selected[kind]&&state.lesson.step>=1?optimizer.trace[state.cursor].updates[i]:detail;
          mesh.userData.tipMaterial.color.set(strategyColors[action?.branch]||'#a49ab9');
          const direction=end.clone().sub(start);if(direction.length()>.0001)mesh.lookAt(mesh.position.clone().sub(direction));
          mesh.userData.wings.forEach((wing,j)=>{wing.rotation.z=(j?1:-1)*(progress<1&&!this.reduced?Math.sin(progress*Math.PI*4)*.3:.08);});
        }
      }
      view.halo.position.copy(view.candidates[state.selected[kind]].position);view.halo.rotation.y=this.reduced?0:now*.00015;
      view.target.position.copy(vector(projectPosition(snap.bestPosition,state.axes)));
      const proposal=this.proposalState(kind);view.ghost.visible=!!proposal;
      const lessonActive=state.lesson.enabled&&state.lesson.algorithm===kind;
      setOpacity(view.ghost,lessonActive?3.8:1);view.ghost.userData.material.wireframe=!lessonActive;
      view.ghost.userData.material.color.set(lessonActive?(state.lesson.step===2?lessonColors.raw:state.lesson.step===3?lessonColors.clip:lessonColors.rejected):themes[kind]);
      view.ghostLabel.visible=!lessonActive;view.ghost.scale.setScalar(lessonActive?1.65:1);
      if(proposal)view.ghost.position.copy(vector(projectPosition(proposal.position,state.axes)));
      view.boundaryMarker.visible=!lessonActive&&!!(proposal?.raw&&state.axes.some(d=>proposal.position[d]<0||proposal.position[d]>1));
      if(view.boundaryMarker.visible)view.boundaryMarker.position.copy(vector(projectPosition(proposal.boundary,state.axes)));
      view.camera.copy(this.camera);view.camera.aspect=viewport.w/viewport.h;view.camera.updateProjectionMatrix();
      this.renderer.setViewport(viewport.x,viewport.y,viewport.w,viewport.h);this.renderer.setScissor(viewport.x,viewport.y,viewport.w,viewport.h);this.renderer.render(view.scene,view.camera);
    }
  }
  render2D(progress,fromCursor){
    const ctx=this.context,state=this.state;if(!ctx)return;
    ctx.clearRect(0,0,this.width,this.height);this.hits=[];
    for(const v of this.viewports()){
      const top=this.height-v.y-v.h,pad=45,left=v.x+pad,right=v.x+v.w-pad,upper=top+45,lower=top+v.h-30;
      const xy=position=>[left+position[state.axes[0]]*(right-left),lower-position[state.axes[1]]*(lower-upper)];
      ctx.save();ctx.beginPath();ctx.rect(v.x,top,v.w,v.h);ctx.clip();
      ctx.strokeStyle='#3e3556';ctx.lineWidth=1;
      for(let i=0;i<=4;i++){const x=left+(right-left)*i/4,y=upper+(lower-upper)*i/4;ctx.beginPath();ctx.moveTo(x,upper);ctx.lineTo(x,lower);ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
      if(state.showVMBounds){
        const m=state.simulation.optimizers[v.kind].vms.length;ctx.strokeStyle='#b9a6ff77';ctx.setLineDash([4,5]);
        for(let i=1;i<m;i++){const x=left+(right-left)*i/m,y=lower-(lower-upper)*i/m;ctx.beginPath();ctx.moveTo(x,upper);ctx.lineTo(x,lower);ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}ctx.setLineDash([]);
        ctx.font='9px Consolas';ctx.fillStyle='#baadd6';for(let i=0;i<m;i++)ctx.fillText(`VM ${i+1}`,left+(right-left)*(i+.5)/m-12,lower-6);
      }
      ctx.fillStyle='#aaa0bb';ctx.font='10px Consolas';ctx.fillText(`X · T${state.axes[0]+1}`,right-38,lower+20);ctx.fillText(`Y · T${state.axes[1]+1}`,left-30,upper-10);
      const display=frameCursor(state.cursor,state.lesson),optimizer=state.simulation.optimizers[v.kind],snap=optimizer.trace[display],before=optimizer.trace[state.lesson.enabled?display:(fromCursor??state.cursor)],{min:lo,max:hi}=state.fitnessScale;
      snap.population.forEach((candidate,i)=>{
        ctx.globalAlpha=state.isolate&&i!==state.selected[v.kind]?.15:1;
        const [sx,sy]=xy(before.population[i].position),[ex,ey]=xy(candidate.position),x=sx+(ex-sx)*progress,y=sy+(ey-sy)*progress;
        if(state.showTrails&&display&&(!state.isolate||i===state.selected[v.kind])){ctx.strokeStyle=i===state.selected[v.kind]?themes[v.kind]:'#80709188';ctx.beginPath();optimizer.trace.slice(Math.max(0,display-8),display+1).forEach((row,t)=>{const p=xy(row.population[i].position);t?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.stroke();}
        ctx.fillStyle='#'+fitnessColor(candidate.score,lo,hi).getHexString();ctx.beginPath();ctx.arc(x,y,i===state.selected[v.kind]?7:4,0,Math.PI*2);ctx.fill();
        if(i===state.selected[v.kind]){ctx.strokeStyle='#dfceff';ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.stroke();}
        this.hits.push({x,y,id:i,kind:v.kind});
      });
      ctx.globalAlpha=1;
      const proposal=this.proposalState(v.kind),detail=optimizer.trace[state.cursor].updates[state.selected[v.kind]];
      if(proposal){const p=xy(proposal.position),start=xy(detail.before);ctx.strokeStyle='#e3a6aa';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(...start);ctx.lineTo(...p);ctx.stroke();ctx.beginPath();ctx.arc(...p,9,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e3a6aa';ctx.fillText(proposal.label,p[0]+12,p[1]-8);
        if(proposal.raw&&state.axes.some(d=>proposal.position[d]<0||proposal.position[d]>1)){const edge=xy(proposal.boundary);ctx.strokeRect(edge[0]-7,edge[1]-7,14,14);ctx.fillText('MENTAH DI LUAR BATAS',edge[0]-80,edge[1]-15);}
      }
      const lesson=lessonFrame(state,v.kind);
      if(lesson){
        const screen=point=>[left+(point.x+4)/8*(right-left),lower-(point.y-.8)/6*(lower-upper)];
        for(const arrow of lesson.arrows){
          const a=screen(arrow.start),b=screen(arrow.end),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.strokeStyle=ctx.fillStyle=arrow.color;ctx.lineWidth=3;ctx.setLineDash(arrow.dashed?[5,4]:[]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(...b);ctx.lineTo(b[0]-12*Math.cos(angle-.45),b[1]-12*Math.sin(angle-.45));ctx.lineTo(b[0]-12*Math.cos(angle+.45),b[1]-12*Math.sin(angle+.45));ctx.closePath();ctx.fill();
        }
        for(const marker of lesson.markers){const [x,y]=screen(marker.position);ctx.strokeStyle=ctx.fillStyle=marker.color;ctx.lineWidth=2.5;ctx.beginPath();if(marker.type==='cross'){ctx.moveTo(x-10,y-10);ctx.lineTo(x+10,y+10);ctx.moveTo(x-10,y+10);ctx.lineTo(x+10,y-10);}else ctx.arc(x,y,marker.type==='result'?18:14,0,Math.PI*2);ctx.stroke();ctx.font='bold 11px Consolas';ctx.fillText(marker.name,x+18,y-14);}
        ctx.lineWidth=1;
      }
      const target=xy(snap.bestPosition);ctx.strokeStyle='#ffd68b';ctx.beginPath();ctx.arc(...target,13,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffd68b';ctx.font='9px Consolas';ctx.fillText('TERBAIK',target[0]+15,target[1]-8);ctx.restore();
    }
  }
  hitTestAll(clientX,clientY){
    const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
    if(this.use2D)return (this.hits||[]).map(hit=>({...hit,distance:Math.hypot(hit.x-x,hit.y-y)})).filter(hit=>hit.distance<=18).sort((a,b)=>a.distance-b.distance).map(({kind,id})=>({kind,id}));
    for(const v of this.viewports()){
      const top=this.height-v.y-v.h;if(x<v.x||x>v.x+v.w||y<top||y>top+v.h)continue;
      const view=this.scenes[v.kind];this.pointer.set((x-v.x)/v.w*2-1,-(y-top)/v.h*2+1);this.picking.setFromCamera(this.pointer,view.camera);view.scene.updateMatrixWorld(true);
      const hits=new Map();
      for(const hit of this.picking.intersectObjects(view.candidates,true)){let object=hit.object;while(object&&object.userData.id===undefined)object=object.parent;if(object&&!hits.has(object.userData.id))hits.set(object.userData.id,{kind:v.kind,id:object.userData.id});}
      const near=view.candidates.map(object=>{const p=object.position.clone().project(view.camera);return {id:object.userData.id,z:p.z,distance:Math.hypot(v.x+(p.x+1)/2*v.w-x,top+(1-p.y)/2*v.h-y)};}).filter(hit=>hit.z>=-1&&hit.z<=1&&hit.distance<=12).sort((a,b)=>a.distance-b.distance);
      for(const hit of near)if(!hits.has(hit.id))hits.set(hit.id,{kind:v.kind,id:hit.id});
      return [...hits.values()];
    }
    return [];
  }
  hitTest(clientX,clientY){return this.hitTestAll(clientX,clientY)[0]||null;}
  debug(){const result={mode:this.use2D?'2d':'3d',axes:this.state?.axes,viewports:this.viewports()};if(!this.use2D)result.positions=Object.fromEntries(Object.entries(this.scenes).map(([kind,view])=>[kind,view.candidates.map(obj=>obj.position.toArray())]));return result;}
}
