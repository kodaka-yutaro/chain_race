import {test} from 'node:test';
import assert from 'node:assert/strict';
import {heldInput} from '../shared/held-input';
import {emptyInput} from '../shared/physics';
test('保持するのは継続操作だけで、自殺・単発技・武器変更は再実行しない',()=>{
 const input={...emptyInput(),left:true,jump:true,wire:true,fire:true,aimX:75,aimY:-90,kill:true,spit:true,miniSpit:true,clearWord:true,weapon:3};
 const saved=heldInput(input);assert.equal(input.kill,true);assert.deepEqual(saved,{...input,kill:false,spit:false,miniSpit:false,clearWord:false,weapon:undefined});
});
