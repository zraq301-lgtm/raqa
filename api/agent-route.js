import { NextResponse } from 'next/server';
import axios from 'axios';

// 1. وظيفة التحقق (التي يحتاجها فيسبوك عند الربط لأول مرة)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // هنا نستخدم رمز التحقق الذي وضعته في إعدادات فيسبوك
  if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// 2. وظيفة استقبال البيانات (التي تعمل مع GitHub Actions)
export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    
    // التحقق من كلمة السر الخاصة بك (AGENT_SECRET)
    if (authHeader !== `Bearer ${process.env.AGENT_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { comments } = await req.json();
    if (!comments || !Array.isArray(comments)) {
      return NextResponse.json({ error: 'No comments provided' }, { status: 400 });
    }

    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    for (const comment of comments) {
      const text = comment.message ? comment.message.toLowerCase() : '';
      const commentId = comment.id;
      const userId = comment.from ? comment.from.id : null;

      if (commentId && userId && (text.includes('مهتم') || text.includes('تم') || text.includes('تفاصيل'))) {
        
        // استدعاء Groq AI
        const groqResponse = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'أنت مساعد تسويقي لصفحة "الرقة". قم بصياغة ردين: 1. رد على التعليق. 2. رسالة خاصة. افصل بينهما بـ [SEPARATOR]' },
              { role: 'user', content: 'العميل علق بكلمة تدل على الاهتمام، اكتب الردين الآن.' }
            ],
            temperature: 0.7
          },
          { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` } }
        );

        const aiOutput = groqResponse.data.choices[0].message.content;
        const [commentReply, privateReply] = aiOutput.split('[SEPARATOR]').map(s => s.trim());

        // الرد العام
        await axios.post(`https://graph.facebook.com/v20.0/${commentId}/comments`, {
          message: commentReply,
          access_token: pageAccessToken
        });

        // الرد الخاص
        const finalPrivateMessage = `${privateReply}\n\n تفضل الرابط:\n ${process.env.LANDING_PAGE_URL}`;
        await axios.post(`https://graph.facebook.com/v20.0/me/messages?access_token=${pageAccessToken}`, {
          recipient: { id: userId },
          message: { text: finalPrivateMessage }
        });

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
