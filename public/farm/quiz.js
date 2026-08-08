(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const locale = () => {
    const cookie = document.cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith("plantmoji_locale="))?.split("=")[1];
    return cookie === "en" || (!cookie && localStorage.getItem("plantmoji_locale") === "en") ? "en" : "id";
  };
  const C = {
    id:{title:"Quiz Jamkachu",ready:n=>`${n}/3 selesai`,done:"3 soal harian selesai!",next:"Berikutnya →",finish:"Lihat hasil",practice:"Lanjut latihan tanpa batas →",again:"Belum tepat — -1 XP. Coba lagi!",timeout:"Waktu habis — -1 XP. Yuk coba lagi!",earned:xp=>`Benar! +${xp} XP`,summary:xp=>`Hebat! Ronde ini menghasilkan ${xp} XP.`,offline:"Quiz sedang istirahat. Coba lagi sebentar lagi."},
    en:{title:"Jamkachu Quiz",ready:n=>`${n}/3 complete`,done:"Daily 3 complete!",next:"Next →",finish:"See result",practice:"Keep practicing →",again:"Not quite — -1 XP. Try again!",timeout:"Time's up — -1 XP. Try again!",earned:xp=>`Correct! +${xp} XP`,summary:xp=>`Nice! This round earned ${xp} XP.`,offline:"Quiz is taking a tiny break. Try again soon."}
  };
  const REACTIONS = {
    temperature:["Whew! Cool thinking!","Fiuh! Pilihan yang sejuk!"], humidity:["You caught the air clue!","Kamu menangkap petunjuk udaranya!"],
    light:["Bright answer!","Jawabanmu bersinar!"], soil_ph:["Safe soil detective!","Detektif tanah yang aman!"],
    crop:["Crop clue cracked!","Petunjuk tanaman terpecahkan!"], safety:["Safe and smart!","Aman dan pintar!"], plantmoji:["You know our rules!","Kamu tahu aturan kita!"]
  };
  let questions=[],progress=[],caseData=null,mastery={},index=0,round=0,busy=false,returnFocus=null,timer=null,timeLeft=15;
  const copy=()=>C[locale()];
  const completed=()=>new Set(progress.filter(p=>p.completed_at).map(p=>p.question_key));
  const totalXp=()=>progress.reduce((sum,p)=>sum+(Number(p.xp_awarded)||0),0);
  function updateChip(){if(round!==0)return;const n=completed().size;$("#daily-quiz-progress").textContent=n>=3?copy().done:copy().ready(n);$("#daily-quiz-open").classList.toggle("quiz-complete",n>=3);renderGems(n);}
  function renderGems(n){let gems=$("#quiz-chip-gems");if(!gems){gems=document.createElement("span");gems.id="quiz-chip-gems";gems.className="quiz-chip-gems";$(".quiz-chip-copy").appendChild(gems);}gems.innerHTML=[0,1,2].map(i=>`<i class="${i<n?"lit":""}">◆</i>`).join("");}
  async function load(targetRound=0){try{round=targetRound;const r=await fetch(`/api/daily-quiz?plantId=plant-01&locale=${locale()}&round=${round}`,{cache:"no-store"});const d=await r.json();if(!d.ok)throw 0;questions=d.questions;progress=d.progress||[];caseData=d.case;mastery=d.mastery||{};updateChip();return true;}catch{$("#daily-quiz-progress").textContent=copy().offline;return false;}}
  function stopTimer(){if(timer)clearInterval(timer);timer=null;}
  function paintTimer(){const pct=Math.max(0,timeLeft/15*100);$("#quiz-timer-fill").style.width=`${pct}%`;$("#quiz-timer-text").textContent=timeLeft;$(".quiz-timer").classList.toggle("urgent",timeLeft<=5);}
  function startTimer(){stopTimer();timeLeft=15;paintTimer();timer=setInterval(()=>{timeLeft--;paintTimer();if(timeLeft<=0){stopTimer();answer(-1,null,true);}},1000);}
  function render(){
    const q=questions[index],done=completed(),c=copy(),next=$("#quiz-next");
    $("#quiz-title").textContent=c.title;$("#quiz-step").textContent=`CASE ${round+1} · ${Math.min(index+1,3)} / 3`;$("#quiz-meter-fill").style.width=`${Math.min(3,done.size)/3*100}%`;
    $("#quiz-case-title").textContent=caseData?.title||"FARM CASE";$("#quiz-case-intro").textContent=caseData?.intro||"";$("#quiz-case-phases").innerHTML=(caseData?.phases||[]).map((phase,i)=>`<span class="${i===index?"active":i<index?"done":""}">${i<index?"✓ ":""}${phase}</span>`).join("");
    $("#quiz-feedback").hidden=true;next.hidden=true;next.dataset.practice="";
    if(!q){stopTimer();$("#quiz-question").textContent=c.summary(totalXp());$("#quiz-choices").innerHTML=`<div class="quiz-mastery">${Object.entries(mastery).map(([key,value])=>`<span>${categoryIcon(key)} ${key.replace("_"," ")} · ${value}</span>`).join("")}</div>`;const f=$("#quiz-feedback");f.hidden=false;f.className="quiz-feedback correct";f.textContent="🌟 "+(round===0?c.done:c.summary(totalXp()));next.hidden=false;next.textContent=c.practice;next.dataset.practice="true";return;}
    $("#quiz-question").textContent=q.question;const box=$("#quiz-choices");box.replaceChildren();
    q.choices.forEach((choice,i)=>{const b=document.createElement("button");b.type="button";b.className="quiz-choice";b.textContent=`${String.fromCharCode(65+i)}. ${choice}`;b.disabled=done.has(q.key);b.addEventListener("click",()=>answer(i,b,false));box.appendChild(b);});
    if(done.has(q.key)){stopTimer();const f=$("#quiz-feedback");f.hidden=false;f.className="quiz-feedback correct";f.textContent="✓ "+c.done;showNext();}else startTimer();
  }
  function categoryIcon(key){return({temperature:"🌡️",humidity:"💧",light:"☀️",soil_ph:"🧪",crop:"🌾",safety:"🛡️",plantmoji:"🌱"})[key]||"◆";}
  function showNext(){const b=$("#quiz-next");b.hidden=false;b.textContent=index>=questions.length-1?copy().finish:copy().next;}
  function xpPod(amount,origin){
    const target=$(".badge.coin")?.getBoundingClientRect(),from=origin?.getBoundingClientRect?.()||$(".quiz-card").getBoundingClientRect();const pod=document.createElement("b");pod.className=`quiz-xp-pod ${amount<0?"loss":""}`;pod.textContent=`${amount>0?"+":""}${amount} XP`;
    pod.style.left=`${from.left+from.width/2}px`;pod.style.top=`${from.top+from.height/2}px`;if(target){pod.style.setProperty("--xp-x",`${target.left+target.width/2-(from.left+from.width/2)}px`);pod.style.setProperty("--xp-y",`${target.top+target.height/2-(from.top+from.height/2)}px`);}document.body.appendChild(pod);setTimeout(()=>pod.remove(),1250);
  }
  function updateXpHud(data){if(data.total_xp==null)return;const total=Number(data.total_xp);const coin=$(".badge.coin");if(coin)coin.innerHTML=`<i class="icon">⭐</i> ${total} XP`;const bar=$(".xp-bar");if(bar)bar.style.width=`${(total%30)/30*100}%`;}
  function levelUp(data){if(!data.leveled_up)return;const el=document.createElement("div");el.className="quiz-level-up";el.innerHTML=`<small>JAMKACHU</small><strong>LEVEL UP!</strong><span>LV. ${data.bond_level}</span>`;document.body.appendChild(el);window.PMSfx?.play("levelup");setTimeout(()=>el.remove(),2600);}
  function celebrate(data,button,category){document.body.classList.add("quiz-success-flash");setTimeout(()=>document.body.classList.remove("quiz-success-flash"),420);const mascot=$(".mascot-wrapper");mascot?.classList.add(`quiz-cheer`,`quiz-${category}`);setTimeout(()=>mascot?.classList.remove("quiz-cheer",`quiz-${category}`),850);const line=REACTIONS[category]?.[locale()==="id"?1:0];if(line){const bubble=$(".speech-bubble");if(bubble)bubble.textContent=`“${line}”`;}window.PMSfx?.play("coin");xpPod(data.xp_awarded,button);setTimeout(()=>updateXpHud(data),780);setTimeout(()=>levelUp(data),1050);}
  async function answer(answerIndex,button,timedOut){
    if(busy)return;busy=true;stopTimer();document.querySelectorAll(".quiz-choice").forEach(b=>b.disabled=true);button?.classList.add("selected");
    try{const q=questions[index];const r=await fetch("/api/daily-quiz",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({plantId:"plant-01",questionKey:q.key,answerIndex,locale:locale(),round})});const d=await r.json();if(!d.ok)throw 0;const f=$("#quiz-feedback");f.hidden=false;
      if(d.correct){button?.classList.add("correct");f.className="quiz-feedback correct";f.textContent=`${copy().earned(d.xp_awarded)} ${d.explanation}`;progress=progress.filter(p=>p.question_key!==q.key);progress.push({question_key:q.key,completed_at:new Date().toISOString(),xp_awarded:d.xp_awarded});celebrate(d,button,q.category);updateChip();showNext();}
      else{button?.classList.add("wrong");f.className="quiz-feedback retry";window.PMSfx?.play("tick");xpPod(d.xp_awarded,button);setTimeout(()=>updateXpHud(d),780);
        if(d.completed&&Number.isInteger(d.correctIndex)){const buttons=[...document.querySelectorAll(".quiz-choice")];buttons[d.correctIndex]?.classList.add("correct");f.textContent=`${timedOut?copy().timeout:copy().again} ✓ ${d.correctAnswer}. ${d.explanation}`;progress=progress.filter(p=>p.question_key!==q.key);progress.push({question_key:q.key,completed_at:new Date().toISOString(),xp_awarded:0});showNext();}
        else{f.textContent=`${timedOut?copy().timeout:copy().again} ${d.hint||q.hint}`;setTimeout(()=>{document.querySelectorAll(".quiz-choice").forEach(b=>b.disabled=false);startTimer();},650);}}
    }catch{const f=$("#quiz-feedback");f.hidden=false;f.className="quiz-feedback retry";f.textContent=copy().offline;document.querySelectorAll(".quiz-choice").forEach(b=>b.disabled=false);startTimer();}finally{busy=false;}
  }
  function open(){if(!questions.length)return;returnFocus=document.activeElement;index=questions.findIndex(q=>!completed().has(q.key));if(index<0)index=questions.length;$("#daily-quiz-modal").hidden=false;document.body.classList.add("quiz-open");render();$(".quiz-card").focus();}
  function close(){stopTimer();$("#daily-quiz-modal").hidden=true;document.body.classList.remove("quiz-open");returnFocus?.focus?.();}
  $("#daily-quiz-open")?.addEventListener("click",open);$("#quiz-close")?.addEventListener("click",close);$("[data-quiz-close]")?.addEventListener("click",close);
  $("#quiz-next")?.addEventListener("click",async()=>{const b=$("#quiz-next");if(b.dataset.practice==="true"){b.dataset.practice="";if(await load(round+1)){index=0;render();}}else{index++;render();}window.PMSfx?.play("tick");});
  document.addEventListener("keydown",e=>{const modal=$("#daily-quiz-modal");if(modal?.hidden)return;if(e.key==="Escape"){close();return;}if(e.key==="Tab"){const list=[...modal.querySelectorAll("button:not([disabled])")].filter(el=>!el.hidden);if(!list.length)return;const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  load();
})();
