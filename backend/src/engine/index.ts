/**
 * Fluxo execution engine — PUBLIC INTERFACE.
 *
 *   runWorkflow({ workflowId, trigger, input }): Promise<ExecutionDetail>
 *   getExecutionDetail(executionId): Promise<ExecutionDetail | null>
 */
export { runWorkflow } from "./executor";
export type { RunWorkflowOpts } from "./executor";
export { getExecutionDetail, serializeExecution } from "./serialize";
export type { ExecutionDetail, NodeRunJson } from "./serialize";
export { resolveExpr, resolveDeep } from "./expr";
export type { ExprContext } from "./expr";
export { registry, getHandler, TRIGGER_KINDS } from "./registry";
export type { NodeKind } from "./registry";
