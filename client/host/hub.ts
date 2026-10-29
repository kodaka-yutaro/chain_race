import { validateCourseMap, newCourseMap } from '../../shared/courses';
import { stageById } from '../../shared/maps';
import { HUB_CAPACITY, validName, type ClientMsg, type HubState, type ServerMsg } from '../../shared/protocol';
import { validFace } from '../../shared/face';
import { Game } from './game';

export interface Client {
  id: number; name: string; guest: boolean; face: string; game: Game | null; lastChat: number; host: boolean;
  send(msg: ServerMsg): void; close(): void;
}
export interface Link {
  send(msg: ServerMsg): void; close(): void;
  onMessage: (msg: ClientMsg) => void; onClose: () => void;
}

/** A host-owned room. The waiting screen has no simulated lobby world. */
export class HostHub {
  readonly members = new Set<Client>();
  readonly games = new Set<Game>();
  private selected = { ...newCourseMap(), id: 'user-000000000000000000', name: '能力の練習コース', minPlayers: 1 };
  private nextId = 1;
  private tickCount = 0;
  constructor(readonly id: string, readonly name: string, private onCount: (n:number)=>void = ()=>{}) {
    const rows = this.selected.tiles.map(r => [...r]);
    for(const [x,c] of [[12,'H'],[19,'M'],[26,'V'],[29,'o'],[31,'o'],[36,'N'],[44,'G']] as const)rows[this.selected.height-4][x]=c;
    this.selected.tiles = rows.map(r=>r.join(''));
  }
  connect(link: Link, host = false) {
    const c: Client = { id:this.nextId++, name:'', guest:true, face:'', game:null, lastChat:0, host,
      send:m=>link.send(m), close:()=>link.close() };
    link.onMessage = m => { try { this.handle(c,m); } catch { c.send({t:'error',message:'部屋の操作を実行できませんでした'}); } };
    link.onClose = () => {
      c.game?.remove(c); this.members.delete(c); this.pushState(); this.onCount(this.members.size);
    };
  }
  tick() { this.tickCount++; for(const game of this.games) game.tick(this.tickCount%2===0); }
  private handle(c: Client, msg: ClientMsg) {
    if (!msg || typeof msg !== 'object') return;
    if(msg.t==='hello') {
      if(c.name)return;
      const name=validName(msg.name);
      if(!name || this.members.size>=HUB_CAPACITY){c.send({t:'error',message:'名前が無効か、部屋が満員です'});c.close();return;}
      c.name=name;c.guest=!!msg.guest;c.face=validFace(msg.face)?msg.face!:'';
      this.members.add(c);c.send({t:'welcome',you:{id:c.id,name,guest:c.guest}});
      const active=[...this.games][0]; if(active)active.add(c);
      this.pushState();this.onCount(this.members.size);return;
    }
    if(!this.members.has(c))return;
    if(msg.t==='chat'){
      const text=String(msg.text??'').trim().slice(0,200),now=Date.now();
      if(!text||now-c.lastChat<500)return;c.lastChat=now;
      for(const peer of this.members)peer.send({t:'chat',from:c.name,fromId:c.id,text});return;
    }
    if(msg.t==='input'){
      if(!c.game || msg.gameId!==c.game.id || !Array.isArray(msg.list))return;
      for(const e of msg.list.slice(-4)){
        const i=e?.input;if(!i||!Number.isSafeInteger(e.seq))continue;
        c.game.pushInput(c,e.seq,{left:!!i.left,right:!!i.right,up:!!i.up,down:!!i.down,jump:!!i.jump,wire:!!i.wire,fire:!!i.fire,kill:!!i.kill,
          aimX:Number.isFinite(i.aimX)?i.aimX:1,aimY:Number.isFinite(i.aimY)?i.aimY:0,spit:!!i.spit,miniSpit:!!i.miniSpit,clearWord:!!i.clearWord});
      }return;
    }
    if(msg.t==='roomResume'){const g=[...this.games][0];if(g&&!c.game)g.add(c);this.pushState();return;}
    if(msg.t==='leaveGame'){ c.game?.remove(c);this.pushState();return; }
    if(!c.host){c.send({t:'error',message:'コース選択と開始はホストが行います'});return;}
    if(msg.t==='roomStop') { for(const peer of this.members)peer.game?.remove(peer); this.games.clear();this.pushState();return; }
    if(this.games.size){c.send({t:'error',message:'コースを変更するには全員を待機画面に戻してください'});return;}
    if(msg.t==='stageJoin'){
      const m=stageById(msg.stageId);if(!m)return;
      this.selected={...structuredClone(m), abilityMode:true, wordBlocks:true};
      const rows=this.selected.tiles.map(r=>[...r]);const sy=rows.findIndex(r=>r.includes('S')),sx=rows[sy]?.indexOf('S')??-1;
      if(sy>=0)for(const [i,c] of ['G','H','M','V','N'].entries()){const x=sx+2+i*2;if(rows[sy][x]==='.')rows[sy][x]=c;}
      this.selected.tiles=rows.map(r=>r.join(''));this.pushState();return;
    }
    if(msg.t==='courseJoin'){
      const m=validateCourseMap(msg.map);
      if(!/^user-[a-f0-9]{18}$/.test(msg.map.id))return;
      this.selected={...m,id:msg.map.id};this.pushState();return;
    }
    if(msg.t==='roomStart'){
      if(this.members.size<this.selected.minPlayers){c.send({t:'error',message:`${this.selected.minPlayers}人以上で開始できます`});return;}

      const g=new Game(this.selected.id,'party',g=>this.games.delete(g),{},this.selected);this.games.add(g);
      for(const peer of this.members)g.add(peer);this.pushState();
    }
  }
  private pushState(){
    const state:HubState={id:this.id,name:this.name,host:[...this.members].find(c=>c.host)?.id??-1,stageId:this.selected.id,stageName:this.selected.name,playing:this.games.size>0,
      members:[...this.members].map(c=>({id:c.id,name:c.name,guest:c.guest,status:c.game?'プレイ中':'待機中'})),free:[]};
    for(const c of this.members)c.send({t:'hubState',hub:state});
  }
}
