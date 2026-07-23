import axios from "axios";

const client = axios.create({
  baseURL: "/system",
});

export async function stopApplication(): Promise<void> {
  await client.post("/shutdown");
}
