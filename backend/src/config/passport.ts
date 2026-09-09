import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import { prisma } from "../lib/prisma";

// Only the DB id goes into the session cookie — the full user is re-fetched
// from Postgres on every request via deserializeUser. This keeps the cookie
// small and means a user's data (e.g. a newly connected Slack token) is
// always fresh rather than cached in the session.
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user ?? false);
  } catch (err) {
    done(err);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("Google profile did not include an email address"));
        }

        const name = profile.displayName ?? email.split("@")[0];
        const avatar = profile.photos?.[0]?.value;

        // Match by googleId first (repeat logins). Fall back to matching an
        // existing row by email (e.g. one created earlier by the old dev-auth
        // stub) so accounts don't silently duplicate on a unique constraint.
        const existing =
          (await prisma.user.findUnique({ where: { googleId: profile.id } })) ??
          (await prisma.user.findUnique({ where: { email } }));

        const user = existing
          ? await prisma.user.update({
              where: { id: existing.id },
              data: { googleId: profile.id, name, email, avatar },
            })
          : await prisma.user.create({
              data: { googleId: profile.id, name, email, avatar },
            });

        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    }
  )
);

export { passport };
