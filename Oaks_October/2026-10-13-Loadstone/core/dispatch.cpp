// A bounded integer dispatch engine. Units: kWh per slot; prices: cents per kWh.
// Lossless storage is a stated modelling assumption, not a physical device claim.
extern "C" {
static int input[16+48*4];
static int output[48*7];
static long long values[49][33][13];
static short choiceDelta[48][33][13], choiceGen[48][33][13];
static int nodes;
int* input_ptr(){return input;}
int* output_ptr(){return output;}
int transitions(){return nodes;}
long long result_cost(){return values[0][input[2]][0];}
int solve(){
 int h=input[0],cap=input[1],initial=input[2],reserve=input[3],power=input[4],maxg=input[5],ramp=input[6],fuel=input[7],wear=input[8];
 if(h<1||h>48||cap<1||cap>32||initial<0||initial>cap||reserve<0||reserve>cap||power<0||power>16||maxg<0||maxg>12||ramp<0||ramp>12||fuel<0||fuel>1000||wear<0||wear>1000)return -1;
 for(int t=0;t<h;t++)for(int j=0;j<4;j++){int v=input[16+4*t+j];if(v<0||v>1000)return -1;}
 const long long inf=1LL<<60;nodes=0;
 for(int s=0;s<=cap;s++)for(int g=0;g<=maxg;g++)values[h][s][g]=(s>=reserve?0:inf);
 for(int t=h-1;t>=0;t--){
  int demand=input[16+t*4],solar=input[17+t*4],price=input[18+t*4],limit=input[19+t*4];
  for(int s=0;s<=cap;s++)for(int prev=0;prev<=maxg;prev++){
   long long best=inf;int bd=0,bg=0;
   for(int delta=-power;delta<=power;delta++){
    int ns=s+delta;if(ns<0||ns>cap)continue;
    for(int g=0;g<=maxg;g++){
     if(g-prev>ramp||prev-g>ramp)continue;
     int net=demand-solar-g+delta;
     int grid=net>0?(net<limit?net:limit):0;
     int shed=net>grid?net-grid:0;
     long long tail=values[t+1][ns][g];if(tail==inf)continue;
     long long cost=tail+1LL*grid*price+1LL*g*fuel+1LL*(delta<0?-delta:delta)*wear+1LL*shed*10000;
     nodes++;if(cost<best){best=cost;bd=delta;bg=g;}
    }
   }
   values[t][s][prev]=best;choiceDelta[t][s][prev]=(short)bd;choiceGen[t][s][prev]=(short)bg;
  }
 }
 if(values[0][initial][0]==inf)return -2;
 int s=initial,prev=0;
 for(int t=0;t<h;t++){
  int delta=choiceDelta[t][s][prev],g=choiceGen[t][s][prev],net=input[16+t*4]-input[17+t*4]-g+delta;
  int grid=net>0?(net<input[19+t*4]?net:input[19+t*4]):0;
  int shed=net>grid?net-grid:0,spill=net<0?-net:0;s+=delta;prev=g;
  int* o=output+t*7;o[0]=g;o[1]=delta;o[2]=grid;o[3]=spill;o[4]=s;o[5]=shed;o[6]=grid*input[18+t*4]+g*fuel+(delta<0?-delta:delta)*wear+shed*10000;
 }
 return h;
}
}
