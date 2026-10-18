from pathlib import Path
import math,wave,array
root=Path(__file__).resolve().parents[1]/'Oaks_October'
for index,(name,cues) in enumerate([('Lintel',[5,12,20,26,39]),('Portwise',[5,31,40,45]),('Fallow',[5,33,40])]):
 p=root/f'2026-10-15-{name}'/'launch';a=p/'composition/assets'
 rate=24000;duration=50 if name=='Portwise' else 45;notes=[[130.81,164.81,196,220],[110,146.83,220,293.66],[146.83,174.61,220,261.63]][index];beat=[1.5,.75,2.0][index];samples=array.array('h')
 for i in range(rate*duration):
  t=i/rate;fade=max(0,min(1,t/.8,(duration-t)/2));value=0
  for j in range(3):
   f=notes[(int(t//6)+j)%len(notes)];value+=math.sin(2*math.pi*f*t)*(.024+.008*math.sin(t*.6+j))
  q=t%beat;value+=.018*math.sin(2*math.pi*(660 if index==1 else 440)*q)*math.exp(-q*22)
  for cue in cues:
   d=t-cue
   if 0<=d<.3:value+=.035*math.sin(2*math.pi*(880 if index==1 else 523.25)*d)*math.exp(-d*18)
  samples.append(int(32767*fade*value))
 with wave.open(str(a/'score.wav'),'wb') as w:w.setparams((1,2,rate,0,'NONE','not compressed'));w.writeframes(samples.tobytes())
