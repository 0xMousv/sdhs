import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, getCountFromServer, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyChYh6bHiB7dAAcDYbrHzW61gyQR0A5UuM",authDomain:"ninjaturtels.firebaseapp.com",projectId:"ninjaturtels",storageBucket:"ninjaturtels.firebasestorage.app",messagingSenderId:"1063186224531",appId:"1:1063186224531:web:76b1369b477808e4654466",measurementId:"G-HEB32CJR1N"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app); const CLASS_OPTIONS=Array.from({length:10},(_,i)=>`1/${i+1}`);
let currentUser=null,currentUserData=null,allStudents=[],allTeachers=[],allPrincipals=[];
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const classLabel=c=>`الفصل ${c}`; const classesText=a=>(a||[]).map(classLabel).join(' • ');
function fillClassPicker(){const el=document.getElementById('teacherClasses');el.innerHTML=CLASS_OPTIONS.map(c=>`<label><input type="checkbox" value="${c}"> ${classLabel(c)}</label>`).join('');}
fillClassPicker();
onAuthStateChanged(auth,async user=>{if(!user){location.href='login.html';return;}try{const s=await getDoc(doc(db,'users',user.uid));if(!s.exists()||s.data().role!=='admin'){alert('ليس لديك صلاحية الوصول لهذه الصفحة');await signOut(auth);location.href='login.html';return;}currentUser=user;currentUserData=s.data();document.getElementById('adminName').textContent=currentUserData.name||'مدير النظام';initializeAdmin();}catch(e){console.error(e);alert('تعذر التحقق من الصلاحيات');await signOut(auth);location.href='login.html';}});
function initializeAdmin(){setupEvents();loadAll();document.getElementById('loadingState').style.display='none';}
async function loadAll(){await Promise.all([loadStudents(),loadTeachers(),loadPrincipals(),loadDashboard(),loadQuizzes(),loadReports()]);}
async function loadStudents(){const s=await getDocs(query(collection(db,'users'),where('role','==','student')));allStudents=s.docs.map(d=>({id:d.id,...d.data()}));renderStudents(allStudents);}
async function loadTeachers(){const s=await getDocs(query(collection(db,'users'),where('role','==','teacher')));allTeachers=s.docs.map(d=>({id:d.id,...d.data()}));renderTeachers(allTeachers);}
async function loadPrincipals(){const s=await getDocs(query(collection(db,'users'),where('role','==','principal')));allPrincipals=s.docs.map(d=>({id:d.id,...d.data()}));renderPrincipals();}
async function loadDashboard(){const q=await getDocs(collection(db,'quizzes'));const flags=allStudents.filter(x=>x.redFlag).length;document.getElementById('totalStudents').textContent=allStudents.length;document.getElementById('totalTeachers').textContent=allTeachers.length;document.getElementById('totalQuizzes').textContent=q.size;document.getElementById('redFlagCount').textContent=flags;document.getElementById('studentsCount').textContent=allStudents.length;document.getElementById('teachersCount').textContent=allTeachers.length;document.getElementById('recentStudents').innerHTML=[...allStudents].slice(-5).reverse().map(s=>`<div class="recent-item"><div class="recent-icon">🎓</div><div class="recent-info"><div class="recent-title">${esc(s.name)}</div><div class="recent-subtitle">${esc(classLabel(s.class))} • ${esc(s.email)}</div></div></div>`).join('')||'<div class="loading-item">لا يوجد طلاب</div>';document.getElementById('redFlagStudents').innerHTML=allStudents.filter(s=>s.redFlag).map(s=>`<div class="recent-item"><div class="recent-icon">🚩</div><div class="recent-info"><div class="recent-title">${esc(s.name)}</div><div class="recent-subtitle">${esc(classLabel(s.class))}</div></div></div>`).join('')||'<div class="loading-item">لا يوجد Red Flag</div>';}
function renderStudents(list){const b=document.getElementById('studentsTableBody');b.innerHTML=list.length?list.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(classLabel(s.class))}</td><td><span class="red-flag-badge ${s.redFlag?'active':'inactive'}">${s.redFlag?'🚩 يحتاج متابعة':'لا يوجد'}</span></td><td><button class="btn-edit" onclick="editStudent('${s.id}')">تعديل</button> <button class="btn-delete" onclick="deleteStudent('${s.id}')">حذف</button></td></tr>`).join(''):'<tr><td colspan="5" class="loading-cell">لا يوجد طلاب</td></tr>';}
function renderTeachers(list){const b=document.getElementById('teachersTableBody');b.innerHTML=list.length?list.map(t=>{const cs=t.targetClasses||t.classes||[];return `<tr><td>${esc(t.name)}</td><td>${esc(t.email)}</td><td>${esc(t.subject)}</td><td><div class="class-chips">${cs.map(c=>`<span>${esc(classLabel(c))}</span>`).join('')}</div></td><td><button class="btn-edit" onclick="editTeacher('${t.id}')">تعديل</button> <button class="btn-delete" onclick="deleteTeacher('${t.id}')">حذف</button></td></tr>`}).join(''):'<tr><td colspan="5" class="loading-cell">لا يوجد مدرسون</td></tr>';}
function renderPrincipals(){const b=document.getElementById('principalsTableBody');b.innerHTML=allPrincipals.length?allPrincipals.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.email)}</td><td><span class="status-badge active">مديرة</span></td><td><button class="btn-delete" onclick="deletePrincipal('${p.id}')">حذف</button></td></tr>`).join(''):'<tr><td colspan="4" class="loading-cell">لم يتم إنشاء حساب مديرة بعد</td></tr>';}
async function loadQuizzes(){const s=await getDocs(collection(db,'quizzes'));const b=document.getElementById('adminQuizzesGrid');const arr=s.docs.map(d=>({id:d.id,...d.data()}));b.innerHTML=arr.length?arr.map(q=>`<div class="quiz-card"><div class="quiz-header"><h3 class="quiz-title">${esc(q.title)}</h3><span class="quiz-subject">${esc(q.subject)}</span></div><div class="quiz-details"><div>👨‍🏫 ${esc(q.teacherName)}</div><div>👥 ${esc(classesText(q.targetClasses))}</div><div>⏱️ ${q.durationMinutes||10} دقيقة</div><div>📝 ${q.questions?.length||q.questionsCount||0} أسئلة</div></div></div>`).join(''):'<div class="loading-card">لا توجد كويزات</div>';}
async function loadReports(){const [topSnap,countSnap,qs]=await Promise.all([getDocs(query(collection(db,'studentStats'),orderBy('totalXP','desc'),limit(10))),getCountFromServer(collection(db,'submissions')),getDocs(collection(db,'quizzes'))]);const top=topSnap.docs.map(d=>d.data());document.getElementById('topStudents').innerHTML=top.map((x,i)=>`<div class="leaderboard-row"><div class="leaderboard-rank">${i+1}</div><div class="leaderboard-info"><div class="leaderboard-name">${esc(x.studentName)}</div><div class="leaderboard-meta">${x.completedQuizzes||0} كويز • متوسط ${Math.round(x.avgScore||0)}%</div></div><div class="leaderboard-xp">${x.totalXP||0} XP</div></div>`).join('')||'<div class="loading-item">لا توجد بيانات</div>';document.getElementById('quizStats').innerHTML=`<div class="recent-item"><div class="recent-icon">📝</div><div class="recent-info"><div class="recent-title">إجمالي الكويزات</div><div class="recent-subtitle">${qs.size} كويز</div></div></div><div class="recent-item"><div class="recent-icon">📊</div><div class="recent-info"><div class="recent-title">إجمالي التسليمات</div><div class="recent-subtitle">${countSnap.data().count} تسليم</div></div></div>`;}
function studentsToCSV(){ return [['name','email','class','redFlag'], ...allStudents.map(s=>[s.name||'',s.email||'',s.class||'', s.redFlag?'TRUE':'FALSE'])]; }
function downloadCSV(filename, rows){
  const csv=rows.map(r=>r.map(cell=>{const s=String(cell??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(',')).join('\r\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function parseCSV(text){
  const rows=[]; let i=0,field='',row=[],inQuotes=false;
  while(i<text.length){
    const c=text[i];
    if(inQuotes){
      if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else inQuotes=false; }
      else field+=c;
    } else {
      if(c==='"') inQuotes=true;
      else if(c===','){ row.push(field); field=''; }
      else if(c==='\n' || c==='\r'){ if(c==='\r'&&text[i+1]==='\n')i++; row.push(field); field=''; rows.push(row); row=[]; }
      else field+=c;
    }
    i++;
  }
  if(field.length||row.length){ row.push(field); rows.push(row); }
  return rows.filter(r=>r.some(c=>c!==''));
}
function genPassword(){ return 'Std'+Math.random().toString(36).slice(2,8)+Math.floor(Math.random()*90+10); }
async function importStudentsFromCSV(file){
  const text=await file.text();
  const rows=parseCSV(text);
  if(!rows.length){alert('الملف فاضي');return;}
  const header=rows[0].map(h=>h.trim().toLowerCase());
  const dataRows=rows.slice(1);
  const nameIdx=header.indexOf('name'), emailIdx=header.indexOf('email'), classIdx=header.indexOf('class'), passIdx=header.indexOf('password');
  if(nameIdx<0||emailIdx<0||classIdx<0){alert('الملف لازم يحتوي أعمدة: name, email, class (وpassword اختياري)');return;}

  const body=document.getElementById('importResultsBody'); body.innerHTML='';
  document.getElementById('importResultsModal').classList.remove('hidden');
  const progressEl=document.getElementById('importProgress');
  let done=0, ok=0, fail=0;
  progressEl.textContent=`جاري الاستيراد... 0 / ${dataRows.length}`;

  for(const r of dataRows){
    const name=(r[nameIdx]||'').trim();
    const email=(r[emailIdx]||'').trim();
    const cls=(r[classIdx]||'').trim();
    const password=(passIdx>=0?(r[passIdx]||'').trim():'')||genPassword();
    done++;
    const tr=document.createElement('tr');
    if(!name||!email||!cls){
      tr.innerHTML=`<td>${esc(name||'-')}</td><td>${esc(email||'-')}</td><td class="import-status-fail">❌ صف ناقص (اسم/إيميل/فصل)</td>`;
      fail++;
    } else {
      let app=null;
      try{
        app=initializeApp(firebaseConfig,`Secondary-import-${Date.now()}-${Math.random().toString(36).slice(2,6)}`);
        const au=getAuth(app);
        const c=await createUserWithEmailAndPassword(au,email,password);
        const uid=c.user.uid;
        await setDoc(doc(db,'users',uid),{name,email,class:cls,redFlag:false,role:'student',uid,createdAt:new Date().toISOString()});
        await setDoc(doc(db,'studentStats',uid),{studentId:uid,studentName:name,studentClass:cls,class:cls,completedQuizzes:0,totalXP:0,totalPercentage:0,avgScore:0,updatedAt:new Date().toISOString()});
        await signOut(au); await deleteApp(app);
        tr.innerHTML=`<td>${esc(name)}</td><td>${esc(email)}</td><td class="import-status-ok">✅ تم — الباسورد: ${esc(password)}</td>`;
        ok++;
      }catch(err){
        if(app){ try{await deleteApp(app);}catch(e){} }
        const msg=err.code==='auth/email-already-in-use'?'البريد مستخدم بالفعل':(err.code==='auth/invalid-email'?'بريد إلكتروني غير صالح':(err.code==='auth/weak-password'?'كلمة السر ضعيفة (أقل من 6 أحرف)':(err.message||'فشل غير معروف')));
        tr.innerHTML=`<td>${esc(name)}</td><td>${esc(email)}</td><td class="import-status-fail">❌ ${esc(msg)}</td>`;
        fail++;
      }
    }
    body.appendChild(tr);
    progressEl.textContent=`جاري الاستيراد... ${done} / ${dataRows.length} (نجح ${ok}، فشل ${fail})`;
  }
  progressEl.textContent=`اكتمل الاستيراد: نجح ${ok} من ${dataRows.length}، فشل ${fail}`;
  await loadStudents(); await loadDashboard();
}
function setupEvents(){document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.content-section').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.section)?.classList.add('active');}));document.getElementById('logoutBtn')?.addEventListener('click',()=>signOut(auth).then(()=>location.href='login.html'));document.getElementById('addStudentBtn')?.addEventListener('click',()=>openModal('student'));document.getElementById('addTeacherBtn')?.addEventListener('click',()=>openModal('teacher'));document.getElementById('addPrincipalBtn')?.addEventListener('click',()=>document.getElementById('principalModal').classList.remove('hidden'));['closeStudentModal','cancelStudent'].forEach(x=>document.getElementById(x)?.addEventListener('click',()=>document.getElementById('studentModal').classList.add('hidden')));['closeTeacherModal','cancelTeacher'].forEach(x=>document.getElementById(x)?.addEventListener('click',()=>document.getElementById('teacherModal').classList.add('hidden')));['closePrincipalModal','cancelPrincipal'].forEach(x=>document.getElementById(x)?.addEventListener('click',()=>document.getElementById('principalModal').classList.add('hidden')));window.addEventListener('click',e=>{['studentModal','teacherModal','principalModal'].forEach(id=>{if(e.target===document.getElementById(id))document.getElementById(id).classList.add('hidden')});});document.getElementById('studentForm').addEventListener('submit',saveStudent);document.getElementById('teacherForm').addEventListener('submit',saveTeacher);document.getElementById('principalForm').addEventListener('submit',savePrincipal);document.getElementById('searchStudents')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();renderStudents(allStudents.filter(x=>(x.name||'').toLowerCase().includes(q)||(x.email||'').toLowerCase().includes(q)||(x.class||'').includes(q)))});document.getElementById('searchTeachers')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();renderTeachers(allTeachers.filter(x=>(x.name||'').toLowerCase().includes(q)||(x.email||'').toLowerCase().includes(q)||(x.subject||'').toLowerCase().includes(q)))});
document.getElementById('exportStudentsBtn')?.addEventListener('click',()=>downloadCSV('students-export.csv',studentsToCSV()));
document.getElementById('downloadTemplateBtn')?.addEventListener('click',()=>downloadCSV('students-import-template.csv',[['name','email','class','password'],['أحمد محمد علي','ahmed.mohamed@student.com','1/1','']]));
document.getElementById('importStudentsBtn')?.addEventListener('click',()=>document.getElementById('importStudentsFile').click());
document.getElementById('importStudentsFile')?.addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;e.target.disabled=true;try{await importStudentsFromCSV(file);}finally{e.target.disabled=false;e.target.value='';}});
document.getElementById('closeImportResultsModal')?.addEventListener('click',()=>document.getElementById('importResultsModal').classList.add('hidden'));
}
function openModal(type){const f=document.getElementById(type==='student'?'studentForm':'teacherForm');f.reset();delete f.dataset.id;f.dataset.mode='add';const emailEl=document.getElementById(type==='student'?'studentEmail':'teacherEmail');if(emailEl)emailEl.disabled=false;const passEl=document.getElementById(type==='student'?'studentPassword':'teacherPassword');if(passEl)passEl.required=true;if(type==='teacher')document.querySelectorAll('#teacherClasses input').forEach(x=>x.checked=false);document.getElementById(type+'Modal').classList.remove('hidden');}
async function createAuthProfile(email,password,data,label){const a=initializeApp(firebaseConfig,`Secondary-${label}-${Date.now()}`),au=getAuth(a);try{const c=await createUserWithEmailAndPassword(au,email,password);await setDoc(doc(db,'users',c.user.uid),{...data,uid:c.user.uid,createdAt:new Date().toISOString()});await signOut(au);await deleteApp(a);}catch(e){await deleteApp(a);throw e;}}
async function saveStudent(e){e.preventDefault();const f=e.target,name=document.getElementById('studentName').value.trim(),email=document.getElementById('studentEmail').value.trim(),password=document.getElementById('studentPassword').value,studentClass=document.getElementById('studentClass').value;if(!name||!email||!studentClass||(f.dataset.mode==='add'&&!password)){alert('أكمل البيانات المطلوبة');return;}try{if(f.dataset.mode==='add'){const a=initializeApp(firebaseConfig,`Secondary-student-${Date.now()}`),au=getAuth(a);try{const c=await createUserWithEmailAndPassword(au,email,password);const uid=c.user.uid;await setDoc(doc(db,'users',uid),{name,email,class:studentClass,redFlag:false,role:'student',uid,createdAt:new Date().toISOString()});await setDoc(doc(db,'studentStats',uid),{studentId:uid,studentName:name,studentClass:studentClass,class:studentClass,completedQuizzes:0,totalXP:0,totalPercentage:0,avgScore:0,updatedAt:new Date().toISOString()});await signOut(au);await deleteApp(a);}catch(err){await deleteApp(a);throw err;}}else await updateDoc(doc(db,'users',f.dataset.id),{name,class:studentClass,updatedAt:new Date().toISOString()});alert('تم حفظ الطالب');f.parentElement.parentElement.classList.add('hidden');await loadStudents();await loadDashboard();}catch(e){alert('حدث خطأ: '+(e.code==='auth/email-already-in-use'?'البريد مستخدم بالفعل':e.message));}}
async function saveTeacher(e){e.preventDefault();const f=e.target,name=document.getElementById('teacherName').value.trim(),email=document.getElementById('teacherEmail').value.trim(),password=document.getElementById('teacherPassword').value,subject=document.getElementById('teacherSubject').value,classes=[...document.querySelectorAll('#teacherClasses input:checked')].map(x=>x.value);if(!name||!email||!subject||!classes.length||(f.dataset.mode==='add'&&!password)){alert('اختر اسم المدرس والمادة وكمان فصل واحد على الأقل');return;}try{const data={name,email,subject,role:'teacher',targetClasses:classes,classes};if(f.dataset.mode==='add')await createAuthProfile(email,password,data,'teacher');else await updateDoc(doc(db,'users',f.dataset.id),{name,subject,targetClasses:classes,classes,updatedAt:new Date().toISOString()});alert('تم حفظ المدرس — الفصول أصبحت محددة من الإدارة فقط');f.parentElement.parentElement.classList.add('hidden');await loadTeachers();await loadDashboard();}catch(e){alert('حدث خطأ: '+(e.code==='auth/email-already-in-use'?'البريد مستخدم بالفعل':e.message));}}
async function savePrincipal(e){e.preventDefault();const name=document.getElementById('principalName').value.trim(),email=document.getElementById('principalEmail').value.trim(),password=document.getElementById('principalPassword').value;if(!name||!email||password.length<6){alert('أكمل البيانات وكلمة المرور 6 أحرف على الأقل');return;}try{await createAuthProfile(email,password,{name,email,role:'principal',title:'مديرة المدرسة'},'principal');alert('تم إنشاء حساب المديرة');document.getElementById('principalModal').classList.add('hidden');e.target.reset();await loadPrincipals();}catch(e){alert('حدث خطأ: '+(e.code==='auth/email-already-in-use'?'البريد مستخدم بالفعل':e.message));}}
window.editStudent=id=>{const s=allStudents.find(x=>x.id===id);if(!s)return;const f=document.getElementById('studentForm');f.dataset.mode='edit';f.dataset.id=id;document.getElementById('studentModalTitle').textContent='تعديل الطالب';document.getElementById('studentName').value=s.name||'';document.getElementById('studentEmail').value=s.email||'';document.getElementById('studentEmail').disabled=true;document.getElementById('studentClass').value=s.class||'';document.getElementById('studentPassword').required=false;document.getElementById('studentModal').classList.remove('hidden');};
window.editTeacher=id=>{const t=allTeachers.find(x=>x.id===id);if(!t)return;const f=document.getElementById('teacherForm');f.dataset.mode='edit';f.dataset.id=id;document.getElementById('teacherModalTitle').textContent='تعديل المدرس والفصول';document.getElementById('teacherName').value=t.name||'';document.getElementById('teacherEmail').value=t.email||'';document.getElementById('teacherEmail').disabled=true;document.getElementById('teacherSubject').value=t.subject||'';document.querySelectorAll('#teacherClasses input').forEach(x=>x.checked=(t.targetClasses||t.classes||[]).includes(x.value));document.getElementById('teacherPassword').required=false;document.getElementById('teacherModal').classList.remove('hidden');};
window.deleteStudent=async id=>{if(confirm('حذف الطالب؟')){await deleteDoc(doc(db,'users',id));await loadStudents();await loadDashboard();}};window.deleteTeacher=async id=>{if(confirm('حذف المدرس؟')){await deleteDoc(doc(db,'users',id));await loadTeachers();await loadDashboard();}};window.deletePrincipal=async id=>{if(confirm('حذف حساب المديرة؟')){await deleteDoc(doc(db,'users',id));await loadPrincipals();}};
