import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ViewCamera,zoomKey} from '../client/camera';
test('free camera moves independently, stays inside the map, and resumes following',()=>{
 const c=new ViewCamera(),player={x:400,y:300};
 assert.deepEqual(c.view(player,3200,1440,800,600),{x:0,y:0});
 c.toggle(400,300);c.pan(1200,600);
 assert.deepEqual(c.view(player,3200,1440,800,600),{x:1200,y:600});
 assert.deepEqual(player,{x:400,y:300});
 c.pan(100000,-100000);assert.deepEqual(c.view(player,3200,1440,800,600),{x:2400,y:0});
 c.follow();assert.deepEqual(c.view(player,3200,1440,800,600),{x:0,y:0});
});
test('zoom is bounded and small maps stay centered at any camera position',()=>{
 const c=new ViewCamera();c.zoom(100);assert.equal(c.scale,3);c.zoom(.0001);assert.equal(c.scale,.25);
 c.toggle(100,100);assert.deepEqual(c.view({x:0,y:0},320,160,800,600),{x:-240,y:-220});
 c.reset();assert.equal(c.scale,1);assert.equal(c.free,false);
});

test('zoom keys support Japanese plus and both numpad keys',()=>{
 assert.equal(zoomKey('+','Semicolon'),1.15);assert.equal(zoomKey(';','Semicolon'),0);
 assert.equal(zoomKey('+','NumpadAdd'),1.15);assert.equal(zoomKey('-','Minus'),1/1.15);
 assert.equal(zoomKey('-','NumpadSubtract'),1/1.15);
});
