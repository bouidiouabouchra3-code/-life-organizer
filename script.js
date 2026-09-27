const KEYS={tasks:"lifeOrganizer.tasks.v2",notes:"lifeOrganizer.notes.v1",ideas:"lifeOrganizer.ideas.v1",transactions:"lifeOrganizer.transactions.v1"};
let tasks=load(KEYS.tasks),notes=load(KEYS.notes),ideas=load(KEYS.ideas),transactions=load(KEYS.transactions);
let taskFilter="all",noteFilter="all",ideaFilter="all",expenseFilter="all";
let currency=localStorage.getItem("lifeOrganizer.currency.v1")||"ج.م";
const $=id=>document.getElementById(id);
const taskLabels={personal:"شخصي",study:"دراسة",home:"البيت",work:"شغل",other:"أخرى"};
const taskIcons={personal:"💗",study:"📚",home:"🏠",work:"💼",other:"✨"};
const priorities={low:"منخفضة",medium:"متوسطة",high:"عالية"};
const noteLabels={personal:"شخصية",study:"دراسة",work:"شغل",other:"أخرى"};
const ideaLabels={project:"مشروع",life:"حياتي",study:"دراسة",other:"أخرى"};
const ideaIcons={project:"🛍️",life:"🌷",study:"🎓",other:"💡"};

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

 $("todayCount").textContent=today.length;$("doneCount").textContent=done;$("notesCount").textContent=notes.length;$("ideasCount").textContent=ideas.length;
 $("todaySub").textContent=today.length?`${today.filter(t=>!t.completed).length} متبقية من ${today.length}`:"لا توجد مهام اليوم";
 $("notesSub").textContent=notes.length?"ملاحظات محفوظة":"اكتبي أول ملاحظة";
 $("ideasSub").textContent=ideas.length?"أفكار محفوظة":"احفظي أي فكرة";
 $("monthExpenseHome").textContent=money(monthExpense);
 $("monthBalanceHome").textContent=money(balance);
 $("expenseHomeSub").textContent=monthTx.length?`${monthTx.length} حركة هذا الشهر`:"ابدئي أول تسجيل";
 $("taskCardText").textContent=pending?`${pending} مهمة متبقية`:tasks.length?"كل المهام مكتملة ✨":"ابدئي أول مهمة";
 $("noteCardText").textContent=notes.length?`${notes.length} ملاحظة محفوظة`:"اكتبي أول ملاحظة";
 $("ideaCardText").textContent=ideas.length?`${ideas.length} فكرة محفوظة`:"احفظي أول فكرة";
 $("expenseCardText").textContent=monthTx.length?money(monthExpense)+" مصروفات":"ابدئي أول تسجيل";
}

function visibleTasks(){let a=[...tasks];if(taskFilter==="today")a=a.filter(t=>t.date===dateKey());if(taskFilter==="pending")a=a.filter(t=>!t.completed);if(taskFilter==="completed")a=a.filter(t=>t.completed);return sortTasks(a)}
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
 const month=selectedExpenseMonth();
 let a=transactions.filter(t=>monthKeyFromDate(t.date)===month);
 if(expenseFilter!=="all")a=a.filter(t=>t.type===expenseFilter);
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

function renderAll(){dashboard();renderTasks();renderNotes();renderIdeas();renderExpenses()}

function go(view,chosen){
 document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
 if(view==="home")$("homeView").classList.add("active");
 if(view==="tasks"){if(chosen)taskFilter=chosen;$("tasksView").classList.add("active");renderTasks()}
 if(view==="notes"){$("notesView").classList.add("active");renderNotes()}
 if(view==="ideas"){$("ideasView").classList.add("active");renderIdeas()}
 if(view==="expenses"){$("expensesView").classList.add("active");renderExpenses()}
 document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.go===view));
 window.scrollTo({top:0,behavior:"smooth"})
}
function soon(name){$("soonTitle").textContent=name+" قادم 🌸";const map={العادات:"سنفعّل متتبع العادات في P05.",الدراسة:"سنفعّل مخطط الدراسة في P06.",المزيد:"هنا سنجمع الإعدادات والنسخ الاحتياطي والخصائص الإضافية."};$("soonText").textContent=map[name]||"سنفعّل هذا القسم في باتش قادم.";document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$("soonView").classList.add("active")}

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
document.querySelectorAll("[data-note-filter]").forEach(b=>b.onclick=()=>{noteFilter=b.dataset.noteFilter;renderNotes()});
document.querySelectorAll("[data-idea-filter]").forEach(b=>b.onclick=()=>{ideaFilter=b.dataset.ideaFilter;renderIdeas()});

document.querySelectorAll("[data-expense-filter]").forEach(b=>b.onclick=()=>{expenseFilter=b.dataset.expenseFilter;renderExpenses()});
document.querySelectorAll("[data-type-choice]").forEach(b=>b.onclick=()=>setTransactionType(b.dataset.typeChoice));
$("expenseMonth").onchange=renderExpenses;
$("currencySelect").onchange=()=>{currency=$("currencySelect").value;localStorage.setItem("lifeOrganizer.currency.v1",currency);renderAll()};

$("noteSearch").oninput=renderNotes;$("ideaSearch").oninput=renderIdeas;
$("addTask").onclick=()=>openTask();$("addNote").onclick=()=>openNote();$("addIdea").onclick=()=>openIdea();$("addTransaction").onclick=()=>openTransaction();
["taskModal","noteModal","ideaModal","expenseModal"].forEach(id=>$(id).onclick=e=>{if(e.target===$(id))hideModal(id)});
$("mascot").onclick=()=>toast(["اكتبي الفكرة قبل ما تهرب 💡","ملاحظة صغيرة اليوم توفر وقت بكرة 🌸","رتبي اللي في بالك خطوة خطوة 🐱"][Math.floor(Math.random()*3)]);
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"));
header();renderAll();go("home");