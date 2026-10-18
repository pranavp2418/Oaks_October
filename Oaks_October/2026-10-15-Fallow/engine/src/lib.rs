//! Bounded exact sampling allocation on synthetic exceedance observations.
use serde::{Deserialize,Serialize};
use std::collections::{BTreeMap,BTreeSet};
#[derive(Clone,Debug,Deserialize,Serialize)]
#[serde(deny_unknown_fields)]
pub struct Site{pub id:String,pub region:u8,pub cost:u32,pub successes:u32,pub failures:u32,pub max_samples:u8}
#[derive(Clone,Debug,Deserialize,Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request{pub sites:Vec<Site>,pub budget:u32,pub capacity:u8,pub minimum_regions:u8}
#[derive(Clone,Debug,Deserialize,Serialize)]
pub struct Posterior{pub id:String,pub alpha:u32,pub beta:u32,pub exceedance_mean:f64,pub variance:f64}
#[derive(Clone,Debug,Deserialize,Serialize)]
pub struct Plan{pub selected:Vec<(String,u8)>,pub cost:u32,pub samples:u8,pub regions:u8,pub utility_nano:u64,pub posteriors:Vec<Posterior>,pub states_explored:usize,pub objective:String}
#[derive(Clone)]
struct Candidate{utility:u64,picks:Vec<u8>}
fn validate(r:&Request)->Result<(),String>{
 if r.sites.is_empty()||r.sites.len()>18||r.budget>10000||r.capacity>24||r.minimum_regions>6{return Err("Bounded contract: 1..18 sites, budget<=10000, capacity<=24, regions<=6".into())}
 let mut ids=BTreeSet::new();
 for s in &r.sites{
  if s.id.is_empty()||s.id.len()>48||!s.id.bytes().all(|c|c.is_ascii_alphanumeric()||b"-_.".contains(&c))||!ids.insert(&s.id){return Err("Invalid/duplicate site id".into())}
  if s.region>=6||s.cost==0||s.cost>10000||s.successes>128||s.failures>128||s.successes+s.failures>128||s.max_samples>4{return Err("Invalid site region/cost/observation/sample bound".into())}
 }
 Ok(())
}
pub fn utility(s:&Site,n:u8)->u64{
 let a=f64::from(s.successes+1);let b=f64::from(s.failures+1);let total=a+b;
 // Expected beta-Bernoulli posterior variance reduction, quantized once to nano-units.
 let variance=a*b/(total*total*(total+1.));
 (variance*f64::from(n)/(total+f64::from(n))*1_000_000_000.).round() as u64
}
pub fn solve(r:&Request)->Result<Plan,String>{
 validate(r)?;
 // Ordered maps and lexicographic tie-breaks make equal-objective plans reproducible.
 let mut states:BTreeMap<(u32,u8,u8),Candidate>=BTreeMap::new();states.insert((0,0,0),Candidate{utility:0,picks:vec![]});let mut explored=1;
 for site in &r.sites{
  let mut next:BTreeMap<(u32,u8,u8),Candidate>=BTreeMap::new();
  for (&(cost,count,mask),candidate) in &states{
   for n in 0..=site.max_samples{
    let nc=cost+site.cost*u32::from(n);let nn=count+n;if nc>r.budget||nn>r.capacity{continue}
    let nm=if n>0{mask|(1<<site.region)}else{mask};let score=candidate.utility+utility(site,n);let mut picks=candidate.picks.clone();picks.push(n);let key=(nc,nn,nm);
    let replace=next.get(&key).is_none_or(|old|score>old.utility||(score==old.utility&&picks<old.picks));
    if replace{next.insert(key,Candidate{utility:score,picks});}
   }
  }
  explored+=next.len();if next.len()>300000||explored>2000000{return Err("Exact DP state budget exceeded; no approximate success returned".into())}states=next;
 }
 let mut best:Option<((u32,u8,u8),Candidate)>=None;
 for (key,value) in states{
  if key.2.count_ones()<u32::from(r.minimum_regions){continue}
  let replace=best.as_ref().is_none_or(|(k,v)|value.utility>v.utility||(value.utility==v.utility&&(key.0,key.1,&value.picks)<(k.0,k.1,&v.picks)));
  if replace{best=Some((key,value));}
 }
 let ((cost,samples,mask),candidate)=best.ok_or("No feasible plan satisfies the region minimum")?;
 let posteriors=r.sites.iter().map(|s|{let a=s.successes+1;let b=s.failures+1;let t=f64::from(a+b);Posterior{id:s.id.clone(),alpha:a,beta:b,exceedance_mean:f64::from(a)/t,variance:f64::from(a)*f64::from(b)/(t*t*(t+1.))}}).collect();
 let selected=r.sites.iter().zip(candidate.picks).filter(|(_,n)|*n>0).map(|(s,n)|(s.id.clone(),n)).collect();
 Ok(Plan{selected,cost,samples,regions:mask.count_ones() as u8,utility_nano:candidate.utility,posteriors,states_explored:explored,objective:"Maximize summed expected posterior-variance reduction in rounded nano-units; ties prefer lower cost, fewer samples, then lexicographic counts. Independent sites, beta(1,1) priors; synthetic decision support only.".into()})
}
pub fn solve_json(input:&str)->String{
 let result=serde_json::from_str::<Request>(input).map_err(|e|e.to_string()).and_then(|r|solve(&r));
 match result{Ok(plan)=>serde_json::json!({"ok":true,"plan":plan}).to_string(),Err(error)=>serde_json::json!({"ok":false,"error":error}).to_string()}
}
// Explicit byte-buffer ABI. No host functions, network or filesystem in WASM.
#[unsafe(no_mangle)]pub extern "C" fn allocate(length:usize)->*mut u8{if length>65536{return std::ptr::null_mut()}Box::into_raw(vec![0u8;length].into_boxed_slice()) as *mut u8}
#[unsafe(no_mangle)]pub unsafe extern "C" fn release(pointer:*mut u8,length:usize){if !pointer.is_null(){drop(unsafe{Box::from_raw(std::ptr::slice_from_raw_parts_mut(pointer,length))});}}
#[unsafe(no_mangle)]pub unsafe extern "C" fn evaluate(pointer:*const u8,length:usize)->u64{
 if length>65536||pointer.is_null(){return 0}
 let raw=unsafe{std::slice::from_raw_parts(pointer,length)};
 let result=match std::str::from_utf8(raw){Ok(s)=>solve_json(s),Err(_)=>"{\"ok\":false,\"error\":\"Invalid UTF-8\"}".into()};
 let bytes=result.into_bytes().into_boxed_slice();let n=bytes.len();let p=Box::into_raw(bytes) as *mut u8;((p as u64)<<32)|(n as u64)
}
#[cfg(test)]mod tests{
 use super::*;
 fn example()->Request{Request{sites:vec![Site{id:"a".into(),region:0,cost:3,successes:1,failures:1,max_samples:3},Site{id:"b".into(),region:1,cost:4,successes:0,failures:0,max_samples:3}],budget:10,capacity:3,minimum_regions:2}}
 #[test]fn budget_and_diversity(){let r=example();let p=solve(&r).unwrap();assert!(p.cost<=10&&p.samples<=3&&p.regions>=2);assert_eq!(p.selected,vec![("a".into(),2),("b".into(),1)]);}
 #[test]fn posterior_reference(){let r=example();let p=solve(&r).unwrap();assert_eq!(p.posteriors[0].exceedance_mean,0.5);assert!((p.posteriors[1].variance-1./12.).abs()<1e-12);}
 #[test]fn reject_invalid_and_infeasible(){let mut r=example();r.budget=0;assert!(solve(&r).is_err());r.minimum_regions=0;assert_eq!(solve(&r).unwrap().samples,0);r.sites[0].region=7;assert!(solve(&r).is_err());}
 #[test]fn rejects_unknown_fields(){assert!(solve_json("{\"shell\":\"bad\"}").contains("false"));}
 #[test]fn independent_enumeration(){for budget in 0..=20{for capacity in 0..=6{let mut r=example();r.budget=budget;r.capacity=capacity;let mut best=0;let mut feasible=false;for a in 1..=3u8{for b in 1..=3u8{if 3*u32::from(a)+4*u32::from(b)<=budget&&a+b<=capacity{feasible=true;best=best.max(utility(&r.sites[0],a)+utility(&r.sites[1],b));}}}let p=solve(&r);assert_eq!(p.is_ok(),feasible);if let Ok(p)=p{assert_eq!(p.utility_nano,best);}}}}
}
