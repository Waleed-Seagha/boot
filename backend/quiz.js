const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { logger } = require('./errorHandler');

function createQuiz(user_id, lecture, questions, sender_name, cb) {
  const quiz_id = uuidv4();
  db.addQuiz(quiz_id, user_id, lecture, sender_name, (err) => {
    if (err) return cb(err);
    let done = 0;
    questions.forEach((q, i) => {
      db.addQuestion(quiz_id, q.question, q.options, q.answer, q.explanation, (err2) => {
        if (err2) {
          logger.error('خطأ عند إضافة سؤال', err2, { 
            quiz_id, 
            questionIndex: i, 
            question: q.question 
          });
        } else {
          logger.info(`تمت إضافة سؤال (${i + 1}/${questions.length}) للـ quiz`, { quiz_id });
        }
        if (++done === questions.length) {
          logger.info('تم الانتهاء من إضافة جميع الأسئلة للـ quiz', { quiz_id });
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
    // نقاط الضعف: قائمة بعناوين الأسئلة فقط بدون شرح
    let weaknesses = '';
    if (mistakes.length) {
      weaknesses = 'ننصحك بمراجعة الأسئلة التالية:\n' + mistakes.map((m, idx) => `${idx + 1}- ${m.question}`).join('\n');
    }
    db.addResult(quiz_id, user_answers, score, weaknesses, (err2) => {
      cb(null, { score, total: questions.length, mistakes, weaknesses });
    });
  });
}

module.exports = { createQuiz, correctQuiz }; 