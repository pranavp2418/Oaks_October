import { replay } from '../lib/core.js';
export default function handler(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'POST required'});try{const body=typeof req.body==='string'?JSON.parse(req.body):req.body;return res.status(200).json(replay(body.events));}catch(e){return res.status(400).json({error:e.message});}}
