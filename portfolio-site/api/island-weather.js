import {OBSERVATION_URL,normalizeObservation} from '../lib/houston-weather.js';

export function createWeatherHandler({fetchImpl=fetch,now=()=>Date.now()}={}){
  let cached=null,expires=0,pending=null;
  async function refresh(){
    if(cached&&now()<expires)return cached;
    if(pending)return pending;
    pending=(async()=>{
      const response=await fetchImpl(OBSERVATION_URL,{headers:{'Accept':'application/geo+json','User-Agent':'PranavPortfolio/1.0 (https://pranav-patel.vercel.app)'},signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error('Weather service unavailable');
      const observation=normalizeObservation(await response.json(),now());cached=observation;expires=now()+300000;return observation;
    })();
    try{return await pending;}finally{pending=null;}
  }
  return async function handler(req,res){
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'){res.setHeader('Allow','GET');res.status(405).json({status:'unavailable',error:'Method not allowed'});return;}
    try{
      const observation=await refresh();res.setHeader('Cache-Control','public, max-age=0, s-maxage=300, stale-while-revalidate=60');
      res.status(200).json({...observation,servedAt:new Date(now()).toISOString()});
    }catch{
      res.setHeader('Cache-Control','no-store');
      if(cached)res.status(200).json({...cached,status:'stale',reason:'upstream_unavailable',servedAt:new Date(now()).toISOString()});
      else res.status(502).json({status:'unavailable',source:'National Weather Service',station:'KIAH',error:'The latest Houston observation is temporarily unavailable.'});
    }
  };
}
export default createWeatherHandler();
