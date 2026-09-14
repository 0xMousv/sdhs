// js/teacher.js

// =========================================
// 1. Firebase Configuration & Imports
// =========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc,
    query,
    where
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
let allMaterials = [];
let allQuizzes = [];
let allStudents = [];
let questionCounter = 0;

// =========================================
// 3. Authentication Check
// =========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('Teacher logged in:', user.email);

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                
                if (currentUserData.role === 'teacher') {
                    document.getElementById('teacherName').textContent = currentUserData.name || 'أستاذ';
                    document.getElementById('teacherSubject').textContent = currentUserData.subject || '-';
                    document.getElementById('welcomeName').textContent = currentUserData.name || 'أستاذ';
                    
                    document.getElementById('materialSubject').value = currentUserData.subject || '';
                    document.getElementById('quizSubject').value = currentUserData.subject || '';
                    
                    initializeTeacher();
                } else {
                    alert('ليس لديك صلاحية الوصول لهذه الصفحة');
                    await signOut(auth);
                    window.location.href = '../login.html';
                }
            } else {
                alert('الحساب غير مسجل كمدرس على المنصة');
                await signOut(auth);
                window.location.href = '../login.html';
            }
        } catch (error) {
            console.error('Error checking user role:', error);
            alert('تعذر التحقق من صلاحيات الحساب');
            await signOut(auth);
            window.location.href = '../login.html';
        }
    } else {
        window.location.href = '../login.html';
    }
});

// =========================================
// 4. Initialize Teacher Panel
// =========================================
function initializeTeacher() {
    loadDashboard();
    loadMaterials();
    loadQuizzes();
    loadStudents();
    loadAnnouncements();
    setupEventListeners();
    setupDeadlinePreview();
    setupQuestionsSystem();
    
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
        const materialsSnapshot = await getDocs(
            query(collection(db, 'materials'), where('teacherId', '==', currentUser.uid))
        );
        allMaterials = [];
        materialsSnapshot.forEach(docSnap => {
            allMaterials.push({ id: docSnap.id, ...docSnap.data() });
        });

        const quizzesSnapshot = await getDocs(
            query(collection(db, 'quizzes'), where('teacherId', '==', currentUser.uid))
        );
        allQuizzes = [];
        quizzesSnapshot.forEach(docSnap => {
            allQuizzes.push({ id: docSnap.id, ...docSnap.data() });
        });

        const studentsSnapshot = await getDocs(
            query(collection(db, 'users'), where('role', '==', 'student'))
        );
        const teacherClass = currentUserData.class || currentUserData.targetClass || '1st Secondary';
        allStudents = [];
        studentsSnapshot.forEach(docSnap => {
            const student = { id: docSnap.id, ...docSnap.data() };
            if (!currentUserData.class && !currentUserData.targetClass || student.class === teacherClass) {
                allStudents.push(student);
            }
        });

        document.getElementById('totalMaterials').textContent = allMaterials.length;
        document.getElementById('totalQuizzes').textContent = allQuizzes.length;
        document.getElementById('totalStudents').textContent = allStudents.length;
        document.getElementById('materialsCount').textContent = allMaterials.length;
        document.getElementById('quizzesCount').textContent = allQuizzes.length;

        let avgScore = 0;
        if (allQuizzes.length > 0) {
            const totalAvg = allQuizzes.reduce((sum, q) => sum + (q.avgScore || 0), 0);
            avgScore = Math.round(totalAvg / allQuizzes.length);
        }
        document.getElementById('avgScore').textContent = avgScore + '%';

        const recentMaterials = allMaterials.slice(-5).reverse();
        const recentMaterialsList = document.getElementById('recentMaterials');
        recentMaterialsList.innerHTML = recentMaterials.length > 0
            ? recentMaterials.map(material => `
                <div class="recent-item">
                    <div class="recent-icon">${material.type === 'video' ? '🎥' : '📄'}</div>
                    <div class="recent-info">
                        <div class="recent-title">${material.title || 'بدون عنوان'}</div>
                        <div class="recent-subtitle">${material.createdAt ? new Date(material.createdAt).toLocaleDateString('ar-EG') : ''}</div>
                    </div>
                </div>
            `).join('')
            : '<div class="loading-item">لم تنشر أي شروحات بعد</div>';

        const recentQuizzes = allQuizzes.slice(-5).reverse();
        const recentQuizzesList = document.getElementById('recentQuizzes');
        recentQuizzesList.innerHTML = recentQuizzes.length > 0
            ? recentQuizzes.map(quiz => `
                <div class="recent-item">
                    <div class="recent-icon">📝</div>
                    <div class="recent-info">
                        <div class="recent-title">${quiz.title || 'بدون عنوان'}</div>
                        <div class="recent-subtitle">${quiz.questionsCount || 0} أسئلة - ${quiz.xpReward || 0} XP</div>
                    </div>
                </div>
            `).join('')
            : '<div class="loading-item">لم تنشئ أي كويزات بعد</div>';

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// =========================================
// 6. Load Materials
// =========================================
async function loadMaterials() {
    try {
        const materialsSnapshot = await getDocs(
            query(collection(db, 'materials'), where('teacherId', '==', currentUser.uid))
        );
        allMaterials = [];
        materialsSnapshot.forEach(docSnap => {
            allMaterials.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderMaterialsGrid(allMaterials);
    } catch (error) {
        console.error('Error loading materials:', error);
    }
}

function renderMaterialsGrid(materials) {
    const grid = document.getElementById('materialsGrid');
    
    if (materials.length === 0) {
        grid.innerHTML = '<div class="loading-card">لم تنشر أي شروحات بعد. ابدأ بإضافة شرح جديد!</div>';
        return;
    }

    const sortedMaterials = [...materials].sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return 0;
    });

    grid.innerHTML = sortedMaterials.map(material => {
        const typeIcon = material.type === 'video' ? '🎥' : '📝';
        
        return `
            <div class="material-card ${material.featured ? 'featured' : ''}">
                <div class="material-header">
                    <div class="material-icon">${typeIcon}</div>
                    <div>
                        <h3 class="material-title">${material.title || 'بدون عنوان'}</h3>
                        <div class="material-meta">${material.subject || 'غير محدد'} • ${material.createdAt ? new Date(material.createdAt).toLocaleDateString('ar-EG') : ''}</div><div class="material-id" style="font-size:.75rem;color:var(--text-tertiary);margin-top:4px;direction:ltr;text-align:right;">ID: ${material.id}</div>
                    </div>
                </div>
                <p class="material-description">${material.description || 'لا يوجد وصف'}</p>
                <div class="material-actions">
                    <button class="btn-view" onclick="viewMaterial('${material.id}')">فتح الشرح</button>
                    <button class="btn-edit" onclick="editMaterial('${material.id}')">تعديل</button>
                    <button class="btn-delete" onclick="deleteMaterial('${material.id}')">حذف</button>
                </div>
            </div>
        `;
    }).join('');
}

// =========================================
// 7. Load Quizzes
// =========================================
async function loadQuizzes() {
    try {
        const quizzesSnapshot = await getDocs(
            query(collection(db, 'quizzes'), where('teacherId', '==', currentUser.uid))
        );
        allQuizzes = [];
        quizzesSnapshot.forEach(docSnap => {
            allQuizzes.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderQuizzesGrid(allQuizzes);
    } catch (error) {
        console.error('Error loading quizzes:', error);
    }
}

function renderQuizzesGrid(quizzes) {
    const grid = document.getElementById('quizzesGrid');
    
    if (quizzes.length === 0) {
        grid.innerHTML = '<div class="loading-card">لم تنشئ أي كويزات بعد. ابدأ بإنشاء كويز جديد!</div>';
        return;
    }

    grid.innerHTML = quizzes.map(quiz => {
        const daysLeft = Math.ceil((new Date(quiz.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        const isExpired = daysLeft <= 0;
        
        const deadlineText = quiz.deadline ? new Date(quiz.deadline).toLocaleString('ar-EG', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }) : 'غير محدد';
        
        return `
            <div class="quiz-card ${quiz.isOptional ? 'optional' : ''}">
                <div class="quiz-header">
                    <h3 class="quiz-title">${quiz.title || 'بدون عنوان'}</h3>
                    <span class="quiz-subject">${quiz.subject || 'غير محدد'}</span>
                </div>
                <div class="quiz-details">
                    <div class="quiz-detail">
                        <span>❓</span>
                        <span>${quiz.questions?.length || quiz.questionsCount || 0} أسئلة</span>
                    </div>
                    <div class="quiz-detail">
                        <span>⭐</span>
                        <span>${quiz.xpReward || 0} XP</span>
                    </div>
                    <div class="quiz-detail">
                        <span></span>
                        <span>${isExpired ? 'انتهى' : 'ينتهي: ' + deadlineText}</span>
                    </div>
                    ${quiz.isOptional ? '<div class="quiz-detail" style="color: var(--warning-color);"><span>🚩</span><span>اختياري</span></div>' : ''}
                </div>
                <div class="quiz-stats">
                    <div class="quiz-stat">
                        <span class="quiz-stat-value">${quiz.submissionsCount || 0}</span>
                        <span class="quiz-stat-label">تسليم</span>
                    </div>
                    <div class="quiz-stat">
                        <span class="quiz-stat-value">${quiz.avgScore || 0}%</span>
                        <span class="quiz-stat-label">متوسط</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// =========================================
// 8. Load Students
// =========================================
async function loadStudents() {
    try {
        const studentsSnapshot = await getDocs(
            query(collection(db, 'users'), where('role', '==', 'student'))
        );
        const teacherClass = currentUserData.class || currentUserData.targetClass || '1st Secondary';
        allStudents = [];
        studentsSnapshot.forEach(docSnap => {
            const student = { id: docSnap.id, ...docSnap.data() };
            if (!currentUserData.class && !currentUserData.targetClass || student.class === teacherClass) {
                allStudents.push(student);
            }
        });
        renderStudentsTable(allStudents);
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">لا يوجد طلاب مطابقون للصف المحدد</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => {
        const avgScore = student.avgScore || 0;
        const completedQuizzes = student.completedQuizzes || 0;
        const status = student.redFlag ? 'flagged' : 'active';
        const statusText = student.redFlag ? 'يحتاج متابعة' : 'نشط';
        
        return `
            <tr>
                <td>${student.name || 'بدون اسم'}</td>
                <td>${student.email || '-'}</td>
                <td>${avgScore}%</td>
                <td>${completedQuizzes}</td>
                <td><span class="status-badge ${status}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// =========================================
// 9. Load Announcements
// =========================================
async function loadAnnouncements() {
    try {
        const announcementsSnapshot = await getDocs(
            query(collection(db, 'announcements'), where('teacherId', '==', currentUser.uid))
        );
        const announcements = [];
        announcementsSnapshot.forEach(docSnap => {
            announcements.push({ id: docSnap.id, ...docSnap.data() });
        });

        const announcementsList = document.getElementById('announcementsList');
        
        if (announcements.length === 0) {
            announcementsList.innerHTML = '<div class="loading-item">لم ترسل أي إشعارات بعد</div>';
            return;
        }

        announcementsList.innerHTML = announcements.map(announcement => `
            <div class="announcement-card">
                <div class="announcement-header">
                    <h3 class="announcement-title">${announcement.title || 'بدون عنوان'}</h3>
                    <div class="announcement-time">${announcement.createdAt ? new Date(announcement.createdAt).toLocaleDateString('ar-EG') : ''}</div>
                </div>
                <p class="announcement-content">${announcement.content || ''}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// =========================================
// 10. Deadline Preview System
// =========================================
function setupDeadlinePreview() {
    const dateInput = document.getElementById('deadlineDate');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const previewText = document.getElementById('deadlinePreviewText');
    const previewBox = document.getElementById('deadlinePreview');

    // تعيين التاريخ الأدنى لليوم الحالي
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);

    function updatePreview() {
        const date = dateInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        if (date && startTime && endTime) {
            // التحقق من أن وقت البداية قبل وقت النهاية
            if (startTime >= endTime) {
                previewText.textContent = '⚠️ وقت البداية يجب أن يكون قبل وقت النهاية';
                previewBox.classList.remove('active');
                return;
            }

            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            previewText.textContent = `📅 يوم ${formattedDate} | من ${startTime} إلى ${endTime}`;
            previewBox.classList.add('active');
        } else {
            previewText.textContent = 'لم يتم تحديد الموعد بعد';
            previewBox.classList.remove('active');
        }
    }

    dateInput.addEventListener('change', updatePreview);
    startTimeInput.addEventListener('change', updatePreview);
    endTimeInput.addEventListener('change', updatePreview);
}

// =========================================
// 11. Questions System
// =========================================
function setupQuestionsSystem() {
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const questionsContainer = document.getElementById('questionsContainer');
    const questionTemplate = document.getElementById('questionTemplate');

    addQuestionBtn.addEventListener('click', () => {
        addQuestion();
    });

    function addQuestion() {
        questionCounter++;
        const questionCard = questionTemplate.content.cloneNode(true);
        const questionElement = questionCard.querySelector('.question-card');
        
        // تحديث الأرقام
        questionElement.querySelector('.question-number-badge').textContent = questionCounter;
        questionElement.querySelector('.question-number').textContent = `السؤال ${questionCounter}`;
        
        // تحديث أسماء الـ radio buttons
        const radioButtons = questionElement.querySelectorAll('.option-radio');
        radioButtons.forEach(radio => {
            radio.name = `correct_answer_Q${questionCounter}`;
            radio.addEventListener('change', handleCorrectAnswerChange);
        });

        // زر الحذف
        const removeBtn = questionElement.querySelector('.btn-remove-question');
        removeBtn.addEventListener('click', () => {
            if (confirm('هل أنت متأكد من حذف هذا السؤال؟')) {
                questionElement.style.animation = 'fadeIn 0.3s ease reverse';
                setTimeout(() => {
                    questionElement.remove();
                    updateQuestionNumbers();
                }, 250);
            }
        });

        // إزالة رسالة "لا توجد أسئلة"
        const emptyMessage = questionsContainer.querySelector('.empty-questions');
        if (emptyMessage) {
            emptyMessage.remove();
        }

        questionsContainer.appendChild(questionCard);
        questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function handleCorrectAnswerChange(e) {
        const questionCard = e.target.closest('.question-card');
        const optionItems = questionCard.querySelectorAll('.option-item');
        
        optionItems.forEach(item => {
            item.classList.remove('correct-option');
        });

        const selectedRadio = e.target;
        const selectedOption = selectedRadio.closest('.option-item');
        if (selectedOption) {
            selectedOption.classList.add('correct-option');
        }
    }

    function updateQuestionNumbers() {
        const questions = questionsContainer.querySelectorAll('.question-card');
        
        if (questions.length === 0) {
            questionsContainer.innerHTML = `
                <div class="empty-questions">
                    <div class="empty-icon">📝</div>
                    <p>لم تضف أي أسئلة بعد.</p>
                    <p class="empty-hint">اضغط "إضافة سؤال" للبدء</p>
                </div>
            `;
            questionCounter = 0;
            return;
        }

        questions.forEach((question, index) => {
            const newIndex = index + 1;
            question.querySelector('.question-number-badge').textContent = newIndex;
            question.querySelector('.question-number').textContent = `السؤال ${newIndex}`;
            
            const radioButtons = question.querySelectorAll('.option-radio');
            radioButtons.forEach(radio => {
                radio.name = `correct_answer_Q${newIndex}`;
                radio.addEventListener('change', handleCorrectAnswerChange);
            });
        });

        questionCounter = questions.length;
    }
}

// =========================================
// 12. Modal & Form Handling
// =========================================
const materialModal = document.getElementById('materialModal');
const quizModal = document.getElementById('quizModal');
const announcementModal = document.getElementById('announcementModal');
const addMaterialBtn = document.getElementById('addMaterialBtn');
const addQuizBtn = document.getElementById('addQuizBtn');
const addAnnouncementBtn = document.getElementById('addAnnouncementBtn');

addMaterialBtn.addEventListener('click', () => {
    document.getElementById('materialModalTitle').textContent = 'إضافة شرح جديد';
    document.getElementById('materialForm').reset();
    document.getElementById('materialSubject').value = currentUserData.subject || '';
    delete materialModal.dataset.id;
    materialModal.classList.remove('hidden');
});

addQuizBtn.addEventListener('click', () => {
    document.getElementById('quizModalTitle').textContent = 'إنشاء كويز جديد';
    document.getElementById('quizForm').reset();
    document.getElementById('quizSubject').value = currentUserData.subject || '';
    
    // إعادة تعيين الأسئلة
    const questionsContainer = document.getElementById('questionsContainer');
    questionsContainer.innerHTML = `
        <div class="empty-questions">
            <div class="empty-icon">📝</div>
            <p>لم تضف أي أسئلة بعد.</p>
            <p class="empty-hint">اضغط "إضافة سؤال" للبدء</p>
        </div>
    `;
    questionCounter = 0;
    
    // إعادة تعيين الديدلاين
    document.getElementById('deadlinePreview').classList.remove('active');
    document.getElementById('deadlinePreviewText').textContent = 'لم يتم تحديد الموعد بعد';
    
    delete quizModal.dataset.id;
    quizModal.classList.remove('hidden');
});

addAnnouncementBtn.addEventListener('click', () => {
    document.getElementById('announcementForm').reset();
    announcementModal.classList.remove('hidden');
});

document.getElementById('closeMaterialModal').addEventListener('click', () => {
    materialModal.classList.add('hidden');
});

document.getElementById('closeQuizModal').addEventListener('click', () => {
    quizModal.classList.add('hidden');
});

document.getElementById('closeAnnouncementModal').addEventListener('click', () => {
    announcementModal.classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === materialModal) materialModal.classList.add('hidden');
    if (e.target === quizModal) quizModal.classList.add('hidden');
    if (e.target === announcementModal) announcementModal.classList.add('hidden');
});

// =========================================
// 13. Collect Questions Data
// =========================================
function collectQuestionsData() {
    const questionsContainer = document.getElementById('questionsContainer');
    const questionCards = questionsContainer.querySelectorAll('.question-card');
    const questions = [];

    questionCards.forEach((card, index) => {
        const questionText = card.querySelector('.question-text').value.trim();
        const correctExplanation = card.querySelector('.correct-explanation').value.trim();
        
        const options = [];
        const optionItems = card.querySelectorAll('.option-item');
        let correctAnswerIndex = -1;

        optionItems.forEach((item, optIndex) => {
            const radio = item.querySelector('.option-radio');
            const text = item.querySelector('.option-text').value.trim();
            const explanation = item.querySelector('.option-explanation').value.trim();
            const isCorrect = radio.checked;

            if (isCorrect) {
                correctAnswerIndex = optIndex;
            }

            options.push({
                text: text,
                explanation: explanation,
                isCorrect: isCorrect
            });
        });

        if (questionText && correctAnswerIndex !== -1) {
            questions.push({
                questionNumber: index + 1,
                questionText: questionText,
                options: options,
                correctAnswerIndex: correctAnswerIndex,
                correctExplanation: correctExplanation
            });
        }
    });

    return questions;
}

// =========================================
// 14. Add/Edit Material
// =========================================
document.getElementById('materialForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const materialId = materialModal.dataset.id;
    const materialData = {
        title: document.getElementById('materialTitle').value.trim(),
        type: document.getElementById('materialType').value,
        subject: document.getElementById('materialSubject').value,
        url: document.getElementById('materialUrl').value.trim(),
        description: document.getElementById('materialDescription').value.trim(),
        content: document.getElementById('materialContent').value.trim(),
        featured: document.getElementById('materialFeatured').checked,
        teacherId: currentUser.uid,
        teacherName: currentUserData.name,
        targetClass: currentUserData.class || currentUserData.targetClass || '1st Secondary',
        updatedAt: new Date().toISOString()
    };

    const youtubeUrl = materialData.url;
    if (materialData.type === 'video') {
        if (!youtubeUrl || !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(youtubeUrl)) {
            alert('ضع رابط فيديو YouTube صحيح.');
            return;
        }
        materialData.content = '';
    } else if (materialData.type === 'text') {
        if (!materialData.content) {
            alert('اكتب نص الشرح.');
            return;
        }
        materialData.url = '';
    } else {
        alert('اختر نوع المحتوى.');
        return;
    }

    try {
        let savedId = materialId;

        if (materialId) {
            await updateDoc(doc(db, 'materials', materialId), materialData);
            alert('تم تحديث الشرح بنجاح! ✅');
        } else {
            materialData.createdAt = new Date().toISOString();
            const newDoc = await addDoc(collection(db, 'materials'), materialData);
            savedId = newDoc.id;
            alert(`تم نشر الشرح بنجاح! ✅\nID الشرح: ${savedId}`);
        }

        materialModal.classList.add('hidden');
        await loadDashboard();
        await loadMaterials();

        // فتح الشرح في صفحة مستقلة عند الطلب من زر البطاقة
        if (savedId) {
            console.log('Material page:', `material.html?id=${encodeURIComponent(savedId)}`);
        }
    } catch (error) {
        console.error('Error saving material:', error);
        alert('حدث خطأ: ' + error.message);
    }
});


// =========================================
// 15. Add Quiz (مع الأسئلة والديدلاين)
// =========================================
document.getElementById('quizForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // جمع بيانات الأسئلة
    const questions = collectQuestionsData();
    
    if (questions.length === 0) {
        alert('⚠️ يجب إضافة سؤال واحد على الأقل للكويز!');
        return;
    }

    // التحقق من أن كل سؤال له 4 خيارات
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (q.options.some(opt => !opt.text)) {
            alert(`️ السؤال ${i + 1}: يجب ملء جميع الخيارات الأربعة!`);
            return;
        }
    }

    // جمع بيانات الديدلاين
    const deadlineDate = document.getElementById('deadlineDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    if (!deadlineDate || !startTime || !endTime) {
        alert('⚠️ يجب تحديد تاريخ ووقت بداية ونهاية الكويز!');
        return;
    }

    if (startTime >= endTime) {
        alert('️ وقت البداية يجب أن يكون قبل وقت النهاية!');
        return;
    }

    // دمج التاريخ مع وقت النهاية (الديدلاين الفعلي)
    const deadlineDateTime = new Date(`${deadlineDate}T${endTime}:00`);
    const startDateTime = new Date(`${deadlineDate}T${startTime}:00`);

    const quizData = {
        title: document.getElementById('quizTitle').value.trim(),
        subject: document.getElementById('quizSubject').value,
        xpReward: parseInt(document.getElementById('quizXP').value),
        isOptional: document.getElementById('quizOptional').checked,
        questions: questions,
        questionsCount: questions.length,
        deadline: deadlineDateTime.toISOString(),
        deadlineDate: deadlineDate,
        startTime: startTime,
        endTime: endTime,
        startDateTime: startDateTime.toISOString(),
        teacherId: currentUser.uid,
        teacherName: currentUserData.name,
        targetClass: currentUserData.class || currentUserData.targetClass || '1st Secondary',
        submissionsCount: 0,
        avgScore: 0,
        updatedAt: new Date().toISOString()
    };

    try {
        const quizId = quizModal.dataset.id;
        
        if (quizId) {
            await updateDoc(doc(db, 'quizzes', quizId), quizData);
            alert('تم تحديث الكويز بنجاح! ✅');
        } else {
            quizData.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'quizzes'), quizData);
            alert('تم نشر الكويز بنجاح! ✅');
        }

        quizModal.classList.add('hidden');
        await loadDashboard();
        await loadQuizzes();

    } catch (error) {
        console.error('Error saving quiz:', error);
        alert('حدث خطأ: ' + error.message);
    }
});

// =========================================
// 16. Add Announcement
// =========================================
document.getElementById('announcementForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const announcementData = {
        title: document.getElementById('announcementTitle').value.trim(),
        content: document.getElementById('announcementContent').value.trim(),
        teacherId: currentUser.uid,
        teacherName: currentUserData.name,
        targetClass: currentUserData.class || currentUserData.targetClass || '1st Secondary',
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, 'announcements'), announcementData);
        alert('تم إرسال الإشعار بنجاح! ✅');
        announcementModal.classList.add('hidden');
        await loadAnnouncements();
    } catch (error) {
        console.error('Error sending announcement:', error);
        alert('حدث خطأ: ' + error.message);
    }
});

// =========================================
// 17. Edit & Delete Functions
// =========================================
window.editMaterial = function(id) {
    const material = allMaterials.find(m => m.id === id);
    if (!material) return;
    
    document.getElementById('materialModalTitle').textContent = 'تعديل الشرح';
    document.getElementById('materialTitle').value = material.title || '';
    document.getElementById('materialType').value = material.type || '';
    document.getElementById('materialSubject').value = material.subject || '';
    document.getElementById('materialUrl').value = material.url || '';
    document.getElementById('materialDescription').value = material.description || '';
    document.getElementById('materialContent').value = material.content || '';
    document.getElementById('materialFeatured').checked = material.featured || false;
    
    materialModal.dataset.id = id;
    materialModal.classList.remove('hidden');
};

window.deleteMaterial = async function(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الشرح؟')) return;
    
    try {
        await deleteDoc(doc(db, 'materials', id));
        alert('تم حذف الشرح بنجاح ✅');
        await loadDashboard();
        await loadMaterials();
    } catch (error) {
        console.error('Error deleting material:', error);
        alert('حدث خطأ في الحذف');
    }
};

window.viewMaterial = function(id) {
    const material = allMaterials.find(m => m.id === id);
    if (!material) return;
    const url = `material.html?id=${encodeURIComponent(id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
};

// =========================================
// 18. Search
// =========================================
document.getElementById('searchStudents').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allStudents.filter(s => 
        (s.name && s.name.toLowerCase().includes(searchTerm)) || 
        (s.email && s.email.toLowerCase().includes(searchTerm))
    );
    renderStudentsTable(filtered);
});

// =========================================
// 19. Setup Event Listeners
// =========================================
function setupEventListeners() {
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
    
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            await signOut(auth);
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userEmail');
            window.location.href = '../login.html';
        }
    });
    
    document.getElementById('cancelMaterial').addEventListener('click', () => {
        materialModal.classList.add('hidden');
    });
    
    document.getElementById('cancelQuiz').addEventListener('click', () => {
        quizModal.classList.add('hidden');
    });
    
    document.getElementById('cancelAnnouncement').addEventListener('click', () => {
        announcementModal.classList.add('hidden');
    });
}