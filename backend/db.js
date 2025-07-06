const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { dbErrorHandler } = require('./errorHandler');

const db = new sqlite3.Database(path.join(__dirname, 'data.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE,
    name TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    lecture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT,
    question TEXT,
    options TEXT,
    answer INTEGER,
    explanation TEXT,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT,
    user_answers TEXT,
    score INTEGER,
    weaknesses TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
  )`);
});

module.exports = {
  db,
  addUser: (telegram_id, name, cb) => {
    db.run('INSERT OR IGNORE INTO users (telegram_id, name) VALUES (?, ?)', [telegram_id, name], cb);
  },
  getUser: (telegram_id, cb) => {
    db.get('SELECT * FROM users WHERE telegram_id = ?', [telegram_id], cb);
  },
  addQuiz: (quiz_id, user_id, lecture, cb) => {
    db.run('INSERT INTO quizzes (id, user_id, lecture) VALUES (?, ?, ?)', [quiz_id, user_id, lecture], cb);
  },
  getQuiz: (quiz_id, cb) => {
    db.get('SELECT * FROM quizzes WHERE id = ?', [quiz_id], cb);
  },
  addQuestion: (quiz_id, question, options, answer, explanation, cb) => {
    db.run('INSERT INTO questions (quiz_id, question, options, answer, explanation) VALUES (?, ?, ?, ?, ?)', [quiz_id, question, JSON.stringify(options), answer, explanation], cb);
  },
  getQuestions: (quiz_id, cb) => {
    if (!quiz_id) {
      return cb(new Error('معرف الاختبار مطلوب'));
    }
    
    db.all('SELECT * FROM questions WHERE quiz_id = ?', [quiz_id], (err, rows) => {
      if (err) {
        dbErrorHandler(err, 'getQuestions', { quiz_id });
        return cb(err);
      }
      
      try {
        if (rows && rows.length > 0) {
          rows.forEach(q => {
            if (q.options) {
              q.options = JSON.parse(q.options);
            }
          });
        }
        cb(null, rows || []);
      } catch (parseError) {
        dbErrorHandler(parseError, 'parseQuestions', { quiz_id });
        cb(new Error('خطأ في تحليل بيانات الأسئلة'));
      }
    });
  },
  addResult: (quiz_id, user_answers, score, weaknesses, cb) => {
    db.run('INSERT INTO results (quiz_id, user_answers, score, weaknesses) VALUES (?, ?, ?, ?)', [quiz_id, JSON.stringify(user_answers), score, weaknesses], cb);
  },
  getResult: (quiz_id, cb) => {
    db.get('SELECT * FROM results WHERE quiz_id = ?', [quiz_id], (err, row) => {
      if (err) return cb(err);
      if (row) row.user_answers = JSON.parse(row.user_answers);
      cb(null, row);
    });
  }
}; 