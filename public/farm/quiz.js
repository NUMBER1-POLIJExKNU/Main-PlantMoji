(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const locale = () => {
    const cookie = document.cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith("plantmoji_locale="))?.split("=")[1];
    let stored=null;try{stored=localStorage.getItem("plantmoji_locale");}catch{}
    return cookie === "en" || (!cookie && stored === "en") ? "en" : "id";
  };
  const C = {
    id:{title:"Quiz Jamkachu",ready:n=>`${n}/3 selesai`,done:"3 soal harian selesai!",next:"Berikutnya →",finish:"Lihat hasil",practice:"Lanjut latihan (tanpa XP) →",
      again:xp=>xp<0?`Belum tepat — ${xp} XP. Coba lagi!`:"Belum tepat. Coba lagi!",timeout:xp=>xp<0?`Waktu habis — ${xp} XP. Yuk coba lagi!`:"Waktu habis. Yuk coba lagi!",
      earned:xp=>`Benar! +${xp} XP`,practiceEarned:"Benar! Mode latihan — tanpa XP.",levelUp:"Naik level!",summary:xp=>`Hebat! Ronde ini menghasilkan ${xp} XP.`,practiceSummary:"Ronde latihan selesai — tanpa XP, ilmunya tetap milikmu!",
      offline:"Quiz sedang istirahat. Coba lagi sebentar lagi.",offlinePlayer:"Quiz sedang offline — belum bisa memberi XP sekarang.",offlineChip:"Istirahat sebentar",
      migration:"Quiz belum siap memberi XP saat ini, coba lagi nanti ya.",
      loading:"Memuat soal…",loadError:"Gagal memuat soal.",retry:"Coba lagi",caseLabel:"KASUS",farmCase:"KASUS KEBUN",categories:{temperature:"Suhu",humidity:"Udara",light:"Cahaya",soil_ph:"Tanah",crop:"Tanaman",safety:"Keamanan",plantmoji:"PlantMoji"}},
    en:{title:"Jamkachu Quiz",ready:n=>`${n}/3 complete`,done:"Daily 3 complete!",next:"Next →",finish:"See result",practice:"Keep practicing (no XP) →",
      again:xp=>xp<0?`Not quite — ${xp} XP. Try again!`:"Not quite. Try again!",timeout:xp=>xp<0?`Time's up — ${xp} XP. Try again!`:"Time's up. Try again!",
      earned:xp=>`Correct! +${xp} XP`,practiceEarned:"Correct! Practice mode — no XP.",levelUp:"Level up!",summary:xp=>`Nice! This round earned ${xp} XP.`,practiceSummary:"Practice round complete — no XP, the learning is all yours!",
      offline:"Quiz is taking a tiny break. Try again soon.",offlinePlayer:"The quiz is offline — it can't award XP right now.",offlineChip:"Taking a break",
      migration:"Quiz can't award XP right now, please try again later.",
      loading:"Loading questions…",loadError:"Couldn't load the quiz.",retry:"Try again",caseLabel:"CASE",farmCase:"FARM CASE",categories:{temperature:"Temperature",humidity:"Air",light:"Light",soil_ph:"Soil",crop:"Crops",safety:"Safety",plantmoji:"PlantMoji"}}
  };
  const REACTIONS = {
    temperature:["Whew! Cool thinking!","Fiuh! Pilihan yang sejuk!"], humidity:["You caught the air clue!","Kamu menangkap petunjuk udaranya!"],
    light:["Bright answer!","Jawabanmu bersinar!"], soil_ph:["Safe soil detective!","Detektif tanah yang aman!"],
    crop:["Crop clue cracked!","Petunjuk tanaman terpecahkan!"], safety:["Safe and smart!","Aman dan pintar!"], plantmoji:["You know our rules!","Kamu tahu aturan kita!"]
  };
  let questions=[],progress=[],caseData=null,mastery={},index=0,round=0,busy=false,returnFocus=null,timer=null,timeLeft=15,offlineMode=false;
  const copy=()=>C[locale()];
  const completed=()=>new Set(progress.filter(p=>p.completed_at).map(p=>p.question_key));
  const totalXp=()=>progress.reduce((sum,p)=>sum+(Number(p.xp_awarded)||0),0);
  // Offline chip copy is the SHORT line — the long offline sentence stays
  // modal-only (the tiny home chip cannot fit a full sentence).
  function updateChip(){if(round!==0)return;const n=completed().size;$("#daily-quiz-progress").textContent=offlineMode?copy().offlineChip:(n>=3?copy().done:copy().ready(n));$("#daily-quiz-open").classList.toggle("quiz-complete",n>=3);renderGems(n);}
  function renderGems(n){let gems=$("#quiz-chip-gems");if(!gems){gems=document.createElement("span");gems.id="quiz-chip-gems";gems.className="quiz-chip-gems";$(".quiz-chip-copy").appendChild(gems);}gems.innerHTML=[0,1,2].map(i=>`<i class="${i<n?"lit":""}">◆</i>`).join("");}
  // Player copy stays ops-free; the machine-readable code goes to the
  // console for operators instead.
  function answerErrorCopy(d){const c=copy();if(d&&d.error==="quiz_migration_required"){console.warn("PlantMoji quiz: quiz_migration_required — apply the quiz migration to enable XP");return c.migration;}if(d&&d.error==="quiz_xp_unavailable")return c.offlinePlayer;return c.offline;}
  async function load(targetRound=0){try{round=targetRound;const r=await fetch(`/api/daily-quiz?plantId=plant-01&locale=${locale()}&round=${round}`,{cache:"no-store"});const d=await r.json();if(!d.ok)throw 0;questions=d.questions;progress=d.progress||[];caseData=d.case;mastery=d.mastery||{};offlineMode=Boolean(d.offline);updateChip();return true;}catch{$("#daily-quiz-progress").textContent=copy().offline;return false;}}
  function stopTimer(){if(timer)clearInterval(timer);timer=null;}
  function paintTimer(){const pct=Math.max(0,timeLeft/15*100);$("#quiz-timer-fill").style.width=`${pct}%`;$("#quiz-timer-text").textContent=timeLeft;$(".quiz-timer").classList.toggle("urgent",timeLeft<=5);}
  function startTimer(){stopTimer();timeLeft=15;paintTimer();timer=setInterval(()=>{timeLeft--;paintTimer();if(timeLeft<=0){stopTimer();answer(-1,null,true);}},1000);}
  function renderLoading(){stopTimer();const c=copy();$("#quiz-title").textContent=c.title;$("#quiz-step").textContent="";$("#quiz-feedback").hidden=true;$("#quiz-question").textContent=c.loading;$("#quiz-choices").innerHTML="";const next=$("#quiz-next");next.hidden=true;next.dataset.practice="";next.dataset.retry="";}
  function renderError(){stopTimer();const c=copy();$("#quiz-title").textContent=c.title;$("#quiz-question").textContent="";$("#quiz-choices").innerHTML="";const f=$("#quiz-feedback");f.hidden=false;f.className="quiz-feedback retry";f.textContent=c.loadError;const next=$("#quiz-next");next.hidden=false;next.textContent=c.retry;next.dataset.practice="";next.dataset.retry="true";}
  async function ensureQuestionsAndRender(){renderLoading();const ok=await load(round);if(ok&&questions.length){index=questions.findIndex(q=>!completed().has(q.key));if(index<0)index=questions.length;render();}else renderError();}
  function render(){
    const q=questions[index],done=completed(),c=copy(),next=$("#quiz-next");
    $("#quiz-title").textContent=c.title;$("#quiz-step").textContent=`${c.caseLabel} ${round+1} · ${Math.min(index+1,3)} / 3`;
    // Indicator diet: the timer + step text carry the pacing (the meter bar
    // and phase chips are gone); the case intro only opens question 1.
    $("#quiz-case-title").textContent=caseData?.title||c.farmCase;const intro=$("#quiz-case-intro");intro.textContent=index===0?(caseData?.intro||""):"";intro.hidden=index!==0||!intro.textContent;
    $("#quiz-feedback").hidden=true;next.hidden=true;next.dataset.practice="";next.dataset.retry="";
    if(!q){stopTimer();$("#quiz-question").textContent=round===0?c.summary(totalXp()):c.practiceSummary;$("#quiz-choices").innerHTML=`<div class="quiz-mastery">${Object.entries(mastery).map(([key,value])=>`<span>${categoryIcon(key)} ${c.categories[key]||key.replace("_"," ")} · ${value}</span>`).join("")}</div>`;const f=$("#quiz-feedback");f.hidden=false;f.className="quiz-feedback correct";f.textContent="🌟 "+(round===0?c.done:c.practiceSummary);next.hidden=false;next.textContent=c.practice;next.dataset.practice="true";return;}
    $("#quiz-question").textContent=q.question;const box=$("#quiz-choices");box.replaceChildren();
    q.choices.forEach((choice,i)=>{const b=document.createElement("button");b.type="button";b.className="quiz-choice";b.textContent=`${String.fromCharCode(65+i)}. ${choice}`;b.disabled=done.has(q.key);b.addEventListener("click",()=>answer(i,b,false));box.appendChild(b);});
    if(done.has(q.key)){stopTimer();const f=$("#quiz-feedback");f.hidden=false;f.className="quiz-feedback correct";f.textContent="✓ "+c.done;showNext();}
    else if(offlineMode){stopTimer();const f=$("#quiz-feedback");f.hidden=false;f.className="quiz-feedback retry";f.textContent=c.offlinePlayer;}
    else startTimer();
  }
  function categoryIcon(key){return({temperature:"🌡️",humidity:"💧",light:"☀️",soil_ph:"🧪",crop:"🌾",safety:"🛡️",plantmoji:"🌱"})[key]||"◆";}
  function showNext(){const b=$("#quiz-next");b.hidden=false;b.textContent=index>=questions.length-1?copy().finish:copy().next;}
  function celebrate(data,button,category){document.body.classList.add("quiz-success-flash");setTimeout(()=>document.body.classList.remove("quiz-success-flash"),420);const mascot=$(".mascot-wrapper");mascot?.classList.add(`quiz-cheer`,`quiz-${category}`);setTimeout(()=>mascot?.classList.remove("quiz-cheer",`quiz-${category}`),850);const line=REACTIONS[category]?.[locale()==="id"?1:0];if(line){const bubble=$(".speech-bubble");if(bubble)bubble.textContent=line;}window.PMSfx?.play("coin");}
  async function answer(answerIndex,button,timedOut){
    if(busy)return;busy=true;stopTimer();document.querySelectorAll(".quiz-choice").forEach(b=>b.disabled=true);button?.classList.add("selected");
    const q=questions[index];let d=null,failed=false;
    try{const r=await fetch("/api/daily-quiz",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({plantId:"plant-01",questionKey:q.key,answerIndex,locale:locale(),round})});d=await r.json();}catch{failed=true;}
    const f=$("#quiz-feedback");f.hidden=false;
    if(failed||!d||!d.ok){const dead=offlineMode||d?.error==="quiz_migration_required"||d?.error==="quiz_xp_unavailable";f.className="quiz-feedback retry";f.textContent=answerErrorCopy(d);if(dead){stopTimer();}else{document.querySelectorAll(".quiz-choice").forEach(b=>b.disabled=false);startTimer();}busy=false;return;}
    if(d.correct){
      button?.classList.add("correct");f.className="quiz-feedback correct";f.textContent=`${d.practice?copy().practiceEarned:copy().earned(d.xp_awarded)}${d.leveled_up?" "+copy().levelUp:""} ${d.explanation}`;
      progress=progress.filter(p=>p.question_key!==q.key);progress.push({question_key:q.key,completed_at:new Date().toISOString(),xp_awarded:d.xp_awarded});
      celebrate(d,button,q.category);updateChip();showNext();
    }else{
      button?.classList.add("wrong");f.className="quiz-feedback retry";window.PMSfx?.play("tick");
      if(d.completed&&Number.isInteger(d.correctIndex)){
        const buttons=[...document.querySelectorAll(".quiz-choice")];buttons[d.correctIndex]?.classList.add("correct");
        f.textContent=`${timedOut?copy().timeout(d.xp_awarded):copy().again(d.xp_awarded)} ✓ ${d.correctAnswer}. ${d.explanation}`;
        progress=progress.filter(p=>p.question_key!==q.key);progress.push({question_key:q.key,completed_at:new Date().toISOString(),xp_awarded:0});showNext();
      }else{
        f.textContent=`${timedOut?copy().timeout(d.xp_awarded):copy().again(d.xp_awarded)} ${d.hint||q.hint}`;
        setTimeout(()=>{document.querySelectorAll(".quiz-choice").forEach(b=>b.disabled=false);startTimer();},650);
      }
    }
    busy=false;
  }
  function open(){returnFocus=document.activeElement;$("#daily-quiz-modal").hidden=false;document.body.classList.add("quiz-open");if(questions.length){index=questions.findIndex(q=>!completed().has(q.key));if(index<0)index=questions.length;render();}else{ensureQuestionsAndRender();}$(".quiz-card").focus();}
  function close(){stopTimer();$("#daily-quiz-modal").hidden=true;document.body.classList.remove("quiz-open");returnFocus?.focus?.();}
  $("#daily-quiz-open")?.addEventListener("click",open);$("#quiz-close")?.addEventListener("click",close);$("[data-quiz-close]")?.addEventListener("click",close);
  $("#quiz-next")?.addEventListener("click",async()=>{const b=$("#quiz-next");if(b.dataset.retry==="true"){b.dataset.retry="";await ensureQuestionsAndRender();window.PMSfx?.play("tick");return;}if(b.dataset.practice==="true"){b.dataset.practice="";if(await load(round+1)){index=0;render();}}else{index++;render();}window.PMSfx?.play("tick");});
  document.addEventListener("keydown",e=>{const modal=$("#daily-quiz-modal");if(modal?.hidden)return;if(e.key==="Escape"){close();return;}if(e.key==="Tab"){const list=[...modal.querySelectorAll("button:not([disabled])")].filter(el=>!el.hidden);if(!list.length)return;const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  load();
})();
