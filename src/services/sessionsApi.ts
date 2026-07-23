import axios from "axios";
import type { Session } from "../types/session";

const client = axios.create({
  baseURL: "/sessions",
});

export async function fetchSessions(): Promise<Session[]> {
  const { data } = await client.get<Session[]>("/");
  return data;
}

export async function deleteSession(id: string): Promise<void> {
  await client.delete(`/${encodeURIComponent(id)}`);
}

export async function continueSession(id: string): Promise<void> {
  await client.post(`/${encodeURIComponent(id)}/continue`);
}
