// js/student.js

// =========================================
// 1. Firebase Configuration & Imports
// =========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    addDoc, 
    updateDoc,
    query,
    where,
    setDoc,
    orderBy,
    limit,
    getCountFromServer,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyChYh6bHiB7dAAcDYbrHzW61gyQR0A5UuM",
    authDomain: "ninjaturtels.firebaseapp.com",
    projectId: "ninjaturtels",
    storageBucket: "ninjaturtels.firebasestorage.app",
    messagingSenderId: "1063186224531",
    appId: "1:1063186224531:web:76b1369b477808e4654466",
    measurementId: "G-HEB32CJR1N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================================
// 2. Global Variables
// =========================================
let currentUser = null;
let currentUserData = null;
let allQuizzes = [];
let allSubmissions = [];
let allMaterials = [];
let allAnnouncements = [];
let allLeaderboard = [];
let allStudentStats = [];
let classBoard = [];
let schoolBoard = [];
let leaderboardScope = 'class';
const studentClass = () => currentUserData.class || '';
const targetsMe = d => (Array.isArray(d.targetClasses) ? d.targetClasses.includes(studentClass()) : d.targetClass === studentClass());

// =========================================
// 3. Authentication Check
// =========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('Student logged in:', user.email);

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                
                if (currentUserData.role === 'student') {
                    // تحديث واجهة المستخدم ببيانات الطالب
                    updateStudentUI();
                    
                    // التحقق من Red Flag
                    if (currentUserData.redFlag) {
                        document.getElementById('redFlagAlert').classList.remove('hidden');
                    }
                    
                    // تهيئة لوحة الطالب
                    initializeStudent();
                } else {
                    alert('ليس لديك صلاحية الوصول لهذه الصفحة');
                    await signOut(auth);
                    window.location.href = 'login.html';
                }
            } else {
                alert('الحساب غير مسجل كطالب على المنصة');
                await signOut(auth);
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Error checking user role:', error);
            alert('حدث خطأ في التحقق من الصلاحيات');
            await signOut(auth);
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

async function setupNotificationPermission(){
  if(!('Notification' in window)) return;
  const btn=document.getElementById('enableNotificationsBtn');
  if(Notification.permission==='granted'){ if(btn) btn.remove(); try{await setDoc(doc(db,'users',currentUser.uid),{notificationsEnabled:true},{merge:true});}catch(e){} return; }
  if(!btn) return;
  btn.addEventListener('click',async()=>{ const p=await Notification.requestPermission(); if(p==='granted'){ try{await setDoc(doc(db,'users',currentUser.uid),{notificationsEnabled:true},{merge:true});}catch(e){} btn.textContent='تم تفعيل الإشعارات'; btn.disabled=true; } });
}

// =========================================
// 4. Update Student UI
// =========================================
function updateStudentUI() {
    const name = currentUserData.name || 'طالب';
    const studentClass = currentUserData.class || 'الصف الأول الثانوي';
    
    document.getElementById('studentName').textContent = name;
    document.getElementById('studentClass').textContent = studentClass;
    document.getElementById('welcomeName').textContent = name;
}

// =========================================
// 5. Initialize Student Panel
// =========================================
function initializeStudent() {
    loadAllData();
    setupEventListeners();
    setupNotificationPermission();
    
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.style.display = 'none';
    }
}

// =========================================
// 6. Load All Data
// =========================================
async function loadAllData() {
    try {
        await Promise.all([
            loadQuizzes(),
            loadSubmissions(),
            loadMaterials(),
            loadAnnouncements(),
            loadLeaderboard()
        ]);
        
        // بعد تحميل كل البيانات، نحدث الواجهة
        updateDashboard();
        renderQuizzes();
        renderMaterials();
        renderAnnouncements();
        renderGrades();
        renderClassLeaderboard();
        await renderSchoolStats();
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// =========================================
// 9.5 Load Leaderboard + School Stats
// =========================================
async function loadLeaderboard() {
    try {
        const LB_LIMIT = 50;
        const [classSnap, schoolSnap] = await Promise.all([
            getDocs(query(collection(db, 'studentStats'), where('class', '==', studentClass()), orderBy('totalXP', 'desc'), limit(LB_LIMIT))),
            getDocs(query(collection(db, 'studentStats'), orderBy('totalXP', 'desc'), limit(LB_LIMIT)))
        ]);
        classBoard = classSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        schoolBoard = schoolSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allStudentStats = schoolBoard; // متوافق مع renderSchoolStats (تقريبي على أعلى 50 بدل قراءة الكل)
        allLeaderboard = classBoard;

        // لو الطالب مش موجود ضمن أعلى 50 في أي من القايمتين، هات درجته هو بس (قراءة واحدة رخيصة)
        const inClass = classBoard.some(s => s.studentId === currentUser.uid);
        const inSchool = schoolBoard.some(s => s.studentId === currentUser.uid);
        if (!inClass || !inSchool) {
            const mySnap = await getDoc(doc(db, 'studentStats', currentUser.uid));
            if (mySnap.exists()) {
                const mine = { id: mySnap.id, ...mySnap.data() };
                if (!inClass) classBoard = [...classBoard, mine];
                if (!inSchool) schoolBoard = [...schoolBoard, mine];
            }
        }
    } catch (error) { console.error('Error loading leaderboard:', error); }
}

function renderClassLeaderboard() {
    const el=document.getElementById('classLeaderboard');
    if(!el) return;
    document.getElementById('classNameDashboard').textContent=studentClass() ? `الفصل ${studentClass()}` : 'فصلك';
    if(!allLeaderboard.length){el.innerHTML='<div class="loading-item">لا توجد نتائج كافية بعد</div>';return;}
    el.innerHTML=allLeaderboard.slice(0,10).map((s,i)=>`<div class="mini-rank-row ${s.studentId===currentUser.uid?'is-me':''}"><span class="mini-rank">${i+1}</span><div><strong>${escStudent(s.studentName||'طالب')}${s.studentId===currentUser.uid?' (أنت)':''}</strong><small>${s.completedQuizzes||0} كويز • متوسط ${Math.round(s.avgScore||0)}%</small></div><b>${s.totalXP||0} XP</b></div>`).join('');
}
async function renderSchoolStats(){
    const el=document.getElementById('schoolStatsDashboard'); if(!el)return;
    // بنستخدم count aggregation query هنا (تكلفتها قراءة واحدة بس مهما كان عدد الطلاب)
    // بدل ما نسحب كل مستندات studentStats عشان نعدّهم
    try {
        const [totalSnap, classSnap] = await Promise.all([
            getCountFromServer(collection(db, 'studentStats')),
            getCountFromServer(query(collection(db, 'studentStats'), where('class', '==', studentClass())))
        ]);
        const totalStudents = totalSnap.data().count;
        const classCount = classSnap.data().count;
        const avg = schoolBoard.length ? Math.round(schoolBoard.reduce((t, x) => t + (x.avgScore || 0), 0) / schoolBoard.length) : 0;
        el.innerHTML=`<div class="school-stat"><span>الطلاب</span><b>${totalStudents}</b></div><div class="school-stat"><span>الفصول</span><b>10</b></div><div class="school-stat"><span>متوسط المدرسة</span><b>${avg}%</b></div><div class="school-stat"><span>طلاب فصلك</span><b>${classCount}</b></div>`;
    } catch (e) { console.error(e); }
}
function escStudent(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

// =========================================
// 9.7 Profile Modal (بيانات + تغيير الباسورد + إحصائيات)
// =========================================
function bestSubjectByXP() {
    const bySubject = {};
    allSubmissions.forEach(sub => {
        const subject = sub.subject || (allQuizzes.find(q => q.id === sub.quizId)?.subject) || '';
        if (!subject) return;
        bySubject[subject] = (bySubject[subject] || 0) + (sub.xpEarned || 0);
    });
    let best = null, bestXp = -1;
    Object.entries(bySubject).forEach(([subj, xp]) => { if (xp > bestXp) { bestXp = xp; best = subj; } });
    return best ? { subject: best, xp: bestXp } : null;
}

function openProfileModal() {
    document.getElementById('profileNameField').textContent = currentUserData.name || '-';
    document.getElementById('profileEmailField').textContent = currentUserData.email || currentUser.email || '-';
    document.getElementById('profileClassField').textContent = studentClass() || '-';

    const totalXP = allSubmissions.reduce((sum, sub) => sum + (sub.xpEarned || 0), 0);
    const completed = allSubmissions.length;
    const avg = completed ? Math.round(allSubmissions.reduce((s, x) => s + (x.percentage || 0), 0) / completed) : 0;
    const best = bestSubjectByXP();

    document.getElementById('profileTotalXP').textContent = totalXP;
    document.getElementById('profileCompleted').textContent = completed;
    document.getElementById('profileAvg').textContent = avg + '%';
    document.getElementById('profileBestSubject').textContent = best ? `${best.subject} (${best.xp} XP)` : 'لا توجد بيانات كفاية بعد';

    document.getElementById('passwordForm').reset();
    setPasswordMsg('', '');
    document.getElementById('profileModal').classList.remove('hidden');
}
function closeProfileModal() { document.getElementById('profileModal').classList.add('hidden'); }

function setPasswordMsg(text, type) {
    const msg = document.getElementById('passwordMsg');
    msg.textContent = text;
    msg.className = 'form-msg' + (type ? ' ' + type : '');
}

async function changePassword(e) {
    e.preventDefault();
    const current = document.getElementById('currentPassword').value;
    const next = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;

    if (next.length < 6) { setPasswordMsg('كلمة السر الجديدة لازم تكون 6 حروف على الأقل', 'error'); return; }
    if (next !== confirmPass) { setPasswordMsg('تأكيد كلمة السر مش مطابق', 'error'); return; }

    const btn = document.getElementById('changePasswordBtn');
    btn.disabled = true;
    try {
        const cred = EmailAuthProvider.credential(currentUser.email, current);
        await reauthenticateWithCredential(currentUser, cred);
        await updatePassword(currentUser, next);
        setPasswordMsg('تم تغيير كلمة السر بنجاح ✅', 'success');
        document.getElementById('passwordForm').reset();
    } catch (err) {
        console.error(err);
        const map = { 'auth/wrong-password': 'كلمة السر الحالية غلط', 'auth/too-many-requests': 'محاولات كتير، حاول تاني بعد شوية', 'auth/weak-password': 'كلمة السر ضعيفة، اختار كلمة أقوى' };
        setPasswordMsg(map[err.code] || 'حدث خطأ: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// =========================================
// 9.6 Render Leaderboard Modal (فصل / مدرسة)
// =========================================
function renderLeaderboardModal() {
    const container = document.getElementById('leaderboardContainer');
    if (!container) return;

    const board = leaderboardScope === 'school' ? schoolBoard : classBoard;
    document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.toggle('active', t.dataset.scope === leaderboardScope));

    if (board.length === 0) {
        container.innerHTML = '<div class="loading-item">لا يوجد طلاب في الترتيب بعد</div>';
        return;
    }

    const rankClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const rankIcon = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);

    container.innerHTML = board.map((s, i) => {
        const isMe = s.studentId === currentUser.uid;
        return `
            <div class="leaderboard-row ${isMe ? 'me' : ''}">
                <div class="leaderboard-rank ${rankClass(i)}">${rankIcon(i)}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${escStudent(s.studentName)}${isMe ? ' (أنت)' : ''}</div>
                    <div class="leaderboard-meta">${s.completedQuizzes||0} كويز محلول - متوسط ${Math.round(s.avgScore||0)}%${leaderboardScope==='school' ? ` - فصل ${escStudent(s.class||'-')}` : ''}</div>
                </div>
                <div class="leaderboard-xp">${s.totalXP||0} XP</div>
            </div>
        `;
    }).join('');
}

function openLeaderboardModal() {
    document.getElementById('leaderboardModal').classList.remove('hidden');
    renderLeaderboardModal();
}
function closeLeaderboardModal() {
    document.getElementById('leaderboardModal').classList.add('hidden');
}

// =========================================
// 7. Load Quizzes
// =========================================
async function loadQuizzes() {
    try {
        const snap = await getDocs(query(collection(db, 'quizzes'), where('targetClasses', 'array-contains', studentClass())));
        allQuizzes = [];
        snap.forEach(docSnap => {
            const d = { id: docSnap.id, ...docSnap.data() };
            if (targetsMe(d)) allQuizzes.push(d);
        });
        console.log('Loaded quizzes:', allQuizzes.length);
    } catch (error) { console.error('Error loading quizzes:', error); }
}

// =========================================
// 8. Load Submissions
// =========================================
async function loadSubmissions() {
    try {
        const submissionsSnapshot = await getDocs(
            query(
                collection(db, 'submissions'),
                where('studentId', '==', currentUser.uid)
            )
        );
        
        allSubmissions = [];
        submissionsSnapshot.forEach(docSnap => {
            allSubmissions.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        console.log('Loaded submissions:', allSubmissions.length);
    } catch (error) {
        console.error('Error loading submissions:', error);
    }
}

// =========================================
// 9. Load Materials
// =========================================
async function loadMaterials() {
    try {
        const snap = await getDocs(query(collection(db, 'materials'), where('targetClasses', 'array-contains', studentClass())));
        allMaterials = [];
        snap.forEach(docSnap => {
            const d = { id: docSnap.id, ...docSnap.data() };
            if (targetsMe(d)) allMaterials.push(d);
        });
        console.log('Loaded materials:', allMaterials.length);
    } catch (error) { console.error('Error loading materials:', error); }
}

// =========================================
// 10. Load Announcements
// =========================================
async function loadAnnouncements() {
    try {
        const snap = await getDocs(query(collection(db, 'announcements'), where('targetClasses', 'array-contains', studentClass())));
        allAnnouncements = [];
        snap.forEach(docSnap => {
            const d = { id: docSnap.id, ...docSnap.data() };
            if (targetsMe(d)) allAnnouncements.push(d);
        });
        console.log('Loaded announcements:', allAnnouncements.length);
    } catch (error) { console.error('Error loading announcements:', error); }
}

// =========================================
// 11. Update Dashboard
// =========================================
function updateDashboard() {
    // حساب الإحصائيات
    const completedQuizzes = allSubmissions.length;
    const totalXP = allSubmissions.reduce((sum, sub) => sum + (sub.xpEarned || 0), 0);
    
    let avgScore = 0;
    if (completedQuizzes > 0) {
        const totalPercentage = allSubmissions.reduce((sum, sub) => {
            const percentage = sub.totalQuestions > 0 ? (sub.score / sub.totalQuestions) * 100 : 0;
            return sum + percentage;
        }, 0);
        avgScore = Math.round(totalPercentage / completedQuizzes);
    }

    const pendingQuizzes = allQuizzes.filter(quiz => {
        const submitted = allSubmissions.some(sub => sub.quizId === quiz.id);
        const deadline = quiz.deadline ? new Date(quiz.deadline) : null;
        const isExpired = deadline && deadline < new Date();
        return !submitted && !isExpired;
    }).length;

    // تحديث الواجهة
    document.getElementById('totalXP').textContent = totalXP;
    document.getElementById('totalXPStats').textContent = totalXP;
    document.getElementById('completedQuizzes').textContent = completedQuizzes;
    document.getElementById('avgScore').textContent = avgScore + '%';
    document.getElementById('pendingQuizzes').textContent = pendingQuizzes;
    document.getElementById('quizCount').textContent = pendingQuizzes;

    // الكويزات القادمة
    const upcomingQuizzes = allQuizzes
        .filter(quiz => {
            const submitted = allSubmissions.some(sub => sub.quizId === quiz.id);
            const deadline = quiz.deadline ? new Date(quiz.deadline) : null;
            const isExpired = deadline && deadline < new Date();
            return !submitted && !isExpired;
        })
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        .slice(0, 5);

    const upcomingList = document.getElementById('upcomingQuizzes');
    upcomingList.innerHTML = upcomingQuizzes.length > 0
        ? upcomingQuizzes.map(quiz => {
            const deadline = new Date(quiz.deadline);
            const now = new Date();
            const diffMs = deadline - now;
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const hoursLeft = Math.ceil(diffMs / (1000 * 60 * 60));
            
            let timeText = '';
            if (daysLeft > 0) {
                timeText = `${daysLeft} يوم متبقي`;
            } else if (hoursLeft > 0) {
                timeText = `${hoursLeft} ساعة متبقية`;
            } else {
                timeText = 'ينتهي قريباً';
            }
            
            return `
                <div class="recent-item">
                    <div class="recent-icon">📝</div>
                    <div class="recent-info">
                        <div class="recent-title">${quiz.title || 'بدون عنوان'}</div>
                        <div class="recent-subtitle">${quiz.subject || 'غير محدد'} - ${timeText}</div>
                    </div>
                </div>
            `;
        }).join('')
        : '<div class="loading-item">لا توجد كويزات قادمة 🎉</div>';

    // آخر الإنجازات
    const recentAchievements = [...allSubmissions]
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .slice(0, 5);
        
    const achievementsList = document.getElementById('recentAchievements');
    achievementsList.innerHTML = recentAchievements.length > 0
        ? recentAchievements.map(sub => {
            const quiz = allQuizzes.find(q => q.id === sub.quizId);
            const percentage = sub.totalQuestions > 0 ? Math.round((sub.score / sub.totalQuestions) * 100) : 0;
            
            return `
                <div class="recent-item">
                    <div class="recent-icon" style="background: linear-gradient(135deg, var(--success-color), #15803d);">✅</div>
                    <div class="recent-info">
                        <div class="recent-title">${quiz?.title || 'كويز'}</div>
                        <div class="recent-subtitle">حصلت على ${sub.xpEarned || 0} XP - درجة ${percentage}%</div>
                    </div>
                </div>
            `;
        }).join('')
        : '<div class="loading-item">لم تكمل أي كويزات بعد. ابدأ الآن! 🚀</div>';
}

// =========================================
// 12. Render Quizzes
// =========================================
function renderQuizzes() {
    const quizzesGrid = document.getElementById('quizzesGrid');
    
    if (allQuizzes.length === 0) {
        quizzesGrid.innerHTML = '<div class="loading-card">لا توجد كويزات حالياً</div>';
        return;
    }

    quizzesGrid.innerHTML = allQuizzes.map(quiz => {
        const submission = allSubmissions.find(sub => sub.quizId === quiz.id);
        const isCompleted = !!submission;
        const isOptional = quiz.isOptional || false;
        const deadline = quiz.deadline ? new Date(quiz.deadline) : null;
        const now = new Date();
        const isExpired = deadline && deadline < now;
        
        let daysLeft = 0;
        let hoursLeft = 0;
        if (deadline) {
            const diffMs = deadline - now;
            daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            hoursLeft = Math.ceil(diffMs / (1000 * 60 * 60));
        }
        
        const isUrgent = daysLeft <= 2 && daysLeft > 0;

        let cardClass = '';
        if (isCompleted) cardClass = 'completed';
        else if (isOptional) cardClass = 'optional';

        const deadlineText = deadline ? deadline.toLocaleString('ar-EG', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }) : 'غير محدد';

        return `
            <div class="quiz-card ${cardClass}">
                <div class="quiz-header">
                    <div>
                        <h3 class="quiz-title">${quiz.title || 'بدون عنوان'}</h3>
                        <span class="quiz-subject">${quiz.subject || 'غير محدد'}</span>
                    </div>
                    <div class="quiz-xp">+${quiz.xpReward || 0} XP</div>
                </div>
                <div class="quiz-details">
                    <div class="quiz-detail">
                        <span class="quiz-detail-icon">👨‍🏫</span>
                        <span>${quiz.teacherName || 'غير محدد'}</span>
                    </div>
                    <div class="quiz-detail">
                        <span class="quiz-detail-icon">❓</span>
                        <span>${quiz.questions?.length || quiz.questionsCount || 0} أسئلة</span>
                    </div>
                    ${isCompleted ? `
                        <div class="quiz-detail completed">
                            <span class="quiz-detail-icon">✅</span>
                            <span>مكتمل - درجة ${submission.score || 0}/${submission.totalQuestions || 0} (${Math.round((submission.score / submission.totalQuestions) * 100)}%)</span>
                        </div>
                    ` : isExpired ? `
                        <div class="quiz-detail urgent">
                            <span class="quiz-detail-icon">⏰</span>
                            <span>انتهى الوقت</span>
                        </div>
                    ` : `
                        <div class="quiz-detail ${isUrgent ? 'urgent' : ''}">
                            <span class="quiz-detail-icon">⏰</span>
                            <span>${isUrgent ? 'ينتهي خلال' : 'ينتهي في'} ${daysLeft > 0 ? daysLeft + ' يوم' : hoursLeft + ' ساعة'}</span>
                        </div>
                        <div class="quiz-detail">
                            <span class="quiz-detail-icon">📅</span>
                            <span>${deadlineText}</span>
                        </div>
                    `}
                    ${isOptional && !isCompleted ? `
                        <div class="quiz-detail" style="color: var(--warning-color);">
                            <span class="quiz-detail-icon">🚩</span>
                            <span>كويز اختياري (مطلوب منك)</span>
                        </div>
                    ` : ''}
                </div>
                ${isCompleted ? `
                    <button class="btn-start-quiz" disabled>تم الحل ✅</button>
                ` : isExpired ? `
                    <button class="btn-start-quiz" disabled>انتهى الوقت</button>
                ` : `
                    <button class="btn-start-quiz" onclick="startQuiz('${quiz.id}')">ابدأ الكويز</button>
                `}
            </div>
        `;
    }).join('');
}

// =========================================
// 13. Render Materials
// =========================================
function renderMaterials() {
    const materialsGrid = document.getElementById('materialsGrid');
    
    if (allMaterials.length === 0) {
        materialsGrid.innerHTML = '<div class="loading-card">لا توجد مواد حالياً</div>';
        return;
    }

    // ترتيب: المميز أولاً
    const sortedMaterials = [...allMaterials].sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    materialsGrid.innerHTML = sortedMaterials.map(material => {
        const typeIcon = material.type === 'video' ? '🎥' : '📝';
        
        return `
            <div class="material-card">
                <div class="material-header">
                    <div class="material-icon">${typeIcon}</div>
                    <div>
                        <h3 class="material-title">${material.title || 'بدون عنوان'}</h3>
                        <div class="material-teacher">${material.teacherName || 'غير محدد'} - ${material.subject || 'غير محدد'}</div>
                    </div>
                </div>
                <p class="material-description">${material.description || 'لا يوجد وصف'}</p>
                <a href="material.html?id=${encodeURIComponent(material.id)}" target="_blank" class="btn-view-material" style="text-decoration: none; display: block; text-align: center;">فتح الشرح</a>
            </div>
        `;
    }).join('');
}

// =========================================
// 14. Render Announcements
// =========================================
function renderAnnouncements() {
    const notificationsList = document.getElementById('notificationsList');
    
    const unreadCount = allAnnouncements.filter(n => !n.readBy?.includes(currentUser.uid)).length;
    document.getElementById('notifCount').textContent = unreadCount;
    
    if (allAnnouncements.length === 0) {
        notificationsList.innerHTML = '<div class="loading-item">لا توجد إشعارات حالياً</div>';
        return;
    }

    const sortedAnnouncements = [...allAnnouncements].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    notificationsList.innerHTML = sortedAnnouncements.map(notif => {
        const isUnread = !notif.readBy?.includes(currentUser.uid);
        const date = notif.createdAt ? new Date(notif.createdAt).toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : '';
        
        return `
            <div class="notification-card ${isUnread ? 'unread' : ''}" onclick="markAsRead('${notif.id}')">
                <div class="notification-header">
                    <div>
                        <div><h3 class="notification-title">${notif.title || 'بدون عنوان'}</h3><div class="notification-sender">${notif.teacherName ? `إشعار من المستر ${notif.teacherName}` : (notif.principalName ? `إشعار من إدارة المدرسة - ${notif.principalName}` : 'إشعار من إدارة المدرسة')} ${notif.subject ? `• ${notif.subject}` : ''}</div></div>
                        <div class="notification-time">${date}</div>
                    </div>
                    ${isUnread ? '<span class="unread-dot"></span>' : ''}
                </div>
                <p class="notification-content">${notif.content || ''}</p>
            </div>
        `;
    }).join('');
}

// =========================================
// 15. Mark Notification as Read
// =========================================
window.markAsRead = async function(announcementId) {
    try {
        const announcementRef = doc(db, 'announcements', announcementId);
        const announcement = allAnnouncements.find(a => a.id === announcementId);
        
        if (announcement && !announcement.readBy?.includes(currentUser.uid)) {
            const readBy = announcement.readBy || [];
            readBy.push(currentUser.uid);
            
            await updateDoc(announcementRef, { readBy });
            
            // تحديث الواجهة
            announcement.readBy = readBy;
            renderAnnouncements();
        }
    } catch (error) {
        console.error('Error marking as read:', error);
    }
};

// =========================================
// 16. Render Grades
// =========================================
function renderGrades() {
    const gradesContainer = document.getElementById('gradesContainer');
    
    if (allSubmissions.length === 0) {
        gradesContainer.innerHTML = '<div class="loading-item">لم تحل أي كويزات بعد</div>';
        return;
    }

    const sortedSubmissions = [...allSubmissions].sort((a, b) => 
        new Date(b.submittedAt) - new Date(a.submittedAt)
    );

    gradesContainer.innerHTML = `
        <table class="grades-table">
            <thead>
                <tr>
                    <th>الكويز</th>
                    <th>المادة</th>
                    <th>الدرجة</th>
                    <th>النسبة</th>
                    <th>XP المكتسب</th>
                    <th>التاريخ</th>
                </tr>
            </thead>
            <tbody>
                ${sortedSubmissions.map(sub => {
                    const quiz = allQuizzes.find(q => q.id === sub.quizId) || {};
                    const percentage = sub.totalQuestions > 0 ? Math.round((sub.score / sub.totalQuestions) * 100) : 0;
                    let badgeClass = 'poor';
                    if (percentage >= 90) badgeClass = 'excellent';
                    else if (percentage >= 75) badgeClass = 'good';
                    else if (percentage >= 60) badgeClass = 'average';
                    
                    const date = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }) : '-';
                    
                    return `
                        <tr>
                            <td>${quiz.title || 'كويز'}</td>
                            <td>${quiz.subject || '-'}</td>
                            <td><span class="score-badge ${badgeClass}">${sub.score || 0}/${sub.totalQuestions || 0}</span></td>
                            <td><strong>${percentage}%</strong></td>
                            <td>+${sub.xpEarned || 0} XP</td>
                            <td>${date}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// =========================================
// 17. Start Quiz
// =========================================
window.startQuiz = function(quizId) {
    const quiz = allQuizzes.find(q => q.id === quizId);
    if (!quiz) {
        alert('الكويز غير موجود');
        return;
    }

    const deadline = quiz.deadline ? new Date(quiz.deadline) : null;
    const now = new Date();
    
    if (deadline && deadline < now) {
        alert('انتهى وقت هذا الكويز');
        return;
    }

    const alreadySubmitted = allSubmissions.some(sub => sub.quizId === quizId);
    if (alreadySubmitted) {
        alert('لقد قمت بحل هذا الكويز بالفعل');
        return;
    }

    // حفظ بيانات الكويز في localStorage للانتقال لصفحة الحل (احتياطي)
    localStorage.setItem('currentQuizId', quizId);
    localStorage.setItem('currentQuizData', JSON.stringify(quiz));
    
    // الانتقال لصفحة حل الكويز مع تمرير الـ id في الرابط
    window.location.href = `take-quiz.html?id=${encodeURIComponent(quizId)}`;
};

// =========================================
// 18. View Material
// =========================================
window.viewMaterial = function(materialId) {
    const material = allMaterials.find(m => m.id === materialId);
    if (!material) return;
    
    if (material.url) {
        window.open(material.url, '_blank');
    } else {
        alert(`المادة: ${material.title}\n\n${material.description}\n\n${material.content || 'لا يوجد محتوى إضافي'}`);
    }
};

// =========================================
// 19. Setup Event Listeners
// =========================================
function setupEventListeners() {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetSection = item.dataset.section;

            if (targetSection === 'leaderboard') {
                openLeaderboardModal();
                return;
            }

            navItems.forEach(nav => nav.classList.remove('active'));
            contentSections.forEach(section => section.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(targetSection).classList.add('active');
        });
    });

    // Leaderboard Modal
    document.getElementById('closeLeaderboardModal').addEventListener('click', closeLeaderboardModal);
    document.getElementById('leaderboardModal').addEventListener('click', e => {
        if (e.target.id === 'leaderboardModal') closeLeaderboardModal();
    });
    document.querySelectorAll('.leaderboard-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            leaderboardScope = tab.dataset.scope;
            renderLeaderboardModal();
        });
    });

    // Profile Modal
    document.getElementById('profileTrigger').addEventListener('click', openProfileModal);
    document.getElementById('closeProfileModal').addEventListener('click', closeProfileModal);
    document.getElementById('profileModal').addEventListener('click', e => {
        if (e.target.id === 'profileModal') closeProfileModal();
    });
    document.getElementById('passwordForm').addEventListener('submit', changePassword);
    
    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme');
    
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    }
    
    themeToggle.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeToggle.textContent = '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.textContent = '☀️';
        }
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            await signOut(auth);
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('currentQuizId');
            localStorage.removeItem('currentQuizData');
            window.location.href = 'login.html';
        }
    });
}