import type { NodeHandler } from "./types";
import { asString } from "./types";

const VALID_CHANNELS = new Set(["inbox", "slack", "whatsapp", "email"]);

/**
 * action.notify — config { channel, title, body }. Creates a Notification.
 * Output = the notification row.
 */
export const actionNotify: NodeHandler = async ({ config, userId, prisma }) => {
  let channel = asString(config.channel, "inbox").trim().toLowerCase();
  if (!VALID_CHANNELS.has(channel)) channel = "inbox";
  const title = asString(config.title, "Notification");
  const body = asString(config.body);

  const notification = await prisma.notification.create({
    data: { userId, channel, title, body },
  });

  return {
    output: {
      id: notification.id,
      channel: notification.channel,
      title: notification.title,
      body: notification.body,
      read: notification.read,
      createdAt: notification.createdAt.toISOString(),
    },
  };
};
