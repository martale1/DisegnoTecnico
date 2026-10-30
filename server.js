import http from 'node:http';
import os from 'node:os';
import {readFile} from 'node:fs/promises';
import {projectSolid} from './geometry.js';
import {decorateScene} from './scene.js';

const assets = {'/':['index.html','text/html'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css']};
const server = http.createServer(async (req,res)=> {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/project' && req.method === 'POST') {
    try {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 65536) throw new Error('Richiesta troppo grande.'); }
      const input = JSON.parse(body);
      if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Parametri non validi.');
      let result;
      if (input.solids !== undefined) {
        if (!Array.isArray(input.solids) || input.solids.length < 1 || input.solids.length > 30) throw new Error('La scena deve contenere da 1 a 30 solidi.');
        const views = ['front','right','top','cavalier','back','left','bottom','isometric'];
        result = Object.fromEntries(views.map(projection=>[projection,decorateScene(input.solids.map(solid=>{
          if (!solid || typeof solid !== 'object' || Array.isArray(solid)) throw new Error('Solido non valido.');
          return projectSolid({...solid,angle:input.angle,reduction:input.reduction,projection});
        }))]));
      } else result = projectSolid(input);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(result));
    } catch (error) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); }
    return;
  }
  const asset = assets[url.pathname];
  if (!asset || req.method !== 'GET') { res.writeHead(404); res.end('Non trovato'); return; }
  try {
    const content = await readFile(new URL(`./public/${asset[0]}`,import.meta.url));
    res.writeHead(200, {'Content-Type':`${asset[1]}; charset=utf-8`}); res.end(content);
  } catch { res.writeHead(500); res.end('Impossibile caricare la pagina.'); }
});
const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 3000);
server.listen(port, host, ()=>{
  const lan = Object.values(os.networkInterfaces()).flat().filter(i=>i && i.family === 'IPv4' && !i.internal).map(i=>i.address);
  const addresses = host === '0.0.0.0' || host === '::' ? lan : [host];
  console.log(`Apri ${(addresses.length ? addresses : [host]).map(a=>`http://${a}:${port}`).join('  ')}`);
});
