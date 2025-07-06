// معالج الأخطاء المركزي
const logger = {
  error: (message, error = null, context = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'ERROR',
      message,
      context,
      stack: error ? error.stack : null
    };
    
    console.error('🔴 خطأ:', JSON.stringify(logEntry, null, 2));
    
    // يمكن إضافة إرسال الأخطاء إلى خدمة خارجية هنا
    // مثل Sentry أو LogRocket
  },
  
  warn: (message, context = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'WARN',
      message,
      context
    };
    
    console.warn('🟡 تحذير:', JSON.stringify(logEntry, null, 2));
  },
  
  info: (message, context = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'INFO',
      message,
      context
    };
    
    console.log('🔵 معلومات:', JSON.stringify(logEntry, null, 2));
  }
};

// معالج الأخطاء للـ Express
const errorMiddleware = (err, req, res, next) => {
  logger.error('خطأ في Express', err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // لا تكشف تفاصيل الخطأ للمستخدم في الإنتاج
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment ? err.message : 'خطأ داخلي في الخادم';
  
  res.status(err.status || 500).json({
    error: errorMessage,
    ...(isDevelopment && { stack: err.stack })
  });
};

// معالج الأخطاء للبوت
const botErrorHandler = (error, chatId = null) => {
  logger.error('خطأ في بوت تيليجرام', error, { chatId });
  
  // إرسال رسالة خطأ للمستخدم إذا كان لدينا chatId
  if (chatId && global.bot) {
    try {
      global.bot.sendMessage(chatId, 'عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
    } catch (sendError) {
      logger.error('فشل في إرسال رسالة خطأ للمستخدم', sendError, { chatId });
    }
  }
};

// معالج الأخطاء لقاعدة البيانات
const dbErrorHandler = (error, operation, context = {}) => {
  logger.error(`خطأ في قاعدة البيانات - ${operation}`, error, context);
  
  // يمكن إضافة إعادة المحاولة أو fallback هنا
  if (error.code === 'SQLITE_BUSY') {
    logger.warn('قاعدة البيانات مشغولة، يمكن إعادة المحاولة', { operation });
  }
};

// معالج الأخطاء للذكاء الاصطناعي
const aiErrorHandler = (error, operation, context = {}) => {
  logger.error(`خطأ في الذكاء الاصطناعي - ${operation}`, error, context);
  
  // تصنيف الأخطاء
  if (error.response) {
    logger.error('خطأ في API', {
      status: error.response.status,
      data: error.response.data,
      operation
    });
  } else if (error.code === 'ECONNABORTED') {
    logger.error('انتهت مهلة الاتصال', { operation });
  } else if (error.code === 'ENOTFOUND') {
    logger.error('فشل في حل اسم المضيف', { operation });
  }
};

// معالج الأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
  logger.error('استثناء غير معالج', error);
  // في الإنتاج، قد تريد إغلاق التطبيق بشكل آمن
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('وعد مرفوض غير معالج', reason, { promise });
});

module.exports = {
  logger,
  errorMiddleware,
  botErrorHandler,
  dbErrorHandler,
  aiErrorHandler
}; 