// واجهة اختبار احترافية

// 1. استخراج باراميتر quiz من الرابط
function getQuizId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('quiz');
}

// 2. عناصر الواجهة
const quizBox = document.getElementById('quiz-box');
const statusDiv = document.getElementById('status');
const quizForm = document.getElementById('quiz-form');
const questionsArea = document.getElementById('questions-area');
const submitBtn = document.getElementById('submit-btn');
const resultBox = document.getElementById('result-box');

// 3. حالة تحميل
function showLoading(msg = 'جاري التحميل...') {
  if (statusDiv) statusDiv.innerHTML = `<div class="loading"><span class="loader"></span> ${msg}</div>`;
  if (submitBtn) submitBtn.style.display = 'none';
}

// 4. عرض رسالة خطأ
function showError(msg) {
  if (statusDiv) statusDiv.innerHTML = `<div class="error">${msg}</div>`;
  if (submitBtn) submitBtn.style.display = 'none';
}

// 5. عرض الأسئلة
function renderQuiz(questions) {
  console.log('بدء عرض الأسئلة...');
  quizBox.style.display = 'block';
  resultBox.style.display = 'none';
  if (statusDiv) statusDiv.innerHTML = '';
  if (questionsArea) questionsArea.innerHTML = '';
  try {
    questions.forEach((q, i) => {
      const optionsHtml = q.options.map((opt, j) => `
        <label class="option-label">
          <input type="radio" name="q${i}" value="${j}" required>
          <span>${opt}</span>
        </label>
      `).join('');
      if (questionsArea) questionsArea.innerHTML += `
        <div class="question-card">
          <div class="question-title">${i + 1}. ${q.question}</div>
          <div class="options">${optionsHtml}</div>
        </div>
      `;
    });
    submitBtn.style.display = 'block';
    // حفظ الأسئلة الحالية للاستخدام في التصدير
    window.__currentQuizQuestions = questions;
    console.log('تم عرض الأسئلة في الصفحة.');
  } catch (e) {
    console.error('خطأ أثناء عرض الأسئلة:', e);
    showError('حدث خطأ أثناء عرض الأسئلة. يرجى إعادة تحميل الصفحة أو المحاولة لاحقاً.');
  }
}

// 6. عرض النتيجة
function renderResult(result, senderName) {
  let html = `<div class="score">نتيجتك: <b>${result.score} / ${result.total}</b></div>`;
  if (result.mistakes && result.mistakes.length) {
    html += '<div class="mistakes-title">الأخطاء:</div>';
    result.mistakes.forEach(m => {
      html += `<div class="mistake">
        <div><b>السؤال:</b> ${m.question}</div>
        <div><b>إجابتك:</b> ${m.your}</div>
        <div><b>الصحيح:</b> ${m.correct}</div>
        <div><b>الشرح:</b> ${m.explanation}</div>
      </div>`;
    });
    if (result.weaknesses) {
      html += `<div class="weaknesses">نقاط الضعف: ${result.weaknesses}</div>`;
    }
  } else {
    html += '<div class="success">أحسنت! كل إجاباتك صحيحة 🎉</div>';
  }
  // إضافة اسم المُرسل أسفل النتيجة إذا كان موجودًا
  //if (senderName) {
    //html += `<div style="margin-top:24px; color:#0D9B0A; font-weight:bold; text-align:center; font-size:1.1em;">هذا الاختبار من إعداد الطالب: <span style="color:#12F906;">${senderName}</span></div>`;
 // }
  resultBox.innerHTML = html;
  resultBox.style.display = 'block';
  quizBox.style.display = 'none';
}

// 7. جلب الأسئلة من الباكند
async function fetchQuiz(quizId) {
  showLoading('جاري تحميل الأسئلة...');
  try {
    const res = await fetch(`/api/quiz?quiz=${quizId}`);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = errorData.error || `خطأ في الخادم: ${res.status}`;
      throw new Error(errorMessage);
    }
    
    const data = await res.json();
    console.log('البيانات المستلمة من الباكند:', data);
    
    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('لا توجد أسئلة في هذا الاختبار.');
    }
    
    console.log('عدد الأسئلة:', data.questions.length);
    
    // التحقق من صحة بيانات كل سؤال
    data.questions.forEach((q, i) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length === 0) {
        throw new Error(`السؤال رقم ${i + 1} غير صالح`);
      }
      console.log(`سؤال ${i + 1}:`, q.question);
      console.log('الخيارات:', q.options);
    });
    
    renderQuiz(data.questions);
    // حفظ اسم المُرسل للاستخدام عند عرض النتيجة
    window.__quizSenderName = data.sender_name || '';
  } catch (e) {
    console.error('خطأ أثناء جلب الأسئلة:', e);
    let errorMessage = e.message;
    
    // تحسين رسائل الخطأ للمستخدم
    if (e.name === 'TypeError' && e.message.includes('fetch')) {
      errorMessage = 'فشل في الاتصال بالخادم. تحقق من اتصالك بالإنترنت.';
    } else if (e.message.includes('404')) {
      errorMessage = 'الاختبار غير موجود أو تم حذفه.';
    } else if (e.message.includes('500')) {
      errorMessage = 'خطأ في الخادم. يرجى المحاولة لاحقاً.';
    }
    
    showError(errorMessage);
  }
}

// 8. إرسال الإجابات
quizForm && quizForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // التحقق من أن جميع الأسئلة تمت الإجابة عليها
  const formData = new FormData(quizForm);
  const answeredQuestions = formData.getAll('q0').length; // عدد الأسئلة المجاب عليها
  
  if (answeredQuestions === 0) {
    showError('يرجى الإجابة على جميع الأسئلة قبل الإرسال.');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'جاري التصحيح...';
  
  const quizId = getQuizId();
  const answers = [];
  
  try {
    for (let [name, value] of formData.entries()) {
      const answer = Number(value);
      if (isNaN(answer) || answer < 0) {
        throw new Error('إجابة غير صحيحة في أحد الأسئلة');
      }
      answers.push(answer);
    }
    
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz: quizId, answers })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = errorData.error || `خطأ في التصحيح: ${res.status}`;
      throw new Error(errorMessage);
    }
    
    const data = await res.json();
    
    // التحقق من صحة البيانات المستلمة
    if (!data || typeof data.score !== 'number' || typeof data.total !== 'number') {
      throw new Error('بيانات النتيجة غير صحيحة');
    }
    
    // تمرير اسم المُرسل عند عرض النتيجة
    renderResult(data, window.__quizSenderName);
  } catch (e) {
    console.error('خطأ أثناء إرسال الإجابات:', e);
    let errorMessage = e.message;
    
    // تحسين رسائل الخطأ للمستخدم
    if (e.name === 'TypeError' && e.message.includes('fetch')) {
      errorMessage = 'فشل في الاتصال بالخادم. تحقق من اتصالك بالإنترنت.';
    } else if (e.message.includes('400')) {
      errorMessage = 'بيانات الإجابات غير صحيحة. يرجى المحاولة مرة أخرى.';
    } else if (e.message.includes('500')) {
      errorMessage = 'خطأ في الخادم أثناء التصحيح. يرجى المحاولة لاحقاً.';
    }
    
    showError(errorMessage);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'إرسال الإجابات';
  }
});

// 9. بدء التنفيذ
window.addEventListener('DOMContentLoaded', () => {
  try {
    const quizId = getQuizId();
    if (!quizId) {
      showError('رابط الاختبار غير صحيح.');
      return;
    }
    // تأكد من إظهار عناصر الواجهة عند البدء
    quizBox.style.display = 'block';
    resultBox.style.display = 'none';
    fetchQuiz(quizId);
  } catch (e) {
    console.error('خطأ في بدء التنفيذ:', e);
    showError('حدث خطأ غير متوقع. يرجى إعادة تحميل الصفحة.');
  }
});

// 10. معالجة الأخطاء العامة
window.addEventListener('error', (e) => {
  console.error('خطأ عام في الصفحة:', e.error);
  if (statusDiv) {
    showError('حدث خطأ غير متوقع في الصفحة. يرجى إعادة تحميل الصفحة.');
  }
});

// 11. معالجة أخطاء الشبكة
window.addEventListener('unhandledrejection', (e) => {
  console.error('وعد مرفوض غير معالج:', e.reason);
  if (statusDiv) {
    showError('فشل في الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
  }
});

// 10. تحسينات جمالية (Loader)
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .loading { color: var(--primary-color); font-size: 1.2em; text-align: center; margin: 32px 0; }
    .loader {
      display: inline-block; width: 1.2em; height: 1.2em; border: 3px solid var(--primary-color); border-radius: 50%; border-top: 3px solid transparent; animation: spin 1s linear infinite; vertical-align: middle;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    .error { color: #e55; background: #fff0f0; border: 1px solid #e55; border-radius: var(--border-radius); padding: 16px; margin: 24px 0; text-align: center; }
    .question-card { background: var(--card-bg); box-shadow: var(--box-shadow); border-radius: var(--border-radius); padding: 18px 14px; margin-bottom: 18px; border: 1px solid var(--border-color); transition: var(--transition); }
    .question-title { font-weight: bold; color: var(--secondary-color); margin-bottom: 10px; }
    .option-label { display: flex; align-items: center; gap: 8px; background: #f0fff0; border-radius: var(--border-radius); padding: 8px 12px; margin-bottom: 7px; cursor: pointer; border: 1px solid var(--border-color); transition: var(--transition); }
    .option-label:hover, .option-label input:checked + span { background: linear-gradient(90deg, var(--gradient-start), var(--gradient-end)); color: #fff; }
    .score { font-size: 1.3em; color: var(--primary-color); margin-bottom: 18px; text-align: center; }
    .mistakes-title { color: #e55; font-weight: bold; margin-bottom: 8px; }
    .mistake { background: #fff0f0; border-right: 4px solid #e55; margin-bottom: 10px; padding: 8px 12px; border-radius: var(--border-radius); }
    .weaknesses { color: #b00; font-weight: bold; margin-top: 12px; }
    .success { color: var(--secondary-color); font-weight: bold; margin-top: 18px; text-align: center; }
    @media (prefers-color-scheme: dark) {
      body, html { background: var(--background-color) !important; color: var(--text-color) !important; }
      .question-card, .mistake { background: var(--card-bg) !important; color: var(--text-color) !important; }
      .option-label { background: #1a2a1a !important; color: var(--text-color) !important; }
      .error { background: #2a1a1a !important; color: #f99; }
    }
  </style>
`);

// --- لوحة تحكم الإدارة ---
function showAdminPage() {
  document.getElementById('quiz-box').style.display = 'none';
  document.getElementById('result-box').style.display = 'none';
  document.getElementById('admin-page').style.display = 'block';
}

function hideAdminPage() {
  document.getElementById('admin-page').style.display = 'none';
}

function fetchAdminStats() {
  fetch('/api/admin/stats')
    .then(res => res.json())
    .then(data => {
      document.getElementById('users-count').textContent = data.usersCount;
      document.getElementById('users-names').textContent = data.usersNames.join(', ');
      document.getElementById('quizzes-count').textContent = data.quizzesCount;
      // رسم مخطط بياني
      if (window.adminChart) window.adminChart.destroy();
      const ctx = document.getElementById('admin-chart').getContext('2d');
      window.adminChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['المستخدمون', 'الاختبارات'],
          datasets: [{
            label: 'إحصائيات',
            data: [data.usersCount, data.quizzesCount],
            backgroundColor: ['#12F906', '#0D9B0A']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    })
    .catch(err => {
      document.getElementById('admin-error').textContent = 'فشل في جلب الإحصائيات.';
    });
}

// معالجة الدخول للوحة الإدارة
const adminLoginForm = document.getElementById('admin-login-form');
if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-password').value;
    if (pass === 'w1') {
      document.getElementById('admin-login-form').style.display = 'none';
      document.getElementById('admin-stats').style.display = 'block';
      fetchAdminStats();
    } else {
      document.getElementById('admin-error').textContent = 'كلمة المرور غير صحيحة!';
    }
  });
}

// إظهار صفحة الإدارة إذا كان الرابط يحتوي ?admin
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('admin')) {
    showAdminPage();
  }
}); 