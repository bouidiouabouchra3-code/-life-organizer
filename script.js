const KEYS={tasks:"lifeOrganizer.tasks.v2",notes:"lifeOrganizer.notes.v1",ideas:"lifeOrganizer.ideas.v1",transactions:"lifeOrganizer.transactions.v1",habits:"lifeOrganizer.habits.v1",study:"lifeOrganizer.study.v1",goals:"lifeOrganizer.goals.v1",moods:"lifeOrganizer.moods.v1"};
let tasks=load(KEYS.tasks),notes=load(KEYS.notes),ideas=load(KEYS.ideas),transactions=load(KEYS.transactions),habits=load(KEYS.habits),studyItems=load(KEYS.study),goals=load(KEYS.goals),moods=load(KEYS.moods);
let taskFilter="all",noteFilter="all",ideaFilter="all",expenseFilter="all",habitFilter="all",studyFilter="all",studySelectedDay="",goalFilter="all";
let taskCategoryFilter="all",taskPriorityFilter="all",expenseCategoryFilter="all",goalCategoryFilter="all",globalType="all",globalSort="newest";
let calendarCursor=new Date();calendarCursor.setDate(1);calendarCursor.setHours(12,0,0,0);
let calendarSelectedDate=dateKey();
let calendarTypeFilter="all";
let moodMonthCursor=new Date();moodMonthCursor.setDate(1);moodMonthCursor.setHours(12,0,0,0);
let currency=localStorage.getItem("lifeOrganizer.currency.v1")||"ج.م";

const BACKUP_META_KEY="lifeOrganizer.backupMeta.v1";
const TASK_RECURRENCE_EXCEPTIONS_KEY="lifeOrganizer.taskRecurrenceExceptions.v1";
const REMINDER_STATE_KEY="lifeOrganizer.reminderState.v1";
const PRIVACY_KEY="lifeOrganizer.privacy.v1";
const APPEARANCE_KEY="lifeOrganizer.appearance.v1";
const BACKUP_FORMAT_VERSION=1;
const APP_VERSION="2.2";
const PATCH_VERSION="P20";
let pendingImportData=null;
let taskRecurrenceExceptions=load(TASK_RECURRENCE_EXCEPTIONS_KEY);
let reminderFilter="all";
let reminderState=(()=>{try{const x=JSON.parse(localStorage.getItem(REMINDER_STATE_KEY)||"{}");return x&&typeof x==="object"?x:{fired:{}}}catch{return{fired:{}}}})();
if(!reminderState.fired||typeof reminderState.fired!=="object")reminderState.fired={};
let privacySettings=loadPrivacySettings();
let privacyLocked=false;
let privacyHiddenAt=0;
let unlockFailures=0;
let unlockBlockedUntil=0;
let pinModalMode="setup";
let appearanceSettings=loadAppearanceSettings();
let analyticsMonth=currentMonth();
let sharePreset="today";

const $=id=>document.getElementById(id);





function shareDateRange(){
 const mode=$("shareRange")?$("shareRange").value:"today",start=dateKey(),dates=[];
 if(mode==="today")return {start,end:start,label:"اليوم"};
 if(mode==="week"){
   const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+6);
   return {start,end:dateKeyFrom(d),label:"7 أيام"}
 }
 const now=new Date(),end=new Date(now.getFullYear(),now.getMonth()+1,0,12);
 return {start:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`,end:dateKeyFrom(end),label:"هذا الشهر"}
}
function inShareRange(date,range){return !!date&&date>=range.start&&date<=range.end}
function shareSectionCount(){
 return ["shareTasks","shareStudy","shareHabits","shareGoals"].filter(id=>$(id)&&$(id).checked).length
}
function shareDateHeading(key){
 const d=new Date(`${key}T12:00:00`);
 return new Intl.DateTimeFormat("ar",{weekday:"long",day:"numeric",month:"short"}).format(d)
}
function shareTimePart(time){
 return $("shareTimes")&&$("shareTimes").checked&&time?` • ${timeLabel(time)}`:""
}
function shareCategoryPart(label){
 return $("shareCategories")&&$("shareCategories").checked&&label?` • ${label}`:""
}
function shareTasksLines(range,includeCompleted){
 ensureRecurringTasksThrough(range.end);
 return tasks.filter(t=>inShareRange(t.date,range)&&(includeCompleted||!t.completed)).sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||""))).map(t=>({
   date:t.date,
   text:`${t.completed?"☑️":"⬜"} ${t.title}${shareTimePart(t.time)}${shareCategoryPart(taskLabels[t.category]||"أخرى")}`
 }))
}
function shareStudyLines(range,includeCompleted){
 return studyItems.filter(s=>inShareRange(s.date,range)&&(includeCompleted||!s.completed)).sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||""))).map(s=>({
   date:s.date,
   text:`${s.completed?"☑️":"🎓"} ${s.title}${shareTimePart(s.time)}${shareCategoryPart(s.subject||"")}`
 }))
}
function shareHabitLines(range,includeCompleted){
 const rows=[],start=new Date(`${range.start}T12:00:00`),end=new Date(`${range.end}T12:00:00`);
 for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
   const key=dateKeyFrom(d);
   habits.filter(h=>!h.paused&&habitDueOn(h,d)).forEach(h=>{
     const done=habitDoneOn(h,d);if(!includeCompleted&&done)return;
     rows.push({date:key,text:`${done?"☑️":"🌿"} ${h.title}${$("shareTimes")&&$("shareTimes").checked&&h.reminder==="enabled"&&h.reminderTime?` • ${timeLabel(h.reminderTime)}`:""}`})
   })
 }
 return rows
}
function shareGoalLines(range,includeCompleted){
 return goals.filter(g=>g.targetDate&&inShareRange(g.targetDate,range)&&(includeCompleted||goalProgress(g)<100)).sort((a,b)=>a.targetDate.localeCompare(b.targetDate)).map(g=>({
   date:g.targetDate,
   text:`🎯 ${g.title} • ${goalProgress(g)}%${shareCategoryPart(goalLabels[g.category]||"أخرى")}`
 }))
}
function groupShareLines(title,emoji,rows){
 if(!rows.length)return "";
 const byDate={};rows.forEach(r=>(byDate[r.date]||(byDate[r.date]=[])).push(r.text));
 let out=`\n${emoji} ${title}\n`;
 Object.keys(byDate).sort().forEach(date=>{
   out+=`\n${shareDateHeading(date)}\n`;
   byDate[date].forEach(line=>out+=`• ${line}\n`)
 });
 return out.trimEnd()+"\n"
}
function buildShareText(){
 const range=shareDateRange(),includeCompleted=$("shareCompleted").value==="yes";
 const sections=[];
 if($("shareTasks").checked)sections.push(groupShareLines("المهام","✅",shareTasksLines(range,includeCompleted)));
 if($("shareStudy").checked)sections.push(groupShareLines("الدراسة","🎓",shareStudyLines(range,includeCompleted)));
 if($("shareHabits").checked)sections.push(groupShareLines("العادات","🌿",shareHabitLines(range,includeCompleted)));
 if($("shareGoals").checked)sections.push(groupShareLines("الأهداف","🎯",shareGoalLines(range,includeCompleted)));
 const body=sections.filter(Boolean).join("\n").trim();
 return `Bloomie 🌸 — ${range.label}\n${body||"\nلا توجد عناصر ضمن الاختيارات الحالية."}\n\n— مشاركة انتقائية من Bloomie`;
}
function renderSharePreview(){
 if(!$("sharePreview"))return;
 $("shareSelectionCount").textContent=`${shareSectionCount()} أقسام`;
 $("sharePreview").textContent=buildShareText();
 if($("shareHomeText"))$("shareHomeText").textContent=shareSectionCount()?`${shareSectionCount()} أقسام جاهزة للمشاركة`:"اختاري فقط الأشياء اللي حابة تشاركيها";
 if($("moreShareText"))$("moreShareText").textContent=`${shareDateRange().label} • ${shareSectionCount()} أقسام`;
 document.querySelectorAll("[data-share-preset]").forEach(b=>b.classList.toggle("active",b.dataset.sharePreset===sharePreset))
}
function setShareChecks({tasks=false,study=false,habits=false,goals=false}={}){
 $("shareTasks").checked=tasks;$("shareStudy").checked=study;$("shareHabits").checked=habits;$("shareGoals").checked=goals
}
function applySharePreset(preset){
 sharePreset=preset;
 if(preset==="today"){
   setShareChecks({tasks:true,study:true,habits:true,goals:false});$("shareRange").value="today";$("shareCompleted").value="no"
 }else if(preset==="tasks"){
   setShareChecks({tasks:true});$("shareRange").value="week";$("shareCompleted").value="no"
 }else if(preset==="study"){
   setShareChecks({study:true});$("shareRange").value="week";$("shareCompleted").value="no"
 }
 renderSharePreview()
}
async function nativeSharePlan(){
 const text=buildShareText();
 if(navigator.share){
   try{await navigator.share({title:"Bloomie 🌸",text});return}catch(err){if(err&&err.name==="AbortError")return}
 }
 await copySharePlan()
}
async function copySharePlan(){
 const text=buildShareText();
 try{await navigator.clipboard.writeText(text);toast("تم نسخ خطة المشاركة 📋")}
 catch{
   const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();
   try{document.execCommand("copy");toast("تم نسخ خطة المشاركة 📋")}catch{toast("تعذر النسخ تلقائيًا")}
   ta.remove()
 }
}
function downloadSharePlan(){
 const text=buildShareText(),blob=new Blob([text],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=`Bloomie-plan-${dateKey()}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("تم تجهيز ملف TXT")
}
function renderSharing(){renderSharePreview()}

function openQuickAdd(){
 if(privacyLocked)return;
 showModal("quickAddModal")
}
function closeQuickAdd(){hideModal("quickAddModal")}
function quickAdd(type){
 closeQuickAdd();
 if(type==="task"){
   openTask();$("taskDate").value=dateKey();setTimeout(()=>$("taskTitle").focus(),50);return
 }
 if(type==="expense"){
   openTransaction();$("transactionType").value="expense";$("transactionDate").value=dateKey();setTimeout(()=>$("transactionAmount").focus(),50);return
 }
 if(type==="idea"){
   openIdea();setTimeout(()=>$("ideaTitle").focus(),50);return
 }
 if(type==="note"){
   openNote();setTimeout(()=>$("noteTitle").focus(),50);return
 }
 if(type==="study"){
   openStudy();$("studyDate").value=dateKey();setTimeout(()=>$("studyTitle").focus(),50);return
 }
 if(type==="goal"){
   openGoal();setTimeout(()=>$("goalTitle").focus(),50);return
 }
 if(type==="habit"){
   openHabit();setTimeout(()=>$("habitTitle").focus(),50);return
 }
 if(type==="mood"){
   openMood(null,dateKey());return
 }
}

function analyticsMonthDate(month=analyticsMonth){
 const [y,m]=String(month||currentMonth()).split("-").map(Number);
 return new Date(y,m-1,1,12)
}
function analyticsMonthTitle(month=analyticsMonth){
 return new Intl.DateTimeFormat("ar",{month:"long",year:"numeric"}).format(analyticsMonthDate(month))
}
function shiftMonthKey(month,delta){
 const d=analyticsMonthDate(month);d.setMonth(d.getMonth()+delta);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`
}
function monthDayKeys(month){
 const d=analyticsMonthDate(month),y=d.getFullYear(),m=d.getMonth(),last=new Date(y,m+1,0,12).getDate();
 const today=dateKey(),keys=[];
 for(let day=1;day<=last;day++){
   const x=new Date(y,m,day,12),key=dateKeyFrom(x);
   if(month===currentMonth()&&key>today)break;
   keys.push(key)
 }
 return keys
}
function habitMonthStats(month){
 const keys=monthDayKeys(month);let due=0,done=0;const perHabit=[];
 habits.forEach(h=>{
   let hdue=0,hdone=0;
   const created=h.createdAt?dateKeyFrom(new Date(h.createdAt)):null;
   keys.forEach(key=>{
     const d=new Date(`${key}T12:00:00`);
     if(created&&key<created)return;
     if(Array.isArray(h.days)&&h.days.includes(d.getDay())){
       hdue++;if(h.completions&&h.completions[key])hdone++
     }
   });
   due+=hdue;done+=hdone;if(hdue)perHabit.push({h,due:hdue,done:hdone,rate:Math.round(hdone/hdue*100)})
 });
 return {due,done,rate:due?Math.round(done/due*100):0,perHabit}
}
function analyticsData(month=analyticsMonth){
 const taskMonth=tasks.filter(t=>monthKeyFromDate(t.date)===month);
 const taskDone=taskMonth.filter(t=>t.completed).length;
 const tx=transactions.filter(t=>monthKeyFromDate(t.date)===month);
 const expenseTx=tx.filter(t=>t.type==="expense"),incomeTx=tx.filter(t=>t.type==="income");
 const expense=expenseTx.reduce((s,t)=>s+Number(t.amount||0),0),income=incomeTx.reduce((s,t)=>s+Number(t.amount||0),0);
 const study=studyItems.filter(s=>monthKeyFromDate(s.date)===month);
 const studyDone=study.filter(s=>s.completed),studyMinutes=studyDone.reduce((sum,s)=>sum+Number(s.duration||0),0),studyPlanned=study.reduce((sum,s)=>sum+Number(s.duration||0),0);
 const goalMonth=goals.filter(g=>g.targetDate&&monthKeyFromDate(g.targetDate)===month),goalDone=goalMonth.filter(g=>goalProgress(g)>=100).length;
 const moodMonth=moods.filter(m=>monthKeyFromDate(m.date)===month),moodCommonKey=moodCommon(moodMonth);
 const habitsMonth=habitMonthStats(month);
 const activity=taskDone+habitsMonth.done+studyDone.length+moodMonth.length;
 return {
   month,taskMonth,taskDone,taskRate:taskMonth.length?Math.round(taskDone/taskMonth.length*100):0,
   tx,expenseTx,incomeTx,expense,income,
   study,studyDone,studyMinutes,studyPlanned,
   goalMonth,goalDone,goalRate:goalMonth.length?Math.round(goalDone/goalMonth.length*100):0,
   moodMonth,moodCommonKey,habitsMonth,activity
 }
}
function formatHours(minutes){
 const n=Number(minutes)||0;if(!n)return"0 س";
 if(n<60)return`${n} د`;
 const h=Math.floor(n/60),m=n%60;return m?`${h}س ${m}د`:`${h} س`
}
function analyticsCompareText(current,previous,suffix="",reverse=false){
 if(current===previous)return {cls:"same",text:"— بدون تغيير",detail:`${current}${suffix}`};
 if(previous===0)return {cls:"up",text:current>0?"جديد هذا الشهر":"—",detail:`${current}${suffix}`};
 const pct=Math.round(Math.abs(current-previous)/Math.abs(previous)*100);
 const up=current>previous,arrow=up?"↑":"↓";
 return {cls:up?"up":"down",text:`${arrow} ${pct}%`,detail:`${current}${suffix} مقابل ${previous}${suffix}`}
}
function analyticsWeeklyActivity(month){
 const d=analyticsMonthDate(month),y=d.getFullYear(),m=d.getMonth(),last=new Date(y,m+1,0,12).getDate();
 const buckets=[];
 for(let start=1;start<=last;start+=7)buckets.push({start,end:Math.min(last,start+6),value:0});
 const add=(date,count=1)=>{
   if(monthKeyFromDate(date)!==month)return;
   const day=Number(String(date).slice(8,10)),idx=Math.floor((day-1)/7);if(buckets[idx])buckets[idx].value+=count
 };
 tasks.filter(t=>t.completed).forEach(t=>add(t.date));
 habits.forEach(h=>Object.entries(h.completions||{}).forEach(([key,v])=>{if(v)add(key)}));
 studyItems.filter(s=>s.completed).forEach(s=>add(s.date));
 moods.forEach(m=>add(m.date));
 return buckets
}
function renderAnalyticsBreakdown(target,rows,emptyText){
 const el=$(target);if(!el)return;
 if(!rows.length){el.innerHTML=`<div class="analyticsEmpty">${esc(emptyText)}</div>`;return}
 const max=Math.max(...rows.map(r=>Number(r.value)||0),1);
 el.innerHTML=rows.map(r=>`<div class="analyticsBreakdownRow"><i>${r.icon||"•"}</i><div class="analyticsBreakdownMain"><div class="analyticsBreakdownTop"><span>${esc(r.label)}</span><strong>${esc(r.main||String(r.value))}</strong></div><div class="analyticsMiniBar"><div style="width:${Math.round((Number(r.value)||0)/max*100)}%"></div></div></div><small>${esc(r.side||"")}</small></div>`).join("")
}
function renderAnalytics(){
 if(!$("analyticsView"))return;
 if(!$("analyticsMonth").value)$("analyticsMonth").value=analyticsMonth;
 analyticsMonth=$("analyticsMonth").value||currentMonth();
 const selectedDate=analyticsMonthDate(analyticsMonth),end=new Date(selectedDate.getFullYear(),selectedDate.getMonth()+1,0,12);
 if(analyticsMonth>=currentMonth())ensureRecurringTasksThrough(dateKeyFrom(end));

 const d=analyticsData(analyticsMonth),prev=analyticsData(shiftMonthKey(analyticsMonth,-1));
 $("analyticsMonth").value=analyticsMonth;$("analyticsMonthTitle").textContent=analyticsMonthTitle();
 $("analyticsSummary").textContent=`ملخص ${analyticsMonthTitle()} • ${d.activity} نشاط مسجل`;
 $("analyticsActivityScore").textContent=d.activity;
 $("analyticsHeroText").textContent=d.activity?`عندكِ ${d.activity} نشاط مسجل في هذا الشهر بين مهام وعادات ودراسة ومزاج.`:"لا توجد أنشطة مسجلة لهذا الشهر حتى الآن.";

 $("analyticsTaskRate").textContent=d.taskRate+"%";$("analyticsTaskSub").textContent=`${d.taskDone} من ${d.taskMonth.length} مكتملة`;
 $("analyticsHabitRate").textContent=d.habitsMonth.rate+"%";$("analyticsHabitSub").textContent=`${d.habitsMonth.done} من ${d.habitsMonth.due} تسجيل`;
 $("analyticsStudyHours").textContent=formatHours(d.studyMinutes);$("analyticsStudySub").textContent=`${d.studyDone.length} من ${d.study.length} جلسة مكتملة`;
 $("analyticsExpenseTotal").textContent=money(d.expense);$("analyticsIncomeSub").textContent=`دخل ${money(d.income)}`;
 $("analyticsGoalRate").textContent=d.goalRate+"%";$("analyticsGoalSub").textContent=`${d.goalDone} من ${d.goalMonth.length} مستهدفة`;
 const moodInfoMonth=d.moodCommonKey?moodInfo[d.moodCommonKey]:null;
 $("analyticsMoodCommon").textContent=moodInfoMonth?moodInfoMonth.emoji:"—";$("analyticsMoodSub").textContent=d.moodMonth.length?`${d.moodMonth.length} أيام • ${moodInfoMonth?.label||""}`:"0 أيام مسجلة";
 $("analyticsStudyPlanned").textContent=`${d.studyPlanned} دقيقة مخططة`;

 const taskCmp=analyticsCompareText(d.taskRate,prev.taskRate,"%");
 const habitCmp=analyticsCompareText(d.habitsMonth.rate,prev.habitsMonth.rate,"%");
 const studyCmp=analyticsCompareText(d.studyMinutes,prev.studyMinutes," د");
 const expenseCmp=analyticsCompareText(Math.round(d.expense),Math.round(prev.expense),` ${currency}`);
 $("analyticsCompareLabel").textContent=analyticsMonthTitle(shiftMonthKey(analyticsMonth,-1));
 $("analyticsCompareGrid").innerHTML=[
   ["✅","معدل المهام",taskCmp],["🌿","معدل العادات",habitCmp],["🎓","دقائق الدراسة",studyCmp],["🪙","المصروف",expenseCmp]
 ].map(([icon,label,c])=>`<div class="compareCard"><span>${icon} ${label}</span><strong class="${c.cls}">${c.text}</strong><small>${esc(c.detail)}</small></div>`).join("");

 const weeks=analyticsWeeklyActivity(analyticsMonth),maxWeek=Math.max(...weeks.map(w=>w.value),1);
 $("analyticsWeeklyChart").innerHTML=weeks.map((w,i)=>`<div class="weekBarWrap"><div class="weekBarValue">${w.value}</div><div class="weekBar" style="height:${Math.max(4,Math.round(w.value/maxWeek*100))}%"></div><div class="weekBarLabel">${w.start}–${w.end}</div></div>`).join("");

 const taskCats={};d.taskMonth.forEach(t=>{const key=t.category||"other";if(!taskCats[key])taskCats[key]={total:0,done:0};taskCats[key].total++;if(t.completed)taskCats[key].done++});
 renderAnalyticsBreakdown("analyticsTaskCategories",
   Object.entries(taskCats).map(([key,v])=>({icon:taskIcons[key]||"✨",label:taskLabels[key]||"أخرى",value:v.total,main:`${v.done}/${v.total}`,side:v.total?`${Math.round(v.done/v.total*100)}%`:"0%"})).sort((a,b)=>b.value-a.value),
   "لا توجد مهام مجدولة في هذا الشهر."
 );

 const expCats={};d.expenseTx.forEach(t=>expCats[t.category]=(expCats[t.category]||0)+Number(t.amount||0));
 renderAnalyticsBreakdown("analyticsExpenseCategories",
   Object.entries(expCats).map(([key,val])=>{const c=expenseCategories[key]||expenseCategories.other;return{icon:c.icon,label:c.label,value:val,main:money(val),side:d.expense?`${Math.round(val/d.expense*100)}%`:"0%"}}).sort((a,b)=>b.value-a.value).slice(0,6),
   "لا توجد مصروفات في هذا الشهر."
 );

 const moodCounts={great:0,good:0,okay:0,low:0,bad:0};d.moodMonth.forEach(m=>{if(moodCounts[m.mood]!==undefined)moodCounts[m.mood]++});
 $("analyticsMoodBreakdown").innerHTML=Object.entries(moodCounts).map(([key,count])=>`<div class="moodAnalyticsItem"><b>${moodInfo[key].emoji}</b><span>${moodInfo[key].label}</span><small>${count}</small></div>`).join("");

 const best=[...d.habitsMonth.perHabit].sort((a,b)=>b.rate-a.rate||b.done-a.done)[0];
 $("analyticsBestHabit").innerHTML=best?`<div class="bestHabitCard"><div class="bestHabitTop"><b>${esc(best.h.icon||"🌿")}</b><div><h4>${esc(best.h.title)}</h4><p>${best.done} من ${best.due} أيام مجدولة</p></div></div><div class="bestHabitRate"><span>نسبة المتابعة</span><strong>${best.rate}%</strong></div><div class="bestHabitTrack"><div style="width:${best.rate}%"></div></div></div>`:`<div class="analyticsEmpty">لا توجد عادات مجدولة في هذا الشهر.</div>`;

 const subjects={};d.study.forEach(s=>{const key=s.subject||"بدون مادة";if(!subjects[key])subjects[key]={planned:0,done:0,sessions:0};subjects[key].planned+=Number(s.duration||0);if(s.completed){subjects[key].done+=Number(s.duration||0);subjects[key].sessions++}});
 renderAnalyticsBreakdown("analyticsStudySubjects",
   Object.entries(subjects).map(([subject,v])=>({icon:"📚",label:subject,value:v.planned||v.sessions,main:formatHours(v.done),side:`${v.sessions} جلسة` })).sort((a,b)=>b.value-a.value),
   "لا توجد دراسة مجدولة في هذا الشهر."
 );

 if($("analyticsHomeText"))$("analyticsHomeText").textContent=d.activity?`${d.activity} نشاط • مهام ${d.taskRate}%`:"شوفي تقدمك في مكان واحد";
 if($("analyticsCardText"))$("analyticsCardText").textContent=d.activity?`مهام ${d.taskRate}% • عادات ${d.habitsMonth.rate}%`:"ملخص هذا الشهر";
 if($("moreAnalyticsText"))$("moreAnalyticsText").textContent=d.activity?`${d.activity} نشاط هذا الشهر`:"ملخص هذا الشهر"
}
function analyticsMoveMonth(delta){analyticsMonth=shiftMonthKey(analyticsMonth,delta);$("analyticsMonth").value=analyticsMonth;renderAnalytics()}
function monthlySummaryText(){
 const d=analyticsData(analyticsMonth),mood=d.moodCommonKey?moodInfo[d.moodCommonKey]:null;
 return `Bloomie — ${analyticsMonthTitle()}
✅ المهام: ${d.taskDone}/${d.taskMonth.length} (${d.taskRate}%)
🌿 العادات: ${d.habitsMonth.done}/${d.habitsMonth.due} (${d.habitsMonth.rate}%)
🎓 الدراسة المكتملة: ${formatHours(d.studyMinutes)} — ${d.studyDone.length}/${d.study.length} جلسة
🪙 المصروف: ${money(d.expense)}
💰 الدخل: ${money(d.income)}
🎯 الأهداف المستهدفة: ${d.goalDone}/${d.goalMonth.length}
🌸 المزاج: ${d.moodMonth.length} أيام${mood?` — الأكثر ${mood.emoji} ${mood.label}`:""}
📊 النشاط المسجل: ${d.activity}`;
}
async function copyMonthlySummary(){
 const text=monthlySummaryText();
 try{await navigator.clipboard.writeText(text);toast("تم نسخ ملخص الشهر 📋")}
 catch{toast("تعذر النسخ تلقائيًا")}
}

const appearanceThemes={
 bloom:{label:"Bloom Pink",themeColor:"#f8dce7"},
 lavender:{label:"Lavender Dream",themeColor:"#e9e1ff"},
 mint:{label:"Mint Garden",themeColor:"#dff4e8"},
 sky:{label:"Sky Cloud",themeColor:"#deedff"},
 peach:{label:"Peach Glow",themeColor:"#ffe5d2"}
};
const appearanceBackgrounds={soft:"ناعمة",clean:"نظيفة",dots:"نقط كيوت",flowers:"زهور"};
const appearanceMascots={
 cat:{emoji:"🐱",label:"القطة"},
 kitty:{emoji:"😺",label:"Kitty"},
 bunny:{emoji:"🐰",label:"الأرنوبة"},
 bear:{emoji:"🐻",label:"الدبدوب"},
 flower:{emoji:"🌸",label:"Bloom"}
};
const appearanceCardStyles={round:"دائري",soft:"ناعم",compact:"Compact"};
function normalizeAppearance(a){
 const x=a&&typeof a==="object"?a:{};
 return {
   theme:appearanceThemes[x.theme]?x.theme:"bloom",
   background:appearanceBackgrounds[x.background]?x.background:"soft",
   mascot:appearanceMascots[x.mascot]?x.mascot:"cat",
   cardStyle:appearanceCardStyles[x.cardStyle]?x.cardStyle:"round"
 }
}
function loadAppearanceSettings(){
 try{return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY)||"{}"))}
 catch{return normalizeAppearance({})}
}
function saveAppearanceSettings(){localStorage.setItem(APPEARANCE_KEY,JSON.stringify(appearanceSettings))}
function applyAppearance(saveIt=false){
 appearanceSettings=normalizeAppearance(appearanceSettings);
 const body=document.body;if(!body)return;
 body.dataset.theme=appearanceSettings.theme;body.dataset.bg=appearanceSettings.background;body.dataset.cardStyle=appearanceSettings.cardStyle;
 const mascot=appearanceMascots[appearanceSettings.mascot]||appearanceMascots.cat;
 if($("mascot"))$("mascot").textContent=mascot.emoji;
 if($("previewMascot"))$("previewMascot").textContent=mascot.emoji;
 const lockCat=document.querySelector(".lockCat");if(lockCat)lockCat.textContent=mascot.emoji;
 const theme=appearanceThemes[appearanceSettings.theme];
 if($("appThemeColor"))$("appThemeColor").setAttribute("content",theme.themeColor);
 if(saveIt)saveAppearanceSettings();
 renderAppearance()
}
function renderAppearance(){
 if(!$("appearanceView"))return;
 const theme=appearanceThemes[appearanceSettings.theme],mascot=appearanceMascots[appearanceSettings.mascot];
 $("previewThemeName").textContent=theme.label;$("themeChoiceLabel").textContent=theme.label;$("backgroundChoiceLabel").textContent=appearanceBackgrounds[appearanceSettings.background];$("mascotChoiceLabel").textContent=mascot.label;
 if($("appearanceHomeText"))$("appearanceHomeText").textContent=`${theme.label} • ${mascot.emoji} ${mascot.label}`;
 if($("moreAppearanceText"))$("moreAppearanceText").textContent=`${theme.label} • ${appearanceBackgrounds[appearanceSettings.background]}`;
 if($("appearanceLauncherIcon"))$("appearanceLauncherIcon").textContent=mascot.emoji;
 

document.querySelectorAll("[data-share-preset]").forEach(b=>b.onclick=()=>applySharePreset(b.dataset.sharePreset));
["shareTasks","shareStudy","shareHabits","shareGoals","shareTimes","shareCategories"].forEach(id=>$(id).onchange=()=>{sharePreset="custom";renderSharePreview()});
$("shareRange").onchange=()=>{sharePreset="custom";renderSharePreview()};
$("shareCompleted").onchange=()=>{sharePreset="custom";renderSharePreview()};
$("refreshSharePreview").onclick=renderSharePreview;
$("nativeSharePlan").onclick=nativeSharePlan;
$("copySharePlan").onclick=copySharePlan;
$("downloadSharePlan").onclick=downloadSharePlan;

$("analyticsPrevMonth").onclick=()=>analyticsMoveMonth(-1);
$("analyticsNextMonth").onclick=()=>analyticsMoveMonth(1);
$("analyticsThisMonth").onclick=()=>{analyticsMonth=currentMonth();$("analyticsMonth").value=analyticsMonth;renderAnalytics()};
$("analyticsMonth").onchange=()=>{analyticsMonth=$("analyticsMonth").value||currentMonth();renderAnalytics()};
$("copyMonthlySummary").onclick=copyMonthlySummary;

document.querySelectorAll("[data-theme-choice]").forEach(b=>b.classList.toggle("active",b.dataset.themeChoice===appearanceSettings.theme));
 document.querySelectorAll("[data-bg-choice]").forEach(b=>b.classList.toggle("active",b.dataset.bgChoice===appearanceSettings.background));
 document.querySelectorAll("[data-mascot-choice]").forEach(b=>b.classList.toggle("active",b.dataset.mascotChoice===appearanceSettings.mascot));
 document.querySelectorAll("[data-card-style]").forEach(b=>b.classList.toggle("active",b.dataset.cardStyle===appearanceSettings.cardStyle))
}
function chooseAppearance(kind,value){
 if(kind==="theme"&&appearanceThemes[value])appearanceSettings.theme=value;
 if(kind==="background"&&appearanceBackgrounds[value])appearanceSettings.background=value;
 if(kind==="mascot"&&appearanceMascots[value])appearanceSettings.mascot=value;
 if(kind==="cardStyle"&&appearanceCardStyles[value])appearanceSettings.cardStyle=value;
 applyAppearance(true);toast("تم حفظ شكل Bloomie ✨")
}
function resetAppearance(){
 appearanceSettings=normalizeAppearance({});applyAppearance(true);toast("رجعنا لشكل Bloomie الأصلي 🌸")
}

function loadPrivacySettings(){
 try{
   const p=JSON.parse(localStorage.getItem(PRIVACY_KEY)||"{}");
   return {
     enabled:!!p.enabled,
     hash:typeof p.hash==="string"?p.hash:"",
     salt:typeof p.salt==="string"?p.salt:"",
     autoLockMinutes:[1,5,15,30].includes(Number(p.autoLockMinutes))?Number(p.autoLockMinutes):5,
     hideNotificationDetails:p.hideNotificationDetails!==false
   }
 }catch{return{enabled:false,hash:"",salt:"",autoLockMinutes:5,hideNotificationDetails:true}}
}
function savePrivacySettings(){localStorage.setItem(PRIVACY_KEY,JSON.stringify(privacySettings))}
function pinValid(pin){return /^\d{4,6}$/.test(pin)}
function bytesToBase64(bytes){
 let s="";bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s)
}
function randomSalt(){
 const a=new Uint8Array(16);crypto.getRandomValues(a);return bytesToBase64(a)
}
async function hashPin(pin,salt){
 if(!window.crypto||!crypto.subtle)throw new Error("crypto unavailable");
 const data=new TextEncoder().encode(`${salt}:${pin}`);
 const digest=await crypto.subtle.digest("SHA-256",data);
 return bytesToBase64(new Uint8Array(digest))
}
async function verifyPin(pin){
 if(!privacySettings.enabled||!privacySettings.hash||!privacySettings.salt)return false;
 try{return (await hashPin(pin,privacySettings.salt))===privacySettings.hash}catch{return false}
}
function renderPrivacy(){
 if(!$("privacyView"))return;
 const on=privacySettings.enabled;
 $("privacyShield").textContent=on?"🔒":"🔓";
 $("privacyStatusTitle").textContent=on?"PIN مفعّل":"PIN غير مفعّل";
 $("privacyStatusText").textContent=on?`القفل التلقائي بعد ${privacySettings.autoLockMinutes} دقيقة من مغادرة التطبيق.`:"يمكنك إضافة PIN من 4 إلى 6 أرقام.";
 $("privacyStatusPill").textContent=on?"ON":"OFF";$("privacyStatusPill").classList.toggle("on",on);
 $("setupPin").classList.toggle("hidden",on);$("changePin").classList.toggle("hidden",!on);$("removePin").classList.toggle("hidden",!on);
 $("lockNow").disabled=!on;$("autoLockMinutes").disabled=!on;$("hideNotificationDetails").disabled=!on;
 $("autoLockMinutes").value=String(privacySettings.autoLockMinutes);$("hideNotificationDetails").value=privacySettings.hideNotificationDetails?"yes":"no";
 if($("privacyHomeText"))$("privacyHomeText").textContent=on?"PIN مفعّل • بيانات الشاشة مقفلة":"فعّلي PIN لحماية شاشة Bloomie";
 if($("privacyHomeBadge")){$("privacyHomeBadge").textContent=on?"ON":"OFF";$("privacyHomeBadge").classList.toggle("on",on)}
 if($("morePrivacyText"))$("morePrivacyText").textContent=on?"PIN مفعّل":"PIN غير مفعّل"
}
function showPrivacyLock(){
 if(!privacySettings.enabled)return;
 privacyLocked=true;
 if($("quickAddFab"))$("quickAddFab").classList.add("fabHidden");
 $("privacyLock").classList.remove("hidden");$("unlockPin").value="";$("unlockMessage").textContent="PIN من 4 إلى 6 أرقام";$("unlockMessage").classList.remove("error");
 document.documentElement.classList.remove("privacy-boot-lock");
 setTimeout(()=>$("unlockPin").focus(),80)
}
function hidePrivacyLock(){
 privacyLocked=false;$("privacyLock").classList.add("hidden");$("unlockPin").value="";unlockFailures=0;unlockBlockedUntil=0;if($("quickAddFab")&&!document.querySelector(".modal:not(.hidden)"))$("quickAddFab").classList.remove("fabHidden")
}
function openPinSetup(mode){
 pinModalMode=mode;$("pinForm").reset();
 const changing=mode==="change";$("currentPinWrap").classList.toggle("hidden",!changing);
 $("currentPin").required=changing;$("pinModalTitle").textContent=changing?"تغيير PIN":"تفعيل PIN";$("savePin").textContent=changing?"حفظ PIN الجديد 🔒":"تفعيل PIN 🔒";
 showModal("pinModal")
}
async function handlePinSave(){
 const current=$("currentPin").value.trim(),pin=$("newPin").value.trim(),confirmPin=$("confirmPin").value.trim();
 if(pinModalMode==="change"&&!(await verifyPin(current))){toast("PIN الحالي غير صحيح");return}
 if(!pinValid(pin)){toast("PIN لازم يكون من 4 إلى 6 أرقام");return}
 if(pin!==confirmPin){toast("تأكيد PIN غير مطابق");return}
 try{
   const salt=randomSalt(),hash=await hashPin(pin,salt);
   privacySettings={...privacySettings,enabled:true,salt,hash};
   savePrivacySettings();hideModal("pinModal");renderPrivacy();toast(pinModalMode==="change"?"تم تغيير PIN 🔒":"تم تفعيل PIN 🔒")
 }catch{toast("تعذر تفعيل PIN على هذا الجهاز")}
}
async function handleRemovePin(){
 const pin=$("removePinCurrent").value.trim();
 if(!(await verifyPin(pin))){toast("PIN غير صحيح");return}
 privacySettings={enabled:false,hash:"",salt:"",autoLockMinutes:5,hideNotificationDetails:true};
 savePrivacySettings();hideModal("removePinModal");hidePrivacyLock();renderPrivacy();toast("تمت إزالة PIN")
}
async function handleUnlock(){
 const now=Date.now();
 if(now<unlockBlockedUntil){$("unlockMessage").textContent=`حاولي بعد ${Math.ceil((unlockBlockedUntil-now)/1000)} ثانية`;$("unlockMessage").classList.add("error");return}
 const pin=$("unlockPin").value.trim();
 if(!pinValid(pin)){$("unlockMessage").textContent="أدخلي PIN من 4 إلى 6 أرقام";$("unlockMessage").classList.add("error");return}
 if(await verifyPin(pin)){hidePrivacyLock();checkReminders();return}
 unlockFailures++;$("unlockPin").value="";
 if(unlockFailures>=5){
   unlockBlockedUntil=Date.now()+30000;unlockFailures=0;$("unlockMessage").textContent="محاولات كثيرة — انتظري 30 ثانية";$("unlockMessage").classList.add("error")
 }else{
   $("unlockMessage").textContent=`PIN غير صحيح • متبقي ${5-unlockFailures} محاولات`;$("unlockMessage").classList.add("error")
 }
}
function privacyVisibilityChanged(){
 if(!privacySettings.enabled)return;
 if(document.hidden){privacyHiddenAt=Date.now();sessionStorage.setItem("bloomiePrivacyHiddenAt",String(privacyHiddenAt));return}
 const hiddenAt=privacyHiddenAt||Number(sessionStorage.getItem("bloomiePrivacyHiddenAt")||0);
 if(hiddenAt&&Date.now()-hiddenAt>=privacySettings.autoLockMinutes*60000)showPrivacyLock();
 privacyHiddenAt=0;sessionStorage.removeItem("bloomiePrivacyHiddenAt")
}
function initializePrivacy(){
 renderPrivacy();document.documentElement.classList.remove("privacy-boot-lock");
 if(privacySettings.enabled)showPrivacyLock()
}

const taskLabels={personal:"شخصي",study:"دراسة",home:"البيت",work:"شغل",other:"أخرى"};
const taskIcons={personal:"💗",study:"📚",home:"🏠",work:"💼",other:"✨"};
const priorities={low:"منخفضة",medium:"متوسطة",high:"عالية"};

const repeatLabels={none:"بدون تكرار",daily:"يوميًا",weekly:"أسبوعيًا",monthly:"شهريًا",custom:"أيام محددة"};

const noteLabels={personal:"شخصية",study:"دراسة",work:"شغل",other:"أخرى"};
const ideaLabels={project:"مشروع",life:"حياتي",study:"دراسة",other:"أخرى"};
const ideaIcons={project:"🛍️",life:"🌷",study:"🎓",other:"💡"};
const goalLabels={personal:"شخصي",study:"دراسة",health:"صحة",money:"مال",work:"شغل",other:"أخرى"};
const goalIcons={personal:"🌸",study:"🎓",health:"💗",money:"💰",work:"💼",other:"✨"};
const moodInfo={
 great:{emoji:"😍",label:"رائع",score:5},
 good:{emoji:"😊",label:"كويس",score:4},
 okay:{emoji:"😌",label:"عادي",score:3},
 low:{emoji:"😕",label:"ثقيل",score:2},
 bad:{emoji:"😢",label:"صعب",score:1}
};

const studyTypeLabels={study:"مذاكرة",class:"محاضرة / حصة",homework:"واجب",exam:"امتحان",review:"مراجعة",other:"أخرى"};
const studyTypeIcons={study:"📖",class:"🏫",homework:"✍️",exam:"📝",review:"🔁",other:"📌"};
const reminderLabels={
 none:"بدون تذكير",at_time:"في الوقت",five_min:"قبلها بـ 5 دقائق",fifteen_min:"قبلها بـ 15 دقيقة",
 thirty_min:"قبلها بـ 30 دقيقة",one_hour:"قبلها بساعة",one_day:"قبلها بيوم",two_days:"قبلها بيومين",
 same_day:"في نفس اليوم"
};
const studyReminderLabels=reminderLabels;


const expenseCategories={
 food:{label:"طعام ومشروبات",icon:"🍽️"},
 transport:{label:"مواصلات",icon:"🚕"},
 shopping:{label:"مشتريات",icon:"🛍️"},
 entertainment:{label:"ترفيه",icon:"🎮"},
 bills:{label:"فواتير",icon:"🧾"},
 health:{label:"صحة",icon:"💊"},
 education:{label:"دراسة",icon:"📚"},
 other:{label:"أخرى",icon:"✨"}
};
const incomeCategories={
 salary:{label:"راتب",icon:"💼"},
 gift:{label:"هدية",icon:"🎁"},
 freelance:{label:"عمل إضافي",icon:"💻"},
 refund:{label:"استرداد",icon:"↩️"},
 other:{label:"أخرى",icon:"✨"}
};


function load(key){try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
function save(key,data){localStorage.setItem(key,JSON.stringify(data))}
function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}

function monthKeyFromDate(s){return String(s||"").slice(0,7)}
function currentMonth(){return dateKey().slice(0,7)}

const weekOrder=[6,0,1,2,3,4,5];
const weekShort={6:"سبت",0:"أحد",1:"اثن",2:"ثلا",3:"أرب",4:"خمي",5:"جمع"};
function dateKeyFrom(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function startOfWeekSaturday(ref=new Date()){
 const d=new Date(ref);d.setHours(12,0,0,0);const diff=(d.getDay()+1)%7;d.setDate(d.getDate()-diff);return d
}
function currentWeekDates(){
 const start=startOfWeekSaturday();return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})
}
function habitDueOn(h,d){return Array.isArray(h.days)&&h.days.includes(d.getDay())}
function habitDoneOn(h,d){return !!(h.completions&&h.completions[dateKeyFrom(d)])}
function habitStreak(h){
 let d=new Date();d.setHours(12,0,0,0);
 if(habitDueOn(h,d)&&!habitDoneOn(h,d))d.setDate(d.getDate()-1);
 let count=0,guard=0;
 while(guard<365){
   if(habitDueOn(h,d)){
     if(habitDoneOn(h,d))count++;else break;
   }
   d.setDate(d.getDate()-1);guard++;
 }
 return count
}
function habitRate30(h){
 const today=new Date();today.setHours(12,0,0,0);let due=0,done=0;
 for(let i=0;i<30;i++){const d=new Date(today);d.setDate(today.getDate()-i);if(habitDueOn(h,d)){due++;if(habitDoneOn(h,d))done++}}
 return due?Math.round(done/due*100):0
}


function studyDateTime(item){
 const time=item.time||"23:59";const n=new Date(`${item.date}T${time}:00`).getTime();return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER
}
function studyWeekBounds(){
 const start=startOfWeekSaturday();const end=new Date(start);end.setDate(start.getDate()+6);end.setHours(23,59,59,999);return{start,end}
}
function studyIsThisWeek(item){
 const {start,end}=studyWeekBounds();const t=new Date(`${item.date}T12:00:00`).getTime();return t>=start.getTime()&&t<=end.getTime()
}
function normalizeReminderValue(v){
 if(v==="same_day")return"at_time";
 return v||"none"
}
function reminderOffsetMinutes(v){
 const map={at_time:0,five_min:5,fifteen_min:15,thirty_min:30,one_hour:60,one_day:1440,two_days:2880,same_day:0};
 return Object.prototype.hasOwnProperty.call(map,v)?map[v]:null
}
function dateTimeMs(date,time,defaultTime="09:00"){
 const v=new Date(`${date}T${time||defaultTime}:00`).getTime();
 return Number.isFinite(v)?v:null
}
function reminderDueAt(date,time,reminder){
 const base=dateTimeMs(date,time);
 const off=reminderOffsetMinutes(reminder);
 return base===null||off===null?null:base-off*60000
}
function studyReminderDue(item){
 if(item.completed||!item.reminder||item.reminder==="none")return false;
 const due=reminderDueAt(item.date,item.time,normalizeReminderValue(item.reminder));
 if(due===null)return false;
 const now=Date.now();return due<=now&&now-due<=6*3600000
}
function saveReminderState(){localStorage.setItem(REMINDER_STATE_KEY,JSON.stringify(reminderState))}
function reminderToken(x){return `${x.type}|${x.id}|${x.date}|${x.dueAt}`}
function reminderTypeInfo(type){
 return type==="tasks"?{label:"مهمة",icon:"✅",view:"tasks"}:type==="study"?{label:"دراسة",icon:"🎓",view:"study"}:{label:"عادة",icon:"🌿",view:"habits"}
}
function reminderItems(daysAhead=7){
 ensureRecurringTasksThrough(dateKeyFrom(new Date(Date.now()+daysAhead*86400000)));
 const start=Date.now()-6*3600000,end=Date.now()+daysAhead*86400000,items=[];
 tasks.forEach(t=>{
   const r=normalizeReminderValue(t.reminder);
   if(t.completed||r==="none")return;
   const dueAt=reminderDueAt(t.date,t.time,r);if(dueAt===null||dueAt<start||dueAt>end)return;
   items.push({type:"tasks",id:t.id,title:t.title,date:t.date,time:t.time||"",dueAt,reminder:r,done:!!t.completed,subtitle:`${taskLabels[t.category]||"مهمة"} • ${timeLabel(t.time)}`})
 });
 studyItems.forEach(s=>{
   const r=normalizeReminderValue(s.reminder);
   if(s.completed||r==="none")return;
   const dueAt=reminderDueAt(s.date,s.time,r);if(dueAt===null||dueAt<start||dueAt>end)return;
   items.push({type:"study",id:s.id,title:s.title,date:s.date,time:s.time||"",dueAt,reminder:r,done:!!s.completed,subtitle:`${s.subject} • ${studyTypeLabels[s.type]||"دراسة"}`})
 });
 const today=new Date();today.setHours(12,0,0,0);
 habits.forEach(h=>{
   if(h.paused||h.reminder!=="enabled"||!h.reminderTime)return;
   for(let i=0;i<=daysAhead;i++){
     const d=new Date(today);d.setDate(today.getDate()+i);
     if(!habitDueOn(h,d)||habitDoneOn(h,d))continue;
     const key=dateKeyFrom(d),dueAt=dateTimeMs(key,h.reminderTime);
     if(dueAt===null||dueAt<start||dueAt>end)continue;
     items.push({type:"habits",id:h.id,title:h.title,date:key,time:h.reminderTime,dueAt,reminder:"at_time",done:false,subtitle:`${h.icon||"🌿"} عادة • ${timeLabel(h.reminderTime)}`})
   }
 });
 return items.sort((a,b)=>a.dueAt-b.dueAt)
}
function reminderRelative(ms){
 const diff=ms-Date.now(),abs=Math.abs(diff);
 if(abs<60000)return diff<=0?"حان الآن":"خلال أقل من دقيقة";
 if(diff<0){
   const mins=Math.round(abs/60000);return mins<60?`متأخر ${mins} د`:`متأخر ${Math.round(mins/60)} س`
 }
 const mins=Math.round(diff/60000);
 if(mins<60)return`بعد ${mins} د`;
 const hours=Math.round(mins/60);if(hours<24)return`بعد ${hours} س`;
 const days=Math.round(hours/24);return`بعد ${days} يوم`
}
function notificationPermission(){
 if(!("Notification"in window))return"unsupported";
 return Notification.permission
}
async function requestBloomieNotifications(){
 if(!("Notification"in window)){toast("التنبيهات غير مدعومة على هذا المتصفح");renderReminders();return}
 try{
   const p=await Notification.requestPermission();renderReminders();
   if(p==="granted"){toast("تم تفعيل تنبيهات Bloomie 🔔");sendTestNotification(true)}
   else toast("لم يتم السماح بالتنبيهات")
 }catch{toast("تعذر طلب إذن التنبيهات")}
}
async function showSystemNotification(title,body,tag="bloomie-reminder"){
 if(notificationPermission()!=="granted")return false;
 if(privacySettings.enabled&&privacySettings.hideNotificationDetails&&!String(tag).startsWith("bloomie-test-")){
   title="Bloomie 🔒";body="عندك تذكير جديد داخل Bloomie 🌸"
 }
 try{
   if("serviceWorker"in navigator){
     const reg=await navigator.serviceWorker.ready;
     await reg.showNotification(title,{body,icon:"./icon-192.png",badge:"./icon-192.png",tag,renotify:false,data:{url:"./"}});
     return true
   }
   new Notification(title,{body,icon:"./icon-192.png",tag});return true
 }catch{return false}
}
async function sendTestNotification(silent=false){
 if(notificationPermission()!=="granted"){if(!silent)toast("فعّلي تنبيهات الجهاز أولًا");return}
 await showSystemNotification("Bloomie 🌸","هذا تنبيه تجريبي — كل شيء جاهز 🔔","bloomie-test-"+Date.now());
 if(!silent)toast("أرسلنا تنبيه تجريبي 🔔")
}
function cleanReminderState(){
 const cutoff=Date.now()-14*86400000;
 Object.keys(reminderState.fired).forEach(k=>{if(Number(reminderState.fired[k])<cutoff)delete reminderState.fired[k]});
 saveReminderState()
}
async function checkReminders(){
 const now=Date.now(),due=reminderItems(1).filter(x=>x.dueAt<=now&&now-x.dueAt<=6*3600000);
 for(const x of due){
   const token=reminderToken(x);if(reminderState.fired[token])continue;
   const info=reminderTypeInfo(x.type);
   reminderState.fired[token]=Date.now();saveReminderState();
   toast(`🔔 ${x.title}`);
   await showSystemNotification(`Bloomie • ${info.label}`,`${x.title} — ${x.subtitle}`,`bloomie-${token}`)
 }
 updateAppBadge();renderReminderHomeStatus();
 if($("remindersView")&&$("remindersView").classList.contains("active"))renderReminders()
}
function dueReminderCount(){
 const now=Date.now();return reminderItems(1).filter(x=>x.dueAt<=now&&now-x.dueAt<=6*3600000).length
}
function updateAppBadge(){
 const c=dueReminderCount();
 try{
   if("setAppBadge"in navigator){if(c)navigator.setAppBadge(c);else if("clearAppBadge"in navigator)navigator.clearAppBadge()}
 }catch{}
}


function money(n){const num=Number(n)||0;return `${num.toLocaleString("ar-EG",{maximumFractionDigits:2})} ${currency}`}
function txCategories(type){return type==="income"?incomeCategories:expenseCategories}

function esc(s=""){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2)}
function stamp(t){return new Intl.DateTimeFormat("ar",{day:"numeric",month:"short"}).format(new Date(t))}
function when(t){return new Date(`${t.date}T${t.time||"23:59"}:00`).getTime()}
function dateLabel(s){if(s===dateKey())return"اليوم";const d=new Date();d.setDate(d.getDate()+1);if(s===dateKey(d))return"غدًا";return new Intl.DateTimeFormat("ar",{day:"numeric",month:"short"}).format(new Date(`${s}T12:00:00`))}
function timeLabel(s){if(!s)return"بدون وقت";const [h,m]=s.split(":");const d=new Date();d.setHours(+h,+m);return new Intl.DateTimeFormat("ar",{hour:"numeric",minute:"2-digit"}).format(d)}
function sortTasks(a){return[...a].sort((x,y)=>x.completed-y.completed||when(x)-when(y))}
function header(){$("todayLabel").textContent=new Intl.DateTimeFormat("ar",{weekday:"long",day:"numeric",month:"long"}).format(new Date())}

function dashboard(){
 const today=tasks.filter(t=>t.date===dateKey()),done=tasks.filter(t=>t.completed).length,pending=tasks.filter(t=>!t.completed&&t.date<=dateKey()).length;
 const monthTx=transactions.filter(t=>monthKeyFromDate(t.date)===currentMonth());
 const monthIncome=monthTx.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount||0),0);
 const monthExpense=monthTx.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);
 const balance=monthIncome-monthExpense;
 const now=new Date(),dueHabits=habits.filter(h=>!h.paused&&habitDueOn(h,now)),doneHabits=dueHabits.filter(h=>habitDoneOn(h,now));
 const studyToday=studyItems.filter(s=>s.date===dateKey());
 const studyWeek=studyItems.filter(s=>studyIsThisWeek(s)&&!s.completed);
 const activeGoals=goals.filter(g=>goalProgress(g)<100),completedGoals=goals.filter(g=>goalProgress(g)>=100);
 const todayMood=moodForDate(dateKey());

 $("todayCount").textContent=today.length;$("doneCount").textContent=done;$("notesCount").textContent=notes.length;$("ideasCount").textContent=ideas.length;
 $("todaySub").textContent=today.length?`${today.filter(t=>!t.completed).length} متبقية من ${today.length}`:"لا توجد مهام اليوم";
 $("notesSub").textContent=notes.length?"ملاحظات محفوظة":"اكتبي أول ملاحظة";
 $("ideasSub").textContent=ideas.length?"أفكار محفوظة":"احفظي أي فكرة";
 $("monthExpenseHome").textContent=money(monthExpense);$("monthBalanceHome").textContent=money(balance);
 $("expenseHomeSub").textContent=monthTx.length?`${monthTx.length} حركة هذا الشهر`:"ابدئي أول تسجيل";
 $("habitsDueHome").textContent=dueHabits.length;$("habitsDoneHome").textContent=doneHabits.length;
 $("habitsDueSub").textContent=habits.length?(dueHabits.length?`${doneHabits.length} من ${dueHabits.length} مكتملة`:"لا عادات مجدولة اليوم"):"ابدئي أول عادة";
 $("studyTodayHome").textContent=studyToday.length;$("studyUpcomingHome").textContent=studyWeek.length;
 $("studyTodaySub").textContent=studyToday.length?`${studyToday.filter(s=>!s.completed).length} متبقية اليوم`:"لا توجد جلسات";
 if($("goalsActiveHome"))$("goalsActiveHome").textContent=activeGoals.length;
 if($("goalsDoneHome"))$("goalsDoneHome").textContent=completedGoals.length;
 if($("goalsActiveSub"))$("goalsActiveSub").textContent=activeGoals.length?`${activeGoals.length} هدف قيد التقدم`:"ابدئي أول هدف";
 if($("moodTodayHome"))$("moodTodayHome").textContent=todayMood?(moodInfo[todayMood.mood]?.emoji||"🌸"):"—";
 if($("moodTodayHomeIcon"))$("moodTodayHomeIcon").textContent=todayMood?(moodInfo[todayMood.mood]?.emoji||"🌸"):"🌸";
 if($("moodTodaySub"))$("moodTodaySub").textContent=todayMood?(moodInfo[todayMood.mood]?.label||"مسجل"):"سجّلي شعورك اليوم";
 $("taskCardText").textContent=pending?`${pending} مهمة متبقية`:tasks.length?"كل المهام مكتملة ✨":"ابدئي أول مهمة";
 $("noteCardText").textContent=notes.length?`${notes.length} ملاحظة محفوظة`:"اكتبي أول ملاحظة";
 $("ideaCardText").textContent=ideas.length?`${ideas.length} فكرة محفوظة`:"احفظي أول فكرة";
 $("expenseCardText").textContent=monthTx.length?money(monthExpense)+" مصروفات":"ابدئي أول تسجيل";
 $("habitCardText").textContent=habits.length?`${doneHabits.length}/${dueHabits.length} اليوم`:"ابدئي أول عادة";
 $("studyCardText").textContent=studyItems.length?`${studyToday.length} اليوم`:"أضيفي أول جلسة";
 if($("goalCardText"))$("goalCardText").textContent=goals.length?`${activeGoals.length} نشطة • ${completedGoals.length} مكتملة`:"ابدئي أول هدف";
 if($("moodCardText"))$("moodCardText").textContent=todayMood?`${moodInfo[todayMood.mood]?.emoji||"🌸"} ${moodInfo[todayMood.mood]?.label||"مسجل"} اليوم`:"سجّلي مزاج اليوم";
 if($("moreNotesText"))$("moreNotesText").textContent=notes.length?`${notes.length} ملاحظة محفوظة`:"اكتبي أول ملاحظة";
 if($("moreIdeasText"))$("moreIdeasText").textContent=ideas.length?`${ideas.length} فكرة محفوظة`:"احفظي أول فكرة";
 if($("moreStudyText"))$("moreStudyText").textContent=studyItems.length?`${studyWeek.length} قادمة هذا الأسبوع`:"أضيفي أول جلسة";
 if($("moreGoalsText"))$("moreGoalsText").textContent=goals.length?`${activeGoals.length} هدف نشط`:"ابدئي أول هدف";
 if($("moreMoodText"))$("moreMoodText").textContent=todayMood?`${moodInfo[todayMood.mood]?.emoji||"🌸"} مزاج اليوم مسجل`:"سجّلي مزاج اليوم";
 if($("calendarHomeText")){
   const c=calendarEventsForDate(dateKey()).length;
   $("calendarHomeText").textContent=c?`${c} عنصر اليوم`:"شوفي يومك كله في مكان واحد"
 }
 renderReminderHomeStatus();
}


function taskRepeatSelectedDays(){return [...document.querySelectorAll(".taskRepeatDaysPicker input:checked")].map(x=>Number(x.value))}
function setTaskRepeatDays(days){document.querySelectorAll(".taskRepeatDaysPicker input").forEach(x=>x.checked=(days||[]).includes(Number(x.value)))}
function showTaskRepeatUI(){
 const repeat=$("taskRepeat").value;
 $("taskRepeatDaysField").classList.toggle("hidden",repeat!=="custom");
}
function exceptionKey(seriesId,date){return `${seriesId}|${date}`}
function saveTaskRecurrenceExceptions(){localStorage.setItem(TASK_RECURRENCE_EXCEPTIONS_KEY,JSON.stringify(taskRecurrenceExceptions))}
function addTaskRecurrenceException(seriesId,date){
 const k=exceptionKey(seriesId,date);if(!taskRecurrenceExceptions.includes(k)){taskRecurrenceExceptions.push(k);saveTaskRecurrenceExceptions()}
}
function clearSeriesExceptionsFrom(seriesId,date){
 taskRecurrenceExceptions=taskRecurrenceExceptions.filter(k=>{const [sid,d]=k.split("|");return !(sid===seriesId&&d>=date)});
 saveTaskRecurrenceExceptions()
}
function isTaskRecurrenceException(seriesId,date){return taskRecurrenceExceptions.includes(exceptionKey(seriesId,date))}
function taskRepeatDateMatches(t,d){
 const repeat=t.repeat||"none";if(repeat==="none")return false;
 const key=dateKeyFrom(d),start=t.seriesStartDate||t.date;
 if(key<start)return false;if(t.repeatEnd&&key>t.repeatEnd)return false;
 const startDate=new Date(`${start}T12:00:00`);
 if(repeat==="daily")return true;
 if(repeat==="weekly")return d.getDay()===startDate.getDay();
 if(repeat==="monthly")return d.getDate()===startDate.getDate();
 if(repeat==="custom")return (t.repeatDays||[]).includes(d.getDay());
 return false
}
function ensureRecurringTasksThrough(endKey){
 const recurring=tasks.filter(t=>t.seriesId&&(t.repeat||"none")!=="none");
 if(!recurring.length)return;
 const target=new Date(`${endKey}T12:00:00`);
 const today=new Date();today.setHours(12,0,0,0);
 const hardEnd=new Date(today);hardEnd.setDate(hardEnd.getDate()+1095);
 if(target>hardEnd)target.setTime(hardEnd.getTime());
 const seriesIds=[...new Set(recurring.map(t=>t.seriesId))];
 let changed=false;
 seriesIds.forEach(seriesId=>{
   const all=tasks.filter(t=>t.seriesId===seriesId&&(t.repeat||"none")!=="none");
   if(!all.length)return;
   const template=[...all].sort((a,b)=>Number(b.seriesUpdatedAt||b.updatedAt||b.createdAt||0)-Number(a.seriesUpdatedAt||a.updatedAt||a.createdAt||0))[0];
   let cursor=new Date(today),guard=0;
   while(cursor<=target&&guard<1100){
     const key=dateKeyFrom(cursor);
     if(taskRepeatDateMatches(template,cursor)&&!tasks.some(t=>t.seriesId===seriesId&&t.date===key)&&!isTaskRecurrenceException(seriesId,key)){
       tasks.push({
         id:uid(),title:template.title,date:key,time:template.time||"",priority:template.priority||"medium",category:template.category||"personal",
         note:template.note||"",reminder:template.reminder||"none",completed:false,createdAt:Date.now(),updatedAt:Date.now(),seriesId,
         seriesStartDate:template.seriesStartDate||template.date,seriesUpdatedAt:template.seriesUpdatedAt||Date.now(),
         repeat:template.repeat,repeatDays:[...(template.repeatDays||[])],repeatEnd:template.repeatEnd||"",generated:true
       });
       changed=true
     }
     cursor.setDate(cursor.getDate()+1);guard++
   }
 });
 if(changed)save(KEYS.tasks,tasks)
}
function ensureRecurringTasks(){
 const d=new Date();d.setDate(d.getDate()+45);ensureRecurringTasksThrough(dateKeyFrom(d))
}
function taskRepeatSummary(t){
 const repeat=t.repeat||"none";if(repeat==="none")return"";
 if(repeat==="custom"){
   const names={6:"سبت",0:"أحد",1:"اثن",2:"ثلا",3:"أرب",4:"خمي",5:"جمع"};
   return `🔁 ${((t.repeatDays||[]).map(d=>names[d]).join("، "))||"مخصص"}`
 }
 return `🔁 ${repeatLabels[repeat]||"متكررة"}`
}
function itemReminderSummary(v){const r=normalizeReminderValue(v);return r&&r!=="none"?`🔔 ${reminderLabels[r]||"تذكير"}`:""}

function visibleTasks(){
 const today=dateKey(),q=$("taskSearch")?$("taskSearch").value.trim().toLowerCase():"";
 let a=[...tasks];
 if(taskFilter==="today")a=a.filter(t=>t.date===today);
 if(taskFilter==="pending")a=a.filter(t=>!t.completed);
 if(taskFilter==="completed")a=a.filter(t=>t.completed);
 if(taskFilter==="recurring")a=a.filter(t=>(t.repeat||"none")!=="none");
 if(taskCategoryFilter!=="all")a=a.filter(t=>t.category===taskCategoryFilter);
 if(taskPriorityFilter!=="all")a=a.filter(t=>t.priority===taskPriorityFilter);
 if(q)a=a.filter(t=>(t.title+" "+(t.note||"")+" "+(taskLabels[t.category]||"")+" "+taskRepeatSummary(t)).toLowerCase().includes(q));
 return sortTasks(a)
}
function renderTasks(){
 const dueTasks=tasks.filter(t=>t.date<=dateKey()),done=dueTasks.filter(t=>t.completed).length,pct=dueTasks.length?Math.round(done/dueTasks.length*100):0;
 $("progressBar").style.width=pct+"%";$("progressText").textContent=dueTasks.length?`${done} من ${dueTasks.length} مستحقة مكتملة`:"لا توجد مهام مستحقة بعد";
 document.querySelectorAll("[data-task-filter]").forEach(b=>b.classList.toggle("active",b.dataset.taskFilter===taskFilter));
 const a=visibleTasks();
 if(!a.length){$("taskList").innerHTML=`<div class="empty"><div>🐱🌷</div><h3>مساحة هادئة</h3><p>${taskFilter==="today"?"ما عندكِ مهام لليوم.":taskFilter==="pending"?"ممتاز، ما فيش مهام متبقية.":taskFilter==="completed"?"ما فيش مهام مكتملة لسه.":taskFilter==="recurring"?"لسه ما أضفتيش مهام متكررة.":"لسه ما أضفتيش مهام."}</p>${taskFilter!=="completed"?'<button id="emptyTaskAdd" class="primary">＋ أضيفي مهمة</button>':""}</div>`;if($("emptyTaskAdd"))$("emptyTaskAdd").onclick=()=>openTask();return}
 $("taskList").innerHTML=a.map(t=>{
   const recurring=taskRepeatSummary(t);
   return `<article class="taskItem" data-id="${esc(t.id)}"><button class="check ${t.completed?"done":""}" data-task-action="toggle">${t.completed?"✓":""}</button><div class="taskBody"><p class="taskTitle ${t.completed?"done":""}">${esc(t.title)}</p><div class="meta"><span>${taskIcons[t.category]||"✨"} ${taskLabels[t.category]||"أخرى"}</span><span>🗓 ${dateLabel(t.date)}</span><span>🕒 ${timeLabel(t.time)}</span><span class="${t.priority}">● ${priorities[t.priority]}</span>${recurring?`<span class="recurringPill">${esc(recurring)}</span>`:""}${itemReminderSummary(t.reminder)?`<span class="reminderPill">${esc(itemReminderSummary(t.reminder))}</span>`:""}</div>${t.note?`<p class="taskNote">${esc(t.note)}</p>`:""}${t.seriesId?'<div class="seriesNotice">جزء من سلسلة متكررة</div>':""}</div><div class="actions"><button data-task-action="edit">✏️</button><button class="delete" data-task-action="delete">🗑️</button></div></article>`
 }).join("")
}

function visibleNotes(){
 const q=$("noteSearch").value.trim().toLowerCase();
 return [...notes].filter(n=>(noteFilter==="all"||n.category===noteFilter)&&(!q||(n.title+" "+n.body).toLowerCase().includes(q))).sort((a,b)=>b.updatedAt-a.updatedAt)
}
function renderNotes(){
 $("notesSummary").textContent=notes.length?`${notes.length} ملاحظة محفوظة`:"مساحتك للكتابة السريعة";
document.querySelectorAll("[data-note-filter]").forEach(b=>b.classList.toggle("active",b.dataset.noteFilter===noteFilter));
 const a=visibleNotes();
 if(!a.length){$("notesList").innerHTML=`<div class="empty" style="grid-column:1/-1"><div>📝🌸</div><h3>لسه مفيش ملاحظات</h3><p>اكتبي أي شيء مهم عشان تلاقيه بسهولة بعدين.</p><button id="emptyNoteAdd" class="primary noteBtn">＋ ملاحظة جديدة</button></div>`;$("emptyNoteAdd").onclick=()=>openNote();return}
 $("notesList").innerHTML=a.map(n=>`<article class="noteCard" data-id="${esc(n.id)}"><div class="cardActions"><button data-note-action="edit">✏️</button><button data-note-action="delete">🗑️</button></div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="cardFoot"><span>${noteLabels[n.category]||"أخرى"}</span><span>${stamp(n.updatedAt)}</span></div></article>`).join("")
}

function visibleIdeas(){
 const q=$("ideaSearch").value.trim().toLowerCase();
 return [...ideas].filter(i=>(ideaFilter==="all"||i.category===ideaFilter)&&(!q||(i.title+" "+i.body).toLowerCase().includes(q))).sort((a,b)=>b.updatedAt-a.updatedAt)
}
function renderIdeas(){
 $("ideasSummary").textContent=ideas.length?`${ideas.length} فكرة محفوظة`:"ما تسيبيش أي فكرة تضيع";
 document.querySelectorAll("[data-idea-filter]").forEach(b=>b.classList.toggle("active",b.dataset.ideaFilter===ideaFilter));
 const a=visibleIdeas();
 if(!a.length){$("ideasList").innerHTML=`<div class="empty"><div>💡✨</div><h3>لسه مفيش أفكار</h3><p>أي فكرة تيجي في بالك، اكتبيها هنا فورًا.</p><button id="emptyIdeaAdd" class="primary ideaBtn">＋ فكرة جديدة</button></div>`;$("emptyIdeaAdd").onclick=()=>openIdea();return}
 $("ideasList").innerHTML=a.map(i=>`<article class="ideaCard" data-id="${esc(i.id)}"><div class="ideaIcon">${ideaIcons[i.category]||"💡"}</div><div><h3>${esc(i.title)}</h3><p>${esc(i.body)}</p><div class="ideaMeta"><span>${ideaLabels[i.category]||"أخرى"}</span><span>${stamp(i.updatedAt)}</span></div></div><div class="ideaActions"><button data-idea-action="edit">✏️</button><button data-idea-action="task" title="تحويل لمهمة">✅</button><button data-idea-action="delete">🗑️</button></div></article>`).join("")
}


function selectedExpenseMonth(){
 return $("expenseMonth")&&$("expenseMonth").value?$("expenseMonth").value:currentMonth()
}
function visibleTransactions(){
 const month=selectedExpenseMonth(),q=$("expenseSearch")?$("expenseSearch").value.trim().toLowerCase():"";
 let a=transactions.filter(t=>monthKeyFromDate(t.date)===month);
 if(expenseFilter!=="all")a=a.filter(t=>t.type===expenseFilter);
 if(expenseCategoryFilter!=="all")a=a.filter(t=>t.category===expenseCategoryFilter);
 if(q)a=a.filter(t=>(t.title+" "+(t.note||"")+" "+((txCategories(t.type)[t.category]||{}).label||"")).toLowerCase().includes(q));
 return [...a].sort((x,y)=>String(y.date).localeCompare(String(x.date))||Number(y.createdAt||0)-Number(x.createdAt||0))
}
function renderExpenseCategoryOptions(type,selected){
 const cats=txCategories(type);
 $("transactionCategory").innerHTML=Object.entries(cats).map(([key,c])=>`<option value="${key}" ${selected===key?"selected":""}>${c.icon} ${c.label}</option>`).join("")
}
function renderExpenses(){
 if(!$("expenseMonth"))return;
 if(!$("expenseMonth").value)$("expenseMonth").value=currentMonth();
 $("currencySelect").value=currency;

 const month=selectedExpenseMonth();
 const monthTx=transactions.filter(t=>monthKeyFromDate(t.date)===month);
 const income=monthTx.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount||0),0);
 const expense=monthTx.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);
 const balance=income-expense;

 $("incomeTotal").textContent=money(income);
 $("expenseTotal").textContent=money(expense);
 $("balanceTotal").textContent=money(balance);
 $("expenseSummary").textContent=monthTx.length?`${monthTx.length} حركة محفوظة في هذا الشهر`:"تابعي دخلك ومصاريفك ببساطة";

 document.querySelectorAll("[data-expense-filter]").forEach(b=>b.classList.toggle("active",b.dataset.expenseFilter===expenseFilter));

 const expenseTx=monthTx.filter(t=>t.type==="expense");
 const totals={};
 expenseTx.forEach(t=>totals[t.category]=(totals[t.category]||0)+Number(t.amount||0));
 const entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
 if(!entries.length){
   $("categoryBreakdown").innerHTML=`<div class="empty"><div>🪙🌸</div><h3>لا توجد مصروفات بعد</h3><p>أضيفي أول مصروف وسيظهر هنا توزيع الفئات.</p></div>`;
 }else{
   $("categoryBreakdown").innerHTML=entries.map(([key,val])=>{
     const c=expenseCategories[key]||expenseCategories.other;
     const pct=expense?Math.round(val/expense*100):0;
     return `<div class="categoryRow"><div class="categoryIcon">${c.icon}</div><div class="categoryBody"><div class="categoryTop"><span>${c.label}</span><strong>${money(val)}</strong></div><div class="categoryBar"><div style="width:${pct}%"></div></div></div><div class="categoryPct">${pct}%</div></div>`;
   }).join("");
 }

 const a=visibleTransactions();
 $("transactionCount").textContent=`${a.length} حركة`;
 if(!a.length){
   $("transactionList").innerHTML=`<div class="empty"><div>💗🪙</div><h3>لسه مفيش حركات</h3><p>ضيفي دخل أو مصروف للشهر المختار.</p><button id="emptyTxAdd" class="primary expenseBtn">＋ إضافة حركة</button></div>`;
   if($("emptyTxAdd"))$("emptyTxAdd").onclick=()=>openTransaction();
   return;
 }
 $("transactionList").innerHTML=a.map(t=>{
   const cats=txCategories(t.type),c=cats[t.category]||cats.other;
   const sign=t.type==="income"?"+":"−";
   return `<article class="transactionItem" data-id="${esc(t.id)}">
     <div class="transactionIcon ${t.type}">${c.icon}</div>
     <div class="transactionMain"><h4>${esc(t.title)}</h4><p>${c.label} • ${dateLabel(t.date)}${t.note?` • ${esc(t.note)}`:""}</p></div>
     <div class="transactionSide"><span class="transactionAmount ${t.type}">${sign}${money(t.amount)}</span><div class="transactionActions"><button data-tx-action="edit">✏️</button><button data-tx-action="delete">🗑️</button></div></div>
   </article>`;
 }).join("");
}


function visibleHabits(){
 const now=new Date(),q=$("habitSearch")?$("habitSearch").value.trim().toLowerCase():"";
 let a=[...habits];
 if(habitFilter==="today")a=a.filter(h=>!h.paused&&habitDueOn(h,now));
 if(habitFilter==="completed")a=a.filter(h=>!h.paused&&habitDueOn(h,now)&&habitDoneOn(h,now));
 if(habitFilter==="pending")a=a.filter(h=>!h.paused&&habitDueOn(h,now)&&!habitDoneOn(h,now));
 if(habitFilter==="paused")a=a.filter(h=>h.paused);
 if(q)a=a.filter(h=>(h.title+" "+(h.note||"")).toLowerCase().includes(q));
 return a.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0))
}
function renderWeekHeader(){
 const dates=currentWeekDates(),today=dateKey();
 $("weekHeader").innerHTML=dates.map(d=>`<div class="weekDay ${dateKeyFrom(d)===today?"today":""}"><span>${weekShort[d.getDay()]}</span><strong>${d.getDate()}</strong></div>`).join("");
 const f=new Intl.DateTimeFormat("ar",{day:"numeric",month:"short"});$("weekRangeLabel").textContent=`${f.format(dates[0])} — ${f.format(dates[6])}`
}
function renderHabits(){
 if(!$("habitList"))return;
 renderWeekHeader();
 const now=new Date(),due=habits.filter(h=>!h.paused&&habitDueOn(h,now)),done=due.filter(h=>habitDoneOn(h,now));
 $("habitsDue").textContent=due.length;$("habitsDone").textContent=done.length;$("habitsRate").textContent=due.length?Math.round(done.length/due.length*100)+"%":"0%";
 $("habitsSummary").textContent=habits.length?`${habits.length} عادة محفوظة • ${habits.filter(h=>h.paused).length} متوقفة`:"ابني روتينك يومًا بيوم";
 document.querySelectorAll("[data-habit-filter]").forEach(b=>b.classList.toggle("active",b.dataset.habitFilter===habitFilter));
 const a=visibleHabits();
 if(!a.length){
   $("habitList").innerHTML=`<div class="empty"><div>🌿🐱</div><h3>${habits.length?"لا توجد عادات في هذا الفلتر":"ابدئي عادة لطيفة"}</h3><p>${habits.length?"جربي فلترًا آخر.":"اختاري عادة صغيرة تقدري تكرريها بسهولة."}</p>${!habits.length?'<button id="emptyHabitAdd" class="primary habitBtn">＋ إضافة عادة</button>':""}</div>`;
   if($("emptyHabitAdd"))$("emptyHabitAdd").onclick=()=>openHabit();return
 }
 const dates=currentWeekDates(),todayKey=dateKey();
 $("habitList").innerHTML=a.map(h=>{
   const isDue=!h.paused&&habitDueOn(h,now),isDone=habitDoneOn(h,now),streak=habitStreak(h),rate=habitRate30(h);
   const week=dates.map(d=>{
     const key=dateKeyFrom(d),scheduled=habitDueOn(h,d),completed=habitDoneOn(h,d),future=key>todayKey;
     return `<button class="habitDay ${scheduled?"scheduled":"unscheduled"} ${completed?"completed":""} ${future?"future":""}" data-habit-day="${key}" ${(h.paused||!scheduled||future)?"disabled":""}><small>${weekShort[d.getDay()]}</small><b>${completed?"✓":d.getDate()}</b></button>`
   }).join("");
   return `<article class="habitCard ${h.paused?"paused":""}" data-id="${esc(h.id)}">
     <div class="habitTop"><div class="habitIcon">${esc(h.icon||"✨")}</div><div class="habitTitleWrap"><h3>${esc(h.title)}</h3><p>${esc(h.note||"عادة شخصية")}</p>${h.paused?'<span class="habitPausedLabel">⏸ متوقفة مؤقتًا</span>':""}</div><button class="todayCheck ${isDone?"done":""} ${!isDue?"notDue":""}" data-habit-action="today" ${!isDue?"disabled":""}>${isDone?"✓":""}</button></div>
     <div class="habitStats"><div class="habitStat"><span>🔥 الاستمرارية</span><strong>${streak} يوم</strong></div><div class="habitStat"><span>📈 آخر 30 يوم</span><strong>${rate}%</strong></div></div>
     <div class="habitWeek">${week}</div>
     <div class="habitBottom"><span class="habitRate">${h.days.length===7?"كل يوم":`${h.days.length} أيام بالأسبوع`}${h.reminder==="enabled"?` • 🔔 ${timeLabel(h.reminderTime)}`:""}</span><div class="habitActions"><button class="pauseAction" data-habit-action="pause">${h.paused?"▶️":"⏸️"}</button><button data-habit-action="edit">✏️</button><button data-habit-action="delete">🗑️</button></div></div>
   </article>`
 }).join("")
}

function renderStudySubjectFilter(){
 if(!$("studySubjectFilter"))return;
 const current=$("studySubjectFilter").value||"all";
 const subjects=[...new Set(studyItems.map(s=>s.subject.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
 $("studySubjectFilter").innerHTML=`<option value="all">كل المواد</option>`+subjects.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("");
 $("studySubjectFilter").value=subjects.includes(current)?current:"all"
}
function renderStudyWeek(){
 const dates=currentWeekDates(),today=dateKey();
 const counts={};studyItems.forEach(s=>{counts[s.date]=(counts[s.date]||0)+1});
 $("studyWeekHeader").innerHTML=dates.map(d=>{
   const key=dateKeyFrom(d),selected=studySelectedDay===key;
   return `<button class="studyDayButton ${key===today?"today":""} ${selected?"selected":""}" data-study-day-filter="${key}"><span>${weekShort[d.getDay()]}</span><strong>${d.getDate()}</strong><b>${counts[key]||0} موعد</b></button>`
 }).join("");
 const f=new Intl.DateTimeFormat("ar",{day:"numeric",month:"short"});$("studyWeekRange").textContent=`${f.format(dates[0])} — ${f.format(dates[6])}`
}
function visibleStudy(){
 const q=$("studySearch").value.trim().toLowerCase();
 const subject=$("studySubjectFilter").value;
 const now=Date.now();
 let a=[...studyItems];
 if(studySelectedDay)a=a.filter(s=>s.date===studySelectedDay);
 if(studyFilter==="today")a=a.filter(s=>s.date===dateKey());
 if(studyFilter==="week")a=a.filter(studyIsThisWeek);
 if(studyFilter==="upcoming")a=a.filter(s=>!s.completed&&studyDateTime(s)>=now-60000);
 if(studyFilter==="completed")a=a.filter(s=>s.completed);
 if(subject!=="all")a=a.filter(s=>s.subject===subject);
 if(q)a=a.filter(s=>(s.title+" "+s.subject+" "+(s.note||"")).toLowerCase().includes(q));
 return a.sort((x,y)=>studyDateTime(x)-studyDateTime(y))
}
function renderStudy(){
 if(!$("studyList"))return;
 renderStudySubjectFilter();renderStudyWeek();
 const todayItems=studyItems.filter(s=>s.date===dateKey());
 const weekItems=studyItems.filter(studyIsThisWeek);
 const completed=studyItems.filter(s=>s.completed).length;
 $("studyTodayCount").textContent=todayItems.length;$("studyWeekCount").textContent=weekItems.length;$("studyDoneCount").textContent=completed;
 $("studySummary").textContent=studyItems.length?`${studyItems.length} موعد دراسي محفوظ`:"رتّبي جلساتك وامتحاناتك بسهولة";
 document.querySelectorAll("[data-study-filter]").forEach(b=>b.classList.toggle("active",b.dataset.studyFilter===studyFilter));
 const a=visibleStudy();
 if(!a.length){
   $("studyList").innerHTML=`<div class="empty"><div>🎓📚</div><h3>${studyItems.length?"لا توجد نتائج":"ابدئي جدولك الدراسي"}</h3><p>${studyItems.length?"غيّري الفلتر أو البحث.":"أضيفي جلسة مذاكرة، محاضرة، واجب أو امتحان."}</p>${!studyItems.length?'<button id="emptyStudyAdd" class="primary studyBtn">＋ إضافة موعد</button>':""}</div>`;
   if($("emptyStudyAdd"))$("emptyStudyAdd").onclick=()=>openStudy();return
 }
 let lastDate="";
 $("studyList").innerHTML=a.map(s=>{
   const group=s.date!==lastDate?`<div class="studyGroupLabel">${dateLabel(s.date)}</div>`:"";lastDate=s.date;
   const sr=normalizeReminderValue(s.reminder),reminder=sr!=="none"?`<div class="studyReminderBadge">🔔 ${studyReminderLabels[sr]||"تذكير"}</div>`:"";
   const duration=s.duration?`${s.duration} دقيقة`:"بدون مدة";
   return `${group}<article class="studyCard ${s.completed?"completed":""}" data-id="${esc(s.id)}">
     <div class="studyTypeIcon">${studyTypeIcons[s.type]||"📌"}</div>
     <div class="studyMain"><h3>${esc(s.title)}</h3><div class="studySubject">${esc(s.subject)} • ${studyTypeLabels[s.type]||"أخرى"}</div>
       <div class="studyMeta"><span>🗓 ${dateLabel(s.date)}</span><span>🕒 ${timeLabel(s.time)}</span><span>⏱ ${duration}</span><span class="priority-${s.priority}">● ${priorities[s.priority]}</span></div>
       ${s.note?`<p class="studyNote">${esc(s.note)}</p>`:""}${reminder}
     </div>
     <div class="studySide"><button class="studyComplete ${s.completed?"done":""}" data-study-action="toggle">${s.completed?"✓":""}</button><div class="studyActions"><button data-study-action="edit">✏️</button><button data-study-action="task" title="نسخ إلى المهام">✅</button><button data-study-action="delete">🗑️</button></div></div>
   </article>`
 }).join("")
}





function habitCompletionCount(){
 return habits.reduce((sum,h)=>sum+Object.values(h.completions||{}).filter(Boolean).length,0)
}
function completedTaskCount(){return tasks.filter(t=>t.completed).length}
function completedStudyCount(){return studyItems.filter(s=>s.completed).length}
function completedGoalCount(){return goals.filter(g=>goalProgress(g)>=100).length}
function completedRewardItems(){return completedTaskCount()+habitCompletionCount()+completedStudyCount()+completedGoalCount()}
function rewardPoints(){
 return completedTaskCount()*10 + habitCompletionCount()*5 + completedStudyCount()*15 + completedGoalCount()*50 + moods.length*2
}
function activityDates(){
 const set=new Set();
 tasks.filter(t=>t.completed).forEach(t=>set.add(t.date||dateKeyFrom(new Date(t.updatedAt||t.createdAt||Date.now()))));
 habits.forEach(h=>Object.entries(h.completions||{}).forEach(([d,v])=>{if(v)set.add(d)}));
 studyItems.filter(s=>s.completed).forEach(s=>set.add(s.date||dateKeyFrom(new Date(s.updatedAt||s.createdAt||Date.now()))));
 goals.filter(g=>goalProgress(g)>=100).forEach(g=>set.add(g.targetDate||dateKeyFrom(new Date(g.updatedAt||g.createdAt||Date.now()))));
 moods.forEach(m=>set.add(m.date));
 return set
}
function activityStreakCount(){
 const dates=activityDates();if(!dates.size)return 0;
 const today=new Date();today.setHours(12,0,0,0);let cursor=new Date(today);
 if(!dates.has(dateKeyFrom(cursor)))cursor.setDate(cursor.getDate()-1);
 let c=0;while(c<500&&dates.has(dateKeyFrom(cursor))){c++;cursor.setDate(cursor.getDate()-1)}return c
}
function rewardLevelInfo(points){
 const level=Math.floor(points/100)+1,within=points%100;
 const names=[
   ["🌱","بداية لطيفة"],["🌷","براعم التقدم"],["🌸","Bloomie مزهرة"],["🌼","نجمة العادات"],
   ["🌺","طاقة الإنجاز"],["🪻","مستمرة بقوة"],["🌻","يوميات ذهبية"],["🏆","Bloomie Pro"]
 ];
 const idx=Math.min(level-1,names.length-1);
 return {level,progress:within,icon:names[idx][0],name:names[idx][1],toNext:100-within}
}
function rewardBadges(){
 const tasksDone=completedTaskCount(),habitDone=habitCompletionCount(),studyDone=completedStudyCount(),goalsDone=completedGoalCount(),streak=activityStreakCount(),points=rewardPoints();
 return [
   {id:"first_task",icon:"✅",title:"أول خطوة",desc:"إكمال أول مهمة",unlocked:tasksDone>=1,progress:`${Math.min(tasksDone,1)}/1`},
   {id:"task_star",icon:"⭐",title:"نجمة المهام",desc:"إكمال 25 مهمة",unlocked:tasksDone>=25,progress:`${Math.min(tasksDone,25)}/25`},
   {id:"habit_seed",icon:"🌿",title:"بذرة عادة",desc:"7 مرات إكمال للعادات",unlocked:habitDone>=7,progress:`${Math.min(habitDone,7)}/7`},
   {id:"habit_garden",icon:"🌳",title:"حديقة العادات",desc:"30 مرة إكمال للعادات",unlocked:habitDone>=30,progress:`${Math.min(habitDone,30)}/30`},
   {id:"study_focus",icon:"🎓",title:"تركيز",desc:"5 جلسات دراسة مكتملة",unlocked:studyDone>=5,progress:`${Math.min(studyDone,5)}/5`},
   {id:"goal_getter",icon:"🎯",title:"Goal Getter",desc:"إكمال أول هدف",unlocked:goalsDone>=1,progress:`${Math.min(goalsDone,1)}/1`},
   {id:"mood_bloom",icon:"🌸",title:"Mood Bloom",desc:"7 تسجيلات مزاج",unlocked:moods.length>=7,progress:`${Math.min(moods.length,7)}/7`},
   {id:"steady_week",icon:"🔥",title:"أسبوع ثابت",desc:"7 أيام نشاط متتالية",unlocked:streak>=7,progress:`${Math.min(streak,7)}/7`},
   {id:"five_hundred",icon:"💎",title:"500 Club",desc:"الوصول إلى 500 نقطة",unlocked:points>=500,progress:`${Math.min(points,500)}/500`},
   {id:"one_thousand",icon:"👑",title:"Bloomie Crown",desc:"الوصول إلى 1000 نقطة",unlocked:points>=1000,progress:`${Math.min(points,1000)}/1000`}
 ]
}
function gardenStage(points){
 if(points<50)return {label:"بذرة",plants:["🌱"],hint:"أول 50 نقطة تفتح أول زهرة في حديقتك."};
 if(points<150)return {label:"براعم",plants:["🌱","🌷"],hint:"الحديقة بدأت تتفتح. كمّلي لفتح زهور أكثر."};
 if(points<300)return {label:"حديقة صغيرة",plants:["🌷","🌸","🌱"],hint:"وصلتِ لحديقة صغيرة 🌸"};
 if(points<600)return {label:"حديقة مزهرة",plants:["🌷","🌸","🌼","🪻","🌱"],hint:"حديقتك صارت مليانة ألوان."};
 if(points<1000)return {label:"حديقة كبيرة",plants:["🌷","🌸","🌼","🪻","🌺","🌻"],hint:"إنجازات كثيرة = حديقة أكبر."};
 return {label:"حديقة Bloomie",plants:["🌷","🌸","🌼","🪻","🌺","🌻","🌹","✨"],hint:"وصلتِ لحديقة Bloomie الكاملة 🏆"}
}
function renderRewards(){
 if(!$("rewardsView"))return;
 const points=rewardPoints(),lvl=rewardLevelInfo(points),badges=rewardBadges(),unlocked=badges.filter(b=>b.unlocked),streak=activityStreakCount(),stage=gardenStage(points);
 $("rewardPoints").textContent=`${points} نقطة`;$("rewardLevel").textContent=lvl.level;$("rewardLevelIcon").textContent=lvl.icon;$("rewardLevelName").textContent=lvl.name;$("rewardLevelBar").style.width=lvl.progress+"%";
 $("rewardNextLevel").textContent=lvl.progress===0&&points>0?"بدأتِ مستوى جديد ✨":`${lvl.toNext} نقطة للمستوى التالي`;
 $("rewardUnlockedCount").textContent=unlocked.length;$("rewardTotalCount").textContent=badges.length;$("activityStreak").textContent=streak;$("rewardCompletedItems").textContent=completedRewardItems();
 $("rewardsSummary").textContent=points?`${points} نقطة • ${unlocked.length} شارات مفتوحة`:"ابدئي بإكمال أول مهمة واجمعي نقاط Bloomie";
 $("badgesProgress").textContent=`${unlocked.length} / ${badges.length}`;
 $("badgeGrid").innerHTML=badges.map(b=>`<article class="badgeCard ${b.unlocked?"unlocked":"locked"}"><div class="badgeIcon">${b.icon}</div><div class="badgeBody"><h4>${esc(b.title)}</h4><p>${esc(b.desc)}</p><small>${b.unlocked?"مفتوحة ✓":b.progress}</small></div></article>`).join("");
 $("gardenStageLabel").textContent=stage.label;$("gardenHint").textContent=stage.hint;
 const plants=stage.plants.map(x=>`<span class="gardenPlant">${x}</span>`).join("");
 $("gardenScene").innerHTML=`${plants}<span class="gardenPlant gardenCat">${appearanceMascots[appearanceSettings.mascot]?.emoji||"🐱"}</span>${points>=300?'<span class="gardenSpark" style="top:28%;left:35%">✨</span>':""}${points>=600?'<span class="gardenSpark" style="top:20%;right:32%">✨</span>':""}`;
 if($("rewardHomePoints"))$("rewardHomePoints").textContent=points;
 if($("rewardHomeText"))$("rewardHomeText").textContent=points?`${points} نقطة • مستوى ${lvl.level}`:"كل خطوة صغيرة تحسب ✨";
 if($("rewardCardText"))$("rewardCardText").textContent=points?`${points} نقطة • ${unlocked.length} شارات`:"ابدئي تجمعي نقاط Bloomie";
 if($("moreRewardText"))$("moreRewardText").textContent=points?`${points} نقطة • مستوى ${lvl.level}`:"ابدئي تجمعي نقاط";
}

function moodForDate(key){return moods.find(m=>m.date===key)}
function moodMonthEntries(){
 const y=moodMonthCursor.getFullYear(),m=moodMonthCursor.getMonth();
 return moods.filter(x=>{const d=new Date(`${x.date}T12:00:00`);return d.getFullYear()===y&&d.getMonth()===m})
}
function moodStreakCount(){
 const today=new Date();today.setHours(12,0,0,0);
 let cursor=new Date(today);
 if(!moodForDate(dateKeyFrom(cursor)))cursor.setDate(cursor.getDate()-1);
 let count=0;
 while(count<400&&moodForDate(dateKeyFrom(cursor))){count++;cursor.setDate(cursor.getDate()-1)}
 return count
}
function moodCommon(entries){
 if(!entries.length)return null;
 const counts={};entries.forEach(m=>counts[m.mood]=(counts[m.mood]||0)+1);
 return Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||(moodInfo[b]?.score||0)-(moodInfo[a]?.score||0))[0]
}
function moodMonthDates(){
 const first=new Date(moodMonthCursor.getFullYear(),moodMonthCursor.getMonth(),1,12);
 const shift=(first.getDay()+1)%7,start=new Date(first);start.setDate(first.getDate()-shift);
 return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})
}
function renderMoodWeek(){
 const today=new Date();today.setHours(12,0,0,0);const dates=[];
 for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);dates.push(d)}
 const short={6:"سبت",0:"أحد",1:"اثن",2:"ثلا",3:"أرب",4:"خمي",5:"جمع"};
 $("moodWeekStrip").innerHTML=dates.map(d=>{
   const key=dateKeyFrom(d),m=moodForDate(key),info=m?moodInfo[m.mood]:null;
   return `<button class="moodWeekDay ${key===dateKey()?"today":""}" data-mood-date="${key}"><small>${short[d.getDay()]}</small><b>${info?info.emoji:"·"}</b><em>${info?info.label:d.getDate()}</em></button>`
 }).join("");
 const tracked=dates.filter(d=>moodForDate(dateKeyFrom(d))).length;
 $("moodWeekSummary").textContent=tracked?`${tracked} من 7 أيام مسجلة`:"ابدئي أول تسجيل"
}
function renderMoodMonth(){
 const dates=moodMonthDates(),month=moodMonthCursor.getMonth(),today=dateKey();
 $("moodMonthLabel").textContent=new Intl.DateTimeFormat("ar",{month:"long"}).format(moodMonthCursor);
 $("moodYearLabel").textContent=new Intl.DateTimeFormat("ar",{year:"numeric"}).format(moodMonthCursor);
 $("moodMonthGrid").innerHTML=dates.map(d=>{
   const key=dateKeyFrom(d),m=moodForDate(key),info=m?moodInfo[m.mood]:null;
   return `<button class="moodDay ${d.getMonth()!==month?"outside":""} ${key===today?"today":""} ${m?"hasMood":""}" data-mood-date="${key}"><strong>${d.getDate()}</strong><b>${info?info.emoji:""}</b><small>${info?info.label:""}</small></button>`
 }).join("");
 const entries=moodMonthEntries(),common=moodCommon(entries),positive=entries.filter(x=>["great","good"].includes(x.mood)).length;
 if(!entries.length)$("moodInsight").textContent="🌸 سجّلي عدة أيام ليظهر لكِ ملخص بسيط للشهر.";
 else{
   const commonText=common?`${moodInfo[common].emoji} ${moodInfo[common].label}`:"—";
   $("moodInsight").textContent=`هذا الشهر سجلتِ ${entries.length} يوم. الأكثر تكرارًا: ${commonText}. الأيام التي سجلتِ فيها «رائع» أو «كويس»: ${positive}.`
 }
}
function renderMoodHistory(){
 const a=[...moods].sort((x,y)=>y.date.localeCompare(x.date)||Number(y.updatedAt||0)-Number(x.updatedAt||0)).slice(0,12);
 if(!a.length){$("moodHistory").innerHTML=`<div class="empty"><div>🌸</div><h3>لسه ما في تسجيلات</h3><p>أول تسجيل يكفي لبدء سجلّك.</p></div>`;return}
 $("moodHistory").innerHTML=a.map(m=>{
   const info=moodInfo[m.mood]||{emoji:"🌸",label:"مسجل"};
   return `<article class="moodHistoryItem" data-id="${esc(m.id)}"><div class="moodHistoryEmoji">${info.emoji}</div><div class="moodHistoryMain"><h4>${info.label}</h4><p>${esc(m.note||"بدون ملاحظة")}</p><small>${dateLabel(m.date)}</small></div><div class="moodHistoryActions"><button data-mood-action="edit">✏️</button><button data-mood-action="delete">🗑️</button></div></article>`
 }).join("")
}
function renderMood(){
 if(!$("moodView"))return;
 const today=moodForDate(dateKey()),monthEntries=moodMonthEntries(),common=moodCommon(monthEntries),streak=moodStreakCount();
 $("moodStreak").textContent=streak;$("moodMonthCount").textContent=monthEntries.length;
 $("moodCommonEmoji").textContent=common?moodInfo[common].emoji:"—";$("moodCommonLabel").textContent=common?moodInfo[common].label:"لا بيانات";
 if(today){
   const info=moodInfo[today.mood]||{emoji:"🌸",label:"مسجل"};$("moodTodayIcon").textContent=info.emoji;$("moodTodayTitle").textContent=info.label;
   $("moodTodayText").textContent=today.note||"تم تسجيل مزاج اليوم.";$("editTodayMood").textContent="تعديل"
 }else{$("moodTodayIcon").textContent="🌷";$("moodTodayTitle").textContent="كيف كان يومك؟";$("moodTodayText").textContent="اختاري الشعور الأقرب لكِ واكتبي ملاحظة لو حبيتي.";$("editTodayMood").textContent="تسجيل"}
 $("moodSummary").textContent=moods.length?`${moods.length} يوم مسجل • سلسلة ${streak} يوم`:"سجّلي شعورك بلطف وشوفي نمط أيامك";
 renderMoodWeek();renderMoodMonth();renderMoodHistory()
}
function setMoodChoice(value){
 $("moodValue").value=value||"";
 document.querySelectorAll("[data-mood-choice]").forEach(b=>b.classList.toggle("active",b.dataset.moodChoice===value))
}
function openMood(m,dateOverride){
 const selected=m||moodForDate(dateOverride||dateKey());
 $("moodForm").reset();$("moodId").value="";$("moodDate").value=dateOverride||dateKey();$("moodNote").value="";setMoodChoice("");
 if(selected){
   $("moodModalTitle").textContent="تعديل التسجيل";$("moodId").value=selected.id;$("moodDate").value=selected.date;$("moodNote").value=selected.note||"";setMoodChoice(selected.mood);$("saveMood").textContent="حفظ التعديلات 🌸"
 }else{$("moodModalTitle").textContent="تسجيل المزاج";$("saveMood").textContent="حفظ التسجيل 🌸"}
 showModal("moodModal")
}
function moodMoveMonth(delta){moodMonthCursor=new Date(moodMonthCursor.getFullYear(),moodMonthCursor.getMonth()+delta,1,12);renderMood()}

function goalProgress(g){
 const steps=Array.isArray(g.steps)?g.steps:[];
 if(steps.length)return Math.round(steps.filter(s=>s.done).length/steps.length*100);
 return Math.max(0,Math.min(100,Number(g.progress)||0))
}
function goalIsDueSoon(g){
 if(!g.targetDate||goalProgress(g)>=100)return false;
 const target=new Date(`${g.targetDate}T12:00:00`).getTime(),now=new Date();now.setHours(12,0,0,0);
 const days=Math.ceil((target-now.getTime())/86400000);return days>=0&&days<=7
}
function goalTargetLabel(g){
 if(!g.targetDate)return"بدون موعد";
 const target=new Date(`${g.targetDate}T12:00:00`).getTime(),now=new Date();now.setHours(12,0,0,0);
 const days=Math.ceil((target-now.getTime())/86400000);
 if(days<0)return`متأخر ${Math.abs(days)} يوم`;
 if(days===0)return"الموعد اليوم";
 if(days===1)return"غدًا";
 return dateLabel(g.targetDate)
}
function visibleGoals(){
 const q=$("goalSearch")?$("goalSearch").value.trim().toLowerCase():"";let a=[...goals];
 if(goalFilter==="active")a=a.filter(g=>goalProgress(g)<100);
 if(goalFilter==="completed")a=a.filter(g=>goalProgress(g)>=100);
 if(goalFilter==="due")a=a.filter(goalIsDueSoon);
 if(goalCategoryFilter!=="all")a=a.filter(g=>g.category===goalCategoryFilter);
 if(q)a=a.filter(g=>[g.title,g.note,goalLabels[g.category],...(g.steps||[]).map(s=>s.text)].join(" ").toLowerCase().includes(q));
 return a.sort((a,b)=>{
   const ac=goalProgress(a)>=100,bc=goalProgress(b)>=100;if(ac!==bc)return ac-bc;
   const ad=a.targetDate||"9999-12-31",bd=b.targetDate||"9999-12-31";return ad.localeCompare(bd)||Number(b.updatedAt||0)-Number(a.updatedAt||0)
 })
}
function renderGoals(){
 if(!$("goalList"))return;
 const active=goals.filter(g=>goalProgress(g)<100),done=goals.filter(g=>goalProgress(g)>=100);
 const avg=goals.length?Math.round(goals.reduce((s,g)=>s+goalProgress(g),0)/goals.length):0;
 $("goalActiveCount").textContent=active.length;$("goalCompletedCount").textContent=done.length;$("goalAverageProgress").textContent=avg+"%";
 $("goalsSummary").textContent=goals.length?`${active.length} نشطة • ${done.length} مكتملة`:"حوّلي أهدافك الكبيرة لخطوات صغيرة وواضحة";
 document.querySelectorAll("[data-goal-filter]").forEach(b=>b.classList.toggle("active",b.dataset.goalFilter===goalFilter));
 const a=visibleGoals();
 if(!a.length){
   $("goalList").innerHTML=`<div class="empty"><div>🎯🌸</div><h3>${goals.length?"لا توجد أهداف بهذا الفلتر":"ابدئي هدفك الأول"}</h3><p>${goals.length?"جربي فلترًا أو تصنيفًا مختلفًا.":"اكتبي هدفًا كبيرًا، وقسميه لخطوات صغيرة قابلة للإنجاز."}</p>${!goals.length?'<button id="emptyGoalAdd" class="primary goalBtn">＋ هدف جديد</button>':""}</div>`;
   if($("emptyGoalAdd"))$("emptyGoalAdd").onclick=()=>openGoal();return
 }
 $("goalList").innerHTML=a.map(g=>{
   const p=goalProgress(g),completed=p>=100,steps=Array.isArray(g.steps)?g.steps:[],doneSteps=steps.filter(s=>s.done).length;
   const stepHtml=steps.length?`<div class="goalSteps">${steps.map((s,i)=>`<button class="goalStep ${s.done?"done":""}" data-goal-step="${i}"><span class="goalStepCheck">${s.done?"✓":""}</span><span>${esc(s.text)}</span></button>`).join("")}</div>`:"";
   return `<article class="goalCard ${completed?"completed":""}" data-id="${esc(g.id)}">
     <div class="goalTop"><div class="goalIcon">${goalIcons[g.category]||"✨"}</div><div class="goalTitleWrap"><h3>${esc(g.title)}</h3><p>${goalLabels[g.category]||"أخرى"}${steps.length?` • ${doneSteps}/${steps.length} خطوات`:""}</p></div><div class="goalPercent">${p}%</div></div>
     <div class="goalProgressTrack"><div class="goalProgressFill" style="width:${p}%"></div></div>
     <div class="goalMeta"><span>🎯 ${goalLabels[g.category]||"أخرى"}</span>${g.targetDate?`<span class="${goalIsDueSoon(g)?"goalDueSoon":""}">📅 ${esc(goalTargetLabel(g))}</span>`:""}${completed?'<span class="goalCompletePill">🏆 مكتمل</span>':""}</div>
     ${g.note?`<p class="goalNote">${esc(g.note)}</p>`:""}${stepHtml}
     <div class="goalActions"><button data-goal-action="task" class="goalTaskAction" title="تحويل لَمهمة">✅ مهمة</button><button data-goal-action="edit">✏️ تعديل</button><button data-goal-action="delete" class="goalDeleteAction">🗑️</button></div>
   </article>`
 }).join("")
}
function openGoal(g){
 $("goalForm").reset();$("goalId").value="";$("goalCategory").value="personal";$("goalTargetDate").value="";$("goalProgress").value="0";$("goalProgressValue").textContent="0%";$("goalSteps").value="";
 if(g){
   $("goalModalTitle").textContent="تعديل الهدف";$("goalId").value=g.id;$("goalTitle").value=g.title;$("goalCategory").value=g.category||"personal";$("goalTargetDate").value=g.targetDate||"";$("goalProgress").value=Number(g.progress)||0;$("goalProgressValue").textContent=(Number(g.progress)||0)+"%";$("goalSteps").value=(g.steps||[]).map(s=>s.text).join("\n");$("goalNote").value=g.note||"";$("saveGoal").textContent="حفظ التعديلات 🎯"
 }else{$("goalModalTitle").textContent="هدف جديد";$("saveGoal").textContent="حفظ الهدف 🎯"}
 showModal("goalModal")
}
function goalToTask(g){
 const now=Date.now(),date=g.targetDate||dateKey();
 tasks.push({id:uid(),title:g.title,date,time:"",priority:goalIsDueSoon(g)?"high":"medium",category:g.category==="study"?"study":g.category==="work"?"work":"personal",note:`من هدف Bloomie 🎯${g.note?" • "+g.note:""}`,reminder:"none",completed:false,createdAt:now,updatedAt:now});
 save(KEYS.tasks,tasks);renderAll();toast("تم إنشاء مهمة من الهدف ✅")
}

const globalTypeInfo={
 tasks:{label:"مهمة",icon:"✅",view:"tasks"},
 goals:{label:"هدف",icon:"🎯",view:"goals"},
 moods:{label:"مزاج",icon:"🌸",view:"mood"},
 notes:{label:"ملاحظة",icon:"📝",view:"notes"},
 ideas:{label:"فكرة",icon:"💡",view:"ideas"},
 expenses:{label:"حركة مالية",icon:"🪙",view:"expenses"},
 habits:{label:"عادة",icon:"🌿",view:"habits"},
 study:{label:"دراسة",icon:"🎓",view:"study"}
};
function normalizeGlobalItems(){
 const items=[];
 tasks.forEach(t=>items.push({type:"tasks",id:t.id,title:t.title,text:t.note||"",meta:[dateLabel(t.date),taskLabels[t.category]||"أخرى",priorities[t.priority]||""],stamp:Number(t.createdAt||0),search:[t.title,t.note,taskLabels[t.category],priorities[t.priority],t.date].join(" ")}));
 goals.forEach(g=>items.push({type:"goals",id:g.id,title:g.title,text:g.note||"",meta:[`${goalProgress(g)}%`,goalLabels[g.category]||"أخرى",g.targetDate?goalTargetLabel(g):"بدون موعد"],stamp:Number(g.updatedAt||g.createdAt||0),search:[g.title,g.note,goalLabels[g.category],...(g.steps||[]).map(s=>s.text)].join(" ")}));
 moods.forEach(m=>{const info=moodInfo[m.mood]||{emoji:"🌸",label:"مزاج"};items.push({type:"moods",id:m.id,title:`${info.emoji} ${info.label}`,text:m.note||"",meta:[dateLabel(m.date)],stamp:Number(m.updatedAt||m.createdAt||0),search:[info.label,m.note,m.date].join(" ")})});
 notes.forEach(n=>items.push({type:"notes",id:n.id,title:n.title,text:n.body||"",meta:[noteLabels[n.category]||"أخرى",stamp(n.updatedAt||n.createdAt||Date.now())],stamp:Number(n.updatedAt||n.createdAt||0),search:[n.title,n.body,noteLabels[n.category]].join(" ")}));
 ideas.forEach(i=>items.push({type:"ideas",id:i.id,title:i.title,text:i.body||"",meta:[ideaLabels[i.category]||"أخرى",stamp(i.updatedAt||i.createdAt||Date.now())],stamp:Number(i.updatedAt||i.createdAt||0),search:[i.title,i.body,ideaLabels[i.category]].join(" ")}));
 transactions.forEach(t=>{const c=txCategories(t.type)[t.category]||txCategories(t.type).other;items.push({type:"expenses",id:t.id,title:t.title,text:t.note||"",meta:[c.label,dateLabel(t.date),`${t.type==="income"?"+":"−"}${money(t.amount)}`],stamp:Number(t.updatedAt||t.createdAt||0),search:[t.title,t.note,c.label,t.type,money(t.amount)].join(" ")})});
 habits.forEach(h=>items.push({type:"habits",id:h.id,title:h.title,text:h.note||"",meta:[`🔥 ${habitStreak(h)} يوم`,`${habitRate30(h)}% آخر 30 يوم`],stamp:Number(h.updatedAt||h.createdAt||0),search:[h.title,h.note].join(" ")}));
 studyItems.forEach(s=>items.push({type:"study",id:s.id,title:s.title,text:`${s.subject}${s.note?" • "+s.note:""}`,meta:[studyTypeLabels[s.type]||"أخرى",dateLabel(s.date),timeLabel(s.time)],stamp:Number(s.updatedAt||s.createdAt||0),search:[s.title,s.subject,s.note,studyTypeLabels[s.type]].join(" ")}));
 return items
}
function globalSearchResults(){
 const q=$("globalSearch")?$("globalSearch").value.trim().toLowerCase():"";
 let a=normalizeGlobalItems();
 if(globalType!=="all")a=a.filter(x=>x.type===globalType);
 if(q)a=a.filter(x=>x.search.toLowerCase().includes(q));
 else a=a.sort((x,y)=>y.stamp-x.stamp).slice(0,12);
 if(globalSort==="newest")a.sort((x,y)=>y.stamp-x.stamp);
 if(globalSort==="oldest")a.sort((x,y)=>x.stamp-y.stamp);
 if(globalSort==="az")a.sort((x,y)=>x.title.localeCompare(y.title,"ar"));
 return a
}
function renderGlobalSearch(){
 if(!$("globalResults"))return;
 const q=$("globalSearch").value.trim(),a=globalSearchResults();
 $("clearGlobalSearch").classList.toggle("hidden",!q);
 document.querySelectorAll("[data-global-type]").forEach(b=>b.classList.toggle("active",b.dataset.globalType===globalType));
 $("globalSearchCount").textContent=q||globalType!=="all"?`${a.length} نتيجة`:`${a.length} من أحدث العناصر`;
 if(!a.length){
   $("globalResults").innerHTML=`<div class="empty"><div>🔎🌸</div><h3>ما لقيناش نتيجة</h3><p>جربي كلمة مختلفة أو اختاري قسمًا آخر.</p></div>`;return
 }
 $("globalResults").innerHTML=a.map(x=>{
   const info=globalTypeInfo[x.type];
   return `<article class="globalResult" data-type="${x.type}" data-id="${esc(x.id)}"><div class="resultIcon">${info.icon}</div><div class="resultMain"><span class="resultType">${info.label}</span><h3>${esc(x.title)}</h3>${x.text?`<p>${esc(x.text)}</p>`:""}<div class="resultMeta">${x.meta.filter(Boolean).map(m=>`<span>${esc(m)}</span>`).join("")}</div></div><button class="resultOpen" data-search-open>فتح</button></article>`
 }).join("")
}
function openGlobalResult(type,id){
 if(type==="tasks"){const x=tasks.find(v=>v.id===id);go("tasks");if(x)openTask(x)}
 if(type==="goals"){const x=goals.find(v=>v.id===id);go("goals");if(x)openGoal(x)}
 if(type==="moods"){const x=moods.find(v=>v.id===id);go("mood");if(x)openMood(x)}
 if(type==="notes"){const x=notes.find(v=>v.id===id);go("notes");if(x)openNote(x)}
 if(type==="ideas"){const x=ideas.find(v=>v.id===id);go("ideas");if(x)openIdea(x)}
 if(type==="expenses"){const x=transactions.find(v=>v.id===id);go("expenses");if(x)openTransaction(x)}
 if(type==="habits"){const x=habits.find(v=>v.id===id);go("habits");if(x)openHabit(x)}
 if(type==="study"){const x=studyItems.find(v=>v.id===id);go("study");if(x)openStudy(x)}
}


function backupMeta(){
 try{return JSON.parse(localStorage.getItem(BACKUP_META_KEY)||"{}")}catch{return{}}
}
function makeBackupObject(){
 return {
   app:"Life Organizer",
   formatVersion:BACKUP_FORMAT_VERSION,
   exportedAt:new Date().toISOString(),
   data:{
     tasks,
     notes,
     ideas,
     transactions,
     habits,
     studyItems,
     goals,
     settings:{currency,appearance:appearanceSettings},taskRecurrenceExceptions
   }
 }
}
function backupCounts(data){
 const d=data&&data.data?data.data:{};
 return {
   tasks:Array.isArray(d.tasks)?d.tasks.length:0,
   notes:Array.isArray(d.notes)?d.notes.length:0,
   ideas:Array.isArray(d.ideas)?d.ideas.length:0,
   transactions:Array.isArray(d.transactions)?d.transactions.length:0,
   habits:Array.isArray(d.habits)?d.habits.length:0,
   study:Array.isArray(d.studyItems)?d.studyItems.length:0,
   goals:Array.isArray(d.goals)?d.goals.length:0,
   moods:Array.isArray(d.moods)?d.moods.length:0
 }
}
function formatDateTime(iso){
 if(!iso)return"لم يتم إنشاء نسخة بعد";
 const d=new Date(iso);if(Number.isNaN(d.getTime()))return"غير معروف";
 return new Intl.DateTimeFormat("ar",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(d)
}
function renderBackup(){
 if(!$("backupTasksCount"))return;
 $("backupTasksCount").textContent=tasks.length;
 $("backupNotesCount").textContent=notes.length;
 $("backupIdeasCount").textContent=ideas.length;
 $("backupTransactionsCount").textContent=transactions.length;
 $("backupHabitsCount").textContent=habits.length;
 $("backupStudyCount").textContent=studyItems.length;
 if($("backupGoalsCount"))$("backupGoalsCount").textContent=goals.length;
 if($("backupMoodsCount"))$("backupMoodsCount").textContent=moods.length;

 const meta=backupMeta();
 $("lastBackupText").textContent=formatDateTime(meta.lastExportAt);
 const total=tasks.length+notes.length+ideas.length+transactions.length+habits.length+studyItems.length+goals.length+moods.length;
 $("backupStatusTitle").textContent=total?`${total} عنصر جاهز للنسخ`:"لا توجد بيانات بعد";
 $("backupStatusText").textContent=total?"اعملي نسخة احتياطية واحفظي الملف في مكان آمن.":"ابدئي باستخدام التطبيق، وبعدها تقدري تحفظي نسخة من كل شيء.";

 if($("homeBackupStatus"))$("homeBackupStatus").textContent=meta.lastExportAt?`آخر نسخة: ${formatDateTime(meta.lastExportAt)}`:"اعملي نسخة قبل أي تغيير كبير";
 if($("backupCardText"))$("backupCardText").textContent=meta.lastExportAt?"آخر نسخة محفوظة موجودة":"احفظي نسخة من بياناتك";
 if($("moreBackupText"))$("moreBackupText").textContent=meta.lastExportAt?`آخر نسخة: ${formatDateTime(meta.lastExportAt)}`:"احفظي نسخة من بياناتك";
}
function downloadTextFile(filename,text,type="application/json"){
 const blob=new Blob([text],{type});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500)
}
function safeFileDate(){
 const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}_${String(d.getHours()).padStart(2,"0")}-${String(d.getMinutes()).padStart(2,"0")}`
}
function exportBackup(){
 const backup=makeBackupObject();
 downloadTextFile(`life-organizer-backup_${safeFileDate()}.json`,JSON.stringify(backup,null,2),"application/json");
 localStorage.setItem(BACKUP_META_KEY,JSON.stringify({lastExportAt:backup.exportedAt}));
 renderBackup();toast("تم إنشاء النسخة الاحتياطية 💾")
}
function csvCell(value){
 const s=String(value??"").replaceAll('"','""');return `"${s}"`
}
function exportExpensesCsv(){
 const header=["النوع","المبلغ","العملة","الوصف","التاريخ","الفئة","الملاحظة"];
 const rows=transactions.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(t=>{
   const c=txCategories(t.type)[t.category]||txCategories(t.type).other;
   return [t.type==="income"?"دخل":"مصروف",t.amount,currency,t.title,t.date,c.label,t.note||""].map(csvCell).join(",")
 });
 const csv="\ufeff"+header.map(csvCell).join(",")+"\n"+rows.join("\n");
 downloadTextFile(`life-organizer-expenses_${safeFileDate()}.csv`,csv,"text/csv;charset=utf-8");
 toast("تم تصدير جدول المصاريف 📄")
}
function validateBackupObject(obj){
 if(!obj||typeof obj!=="object")throw new Error("الملف غير صالح");
 if(obj.app!=="Life Organizer")throw new Error("هذا الملف ليس نسخة من التطبيق");
 if(Number(obj.formatVersion)!==BACKUP_FORMAT_VERSION)throw new Error("إصدار النسخة غير مدعوم");
 if(!obj.data||typeof obj.data!=="object")throw new Error("النسخة لا تحتوي بيانات");
 const keys=["tasks","notes","ideas","transactions","habits","studyItems"];
 keys.forEach(k=>{if(!Array.isArray(obj.data[k]))throw new Error(`قسم ${k} غير صالح`)});
 return obj
}
function renderImportPreview(obj){
 const c=backupCounts(obj);
 $("importPreview").classList.remove("hidden");
 $("importPreview").innerHTML=`<h4>النسخة جاهزة للاستيراد</h4>
   <p>تاريخ النسخة: ${formatDateTime(obj.exportedAt)}. الاستيراد سيستبدل البيانات الحالية بهذه النسخة.</p>
   <div class="importPreviewGrid">
     <div><span>مهام</span><strong>${c.tasks}</strong></div>
     <div><span>ملاحظات</span><strong>${c.notes}</strong></div>
     <div><span>أفكار</span><strong>${c.ideas}</strong></div>
     <div><span>حركات مالية</span><strong>${c.transactions}</strong></div>
     <div><span>عادات</span><strong>${c.habits}</strong></div>
     <div><span>دراسة</span><strong>${c.study}</strong></div>
     <div><span>أهداف</span><strong>${c.goals}</strong></div>
     <div><span>مزاج</span><strong>${c.moods}</strong></div>
   </div>
   <div class="importActions">
     <button class="dangerBtn" id="confirmImportBackup">استبدال البيانات</button>
     <button class="cancelBtn" id="cancelImportBackup">إلغاء</button>
   </div>`;
 $("confirmImportBackup").onclick=confirmImportBackup;
 $("cancelImportBackup").onclick=cancelImportBackup;
}
function chooseBackupFile(file){
 const reader=new FileReader();
 reader.onload=()=>{
   try{
     const obj=validateBackupObject(JSON.parse(reader.result));
     pendingImportData=obj;renderImportPreview(obj);toast("تم فحص النسخة بنجاح")
   }catch(err){
     pendingImportData=null;$("importPreview").classList.add("hidden");toast(err.message||"تعذر قراءة النسخة")
   }
 };
 reader.onerror=()=>toast("تعذر قراءة الملف");
 reader.readAsText(file)
}
function confirmImportBackup(){
 if(!pendingImportData)return;
 if(!confirm("سيتم استبدال بيانات التطبيق الحالية بالكامل. هل تريدين المتابعة؟"))return;
 const d=pendingImportData.data;
 tasks=d.tasks;notes=d.notes;ideas=d.ideas;transactions=d.transactions;habits=d.habits;studyItems=d.studyItems;goals=Array.isArray(d.goals)?d.goals:[];moods=Array.isArray(d.moods)?d.moods:[];
 taskRecurrenceExceptions=Array.isArray(d.taskRecurrenceExceptions)?d.taskRecurrenceExceptions:[];
 currency=(d.settings&&d.settings.currency)||currency;
 if(d.settings&&d.settings.appearance){appearanceSettings=normalizeAppearance(d.settings.appearance);saveAppearanceSettings();applyAppearance(false)}
 save(KEYS.tasks,tasks);saveTaskRecurrenceExceptions();save(KEYS.notes,notes);save(KEYS.ideas,ideas);save(KEYS.transactions,transactions);save(KEYS.habits,habits);save(KEYS.study,studyItems);save(KEYS.goals,goals);save(KEYS.moods,moods);
 localStorage.setItem("lifeOrganizer.currency.v1",currency);
 localStorage.setItem(BACKUP_META_KEY,JSON.stringify({lastImportAt:new Date().toISOString(),lastImportedBackupAt:pendingImportData.exportedAt,lastExportAt:backupMeta().lastExportAt||null}));
 pendingImportData=null;$("importBackupFile").value="";$("importPreview").classList.add("hidden");
 renderAll();go("backup");toast("تم استرجاع النسخة بنجاح ✅")
}
function cancelImportBackup(){
 pendingImportData=null;$("importBackupFile").value="";$("importPreview").classList.add("hidden");toast("تم إلغاء الاستيراد")
}



function reminderOpen(type,id){
 if(type==="tasks"){const x=tasks.find(v=>v.id===id);go("tasks");if(x)openTask(x)}
 if(type==="study"){const x=studyItems.find(v=>v.id===id);go("study");if(x)openStudy(x)}
 if(type==="habits"){const x=habits.find(v=>v.id===id);go("habits");if(x)openHabit(x)}
}
function reminderFilteredItems(){
 const now=Date.now(),today=dateKey();let a=reminderItems(7);
 if(reminderFilter==="today")a=a.filter(x=>x.date===today);
 if(reminderFilter==="overdue")a=a.filter(x=>x.dueAt<=now);
 if(reminderFilter==="upcoming")a=a.filter(x=>x.dueAt>now);
 return a
}
function renderReminderPermission(){
 if(!$("notificationPermissionTitle"))return;
 const p=notificationPermission(),btn=$("enableNotifications");
 btn.classList.remove("permissionOk","permissionDenied");
 if(p==="granted"){
   $("notificationPermissionTitle").textContent="تنبيهات الجهاز مفعّلة ✓";
   $("notificationPermissionText").textContent="Bloomie يقدر يعرض تنبيهًا أثناء تشغيل التطبيق.";
   btn.textContent="مفعّلة";btn.disabled=true;btn.classList.add("permissionOk")
 }else if(p==="denied"){
   $("notificationPermissionTitle").textContent="تنبيهات الجهاز مرفوضة";
   $("notificationPermissionText").textContent="يمكن تغيير الإذن من إعدادات Safari / إشعارات تطبيق Bloomie.";
   btn.textContent="مرفوضة";btn.disabled=true;btn.classList.add("permissionDenied")
 }else if(p==="unsupported"){
   $("notificationPermissionTitle").textContent="تنبيهات الجهاز غير مدعومة";
   $("notificationPermissionText").textContent="ستظل قائمة التذكيرات داخل Bloomie تعمل.";
   btn.textContent="غير مدعوم";btn.disabled=true;btn.classList.add("permissionDenied")
 }else{
   $("notificationPermissionTitle").textContent="تنبيهات الجهاز";
   $("notificationPermissionText").textContent="اضغطي تفعيل حتى يسمح الجهاز لـBloomie بإظهار التنبيهات.";
   btn.textContent="تفعيل";btn.disabled=false
 }
}
function renderReminderHomeStatus(){
 const items=reminderItems(7),today=items.filter(x=>x.date===dateKey()).length,due=items.filter(x=>x.dueAt<=Date.now()).length;
 if($("reminderHomeBadge"))$("reminderHomeBadge").textContent=due||today||0;
 if($("reminderHomeText"))$("reminderHomeText").textContent=due?`${due} تذكير حان وقته`:today?`${today} تذكير اليوم`:items.length?`${items.length} تذكير هذا الأسبوع`:"لا توجد تذكيرات قادمة";
 if($("moreReminderText"))$("moreReminderText").textContent=due?`${due} حان وقتها`:items.length?`${items.length} قادمة`:"لا توجد تذكيرات قادمة"
}
function renderReminders(){
 if(!$("reminderList"))return;
 cleanReminderState();renderReminderPermission();
 const all=reminderItems(7),now=Date.now(),today=dateKey(),a=reminderFilteredItems();
 const todayCount=all.filter(x=>x.date===today).length,dueCount=all.filter(x=>x.dueAt<=now).length;
 $("reminderTodayCount").textContent=todayCount;$("reminderDueCount").textContent=dueCount;$("reminderWeekCount").textContent=all.length;
 $("reminderSummary").textContent=all.length?`${all.length} تذكير خلال 7 أيام`:"لا توجد تذكيرات مجدولة";
 document.querySelectorAll("[data-reminder-filter]").forEach(b=>b.classList.toggle("active",b.dataset.reminderFilter===reminderFilter));
 renderReminderHomeStatus();
 if(!a.length){
   $("reminderList").innerHTML=`<div class="empty"><div>🔔🌸</div><h3>قائمة التذكيرات هادئة</h3><p>أضيفي تذكيرًا لمهمة أو جلسة دراسة أو عادة.</p><div class="reminderEmptyTip">يمكنك تعديل أي عنصر موجود واختيار وقت التذكير.</div></div>`;return
 }
 $("reminderList").innerHTML=a.map(x=>{
   const info=reminderTypeInfo(x.type),diff=x.dueAt-now,cls=diff<=0?(Math.abs(diff)<10*60000?"dueNow":"overdue"):"";
   const dueDate=new Date(x.dueAt);
   const dueText=new Intl.DateTimeFormat("ar",{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(dueDate);
   return `<article class="reminderItem ${cls}" data-type="${x.type}" data-id="${esc(x.id)}">
     <div class="reminderTypeIcon ${x.type}">${info.icon}</div>
     <div class="reminderMain"><h3>${esc(x.title)}</h3><p>${esc(x.subtitle)}</p><small>${esc(dueText)}</small><small class="reminderWhen">${esc(reminderRelative(x.dueAt))}</small></div>
     <button class="reminderOpen" data-reminder-open>فتح</button>
   </article>`
 }).join("")
}

function calendarMonthStart(){const d=new Date(calendarCursor);d.setDate(1);d.setHours(12,0,0,0);return d}
function calendarMonthEnd(){const d=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,0,12);return d}
function calendarGridDates(){
 const first=calendarMonthStart();
 const shift=(first.getDay()+1)%7;
 const start=new Date(first);start.setDate(first.getDate()-shift);
 return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})
}
function calendarEventsForDate(key){
 const date=new Date(`${key}T12:00:00`);
 const events=[];
 if(calendarTypeFilter==="all"||calendarTypeFilter==="tasks"){
   tasks.filter(t=>t.date===key).forEach(t=>events.push({type:"tasks",id:t.id,title:t.title,subtitle:`${timeLabel(t.time)} • ${taskLabels[t.category]||"أخرى"}${normalizeReminderValue(t.reminder)!=="none"?" • 🔔":""}`,done:!!t.completed,time:t.time||"23:59",icon:"✅"}))
 }
 if(calendarTypeFilter==="all"||calendarTypeFilter==="study"){
   studyItems.filter(s=>s.date===key).forEach(s=>events.push({type:"study",id:s.id,title:s.title,subtitle:`${s.subject} • ${timeLabel(s.time)}${normalizeReminderValue(s.reminder)!=="none"?" • 🔔":""}`,done:!!s.completed,time:s.time||"23:59",icon:studyTypeIcons[s.type]||"🎓"}))
 }
 if(calendarTypeFilter==="all"||calendarTypeFilter==="habits"){
   habits.filter(h=>!h.paused&&habitDueOn(h,date)).forEach(h=>events.push({type:"habits",id:h.id,title:h.title,subtitle:habitDoneOn(h,date)?"مكتملة ✓":"عادة مجدولة",done:habitDoneOn(h,date),time:"12:00",icon:h.icon||"🌿"}))
 }
 if(calendarTypeFilter==="all"||calendarTypeFilter==="goals"){
   goals.filter(g=>g.targetDate===key).forEach(g=>events.push({type:"goals",id:g.id,title:g.title,subtitle:`هدف • ${goalProgress(g)}%`,done:goalProgress(g)>=100,time:"23:58",icon:"🎯"}))
 }
 if(calendarTypeFilter==="all"||calendarTypeFilter==="moods"){
   const m=moodForDate(key);if(m){const info=moodInfo[m.mood]||{emoji:"🌸",label:"مزاج"};events.push({type:"moods",id:m.id,title:`مزاج اليوم: ${info.label}`,subtitle:m.note||"تسجيل مزاج",done:true,time:"23:57",icon:info.emoji})}
 }
 return events.sort((a,b)=>a.time.localeCompare(b.time))
}
function renderCalendarGrid(){
 const dates=calendarGridDates(),month=calendarCursor.getMonth(),today=dateKey();
 const end=dates[dates.length-1];ensureRecurringTasksThrough(dateKeyFrom(end));
 $("calendarGrid").innerHTML=dates.map(d=>{
   const key=dateKeyFrom(d),events=calendarEventsForDate(key);
   const types=[...new Set(events.map(e=>e.type))];
   const dots=types.map(t=>`<i class="dot ${t==="tasks"?"taskDot":t==="study"?"studyDot":t==="habits"?"habitDot":t==="goals"?"goalDot":"moodDot"}"></i>`).join("");
   return `<button class="calendarCell ${d.getMonth()!==month?"outside":""} ${key===today?"today":""} ${key===calendarSelectedDate?"selected":""}" data-calendar-date="${key}">
     <strong>${d.getDate()}</strong><div class="calendarDots">${dots}</div>${events.length?`<span class="calendarCount">${events.length}</span>`:""}
   </button>`
 }).join("")
}
function renderAgenda(){
 const events=calendarEventsForDate(calendarSelectedDate);
 const d=new Date(`${calendarSelectedDate}T12:00:00`);
 $("agendaDateLabel").textContent=new Intl.DateTimeFormat("ar",{weekday:"long",day:"numeric",month:"long"}).format(d);
 const taskCount=events.filter(e=>e.type==="tasks").length,studyCount=events.filter(e=>e.type==="study").length,habitCount=events.filter(e=>e.type==="habits").length,goalCount=events.filter(e=>e.type==="goals").length,moodCount=events.filter(e=>e.type==="moods").length;
 $("agendaSummary").classList.remove("fourCols");$("agendaSummary").classList.add("fiveCols");
 $("agendaSummary").innerHTML=`<div><span>مهام</span><strong>${taskCount}</strong></div><div><span>دراسة</span><strong>${studyCount}</strong></div><div><span>عادات</span><strong>${habitCount}</strong></div><div><span>أهداف</span><strong>${goalCount}</strong></div><div><span>مزاج</span><strong>${moodCount}</strong></div>`;
 if(!events.length){
   $("agendaList").innerHTML=`<div class="empty"><div>🌸📅</div><h3>اليوم هادي</h3><p>ما فيش عناصر في هذا اليوم ضمن الفلتر الحالي.</p></div>`;return
 }
 $("agendaList").innerHTML=events.map(e=>`<article class="agendaItem ${e.done?"agendaDone":""}" data-type="${e.type}" data-id="${esc(e.id)}">
   <div class="agendaIcon ${e.type}">${esc(e.icon)}</div><div class="agendaMain"><h4>${esc(e.title)}</h4><p>${esc(e.subtitle)}</p><small>${e.done?"مكتمل":"غير مكتمل"}</small></div><button class="agendaOpen" data-agenda-open>فتح</button>
 </article>`).join("")
}
function renderCalendar(){
 if(!$("calendarGrid"))return;
 const monthFmt=new Intl.DateTimeFormat("ar",{month:"long"}),yearFmt=new Intl.DateTimeFormat("ar",{year:"numeric"});
 $("calendarMonthLabel").textContent=monthFmt.format(calendarCursor);$("calendarYearLabel").textContent=yearFmt.format(calendarCursor);
 document.querySelectorAll("[data-calendar-type]").forEach(b=>b.classList.toggle("active",b.dataset.calendarType===calendarTypeFilter));
 renderCalendarGrid();renderAgenda();
 const todayEvents=calendarEventsForDate(dateKey());
 $("calendarSummary").textContent=`${todayEvents.length} عنصر في تقويم اليوم`;
 if($("calendarHomeText"))$("calendarHomeText").textContent=todayEvents.length?`${todayEvents.length} عنصر اليوم`:"شوفي يومك كله في مكان واحد"
}
function calendarMoveMonth(delta){
 calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+delta,1,12);
 calendarSelectedDate=dateKeyFrom(calendarCursor);renderCalendar()
}
function calendarGoToday(){
 const now=new Date();calendarCursor=new Date(now.getFullYear(),now.getMonth(),1,12);calendarSelectedDate=dateKey();renderCalendar()
}
function openAgendaItem(type,id){
 if(type==="tasks"){const x=tasks.find(v=>v.id===id);go("tasks");if(x)openTask(x)}
 if(type==="study"){const x=studyItems.find(v=>v.id===id);go("study");if(x)openStudy(x)}
 if(type==="habits"){const x=habits.find(v=>v.id===id);go("habits");if(x)openHabit(x)}
 if(type==="goals"){const x=goals.find(v=>v.id===id);go("goals");if(x)openGoal(x)}
 if(type==="moods"){const x=moods.find(v=>v.id===id);go("mood");if(x)openMood(x)}
}

function renderAll(){ensureRecurringTasks();dashboard();renderTasks();renderNotes();renderIdeas();renderExpenses();renderHabits();renderStudy();renderGoals();renderMood();renderRewards();renderPrivacy();renderAppearance();renderAnalytics();renderSharing();renderGlobalSearch();renderBackup();renderCalendar();renderReminders();updateAppBadge()}

function go(view,chosen){
 document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
 if(view==="home")$("homeView").classList.add("active");
 if(view==="tasks"){if(chosen)taskFilter=chosen;$("tasksView").classList.add("active");renderTasks()}
 if(view==="notes"){$("notesView").classList.add("active");renderNotes()}
 if(view==="ideas"){$("ideasView").classList.add("active");renderIdeas()}
 if(view==="expenses"){$("expensesView").classList.add("active");renderExpenses()}
 if(view==="habits"){$("habitsView").classList.add("active");renderHabits()}
 if(view==="more"){$("moreView").classList.add("active");dashboard()}
 if(view==="study"){$("studyView").classList.add("active");renderStudy()}
 if(view==="search"){$("searchView").classList.add("active");renderGlobalSearch();setTimeout(()=>$("globalSearch").focus(),120)}
 if(view==="backup"){$("backupView").classList.add("active");renderBackup()}
 if(view==="calendar"){$("calendarView").classList.add("active");renderCalendar()}
 if(view==="reminders"){$("remindersView").classList.add("active");renderReminders()}
 if(view==="goals"){$("goalsView").classList.add("active");if(chosen)goalFilter=chosen;renderGoals()}
 if(view==="mood"){$("moodView").classList.add("active");renderMood()}
 if(view==="rewards"){$("rewardsView").classList.add("active");renderRewards()}
 if(view==="privacy"){$("privacyView").classList.add("active");renderPrivacy()}
 if(view==="appearance"){$("appearanceView").classList.add("active");renderAppearance()}
 if(view==="analytics"){$("analyticsView").classList.add("active");renderAnalytics()}
 if(view==="sharing"){$("sharingView").classList.add("active");renderSharing()}
 document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.go===view));
 window.scrollTo({top:0,behavior:"smooth"})
}
function soon(name){$("soonTitle").textContent=name+" قادم 🌸";const map={الإعدادات:"سنضيف الإعدادات والنسخ الاحتياطي في الباتشات القادمة."};$("soonText").textContent=map[name]||"سنفعّل هذا القسم في باتش قادم.";document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$("soonView").classList.add("active")}

function showModal(id){$(id).classList.remove("hidden");document.body.style.overflow="hidden";if($("quickAddFab"))$("quickAddFab").classList.add("fabHidden")}
function hideModal(id){$(id).classList.add("hidden");document.body.style.overflow="";if($("quickAddFab")&&!document.querySelector(".modal:not(.hidden)")&&!privacyLocked)$("quickAddFab").classList.remove("fabHidden")}
function toast(s){$("toast").textContent=s;$("toast").classList.remove("hidden");clearTimeout(window._toast);window._toast=setTimeout(()=>$("toast").classList.add("hidden"),1700)}

function openTask(t){
 $("taskForm").reset();$("taskPriority").value="medium";$("taskCategory").value="personal";$("taskDate").value=dateKey();$("taskId").value="";
 $("taskRepeat").value="none";$("taskRepeatEnd").value="";$("taskReminder").value="none";setTaskRepeatDays([]);$("taskEditScopeWrap").classList.add("hidden");$("taskEditScope").value="single";showTaskRepeatUI();
 if(t){
   $("taskModalTitle").textContent="تعديل المهمة";$("taskId").value=t.id;$("taskTitle").value=t.title;$("taskDate").value=t.date;$("taskTime").value=t.time||"";$("taskPriority").value=t.priority;$("taskCategory").value=t.category;$("taskNote").value=t.note||"";
   $("taskRepeat").value=t.repeat||"none";$("taskRepeatEnd").value=t.repeatEnd||"";$("taskReminder").value=normalizeReminderValue(t.reminder);setTaskRepeatDays(t.repeatDays||[]);showTaskRepeatUI();
   if(t.seriesId)$("taskEditScopeWrap").classList.remove("hidden");
   $("saveTask").textContent="حفظ التعديلات 💗"
 }else{$("taskModalTitle").textContent="إضافة مهمة";$("saveTask").textContent="حفظ المهمة 💗"}
 showModal("taskModal")
}
function openNote(n){
 $("noteForm").reset();$("noteCategory").value="personal";$("noteId").value="";
 if(n){$("noteModalTitle").textContent="تعديل الملاحظة";$("noteId").value=n.id;$("noteTitle").value=n.title;$("noteBody").value=n.body;$("noteCategory").value=n.category;$("saveNote").textContent="حفظ التعديلات 🌸"}else{$("noteModalTitle").textContent="ملاحظة جديدة";$("saveNote").textContent="حفظ الملاحظة 🌸"}
 showModal("noteModal")
}
function openIdea(i){
 $("ideaForm").reset();$("ideaCategory").value="project";$("ideaId").value="";
 if(i){$("ideaModalTitle").textContent="تعديل الفكرة";$("ideaId").value=i.id;$("ideaTitle").value=i.title;$("ideaBody").value=i.body;$("ideaCategory").value=i.category;$("saveIdea").textContent="حفظ التعديلات ✨"}else{$("ideaModalTitle").textContent="فكرة جديدة";$("saveIdea").textContent="حفظ الفكرة ✨"}
 showModal("ideaModal")
}

function setTransactionType(type,selectedCategory){
 $("transactionType").value=type;
 document.querySelectorAll("[data-type-choice]").forEach(b=>b.classList.toggle("active",b.dataset.typeChoice===type));
 renderExpenseCategoryOptions(type,selectedCategory);
}
function openTransaction(t){
 $("expenseForm").reset();$("transactionId").value="";$("transactionDate").value=dateKey();
 if(t){
   $("expenseModalTitle").textContent="تعديل الحركة";
   $("transactionId").value=t.id;$("transactionAmount").value=t.amount;$("transactionTitle").value=t.title;$("transactionDate").value=t.date;$("transactionNote").value=t.note||"";
   setTransactionType(t.type,t.category);$("saveTransaction").textContent="حفظ التعديلات 🪙";
 }else{
   $("expenseModalTitle").textContent="إضافة حركة مالية";setTransactionType("expense");$("saveTransaction").textContent="حفظ الحركة 🪙";
 }
 showModal("expenseModal")
}


function habitSelectedDays(){return [...document.querySelectorAll(".habitDaysPicker input:checked")].map(x=>Number(x.value))}
function habitPresetFromDays(days){
 const s=[...(days||[])].sort().join(",");
 if(s==="0,1,2,3,4,5,6")return"daily";
 if(s==="0,1,2,3,4")return"weekdays";
 if(s==="5,6")return"weekends";
 return"custom"
}
function applyHabitPreset(preset){
 if(preset==="daily")setHabitDays([6,0,1,2,3,4,5]);
 if(preset==="weekdays")setHabitDays([0,1,2,3,4]);
 if(preset==="weekends")setHabitDays([5,6]);
}
function setHabitDays(days){document.querySelectorAll(".habitDaysPicker input").forEach(x=>x.checked=days.includes(Number(x.value)))}
function openHabit(h){
 $("habitForm").reset();$("habitId").value="";$("habitIcon").value="💧";$("habitPreset").value="daily";$("habitReminder").value="none";$("habitReminderTime").value="09:00";setHabitDays([6,0,1,2,3,4,5]);showHabitReminderUI();
 if(h){
   $("habitModalTitle").textContent="تعديل العادة";$("habitId").value=h.id;$("habitTitle").value=h.title;$("habitIcon").value=h.icon||"✨";$("habitNote").value=h.note||"";setHabitDays(h.days||[]);$("habitPreset").value=habitPresetFromDays(h.days||[]);$("habitReminder").value=h.reminder||"none";$("habitReminderTime").value=h.reminderTime||"09:00";showHabitReminderUI();$("saveHabit").textContent="حفظ التعديلات 🌿";
 }else{$("habitModalTitle").textContent="عادة جديدة";$("saveHabit").textContent="حفظ العادة 🌿"}
 showModal("habitModal")
}
function showHabitReminderUI(){$("habitReminderTime").disabled=$("habitReminder").value!=="enabled"}

function openStudy(s){
 $("studyForm").reset();$("studyId").value="";$("studyDate").value=dateKey();$("studyPriority").value="medium";$("studyType").value="study";$("studyReminder").value="none";
 if(s){
   $("studyModalTitle").textContent="تعديل الموعد";$("studyId").value=s.id;$("studyTitle").value=s.title;$("studySubject").value=s.subject;$("studyType").value=s.type;$("studyPriority").value=s.priority;$("studyDate").value=s.date;$("studyTime").value=s.time||"";$("studyDuration").value=s.duration||"";$("studyReminder").value=normalizeReminderValue(s.reminder);$("studyNote").value=s.note||"";$("saveStudy").textContent="حفظ التعديلات 🎓";
 }else{$("studyModalTitle").textContent="إضافة جلسة أو موعد";$("saveStudy").textContent="حفظ الموعد 🎓"}
 showModal("studyModal")
}


$("studyForm").onsubmit=e=>{
 e.preventDefault();const id=$("studyId").value,old=studyItems.find(s=>s.id===id),now=Date.now();
 const item={id:id||uid(),title:$("studyTitle").value.trim(),subject:$("studySubject").value.trim(),type:$("studyType").value,priority:$("studyPriority").value,date:$("studyDate").value,time:$("studyTime").value,duration:Number($("studyDuration").value)||0,reminder:normalizeReminderValue($("studyReminder").value),note:$("studyNote").value.trim(),completed:old?old.completed:false,createdAt:old?old.createdAt:now,updatedAt:now};
 studyItems=old?studyItems.map(x=>x.id===id?item:x):[...studyItems,item];save(KEYS.study,studyItems);hideModal("studyModal");renderAll();go("study");toast(old?"تم تعديل الموعد 🎓":"تم حفظ الموعد 🎓")
};
$("habitForm").onsubmit=e=>{
 e.preventDefault();const days=habitSelectedDays();if(!days.length){toast("اختاري يومًا واحدًا على الأقل");return}
 const id=$("habitId").value,old=habits.find(h=>h.id===id),now=Date.now();
 const h={id:id||uid(),title:$("habitTitle").value.trim(),icon:$("habitIcon").value,days,note:$("habitNote").value.trim(),reminder:$("habitReminder").value,reminderTime:$("habitReminderTime").value||"09:00",paused:old?!!old.paused:false,completions:old&&old.completions?old.completions:{},createdAt:old?old.createdAt:now,updatedAt:now};
 habits=old?habits.map(x=>x.id===id?h:x):[...habits,h];save(KEYS.habits,habits);hideModal("habitModal");renderAll();go("habits");toast(old?"تم تعديل العادة 🌿":"تمت إضافة العادة 🌿")
};
$("expenseForm").onsubmit=e=>{
 e.preventDefault();
 const id=$("transactionId").value,old=transactions.find(t=>t.id===id),now=Date.now();
 const t={id:id||uid(),type:$("transactionType").value,amount:Number($("transactionAmount").value),title:$("transactionTitle").value.trim(),date:$("transactionDate").value,category:$("transactionCategory").value,note:$("transactionNote").value.trim(),createdAt:old?old.createdAt:now,updatedAt:now};
 transactions=old?transactions.map(x=>x.id===id?t:x):[...transactions,t];
 save(KEYS.transactions,transactions);hideModal("expenseModal");renderAll();go("expenses");toast(old?"تم تعديل الحركة 🪙":"تم حفظ الحركة 🪙")
};
$("taskForm").onsubmit=e=>{
 e.preventDefault();
 const id=$("taskId").value,old=tasks.find(t=>t.id===id),now=Date.now();
 const repeat=$("taskRepeat").value,repeatDays=repeat==="custom"?taskRepeatSelectedDays():[];
 const repeatEnd=$("taskRepeatEnd").value;
 if(repeat==="custom"&&!repeatDays.length){toast("اختاري يومًا واحدًا للتكرار على الأقل");return}
 if(repeatEnd&&repeatEnd<$("taskDate").value){toast("تاريخ نهاية التكرار لازم يكون بعد بداية المهمة");return}

 const base={
   title:$("taskTitle").value.trim(),date:$("taskDate").value,time:$("taskTime").value,priority:$("taskPriority").value,category:$("taskCategory").value,note:$("taskNote").value.trim(),reminder:normalizeReminderValue($("taskReminder").value),
   repeat,repeatDays,repeatEnd,updatedAt:now
 };

 if(!old){
   if(repeat==="none"){
     tasks.push({id:uid(),...base,completed:false,createdAt:now});
   }else{
     const seriesId=uid();
     tasks.push({id:uid(),...base,completed:false,createdAt:now,seriesId,seriesStartDate:base.date,seriesUpdatedAt:now,generated:false});
   }
 }else if(old.seriesId&&$("taskEditScope").value==="future"){
   const sid=old.seriesId,currentDate=old.date;
   tasks=tasks.filter(t=>!(t.seriesId===sid&&t.date>=currentDate));
   clearSeriesExceptionsFrom(sid,currentDate);
   if(repeat==="none"){
     tasks.push({id:uid(),...base,completed:old.completed,createdAt:old.createdAt||now});
   }else{
     tasks.push({id:uid(),...base,completed:old.completed,createdAt:old.createdAt||now,seriesId:sid,seriesStartDate:base.date,seriesUpdatedAt:now,generated:false});
   }
 }else if(old.seriesId){
   tasks=tasks.map(t=>t.id===id?{id:t.id,...base,completed:t.completed,createdAt:t.createdAt||now}:t);
 }else{
   if(repeat==="none"){
     tasks=tasks.map(t=>t.id===id?{id:t.id,...base,completed:t.completed,createdAt:t.createdAt||now}:t);
   }else{
     const sid=uid();
     tasks=tasks.map(t=>t.id===id?{id:t.id,...base,completed:t.completed,createdAt:t.createdAt||now,seriesId:sid,seriesStartDate:base.date,seriesUpdatedAt:now,generated:false}:t);
   }
 }
 save(KEYS.tasks,tasks);ensureRecurringTasks();hideModal("taskModal");renderAll();go("tasks");toast(old?"تم تعديل المهمة ✨":"تمت إضافة المهمة 💗")
};
$("moodForm").onsubmit=e=>{
 e.preventDefault();
 const mood=$("moodValue").value;if(!mood||!moodInfo[mood]){toast("اختاري شعورك أولًا 🌸");return}
 const id=$("moodId").value,date=$("moodDate").value,old=moods.find(x=>x.id===id),sameDate=moods.find(x=>x.date===date&&x.id!==id),now=Date.now();
 if(sameDate){toast("في تسجيل موجود لهذا اليوم — افتحيه وعدليه");return}
 const item={id:id||uid(),date,mood,note:$("moodNote").value.trim(),createdAt:old?old.createdAt:now,updatedAt:now};
 moods=old?moods.map(x=>x.id===id?item:x):[...moods,item];save(KEYS.moods,moods);hideModal("moodModal");renderAll();go("mood");toast(old?"تم تعديل تسجيل المزاج 🌸":"تم تسجيل مزاجك 🌸")
};
$("goalForm").onsubmit=e=>{
 e.preventDefault();
 const id=$("goalId").value,old=goals.find(g=>g.id===id),now=Date.now();
 const lines=$("goalSteps").value.split("\n").map(s=>s.trim()).filter(Boolean);
 const oldSteps=old&&Array.isArray(old.steps)?old.steps:[];
 const steps=lines.map((text,i)=>{
   const same=oldSteps.find(s=>s.text===text)||oldSteps[i];
   return {id:(same&&same.id)||uid(),text,done:!!(same&&same.text===text&&same.done)}
 });
 const g={id:id||uid(),title:$("goalTitle").value.trim(),category:$("goalCategory").value,targetDate:$("goalTargetDate").value||"",progress:Number($("goalProgress").value)||0,steps,note:$("goalNote").value.trim(),createdAt:old?old.createdAt:now,updatedAt:now};
 goals=old?goals.map(x=>x.id===id?g:x):[...goals,g];save(KEYS.goals,goals);hideModal("goalModal");renderAll();go("goals");toast(old?"تم تعديل الهدف 🎯":"تمت إضافة الهدف 🎯")
};
$("noteForm").onsubmit=e=>{e.preventDefault();const id=$("noteId").value,old=notes.find(n=>n.id===id),now=Date.now();const n={id:id||uid(),title:$("noteTitle").value.trim(),body:$("noteBody").value.trim(),category:$("noteCategory").value,createdAt:old?old.createdAt:now,updatedAt:now};notes=old?notes.map(x=>x.id===id?n:x):[...notes,n];save(KEYS.notes,notes);hideModal("noteModal");renderAll();go("notes");toast(old?"تم تعديل الملاحظة 🌸":"تم حفظ الملاحظة 🌸")};
$("ideaForm").onsubmit=e=>{e.preventDefault();const id=$("ideaId").value,old=ideas.find(i=>i.id===id),now=Date.now();const i={id:id||uid(),title:$("ideaTitle").value.trim(),body:$("ideaBody").value.trim(),category:$("ideaCategory").value,createdAt:old?old.createdAt:now,updatedAt:now};ideas=old?ideas.map(x=>x.id===id?i:x):[...ideas,i];save(KEYS.ideas,ideas);hideModal("ideaModal");renderAll();go("ideas");toast(old?"تم تعديل الفكرة ✨":"تم حفظ الفكرة ✨")};

$("taskList").onclick=e=>{
 const b=e.target.closest("[data-task-action]");if(!b)return;const box=b.closest(".taskItem"),t=tasks.find(x=>x.id===box.dataset.id);if(!t)return;
 if(b.dataset.taskAction==="toggle"){t.completed=!t.completed;save(KEYS.tasks,tasks);ensureRecurringTasks();renderAll();toast(t.completed?"مهمة مكتملة ✓":"رجّعنا المهمة للقائمة")}
 if(b.dataset.taskAction==="edit")openTask(t);
 if(b.dataset.taskAction==="delete"&&confirm(t.seriesId?`حذف هذه المرة من "${t.title}"؟ التكرارات القادمة ستبقى.`:`حذف المهمة: "${t.title}"؟`)){
   if(t.seriesId)addTaskRecurrenceException(t.seriesId,t.date);
   tasks=tasks.filter(x=>x.id!==t.id);save(KEYS.tasks,tasks);ensureRecurringTasks();renderAll();toast("تم حذف المهمة")
 }
};

$("notesList").onclick=e=>{const b=e.target.closest("[data-note-action]");if(!b)return;const box=b.closest(".noteCard"),n=notes.find(x=>x.id===box.dataset.id);if(!n)return;if(b.dataset.noteAction==="edit")openNote(n);if(b.dataset.noteAction==="delete"&&confirm(`حذف الملاحظة: "${n.title}"؟`)){notes=notes.filter(x=>x.id!==n.id);save(KEYS.notes,notes);renderAll();toast("تم حذف الملاحظة")}};

$("ideasList").onclick=e=>{const b=e.target.closest("[data-idea-action]");if(!b)return;const box=b.closest(".ideaCard"),i=ideas.find(x=>x.id===box.dataset.id);if(!i)return;if(b.dataset.ideaAction==="edit")openIdea(i);if(b.dataset.ideaAction==="delete"&&confirm(`حذف الفكرة: "${i.title}"؟`)){ideas=ideas.filter(x=>x.id!==i.id);save(KEYS.ideas,ideas);renderAll();toast("تم حذف الفكرة")}if(b.dataset.ideaAction==="task"){const now=Date.now();tasks.push({id:uid(),title:i.title,date:dateKey(),time:"",priority:"medium",category:i.category==="study"?"study":"personal",note:i.body,completed:false,createdAt:now});save(KEYS.tasks,tasks);renderAll();toast("تحولت الفكرة لمهمة ✅")}};

$("moodHistory").onclick=e=>{
 const row=e.target.closest(".moodHistoryItem");if(!row)return;const m=moods.find(x=>x.id===row.dataset.id);if(!m)return;
 const b=e.target.closest("[data-mood-action]");if(!b)return;
 if(b.dataset.moodAction==="edit")openMood(m);
 if(b.dataset.moodAction==="delete"&&confirm(`حذف تسجيل ${dateLabel(m.date)}؟`)){moods=moods.filter(x=>x.id!==m.id);save(KEYS.moods,moods);renderAll();toast("تم حذف التسجيل")}
};
$("goalList").onclick=e=>{
 const card=e.target.closest(".goalCard");if(!card)return;const g=goals.find(x=>x.id===card.dataset.id);if(!g)return;
 const step=e.target.closest("[data-goal-step]");
 if(step){
   const i=Number(step.dataset.goalStep);if(g.steps&&g.steps[i]){g.steps[i].done=!g.steps[i].done;g.updatedAt=Date.now();save(KEYS.goals,goals);renderAll();toast(g.steps[i].done?"خطوة مكتملة ✓":"تم إلغاء الخطوة")}return
 }
 const b=e.target.closest("[data-goal-action]");if(!b)return;
 if(b.dataset.goalAction==="edit")openGoal(g);
 if(b.dataset.goalAction==="task")goalToTask(g);
 if(b.dataset.goalAction==="delete"&&confirm(`حذف الهدف: "${g.title}"؟`)){goals=goals.filter(x=>x.id!==g.id);save(KEYS.goals,goals);renderAll();toast("تم حذف الهدف")}
};
$("studyList").onclick=e=>{
 const card=e.target.closest(".studyCard");if(!card)return;const s=studyItems.find(x=>x.id===card.dataset.id);if(!s)return;
 const b=e.target.closest("[data-study-action]");if(!b)return;
 if(b.dataset.studyAction==="toggle"){s.completed=!s.completed;save(KEYS.study,studyItems);renderAll();toast(s.completed?"تم إنجاز الموعد ✓":"تم إرجاع الموعد")}
 if(b.dataset.studyAction==="edit")openStudy(s);
 if(b.dataset.studyAction==="task"){
   tasks.push({id:uid(),title:s.title,date:s.date,time:s.time||"",priority:s.priority,category:"study",note:`${s.subject}${s.note?": "+s.note:""}`,reminder:normalizeReminderValue(s.reminder),completed:false,createdAt:Date.now()});save(KEYS.tasks,tasks);renderAll();toast("تم نسخه إلى المهام ✅")
 }
 if(b.dataset.studyAction==="delete"&&confirm(`حذف الموعد: "${s.title}"؟`)){studyItems=studyItems.filter(x=>x.id!==s.id);save(KEYS.study,studyItems);renderAll();toast("تم حذف الموعد")}
};
$("habitList").onclick=e=>{
 const card=e.target.closest(".habitCard");if(!card)return;const h=habits.find(x=>x.id===card.dataset.id);if(!h)return;
 const action=e.target.closest("[data-habit-action]");
 if(action){
   if(action.dataset.habitAction==="today"){const k=dateKey();h.completions=h.completions||{};if(h.completions[k])delete h.completions[k];else h.completions[k]=true;save(KEYS.habits,habits);renderAll();toast(h.completions[k]?"عادة مكتملة ✓":"تم إلغاء الإكمال")}
   if(action.dataset.habitAction==="pause"){h.paused=!h.paused;h.updatedAt=Date.now();save(KEYS.habits,habits);renderAll();toast(h.paused?"تم إيقاف العادة مؤقتًا ⏸":"تم استئناف العادة ▶️")}
   if(action.dataset.habitAction==="edit")openHabit(h);
   if(action.dataset.habitAction==="delete"&&confirm(`حذف العادة: "${h.title}"؟`)){habits=habits.filter(x=>x.id!==h.id);save(KEYS.habits,habits);renderAll();toast("تم حذف العادة")}
   return
 }
 const day=e.target.closest("[data-habit-day]");
 if(day&&!day.disabled){const k=day.dataset.habitDay;h.completions=h.completions||{};if(h.completions[k])delete h.completions[k];else h.completions[k]=true;save(KEYS.habits,habits);renderAll();toast(h.completions[k]?"تم تسجيل اليوم ✓":"تم إلغاء اليوم")}
};
$("transactionList").onclick=e=>{
 const b=e.target.closest("[data-tx-action]");if(!b)return;
 const box=b.closest(".transactionItem"),t=transactions.find(x=>x.id===box.dataset.id);if(!t)return;
 if(b.dataset.txAction==="edit")openTransaction(t);
 if(b.dataset.txAction==="delete"&&confirm(`حذف الحركة: "${t.title}"؟`)){
   transactions=transactions.filter(x=>x.id!==t.id);save(KEYS.transactions,transactions);renderAll();toast("تم حذف الحركة")
 }
};
document.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(g){go(g.dataset.go,g.dataset.filter);return}const s=e.target.closest("[data-soon]");if(s)soon(s.dataset.soon);const c=e.target.closest("[data-close]");if(c)hideModal(c.dataset.close)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("quickAddModal").classList.contains("hidden"))closeQuickAdd()});
document.querySelectorAll("[data-task-filter]").forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;renderTasks()});

$("taskSearch").oninput=renderTasks;
$("taskCategoryFilter").onchange=()=>{taskCategoryFilter=$("taskCategoryFilter").value;renderTasks()};
$("taskPriorityFilter").onchange=()=>{taskPriorityFilter=$("taskPriorityFilter").value;renderTasks()};

$("taskRepeat").onchange=showTaskRepeatUI;


document.querySelectorAll("[data-goal-filter]").forEach(b=>b.onclick=()=>{goalFilter=b.dataset.goalFilter;renderGoals()});
$("goalSearch").oninput=renderGoals;
$("goalCategoryFilter").onchange=()=>{goalCategoryFilter=$("goalCategoryFilter").value;renderGoals()};
$("goalProgress").oninput=()=>{$("goalProgressValue").textContent=$("goalProgress").value+"%"};

document.querySelectorAll("[data-mood-choice]").forEach(b=>b.onclick=()=>setMoodChoice(b.dataset.moodChoice));
$("moodPrevMonth").onclick=()=>moodMoveMonth(-1);
$("moodNextMonth").onclick=()=>moodMoveMonth(1);
$("moodMonthGrid").onclick=e=>{const b=e.target.closest("[data-mood-date]");if(b)openMood(null,b.dataset.moodDate)};
$("moodWeekStrip").onclick=e=>{const b=e.target.closest("[data-mood-date]");if(b)openMood(null,b.dataset.moodDate)};
$("editTodayMood").onclick=()=>openMood(null,dateKey());

document.querySelectorAll("[data-note-filter]").forEach(b=>b.onclick=()=>{noteFilter=b.dataset.noteFilter;renderNotes()});
document.querySelectorAll("[data-idea-filter]").forEach(b=>b.onclick=()=>{ideaFilter=b.dataset.ideaFilter;renderIdeas()});

document.querySelectorAll("[data-expense-filter]").forEach(b=>b.onclick=()=>{expenseFilter=b.dataset.expenseFilter;renderExpenses()});

$("expenseSearch").oninput=renderExpenses;
$("expenseCategoryFilter").onchange=()=>{expenseCategoryFilter=$("expenseCategoryFilter").value;renderExpenses()};

document.querySelectorAll("[data-habit-filter]").forEach(b=>b.onclick=()=>{habitFilter=b.dataset.habitFilter;renderHabits()});
$("habitSearch").oninput=renderHabits;

$("habitPreset").onchange=()=>{if($("habitPreset").value!=="custom")applyHabitPreset($("habitPreset").value)};
document.querySelectorAll(".habitDaysPicker input").forEach(x=>x.onchange=()=>{$("habitPreset").value=habitPresetFromDays(habitSelectedDays())});


document.querySelectorAll("[data-study-filter]").forEach(b=>b.onclick=()=>{studyFilter=b.dataset.studyFilter;studySelectedDay="";renderStudy()});
$("studySearch").oninput=renderStudy;
$("studySubjectFilter").onchange=renderStudy;
$("studyWeekHeader").onclick=e=>{const b=e.target.closest("[data-study-day-filter]");if(!b)return;studySelectedDay=studySelectedDay===b.dataset.studyDayFilter?"":b.dataset.studyDayFilter;studyFilter="all";renderStudy()};

document.querySelectorAll("[data-type-choice]").forEach(b=>b.onclick=()=>setTransactionType(b.dataset.typeChoice));
$("expenseMonth").onchange=renderExpenses;
$("currencySelect").onchange=()=>{currency=$("currencySelect").value;localStorage.setItem("lifeOrganizer.currency.v1",currency);renderAll()};

$("noteSearch").oninput=renderNotes;$("ideaSearch").oninput=renderIdeas;

$("globalSearch").oninput=renderGlobalSearch;
$("clearGlobalSearch").onclick=()=>{$("globalSearch").value="";renderGlobalSearch();$("globalSearch").focus()};
$("globalSort").onchange=()=>{globalSort=$("globalSort").value;renderGlobalSearch()};
document.querySelectorAll("[data-global-type]").forEach(b=>b.onclick=()=>{globalType=b.dataset.globalType;renderGlobalSearch()});
$("globalResults").onclick=e=>{const b=e.target.closest("[data-search-open]");if(!b)return;const card=b.closest(".globalResult");openGlobalResult(card.dataset.type,card.dataset.id)};

$("addTask").onclick=()=>openTask();$("addNote").onclick=()=>openNote();$("addIdea").onclick=()=>openIdea();$("addTransaction").onclick=()=>openTransaction();$("addHabit").onclick=()=>openHabit();$("addStudy").onclick=()=>openStudy();$("addGoal").onclick=()=>openGoal();$("addMood").onclick=()=>openMood(null,dateKey());
$("quickAddFab").onclick=openQuickAdd;
$("homeQuickAdd").onclick=openQuickAdd;
$("moreQuickAdd").onclick=openQuickAdd;
document.querySelectorAll("[data-quick-type]").forEach(b=>b.onclick=()=>quickAdd(b.dataset.quickType));
["taskModal","noteModal","ideaModal","expenseModal","habitModal","studyModal","goalModal","moodModal","quickAddModal","pinModal","removePinModal","installModal"].forEach(id=>$(id).onclick=e=>{if(e.target===$(id))hideModal(id)});






document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=()=>chooseAppearance("theme",b.dataset.themeChoice));
document.querySelectorAll("[data-bg-choice]").forEach(b=>b.onclick=()=>chooseAppearance("background",b.dataset.bgChoice));
document.querySelectorAll("[data-mascot-choice]").forEach(b=>b.onclick=()=>chooseAppearance("mascot",b.dataset.mascotChoice));
document.querySelectorAll("[data-card-style]").forEach(b=>b.onclick=()=>chooseAppearance("cardStyle",b.dataset.cardStyle));
$("resetAppearance").onclick=resetAppearance;

$("setupPin").onclick=()=>openPinSetup("setup");
$("changePin").onclick=()=>openPinSetup("change");
$("removePin").onclick=()=>{$("removePinForm").reset();showModal("removePinModal")};
$("lockNow").onclick=()=>showPrivacyLock();
$("pinForm").onsubmit=async e=>{e.preventDefault();await handlePinSave()};
$("removePinForm").onsubmit=async e=>{e.preventDefault();await handleRemovePin()};
$("unlockForm").onsubmit=async e=>{e.preventDefault();await handleUnlock()};
$("autoLockMinutes").onchange=()=>{privacySettings.autoLockMinutes=Number($("autoLockMinutes").value)||5;savePrivacySettings();renderPrivacy();toast("تم حفظ وقت القفل")};
$("hideNotificationDetails").onchange=()=>{privacySettings.hideNotificationDetails=$("hideNotificationDetails").value==="yes";savePrivacySettings();renderPrivacy();toast("تم حفظ إعداد التنبيهات")};

$("enableNotifications").onclick=requestBloomieNotifications;
$("testNotification").onclick=()=>sendTestNotification(false);
$("refreshReminders").onclick=()=>{renderReminders();checkReminders();toast("تم تحديث التذكيرات ↻")};
document.querySelectorAll("[data-reminder-filter]").forEach(b=>b.onclick=()=>{reminderFilter=b.dataset.reminderFilter;renderReminders()});
$("reminderList").onclick=e=>{const b=e.target.closest("[data-reminder-open]");if(!b)return;const row=b.closest(".reminderItem");reminderOpen(row.dataset.type,row.dataset.id)};
$("habitReminder").onchange=showHabitReminderUI;

$("calendarPrev").onclick=()=>calendarMoveMonth(-1);
$("calendarNext").onclick=()=>calendarMoveMonth(1);
$("calendarToday").onclick=calendarGoToday;
document.querySelectorAll("[data-calendar-type]").forEach(b=>b.onclick=()=>{calendarTypeFilter=b.dataset.calendarType;renderCalendar()});
$("calendarGrid").onclick=e=>{const b=e.target.closest("[data-calendar-date]");if(!b)return;calendarSelectedDate=b.dataset.calendarDate;const d=new Date(`${calendarSelectedDate}T12:00:00`);calendarCursor=new Date(d.getFullYear(),d.getMonth(),1,12);renderCalendar()};
$("agendaList").onclick=e=>{const b=e.target.closest("[data-agenda-open]");if(!b)return;const row=b.closest(".agendaItem");openAgendaItem(row.dataset.type,row.dataset.id)};
$("calendarAddTask").onclick=()=>{openTask();$("taskDate").value=calendarSelectedDate};
$("calendarAddStudy").onclick=()=>{openStudy();$("studyDate").value=calendarSelectedDate};

$("showInstallHelp").onclick=()=>showModal("installModal");

$("exportBackup").onclick=exportBackup;
$("exportExpensesCsv").onclick=exportExpensesCsv;
$("chooseBackupFile").onclick=()=>$("importBackupFile").click();
$("importBackupFile").onchange=e=>{const file=e.target.files&&e.target.files[0];if(file)chooseBackupFile(file)};

const mascotTips=["اكتبي الفكرة قبل ما تهرب 💡","ملاحظة صغيرة اليوم توفر وقت بكرة 🌸","رتبي اللي في بالك خطوة خطوة 🐱","لو ضاع منك شيء استخدمي البحث الشامل 🔎","اعملي نسخة احتياطية من وقت للتاني 💾","المهام المتكررة توفر عليكِ كتابة نفس الشيء كل مرة 🔁","التقويم يجمع يومك كله في شاشة واحدة 📅","فعّلي تذكيرًا للأشياء اللي ما بدك تنسيها 🔔","الهدف الكبير يصير أسهل لما تقسميه خطوات صغيرة 🎯","تسجيل شعور بسيط اليوم يساعدك تتذكري شكل أسبوعك 🌸","كل مهمة تكمليها تزود نقاطك وتكبر حديقة Bloomie 🏆","فعّلي PIN لو حابة تقفلي شاشة Bloomie 🔒","غيري ألوان وخلفية وشخصية Bloomie من قسم الشكل 🎨","راجعي إحصائيات الشهر عشان تشوفي أرقامك كلها في مكان واحد 📊","زر ＋ في الأسفل يضيف مهمة أو مصروف أو فكرة أو ملاحظة بسرعة ⚡","من مشاركة خطتي تقدري تختاري بالضبط إيش يطلع لصحابك 📤"];$("mascot").onclick=()=>toast(mascotTips[Math.floor(Math.random()*mascotTips.length)]);
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").then(()=>setTimeout(()=>{if(!privacyLocked)checkReminders()},700)).catch(()=>{}));
header();applyAppearance(false);renderAll();go("home");initializePrivacy();
setInterval(()=>{if(!privacyLocked)checkReminders()},30000);
document.addEventListener("visibilitychange",()=>{privacyVisibilityChanged();if(!document.hidden&&!privacyLocked)checkReminders()});
window.addEventListener("focus",()=>{if(!privacyLocked)checkReminders()});
setTimeout(()=>{if(!privacyLocked)checkReminders()},1200);
if(localStorage.getItem("lifeOrganizer.lastSeenVersion")!==APP_VERSION){
  localStorage.setItem("lifeOrganizer.lastSeenVersion",APP_VERSION);
  setTimeout(()=>toast("Bloomie v2.2 جاهزة 🌸"),450);
}