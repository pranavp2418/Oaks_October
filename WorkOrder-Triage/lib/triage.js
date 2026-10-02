export function triage(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Send a work order object.');
  const {title,unit,category,impact,ageHours}=input;
  if (typeof title !== 'string' || title.trim().length<4 || title.trim().length>120) throw new Error('Title must be 4–120 characters.');
  if (typeof unit !== 'string' || !unit.trim() || unit.length>30) throw new Error('Unit is required (maximum 30 characters).');
  if (!['plumbing','electrical','hvac','general'].includes(category)) throw new Error('Choose a valid category.');
  if (!['routine','disruption','active-damage'].includes(impact)) throw new Error('Choose a valid impact.');
  if (typeof ageHours !== 'number' || !Number.isFinite(ageHours) || ageHours<0 || ageHours>8760) throw new Error('Age must be between 0 and 8,760 hours.');
  const reasons=[]; let score=impact==='active-damage'?80:impact==='disruption'?45:15;
  reasons.push({points:score,reason:impact==='active-damage'?'Ongoing property damage':impact==='disruption'?'Essential service disrupted':'Routine maintenance'});
  const agePoints=Math.min(20,Math.floor(ageHours/12)*5);
  if(agePoints){score+=agePoints;reasons.push({points:agePoints,reason:'Waiting time: '+ageHours+' hours'});}
  const priority=score>=80?'Urgent':score>=45?'High':'Normal';
  return {title:title.trim(),unit:unit.trim(),category,impact,ageHours,score,priority,trade:{plumbing:'Plumbing',electrical:'Electrical',hvac:'HVAC',general:'General maintenance'}[category],targetHours:priority==='Urgent'?2:priority==='High'?24:72,reasons,policyVersion:'demo-1.0'};
}
