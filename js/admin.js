// js/admin.js

// =========================================
// 1. Firebase Configuration & Imports
// =========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc,
    updateDoc, 
    deleteDoc,
    query,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyChYh6bHiB7dAAcDYbrHzW61gyQR0A5UuM",
    authDomain: "ninjaturtels.firebaseapp.com",
    projectId: "ninjaturtels",
    storageBucket: "ninjaturtels.firebasestorage.app",
    messagingSenderId: "1063186224531",
    appId: "1:1063186224531:web:76b1369b477808e4654466",
    measurementId: "G-HEB32CJR1N"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================================
// 2. Global Variables
// =========================================
let currentUser = null;
let currentUserData = null;
let allStudents = [];
let allTeachers = [];

// =========================================
// 3. Authentication Check (التحقق من الأدمن)
// =========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('User logged in:', user.email);

        try {
            // محاولة جلب بيانات المستخدم من Firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                // المستخدم موجود في Firestore
                currentUserData = userDoc.data();
                
                if (currentUserData.role === 'admin') {
                    // أدمن حقيقي ✅
                    document.getElementById('adminName').textContent = currentUserData.name || 'مدير النظام';
                    initializeAdmin();
                } else {
                    // مش أدمن ❌
                    alert('ليس لديك صلاحية الوصول لهذه الصفحة');
                    await signOut(auth);
                    window.location.href = '../login.html';
                }
            } else {
                // المستخدم مش موجود في Firestore
                // نتحقق من نوع الإيميل
                const email = user.email.toLowerCase();
                
                if (email.endsWith('@admin.local')) {
                    // أدمن لكن مفيش document → ننشئه تلقائيًا
                    console.log('Creating admin document in Firestore...');
                    
                    currentUserData = {
                        email: email,
                        role: 'admin',
                        name: email.split('@')[0],
                        uid: user.uid,
                        createdAt: new Date().toISOString()
                    };

                    // إنشاء document في Firestore
                    await setDoc(userDocRef, currentUserData);
                    
                    document.getElementById('adminName').textContent = currentUserData.name;
                    initializeAdmin();
                } else {
                    // مش أدمن 
                    alert('ليس لديك صلاحية الوصول لهذه الصفحة');
                    await signOut(auth);
                    window.location.href = '../login.html';
                }
            }
        } catch (error) {
            console.error('Error checking user role:', error);
            
            // Fallback: لو فيه مشكلة في Firestore، نتحقق من الإيميل بس
            const email = user.email.toLowerCase();
            if (email.endsWith('@admin.local')) {
                currentUserData = {
                    email: email,
                    role: 'admin',
                    name: email.split('@')[0]
                };
                document.getElementById('adminName').textContent = currentUserData.name;
                initializeAdmin();
            } else {
                alert('حدث خطأ في التحقق من الصلاحيات');
                await signOut(auth);
                window.location.href = '../login.html';
            }
        }
    } else {
        // مش مسجل دخول
        window.location.href = '../login.html';
    }
});

// =========================================
// 4. Initialize Admin Panel
// =========================================
function initializeAdmin() {
    loadDashboard();
    loadStudents();
    loadTeachers();
    loadQuizzes();
    loadReports();
    setupEventListeners();
    
    // إخفاء حالة التحميل
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.style.display = 'none';
    }
}

// =========================================
// 5. Load Dashboard
// =========================================
async function loadDashboard() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const students = [];
        const teachers = [];

        usersSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.role === 'student') {
                students.push({ id: docSnap.id, ...data });
            } else if (data.role === 'teacher') {
                teachers.push({ id: docSnap.id, ...data });
            }
        });

        const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));
        const quizzes = [];
        quizzesSnapshot.forEach(docSnap => {
            quizzes.push({ id: docSnap.id, ...docSnap.data() });
        });

        const totalStudents = students.length;
        const totalTeachers = teachers.length;
        const totalQuizzes = quizzes.length;
        const redFlagCount = students.filter(s => s.redFlag).length;

        document.getElementById('totalStudents').textContent = totalStudents;
        document.getElementById('totalTeachers').textContent = totalTeachers;
        document.getElementById('totalQuizzes').textContent = totalQuizzes;
        document.getElementById('redFlagCount').textContent = redFlagCount;
        document.getElementById('studentsCount').textContent = totalStudents;
        document.getElementById('teachersCount').textContent = totalTeachers;

        // آخر الطلاب
        const recentStudents = students.slice(-5).reverse();
        const recentStudentsList = document.getElementById('recentStudents');
        recentStudentsList.innerHTML = recentStudents.length > 0
            ? recentStudents.map(student => `
                <div class="recent-item">
                    <div class="recent-icon">🎓</div>
                    <div class="recent-info">
                        <div class="recent-title">${student.name || 'بدون اسم'}</div>
                        <div class="recent-subtitle">${student.class || 'غير محدد'} - ${student.email}</div>
                    </div>
                </div>
            `).join('')
            : '<div class="loading-item">لا يوجد طلاب بعد</div>';

        // الطلاب المحتاجين متابعة
        const redFlagStudents = students.filter(s => s.redFlag);
        const redFlagList = document.getElementById('redFlagStudents');
        redFlagList.innerHTML = redFlagStudents.length > 0
            ? redFlagStudents.map(student => `
                <div class="recent-item">
                    <div class="recent-icon" style="background: linear-gradient(135deg, var(--error-color), #b91c1c);">🚩</div>
                    <div class="recent-info">
                        <div class="recent-title">${student.name || 'بدون اسم'}</div>
                        <div class="recent-subtitle">${student.email}</div>
                    </div>
                </div>
            `).join('')
            : '<div class="loading-item">لا يوجد طلاب يحتاجون متابعة ✅</div>';

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// =========================================
// 6. Load Students
// =========================================
async function loadStudents() {
    try {
        const studentsSnapshot = await getDocs(
            query(collection(db, 'users'), where('role', '==', 'student'))
        );
        
        allStudents = [];
        studentsSnapshot.forEach(docSnap => {
            allStudents.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderStudentsTable(allStudents);
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentsTableBody').innerHTML = 
            '<tr><td colspan="5" class="loading-cell">حدث خطأ في تحميل البيانات</td></tr>';
    }
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">لا يوجد طلاب</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => `
        <tr>
            <td>${student.name || 'بدون اسم'}</td>
            <td>${student.email || '-'}</td>
            <td>${student.class || 'غير محدد'}</td>
            <td>
                <span class="red-flag-badge ${student.redFlag ? 'active' : 'inactive'}">
                    ${student.redFlag ? '🚩 نعم' : 'لا'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editStudent('${student.id}')">تعديل</button>
                    <button class="btn-toggle-flag" onclick="toggleRedFlag('${student.id}')">
                        ${student.redFlag ? 'إزالة Red Flag' : 'إضافة Red Flag'}
                    </button>
                    <button class="btn-delete" onclick="deleteStudent('${student.id}')">حذف</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// =========================================
// 7. Load Teachers
// =========================================
async function loadTeachers() {
    try {
        const teachersSnapshot = await getDocs(
            query(collection(db, 'users'), where('role', '==', 'teacher'))
        );
        
        allTeachers = [];
        teachersSnapshot.forEach(docSnap => {
            allTeachers.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderTeachersTable(allTeachers);
    } catch (error) {
        console.error('Error loading teachers:', error);
        document.getElementById('teachersTableBody').innerHTML = 
            '<tr><td colspan="4" class="loading-cell">حدث خطأ في تحميل البيانات</td></tr>';
    }
}

function renderTeachersTable(teachers) {
    const tbody = document.getElementById('teachersTableBody');
    
    if (teachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">لا يوجد مدرسين</td></tr>';
        return;
    }

    tbody.innerHTML = teachers.map(teacher => `
        <tr>
            <td>${teacher.name || 'بدون اسم'}</td>
            <td>${teacher.email || '-'}</td>
            <td>${teacher.subject || 'غير محدد'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editTeacher('${teacher.id}')">تعديل</button>
                    <button class="btn-delete" onclick="deleteTeacher('${teacher.id}')">حذف</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// =========================================
// 8. Load Quizzes
// =========================================
async function loadQuizzes() {
    try {
        const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));
        const quizzes = [];
        
        quizzesSnapshot.forEach(docSnap => {
            quizzes.push({ id: docSnap.id, ...docSnap.data() });
        });

        const quizzesGrid = document.getElementById('adminQuizzesGrid');
        
        if (quizzes.length === 0) {
            quizzesGrid.innerHTML = '<div class="loading-card">لا توجد كويزات حالياً</div>';
            return;
        }

        quizzesGrid.innerHTML = quizzes.map(quiz => `
            <div class="quiz-card">
                <div class="quiz-header">
                    <h3 class="quiz-title">${quiz.title || 'بدون عنوان'}</h3>
                    <span class="quiz-subject">${quiz.subject || 'غير محدد'}</span>
                </div>
                <div style="margin-top: 12px; color: var(--text-secondary); font-size: 0.9rem;">
                    👨‍🏫 ${quiz.teacherName || 'غير محدد'}
                </div>
                <div class="quiz-stats">
                    <div class="quiz-stat">
                        <span class="quiz-stat-value">${quiz.questionsCount || 0}</span>
                        <span class="quiz-stat-label">أسئلة</span>
                    </div>
                    <div class="quiz-stat">
                        <span class="quiz-stat-value">${quiz.xpReward || 0}</span>
                        <span class="quiz-stat-label">XP</span>
                    </div>
                    <div class="quiz-stat">
                        <span class="quiz-stat-value">${quiz.isOptional ? 'اختياري' : 'إلزامي'}</span>
                        <span class="quiz-stat-label">النوع</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading quizzes:', error);
        document.getElementById('adminQuizzesGrid').innerHTML = 
            '<div class="loading-card">حدث خطأ في تحميل الكويزات</div>';
    }
}

// =========================================
// 8.5 Remove All Quizzes
// =========================================
document.getElementById('deleteAllQuizzesBtn').addEventListener('click', async () => {
    try {
        const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));

        if (quizzesSnapshot.empty) {
            alert('لا توجد كويزات لحذفها');
            return;
        }

        const confirmFirst = confirm(
            `هل أنت متأكد من إزالة كل الكويزات؟ (العدد الحالي: ${quizzesSnapshot.size})\nهذا الإجراء لا يمكن التراجع عنه`
        );
        if (!confirmFirst) return;

        const confirmSecond = confirm('تأكيد نهائي: سيتم حذف كل الكويزات نهائيًا. متابعة؟');
        if (!confirmSecond) return;

        // Firestore بتسمح بـ 500 عملية كحد أقصى في الـ batch الواحدة
        const docs = quizzesSnapshot.docs;
        const chunkSize = 450;
        for (let i = 0; i < docs.length; i += chunkSize) {
            const batch = writeBatch(db);
            docs.slice(i, i + chunkSize).forEach(docSnap => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();
        }

        alert('تم إزالة كل الكويزات بنجاح ✅');
        await loadDashboard();
        await loadQuizzes();
        await loadReports();

    } catch (error) {
        console.error('Error deleting all quizzes:', error);
        alert('حدث خطأ أثناء حذف الكويزات: ' + error.message);
    }
});

// =========================================
// 8.6 Load Reports (لوحة الصدارة + إحصائيات الكويزات)
// =========================================
async function loadReports() {
    try {
        const [quizzesSnapshot, submissionsSnapshot] = await Promise.all([
            getDocs(collection(db, 'quizzes')),
            getDocs(collection(db, 'submissions'))
        ]);

        const quizzes = [];
        quizzesSnapshot.forEach(docSnap => quizzes.push({ id: docSnap.id, ...docSnap.data() }));

        const submissions = [];
        submissionsSnapshot.forEach(docSnap => submissions.push(docSnap.data()));

        // ----- لوحة الصدارة -----
        const byStudent = {};
        submissions.forEach(sub => {
            const id = sub.studentId;
            if (!id) return;
            if (!byStudent[id]) {
                byStudent[id] = { studentName: sub.studentName || 'طالب', totalXP: 0, completedQuizzes: 0 };
            }
            byStudent[id].totalXP += sub.xpEarned || 0;
            byStudent[id].completedQuizzes += 1;
        });

        const leaderboard = Object.values(byStudent)
            .sort((a, b) => b.totalXP - a.totalXP)
            .slice(0, 10);

        const topStudentsEl = document.getElementById('topStudents');
        const rankClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const rankIcon = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);

        topStudentsEl.innerHTML = leaderboard.length > 0
            ? leaderboard.map((s, i) => `
                <div class="leaderboard-row">
                    <div class="leaderboard-rank ${rankClass(i)}">${rankIcon(i)}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${s.studentName}</div>
                        <div class="leaderboard-meta">${s.completedQuizzes} كويز محلول</div>
                    </div>
                    <div class="leaderboard-xp">${s.totalXP} XP</div>
                </div>
            `).join('')
            : '<div class="loading-item">لا توجد بيانات بعد</div>';

        // ----- إحصائيات الكويزات -----
        const quizStatsEl = document.getElementById('quizStats');
        const statsRows = quizzes.map(quiz => {
            const quizSubs = submissions.filter(s => s.quizId === quiz.id);
            const avgPct = quizSubs.length > 0
                ? Math.round(quizSubs.reduce((sum, s) => sum + (s.percentage || 0), 0) / quizSubs.length)
                : 0;
            return `
                <div class="recent-item">
                    <div class="recent-icon">📝</div>
                    <div class="recent-info">
                        <div class="recent-title">${quiz.title || 'بدون عنوان'}</div>
                        <div class="recent-subtitle">${quizSubs.length} تسليم - متوسط ${avgPct}%</div>
                    </div>
                </div>
            `;
        });

        quizStatsEl.innerHTML = statsRows.length > 0
            ? statsRows.join('')
            : '<div class="loading-item">لا توجد كويزات بعد</div>';

    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

// =========================================
// 9. Modal & Form Handling
// =========================================
const studentModal = document.getElementById('studentModal');
const teacherModal = document.getElementById('teacherModal');
const addStudentBtn = document.getElementById('addStudentBtn');
const addTeacherBtn = document.getElementById('addTeacherBtn');
const closeStudentModal = document.getElementById('closeStudentModal');
const closeTeacherModal = document.getElementById('closeTeacherModal');
const studentForm = document.getElementById('studentForm');
const teacherForm = document.getElementById('teacherForm');

addStudentBtn.addEventListener('click', () => {
    document.getElementById('studentModalTitle').textContent = 'إضافة طالب جديد';
    studentForm.reset();
    studentForm.dataset.mode = 'add';
    delete studentForm.dataset.id;
    document.getElementById('studentPassword').required = true;
    studentModal.classList.remove('hidden');
});

addTeacherBtn.addEventListener('click', () => {
    document.getElementById('teacherModalTitle').textContent = 'إضافة مدرس جديد';
    teacherForm.reset();
    teacherForm.dataset.mode = 'add';
    delete teacherForm.dataset.id;
    document.getElementById('teacherPassword').required = true;
    teacherModal.classList.remove('hidden');
});

closeStudentModal.addEventListener('click', () => {
    studentModal.classList.add('hidden');
});

closeTeacherModal.addEventListener('click', () => {
    teacherModal.classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === studentModal) studentModal.classList.add('hidden');
    if (e.target === teacherModal) teacherModal.classList.add('hidden');
});

// =========================================
// 10. Add/Edit Student (مع الحيلة السحرية)
// =========================================
studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const mode = studentForm.dataset.mode || 'add';
    const studentId = studentForm.dataset.id;
    
    const name = document.getElementById('studentName').value.trim();
    const email = document.getElementById('studentEmail').value.trim();
    const password = document.getElementById('studentPassword').value;
    const studentClass = document.getElementById('studentClass').value;
    const redFlag = document.getElementById('studentRedFlag').checked;

    if (!name || !email) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
    }

    try {
        if (mode === 'add') {
            if (!password || password.length < 6) {
                alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                return;
            }

            // 🌟 الحيلة السحرية: إنشاء تطبيق فايربيس ثانوي
            const secondaryApp = initializeApp(firebaseConfig, 'SecondaryAppStudent');
            const secondaryAuth = getAuth(secondaryApp);
            
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const uid = userCredential.user.uid;

            // حفظ البيانات في قاعدة البيانات الرئيسية
            await setDoc(doc(db, 'users', uid), {
                name,
                email,
                class: studentClass,
                redFlag,
                role: 'student',
                uid,
                createdAt: new Date().toISOString()
            });

            alert('تم إضافة الطالب بنجاح! ✅');
        } else {
            // وضع التعديل
            const studentRef = doc(db, 'users', studentId);
            await updateDoc(studentRef, {
                name,
                class: studentClass,
                redFlag,
                updatedAt: new Date().toISOString()
            });
            alert('تم تحديث بيانات الطالب بنجاح! ✅');
        }

        studentModal.classList.add('hidden');
        await loadDashboard();
        await loadStudents();

    } catch (error) {
        console.error('Error saving student:', error);
        if (error.code === 'auth/email-already-in-use') {
            alert('البريد الإلكتروني مستخدم بالفعل');
        } else if (error.code === 'auth/weak-password') {
            alert('كلمة المرور ضعيفة جداً');
        } else if (error.code === 'auth/invalid-email') {
            alert('صيغة البريد الإلكتروني غير صحيحة');
        } else {
            alert('حدث خطأ: ' + error.message);
        }
    }
});

// =========================================
// 11. Add/Edit Teacher (مع الحيلة السحرية)
// =========================================
teacherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const mode = teacherForm.dataset.mode || 'add';
    const teacherId = teacherForm.dataset.id;
    
    const name = document.getElementById('teacherName').value.trim();
    const email = document.getElementById('teacherEmail').value.trim();
    const password = document.getElementById('teacherPassword').value;
    const subject = document.getElementById('teacherSubject').value;

    if (!name || !email || !subject) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
    }

    try {
        if (mode === 'add') {
            if (!password || password.length < 6) {
                alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                return;
            }

            // 🌟 نفس الحيلة السحرية للمدرسين
            const secondaryApp = initializeApp(firebaseConfig, 'SecondaryAppTeacher');
            const secondaryAuth = getAuth(secondaryApp);
            
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const uid = userCredential.user.uid;

            await setDoc(doc(db, 'users', uid), {
                name,
                email,
                subject,
                role: 'teacher',
                uid,
                createdAt: new Date().toISOString()
            });

            alert('تم إضافة المدرس بنجاح! ✅');
        } else {
            // وضع التعديل
            const teacherRef = doc(db, 'users', teacherId);
            await updateDoc(teacherRef, {
                name,
                subject,
                updatedAt: new Date().toISOString()
            });
            alert('تم تحديث بيانات المدرس بنجاح! ✅');
        }

        teacherModal.classList.add('hidden');
        await loadDashboard();
        await loadTeachers();

    } catch (error) {
        console.error('Error saving teacher:', error);
        if (error.code === 'auth/email-already-in-use') {
            alert('البريد الإلكتروني مستخدم بالفعل');
        } else if (error.code === 'auth/weak-password') {
            alert('كلمة المرور ضعيفة جداً');
        } else if (error.code === 'auth/invalid-email') {
            alert('صيغة البريد الإلكتروني غير صحيحة');
        } else {
            alert('حدث خطأ: ' + error.message);
        }
    }
});

// =========================================
// 12. Edit Functions
// =========================================
window.editStudent = function(id) {
    const student = allStudents.find(s => s.id === id);
    if (!student) return;
    
    document.getElementById('studentModalTitle').textContent = 'تعديل بيانات الطالب';
    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentEmail').value = student.email || '';
    document.getElementById('studentClass').value = student.class || '';
    document.getElementById('studentRedFlag').checked = student.redFlag || false;
    document.getElementById('studentPassword').value = '';
    document.getElementById('studentPassword').required = false;
    
    studentForm.dataset.mode = 'edit';
    studentForm.dataset.id = id;
    studentModal.classList.remove('hidden');
};

window.editTeacher = function(id) {
    const teacher = allTeachers.find(t => t.id === id);
    if (!teacher) return;
    
    document.getElementById('teacherModalTitle').textContent = 'تعديل بيانات المدرس';
    document.getElementById('teacherName').value = teacher.name || '';
    document.getElementById('teacherEmail').value = teacher.email || '';
    document.getElementById('teacherSubject').value = teacher.subject || '';
    document.getElementById('teacherPassword').value = '';
    document.getElementById('teacherPassword').required = false;
    
    teacherForm.dataset.mode = 'edit';
    teacherForm.dataset.id = id;
    teacherModal.classList.remove('hidden');
};

// =========================================
// 13. Delete Functions
// =========================================
window.deleteStudent = async function(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الطالب؟\nسيتم حذف الحساب نهائيًا')) return;
    
    try {
        await deleteDoc(doc(db, 'users', id));
        alert('تم حذف الطالب بنجاح ✅');
        await loadDashboard();
        await loadStudents();
        
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('حدث خطأ في الحذف: ' + error.message);
    }
};

window.deleteTeacher = async function(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المدرس؟\nسيتم حذف الحساب نهائيًا')) return;
    
    try {
        await deleteDoc(doc(db, 'users', id));
        alert('تم حذف المدرس بنجاح ✅');
        await loadDashboard();
        await loadTeachers();
        
    } catch (error) {
        console.error('Error deleting teacher:', error);
        alert('حدث خطأ في الحذف: ' + error.message);
    }
};

// =========================================
// 14. Toggle Red Flag
// =========================================
window.toggleRedFlag = async function(id) {
    const student = allStudents.find(s => s.id === id);
    if (!student) return;
    
    try {
        const studentRef = doc(db, 'users', id);
        const newRedFlagValue = !student.redFlag;
        
        await updateDoc(studentRef, {
            redFlag: newRedFlagValue,
            updatedAt: new Date().toISOString()
        });
        
        alert(`تم ${newRedFlagValue ? 'إضافة' : 'إزالة'} Red Flag بنجاح ✅`);
        await loadDashboard();
        await loadStudents();
        
    } catch (error) {
        console.error('Error toggling red flag:', error);
        alert('حدث خطأ: ' + error.message);
    }
};

// =========================================
// 15. Search
// =========================================
document.getElementById('searchStudents').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allStudents.filter(s => 
        (s.name && s.name.toLowerCase().includes(searchTerm)) || 
        (s.email && s.email.toLowerCase().includes(searchTerm))
    );
    renderStudentsTable(filtered);
});

document.getElementById('searchTeachers').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allTeachers.filter(t => 
        (t.name && t.name.toLowerCase().includes(searchTerm)) || 
        (t.email && t.email.toLowerCase().includes(searchTerm)) ||
        (t.subject && t.subject.toLowerCase().includes(searchTerm))
    );
    renderTeachersTable(filtered);
});

// =========================================
// 16. Setup Event Listeners
// =========================================
function setupEventListeners() {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetSection = item.dataset.section;
            
            navItems.forEach(nav => nav.classList.remove('active'));
            contentSections.forEach(section => section.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(targetSection).classList.add('active');
        });
    });
    
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
            window.location.href = '../login.html';
        }
    });
    
    // Cancel buttons
    document.getElementById('cancelStudent').addEventListener('click', () => {
        studentModal.classList.add('hidden');
    });
    
    document.getElementById('cancelTeacher').addEventListener('click', () => {
        teacherModal.classList.add('hidden');
    });
}