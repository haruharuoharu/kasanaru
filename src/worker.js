import {QUESTIONS,RULES,canonical,sha256,aggregate,demo} from './domain.js';
const MEMO='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
function fail(message,status=400,code="REQUEST_ERROR"){throw Object.assign(new Error(message),{status,code});}
function participant(req){const raw=req.headers.get('cookie')||'';return raw.match(/(?:^|;\s*)ks_session=([a-f0-9]{64})(?:;|$)/)?.[1]||null;}
function admin(req,env){return env.ADMIN_TOKEN?.length>=24&&req.headers.get('authorization')==='Bearer '+env.ADMIN_TOKEN;}
async function room(db){return db.prepare('SELECT * FROM room WHERE id=1').first();}
async function ensure(db){const rules=canonical({schema:'kasanaru-rules-v1',room:'main',topic:'イベント告知と生成AIイラスト',questions:QUESTIONS,rules:RULES});await db.prepare('INSERT OR IGNORE INTO room(id,rules_json,rules_hash) VALUES(1,?,?)').bind(rules,await sha256(rules)).run();}
export function memoFor(kind,hash){return canonical({app:'kasanaru',room:'main',kind,sha256:hash});}
export async function verifyRecord(signature,expected,recorder,fetcher=fetch,rpcUrl='https://api.devnet.solana.com'){
 if(!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature||''))fail('トランザクションIDが正しくありません。');
 let parsed;
 try{parsed=new URL(rpcUrl.trim());if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error();}catch{fail('SOLANA_RPC_URLの形式が正しくありません。APIキー単体ではなく、https://で始まるDevnet RPC URL全体を設定してください。',503,'RPC_CONFIG');}
 let response;
 try{response=await fetcher(parsed.href,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTransaction',params:[signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}]}),signal:AbortSignal.timeout(12000)});}catch{fail('RPCへの通信が失敗しました。接続先URLとRPCサービスの稼働状況を確認してください。',503,'RPC_NETWORK');}
 if(!response.ok)fail(response.status===401||response.status===403?'RPCの認証またはアクセスが拒否されました。Devnet用URL・APIキー・アクセス制限を確認してください。':response.status===429?'RPCの利用制限に達しました。少し待って再確認してください。':'RPCからHTTP '+response.status+'が返りました。接続先を確認してください。',503,'RPC_HTTP_'+response.status);
 let payload;try{payload=await response.json();}catch{fail('RPCからJSON以外の応答が返りました。ダッシュボードのURLではなく、Devnet RPC URLを設定してください。',503,'RPC_FORMAT');}
 if(!payload||payload.error)fail('RPCが記録取得エラーを返しました。接続先がDevnet対応か確認してください。',503,'RPC_RESPONSE');
 if(!payload.result)fail('RPCへの接続は成功しましたが、このTxはまだ見つかりません。未送信または確認待ちです。',503,'TX_PENDING');
 const tx=payload.result;if(tx.meta?.err||!tx.meta)fail('失敗したトランザクションは記録に使えません。');
 const keys=tx.transaction.message.accountKeys;const signers=keys.filter(k=>k.signer).map(k=>k.pubkey);
 const memo=tx.transaction.message.instructions.find(i=>i.programId===MEMO&&i.parsed===expected);
 if(!memo)fail('このルームの記録内容と一致しません。');
 if(typeof recorder!=='string'||!signers.includes(recorder))fail('記録者の署名が一致しません。');
 return {signature,recorder,slot:tx.slot};
}
export default {async scheduled(_event,env){await env.DB.batch([env.DB.prepare("DELETE FROM votes WHERE participant_id IN (SELECT id FROM participants WHERE created_at < datetime('now','-30 days'))"),env.DB.prepare("DELETE FROM participants WHERE created_at < datetime('now','-30 days')")]);},async fetch(req,env){
 const url=new URL(req.url);if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);
 try{
 if(req.method==='POST'&&req.headers.get('origin')!==url.origin)fail('同じサイトから操作してください。',403);
 await ensure(env.DB);let r=await room(env.DB);const path=url.pathname;const isAdmin=admin(req,env);const sid=participant(req);
 if(req.method==='GET'&&path==='/api/state'){
 const rows=await env.DB.prepare('SELECT id,group_name FROM participants').all();const votes=await env.DB.prepare('SELECT * FROM votes').all();
 const my=sid?votes.results.filter(v=>v.participant_id===sid):[];
 // Keep aggregates hidden during initial voting. Group counts appear after closing round one.
 let summary=null;if(r.state==='final'&&r.snapshot_json)summary=JSON.parse(r.snapshot_json).summary;
 else if(r.state!=='draft'&&r.state!=='round1')summary=aggregate(rows.results,votes.results);
 return json({state:r.state,topic:'イベント告知に、生成AIイラストを使ってよい？',questions:QUESTIONS.filter(q=>q.round===1||!['draft','round1','review'].includes(r.state)),rules:RULES,summary,answers:Object.fromEntries(my.map(v=>[v.question_id,v.answer])),joined:!!sid&&rows.results.some(p=>p.id===sid),isAdmin,rulesHash:r.rules_hash,rulesTx:r.rules_tx,resultHash:r.snapshot_hash,resultTx:r.result_tx,recorder:r.recorder,localUnanchored:env.LOCAL_MODE==='1'&&env.ALLOW_LOCAL_UNANCHORED==='1'});
 }
 if(req.method==='GET'&&path==='/api/demo')return json({demo:true,summary:demo()});
 if(req.method==='GET'&&path==='/api/rules')return new Response(r.rules_json,{headers:{'content-type':'application/json','content-disposition':'attachment; filename="kasanaru-rules.json"'}});
 if(req.method==='GET'&&path==='/api/snapshot'){
 if(!r.snapshot_json)fail('最終結果はまだ確定していません。',409);
 return new Response(r.snapshot_json,{headers:{'content-type':'application/json','content-disposition':'attachment; filename="kasanaru-result.json"'}});
 }
 if(req.method==='POST'&&Number(req.headers.get('content-length')||0)>4096)fail('データが大きすぎます。',413);
 let body={};if(req.method==='POST'){const raw=await req.text();if(raw.length>4096)fail('データが大きすぎます。',413);try{body=JSON.parse(raw||'{}');}catch{fail('JSON形式が正しくありません。');}if(!body||Array.isArray(body)||typeof body!=='object')fail('JSONオブジェクトを指定してください。');}
 if(req.method==='POST'&&path==='/api/join'){
 if(r.state!=='round1')fail('現在、新規参加は受け付けていません。',409);
 if(sid&&(await env.DB.prepare('SELECT id FROM participants WHERE id=?').bind(sid).first()))return json({ok:true});
 const id=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
 await env.DB.prepare("INSERT INTO participants(id) SELECT ? WHERE (SELECT state FROM room WHERE id=1)='round1' AND (SELECT COUNT(*) FROM participants)<100").bind(id).run();
 if(!(await env.DB.prepare('SELECT id FROM participants WHERE id=?').bind(id).first()))fail('受付を終了しました。',409);
 return json({ok:true},200,{'set-cookie':`ks_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${url.protocol==='https:'?'; Secure':''}`});
 }
 if(req.method==='POST'&&path==='/api/vote'){
 if(!sid)fail('先に参加してください。',401);const q=QUESTIONS.find(q=>q.id===body.questionId);
 if(!q||!['agree','disagree','pass'].includes(body.answer))fail('回答が正しくありません。');
 const target=q.round===1?'round1':'round2';
 const result=await env.DB.prepare(`INSERT INTO votes(participant_id,question_id,answer) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM participants WHERE id=?) AND (SELECT state FROM room WHERE id=1)=? ON CONFLICT(participant_id,question_id) DO UPDATE SET answer=excluded.answer`).bind(sid,q.id,body.answer,sid,target).run();
 if(!result.meta.changes)fail('回答期間が終了したか、参加情報がありません。',409);return json({ok:true});
 }
 if(path.startsWith('/api/admin/')){
 if(!isAdmin)fail('主催者の認証が必要です。',401);
 if(req.method!=='POST')fail('操作が正しくありません。',405);
 if(path==='/api/admin/record'){
 const kind=body.kind;if(!['rules','result'].includes(kind))fail('記録種別が正しくありません。');
 if(kind==='rules'&&r.state!=='draft')fail('ルールは固定済みです。',409);
 if(kind==='result'&&r.state!=='final')fail('先に結果を確定してください。',409);
 const existingTx=kind==='rules'?r.rules_tx:r.result_tx;if(existingTx){if(existingTx===body.signature&&r.recorder===body.recorder)return json({ok:true});fail('すでに別の記録が登録されています。',409);}
 const hash=kind==='rules'?r.rules_hash:r.snapshot_hash;const who=kind==='rules'?body.recorder:r.recorder;
 await verifyRecord(body.signature,memoFor(kind,hash),who,fetch,env.SOLANA_RPC_URL);
 if(kind==='rules')await env.DB.prepare("UPDATE room SET rules_tx=?,recorder=? WHERE id=1 AND state='draft' AND rules_tx IS NULL").bind(body.signature,who).run();
 else await env.DB.prepare("UPDATE room SET result_tx=? WHERE id=1 AND state='final' AND result_tx IS NULL").bind(body.signature).run();
 return json({ok:true});
 }
 if(path==='/api/admin/transition'){
 const action=body.action;const allowed={open:['draft','round1'],review:['round1','review'],followup:['review','round2'],final:['round2','closing','final']};if(!allowed[action])fail('操作が正しくありません。');if(!allowed[action].includes(r.state))fail('別の画面で進行しました。更新して現在の状態を確認してください。',409);
 if(action==='open'){
 if(!r.rules_tx&&!(env.LOCAL_MODE==='1'&&env.ALLOW_LOCAL_UNANCHORED==='1'))fail('投票前にルールをDevnetへ記録してください。',409);
 await env.DB.prepare("UPDATE room SET state='round1' WHERE id=1 AND state='draft'").run();
 }else if(action==='review'){
 await env.DB.batch([
 env.DB.prepare("UPDATE participants SET group_name=COALESCE((SELECT CASE WHEN answer IN ('agree','disagree') THEN answer ELSE 'other' END FROM votes WHERE participant_id=participants.id AND question_id='q1'),'other') WHERE (SELECT state FROM room WHERE id=1)='round1'"),
 env.DB.prepare("UPDATE room SET state='review' WHERE id=1 AND state='round1'")]);
 }else if(action==='followup')await env.DB.prepare("UPDATE room SET state='round2' WHERE id=1 AND state='review'").run();
 else if(action==='final'){
 await env.DB.prepare("UPDATE room SET state='closing',closed_at=? WHERE id=1 AND state='round2'").bind(new Date().toISOString()).run();
 r=await room(env.DB);if(r.state==='closing'){
 const ps=await env.DB.prepare('SELECT id,group_name FROM participants').all();const vs=await env.DB.prepare('SELECT * FROM votes').all();
 const data=canonical({schema:'kasanaru-result-v1',room:'main',rulesHash:r.rules_hash,rulesTx:r.rules_tx,recorder:r.recorder,closedAt:r.closed_at,summary:aggregate(ps.results,vs.results),limitations:['browser-session-not-person','sample-not-representative','hash-does-not-prove-tally-correctness']});
 await env.DB.prepare("UPDATE room SET state='final',snapshot_json=?,snapshot_hash=? WHERE id=1 AND state='closing'").bind(data,await sha256(data)).run();}
 }else fail('操作が正しくありません。');return json({ok:true});
 }
 }
 if(req.method==='POST'&&path==='/api/verify'){
 const kind=body.kind;if(!['rules','result'].includes(kind))fail('記録種別が正しくありません。');
 const signature=kind==='rules'?r.rules_tx:r.result_tx;const hash=kind==='rules'?r.rules_hash:r.snapshot_hash;
 if(!signature)fail('まだ記録されていません。',409);const recordedText=kind==='rules'?r.rules_json:r.snapshot_json;if(!recordedText||await sha256(recordedText)!==hash)fail('保存ファイルと固定ハッシュが一致しません。',409);await verifyRecord(signature,memoFor(kind,hash),r.recorder,fetch,env.SOLANA_RPC_URL);return json({status:'match',hash,signature});
 }
 return json({error:'見つかりません。'},404);
 }catch(e){return json({error:e.status?e.message:'処理できませんでした。時間をおいて再試行してください。',code:e.code||'INTERNAL_ERROR'},e.status||500);}
}};
