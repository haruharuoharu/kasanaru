import {PublicKey,Transaction,TransactionInstruction} from '@solana/web3.js';
import {Buffer} from 'buffer';
export const MEMO_PROGRAM='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export function buildRecordTransaction(kind,hash,payer,latest){
 if(!['rules','result'].includes(kind)||!/^[a-f0-9]{64}$/.test(hash))throw Error('記録内容の形式が正しくありません。');
 return new Transaction({feePayer:payer,...latest}).add(new TransactionInstruction({programId:new PublicKey(MEMO_PROGRAM),keys:[{pubkey:payer,isSigner:true,isWritable:false}],data:Buffer.from(JSON.stringify({app:'kasanaru',kind,room:'main',sha256:hash}),'utf8')}));
}
