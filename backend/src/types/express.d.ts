import type { User as PrismaUser } from "@prisma/client";

// Passport's Express.User interface is what req.user / req.login /
// req.isAuthenticated() are typed against. Extending it with our Prisma
// User model means req.user is fully typed everywhere without an `as` cast.
declare global {
  namespace Express {
    interface User extends PrismaUser {}
  }
}

export {};
