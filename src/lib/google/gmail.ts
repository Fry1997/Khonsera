// Gmail API REST helpers. Same pattern as calendar.ts — plain fetch + Bearer token.

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailMessageHeader = {
  name: string;
  value: string;
};

type GmailMessagePart = {
  mimeType: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailMessagePart[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  internalDate: string;
  snippet: string;
  payload: {
    headers: GmailMessageHeader[];
    mimeType: string;
    body?: { data?: string; size?: number };
    parts?: GmailMessagePart[];
  };
};

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export async function gmailSearchMessages(args: {
  accessToken: string;
  query: string;
  maxResults?: number;
}): Promise<Array<{ id: string; threadId: string }>> {
  const params = new URLSearchParams({
    q: args.query,
    maxResults: String(args.maxResults ?? 50),
  });
  const res = await fetch(`${BASE}/messages?${params}`, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail search failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as GmailListResponse;
  return data.messages ?? [];
}

export async function gmailGetMessage(args: {
  accessToken: string;
  messageId: string;
  format?: "full" | "metadata" | "minimal";
}): Promise<GmailMessage> {
  const params = new URLSearchParams({
    format: args.format ?? "full",
  });
  const res = await fetch(`${BASE}/messages/${args.messageId}?${params}`, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail get message failed: ${res.status} ${text}`);
  }
  return (await res.json()) as GmailMessage;
}

export function getHeader(
  headers: GmailMessageHeader[],
  name: string,
): string | null {
  const h = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return h?.value ?? null;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractPartsRecursive(
  part: GmailMessagePart,
  mimeType: string,
): string[] {
  const results: string[] = [];
  if (part.mimeType === mimeType && part.body?.data) {
    results.push(decodeBase64Url(part.body.data));
  }
  if (part.parts) {
    for (const child of part.parts) {
      results.push(...extractPartsRecursive(child, mimeType));
    }
  }
  return results;
}

export async function gmailGetAttachment(args: {
  accessToken: string;
  messageId: string;
  attachmentId: string;
}): Promise<Buffer> {
  const res = await fetch(
    `${BASE}/messages/${args.messageId}/attachments/${args.attachmentId}`,
    { headers: { Authorization: `Bearer ${args.accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Gmail get attachment failed: ${res.status}`);
  }
  const data = (await res.json()) as { data: string; size: number };
  const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
};

function findAttachmentsRecursive(part: GmailMessagePart): EmailAttachment[] {
  const results: EmailAttachment[] = [];
  if (part.body?.attachmentId && part.filename) {
    results.push({
      filename: part.filename,
      mimeType: part.mimeType,
      attachmentId: part.body.attachmentId,
      size: part.body.size ?? 0,
    });
  }
  if (part.parts) {
    for (const child of part.parts) {
      results.push(...findAttachmentsRecursive(child));
    }
  }
  return results;
}

export function extractAttachments(msg: GmailMessage): EmailAttachment[] {
  const results: EmailAttachment[] = [];
  if (msg.payload.parts) {
    for (const part of msg.payload.parts) {
      results.push(...findAttachmentsRecursive(part));
    }
  }
  return results;
}

export function extractMessageBody(msg: GmailMessage): {
  html: string | null;
  text: string | null;
} {
  const payload = msg.payload;
  let html: string | null = null;
  let text: string | null = null;

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") html = decoded;
    else text = decoded;
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const htmlParts = extractPartsRecursive(part, "text/html");
      if (htmlParts.length > 0 && !html) html = htmlParts[0];
      const textParts = extractPartsRecursive(part, "text/plain");
      if (textParts.length > 0 && !text) text = textParts[0];
    }
  }

  return { html, text };
}
