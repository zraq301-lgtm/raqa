// api/chatController.js

export default async function handler(req, res) {
  // إعدادات CORS للسماح بالطلب من أي نطاق
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // عند فتح الرابط من المتصفح مباشرة للاختبار
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'online', 
      message: 'Sondss AI Service is active. Send a POST request to interact with AI.' 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message, storeData } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: 'الرسالة مطلوبة (message parameter missing)' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured on Vercel' });
  }

  const contextSummary = storeData ? `
بيانات الحركة الحالية:
- عدد المنتجات: ${storeData.productCount ?? 0}
- قيمة المخزون: ${storeData.inventoryValue ?? 0}
- النواقص: ${storeData.lowStock ?? 0}
- المبيعات: ${storeData.totalRevenue ?? 0}
- المشتريات: ${storeData.totalPurchases ?? 0}
` : 'لا توجد بيانات ممررة حالياً.';

  const systemPrompt = `
أنت مساعد ذكاء اصطناعي خبير لإدارة المحلات والمخازن والفواتير.
حلل البيانات وقدم إجابات عملية ومختصرة باللغة العربية.
بيانات النظام:
${contextSummary}
`;

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (!groqResponse.ok) {
      const errData = await groqResponse.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Groq Status: ${groqResponse.status}`);
    }

    const data = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content || 'لم يتم استلام إجابة.';

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({
      error: 'فشل معالجة الطلب',
      details: error.message
    });
  }
}
