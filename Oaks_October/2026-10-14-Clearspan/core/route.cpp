// Original bounded prize-collecting grid planner. No hardware control.
static int input[512], output[2048], distances[12][256];
static int dp[1024][10], parent[1024][10], queue_[256], prev_[256];
static const int INF=1000000;
static int w,h,cells,n,expanded;
extern "C" int* input_ptr(){return input;}
extern "C" int* output_ptr(){return output;}
extern "C" void* memset(void* p,int c,unsigned long size){volatile unsigned char* b=(volatile unsigned char*)p;for(unsigned long i=0;i<size;i++)b[i]=(unsigned char)c;return p;}
static void bfs(int start,int* dist){
 for(int i=0;i<cells;i++){dist[i]=INF;prev_[i]=-1;}
 int front=0,back=0;queue_[back++]=start;dist[start]=0;
 while(front<back){int a=queue_[front++];expanded++;int ns[4]={a-w,a+1,a+w,a-1};
  for(int k=0;k<4;k++){int b=ns[k];if(b<0||b>=cells||((k==1||k==3)&&a/w!=b/w)||input[6+b]||dist[b]!=INF)continue;
   dist[b]=dist[a]+1;prev_[b]=a;queue_[back++]=b;}
 }
}
static int append_path(int from,int to,int len){
 int dist[256],rev[256],count=0;bfs(from,dist);if(dist[to]>=INF)return -1;
 for(int at=to;at!=from;at=prev_[at])rev[count++]=at;
 while(count){if(len>=2000)return -1;output[6+len++]=rev[--count];}return len;
}
extern "C" int solve(){
 w=input[0];h=input[1];int start=input[2],home=input[3],budget=input[4];n=input[5];expanded=0;
 if(w<1||w>16||h<1||h>16||n<0||n>10||budget<0||budget>512)return -1;
 cells=w*h;if(start<0||start>=cells||home<0||home>=cells||input[6+start]||input[6+home])return -1;
 int pos[10],prize[10];
 for(int i=0;i<cells;i++)if(input[6+i]!=0&&input[6+i]!=1)return -1;
 for(int i=0;i<n;i++){pos[i]=input[6+cells+i*2];prize[i]=input[7+cells+i*2];
  if(pos[i]<0||pos[i]>=cells||input[6+pos[i]]||prize[i]<1||prize[i]>100)return -1;
  for(int j=0;j<i;j++)if(pos[i]==pos[j])return -1;
  bfs(pos[i],distances[i]);
 }
 bfs(start,distances[n]);bfs(home,distances[n+1]);
 int baseCost=distances[n][home];if(baseCost>budget){output[0]=-2;return -2;}
 int masks=1<<n;
 for(int m=0;m<masks;m++)for(int j=0;j<n;j++){dp[m][j]=INF;parent[m][j]=-1;}
 for(int j=0;j<n;j++)dp[1<<j][j]=distances[n][pos[j]]+1;
 for(int m=1;m<masks;m++)for(int j=0;j<n;j++)if((m&(1<<j))&&dp[m][j]<=budget)
  for(int k=0;k<n;k++)if(!(m&(1<<k))){int nm=m|(1<<k),cost=dp[m][j]+distances[j][pos[k]]+1;
   if(cost<dp[nm][k]){dp[nm][k]=cost;parent[nm][k]=j;}}
 int bestMask=0,bestLast=-1,bestPrize=0,bestCost=baseCost;
 for(int m=1;m<masks;m++){int reward=0;for(int j=0;j<n;j++)if(m&(1<<j))reward+=prize[j];
  for(int j=0;j<n;j++)if(m&(1<<j)){int cost=dp[m][j]+distances[j][home];
   if(cost<=budget&&(reward>bestPrize||(reward==bestPrize&&cost<bestCost))){bestMask=m;bestLast=j;bestPrize=reward;bestCost=cost;}}}
 int order[10],count=0,mask=bestMask,last=bestLast;
 while(last>=0){order[count++]=last;int p=parent[mask][last];mask^=1<<last;last=p;}
 int len=0,current=start;
 while(count){int k=order[--count];len=append_path(current,pos[k],len);if(len<0)return -1;output[6+len++]=256+pos[k];current=pos[k];}
 len=append_path(current,home,len);if(len<0||len!=bestCost)return -1;
 output[0]=1;output[1]=bestCost;output[2]=bestPrize;output[3]=bestMask;output[4]=len;output[5]=expanded;return 1;
}
