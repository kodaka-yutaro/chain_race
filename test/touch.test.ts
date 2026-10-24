import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindPress, releasePresses } from '../client/press';
import { setTouchAim, touch } from '../client/touch';

class Button extends EventTarget {
  disabled=false;
  classList={add:(_s:string)=>{},remove:(_s:string)=>{}};
  setPointerCapture(_id:number){}
  element(){return this as unknown as HTMLElement;}
  pointer(type:string,pointerId:number){
    const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId,button:0,pointerType:'touch'});this.dispatchEvent(e);
  }
  click(detail:number){const e=new Event('click',{cancelable:true});Object.assign(e,{detail});this.dispatchEvent(e);}
}

test('鎖を握りながら別の指で攻撃・ジャンプ・ミニを押せて、離した指の操作だけが終わる',()=>{
  const owner={};setTouchAim(owner,{x:0,y:-1,stick:true,hook:true});
  const attack=new Button(),jump=new Button(),mini=new Button();let fire=false,jumping=false,spits=0;
  const clean=[bindPress(attack.element(),()=>fire=true,()=>fire=false),bindPress(jump.element(),()=>jumping=true,()=>jumping=false),bindPress(mini.element(),()=>spits++)];
  attack.pointer('pointerdown',2);jump.pointer('pointerdown',3);mini.pointer('pointerdown',4);
  assert.ok(touch.hook&&fire&&jumping);assert.equal(spits,1);
  mini.pointer('pointerup',4);mini.click(1);assert.equal(spits,1);assert.ok(touch.hook&&fire&&jumping);
  attack.pointer('pointercancel',2);assert.equal(fire,false);assert.ok(touch.hook&&jumping);
  jump.pointer('pointerup',3);assert.equal(jumping,false);assert.ok(touch.hook);
  setTouchAim(owner);clean.forEach(f=>f());
});

test('同じボタンの2本指・指のキャンセル・画面離脱を処理し、ボタンを外した後に反応を残さない',()=>{
  const b=new Button();let held=false,presses=0;
  const clean=bindPress(b.element(),()=>{held=true;presses++;},()=>held=false);
  b.pointer('pointerdown',1);b.pointer('pointerdown',2);assert.equal(presses,1);
  b.pointer('lostpointercapture',1);assert.ok(held);b.pointer('pointerup',2);assert.equal(held,false);
  b.disabled=true;b.pointer('pointerdown',3);assert.equal(presses,1);b.disabled=false;
  b.click(0);assert.equal(presses,2);assert.equal(held,false);
  b.pointer('pointerdown',4);releasePresses();assert.equal(held,false);
  clean();b.pointer('pointerdown',5);assert.equal(presses,3);
});

test('画面と右スティックのどちらかを離しても、もう片方の鎖と照準は残る',()=>{
  const stick={},canvas={};touch.hookTap=false;
  setTouchAim(stick,{x:1,y:0,stick:true,hook:true});assert.ok(touch.hook&&touch.hookTap);
  setTouchAim(canvas,{x:120,y:40,stick:false,hook:true});assert.equal(touch.aimMode,false);
  setTouchAim(canvas);assert.ok(touch.hook&&touch.aimMode);assert.equal(touch.aimX,1);
  setTouchAim(stick);assert.equal(touch.hook,false);assert.equal(touch.aimX,1,'次のミニや攻撃にも狙った向きが残る');
});
