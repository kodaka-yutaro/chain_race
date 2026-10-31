import './ability-guide.css';

const abilities=[
  {id:'basic',name:'フック',main:'ハンマー',mainText:'左クリックで仲間をたたいて飛ばす。凍結した仲間を助けよう。',sub:'フック',subText:'右クリックを押し続けて壁や仲間につかまり、引き寄せる。大中華や赤いボールもフックでつかめる。'},
  {id:'bicycle',name:'自転車',main:'ボールをシュート',mainText:'近くの赤いボールを回収し、左クリックで発射。マウスの向きと距離で軌道を調整。赤いボールはフックでもつかめる。',sub:'爆破・回収',subText:'右クリックで円内（半径320px）の赤ボールを爆破して回収。壁越しでも届く。他の人が回収済みのボールは対象外。爆風で仲間を飛ばそう。'},
  {id:'bun',name:'肉まん',main:'大中華を出す・動かす',mainText:'左クリック長押しで大中華を生成。短くクリックすると、狙った方向に動かせる。大中華にはフックを掛けてつかまれる。',sub:'小中華を出す',subText:'右クリックで小中華を生成。主が凍結中は操作できず、能力が変わると中華は消える。'},
  {id:'ghost',name:'幽霊',main:'幽体離脱・帰還',mainText:'左クリック長押しで本体を残して離脱。WASDで飛び、再び長押しすると帰還。短押しはハンマー。',sub:'霊体のフック',subText:'右クリックでフック。本体が凍っても飛べる。霊体の凍結中は飛べるが、フックは使えない。'},
];
const root=document.querySelector<HTMLElement>('#ability-guide');
if(root){
  let selected=0;
  root.innerHTML=`<div class="guide-heading"><span>能力の使い方</span><span class="guide-count"></span></div><div class="guide-tabs" role="tablist" aria-label="能力">${abilities.map((a,i)=>`<button type="button" role="tab" id="guide-tab-${i}" aria-controls="guide-panel" data-index="${i}">${a.name}</button>`).join('')}</div><article id="guide-panel" role="tabpanel"><img class="guide-image" width="960" height="540"><div class="guide-details" aria-live="polite"></div></article><div class="guide-controls"><button type="button" data-step="-1" aria-label="前の能力">← 前へ</button><button type="button" data-step="1" aria-label="次の能力">次へ →</button></div>`;
  function show(index:number){
    selected=(index+abilities.length)%abilities.length;const a=abilities[selected];
    root!.querySelector('.guide-count')!.textContent=`${selected+1} / ${abilities.length}`;
    root!.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===selected));b.tabIndex=i===selected?0:-1;});
    root!.querySelector('#guide-panel')!.setAttribute('aria-labelledby',`guide-tab-${selected}`);
    const img=root!.querySelector<HTMLImageElement>('img')!;img.src=`${import.meta.env.BASE_URL}art/guide/${a.id}.png`;img.alt=`${a.name}の能力を使ったゲーム画面`;
    root!.querySelector('.guide-details')!.innerHTML=`<h4>${a.name}</h4><p><strong>メイン · ${a.main}</strong><span>${a.mainText}</span></p><p><strong>サブ · ${a.sub}</strong><span>${a.subText}</span></p>`;
  }
  root.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;if(b.dataset.index!==undefined)show(Number(b.dataset.index));else show(selected+Number(b.dataset.step));});
  root.querySelector('.guide-tabs')!.addEventListener('keydown',e=>{const k=e as KeyboardEvent;if(!['ArrowLeft','ArrowRight','Home','End'].includes(k.key))return;k.preventDefault();show(k.key==='Home'?0:k.key==='End'?abilities.length-1:selected+(k.key==='ArrowRight'?1:-1));root.querySelector<HTMLButtonElement>('[aria-selected="true"]')!.focus();});
  show(0);
}
