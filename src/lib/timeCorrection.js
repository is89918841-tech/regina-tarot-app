function pad(n){ return String(n).padStart(2,'0'); }
function bool(v, def=false){
  if(v===undefined || v===null || v==='') return def;
  if(typeof v==='boolean') return v;
  return ['1','true','on','yes','y','적용','사용'].includes(String(v).toLowerCase());
}
const LOCATIONS = {
  '서울': { lat:37.5665, lon:126.9780, tz:9 }, '서울특별시': { lat:37.5665, lon:126.9780, tz:9 },
  '원주': { lat:37.3422, lon:127.9202, tz:9 }, '원주시': { lat:37.3422, lon:127.9202, tz:9 },
  '부산': { lat:35.1796, lon:129.0756, tz:9 }, '대구': { lat:35.8714, lon:128.6014, tz:9 },
  '인천': { lat:37.4563, lon:126.7052, tz:9 }, '광주': { lat:35.1595, lon:126.8526, tz:9 },
  '대전': { lat:36.3504, lon:127.3845, tz:9 }, '울산': { lat:35.5384, lon:129.3114, tz:9 },
  '세종': { lat:36.4800, lon:127.2890, tz:9 }, '제주': { lat:33.4996, lon:126.5312, tz:9 },
  '춘천': { lat:37.8813, lon:127.7298, tz:9 }, '청주': { lat:36.6424, lon:127.4890, tz:9 },
  '전주': { lat:35.8242, lon:127.1480, tz:9 }, '창원': { lat:35.2280, lon:128.6811, tz:9 }
};
function firstValidNumber(...values){
  for(const v of values){
    if(v === undefined || v === null) continue;
    if(typeof v === 'string' && v.trim() === '') continue;
    const n = Number(v);
    if(Number.isFinite(n)) return n;
  }
  return null;
}
function resolveLocation(input={}){
  const place = String(input.birthPlace || input.birth_place || input.city || '').trim();
  const direct = LOCATIONS[place] || Object.entries(LOCATIONS).find(([k]) => place.includes(k))?.[1];
  const lat = firstValidNumber(input.latitude, input.lat, direct?.lat, 37.5665);
  const lon = firstValidNumber(input.longitude, input.lon, input.lng, direct?.lon, 126.9780);
  const timezone = firstValidNumber(input.timezone, input.tz, direct?.tz, 9);
  return { place: place || '서울특별시(기본값)', lat, lon, timezone };
}
function isKoreaDst(date){
  const y=date.getUTCFullYear();
  const t=date.getTime();
  const range=(a,b)=> t>=Date.UTC(y,a[0]-1,a[1],0,0) && t<Date.UTC(y,b[0]-1,b[1],0,0);
  if(y===1948) return range([6,1],[9,13]);
  if(y===1949) return range([4,3],[9,11]);
  if(y===1950) return range([4,1],[9,10]);
  if(y>=1955 && y<=1960) return range([5,5],[9,9]);
  if(y===1987) return range([5,10],[10,11]);
  if(y===1988) return range([5,8],[10,9]);
  return false;
}
function equationOfTimeMinutes(date){
  const start = Date.UTC(date.getUTCFullYear(),0,0);
  const n = Math.floor((date.getTime()-start)/86400000);
  const B = 2*Math.PI*(n-81)/364;
  return 9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
}
function parseLocalDate(input={}){
  const raw=String(input.birthDate||input.birth_date||input.date||'');
  const [y,m,d]=raw.split('-').map(Number);
  const traw=String(input.birthTime||input.birth_time||input.time||'');
  let hh=12, mm=0, timeKnown=false;
  const mt=traw.match(/(\d{1,2})(?::(\d{1,2}))?/);
  if(mt && !['unknown','모름','시각모름'].includes(traw)){ hh=Number(mt[1]); mm=Number(mt[2]||0); timeKnown=true; }
  if(!y||!m||!d) throw new Error('birthDate는 YYYY-MM-DD 형식이어야 합니다.');
  return { y,m,d,hh,mm,timeKnown };
}
function addMinutesToLocal({y,m,d,hh,mm}, minutes){
  const dt = new Date(Date.UTC(y,m-1,d,hh,mm + Math.round(minutes),0));
  return { year:dt.getUTCFullYear(), month:dt.getUTCMonth()+1, day:dt.getUTCDate(), hour:dt.getUTCHours(), minute:dt.getUTCMinutes(), date:`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`, time:`${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}` };
}
function buildTimeCorrection(input={}){
  const base=parseLocalDate(input), loc=resolveLocation(input);
  const options={
    longitudeCorrection: bool(input.longitudeCorrection ?? input.useLongitudeCorrection, false),
    trueSolarTime: bool(input.trueSolarTime ?? input.useTrueSolarTime, false),
    autoDST: bool(input.autoDST ?? input.dstAuto, true),
    yajasi: bool(input.yajasi ?? input.useYajasi, false),
    ziweiTimeCorrection: bool(input.ziweiTimeCorrection ?? input.adjustZiweiTime, true),
    astrologyPrecision: bool(input.astrologyPrecision ?? input.preciseAstrology, true)
  };
  const localDate = new Date(Date.UTC(base.y,base.m-1,base.d,base.hh,base.mm,0));
  const dstApplied = options.autoDST && isKoreaDst(localDate);
  const meridian = loc.timezone * 15;
  const longitudeMinutes = options.longitudeCorrection || options.trueSolarTime ? (loc.lon - meridian) * 4 : 0;
  const eot = options.trueSolarTime ? equationOfTimeMinutes(localDate) : 0;
  const dstMinutes = dstApplied ? -60 : 0; // DST 표기 시 실제 태양시/명리시 보정은 1시간 되돌림
  const totalMinutes = longitudeMinutes + eot + dstMinutes;
  let corrected = base.timeKnown ? addMinutesToLocal(base,totalMinutes) : {year:base.y,month:base.m,day:base.d,hour:base.hh,minute:base.mm,date:`${base.y}-${pad(base.m)}-${pad(base.d)}`,time:'시각모름'};
  let sajuDate=corrected.date, sajuTime=corrected.time;
  let yajasiApplied=false;
  if(base.timeKnown && options.yajasi && corrected.hour===23){
    const yj = addMinutesToLocal({y:corrected.year,m:corrected.month,d:corrected.day,hh:corrected.hour,mm:corrected.minute}, 60);
    sajuDate = yj.date; yajasiApplied=true;
  }
  return { options, location:loc, original:{date:`${base.y}-${pad(base.m)}-${pad(base.d)}`,time:base.timeKnown?`${pad(base.hh)}:${pad(base.mm)}`:'시각모름'}, corrected, saju:{date:sajuDate,time:sajuTime}, adjustments:{longitudeMinutes:+longitudeMinutes.toFixed(2), equationOfTimeMinutes:+eot.toFixed(2), dstMinutes, totalMinutes:+totalMinutes.toFixed(2), dstApplied, yajasiApplied}, note:'경도 보정은 표준자오선(UTC+9=동경135도) 대비, 진태양시는 균시차를 추가한 백업 근사입니다.' };
}
function applyTimeCorrection(input={}, target='saju'){
  const meta=buildTimeCorrection(input);
  const use = target==='original' ? {date:meta.original.date,time:meta.original.time} : (target==='saju' ? meta.saju : {date:meta.corrected.date,time:meta.corrected.time});
  return {...input,birthDate:use.date,birthTime:use.time,_timeCorrection:meta};
}
module.exports={buildTimeCorrection,applyTimeCorrection,resolveLocation};
