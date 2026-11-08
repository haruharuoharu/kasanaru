import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomBytes} from 'node:crypto';
import worker from '../src/worker.js';
await mkdir('.data',{recursive:true});const sqlite=new DatabaseSync('.data/kasanaru.sqlite');sqlite.exec(await readFile('schema.sql','utf8'));
function prepare(sql,values=[]){return {bind(...v){return prepare(sql,v);},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){const r=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};}};}
const db={prepare,async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
// Serialize local API calls to match atomic D1 batch behavior.
let queue=Promise.resolve();const token=process.env.ADMIN_TOKEN||randomBytes(24).toString('hex');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const env={DB:db,ADMIN_TOKEN:token,LOCAL_MODE:'1',ALLOW_LOCAL_UNANCHORED:process.env.ALLOW_LOCAL_UNANCHORED||'0',ASSETS:{async fetch(req){try{let path=new URL(req.url).pathname;if(path==='/')path='/index.html';const file=resolve('public','.'+path);if(!file.startsWith(resolve('public')+'/'))return new Response('Forbidden',{status:403});return new Response(await readFile(file),{headers:{'content-type':mime[extname(file)]||'application/octet-stream','x-content-type-options':'nosniff'}});}catch{return new Response('Not found',{status:404});}}}};
const server=createServer(async(incoming,outgoing)=>{let raw=[];let size=0;for await(const c of incoming){size+=c.length;if(size>8192){outgoing.writeHead(413);outgoing.end();return;}raw.push(c);}const req=new Request('http://'+incoming.headers.host+incoming.url,{method:incoming.method,headers:incoming.headers,...(!['GET','HEAD'].includes(incoming.method)?{body:Buffer.concat(raw)}:{})});const task=async()=>{const res=await worker.fetch(req,env);outgoing.writeHead(res.status,Object.fromEntries(res.headers));outgoing.end(Buffer.from(await res.arrayBuffer()));};queue=queue.then(task,task).catch(e=>{console.error(e);outgoing.writeHead(500);outgoing.end();});});
server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>{console.log('Kasanaru: http://127.0.0.1:'+ (process.env.PORT||8787));console.log('Local admin token (do not share): '+token);console.log('Unanchored local mode: '+(env.ALLOW_LOCAL_UNANCHORED==='1'));});
