const fields = { weight: 'number', units: 'number', labels: 'number', temperature: 'number', hazmat: 'boolean', seal: 'boolean', carrier: 'string' };
function binary(op, a, b) { switch (op) {
    case 'and': return Boolean(a) && Boolean(b);
    case 'or': return Boolean(a) || Boolean(b);
    case '==': return a === b;
    case '!=': return a !== b;
    case '<': return a < b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    default: throw Error('Unknown operator');
} }
class Parser {
    tokens = [];
    i = 0;
    constructor(source) { if (source.length > 12000)
        throw Error('Policy exceeds 12000 characters'); const re = /\s+|#[^\n]*|"(?:[^"\\]|\\["\\n])*"|(?:\d+(?:\.\d+)?)|(?:[A-Za-z_][A-Za-z_0-9-]*)|(?:==|!=|<=|>=|[<>()=:;])/gy; let pos = 0; while (pos < source.length) {
        re.lastIndex = pos;
        const m = re.exec(source);
        if (!m)
            throw Error(`Unexpected character at ${pos}`);
        if (!/^\s|^#/.test(m[0]))
            this.tokens.push({ s: m[0], pos });
        pos = re.lastIndex;
    } if (this.tokens.length > 1500)
        throw Error('Token budget exceeded'); }
    peek() { return this.tokens[this.i]?.s; }
    take(s) { const t = this.tokens[this.i++]; if (!t || s && t.s !== s)
        throw Error(`Expected ${s || 'expression'} at ${t?.pos ?? 'end'}`); return t.s; }
    atom(depth) { if (depth > 32)
        throw Error('Expression nesting exceeds 32'); let s = this.take(); if (s === 'not')
        return { kind: 'not', child: this.atom(depth + 1) }; if (s === '(') {
        const e = this.expr(0, depth + 1);
        this.take(')');
        return e;
    } if (s[0] === '"')
        return { kind: 'lit', value: JSON.parse(s) }; if (/^\d/.test(s))
        return { kind: 'lit', value: Number(s) }; if (s === 'true' || s === 'false')
        return { kind: 'lit', value: s === 'true' }; if (!Object.hasOwn(fields, s))
        throw Error(`Unknown field ${s}`); return { kind: 'field', name: s }; }
    expr(min, depth = 0) { let left = this.atom(depth); const precedence = { or: 1, and: 2, '==': 3, '!=': 3, '<': 3, '>': 3, '<=': 3, '>=': 3 }; while ((precedence[this.peek() || ''] || 0) > min) {
        const op = this.take();
        left = { kind: 'binary', op, left, right: this.expr(precedence[op], depth + 1) };
    } return left; }
    parse() { const rules = []; const ids = new Set(); while (this.peek()) {
        this.take('require');
        const id = this.take();
        if (!/^[A-Za-z_][\w-]*$/.test(id) || ids.has(id))
            throw Error('Invalid or duplicate rule ID');
        ids.add(id);
        this.take(':');
        const expr = this.expr(0);
        this.take('message');
        const message = JSON.parse(this.take());
        if (typeof message !== 'string' || message.length > 240)
            throw Error('Message must be a short string');
        this.take(';');
        if (typeOf(expr) !== 'boolean')
            throw Error('Rule expression must be boolean');
        const code = [];
        emit(fold(expr), code);
        rules.push({ id, expr, message, code });
        if (rules.length > 60)
            throw Error('Maximum 60 rules');
    } if (!rules.length)
        throw Error('At least one rule required'); return rules; }
}
function typeOf(e) { if (e.kind === 'lit')
    return typeof e.value; if (e.kind === 'field')
    return fields[e.name]; if (e.kind === 'not') {
    if (typeOf(e.child) !== 'boolean')
        throw Error('not requires boolean');
    return 'boolean';
} const a = typeOf(e.left), b = typeOf(e.right); if (a !== b)
    throw Error('Comparison type mismatch'); if (['and', 'or'].includes(e.op) && a !== 'boolean')
    throw Error('Logical operators require booleans'); if (['<', '>', '<=', '>='].includes(e.op) && a !== 'number')
    throw Error('Ordering requires numbers'); return 'boolean'; }
function fold(e) { if (e.kind === 'not') {
    const child = fold(e.child);
    return child.kind === 'lit' ? { kind: 'lit', value: !child.value } : { ...e, child };
} if (e.kind !== 'binary')
    return e; const left = fold(e.left), right = fold(e.right); return left.kind === 'lit' && right.kind === 'lit' ? { kind: 'lit', value: binary(e.op, left.value, right.value) } : { ...e, left, right }; }
function emit(e, out) { if (e.kind === 'lit')
    out.push({ op: 'push', value: e.value });
else if (e.kind === 'field')
    out.push({ op: 'load', name: e.name });
else if (e.kind === 'not') {
    emit(e.child, out);
    out.push({ op: 'not' });
}
else {
    emit(e.left, out);
    emit(e.right, out);
    out.push({ op: 'binary', operator: e.op });
} }
export function compile(source) { return new Parser(source).parse(); }
export function interpret(e, s) { if (e.kind === 'lit')
    return e.value; if (e.kind === 'field')
    return s[e.name]; if (e.kind === 'not')
    return !interpret(e.child, s); return binary(e.op, interpret(e.left, s), interpret(e.right, s)); }
export function execute(code, s) { const stack = []; for (const i of code) {
    if (i.op === 'push')
        stack.push(i.value);
    else if (i.op === 'load')
        stack.push(s[i.name]);
    else if (i.op === 'not')
        stack.push(!stack.pop());
    else {
        const b = stack.pop(), a = stack.pop();
        stack.push(binary(i.operator, a, b));
    }
} if (stack.length !== 1 || typeof stack[0] !== 'boolean')
    throw Error('Invalid VM state'); return stack[0]; }
export function validateShipment(s) { if (!s || typeof s.id !== 'string' || s.id.length > 80 || !s.id)
    throw Error('Shipment ID required'); for (const [f, t] of Object.entries(fields)) {
    const v = s[f];
    if (typeof v !== t || t === 'number' && (!Number.isFinite(v) || Math.abs(v) > 1000000))
        throw Error(`Invalid shipment ${f}`);
} if (s.units < 0 || s.labels < 0 || s.weight < 0 || !Number.isInteger(s.units) || !Number.isInteger(s.labels) || s.carrier.length > 80)
    throw Error('Invalid shipment quantities'); }
export function evaluate(source, shipments) { const rules = compile(source); if (!Array.isArray(shipments) || shipments.length > 200)
    throw Error('Maximum 200 shipments'); const ids = new Set(); return { rules: rules.map(r => ({ id: r.id, instructions: r.code.length, message: r.message })), results: shipments.map(s => { validateShipment(s); if (ids.has(s.id))
        throw Error('Duplicate shipment ID'); ids.add(s.id); const checks = rules.map(r => ({ id: r.id, pass: execute(r.code, s), message: r.message })); return { id: s.id, pass: checks.every(x => x.pass), checks }; }) }; }
export function workspace(input) {
    if (!input || !Array.isArray(input.events) || input.events.length > 500)
        throw Error('Bounded event journal required');
    let policy = input.policy;
    let shipments = structuredClone(input.shipments);
    const history = [];
    const seen = new Map();
    let revision = 0;
    let approvals = {};
    evaluate(policy, shipments);
    for (const e of input.events) {
        if (!e || typeof e.id !== 'string' || !e.id || e.id.length > 80 || !Number.isInteger(e.revision))
            throw Error('Invalid event identity');
        const serialized = JSON.stringify(e);
        if (seen.has(e.id)) {
            if (seen.get(e.id) !== serialized)
                throw Error('Idempotency key conflict');
            continue;
        }
        if (e.revision !== revision)
            throw Error('Revision conflict');
        const p = e.payload;
        if (e.type === 'policy') {
            if (typeof p?.source !== 'string')
                throw Error('Policy source required');
            evaluate(p.source, shipments);
            policy = p.source;
            approvals = {};
        }
        else if (e.type === 'edit') {
            validateShipment(p);
            if (!shipments.some(s => s.id === p.id))
                throw Error('Shipment not found');
            shipments = shipments.map(s => s.id === p.id ? p : s);
            delete approvals[p.id];
        }
        else if (e.type === 'approve') {
            if (typeof p?.shipment !== 'string' || typeof p?.note !== 'string' || p.note.trim().length < 4 || p.note.length > 240)
                throw Error('Approval needs shipment and review note');
            const row = evaluate(policy, shipments).results.find(s => s.id === p.shipment);
            if (!row?.pass)
                throw Error('Failing shipment cannot be approved');
            approvals[p.shipment] = revision + 1;
        }
        else
            throw Error('Unknown operation');
        seen.set(e.id, serialized);
        revision++;
        history.push({ revision, type: e.type, id: e.id });
    }
    const report = evaluate(policy, shipments);
    const impact = input.candidate ? evaluate(input.candidate, shipments).results.map((r, i) => ({ id: r.id, before: report.results[i].pass, after: r.pass, changed: report.results[i].pass !== r.pass })) : [];
    return { revision, policy, shipments, approvals, history, ...report, impact };
}
