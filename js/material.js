import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyChYh6bHiB7dAAcDYbrHzW61gyQR0A5UuM",authDomain:"ninjaturtels.firebaseapp.com",projectId:"ninjaturtels",storageBucket:"ninjaturtels.firebasestorage.app",messagingSenderId:"1063186224531",appId:"1:1063186224531:web:76b1369b477808e4654466"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search), id=params.get('id');

function youtubeId(url){
  try{
    const u=new URL(url);
    if(u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0];
    if(u.hostname.includes('youtube.com')){
      if(u.pathname==='/watch') return u.searchParams.get('v');
      const parts=u.pathname.split('/');
      const i=parts.indexOf('embed');
      if(i>=0) return parts[i+1];
      const si=parts.indexOf('shorts');
      if(si>=0) return parts[si+1];
    }
  }catch(e){}
  return null;
}

function fail(message){$('loading').classList.add('hidden');$('error').textContent=message;$('error').classList.remove('hidden')}

onAuthStateChanged(auth,async user=>{
  if(!user){ fail('يجب تسجيل الدخول أولاً لعرض الشرح.'); return; }
  if(!id){ fail('معرّف الشرح غير موجود.'); return; }
  try{
    const snap=await getDoc(doc(db,'materials',id));
    if(!snap.exists()){fail('الشرح غير موجود أو تم حذفه.');return;}
    const m=snap.data();
    document.title=m.title||'الشرح';$('materialId').textContent=`ID: ${id}`;
    $('title').textContent=m.title||'بدون عنوان';
    $('meta').textContent=`${m.subject||'غير محدد'} • ${m.teacherName||'غير محدد'}`;
    $('description').textContent=m.description||'';
    $('typeBadge').textContent=m.type==='video'?'فيديو YouTube':'شرح مكتوب';

    const vid=youtubeId(m.url||'');
    if(vid){
      $('video').src=`https://www.youtube.com/embed/${encodeURIComponent(vid)}`;
      $('videoSection').classList.remove('hidden');
    }
    if(m.content){
      $('content').textContent=m.content;
      $('textSection').classList.remove('hidden');
    }
    if(!vid&&!m.content) $('emptyContent').classList.remove('hidden');

    $('loading').classList.add('hidden');$('lesson').classList.remove('hidden');
  }catch(e){console.error(e);fail('حدث خطأ أثناء تحميل الشرح.');}
});
