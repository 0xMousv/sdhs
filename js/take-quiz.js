// js/take-quiz.js

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
    query,
    where,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================================
// نظام تناقص الـ XP (Dynamic Scoring)
// أول طالب يحل الكويز ياخد الدرجة الكاملة، وبعد كل حل تقل
// مكافأة الـ XP بنسبة 2% لحد ما توصل لنص القيمة الأصلية (الحد الأدنى 50%)
// =========================================
const DECAY_PER_SOLVE = 0.02;
const MIN_DECAY_MULTIPLIER = 0.5;

function getDecayMultiplier(solveRank) {
    // أول حل (rank = 1) ياخد المضاعف كامل (1.0)
    const multiplier = 1 - DECAY_PER_SOLVE * (solveRank - 1);
    return Math.max(MIN_DECAY_MULTIPLIER, multiplier);
}

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
let currentQuiz = null;
let currentQuizId = null;
let userAnswers = {}; // { questionIndex: optionIndex }
let currentQuestionIndex = 0;
let timerInterval = null;
let timeRemaining = 0;
let quizSubmitted = false;

// =========================================
// 3. Get Quiz ID from URL
// =========================================
function getQuizIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    if (idFromUrl) return idFromUrl;

    // خطة بديلة: لو الرابط ملوش id (مثلاً بعد Refresh لصفحة قديمة)
    // نرجع نجيبه من localStorage اللي بتحفظه صفحة الطالب
    return localStorage.getItem('currentQuizId');
}

// =========================================
// 4. Authentication Check
// =========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('Student taking quiz:', user.email);

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                
                if (currentUserData.role === 'student') {
                    // التحقق من وجود Quiz ID
                    currentQuizId = getQuizIdFromURL();
                    if (!currentQuizId) {
                        alert('⚠️ لم يتم تحديد الكويز');
                        window.location.href = 'student.html';
                        return;
                    }

                    // التحقق من عدم الحل السابق
                    const submissionsSnapshot = await getDocs(
                        query(collection(db, 'submissions'), 
                              where('studentId', '==', user.uid),
                              where('quizId', '==', currentQuizId))
                    );
                    
                    if (!submissionsSnapshot.empty) {
                        alert('✅ لقد قمت بحل هذا الكويز بالفعل!');
                        window.location.href = 'student.html';
                        return;
                    }

                    // تحميل الكويز
                    await loadQuiz(currentQuizId);
                } else {
                    alert('ليس لديك صلاحية الوصول لهذه الصفحة');
                    await signOut(auth);
                    window.location.href = '../login.html';
                }
            } else {
                alert('خطأ في بيانات المستخدم');
                await signOut(auth);
                window.location.href = '../login.html';
            }
        } catch (error) {
            console.error('Error:', error);
            alert('حدث خطأ: ' + error.message);
            window.location.href = 'student.html';
        }
    } else {
        window.location.href = '../login.html';
    }
});

// =========================================
// 5. Load Quiz
// =========================================
async function loadQuiz(quizId) {
    try {
        const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
        
        if (!quizDoc.exists()) {
            alert('الكويز غير موجود');
            window.location.href = 'student.html';
            return;
        }

        currentQuiz = { id: quizDoc.id, ...quizDoc.data() };

        // التحقق من وقت البداية
        if (currentQuiz.startDateTime) {
            const now = new Date();
            const startTime = new Date(currentQuiz.startDateTime);
            if (now < startTime) {
                alert(`⏰ الكويز لم يبدأ بعد. سيبدأ في ${startTime.toLocaleString('ar-EG')}`);
                window.location.href = 'student.html';
                return;
            }
        }

        // التحقق من وقت النهاية
        if (currentQuiz.deadline) {
            const now = new Date();
            const deadline = new Date(currentQuiz.deadline);
            if (now > deadline) {
                alert('⏰ انتهى وقت الكويز');
                window.location.href = 'student.html';
                return;
            }
        }

        // تهيئة الإجابات
        userAnswers = {};
        currentQuestionIndex = 0;

        // عرض معلومات الكويز
        document.getElementById('quizTitle').textContent = currentQuiz.title || 'كويز';
        document.getElementById('quizSubject').textContent = currentQuiz.subject || 'غير محدد';
        document.getElementById('quizTeacher').textContent = currentQuiz.teacherName || 'غير محدد';
        document.getElementById('quizQuestionsCount').textContent = `${currentQuiz.questionsCount || currentQuiz.questions?.length || 0} أسئلة`;
        document.getElementById('quizXP').textContent = `${currentQuiz.xpReward || 0} XP`;

        // عرض الأسئلة
        renderQuestions();
        renderQuestionDots();
        updateCurrentQuestion();
        updateProgress();

        // بدء المؤقت
        startTimer();

        // إخفاء التحميل وإظهار الكويز
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('quizMain').style.display = 'block';

        // تحذير عند محاولة الخروج
        window.addEventListener('beforeunload', handleBeforeUnload);

    } catch (error) {
        console.error('Error loading quiz:', error);
        alert('حدث خطأ في تحميل الكويز');
        window.location.href = 'student.html';
    }
}

// =========================================
// 6. Render Questions
// =========================================
function renderQuestions() {
    const wrapper = document.getElementById('questionsWrapper');
    const questions = currentQuiz.questions || [];

    wrapper.innerHTML = questions.map((question, index) => `
        <div class="question-card" id="question-${index}" data-index="${index}">
            <div class="question-header">
                <div class="question-number-badge">${index + 1}</div>
                <div class="question-text">${question.questionText || `السؤال ${index + 1}`}</div>
            </div>
            
            <div class="options-container">
                ${question.options.map((option, optIndex) => {
                    const letters = ['A', 'B', 'C', 'D'];
                    const isSelected = userAnswers[index] === optIndex;
                    return `
                        <div class="option-item ${isSelected ? 'selected' : ''}" 
                             onclick="selectAnswer(${index}, ${optIndex})">
                            <input type="radio" 
                                   name="question_${index}" 
                                   value="${optIndex}" 
                                   class="option-radio"
                                   ${isSelected ? 'checked' : ''}>
                            <div class="option-letter">${letters[optIndex]}</div>
                            <div class="option-text-display">${option.text || `الخيار ${letters[optIndex]}`}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

// =========================================
// 7. Render Question Dots
// =========================================
function renderQuestionDots() {
    const dotsContainer = document.getElementById('questionDots');
    const questions = currentQuiz.questions || [];

    dotsContainer.innerHTML = questions.map((_, index) => `
        <div class="question-dot" 
             data-index="${index}"
             onclick="goToQuestion(${index})">
            ${index + 1}
        </div>
    `).join('');
}

// =========================================
// 8. Select Answer
// =========================================
window.selectAnswer = function(questionIndex, optionIndex) {
    if (quizSubmitted) return;

    userAnswers[questionIndex] = optionIndex;

    // تحديث UI
    const questionCard = document.getElementById(`question-${questionIndex}`);
    const optionItems = questionCard.querySelectorAll('.option-item');
    
    optionItems.forEach((item, idx) => {
        if (idx === optionIndex) {
            item.classList.add('selected');
            item.querySelector('.option-radio').checked = true;
        } else {
            item.classList.remove('selected');
            item.querySelector('.option-radio').checked = false;
        }
    });

    // تحديث النقاط
    updateQuestionDots();
    updateProgress();
};

// =========================================
// 9. Update Question Dots
// =========================================
function updateQuestionDots() {
    const dots = document.querySelectorAll('.question-dot');
    dots.forEach((dot, index) => {
        dot.classList.remove('current', 'answered');
        if (index === currentQuestionIndex) {
            dot.classList.add('current');
        }
        if (userAnswers[index] !== undefined) {
            dot.classList.add('answered');
        }
    });
}

// =========================================
// 10. Update Current Question
// =========================================
function updateCurrentQuestion() {
    const questions = document.querySelectorAll('.question-card');
    questions.forEach((card, index) => {
        card.classList.remove('current', 'answered');
        if (index === currentQuestionIndex) {
            card.classList.add('current');
        }
        if (userAnswers[index] !== undefined) {
            card.classList.add('answered');
        }
    });

    // تحديث أزرار التنقل
    document.getElementById('prevQuestionBtn').disabled = currentQuestionIndex === 0;
    document.getElementById('nextQuestionBtn').disabled = 
        currentQuestionIndex === (currentQuiz.questions?.length || 0) - 1;

    updateQuestionDots();
}

// =========================================
// 11. Go to Question
// =========================================
window.goToQuestion = function(index) {
    currentQuestionIndex = index;
    updateCurrentQuestion();
    
    const questionCard = document.getElementById(`question-${index}`);
    questionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// =========================================
// 12. Navigation Buttons
// =========================================
document.getElementById('prevQuestionBtn').addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        updateCurrentQuestion();
        document.getElementById(`question-${currentQuestionIndex}`).scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }
});

document.getElementById('nextQuestionBtn').addEventListener('click', () => {
    const totalQuestions = currentQuiz.questions?.length || 0;
    if (currentQuestionIndex < totalQuestions - 1) {
        currentQuestionIndex++;
        updateCurrentQuestion();
        document.getElementById(`question-${currentQuestionIndex}`).scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }
});

// =========================================
// 13. Update Progress
// =========================================
function updateProgress() {
    const totalQuestions = currentQuiz.questions?.length || 0;
    const answeredQuestions = Object.keys(userAnswers).length;
    const percentage = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

    document.getElementById('progressText').textContent = `${answeredQuestions} / ${totalQuestions}`;
    document.getElementById('progressBar').style.width = `${percentage}%`;
}

// =========================================
// 14. Timer System
// =========================================
function startTimer() {
    // حساب الوقت المتبقي
    if (currentQuiz.deadline) {
        const now = new Date();
        const deadline = new Date(currentQuiz.deadline);
        timeRemaining = Math.max(0, Math.floor((deadline - now) / 1000));
    } else {
        // افتراضي: 30 دقيقة
        timeRemaining = 30 * 60;
    }

    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert('⏰ انتهى وقت الكويز! سيتم إرسال إجاباتك تلقائياً.');
            submitQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    const seconds = timeRemaining % 60;

    const display = hours > 0 
        ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    document.getElementById('timerDisplay').textContent = display;

    // تحديث حالة المؤقت
    const timerBox = document.getElementById('timerBox');
    timerBox.classList.remove('urgent', 'warning');

    if (timeRemaining <= 60) {
        timerBox.classList.add('urgent');
    } else if (timeRemaining <= 300) {
        timerBox.classList.add('warning');
    }
}

// =========================================
// 15. Submit Quiz
// =========================================
function showConfirmModal() {
    const totalQuestions = currentQuiz.questions?.length || 0;
    const answeredQuestions = Object.keys(userAnswers).length;
    const unanswered = totalQuestions - answeredQuestions;

    document.getElementById('confirmMessage').textContent = 
        `هل أنت متأكد من إرسال إجاباتك؟ لن تتمكن من تعديلها بعد ذلك.`;
    
    document.getElementById('confirmStats').innerHTML = `
        <div>✅ تم الإجابة على <strong>${answeredQuestions}</strong> من <strong>${totalQuestions}</strong> أسئلة</div>
        ${unanswered > 0 ? `<div style="color: var(--warning-color); margin-top: 8px;">⚠️ هناك ${unanswered} سؤال بدون إجابة</div>` : ''}
    `;

    document.getElementById('confirmModal').classList.remove('hidden');
}

async function submitQuiz() {
    if (quizSubmitted) return;
    quizSubmitted = true;

    // إيقاف المؤقت
    clearInterval(timerInterval);
    window.removeEventListener('beforeunload', handleBeforeUnload);

    try {
        // حساب النتيجة
        const questions = currentQuiz.questions || [];
        let correctCount = 0;
        let totalScore = 0;

        questions.forEach((question, index) => {
            const userAnswer = userAnswers[index];
            if (userAnswer !== undefined && question.correctAnswerIndex === userAnswer) {
                correctCount++;
            }
        });

        totalScore = correctCount;
        const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

        // حساب الـ XP الأساسي على حسب النسبة المئوية
        let baseXpEarned = 0;
        if (percentage >= 60) {
            baseXpEarned = Math.round((currentQuiz.xpReward || 0) * (percentage / 100));
        }

        // نستخدم Transaction عشان ترتيب الحل (solveRank) يتحسب بأمان
        // حتى لو أكتر من طالب بيسلم في نفس اللحظة بالظبط
        const quizRef = doc(db, 'quizzes', currentQuiz.id);
        const submissionRef = doc(collection(db, 'submissions'));

        let solveRank = null;
        let decayMultiplier = null;
        let xpEarned = 0;
        const didSolve = baseXpEarned > 0; // نجح في الكويز (٦٠٪ فأكتر) = "حله"

        await runTransaction(db, async (transaction) => {
            const quizSnap = await transaction.get(quizRef);
            const quizData = quizSnap.exists() ? quizSnap.data() : {};
            const previousSolves = quizData.solvedCount || 0;
            const previousSubmissions = quizData.submissionsCount || 0;

            if (didSolve) {
                solveRank = previousSolves + 1;
                decayMultiplier = getDecayMultiplier(solveRank);
                xpEarned = Math.round(baseXpEarned * decayMultiplier);
            }

            const submissionData = {
                quizId: currentQuiz.id,
                studentId: currentUser.uid,
                studentName: currentUserData.name,
                studentEmail: currentUserData.email,
                answers: userAnswers,
                score: totalScore,
                totalQuestions: questions.length,
                percentage: percentage,
                baseXpEarned: baseXpEarned,
                decayMultiplier: decayMultiplier,
                solveRank: solveRank,
                xpEarned: xpEarned,
                submittedAt: new Date().toISOString(),
                timeTaken: (currentQuiz.deadline ? new Date(currentQuiz.deadline) : new Date()) - new Date()
            };

            transaction.set(submissionRef, submissionData);
            transaction.update(quizRef, {
                solvedCount: didSolve ? solveRank : previousSolves,
                submissionsCount: previousSubmissions + 1
            });
        });

        // عرض النتيجة
        showResult(totalScore, questions.length, percentage, xpEarned, solveRank);

    } catch (error) {
        console.error('Error submitting quiz:', error);
        alert('حدث خطأ في إرسال الإجابات: ' + error.message);
        quizSubmitted = false;
    }
}

// =========================================
// 16. Show Result
// =========================================
function showResult(score, total, percentage, xp, solveRank) {
    let icon, title, subtitle;

    if (percentage >= 90) {
        icon = '';
        title = 'ممتاز! أداء رائع';
        subtitle = 'أحسنت! استمر في التفوق';
    } else if (percentage >= 75) {
        icon = '🌟';
        title = 'جيد جداً!';
        subtitle = 'أداء جيد، يمكنك التحسن أكثر';
    } else if (percentage >= 60) {
        icon = '👍';
        title = 'جيد';
        subtitle = 'نجحت، لكن تحتاج لمزيد من المراجعة';
    } else {
        icon = '';
        title = 'تحتاج مراجعة';
        subtitle = 'لا بأس، راجع الشرح وحاول مرة أخرى';
    }

    document.getElementById('resultIcon').textContent = icon;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultSubtitle').textContent = subtitle;
    document.getElementById('resultScore').textContent = `${score}/${total}`;
    document.getElementById('resultPercentage').textContent = `${percentage}%`;
    document.getElementById('resultXP').textContent = `+${xp}`;
    document.getElementById('resultCorrect').textContent = score;

    const resultRankEl = document.getElementById('resultRank');
    if (resultRankEl) {
        resultRankEl.textContent = solveRank ? `#${solveRank}` : '-';
    }

    document.getElementById('resultModal').classList.remove('hidden');
}

// =========================================
// 17. Review Answers
// =========================================
document.getElementById('reviewAnswersBtn').addEventListener('click', () => {
    document.getElementById('resultModal').classList.add('hidden');
    showReview();
});

function showReview() {
    const reviewContent = document.getElementById('reviewContent');
    const questions = currentQuiz.questions || [];
    const letters = ['A', 'B', 'C', 'D'];

    reviewContent.innerHTML = questions.map((question, index) => {
        const userAnswer = userAnswers[index];
        const correctAnswer = question.correctAnswerIndex;
        const isCorrect = userAnswer === correctAnswer;

        return `
            <div class="review-question">
                <div class="review-question-header">
                    <div class="review-question-number ${isCorrect ? 'correct' : 'wrong'}">
                        ${isCorrect ? '✓' : '✗'}
                    </div>
                    <div class="review-question-text">
                        السؤال ${index + 1}: ${question.questionText}
                    </div>
                </div>

                <div class="review-options">
                    ${question.options.map((option, optIndex) => {
                        let optionClass = '';
                        let icon = '';

                        if (optIndex === correctAnswer) {
                            optionClass = 'correct';
                            icon = '✅';
                        } else if (optIndex === userAnswer && !isCorrect) {
                            optionClass = 'selected-wrong';
                            icon = '❌';
                        } else {
                            icon = '⚪';
                        }

                        return `
                            <div class="review-option ${optionClass}">
                                <div class="review-option-icon">${icon}</div>
                                <div class="review-option-content">
                                    <div class="review-option-text">
                                        <strong>${letters[optIndex]}.</strong> ${option.text}
                                    </div>
                                    ${option.explanation ? `
                                        <div class="review-option-explanation">
                                            💬 ${option.explanation}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${question.correctExplanation ? `
                    <div class="review-correct-explanation">
                        <div class="review-correct-explanation-label"> شرح الإجابة الصحيحة:</div>
                        <div class="review-correct-explanation-text">${question.correctExplanation}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    document.getElementById('reviewModal').classList.remove('hidden');
}

// =========================================
// 18. Event Listeners
// =========================================
document.getElementById('submitQuizBtn').addEventListener('click', showConfirmModal);
document.getElementById('finalSubmitBtn').addEventListener('click', showConfirmModal);

document.getElementById('cancelSubmitBtn').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.add('hidden');
});

document.getElementById('confirmSubmitBtn').addEventListener('click', async () => {
    document.getElementById('confirmModal').classList.add('hidden');
    await submitQuiz();
});

document.getElementById('backToDashboardBtn').addEventListener('click', () => {
    window.location.href = 'student.html';
});

document.getElementById('closeReviewModal').addEventListener('click', () => {
    document.getElementById('reviewModal').classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('reviewModal')) {
        document.getElementById('reviewModal').classList.add('hidden');
    }
});

// تحذير عند محاولة الخروج
function handleBeforeUnload(e) {
    if (!quizSubmitted && Object.keys(userAnswers).length > 0) {
        e.preventDefault();
        e.returnValue = 'لديك إجابات غير محفوظة. هل أنت متأكد من المغادرة؟';
        return e.returnValue;
    }
}

// منع النقر بزر الماوس الأيمن (اختياري - لمنع الغش البسيط)
document.addEventListener('contextmenu', (e) => {
    if (!quizSubmitted) {
        e.preventDefault();
    }
});

// منع F12 و Ctrl+Shift+I (اختياري)
document.addEventListener('keydown', (e) => {
    if (!quizSubmitted) {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
            e.preventDefault();
        }
    }
});