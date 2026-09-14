import { createRequire } from "node:module";
import type { NextFunction, Request, Response } from "express";

// Express 4 only catches errors thrown synchronously. Every route here is an
// async function, so a rejected promise — a Mongoose cast error from a
// malformed body, a database hiccup — never reached the error handler: the
// request hung and Node then exited the whole process on the unhandled
// rejection. One bad request took the API down for everyone.
//
// This wraps the single point every route and middleware handler runs
// through, so a returned promise that rejects is passed to `next(err)` like a
// thrown error. Express 5 does this natively; drop this file on upgrade.
//
// Imported for its side effect by app.ts, before any router is built.

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
type LayerProto = {
  handle: Handler;
  handle_request: (req: Request, res: Response, next: NextFunction) => void;
  __asyncErrorsPatched?: boolean;
};

const require = createRequire(import.meta.url);
const Layer = require("express/lib/router/layer.js") as {
  prototype: LayerProto;
};

if (!Layer.prototype.__asyncErrorsPatched) {
  Layer.prototype.__asyncErrorsPatched = true;
  Layer.prototype.handle_request = function handle(
    this: LayerProto,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const fn = this.handle;
    // Error-handling middleware (4 args) is run by handle_error instead.
    if (fn.length > 3) {
      next();
      return;
    }
    try {
      const result = fn(req, res, next);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).then(undefined, next);
      }
    } catch (err) {
      next(err);
    }
  };
}
