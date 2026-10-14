import com.google.gson.Gson
import java.security.MessageDigest
import java.util.ArrayDeque

data class Node(val id:String, val version:String, val root:Boolean=false)
data class Edge(val from:String,val to:String,val scope:String="runtime")
data class Advisory(val id:String,val packageId:String,val severity:Int)
data class Action(val id:String,val cost:Int,val fixes:List<String>,val excludes:List<String> = emptyList())
data class Bundle(val schema:Int,val nodes:List<Node>,val edges:List<Edge>,val advisories:List<Advisory>,val actions:List<Action>)
data class Exposure(val root:String,val advisory:String,val packageId:String,val severity:Int,val path:List<String>)
data class Analysis(val exposures:List<Exposure>,val components:List<List<String>>,val runtimeEdges:Int,val excludedDevEdges:Int)
data class Plan(val actions:List<String>,val cost:Int,val covered:Int,val total:Int,val states:Int)
val gson=Gson()
fun digest(text:String)=MessageDigest.getInstance("SHA-256").digest(text.toByteArray()).joinToString(""){"%02x".format(it)}
fun requireId(v:String){require(v.matches(Regex("[A-Za-z0-9_.:-]{1,80}"))){"Invalid ID"}}
fun validate(b:Bundle):Bundle{
 require(b.schema==1){"Unsupported schema"};require(b.nodes.isNotEmpty()&&b.nodes.size<=500&&b.edges.size<=5000&&b.advisories.size<=100&&b.actions.size<=20){"Input limits exceeded"}
 require(b.nodes.map{it.id}.toSet().size==b.nodes.size){"Duplicate package IDs"};val ids=b.nodes.map{it.id}.toSet()
 b.nodes.forEach{requireId(it.id);require(it.version.length in 1..80){"Version required"}}
 require(b.nodes.any{it.root}){"No application roots"}
 b.edges.forEach{require(it.from in ids&&it.to in ids&&it.scope in listOf("runtime","dev")){"Invalid dependency edge"}}
 require(b.advisories.map{it.id}.toSet().size==b.advisories.size){"Duplicate advisory"}
 b.advisories.forEach{requireId(it.id);require(it.packageId in ids&&it.severity in 1..10){"Invalid advisory"}}
 val aIds=b.advisories.map{it.id}.toSet();val actions=b.actions.map{it.id}.toSet()
 require(actions.size==b.actions.size){"Duplicate action"}
 b.actions.forEach{a->requireId(a.id);require(a.cost in 1..1000000&&a.fixes.isNotEmpty()&&a.fixes.all{it in aIds}&&a.excludes.all{it in actions&&it!=a.id}){"Invalid remediation action"}}
 return b
}
fun analyse(b:Bundle):Analysis{
 validate(b);val graph=b.nodes.associate{it.id to mutableListOf<String>()}
 b.edges.filter{it.scope=="runtime"}.forEach{graph.getValue(it.from).add(it.to)}
 graph.values.forEach{it.sort()}
 var next=0;val index=mutableMapOf<String,Int>();val low=mutableMapOf<String,Int>();val stack=ArrayDeque<String>();val on=mutableSetOf<String>();val components=mutableListOf<List<String>>()
 fun visit(v:String){index[v]=next;low[v]=next;next++;stack.push(v);on.add(v);for(w in graph.getValue(v)){if(w !in index){visit(w);low[v]=minOf(low.getValue(v),low.getValue(w))}else if(w in on)low[v]=minOf(low.getValue(v),index.getValue(w))};if(low[v]==index[v]){val c=mutableListOf<String>();do{val w=stack.pop();on.remove(w);c.add(w)}while(w!=v);components.add(c.sorted())}}
 for(v in graph.keys.sorted())if(v !in index)visit(v)
 val exposures=mutableListOf<Exposure>()
 for(root in b.nodes.filter{it.root}.sortedBy{it.id}){
  val parents=mutableMapOf<String,String?>(root.id to null);val queue=ArrayDeque<String>();queue.add(root.id)
  while(queue.isNotEmpty()){val v=queue.remove();for(w in graph.getValue(v))if(w !in parents){parents[w]=v;queue.add(w)}}
  for(a in b.advisories.sortedBy{it.id})if(a.packageId in parents){val path=mutableListOf<String>();var v:String?=a.packageId;while(v!=null){path.add(v);v=parents[v]};exposures.add(Exposure(root.id,a.id,a.packageId,a.severity,path.reversed()))}
 }
 return Analysis(exposures,components.sortedBy{it.first()},b.edges.count{it.scope=="runtime"},b.edges.count{it.scope=="dev"})
}
fun optimise(b:Bundle,budget:Int):Plan{
 require(budget in 0..10000000){"Invalid budget"}
 val analysis=analyse(b)
 // Every bundle fixes an advisory across all exposed roots. Compact by advisory,
 // preserving both total severity and the number of root/advisory exposures.
 val groups=analysis.exposures.groupBy{it.advisory}
 val weights=groups.mapValues{(_,v)->v.sumOf{it.severity}}
 val coverage=b.actions.associate{a->a.id to a.fixes.filter{it in groups}.toSet()}
 val actions=b.actions.sortedBy{it.id}
 val suffix=Array(actions.size+1){emptySet<String>()}
 for(i in actions.indices.reversed())suffix[i]=suffix[i+1]+coverage.getValue(actions[i].id)
 var bestWeight=-1;var bestCost=Int.MAX_VALUE;var best=emptyList<String>();var coveredBest=0;var states=0
 fun search(i:Int,chosen:List<Action>,cost:Int,covered:Set<String>){
  states++
  val weight=covered.sumOf{weights.getValue(it)};val names=chosen.map{it.id}
  if(weight>bestWeight||(weight==bestWeight&&(cost<bestCost||(cost==bestCost&&names.joinToString(",")<best.joinToString(","))))){bestWeight=weight;bestCost=cost;best=names;coveredBest=covered.sumOf{groups.getValue(it).size}}
  if(i==actions.size)return
  val upper=(covered+suffix[i]).sumOf{weights.getValue(it)}
  // Costs are strictly positive: equal coverage at >= incumbent cost cannot
  // improve by adding a bundle. The current lexicographic tie was checked above.
  if(upper<bestWeight||(upper==bestWeight&&cost>=bestCost))return
  val a=actions[i]
  if(cost+a.cost<=budget&&chosen.none{a.id in it.excludes||it.id in a.excludes})search(i+1,chosen+a,cost+a.cost,covered+coverage.getValue(a.id))
  search(i+1,chosen,cost,covered)
 }
 search(0,emptyList(),0,emptySet())
 return Plan(best,bestCost,coveredBest,analysis.exposures.size,states)

}

fun parseBundle(text:String):Bundle{
 val json=com.google.gson.JsonParser.parseString(text).asJsonObject
 for(n in json.getAsJsonArray("nodes"))if(!n.asJsonObject.has("root"))n.asJsonObject.addProperty("root",false)
 for(e in json.getAsJsonArray("edges"))if(!e.asJsonObject.has("scope"))e.asJsonObject.addProperty("scope","runtime")
 for(a in json.getAsJsonArray("actions"))if(!a.asJsonObject.has("excludes"))a.asJsonObject.add("excludes",com.google.gson.JsonArray())
 return validate(gson.fromJson(json,Bundle::class.java))
}
