import bot from "@/lib/services/bot";

export async function POST(req: Request) {
  if (!bot) return new Response("Bot not configured", { status: 500 });

  const update = await req.json();
  await bot.handleUpdate(update);
  return new Response("OK");
}
