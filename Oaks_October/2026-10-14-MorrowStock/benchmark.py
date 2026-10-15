"""Reproducible bounded solver benchmark, not a hosted performance promise."""
import json
import os
import platform
import random
import statistics
import time
import tracemalloc

from core import allocate, validate


def workload(seed=141022, size=24):
    rng = random.Random(seed)
    lots = [{"id":f"L{i}","sku":f"S{i%4}","quantity":rng.randint(1,8),"arrival":0,"expiry":rng.randint(2,7),"location":rng.randint(0,5)} for i in range(size)]
    orders = [{"id":f"O{i}","sku":f"S{i%4}","quantity":rng.randint(1,9),"due":rng.randint(1,7),"priority":rng.randint(1,9),"location":rng.randint(0,5)} for i in range(size)]
    validate({"lots":lots,"orders":orders})
    return lots, orders


def greedy(lots, orders):
    # Feasible priority-first nearest-cost heuristic, deliberately not an optimal oracle.
    remaining = {l["id"]:l["quantity"] for l in lots}
    cost = served = 0
    for o in sorted(orders, key=lambda x:(-x["priority"],x["due"],x["id"])):
        needed = o["quantity"]
        candidates = sorted([l for l in lots if l["sku"]==o["sku"] and l["arrival"]<=o["due"]<=l["expiry"]],key=lambda l:(3*abs(l["location"]-o["location"])+l["expiry"]-o["due"],l["id"]))
        for l in candidates:
            count = min(needed,remaining[l["id"]]); needed -= count; remaining[l["id"]] -= count
            cost += count*(3*abs(l["location"]-o["location"])+l["expiry"]-o["due"]); served += count
        cost += needed*o["priority"]*1000
    return {"objective":cost,"served":served}


def measure(fn, lots, orders):
    for _ in range(3): fn(lots,orders)
    samples=[]
    for _ in range(25):
        started=time.perf_counter_ns(); result=fn(lots,orders); samples.append((time.perf_counter_ns()-started)/1e6)
    tracemalloc.start(); fn(lots,orders); _,peak=tracemalloc.get_traced_memory(); tracemalloc.stop()
    values=sorted(samples)
    return {"p50_ms":round(statistics.median(values),4),"p95_ms":round(values[23],4),"min_ms":round(values[0],4),"max_ms":round(values[-1],4),"traced_peak_bytes_separate_run":peak,"objective":result["objective"],"served":result["served"]}


if __name__ == "__main__":
    lots,orders=workload()
    exact=measure(allocate,lots,orders); baseline=measure(greedy,lots,orders)
    assert exact["objective"]<=baseline["objective"]
    print(json.dumps({"environment":{"os":platform.platform(),"python":platform.python_version(),"compiler":platform.python_compiler(),"machine":platform.machine(),"logical_cpu_count":os.cpu_count(),"process_affinity_count":len(os.sched_getaffinity(0)) if hasattr(os,"sched_getaffinity") else None},"workload":{"seed":141022,"lots":24,"orders":24,"lot_cases":sum(l["quantity"] for l in lots),"demand_cases":sum(o["quantity"] for o in orders),"warmup":3,"repetitions":25,"method":"Sequential wall-clock perf_counter_ns; p95 nearest rank; tracemalloc separate run; shared container, no CPU isolation"},"exact_min_cost_flow":exact,"priority_nearest_greedy":baseline,"limit":"One small synthetic workload; greedy is not an optimal oracle; no throughput or production-scale extrapolation"},indent=2))
