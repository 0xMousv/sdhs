import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, where, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyChYh6bHiB7dAAcDYbrHzW61gyQR0A5UuM", authDomain: "ninjaturtels.firebaseapp.com", projectId: "ninjaturtels",
  storageBucket: "ninjaturtels.firebasestorage.app", messagingSenderId: "1063186224531", appId: "1:1063186224531:web:76b1369b477808e4654466", measurementId: "G-HEB32CJR1N"
};
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const CLASS_OPTIONS = Array.from({length:10}, (_,i)=>`1/${i+1}`);
const CLOUDINARY_CLOUD = 'dhna8fguk', CLOUDINARY_PRESET = 'sadat_school';
let currentUser=null,currentUserData=null,allMaterials=[],allHomework=[],allQuizzes=[],allStudents=[],allAnnouncements=[],allViews=[];

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const classLabel = c => c ? `الفصل ${c}` : 'غير محدد';
const teacherClasses = () => Array.isArray(currentUserData?.targetClasses) ? currentUserData.targetClasses : (Array.isArray(currentUserData?.classes) ? currentUserData.classes : (currentUserData?.class ? [currentUserData.class] : []));
const classesText = arr => (arr||[]).map(classLabel).join(' • ');

onAuthStateChanged(auth, async user => {
  if(!user){ location.href='login.html'; return; }
  try{
    const snap=await getDoc(doc(db,'users',user.uid));
    if(!snap.exists() || snap.data().role!=='teacher'){ alert('ليس لديك صلاحية الوصول لهذه الصفحة'); await signOut(auth); location.href='login.html'; return; }
    currentUser=user; currentUserData=snap.data();
    document.getElementById('teacherName').textContent=currentUserData.name||'المدرس';
    document.getElementById('teacherSubject').textContent=currentUserData.subject||'—';
    document.getElementById('welcomeName').textContent=currentUserData.name||'أستاذ';
    document.getElementById('assignedClassesText').textContent=classesText(teacherClasses()) || 'لم يتم إسناد فصول';
    initializeTeacher();
  }catch(e){console.error(e);alert('تعذر تحميل حساب المدرس');await signOut(auth);location.href='login.html';}
});

function initializeTeacher(){
  loadAll(); setupEvents();
  const l=document.getElementById('loadingState'); if(l) l.style.display='none';
}
async function loadAll(){ await Promise.all([loadMaterials(),loadHomework(),loadQuizzes(),loadStudents(),loadAnnouncements(),loadViews()]); updateDashboard(); renderMaterials(); renderHomework(); renderQuizzes(); renderStudents(); renderAnnouncements(); }
async function loadMaterials(){ const s=await getDocs(query(collection(db,'materials'),where('teacherId','==',currentUser.uid))); allMaterials=s.docs.map(d=>({id:d.id,...d.data()})); }
async function loadHomework(){ const s=await getDocs(query(collection(db,'homework'),where('teacherId','==',currentUser.uid))); allHomework=s.docs.map(d=>({id:d.id,...d.data()})); }
async function loadQuizzes(){ const s=await getDocs(query(collection(db,'quizzes'),where('teacherId','==',currentUser.uid))); allQuizzes=s.docs.map(d=>({id:d.id,...d.data()})); }
async function loadStudents(){ const s=await getDocs(query(collection(db,'users'),where('role','==','student'))); const allowed=teacherClasses(); allStudents=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>allowed.includes(x.class)); }
async function loadAnnouncements(){ const s=await getDocs(query(collection(db,'announcements'),where('teacherId','==',currentUser.uid))); allAnnouncements=s.docs.map(d=>({id:d.id,...d.data()})); }
async function loadViews(){ const s=await getDocs(query(collection(db,'materialViews'),where('teacherId','==',currentUser.uid))); allViews=s.docs.map(d=>({id:d.id,...d.data()})); }

function updateDashboard(){
  document.getElementById('totalMaterials').textContent=allMaterials.length;
  document.getElementById('totalQuizzes').textContent=allQuizzes.length;
  document.getElementById('totalStudents').textContent=allStudents.length;
  document.getElementById('teacherClassesCount').textContent=teacherClasses().length;
  document.getElementById('materialsCount').textContent=allMaterials.length;
  document.getElementById('quizzesCount').textContent=allQuizzes.length;
  document.getElementById('homeworkCount').textContent=allHomework.length;
  const recentM=[...allMaterials].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,5);
  document.getElementById('recentMaterials').innerHTML=recentM.length?recentM.map(m=>`<div class="recent-item"><div class="recent-icon">📚</div><div class="recent-info"><div class="recent-title">${esc(m.title)}</div><div class="recent-subtitle">${esc(m.subject||currentUserData.subject)} • ${esc(m.targetClasses?.map(classLabel).join('، ')||classesText(teacherClasses()))}</div></div></div>`).join(''):'<div class="loading-item">لا توجد شروحات بعد</div>';
  const recentQ=[...allQuizzes].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,5);
  document.getElementById('recentQuizzes').innerHTML=recentQ.length?recentQ.map(q=>`<div class="recent-item"><div class="recent-icon">📝</div><div class="recent-info"><div class="recent-title">${esc(q.title)}</div><div class="recent-subtitle">${esc(q.durationMinutes||10)} دقيقة • ${esc(classesText(q.targetClasses||teacherClasses()))}</div></div></div>`).join(''):'<div class="loading-item">لا توجد كويزات بعد</div>';
}

function renderMaterials(){
 const grid=document.getElementById('materialsGrid');
 if(!allMaterials.length){grid.innerHTML='<div class="loading-card">لا توجد شروحات حتى الآن</div>';return;}
 grid.innerHTML=[...allMaterials].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).map(m=>{
   const views=allViews.filter(v=>v.materialId===m.id); const extras=[m.youtubeUrl||m.url?'YouTube':'',m.fileUrl?(m.fileName||'ملف'):'',m.content?'نص إضافي':''].filter(Boolean);
   return `<article class="material-card premium-material"><div class="material-glow"></div><div class="material-header"><div class="material-icon">📖</div><div><span class="material-kicker">${esc(m.subject||currentUserData.subject||'المادة')}</span><h3 class="material-title">${esc(m.title)}</h3><div class="material-teacher">${esc(classesText(m.targetClasses||teacherClasses()))}</div></div></div><p class="material-description">${esc(m.description)}</p><div class="material-extra-tags">${extras.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="material-views">👁️ ${views.length} مشاهدة</div><div class="material-actions"><a class="btn-view" href="material.html?id=${encodeURIComponent(m.id)}" target="_blank">فتح الدرس</a><button class="btn-edit" onclick="showMaterialViewers('${m.id}')">المشاهدات</button><button class="btn-edit" onclick="editMaterial('${m.id}')">تعديل</button><button class="btn-delete" onclick="deleteMaterial('${m.id}')">حذف</button></div></article>`;
 }).join('');
}
function renderHomework(){
 const grid=document.getElementById('homeworkGrid');
 if(!allHomework.length){grid.innerHTML='<div class="loading-card">لا توجد واجبات حتى الآن</div>';return;}
 grid.innerHTML=[...allHomework].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).map(m=>{
   const extras=[m.youtubeUrl||m.url?'YouTube':'',m.fileUrl?(m.fileName||'ملف'):'',m.content?'نص إضافي':''].filter(Boolean);
   return `<article class="material-card premium-material"><div class="material-glow"></div><div class="material-header"><div class="material-icon">📔</div><div><span class="material-kicker">${esc(m.subject||currentUserData.subject||'المادة')}</span><h3 class="material-title">${esc(m.title)}</h3><div class="material-teacher">${esc(classesText(m.targetClasses||teacherClasses()))}</div></div></div><p class="material-description">${esc(m.description)}</p><div class="material-extra-tags">${extras.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="material-actions"><a class="btn-view" href="material.html?id=${encodeURIComponent(m.id)}&col=homework" target="_blank">فتح الواجب</a><button class="btn-edit" onclick="editHomework('${m.id}')">تعديل</button><button class="btn-delete" onclick="deleteHomework('${m.id}')">حذف</button></div></article>`;
 }).join('');
}
function renderQuizzes(){
 const grid=document.getElementById('quizzesGrid'); if(!allQuizzes.length){grid.innerHTML='<div class="loading-card">لا توجد كويزات حتى الآن</div>';return;}
 grid.innerHTML=[...allQuizzes].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).map(q=>`<article class="quiz-card"><div class="quiz-header"><div><h3 class="quiz-title">${esc(q.title)}</h3><span class="quiz-subject">${esc(q.subject||currentUserData.subject)}</span></div><div class="quiz-xp">+${q.xpReward||0} XP</div></div><div class="quiz-details"><div class="quiz-detail">👥 ${esc(classesText(q.targetClasses||teacherClasses()))}</div><div class="quiz-detail">❓ ${q.questions?.length||q.questionsCount||0} أسئلة</div><div class="quiz-detail">⏱️ ${q.durationMinutes||10} دقيقة</div><div class="quiz-detail">🗓️ ${q.startAt?new Date(q.startAt).toLocaleString('ar-EG'):''} → ${q.deadline?new Date(q.deadline).toLocaleString('ar-EG'):''}</div></div><div class="material-actions"><button class="btn-edit" onclick="editQuiz('${q.id}')">تعديل</button><button class="btn-delete" onclick="deleteQuiz('${q.id}')">حذف</button></div></article>`).join('');
}
async function renderStudents(){
 const tbody=document.getElementById('studentsTableBody'); if(!allStudents.length){tbody.innerHTML='<tr><td colspan="6" class="loading-cell">لا يوجد طلاب في الفصول المسندة إليك</td></tr>';return;}
 const subs=await getDocs(query(collection(db,'submissions'),where('teacherId','==',currentUser.uid))); const submissions=subs.docs.map(d=>d.data());
 tbody.innerHTML=[...allStudents].sort((a,b)=>a.class.localeCompare(b.class,'ar',{numeric:true})||String(a.name||'').localeCompare(String(b.name||''),'ar')).map(s=>{const mine=submissions.filter(x=>x.studentId===s.id);const avg=mine.length?Math.round(mine.reduce((t,x)=>t+(x.totalQuestions?x.score/x.totalQuestions*100:0),0)/mine.length):0;return `<tr><td>${esc(s.name)}</td><td><strong>${esc(classLabel(s.class))}</strong></td><td>${avg}%</td><td>${mine.length}</td><td><span class="status-badge ${s.redFlag?'flagged':'active'}">${s.redFlag?'🚩 Red Flag':'نشط'}</span></td><td><button class="btn-toggle-flag" onclick="toggleStudentRedFlag('${s.id}')">${s.redFlag?'إزالة Red Flag':'وضع Red Flag'}</button></td></tr>`}).join('');
}
function renderAnnouncements(){ const el=document.getElementById('announcementsList'); if(!allAnnouncements.length){el.innerHTML='<div class="loading-item">لم ترسل إشعارات بعد</div>';return;} el.innerHTML=[...allAnnouncements].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).map(a=>`<div class="announcement-card"><div class="announcement-header"><h3 class="announcement-title">${esc(a.title)}</h3><span class="announcement-time">${esc(classesText(a.targetClasses||teacherClasses()))}</span></div><p class="announcement-content">${esc(a.content)}</p><div class="announcement-actions"><button class="btn-delete-announcement" onclick="deleteAnnouncement('${a.id}')">🗑️ حذف</button></div></div>`).join(''); }
window.deleteAnnouncement=async id=>{
  if(!confirm('متأكد إنك عايز تحذف الإشعار ده؟'))return;
  try{
    await deleteDoc(doc(db,'announcements',id));
    await loadAnnouncements();
    renderAnnouncements();
  }catch(err){ alert('حدث خطأ أثناء الحذف: '+err.message); }
};

function setupEvents(){
 document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.content-section').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.getElementById(btn.dataset.section)?.classList.add('active');}));
 document.getElementById('logoutBtn')?.addEventListener('click',()=>signOut(auth).then(()=>location.href='login.html'));
 document.getElementById('profileTrigger')?.addEventListener('click',openProfileModal);
 document.getElementById('closeProfileModal')?.addEventListener('click',()=>document.getElementById('profileModal').classList.add('hidden'));
 document.getElementById('profileModal')?.addEventListener('click',e=>{if(e.target.id==='profileModal')document.getElementById('profileModal').classList.add('hidden');});
 document.getElementById('passwordForm')?.addEventListener('submit',changePassword);
 document.getElementById('addMaterialBtn')?.addEventListener('click',openMaterialModal);
 document.getElementById('addHomeworkBtn')?.addEventListener('click',openHomeworkModal);
 document.getElementById('addQuizBtn')?.addEventListener('click',openQuizModal);
 document.getElementById('addAnnouncementBtn')?.addEventListener('click',openAnnouncementModal);
 ['closeMaterialModal','cancelMaterial'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>document.getElementById('materialModal').classList.add('hidden')));
 ['closeHomeworkModal','cancelHomework'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>document.getElementById('homeworkModal').classList.add('hidden')));
 ['closeQuizModal','cancelQuiz'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>document.getElementById('quizModal').classList.add('hidden')));
 ['closeAnnouncementModal','cancelAnnouncement'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>document.getElementById('announcementModal').classList.add('hidden')));
 document.getElementById('materialForm').addEventListener('submit',saveMaterial);
 document.getElementById('homeworkForm').addEventListener('submit',saveHomework);
 document.getElementById('quizForm').addEventListener('submit',saveQuiz);
 document.getElementById('announcementForm').addEventListener('submit',saveAnnouncement);
 document.getElementById('searchStudents')?.addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#studentsTableBody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')});
 document.getElementById('materialType')?.addEventListener('change',syncMaterialExtras);
 document.getElementById('homeworkType')?.addEventListener('change',syncHomeworkExtras);
 document.getElementById('deadlineDate')?.addEventListener('change',previewDeadline); document.getElementById('startTime')?.addEventListener('change',previewDeadline); document.getElementById('endTime')?.addEventListener('change',previewDeadline);
 document.getElementById('addQuestionBtn')?.addEventListener('click',addQuestion);
}
function openMaterialModal(){const f=document.getElementById('materialForm');f.reset();delete f.dataset.id;document.getElementById('materialSubject').value=currentUserData.subject||'';document.getElementById('assignedClassesPreview').textContent=classesText(teacherClasses());syncMaterialExtras();document.getElementById('materialModal').classList.remove('hidden');}
function openHomeworkModal(){const f=document.getElementById('homeworkForm');f.reset();delete f.dataset.id;document.getElementById('homeworkModalTitle').textContent='إضافة واجب جديد';document.getElementById('homeworkSubject').value=currentUserData.subject||'';document.getElementById('assignedHomeworkClassesPreview').textContent=classesText(teacherClasses());syncHomeworkExtras();document.getElementById('homeworkModal').classList.remove('hidden');}
function openQuizModal(){const f=document.getElementById('quizForm');f.reset();delete f.dataset.id;document.getElementById('quizModalTitle').textContent='إنشاء كويز جديد';document.getElementById('quizSubject').value=currentUserData.subject||'';document.getElementById('assignedQuizClasses').textContent=classesText(teacherClasses());document.getElementById('questionsContainer').innerHTML='';questionCounter=0;addQuestion();setDefaultQuizTimes();document.getElementById('quizModal').classList.remove('hidden');}
function openAnnouncementModal(){const f=document.getElementById('announcementForm');f.reset();delete f.dataset.id;document.getElementById('announcementClassesPreview').textContent=classesText(teacherClasses());document.getElementById('announcementModal').classList.remove('hidden');}
function syncMaterialExtras(){const type=document.getElementById('materialType')?.value;document.getElementById('youtubeGroup')?.classList.toggle('hidden',type!=='video');document.getElementById('fileGroup')?.classList.toggle('hidden',type!=='file');document.getElementById('textGroup')?.classList.toggle('hidden',type!=='text');}
function syncHomeworkExtras(){const type=document.getElementById('homeworkType')?.value;document.getElementById('homeworkYoutubeGroup')?.classList.toggle('hidden',type!=='video');document.getElementById('homeworkFileGroup')?.classList.toggle('hidden',type!=='file');document.getElementById('homeworkTextGroup')?.classList.toggle('hidden',type!=='text');}
function setDefaultQuizTimes(){const now=new Date();const d=now.toISOString().slice(0,10);document.getElementById('deadlineDate').value=d;document.getElementById('startTime').value=now.toTimeString().slice(0,5);document.getElementById('endTime').value=new Date(now.getTime()+60*60*1000).toTimeString().slice(0,5);previewDeadline();}
function previewDeadline(){const d=document.getElementById('deadlineDate')?.value,s=document.getElementById('startTime')?.value,e=document.getElementById('endTime')?.value; if(d&&s&&e) document.getElementById('deadlinePreviewText').textContent=`من ${s} إلى ${e} يوم ${new Date(d+'T00:00').toLocaleDateString('ar-EG')}`;}
let questionCounter=0;
function addQuestion(){const tpl=document.getElementById('questionTemplate');if(!tpl)return;questionCounter++;const node=tpl.content.cloneNode(true);const card=node.querySelector('.question-card');card.dataset.index=questionCounter;card.querySelector('.question-number').textContent=`السؤال ${questionCounter}`;card.querySelector('.question-number-badge').textContent=questionCounter;card.querySelectorAll('.option-radio').forEach(r=>r.name=`correct_answer_${questionCounter}`);card.querySelector('.btn-remove-question').addEventListener('click',()=>{card.remove();renumberQuestions()});document.getElementById('questionsContainer').appendChild(node);renumberQuestions();}
function renumberQuestions(){document.querySelectorAll('#questionsContainer .question-card').forEach((c,i)=>{c.querySelector('.question-number').textContent=`السؤال ${i+1}`;c.querySelector('.question-number-badge').textContent=i+1;c.querySelectorAll('.option-radio').forEach(r=>r.name=`correct_answer_${i+1}`);});}
function collectQuestions(){const out=[];for(const [i,card] of [...document.querySelectorAll('#questionsContainer .question-card')].entries()){const text=card.querySelector('.question-text').value.trim(), opts=[...card.querySelectorAll('.option-item')], correct=opts.findIndex(x=>x.querySelector('.option-radio').checked);if(!text||opts.some(x=>!x.querySelector('.option-text').value.trim())||correct<0)throw new Error(`أكمل بيانات السؤال ${i+1}`);out.push({questionNumber:i+1,questionText:text,options:opts.map(x=>({text:x.querySelector('.option-text').value.trim(),explanation:x.querySelector('.option-explanation').value.trim(),isCorrect:x.querySelector('.option-radio').checked})),correctAnswerIndex:correct,correctExplanation:card.querySelector('.correct-explanation').value.trim()});}if(!out.length)throw new Error('أضف سؤالًا واحدًا على الأقل');return out;}

async function uploadCloudinary(file){const fd=new FormData();fd.append('file',file);fd.append('upload_preset',CLOUDINARY_PRESET);const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`,{method:'POST',body:fd});const d=await r.json();if(!r.ok||!d.secure_url)throw new Error(d.error?.message||'فشل رفع الملف');return d;}
async function saveMaterial(e){e.preventDefault();const f=document.getElementById('materialForm');const title=document.getElementById('materialTitle').value.trim(),description=document.getElementById('materialDescription').value.trim(),type=document.getElementById('materialType').value; if(!title||!description){alert('العنوان وشرح الدرس إجباريان');return;}const data={title,description,subject:currentUserData.subject||'',teacherId:currentUser.uid,teacherName:currentUserData.name||'',targetClasses:teacherClasses(),targetClass:teacherClasses()[0]||'',updatedAt:new Date().toISOString(),featured:document.getElementById('materialFeatured').checked};if(!data.targetClasses.length){alert('هذا المدرس غير مسند له أي فصل');return;}if(type==='video'){const url=document.getElementById('materialUrl').value.trim();if(url){data.youtubeUrl=url;data.url=url;data.type='video';}}if(type==='text'){const text=document.getElementById('materialContent').value.trim();if(text){data.content=text;data.type='text';}}if(type==='file'){const file=document.getElementById('materialFile').files[0];if(file){if(file.type!=='application/pdf'&&!file.type.startsWith('image/')){alert('المسموح PDF أو صورة فقط');return;}const up=await uploadCloudinary(file);data.fileUrl=up.secure_url;data.fileName=file.name;data.cloudinaryPublicId=up.public_id;data.type=file.type==='application/pdf'?'pdf':'image';}}if(!data.type)data.type='lesson';try{if(f.dataset.id){await updateDoc(doc(db,'materials',f.dataset.id),data);alert('تم تحديث الدرس بنجاح');}else{data.createdAt=new Date().toISOString();await addDoc(collection(db,'materials'),data);alert('تم نشر الدرس بنجاح');}f.classList.add('hidden');document.getElementById('materialModal').classList.add('hidden');await loadMaterials();await loadViews();updateDashboard();renderMaterials();}catch(err){console.error(err);alert('حدث خطأ: '+err.message);}}
async function saveHomework(e){e.preventDefault();const f=document.getElementById('homeworkForm');const title=document.getElementById('homeworkTitle').value.trim(),description=document.getElementById('homeworkDescription').value.trim(),type=document.getElementById('homeworkType').value; if(!title||!description){alert('العنوان ووصف الواجب إجباريان');return;}const data={title,description,subject:currentUserData.subject||'',teacherId:currentUser.uid,teacherName:currentUserData.name||'',targetClasses:teacherClasses(),targetClass:teacherClasses()[0]||'',updatedAt:new Date().toISOString()};if(!data.targetClasses.length){alert('هذا المدرس غير مسند له أي فصل');return;}if(type==='video'){const url=document.getElementById('homeworkUrl').value.trim();if(url){data.youtubeUrl=url;data.url=url;data.type='video';}}if(type==='text'){const text=document.getElementById('homeworkContent').value.trim();if(text){data.content=text;data.type='text';}}if(type==='file'){const file=document.getElementById('homeworkFile').files[0];if(file){if(file.type!=='application/pdf'&&!file.type.startsWith('image/')){alert('المسموح PDF أو صورة فقط');return;}const up=await uploadCloudinary(file);data.fileUrl=up.secure_url;data.fileName=file.name;data.cloudinaryPublicId=up.public_id;data.type=file.type==='application/pdf'?'pdf':'image';}}if(!data.type)data.type='lesson';try{if(f.dataset.id){await updateDoc(doc(db,'homework',f.dataset.id),data);alert('تم تحديث الواجب بنجاح');}else{data.createdAt=new Date().toISOString();await addDoc(collection(db,'homework'),data);alert('تم نشر الواجب بنجاح');}f.classList.add('hidden');document.getElementById('homeworkModal').classList.add('hidden');await loadHomework();updateDashboard();renderHomework();}catch(err){console.error(err);alert('حدث خطأ: '+err.message);}}
async function saveQuiz(e){e.preventDefault();try{const questions=collectQuestions(),date=document.getElementById('deadlineDate').value,start=document.getElementById('startTime').value,end=document.getElementById('endTime').value;if(!date||!start||!end||start>=end)throw new Error('حدد وقت بداية ونهاية صحيحين');const data={title:document.getElementById('quizTitle').value.trim(),subject:currentUserData.subject||'',xpReward:Number(document.getElementById('quizXP').value)||50,durationMinutes:Number(document.getElementById('quizDuration').value)||10,isOptional:document.getElementById('quizOptional').checked,questions,questionsCount:questions.length,teacherId:currentUser.uid,teacherName:currentUserData.name||'',targetClasses:teacherClasses(),targetClass:teacherClasses()[0]||'',startAt:new Date(`${date}T${start}`).toISOString(),deadline:new Date(`${date}T${end}`).toISOString(),updatedAt:new Date().toISOString()};if(!data.title)throw new Error('اكتب عنوان الكويز');if(!data.targetClasses.length)throw new Error('المدرس غير مسند لفصل');if(document.getElementById('quizForm').dataset.id)await updateDoc(doc(db,'quizzes',document.getElementById('quizForm').dataset.id),data);else{data.createdAt=new Date().toISOString();await addDoc(collection(db,'quizzes'),data);}alert('تم حفظ الكويز بنجاح');document.getElementById('quizModal').classList.add('hidden');await loadQuizzes();updateDashboard();renderQuizzes();}catch(err){console.error(err);alert(err.message);}}
async function saveAnnouncement(e){e.preventDefault();const title=document.getElementById('announcementTitle').value.trim(),content=document.getElementById('announcementContent').value.trim();if(!title||!content){alert('العنوان والمحتوى إجباريان');return;}const classes=teacherClasses();if(!classes.length){alert('لا يوجد فصول مسندة');return;}try{await addDoc(collection(db,'announcements'),{title,content,teacherId:currentUser.uid,teacherName:currentUserData.name||'',subject:currentUserData.subject||'',targetClasses:classes,targetClass:classes[0],createdAt:new Date().toISOString(),readBy:[]});alert('تم إرسال الإشعار إلى الفصول المسندة إليك');document.getElementById('announcementModal').classList.add('hidden');await loadAnnouncements();renderAnnouncements();}catch(err){alert('حدث خطأ: '+err.message);}}

function openProfileModal(){document.getElementById('profileNameField').textContent=currentUserData.name||'-';document.getElementById('profileEmailField').textContent=currentUserData.email||currentUser.email||'-';document.getElementById('profileSubjectField').textContent=currentUserData.subject||'-';document.getElementById('passwordForm').reset();setPasswordMsg('','');document.getElementById('profileModal').classList.remove('hidden');}
function setPasswordMsg(text,type){const msg=document.getElementById('passwordMsg');msg.textContent=text;msg.className='form-msg'+(type?' '+type:'');}
async function changePassword(e){
  e.preventDefault();
  const current=document.getElementById('currentPassword').value,next=document.getElementById('newPassword').value,confirmPass=document.getElementById('confirmPassword').value;
  if(next.length<6){setPasswordMsg('كلمة السر الجديدة لازم تكون 6 حروف على الأقل','error');return;}
  if(next!==confirmPass){setPasswordMsg('تأكيد كلمة السر مش مطابق','error');return;}
  const btn=document.getElementById('changePasswordBtn');btn.disabled=true;
  try{
    const cred=EmailAuthProvider.credential(currentUser.email,current);
    await reauthenticateWithCredential(currentUser,cred);
    await updatePassword(currentUser,next);
    setPasswordMsg('تم تغيير كلمة السر بنجاح ✅','success');
    document.getElementById('passwordForm').reset();
  }catch(err){
    console.error(err);
    const map={'auth/wrong-password':'كلمة السر الحالية غلط','auth/too-many-requests':'محاولات كتير، حاول تاني بعد شوية','auth/weak-password':'كلمة السر ضعيفة، اختار كلمة أقوى'};
    setPasswordMsg(map[err.code]||'حدث خطأ: '+err.message,'error');
  }finally{btn.disabled=false;}
}
window.editMaterial=async id=>{const m=allMaterials.find(x=>x.id===id);if(!m)return;openMaterialModal();const f=document.getElementById('materialForm');f.dataset.id=id;document.getElementById('materialTitle').value=m.title||'';document.getElementById('materialDescription').value=m.description||'';document.getElementById('materialSubject').value=m.subject||currentUserData.subject||'';document.getElementById('materialType').value=m.type==='video'?'video':m.type==='text'?'text':(m.fileUrl?'file':'');document.getElementById('materialUrl').value=m.youtubeUrl||m.url||'';document.getElementById('materialContent').value=m.content||'';syncMaterialExtras();};
window.deleteMaterial=async id=>{if(!confirm('حذف هذا الدرس؟'))return;await deleteDoc(doc(db,'materials',id));await loadMaterials();await loadViews();updateDashboard();renderMaterials();};
window.editHomework=async id=>{const m=allHomework.find(x=>x.id===id);if(!m)return;openHomeworkModal();const f=document.getElementById('homeworkForm');f.dataset.id=id;document.getElementById('homeworkModalTitle').textContent='تعديل الواجب';document.getElementById('homeworkTitle').value=m.title||'';document.getElementById('homeworkDescription').value=m.description||'';document.getElementById('homeworkSubject').value=m.subject||currentUserData.subject||'';document.getElementById('homeworkType').value=m.type==='video'?'video':m.type==='text'?'text':(m.fileUrl?'file':'');document.getElementById('homeworkUrl').value=m.youtubeUrl||m.url||'';document.getElementById('homeworkContent').value=m.content||'';syncHomeworkExtras();};
window.deleteHomework=async id=>{if(!confirm('حذف هذا الواجب؟'))return;await deleteDoc(doc(db,'homework',id));await loadHomework();updateDashboard();renderHomework();};
window.showMaterialViewers=async id=>{const rows=allViews.filter(x=>x.materialId===id).sort((a,b)=>new Date(b.lastSeenAt||b.openedAt||0)-new Date(a.lastSeenAt||a.openedAt||0));alert(rows.length?rows.map(x=>`${x.studentName||'طالب'} — ${x.openedAt?new Date(x.openedAt).toLocaleString('ar-EG'):''}`).join('\n'):'لم يشاهد أي طالب الدرس بعد');};
window.toggleStudentRedFlag=async id=>{const s=allStudents.find(x=>x.id===id);if(!s)return;await updateDoc(doc(db,'users',id),{redFlag:!s.redFlag,updatedAt:new Date().toISOString(),redFlagBy:currentUser.uid,redFlagTeacherName:currentUserData.name||''});await loadStudents();renderStudents();};
window.editQuiz=async id=>{
  const q=allQuizzes.find(x=>x.id===id);
  if(!q)return;
  openQuizModal();
  const f=document.getElementById('quizForm');
  f.dataset.id=id;
  document.getElementById('quizModalTitle').textContent='تعديل الكويز';
  document.getElementById('quizTitle').value=q.title||'';
  document.getElementById('quizSubject').value=q.subject||currentUserData.subject||'';
  document.getElementById('quizXP').value=q.xpReward||50;
  document.getElementById('quizDuration').value=q.durationMinutes||10;
  document.getElementById('quizOptional').checked=!!q.isOptional;
  if(q.startAt){
    const s=new Date(q.startAt);
    document.getElementById('deadlineDate').value=s.toISOString().slice(0,10);
    document.getElementById('startTime').value=s.toTimeString().slice(0,5);
  }
  if(q.deadline) document.getElementById('endTime').value=new Date(q.deadline).toTimeString().slice(0,5);
  previewDeadline();

  document.getElementById('questionsContainer').innerHTML='';
  questionCounter=0;
  const qs=q.questions||[];
  qs.forEach(qq=>{
    addQuestion();
    const card=document.querySelector('#questionsContainer .question-card:last-child');
    card.querySelector('.question-text').value=qq.questionText||'';
    const opts=[...card.querySelectorAll('.option-item')];
    (qq.options||[]).forEach((op,i)=>{
      if(!opts[i])return;
      opts[i].querySelector('.option-text').value=op.text||'';
      opts[i].querySelector('.option-explanation').value=op.explanation||'';
      opts[i].querySelector('.option-radio').checked = op.isCorrect===true || i===qq.correctAnswerIndex;
    });
    card.querySelector('.correct-explanation').value=qq.correctExplanation||'';
  });
  if(!qs.length) addQuestion();
};
window.deleteQuiz=async id=>{if(!confirm('حذف الكويز؟'))return;await deleteDoc(doc(db,'quizzes',id));await loadQuizzes();updateDashboard();renderQuizzes();};
