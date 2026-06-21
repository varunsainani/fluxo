import type { NodeHandler } from "./types";
import { asArray, asString } from "./types";

/**
 * action.appendRow — config { datastore: string (name), columns: [{ name, value }] }.
 * Upserts a Datastore by (userId, name), appends a DatastoreRow { data: {name:value...} }.
 * Output = { id, data }.
 */
export const actionAppendRow: NodeHandler = async ({ config, userId, prisma }) => {
  const name = asString(config.datastore).trim() || "Untitled";

  const data: Record<string, unknown> = {};
  for (const col of asArray<unknown>(config.columns)) {
    if (col && typeof col === "object") {
      const c = col as Record<string, unknown>;
      const key = asString(c.name).trim();
      if (key) data[key] = c.value;
    }
  }

  const datastore = await prisma.datastore.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
  });

  const row = await prisma.datastoreRow.create({
    data: { datastoreId: datastore.id, data: data as object },
  });

  return { output: { id: row.id, data } };
};
