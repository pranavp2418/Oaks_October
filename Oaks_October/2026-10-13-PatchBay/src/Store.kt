import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException
import java.time.Instant

data class Snapshot(val revision:Int,val bundle:Bundle,val hash:String)
class Store(path:String):AutoCloseable{
 val db:Connection=DriverManager.getConnection("jdbc:sqlite:"+path)
 init{db.createStatement().use{s->s.execute("PRAGMA busy_timeout=5000");s.execute("PRAGMA foreign_keys=ON");s.execute("PRAGMA journal_mode=WAL");s.execute("PRAGMA synchronous=FULL");s.execute("CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,bundle TEXT NOT NULL,hash TEXT NOT NULL)");s.execute("CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,hash TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','approved','applied','rolled_back')),reviewer TEXT,note TEXT,prior TEXT)");s.execute("CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,request TEXT NOT NULL,response TEXT NOT NULL)");s.execute("CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY,operation TEXT NOT NULL,revision INTEGER NOT NULL,receipt TEXT NOT NULL,previous_hash TEXT NOT NULL,hash TEXT NOT NULL)");s.execute("PRAGMA user_version=1")}}
 override fun close(){db.close()}
 fun snapshot():Snapshot{db.createStatement().use{s->s.executeQuery("SELECT revision,bundle,hash FROM meta WHERE id=1").use{r->require(r.next()){"Import a graph first"};val text=r.getString(2);require(digest(text)==r.getString(3)){"Snapshot checksum mismatch"};return Snapshot(r.getInt(1),validate(gson.fromJson(text,Bundle::class.java)),r.getString(3))}}}
 fun transaction(id:String,request:String,block:()->Any):String{
  requireId(id);db.createStatement().execute("BEGIN IMMEDIATE")
  try{
   db.prepareStatement("SELECT request,response FROM receipts WHERE id=?").use{q->q.setString(1,id);q.executeQuery().use{r->if(r.next()){require(r.getString(1)==request){"Conflicting receipt ID"};val response=r.getString(2);db.createStatement().execute("COMMIT");return response}}}
   val result=gson.toJson(block());val rev=try{snapshot().revision}catch(e:IllegalArgumentException){0}
   val prev=db.createStatement().use{s->s.executeQuery("SELECT hash FROM audit ORDER BY seq DESC LIMIT 1").use{r->if(r.next())r.getString(1) else "0".repeat(64)}}
   val hash=digest(prev+"|"+request+"|"+rev+"|"+id)
   db.prepareStatement("INSERT INTO audit(operation,revision,receipt,previous_hash,hash) VALUES(?,?,?,?,?)").use{q->listOf(request,rev,id,prev,hash).forEachIndexed{i,v->q.setObject(i+1,v)};q.executeUpdate()}
   db.prepareStatement("INSERT INTO receipts VALUES(?,?,?)").use{q->q.setString(1,id);q.setString(2,request);q.setString(3,result);q.executeUpdate()}
   db.createStatement().execute("COMMIT");return result
  }catch(e:Throwable){db.createStatement().execute("ROLLBACK");throw e}
 }
 fun saveBundle(b:Bundle,revision:Int){val text=gson.toJson(validate(b));db.prepareStatement("INSERT INTO meta VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,bundle=excluded.bundle,hash=excluded.hash").use{q->q.setInt(1,revision);q.setString(2,text);q.setString(3,digest(text));q.executeUpdate()}}
 fun import(id:String,b:Bundle)=transaction(id,"import:"+digest(gson.toJson(validate(b)))){val rev=db.createStatement().use{s->s.executeQuery("SELECT revision FROM meta WHERE id=1").use{r->if(r.next())r.getInt(1)+1 else 1}};saveBundle(b,rev);mapOf("revision" to rev,"packages" to b.nodes.size,"hash" to snapshot().hash)}
 fun propose(id:String,budget:Int)=transaction(id,"plan:$budget"){
  val s=snapshot();val p=optimise(s.bundle,budget);val planId="plan-"+id
  db.prepareStatement("INSERT INTO plans(id,revision,hash,body,status) VALUES(?,?,?,?,'draft')").use{q->q.setString(1,planId);q.setInt(2,s.revision);q.setString(3,s.hash);q.setString(4,gson.toJson(p));q.executeUpdate()};mapOf("id" to planId,"revision" to s.revision,"status" to "draft","plan" to p)
 }
 fun getPlan(id:String):Map<String,Any?>{db.prepareStatement("SELECT * FROM plans WHERE id=?").use{q->q.setString(1,id);q.executeQuery().use{r->require(r.next()){"Plan not found"};return mapOf("id" to id,"revision" to r.getInt("revision"),"hash" to r.getString("hash"),"body" to gson.fromJson(r.getString("body"),Plan::class.java),"status" to r.getString("status"),"reviewer" to r.getString("reviewer"),"note" to r.getString("note"),"prior" to r.getString("prior"))}}}
 fun approve(id:String,planId:String,reviewer:String,note:String)=transaction(id,gson.toJson(listOf("approve",planId,reviewer,note))){
  requireId(reviewer);require(note.trim().length in 3..500){"Review note required"};val p=getPlan(planId);val s=snapshot();require(p["status"]=="draft"&&p["revision"]==s.revision&&p["hash"]==s.hash){"Plan is stale or already reviewed"}
  require(planId!="plan-"+reviewer){"Reviewer must differ from plan creator receipt"}
  db.prepareStatement("UPDATE plans SET status='approved',reviewer=?,note=? WHERE id=?").use{q->q.setString(1,reviewer);q.setString(2,note);q.setString(3,planId);q.executeUpdate()};mapOf("id" to planId,"status" to "approved","reviewer" to reviewer)
 }
 fun apply(id:String,planId:String,fail:Boolean)=transaction(id,"apply:$planId:$fail"){
  val p=getPlan(planId);val s=snapshot();require(p["status"]=="approved"&&p["revision"]==s.revision&&p["hash"]==s.hash){"Approved current plan required"};val plan=p["body"] as Plan;val fixes=s.bundle.actions.filter{it.id in plan.actions}.flatMap{it.fixes}.toSet()
  val b=s.bundle.copy(advisories=s.bundle.advisories.filter{it.id !in fixes},actions=s.bundle.actions.map{it.copy(fixes=it.fixes.filter{it !in fixes})}.filter{it.fixes.isNotEmpty()}.let{a->val ids=a.map{it.id}.toSet();a.map{it.copy(excludes=it.excludes.filter{it in ids})}})
  saveBundle(b,s.revision+1)
  db.prepareStatement("UPDATE plans SET status='applied',prior=? WHERE id=?").use{q->q.setString(1,gson.toJson(s.bundle));q.setString(2,planId);q.executeUpdate()}
  if(fail)throw IllegalStateException("Injected failure before commit; transaction rolled back")
  mapOf("id" to planId,"status" to "applied","revision" to s.revision+1,"remaining_exposures" to analyse(b).exposures.size)
 }
 fun rollback(id:String,planId:String)=transaction(id,"rollback:$planId"){
  val p=getPlan(planId);val s=snapshot();require(p["status"]=="applied"&&s.revision==(p["revision"] as Int)+1){"Rollback requires the immediate applied revision"};val b=validate(gson.fromJson(p["prior"] as String,Bundle::class.java));saveBundle(b,s.revision+1)
  db.prepareStatement("UPDATE plans SET status='rolled_back' WHERE id=?").use{q->q.setString(1,planId);q.executeUpdate()};mapOf("status" to "rolled_back","revision" to s.revision+1)
 }
 fun integrity():Map<String,Any>{var previous="0".repeat(64);var count=0;db.createStatement().use{s->s.executeQuery("SELECT * FROM audit ORDER BY seq").use{r->while(r.next()){require(r.getString("previous_hash")==previous){"Audit predecessor mismatch"};val hash=digest(previous+"|"+r.getString("operation")+"|"+r.getInt("revision")+"|"+r.getString("receipt"));require(hash==r.getString("hash")){"Audit chain corruption"};previous=hash;count++}}};val sqlite=db.createStatement().use{s->s.executeQuery("PRAGMA integrity_check").use{r->r.next();r.getString(1)}};require(sqlite=="ok"){"Database integrity failure"};snapshot();return mapOf("sqlite" to sqlite,"audit_events" to count,"head_hash" to previous)}
 fun <T> readTransaction(block:()->T):T{db.createStatement().use{it.execute("BEGIN")};try{val result=block();db.createStatement().use{it.execute("COMMIT")};return result}catch(e:Throwable){db.createStatement().use{it.execute("ROLLBACK")};throw e}}
 fun status():Map<String,Any> = readTransaction{val s=snapshot();mapOf("revision" to s.revision,"hash" to s.hash,"integrity" to integrity())}
 fun export():Map<String,Any> = readTransaction{val s=snapshot();val plans=mutableListOf<Map<String,Any?>>();db.createStatement().use{q->q.executeQuery("SELECT id FROM plans ORDER BY id").use{r->while(r.next())plans.add(getPlan(r.getString(1)))}};mapOf("schema" to 1,"snapshot" to s,"analysis" to analyse(s.bundle),"plans" to plans,"integrity" to integrity(),"model" to "Synthetic bounded remediation rehearsal; no real package manager commands")}
}
