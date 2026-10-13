import kotlin.random.Random
fun main(){
 val r=Random(13102026);var cases=0
 repeat(300){
  val nodes=(0..7).map{Node("p$it","1.0",it<2)}
  val edges=(0..18).map{Edge("p${r.nextInt(8)}","p${r.nextInt(8)}",if(r.nextInt(4)==0)"dev" else "runtime")}.distinct()
  val adv=(0..4).map{Advisory("a$it","p${r.nextInt(8)}",r.nextInt(1,11))}
  val actions=(0..7).map{i->Action("fix$i",r.nextInt(1,20),adv.filter{r.nextBoolean()}.map{it.id}.ifEmpty{listOf(adv[i%5].id)},if(i%3==0&&i<7)listOf("fix${i+1}") else emptyList())}
  val b=Bundle(1,nodes,edges,adv,actions);val a=analyse(b)
  // Independent transitive closure, rather than the engine's BFS/Tarjan.
  val matrix=Array(8){BooleanArray(8)};repeat(8){matrix[it][it]=true};edges.filter{it.scope=="runtime"}.forEach{matrix[it.from.substring(1).toInt()][it.to.substring(1).toInt()]=true}
  for(k in 0..7)for(i in 0..7)for(j in 0..7)matrix[i][j]=matrix[i][j]||(matrix[i][k]&&matrix[k][j])
  val reachable=(0..1).flatMap{i->adv.filter{matrix[i][it.packageId.substring(1).toInt()]}.map{"p$i/"+it.id}}.toSet()
  check(a.exposures.map{it.root+"/"+it.advisory}.toSet()==reachable)
  for(c in a.components)for(x in c)for(y in c)check(matrix[x.substring(1).toInt()][y.substring(1).toInt()]&&matrix[y.substring(1).toInt()][x.substring(1).toInt()])
  for(e in a.exposures){check(e.path.first()==e.root&&e.path.last()==e.packageId);e.path.zipWithNext().forEach{(x,y)->check(edges.any{it.from==x&&it.to==y&&it.scope=="runtime"})}}
  val budget=r.nextInt(0,40);var weight=-1;var cost=Int.MAX_VALUE
  for(mask in 0 until(1 shl actions.size)){
   val chosen=actions.filterIndexed{i,_->mask and(1 shl i)!=0};val sum=chosen.sumOf{it.cost};if(sum>budget||chosen.any{x->chosen.any{y->x.id in y.excludes||y.id in x.excludes}})continue
   val fixed=chosen.flatMap{it.fixes}.toSet();val w=a.exposures.filter{it.advisory in fixed}.sumOf{it.severity}
   if(w>weight||(w==weight&&sum<cost)){weight=w;cost=sum}
  }
  val plan=optimise(b,budget);val fixed=actions.filter{it.id in plan.actions}.flatMap{it.fixes}.toSet();check(plan.cost==cost);check(a.exposures.filter{it.advisory in fixed}.sumOf{it.severity}==weight);cases++
 }
 val cycle=Bundle(1,listOf(Node("app","1",true),Node("a","1"),Node("b","1")),listOf(Edge("app","a"),Edge("a","b"),Edge("b","a")),listOf(Advisory("risk","b",10)),listOf(Action("fix",4,listOf("risk"))))
 check(analyse(cycle).components.any{it==listOf("a","b")});check(optimise(cycle,4).covered==1)
 println("300 independent transitive-closure and exhaustive subset oracle cases passed; cycle fixture passed.")
}
