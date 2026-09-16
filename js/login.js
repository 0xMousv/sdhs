// js/login.js

// =========================================
// 1. Firebase Configuration & Imports
// =========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc 
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
// 2. DOM Elements
// =========================================
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const errorMessage = document.getElementById('errorMessage');
const loginBtn = document.getElementById('loginBtn');
const btnText = loginBtn.querySelector('.btn-text');
const btnLoader = loginBtn.querySelector('.btn-loader');

// =========================================
// 3. Toggle Password Visibility
// =========================================
togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePasswordBtn.textContent = type === 'password' ? '👁️' : '';
});

// =========================================
// 4. Role is determined by the account stored in Firestore
// =========================================
// لا نعتمد على شكل الإيميل أو دومين وهمي لتحديد الصلاحية.
// بعد نجاح Firebase Authentication نقرأ users/{uid} ونستخدم role المسجل هناك.
const ALLOWED_ROLES = new Set(['admin', 'teacher', 'student', 'principal']);

function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    return ALLOWED_ROLES.has(value) ? value : null;
}

function getRedirectPage(role) {
    return role ? `${role}.html` : null;
}

async function getUserProfile(uid) {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return null;
    const data = userDoc.data();
    const role = normalizeRole(data.role);
    if (!role) return null;
    return { ...data, role };
}

// =========================================
// 7. Login Form Submission
// =========================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Validation
    if (!email || !password) {
        showError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
        return;
    }
    // Show loading
    setLoading(true);
    
    try {
        // Firebase Authentication - يتحقق من الهاش تلقائياً
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // الحسابات المسموح لها بالدخول هي الحسابات الموجودة في users/{uid}.
        // الدور محفوظ في Firestore؛ لا يوجد اختيار يدوي للدور ولا اعتماد على دومين الإيميل.
        const profile = await getUserProfile(user.uid);
        if (!profile) {
            showError('الحساب غير مسجل على المنصة أو لم يتم تحديد صلاحياته بعد.');
            await auth.signOut();
            setLoading(false);
            return;
        }

        const role = profile.role;
        
        // حفظ بيانات الجلسة
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', role);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userUID', user.uid);
        
        // رسالة نجاح
        showSuccess('تم تسجيل الدخول بنجاح! جاري التحويل...');
        
        // التوجيه بعد 600ms
        setTimeout(() => {
            const redirectPage = getRedirectPage(role);
            window.location.href = redirectPage;
        }, 600);
        
    } catch (error) {
        console.error('Login error:', error);
        setLoading(false);
        
        // رسائل خطأ واضحة بالعربي
        switch (error.code) {
            case 'auth/invalid-credential':
            case 'auth/wrong-password':
            case 'auth/user-not-found':
                showError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
                break;
            case 'auth/invalid-email':
                showError('صيغة البريد الإلكتروني غير صحيحة');
                break;
            case 'auth/too-many-requests':
                showError('محاولات كثيرة جداً. انتظر قليلاً وحاول مرة أخرى');
                break;
            case 'auth/network-request-failed':
                showError('مشكلة في الاتصال بالإنترنت');
                break;
            default:
                showError('حدث خطأ غير متوقع. حاول مرة أخرى');
        }
    }
});

// =========================================
// 8. Helper Functions
// =========================================
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

function hideError() {
    errorMessage.classList.remove('show');
}

function showSuccess(message) {
    errorMessage.textContent = message;
    errorMessage.style.backgroundColor = 'rgba(22, 163, 74, 0.1)';
    errorMessage.style.borderColor = 'var(--success-color)';
    errorMessage.style.color = 'var(--success-color)';
    errorMessage.classList.add('show');
}

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    if (isLoading) {
        btnText.textContent = 'جاري تسجيل الدخول...';
        btnLoader.classList.remove('hidden');
    } else {
        btnText.textContent = 'تسجيل الدخول';
        btnLoader.classList.add('hidden');
    }
}


// =========================================
// 9. Auto-redirect if already logged in
// =========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
        const profile = await getUserProfile(user.uid);
        const redirectPage = profile ? getRedirectPage(profile.role) : null;
        if (redirectPage) {
            window.location.href = redirectPage;
        } else {
            await auth.signOut();
        }
    } catch (error) {
        console.error('Session role check failed:', error);
        await auth.signOut();
    }
});
