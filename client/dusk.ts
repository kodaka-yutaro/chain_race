/** Original procedural artwork; no DDNet art assets. */
export function drawDusk(g:CanvasRenderingContext2D,w:number,h:number,cam=0){
 const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#17243d');sky.addColorStop(.6,'#957c8c');sky.addColorStop(1,'#e9ad87');g.fillStyle=sky;g.fillRect(0,0,w,h);
 g.fillStyle='#ffd9a3';g.beginPath();g.arc(w*.75,h*.38,Math.min(w,h)*.06,0,Math.PI*2);g.fill();
 for(let layer=0;layer<3;layer++){g.fillStyle=['#656785','#414d68','#263c50'][layer];g.beginPath();g.moveTo(0,h);for(let x=-30;x<=w+30;x+=20){const px=x+cam*(.03+layer*.025);const y=h*(.62+layer*.12)+Math.sin(px*.006+layer*2)*h*.07+Math.sin(px*.014+layer)*h*.025;g.lineTo(x,y);}g.lineTo(w,h);g.closePath();g.fill();}
 g.fillStyle='#172c39';for(let i=0;i<14;i++){const x=((i*193-cam*.13)%(w+100)+w+100)%(w+100)-50,y=h*.9;g.fillRect(x-2,y-45,4,80);g.beginPath();g.moveTo(x,y-95);g.lineTo(x-22,y-20);g.lineTo(x+22,y-20);g.closePath();g.fill();}
}
