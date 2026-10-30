// Vector visibility for convex polyhedra in parallel projection.
// Depth increases toward the observer. All clipping happens in drawing units.
const EPS=1e-7;
const value=(h,p)=>h[0]*p[0]+h[1]*p[1]+h[2];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function clip(poly,h){
 const out=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],va=value(h,a),vb=value(h,b);
  if(va>=-EPS)out.push(a);
  if((va>EPS&&vb<-EPS)||(va<-EPS&&vb>EPS))out.push(mix(a,b,va/(va-vb)));
 }
 return out;
}
function area(poly){return Math.abs(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-p[1]*q[0];},0))/2;}
function bounds(poly){return [Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];}
function overlaps(a,b){return a[0]<=b[2]+EPS&&b[0]<=a[2]+EPS&&a[1]<=b[3]+EPS&&b[1]<=a[3]+EPS;}
function planes(poly){
 const center=poly.reduce((s,p)=>s.map((v,i)=>v+p[i]/poly.length),[0,0]);
 return poly.map((a,i)=>{const b=poly[(i+1)%poly.length];let h=[a[1]-b[1],b[0]-a[0],a[0]*b[1]-b[0]*a[1]];if(value(h,center)<0)h=h.map(n=>-n);return h;});
}
function depthPlane(poly,depths){
 const [a,b,c]=poly,[da,db,dc]=depths;
 const det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
 const x=((db-da)*(c[1]-a[1])-(dc-da)*(b[1]-a[1]))/det;
 const y=((b[0]-a[0])*(dc-da)-(c[0]-a[0])*(db-da))/det;
 return [x,y,da-x*a[0]-y*a[1]];
}
function subtract(poly,halfplanes){
 let inside=poly;const outside=[];
 for(const h of halfplanes){
  if(inside.length<3)break;
  const part=clip(inside,h.map(v=>-v));
  if(part.length>=3&&area(part)>EPS)outside.push(part);
  inside=clip(inside,h);
 }
 return outside;
}
function interval(a,b,halfplanes){
 let lo=0,hi=1;
 for(const h of halfplanes){const va=value(h,a),vb=value(h,b),delta=vb-va;
  if(Math.abs(delta)<EPS){if(va<0)return null;continue;}
  const t=-va/delta;if(delta>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
  if(lo>=hi-EPS)return null;
 }
 return [lo,hi];
}
export function decorateScene(solids){
 const faces=[];
 solids.forEach((s,si)=>s.faces.forEach((indices,fi)=>{
  const poly=indices.map(i=>s.points[i]);if(area(poly)<EPS)return;
  faces.push({si,fi,poly,box:bounds(poly),planes:planes(poly),depth:depthPlane(poly,indices.map(i=>s.depths[i]))});
 }));
 solids.forEach(s=>{s.surfaces=[];s.segments=[];});
 for(const face of faces){
  let fragments=[face.poly];
  for(const other of faces){
   if(other.si===face.si||!overlaps(face.box,other.box))continue;
   const difference=other.depth.map((v,i)=>v-face.depth[i]);
   // Stable ownership of coincident surfaces avoids holes and double drawing.
   const coplanar=difference.every(v=>Math.abs(v)<EPS);
   if(coplanar&&other.si>face.si)continue;
   if(!coplanar)difference[2]-=EPS;
   const cuts=coplanar?other.planes:[...other.planes,difference];
   fragments=fragments.flatMap(p=>subtract(p,cuts));if(!fragments.length)break;
  }
  fragments.forEach(points=>solids[face.si].surfaces.push({points,shade:face.fi}));
 }
 function segment(a,b,da,db,si,initialVisible=true,intersection=false){
  if(Math.hypot(a[0]-b[0],a[1]-b[1])<EPS)return;
  const box=bounds([a,b]),hidden=[];
  for(const face of faces){
   if(!overlaps(box,face.box))continue;
   const cover=interval(a,b,face.planes);if(!cover)continue;
   const va=value(face.depth,a)-da-EPS*10,vb=value(face.depth,b)-db-EPS*10;
   let [lo,hi]=cover;
   if(va<=0&&vb<=0)continue;
   if(va<=0)lo=Math.max(lo,-va/(vb-va));
   if(vb<=0)hi=Math.min(hi,-va/(vb-va));
   if(hi-lo>EPS)hidden.push([lo,hi]);
  }
  const cuts=[...new Set([0,1,...hidden.flat()])].sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++){
   const lo=cuts[i-1],hi=cuts[i];if(hi-lo<EPS)continue;
   const t=(lo+hi)/2,visible=initialVisible&&!hidden.some(([a,b])=>t>a-EPS&&t<b+EPS);
   solids[si].segments.push({a:mix(a,b,lo),b:mix(a,b,hi),visible,intersection});
  }
 }
 solids.forEach((s,si)=>s.edges.forEach(e=>segment(s.points[e.a],s.points[e.b],s.depths[e.a],s.depths[e.b],si,e.visible)));
 // Face intersections occur where their depth planes coincide inside both polygons.
 for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){
  const a=faces[i],b=faces[j];if(a.si===b.si||!overlaps(a.box,b.box))continue;
  const h=a.depth.map((v,i)=>v-b.depth[i]);if(Math.hypot(h[0],h[1])<EPS)continue;
  let overlap=a.poly;for(const plane of b.planes)overlap=clip(overlap,plane);
  if(overlap.length<3||area(overlap)<EPS)continue;
  const hits=[];
  overlap.forEach((p,k)=>{const q=overlap[(k+1)%overlap.length],vp=value(h,p),vq=value(h,q);if(Math.abs(vp)<EPS)hits.push(p);if(vp*vq<0)hits.push(mix(p,q,vp/(vp-vq)));});
  if(hits.length<2)continue;
  let start=hits[0],end=hits[1],distance=0;
  for(const p of hits)for(const q of hits){const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d>distance){distance=d;start=p;end=q;}}
  if(distance>EPS)segment(start,end,value(a.depth,start),value(a.depth,end),a.si,true,true);
 }
 return solids;
}
