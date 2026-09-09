import type { Request, Response } from "express";

export async function meHandler(req: Request, res: Response): Promise<void> {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }

  const user = req.user;
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      slackConnected: Boolean(user.slackAccessToken),
    },
  });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: "failed to log out" });
      return;
    }
    req.session.destroy(() => {
      res.clearCookie("reachinbox.sid");
      res.json({ ok: true });
    });
  });
}
