import express, { Router } from "express";

// Express counterpart of kareez's hapi `/images/{param*}` directory handler:
// serves the files the local provider writes under IMAGE_SERVER_PATH.
//
// Only mounted when the local provider is in use (see app.ts). With S3 there is
// nothing on disk to serve — clients get signed bucket URLs instead.
//
// Public, as in kareez: no auth on these URLs. Every stored filename carries a
// random suffix, so a file can only be fetched by someone who was handed its
// URL, but that URL works for anyone who has it.
export function fileStorageRoute(): Router {
  const router = Router();
  router.use(
    express.static(process.env.IMAGE_SERVER_PATH!, {
      index: false,
      redirect: false,
      dotfiles: "deny",
      // A stored file is never rewritten — a replaced photo gets a new name.
      immutable: true,
      maxAge: "365d",
    })
  );
  // Anything static didn't serve — a missing file, a dotfile, a path trying to
  // climb out of the folder — is a plain 404. Handled here rather than passed
  // on as an error: the app's error handler logs every error in full, and an
  // app still holding the URL of a replaced photo would fill the log with one
  // stack trace per request.
  router.use((_req, res) => {
    res.status(404).end();
  });
  return router;
}
