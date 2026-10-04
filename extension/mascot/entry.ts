// Minimal flat aircraft with a gentle six-second glide.
type Mood = 'idle' | 'detected' | 'checking' | 'ready' | 'unavailable' | 'error';

function create(initial:Mood='idle') {
  const ns='http://www.w3.org/2000/svg';
  function node(tag:string,attrs:Record<string,string>) {const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n;}
  const element=node('svg',{viewBox:'0 0 100 100',class:'tk-mascot','aria-hidden':'true',focusable:'false'});
  const wake=node('g',{fill:'none',stroke:'#70bea5','stroke-width':'2.4','stroke-linecap':'round'});
  const ribbon=node('path',{d:'M32 68Q24 78 13 80','stroke-dasharray':'9 8',opacity:'.4'});
  wake.append(ribbon);element.append(wake);
  const group=node('g',{});
  // A single rounded silhouette stays readable at the launcher's small size.
  const body=node('path',{
    d:'M50 15C47 15 46 19 46 24V38L24 51Q22 52 22 55V57L46 50V65L38 71V75L50 72 62 75V71L54 65V50L78 57V55Q78 52 76 51L54 38V24C54 19 53 15 50 15Z',
    fill:'#70bea5',stroke:'#70bea5','stroke-width':'2','stroke-linejoin':'round'
  });
  group.append(body);element.append(group);
  let mood:Mood=initial,frame=0,disposed=false,start=performance.now();
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  function paint(time:number) {
    const animated=!motion.matches&&!document.hidden;
    const elapsed=animated?(time-start)/1000:0;
    const phase=elapsed*Math.PI/3;
    const glide=Math.sin(phase);
    // At 60px this is a gentle 1.2px drift with a two-degree bank.
    group.setAttribute('transform','translate('+(glide*.8)+' '+(-2-glide*2)+') rotate('+(34+Math.sin(phase)*2)+' 50 46)');
    ribbon.setAttribute('stroke-dashoffset',String(-elapsed*3));
    wake.setAttribute('opacity',mood==='unavailable'||mood==='error'?'.25':'.65');
  }
  function tick(time:number){frame=0;if(disposed||document.hidden||motion.matches)return;paint(time);frame=requestAnimationFrame(tick);}
  function resume(){cancelAnimationFrame(frame);frame=0;element.dataset.motion=motion.matches?'reduced':document.hidden?'paused':'animated';paint(performance.now());if(!motion.matches&&!document.hidden&&!disposed)frame=requestAnimationFrame(tick);}
  function setState(next:Mood){mood=next;element.dataset.state=next;body.setAttribute('fill',next==='error'?'#b58a51':'#70bea5');body.setAttribute('stroke',next==='error'?'#b58a51':'#70bea5');paint(performance.now());}
  document.addEventListener('visibilitychange',resume);motion.addEventListener('change',resume);setState(initial);resume();
  return {element,setState,destroy(){disposed=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resume);motion.removeEventListener('change',resume);}};
}
(globalThis as any).Tickety.mascot={create};


