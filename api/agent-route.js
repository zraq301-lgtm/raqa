import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req) {
  try {
    // 1. التحقق من أمان الطلب القادم من GitHub Actions
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.AGENT_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { comments } = await req.json();

    if (!comments || !Array.isArray(comments)) {
      return NextResponse.json({ error: 'No comments provided' }, { status: 400 });
    }

    const landingPageUrl = 'https://your-landing-page.vercel.app';
    const facebookPageUrl = 'https://facebook.com/YourPageName';
    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    // 2. معالجة كل تعليق قادم
    for (const comment of comments) {
      const text = comment.message ? comment.message.toLowerCase() : '';
      const commentId = comment.id; // معرف التعليق للرد عليه مباشرة
      const userId = comment.from ? comment.from.id : null; // معرف الشخص

      // التأكد من الكلمات المفتاحية
      if (commentId && userId && (text.includes('مهتم') || text.includes('تم') || text.includes('تفاصيل'))) {
        
        // ----------------------------------------------------
        // المرحلة الأولى: استدعاء Groq AI لصياغة رد التعليق والرسالة الخاصة
        // ----------------------------------------------------
        const groqResponse = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `أنت مساعد تسويقي محترف. قم بصياغة نصين باللغة العربية الفصحى أو العامية المصرية المهذبة:
                1. النص الأول (للرد على التعليق): رسالة ترحيبية قصيرة جداً تؤكد له أنك أرسلت التفاصيل والروابط على حسابه الخاص (ماسنجر).
                2. النص الثاني (للرسالة الخاصة): رسالة ترحيبية ودودة تمهد لروابط صفحة الهبوط والفيسبوك.
                افصل بين النصين بكلمة [SEPARATOR]`
              },
              {
                role: 'user',
                content: 'العميل علق بمهتم، اكتب الردين الآن.'
              }
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

        // تقسيم النتيجة المرجعة من Groq إلى رد التعليق ورد الخاص
        const aiOutput = groqResponse.data.choices[0].message.content;
        const [commentReply, privateReply] = aiOutput.split('[SEPARATOR]').map(s => s.trim());

        // ----------------------------------------------------
        // المرحلة الثانية: الرد على العميل في التعليقات العامة
        // ----------------------------------------------------
        await axios.post(
          `https://graph.facebook.com/v20.0/${commentId}/comments`,
          {
            message: commentReply || 'أهلاً بك! تم إرسال كافة التفاصيل والروابط في رسالة خاصة على حسابك. تفقد صندوق الرسائل لديك.',
            access_token: pageAccessToken
          }
        );

        // ----------------------------------------------------
        // المرحلة الثالثة: إرسال الرسالة الخاصة متضمنة الروابط
        // ----------------------------------------------------
        const finalPrivateMessage = `${privateReply || 'أهلاً بك، يسعدنا اهتمامك.'}\n\n تفضل رابط صفحة الهبوط للاطلاع على كافة التفاصيل:\n ${landingPageUrl}\n\n ويسعدنا متابعتك لصفحتنا الرسمية على فيسبوك من هنا:\n ${facebookPageUrl}`;

        await axios.post(
          `https://graph.facebook.com/v20.0/me/messages?access_token=${pageAccessToken}`,
          {
            recipient: { id: userId },
            message: { text: finalPrivateMessage }
          }
        );

        // تأخير عشوائي بسيط (بين 1 إلى 3 ثوانٍ) لحماية حسابك من خوارزميات الـ Spam
        const delay = Math.floor(Math.random() * 2000) + 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return NextResponse.json({ success: true, message: 'Replies and Messages sent successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error in agent API:', error.response ? error.response.data : error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
