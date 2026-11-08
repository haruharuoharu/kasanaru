// No wallet secrets are stored: only the signed, public Devnet transaction.
export function base58(bytes){let n=0n;for(const b of bytes)n=(n<<8n)+BigInt(b);let s='';const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';while(n){s=alphabet[Number(n%58n)]+s;n/=58n;}for(const b of bytes){if(b!==0)break;s='1'+s;}return s;}
export function pendingKey(kind,hash){return `ks_pending_${kind}_${hash}`;}
export function validatePending(p,hash){return !!p&&p.hash===hash&&typeof p.signature==='string'&&typeof p.recorder==='string'&&typeof p.raw==='string';}
