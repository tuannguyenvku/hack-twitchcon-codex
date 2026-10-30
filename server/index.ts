import { resolve } from "node:path";
import { createApp } from "./transport/app.js";
const env = process.env;
const app = createApp({
  staticDir: resolve("dist/client"),
  origin: env.APP_ORIGIN ?? "http://127.0.0.1:3000",
  hosted: env.NODE_ENV === "production",
  streamerControlToken: env.STREAMER_CONTROL_TOKEN,
  twitch:
    env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET
      ? {
          clientId: env.TWITCH_CLIENT_ID,
          clientSecret: env.TWITCH_CLIENT_SECRET,
          redirectUri:
            env.TWITCH_REDIRECT_URI ??
            "http://127.0.0.1:3000/auth/twitch/callback",
          channel: env.TWITCH_CHANNEL,
        }
      : undefined,
  director: { key: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL },
});
const addr = await app.listen(
  Number(env.PORT ?? 3000),
  env.HOST ?? "127.0.0.1",
);
console.log(`TwitchHive backend listening on ${addr.address}:${addr.port}`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
