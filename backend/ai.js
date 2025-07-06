const axios = require('axios');
require('dotenv').config();
const { aiErrorHandler } = require('./errorHandler');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openrouter/cypher-alpha:free'; // موديل مجاني متاح في OpenRouter غالباً

async function summarizeSyrian(lecture) {
  const prompt = `لخّص لي النص التالي باللهجة السورية، مع الحفاظ على الأفكار الأساسية، واجعله سهل الفهم للطلاب:\n\n${lecture}`;
  try {
    const res = await axios.post(OPENROUTER_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: 'أنت مساعد ذكي تلخّص باللهجة السورية.' },
        { role: 'user', content: prompt }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return res.data.choices[0].message.content.trim();
  } catch (e) {
    if (e.response) {
      console.error('OpenRouter API Error:', {
        status: e.response.status,
        data: e.response.data,
        headers: e.response.headers
      });
    } else {
      console.error('OpenRouter Error:', e.message);
    }
    throw e;
  }
}

async function generateQuiz(lecture) {
  if (!lecture || typeof lecture !== 'string' || lecture.trim().length < 10) {
    throw new Error('النص المقدم قصير جداً أو غير صالح');
  }

  if (!OPENROUTER_API_KEY) {
    throw new Error('مفتاح API للذكاء الاصطناعي غير متوفر');
  }

  const prompt = `أنشئ لي اختبارًا من 20 سؤال اختيار من متعدد (مع 4 خيارات لكل سؤال) بناءً فقط على النص التالي (المحاضرة). أجبني فقط بصيغة JSON Array كالتالي بدون أي شرح أو نص خارجي:\n[{\"question\":\"...\",\"options\":[\"...\",...],\"answer\":0,\"explanation\":\"...\"}, ...] حيث answer هو رقم الخيار الصحيح (0-3) وexplanation شرح مختصر للإجابة الصحيحة باللهجة السورية.\nالمحاضرة:\n${lecture}`;
  
  try {
    const res = await axios.post(OPENROUTER_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: 'أنت مساعد ذكي تنشئ اختبارات تعليمية وتلتزم بإخراج JSON فقط.' },
        { role: 'user', content: prompt }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // timeout 30 ثانية
    });

    if (!res.data || !res.data.choices || !res.data.choices[0] || !res.data.choices[0].message) {
      throw new Error('رد غير صالح من خدمة الذكاء الاصطناعي');
    }

    const text = res.data.choices[0].message.content;
    console.log('رد الذكاء الاصطناعي (للاختبار):', text);
    
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']') + 1;
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('رد الذكاء الاصطناعي غير متوقع:', text);
      throw new Error('فشل في العثور على JSON في رد الذكاء الاصطناعي.');
    }
    
    let questions = [];
    try {
      questions = JSON.parse(text.slice(jsonStart, jsonEnd));
    } catch (e) {
      console.error('فشل في تحويل الرد إلى JSON:', text.slice(jsonStart, jsonEnd));
      throw new Error('فشل في استخراج الأسئلة من رد الذكاء الاصطناعي.');
    }

    // التحقق من صحة البيانات
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('لم يتم توليد أسئلة صحيحة');
    }

    // التحقق من كل سؤال
    questions.forEach((q, index) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
          typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) {
        throw new Error(`السؤال رقم ${index + 1} غير صالح`);
      }
    });

    return questions;
  } catch (error) {
    aiErrorHandler(error, 'generateQuiz', { lectureLength: lecture.length });
    
    if (error.response) {
      throw new Error(`خطأ في خدمة الذكاء الاصطناعي: ${error.response.status}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي');
    } else {
      throw error;
    }
  }
}

module.exports = { summarizeSyrian, generateQuiz }; 