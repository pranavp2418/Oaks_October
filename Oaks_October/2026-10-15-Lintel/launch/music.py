"""Original synthesized film bed. No samples or third-party melodies. CC0 by project author."""
import math,wave,array,pathlib
rate=48000;duration=45;notes=[130.8128,164.8138,195.9977,146.8324,174.6141,220.,164.8138,195.9977,246.9417]
out=array.array('h')
for i in range(rate*duration):
 t=i/rate;fade=min(1,t/2,(duration-t)/3);v=0
 for j in range(3):
  f=notes[(int(t//5)*2+j)%len(notes)];phase=2*math.pi*f*t;v+=(math.sin(phase)+.18*math.sin(phase*2))*.045*(.75+.25*math.sin(2*math.pi*.12*t+j))
 beat=t%1.25;v+=math.sin(2*math.pi*880*beat)*math.exp(-beat*55)*.018
 value=int(max(-.9,min(.9,v*fade))*32767);out.extend((value,value))
p=pathlib.Path(__file__).parent/'composition/assets/original-bed.wav'
with wave.open(str(p),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(out.tobytes())
