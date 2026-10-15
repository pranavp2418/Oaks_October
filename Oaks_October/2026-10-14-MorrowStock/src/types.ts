export type Workspace = { schema: number; journal: any[] };
export type Result = {
  workspace: Workspace;
  state: {
    inventory_version: number;
    lots: any[];
    orders: any[];
    plans: any[];
    allocations: any[];
    purchases: any[];
    audit: any[];
    receipts: number;
    audit_head: string;
  };
  agents: any[];
  solution: any;
  receipt: any;
  boundary: string;
};
