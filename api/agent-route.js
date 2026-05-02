import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req) {
  try {
    // 1. التحقق من أمان الطلب (هل هو قادم من GitHub Actions الخاص بك؟)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.AGENT_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { comments } = await req.json();

    if (!comments || !Array.isArray(comments)) {
      return NextResponse.json({ error: 'No comments provided' }, { status: 400 });
    }

    // 2. روابطك الثابتة التي تريد إرسالها
    const landingPageUrl = 'https://your-landing-page.vercel.app';
    const facebookPageUrl = 'https://facebook.com/YourPageName';

    // 3. معالجة كل تعليق
    for (const comment of comments) {
      const text = comment.message ? comment.message.toLowerCase() : '';
      const userId = comment.from ? comment.from.id : null; // معرف العميل على فيسبوك

      // التأكد من أن التعليق يحتوي على الكلمات المفتاحية
      if (userId && (text.includes('مهتم') || text.includes('تم') || text.includes('تفاصيل'))) {
        
        // 4. استدعاء Groq AI لصياغة رسالة ترحيبية فريدة
        const groqResponse = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile', // نموذج قوي وسريع جداً على جروق
            messages: [
              {
                role: 'system',
                content: 'أنت مساعد تسويقي ذكي. اكتب رسالة ترحيبية قصيرة جداً ومميزة للعميل الذي أبدى اهتمامه بمنتجنا. لا تذكر روابط في ردك، فقط رحب به بأسلوب جذاب وودود.'
              },
              {
                role: 'user',
                content: 'العميل علق بمهتم، اكتب له رسالة ترحيبية قصيرة.'
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

        // نص الرسالة المولدة من الذكاء الاصطناعي
        const aiMessage = groqResponse.data.choices[0].message.content;

        // دمج الرسالة مع الروابط الخاصة بك
        const finalMessage = `${aiMessage}\n\n تفضل رابط صفحة الهبوط للاطلاع على كافة التفاصيل:\n ${landingPageUrl}\n\n ويسعدنا متابعتك لصفحتنا الرسمية على فيسبوك من هنا:\n ${facebookPageUrl}`;

        // 5. إرسال الرسالة إلى العميل عبر Messenger API
        await axios.post(
          `https://graph.facebook.com/v20.0/me/messages?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`,
          {
            recipient: { id: userId },
            message: { text: finalMessage }
          }
        );

        // تأخير بسيط (ثانية واحدة) لتجنب حظر الفيسبوك عند إرسال رسائل متعددة
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({ success: true, message: 'Processed successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error in agent API:', error.response ? error.response.data : error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
