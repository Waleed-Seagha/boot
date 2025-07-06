const { v4: uuidv4 } = require('uuid');
const db = require('./db');

function createQuiz(user_id, lecture, questions, cb) {
  const quiz_id = uuidv4();
  db.addQuiz(quiz_id, user_id, lecture, (err) => {
    if (err) return cb(err);
    let done = 0;
    questions.forEach((q, i) => {
      db.addQuestion(quiz_id, q.question, q.options, q.answer, q.explanation, (err2) => {
        if (err2) {
          console.error('خطأ عند إضافة سؤال:', q.question, err2);
        } else {
          console.log(`تمت إضافة سؤال (${i + 1}/${questions.length}) للـ quiz:`, quiz_id);
        }
        if (++done === questions.length) {
          console.log('تم الانتهاء من إضافة جميع الأسئلة للـ quiz:', quiz_id);
          cb(null, quiz_id);
        }
      });
    });
  });
}

function correctQuiz(quiz_id, user_answers, cb) {
  db.getQuestions(quiz_id, (err, questions) => {
    if (err) return cb(err);
    let score = 0;
    let mistakes = [];
    questions.forEach((q, i) => {
      if (user_answers[i] == q.answer) score++;
      else mistakes.push({
        question: q.question,
        correct: q.options[q.answer],
        your: q.options[user_answers[i]],
        explanation: q.explanation
      });
    });
    // نقاط الضعف: جمل توجيهية لكل سؤال أخطأ فيه المستخدم
    let weaknesses = mistakes.map(
      m => `ننصحك بمراجعة هذا السؤال: "${m.question}"
الشرح: ${m.explanation || 'راجع الإجابة الصحيحة.'}`
    ).join('\n\n');
    db.addResult(quiz_id, user_answers, score, weaknesses, (err2) => {
      cb(null, { score, total: questions.length, mistakes, weaknesses });
    });
  });
}

module.exports = { createQuiz, correctQuiz }; 