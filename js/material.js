import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyChYh6bHiB7dAAcDYbrHzW61gyQR0A5UuM",
  authDomain: "ninjaturtels.firebaseapp.com",
  projectId: "ninjaturtels",
  storageBucket: "ninjaturtels.firebasestorage.app",
  messagingSenderId: "1063186224531",
  appId: "1:1063186224531:web:76b1369b477808e4654466"
};

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get('id');
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0];
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const p = u.pathname.split('/');
      let i = p.indexOf('embed'); if (i >= 0) return p[i + 1];
      i = p.indexOf('shorts'); if (i >= 0) return p[i + 1];
    }
  } catch {}
  return null;
}

function fail(msg) {
  $('loading').classList.add('hidden');
  $('error').textContent = msg;
  $('error').classList.remove('hidden');
}

onAuthStateChanged(auth, async user => {
  if (!user) { fail('يجب تسجيل الدخول أولاً.'); return; }
  if (!id) { fail('معرّف الدرس غير موجود.'); return; }
  try {
    const [mSnap, uSnap] = await Promise.all([
      getDoc(doc(db, 'materials', id)),
      getDoc(doc(db, 'users', user.uid))
    ]);
    if (!mSnap.exists()) { fail('الدرس غير موجود أو تم حذفه.'); return; }
    const m = mSnap.data(), u = uSnap.exists() ? uSnap.data() : {};
    const allowed = u.role === 'admin'
      || (u.role === 'teacher' && m.teacherId === user.uid)
      || (u.role === 'student' && ((m.targetClasses || []).includes(u.class) || m.targetClass === u.class));
    if (!allowed) { fail('هذا الدرس غير متاح لحسابك.'); return; }

    if (u.role === 'student') {
      try {
        await setDoc(doc(db, 'materialViews', `${id}_${user.uid}`), {
          materialId: id, studentId: user.uid, studentName: u.name || user.email,
          teacherId: m.teacherId || '',
          openedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) { console.warn(e); }
    }

    renderLesson(m);
    $('loading').classList.add('hidden');
    $('lesson').classList.remove('hidden');
    setupChat(user, u, m);
  } catch (e) {
    console.error(e);
    fail('حدث خطأ أثناء تحميل الدرس.');
  }
});

function renderLesson(m) {
  document.title = m.title || 'الدرس';
  $('title').textContent = m.title || 'بدون عنوان';
  $('materialId').textContent = `ID: ${id}`;
  $('meta').textContent = `${m.subject || ''} • ${m.teacherName || ''}`;
  $('description').textContent = m.description || '';

  const vid = youtubeId(m.youtubeUrl || m.url || '');
  const isImage = m.type === 'image' || (m.fileUrl && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(m.fileUrl));
  const isPdf = m.type === 'pdf' || (m.fileUrl && /\.pdf(\?|$)/i.test(m.fileUrl));
  const isFile = m.fileUrl && !isImage && !isPdf;

  if (vid) {
    $('video').src = `https://www.youtube.com/embed/${encodeURIComponent(vid)}`;
    $('videoSection').classList.remove('hidden');
  }

  if (isImage && m.fileUrl) {
    $('imageEl').src = m.fileUrl;
    $('imageEl').alt = m.title || 'صورة الدرس';
    $('imageLink').href = m.fileUrl;
    $('imageFileLink').href = m.fileUrl;
    $('imageFileLink').download = m.fileName || '';
    $('imageSection').classList.remove('hidden');
  } else if (isPdf && m.fileUrl) {
    $('pdfFrame').src = m.fileUrl;
    $('pdfDownload').href = m.fileUrl;
    $('pdfDownload').download = m.fileName || '';
    $('pdfSection').classList.remove('hidden');
  } else if (isFile) {
    $('fileLink').href = m.fileUrl;
    $('fileLink').download = m.fileName || '';
    $('fileName').textContent = m.fileName || 'الملف المرفق';
    $('fileIcon').textContent = '📎';
    $('fileSection').classList.remove('hidden');
  }

  if (m.content) {
    $('content').textContent = m.content;
    $('textSection').classList.remove('hidden');
  }

  $('typeBadge').textContent = isImage ? 'صورة' : isPdf ? 'ملف PDF' : vid ? 'YouTube' : isFile ? 'ملف مرفق' : 'شرح الدرس';

  if (!vid && !isImage && !isPdf && !isFile && !m.content) {
    $('emptyContent').classList.remove('hidden');
  }
}

async function setupChat(user, ud, m) {
  const btn = $('discussBtn'), modal = $('chatModal');
  btn.classList.remove('hidden');

  const openModal = () => { modal.classList.remove('hidden'); load(); };
  const closeModal = () => modal.classList.add('hidden');

  btn.onclick = openModal;
  $('closeChat').onclick = closeModal;
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  const load = async () => {
    const s = await getDocs(query(collection(db, 'lessonMessages'), where('materialId', '==', id)));
    const rows = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    $('chatMessages').innerHTML = rows.map(x => `
      <div class="chat-msg ${x.senderId === user.uid ? 'mine' : ''}">
        <b>${esc(x.senderName || 'مستخدم')}</b>
        <span>${esc(x.text)}</span>
        <small>${x.createdAt ? new Date(x.createdAt).toLocaleString('ar-EG') : ''}</small>
      </div>`).join('') || '<div class="empty">ابدأ أول رسالة في مناقشة هذا الدرس.</div>';
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  };

  $('chatForm').onsubmit = async e => {
    e.preventDefault();
    const input = $('chatInput'), text = input.value.trim();
    if (!text) return;
    await addDoc(collection(db, 'lessonMessages'), {
      materialId: id, senderId: user.uid, senderName: ud.name || user.email,
      role: ud.role || 'student', text, createdAt: new Date().toISOString()
    });
    input.value = '';
    await load();
  };
}
