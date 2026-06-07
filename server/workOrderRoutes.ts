import { Router, Request, Response } from "express";
import { pool } from "./db";

export function registerWorkOrderRoutes(app: any) {

  // ─── Work Orders (CRUD) ───────────────────────────────────────────────────

  app.get("/api/work-orders", async (req: Request, res: Response) => {
    try {
      const { status, search } = req.query as Record<string, string>;
      let query = `
        SELECT wo.*,
               j.title AS job_title,
               (SELECT COUNT(*) FROM work_order_steps s WHERE s.work_order_id = wo.id) AS total_steps,
               (SELECT COUNT(*) FROM work_order_steps s WHERE s.work_order_id = wo.id AND s.is_complete = true) AS complete_steps,
               (SELECT COUNT(*) FROM work_order_materials m WHERE m.work_order_id = wo.id) AS total_materials
        FROM work_orders wo
        LEFT JOIN jobs j ON j.id = wo.job_id
      `;
      const params: any[] = [];
      const conditions: string[] = [];

      if (status && status !== "all") {
        params.push(status);
        conditions.push(`wo.status = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(wo.title ILIKE $${params.length} OR j.title ILIKE $${params.length})`);
      }
      if (conditions.length) query += " WHERE " + conditions.join(" AND ");
      query += " ORDER BY wo.updated_at DESC";

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  app.get("/api/work-orders/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const wo = await pool.query(
        `SELECT wo.*, j.title AS job_title
         FROM work_orders wo
         LEFT JOIN jobs j ON j.id = wo.job_id
         WHERE wo.id = $1`,
        [id]
      );
      if (!wo.rows.length) return res.status(404).json({ message: "Not found" });

      const steps = await pool.query(
        `SELECT * FROM work_order_steps WHERE work_order_id = $1 ORDER BY step_number ASC`,
        [id]
      );
      const materials = await pool.query(
        `SELECT * FROM work_order_materials WHERE work_order_id = $1 ORDER BY created_at ASC`,
        [id]
      );
      const logs = await pool.query(
        `SELECT * FROM work_order_daily_logs WHERE work_order_id = $1 ORDER BY log_date DESC`,
        [id]
      );

      res.json({
        ...wo.rows[0],
        steps: steps.rows,
        materials: materials.rows,
        daily_logs: logs.rows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch work order" });
    }
  });

  app.post("/api/work-orders", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { title, description, job_id, scheduled_date, office_notes, assigned_crew } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });

      const result = await pool.query(
        `INSERT INTO work_orders (title, description, job_id, scheduled_date, office_notes, assigned_crew, created_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING *`,
        [title, description || null, job_id || null, scheduled_date || null, office_notes || null,
          JSON.stringify(assigned_crew || []), user?.username || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to create work order" });
    }
  });

  app.put("/api/work-orders/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title, description, job_id, scheduled_date, office_notes, assigned_crew, status } = req.body;
      const result = await pool.query(
        `UPDATE work_orders
         SET title=$1, description=$2, job_id=$3, scheduled_date=$4, office_notes=$5,
             assigned_crew=$6, status=$7, updated_at=NOW()
         WHERE id=$8 RETURNING *`,
        [title, description || null, job_id || null, scheduled_date || null, office_notes || null,
          JSON.stringify(assigned_crew || []), status, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update work order" });
    }
  });

  app.patch("/api/work-orders/:id/status", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const valid = ["draft", "ready", "in_progress", "on_hold", "complete"];
      if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });
      const result = await pool.query(
        `UPDATE work_orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
        [status, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  app.delete("/api/work-orders/:id", async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM work_orders WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete work order" });
    }
  });

  // ─── Steps ────────────────────────────────────────────────────────────────

  app.post("/api/work-orders/:id/steps", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title, description, requires_photo, step_number } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });

      // auto step_number if not provided
      let num = step_number;
      if (!num) {
        const max = await pool.query(
          `SELECT COALESCE(MAX(step_number),0)+1 AS next FROM work_order_steps WHERE work_order_id=$1`,
          [id]
        );
        num = max.rows[0].next;
      }

      const result = await pool.query(
        `INSERT INTO work_order_steps (work_order_id, title, description, requires_photo, step_number)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [id, title, description || null, !!requires_photo, num]
      );
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to add step" });
    }
  });

  app.put("/api/work-orders/:id/steps/:stepId", async (req: Request, res: Response) => {
    try {
      const { stepId } = req.params;
      const { title, description, requires_photo, step_number } = req.body;
      const result = await pool.query(
        `UPDATE work_order_steps SET title=$1, description=$2, requires_photo=$3, step_number=$4
         WHERE id=$5 RETURNING *`,
        [title, description || null, !!requires_photo, step_number, stepId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update step" });
    }
  });

  app.patch("/api/work-orders/:id/steps/:stepId/complete", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { stepId, id } = req.params;
      const { is_complete, completion_note } = req.body;

      const result = await pool.query(
        `UPDATE work_order_steps
         SET is_complete=$1,
             completed_by=$2,
             completed_at=CASE WHEN $1=true THEN NOW() ELSE NULL END,
             completion_note=$3
         WHERE id=$4 RETURNING *`,
        [!!is_complete, is_complete ? (user?.username || "crew") : null, completion_note || null, stepId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to toggle step" });
    }
  });

  app.delete("/api/work-orders/:id/steps/:stepId", async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM work_order_steps WHERE id=$1`, [req.params.stepId]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete step" });
    }
  });

  // Step photo upload
  app.post("/api/work-orders/:id/steps/:stepId/photos", async (req: Request, res: Response) => {
    try {
      const multer = (await import("multer")).default;
      const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

      upload.single("file")(req as any, res as any, async (err: any) => {
        if (err) return res.status(400).json({ message: err.message });
        const file = (req as any).file;
        if (!file) return res.status(400).json({ message: "No file uploaded" });

        const { stepId, id } = req.params;

        // Upload to object storage
        const axios = (await import("axios")).default;
        const sidecarBase = "http://127.0.0.1:1106";
        const privateDir = process.env.PRIVATE_OBJECT_DIR || ".private";
        const timestamp = Date.now();
        const ext = file.originalname.split(".").pop() || "jpg";
        const objectKey = `${privateDir}/work-orders/steps/${id}/${stepId}/${timestamp}.${ext}`;

        await axios.put(`${sidecarBase}/upload/${encodeURIComponent(objectKey)}`, file.buffer, {
          headers: { "Content-Type": file.mimetype },
        });

        const photoUrl = `/api/object-storage/${encodeURIComponent(objectKey)}`;

        // Append to step photos array
        const step = await pool.query(`SELECT photos FROM work_order_steps WHERE id=$1`, [stepId]);
        if (!step.rows.length) return res.status(404).json({ message: "Step not found" });

        const existing = step.rows[0].photos || [];
        const updated = [...existing, { url: photoUrl, uploaded_at: new Date().toISOString() }];

        await pool.query(`UPDATE work_order_steps SET photos=$1 WHERE id=$2`, [JSON.stringify(updated), stepId]);
        await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);

        res.json({ url: photoUrl, photos: updated });
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  // Delete step photo
  app.delete("/api/work-orders/:id/steps/:stepId/photos", async (req: Request, res: Response) => {
    try {
      const { stepId } = req.params;
      const { url } = req.body;
      const step = await pool.query(`SELECT photos FROM work_order_steps WHERE id=$1`, [stepId]);
      if (!step.rows.length) return res.status(404).json({ message: "Not found" });
      const updated = (step.rows[0].photos || []).filter((p: any) => p.url !== url);
      await pool.query(`UPDATE work_order_steps SET photos=$1 WHERE id=$2`, [JSON.stringify(updated), stepId]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });

  // ─── Materials ────────────────────────────────────────────────────────────

  app.post("/api/work-orders/:id/materials", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { item_name, quantity, unit, catalog_item_id, notes } = req.body;
      if (!item_name) return res.status(400).json({ message: "Item name is required" });
      const result = await pool.query(
        `INSERT INTO work_order_materials (work_order_id, item_name, quantity, unit, catalog_item_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, item_name, quantity || null, unit || null, catalog_item_id || null, notes || null]
      );
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to add material" });
    }
  });

  app.put("/api/work-orders/:id/materials/:materialId", async (req: Request, res: Response) => {
    try {
      const { materialId } = req.params;
      const { item_name, quantity, unit, notes, status } = req.body;
      const result = await pool.query(
        `UPDATE work_order_materials SET item_name=$1, quantity=$2, unit=$3, notes=$4, status=$5
         WHERE id=$6 RETURNING *`,
        [item_name, quantity || null, unit || null, notes || null, status || "needed", materialId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update material" });
    }
  });

  app.patch("/api/work-orders/:id/materials/:materialId/status", async (req: Request, res: Response) => {
    try {
      const { materialId, id } = req.params;
      const { status } = req.body;
      const valid = ["needed", "loaded", "used"];
      if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });
      const result = await pool.query(
        `UPDATE work_order_materials SET status=$1 WHERE id=$2 RETURNING *`,
        [status, materialId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update material status" });
    }
  });

  app.delete("/api/work-orders/:id/materials/:materialId", async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM work_order_materials WHERE id=$1`, [req.params.materialId]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete material" });
    }
  });

  // ─── Daily Logs ───────────────────────────────────────────────────────────

  app.get("/api/work-orders/:id/daily-logs", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT * FROM work_order_daily_logs WHERE work_order_id=$1 ORDER BY log_date DESC`,
        [req.params.id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // Upsert today's log (one per WO per date)
  app.post("/api/work-orders/:id/daily-logs", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const {
        log_date, work_completed, crew_notes, materials_needed_tomorrow,
        truck_emptied, truck_loaded, truck_fueled, truck_clean, truck_notes, office_update
      } = req.body;

      const date = log_date || new Date().toISOString().slice(0, 10);

      const existing = await pool.query(
        `SELECT id FROM work_order_daily_logs WHERE work_order_id=$1 AND log_date=$2`,
        [id, date]
      );

      let result;
      if (existing.rows.length) {
        result = await pool.query(
          `UPDATE work_order_daily_logs
           SET work_completed=$1, crew_notes=$2, materials_needed_tomorrow=$3,
               truck_emptied=$4, truck_loaded=$5, truck_fueled=$6, truck_clean=$7,
               truck_notes=$8, office_update=$9, submitted_by=$10, submitted_at=NOW()
           WHERE id=$11 RETURNING *`,
          [work_completed, crew_notes, materials_needed_tomorrow,
            !!truck_emptied, !!truck_loaded, !!truck_fueled, !!truck_clean,
            truck_notes, office_update, user?.username || null, existing.rows[0].id]
        );
      } else {
        result = await pool.query(
          `INSERT INTO work_order_daily_logs
           (work_order_id, log_date, work_completed, crew_notes, materials_needed_tomorrow,
            truck_emptied, truck_loaded, truck_fueled, truck_clean, truck_notes, office_update, submitted_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [id, date, work_completed, crew_notes, materials_needed_tomorrow,
            !!truck_emptied, !!truck_loaded, !!truck_fueled, !!truck_clean,
            truck_notes, office_update, user?.username || null]
        );
      }

      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to save daily log" });
    }
  });
}
