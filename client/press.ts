// Each button owns its pointers. Releasing one finger never releases another control.
const releases=new Set<()=>void>();
export function releasePresses(){for(const release of releases)release();}

export function bindPress(el:HTMLElement,onDown:()=>void,onUp:()=>void=()=>{}) {
  const pointers=new Set<number>();
  const release=()=>{if(!pointers.size)return;pointers.clear();el.classList.remove('held');onUp();};
  const down=(e:PointerEvent)=>{
    if((el as HTMLButtonElement).disabled||e.button!==0)return;
    e.preventDefault();
    const first=pointers.size===0;pointers.add(e.pointerId);
    el.setPointerCapture(e.pointerId);el.classList.add('held');
    if(first)onDown();
  };
  const end=(e:PointerEvent)=>{
    if(!pointers.delete(e.pointerId)||pointers.size)return;
    el.classList.remove('held');onUp();
  };
  // Pointer actions run on press, not the delayed/sometimes suppressed mobile click.
  // Keep keyboard and accessibility activation, without a second compatibility click.
  const click=(e:MouseEvent)=>{
    e.preventDefault();
    if(e.detail===0&&!(e as PointerEvent).pointerType&&!(el as HTMLButtonElement).disabled){onDown();onUp();}
  };
  el.addEventListener('pointerdown',down);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,end as EventListener);
  el.addEventListener('click',click);releases.add(release);
  return ()=>{
    release();releases.delete(release);el.removeEventListener('pointerdown',down);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])el.removeEventListener(type,end as EventListener);
    el.removeEventListener('click',click);
  };
}
