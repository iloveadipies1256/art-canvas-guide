import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().min(1).max(40).optional(),
});

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("TTS unavailable", { status: 503 });

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid request", { status: 400 });
        }

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: body.text,
            voice: body.voice ?? "alloy",
            response_format: "mp3",
            speed: 1,
            instructions:
              "You are a warm, encouraging art teacher guiding someone at their drawing desk. " +
              "Speak naturally and conversationally, unhurried, with gentle expressive phrasing " +
              "and natural pauses between ideas. Never sound robotic or monotone.",
          }),
        });

        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          return new Response(detail || "TTS failed", { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});