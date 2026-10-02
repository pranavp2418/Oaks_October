import {triage} from '../lib/triage.js';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET') return res.status(200).json({status:'ok',service:'workorder-triage',policyVersion:'demo-1.0'});
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
  try{const data=typeof req.body==='string'?JSON.parse(req.body):req.body;return res.status(200).json(triage(data));}
  catch(error){return res.status(400).json({error:error instanceof SyntaxError?'Invalid JSON':error.message});}
}
