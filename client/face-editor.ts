import { defaultFace, FACE_COLORS, FACE_SIZE, validFace } from '../shared/face';
const KEY='chainrace.face.v1';
export function savedFace(){try{const s=localStorage.getItem(KEY);return validFace(s)?s:defaultFace();}catch{return defaultFace();}}
const images=new Map<string,HTMLCanvasElement>();
export function drawFace(g:CanvasRenderingContext2D,face:string,x:number,y:number,size:number){
  const value=validFace(face)?face:defaultFace();let c=images.get(value);
  if(!c){c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d')!;
    for(let i=0;i<value.length;i++){const n=parseInt(value[i],16);if(n){ctx.fillStyle=FACE_COLORS[n];ctx.fillRect(i%24,Math.floor(i/24),1,1);}}
    if(images.size>64)images.delete(images.keys().next().value!);images.set(value,c);
  }g.save();g.imageSmoothingEnabled=false;g.drawImage(c,x-size/2,y-size/2,size,size);g.restore();
}
export function openFaceEditor(){
  let pixels=savedFace().split(''),color='1',undo:string[]=[],drawing=false;
  const d=document.createElement('dialog');d.className='face-editor';
  d.innerHTML='<h2>わたしのキャラクター</h2><p>顔と髪を描こう。目はゲーム中に自動で付き、マウスの方向を見ます。</p><div class="face-work"><canvas width="288" height="288" aria-label="顔を描くキャンバス"></canvas><canvas data-preview width="144" height="144" aria-label="目付きプレビュー"></canvas></div><div class="face-palette"></div><div class="buttons"><button data-undo>元に戻す</button><button data-default>お団子の少女に戻す</button><button data-clear>消す</button><button data-export>保存ファイル</button><label>ファイルを開く<input data-import type="file" accept="application/json"></label></div><p data-status></p><div class="buttons"><button data-save class="primary">この顔を使う</button><button data-close>キャンセル</button></div>';
  document.body.append(d);const canvas=d.querySelector('canvas')!,g=canvas.getContext('2d')!,preview=d.querySelector<HTMLCanvasElement>('[data-preview]')!,pg=preview.getContext('2d')!;
  const draw=()=>{g.clearRect(0,0,288,288);for(let i=0;i<576;i++){g.fillStyle=(i+Math.floor(i/24))%2?'#303746':'#252b37';g.fillRect(i%24*12,Math.floor(i/24)*12,12,12);if(pixels[i]!=='0'){g.fillStyle=FACE_COLORS[parseInt(pixels[i],16)];g.fillRect(i%24*12,Math.floor(i/24)*12,12,12);}}
    pg.clearRect(0,0,144,144);drawFace(pg,pixels.join(''),72,72,120);for(const dx of [-18,18]){pg.fillStyle='white';pg.beginPath();pg.ellipse(72+dx,76,12,15,0,0,Math.PI*2);pg.fill();pg.fillStyle='#171923';pg.beginPath();pg.ellipse(75+dx,77,6,10,0,0,Math.PI*2);pg.fill();}};
  FACE_COLORS.forEach((c,i)=>{const b=document.createElement('button');b.style.background=i?c:'#444';b.textContent=i?'':'消';b.setAttribute('aria-label',i?`色 ${c}`:'消しゴム');b.setAttribute('aria-pressed',String(i===1));b.onclick=()=>{color=i.toString(16);d.querySelectorAll('.face-palette button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};d.querySelector('.face-palette')!.append(b);});
  const paint=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*FACE_SIZE),y=Math.floor((e.clientY-r.top)/r.height*FACE_SIZE);if(x>=0&&x<24&&y>=0&&y<24){pixels[y*24+x]=color;draw();}};
  canvas.onpointerdown=e=>{undo.push(pixels.join(''));if(undo.length>40)undo.shift();drawing=true;canvas.setPointerCapture(e.pointerId);paint(e);};canvas.onpointermove=e=>{if(drawing)paint(e);};canvas.onpointerup=canvas.onpointercancel=()=>drawing=false;
  const on=(s:string,fn:()=>void)=>d.querySelector<HTMLButtonElement>(s)!.onclick=fn;
  on('[data-undo]',()=>{const s=undo.pop();if(s){pixels=s.split('');draw();}});
  on('[data-default]',()=>{undo.push(pixels.join(''));pixels=defaultFace().split('');draw();});on('[data-clear]',()=>{undo.push(pixels.join(''));pixels=Array(576).fill('0');draw();});
  on('[data-save]',()=>{try{localStorage.setItem(KEY,pixels.join(''));d.close();}catch{d.querySelector('[data-status]')!.textContent='保存できません。保存ファイルで持ち出してください。';}});on('[data-close]',()=>d.close());
  on('[data-export]',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({face:pixels.join('')})],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='chinatown-face.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  d.querySelector<HTMLInputElement>('[data-import]')!.onchange=async e=>{try{const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;if(f.size>4096)throw Error();const data=JSON.parse(await f.text());if(!validFace(data.face))throw Error();undo.push(pixels.join(''));pixels=data.face.split('');draw();}catch{d.querySelector('[data-status]')!.textContent='顔ファイルを読み込めません';}};
  d.addEventListener('close',()=>d.remove());draw();d.showModal();
}
