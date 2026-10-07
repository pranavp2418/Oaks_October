-- Exact branch-and-bound sequence search with a disclosed node budget.
local function solve(input)
 local jobs=input.jobs
 local n=#jobs
 local budget=input.budget
 local setup=input.setup
 local idindex={}
 for i,j in ipairs(jobs) do idindex[j.id]=i end
 local nodes=0
 local pruned=0
 local cut=false
 local best=math.huge
 local bestschedule={}
 local function copy(a)
  local b={} for i,x in ipairs(a) do b[i]={id=x.id,start=x.start,finish=x.finish,tardiness=x.tardiness,family=x.family} end return b
 end
 local function ready(j,used)
  for _,id in ipairs(j.predecessors) do if not used[idindex[id]] then return false end end return true
 end
 local function visit(used,count,time,family,cost,schedule)
  if nodes>=budget then cut=true return end
  nodes=nodes+1
  if count==n then
   if cost<best then best=cost bestschedule=copy(schedule) end
   return
  end
  local bound=cost
  for i,j in ipairs(jobs) do
   if not used[i] then bound=bound+math.max(0,math.max(time,j.release)+j.duration-j.due)*j.weight end
  end
  if bound>=best then pruned=pruned+1 return end
  local candidates={}
  for i,j in ipairs(jobs) do if not used[i] and ready(j,used) then candidates[#candidates+1]=i end end
  table.sort(candidates,function(a,b)
   if jobs[a].due~=jobs[b].due then return jobs[a].due<jobs[b].due end
   return jobs[a].id<jobs[b].id
  end)
  for _,i in ipairs(candidates) do
   local j=jobs[i]
   local change=(family and family~=j.family) and setup or 0
   local start=math.max(time+change,j.release)
   local finish=start+j.duration
   local tard=math.max(0,finish-j.due)
   used[i]=true
   schedule[#schedule+1]={id=j.id,start=start,finish=finish,tardiness=tard,family=j.family}
   visit(used,count+1,finish,j.family,cost+tard*j.weight,schedule)
   used[i]=nil schedule[#schedule]=nil
   if cut then return end
  end
 end
 -- Establish a feasible earliest-due-date incumbent before bounded search.
 local used={} local schedule={} local time=0 local family=nil local cost=0
 for _=1,n do
  local chosen=nil
  for i,j in ipairs(jobs) do if not used[i] and ready(j,used) and (not chosen or j.due<jobs[chosen].due or (j.due==jobs[chosen].due and j.id<jobs[chosen].id)) then chosen=i end end
  local j=jobs[chosen]
  local change=(family and family~=j.family) and setup or 0
  local start=math.max(time+change,j.release)
  time=start+j.duration local tard=math.max(0,time-j.due)
  cost=cost+tard*j.weight
  schedule[#schedule+1]={id=j.id,start=start,finish=time,tardiness=tard,family=j.family}
  family=j.family used[chosen]=true
 end
 best=cost bestschedule=copy(schedule)
 visit({},0,0,nil,0,{})
 local out={"{\"objective\":"..best..",\"baselineObjective\":"..cost..",\"nodes\":"..nodes..",\"pruned\":"..pruned..",\"optimal\":"..tostring(not cut)..",\"schedule\":["}
 for i,j in ipairs(bestschedule) do
  if i>1 then out[#out+1]="," end
  out[#out+1]=string.format('{"id":"%s","family":"%s","start":%d,"finish":%d,"tardiness":%d}',j.id,j.family,j.start,j.finish,j.tardiness)
 end
 out[#out+1]="]}" return table.concat(out)
end
return solve(INPUT)
