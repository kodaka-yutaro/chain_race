import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localBackend} from '../client/net/local';
import {HUB_STALE_MS} from '../client/net/backend';

test('公開部屋だけを列挙し、招待IDで入室でき、終了した部屋を復活させない',async()=>{
  const local=new Map<string,string>(),session=new Map<string,string>();
  const keys=['localStorage','sessionStorage','BroadcastChannel'] as const;
  const original=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
  const storage=(data:Map<string,string>)=>({getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage(local)});
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage(session)});
  Object.defineProperty(globalThis,'BroadcastChannel',{configurable:true,value:class{addEventListener(){}removeEventListener(){}postMessage(){}}});
  try{
    const b=localBackend();assert.deepEqual(await b.listHubs(),[]);
    const pub=await b.claimHub(null,'公開','host-a','public'),secret=await b.claimHub(null,'友達','host-b','invite');
    await b.heartbeat(pub.id,2,['主','友達']);const listed=await b.listHubs();assert.equal(listed.length,1);assert.deepEqual(listed[0].members,['主','友達']);
    assert.equal((await b.claimHub(secret.id,'招待','guest')).role,'join');
    await b.releaseHub(pub.id);await assert.rejects(()=>b.claimHub(pub.id,'古い招待','guest'),/終了/);
    const rooms=JSON.parse(local.get('cr.hubs')!);rooms[secret.id].updatedAt=Date.now()-HUB_STALE_MS-1;local.set('cr.hubs',JSON.stringify(rooms));
    await assert.rejects(()=>b.claimHub(secret.id,'期限切れ','guest'),/終了/);
    await assert.rejects(()=>b.claimHub(secret.id,'復元','wrong-host','invite',true),/復元/);
    assert.equal((await b.claimHub(secret.id,'復元','host-b','invite',true)).role,'host');
    await b.releaseHub(secret.id);
    await assert.rejects(()=>b.claimHub(secret.id,'終了後','host-b','invite',true),/復元/);
  }finally{keys.forEach((k,i)=>{if(original[i])Object.defineProperty(globalThis,k,original[i]!);else Reflect.deleteProperty(globalThis,k);});}
});
