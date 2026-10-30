import type {MapDef} from '../shared/physics';
import {validateCourseMap} from '../shared/courses';
export interface Draft {slot:number;map:MapDef;updatedAt:number}
const db=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('chainrace-drafts',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'slot'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function saveDraft(slot:number,map:MapDef){
 if(!Number.isInteger(slot)||slot<0||slot>=5)throw Error('保存枠が正しくありません');
 const d=await db;await new Promise<void>((resolve,reject)=>{const t=d.transaction('drafts','readwrite');t.objectStore('drafts').put({slot,map,updatedAt:Date.now()});t.oncomplete=()=>resolve();t.onabort=t.onerror=()=>reject(t.error);});
}
export async function listDrafts():Promise<Draft[]>{
 const d=await db;const rows=await new Promise<Draft[]>((resolve,reject)=>{const r=d.transaction('drafts').objectStore('drafts').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 // Copy the old draft once; keep the original as a recovery backup.
 if(!rows.length){const raw=localStorage.getItem('tsunagu.course-draft.v1');if(raw){const map=validateCourseMap(JSON.parse(raw),false);await saveDraft(0,map);return [{slot:0,map,updatedAt:Date.now()}];}}
 return rows;
}
