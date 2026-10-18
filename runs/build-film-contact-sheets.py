"""Every rendered second, plus native proof frames; no video editing or upscaling."""
from pathlib import Path
import subprocess,sys
name=sys.argv[1];p=Path(sys.argv[2]) if len(sys.argv)>2 else Path('/workspace/media/final');q=p/(name+'-qa');q.mkdir(exist_ok=True)
# Clear only this helper's previous evidence images so a changed cut cannot retain stale samples.
for pattern in ['sequence-*.jpg','frame-*.jpg']:
 for previous in q.glob(pattern):previous.unlink()
subprocess.run(['ffmpeg','-v','error','-threads','2','-i',str(p/(name+'-launch-4k.mp4')),'-vf','fps=1,scale=960:540,tile=3x5','-fps_mode','vfr','-y',str(q/'sequence-%02d.jpg')],check=True)
for t in ([2,7,17,35,43,48] if name=='portwise' else [2,7,17,29,37,43]):subprocess.run(['ffmpeg','-v','error','-threads','2','-ss',str(t),'-i',str(p/(name+'-launch-4k.mp4')),'-frames:v','1','-q:v','2','-y',str(q/f'frame-{t}.jpg')],check=True)
