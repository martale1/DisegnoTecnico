import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSolid} from './geometry.js';
test('Il piano frontale conserva misure e la profondità viene ridotta',()=>{
  const result=projectSolid({width:100,depth:80,height:120,angle:45,reduction:.5});
  assert.equal(result.points[1][0],100);
  assert.ok(Math.abs(result.points[1][1])<1e-9);
  assert.deepEqual(result.points[4],[0,-120]);
  assert.ok(Math.abs(result.points[3][0]-40/Math.sqrt(2))<1e-9);
  assert.equal(result.edges.length,12);
  assert.equal(result.edges.filter(e=>!e.visible).length,3);
});
test('Topologia dei solidi e spigoli unici',()=>{
  for(const [shape,vertices,edges] of [['cube',8,12],['pyramid',5,8],['prism',6,9],['hexprism',12,18]]){
    const result=projectSolid({shape});assert.equal(result.points.length,vertices);assert.equal(result.edges.length,edges);
  }
  assert.deepEqual(projectSolid({shape:'cube',width:70}).dimensions,{width:70,depth:70,height:70});
});
test('Il prisma esagonale ha base regolare e profondità derivata',()=>{
  const plan=projectSolid({shape:'hexprism',width:100,height:80,projection:'top'});
  const xs=plan.points.map(p=>p[0]),ys=plan.points.map(p=>p[1]);
  assert.equal(plan.points.length,12);
  assert.equal(plan.edges.length,18);
  assert.ok(Math.abs(Math.max(...xs)-100)<1e-9);
  assert.ok(Math.abs(Math.min(...xs))<1e-9);
  assert.ok(Math.abs((Math.max(...ys)-Math.min(...ys))-100*Math.sqrt(3)/2)<1e-9);
  assert.ok(Math.abs(plan.dimensions.depth-100*Math.sqrt(3)/2)<1e-9);
  const front=projectSolid({shape:'hexprism',width:100,depth:999,height:80,projection:'front'});
  assert.equal(Math.min(...front.points.map(p=>p[1])),-80);
  assert.ok(Math.abs(Math.max(...front.points.map(p=>p[1])))<1e-9);
});
test('Rifiuta parametri fuori intervallo',()=>{
  for(const input of [{shape:'sphere'},{width:0},{height:'abc'},{angle:90},{reduction:2}])assert.throws(()=>projectSolid(input));
});
test('Le sei viste ortogonali conservano le coordinate del modello',()=>{
  const cases={front:[10,-30],back:[-10,-30],top:[10,20],bottom:[10,-20],right:[20,-30],left:[-20,-30]};
  for(const [projection,expected] of Object.entries(cases)){
    assert.deepEqual(projectSolid({projection,x:10,y:20,z:30}).points[0],expected);
  }
});
test('La rotazione cambia pianta senza cambiare le altezze',()=>{
  const front=projectSolid({projection:'front',width:100,depth:60,rotation:90});
  assert.ok(Math.abs(front.points[0][0]-80)<1e-9);
  assert.ok(Math.abs(front.points[1][0]-80)<1e-9);
  assert.equal(front.points[4][1],-140);
  assert.throws(()=>projectSolid({projection:'unknown'}));
  assert.throws(()=>projectSolid({x:1001}));
});
