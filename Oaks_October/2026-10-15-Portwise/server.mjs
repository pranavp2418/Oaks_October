import express from 'express';import {handle} from './server/service.mjs';
const app=express();app.use(express.json({limit:'256kb'}));app.post('/api/workspace',async(req,res)=>{try{res.json(await handle(req.body));}catch(error){res.status(400).json({error:error.message});}});app.listen(8016,'127.0.0.1');
