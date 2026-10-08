type Value = string | number | boolean;
type Expr = {
    kind: 'lit';
    value: Value;
} | {
    kind: 'field';
    name: string;
} | {
    kind: 'binary';
    op: string;
    left: Expr;
    right: Expr;
} | {
    kind: 'not';
    child: Expr;
};
export type Rule = {
    id: string;
    expr: Expr;
    message: string;
    code: Instruction[];
};
type Instruction = {
    op: 'push';
    value: Value;
} | {
    op: 'load';
    name: string;
} | {
    op: 'not';
} | {
    op: 'binary';
    operator: string;
};
export type Shipment = {
    id: string;
    weight: number;
    units: number;
    labels: number;
    temperature: number;
    hazmat: boolean;
    seal: boolean;
    carrier: string;
};
export declare function compile(source: string): Rule[];
export declare function interpret(e: Expr, s: Shipment): Value;
export declare function execute(code: Instruction[], s: Shipment): boolean;
export declare function validateShipment(s: Shipment): void;
export declare function evaluate(source: string, shipments: Shipment[]): {
    rules: {
        id: string;
        instructions: number;
        message: string;
    }[];
    results: {
        id: string;
        pass: boolean;
        checks: {
            id: string;
            pass: boolean;
            message: string;
        }[];
    }[];
};
type Event = {
    id: string;
    revision: number;
    type: string;
    payload: unknown;
};
export declare function workspace(input: {
    policy: string;
    shipments: Shipment[];
    events: Event[];
    candidate?: string;
}): {
    impact: {
        id: string;
        before: boolean;
        after: boolean;
        changed: boolean;
    }[];
    rules: {
        id: string;
        instructions: number;
        message: string;
    }[];
    results: {
        id: string;
        pass: boolean;
        checks: {
            id: string;
            pass: boolean;
            message: string;
        }[];
    }[];
    revision: number;
    policy: string;
    shipments: Shipment[];
    approvals: Record<string, number>;
    history: {
        revision: number;
        type: string;
        id: string;
    }[];
};
export {};
