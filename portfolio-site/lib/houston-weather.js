export const OBSERVATION_URL='https://api.weather.gov/stations/KIAH/observations/latest';
export const MAX_OBSERVATION_AGE_MS=90*60*1000;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function quantity(q){return typeof q?.value==='number'&&Number.isFinite(q.value)?q.value:null;}
function windKmh(q){const n=quantity(q);if(n===null)return 0;return clamp(q.unitCode==='wmoUnit:m_s-1'?n*3.6:q.unitCode==='wmoUnit:kn'?n*1.852:n,0,220);}
export function normalizeObservation(data,now=Date.now()){
  const p=data?.properties;if(!p||typeof p.timestamp!=='string')throw new Error('Missing observation timestamp');
  const observedMs=Date.parse(p.timestamp);if(!Number.isFinite(observedMs)||observedMs>now+5*60*1000)throw new Error('Invalid observation timestamp');
  const text=String(p.textDescription||'').slice(0,140),present=Array.isArray(p.presentWeather)?p.presentWeather:[],layers=Array.isArray(p.cloudLayers)?p.cloudLayers:[];
  if(!text&&!present.length&&!layers.length)throw new Error('Missing weather conditions');
  const description=[text,...present.map(x=>[x.rawString,x.weather,x.modifier,x.intensity].filter(Boolean).join(' '))].join(' ').toLowerCase();
  const clouds={CLR:0,SKC:0,FEW:.18,SCT:.4,BKN:.75,OVC:1,VV:1};
  let cloudCover=layers.reduce((m,c)=>Math.max(m,clouds[c.amount]??0),0);
  if(/overcast|mostly cloudy/.test(description))cloudCover=Math.max(cloudCover,.88);else if(/partly cloudy|fair/.test(description))cloudCover=Math.max(cloudCover,.3);
  const storm=/thunder|\bts\b|tsra|tornado/.test(description),snow=/snow|sleet|freezing/.test(description),rain=storm||/rain|drizzle|shower|\bra\b|\bdz\b/.test(description),fog=/fog|mist|haze|\bfg\b/.test(description);
  if(rain||snow)cloudCover=Math.max(cloudCover,.8);
  const kind=storm?'storm':snow?'snow':rain?'rain':fog?'fog':cloudCover>.65?'cloudy':cloudCover>.2?'partly-cloudy':'clear';
  const wind=windKmh(p.windSpeed),gust=windKmh(p.windGust),rawTemperature=quantity(p.temperature);
  const temperatureC=rawTemperature===null?null:p.temperature.unitCode==='wmoUnit:degF'?(rawTemperature-32)*5/9:rawTemperature;
  return {status:now-observedMs>MAX_OBSERVATION_AGE_MS?'stale':'fresh',source:'National Weather Service',station:'KIAH',location:'Houston area',observedAt:new Date(observedMs).toISOString(),description:text||kind.replaceAll('-',' '),kind,cloudCover,precipitation:rain||snow?(/heavy|\+ra|\+ts/.test(description)?1:storm?.8:.45):0,windKmh:wind,gustKmh:gust,windDirection:clamp(quantity(p.windDirection)??150,0,360),temperatureC:temperatureC===null?null:Math.round(temperatureC*10)/10,visibilityKm:quantity(p.visibility)===null?null:quantity(p.visibility)/1000};
}
export function weatherFreshness(weather,now=Date.now()){
  if(!weather?.observedAt)return 'unavailable';const t=Date.parse(weather.observedAt);
  if(!Number.isFinite(t)||t>now+300000)return 'unavailable';
  return weather.status==='stale'||now-t>MAX_OBSERVATION_AGE_MS?'stale':'fresh';
}
