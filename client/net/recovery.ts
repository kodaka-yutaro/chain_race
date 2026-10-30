import type { HubSave } from '../host/hub';

export const RECOVERY_KEY = 'chainrace.recovery.v1';
export interface Recovery {
  version: 1; at: number; hubId: string; hubName: string; hostId: string;
  isHost: boolean; token: string; profile: {name:string;guest:boolean}; state?: HubSave;
}
export function readRecovery(storage: Pick<Storage,'getItem'> = sessionStorage): Recovery | null {
  try {
    const r=JSON.parse(storage.getItem(RECOVERY_KEY)??'null');
    if(r?.version!==1 || !Number.isFinite(r.at) || Date.now()-r.at>24*60*60*1000 || r.at>Date.now()+60000
      || !/^[a-f0-9]{18}$/.test(r.hubId) || !/^[a-f0-9]{18}$/.test(r.hostId)
      || !/^[a-f0-9]{36}$/.test(r.token) || typeof r.hubName!=='string' || typeof r.isHost!=='boolean'
      || typeof r.profile?.name!=='string' || typeof r.profile.guest!=='boolean')return null;
    return r;
  }catch{return null;}
}
export function writeRecovery(r:Recovery,storage:Pick<Storage,'setItem'>=sessionStorage): boolean {
  try{storage.setItem(RECOVERY_KEY,JSON.stringify({...r,at:Date.now()}));return true;}catch{return false;}
}
export function clearRecovery(){try{sessionStorage.removeItem(RECOVERY_KEY);}catch{/* storage unavailable */}}
