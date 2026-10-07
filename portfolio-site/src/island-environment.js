import * as SunCalc from 'suncalc';
import {weatherFreshness} from '../lib/houston-weather.js';
export const HOUSTON={latitude:29.7604,longitude:-95.3698,timeZone:'America/Chicago'};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function houstonUtcOffset(date){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:HOUSTON.timeZone,timeZoneName:'shortOffset'}).formatToParts(date);
  const value=parts.find(x=>x.type==='timeZoneName')?.value||'GMT-6';const match=value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return match?(match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]||0)):0;
}
export function solarState(date=new Date()){
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw new Error('Invalid date');
  const position=SunCalc.getPosition(date,HOUSTON.latitude,HOUSTON.longitude),times=SunCalc.getTimes(date,HOUSTON.latitude,HOUSTON.longitude,0,houstonUtcOffset(date));
  const daylight=clamp((position.altitude+7)/16,0,1),night=clamp((-position.altitude-1)/7,0,1);
  let phase='Night';if(date>=times.sunrise&&date<times.sunset)phase=position.altitude<7?(date<times.solarNoon?'Sunrise':'Golden hour'):'Day';else if(date>=times.dawn&&date<times.sunrise)phase='Dawn';else if(date>=times.sunset&&date<times.dusk)phase='Sunset';
  const rad=Math.PI/180,alt=position.altitude*rad,az=position.azimuth*rad;
  return {phase,daylight,night,altitude:position.altitude,azimuth:position.azimuth,sunDirection:{x:Math.cos(alt)*Math.sin(az),y:Math.sin(alt),z:-Math.cos(alt)*Math.cos(az)},sunrise:times.sunrise.toISOString(),sunset:times.sunset.toISOString(),localTime:new Intl.DateTimeFormat('en-US',{timeZone:HOUSTON.timeZone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date),localDate:new Intl.DateTimeFormat('en-US',{timeZone:HOUSTON.timeZone,month:'short',day:'numeric'}).format(date),utcOffsetMinutes:houstonUtcOffset(date)};
}
export function environmentState(date,weather){
  const solar=solarState(date),freshness=weatherFreshness(weather,date.getTime()),usable=freshness!=='unavailable';
  return {...solar,weatherStatus:freshness,weather:usable?weather:null,cloudCover:usable?clamp(weather.cloudCover||0,0,1):.12,rain:usable&&weather.kind!=='snow'?clamp(weather.precipitation||0,0,1):0,snow:usable&&weather.kind==='snow'?clamp(weather.precipitation||0,0,1):0,storm:usable&&weather.kind==='storm',wind:usable?clamp(weather.windKmh||0,0,100):8,windDirection:usable?(weather.windDirection||0):150,fog:usable&&weather.kind==='fog'};
}
export const formatHoustonTime=value=>new Intl.DateTimeFormat('en-US',{timeZone:HOUSTON.timeZone,hour:'numeric',minute:'2-digit'}).format(new Date(value));
