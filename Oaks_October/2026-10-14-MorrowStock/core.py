"""Integral perishable allocation and transactional, explicitly single-user operations."""
from __future__ import annotations

from contextlib import contextmanager
from hashlib import sha256
import json
import re
import sqlite3
from time import perf_counter

MAX_ROWS = 32
MAX_UNITS = 400
ID = re.compile(r"^[A-Za-z0-9_-]{1,48}$")


def packed(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return sha256(packed(value).encode()).hexdigest()


def integer(value, low, high, field):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{field} must be an integer in [{low}, {high}]")
    return value


def ident(value):
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ValueError("Identifiers must be 1–48 letters, digits, underscores or hyphens")
    return value


def validate(data):
    if not isinstance(data, dict) or set(data) != {"lots", "orders"}:
        raise ValueError("Import requires exactly lots and orders")
    lots, orders = data["lots"], data["orders"]
    for rows, fields in [(lots, {"id", "sku", "quantity", "arrival", "expiry", "location"}),
                         (orders, {"id", "sku", "quantity", "due", "priority", "location"})]:
        if not isinstance(rows, list) or not 1 <= len(rows) <= MAX_ROWS:
            raise ValueError("Each collection requires 1–32 rows")
        seen = set()
        for row in rows:
            if not isinstance(row, dict) or set(row) != fields:
                raise ValueError("Unexpected or missing import fields")
            ident(row["id"]); ident(row["sku"])
            if row["id"] in seen:
                raise ValueError("Duplicate identifier")
            seen.add(row["id"])
            integer(row["quantity"], 1, MAX_UNITS, "quantity")
            integer(row["location"], 0, 20, "location")
            if "arrival" in row:
                integer(row["arrival"], 0, 30, "arrival")
                integer(row["expiry"], row["arrival"], 30, "expiry")
            else:
                integer(row["due"], 0, 30, "due")
                integer(row["priority"], 1, 9, "priority")
        if sum(r["quantity"] for r in rows) > MAX_UNITS:
            raise ValueError("Collection exceeds 400 cases")
    return data


def unit_cost(lot, order):
    # Integer synthetic planning cost, not a claimed financial valuation.
    return abs(lot["location"] - order["location"]) * 3 + lot["expiry"] - order["due"]


def compatible(lot, order):
    return lot["sku"] == order["sku"] and lot["arrival"] <= order["due"] <= lot["expiry"]


def allocate(lots, orders):
    """Successive shortest augmenting paths, including explicit shortage arcs.

    Reverse arcs allow rerouting an earlier allocation. Bellman–Ford handles
    their negative costs. Bounded integral capacities give integral output.
    """
    started = perf_counter()
    n, m = len(lots), len(orders)
    source, sink = n + m, n + m + 1
    graph = [[] for _ in range(sink + 1)]
    traced = []

    def edge(a, b, cap, cost):
        forward = [b, len(graph[b]), cap, cost, cap]
        backward = [a, len(graph[a]), 0, -cost, 0]
        graph[a].append(forward); graph[b].append(backward)
        return forward

    for i, lot in enumerate(lots):
        edge(source, i, lot["quantity"], 0)
        for j, order in enumerate(orders):
            if compatible(lot, order):
                e = edge(i, n + j, min(lot["quantity"], order["quantity"]), unit_cost(lot, order))
                traced.append((lot, order, e))
    short_edges = []
    for j, order in enumerate(orders):
        edge(n + j, sink, order["quantity"], 0)
        short_edges.append(edge(source, n + j, order["quantity"], 1000 * order["priority"]))
    remaining = sum(o["quantity"] for o in orders)
    cost, augmentations, relaxations = 0, 0, 0
    while remaining:
        distance, previous = [float("inf")] * len(graph), [None] * len(graph)
        distance[source] = 0
        for _ in range(len(graph) - 1):
            changed = False
            for a, edges in enumerate(graph):
                if distance[a] == float("inf"):
                    continue
                for k, e in enumerate(edges):
                    relaxations += 1
                    if e[2] and distance[e[0]] > distance[a] + e[3]:
                        distance[e[0]] = distance[a] + e[3]
                        previous[e[0]] = (a, k)
                        changed = True
            if not changed:
                break
        if previous[sink] is None:
            raise RuntimeError("Shortage arcs must make every demand feasible")
        delta, node = remaining, sink
        while node != source:
            a, k = previous[node]; delta = min(delta, graph[a][k][2]); node = a
        node = sink
        while node != source:
            a, k = previous[node]; e = graph[a][k]
            e[2] -= delta; graph[node][e[1]][2] += delta; node = a
        cost += delta * distance[sink]; remaining -= delta; augmentations += 1
    allocations = [{"lot": lot["id"], "order": order["id"], "quantity": e[4] - e[2],
                    "unit_cost": e[3]} for lot, order, e in traced if e[4] > e[2]]
    shortages = [{"order": o["id"], "sku": o["sku"], "quantity": e[4] - e[2],
                  "due": o["due"], "priority": o["priority"]}
                 for o, e in zip(orders, short_edges) if e[4] > e[2]]
    return {"allocations": allocations, "shortages": shortages, "objective": cost,
            "served": sum(a["quantity"] for a in allocations),
            "metrics": {"elapsed_ms": round((perf_counter() - started) * 1000, 3),
                        "nodes": len(graph), "directed_arcs": sum(map(len, graph)),
                        "augmentations": augmentations, "relaxations": relaxations}}


SCHEMA = """
CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, schema_version INTEGER NOT NULL);
INSERT OR IGNORE INTO meta VALUES(1,0,1);
CREATE TABLE IF NOT EXISTS lots(id TEXT PRIMARY KEY,sku TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),arrival INTEGER NOT NULL,expiry INTEGER NOT NULL CHECK(expiry>=arrival),location INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('ACTIVE','RECALLED')));
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,sku TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),due INTEGER NOT NULL,priority INTEGER NOT NULL,location INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,version INTEGER NOT NULL,digest TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,review TEXT);
CREATE TABLE IF NOT EXISTS allocations(plan TEXT NOT NULL REFERENCES plans(id),line INTEGER NOT NULL,lot TEXT NOT NULL REFERENCES lots(id),order_id TEXT NOT NULL REFERENCES orders(id),quantity INTEGER NOT NULL CHECK(quantity>0),status TEXT NOT NULL CHECK(status IN ('RESERVED','PICKED','RELEASED')),PRIMARY KEY(plan,line));
CREATE INDEX IF NOT EXISTS allocations_lot_status ON allocations(lot,status);
CREATE INDEX IF NOT EXISTS allocations_order_status ON allocations(order_id,status);
CREATE TABLE IF NOT EXISTS purchases(id TEXT PRIMARY KEY,body TEXT NOT NULL,status TEXT NOT NULL,review TEXT);
CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,response TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY,body TEXT NOT NULL,previous TEXT NOT NULL,hash TEXT NOT NULL);
"""


class Store:
    def __init__(self, path=":memory:"):
        self.db = sqlite3.connect(path, timeout=5, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.executescript(SCHEMA)
        if self.db.execute("SELECT schema_version FROM meta").fetchone()[0] != 1:
            raise ValueError("Unsupported workspace schema")

    def close(self):
        self.db.close()

    def rows(self, sql, args=()):
        return [dict(r) for r in self.db.execute(sql, args)]

    def one(self, table, key):
        if table not in {"lots", "orders", "plans", "purchases"}:
            raise ValueError("Invalid table")
        rows = self.rows(f"SELECT * FROM {table} WHERE id=?", (ident(key),))
        if not rows:
            raise ValueError(f"Unknown {table} identifier")
        return rows[0]

    @property
    def version(self):
        return self.db.execute("SELECT version FROM meta").fetchone()[0]

    def advance(self):
        self.db.execute("UPDATE meta SET version=version+1")

    @contextmanager
    def transaction(self):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield
            self.check_invariants()
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def audit_check(self):
        previous = "0" * 64
        for expected, row in enumerate(self.rows("SELECT * FROM audit ORDER BY seq"), 1):
            if row["seq"] != expected or row["previous"] != previous or row["hash"] != digest([expected, previous, json.loads(row["body"])]):
                raise ValueError("Audit chain integrity failure")
            previous = row["hash"]
        return previous

    def event(self, body):
        previous = self.audit_check()
        seq = self.db.execute("SELECT COUNT(*) FROM audit").fetchone()[0] + 1
        self.db.execute("INSERT INTO audit VALUES(?,?,?,?)", (seq, packed(body), previous, digest([seq, previous, body])))

    def execute(self, operation):
        if not isinstance(operation, dict) or set(operation) - {"id", "kind", "args", "fail_before_commit"} or not {"id", "kind", "args"} <= set(operation):
            raise ValueError("Invalid operation envelope")
        ident(operation["id"])
        if not isinstance(operation["args"], dict):
            raise ValueError("Operation arguments must be an object")
        body = {k: operation[k] for k in ("kind", "args")}
        fp = digest(body)
        with self.transaction():
            self.audit_check()
            previous = self.rows("SELECT * FROM receipts WHERE id=?", (operation["id"],))
            if previous:
                if previous[0]["fingerprint"] != fp:
                    raise ValueError("Operation ID reused with different content")
                return json.loads(previous[0]["response"])
            handlers = {"import": self.import_data, "plan": self.plan, "review": self.review,
                        "reserve": self.reserve, "pick": self.pick, "release": self.release,
                        "recall": self.recall, "purchase": self.purchase,
                        "review_purchase": self.review_purchase, "receive": self.receive}
            if operation["kind"] not in handlers:
                raise ValueError("Unknown operation")
            result = handlers[operation["kind"]](**operation["args"])
            self.event({"operation": operation["id"], **body, "result": result})
            self.db.execute("INSERT INTO receipts VALUES(?,?,?)", (operation["id"], fp, packed(result)))
            if operation.get("fail_before_commit") is True:
                raise ValueError("Injected precommit interruption; transaction rolled back")
            return result

    def import_data(self, data):
        validate(data)
        if self.db.execute("SELECT COUNT(*) FROM lots").fetchone()[0]:
            raise ValueError("Import is only allowed into an empty workspace")
        for r in data["lots"]:
            self.db.execute("INSERT INTO lots VALUES(?,?,?,?,?,?,?)", tuple(r[k] for k in ("id", "sku", "quantity", "arrival", "expiry", "location")) + ("ACTIVE",))
        for r in data["orders"]:
            self.db.execute("INSERT INTO orders VALUES(?,?,?,?,?,?)", tuple(r[k] for k in ("id", "sku", "quantity", "due", "priority", "location")))
        self.advance()
        return {"version": self.version, "lots": len(data["lots"]), "orders": len(data["orders"])}

    def available(self):
        lots = self.rows("""SELECT l.id,l.sku,l.quantity-COALESCE(SUM(CASE WHEN a.status!='RELEASED' THEN a.quantity ELSE 0 END),0) quantity,l.arrival,l.expiry,l.location FROM lots l LEFT JOIN allocations a ON a.lot=l.id WHERE l.status='ACTIVE' GROUP BY l.id ORDER BY l.id""")
        orders = self.rows("""SELECT o.id,o.sku,o.quantity-COALESCE(SUM(CASE WHEN a.status!='RELEASED' THEN a.quantity ELSE 0 END),0) quantity,o.due,o.priority,o.location FROM orders o LEFT JOIN allocations a ON a.order_id=o.id GROUP BY o.id ORDER BY o.id""")
        return [r for r in lots if r["quantity"] > 0], [r for r in orders if r["quantity"] > 0]

    def solve(self, exclude_lot=None, demand_percent=100):
        integer(demand_percent, 50, 150, "demand_percent")
        lots, orders = self.available()
        if exclude_lot is not None:
            self.one("lots", exclude_lot)
            lots = [r for r in lots if r["id"] != exclude_lot]
        orders = [{**r, "quantity": (r["quantity"] * demand_percent + 99) // 100} for r in orders]
        return {"inventory_version": self.version, **allocate(lots, orders)}

    def plan(self, plan_id, expected_version):
        ident(plan_id)
        integer(expected_version, 0, 10000, "expected_version")
        if expected_version != self.version:
            raise ValueError("Stale inventory version; inspect and replan")
        result = self.solve()
        result.pop("metrics")
        body_hash = digest(result)
        self.db.execute("INSERT INTO plans VALUES(?,?,?,?,?,NULL)", (plan_id, self.version, body_hash, packed(result), "DRAFT"))
        return {"plan": plan_id, "digest": body_hash, **result}

    def review(self, plan_id, plan_digest, note):
        p = self.one("plans", plan_id)
        if p["status"] != "DRAFT" or p["digest"] != plan_digest or p["version"] != self.version:
            raise ValueError("Review requires the current draft and matching digest")
        if not isinstance(note, str) or not 8 <= len(note.strip()) <= 500:
            raise ValueError("Review note requires 8–500 characters")
        self.db.execute("UPDATE plans SET status='REVIEWED',review=? WHERE id=?", (note.strip(), plan_id))
        return {"plan": plan_id, "status": "REVIEWED"}

    def reserve(self, plan_id, plan_digest):
        p = self.one("plans", plan_id)
        if p["status"] != "REVIEWED" or p["digest"] != plan_digest or p["version"] != self.version:
            raise ValueError("Reservation requires current inventory and reviewed digest")
        body = json.loads(p["body"])
        if digest(body) != p["digest"]:
            raise ValueError("Plan integrity failure")
        for i, a in enumerate(body["allocations"]):
            self.db.execute("INSERT INTO allocations VALUES(?,?,?,?,?,?)", (plan_id, i, a["lot"], a["order"], a["quantity"], "RESERVED"))
        status = "RESERVED" if body["allocations"] else "COMPLETE"
        self.db.execute("UPDATE plans SET status=? WHERE id=?", (status, plan_id))
        self.advance()
        return {"plan": plan_id, "status": status, "lines": len(body["allocations"])}

    def pick(self, plan_id, line):
        p = self.one("plans", plan_id)
        integer(line, 0, MAX_ROWS * MAX_ROWS, "line")
        if p["status"] not in {"RESERVED", "PICKING"}:
            raise ValueError("Plan is not pickable")
        row = self.rows("SELECT a.*,l.status lot_status FROM allocations a JOIN lots l ON l.id=a.lot WHERE plan=? AND line=?", (plan_id, line))
        if not row or row[0]["status"] != "RESERVED" or row[0]["lot_status"] != "ACTIVE":
            raise ValueError("Line is missing, already processed or recalled")
        self.db.execute("UPDATE allocations SET status='PICKED' WHERE plan=? AND line=?", (plan_id, line))
        remaining = self.db.execute("SELECT COUNT(*) FROM allocations WHERE plan=? AND status='RESERVED'", (plan_id,)).fetchone()[0]
        status = "PICKING" if remaining else "COMPLETE"
        self.db.execute("UPDATE plans SET status=? WHERE id=?", (status, plan_id))
        self.advance()
        return {"plan": plan_id, "line": line, "quantity": row[0]["quantity"], "status": status}

    def release(self, plan_id, note):
        p = self.one("plans", plan_id)
        if p["status"] not in {"RESERVED", "PICKING", "BLOCKED"} or not isinstance(note, str) or len(note.strip()) < 8:
            raise ValueError("Release needs an active/blocked plan and a review note")
        self.db.execute("UPDATE allocations SET status='RELEASED' WHERE plan=? AND status='RESERVED'", (plan_id,))
        self.db.execute("UPDATE plans SET status='CLOSED' WHERE id=?", (plan_id,))
        self.advance()
        return {"plan": plan_id, "status": "CLOSED", "picked_preserved": True}

    def recall(self, lot_id, reason):
        self.one("lots", lot_id)
        if not isinstance(reason, str) or not 8 <= len(reason.strip()) <= 500:
            raise ValueError("Recall reason requires 8–500 characters")
        self.db.execute("UPDATE lots SET status='RECALLED' WHERE id=?", (lot_id,))
        exposure = self.rows("SELECT plan,line,order_id,quantity,status FROM allocations WHERE lot=? AND status!='RELEASED'", (lot_id,))
        self.db.execute("UPDATE plans SET status='BLOCKED' WHERE id IN (SELECT plan FROM allocations WHERE lot=? AND status='RESERVED')", (lot_id,))
        self.advance()
        return {"lot": lot_id, "status": "RECALLED", "exposure": exposure, "reason": reason.strip()}

    def purchase(self, purchase_id, sku, quantity, arrival, expiry, location):
        ident(purchase_id)
        lot = {"id": "received", "sku": sku, "quantity": quantity, "arrival": arrival, "expiry": expiry, "location": location}
        validate({"lots": [lot], "orders": [{"id": "check", "sku": sku, "quantity": 1, "due": arrival, "priority": 1, "location": location}]})
        body = {k: v for k, v in lot.items() if k != "id"}
        self.db.execute("INSERT INTO purchases VALUES(?,?,?,NULL)", (purchase_id, packed(body), "PROPOSED"))
        return {"purchase": purchase_id, "status": "PROPOSED", "digest": digest(body), **body}

    def review_purchase(self, purchase_id, purchase_digest, note):
        p = self.one("purchases", purchase_id)
        if p["status"] != "PROPOSED" or digest(json.loads(p["body"])) != purchase_digest or not isinstance(note, str) or not 8 <= len(note.strip()) <= 500:
            raise ValueError("Purchase review requires matching proposal and 8–500 character note")
        self.db.execute("UPDATE purchases SET status='REVIEWED',review=? WHERE id=?", (note.strip(), purchase_id))
        return {"purchase": purchase_id, "status": "REVIEWED"}

    def receive(self, purchase_id, lot_id):
        p = self.one("purchases", purchase_id); ident(lot_id)
        if p["status"] != "REVIEWED":
            raise ValueError("Receiving requires a reviewed purchase")
        b = json.loads(p["body"])
        if self.db.execute("SELECT COUNT(*) FROM lots").fetchone()[0] >= MAX_ROWS:
            raise ValueError("Workspace lot limit reached")
        if self.db.execute("SELECT SUM(quantity) FROM lots").fetchone()[0] + b["quantity"] > MAX_UNITS:
            raise ValueError("Workspace inventory limit reached")
        self.db.execute("INSERT INTO lots VALUES(?,?,?,?,?,?,?)", (lot_id, b["sku"], b["quantity"], b["arrival"], b["expiry"], b["location"], "ACTIVE"))
        self.db.execute("UPDATE purchases SET status='RECEIVED' WHERE id=?", (purchase_id,))
        self.advance()
        return {"purchase": purchase_id, "lot": lot_id, "status": "RECEIVED"}

    def check_invariants(self):
        for r in self.rows("""SELECT l.id,l.quantity,COALESCE(SUM(CASE WHEN a.status!='RELEASED' THEN a.quantity ELSE 0 END),0) used FROM lots l LEFT JOIN allocations a ON a.lot=l.id GROUP BY l.id"""):
            if not 0 <= r["used"] <= r["quantity"]:
                raise ValueError("Lot quantity conservation violated")
        for r in self.rows("""SELECT o.id,o.quantity,COALESCE(SUM(CASE WHEN a.status!='RELEASED' THEN a.quantity ELSE 0 END),0) used FROM orders o LEFT JOIN allocations a ON a.order_id=o.id GROUP BY o.id"""):
            if not 0 <= r["used"] <= r["quantity"]:
                raise ValueError("Order quantity conservation violated")
        invalid = self.db.execute("""SELECT COUNT(*) FROM allocations a JOIN lots l ON l.id=a.lot JOIN orders o ON o.id=a.order_id WHERE a.status!='RELEASED' AND (l.sku!=o.sku OR l.arrival>o.due OR l.expiry<o.due)""").fetchone()[0]
        if invalid:
            raise ValueError("Perishability compatibility violated")

    def snapshot(self):
        self.audit_check(); self.check_invariants()
        lots = self.rows("""SELECT l.*,COALESCE(SUM(CASE WHEN a.status='RESERVED' THEN a.quantity ELSE 0 END),0) reserved,COALESCE(SUM(CASE WHEN a.status='PICKED' THEN a.quantity ELSE 0 END),0) picked FROM lots l LEFT JOIN allocations a ON a.lot=l.id GROUP BY l.id ORDER BY l.id""")
        for r in lots:
            r["free"] = r["quantity"] - r["reserved"] - r["picked"]
        return {"schema": 1, "inventory_version": self.version, "lots": lots,
                "orders": self.rows("SELECT * FROM orders ORDER BY due,priority DESC,id"),
                "plans": [{**r, "body": json.loads(r["body"])} for r in self.rows("SELECT * FROM plans ORDER BY rowid DESC")],
                "allocations": self.rows("SELECT * FROM allocations ORDER BY plan,line"),
                "purchases": [{**r, "body": json.loads(r["body"])} for r in self.rows("SELECT * FROM purchases ORDER BY rowid")],
                "audit": self.rows("SELECT * FROM audit ORDER BY seq"),
                "receipts": self.db.execute("SELECT COUNT(*) FROM receipts").fetchone()[0],
                "audit_head": self.audit_check()}
