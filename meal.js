/* ============================================================
   api/meal.js — Vercel 서버리스 함수 (NEIS API 프록시)
   브라우저의 CORS 제한을 서버 측에서 우회합니다.
   호출: /api/meal?date=20260403
   ============================================================ */

const NEIS_KEY  = '4b167196e8cb474ab525e6f844749e87';
const ATPT_CODE = 'B10';
const SCHUL_CODE = '7010215';

export default async function handler(req, res) {
  // CORS 헤더 설정 — 같은 Vercel 도메인 및 localhost 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'date 파라미터가 필요합니다.' });
  }

  const neisUrl =
    `https://open.neis.go.kr/hub/mealServiceDietInfo` +
    `?KEY=${NEIS_KEY}` +
    `&Type=json` +
    `&pIndex=1` +
    `&pSize=20` +
    `&ATPT_OFCDC_SC_CODE=${ATPT_CODE}` +
    `&SD_SCHUL_CODE=${SCHUL_CODE}` +
    `&MLSV_YMD=${date}`;

  try {
    const neisRes = await fetch(neisUrl);
    const data    = await neisRes.json();
    return res.status(200).json(data);
  } catch (e) {
    console.error('NEIS API 호출 오류:', e);
    return res.status(500).json({ error: 'NEIS API 호출 실패', detail: e.message });
  }
}
