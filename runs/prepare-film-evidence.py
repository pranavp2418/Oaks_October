"""Retain actual encode/source evidence after final renders; publication is a separate gate."""
from pathlib import Path
import json,hashlib,shutil,subprocess,re,datetime
root=Path(__file__).resolve().parents[1];media=Path('/workspace/media/final');summary=[]
for name in ['lintel','portwise','fallow']:
 launch=root/f'Oaks_October/2026-10-15-{name.title()}/launch';records={}
 for edition,dims in [('launch-4k',(3840,2160)),('launch',(1920,1080))]:
  path=media/f'{name}-{edition}.mp4';probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]));v=next(s for s in probe['streams']if s['codec_type']=='video');expected=50 if name=='portwise'else 45
  if (v['width'],v['height'])!=dims or v['avg_frame_rate']!='30/1' or abs(float(probe['format']['duration'])-expected)>.15 or int(v['nb_frames'])!=expected*30:raise SystemExit('Encoding contract failed: '+str(path))
  probe['sha256']=hashlib.sha256(path.read_bytes()).hexdigest();probe['artifact_name']=path.name;records[edition]=probe;(launch/f'final-{edition}-probe.json').write_text(json.dumps(probe,indent=2)+'\n')
 sourcefiles=[launch/'composition/index.html',*(launch/'composition/assets').glob('*')];hashes={str(p.relative_to(launch)):hashlib.sha256(p.read_bytes()).hexdigest()for p in sourcefiles if p.is_file()};(launch/'final-source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
 shutil.copy2(media.parent/name/'final-check.json',launch/'check.json')
 # Retain settled first/engineering/outcome/closing proof samples without putting MP4 blobs in Git.
 proofdir=launch/'qa-final';proofdir.mkdir(exist_ok=True)
 for image in (media/(name+'-qa')).glob('*.jpg'):shutil.copy2(image,proofdir/image.name)
 poster=media/f'{name}-poster.jpg';target=root/f'portfolio-site/public/assets/film-{name}.jpg';subprocess.run(['ffmpeg','-v','error','-i',str(poster),'-vf','scale=1920:1080:flags=lanczos','-frames:v','1','-q:v','3','-y',str(target)],check=True)
 # The input_* fields measure the actual final mastered file, not a hypothetical target.
 audio=subprocess.run(['ffmpeg','-hide_banner','-i',str(media/f'{name}-launch-4k.mp4'),'-af','loudnorm=I=-18:TP=-2:LRA=7:print_format=json','-vn','-sn','-dn','-f','null','-'],text=True,capture_output=True,check=True).stderr;matches=re.findall(r'\{\s*"input_i".*?\}',audio,re.S);levels=json.loads(matches[-1]);(launch/'final-audio-measurement.json').write_text(json.dumps(levels,indent=2)+'\n')
 if float(levels['input_tp'])>=0:raise SystemExit('Clipping risk in '+name)
 summary.append({'project':name,'editions':records,'audio':levels,'native_capture':True,'editorial_status':'awaiting_recorded_final_review','publication':'pending'})
(root/'runs/evidence/oct15-continuation/final-film-encodes.json').write_text(json.dumps({'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'films':summary},indent=2)+'\n')
print('Recorded three final encoding contracts; publication/editorial gates remain separate.')
