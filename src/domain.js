export const QUESTIONS = [
 {id:'q1',round:1,text:'イベント告知に、生成AIイラストを使ってよい。'},
 {id:'q2',round:1,text:'学習データの利用許諾が確認できることが大切だ。'},
 {id:'q3',round:1,text:'イラストレーターへの発注機会を減らさないことが大切だ。'},
 {id:'q4',round:2,text:'学習データの利用許諾が確認でき、予定していたイラスト発注を減らさず、従来フリー素材を使っていた部分に限るなら、生成AIイラストを使ってよい。'}
];
export const RULES={version:'kasanaru-v1',minResponses:3,minCoverage:0.6,minSupport:0.7,denominator:'agree+disagree+pass',grouping:'q1-at-round1-close',network:'solana-devnet'};
export const GROUPS=['agree','disagree','other'];
export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export async function sha256(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function aggregate(participants,votes){
 const byKey=new Map(votes.map(v=>[v.participant_id+':'+v.question_id,v.answer]));
 const counts=(ps,q)=>{const c={agree:0,disagree:0,pass:0,unanswered:0};for(const p of ps)c[byKey.get(p.id+':'+q)||'unanswered']++;const answered=c.agree+c.disagree+c.pass;return {...c,total:ps.length,answered,support:answered?c.agree/answered:null,coverage:ps.length?answered/ps.length:0};};
 const groups=Object.fromEntries(GROUPS.map(g=>[g,participants.filter(p=>p.group_name===g)]));
 const questions=QUESTIONS.map(q=>({...q,overall:counts(participants,q.id),groups:Object.fromEntries(GROUPS.map(g=>[g,counts(groups[g],q.id)]))}));
 const q4=questions.find(q=>q.id==='q4');
 const ready=['agree','disagree'].every(g=>q4.groups[g].answered>=RULES.minResponses&&q4.groups[g].coverage>=RULES.minCoverage);
 const supported=ready&&['agree','disagree'].every(g=>q4.groups[g].support>=RULES.minSupport);
 return {participantCount:participants.length,questions,candidate:supported,status:!ready?'insufficient':supported?'shared':'different'};
}
export function demo(){
 const ps=Array.from({length:12},(_,i)=>({id:'demo-'+i,group_name:i<6?'agree':'disagree'}));
 const votes=ps.flatMap((p,i)=>QUESTIONS.map(q=>({participant_id:p.id,question_id:q.id,answer:q.id==='q1'?(i<6?'agree':'disagree'):q.id==='q4'?(i===5||i===11?'disagree':'agree'):'agree'})));
 return aggregate(ps,votes);
}
