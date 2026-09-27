const KEYS={tasks:"lifeOrganizer.tasks.v2",notes:"lifeOrganizer.notes.v1",ideas:"lifeOrganizer.ideas.v1",transactions:"lifeOrganizer.transactions.v1",habits:"lifeOrganizer.habits.v1",study:"lifeOrganizer.study.v1"};
let tasks=load(KEYS.tasks),notes=load(KEYS.notes),ideas=load(KEYS.ideas),transactions=load(KEYS.transactions),habits=load(KEYS.habits),studyItems=load(KEYS.study);
let taskFilter="all",noteFilter="all",ideaFilter="all",expenseFilter="all",habitFilter="all",studyFilter="all",studySelectedDay="";
let taskCategoryFilter="all",taskPriorityFilter="all",expenseCategoryFilter="all",globalType="all",globalSort="newest";
let currency=localStorage.getItem("lifeOrganizer.currency.v1")||"ج.م";

const BACKUP_META_KEY="lifeOrganizer.backupMeta.v1";
const BACKUP_FORMAT_VERSION=1;
const APP_VERSION="1.0";
const PATCH_VERSION="P09";
let pendingImportData=null;

const $=id=>document.getElementById(id);
const taskLabels={personal:"شخصي",study:"دراسة",home:"البيت",work:"شغل",other:"أخرى"};
const taskIcons={personal:"💗",study:"📚",home:"🏠",work:"💼",other:"✨"};
const priorities={low:"منخفضة",medium:"متوسطة",high:"عالية"};
const noteLabels={personal:"شخصية",study:"دراسة",work:"شغل",other:"أخرى"};
const ideaLabels={project:"مشروع",life:"حياتي",study:"دراسة",other:"أخرى"};
const ideaIcons={project:"🛍️",life:"🌷",study:"🎓",other:"💡"};

const studyTypeLabels={study:"مذاكرة",class:"محاضرة / حصة",homework:"واجب",exam:"امتحان",review:"مراجعة",other:"أخرى"};
const studyTypeIcons={study:"📖",class:"🏫",homework:"✍️",exam:"📝",review:"🔁",other:"📌"};
const studyReminderLabels={none:"بدون تذكير",same_day:"تذكير اليوم",one_day:"قبلها بيوم",two_days:"قبلها بيومين"};


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
function studyReminderDue(item){
 if(item.completed||item.reminder==="none")return false;
 const today=new Date();today.setHours(0,0,0,0);const d=new Date(`${item.date}T00:00:00`);const days=Math.round((d-today)/86400000);
 if(item.reminder==="same_day")return days===0;
 if(item.reminder==="one_day")return days===1;
 if(item.reminder==="two_days")return days===2;
 return false
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
 const today=tasks.filter(t=>t.date===dateKey()),done=tasks.filter(t=>t.completed).length,pending=tasks.filter(t=>!t.completed).length;
 const monthTx=transactions.filter(t=>monthKeyFromDate(t.date)===currentMonth());
 const monthIncome=monthTx.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount||0),0);
 const monthExpense=monthTx.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);
 const balance=monthIncome-monthExpense;
 const now=new Date(),dueHabits=habits.filter(h=>habitDueOn(h,now)),doneHabits=dueHabits.filter(h=>habitDoneOn(h,now));
 const studyToday=studyItems.filter(s=>s.date===dateKey());
 const studyWeek=studyItems.filter(s=>studyIsThisWeek(s)&&!s.completed);

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
 $("taskCardText").textContent=pending?`${pending} مهمة متبقية`:tasks.length?"كل المهام مكتملة ✨":"ابدئي أول مهمة";
 $("noteCardText").textContent=notes.length?`${notes.length} ملاحظة محفوظة`:"اكتبي أول ملاحظة";
 $("ideaCardText").textContent=ideas.length?`${ideas.length} فكرة محفوظة`:"احفظي أول فكرة";
 $("expenseCardText").textContent=monthTx.length?money(monthExpense)+" مصروفات":"ابدئي أول تسجيل";
 $("habitCardText").textContent=habits.length?`${doneHabits.length}/${dueHabits.length} اليوم`:"ابدئي أول عادة";
 $("studyCardText").textContent=studyItems.length?`${studyToday.length} اليوم`:"أضيفي أول جلسة";
 if($("moreNotesText"))$("moreNotesText").textContent=notes.length?`${notes.length} ملاحظة محفوظة`:"اكتبي أول ملاحظة";
 if($("moreIdeasText"))$("moreIdeasText").textContent=ideas.length?`${ideas.length} فكرة محفوظة`:"احفظي أول فكرة";
 if($("moreStudyText"))$("moreStudyText").textContent=studyItems.length?`${studyWeek.length} قادمة هذا الأسبوع`:"أضيفي أول جلسة";
}

function visibleTasks(){
 const today=dateKey(),q=$("taskSearch")?$("taskSearch").value.trim().toLowerCase():"";
 let a=[...tasks];
 if(taskFilter==="today")a=a.filter(t=>t.date===today);
 if(taskFilter==="pending")a=a.filter(t=>!t.completed);
 if(taskFilter==="completed")a=a.filter(t=>t.completed);
 if(taskCategoryFilter!=="all")a=a.filter(t=>t.category===taskCategoryFilter);
 if(taskPriorityFilter!=="all")a=a.filter(t=>t.priority===taskPriorityFilter);
 if(q)a=a.filter(t=>(t.title+" "+(t.note||"")+" "+(taskLabels[t.category]||"")).toLowerCase().includes(q));
 return sortTasks(a)
}
function renderTasks(){
 const done=tasks.filter(t=>t.completed).length,pct=tasks.length?Math.round(done/tasks.length*100):0;
 $("progressBar").style.width=pct+"%";$("progressText").textContent=tasks.length?`${done} من ${tasks.length} مكتملة`:"لا توجد مهام بعد";
 document.querySelectorAll("[data-task-filter]").forEach(b=>b.classList.toggle("active",b.dataset.taskFilter===taskFilter));
 const a=visibleTasks();
 if(!a.length){$("taskList").innerHTML=`<div class="empty"><div>🐱🌷</div><h3>مساحة هادئة</h3><p>${taskFilter==="today"?"ما عندكِ مهام لليوم.":taskFilter==="pending"?"ممتاز، ما فيش مهام متبقية.":taskFilter==="completed"?"ما فيش مهام مكتملة لسه.":"لسه ما أضفتيش مهام."}</p>${taskFilter!=="completed"?'<button id="emptyTaskAdd" class="primary">＋ أضيفي مهمة</button>':""}</div>`;if($("emptyTaskAdd"))$("emptyTaskAdd").onclick=()=>openTask();return}
 $("taskList").innerHTML=a.map(t=>`<article class="taskItem" data-id="${esc(t.id)}"><button class="check ${t.completed?"done":""}" data-task-action="toggle">${t.completed?"✓":""}</button><div class="taskBody"><p class="taskTitle ${t.completed?"done":""}">${esc(t.title)}</p><div class="meta"><span>${taskIcons[t.category]||"✨"} ${taskLabels[t.category]||"أخرى"}</span><span>🗓 ${dateLabel(t.date)}</span><span>🕒 ${timeLabel(t.time)}</span><span class="${t.priority}">● ${priorities[t.priority]}</span></div>${t.note?`<p class="taskNote">${esc(t.note)}</p>`:""}</div><div class="actions"><button data-task-action="edit">✏️</button><button class="delete" data-task-action="delete">🗑️</button></div></article>`).join("")
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
 if(habitFilter==="today")a=a.filter(h=>habitDueOn(h,now));
 if(habitFilter==="completed")a=a.filter(h=>habitDueOn(h,now)&&habitDoneOn(h,now));
 if(habitFilter==="pending")a=a.filter(h=>habitDueOn(h,now)&&!habitDoneOn(h,now));
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
 const now=new Date(),due=habits.filter(h=>habitDueOn(h,now)),done=due.filter(h=>habitDoneOn(h,now));
 $("habitsDue").textContent=due.length;$("habitsDone").textContent=done.length;$("habitsRate").textContent=due.length?Math.round(done.length/due.length*100)+"%":"0%";
 $("habitsSummary").textContent=habits.length?`${habits.length} عادة محفوظة`:"ابني روتينك يومًا بيوم";
 document.querySelectorAll("[data-habit-filter]").forEach(b=>b.classList.toggle("active",b.dataset.habitFilter===habitFilter));
 const a=visibleHabits();
 if(!a.length){
   $("habitList").innerHTML=`<div class="empty"><div>🌿🐱</div><h3>${habits.length?"لا توجد عادات في هذا الفلتر":"ابدئي عادة لطيفة"}</h3><p>${habits.length?"جربي فلترًا آخر.":"اختاري عادة صغيرة تقدري تكرريها بسهولة."}</p>${!habits.length?'<button id="emptyHabitAdd" class="primary habitBtn">＋ إضافة عادة</button>':""}</div>`;
   if($("emptyHabitAdd"))$("emptyHabitAdd").onclick=()=>openHabit();return
 }
 const dates=currentWeekDates(),todayKey=dateKey();
 $("habitList").innerHTML=a.map(h=>{
   const isDue=habitDueOn(h,now),isDone=habitDoneOn(h,now),streak=habitStreak(h),rate=habitRate30(h);
   const week=dates.map(d=>{
     const key=dateKeyFrom(d),scheduled=habitDueOn(h,d),completed=habitDoneOn(h,d),future=key>todayKey;
     return `<button class="habitDay ${scheduled?"scheduled":"unscheduled"} ${completed?"completed":""} ${future?"future":""}" data-habit-day="${key}" ${(!scheduled||future)?"disabled":""}><small>${weekShort[d.getDay()]}</small><b>${completed?"✓":d.getDate()}</b></button>`
   }).join("");
   return `<article class="habitCard" data-id="${esc(h.id)}">
     <div class="habitTop"><div class="habitIcon">${esc(h.icon||"✨")}</div><div class="habitTitleWrap"><h3>${esc(h.title)}</h3><p>${esc(h.note||"عادة شخصية")}</p></div><button class="todayCheck ${isDone?"done":""} ${!isDue?"notDue":""}" data-habit-action="today" ${!isDue?"disabled":""}>${isDone?"✓":""}</button></div>
     <div class="habitStats"><div class="habitStat"><span>🔥 الاستمرارية</span><strong>${streak} يوم</strong></div><div class="habitStat"><span>📈 آخر 30 يوم</span><strong>${rate}%</strong></div></div>
     <div class="habitWeek">${week}</div>
     <div class="habitBottom"><span class="habitRate">${h.days.length===7?"كل يوم":`${h.days.length} أيام بالأسبوع`}</span><div class="habitActions"><button data-habit-action="edit">✏️</button><button data-habit-action="delete">🗑️</button></div></div>
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
   const reminder=studyReminderDue(s)?`<div class="studyReminderBadge">🔔 ${studyReminderLabels[s.reminder]}</div>`:"";
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


const globalTypeInfo={
 tasks:{label:"مهمة",icon:"✅",view:"tasks"},
 notes:{label:"ملاحظة",icon:"📝",view:"notes"},
 ideas:{label:"فكرة",icon:"💡",view:"ideas"},
 expenses:{label:"حركة مالية",icon:"🪙",view:"expenses"},
 habits:{label:"عادة",icon:"🌿",view:"habits"},
 study:{label:"دراسة",icon:"🎓",view:"study"}
};
function normalizeGlobalItems(){
 const items=[];
 tasks.forEach(t=>items.push({type:"tasks",id:t.id,title:t.title,text:t.note||"",meta:[dateLabel(t.date),taskLabels[t.category]||"أخرى",priorities[t.priority]||""],stamp:Number(t.createdAt||0),search:[t.title,t.note,taskLabels[t.category],priorities[t.priority],t.date].join(" ")}));
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
     settings:{currency}
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
   study:Array.isArray(d.studyItems)?d.studyItems.length:0
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

 const meta=backupMeta();
 $("lastBackupText").textContent=formatDateTime(meta.lastExportAt);
 const total=tasks.length+notes.length+ideas.length+transactions.length+habits.length+studyItems.length;
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
 tasks=d.tasks;notes=d.notes;ideas=d.ideas;transactions=d.transactions;habits=d.habits;studyItems=d.studyItems;
 currency=(d.settings&&d.settings.currency)||currency;
 save(KEYS.tasks,tasks);save(KEYS.notes,notes);save(KEYS.ideas,ideas);save(KEYS.transactions,transactions);save(KEYS.habits,habits);save(KEYS.study,studyItems);
 localStorage.setItem("lifeOrganizer.currency.v1",currency);
 localStorage.setItem(BACKUP_META_KEY,JSON.stringify({lastImportAt:new Date().toISOString(),lastImportedBackupAt:pendingImportData.exportedAt,lastExportAt:backupMeta().lastExportAt||null}));
 pendingImportData=null;$("importBackupFile").value="";$("importPreview").classList.add("hidden");
 renderAll();go("backup");toast("تم استرجاع النسخة بنجاح ✅")
}
function cancelImportBackup(){
 pendingImportData=null;$("importBackupFile").value="";$("importPreview").classList.add("hidden");toast("تم إلغاء الاستيراد")
}

function renderAll(){dashboard();renderTasks();renderNotes();renderIdeas();renderExpenses();renderHabits();renderStudy();renderGlobalSearch();renderBackup()}

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
 document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.go===view));
 window.scrollTo({top:0,behavior:"smooth"})
}
function soon(name){$("soonTitle").textContent=name+" قادم 🌸";const map={الإعدادات:"سنضيف الإعدادات والنسخ الاحتياطي في الباتشات القادمة."};$("soonText").textContent=map[name]||"سنفعّل هذا القسم في باتش قادم.";document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$("soonView").classList.add("active")}

function showModal(id){$(id).classList.remove("hidden");document.body.style.overflow="hidden"}
function hideModal(id){$(id).classList.add("hidden");document.body.style.overflow=""}
function toast(s){$("toast").textContent=s;$("toast").classList.remove("hidden");clearTimeout(window._toast);window._toast=setTimeout(()=>$("toast").classList.add("hidden"),1700)}

function openTask(t){
 $("taskForm").reset();$("taskPriority").value="medium";$("taskCategory").value="personal";$("taskDate").value=dateKey();$("taskId").value="";
 if(t){$("taskModalTitle").textContent="تعديل المهمة";$("taskId").value=t.id;$("taskTitle").value=t.title;$("taskDate").value=t.date;$("taskTime").value=t.time||"";$("taskPriority").value=t.priority;$("taskCategory").value=t.category;$("taskNote").value=t.note||"";$("saveTask").textContent="حفظ التعديلات 💗"}else{$("taskModalTitle").textContent="إضافة مهمة";$("saveTask").textContent="حفظ المهمة 💗"}
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


function habitSelectedDays(){return [...document.querySelectorAll(".daysPicker input:checked")].map(x=>Number(x.value))}
function setHabitDays(days){document.querySelectorAll(".daysPicker input").forEach(x=>x.checked=days.includes(Number(x.value)))}
function openHabit(h){
 $("habitForm").reset();$("habitId").value="";$("habitIcon").value="💧";setHabitDays([6,0,1,2,3,4,5]);
 if(h){
   $("habitModalTitle").textContent="تعديل العادة";$("habitId").value=h.id;$("habitTitle").value=h.title;$("habitIcon").value=h.icon||"✨";$("habitNote").value=h.note||"";setHabitDays(h.days||[]);$("saveHabit").textContent="حفظ التعديلات 🌿";
 }else{$("habitModalTitle").textContent="عادة جديدة";$("saveHabit").textContent="حفظ العادة 🌿"}
 showModal("habitModal")
}


function openStudy(s){
 $("studyForm").reset();$("studyId").value="";$("studyDate").value=dateKey();$("studyPriority").value="medium";$("studyType").value="study";$("studyReminder").value="none";
 if(s){
   $("studyModalTitle").textContent="تعديل الموعد";$("studyId").value=s.id;$("studyTitle").value=s.title;$("studySubject").value=s.subject;$("studyType").value=s.type;$("studyPriority").value=s.priority;$("studyDate").value=s.date;$("studyTime").value=s.time||"";$("studyDuration").value=s.duration||"";$("studyReminder").value=s.reminder||"none";$("studyNote").value=s.note||"";$("saveStudy").textContent="حفظ التعديلات 🎓";
 }else{$("studyModalTitle").textContent="إضافة جلسة أو موعد";$("saveStudy").textContent="حفظ الموعد 🎓"}
 showModal("studyModal")
}


$("studyForm").onsubmit=e=>{
 e.preventDefault();const id=$("studyId").value,old=studyItems.find(s=>s.id===id),now=Date.now();
 const item={id:id||uid(),title:$("studyTitle").value.trim(),subject:$("studySubject").value.trim(),type:$("studyType").value,priority:$("studyPriority").value,date:$("studyDate").value,time:$("studyTime").value,duration:Number($("studyDuration").value)||0,reminder:$("studyReminder").value,note:$("studyNote").value.trim(),completed:old?old.completed:false,createdAt:old?old.createdAt:now,updatedAt:now};
 studyItems=old?studyItems.map(x=>x.id===id?item:x):[...studyItems,item];save(KEYS.study,studyItems);hideModal("studyModal");renderAll();go("study");toast(old?"تم تعديل الموعد 🎓":"تم حفظ الموعد 🎓")
};
$("habitForm").onsubmit=e=>{
 e.preventDefault();const days=habitSelectedDays();if(!days.length){toast("اختاري يومًا واحدًا على الأقل");return}
 const id=$("habitId").value,old=habits.find(h=>h.id===id),now=Date.now();
 const h={id:id||uid(),title:$("habitTitle").value.trim(),icon:$("habitIcon").value,days,note:$("habitNote").value.trim(),completions:old&&old.completions?old.completions:{},createdAt:old?old.createdAt:now,updatedAt:now};
 habits=old?habits.map(x=>x.id===id?h:x):[...habits,h];save(KEYS.habits,habits);hideModal("habitModal");renderAll();go("habits");toast(old?"تم تعديل العادة 🌿":"تمت إضافة العادة 🌿")
};
$("expenseForm").onsubmit=e=>{
 e.preventDefault();
 const id=$("transactionId").value,old=transactions.find(t=>t.id===id),now=Date.now();
 const t={id:id||uid(),type:$("transactionType").value,amount:Number($("transactionAmount").value),title:$("transactionTitle").value.trim(),date:$("transactionDate").value,category:$("transactionCategory").value,note:$("transactionNote").value.trim(),createdAt:old?old.createdAt:now,updatedAt:now};
 transactions=old?transactions.map(x=>x.id===id?t:x):[...transactions,t];
 save(KEYS.transactions,transactions);hideModal("expenseModal");renderAll();go("expenses");toast(old?"تم تعديل الحركة 🪙":"تم حفظ الحركة 🪙")
};
$("taskForm").onsubmit=e=>{e.preventDefault();const id=$("taskId").value,old=tasks.find(t=>t.id===id);const t={id:id||uid(),title:$("taskTitle").value.trim(),date:$("taskDate").value,time:$("taskTime").value,priority:$("taskPriority").value,category:$("taskCategory").value,note:$("taskNote").value.trim(),completed:old?old.completed:false,createdAt:old?old.createdAt:Date.now()};tasks=old?tasks.map(x=>x.id===id?t:x):[...tasks,t];save(KEYS.tasks,tasks);hideModal("taskModal");renderAll();go("tasks");toast(old?"تم تعديل المهمة ✨":"تمت إضافة المهمة 💗")};
$("noteForm").onsubmit=e=>{e.preventDefault();const id=$("noteId").value,old=notes.find(n=>n.id===id),now=Date.now();const n={id:id||uid(),title:$("noteTitle").value.trim(),body:$("noteBody").value.trim(),category:$("noteCategory").value,createdAt:old?old.createdAt:now,updatedAt:now};notes=old?notes.map(x=>x.id===id?n:x):[...notes,n];save(KEYS.notes,notes);hideModal("noteModal");renderAll();go("notes");toast(old?"تم تعديل الملاحظة 🌸":"تم حفظ الملاحظة 🌸")};
$("ideaForm").onsubmit=e=>{e.preventDefault();const id=$("ideaId").value,old=ideas.find(i=>i.id===id),now=Date.now();const i={id:id||uid(),title:$("ideaTitle").value.trim(),body:$("ideaBody").value.trim(),category:$("ideaCategory").value,createdAt:old?old.createdAt:now,updatedAt:now};ideas=old?ideas.map(x=>x.id===id?i:x):[...ideas,i];save(KEYS.ideas,ideas);hideModal("ideaModal");renderAll();go("ideas");toast(old?"تم تعديل الفكرة ✨":"تم حفظ الفكرة ✨")};

$("taskList").onclick=e=>{const b=e.target.closest("[data-task-action]");if(!b)return;const box=b.closest(".taskItem"),t=tasks.find(x=>x.id===box.dataset.id);if(!t)return;if(b.dataset.taskAction==="toggle"){t.completed=!t.completed;save(KEYS.tasks,tasks);renderAll();toast(t.completed?"مهمة مكتملة ✓":"رجّعنا المهمة للقائمة")}if(b.dataset.taskAction==="edit")openTask(t);if(b.dataset.taskAction==="delete"&&confirm(`حذف المهمة: "${t.title}"؟`)){tasks=tasks.filter(x=>x.id!==t.id);save(KEYS.tasks,tasks);renderAll();toast("تم حذف المهمة")}};

$("notesList").onclick=e=>{const b=e.target.closest("[data-note-action]");if(!b)return;const box=b.closest(".noteCard"),n=notes.find(x=>x.id===box.dataset.id);if(!n)return;if(b.dataset.noteAction==="edit")openNote(n);if(b.dataset.noteAction==="delete"&&confirm(`حذف الملاحظة: "${n.title}"؟`)){notes=notes.filter(x=>x.id!==n.id);save(KEYS.notes,notes);renderAll();toast("تم حذف الملاحظة")}};

$("ideasList").onclick=e=>{const b=e.target.closest("[data-idea-action]");if(!b)return;const box=b.closest(".ideaCard"),i=ideas.find(x=>x.id===box.dataset.id);if(!i)return;if(b.dataset.ideaAction==="edit")openIdea(i);if(b.dataset.ideaAction==="delete"&&confirm(`حذف الفكرة: "${i.title}"؟`)){ideas=ideas.filter(x=>x.id!==i.id);save(KEYS.ideas,ideas);renderAll();toast("تم حذف الفكرة")}if(b.dataset.ideaAction==="task"){const now=Date.now();tasks.push({id:uid(),title:i.title,date:dateKey(),time:"",priority:"medium",category:i.category==="study"?"study":"personal",note:i.body,completed:false,createdAt:now});save(KEYS.tasks,tasks);renderAll();toast("تحولت الفكرة لمهمة ✅")}};

$("studyList").onclick=e=>{
 const card=e.target.closest(".studyCard");if(!card)return;const s=studyItems.find(x=>x.id===card.dataset.id);if(!s)return;
 const b=e.target.closest("[data-study-action]");if(!b)return;
 if(b.dataset.studyAction==="toggle"){s.completed=!s.completed;save(KEYS.study,studyItems);renderAll();toast(s.completed?"تم إنجاز الموعد ✓":"تم إرجاع الموعد")}
 if(b.dataset.studyAction==="edit")openStudy(s);
 if(b.dataset.studyAction==="task"){
   tasks.push({id:uid(),title:s.title,date:s.date,time:s.time||"",priority:s.priority,category:"study",note:`${s.subject}${s.note?": "+s.note:""}`,completed:false,createdAt:Date.now()});save(KEYS.tasks,tasks);renderAll();toast("تم نسخه إلى المهام ✅")
 }
 if(b.dataset.studyAction==="delete"&&confirm(`حذف الموعد: "${s.title}"؟`)){studyItems=studyItems.filter(x=>x.id!==s.id);save(KEYS.study,studyItems);renderAll();toast("تم حذف الموعد")}
};
$("habitList").onclick=e=>{
 const card=e.target.closest(".habitCard");if(!card)return;const h=habits.find(x=>x.id===card.dataset.id);if(!h)return;
 const action=e.target.closest("[data-habit-action]");
 if(action){
   if(action.dataset.habitAction==="today"){const k=dateKey();h.completions=h.completions||{};if(h.completions[k])delete h.completions[k];else h.completions[k]=true;save(KEYS.habits,habits);renderAll();toast(h.completions[k]?"عادة مكتملة ✓":"تم إلغاء الإكمال")}
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
document.querySelectorAll("[data-task-filter]").forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;renderTasks()});

$("taskSearch").oninput=renderTasks;
$("taskCategoryFilter").onchange=()=>{taskCategoryFilter=$("taskCategoryFilter").value;renderTasks()};
$("taskPriorityFilter").onchange=()=>{taskPriorityFilter=$("taskPriorityFilter").value;renderTasks()};

document.querySelectorAll("[data-note-filter]").forEach(b=>b.onclick=()=>{noteFilter=b.dataset.noteFilter;renderNotes()});
document.querySelectorAll("[data-idea-filter]").forEach(b=>b.onclick=()=>{ideaFilter=b.dataset.ideaFilter;renderIdeas()});

document.querySelectorAll("[data-expense-filter]").forEach(b=>b.onclick=()=>{expenseFilter=b.dataset.expenseFilter;renderExpenses()});

$("expenseSearch").oninput=renderExpenses;
$("expenseCategoryFilter").onchange=()=>{expenseCategoryFilter=$("expenseCategoryFilter").value;renderExpenses()};

document.querySelectorAll("[data-habit-filter]").forEach(b=>b.onclick=()=>{habitFilter=b.dataset.habitFilter;renderHabits()});
$("habitSearch").oninput=renderHabits;

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

$("addTask").onclick=()=>openTask();$("addNote").onclick=()=>openNote();$("addIdea").onclick=()=>openIdea();$("addTransaction").onclick=()=>openTransaction();$("addHabit").onclick=()=>openHabit();$("addStudy").onclick=()=>openStudy();
["taskModal","noteModal","ideaModal","expenseModal","habitModal","studyModal","installModal"].forEach(id=>$(id).onclick=e=>{if(e.target===$(id))hideModal(id)});


$("showInstallHelp").onclick=()=>showModal("installModal");

$("exportBackup").onclick=exportBackup;
$("exportExpensesCsv").onclick=exportExpensesCsv;
$("chooseBackupFile").onclick=()=>$("importBackupFile").click();
$("importBackupFile").onchange=e=>{const file=e.target.files&&e.target.files[0];if(file)chooseBackupFile(file)};

$("mascot").onclick=()=>toast(["اكتبي الفكرة قبل ما تهرب 💡","ملاحظة صغيرة اليوم توفر وقت بكرة 🌸","رتبي اللي في بالك خطوة خطوة 🐱","لو ضاع منك شيء استخدمي البحث الشامل 🔎","اعملي نسخة احتياطية من وقت للتاني 💾"][Math.floor(Math.random()*3)]);
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"));
header();renderAll();go("home");
if(localStorage.getItem("lifeOrganizer.lastSeenVersion")!==APP_VERSION){
  localStorage.setItem("lifeOrganizer.lastSeenVersion",APP_VERSION);
  setTimeout(()=>toast("نسخة الإطلاق v1.0 جاهزة 🌸"),450);
}