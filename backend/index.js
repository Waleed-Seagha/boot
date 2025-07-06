require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const { summarizeSyrian, generateQuiz } = require('./ai');
const db = require('./db');
const { createQuiz, correctQuiz } = require('./quiz');
const path = require('path');
const pdfParse = require('pdf-parse');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('خطأ: لم يتم تعريف TELEGRAM_BOT_TOKEN في ملف .env');
  process.exit(1);
}

console.log('جاري تهيئة بوت تيليجرام...');
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

bot.on('polling_error', (error) => {
  console.error('خطأ في الاتصال مع تيليجرام:', error);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
});

bot.on('error', (error) => {
  console.error('خطأ في البوت:', error);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
});

console.log('تم تهيئة البوت بنجاح!');

// إرسال رسالة ترحيبية تلقائياً عند تشغيل البوت
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // يمكنك وضع رقمك هنا أو في ملف .env
if (ADMIN_CHAT_ID) {
  bot.sendMessage(ADMIN_CHAT_ID, '👋 تم تشغيل البوت بنجاح! جاهز لاستقبال المحاضرات.');
} else {
  console.log('ملاحظة: يمكنك تعيين ADMIN_CHAT_ID في ملف .env لإرسال رسالة ترحيبية تلقائياً عند تشغيل البوت.');
}

// تخزين مؤقت لحالة كل مستخدم (ينتظر تأكيد، نص PDF أو نص المحاضرة)
const userStates = {};

// استقبال المحاضرة من المستخدم
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || '';
  // معالجة رسالة /start
  if (msg.text === '/start') {
    console.log(`مستخدم جديد: ${name} (${chatId})`);
    db.addUser(chatId, name, () => {});
    userStates[chatId] = { awaitingConfirmation: false };
    bot.sendMessage(chatId, 'مرحباً! أرسل لي المحاضرة التي تريد إنشاء اختبار مؤتمت منها (نص أو ملف PDF).');
    return;
  }
  // إذا كان المستخدم ينتظر التأكيد
  if (userStates[chatId]?.awaitingConfirmation) {
    if (msg.text && msg.text.includes('اختبار')) {
      bot.sendMessage(chatId, 'جاري إنشاء الاختبار المؤتمت...');
      try {
        db.getUser(chatId, async (err, user) => {
          const sourceText = userStates[chatId].pdfText || userStates[chatId].lectureText;
          const questions = await generateQuiz(sourceText);
          createQuiz(user.id, sourceText, questions, (err2, quiz_id) => {
            delete userStates[chatId];
            if (err2) return bot.sendMessage(chatId, 'خطأ بإنشاء الاختبار.');
            const link = `${BASE_URL}/?quiz=${quiz_id}`;
            bot.sendMessage(chatId, `هي رابط اختبارك الخاص:\n${link}`);
          });
        });
      } catch (e) {
        console.error('خطأ في إنشاء الاختبار:', e.message);
        bot.sendMessage(chatId, 'حدث خطأ أثناء إنشاء الاختبار.');
        delete userStates[chatId];
      }
    } else {
      delete userStates[chatId];
      bot.sendMessage(chatId, 'تم إلغاء العملية. أرسل المحاضرة من جديد إذا أردت إنشاء اختبار.');
    }
    return;
  }
  // دعم استقبال ملف PDF
  if (msg.document && msg.document.mime_type === 'application/pdf') {
    db.addUser(chatId, name, () => {});
    bot.sendMessage(chatId, 'جاري معالجة ملف PDF...');
    try {
      const fileLink = await bot.getFileLink(msg.document.file_id);
      const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      const data = await pdfParse(buffer);
      const pdfText = data.text;
      if (!pdfText || pdfText.trim().length < 20) {
        return bot.sendMessage(chatId, 'عذراً، لم أستطع استخراج نص كافٍ من ملف PDF.');
      }
      // خزّن النص وحالة التأكيد لهذا المستخدم
      userStates[chatId] = { awaitingConfirmation: true, pdfText };
      bot.sendMessage(chatId, 'تم استخراج النص من ملف PDF. هل تريد إنشاء اختبار مؤتمت من هذا الملف؟', {
        reply_markup: {
          keyboard: [[{ text: '🔹 إنشاء اختبار مؤتمت' }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
    } catch (e) {
      console.error('خطأ في معالجة PDF:', e.message);
      bot.sendMessage(chatId, 'حدث خطأ أثناء معالجة ملف PDF. تأكد أن الملف صالح ويحتوي نصاً واضحاً.');
    }
    return;
  }
  // استقبال نص المحاضرة
  if (!msg.text || msg.text.startsWith('/')) {
    console.log('تجاهل الرسالة (أمر أو فارغة)');
    return;
  }
  db.addUser(chatId, name, () => {});
  userStates[chatId] = { awaitingConfirmation: true, lectureText: msg.text };
  bot.sendMessage(chatId, 'هل تريد إنشاء اختبار مؤتمت من هذه المحاضرة؟', {
    reply_markup: {
      keyboard: [[{ text: '🔹 إنشاء اختبار مؤتمت' }]],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });
});

// API: جلب أسئلة الاختبار
app.get('/api/quiz', (req, res) => {
  const quiz_id = req.query.quiz;
  db.getQuestions(quiz_id, (err, questions) => {
    if (err || !questions.length) return res.status(404).json({ error: 'اختبار غير موجود' });
    res.json({ questions: questions.map(q => ({ question: q.question, options: q.options })) });
  });
});

// API: تصحيح الاختبار
app.post('/api/quiz', (req, res) => {
  const { quiz, answers } = req.body;
  correctQuiz(quiz, answers, (err, result) => {
    if (err) return res.status(500).json({ error: 'خطأ في التصحيح' });
    res.json(result);
  });
});

// يجب أن يكون هذا في النهاية بعد كل الراوتات الأخرى
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
}); 