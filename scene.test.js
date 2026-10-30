import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSolid} from './geometry.js';
import {decorateScene} from './scene.js';
const model=[{shape:'pyramid',width:140,depth:120,height:240,x:80,y:30},{shape:'box',width:300,depth:180,height:32,z:140}];
function hit(p,poly,depths){
 for(let i=1;i<poly.length-1;i++){
  const [a,b,c]=[poly[0],poly[i],poly[i+1]];
  const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-8)continue;
  const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/det;
  const v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/det;
  if(u>=0&&v>=0&&u+v<=1)return depths?u*depths[0]+v*depths[i]+(1-u-v)*depths[i+1]:0;
 }
 return null;
}
test('La lastra divide gli spigoli della piramide in tratti visibili e coperti',()=>{
 const [pyramid]=decorateScene(model.map(s=>projectSolid({...s,projection:'front'})));
 const edges=pyramid.segments.filter(s=>!s.intersection);
 assert.ok(edges.some(s=>s.visible&&(s.a[1]+s.b[1])/2 < -172));
 assert.ok(edges.some(s=>s.visible&&(s.a[1]+s.b[1])/2 > -140));
 assert.ok(edges.some(s=>!s.visible&&(s.a[1]+s.b[1])/2 < -140&&(s.a[1]+s.b[1])/2 > -172));
 const perspective=decorateScene(model.map(s=>projectSolid({...s,projection:'cavalier'})));
 assert.ok(perspective.some(s=>s.segments.some(e=>e.intersection&&e.visible)));
});
test('Le superfici ritagliate coincidono con la faccia più vicina in tutte le viste',()=>{
 for(const projection of ['front','right','top','cavalier','back','left','bottom','isometric']){
  const scene=decorateScene(model.map(s=>projectSolid({...s,projection})));
  const pts=scene.flatMap(s=>s.points),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  for(let i=0;i<19;i++)for(let j=0;j<19;j++){
   const p=[minX+(i+.371)/19*(maxX-minX),minY+(j+.613)/19*(maxY-minY)];
   let winner=-1,depth=-Infinity;
   scene.forEach((s,si)=>s.faces.forEach(face=>{const d=hit(p,face.map(n=>s.points[n]),face.map(n=>s.depths[n]));if(d!==null&&d>depth+1e-6){winner=si;depth=d;}}));
   const drawn=scene.flatMap((s,si)=>s.surfaces.filter(f=>hit(p,f.points)!==null).map(()=>si));
   assert.deepEqual(drawn,winner===-1?[]:[winner],`${projection} at ${p}`);
  }
 }
});
test('Facce coincidenti non producono buchi',()=>{
 const scene=decorateScene([projectSolid({}),projectSolid({})]);
 assert.ok(scene[0].surfaces.length>0);assert.equal(scene[1].surfaces.length,0);
});
