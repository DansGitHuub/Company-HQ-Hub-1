// ============================================================
// FILE: server/replit_integrations/object_storage/routes.ts
// SECTION: GET /objects/:objectPath (lines ~74-86)
// PURPOSE: Serves the generated image when the browser requests
//          a URL like /objects/sop-media/xxx.png
// ============================================================

app.get(/^\/objects\/(.+)$/, async (req, res) => {
  try {
    const objectPath = `/objects/${req.params[0]}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    await objectStorageService.downloadObject(objectFile, res);
  } catch (error) {
    console.error("Error serving object:", error);
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "Object not found" });
    }
    return res.status(500).json({ error: "Failed to serve object" });
  }
});
