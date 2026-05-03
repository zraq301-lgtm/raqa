import axios from 'axios';

export default async function handler(req, res) {
  // 1. وظيفة التحقق (GET) لفيسبوك
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // التحقق من تطابق كلمة السر مع ما وضعته في إعدادات فيسبوك
    if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Forbidden');
  }

  // 2. وظيفة استقبال البيانات (POST) القادمة من GitHub Actions
  if (req.method === 'POST') {
    try {
      const authHeader = req.headers['authorization'];
      
      // التحقق من أمان الطلب القادم من GitHub
      if (authHeader !== `Bearer ${process.env.AGENT_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { comments } = req.body;
      if (!comments || !Array.isArray(comments)) {
        return res.status(400).json({ error: 'No comments provided' });
      }

      const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;

      for (const comment of comments) {
        const text = comment.message ? comment.message.toLowerCase() : '';
        const commentId = comment.id;
        const userId = comment.from ? comment.from.id : null;

        // التحقق من الكلمات المفتاحية للتعليق
        if (commentId && userId && (text.includes('مهتم') || text.includes('تم') || text.includes('تفاصيل'))) {
          
          // استدعاء Groq AI لصياغة الردود
          const groqResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: 'llama-3.3-70b-versatile',
              messages: [
                { 
                  role: 'system', 
                  content: 'أنت مساعد تسويقي لصفحة "الرقة". قم بصياغة ردين بالعامية المصرية المهذبة: 1. رد على التعليق يؤكد إرسال التفاصيل على الخاص. 2. رسالة خاصة ودودة تمهد لروابط صفحة الهبوط. افصل بين الردين بكلمة [SEPARATOR]' 
                },
                { role: 'user', content: 'العميل علق بكلمة تدل على الاهتمام، اكتب الردين الآن.' }
              ],
              temperature: 0.7
            },
            {
              headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const aiOutput = groqResponse.data.choices[0].message.content;
          const [commentReply, privateReply] = aiOutput.split('[SEPARATOR]').map(s => s.trim());

          // المرحلة الأولى: الرد على التعليق العام
          await axios.post(`https://graph.facebook.com/v20.0/${commentId}/comments`, {
            message: commentReply || 'أهلاً بك! تم إرسال التفاصيل والروابط في رسالة خاصة.',
            access_token: pageAccessToken
          });

          // المرحلة الثانية: إرسال الرسالة الخاصة
          const finalPrivateMessage = `${privateReply || 'أهلاً بك، يسعدنا اهتمامك.'}\n\n تفضل رابط صفحة الهبوط للاطلاع على كافة التفاصيل:\n ${process.env.LANDING_PAGE_URL}`;
          
          await axios.post(`https://graph.facebook.com/v20.0/me/messages?access_token=${pageAccessToken}`, {
            recipient: { id: userId },
            message: { text: finalPrivateMessage }
          });

          // تأخير بسيط لحماية الصفحة
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      return res.status(200).json({ success: true, message: 'Replies sent successfully' });

    } catch (error) {
      console.error('Error in agent API:', error.response ? error.response.data : error.message);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // لأي نوع طلب آخر
  return res.status(405).send('Method Not Allowed');
}
