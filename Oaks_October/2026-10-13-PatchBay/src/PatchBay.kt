import java.nio.file.Files
import java.nio.file.Path
import kotlin.system.exitProcess
fun main(args:Array<String>){
 if(args.isEmpty()||args[0]=="--help"){println("""PatchBay — dependency remediation workbench
Usage: ./patchbay <database> <command> [arguments]
  import <graph.json> <receipt-id>       Atomically import a bounded graph
  analyze                              Runtime exposures, shortest paths and SCCs
  plan <budget> <receipt-id>            Exact weighted coverage under a budget
  approve <plan-id> <reviewer> <note> <receipt-id>
  apply <plan-id> <receipt-id> [--fail]  Apply a reviewed remediation rehearsal
  rollback <plan-id> <receipt-id>       Undo the immediate applied revision
  status                               Snapshot + SQLite/audit integrity
  export <output.json>                  Evidence dossier
Synthetic rehearsal only. Local SQLite, file access is the security boundary.
""");return}
 try{require(args.size>=2){"Database and command required"};Store(args[0]).use{s->val a=args.drop(2);fun n(size:Int){require(a.size>=size){"Missing arguments; use --help"}};val out=when(args[1]){
 "import"->{n(2);val p=Path.of(a[0]);require(Files.size(p)<=1000000){"Input exceeds 1 MB"};s.import(a[1],parseBundle(Files.readString(p)))}
 "analyze"->gson.toJson(analyse(s.snapshot().bundle))
 "plan"->{n(2);s.propose(a[1],a[0].toInt())}
 "approve"->{n(4);s.approve(a[3],a[0],a[1],a[2])}
 "apply"->{n(2);s.apply(a[1],a[0],a.getOrNull(2)=="--fail")}
 "rollback"->{n(2);s.rollback(a[1],a[0])}
 "status"->gson.toJson(s.status())
 "export"->{n(1);val data=gson.toJson(s.export());val target=Path.of(a[0]).toAbsolutePath();val temp=Files.createTempFile(target.parent,"patchbay-",".json");Files.writeString(temp,data);Files.move(temp,target,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);gson.toJson(mapOf("exported" to target.toString(),"sha256" to digest(data)))}
 else->throw IllegalArgumentException("Unknown command")};println(out)}}catch(e:Throwable){System.err.println("PatchBay: "+(e.message?:e.javaClass.simpleName));exitProcess(2)}
}
