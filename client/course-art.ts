// ChainRace's simple area visuals. No upstream game artwork is used here.
export function areaKind(id:string):'freeze'|'thaw'|'mesh'|'entrance'|'exit'|'stop'|undefined {
  if(/^dd:(game|front):60:/.test(id))return 'stop';
  if(id==='~'||id==='dd:game:9:0'||id==='dd:front:9:0')return 'freeze';
  if(id==='U'||id==='dd:game:11:0'||id==='dd:front:11:0')return 'thaw';
  if(id==='O'||id==='dd:front:66:0')return 'mesh';
  if(id==='dd:tele:26:0')return 'entrance';
  if(id==='dd:tele:27:0')return 'exit';
}

export function drawCourseArea(g:CanvasRenderingContext2D,id:string,x:number,y:number,size:number,badge?:string):boolean {
  const kind=areaKind(id);if(!kind)return false;
  g.save();g.translate(x,y);g.scale(size/32,size/32);
  if(kind==='stop'){
    const flags=Number(id.split(':')[3])&11;
    const angle=({0:Math.PI/2,1:Math.PI/2,8:Math.PI,9:Math.PI,3:-Math.PI/2,2:-Math.PI/2,11:0,10:0} as Record<number,number>)[flags]??0;
    g.translate(16,16);g.rotate(angle);g.strokeStyle='rgba(210,235,245,.75)';g.lineWidth=2;g.lineCap='round';g.lineJoin='round';g.beginPath();
    for(const dx of [-7,7]){g.moveTo(dx+3,-8);g.lineTo(dx-3,0);g.lineTo(dx+3,8);}g.stroke();
  }else if(kind==='freeze'||kind==='thaw'){

    g.fillStyle=kind==='freeze'?'rgba(155,216,255,0.32)':'rgba(255,235,146,0.30)';g.fillRect(0,0,32,32);
  }else if(kind==='entrance'){g.fillStyle='#000';g.fillRect(0,0,32,32);}
  else if(kind==='mesh'){
    g.beginPath();g.rect(0,0,32,32);g.clip();g.fillStyle='rgba(144,91,48,.12)';g.fillRect(0,0,32,32);
    g.strokeStyle='#986239';g.lineWidth=1.5;g.beginPath();
    // Integer period dividing 32 keeps the lattice continuous across adjacent tiles.
    for(let d=-32;d<=64;d+=8){g.moveTo(d,0);g.lineTo(d+32,32);g.moveTo(d,0);g.lineTo(d-32,32);}g.stroke();
  }else{
    g.strokeStyle='rgba(0,0,0,.28)';g.lineWidth=2;g.lineCap='round';g.beginPath();
    for(let i=0;i<=100;i++){const t=i/100*Math.PI*5,r=1+i/100*12,px=16+Math.cos(t)*r,py=16+Math.sin(t)*r;i?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();
  }
  // Connection numbers are an editor aid, kept out of the plain gameplay zones.
  if(badge){g.fillStyle='rgba(15,25,40,.65)';g.fillRect(21,0,11,10);g.fillStyle='#fff';g.font='bold 8px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(badge,26.5,5,10);}
  g.restore();return true;
}

const sprites=new Map<string,HTMLImageElement>();
let ballCrop:[number,number,number,number]|undefined;
export const courseArtReady=Promise.all([['N','bun'],['V','bicycle'],['P','spirit'],['o','cloth-ball']].map(([id,file])=>new Promise<void>(resolve=>{
  if(typeof Image==='undefined'){resolve();return;}
  const img=new Image();img.onload=()=>{
    if(id==='o'){
      // Ignore transparent padding and isolated edge specks so the ball fills
      // its physics diameter. The source PNG remains unchanged.
      const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
      const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);const rgba=ctx.getImageData(0,0,c.width,c.height).data;
      const rows=new Uint32Array(c.height),cols=new Uint32Array(c.width);
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(rgba[(y*c.width+x)*4+3]>128){rows[y]++;cols[x]++;}
      const left=cols.findIndex(n=>n>c.height*.02),top=rows.findIndex(n=>n>c.width*.02);
      let right=c.width-1,bottom=c.height-1;
      while(right>=left&&cols[right]<=c.height*.02)right--;
      while(bottom>=top&&rows[bottom]<=c.width*.02)bottom--;
      if(left>=0&&top>=0)ballCrop=[left,top,right-left+1,bottom-top+1];
    }
    sprites.set(id,img);resolve();
  };img.onerror=()=>resolve();img.src=`${import.meta.env.BASE_URL}art/original/${file}.png`;
})));
export function drawPickupArt(g:CanvasRenderingContext2D,id:string,x:number,y:number,size:number):boolean {
  if(['G','H','M'].includes(id)){g.save();g.fillStyle='#b5efd0';g.fillRect(x+size*.4,y+size*.12,size*.2,size*.76);g.fillRect(x+size*.12,y+size*.4,size*.76,size*.2);g.restore();return true;}
  const img=sprites.get(id);if(!img)return false;
  g.save();g.imageSmoothingEnabled=true;g.drawImage(img,x,y,size,size);g.restore();return true;
}

export function drawClothBall(g:CanvasRenderingContext2D,x:number,y:number,radius:number){
  g.save();g.beginPath();g.arc(x,y,radius,0,Math.PI*2);g.clip();
  const img=sprites.get('o');
  if(img&&ballCrop){g.imageSmoothingEnabled=true;g.drawImage(img,...ballCrop,x-radius,y-radius,radius*2,radius*2);}
  else { // Immediate red/white fallback while the sprite is loading.
    g.fillStyle='#e33b40';g.fillRect(x-radius,y-radius,radius*2,radius*2);
    g.fillStyle='#fff1d8';g.beginPath();g.moveTo(x,y-radius*.8);g.lineTo(x-radius*.7,y+radius*.3);g.lineTo(x+radius*.6,y+radius*.3);g.closePath();g.fill();
  }
  g.restore();
}
