import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   TokkuPro — MERGED APP + Supabase (via fetch REST API)
   ไม่ใช้ library — ใช้ fetch() ตรงๆ ทำงานได้ทุก environment
   ============================================================ */

/* ---- Supabase Config ---- */
const SB_URL = "https://xohpbosvfykggtzpigzo.supabase.co";
const SB_KEY = "sb_publishable_pX8_WeCDdh5WPKbxispsBA_XQT8DNkL";
const SB_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Prefer": "return=representation",
};

/* ---- Supabase REST helpers ---- */
const sbUrl = (table, query = "") => `${SB_URL}/rest/v1/${table}${query ? "?" + query : ""}`;

async function sbSelect(table, query = "") {
  const res = await fetch(sbUrl(table, query), { headers: SB_HEADERS });
  if (!res.ok) return [];
  return res.json();
}
async function sbSelectOne(table, query = "") {
  const res = await fetch(sbUrl(table, query), {
    headers: { ...SB_HEADERS, "Accept": "application/vnd.pgrst.object+json" }
  });
  if (!res.ok) return null;
  return res.json();
}
async function sbInsert(table, data) {
  const res = await fetch(sbUrl(table), {
    method: "POST", headers: SB_HEADERS, body: JSON.stringify(data)
  });
  return res.ok;
}
async function sbUpdate(table, query, data) {
  const res = await fetch(sbUrl(table, query), {
    method: "PATCH", headers: SB_HEADERS, body: JSON.stringify(data)
  });
  return res.ok;
}
async function sbDelete(table, query) {
  const res = await fetch(sbUrl(table, query), {
    method: "DELETE", headers: SB_HEADERS
  });
  return res.ok;
}

/* ---- Password Hashing (Web Crypto API) ---- */
async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw + "tokkupro_salt_2026");
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2,"0")).join("");
}
async function verifyPassword(pw, hash) { return (await hashPassword(pw)) === hash; }

/* ---- Session ---- */
const SESSION_KEY = "tokkupro_session";
const getSession      = ()  => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)||"null"); } catch { return null; } };
const setSessionStore = (u) => localStorage.setItem(SESSION_KEY, JSON.stringify({ username:u.username, role:u.role, full_name:u.full_name||"", avatar_url:u.avatar_url||null }));
const clearSession    = ()  => localStorage.removeItem(SESSION_KEY);

/* ---- Users ---- */
const getUsers = async () => sbSelect("users", "order=created_at.desc");

/* ---- History ---- */
const saveHistoryEntry = async (entry) => {
  const session = getSession();
  if (!session) return;
  await sbInsert("quiz_history", {
    username: session.username,
    category: entry.cat,
    score: entry.score,
    total: entry.total,
    pct: entry.pct,
  });
};
const getHistory = async (username) => {
  const u = username || getSession()?.username;
  if (!u) return [];
  const rows = await sbSelect("quiz_history", `username=eq.${encodeURIComponent(u)}&order=created_at.desc&limit=100`);
  return rows.map((r) => ({ date:r.created_at, cat:r.category, score:r.score, total:r.total, pct:r.pct }));
};

/* ---- Supabase: getEffectiveStatus ---- */

/* ============================================================
   SHARED COMPONENTS & DATA
   ============================================================ */
function Ruby({ segments, size = 18 }) {
  return (
    <span style={{ display:"inline-flex", flexWrap:"wrap", alignItems:"flex-end", lineHeight:2.3 }}>
      {segments.map(([base, fr], i) => (
        <ruby key={i} style={{ fontSize:size, rubyAlign:"center" }}>
          {base}<rt style={{ fontSize:size*0.48, textAlign:"center" }}>{fr||"\u00A0"}</rt>
        </ruby>
      ))}
    </span>
  );
}
const S = (arr) => arr.map((x) => Array.isArray(x) ? (x.length===2?x:[x[0],""]) : [x,""]);

const CAT_INFO = {
  team:    { th:"ทีมเวิร์ค",        jp:"チームワーク", c:"#2563eb" },
  safety:  { th:"ความปลอดภัย",      jp:"安全",         c:"#d97706" },
  law:     { th:"กฎหมาย",           jp:"法令",         c:"#16a34a" },
  jobtype: { th:"ประเภทงาน (โยธา)", jp:"工事の種類",    c:"#9333ea" },
};

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

/* ============================================================
   QUESTION BANKS
   ============================================================ */
const MINI_BANK = {
  team: [
    { ruby:S([["職長","しょくちょう"],["とは、"],["労働","ろうどう"],["安全衛生","あんぜんえいせい"],["法","ほう"],["では、"],["工事現場","こうじげんば"],["における【　　】の"],["指導","しどう"],["監督者","かんとくしゃ"],["を"],["指","さ"],["します。"]]),
      choices:[S([["工事","こうじ"],["担任者","たんにんしゃ"]]),S([["主任","しゅにん"],["技術者","ぎじゅつしゃ"]]),S([["親方","おやかた"]]),S([["作業員","さぎょういん"]])], answer:3 },
    { ruby:S([["先輩","せんぱい"],["や、"],["目上","めうえ"],["の"],["人","ひと"],["から、「ご"],["苦労様","くろうさま"],["」といわれた"],["時","とき"],["のふさわしい"],["挨拶","あいさつ"],["はどれか。"]]),
      choices:[S([["ご"],["苦労様","くろうさま"],["です"]]),S([["ありがとうございます"]]),S([["お"],["疲","つか"],["れ"],["様","さま"],["です"]]),S([["ご"],["安全","あんぜん"],["に"]])], answer:1 },
    { ruby:S([["建設","けんせつ"],["キャリアアップシステムでは、"],["技能者","ぎのうしゃ"],["の"],["何","なに"],["を"],["登録","とうろく"],["しますか。"]]),
      choices:[S([["日本語能力試験","にほんごのうりょくしけん"],["（N1〜N4）"]]),S([["家族","かぞく"],["や"],["子供","こども"]]),S([["就業実績","しゅうぎょうじっせき"],["や"],["資格","しかく"]]),S([["健康状態","けんこうじょうたい"]])], answer:2 },
    { ruby:S([["朝礼","ちょうれい"],["で、"],["作業","さぎょう"],["を"],["安全","あんぜん"],["に"],["気持","きも"],["ちよく"],["進","すす"],["められるようにするために"],["行","おこな"],["うのはどれか。"]]),
      choices:[S([["現場","げんば"],["監督","かんとく"],["のあいさつ"]]),S([["ラジオ"],["体操","たいそう"]]),S([["安全","あんぜん"],["唱和","しょうわ"]]),S([["危険予知","きけんよち"],["活動","かつどう"],["（KY"],["活動","かつどう"],["）"]])], answer:0 },
    { ruby:S([["結束","けっそく"],["は",""],["鉄筋","てっきん"],["工事","こうじ"],["で"],["専用","せんよう"],["の"],["結束","けっそく"],["線","せん"],["を【　　】と"],["呼","よ"],["ばれる"],["道具","どうぐ"],["を"],["使","つか"],["います。"]]),
      choices:[S([["シノ"]]),S([["カッター"]]),S([["カケヤ"]]),S([["ハッカー"]])], answer:3 },
    { ruby:S([["工事","こうじ"],["全体","ぜんたい"],["をまとめる"],["会社","かいしゃ"],["は"],["通称","つうしょう"],["【　　】と"],["呼","よ"],["ばれます。"]]),
      choices:[S([["ゼネコン"]]),S([["サブコン"]]),S([["メーカー"]]),S([["デベロッパー"]])], answer:0 },
    { ruby:S([["技能者","ぎのうしゃ"],["の"],["評価","ひょうか"],["の"],["対象","たいしょう"],["とならないものは？"]]),
      choices:[S([["経験","けいけん"],["（"],["就業日数","しゅうぎょうにっすう"],["）"]]),S([["知識","ちしき"],["・"],["技能","ぎのう"]]),S([["マネジメント"],["能力","のうりょく"]]),S([["出身国","しゅっしんこく"]])], answer:3 },
    { ruby:S([["KY"],["活動","かつどう"],["の"],["最初","さいしょ"],["の"],["手順","てじゅん"],["は？"]]),
      choices:[S([["危険","きけん"],["の"],["発見","はっけん"]]),S([["対策","たいさく"],["の"],["検討","けんとう"]]),S([["目標","もくひょう"],["の"],["決定","けってい"]]),S([["かけ"],["声","ごえ"]])], answer:0 },
    { ruby:S([["工事","こうじ"],["が"],["図面","ずめん"],["通","どお"],["りに"],["行","おこな"],["われているか"],["確認","かくにん"],["する"],["立場","たちば"],["の"],["技術者","ぎじゅつしゃ"],["は？"]]),
      choices:[S([["発注者","はっちゅうしゃ"]]),S([["監理者","かんりしゃ"]]),S([["設計者","せっけいしゃ"]]),S([["現場","げんば"],["監督","かんとく"]])], answer:1 },
    { ruby:S([["建設","けんせつ"],["キャリアアップシステムでは、"],["技能者","ぎのうしゃ"],["のレベルが【　　】つに"],["分","わ"],["けられます。"]]),
      choices:[S([["2つ"]]),S([["3つ"]]),S([["4つ"]]),S([["5つ"]])], answer:2 },
  ],
  safety: [
    { ruby:S([["危険","きけん"],["を"],["察知","さっち"],["し、"],["事故","じこ"],["を"],["未然","みぜん"],["に"],["防","ふせ"],["ぐために"],["行","おこな"],["うものは、どれですか。"]]),
      choices:[S([["危険予知活動","きけんよちかつどう"],["（KY"],["活動","かつどう"],["）"]]),S([["5S"],["活動","かつどう"]]),S([["ヒヤリ・ハット"],["活動","かつどう"]]),S([["清掃活動","せいそうかつどう"]])], answer:0 },
    { ruby:S([["5S"],["活動","かつどう"],["で、"],["汚","よご"],["れがない"],["状態","じょうたい"],["を"],["保","たも"],["つことは"],["何","なに"],["か。"]]),
      choices:[S([["しつけ"]]),S([["清掃","せいそう"]]),S([["清潔","せいけつ"]]),S([["整理","せいり"]])], answer:2 },
    { ruby:S([["暑","あつ"],["さ"],["指数","しすう"],["を"],["低減","ていげん"],["させる"],["対策","たいさく"],["として"],["間違","まちが"],["いはどれか。"]]),
      choices:[S([["大型","おおがた"],["扇風機","せんぷうき"]]),S([["ドライミスト"]]),S([["風","かぜ"],["の"],["遮断","しゃだん"]]),S([["送風機","そうふうき"]])], answer:2 },
    { ruby:S([["地下","ちか"],["躯体","くたい"],["工事","こうじ"],["で"],["行","おこな"],["わない"],["工事","こうじ"],["はどれですか。"]]),
      choices:[S([["型枠","かたわく"],["工事","こうじ"]]),S([["建具","たてぐ"],["工事","こうじ"]]),S([["コンクリート"],["圧送","あっそう"],["工事","こうじ"]]),S([["鉄筋","てっきん"],["工事","こうじ"]])], answer:1 },
    { ruby:S([["建設業","けんせつぎょう"],["法","ほう"],["において、"],["適正","てきせい"],["な"],["施工","せこう"],["を"],["確保","かくほ"],["するために"],["配置","はいち"],["が"],["義務","ぎむ"],["付","づ"],["けられているものはどれか。"]]),
      choices:[S([["現場","げんば"],["代理人","だいりにん"],["・"],["施工体制台帳","せこうたいせいだいちょう"]]),S([["安全","あんぜん"],["責任者","せきにんしゃ"]]),S([["監理","かんり"],["技術者","ぎじゅつしゃ"],["・"],["主任","しゅにん"],["技術者","ぎじゅつしゃ"]]),S([["現場","げんば"],["監督","かんとく"]])], answer:2 },
    { ruby:S([["高所","こうしょ"],["作業","さぎょう"],["で"],["原則","げんそく"],["使","つか"],["う"],["墜落","ついらく"],["制止","せいし"],["用","よう"],["器具","きぐ"],["は【　　】"],["型","がた"],["。"]]),
      choices:[S([["胴","どう"],["ベルト"],["型","がた"]]),S([["フルハーネス"],["型","がた"]]),S([["ロープ"],["型","がた"]]),S([["ネット"],["型","がた"]])], answer:1 },
    { ruby:S([["建設業","けんせつぎょう"],["の"],["労働","ろうどう"],["災害","さいがい"],["で"],["最","もっと"],["も"],["多","おお"],["い"],["原因","げんいん"],["は？"]]),
      choices:[S([["崩壊","ほうかい"],["・"],["倒壊","とうかい"]]),S([["墜落","ついらく"],["・"],["転落","てんらく"]]),S([["交通事故","こうつうじこ"]]),S([["感電","かんでん"]])], answer:1 },
    { ruby:S([["50"],["人","にん"],["以上","いじょう"],["の"],["事業場","じぎょうじょう"],["で"],["毎年","まいとし"],["行","おこな"],["う"],["心理的","しんりてき"],["な"],["検査","けんさ"],["は？"]]),
      choices:[S([["健康診断","けんこうしんだん"]]),S([["ストレスチェック"]]),S([["体力測定","たいりょくそくてい"]]),S([["面接","めんせつ"]])], answer:1 },
    { ruby:S([["朝礼","ちょうれい"],["で、"],["作業","さぎょう"],["を"],["安全","あんぜん"],["に"],["気持","きも"],["ちよく"],["進","すす"],["められるようにするために"],["行","おこな"],["うのはどれか。"]]),
      choices:[S([["現場","げんば"],["監督","かんとく"],["のあいさつ"]]),S([["ラジオ"],["体操","たいそう"]]),S([["安全","あんぜん"],["唱和","しょうわ"]]),S([["危険予知","きけんよち"],["活動","かつどう"]])], answer:0 },
    { ruby:S([["KY"],["活動","かつどう"],["の"],["最初","さいしょ"],["の"],["手順","てじゅん"],["は？"]]),
      choices:[S([["危険","きけん"],["の"],["発見","はっけん"]]),S([["対策","たいさく"],["の"],["検討","けんとう"]]),S([["目標","もくひょう"],["の"],["決定","けってい"]]),S([["かけ"],["声","ごえ"]])], answer:0 },
  ],
  law: [
    { ruby:S([["最低","さいてい"],["の"],["労働条件","ろうどうじょうけん"],["が"],["決","き"],["められている"],["法律","ほうりつ"],["はどれか。"]]),
      choices:[S([["雇用","こよう"],["保険","ほけん"],["法","ほう"]]),S([["労働","ろうどう"],["基準","きじゅん"],["法","ほう"]]),S([["労働","ろうどう"],["安全衛生","あんぜんえいせい"],["法","ほう"]]),S([["労働","ろうどう"],["災害","さいがい"],["補償保険","ほしょうほけん"],["法","ほう"]])], answer:1 },
    { ruby:S([["労災","ろうさい"],["保険","ほけん"],["の"],["保険料","ほけんりょう"],["は、（　　）の"],["負担","ふたん"],["です。"]]),
      choices:[S([["50%"],["事業主","じぎょうぬし"],["、50%"],["労働者","ろうどうしゃ"],["本人","ほんにん"],["から"]]),S([["労働者","ろうどうしゃ"],["本人","ほんにん"],["と"],["事業主","じぎょうぬし"]]),S([["全額","ぜんがく"],["、"],["事業主","じぎょうぬし"],["から"]]),S([["全額","ぜんがく"],["、"],["労災","ろうさい"],["保険","ほけん"],["から"]])], answer:2 },
    { ruby:S([["建物","たてもの"],["を"],["建築","けんちく"],["するときや、"],["利用","りよう"],["するときに"],["守","まも"],["らなければならない"],["最低限","さいていげん"],["のルールを"],["定","さだ"],["めた"],["法律","ほうりつ"],["は"],["何","なに"],["か。"]]),
      choices:[S([["建設","けんせつ"],["リサイクル"],["法","ほう"]]),S([["建築基準法","けんちくきじゅんほう"]]),S([["消防法","しょうぼうほう"]]),S([["建設業","けんせつぎょう"],["法","ほう"]])], answer:1 },
    { ruby:S([["建設","けんせつ"],["リサイクル"],["法","ほう"],["は、"],["廃材","はいざい"],["の"],["適切","てきせつ"],["な"],["処理","しょり"],["や（　　）を"],["促","うなが"],["すための"],["法律","ほうりつ"],["です。"]]),
      choices:[S([["収集","しゅうしゅう"],["運搬","うんぱん"]]),S([["再資源化","さいしげんか"]]),S([["最低限","さいていげん"],["のルール"]]),S([["CCUS"]])], answer:1 },
    { ruby:S([["免許","めんきょ"],["が"],["必要","ひつよう"],["な、トランシーバーの"],["使用","しよう"],["を"],["規制","きせい"],["する"],["法律","ほうりつ"],["はどれですか。"]]),
      choices:[S([["電気通信事業","でんきつうしんじぎょう"],["法","ほう"]]),S([["電気事業","でんきじぎょう"],["法","ほう"]]),S([["航空","こうくう"],["法","ほう"]]),S([["電波","でんぱ"],["法","ほう"]])], answer:3 },
    { ruby:S([["法定","ほうてい"],["労働","ろうどう"],["時間","じかん"],["は"],["原則","げんそく"],["1"],["日","にち"],["について【　　】"],["時間","じかん"],["です。"]]),
      choices:[S([["6"],["時間","じかん"]]),S([["7"],["時間","じかん"]]),S([["8"],["時間","じかん"]]),S([["10"],["時間","じかん"]])], answer:2 },
    { ruby:S([["労働者","ろうどうしゃ"],["を"],["解雇","かいこ"],["する"],["場合","ばあい"],["は【　　】"],["日","にち"],["前","まえ"],["に"],["予告","よこく"],["が"],["必要","ひつよう"],["。"]]),
      choices:[S([["7"],["日","にち"]]),S([["14"],["日","にち"]]),S([["30"],["日","にち"]]),S([["60"],["日","にち"]])], answer:2 },
    { ruby:S([["業務","ぎょうむ"],["中","ちゅう"],["のけがの"],["治療費","ちりょうひ"],["を"],["支払","しはら"],["う"],["保険","ほけん"],["は？"]]),
      choices:[S([["労災","ろうさい"],["保険","ほけん"]]),S([["雇用","こよう"],["保険","ほけん"]]),S([["健康","けんこう"],["保険","ほけん"]]),S([["生命","せいめい"],["保険","ほけん"]])], answer:0 },
    { ruby:S([["重量","じゅうりょう"],["が【　　】g"],["以上","いじょう"],["のドローンは"],["登録","とうろく"],["が"],["義務","ぎむ"],["。"]]),
      choices:[S([["50g"]]),S([["100g"]]),S([["200g"]]),S([["500g"]])], answer:1 },
    { ruby:S([["賃金","ちんぎん"],["は"],["毎月","まいつき"],["【　　】"],["回","かい"],["以上","いじょう"],["、"],["一定","いってい"],["の"],["期日","きじつ"],["に"],["支払","しはら"],["う。"]]),
      choices:[S([["1"],["回","かい"]]),S([["2"],["回","かい"]]),S([["3"],["回","かい"]]),S([["4"],["回","かい"]])], answer:0 },
  ],
  jobtype: [
    { ruby:S([["海洋","かいよう"],["土木","どぼく"],["工事","こうじ"],["で、"],["海","うみ"],["や"],["川","かわ"],["などの"],["底","そこ"],["の"],["土砂","どしゃ"],["を"],["取","と"],["り"],["除","のぞ"],["く"],["工事","こうじ"],["を"],["何","なん"],["というか。"]]),
      choices:[S([["埋立","うみたて"],["工事","こうじ"]]),S([["岸壁","がんぺき"],["工事","こうじ"]]),S([["浚渫","しゅんせつ"],["工事","こうじ"]]),S([["防波堤","ぼうはてい"],["工事","こうじ"]])], answer:2 },
    { ruby:S([["三角形","さんかくけい"],["を"],["基本","きほん"],["とした"],["構造","こうぞう"],["で、"],["屋根","やね"],["、ドーム、"],["橋梁","きょうりょう"],["などで"],["使","つか"],["われる"],["構造","こうぞう"],["は"],["何","なに"],["か。"]]),
      choices:[S([["ブレース"],["構造","こうぞう"]]),S([["トラス"],["構造","こうぞう"]]),S([["ラーメン"],["構造","こうぞう"]]),S([["コンクリート"],["構造","こうぞう"]])], answer:1 },
    { ruby:S([["トイレの"],["便器","べんき"],["、"],["洗面器","せんめんき"],["などを"],["設置","せっち"],["する"],["工事","こうじ"],["を"],["何","なん"],["というか。"]]),
      choices:[S([["給水","きゅうすい"],["設備","せつび"],["工事","こうじ"]]),S([["衛生","えいせい"],["器具","きぐ"],["設備","せつび"],["工事","こうじ"]]),S([["給湯","きゅうとう"],["設備","せつび"],["工事","こうじ"]]),S([["排水","はいすい"],["・"],["通気","つうき"],["設備","せつび"],["工事","こうじ"]])], answer:1 },
    { ruby:S([["土木","どぼく"],["工事","こうじ"],["の"],["説明","せつめい"],["で"],["正","ただ"],["しいのはどれか。"]]),
      choices:[S([["電話","でんわ"],["やインターネットなどの"],["通信設備","つうしんせつび"],["を"],["作","つく"],["る"],["工事","こうじ"],["です。"]]),S([["電気","でんき"],["、ガス、"],["水道","すいどう"],["などの"],["設備","せつび"],["を"],["設置","せっち"],["する"],["工事","こうじ"],["です。"]]),S([["海","うみ"],["、"],["川","かわ"],["、"],["山林","さんりん"],["などの"],["自然","しぜん"],["を"],["相手","あいて"],["にした"],["工事","こうじ"],["です。"]]),S([["生活","せいかつ"],["するために、"],["必要","ひつよう"],["な"],["建物","たてもの"],["を"],["作","つく"],["る"],["工事","こうじ"],["です。"]])], answer:2 },
    { ruby:S([["航空法","こうくうほう"],["で、"],["登録","とうろく"],["が"],["義務化","ぎむか"],["されている、"],["無人","むじん"],["航空機","こうくうき"],["（ドローン）の"],["条件","じょうけん"],["で"],["正","ただ"],["しいのはどれか。"]]),
      choices:[S([["重量","じゅうりょう"],["が100g"],["以上","いじょう"],["のドローン"]]),S([["長","なが"],["さが1m"],["以上","いじょう"],["のドローン"]]),S([["重量","じゅうりょう"],["が100kg"],["以上","いじょう"],["のドローン"]]),S([["長","なが"],["さが100cm"],["以上","いじょう"],["のドローン"]])], answer:0 },
    { ruby:S([["ダムの"],["目的","もくてき"],["は「"],["治水","ちすい"],["」と「【　　】」の2つ。"]]),
      choices:[S([["発電","はつでん"]]),S([["利水","りすい"]]),S([["観光","かんこう"]]),S([["漁業","ぎょぎょう"]])], answer:1 },
    { ruby:S([["山岳","さんがく"],["トンネルで"],["吹付","ふきつ"],["けコンクリートで"],["支","ささ"],["える"],["工法","こうほう"],["は？"]]),
      choices:[S([["NATM"]]),S([["TBM"]]),S([["シールド"],["工法","こうほう"]]),S([["開削","かいさく"],["工法","こうほう"]])], answer:0 },
    { ruby:S([["橋梁","きょうりょう"],["工事","こうじ"],["は「"],["下部工","かぶこう"],["」と「【　　】」の2つ。"]]),
      choices:[S([["上部工","じょうぶこう"]]),S([["中部工","ちゅうぶこう"]]),S([["側部工","そくぶこう"]]),S([["外部工","がいぶこう"]])], answer:0 },
    { ruby:S([["柱","はしら"],["や"],["梁","はり"],["に"],["木材","もくざい"],["を"],["使","つか"],["った"],["建物","たてもの"],["の"],["構造","こうぞう"],["は？"]]),
      choices:[S([["鉄筋","てっきん"],["コンクリート"],["造","ぞう"]]),S([["鉄骨","てっこつ"],["造","ぞう"]]),S([["木造","もくぞう"]]),S([["ブロック"],["造","ぞう"]])], answer:2 },
    { ruby:S([["建物","たてもの"],["の"],["前","まえ"],["に"],["地盤","じばん"],["を"],["調","しら"],["べる"],["調査","ちょうさ"],["は【　　】"],["調査","ちょうさ"],["。"]]),
      choices:[S([["ボーリング"]]),S([["測量","そくりょう"]]),S([["環境","かんきょう"]]),S([["交通","こうつう"]])], answer:0 },
  ],
};

const EXAM_BANK = [
  { cat:"team", ruby:S([["職長","しょくちょう"],["とは、"],["労働","ろうどう"],["安全衛生","あんぜんえいせい"],["法","ほう"],["では、"],["工事現場","こうじげんば"],["における【　　】の"],["指導","しどう"],["監督者","かんとくしゃ"],["を"],["指","さ"],["します。"]]),
    choices:[S([["工事","こうじ"],["担任者","たんにんしゃ"]]),S([["主任","しゅにん"],["技術者","ぎじゅつしゃ"]]),S([["親方","おやかた"]]),S([["作業員","さぎょういん"]])], answer:3 },
  { cat:"team", ruby:S([["先輩","せんぱい"],["や、"],["目上","めうえ"],["の"],["人","ひと"],["から、「ご"],["苦労様","くろうさま"],["」といわれた"],["時","とき"],["のふさわしい"],["挨拶","あいさつ"],["はどれか。"]]),
    choices:[S([["ご"],["苦労様","くろうさま"],["です"]]),S([["ありがとうございます"]]),S([["お"],["疲","つか"],["れ"],["様","さま"],["です"]]),S([["ご"],["安全","あんぜん"],["に"]])], answer:1 },
  { cat:"team", ruby:S([["建設","けんせつ"],["キャリアアップシステムでは、"],["技能者","ぎのうしゃ"],["の"],["何","なに"],["を"],["登録","とうろく"],["しますか。"]]),
    choices:[S([["日本語能力試験","にほんごのうりょくしけん"],["（N1〜N4）"]]),S([["家族","かぞく"],["や"],["子供","こども"]]),S([["就業実績","しゅうぎょうじっせき"],["や"],["資格","しかく"]]),S([["健康状態","けんこうじょうたい"]])], answer:2 },
  { cat:"team", ruby:S([["朝礼","ちょうれい"],["で、"],["作業","さぎょう"],["を"],["安全","あんぜん"],["に"],["気持","きも"],["ちよく"],["進","すす"],["められるようにするために"],["行","おこな"],["うのはどれか。"]]),
    choices:[S([["現場","げんば"],["監督","かんとく"],["のあいさつ"]]),S([["ラジオ"],["体操","たいそう"]]),S([["安全","あんぜん"],["唱和","しょうわ"]]),S([["危険予知","きけんよち"],["活動","かつどう"],["（KY"],["活動","かつどう"],["）"]])], answer:0 },
  { cat:"team", ruby:S([["結束","けっそく"],["は",""],["鉄筋","てっきん"],["工事","こうじ"],["で"],["専用","せんよう"],["の"],["結束","けっそく"],["線","せん"],["を【　　】と"],["呼","よ"],["ばれる"],["道具","どうぐ"],["を"],["使","つか"],["います。"]]),
    choices:[S([["シノ"]]),S([["カッター"]]),S([["カケヤ"]]),S([["ハッカー"]])], answer:3 },
  { cat:"safety", ruby:S([["危険","きけん"],["を"],["察知","さっち"],["し、"],["事故","じこ"],["を"],["未然","みぜん"],["に"],["防","ふせ"],["ぐために"],["行","おこな"],["うものは、どれですか。"]]),
    choices:[S([["危険予知活動","きけんよちかつどう"],["（KY"],["活動","かつどう"],["）"]]),S([["5S"],["活動","かつどう"]]),S([["ヒヤリ・ハット"],["活動","かつどう"]]),S([["清掃活動","せいそうかつどう"]])], answer:0 },
  { cat:"safety", ruby:S([["5S"],["活動","かつどう"],["で、"],["汚","よご"],["れがない"],["状態","じょうたい"],["を"],["保","たも"],["つことは"],["何","なに"],["か。"]]),
    choices:[S([["しつけ"]]),S([["清掃","せいそう"]]),S([["清潔","せいけつ"]]),S([["整理","せいり"]])], answer:2 },
  { cat:"safety", ruby:S([["暑","あつ"],["さ"],["指数","しすう"],["を"],["低減","ていげん"],["させる"],["対策","たいさく"],["として"],["間違","まちが"],["いはどれか。"]]),
    choices:[S([["大型","おおがた"],["扇風機","せんぷうき"]]),S([["ドライミスト"]]),S([["風","かぜ"],["の"],["遮断","しゃだん"]]),S([["送風機","そうふうき"]])], answer:2 },
  { cat:"safety", ruby:S([["地下","ちか"],["躯体","くたい"],["工事","こうじ"],["で"],["行","おこな"],["わない"],["工事","こうじ"],["はどれですか。"]]),
    choices:[S([["型枠","かたわく"],["工事","こうじ"]]),S([["建具","たてぐ"],["工事","こうじ"]]),S([["コンクリート"],["圧送","あっそう"],["工事","こうじ"]]),S([["鉄筋","てっきん"],["工事","こうじ"]])], answer:1 },
  { cat:"safety", ruby:S([["建設業","けんせつぎょう"],["法","ほう"],["において、"],["適正","てきせい"],["な"],["施工","せこう"],["を"],["確保","かくほ"],["するために"],["配置","はいち"],["が"],["義務","ぎむ"],["付","づ"],["けられているものはどれか。"]]),
    choices:[S([["現場","げんば"],["代理人","だいりにん"],["・"],["施工体制台帳","せこうたいせいだいちょう"]]),S([["安全","あんぜん"],["責任者","せきにんしゃ"]]),S([["監理","かんり"],["技術者","ぎじゅつしゃ"],["・"],["主任","しゅにん"],["技術者","ぎじゅつしゃ"]]),S([["現場","げんば"],["監督","かんとく"]])], answer:2 },
  { cat:"law", ruby:S([["最低","さいてい"],["の"],["労働条件","ろうどうじょうけん"],["が"],["決","き"],["められている"],["法律","ほうりつ"],["はどれか。"]]),
    choices:[S([["雇用","こよう"],["保険","ほけん"],["法","ほう"]]),S([["労働","ろうどう"],["基準","きじゅん"],["法","ほう"]]),S([["労働","ろうどう"],["安全衛生","あんぜんえいせい"],["法","ほう"]]),S([["労働","ろうどう"],["災害","さいがい"],["補償保険","ほしょうほけん"],["法","ほう"]])], answer:1 },
  { cat:"law", ruby:S([["労災","ろうさい"],["保険","ほけん"],["の"],["保険料","ほけんりょう"],["は、（　　）の"],["負担","ふたん"],["です。"]]),
    choices:[S([["50%"],["事業主","じぎょうぬし"],["、50%"],["労働者","ろうどうしゃ"],["本人","ほんにん"],["から"]]),S([["労働者","ろうどうしゃ"],["本人","ほんにん"],["と"],["事業主","じぎょうぬし"]]),S([["全額","ぜんがく"],["、"],["事業主","じぎょうぬし"],["から"]]),S([["全額","ぜんがく"],["、"],["労災","ろうさい"],["保険","ほけん"],["から"]])], answer:2 },
  { cat:"law", ruby:S([["建物","たてもの"],["を"],["建築","けんちく"],["するときや、"],["利用","りよう"],["するときに"],["守","まも"],["らなければならない"],["最低限","さいていげん"],["のルールを"],["定","さだ"],["めた"],["法律","ほうりつ"],["は"],["何","なに"],["か。"]]),
    choices:[S([["建設","けんせつ"],["リサイクル"],["法","ほう"]]),S([["建築基準法","けんちくきじゅんほう"]]),S([["消防法","しょうぼうほう"]]),S([["建設業","けんせつぎょう"],["法","ほう"]])], answer:1 },
  { cat:"law", ruby:S([["建設","けんせつ"],["リサイクル"],["法","ほう"],["は、"],["廃材","はいざい"],["の"],["適切","てきせつ"],["な"],["処理","しょり"],["や（　　）を"],["促","うなが"],["すための"],["法律","ほうりつ"],["です。"]]),
    choices:[S([["収集","しゅうしゅう"],["運搬","うんぱん"]]),S([["再資源化","さいしげんか"]]),S([["最低限","さいていげん"],["のルール"]]),S([["CCUS"]])], answer:1 },
  { cat:"law", ruby:S([["免許","めんきょ"],["が"],["必要","ひつよう"],["な、トランシーバーの"],["使用","しよう"],["を"],["規制","きせい"],["する"],["法律","ほうりつ"],["はどれですか。"]]),
    choices:[S([["電気通信事業","でんきつうしんじぎょう"],["法","ほう"]]),S([["電気事業","でんきじぎょう"],["法","ほう"]]),S([["航空","こうくう"],["法","ほう"]]),S([["電波","でんぱ"],["法","ほう"]])], answer:3 },
  { cat:"jobtype", ruby:S([["海洋","かいよう"],["土木","どぼく"],["工事","こうじ"],["で、"],["海","うみ"],["や"],["川","かわ"],["などの"],["底","そこ"],["の"],["土砂","どしゃ"],["を"],["取","と"],["り"],["除","のぞ"],["く"],["工事","こうじ"],["を"],["何","なん"],["というか。"]]),
    choices:[S([["埋立","うみたて"],["工事","こうじ"]]),S([["岸壁","がんぺき"],["工事","こうじ"]]),S([["浚渫","しゅんせつ"],["工事","こうじ"]]),S([["防波堤","ぼうはてい"],["工事","こうじ"]])], answer:2 },
  { cat:"jobtype", ruby:S([["三角形","さんかくけい"],["を"],["基本","きほん"],["とした"],["構造","こうぞう"],["で、"],["屋根","やね"],["、ドーム、"],["橋梁","きょうりょう"],["などで"],["使","つか"],["われる"],["構造","こうぞう"],["は"],["何","なに"],["か。"]]),
    choices:[S([["ブレース"],["構造","こうぞう"]]),S([["トラス"],["構造","こうぞう"]]),S([["ラーメン"],["構造","こうぞう"]]),S([["コンクリート"],["構造","こうぞう"]])], answer:1 },
  { cat:"jobtype", ruby:S([["トイレの"],["便器","べんき"],["、"],["洗面器","せんめんき"],["などを"],["設置","せっち"],["する"],["工事","こうじ"],["を"],["何","なん"],["というか。"]]),
    choices:[S([["給水","きゅうすい"],["設備","せつび"],["工事","こうじ"]]),S([["衛生","えいせい"],["器具","きぐ"],["設備","せつび"],["工事","こうじ"]]),S([["給湯","きゅうとう"],["設備","せつび"],["工事","こうじ"]]),S([["排水","はいすい"],["・"],["通気","つうき"],["設備","せつび"],["工事","こうじ"]])], answer:1 },
  { cat:"jobtype", ruby:S([["土木","どぼく"],["工事","こうじ"],["の"],["説明","せつめい"],["で"],["正","ただ"],["しいのはどれか。"]]),
    choices:[S([["電話","でんわ"],["やインターネットなどの"],["通信設備","つうしんせつび"],["を"],["作","つく"],["る"],["工事","こうじ"],["です。"]]),S([["電気","でんき"],["、ガス、"],["水道","すいどう"],["などの"],["設備","せつび"],["を"],["設置","せっち"],["する"],["工事","こうじ"],["です。"]]),S([["海","うみ"],["、"],["川","かわ"],["、"],["山林","さんりん"],["などの"],["自然","しぜん"],["を"],["相手","あいて"],["にした"],["工事","こうじ"],["です。"]]),S([["生活","せいかつ"],["するために、"],["必要","ひつよう"],["な"],["建物","たてもの"],["を"],["作","つく"],["る"],["工事","こうじ"],["です。"]])], answer:2 },
  { cat:"jobtype", ruby:S([["航空法","こうくうほう"],["で、"],["登録","とうろく"],["が"],["義務化","ぎむか"],["されている、"],["無人","むじん"],["航空機","こうくうき"],["（ドローン）の"],["条件","じょうけん"],["で"],["正","ただ"],["しいのはどれか。"]]),
    choices:[S([["重量","じゅうりょう"],["が100g"],["以上","いじょう"],["のドローン"]]),S([["長","なが"],["さが1m"],["以上","いじょう"],["のドローン"]]),S([["重量","じゅうりょう"],["が100kg"],["以上","いじょう"],["のドローン"]]),S([["長","なが"],["さが100cm"],["以上","いじょう"],["のドローン"]])], answer:0 },
];

const VOCAB = [
  { jp:"職長", fr:"しょくちょう", th:"หัวหน้าคนงาน", cat:"team",
    ex:S([["職長","しょくちょう"],["が"],["技能者","ぎのうしゃ"],["に"],["指示","しじ"],["を"],["出","だ"],["します。"]]),
    exTh:"หัวหน้าคนงานออกคำสั่งให้ช่างฝีมือ" },
  { jp:"朝礼", fr:"ちょうれい", th:"การประชุมเช้า", cat:"team",
    ex:S([["毎朝","まいあさ"],["、8"],["時","じ"],["から"],["朝礼","ちょうれい"],["を"],["行","おこな"],["います。"]]),
    exTh:"ทุกเช้าจะมีการประชุมเช้าเวลา 8 โมง" },
  { jp:"危険予知活動", fr:"きけんよちかつどう", th:"กิจกรรมคาดการณ์อันตราย (KY)", cat:"safety",
    ex:S([["KY"],["活動","かつどう"],["で"],["危険","きけん"],["を"],["事前","じぜん"],["に"],["防","ふせ"],["ぎます。"]]),
    exTh:"กิจกรรม KY ใช้ป้องกันอันตรายล่วงหน้า" },
  { jp:"墜落制止用器具", fr:"ついらくせいしようきぐ", th:"อุปกรณ์กันตก (ฮาร์เนส)", cat:"safety",
    ex:S([["高所","こうしょ"],["作業","さぎょう"],["では"],["墜落","ついらく"],["制止","せいし"],["用","よう"],["器具","きぐ"],["を"],["使","つか"],["います。"]]),
    exTh:"งานที่สูงต้องใช้อุปกรณ์กันตก" },
  { jp:"解雇予告", fr:"かいこよこく", th:"การแจ้งเลิกจ้างล่วงหน้า", cat:"law",
    ex:S([["30"],["日","にち"],["前","まえ"],["に"],["解雇","かいこ"],["予告","よこく"],["をします。"]]),
    exTh:"แจ้งเลิกจ้างล่วงหน้า 30 วัน" },
  { jp:"労災保険", fr:"ろうさいほけん", th:"ประกันอุบัติเหตุจากงาน", cat:"law",
    ex:S([["労災","ろうさい"],["保険","ほけん"],["は"],["事業主","じぎょうぬし"],["が"],["全額","ぜんがく"],["負担","ふたん"],["します。"]]),
    exTh:"ประกันอุบัติเหตุจากงานนายจ้างจ่ายเต็มจำนวน" },
  { jp:"浚渫工事", fr:"しゅんせつこうじ", th:"งานขุดลอกตะกอนใต้น้ำ", cat:"jobtype",
    ex:S([["川","かわ"],["の"],["底","そこ"],["を"],["浚渫","しゅんせつ"],["工事","こうじ"],["で"],["きれいにします。"]]),
    exTh:"งานขุดลอกทำความสะอาดก้นแม่น้ำ" },
  { jp:"下部工", fr:"かぶこう", th:"งานฐานราก (ของสะพาน)", cat:"jobtype",
    ex:S([["橋","はし"],["は"],["下部工","かぶこう"],["から"],["建設","けんせつ"],["します。"]]),
    exTh:"สะพานเริ่มสร้างจากงานฐานรากก่อน" },
];
const CATS_FILTER = [
  { key:"all", th:"ทั้งหมด" }, { key:"team", th:"ทีมเวิร์ค" },
  { key:"law", th:"กฎหมาย" }, { key:"safety", th:"ความปลอดภัย" }, { key:"jobtype", th:"ประเภทงาน" },
];

/* ============================================================
   BOTTOM NAV SHELL
   ============================================================ */
function Shell({ tab, setTab, children, currentUser, onLogout }) {
  const items = [
    { k:"home", th:"หน้าแรก", jp:"ホーム" },
    { k:"minitest", th:"แบบทดสอบย่อย", jp:"ミニテスト" },
    { k:"exam", th:"สอบจริง", jp:"模擬試験" },
    { k:"vocab", th:"คำศัพท์", jp:"単語" },
    { k:"profile", th:"โปรไฟล์", jp:"プロフィール" },
  ];
  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb",
      fontFamily:"'Noto Sans JP','Noto Sans Thai',serif", display:"flex", flexDirection:"column" }}>
      {currentUser && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"8px 18px", background:"#fff", borderBottom:"1px solid #e5e7eb", fontSize:12.5 }}>
          <span style={{ color:"#6b7280" }}>👤 {currentUser.username}</span>
          <button onClick={onLogout} style={{ border:"none", background:"none", color:"#dc2626",
            fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>ออกจากระบบ</button>
        </div>
      )}
      <div style={{ flex:1 }}>{children}</div>
      <div style={{ display:"flex", borderTop:"1px solid #d1d5db", background:"#fff" }}>
        {items.map(({k,th,jp}) => {
          const on = tab===k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{ flex:1, border:"none",
              background:"none", cursor:"pointer", padding:"11px 2px 9px", display:"flex",
              flexDirection:"column", alignItems:"center", gap:2,
              color: on?"#1a56db":"#9ca3af", fontFamily:"inherit",
              borderTop: on?"2px solid #1a56db":"2px solid transparent" }}>
              <span style={{ fontSize:11.5, fontWeight:on?700:500 }}>{th}</span>
              <span style={{ fontSize:9.5, opacity:.7 }}>{jp}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   HOME
   ============================================================ */
function HomeScreen({ goTab }) {
  const history = getHistory();
  const recent = history.slice(0, 3);
  const cards = [
    { th:"แบบทดสอบย่อย", jp:"ミニテスト", desc:"10問・タイマーなし", c:"#16a34a", k:"minitest" },
    { th:"สอบเสมือนจริง", jp:"模擬試験", desc:"20問・60分・合格75%", c:"#1a56db", k:"exam" },
    { th:"คำศัพท์", jp:"単語帳", desc:`${VOCAB.length}語収録`, c:"#d97706", k:"vocab" },
    { th:"ผลการเรียน", jp:"学習成果", desc:`${history.length}回受験`, c:"#9333ea", k:"profile" },
  ];
  return (
    <div style={{ padding:"32px 20px 24px", maxWidth:680, margin:"0 auto" }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:13, color:"#9ca3af" }}>特定技能2号 建設</div>
        <h1 style={{ fontSize:24, color:"#111", margin:"4px 0 0", fontWeight:700 }}>TokkuPro</h1>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:28 }}>
        {cards.map((c) => (
          <button key={c.th} onClick={() => goTab(c.k)} style={{ textAlign:"left", border:"1px solid #e5e7eb",
            borderLeft:`4px solid ${c.c}`, background:"#fff", borderRadius:8, padding:"18px 18px",
            cursor:"pointer", fontFamily:"inherit" }}>
            <div style={{ fontWeight:700, fontSize:15.5, color:"#111" }}>{c.th}</div>
            <div style={{ fontSize:12, color:c.c, marginTop:2 }}>{c.jp}</div>
            <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:8 }}>{c.desc}</div>
          </button>
        ))}
      </div>
      {recent.length > 0 && (
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"18px 22px" }}>
          <div style={{ fontWeight:700, fontSize:14, color:"#111", marginBottom:12 }}>ผลล่าสุด / 最近の結果</div>
          {recent.map((h, i) => {
            const info = CAT_INFO[h.cat];
            return (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                padding:"7px 0", borderBottom: i<recent.length-1 ? "1px solid #f3f4f6" : "none", fontSize:13.5 }}>
                <span style={{ color:info.c, fontWeight:600 }}>{info.th}</span>
                <span style={{ color:"#374151", fontWeight:700 }}>{h.score}/{h.total} ({h.pct}%)</span>
              </div>
            );
          })}
          <button onClick={() => goTab("profile")} style={{ marginTop:12, width:"100%",
            padding:"8px", border:"1px solid #d1d5db", borderRadius:5, background:"#fafafa",
            color:"#6b7280", fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>ดูทั้งหมด →</button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   VOCAB
   ============================================================ */
function VocabScreen() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [favs, setFavs] = useState({});
  const list = VOCAB.filter((v) =>
    (filter==="all" || v.cat===filter) &&
    (v.jp.includes(search) || v.th.includes(search) || v.fr.includes(search)));
  return (
    <div style={{ maxWidth:680, margin:"0 auto" }}>
      <div style={{ padding:"24px 20px 14px", position:"sticky", top:0, background:"#f9fafb", zIndex:5 }}>
        <h1 style={{ fontSize:20, color:"#111", margin:"0 0 14px", fontWeight:700 }}>คำศัพท์ / 単語帳</h1>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fff",
          border:"1px solid #d1d5db", borderRadius:6, padding:"9px 14px" }}>
          <span style={{ color:"#9ca3af", fontSize:14 }}>🔍</span>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="ค้นหาคำศัพท์..."
            style={{ border:"none", background:"none", outline:"none", flex:1, fontSize:14, fontFamily:"inherit", color:"#111" }} />
        </div>
        <div style={{ display:"flex", gap:8, overflowX:"auto", marginTop:10, paddingBottom:2 }}>
          {CATS_FILTER.map((c) => (
            <button key={c.key} onClick={()=>setFilter(c.key)} style={{ whiteSpace:"nowrap",
              border:`1px solid ${filter===c.key ? "#1a56db" : "#d1d5db"}`,
              background: filter===c.key ? "#1a56db" : "#fff", color: filter===c.key ? "#fff" : "#6b7280",
              padding:"5px 14px", borderRadius:99, fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{c.th}</button>
          ))}
        </div>
      </div>
      <div style={{ padding:"4px 20px 24px", display:"flex", flexDirection:"column", gap:12 }}>
        {list.map((v, i) => {
          const info = CAT_INFO[v.cat];
          return (
            <div key={i} style={{ background:"#fff", border:"1px solid #e5e7eb",
              borderLeft:`3px solid ${info.c}`, borderRadius:8, padding:"16px 18px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <span style={{ fontSize:11, fontWeight:700, color:info.c }}>{info.th}</span>
                <button onClick={()=>setFavs((f)=>({...f,[v.jp]:!f[v.jp]}))}
                  style={{ border:"none", background:"none", cursor:"pointer", fontSize:16, color: favs[v.jp] ? "#d97706" : "#d1d5db" }}>★</button>
              </div>
              <div style={{ marginTop:6 }}><Ruby segments={[[v.jp, v.fr]]} size={26} /></div>
              <div style={{ fontSize:15, fontWeight:600, color:"#111", marginTop:2 }}>{v.th}</div>
              <div style={{ borderTop:"1px solid #f3f4f6", marginTop:10, paddingTop:10, fontSize:13.5, lineHeight:2, color:"#374151" }}>
                <Ruby segments={v.ex} size={13.5} />
                <div style={{ color:"#9ca3af", marginTop:2 }}>{v.exTh}</div>
              </div>
            </div>
          );
        })}
        {list.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:40, fontSize:14 }}>ไม่พบคำศัพท์ที่ค้นหา</div>}
      </div>
    </div>
  );
}

/* ============================================================
   PROFILE
   ============================================================ */
function ProfileScreen() {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    const session = getSession();
    if (session) getHistory(session.username).then(setHistory);
  }, []);
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"2-digit"}) +
      " " + d.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"});
  };
  const catSummary = () => {
    const out = {};
    Object.keys(CAT_INFO).forEach((k) => {
      const rows = history.filter((h) => h.cat === k);
      out[k] = { count: rows.length, latest: rows[0]||null,
        avg: rows.length ? Math.round(rows.reduce((s,r)=>s+r.pct,0)/rows.length) : null };
    });
    return out;
  };
  const summary = catSummary();
  const totalRuns = history.length;
  const overallAvg = totalRuns ? Math.round(history.reduce((s,h)=>s+h.pct,0)/totalRuns) : 0;
  const clearHistory = async () => {
    const session = getSession();
    if (session) await sbDelete("quiz_history", `username=eq.${encodeURIComponent(session.username)}`);
    setHistory([]);
  };

  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 20px 32px" }}>
      <h1 style={{ fontSize:20, color:"#111", margin:"0 0 18px", fontWeight:700 }}>โปรไฟล์ / プロフィール</h1>
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
        padding:"20px 24px", marginBottom:18, display:"flex", justifyContent:"space-around" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:24, fontWeight:700, color:"#111" }}>{totalRuns}</div>
          <div style={{ fontSize:11.5, color:"#9ca3af" }}>ครั้งที่ทำ</div>
        </div>
        <div style={{ width:1, background:"#f3f4f6" }} />
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:24, fontWeight:700, color:"#1a56db" }}>{overallAvg}%</div>
          <div style={{ fontSize:11.5, color:"#9ca3af" }}>เฉลี่ยรวม</div>
        </div>
      </div>
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"20px 24px", marginBottom:18 }}>
        <div style={{ fontWeight:700, fontSize:14, color:"#111", marginBottom:14 }}>สรุปแยกตามหมวด / カテゴリー別</div>
        {Object.entries(summary).map(([k, s]) => {
          const info = CAT_INFO[k];
          return (
            <div key={k} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}>
                <span style={{ color:"#374151" }}>{info.th} <span style={{ color:"#9ca3af", fontSize:11 }}>{info.jp}</span></span>
                <span style={{ fontWeight:700, color: s.avg!==null ? info.c : "#d1d5db" }}>
                  {s.avg!==null ? `เฉลี่ย ${s.avg}%` : "ยังไม่เคยทำ"}
                </span>
              </div>
              <div style={{ height:8, background:"#f3f4f6", borderRadius:99, overflow:"hidden" }}>
                <div style={{ width:`${s.avg||0}%`, height:"100%", background:info.c, borderRadius:99, transition:"width .5s" }} />
              </div>
              {s.latest && (
                <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>
                  ล่าสุด: {fmtDate(s.latest.date)} — {s.latest.score}/{s.latest.total} ({s.latest.pct}%)
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"20px 24px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:14, color:"#111" }}>ประวัติทั้งหมด / 履歴</div>
          {history.length > 0 && (
            <button onClick={clearHistory} style={{ fontSize:11.5, color:"#dc2626", background:"none",
              border:"none", cursor:"pointer", fontFamily:"inherit" }}>ล้างประวัติ</button>
          )}
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign:"center", color:"#9ca3af", padding:24, fontSize:13.5 }}>
            ยังไม่มีประวัติการทำแบบทดสอบ<br/><span style={{ fontSize:12 }}>เริ่มทำ MiniTest เพื่อบันทึกผลลัพธ์ที่นี่</span>
          </div>
        ) : (
          history.map((h, i) => {
            const info = CAT_INFO[h.cat];
            return (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"9px 0", borderBottom: i<history.length-1 ? "1px solid #f3f4f6" : "none" }}>
                <div>
                  <div style={{ fontSize:13, color:"#374151" }}>{fmtDate(h.date)}</div>
                  <div style={{ fontSize:11.5, color:info.c, fontWeight:600, marginTop:1 }}>{info.th}</div>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:"#111" }}>
                  {h.score}/{h.total} <span style={{ color:info.c }}>({h.pct}%)</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ============================================================
   MINITEST
   ============================================================ */
function MiniTestScreen({ goTab }) {
  const [stage, setStage] = useState("select");
  const [cat, setCat] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [history, setHistory] = useState([]);
  useEffect(() => {
    const session = getSession();
    if (session) getHistory(session.username).then(setHistory);
  }, []);
  const [focusMode, setFocusMode] = useState(false);

  const startTest = (c) => {
    const qs = shuffle(MINI_BANK[c]).slice(0, 10);
    setCat(c); setQuestions(qs); setCurrent(0);
    setAnswers({}); setRevealed({}); setStage("exam");
  };
  const pick = (ci) => {
    if (revealed[current] !== undefined) return;
    setAnswers((a) => ({ ...a, [current]: ci }));
    setRevealed((r) => ({ ...r, [current]: true }));
  };
  const next = () => { if (current === questions.length - 1) finish(); else setCurrent((c) => c + 1); };
  const finish = async () => {
    const score = Object.entries(answers).filter(([i, v]) => questions[i].answer === v).length;
    const pct = Math.round((score / questions.length) * 100);
    await saveHistoryEntry({ cat, score, total: questions.length, pct });
    const session = getSession();
    if (session) getHistory(session.username).then(setHistory);
    setStage("result");
  };
  const backToSelect = () => { setStage("select"); setCat(null); };
  const answeredCount = Object.keys(answers).length;

  if (stage === "select") {
    const catHistory = (c) => history.filter((h) => h.cat === c).slice(0, 3);
    return (
      <div style={{ padding:"40px 20px", maxWidth:680, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:13, color:"#6b7280" }}>ミニテスト</div>
          <h1 style={{ fontSize:22, color:"#111", margin:"6px 0 4px" }}>เลือกหมวดที่ต้องการฝึก</h1>
          <div style={{ fontSize:13, color:"#9ca3af" }}>10問 · タイマーなし · 即時採点</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {Object.entries(CAT_INFO).map(([k, info]) => {
            const recent = catHistory(k);
            return (
              <button key={k} onClick={() => startTest(k)} style={{ textAlign:"left", border:"1px solid #e5e7eb",
                borderLeft:`4px solid ${info.c}`, background:"#fff", borderRadius:8, padding:"18px 20px",
                cursor:"pointer", fontFamily:"inherit" }}>
                <div style={{ fontWeight:700, fontSize:16, color:"#111" }}>{info.th}</div>
                <div style={{ fontSize:12.5, color:info.c, marginTop:2 }}>{info.jp}</div>
                <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:10 }}>
                  {recent.length === 0 ? "ยังไม่เคยทำ" : `ล่าสุด ${recent.length} ครั้ง`}
                </div>
                {recent.length > 0 && (
                  <div style={{ display:"flex", gap:6, marginTop:6 }}>
                    {recent.map((r, i) => (
                      <span key={i} style={{ fontSize:11, padding:"2px 8px", borderRadius:99,
                        background:info.c+"18", color:info.c, fontWeight:600 }}>{r.pct}%</span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (stage === "result") {
    const score = Object.entries(answers).filter(([i, v]) => questions[i].answer === v).length;
    const pct = Math.round((score / questions.length) * 100);
    const info = CAT_INFO[cat];
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:20, minHeight:"60vh" }}>
        <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:8,
          padding:"40px 48px", maxWidth:480, width:"100%", textAlign:"center" }}>
          <div style={{ fontSize:12.5, color:info.c, fontWeight:700, marginBottom:6 }}>{info.th} · {info.jp}</div>
          <div style={{ fontSize:13, color:"#6b7280", marginBottom:6 }}>ミニテスト終了</div>
          <div style={{ fontSize:50, fontWeight:700, color:"#111", margin:"10px 0" }}>{score} / {questions.length}</div>
          <div style={{ fontSize:24, color:info.c, fontWeight:700, marginBottom:24 }}>{pct}%</div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => startTest(cat)} style={{ flex:1, padding:"11px", border:"1px solid #d1d5db",
              borderRadius:6, background:"#fff", color:"#374151", cursor:"pointer", fontSize:14, fontFamily:"inherit" }}>もう一度</button>
            <button onClick={backToSelect} style={{ flex:1, padding:"11px", border:"none", borderRadius:6,
              background:"#1a56db", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:14, fontFamily:"inherit" }}>他のカテゴリー</button>
          </div>
          <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:18 }}>บันทึกลงโปรไฟล์แล้ว ✓</div>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const isRevealed = revealed[current] !== undefined;
  const chosenIdx = answers[current];
  const info = CAT_INFO[cat];
  const statusOf = (i) => {
    if (i === current) return "current";
    if (revealed[i] !== undefined) return answers[i] === questions[i].answer ? "correct" : "wrong";
    return "empty";
  };
  const btnSt = (i) => {
    const st = statusOf(i);
    const base = { width:"100%", height:28, borderRadius:4, border:"1px solid #bbb", background:"#fff",
      color:"#222", fontWeight:600, fontSize:12, cursor:"pointer", display:"flex",
      alignItems:"center", justifyContent:"center", fontFamily:"inherit" };
    if (st==="current") return {...base, border:"2px solid #1a56db", background:"#ebf0ff", color:"#1a56db"};
    if (st==="correct") return {...base, border:"1px solid #16a34a", background:"#f0fdf4", color:"#15803d"};
    if (st==="wrong")   return {...base, border:"1px solid #dc2626", background:"#fef2f2", color:"#dc2626"};
    return base;
  };

  const questionBlock = (
    <>
      <div style={{ fontSize: focusMode?24:19, lineHeight:2.7, color:"#111", borderBottom:"1px solid #e5e7eb",
        paddingBottom:26, marginBottom:30, maxWidth: focusMode?960:760 }}>
        <Ruby segments={q.ruby} size={focusMode?26:20} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: focusMode?"20px 56px":"16px 44px",
        maxWidth: focusMode?960:760 }}>
        {q.choices.map((seg, ci) => {
          const isAns = ci === q.answer, isChosen = ci === chosenIdx;
          let bg="#fff", bd="#d1d5db", col="#111", badge="#f3f4f6", badgeCol="#374151";
          if (isRevealed) {
            if (isAns) { bg="#f0fdf4"; bd="#16a34a"; col="#15803d"; badge="#16a34a"; badgeCol="#fff"; }
            else if (isChosen) { bg="#fef2f2"; bd="#dc2626"; col="#dc2626"; badge="#dc2626"; badgeCol="#fff"; }
            else { col="#9ca3af"; }
          }
          return (
            <button key={ci} onClick={() => pick(ci)} disabled={isRevealed} style={{ display:"flex",
              alignItems:"center", gap:16, padding: focusMode?"20px 26px":"16px 22px", border:`1px solid ${bd}`, background:bg,
              borderRadius:4, cursor:isRevealed?"default":"pointer", textAlign:"left", fontFamily:"inherit" }}>
              <span style={{ width: focusMode?34:30, height: focusMode?34:30, borderRadius:3, flexShrink:0, background:badge, color:badgeCol,
                fontWeight:700, fontSize: focusMode?16:14, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {isRevealed && isAns ? "✓" : isRevealed && isChosen ? "✕" : String.fromCharCode(65+ci)}
              </span>
              <span style={{ fontSize: focusMode?20:17, color:col, lineHeight:1.8 }}><Ruby segments={seg} size={focusMode?19.5:16.5} /></span>
            </button>
          );
        })}
      </div>
      {isRevealed && (
        <div style={{ marginTop:20, padding:"12px 16px", borderRadius:6,
          background: chosenIdx===q.answer ? "#f0fdf4" : "#fef2f2",
          border:`1px solid ${chosenIdx===q.answer ? "#16a34a" : "#dc2626"}`,
          color: chosenIdx===q.answer ? "#15803d" : "#dc2626", fontSize: focusMode?16:14, fontWeight:600,
          maxWidth: focusMode?960:760 }}>
          {chosenIdx===q.answer ? "○ 正解です！" : `✕ 不正解。正解は ${String.fromCharCode(65+q.answer)} です。`}
        </div>
      )}
    </>
  );

  if (focusMode) {
    return (
      <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:200, display:"flex",
        flexDirection:"column", fontFamily:"'Noto Sans JP','Noto Sans Thai',serif" }}>
        <div style={{ flex:1, overflowY:"auto", padding:"48px 64px 110px", position:"relative" }}>
          <button onClick={() => setFocusMode(false)} title="ย่อกลับ" style={{ position:"absolute", top:24, right:24,
            width:40, height:40, borderRadius:8, border:"1px solid #d1d5db", background:"#fff", color:"#374151",
            fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>⤡</button>
          <div style={{ fontSize:13, color:"#9ca3af", marginBottom:14 }}>問題 {current+1} / {questions.length}</div>
          {questionBlock}
        </div>
        <button onClick={next} disabled={!isRevealed} style={{ position:"fixed", bottom:24, right:24,
          padding:"13px 34px", border:"none", borderRadius:99, background:isRevealed?"#1a56db":"#d1d5db",
          color:"#fff", fontWeight:700, fontSize:15, cursor:isRevealed?"pointer":"default", fontFamily:"inherit",
          boxShadow:"0 4px 14px rgba(0,0,0,.18)" }}>
          {current===questions.length-1 ? "結果を見る" : "次へ →"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", height:"calc(100vh - 64px)", background:"#fff", overflow:"hidden",
      fontFamily:"'Noto Sans JP','Noto Sans Thai',serif" }}>
      <div style={{ width:64, borderRight:"1px solid #d1d5db", display:"flex", flexDirection:"column",
        flexShrink:0, background:"#fafafa" }}>
        <div style={{ padding:"10px 6px 8px", borderBottom:"1px solid #e5e7eb", textAlign:"center" }}>
          <div style={{ fontSize:9.5, color:info.c, fontWeight:700, lineHeight:1.3 }}>{info.th}</div>
          <div style={{ fontSize:10, color:"#6b7280", marginTop:3 }}>{answeredCount}/{questions.length}</div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"8px 6px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} style={btnSt(i)}>{i+1}</button>
            ))}
          </div>
        </div>
        <div style={{ padding:6 }}>
          <button onClick={backToSelect} title="กลับไปเลือกหมวด" style={{ width:"100%", padding:"7px 0",
            border:"1px solid #d1d5db", borderRadius:5, background:"#fff", color:"#6b7280", fontSize:15,
            cursor:"pointer", fontFamily:"inherit" }}>←</button>
        </div>
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"10px 32px", borderBottom:"1px solid #d1d5db", background:"#fff" }}>
          <div style={{ fontSize:14, color:"#374151" }}>問題 <strong>{current+1}</strong> / {questions.length}</div>
          <div style={{ fontSize:12.5, color:"#9ca3af" }}>タイマーなし · 即時採点</div>
        </div>
        <div style={{ height:3, background:"#f3f4f6" }}>
          <div style={{ width:`${((current+1)/questions.length)*100}%`, height:"100%", background:info.c, transition:"width .3s" }} />
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"32px 56px 90px", position:"relative" }}>
          <button onClick={() => setFocusMode(true)} title="ขยายเต็มจอ" style={{ position:"absolute", top:18, right:24,
            width:32, height:32, borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#6b7280",
            fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>⤢</button>
          {questionBlock}
        </div>
        <button onClick={next} disabled={!isRevealed} style={{ position:"absolute", bottom:20, right:24,
          padding:"12px 30px", border:"none", borderRadius:99, background:isRevealed?"#1a56db":"#d1d5db",
          color:"#fff", fontWeight:700, fontSize:14, cursor:isRevealed?"pointer":"default", fontFamily:"inherit",
          boxShadow:"0 4px 14px rgba(0,0,0,.15)" }}>
          {current===questions.length-1 ? "結果を見る" : "次へ →"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   EXAM (ExamScreenV3)
   ============================================================ */
function drawExamQuestions(n) {
  const cats = Object.keys(CAT_INFO);
  const pools = {};
  cats.forEach((c) => { pools[c] = shuffle(EXAM_BANK.filter((q) => q.cat === c)); });
  const perCat = Math.floor(n / cats.length);
  const result = [];
  cats.forEach((c) => result.push(...pools[c].slice(0, perCat)));
  const remaining = n - result.length;
  const extra = shuffle(EXAM_BANK.filter((q) => !result.includes(q)));
  result.push(...extra.slice(0, remaining));
  return shuffle(result);
}
function CatBar({ label, jp, correct, total, color }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5, color:"#374151" }}>
        <span>{label} <span style={{ color:"#9ca3af", fontSize:11 }}>{jp}</span></span>
        <span style={{ fontWeight:700 }}>{correct}/{total} ({pct}%)</span>
      </div>
      <div style={{ height:10, background:"#f3f4f6", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width .5s" }} />
      </div>
    </div>
  );
}
function WrongPopup({ q, userAns, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:100,
      display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:10, padding:"28px 32px", maxWidth:520, width:"90%",
        maxHeight:"80vh", overflowY:"auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:12 }}>{CAT_INFO[q.cat].th} · {CAT_INFO[q.cat].jp}</div>
        <div style={{ fontSize:16, lineHeight:2.4, borderBottom:"1px solid #e5e7eb", paddingBottom:16, marginBottom:16 }}>
          <Ruby segments={q.ruby} size={16} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {q.choices.map((seg, ci) => {
            const isAns = ci === q.answer, isUser = ci === userAns;
            let bg="#fff", bd="#d1d5db", col="#374151";
            if (isAns) { bg="#dcfce7"; bd="#16a34a"; col="#15803d"; }
            if (isUser && !isAns) { bg="#fee2e2"; bd="#dc2626"; col="#dc2626"; }
            return (
              <div key={ci} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px",
                border:`1px solid ${bd}`, background:bg, borderRadius:6 }}>
                <span style={{ width:26, height:26, borderRadius:3, background:bd, color:"#fff", fontWeight:700,
                  fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {String.fromCharCode(65+ci)}
                </span>
                <span style={{ fontSize:14.5, color:col, lineHeight:1.8 }}><Ruby segments={seg} size={14} /></span>
                {isAns && <span style={{ marginLeft:"auto", color:"#15803d", fontWeight:700, fontSize:13 }}>✓ 正解</span>}
                {isUser && !isAns && <span style={{ marginLeft:"auto", color:"#dc2626", fontWeight:700, fontSize:13 }}>✕ あなた</span>}
              </div>
            );
          })}
        </div>
        <button onClick={onClose} style={{ marginTop:20, width:"100%", padding:"10px", border:"1px solid #d1d5db",
          borderRadius:6, background:"#fff", cursor:"pointer", fontSize:14, fontFamily:"inherit", color:"#374151" }}>閉じる</button>
      </div>
    </div>
  );
}

function ExamScreen({ goTab }) {
  const [questions, setQuestions] = useState(() => drawExamQuestions(20));
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState({});
  const [timeLeft, setTimeLeft] = useState(20*60);
  const [submitted, setSubmitted] = useState(false);
  const [popup, setPopup] = useState(null);
  const [saved, setSaved] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => { if (t<=1){clearInterval(timerRef.current);setSubmitted(true);return 0;} return t-1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [submitted]);

  const restart = useCallback(() => {
    clearInterval(timerRef.current);
    setQuestions(drawExamQuestions(20));
    setCurrent(0); setAnswers({}); setFlags({});
    setTimeLeft(20*60); setSubmitted(false); setPopup(null); setSaved(false);
  }, []);

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const pick = (ci) => { if (submitted) return; setAnswers((a) => ({...a,[current]:ci})); };
  const toggleFlag = () => { if (submitted) return; setFlags((f) => ({...f,[current]:!f[current]})); };
  const submit = () => { clearInterval(timerRef.current); setSubmitted(true); };
  const answeredCount = Object.keys(answers).length;
  const score = Object.entries(answers).filter(([i,v]) => questions[i]?.answer===v).length;
  const urgent = timeLeft <= 60;

  const statusOf = (i) => {
    if (i===current && !submitted) return "current";
    if (flags[i]) return "flagged";
    if (answers[i]!==undefined) return "done";
    return "empty";
  };
  const btnSt = (i) => {
    const st = statusOf(i);
    const base = { width:"100%", height:28, borderRadius:4, border:"1px solid #bbb", background:"#fff",
      color:"#222", fontWeight:600, fontSize:12, cursor:submitted?"default":"pointer", display:"flex",
      alignItems:"center", justifyContent:"center", position:"relative", fontFamily:"inherit" };
    if (st==="current") return {...base, border:"2px solid #1a56db", background:"#ebf0ff", color:"#1a56db"};
    if (st==="flagged")  return {...base, border:"1px solid #d97706", background:"#fffbeb", color:"#92400e"};
    if (st==="done")     return {...base, border:"1px solid #16a34a", background:"#f0fdf4", color:"#15803d"};
    return base;
  };
  const catStats = () => {
    const st = {};
    Object.keys(CAT_INFO).forEach((k) => { st[k] = { correct:0, total:0 }; });
    questions.forEach((q,i) => { st[q.cat].total++; if (answers[i]===q.answer) st[q.cat].correct++; });
    return st;
  };
  const saveWrong = async () => {
    const session = getSession();
    if (!session) return;
    const wrong = questions.filter((_, i) => answers[i] !== questions[i].answer);
    const rows = wrong.map((q) => ({ username: session.username, question_data: q }));
    if (rows.length > 0) await sbInsert("wrong_answers", rows);
    setSaved(true);
  };

  if (submitted) {
    const pct = Math.round((score/questions.length)*100);
    const passed = pct >= 75;
    const stats = catStats();
    const wrongIdxs = questions.map((_,i)=>i).filter((i)=>answers[i]!==questions[i].answer);
    return (
      <div style={{ padding:"32px 16px", fontFamily:"'Noto Sans JP','Noto Sans Thai',serif" }}>
        {popup!==null && <WrongPopup q={questions[popup]} userAns={answers[popup]} onClose={()=>setPopup(null)} />}
        <div style={{ maxWidth:660, margin:"0 auto" }}>
          <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:8, padding:"36px 40px",
            textAlign:"center", marginBottom:20 }}>
            <div style={{ fontSize:14, color:"#6b7280", marginBottom:6 }}>試験終了 / ผลการสอบ</div>
            <div style={{ fontSize:58, fontWeight:700, color:passed?"#15803d":"#dc2626", margin:"8px 0" }}>{score} / {questions.length}</div>
            <div style={{ fontSize:26, color:"#374151", marginBottom:14 }}>{pct}%</div>
            <div style={{ display:"inline-block", padding:"6px 28px", borderRadius:4,
              background:passed?"#dcfce7":"#fee2e2", color:passed?"#15803d":"#dc2626", fontWeight:700, fontSize:17 }}>
              {passed ? "合格 / ผ่าน" : "不合格 / ไม่ผ่าน"}
            </div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:8 }}>เกณฑ์ผ่าน 75%</div>
          </div>
          <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:8, padding:"24px 28px", marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:18, color:"#111" }}>カテゴリー別成績 / ผลแยกหมวด</div>
            {Object.entries(stats).map(([k,v]) => (
              <CatBar key={k} label={CAT_INFO[k].th} jp={CAT_INFO[k].jp} correct={v.correct} total={v.total} color={CAT_INFO[k].c} />
            ))}
          </div>
          {wrongIdxs.length>0 && (
            <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:8, padding:"24px 28px", marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontWeight:700, fontSize:15, color:"#111" }}>間違えた問題 / ข้อที่ผิด ({wrongIdxs.length} ข้อ)</div>
                <button onClick={saveWrong} disabled={saved} style={{ padding:"6px 16px",
                  border:`1px solid ${saved?"#16a34a":"#1a56db"}`, background:saved?"#dcfce7":"#ebf0ff",
                  color:saved?"#15803d":"#1a56db", borderRadius:5, fontSize:12.5, cursor:saved?"default":"pointer", fontFamily:"inherit" }}>
                  {saved ? "✓ 保存済み" : "📥 保存して復習"}
                </button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {wrongIdxs.map((i) => (
                  <button key={i} onClick={()=>setPopup(i)} style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"center", padding:"10px 14px", border:"1px solid #fecaca", background:"#fff5f5",
                    borderRadius:6, cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                    <span style={{ fontSize:13.5, color:"#374151" }}>
                      問題 {i+1}
                      <span style={{ marginLeft:10, fontSize:11.5, background:CAT_INFO[questions[i].cat].c+"22",
                        color:CAT_INFO[questions[i].cat].c, padding:"2px 8px", borderRadius:99, fontWeight:600 }}>
                        {CAT_INFO[questions[i].cat].th}
                      </span>
                    </span>
                    <span style={{ color:"#9ca3af", fontSize:12 }}>タップして確認 →</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:8, padding:"24px 28px", marginBottom:24 }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#111", marginBottom:14 }}>全問題 / รายข้อ</div>
            {questions.map((q,i) => {
              const ok = answers[i]===q.answer;
              return (
                <div key={i} onClick={()=>!ok && setPopup(i)} style={{ display:"flex", justifyContent:"space-between",
                  padding:"6px 0", borderBottom:"1px solid #f3f4f6", fontSize:13.5, color:"#374151",
                  cursor: ok?"default":"pointer" }}>
                  <span>問題 {i+1}<span style={{ marginLeft:8, fontSize:11, color:CAT_INFO[q.cat].c }}>{CAT_INFO[q.cat].jp}</span></span>
                  <span style={{ color:ok?"#15803d":"#dc2626", fontWeight:700 }}>
                    {ok?"○":"✕"} 正解: {String.fromCharCode(65+q.answer)}
                    {!ok && <span style={{ color:"#9ca3af", fontSize:11, marginLeft:6 }}>→ 確認</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <button onClick={restart} style={{ width:"100%", padding:"13px", border:"none", borderRadius:6,
            background:"#1a56db", color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>
            もう一度受験する / ทำใหม่อีกครั้ง
          </button>
          <button onClick={() => goTab("home")} style={{ width:"100%", padding:"11px", marginTop:10, border:"1px solid #d1d5db",
            borderRadius:6, background:"#fff", color:"#374151", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
            หน้าแรก / ホームへ
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const questionBlock = (
    <>
      <div style={{ fontSize: focusMode?24:19, lineHeight:2.7, color:"#111", borderBottom:"1px solid #e5e7eb",
        paddingBottom:26, marginBottom:30, maxWidth: focusMode?960:760 }}>
        <Ruby segments={q.ruby} size={focusMode?26:20} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: focusMode?"20px 56px":"16px 44px",
        maxWidth: focusMode?960:760 }}>
        {q.choices.map((seg, ci) => {
          const chosen = answers[current]===ci;
          return (
            <button key={ci} onClick={() => pick(ci)} style={{ display:"flex", alignItems:"center", gap:16,
              padding: focusMode?"20px 26px":"16px 22px", border:`1px solid ${chosen?"#1a56db":"#d1d5db"}`,
              background:chosen?"#ebf0ff":"#fff", borderRadius:4, cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
              <span style={{ width: focusMode?34:30, height: focusMode?34:30, borderRadius:3, flexShrink:0,
                background:chosen?"#1a56db":"#f3f4f6", color:chosen?"#fff":"#374151", fontWeight:700,
                fontSize: focusMode?16:14, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {String.fromCharCode(65+ci)}
              </span>
              <span style={{ fontSize: focusMode?20:17, color:chosen?"#1a3a8f":"#111", lineHeight:1.8 }}>
                <Ruby segments={seg} size={focusMode?19.5:16.5} />
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  if (focusMode) {
    return (
      <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:200, display:"flex",
        flexDirection:"column", fontFamily:"'Noto Sans JP','Noto Sans Thai',serif" }}>
        <div style={{ flex:1, overflowY:"auto", padding:"48px 64px 110px", position:"relative" }}>
          <div style={{ position:"absolute", top:24, right:24, display:"flex", gap:8 }}>
            <button onClick={toggleFlag} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px",
              border:`1px solid ${flags[current]?"#d97706":"#d1d5db"}`, background:flags[current]?"#fffbeb":"#fff",
              color:flags[current]?"#92400e":"#6b7280", borderRadius:6, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              🚩 {flags[current]?"フラグ解除":"フラグ"}
            </button>
            <button onClick={() => setFocusMode(false)} title="ย่อกลับ" style={{ width:40, height:40, borderRadius:8,
              border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:18, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}>⤡</button>
          </div>
          <div style={{ fontSize:13, color: urgent?"#dc2626":"#9ca3af", fontWeight: urgent?700:400, marginBottom:14 }}>
            問題 {current+1} / {questions.length} ・ 残り時間 {fmt(timeLeft)}
          </div>
          {questionBlock}
        </div>
        <div style={{ position:"fixed", bottom:24, left:24, right:24, display:"flex",
          justifyContent:"space-between", alignItems:"center", pointerEvents:"none" }}>
          <button onClick={() => setCurrent((c)=>Math.max(0,c-1))} disabled={current===0} style={{ padding:"12px 26px",
            border:"1px solid #d1d5db", borderRadius:99, background:current===0?"#f3f4f6":"#fff",
            color:current===0?"#9ca3af":"#374151", cursor:current===0?"default":"pointer", fontSize:14,
            fontFamily:"inherit", boxShadow:"0 4px 14px rgba(0,0,0,.12)", pointerEvents:"auto" }}>← 前へ</button>
          <div style={{ display:"flex", gap:10, pointerEvents:"auto" }}>
            {(current===questions.length-1 || answeredCount===questions.length) && (
              <button onClick={submit} style={{ padding:"12px 30px", border:"none", borderRadius:99,
                background:"#16a34a", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer",
                fontFamily:"inherit", boxShadow:"0 4px 14px rgba(0,0,0,.18)" }}>提出する</button>
            )}
            <button onClick={() => setCurrent((c)=>Math.min(questions.length-1,c+1))} disabled={current===questions.length-1}
              style={{ padding:"12px 30px", border:"none", borderRadius:99,
                background:current===questions.length-1?"#d1d5db":"#1a56db", color:"#fff", fontWeight:700,
                cursor:current===questions.length-1?"default":"pointer", fontSize:14, fontFamily:"inherit",
                boxShadow:"0 4px 14px rgba(0,0,0,.18)" }}>次へ →</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", height:"calc(100vh - 64px)", background:"#fff", overflow:"hidden",
      fontFamily:"'Noto Sans JP','Noto Sans Thai',serif" }}>
      <div style={{ width:64, borderRight:"1px solid #d1d5db", display:"flex", flexDirection:"column",
        flexShrink:0, background:"#fafafa" }}>
        <div style={{ padding:"10px 6px 8px", borderBottom:"1px solid #e5e7eb", textAlign:"center" }}>
          <div style={{ fontSize:10, color:"#6b7280" }}>{answeredCount}/{questions.length}</div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"8px 6px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {questions.map((_,i) => (
              <button key={i} onClick={() => setCurrent(i)} style={btnSt(i)}>
                {i+1}{flags[i] && <span style={{ position:"absolute", top:-4, right:1, fontSize:7 }}>🚩</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding:"8px 6px", borderTop:"1px solid #e5e7eb", display:"flex",
          flexDirection:"column", gap:4, alignItems:"center" }}>
          {[["#ebf0ff","2px solid #1a56db"],["#f0fdf4","1px solid #16a34a"],
            ["#fffbeb","1px solid #d97706"],["#fff","1px solid #bbb"]].map(([bg,bd], idx) => (
            <span key={idx} style={{ width:12, height:12, background:bg, border:bd, borderRadius:2 }} />
          ))}
        </div>
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 32px",
          borderBottom:"1px solid #d1d5db", background:"#fff" }}>
          <div style={{ fontSize:14, color:"#374151" }}>
            問題 <strong>{current+1}</strong> / {questions.length}
            <span style={{ marginLeft:12, fontSize:11.5, background:CAT_INFO[q.cat].c+"18", color:CAT_INFO[q.cat].c,
              padding:"2px 9px", borderRadius:99, fontWeight:600 }}>{CAT_INFO[q.cat].jp}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, color:urgent?"#dc2626":"#374151", fontWeight:urgent?700:400 }}>
              <span style={{ fontSize:13 }}>残り時間</span>
              <span style={{ fontFamily:"monospace", fontSize:17, letterSpacing:1 }}>{fmt(timeLeft)}</span>
            </div>
            <button onClick={toggleFlag} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 13px",
              border:`1px solid ${flags[current]?"#d97706":"#d1d5db"}`, background:flags[current]?"#fffbeb":"#fff",
              color:flags[current]?"#92400e":"#6b7280", borderRadius:4, fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>
              🚩 {flags[current]?"フラグ解除":"フラグ"}
            </button>
          </div>
        </div>
        <div style={{ height:3, background:"#f3f4f6" }}>
          <div style={{ width:`${((current+1)/questions.length)*100}%`, height:"100%", background:"#1a56db", transition:"width .3s" }} />
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"32px 56px 90px", position:"relative" }}>
          <button onClick={() => setFocusMode(true)} title="ขยายเต็มจอ" style={{ position:"absolute", top:18, right:24,
            width:32, height:32, borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#6b7280",
            fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>⤢</button>
          {questionBlock}
        </div>
        <div style={{ position:"absolute", bottom:20, left:24, right:24, display:"flex",
          justifyContent:"space-between", alignItems:"center" }}>
          <button onClick={() => setCurrent((c)=>Math.max(0,c-1))} disabled={current===0} style={{ padding:"11px 24px",
            border:"1px solid #d1d5db", borderRadius:99, background:current===0?"#f3f4f6":"#fff",
            color:current===0?"#9ca3af":"#374151", cursor:current===0?"default":"pointer", fontSize:14,
            fontFamily:"inherit", boxShadow:"0 4px 14px rgba(0,0,0,.12)" }}>← 前へ</button>
          <div style={{ display:"flex", gap:10 }}>
            {(current===questions.length-1 || answeredCount===questions.length) && (
              <button onClick={submit} style={{ padding:"11px 28px", border:"none", borderRadius:99,
                background:"#16a34a", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer",
                fontFamily:"inherit", boxShadow:"0 4px 14px rgba(0,0,0,.18)" }}>提出する</button>
            )}
            <button onClick={() => setCurrent((c)=>Math.min(questions.length-1,c+1))} disabled={current===questions.length-1}
              style={{ padding:"11px 28px", border:"none", borderRadius:99,
                background:current===questions.length-1?"#d1d5db":"#1a56db", color:"#fff", fontWeight:700,
                cursor:current===questions.length-1?"default":"pointer", fontSize:14, fontFamily:"inherit",
                boxShadow:"0 4px 14px rgba(0,0,0,.18)" }}>次へ →</button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   ROUTE PROTECTION SYSTEM
   - useSessionGuard: เช็ค session ทุก 5 นาที ถ้าผิดปกติ kick ออกทันที
   - ProtectedRoute: wrapper บล็อกหน้าหลักถ้าไม่มี session ถูกต้อง
   ============================================================ */

const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 นาที

async function validateSession() {
  try {
    const session = getSession();
    if (!session) return { valid: false, reason: "no_session" };
    if (session.role === "admin") return { valid: true };

    const user = await sbSelectOne("users", `username=eq.${encodeURIComponent(session.username)}&select=status,approved_at`);
    if (!user) return { valid: false, reason: "user_not_found" };

    const st = getEffectiveStatus(user);
    if (st !== "active") return { valid: false, reason: st };
    return { valid: true };
  } catch {
    return { valid: false, reason: "error" };
  }
}

const REASON_MSG = {
  no_session:     "กรุณาเข้าสู่ระบบก่อนใช้งาน",
  user_not_found: "ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่",
  pending:        "บัญชีของคุณยังรอการอนุมัติจากแอดมิน",
  rejected:       "คำขอสมัครของคุณถูกปฏิเสธ กรุณาติดต่อแอดมิน",
  banned:         "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อแอดมิน",
  expired:        "บัญชีของคุณหมดอายุแล้ว กรุณาติดต่อแอดมิน",
  error:          "เกิดข้อผิดพลาด กรุณาเข้าสู่ระบบใหม่",
};

function useSessionGuard(onInvalid) {
  useEffect(() => {
    const check = async () => {
      const result = await validateSession();
      if (!result.valid) {
        clearSession();
        onInvalid(REASON_MSG[result.reason] || REASON_MSG.error);
      }
    };
    check();
    const interval = setInterval(check, SESSION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);
}

function ProtectedRoute({ onLogout, children }) {
  const [blocked, setBlocked] = useState(false);
  const [reason, setReason] = useState("");

  useSessionGuard((msg) => {
    setBlocked(true);
    setReason(msg);
    clearSession();
  });

  if (blocked) {
    return (
      <div style={{ minHeight:"100vh", background:"#f9fafb", display:"flex", alignItems:"center",
        justifyContent:"center", fontFamily:"'Noto Sans JP','Noto Sans Thai',serif", padding:20 }}>
        <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:8,
          padding:"40px 36px", maxWidth:380, width:"100%", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:8 }}>
            ไม่สามารถเข้าใช้งานได้
          </div>
          <div style={{ fontSize:13.5, color:"#6b7280", marginBottom:24, lineHeight:1.7 }}>
            {reason}
          </div>
          <button onClick={onLogout} style={{ width:"100%", padding:"12px", border:"none",
            borderRadius:6, background:"#1a56db", color:"#fff", fontWeight:700, fontSize:14,
            cursor:"pointer", fontFamily:"inherit" }}>
            กลับไปหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return children;
}

/* ============================================================
   TOKKUPRO APP ROOT (สำหรับ user ที่ login สำเร็จแล้ว)
   ============================================================ */
function TokkuProApp({ currentUser, onLogout }) {
  const [tab, setTab] = useState("home");
  return (
    <ProtectedRoute onLogout={onLogout}>
      <Shell tab={tab} setTab={setTab} currentUser={currentUser} onLogout={onLogout}>
        {tab==="home" && <HomeScreen goTab={setTab} />}
        {tab==="minitest" && <MiniTestScreen goTab={setTab} />}
        {tab==="exam" && <ExamScreen goTab={setTab} />}
        {tab==="vocab" && <VocabScreen />}
        {tab==="profile" && <ProfileScreen />}
      </Shell>
    </ProtectedRoute>
  );
}
/* ============================================================
   TokkuPro — Auth + Admin System (Supabase)
   - Admin: บัญชีตายตัวในโค้ด ไม่ผ่านสมัคร ไม่หมดอายุ
   - User: สมัครเอง → รออนุมัติ → admin อนุมัติ/ปฏิเสธ/แบน/ขยายเวลา
   - หมดอายุ 150 วัน (5 เดือน) จากวันที่ "ได้รับอนุมัติ"
   - ข้อมูลเก็บใน Supabase (sync ข้ามเครื่องได้)
   ============================================================ */

const ADMIN_USERNAME = "Armlovekarnt258";
const ADMIN_PASSWORD = "Am0998397158";
const EXPIRY_DAYS = 150;
const WARN_DAYS = 7;

function daysBetween(a, b) { return Math.floor((b - a) / (1000*60*60*24)); }

function fmtDate(d) {
  return new Date(d).toLocaleDateString("th-TH", { day:"numeric", month:"long", year:"numeric" });
}
function fmtDateShort(d) {
  return new Date(d).toLocaleDateString("th-TH", { day:"numeric", month:"short", year:"2-digit" }) +
    " " + new Date(d).toLocaleTimeString("th-TH", { hour:"2-digit", minute:"2-digit" });
}

function getEffectiveStatus(user) {
  if (user.status === "banned" || user.status === "rejected" || user.status === "pending") return user.status;
  if (user.approved_at) {
    const expiry = new Date(user.approved_at);
    expiry.setDate(expiry.getDate() + EXPIRY_DAYS);
    if (new Date() > expiry) return "expired";
  }
  return "active";
}
function getExpiryDate(user) {
  if (!user.approved_at) return null;
  const d = new Date(user.approved_at);
  d.setDate(d.getDate() + EXPIRY_DAYS);
  return d;
}

const STATUS_LABEL = {
  pending:  { th:"รออนุมัติ",     c:"#d97706", bg:"#fffbeb" },
  active:   { th:"ใช้งานได้",     c:"#16a34a", bg:"#f0fdf4" },
  rejected: { th:"ถูกปฏิเสธ",     c:"#6b7280", bg:"#f3f4f6" },
  banned:   { th:"ถูกแบน",        c:"#dc2626", bg:"#fef2f2" },
  expired:  { th:"หมดอายุ",       c:"#9333ea", bg:"#faf5ff" },
};

/* ============================================================
   ROOT
   ============================================================ */
function AuthAdminSystem({ onExitToEntry }) {
  const [session, setSession] = useState(getSession());
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSession();
    if (s && s.role === "user") {
      const fresh = getUsers().find((u) => u.username === s.username);
      if (fresh) {
        const st = getEffectiveStatus(fresh);
        if (st !== "active") {
          clearSession();
          setSession(null);
          if (st === "expired") setError(`บัญชีของคุณหมดอายุแล้วเมื่อ ${fmtDate(getExpiryDate(fresh))}`);
          else if (st === "banned") setError("บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อแอดมิน");
          else if (st === "pending") setError("บัญชีของคุณยังรอการอนุมัติจากแอดมิน");
          else if (st === "rejected") setError("คำขอสมัครของคุณถูกปฏิเสธ กรุณาติดต่อแอดมิน");
        }
      }
    }
  }, []);

  const handleLogout = () => { clearSession(); setSession(null); setError(""); onExitToEntry(); };

  if (!session) return <LoginScreen onSuccess={(s) => { setSession(s); setError(""); }} initialError={error} />;
  if (session.role === "admin") return <AdminPanel onLogout={handleLogout} />;
  // user login สำเร็จ → ส่งกลับไป TokkuProRoot ให้จัดการ stage "app"
  return <TokkuProApp onLogout={handleLogout} currentUser={session} />;
}

/* ============================================================
   LOGIN / REGISTER
   ============================================================ */
function LoginScreen({ onSuccess, initialError }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError || "");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const adminSession = { username: ADMIN_USERNAME, role: "admin" };
      setSessionStore(adminSession);
      setLoading(false);
      onSuccess(adminSession);
      return;
    }

    const timeoutId = setTimeout(() => {
      setError("⏳ กำลังเชื่อมต่อ... กรุณารอสักครู่");
    }, 8000);

    try {
      const found = await sbSelectOne("users", `username=eq.${encodeURIComponent(username.trim())}`);
      clearTimeout(timeoutId);

      if (!found) { setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"); setLoading(false); return; }

      const valid = await verifyPassword(password, found.password_hash);
      if (!valid) { setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"); setLoading(false); return; }

      const st = getEffectiveStatus(found);
      if (st === "banned")   { setError("บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อแอดมิน"); setLoading(false); return; }
      if (st === "expired")  { setError(`บัญชีของคุณหมดอายุแล้ว กรุณาติดต่อแอดมิน`); setLoading(false); return; }

      setSessionStore(found);
      setLoading(false);
      onSuccess(found);
    } catch {
      clearTimeout(timeoutId);
      setError("ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต");
      setLoading(false);
    }
  };

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:13, color:"#9ca3af" }}>特定技能2号 建設</div>
          <h1 style={{ fontSize:22, color:"#111", margin:"4px 0 0", fontWeight:700 }}>TokkuPro</h1>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Field label="ชื่อผู้ใช้" value={username} onChange={setUsername} />
          <Field label="รหัสผ่าน" type="password" value={password} onChange={setPassword} />
          {error && <ErrorBox text={error} />}
          <button onClick={handleLogin} disabled={loading} style={primaryBtnStyle}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </div>
        <div style={{ textAlign:"center", marginTop:20, fontSize:12.5, color:"#9ca3af", lineHeight:1.7 }}>
          ได้รับบัญชีจากแอดมินเท่านั้น<br/>
          หากยังไม่มีบัญชี กรุณาติดต่อแอดมิน
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type="text" }) {
  return (
    <div>
      <label style={{ fontSize:12.5, color:"#6b7280", display:"block", marginBottom:5 }}>{label}</label>
      <input type={type} value={value} onChange={(e)=>onChange(e.target.value)}
        style={{ width:"100%", padding:"10px 14px", border:"1px solid #d1d5db", borderRadius:6,
          fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none" }} />
    </div>
  );
}
function ErrorBox({ text }) {
  return (
    <div style={{ background:"#fef2f2", border:"1px solid #dc2626", borderRadius:6,
      padding:"9px 13px", fontSize:12.5, color:"#dc2626" }}>{text}</div>
  );
}

const shellStyle = { minHeight:"100vh", background:"#f9fafb",
  fontFamily:"'Noto Sans JP','Noto Sans Thai',serif", display:"flex",
  alignItems:"center", justifyContent:"center", padding:20 };
const cardStyle = { background:"#fff", border:"1px solid #d1d5db", borderRadius:8,
  padding:"36px 36px", maxWidth:400, width:"100%" };
const primaryBtnStyle = { marginTop:4, padding:"12px", border:"none", borderRadius:6,
  background:"#1a56db", color:"#fff", fontWeight:700, fontSize:14.5, cursor:"pointer",
  fontFamily:"inherit", width:"100%" };

/* ============================================================
   USER DASHBOARD (after login)
   ============================================================ */
function UserDashboard({ session, onLogout }) {
  const user = getUsers().find((u) => u.username === session.username);
  if (!user) return null;
  const daysLeft = getDaysLeft(user);
  const expiry = getExpiryDate(user);

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        {daysLeft !== null && daysLeft <= WARN_DAYS && (
          <div style={{ background:"#fffbeb", border:"1px solid #d97706", borderRadius:6,
            padding:"10px 14px", marginBottom:20, fontSize:13, color:"#92400e" }}>
            ⚠️ บัญชีของคุณจะหมดอายุในอีก {daysLeft} วัน ({fmtDate(expiry)})
          </div>
        )}
        <div style={{ textAlign:"center" }}>
          <div style={{ width:64, height:64, borderRadius:"50%", background:"#ebf0ff",
            margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>👤</div>
          <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>{user.full_name}</div>
          <div style={{ fontSize:13, color:"#1a56db", fontWeight:600, marginTop:4 }}>@{user.username}</div>
        </div>
        <div style={{ marginTop:20, padding:"14px 18px", background:"#f9fafb", borderRadius:6,
          fontSize:13, color:"#374151", display:"flex", flexDirection:"column", gap:8 }}>
          <Row label="วันที่สมัคร" value={fmtDate(user.created_at)} />
          <Row label="วันที่อนุมัติ" value={user.approved_at ? fmtDate(user.approved_at) : "-"} />
          <Row label="วันหมดอายุ" value={expiry ? fmtDate(expiry) : "-"} bold />
        </div>
        <button onClick={onLogout} style={{ marginTop:24, width:"100%", padding:"12px",
          border:"1px solid #d1d5db", borderRadius:6, background:"#fff", color:"#dc2626",
          fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
          ออกจากระบบ / ログアウト
        </button>
      </div>
    </div>
  );
}
function Row({ label, value, bold }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between" }}>
      <span style={{ color:"#9ca3af" }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

/* ============================================================
   ADMIN PANEL
   ============================================================ */
function AdminPanel({ onLogout }) {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [extendDays, setExtendDays] = useState(30);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ fullName:"", phone:"", username:"", password:"" });
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const refresh = async () => {
    setLoadingUsers(true);
    const data = await getUsers();
    setUsers(data);
    setLoadingUsers(false);
  };

  useEffect(() => { refresh(); }, []);

  const createAccount = async () => {
    setCreateMsg("");
    if (!newUser.fullName.trim() || !newUser.username.trim() || !newUser.password.trim()) {
      setCreateMsg("❌ กรุณากรอกข้อมูลให้ครบ"); return;
    }
    if (newUser.password.length < 4) { setCreateMsg("❌ รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร"); return; }
    setCreateLoading(true);
    try {
      const hash = await hashPassword(newUser.password);
      const ok = await sbInsert("users", {
        username: newUser.username.trim(),
        password_hash: hash,
        full_name: newUser.fullName.trim(),
        phone: newUser.phone.trim() || null,
        role: "user",
        status: "active",
        approved_at: new Date().toISOString(),
      });
      if (!ok) { setCreateMsg("❌ ชื่อผู้ใช้นี้มีอยู่แล้ว หรือเกิดข้อผิดพลาด"); setCreateLoading(false); return; }
      setCreateMsg(`✅ สร้างบัญชี "${newUser.username}" สำเร็จ!`);
      setNewUser({ fullName:"", phone:"", username:"", password:"" });
      await refresh();
    } catch {
      setCreateMsg("❌ เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
    setCreateLoading(false);
  };

  const updateUserDB = async (username, patch) => {
    await sbUpdate("users", `username=eq.${encodeURIComponent(username)}`, patch);
    await refresh();
    if (selected?.username === username) {
      const fresh = await sbSelectOne("users", `username=eq.${encodeURIComponent(username)}`);
      setSelected(fresh);
    }
  };

  const approve = (username) => updateUserDB(username, { status:"active", approved_at: new Date().toISOString() });
  const reject  = (username) => updateUserDB(username, { status:"rejected" });
  const ban     = (username) => updateUserDB(username, { status:"banned", banned_at: new Date().toISOString() });
  const unban   = (username) => updateUserDB(username, { status:"active", banned_at: null });
  const extend  = async (username, days) => {
    const u = users.find((x) => x.username === username);
    const base = u?.approved_at ? new Date(u.approved_at) : new Date();
    base.setDate(base.getDate() + Number(days));
    await updateUserDB(username, { approved_at: base.toISOString(), status:"active" });
  };

  const stats = { total: users.length };
  ["pending","active","rejected","banned","expired"].forEach((s) => {
    stats[s] = users.filter((u) => getEffectiveStatus(u) === s).length;
  });

  const filtered = users.filter((u) => {
    const st = getEffectiveStatus(u);
    const matchFilter = filter === "all" || st === filter;
    const matchSearch = !search.trim() ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  const FILTERS = [
    { k:"all", th:"ทั้งหมด" }, { k:"pending", th:"รออนุมัติ" },
    { k:"active", th:"ใช้งานได้" }, { k:"banned", th:"ถูกแบน" },
    { k:"expired", th:"หมดอายุ" }, { k:"rejected", th:"ปฏิเสธ" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb",
      fontFamily:"'Noto Sans JP','Noto Sans Thai',serif" }}>

      {selected && (
        <UserDetailModal user={selected} onClose={() => setSelected(null)}
          onApprove={approve} onReject={reject} onBan={ban} onUnban={unban}
          onExtend={extend} extendDays={extendDays} setExtendDays={setExtendDays} />
      )}

      {/* header */}
      <div style={{ background:"#fff", borderBottom:"1px solid #d1d5db", padding:"16px 24px",
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:12, color:"#9ca3af" }}>TokkuPro</div>
          <div style={{ fontSize:17, fontWeight:700, color:"#111" }}>👑 Admin Panel</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => { setShowCreate(!showCreate); setCreateMsg(""); }}
            style={{ padding:"8px 16px", border:"none", borderRadius:6,
              background: showCreate?"#374151":"#1a56db", color:"#fff", fontSize:13,
              fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            {showCreate ? "✕ ปิด" : "➕ สร้างบัญชี"}
          </button>
          <button onClick={onLogout} style={{ padding:"8px 18px", border:"1px solid #d1d5db",
            borderRadius:6, background:"#fff", color:"#dc2626", fontSize:13, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit" }}>ออกจากระบบ</button>
        </div>
      </div>

      {/* ---- Create Account Form ---- */}
      {showCreate && (
        <div style={{ maxWidth:980, margin:"0 auto", padding:"0 24px 0" }}>
          <div style={{ background:"#f0fdf4", border:"1px solid #16a34a", borderRadius:8,
            padding:"20px 24px", marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#15803d", marginBottom:16 }}>
              ➕ สร้างบัญชีผู้ใช้ใหม่
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              {[["ชื่อ-นามสกุล","fullName","text"],["เบอร์โทร (ไม่บังคับ)","phone","text"],
                ["ชื่อผู้ใช้ (username)","username","text"],["รหัสผ่าน","password","password"]
              ].map(([label, key, type]) => (
                <div key={key}>
                  <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>{label}</div>
                  <input type={type} value={newUser[key]}
                    onChange={(e) => setNewUser((p) => ({ ...p, [key]: e.target.value }))}
                    style={{ width:"100%", padding:"9px 12px", border:"1px solid #d1d5db",
                      borderRadius:6, fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }} />
                </div>
              ))}
            </div>
            {createMsg && (
              <div style={{ marginBottom:12, fontSize:13,
                color: createMsg.startsWith("✅") ? "#15803d" : "#dc2626", fontWeight:600 }}>
                {createMsg}
              </div>
            )}
            <button onClick={createAccount} disabled={createLoading}
              style={{ padding:"10px 28px", border:"none", borderRadius:6,
                background: createLoading?"#9ca3af":"#16a34a", color:"#fff",
                fontWeight:700, fontSize:14, cursor:createLoading?"default":"pointer",
                fontFamily:"inherit" }}>
              {createLoading ? "⏳ กำลังสร้าง..." : "✅ สร้างบัญชี"}
            </button>
            <div style={{ fontSize:11.5, color:"#6b7280", marginTop:10 }}>
              บัญชีที่สร้างจะ <strong>พร้อมใช้งานทันที</strong> (status: active) อายุ {EXPIRY_DAYS} วัน
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth:980, margin:"0 auto", padding:24 }}>

        {/* dashboard stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, marginBottom:24 }}>
          <StatCard label="ทั้งหมด" value={stats.total} color="#374151" />
          <StatCard label="รออนุมัติ" value={stats.pending} color="#d97706" />
          <StatCard label="ใช้งานได้" value={stats.active} color="#16a34a" />
          <StatCard label="ถูกแบน" value={stats.banned} color="#dc2626" />
          <StatCard label="หมดอายุ" value={stats.expired} color="#9333ea" />
          <StatCard label="ปฏิเสธ" value={stats.rejected} color="#6b7280" />
        </div>

        {/* pending approvals — highlight */}
        {stats.pending > 0 && (
          <div style={{ background:"#fffbeb", border:"1px solid #d97706", borderRadius:8,
            padding:"16px 20px", marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#92400e", marginBottom:10 }}>
              ⚠️ มีผู้สมัครรออนุมัติ {stats.pending} คน
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {users.filter((u) => getEffectiveStatus(u)==="pending").map((u) => (
                <div key={u.username} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", background:"#fff", borderRadius:6, padding:"10px 14px" }}>
                  <div>
                    <div style={{ fontSize:13.5, fontWeight:600, color:"#111" }}>{u.full_name}</div>
                    <div style={{ fontSize:11.5, color:"#9ca3af" }}>@{u.username} · {fmtDateShort(u.created_at)}</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => setSelected(u)} style={smallBtnStyle("#6b7280")}>ดูรายละเอียด</button>
                    <button onClick={() => approve(u.username)} style={smallBtnStyle("#16a34a", true)}>✓ อนุมัติ</button>
                    <button onClick={() => reject(u.username)} style={smallBtnStyle("#dc2626")}>✕ ปฏิเสธ</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* search + filter */}
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="ค้นหาชื่อหรือ username..."
            style={{ flex:1, minWidth:200, padding:"9px 14px", border:"1px solid #d1d5db", borderRadius:6,
              fontSize:13.5, fontFamily:"inherit", outline:"none" }} />
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {FILTERS.map((f) => (
              <button key={f.k} onClick={() => setFilter(f.k)} style={{
                padding:"7px 14px", borderRadius:99, fontSize:12.5, fontWeight:600, cursor:"pointer",
                border:`1px solid ${filter===f.k?"#1a56db":"#d1d5db"}`,
                background: filter===f.k?"#1a56db":"#fff", color: filter===f.k?"#fff":"#6b7280",
                fontFamily:"inherit" }}>{f.th}</button>
            ))}
          </div>
        </div>

        {/* user list table */}
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1.5fr", gap:10,
            padding:"10px 18px", background:"#f9fafb", borderBottom:"1px solid #e5e7eb",
            fontSize:11.5, color:"#9ca3af", fontWeight:700 }}>
            <span>ชื่อ / Username</span><span>วันที่สมัคร</span><span>สถานะ</span>
            <span>เหลือ</span><span style={{ textAlign:"right" }}>จัดการ</span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:"center", color:"#9ca3af", fontSize:13.5 }}>ไม่พบผู้ใช้</div>
          ) : filtered.map((u) => {
            const st = getEffectiveStatus(u);
            const sl = STATUS_LABEL[st];
            const dl = getDaysLeft(u);
            return (
              <div key={u.username} style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1.5fr",
                gap:10, padding:"12px 18px", borderBottom:"1px solid #f3f4f6", alignItems:"center", fontSize:13 }}>
                <div>
                  <div style={{ fontWeight:600, color:"#111" }}>{u.full_name}</div>
                  <div style={{ fontSize:11.5, color:"#9ca3af" }}>@{u.username}</div>
                </div>
                <span style={{ color:"#6b7280", fontSize:12.5 }}>{fmtDateShort(u.created_at)}</span>
                <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:99,
                  background:sl.bg, color:sl.c, fontSize:11.5, fontWeight:700, width:"fit-content" }}>{sl.th}</span>
                <span style={{ color: dl!==null && dl<=7 ? "#dc2626" : "#6b7280", fontSize:12.5 }}>
                  {dl!==null ? `${dl} วัน` : "-"}
                </span>
                <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                  <button onClick={() => setSelected(u)} style={smallBtnStyle("#1a56db")}>รายละเอียด</button>
                  {st === "active" && <button onClick={() => ban(u.username)} style={smallBtnStyle("#dc2626")}>แบน</button>}
                  {st === "banned" && <button onClick={() => unban(u.username)} style={smallBtnStyle("#16a34a")}>ปลดแบน</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
      padding:"14px 10px", textAlign:"center" }}>
      <div style={{ fontSize:22, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:10.5, color:"#9ca3af", marginTop:2 }}>{label}</div>
    </div>
  );
}
function smallBtnStyle(color, filled) {
  return {
    padding:"5px 11px", borderRadius:5, fontSize:11.5, fontWeight:600, cursor:"pointer",
    border:`1px solid ${color}`, background: filled?color:"#fff", color: filled?"#fff":color,
    fontFamily:"inherit",
  };
}

/* ============================================================
   USER DETAIL MODAL
   ============================================================ */
function UserDetailModal({ user, onClose, onApprove, onReject, onBan, onUnban, onExtend, extendDays, setExtendDays }) {
  const st = getEffectiveStatus(user);
  const sl = STATUS_LABEL[st];
  const dl = getDaysLeft(user);
  const expiry = getExpiryDate(user);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:100,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:10, padding:"28px 32px", maxWidth:440, width:"100%",
        maxHeight:"85vh", overflowY:"auto" }} onClick={(e) => e.stopPropagation()}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>{user.full_name}</div>
            <div style={{ fontSize:13, color:"#9ca3af" }}>@{user.username}</div>
          </div>
          <span style={{ padding:"4px 12px", borderRadius:99, background:sl.bg, color:sl.c,
            fontSize:12, fontWeight:700 }}>{sl.th}</span>
        </div>

        <div style={{ background:"#f9fafb", borderRadius:8, padding:"14px 18px", fontSize:13,
          display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
          <Row label="เบอร์โทร" value={user.phone || "-"} />
          <Row label="วันที่สมัคร" value={fmtDate(user.created_at)} />
          <Row label="วันที่อนุมัติ" value={user.approved_at ? fmtDate(user.approved_at) : "-"} />
          <Row label="วันหมดอายุ" value={expiry ? fmtDate(expiry) : "-"} bold />
          {dl !== null && <Row label="เหลือเวลา" value={dl >= 0 ? `${dl} วัน` : "หมดอายุแล้ว"} />}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {st === "pending" && (
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => onApprove(user.username)} style={{ ...modalBtnStyle, background:"#16a34a", color:"#fff" }}>
                ✓ อนุมัติ
              </button>
              <button onClick={() => onReject(user.username)} style={{ ...modalBtnStyle, background:"#fff",
                border:"1px solid #dc2626", color:"#dc2626" }}>
                ✕ ปฏิเสธ
              </button>
            </div>
          )}

          {(st === "active" || st === "expired") && (
            <>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <select value={extendDays} onChange={(e)=>setExtendDays(e.target.value)}
                  style={{ flex:1, padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:6,
                    fontSize:13, fontFamily:"inherit" }}>
                  <option value={30}>+30 วัน</option>
                  <option value={90}>+90 วัน</option>
                  <option value={150}>+150 วัน (ต่ออายุเต็ม)</option>
                </select>
                <button onClick={() => onExtend(user.username, extendDays)}
                  style={{ ...modalBtnStyle, background:"#1a56db", color:"#fff", width:"auto", padding:"9px 18px" }}>
                  ขยายเวลา
                </button>
              </div>
              {st === "active" && (
                <button onClick={() => onBan(user.username)} style={{ ...modalBtnStyle, background:"#fff",
                  border:"1px solid #dc2626", color:"#dc2626" }}>
                  🚫 แบนผู้ใช้นี้
                </button>
              )}
            </>
          )}

          {st === "banned" && (
            <button onClick={() => onUnban(user.username)} style={{ ...modalBtnStyle, background:"#16a34a", color:"#fff" }}>
              ปลดแบน
            </button>
          )}

          {st === "rejected" && (
            <button onClick={() => onApprove(user.username)} style={{ ...modalBtnStyle, background:"#16a34a", color:"#fff" }}>
              อนุมัติย้อนหลัง
            </button>
          )}

          <button onClick={onClose} style={{ ...modalBtnStyle, background:"#fff",
            border:"1px solid #d1d5db", color:"#374151" }}>ปิด</button>
        </div>
      </div>
    </div>
  );
}
const modalBtnStyle = { flex:1, padding:"10px", border:"none", borderRadius:6, fontWeight:700,
  fontSize:13.5, cursor:"pointer", fontFamily:"inherit", width:"100%" };

/* ============================================================
   GUEST MODE COMPONENTS
   ============================================================ */
const GUEST_VOCAB_VISIBLE = 3; // guest เห็นแค่ 3 คำแรก ที่เหลือล็อก
const GUEST_MINI_QUESTIONS = 5; // guest ทำได้แค่ 5 ข้อ (ไม่ใช่ 10)
const GUEST_ALLOWED_CAT = "team"; // guest เลือกได้แค่หมวดนี้

const MINI_QUESTIONS_TEAM = [
  { ruby:S([["職長","しょくちょう"],["とは、"],["労働","ろうどう"],["安全衛生","あんぜんえいせい"],["法","ほう"],["では、"],["工事現場","こうじげんば"],["における【　　】の"],["指導","しどう"],["監督者","かんとくしゃ"],["を"],["指","さ"],["します。"]]),
    choices:[S([["工事","こうじ"],["担任者","たんにんしゃ"]]),S([["主任","しゅにん"],["技術者","ぎじゅつしゃ"]]),S([["親方","おやかた"]]),S([["作業員","さぎょういん"]])], answer:3 },
  { ruby:S([["先輩","せんぱい"],["や、"],["目上","めうえ"],["の"],["人","ひと"],["から、「ご"],["苦労様","くろうさま"],["」といわれた"],["時","とき"],["のふさわしい"],["挨拶","あいさつ"],["はどれか。"]]),
    choices:[S([["ご"],["苦労様","くろうさま"],["です"]]),S([["ありがとうございます"]]),S([["お"],["疲","つか"],["れ"],["様","さま"],["です"]]),S([["ご"],["安全","あんぜん"],["に"]])], answer:1 },
  { ruby:S([["建設","けんせつ"],["キャリアアップシステムでは、"],["技能者","ぎのうしゃ"],["の"],["何","なに"],["を"],["登録","とうろく"],["しますか。"]]),
    choices:[S([["日本語能力試験","にほんごのうりょくしけん"],["（N1〜N4）"]]),S([["家族","かぞく"],["や"],["子供","こども"]]),S([["就業実績","しゅうぎょうじっせき"],["や"],["資格","しかく"]]),S([["健康状態","けんこうじょうたい"]])], answer:2 },
  { ruby:S([["朝礼","ちょうれい"],["で、"],["作業","さぎょう"],["を"],["安全","あんぜん"],["に"],["気持","きも"],["ちよく"],["進","すす"],["められるようにするために"],["行","おこな"],["うのはどれか。"]]),
    choices:[S([["現場","げんば"],["監督","かんとく"],["のあいさつ"]]),S([["ラジオ"],["体操","たいそう"]]),S([["安全","あんぜん"],["唱和","しょうわ"]]),S([["危険予知","きけんよち"],["活動","かつどう"],["（KY"],["活動","かつどう"],["）"]])], answer:0 },
  { ruby:S([["結束","けっそく"],["は",""],["鉄筋","てっきん"],["工事","こうじ"],["で"],["専用","せんよう"],["の"],["結束","けっそく"],["線","せん"],["を【　　】と"],["呼","よ"],["ばれる"],["道具","どうぐ"],["を"],["使","つか"],["います。"]]),
    choices:[S([["シノ"]]),S([["カッター"]]),S([["カケヤ"]]),S([["ハッカー"]])], answer:3 },
  { ruby:S([["工事","こうじ"],["全体","ぜんたい"],["をまとめる"],["会社","かいしゃ"],["は"],["通称","つうしょう"],["【　　】と"],["呼","よ"],["ばれます。"]]),
    choices:[S([["ゼネコン"]]),S([["サブコン"]]),S([["メーカー"]]),S([["デベロッパー"]])], answer:0 },
];

/* ============================================================
   SIGN UP PROMPT (reusable banner)
   ============================================================ */
function SignupPrompt({ text, onSignup }) {
  return (
    <div style={{ background:"#ebf0ff", border:"1px solid #1a56db", borderRadius:8,
      padding:"16px 20px", textAlign:"center", margin:"16px 0" }}>
      <div style={{ fontSize:24, marginBottom:6 }}>🔒</div>
      <div style={{ fontSize:13.5, color:"#1a3a8f", marginBottom:12, lineHeight:1.6 }}>{text}</div>
      <button onClick={onSignup} style={{ padding:"9px 24px", border:"none", borderRadius:6,
        background:"#1a56db", color:"#fff", fontWeight:700, fontSize:13.5, cursor:"pointer",
        fontFamily:"inherit" }}>
        สมัครสมาชิกฟรี
      </button>
    </div>
  );
}

/* ============================================================
   GUEST BANNER (sticky top, always visible to remind)
   ============================================================ */
function GuestBanner({ onSignup }) {
  return (
    <div style={{ background:"#fffbeb", borderBottom:"1px solid #d97706", padding:"8px 16px",
      display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12.5 }}>
      <span style={{ color:"#92400e" }}>👋 คุณกำลังใช้งานแบบทดลอง (Guest) — เนื้อหาบางส่วนถูกจำกัด</span>
      <button onClick={onSignup} style={{ border:"none", background:"#d97706", color:"#fff",
        padding:"4px 12px", borderRadius:5, fontSize:11.5, fontWeight:700, cursor:"pointer",
        fontFamily:"inherit", flexShrink:0, marginLeft:10 }}>
        สมัครเลย →
      </button>
    </div>
  );
}

/* ============================================================
   ENTRY: Login screen with "ลองใช้งานฟรี" button
   ============================================================ */
function EntryScreen({ onGuestEnter, onGoLogin }) {
  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb",
      fontFamily:"'Noto Sans JP','Noto Sans Thai',serif", display:"flex",
      alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:8,
        padding:"40px 36px", maxWidth:400, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:13, color:"#9ca3af" }}>特定技能2号 建設</div>
        <h1 style={{ fontSize:24, color:"#111", margin:"4px 0 24px", fontWeight:700 }}>TokkuPro</h1>

        <button onClick={onGoLogin} style={{ width:"100%", padding:"13px", border:"none", borderRadius:6,
          background:"#1a56db", color:"#fff", fontWeight:700, fontSize:14.5, cursor:"pointer",
          fontFamily:"inherit", marginBottom:10 }}>
          เข้าสู่ระบบ
        </button>

        <button onClick={onGuestEnter} style={{ width:"100%", padding:"13px", border:"1px solid #d1d5db",
          borderRadius:6, background:"#fff", color:"#374151", fontWeight:600, fontSize:14, cursor:"pointer",
          fontFamily:"inherit" }}>
          ลองใช้งานฟรี (ไม่ต้องเข้าสู่ระบบ)
        </button>

        <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:16, lineHeight:1.7 }}>
          บัญชีผู้ใช้ได้รับจากแอดมินเท่านั้น<br/>ติดต่อแอดมินเพื่อขอรับบัญชี
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   GUEST HOME
   ============================================================ */
function GuestHome({ goTab, onSignup }) {
  const cards = [
    { th:"แบบทดสอบย่อย", jp:"ミニテスト", desc:"ทดลอง 5 ข้อ (หมวดทีมเวิร์ค)", c:"#16a34a", k:"minitest", locked:false },
    { th:"สอบเสมือนจริง", jp:"模擬試験", desc:"ต้องสมัครสมาชิก", c:"#1a56db", k:"exam", locked:true },
    { th:"คำศัพท์", jp:"単語帳", desc:`ดูได้ ${GUEST_VOCAB_VISIBLE}/${VOCAB.length} คำ`, c:"#d97706", k:"vocab", locked:false },
    { th:"ผลการเรียน", jp:"学習成果", desc:"ต้องสมัครสมาชิก", c:"#9333ea", k:"profile", locked:true },
  ];
  return (
    <div style={{ padding:"32px 20px 24px", maxWidth:680, margin:"0 auto" }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:13, color:"#9ca3af" }}>特定技能2号 建設</div>
        <h1 style={{ fontSize:24, color:"#111", margin:"4px 0 0", fontWeight:700 }}>TokkuPro</h1>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {cards.map((c) => (
          <button key={c.th} onClick={() => c.locked ? onSignup() : goTab(c.k)} style={{
            textAlign:"left", border:"1px solid #e5e7eb", borderLeft:`4px solid ${c.locked?"#d1d5db":c.c}`,
            background:"#fff", borderRadius:8, padding:"18px 18px", cursor:"pointer",
            fontFamily:"inherit", position:"relative", opacity: c.locked?0.85:1 }}>
            {c.locked && <span style={{ position:"absolute", top:14, right:14, fontSize:16 }}>🔒</span>}
            <div style={{ fontWeight:700, fontSize:15.5, color:"#111" }}>{c.th}</div>
            <div style={{ fontSize:12, color: c.locked?"#9ca3af":c.c, marginTop:2 }}>{c.jp}</div>
            <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:8 }}>{c.desc}</div>
          </button>
        ))}
      </div>
      <SignupPrompt onSignup={onSignup}
        text="สมัครสมาชิกฟรี เพื่อทำข้อสอบเสมือนจริงครบ 20 ข้อ ดูคำศัพท์ทั้งหมด และบันทึกผลการเรียนของคุณ" />
    </div>
  );
}

/* ============================================================
   GUEST VOCAB — เห็นบางคำ ที่เหลือเบลอ
   ============================================================ */
function GuestVocabScreen({ onSignup }) {
  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 20px" }}>
      <h1 style={{ fontSize:20, color:"#111", margin:"0 0 16px", fontWeight:700 }}>คำศัพท์ / 単語帳</h1>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {VOCAB.map((v, i) => {
          const info = CAT_INFO[v.cat];
          const locked = i >= GUEST_VOCAB_VISIBLE;
          return (
            <div key={i} style={{ background:"#fff", border:"1px solid #e5e7eb",
              borderLeft:`3px solid ${locked?"#d1d5db":info.c}`, borderRadius:8, padding:"16px 18px",
              position:"relative", overflow:"hidden" }}>
              <div style={{ filter: locked ? "blur(5px)" : "none", userSelect: locked ? "none" : "auto" }}>
                <span style={{ fontSize:11, fontWeight:700, color:info.c }}>{info.th}</span>
                <div style={{ marginTop:6 }}><Ruby segments={[[v.jp, v.fr]]} size={24} /></div>
                <div style={{ fontSize:14, fontWeight:600, color:"#111", marginTop:2 }}>{v.th}</div>
              </div>
              {locked && (
                <button onClick={onSignup} style={{ position:"absolute", inset:0, border:"none",
                  background:"rgba(255,255,255,.3)", cursor:"pointer", display:"flex",
                  alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700,
                  color:"#1a56db", fontFamily:"inherit" }}>
                  🔒 สมัครเพื่อดู
                </button>
              )}
            </div>
          );
        })}
      </div>
      <SignupPrompt onSignup={onSignup}
        text={`ปลดล็อกคำศัพท์ทั้งหมด ${VOCAB.length} คำ พร้อมตัวอย่างประโยคและเสียงอ่าน`} />
    </div>
  );
}

/* ============================================================
   GUEST MINITEST — หมวดเดียว 5 ข้อ
   ============================================================ */
function GuestMiniTest({ onSignup, onBack }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [done, setDone] = useState(false);
  const questions = MINI_QUESTIONS_TEAM.slice(0, GUEST_MINI_QUESTIONS);

  const pick = (ci) => {
    if (revealed[current] !== undefined) return;
    setAnswers((a) => ({ ...a, [current]: ci }));
    setRevealed((r) => ({ ...r, [current]: true }));
  };
  const next = () => { if (current === questions.length-1) setDone(true); else setCurrent((c)=>c+1); };

  if (done) {
    const score = Object.entries(answers).filter(([i,v]) => questions[i].answer===v).length;
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh", padding:20 }}>
        <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:8,
          padding:"36px 40px", maxWidth:420, width:"100%", textAlign:"center" }}>
          <div style={{ fontSize:13, color:"#6b7280" }}>ทดลองทำเสร็จแล้ว!</div>
          <div style={{ fontSize:44, fontWeight:700, color:"#111", margin:"12px 0" }}>{score} / {questions.length}</div>
          <p style={{ fontSize:13.5, color:"#374151", lineHeight:1.7, marginBottom:20 }}>
            นี่เป็นแค่ตัวอย่างเล็กๆ จากหมวดทีมเวิร์คเท่านั้น<br/>
            สมัครสมาชิกเพื่อทำครบ <strong>4 หมวด × 10 ข้อ</strong> พร้อมบันทึกผลของคุณ
          </p>
          <button onClick={onSignup} style={{ width:"100%", padding:"12px", border:"none", borderRadius:6,
            background:"#1a56db", color:"#fff", fontWeight:700, fontSize:14.5, cursor:"pointer",
            fontFamily:"inherit", marginBottom:10 }}>สมัครสมาชิกฟรี</button>
          <button onClick={onBack} style={{ width:"100%", padding:"11px", border:"1px solid #d1d5db",
            borderRadius:6, background:"#fff", color:"#374151", fontSize:13.5, cursor:"pointer",
            fontFamily:"inherit" }}>กลับหน้าแรก</button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const isRevealed = revealed[current] !== undefined;
  const chosenIdx = answers[current];

  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ fontSize:13, color:"#374151" }}>
          ทดลองทำ (ทีมเวิร์ค) — ข้อ {current+1}/{questions.length}
        </span>
        <span style={{ fontSize:11.5, background:"#fffbeb", color:"#92400e", padding:"3px 10px",
          borderRadius:99, fontWeight:600 }}>โหมดทดลอง</span>
      </div>
      <div style={{ height:3, background:"#f3f4f6", borderRadius:99, marginBottom:20 }}>
        <div style={{ width:`${((current+1)/questions.length)*100}%`, height:"100%",
          background:"#16a34a", borderRadius:99 }} />
      </div>

      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:20, marginBottom:20 }}>
        <Ruby segments={q.ruby} size={17} />
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {q.choices.map((seg, ci) => {
          const isAns = ci===q.answer, isChosen = ci===chosenIdx;
          let bg="#fff", bd="#d1d5db", col="#111";
          if (isRevealed) {
            if (isAns) { bg="#f0fdf4"; bd="#16a34a"; col="#15803d"; }
            else if (isChosen) { bg="#fef2f2"; bd="#dc2626"; col="#dc2626"; }
            else col="#9ca3af";
          }
          return (
            <button key={ci} onClick={() => pick(ci)} disabled={isRevealed} style={{
              display:"flex", alignItems:"center", gap:12, padding:"13px 18px",
              border:`1px solid ${bd}`, background:bg, borderRadius:6,
              cursor:isRevealed?"default":"pointer", textAlign:"left", fontFamily:"inherit" }}>
              <span style={{ width:24, height:24, borderRadius:4, background:"#f3f4f6", color:"#374151",
                fontWeight:700, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0 }}>{String.fromCharCode(65+ci)}</span>
              <span style={{ fontSize:14.5, color:col }}><Ruby segments={seg} size={14} /></span>
            </button>
          );
        })}
      </div>

      {isRevealed && (
        <button onClick={next} style={{ marginTop:20, width:"100%", padding:"11px", border:"none",
          borderRadius:6, background:"#1a56db", color:"#fff", fontWeight:700, fontSize:14,
          cursor:"pointer", fontFamily:"inherit" }}>
          {current===questions.length-1 ? "ดูผล" : "ข้อถัดไป →"}
        </button>
      )}
    </div>
  );
}

/* ============================================================
   ROOT — เชื่อม Entry → Login/Register/Guest → App
   ============================================================ */
export default function TokkuProRoot() {
  const [stage, setStage] = useState(() => {
    // เช็ค session ตอนเริ่มแอป ถ้ามี session ที่ valid อยู่ข้ามหน้า entry ไปเลย
    const result = validateSession();
    if (result.valid) {
      const s = getSession();
      return s?.role === "admin" ? "auth" : "app";
    }
    // session ไม่ valid → ล้างทิ้งแล้วกลับ entry
    clearSession();
    return "entry";
  });
  const [guestTab, setGuestTab] = useState("home");
  const [kickMsg, setKickMsg] = useState("");

  const goAuth = () => setStage("auth");
  const goEntry = () => { clearSession(); setStage("entry"); setKickMsg(""); };
  const goGuest = () => { setStage("guest"); setGuestTab("home"); };

  if (stage === "entry") {
    return (
      <div>
        {kickMsg && (
          <div style={{ background:"#fef2f2", borderBottom:"1px solid #dc2626",
            padding:"10px 20px", fontSize:13, color:"#dc2626", textAlign:"center",
            fontFamily:"'Noto Sans Thai',sans-serif" }}>
            ⚠️ {kickMsg}
          </div>
        )}
        <EntryScreen onGuestEnter={goGuest} onGoLogin={goAuth} />
      </div>
    );
  }

  if (stage === "auth") {
    return <AuthAdminSystem onExitToEntry={goEntry} />;
  }

  if (stage === "app") {
    const session = getSession();
    return <TokkuProApp currentUser={session} onLogout={goEntry} />;
  }

  // stage === "guest"
  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb",
      fontFamily:"'Noto Sans JP','Noto Sans Thai',serif" }}>
      <GuestBanner onSignup={goAuth} />
      {guestTab === "home" && <GuestHome goTab={setGuestTab} onSignup={goAuth} />}
      {guestTab === "vocab" && <GuestVocabScreen onSignup={goAuth} />}
      {guestTab === "minitest" && <GuestMiniTest onSignup={goAuth} onBack={() => setGuestTab("home")} />}
      <div style={{ display:"flex", borderTop:"1px solid #d1d5db", background:"#fff", marginTop:20 }}>
        {[["home","หน้าแรก"],["minitest","ทดลองทำ"],["vocab","คำศัพท์"]].map(([k,th]) => (
          <button key={k} onClick={() => setGuestTab(k)} style={{ flex:1, border:"none", background:"none",
            cursor:"pointer", padding:"12px", fontSize:13, fontFamily:"inherit",
            color: guestTab===k?"#1a56db":"#9ca3af", fontWeight: guestTab===k?700:500,
            borderTop: guestTab===k?"2px solid #1a56db":"2px solid transparent" }}>{th}</button>
        ))}
      </div>
    </div>
  );
}
