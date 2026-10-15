import {
  Annotation,
  Command,
  MemorySaver,
  StateGraph,
  START,
  END,
  interrupt,
} from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { usableRoute, canonical } from "../src/workspace.mjs";
export function makeInvestigator(engine) {
  return async function investigate(map, ctx, goal, decisions, review = false) {
    if (
      !Array.isArray(decisions) ||
      decisions.length < 1 ||
      decisions.length > 4
    )
      throw Error("One to four recorded decisions required");
    const tools = {
      inspect_map: tool(
        async () =>
          JSON.stringify({
            width: map.width,
            height: map.height,
            base: map.base,
            position: ctx.position,
            remaining: ctx.budget,
            exclusions: map.blocked,
            checkpoints: map.targets,
            already_inspected: ctx.visited,
          }),
        {
          name: "inspect_map",
          description:
            "Read map, exclusions, priorities, current position and remaining energy",
          schema: z.object({}).strict(),
        },
      ),
      plan_route: tool(
        async () => {
          const r = usableRoute(engine, map, ctx);
          delete r.milliseconds;
          return JSON.stringify(r);
        },
        {
          name: "plan_route",
          description:
            "Compute exact maximum-priority feasible inspection route and required return to base",
          schema: z.object({}).strict(),
        },
      ),
      compare_budgets: tool(
        async ({ budgets }) =>
          JSON.stringify(
            budgets.map((budget) => {
              try {
                const r = usableRoute(engine, map, { ...ctx, budget });
                return {
                  budget,
                  cost: r.cost,
                  priority: r.priority,
                  covered: r.covered,
                  uncovered: r.uncovered,
                };
              } catch {
                return { budget, error: "Return infeasible" };
              }
            }),
          ),
        {
          name: "compare_budgets",
          description:
            "Read-only hypothetical budget comparison; never changes mission energy",
          schema: z
            .object({
              budgets: z.array(z.number().int().min(0).max(512)).min(1).max(3),
            })
            .strict(),
        },
      ),
    };
    const State = Annotation.Root({
      observations: Annotation({ default: () => [], reducer: (_, x) => x }),
      decisions: Annotation({ default: () => [], reducer: (_, x) => x }),
      phase: Annotation(),
      summary: Annotation(),
      citations: Annotation(),
    });
    const saver = new MemorySaver();
    const graph = new StateGraph(State)
      .addNode("decision", async (state) => {
        const index = state.decisions.length,
          record = decisions[index],
          choice = record?.choice;
        if (
          !choice ||
          typeof choice.tool !== "string" ||
          Object.keys(choice).some((k) => !["tool", "arguments"].includes(k)) ||
          typeof choice.arguments !== "object" ||
          choice.arguments === null ||
          Array.isArray(choice.arguments) ||
          canonical(choice).length > 12000
        )
          throw Error("Invalid bounded tool decision");
        if (choice.tool === "finish") {
          const a = z
            .object({
              summary: z.string().min(3).max(2000),
              citations: z.array(z.string()).min(1).max(4),
            })
            .strict()
            .parse(choice.arguments);
          if (
            a.citations.some(
              (id) => !state.observations.some((o) => o.id === id),
            )
          )
            throw Error("Unknown evidence citation");
          return {
            decisions: [...state.decisions, record],
            phase: "REVIEW",
            summary: a.summary,
            citations: a.citations,
          };
        }
        if (!Object.hasOwn(tools, choice.tool))
          throw Error("Unknown or unauthorized tool; mission unchanged");
        const result = await tools[choice.tool].invoke(choice.arguments),
          observations = [
            ...state.observations,
            {
              id: "E" + (state.observations.length + 1),
              tool: choice.tool,
              arguments: choice.arguments,
              result: JSON.parse(result),
            },
          ];
        return {
          decisions: [...state.decisions, record],
          observations,
          phase: index === 3 ? "REVIEW" : "CONTINUE",
          summary:
            index === 3
              ? "Decision bound reached; review exact tool observations."
              : null,
          citations: index === 3 ? observations.map((o) => o.id) : [],
        };
      })
      .addNode("human", (state) => {
        const action = interrupt({
          phase: state.phase,
          evidence: state.observations.map((o) => o.id),
        });
        if (action === "review" && state.phase === "REVIEW")
          return { phase: "REVIEWED" };
        if (action === "continue" && state.phase === "CONTINUE")
          return { phase: "NEXT" };
        throw Error("Invalid human continuation");
      })
      .addEdge(START, "decision")
      .addEdge("decision", "human")
      .addConditionalEdges("human", (state) =>
        state.phase === "NEXT" ? "decision" : END,
      )
      .compile({ checkpointer: saver });
    const config = {
      configurable: { thread_id: "inspection" },
      recursionLimit: 20,
    };
    await graph.invoke(
      {
        observations: [],
        decisions: [],
        phase: "START",
        summary: null,
        citations: [],
      },
      config,
    );
    for (let i = 1; i < decisions.length; i++)
      await graph.invoke(new Command({ resume: "continue" }), config);
    if (review) await graph.invoke(new Command({ resume: "review" }), config);
    const snapshot = await graph.getState(config),
      v = snapshot.values;
    return {
      phase: v.phase,
      observations: v.observations,
      summary: v.summary,
      citations: v.citations,
      checkpoint: {
        nodes: snapshot.next,
        persisted_by:
          "validated decision journal; reconstructed LangGraph MemorySaver execution",
        decision_count: v.decisions.length,
      },
    };
  };
}
export const toolSchemas = [
  { name: "inspect_map", arguments: {} },
  { name: "plan_route", arguments: {} },
  {
    name: "compare_budgets",
    arguments: { budgets: "one to three integer budgets0..512" },
  },
  {
    name: "finish",
    arguments: { summary: "3..2000 characters", citations: "existing E IDs" },
  },
];
