import {translate} from '../public/i18n.js';
const t=text=>translate(text,document.documentElement.lang);
import {Connection} from '@solana/web3.js';
import {Buffer} from 'buffer';
import {base58} from './record.js';
import {buildRecordTransaction} from './chain.js';
const RPC='https://api.devnet.solana.com';
export async function prepareRecord(kind,hash,expectedRecorder,choice){
 const provider=choice==='solflare'?window.solflare:choice==='phantom'?window.phantom?.solana:undefined;
 if(!provider?.connect||!provider?.signTransaction)throw Error(t('選択したウォレットのブラウザ拡張を有効にし、ページを再読み込みしてください。'));
 await provider.connect();const address=provider.publicKey.toBase58();
 if(expectedRecorder&&address!==expectedRecorder)throw Error(t('ルールを記録したウォレットと同じウォレットを選んでください。'));
 if(!confirm(t('Solana Devnetへハッシュを記録します。テスト用SOLの手数料が必要です。資金の送金指示は含みません。続行しますか？')))throw Error(t('記録をキャンセルしました。'));
 const connection=new Connection(RPC,'confirmed');const latest=await connection.getLatestBlockhash();
 const tx=buildRecordTransaction(kind,hash,provider.publicKey,latest);
 const signed=await provider.signTransaction(tx);const signature=base58(signed.signature);
 return {signature,recorder:address,raw:Buffer.from(signed.serialize()).toString('base64'),hash,lastValidBlockHeight:latest.lastValidBlockHeight};
}
export async function broadcastRecord(pending){
 const connection=new Connection(RPC,'confirmed');
 try{const returned=await connection.sendRawTransaction(Buffer.from(pending.raw,'base64'));if(returned!==pending.signature)throw Error(t('送信されたトランザクションIDが一致しません。'));}
 catch(error){const status=await connection.getSignatureStatus(pending.signature,{searchTransactionHistory:true}).catch(()=>null);if(status?.value&&!status.value.err)return;const height=await connection.getBlockHeight().catch(()=>null);if(height!==null&&height>pending.lastValidBlockHeight)throw Error(t('署名の有効期間が終了しました。Explorerで状態を確認し、「新しく署名」を使ってください。'));throw Error((document.documentElement.lang==='en'?'Unable to confirm submission. You can recheck the same record. ':'送信の確認ができませんでした。同じ記録を再確認できます。')+(error.message||''));}
}
