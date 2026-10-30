const form=document.querySelector('#controls'),svg=document.querySelector('#drawing');
const names={box:'Parallelepipedo',cube:'Cubo',pyramid:'Piramide',prism:'Prisma triangolare'};
const titles={front:'Prospetto',right:'Profilo destro',top:'Pianta',cavalier:'Cavaliera',back:'Retro',left:'Profilo sinistro',bottom:'Dal basso',isometric:'Isometrica'};
const reductionLabel=value=>value===.5?'½':value===.75?'¾':value===1?'1':String(value);
const fields=['width','depth','height','x','y','z','rotation'];
const blank=()=>({shape:'box',width:120,depth:90,height:140,x:0,y:0,z:0,rotation:0});
let solids=[blank()],active=0,current,request=0;
const solid=(shape,width,depth,height,x=0,y=0,z=0)=>({shape,width,depth,height,x,y,z,rotation:0});
const scenarios={
 intersection:{name:'Piramide attraverso la lastra',view:'all',solids:[{...solid('pyramid',140,120,240,80,30),color:'#c95a79'},{...solid('box',300,180,32,0,0,140),color:'#d5bb55'}]},
 tower:{name:'Torre di cubi',solids:[solid('cube',100,100,100),solid('cube',100,100,100,0,0,100),solid('cube',100,100,100,0,0,200)]},
 pyramid:{name:'Piramide sul piedistallo',solids:[solid('box',160,160,35),solid('cube',110,110,110,25,25,35),solid('pyramid',110,110,100,25,25,145)]},
 row:{name:'Solidi affiancati',solids:[solid('cube',90,90,90),solid('pyramid',100,90,130,120),solid('prism',100,90,110,250)]},
 steps:{name:'Scalinata',solids:[solid('box',75,120,45),solid('box',75,120,90,75),solid('box',75,120,135,150)]},
 house:{name:'Casa e torre',solids:[solid('box',140,110,90),solid('prism',140,110,65,0,0,90),solid('box',60,70,170,175,20),solid('pyramid',60,70,55,175,20,170)]}
};
let previousScene;
try{const saved=JSON.parse(localStorage.getItem('disegno-scene'));if(saved?.solids?.length&&saved.solids.length<=30&&saved.solids.every(s=>Object.hasOwn(names,s.shape)&&fields.every(k=>Number.isFinite(s[k])))){solids=saved.solids;form.elements.angle.value=saved.angle??45;form.elements.reduction.value=saved.reduction??.5;}}catch{}
function node(tag,attrs,text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text)el.textContent=text;return el;}
function sync(){
 const s=solids[active];fields.forEach(k=>form.elements[k].value=s[k]);
 document.querySelector('#color').value=s.color??(s.shape==='pyramid'?'#c95a79':'#d5bb55');
 form.elements.depth.disabled=form.elements.height.disabled=s.shape==='cube';
 document.querySelectorAll('[data-shape]').forEach(b=>{const on=b.dataset.shape===s.shape;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
 const list=document.querySelector('#objects');list.replaceChildren();solids.forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${i+1} · ${names[s.shape]}`;list.append(o);});list.value=active;
 document.querySelector('#remove').disabled=solids.length===1;document.querySelector('#add').disabled=document.querySelector('#duplicate').disabled=solids.length===30;
 const pointSelect=document.querySelector('#construction-point'),previous=pointSelect.value;pointSelect.replaceChildren();
 const all=document.createElement('option');all.value='all';all.textContent='Tutti i punti';pointSelect.append(all);
 solids.forEach((s,si)=>{const count=s.shape==='pyramid'?5:s.shape==='prism'?6:8;for(let vi=0;vi<count;vi++){const o=document.createElement('option');o.value=`${si}:${vi}`;o.textContent=`${si+1}${String.fromCharCode(65+vi)} · ${names[s.shape]}`;pointSelect.append(o);}});
 pointSelect.value=[...pointSelect.options].some(o=>o.value===previous)?previous:'all';
}
function capture(){if(!form.checkValidity())return false;fields.forEach(k=>solids[active][k]=Number(form.elements[k].value));solids[active].color=document.querySelector('#color').value;if(solids[active].shape==='cube')solids[active].depth=solids[active].height=solids[active].width;return true;}
// Punti in cui gli spigoli di un solido attraversano le facce visibili di un altro
// (nel quadrato piccolo della pianta finiscono gli spigoli della piramide sulla lastra).
function constructionExtras(world,views){
 const plane=poly=>{const [a,b,c]=poly,u=[b.x-a.x,b.y-a.y,b.z-a.z],v=[c.x-a.x,c.y-a.y,c.z-a.z],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return {n,d:n[0]*a.x+n[1]*a.y+n[2]*a.z};};
 const inside=(p,poly,n)=>{const axes=['x','y','z'],mag=[Math.abs(n[0]),Math.abs(n[1]),Math.abs(n[2])],drop=mag.indexOf(Math.max(...mag)),u=axes[(drop+1)%3],v=axes[(drop+2)%3],pts=poly.map(q=>[q[u],q[v]]),x=p[u],y=p[v];let hit=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;};
 const same=(a,b)=>Math.abs(a.x-b.x)<1e-6&&Math.abs(a.y-b.y)<1e-6&&Math.abs(a.z-b.z)<1e-6;
 const known=world.flat(),found=[];
 world.forEach((pts,si)=>views[si].edges.forEach(edge=>{
  const a=pts[edge.a],b=pts[edge.b];
  world.forEach((other,oj)=>{
   if(oj===si)return;
   views[oj].faces.forEach(face=>{
    if(face.length<3)return;
    const poly=face.map(i=>other[i]),pl=plane(poly);
    const va=pl.n[0]*a.x+pl.n[1]*a.y+pl.n[2]*a.z-pl.d,vb=pl.n[0]*b.x+pl.n[1]*b.y+pl.n[2]*b.z-pl.d;
    if(Math.abs(va-vb)<1e-9)return;
    const t=va/(va-vb);
    if(t<=1e-4||t>=1-1e-4)return;
    const p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
    if(!inside(p,poly,pl.n))return;
    if(known.some(q=>same(q,p))||found.some(q=>same(q,p)))return;
    found.push({...p,si});
   });
  });
 }));
 return found.map((p,i)=>({...p,id:`x:${p.si}:${i}`}));
}
function renderConstruction(){
 const angle=Number(form.elements.angle.value)*Math.PI/180,k=Number(form.elements.reduction.value);
 const world=current.top.map((s,si)=>s.points.map((p,vi)=>({x:p[0],y:p[1],z:-current.front[si].points[vi][1]})));
 const extras=constructionExtras(world,current.top);
 const vertices=world.flatMap((pts,si)=>pts.map((p,vi)=>({...p,si,vi,label:`${si+1}${String.fromCharCode(65+vi)}`,id:`${si}:${vi}`}))).concat(extras);
 const xmin=Math.min(...vertices.map(p=>p.x)),ymin=Math.min(...vertices.map(p=>p.y)),zmin=Math.min(...vertices.map(p=>p.z));
 const width=Math.max(...vertices.map(p=>p.x-xmin+k*(p.y-ymin)*Math.cos(angle)));
 const height=Math.max(...vertices.map(p=>p.z-zmin+k*(p.y-ymin)*Math.sin(angle)));
 const depth=Math.max(...vertices.map(p=>p.y-ymin));
 const scale=Math.min(610/Math.max(1,width),350/Math.max(1,height),210/Math.max(1,depth));
 const origin=160,baseline=470,planY=650;
 const plan=p=>[origin+(p[0]-xmin)*scale,planY+(p[1]-ymin)*scale];
 const cavalier=p=>[origin+(p[0]-xmin-k*ymin*Math.cos(angle))*scale,baseline+(p[1]+zmin+k*ymin*Math.sin(angle))*scale];
 svg.setAttribute('viewBox','0 0 940 970');svg.style.maxHeight='none';
 svg.append(node('rect',{x:0,y:0,width:940,height:970,fill:'white'}));
 const text=(x,y,t,attrs={})=>svg.append(node('text',{x,y,fill:'#42664d','font-size':13,'font-family':'sans-serif',...attrs},t));
 text(35,30,'COSTRUZIONE DELLA CAVALIERA DALLA PIANTA',{'font-size':18});
 text(35,55,`Angolo ${form.elements.angle.value}° · profondità × ${reductionLabel(k)} · altezze in vera grandezza`);
 const guides=node('g',{'data-layer':'construction',fill:'none','stroke-width':.8,'stroke-opacity':.7});svg.append(guides);
 const line=(parent,a,b,attrs={})=>parent.append(node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],...attrs}));
 const selected=document.querySelector('#construction-point').value;
 const points=vertices.map(p=>{
  const start=plan([p.x,p.y]);
  const anchor=[origin+(p.x-xmin)*scale,baseline];
  const foot=[anchor[0]+k*(p.y-ymin)*Math.cos(angle)*scale,baseline-k*(p.y-ymin)*Math.sin(angle)*scale];
  const end=[foot[0],foot[1]-(p.z-zmin)*scale];
  return {...p,start,anchor,foot,end};
 });
 if(document.querySelector('#connections').checked){
  const seen=new Set();
  const guide=(p,a,b,kind,color)=>{const id=kind+[a,b].flat().map(n=>n.toFixed(4)).join(',');if(seen.has(id))return;seen.add(id);line(guides,a,b,{stroke:color,'data-guide':kind,'data-point':p.id});};
  points.filter(p=>selected==='all'||selected===p.id).forEach(p=>{
   guide(p,p.start,p.anchor,'plan-abscissa','#8297b1');
   guide(p,p.anchor,p.foot,'cavalier-depth','#b28c50');
   guide(p,p.foot,p.end,'cavalier-height','#648d83');
   if(selected!=='all'){
    [p.start,p.anchor,p.foot,p.end].forEach(c=>guides.append(node('circle',{cx:c[0],cy:c[1],r:3,fill:'#b16f36',stroke:'none'})));
    const note=(x,y,t)=>guides.append(node('text',{x,y,fill:'#42664d','font-size':13,'font-family':'sans-serif'},t));
    note(p.anchor[0]+7,p.anchor[1]+17,'Riporto X');note(p.foot[0]+7,p.foot[1]+17,'Piede sul piano di base');
   }
  });
 }
 line(svg,[90,baseline],[850,baseline],{stroke:'#89958b','stroke-width':1,'stroke-dasharray':'8 4'});
 text(35,baseline+24,`Piano di base: Z = ${zmin}`);
 text(35,620,'PIANTA · stessi punti e stessa scala');
 const views=[['cavalier',cavalier],['top',plan]],faces=node('g',{'data-layer':'faces'}),outline=node('g',{'data-layer':'edges'});
 views.forEach(([key,map])=>{
  if(document.querySelector('#filled').checked)current[key].forEach((s,si)=>{
   const color=solids[si]?.color??'#d5bb55';
   const rgb=/^#[0-9a-f]{6}$/i.test(color)?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):[130,170,140];
   (s.surfaces??[]).forEach(f=>{const factor=[.76,1.08,1,.88][f.shade%4];faces.append(node('polygon',{points:f.points.map(p=>map(p).join(',')).join(' '),fill:`rgb(${rgb.map(v=>Math.min(255,Math.round(v*factor))).join(',')})`,'fill-opacity':.25}));});
  });
 });
 // Facce sotto le linee di costruzione, spigoli sopra: tutte le linee restano leggibili.
 svg.append(faces,guides);
 views.forEach(([key,map])=>{
  const edges=current[key].flatMap(s=>s.segments??s.edges.map(e=>({a:s.points[e.a],b:s.points[e.b],visible:e.visible})));
  edges.sort((a,b)=>Number(a.visible)-Number(b.visible)).forEach(e=>{if(!e.visible&&!document.querySelector('#hidden').checked)return;line(outline,map(e.a),map(e.b),{stroke:e.visible?'#394738':'#92978c','stroke-width':e.visible?1.5:.8,'stroke-dasharray':e.visible?'none':'5 4'});});
 });
 svg.append(outline);
 points.filter(p=>(selected==='all'?p.si===active:selected===p.id)&&p.label).forEach(p=>{
  text(p.start[0]+5,p.start[1]+13,p.label,{'font-size':10});text(p.end[0]+5,p.end[1]-6,p.label,{'font-size':10});
 });
 text(35,913,'Blu: riporto di X dalla pianta · Ocra: profondità ridotta lungo la fuga · Verde: altezza verticale');
 text(35,937,'Segui un punto per leggere la costruzione. Anche i punti di intersezione hanno le loro linee nell’SVG.');
}
function render(){
 if(!current)return;svg.replaceChildren();const mode=document.querySelector('#view').value;
 document.querySelector('#construction-options').hidden=mode!=='construction';
 if(mode==='construction'){renderConstruction();return;}
 const views=mode==='sheet'?['front','right','top','cavalier']:mode==='all'?['front','right','top','cavalier','isometric','back','left','bottom']:[mode];
 const multiple=views.length>1;
 const slots=views.map((_,i)=>multiple&&i>=3?i+1:i);
 const cols=multiple?2:1,rows=Math.ceil((views.length+(multiple?1:0))/cols);
 svg.setAttribute('viewBox',`0 0 ${cols*500} ${rows*380}`);svg.style.maxHeight=multiple?'none':'800px';
 const bounds=views.map(key=>{const pts=current[key].flatMap(s=>s.points),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};});
 const scale=Math.min(...bounds.map(b=>Math.min(390/Math.max(1,b.maxX-b.minX),260/Math.max(1,b.maxY-b.minY))));
 const maps=Object.fromEntries(views.map((key,i)=>{const b=bounds[i],ox=slots[i]%2*500,oy=Math.floor(slots[i]/2)*380;return [key,p=>[ox+250+(p[0]-(b.minX+b.maxX)/2)*scale,oy+205+(p[1]-(b.minY+b.maxY)/2)*scale]];}));
 const paper=node('g',{}),guides=node('g',{'data-layer':'construction','aria-label':'Linee di richiamo',fill:'none',stroke:'#648bb5','stroke-width':.7,'stroke-opacity':.7});
 svg.append(paper,guides);
 views.forEach((key,index)=>{
  const ox=slots[index]%cols*500,oy=Math.floor(slots[index]/cols)*380,g=node('g',{});svg.append(g);
  paper.append(node('rect',{x:ox+8,y:oy+8,width:484,height:364,rx:8,fill:'white',stroke:'#e0e8e0'}));g.append(node('text',{x:ox+24,y:oy+34,fill:'#42664d','font-size':14,'font-family':'sans-serif'},titles[key]));
  const map=maps[key];
  const line=(a,c,attrs)=>g.append(node('line',{x1:a[0],y1:a[1],x2:c[0],y2:c[1],...attrs}));
  if(document.querySelector('#filled').checked)current[key].forEach((s,si)=>{
   const color=solids[si]?.color??(solids[si]?.shape==='pyramid'?'#c95a79':'#d5bb55');
   const rgb=/^#[0-9a-f]{6}$/i.test(color)?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):[130,170,140];
   (s.surfaces??[]).forEach(face=>{const factor=[.76,1.08,1,.88][face.shade%4];const fill=`rgb(${rgb.map(v=>Math.min(255,Math.round(v*factor))).join(',')})`;g.append(node('polygon',{points:face.points.map(p=>map(p).join(',')).join(' '),fill}));});
  });
  const edges=[];current[key].forEach((s,si)=>{if(s.segments){s.segments.forEach(e=>edges.push({...e,a:map(e.a),b:map(e.b),si}));}else{const pts=s.points.map(map);s.edges.forEach(e=>edges.push({a:pts[e.a],b:pts[e.b],visible:e.visible,si}));}});
  edges.sort((a,b)=>Number(a.visible)-Number(b.visible));edges.forEach(e=>{if(!e.visible&&!document.querySelector('#hidden').checked)return;if(Math.hypot(e.a[0]-e.b[0],e.a[1]-e.b[1])<.01)return;line(e.a,e.b,{stroke:e.visible?'#394738':'#7c806a','stroke-width':e.visible?1.5:.8,'stroke-dasharray':e.visible?'none':'5 4'});});
  if(document.querySelector('#axes').checked){const o=[ox+35,oy+340];current[key][0].axes.slice(1).forEach((p,i)=>{if(Math.hypot(...p)<.01)return;const end=[o[0]+p[0]*.45,o[1]+p[1]*.45];line(o,end,{stroke:['#b77565','#729d77','#6c8daa'][i],'stroke-width':1});g.append(node('text',{x:end[0]+4,y:end[1]-4,fill:'#718474','font-size':10},['x','y','z'][i]));});}
 });
 if(multiple){
  paper.append(node('rect',{x:508,y:388,width:484,height:364,rx:8,fill:'white',stroke:'#e0e8e0'}));
  svg.append(node('text',{x:524,y:414,fill:'#42664d','font-size':14,'font-family':'sans-serif'},'Riporto della profondità · 45°'));
  const enabled=document.querySelector('#connections').checked;
  if(enabled){
   const seen=new Set();
   const path=(points,kind)=>{const key=points.map(p=>p.map(n=>n.toFixed(4)).join(',')).join(' ');if(seen.has(key))return;seen.add(key);guides.append(node('polyline',{points:points.map(p=>p.join(',')).join(' '),'data-guide':kind}));};
   const corners=[];
   current.front.forEach((s,si)=>s.points.forEach((p,vi)=>{
    const front=maps.front(p),top=maps.top(current.top[si].points[vi]),right=maps.right(current.right[si].points[vi]);
    path([front,top],'front-top');path([front,right],'front-right');
    const corner=[right[0],top[1]];corners.push(corner);path([top,corner,right],'depth-transfer');
   }));
   if(maps.back&&maps.left)current.back.forEach((s,si)=>s.points.forEach((p,vi)=>path([maps.back(p),maps.left(current.left[si].points[vi])],'back-left')));
   corners.sort((a,b)=>a[0]-b[0]);
   const first=corners[0],last=corners.at(-1);
   guides.append(node('line',{x1:first[0]-18,y1:first[1]-18,x2:last[0]+18,y2:last[1]+18,stroke:'#bc8b47','stroke-width':1.2,'stroke-dasharray':'6 4','data-guide':'miter'}));
  }
 }
}
async function update(){
 const id=++request;document.querySelector('#export').disabled=true;document.querySelector('#angle-value').value=`${form.elements.angle.value}°`;
 if(!capture()){document.querySelector('#error').textContent='Controlla misure (10–300), posizioni (−1000–1000) e rotazione (−360–360).';return;}
 const payload={solids,angle:Number(form.elements.angle.value),reduction:Number(form.elements.reduction.value)};
 try{const response=await fetch('/api/project',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(id!==request)return;if(!response.ok)throw new Error(data.error);current=data;render();try{localStorage.setItem('disegno-scene',JSON.stringify(payload));}catch{}
 document.querySelector('#solid-name').textContent=`${solids.length} solidi · ${names[solids[active].shape]} attivo`;document.querySelector('#dimensions').textContent='Stessa scala · intersezioni e occultamenti tra solidi';document.querySelector('#error').textContent='';document.querySelector('#export').disabled=false;
 }catch(error){if(id===request)document.querySelector('#error').textContent=`Impossibile aggiornare: ${error.message}`;}
}
document.querySelectorAll('[data-shape]').forEach(b=>b.addEventListener('click',()=>{if(!capture())return;solids[active].shape=b.dataset.shape;sync();update();}));
document.querySelector('#objects').addEventListener('change',e=>{active=Number(e.target.value);sync();update();});
for(const id of ['add','duplicate'])document.querySelector(`#${id}`).addEventListener('click',()=>{if(!capture()||solids.length>=30)return;const s=id==='duplicate'?{...solids[active]}:blank();s.x=Math.min(1000,solids[active].x+solids[active].width+30);solids.push(s);active=solids.length-1;sync();update();});
document.querySelector('#remove').addEventListener('click',()=>{if(solids.length===1)return;solids.splice(active,1);active=Math.min(active,solids.length-1);sync();update();});
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>{
 capture();previousScene={solids:structuredClone(solids),active,view:document.querySelector('#view').value};
 const scenario=scenarios[button.dataset.scenario];solids=structuredClone(scenario.solids);active=0;
 document.querySelector('#view').value=scenario.view??'all';
 document.querySelector('#undo-scenario').disabled=false;
 document.querySelector('#scenario-status').textContent=`${scenario.name}: ${solids.length} solidi modificabili.`;
 sync();update();
}));
document.querySelector('#undo-scenario').addEventListener('click',()=>{
 if(!previousScene)return;
 solids=previousScene.solids;active=previousScene.active;document.querySelector('#view').value=previousScene.view;
 previousScene=undefined;document.querySelector('#undo-scenario').disabled=true;
 document.querySelector('#scenario-status').textContent='Scena precedente ripristinata.';sync();update();
});
form.addEventListener('input',e=>{if(e.target.id==='objects')return;if(['hidden','axes','filled','connections','construction-point'].includes(e.target.id)){render();return;}
 if(e.target.id==='view'){
  // La costruzione dalla pianta è la cavaliera ridotta: la profondità va sempre a ½.
  if(e.target.value==='construction'&&form.elements.reduction.value!=='0.5'){form.elements.reduction.value='0.5';update();return;}
  render();return;
 }
 update();});form.addEventListener('submit',e=>e.preventDefault());
document.querySelector('#reset').textContent='Ripristina solido attivo';document.querySelector('#reset').addEventListener('click',()=>{solids[active]=blank();sync();update();});
document.querySelector('#export').addEventListener('click',()=>{const clone=svg.cloneNode(true),size=svg.getAttribute('viewBox').split(' ');clone.removeAttribute('style');clone.setAttribute('width',size[2]);clone.setAttribute('height',size[3]);const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download='tavola-proiezioni.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
sync();update();

