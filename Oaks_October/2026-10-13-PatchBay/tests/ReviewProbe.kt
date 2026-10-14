import java.nio.file.Files
fun baseline(b:Bundle,budget:Int):Plan{
 val a=analyse(b);val targets=a.exposures.map{it.root+"/"+it.advisory}.toSet();val weights=a.exposures.associate{it.root+"/"+it.advisory to it.severity};val coverage=b.actions.associate{x->x.id to a.exposures.filter{it.advisory in x.fixes}.map{it.root+"/"+it.advisory}.toSet()};val actions=b.actions.sortedBy{it.id};var bw=-1;var bc=Int.MAX_VALUE;var best=emptyList<String>();var cb=0;var states=0
 fun search(i:Int,chosen:List<Action>,cost:Int,covered:Set<String>){states++;val weight=covered.sumOf{weights.getValue(it)};val names=chosen.map{it.id};if(weight>bw||(weight==bw&&(cost<bc||(cost==bc&&names.joinToString(",")<best.joinToString(","))))){bw=weight;bc=cost;best=names;cb=covered.size};if(i==actions.size)return;val remaining=(covered+actions.drop(i).flatMap{coverage.getValue(it.id)}).sumOf{weights.getValue(it)};if(remaining<bw)return;val x=actions[i];if(cost+x.cost<=budget&&chosen.none{x.id in it.excludes||it.id in x.excludes})search(i+1,chosen+x,cost+x.cost,covered+coverage.getValue(x.id));search(i+1,chosen,cost,covered)}
 search(0,emptyList(),0,emptySet());return Plan(best,bc,cb,targets.size,states)
}
fun fixture(n:Int):Bundle=Bundle(1,(0 until n).map{Node("p$it","1",true)},if(n==1)emptyList()else(0 until n).map{Edge("p$it","p${(it+1)%n}")},(0 until 100).map{Advisory("a$it","p${it%n}",10)},(0 until 20).map{Action("fix"+it.toString().padStart(2,'0'),1,(0 until 100).map{"a$it"})})
fun main(args:Array<String>){
 if(args.firstOrNull()=="large-baseline"){val start=System.nanoTime();val p=baseline(fixture(500),20);println(gson.toJson(mapOf("ms" to (System.nanoTime()-start)/1e6,"plan" to p)));return}
 val rows=mutableListOf<Map<String,Any>>()
 for(n in listOf(1,500))for(kind in if(n==1)listOf("baseline","current")else listOf("current")){
  repeat(4){run->val start=System.nanoTime();val p=if(kind=="baseline")baseline(fixture(n),20)else optimise(fixture(n),20);val ms=(System.nanoTime()-start)/1e6;check(p.actions==listOf("fix00")&&p.cost==1&&p.covered==n*100&&p.total==n*100);val row=mapOf("roots" to n,"advisories" to 100,"actions" to 20,"kind" to kind,"warmup" to (run==0),"ms" to ms,"states" to p.states,"cost" to p.cost,"covered" to p.covered,"total" to p.total);rows.add(row);println(gson.toJson(row))}
 }
 val races=mutableListOf<Map<String,Any>>()
 for(kind in listOf("baseline","current"))repeat(4){run->
  val path=Files.createTempFile("patchbay-export-race-",".db").toString();val b=fixture(350)
  Store(path).use{it.import("initial",b)}
  Store(path).use{reader->val writer=Thread{Thread.sleep(5);Store(path).use{it.import("newer",b)}};writer.start();val start=System.nanoTime();val e=if(kind=="current")reader.export()else{val s=reader.snapshot();val a=analyse(s.bundle);mapOf("snapshot" to s,"analysis" to a,"integrity" to reader.integrity())};writer.join();val s=e["snapshot"] as Snapshot;val integrity=e["integrity"] as Map<*,*>;val row=mapOf("kind" to kind,"warmup" to(run==0),"ms" to (System.nanoTime()-start)/1e6,"snapshot_revision" to s.revision,"audit_events" to integrity["audit_events"]!!,"current_revision" to reader.snapshot().revision);races.add(row);println(gson.toJson(row));if(kind=="current")check(s.revision==1&&integrity["audit_events"]==1&&reader.snapshot().revision==2)}
 }
 Files.writeString(java.nio.file.Path.of(args[0]),gson.toJson(mapOf("timings" to rows,"export_races" to races)))
}
