"""Poster/frame-zero bake and web derivative; retain the native render unchanged."""
from pathlib import Path
import subprocess,json,hashlib,sys
name=sys.argv[1];frame={'lintel':17,'portwise':35,'fallow':37}[name];folder=Path(sys.argv[2]) if len(sys.argv)>2 else Path('/workspace/media/final');raw=folder/f'{name}-render.mp4';poster=folder/f'{name}-poster.jpg';master=folder/f'{name}-launch-4k.mp4';web=folder/f'{name}-launch.mp4'
duration=subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(raw)],text=True).strip()
def run(*args):subprocess.run(args,check=True)
run('ffmpeg','-v','error','-ss',str(frame),'-i',str(raw),'-frames:v','1','-q:v','2','-y',str(poster))
run('ffmpeg','-v','error','-i',str(raw),'-i',str(poster),'-filter_complex',"[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]",'-map','[v]','-map','0:a?','-c:v','libx264','-crf','15','-preset','fast','-threads','2','-pix_fmt','yuv420p','-af','loudnorm=I=-18:TP=-2:LRA=7','-c:a','aac','-b:a','192k','-ar','48000','-t',duration,'-movflags','+faststart','-y',str(master))
run('ffmpeg','-v','error','-i',str(master),'-vf','scale=1920:1080:flags=lanczos','-c:v','libx264','-crf','18','-preset','fast','-threads','2','-c:a','aac','-b:a','192k','-t',duration,'-movflags','+faststart','-y',str(web))
for path in [master,web]:
 run('ffmpeg','-v','error','-threads','2','-i',str(path),'-f','null','-')
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]));probe['sha256']=hashlib.sha256(path.read_bytes()).hexdigest();(folder/(path.stem+'-probe.json')).write_text(json.dumps(probe,indent=2)+'\n')
print(json.dumps({'master':str(master),'web':str(web),'poster':str(poster),'poster_time':frame,'status':'encoded_pending_editorial_review'}))
