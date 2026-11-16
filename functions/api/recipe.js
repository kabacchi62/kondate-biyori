export async function onRequestPost({ request, env }) {
  try {
    if (!env.GEMINI_API_KEY) return Response.json({error:'Gemini APIキーが未設定です'}, {status:500});
    const body = await request.json();
    const dishName = String(body?.dishName || '').trim();
    if (!dishName || dishName.length > 80) return Response.json({error:'料理名を確認してください'}, {status:400});
    const prompt = `料理「${dishName}」の家庭向けの簡単な日本語レシピを1つ作ってください。必ずJSONオブジェクトのみで回答。構造は {"minutes":30,"baseServings":2,"ingredients":[{"name":"じゃがいも","amount":2,"unit":"個"}],"steps":["手順1","手順2"]}。材料は4〜12品、手順は3〜7個。amountは数値、unitは単位（適量ならamount:0,unit:"適量"）。基本は2人分。料理名が不明瞭な場合も無理のない提案にしてください。食品の十分な加熱に注意してください。`;
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`, {
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.4,maxOutputTokens:1800}})
    });
    if (!upstream.ok) {   const detail = await upstream.text();   console.error('Gemini API error:', upstream.status, detail);   return Response.json({     error: 'AIサービスでエラーが発生しました（' + upstream.status + '）'   }, { status: 502 }); }
    const raw=await upstream.json();
    const text=raw.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('');
    if (!text) throw Error('Empty model response');
    const data=JSON.parse(text);
    if (!Array.isArray(data.ingredients)||!Array.isArray(data.steps)||data.ingredients.length>20||data.steps.length>15)throw Error('Invalid recipe');
    const cleaned={minutes:Math.max(1,Math.min(240,Number(data.minutes)||30)),baseServings:Math.max(1,Math.min(12,Number(data.baseServings)||2)),ingredients:data.ingredients.map(x=>({name:String(x.name||'').slice(0,80),amount:Math.max(0,Number(x.amount)||0),unit:String(x.unit||'').slice(0,20)})).filter(x=>x.name),steps:data.steps.map(x=>String(x).slice(0,400)).filter(Boolean)};
    return Response.json(cleaned,{headers:{'Cache-Control':'no-store'}});
  } catch(e) {console.error(e);return Response.json({error:'レシピを生成できませんでした'}, {status:500});}
}
