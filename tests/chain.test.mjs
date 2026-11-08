import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Keypair,PublicKey,Transaction} from '@solana/web3.js';
import {buildRecordTransaction,MEMO_PROGRAM} from '../src/chain.js';
import {memoFor} from '../src/worker.js';
import {base58} from '../src/record.js';
test('wallet transaction contains only a Memo, exact server payload, and a verifiable signature',()=>{const payer=Keypair.fromSeed(new Uint8Array(32).fill(7));const hash='a'.repeat(64);const tx=buildRecordTransaction('rules',hash,payer.publicKey,{blockhash:PublicKey.default.toBase58(),lastValidBlockHeight:999});assert.equal(tx.instructions.length,1);assert.equal(tx.instructions[0].programId.toBase58(),MEMO_PROGRAM);assert.equal(tx.instructions[0].data.toString('utf8'),memoFor('rules',hash));tx.partialSign(payer);assert.equal(tx.verifySignatures(),true);const restored=Transaction.from(tx.serialize());assert.equal(base58(restored.signature),base58(tx.signature));assert.equal(restored.verifySignatures(),true);assert.throws(()=>buildRecordTransaction('result','invalid',payer.publicKey,{}));});
