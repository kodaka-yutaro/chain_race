import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPosition,correctionDecay} from '../client/motion';
test('50 Hz simulation renders evenly at 60, 120 and 144 Hz without mutating physics',()=>{
 for(const hz of [60,120,144]){let previous={x:0,y:0},current={x:10,y:5},acc=0,last={x:0,y:0};
 for(let i=0;i<hz;i++){acc+=1000/hz;while(acc>=20){acc-=20;previous=current;current={x:current.x+10,y:current.y+5};}
 const p=renderPosition(previous,current,acc/20);assert.ok(Math.abs(p.x-last.x-500/hz)<1e-8);assert.ok(Math.abs(p.y-last.y-250/hz)<1e-8);last=p;
 }assert.ok(Math.abs(current.x%10)<1e-8);}
});
test('teleport and respawn distances are not animated across the level',()=>{
 assert.deepEqual(renderPosition({x:0,y:0},{x:500,y:300},.5),{x:500,y:300});
 assert.deepEqual(renderPosition({x:10,y:20},{x:10,y:20},.5),{x:10,y:20});
});
test('corrections settle at the same rate regardless of display refresh',()=>{
 const target=Math.pow(.85,60);for(const hz of [60,120,144]){let error=1;for(let i=0;i<hz;i++)error*=correctionDecay(1000/hz);assert.ok(Math.abs(error-target)<1e-10);}
 assert.equal(correctionDecay(0),1);
});
