// api/webhook.js

export default async function handler(req, res) {
  // 1. تفعيل الـ Webhook (عندما يتحقق فيسبوك من الرابط)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // كلمة السر التي ستخترعها وتضعها في إعدادات فيسبوك وفي الـ Secrets
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'my_secret_bot_123';

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
      } else {
        return res.status(403).send('Forbidden');
      }
    }
  }

  // 2. استقبال الأحداث والتعليقات من فيسبوك
  if (req.method === 'POST') {
    const data = req.body;

    // التأكد أن الإشعار قادم من صفحة فيسبوك
    if (data.object === 'page') {
      data.entry.forEach(function(entry) {
        // هنا نستقبل التغييرات (مثل التعليقات أو الرسائل)
        if (entry.changes) {
          entry.changes.forEach(function(change) {
            if (change.field === 'feed') {
              const value = change.value;
              console.log('تم استقبال تعليق جديد:', value);
              
              // هنا نضع كود الذكاء الاصطناعي للرد على التعليق
            }
          });
        }
      });

      // إخبار فيسبوك بأننا استلمنا البيانات بنجاح
      return res.status(200).send('EVENT_RECEIVED');
    } else {
      return res.status(404).send('Not Found');
    }
  }

  res.status(405).send('Method Not Allowed');
}
