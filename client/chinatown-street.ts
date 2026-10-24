/** Hand-drawn pixel Chinatown. Decorative only, with no gameplay collision. */
const W=1920,H=360,SKY=960;
let street:HTMLCanvasElement|null=null,skyline:HTMLCanvasElement|null=null;
type G=CanvasRenderingContext2D;
const ink='#282235',skin='#efbc8b',pale='#ffe0ac';
const rand=(n:number)=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
const wrap=(n:number,w:number)=>((n%w)+w)%w;
const r=(g:G,x:number,y:number,w:number,h:number,c:string)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));};
function oval(g:G,x:number,y:number,w:number,h:number,c:string){
  for(let yy=0;yy<h;yy++){const a=Math.sqrt(Math.max(0,1-Math.pow((yy+.5-h/2)/(h/2),2)))*w/2;r(g,x+w/2-a,y+yy,a*2,1,c);}
}
function line(g:G,x:number,y:number,xx:number,yy:number,c:string,t=2){
  const n=Math.max(Math.abs(xx-x),Math.abs(yy-y));for(let i=0;i<=n;i++)r(g,x+(xx-x)*i/(n||1),y+(yy-y)*i/(n||1),t,t,c);
}
function text(g:G,s:string,x:number,y:number,size=10,c='#ffe6a1'){g.font=`bold ${size}px "Yu Mincho",serif`;g.textAlign='center';g.fillStyle=c;g.fillText(s,Math.round(x),Math.round(y));}
function roof(g:G,x:number,y:number,w:number,c='#286d6a',gold=false){
  r(g,x+6,y-4,w-12,7,'#34283c');for(let k=0;k<10;k++)r(g,x+k*3,y-k*2,w-k*6,3,c);
  r(g,x-7,y-8,8,5,c);r(g,x+w-1,y-8,8,5,c);line(g,x-7,y-8,x+3,y,gold?'#ffd477':'#66a28b');line(g,x+w+6,y-8,x+w-4,y,gold?'#ffd477':'#66a28b');
  r(g,x-3,y,w+6,3,gold?'#ffc56c':'#df9c62');for(let k=12;k<w-10;k+=9)r(g,x+k,y-9,2,7,'#193f51');r(g,x+5,y+4,w-10,4,'#8f4147');
}
function lantern(g:G,x:number,y:number,s=1,c='#e65d48'){
  g.save();g.translate(Math.round(x),Math.round(y));g.scale(s,s);r(g,-1,-12,1,12,'#d29a65');r(g,-5,0,10,2,'#ffdb86');oval(g,-9,2,18,18,'#8f343c');oval(g,-7,2,14,17,c);r(g,-3,3,3,14,'#ffab66');r(g,3,4,1,12,'#a94245');r(g,-4,20,8,2,'#ffd58b');r(g,0,22,1,8,'#e7aa5e');r(g,-2,29,5,3,'#e7614e');g.restore();
}
function sign(g:G,x:number,y:number,w:number,s:string,c='#9b3f49'){r(g,x-2,y-2,w+4,23,'#302736');r(g,x,y,w,19,'#f1b66c');r(g,x+2,y+2,w-4,15,c);text(g,s,x+w/2,y+14,11);}
function building(g:G,x:number,y:number,w:number,floors:number,label:string,wall='#98534e',tile='#296f6b'){
  const h=floors*36;r(g,x,y,w,h,wall);r(g,x+5,y,w-10,h,'#653945');
  for(let j=0;j<floors;j++){
    const yy=y+j*36;r(g,x+4,yy+5,w-8,3,'#d18a60');for(let k=10;k<w-14;k+=22){r(g,x+k,yy+12,15,17,'#3d3041');r(g,x+k+2,yy+13,11,15,'#e6aa67');r(g,x+k+7,yy+12,2,17,wall);r(g,x+k,yy+20,15,2,wall);}
    r(g,x,yy+33,w,3,'#312d3d');if(j<floors-1)roof(g,x-4,yy+36,w+8,tile);
  }
  roof(g,x-7,y,w+14,tile);r(g,x+3,y+6,4,h-5,'#cf8057');r(g,x+w-7,y+6,4,h-5,'#cf8057');r(g,x+8,y+h-37,w-16,37,'#302b3a');sign(g,x+8,y+h-51,w-16,label);lantern(g,x+5,y+h-30,.65);lantern(g,x+w-5,y+h-30,.65);
}
function dumpling(g:G,x:number,y:number,s=1){g.save();g.translate(x,y);g.scale(s,s);oval(g,-5,-4,10,7,'#b67547');oval(g,-5,-6,10,7,'#fff0ba');r(g,-2,-8,4,3,'#f0d69b');line(g,0,-6,-2,-2,'#d9ad73',1);line(g,1,-6,3,-2,'#d9ad73',1);g.restore();}
function steamer(g:G,x:number,y:number,w=30){oval(g,x,y,w,8,'#ffe0a0');r(g,x,y+4,w,8,'#b87e4e');r(g,x+1,y+6,w-2,2,'#e3b36d');r(g,x+3,y+10,w-6,2,'#80543d');for(let k=7;k<w-3;k+=10)dumpling(g,x+k,y+3,.7);}
function stall(g:G,x:number,y:number,w:number,label:string,c='#d65c47'){
  r(g,x+3,y+7,3,59,'#d8a06c');r(g,x+w-6,y+7,3,59,'#d8a06c');for(let k=0;k<w;k+=8){r(g,x+k,y,8,11,k%16?'#f4d48d':c);r(g,x+k,y+11,7,4,k%16?'#e1b76f':'#9e3c43');}
  r(g,x-3,y-3,w+6,4,'#62404a');r(g,x,y+49,w,4,'#e6b77b');r(g,x+1,y+53,w-2,17,'#8e4948');r(g,x+5,y+55,w-10,12,'#b96350');text(g,label,x+w/2,y+65,9);
}
function planter(g:G,x:number,y:number,c='#4f8e69'){
  r(g,x-7,y,14,12,'#b76c51');r(g,x-9,y,18,3,'#e2aa72');line(g,x,y,x-9,y-22,c,2);line(g,x,y,x+8,y-31,c,2);line(g,x,y,x,y-32,c,2);for(let k=0;k<6;k++)oval(g,x+(k%2?1:-1)*(4+k)-5,y-11-k*4,10,5,c);
}
function temple(g:G,x:number){
  r(g,x+16,201,218,73,'#a84747');r(g,x+24,207,202,62,'#d4865d');for(let k=0;k<5;k++){r(g,x+40+k*38,220,23,50,'#682f3e');r(g,x+43+k*38,225,17,44,'#f0bb6f');r(g,x+50+k*38,226,3,43,'#86423e');}
  roof(g,x+2,205,246,'#347c73',true);roof(g,x+45,177,160,'#3e8d79',true);roof(g,x+77,147,96,'#347c73',true);r(g,x+120,105,5,17,'#e7b768');oval(g,x+117,98,11,10,'#edc980');sign(g,x+89,188,73,'福 慶 寺');
  for(let k=0;k<3;k++)r(g,x+6-k*4,270+k*4,238+k*8,4,k%2?'#c8a385':'#e0bc96');
  for(const xx of[x+20,x+215]){r(g,xx-7,263,22,13,'#7c7f75');oval(g,xx-8,247,23,17,'#b5b39a');oval(g,xx-4,235,18,17,'#d2cbb0');r(g,xx+1,242,3,3,'#514b50');r(g,xx+10,242,3,3,'#514b50');r(g,xx-7,250,5,11,'#ddd3b7');}
  r(g,x+105,258,38,12,'#507a77');r(g,x+109,270,5,8,'#4c6364');r(g,x+134,270,5,8,'#4c6364');for(let k=0;k<5;k++)r(g,x+113+k*5,247-(k%2)*3,1,13,'#e7b177');for(const xx of[x+36,x+73,x+176,x+213])lantern(g,xx,211,.7);
}
function gate(g:G,x:number,label:string){r(g,x+14,175,9,100,'#bd5250');r(g,x+130,175,9,100,'#bd5250');r(g,x+17,177,2,93,'#ffcd7b');r(g,x+133,177,2,93,'#ffcd7b');roof(g,x,176,153,'#2d7875',true);roof(g,x+37,153,79,'#4d9a80',true);sign(g,x+47,168,60,label);r(g,x+7,273,23,9,'#aa8881');r(g,x+123,273,23,9,'#aa8881');}
function paintStreet(g:G){
  r(g,0,250,W,110,'#554350');for(let y=256;y<H;y+=9)for(let x=-20;x<W;x+=30){r(g,x+(y%2)*15,y,28,1,'#80616a');if(rand(x+y*3)>.8)r(g,x+4,y+3,12,1,'#a9776b');}
  building(g,-26,115,108,4,'萬福茶樓');building(g,93,150,114,3,'阿福小籠包','#ae6953','#398b76');building(g,223,138,106,3,'長樂麵館','#686e7b','#375975');building(g,343,164,83,3,'茶香居','#9b655a');building(g,505,133,102,4,'紅龍飯店','#97555e','#5a7392');gate(g,424,'中華街');
  stall(g,94,203,114,'湯気もごちそう');steamer(g,103,237,31);steamer(g,169,238,31);steamer(g,169,226,31);r(g,140,245,23,5,'#272536');r(g,145,249,13,9,'#3c3441');for(let k=0;k<4;k++)dumpling(g,143+k*6,244,.65);
  stall(g,223,215,101,'手打ち麵','#488f85');r(g,233,251,27,7,'#ede4bd');r(g,236,258,21,5,'#a7b6a8');for(let k=0;k<4;k++)line(g,234+k*6,251,241+k*4,247,'#ecbf6f',1);r(g,285,248,11,11,'#b36b4e');line(g,288,249,292,232,'#9ab87e');line(g,292,249,300,234,'#9ab87e');
  r(g,359,246,51,4,'#b16e55');r(g,364,250,4,21,'#6c4a48');r(g,401,250,4,21,'#6c4a48');oval(g,373,240,11,7,'#c79c6c');r(g,377,237,5,4,'#e9be82');r(g,387,243,5,4,'#eee0c1');
  for(let k=0;k<3;k++){line(g,531+k*20,215,531+k*20,225,'#c58e9a',1);oval(g,526+k*20,226,11,19,'#d48a50');r(g,530+k*20,223,5,6,'#e9a55e');}
  building(g,638,129,91,4,'玉蘭香鋪','#88607a','#526c8c');temple(g,763);building(g,1031,158,99,3,'錦繡布莊','#416f79','#7b627e');building(g,1146,136,110,4,'福滿樓','#aa6254');
  stall(g,672,218,72,'平安香','#9e79a4');r(g,683,250,42,8,'#c49b75');for(let k=0;k<9;k++)r(g,685+k*4,238,2,14,k%2?'#dca55d':'#b9575d');r(g,1051,240,65,4,'#d8ac78');for(let k=0;k<4;k++)r(g,1053+k*15,244,12,18,['#df6a76','#659b9a','#d8aa70','#947ab4'][k]);
  building(g,1292,147,105,3,'燈彩工房','#96626d','#54838b');building(g,1410,165,90,3,'糖葫蘆','#b7785b','#7d727b');building(g,1514,142,103,4,'花好月圓','#725e82','#487e82');building(g,1805,133,101,4,'吉祥餅家','#ac705a');gate(g,1632,'龍舞夜市');
  stall(g,1293,215,97,'手作り提灯','#ba6b83');for(let k=0;k<4;k++)lantern(g,1305+k*23,224,.6,k%2?'#edb352':'#e56c67');stall(g,1415,217,78,'あめと果実','#8d77a5');r(g,1430,247,32,13,'#b47b5c');
  for(let k=0;k<5;k++){line(g,1435+k*5,251,1432+k*7,228,'#efcb8b',1);for(let n=0;n<3;n++)oval(g,1429+k*7,228+n*6,6,6,n%2?'#f29a52':'#d95850');}
  r(g,1640,264,143,12,'#a45253');r(g,1635,260,153,4,'#ecc182');r(g,1648,277,126,5,'#79424c');
  for(const[x,y]of[[77,271],[422,276],[621,272],[754,275],[1027,278],[1280,273],[1621,277],[1798,274]])planter(g,x,y);
  sign(g,111,172,81,'點 心 横 丁','#a44743');sign(g,830,101,108,'福 慶 寺 廣 場','#5c6580');sign(g,1517,166,96,'燈 火 縁 日','#a24e6e');
  for(let b=0;b<3;b++){const base=b*640;for(let x=0;x<640;x+=3)r(g,base+x,119+Math.sin(x/640*Math.PI)*31,3,1,'#bd946c');for(let j=0;j<9;j++){const x=base+20+j*74;lantern(g,x,130+Math.sin((x-base)/640*Math.PI)*31,.63,j%4===1?'#db9c56':'#dc6053');}}
}
function paintSky(g:G){
  for(let i=0;i<100;i++)r(g,rand(i)*SKY,rand(i+400)*130,1,1,i%4?'#687392':'#d9b98d');oval(g,694,28,48,48,'#f7d79c');oval(g,704,31,8,6,'#e6bf8e');oval(g,725,53,7,9,'#e6bf8e');
  for(let i=0;i<16;i++){const x=i*64-20,y=139+rand(i+9)*40;r(g,x,y,61,115,'#34415a');roof(g,x-3,y,67,'#3d5869');for(let j=0;j<4;j++)r(g,x+9+j*12,y+14,4,9,'#b38c75');}
  for(let i=0;i<6;i++){const w=89-i*11,y=215-i*23;r(g,431-w/2+8,y-17,w-16,28,'#45576a');roof(g,431-w/2,y-17,w,'#486b76');for(let j=0;j<3;j++)r(g,416+j*11,y-10,5,9,'#c49d79');}r(g,430,61,2,19,'#d6b581');
}
type Citizen={name:string;x:number;y:number;pace:number;walk?:number;paint:(g:G,f:number)=>void;frames?:HTMLCanvasElement[]};
// Each citizen has individual clothing, proportions, props and animation, rather
// than palette-swapping one pedestrian. Only low-level drawing helpers are shared.
function face(g:G,x:number,y:number,w=14,h=15,c=skin){oval(g,x-1,y-1,w+2,h+2,ink);oval(g,x,y,w,h,c);r(g,x+w*.28,y+h*.4,1,2,ink);r(g,x+w*.7,y+h*.4,1,2,ink);r(g,x+w*.46,y+h*.74,3,1,'#a46151');}
function boots(g:G,x:number,y:number,w=17){r(g,x,y,6,4,ink);r(g,x+w-6,y,7,4,ink);}
const citizens:Citizen[]=[
  {name:'阿福・小籠包の親方',x:145,y:267,pace:350,paint(g,f){
    oval(g,22,28,29,30,ink);oval(g,24,30,25,28,'#f2dfb3');r(g,30,39,15,19,'#63a29a');boots(g,28,58,20);face(g,29,17,18,18);oval(g,25,6,11,13,'#fff0c9');oval(g,34,3,14,15,'#fff0c9');oval(g,43,8,9,11,'#fff0c9');r(g,28,16,20,5,'#f5e5bd');line(g,26,36,16,41-f,'#f1d8ad',5);line(g,46,35,56,35+f,'#f1d8ad',5);steamer(g,9,39-f,18);r(g,37,36,3,17,'#dfb272');r(g,31,25,4,2,ink);r(g,42,25,4,2,ink);
  }},
  {name:'炎の中華鍋職人',x:75,y:269,pace:160,paint(g,f){
    r(g,28,32,17,23,'#db6553');r(g,31,40,13,19,'#283f53');boots(g,29,59,17);face(g,28,17,16,17);r(g,26,16,20,5,'#d84d50');r(g,27,13,17,5,ink);line(g,26,21,15,24+f,'#e9645d',3);line(g,30,35,20,40,'#d7a275',4);line(g,44,36,50,37-f,'#e7b182',4);r(g,49,35-f,16,3,ink);oval(g,53,34-f,23,8,'#54626c');for(let j=0;j<3;j++)r(g,57+j*5,30-f-(j%2)*3,3,3,['#e8bc70','#70ab72','#d98557'][j]);
  }},
  {name:'手延べ麺の青年',x:273,y:270,pace:260,paint(g,f){
    r(g,30,30,16,31,'#ebe8bd');r(g,33,36,12,24,'#758ba1');boots(g,30,61,18);face(g,30,13,13,17);r(g,28,8,17,8,'#f7e7c7');r(g,27,14,19,3,'#c65353');line(g,31,33,17-f,27+f,'#eee0b6',4);line(g,45,33,57+f,28+f,'#eee0b6',4);for(let j=0;j<4;j++){line(g,18-f+j,30+f,28+j,42+f*2,'#f4d68c',1);line(g,28+j,42+f*2,57+f-j,30+f,'#f4d68c',1);}
  }},
  {name:'茶館の眼鏡のおばあちゃん',x:386,y:269,pace:480,paint(g,f){
    r(g,28,33,23,24,'#586c94');r(g,31,57,18,6,'#394d72');boots(g,29,63,22);face(g,30,17,18,17,pale);oval(g,26,12,25,8,'#c5c5bd');oval(g,38,7,10,9,'#dad7c7');r(g,30,23,7,5,'#524e60');r(g,39,23,7,5,'#524e60');r(g,32,24,4,3,'#e4d8ae');r(g,41,24,4,3,'#e4d8ae');r(g,37,24,2,1,'#544950');line(g,31,38,19,40,'#768eb0',4);line(g,48,38,59,35+f,'#768eb0',4);oval(g,57,34+f,9,8,'#cc9864');line(g,65,39+f,69,48,'#e4cfa0',1);r(g,64,49,9,4,'#f5e4be');
  }},
  {name:'せいろ便の赤服配達人',x:466,y:269,pace:150,walk:12,paint(g,f){
    const a=f%2?2:-2;line(g,33,49,28+a,61,'#354f62',5);line(g,42,49,47-a,62,'#354f62',5);r(g,24+a,61,10,4,ink);r(g,44-a,62,10,4,ink);r(g,28,29,19,22,'#c94850');r(g,31,30,2,17,'#f5bd72');face(g,29,14,16,17);r(g,27,10,19,7,'#242b3d');r(g,25,14,24,4,'#e36953');line(g,30,32,18,27+a,'#eeb45f',4);line(g,18,27+a,9,32-a,'#eeb45f',3);line(g,46,34,56,39,'#eab98b',4);steamer(g,53,35,20);steamer(g,53,25,20);
  }},
  {name:'翡翠色の服で買物する母',x:577,y:271,pace:540,paint(g,f){
    r(g,30,30,16,15,'#6cad98');r(g,27,44,23,18,'#55a18d');r(g,35,34,2,20,'#e5c478');r(g,39,42,4,4,'#edc789');boots(g,30,62,18);face(g,31,14,14,18,pale);r(g,29,12,17,6,ink);r(g,27,17,5,17,ink);oval(g,41,8,10,11,ink);r(g,43,10,8,2,'#e0b75f');line(g,29,35,19,45+f%2,'#70b39b',4);r(g,13,45,13,14,'#d6a262');r(g,17,42,6,2,'#d6a262');line(g,46,35,57,43,'#edc18c',3);
  }},
  {name:'金魚風船を連れた子',x:604,y:270,pace:210,paint(g,f){
    r(g,29,40,14,17,'#f3c666');boots(g,28,57,17);face(g,28,23,16,17,pale);r(g,27,21,18,6,ink);r(g,27,25,3,6,ink);r(g,42,25,3,6,ink);line(g,30,45,20,41,'#e9b87f',3);line(g,42,43,50,35,'#e9b87f',3);line(g,50,35,57,10+f,'#eccd9b',1);oval(g,48,0+f,18,12,'#ed6f69');r(g,64,2+f,6,8,'#efa271');r(g,52,3+f,3,3,'#fff5cb');r(g,52,4+f,1,1,ink);
  }},
  {name:'香を整える袈裟の人',x:718,y:271,pace:700,paint(g,f){
    r(g,28,30,20,16,'#d78b45');r(g,24,46,28,18,'#c57d47');r(g,27,60,23,5,'#e2ab64');boots(g,28,64,19);face(g,30,14,16,17,skin);line(g,28,33,46,53,'#f6c46b',5);line(g,30,38,39,43,'#efbc8b',4);line(g,47,36,40,43+f%2,'#efbc8b',4);r(g,39,33,1,11,'#d8b78c');
  }},
  {name:'二胡を弾く白ひげのおじいさん',x:790,y:274,pace:220,paint(g,f){
    r(g,27,44,23,14,'#557b98');r(g,24,31,25,24,'#6e94a5');r(g,25,57,9,4,ink);r(g,43,57,9,4,ink);r(g,27,60,4,7,'#ad866b');r(g,48,60,4,7,'#ad866b');face(g,28,13,18,18,pale);r(g,26,10,23,7,'#d6d9c9');r(g,28,27,17,4,'#e9e0c4');r(g,31,30,11,7,'#e9e0c4');r(g,40,21,2,35,'#c39162');oval(g,36,50,12,9,'#9b694d');line(g,41,37,57,35+f*2,'#e1b27c',1);line(g,25,36,37,42,'#e2be95',3);line(g,49,37,57,36+f*2,'#e2be95',3);
  }},
  {name:'扇を広げる舞い手',x:1033,y:270,pace:320,paint(g,f){
    r(g,31,29,14,16,'#bb709c');r(g,27,44,24,17,'#b56695');r(g,24,58,30,5,'#e2a6bd');boots(g,29,63,20);face(g,31,13,13,17,pale);r(g,28,11,18,6,ink);r(g,27,15,5,16,ink);oval(g,39,5,10,10,ink);r(g,42,8,9,2,'#e7c06b');line(g,30,34,19,28+f,'#d58eb0',4);line(g,44,33,54,27-f,'#d58eb0',4);for(let k=0;k<6;k++)line(g,56,27-f,46+k*4,10-f+Math.abs(k-3),'#f4c9bd',2);r(g,54,26-f,4,3,'#ae6378');
  }},
  {name:'碁盤を見つめる藍服のおじさん',x:1130,y:273,pace:750,paint(g,f){
    r(g,27,31,24,22,'#475b83');r(g,25,51,14,11,'#3b496d');r(g,42,51,12,11,'#3b496d');boots(g,25,61,30);face(g,29,15,18,17,skin);oval(g,26,10,24,10,'#4c4152');r(g,25,17,26,3,'#bd9c73');r(g,52,43,25,3,'#deb171');r(g,54,46,3,18,'#98704e');for(let j=0;j<5;j++)r(g,54+j*5,39,1,4,'#947356');r(g,54,39,20,1,'#947356');r(g,57,41,2,2,ink);r(g,66,40,2,2,'#eee5cc');line(g,49,34,61,37+f%2,'#d4ac85',4);r(g,61,36+f%2,2,2,ink);
  }},
  {name:'花売りのそばかす娘',x:1216,y:270,pace:450,paint(g,f){
    r(g,29,32,17,20,'#e69c74');r(g,26,50,23,11,'#cf7f6f');boots(g,29,61,17);face(g,30,14,15,18,pale);r(g,28,12,19,6,'#694452');r(g,25,15,5,16,'#694452');r(g,45,14,5,20,'#694452');r(g,31,25,2,1,'#d99671');r(g,41,25,2,1,'#d99671');line(g,29,36,21,44,'#ecb88a',4);r(g,11,45,23,13,'#bb875d');for(let j=0;j<5;j++){line(g,15+j*4,47,11+j*6,33+(j%2)*5,'#84a875',1);oval(g,7+j*6,29+(j%2)*5+(f%2),8,8,j%2?'#f3c778':'#ed93a6');}
  }},
  {name:'筆を持つ提灯職人',x:1350,y:271,pace:280,paint(g,f){
    r(g,28,29,21,30,'#9680a3');r(g,32,33,13,26,'#e1bb87');boots(g,28,59,23);face(g,31,13,15,17,skin);r(g,28,11,20,7,'#f2d8a6');r(g,27,16,23,4,'#cc6965');line(g,29,35,18,40,'#d6af84',4);line(g,48,34,57,29+f,'#e0b187',4);line(g,56,28+f,64,20+f,'#4b3542',1);lantern(g,15,38,.55,'#f1b15e');r(g,11,43,7,2,'#a85e52');
  }},
  {name:'糖葫蘆のひげ店主',x:1479,y:269,pace:500,paint(g,f){
    oval(g,24,31,29,28,'#779786');r(g,28,47,22,12,'#416c6c');boots(g,28,59,22);face(g,28,14,21,19,skin);r(g,27,12,22,6,ink);r(g,25,10,26,5,'#998257');r(g,29,27,8,3,'#4b3540');r(g,40,27,8,3,'#4b3540');line(g,26,37,16,28+f%2,'#7caa93',5);r(g,16,10+f%2,1,22,'#f3ce9a');for(let j=0;j<3;j++)oval(g,12,8+j*6+f%2,9,7,'#e65c55');line(g,51,38,61,43,'#7caa93',4);r(g,59,40,7,5,'#e9b77e');
  }},
  {name:'おだんご頭の配達少女',x:1567,y:270,pace:170,walk:10,paint(g,f){
    const a=f%2?3:-3;r(g,29,31,18,22,'#e6ba65');r(g,32,35,3,15,'#dd765f');line(g,33,53,29+a,61,'#6c627e',4);line(g,43,52,48-a,61,'#6c627e',4);r(g,26+a,61,9,4,ink);r(g,45-a,61,9,4,ink);face(g,30,14,15,18,pale);r(g,28,12,19,6,ink);oval(g,22,11,9,9,ink);oval(g,44,10,9,9,ink);r(g,23,16,8,3,'#dd7c84');r(g,45,15,8,3,'#dd7c84');line(g,30,36,21,39,'#edc191',4);line(g,46,37,54,41,'#edc191',4);r(g,8,36,55,3,'#d39563');steamer(g,7,29,17);steamer(g,45,29,18);
  }},
  {name:'金の獅子舞・先頭',x:1674,y:267,pace:190,paint(g,f){
    const b=f%2?2:0;line(g,26,50,19+b,65,'#bd4e55',7);line(g,43,50,49-b,65,'#bd4e55',7);r(g,14+b,64,13,5,'#f0ce83');r(g,45-b,64,13,5,'#f0ce83');oval(g,14,24+b,47,30,'#da9b54');r(g,19,43+b,39,15,'#d66055');for(let j=0;j<5;j++)r(g,21+j*7,52+b,3,7,'#f8ce80');oval(g,17,8+b,40,33,'#ffe19b');oval(g,10,15+b,18,20,'#df8057');oval(g,47,15+b,18,20,'#df8057');oval(g,21,14+b,15,15,'#fff4cc');oval(g,40,14+b,15,15,'#fff4cc');oval(g,25,17+b,8,9,'#393148');oval(g,44,17+b,8,9,'#393148');r(g,26,18+b,3,3,'#fff7d7');r(g,45,18+b,3,3,'#fff7d7');oval(g,30,26+b,18,8,'#d25957');r(g,24,37+b,29,5,ink);r(g,26,37+b,25,2,'#fff1b8');r(g,34,7+b,10,7,'#c47b67');r(g,37,8+b,4,4,'#79a5a1');
  }},
  {name:'獅子舞・裾を支える人',x:1722,y:269,pace:190,paint(g,f){
    const b=f%2?2:0;line(g,26,47,20-b,62,'#e18a5b',6);line(g,43,47,48+b,62,'#e18a5b',6);r(g,15-b,62,12,4,ink);r(g,44+b,62,12,4,ink);face(g,35,18,13,16,skin);r(g,33,16,17,5,'#b4444d');oval(g,17,30+b,43,23,'#d86357');for(let j=0;j<6;j++){r(g,19+j*6,35+b,4,3,'#f2bd69');r(g,20+j*6,46+b,4,7,'#f4c778');}line(g,56,37+b,68,22+b,'#eeb567',4);
  }},
  {name:'太鼓を叩く青服の少女',x:1798,y:271,pace:140,paint(g,f){
    r(g,29,30,17,27,'#7296b6');boots(g,28,58,20);face(g,29,14,16,17,pale);r(g,27,11,21,6,ink);r(g,25,15,5,20,ink);r(g,46,15,4,22,ink);r(g,26,20,24,3,'#d87679');r(g,13,43,49,16,'#b85d50');oval(g,13,39,49,9,'#f3dba7');r(g,17,58,3,8,'#8e6556');r(g,55,58,3,8,'#8e6556');for(let k=0;k<6;k++)r(g,17+k*8,49,2,2,'#f3cb82');line(g,30,35,21,27+f*3,'#99b4c7',4);line(g,45,35,56,37-f*3,'#99b4c7',4);line(g,21,27+f*3,16,19+f*3,'#e5c38a',2);line(g,56,37-f*3,61,29-f*3,'#e5c38a',2);
  }},
  {name:'月餅を味見する丸眼鏡の旅人',x:1871,y:270,pace:480,paint(g,f){
    r(g,26,31,25,23,'#c17c80');r(g,30,51,8,11,'#62657c');r(g,43,51,8,11,'#62657c');boots(g,29,62,24);face(g,27,12,23,21,pale);r(g,28,10,22,7,'#4b3d4b');oval(g,28,19,9,8,'#342d40');oval(g,40,19,9,8,'#342d40');oval(g,30,20,5,5,'#efcf9f');oval(g,42,20,5,5,'#efcf9f');r(g,37,22,4,1,'#342d40');line(g,49,35,50,28+f%2,'#e3b18d',4);oval(g,48,26+f%2,9,7,'#e8b565');r(g,21,33,6,24,'#8d705e');r(g,17,35,8,18,'#c99b6f');
  }},
];
function prepare(){
  if(street)return;
  street=document.createElement('canvas');street.width=W;street.height=H;paintStreet(street.getContext('2d')!);
  skyline=document.createElement('canvas');skyline.width=SKY;skyline.height=260;paintSky(skyline.getContext('2d')!);
  for(const p of citizens)p.frames=Array.from({length:4},(_,f)=>{const c=document.createElement('canvas');c.width=80;c.height=80;p.paint(c.getContext('2d')!,f);return c;});
}
function atmosphere(g:G,offset:number,visible:number,now:number){
  for(const a of[{x:115,y:237,k:0},{x:184,y:225,k:0},{x:151,y:250,k:1},{x:251,y:250,k:0},{x:888,y:248,k:2}]){
    const x=wrap(a.x-offset,W);if(x>visible+25)continue;
    if(a.k===1){for(let k=0;k<5;k++){const h=5+Math.round(Math.sin(now*.012+k*2)*3);r(g,x-10+k*4,a.y+10-h,3,h,'#e77749');r(g,x-9+k*4,a.y+9-h/2,2,h/2,'#f7c967');}}
    else{for(let k=0;k<5;k++){const p=wrap(now*.0003+k*.21,1),y=a.y-5-p*(a.k===2?32:28);g.globalAlpha=(1-p)*(a.k===2?.23:.5);const xx=x+Math.sin(now*.002+k*2)*4+p*4;r(g,xx,y,4+p*5,3+p*2,'#fff0d2');r(g,xx+3,y-3,3+p*3,3,'#fff0d2');}g.globalAlpha=1;}
  }
}
export function drawChinatown(g:G,width:number,height:number,now=0,camera=0,title=false){
  prepare();const portrait=height>width*1.15;
  // A phone gets a taller sky, not a magnified crop of one shop facade.
  const scale=portrait?width/430:Math.max(width/800,height/360),visible=width/scale;
  const base=height*(portrait?.64:.79),top=base-274*scale;
  const offset=wrap(camera*.26+(title?210:0),W),far=wrap(camera*.065,SKY);
  g.save();g.imageSmoothingEnabled=false;
  const sky=g.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#19263e');sky.addColorStop(.66,'#645164');sky.addColorStop(1,'#78616a');g.fillStyle=sky;g.fillRect(0,0,width,height);
  g.save();g.translate(0,top);g.scale(scale,scale);
  for(let x=-far;x<visible;x+=SKY)g.drawImage(skyline!,Math.floor(x),-11);
  r(g,0,274,visible,Math.max(86,(height-top)/scale-274),'#554350');
  for(let x=-offset;x<visible;x+=W)g.drawImage(street!,Math.floor(x),0);
  for(const p of citizens){const drift=p.walk?Math.sin(now*.0006+p.x)*p.walk:0,x=wrap(p.x-offset+drift+40,W)-40;if(x< -50||x>visible+50)continue;g.drawImage(p.frames![Math.floor(now/p.pace+p.x)%4],Math.round(x-40),p.y-68);}
  atmosphere(g,offset,visible,now);g.restore();
  // Nearby lanterns form a third continuous parallax layer.
  const ls=Math.min(scale,2.5),near=camera*.4,first=Math.floor(near/70)-1,count=Math.ceil(width/(70*ls))+3;g.save();g.scale(ls,ls);
  for(let i=first;i<first+count;i++){const x=i*70-near,y=30+Math.sin(i*Math.PI/3)*11;line(g,x,y-12,x+70,30+Math.sin((i+1)*Math.PI/3)*11-12,'#bd956f',1);lantern(g,x+35,y,.8,wrap(i,3)?'#d75d53':'#dfaa64');}g.restore();
  g.fillStyle='#1a2035';g.globalAlpha=title?.03:.13;g.fillRect(0,0,width,height);g.restore();
}
