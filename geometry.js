export function projectSolid(input = {}) {
  const shape = input.shape ?? 'box';
  if (!['box', 'cube', 'pyramid', 'prism'].includes(shape)) throw new Error('Solido non supportato.');
  const read = (key, fallback, min, max) => {
    const n = Number(input[key] ?? fallback);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${key}: inserire un numero tra ${min} e ${max}.`);
    return n;
  };
  const w = read('width', 120, 10, 300);
  const d = shape === 'cube' ? w : read('depth', 90, 10, 300);
  const h = shape === 'cube' ? w : read('height', 140, 10, 300);
  const angle = read('angle', 45, 10, 80) * Math.PI / 180;
  const reduction = read('reduction', 0.5, 0.1, 1);
  let vertices, faces;
  if (shape === 'pyramid') {
    vertices = [[0,0,0],[w,0,0],[w,d,0],[0,d,0],[w/2,d/2,h]];
    faces = [[3,2,1,0],[0,1,4],[1,2,4],[2,3,4],[3,0,4]];
  } else if (shape === 'prism') {
    vertices = [[0,0,0],[w,0,0],[w/2,0,h],[0,d,0],[w,d,0],[w/2,d,h]];
    faces = [[0,1,2],[5,4,3],[0,3,4,1],[1,4,5,2],[2,5,3,0]];
  } else {
    vertices = [[0,0,0],[w,0,0],[w,d,0],[0,d,0],[0,0,h],[w,0,h],[w,d,h],[0,d,h]];
    faces = [[3,2,1,0],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]];
  }
  const projections = {
    cavalier: { project: ([x,y,z]) => [x+reduction*y*Math.cos(angle),-z-reduction*y*Math.sin(angle)], view: [reduction*Math.cos(angle),-1,reduction*Math.sin(angle)] },
    isometric: { project: ([x,y,z]) => [(x+y)*Math.sqrt(3)/2,(x-y)/2-z], view: [1,-1,1] },
    front: { project: ([x,y,z]) => [x,-z], view: [0,-1,0] },
    back: { project: ([x,y,z]) => [-x,-z], view: [0,1,0] },
    top: { project: ([x,y,z]) => [x,y], view: [0,0,1] },
    bottom: { project: ([x,y,z]) => [x,-y], view: [0,0,-1] },
    right: { project: ([x,y,z]) => [y,-z], view: [1,0,0] },
    left: { project: ([x,y,z]) => [-y,-z], view: [-1,0,0] }
  };
  const projection = input.projection ?? 'cavalier';
  if (!Object.hasOwn(projections, projection)) throw new Error('Proiezione non supportata.');
  const {project,view} = projections[projection];
  const translation = ['x','y','z'].map(key=>read(key,0,-1000,1000));
  const rotation = read('rotation',0,-360,360)*Math.PI/180;
  vertices = vertices.map(([x,y,z])=>{
    const cx=x-w/2, cy=y-d/2;
    return [cx*Math.cos(rotation)-cy*Math.sin(rotation)+w/2+translation[0],cx*Math.sin(rotation)+cy*Math.cos(rotation)+d/2+translation[1],z+translation[2]];
  });
  const edges = new Map();
  const visibleFaces = [];
  faces.forEach(face => {
    const a = vertices[face[0]], b = vertices[face[1]], c = vertices[face[2]];
    const u = b.map((v,i)=>v-a[i]), v = c.map((v,i)=>v-a[i]);
    const normal = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const visible = normal.reduce((s,n,i)=>s+n*view[i],0) > 1e-8;
    if (visible) visibleFaces.push(face);
    face.forEach((a,i)=> {
      const b = face[(i+1)%face.length], key = [a,b].sort((a,b)=>a-b).join('-');
      const edge = edges.get(key) ?? {a,b,visible:false};
      edge.visible ||= visible;
      edges.set(key,edge);
    });
  });
  return { points: vertices.map(project), depths: vertices.map(p=>p.reduce((s,n,i)=>s+n*view[i],0)), edges: [...edges.values()], faces: visibleFaces, dimensions: {width:w,depth:d,height:h}, axes: [[0,0,0],[60,0,0],[0,60,0],[0,0,60]].map(project) };
}
