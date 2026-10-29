import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,newRunner,emptyInput,stepWorld,wordCollision,type Input,type World} from '../shared/physics';
import {newCourseMap,validateCourseMap} from '../shared/courses';
import {BALL_RADIUS,COLLECTION_RADIUS,ballCount,ballStep,shotLaunch,shotPreview,metalPart,bicycleBlocked} from '../shared/abilities';
import {defaultFace,validFace} from '../shared/face';
function setup(){const m=newCourseMap(40,20),w=createWorld(m),r=newRunner(1,m);w.runners.push(r);r.x=200;r.y=17*32-14;return {m,w,r};}
function tick(w:World,n=1,input:Partial<Input>={}){for(let i=0;i<n;i++)stepWorld(w,new Map([[1,{...emptyInput(),...input}]]));}
function tile(w:World,x:number,y:number,c:string){const r=w.map.tiles[y].split('');r[x]=c;w.map.tiles[y]=r.join('');}
test('基本装備は左ハンマー・右フックで、追加能力と復活を切り替えられる',()=>{
 const {w,r}=setup();assert.equal(r.ability,'basic');tick(w,1,{fire:true,wire:true});assert.equal(r.hammerTick,w.tick);assert.notEqual(r.wireState,0);
 tile(w,6,16,'N');tick(w);assert.equal(r.ability,'bun');tick(w,1,{kill:true});assert.equal(r.ability,'basic');
});
test('中華まんだけが小中華と大中華を生成できる',()=>{
 const {w,r}=setup();r.ability='bun';tick(w,1,{miniSpit:true});assert.equal(w.words.filter(b=>b.kind==='mini').length,1);
 tick(w);r.x=400;tick(w,1,{spit:true});tick(w,30);assert.equal(w.words.filter(b=>b.kind!=='mini').length,1);
 r.ability='hammer';tick(w,20,{miniSpit:true});assert.equal(w.words.filter(b=>b.kind==='mini').length,1);
});
test('自転車は一段ジャンプで、歩行者が通れる幅の通路に入れない',()=>{
 const {w,r}=setup();r.ability='bicycle';r.y=17*32-40;tick(w,1,{jump:true});assert.ok(r.vy<0);tick(w);const vy=r.vy;tick(w,1,{jump:true});assert.ok(r.vy>vy,'空中で再ジャンプしない');
 for(let y=1;y<17;y++){tile(w,10,y,'X');tile(w,12,y,'X');}assert.ok(bicycleBlocked(w,11*32+16,300));
 r.ability='hand';r.x=11*32+16;r.y=300;r.vx=0;tick(w,10);assert.equal(r.x,11*32+16);
});
test('自転車の車輪はしびれ床とトゲの上を走れるが、乗員に触れると反応する',()=>{
 for(const hazard of ['~','^']){const {w,r}=setup();for(let x=2;x<30;x++)tile(w,x,16,hazard);r.ability='bicycle';r.y=16*32-40;tick(w,25,{right:true});assert.equal(r.stun,0);assert.equal(r.ability,'bicycle');assert.ok(Math.abs(r.y-(16*32-40))<1);
   r.y=16*32+16;tick(w);if(hazard==='~')assert.ok(r.stun>0);else assert.equal(r.ability,'basic');}
});
test('マジックハンドで赤いボールを持ち運んで離せる。壁越しにはつかめない',()=>{
 const {w,r}=setup();r.ability='hand';w.balls.push({id:1,x:r.x+40,y:r.y,vx:0,vy:0,homeX:240,homeY:r.y});tick(w,1,{fire:true});assert.deepEqual(r.held,{kind:'ball',id:1});tick(w,10,{right:true});assert.ok(Math.abs(w.balls[0].x-r.x-70)<1);
 tick(w,1,{fire:true});assert.equal(r.held,null);tick(w);r.x=200;r.y=400;w.balls[0].x=250;w.balls[0].y=400;tile(w,7,12,'X');tick(w,1,{fire:true});assert.equal(r.held,null);
});
test('赤いボールを自転車でシュートでき、別のプレイヤーのフックでつかめる',()=>{
 const {w,r}=setup();r.ability='bicycle';r.y=17*32-40;w.balls.push({id:0,x:r.x+38,y:r.y+24,vx:0,vy:0,homeX:240,homeY:r.y});tick(w,1,{fire:true,aimX:500});assert.ok(w.balls[0].vx>5);
 r.ability='hook';r.x=180;r.y=400;w.balls[0].x=270;w.balls[0].y=400;w.balls[0].vx=w.balls[0].vy=0;tick(w);tick(w,1,{fire:true});assert.equal(r.wireBall,0);assert.equal(r.wireState,2);
});
test('乗員のボディをフックでつかめる',()=>{
 const {w,r}=setup();r.ability='hook';r.x=180;r.y=400;const b=newRunner(2,w.map);b.ability='bicycle';b.x=260;b.y=400;w.runners.push(b);tick(w,1,{fire:true});assert.equal(r.wireRunner,2);
});
test('能力アイテムと赤いボールをエディタ形式で往復でき、顔は固定サイズの描画データのみ許可する',()=>{
 const {w}=setup();['G','H','M','V','N','o'].forEach((c,i)=>tile(w,10+i,15,c));const copy=validateCourseMap(JSON.parse(JSON.stringify(w.map)));assert.equal(copy.minPlayers,1);assert.ok(copy.tiles[15].includes('GHMVNo'));assert.equal(createWorld(copy).balls.length,1);
 assert.ok(validFace(defaultFace()));assert.equal(validFace('<script>'),false);assert.equal(validFace('1'.repeat(100000)),false);
});


test('メインとサブは能力ごとに独立し、じゃんけんは保持物を離さない',()=>{
 const {w,r}=setup();r.ability='hand';w.balls.push({id:0,x:240,y:r.y,vx:0,vy:0,homeX:240,homeY:r.y});tick(w,1,{fire:true});tick(w,1,{wire:true});assert.ok(r.held);assert.ok(r.gesture>=0&&r.gesture<=2);const stamp=r.gestureTick;tick(w,4,{wire:true});assert.equal(r.gestureTick,stamp);
 r.ability='hook';r.held=null;tick(w,1,{wire:true});assert.equal(r.wireState,0);tick(w,1,{fire:true});assert.notEqual(r.wireState,0);
});
test('ハンマーのサブは地上で固定、空中で真下に落下し、離すと動ける',()=>{
 const {w,r}=setup();r.ability='hammer';tick(w,20);const x=r.x,y=r.y;r.vx=10;tick(w,10,{wire:true,right:true,jump:true,fire:true});assert.equal(r.x,x);assert.equal(r.y,y-17);assert.equal(r.hammerTick,-100);
 r.y-=100;r.vy=-10;const airY=r.y;tick(w,8,{wire:true,right:true,jump:true});assert.equal(r.x,x);assert.ok(r.y>airY);tick(w,8,{right:true});assert.ok(r.x>x);
});
test('自転車の右クリックは自分が発射したボールだけを爆破し周囲を飛ばす',()=>{
 const {w,r}=setup();r.ability='bicycle';r.x=500;r.y=300;
 for(const [id,owner] of [[0,1],[1,2]])w.balls.push({id,owner,x:600,y:300,vx:0,vy:0,homeX:600,homeY:300});
 const other=newRunner(2,w.map);other.x=650;other.y=300;w.runners.push(other);
 tick(w,1,{wire:true});assert.equal(w.blasts.length,1);assert.ok(other.vx>0);assert.ok(r.vx<0);assert.ok(w.balls[0].respawnAt!>w.tick);assert.equal(w.balls[1].respawnAt,undefined);
 tick(w,2,{wire:true});assert.equal(w.blasts.length,1);
});
test('中華まんは左で大中華、右で従来の小中華を出す',()=>{
 const {w,r}=setup();r.ability='bun';tick(w,1,{wire:true});assert.equal(w.words.filter(b=>b.kind==='mini').length,1);tick(w,15,{wire:true});assert.equal(w.words.length,1);tick(w);r.x=400;tick(w,40,{fire:true});assert.equal(w.words.filter(b=>b.kind!=='mini').length,1);
});

test('回収済みのボールは別の自転車やフックが取得せず、能力を失うと元の位置に戻る',()=>{
 const {w,r}=setup();r.ability='bicycle';r.y=300;w.balls.push({id:0,x:240,y:300,vx:0,vy:0,homeX:240,homeY:300});tick(w);assert.equal(ballCount(w,1),1);
 const o=newRunner(2,w.map);o.ability='bicycle';o.x=300;o.y=300;w.runners.push(o);stepWorld(w,new Map([[2,{...emptyInput(),wire:true}]]));assert.equal(ballCount(w,2),0);
 o.ability='hook';o.x=300;o.y=r.y;stepWorld(w,new Map([[2,{...emptyInput(),fire:true,aimX:-1}]]));assert.equal(o.wireBall,-1);
 r.ability='hand';tick(w);assert.equal(ballCount(w,1),0);assert.equal(w.balls[0].carriedBy,undefined);
});
test('ハンマーの長押しは30tickごとで、連打でも間隔を短縮しない',()=>{
 const {w,r}=setup();r.ability='hammer';const hits:number[]=[];
 for(let i=0;i<95;i++){tick(w,1,{fire:true});if(r.hammerTick===w.tick)hits.push(w.tick);}
 assert.deepEqual(hits,[1,31,61,91]);tick(w,1,{fire:false});tick(w,1,{fire:true});assert.equal(r.hammerTick,91);
 tick(w,40);assert.equal(r.hammerTick,91);
});
test('大小中華を長押しすると30tickごとに繰り返し、大中華は1個を置き換える',()=>{
 const {w,r}=setup();r.ability='bun';const starts:number[]=[],born:number[]=[];let last=0;
 for(let i=0;i<95;i++){
  tick(w,1,{fire:true});if(r.spit.started===w.tick)starts.push(w.tick);
  const b=w.words.find(b=>b.kind!=='mini');if(b&&b.id!==last){last=b.id;born.push(b.born);}assert.ok(w.words.filter(b=>b.kind!=='mini').length<=1);
 }
 assert.deepEqual(starts,[18,48,78]);assert.deepEqual(born,[36,66]);
 const mini=setup();mini.r.ability='bun';const times:number[]=[];let seq=0;
 for(let i=0;i<95;i++){tick(mini.w,1,{wire:true});if(mini.w.wordSeq>seq){times.push(mini.w.tick);seq=mini.w.wordSeq;}}
 assert.deepEqual(times,[1,31,61,91]);
});
test('フックのサブで長さを固定して揺れ、メインを離してもサブの間は保持する',()=>{
 const {w,r}=setup();r.ability='hook';r.x=300;r.y=350;r.wireState=2;r.wireX=300;r.wireY=200;r.prevWire=true;
 tick(w,1,{fire:true,wire:true});const length=r.hookLengthLock;assert.ok(length>0);
 tick(w,15,{wire:true,right:true});assert.equal(r.wireState,2);assert.ok(r.x>300);assert.ok(Math.abs(Math.hypot(r.x-r.wireX,r.y-r.wireY)-length)<.01);
 tick(w);assert.equal(r.wireState,0);assert.equal(r.hookLengthLock,-1);
});
test('サブを離すとフックの引き寄せが戻り、復活や能力交換で固定を解除する',()=>{
 const {w,r}=setup();r.ability='hook';r.x=300;r.y=350;r.wireState=2;r.wireX=300;r.wireY=200;r.prevWire=true;
 tick(w,5,{fire:true,wire:true});const distance=Math.hypot(r.x-r.wireX,r.y-r.wireY);tick(w,10,{fire:true});assert.equal(r.hookLengthLock,-1);assert.ok(Math.hypot(r.x-r.wireX,r.y-r.wireY)<distance);
 tick(w,1,{fire:true,wire:true});assert.ok(r.hookLengthLock>=0);tick(w,1,{kill:true});assert.equal(r.hookLengthLock,-1);
});

test('マウスの距離で飛距離が増え、点線の予測と実際の放物線が一致する',()=>{
 const {w,r}=setup();r.ability='bicycle';r.x=200;r.y=300;r.aimX=1;r.aimY=0;
 const close=shotLaunch(r,120,0),far=shotLaunch(r,600,0);assert.ok(far.vx>close.vx);assert.ok(far.vy<0);
 r.aimDistance=600;const points=shotPreview(w,r,wordCollision(w));const shot=shotLaunch(r);
 w.balls.push({id:0,...shot,homeX:shot.x,homeY:shot.y});
 for(let i=1;i<Math.min(15,points.length-1);i++){tick(w);assert.ok(Math.abs(w.balls[0].x-points[i].x)<.001);assert.ok(Math.abs(w.balls[0].y-points[i].y)<.001);}
 const b={...far};for(let i=0;i<Math.round(far.frames);i++)ballStep(b);assert.ok(Math.abs(b.x-(r.x+600))<far.vx+1);
});
test('車体と下向きハンマーは金属。胴体にはフックが掛かる',()=>{
 for(const ability of ['bicycle','hammer'] as const){
  const {w,r}=setup();r.ability='hook';r.x=180;r.y=300;const o=newRunner(2,w.map);o.ability=ability;o.x=260;o.y=300;o.hammerBrace=ability==='hammer';w.runners.push(o);
  const otherInput={...emptyInput(),wire:ability==='hammer'};
  stepWorld(w,new Map([[1,{...emptyInput(),fire:true}],[2,otherInput]]));assert.equal(r.wireRunner,2);
  r.wireState=0;r.prevWire=false;r.x=180;r.y=o.y+(ability==='hammer'?26:25);
  stepWorld(w,new Map([[1,{...emptyInput(),fire:true}],[2,otherInput]]));assert.equal(r.wireState,0);assert.equal(r.wireRunner,-1);
  assert.ok(metalPart(o));
 }
});
test('ハンマーに乗ると足が地面から浮き、車体とハンマーは歩行を遮る',()=>{
 for(const ability of ['bicycle','hammer'] as const){
  const {w,r}=setup();r.ability=ability;r.x=300;if(ability==='bicycle')r.y=17*32-40;
  tick(w,1,{wire:ability==='hammer'});const part=metalPart(r)!;assert.ok(part);assert.ok(r.y+14<17*32);assert.ok(Math.abs(part.y+part.h-17*32)<1);
  const o=newRunner(2,w.map);o.x=240;o.y=17*32-14;w.runners.push(o);
  for(let i=0;i<30;i++)stepWorld(w,new Map([[1,{...emptyInput(),wire:ability==='hammer'}],[2,{...emptyInput(),right:true}]]));
  assert.ok(o.x+14<=metalPart(r)!.x+.1);
 }
});

test('幽霊は長押しで本体を残して飛行し、離して再長押しすると帰還する',()=>{
 const {w,r}=setup();r.ability='ghost';tick(w,30,{fire:true});assert.ok(r.ghostBody);const body={...r.ghostBody!};
 tick(w,20,{fire:true,up:true,right:true});assert.deepEqual(r.ghostBody,body);assert.ok(r.x>body.x&&r.y<body.y);assert.equal(r.hammerTick,-100);
 tick(w);tick(w,30,{fire:true});assert.equal(r.ghostBody,null);assert.ok(Math.abs(r.x-body.x)<1);assert.ok(Math.abs(r.y-body.y)<2);
 tick(w);tick(w,1,{fire:true});tick(w);assert.equal(r.hammerTick,w.tick);
});
test('中華の単押しは生成せず操舵し、長押しで生成する',()=>{
 const {w,r}=setup();r.ability='bun';tick(w,40,{fire:true});const b=w.words.find(b=>b.kind!=='mini')!;assert.ok(b);const id=b.id;
 tick(w);tick(w,1,{fire:true,aimX:0,aimY:-1});tick(w,1,{aimX:0,aimY:-1});assert.equal(b.id,id);assert.equal(b.vx,0);assert.equal(b.vy,-2.4);
});
