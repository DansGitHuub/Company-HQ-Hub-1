import { Router, Request, Response } from "express";
import { pool } from "./db";

export function registerWorkOrderRoutes(app: any) {

  // ── Helper: load full detail for a WO ─────────────────────────────────────
  async function loadDetail(id: string | number) {
    const wo = await pool.query(
      `SELECT wo.*,
              COALESCE(j.title, j.client) AS job_title,
              st.name AS service_type_name,
              u.name AS crew_leader_name,
              u.username AS crew_leader_username
       FROM work_orders wo
       LEFT JOIN jobs j ON j.id::text = wo.job_id::text
       LEFT JOIN service_types st ON st.id::text = wo.service_type_id::text
       LEFT JOIN users u ON u.id::text = wo.crew_leader_id::text
       WHERE wo.id = $1`,
      [id]
    );
    if (!wo.rows.length) return null;
    const row = wo.rows[0];

    // Areas
    const areas = await pool.query(
      `SELECT * FROM work_order_areas WHERE work_order_id=$1 ORDER BY sort_order, id`,
      [id]
    );

    // Tasks per area
    const tasks = await pool.query(
      `SELECT * FROM work_order_area_tasks WHERE work_order_id=$1 ORDER BY area_id, sort_order, id`,
      [id]
    );

    // Materials (all — area_id may be null for WO-level)
    const materials = await pool.query(
      `SELECT wm.*, ci.name AS catalog_name, ci.units AS catalog_units
       FROM work_order_materials wm
       LEFT JOIN catalog_items ci ON ci.id = wm.catalog_item_id
       WHERE wm.work_order_id=$1 ORDER BY wm.area_id NULLS FIRST, wm.created_at`,
      [id]
    );

    // Checklists
    const checklists = await pool.query(
      `SELECT * FROM work_order_checklists WHERE work_order_id=$1 ORDER BY area_id NULLS FIRST, sort_order`,
      [id]
    );

    // Hold points
    const holdPoints = await pool.query(
      `SELECT * FROM work_order_hold_points WHERE work_order_id=$1 ORDER BY area_id NULLS FIRST, sort_order`,
      [id]
    );

    // Legacy steps
    const steps = await pool.query(
      `SELECT * FROM work_order_steps WHERE work_order_id=$1 ORDER BY step_number`,
      [id]
    );

    // Daily logs
    const logs = await pool.query(
      `SELECT * FROM work_order_daily_logs WHERE work_order_id=$1 ORDER BY log_date DESC`,
      [id]
    );

    // Time entries via job_id
    let timeEntries: any[] = [];
    if (row.job_id) {
      const te = await pool.query(
        `SELECT te.id, te.clock_in, te.clock_out, te.duration_minutes, te.entry_type, te.notes,
                u.username, u.first_name, u.last_name
         FROM time_entries te
         JOIN users u ON u.id = te.user_id
         WHERE te.job_id = $1
         ORDER BY te.clock_in DESC
         LIMIT 100`,
        [row.job_id]
      );
      timeEntries = te.rows;
    }

    // CompanyCam photos via work order's own companycam_project_id
    let ccPhotos: any[] = [];
    if (row.companycam_project_id) {
      const cc = await pool.query(
        `SELECT id, companycam_photo_id, photo_url_web, photo_url_thumbnail,
                photo_url_web_annotation, captured_at, captured_by_name, description
         FROM companycam_photos
         WHERE companycam_project_id=$1
         ORDER BY captured_at DESC
         LIMIT 200`,
        [row.companycam_project_id]
      );
      ccPhotos = cc.rows;
    }

    // Attach children to areas
    const areaMap: Record<number, any> = {};
    for (const a of areas.rows) {
      areaMap[a.id] = {
        ...a,
        tasks:       tasks.rows.filter((t: any) => t.area_id === a.id),
        materials:   materials.rows.filter((m: any) => m.area_id === a.id),
        checklist:   checklists.rows.filter((c: any) => c.area_id === a.id),
        hold_points: holdPoints.rows.filter((h: any) => h.area_id === a.id),
      };
    }

    return {
      ...row,
      areas:       Object.values(areaMap),
      wo_materials: materials.rows.filter((m: any) => !m.area_id),
      wo_checklist: checklists.rows.filter((c: any) => !c.area_id),
      steps:       steps.rows,
      daily_logs:  logs.rows,
      time_entries: timeEntries,
      companycam_photos: ccPhotos,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  WORK ORDERS CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/work-orders", async (req: Request, res: Response) => {
    try {
      const { status, search, wo_type } = req.query as Record<string, string>;
      let query = `
        SELECT wo.*,
               COALESCE(j.title, j.client) AS job_title,
               st.name AS service_type_name,
               COALESCE(u.name, u.username) AS crew_leader_name,
               (SELECT COUNT(*) FROM work_order_area_tasks t WHERE t.work_order_id = wo.id) AS total_tasks,
               (SELECT COUNT(*) FROM work_order_area_tasks t WHERE t.work_order_id = wo.id AND t.is_complete = true) AS complete_tasks,
               (SELECT COUNT(*) FROM work_order_areas a WHERE a.work_order_id = wo.id) AS total_areas,
               (SELECT COUNT(*) FROM work_order_materials m WHERE m.work_order_id = wo.id) AS total_materials
        FROM work_orders wo
        LEFT JOIN jobs j ON j.id::text = wo.job_id::text
        LEFT JOIN service_types st ON st.id::text = wo.service_type_id::text
        LEFT JOIN users u ON u.id::text = wo.crew_leader_id::text
      `;
      const params: any[] = [];
      const conds: string[] = [];
      if (status && status !== "all") { params.push(status); conds.push(`wo.status=$${params.length}`); }
      if (wo_type && wo_type !== "all") { params.push(wo_type); conds.push(`wo.wo_type=$${params.length}`); }
      if (search) {
        params.push(`%${search}%`);
        conds.push(`(wo.title ILIKE $${params.length} OR j.title ILIKE $${params.length} OR wo.customer_name ILIKE $${params.length})`);
      }
      if (conds.length) query += " WHERE " + conds.join(" AND ");
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
      const detail = await loadDetail(req.params.id);
      if (!detail) return res.status(404).json({ message: "Not found" });
      res.json(detail);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch work order" });
    }
  });

  app.post("/api/work-orders", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const {
        title, description, job_id, wo_type, scheduled_date, office_notes,
        assigned_crew, service_type_id, crew_leader_id, estimated_duration,
        property_notes, site_access_notes, customer_name, customer_address,
        customer_phone, contract_value, estimated_completion_date, companycam_project_id
      } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });
      const result = await pool.query(
        `INSERT INTO work_orders
           (title, description, job_id, wo_type, scheduled_date, office_notes,
            assigned_crew, service_type_id, crew_leader_id, estimated_duration,
            property_notes, site_access_notes, customer_name, customer_address,
            customer_phone, contract_value, estimated_completion_date,
            companycam_project_id, created_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'draft')
         RETURNING *`,
        [title, description||null, job_id||null, wo_type||'maintenance', scheduled_date||null,
         office_notes||null, JSON.stringify(assigned_crew||[]),
         service_type_id||null, crew_leader_id||null, estimated_duration||null,
         property_notes||null, site_access_notes||null, customer_name||null,
         customer_address||null, customer_phone||null, contract_value||null,
         estimated_completion_date||null, companycam_project_id||null, user?.username||null]
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
      const {
        title, description, job_id, wo_type, scheduled_date, office_notes,
        assigned_crew, status, service_type_id, crew_leader_id, estimated_duration,
        property_notes, site_access_notes, customer_name, customer_address,
        customer_phone, contract_value, estimated_completion_date, companycam_project_id
      } = req.body;
      const result = await pool.query(
        `UPDATE work_orders SET
           title=$1, description=$2, job_id=$3, wo_type=$4, scheduled_date=$5,
           office_notes=$6, assigned_crew=$7, status=$8, service_type_id=$9,
           crew_leader_id=$10, estimated_duration=$11, property_notes=$12,
           site_access_notes=$13, customer_name=$14, customer_address=$15,
           customer_phone=$16, contract_value=$17, estimated_completion_date=$18,
           companycam_project_id=$19, updated_at=NOW()
         WHERE id=$20 RETURNING *`,
        [title, description||null, job_id||null, wo_type||'maintenance', scheduled_date||null,
         office_notes||null, JSON.stringify(assigned_crew||[]), status,
         service_type_id||null, crew_leader_id||null, estimated_duration||null,
         property_notes||null, site_access_notes||null, customer_name||null,
         customer_address||null, customer_phone||null, contract_value||null,
         estimated_completion_date||null, companycam_project_id||null, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      const detail = await loadDetail(id);
      res.json(detail);
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
      await pool.query(`UPDATE work_orders SET status=$1, updated_at=NOW() WHERE id=$2`, [status, id]);
      res.json({ ok: true });
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
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  WORK ORDER AREAS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/work-orders/:id/areas", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, estimated_hours } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const maxSort = await pool.query(
        `SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM work_order_areas WHERE work_order_id=$1`, [id]
      );
      const result = await pool.query(
        `INSERT INTO work_order_areas (work_order_id, name, description, estimated_hours, sort_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [id, name, description||null, estimated_hours||null, maxSort.rows[0].next]
      );
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to add area" });
    }
  });

  app.put("/api/work-orders/:id/areas/:areaId", async (req: Request, res: Response) => {
    try {
      const { areaId } = req.params;
      const { name, description, estimated_hours } = req.body;
      const result = await pool.query(
        `UPDATE work_order_areas SET name=$1, description=$2, estimated_hours=$3
         WHERE id=$4 RETURNING *`,
        [name, description||null, estimated_hours||null, areaId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update area" });
    }
  });

  app.delete("/api/work-orders/:id/areas/:areaId", async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM work_order_areas WHERE id=$1`, [req.params.areaId]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete area" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  AREA TASKS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/work-orders/:id/areas/:areaId/tasks", async (req: Request, res: Response) => {
    try {
      const { id, areaId } = req.params;
      const { title, description, requires_photo } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });
      const maxSort = await pool.query(
        `SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM work_order_area_tasks WHERE area_id=$1`, [areaId]
      );
      const result = await pool.query(
        `INSERT INTO work_order_area_tasks (work_order_id, area_id, title, description, requires_photo, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, areaId, title, description||null, !!requires_photo, maxSort.rows[0].next]
      );
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to add task" });
    }
  });

  app.put("/api/work-orders/:id/areas/:areaId/tasks/:taskId", async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { title, description, requires_photo } = req.body;
      const result = await pool.query(
        `UPDATE work_order_area_tasks SET title=$1, description=$2, requires_photo=$3
         WHERE id=$4 RETURNING *`,
        [title, description||null, !!requires_photo, taskId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.patch("/api/work-orders/:id/areas/:areaId/tasks/:taskId/complete", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id, taskId } = req.params;
      const { is_complete } = req.body;
      const result = await pool.query(
        `UPDATE work_order_area_tasks
         SET is_complete=$1, completed_by=$2,
             completed_at=CASE WHEN $1=true THEN NOW() ELSE NULL END
         WHERE id=$3 RETURNING *`,
        [!!is_complete, is_complete ? (user?.username||"crew") : null, taskId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to toggle task" });
    }
  });

  app.delete("/api/work-orders/:id/areas/:areaId/tasks/:taskId", async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM work_order_area_tasks WHERE id=$1`, [req.params.taskId]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Task photo upload
  app.post("/api/work-orders/:id/areas/:areaId/tasks/:taskId/photos", async (req: Request, res: Response) => {
    try {
      const multer = (await import("multer")).default;
      const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
      upload.single("file")(req as any, res as any, async (err: any) => {
        if (err) return res.status(400).json({ message: err.message });
        const file = (req as any).file;
        if (!file) return res.status(400).json({ message: "No file" });
        const { id, areaId, taskId } = req.params;
        const axios = (await import("axios")).default;
        const sidecarBase = "http://127.0.0.1:1106";
        const privateDir = process.env.PRIVATE_OBJECT_DIR || ".private";
        const ts = Date.now();
        const ext = file.originalname.split(".").pop() || "jpg";
        const objectKey = `${privateDir}/work-orders/${id}/areas/${areaId}/tasks/${taskId}/${ts}.${ext}`;
        await axios.put(`${sidecarBase}/upload/${encodeURIComponent(objectKey)}`, file.buffer, {
          headers: { "Content-Type": file.mimetype },
        });
        const photoUrl = `/api/object-storage/${encodeURIComponent(objectKey)}`;
        const task = await pool.query(`SELECT photos FROM work_order_area_tasks WHERE id=$1`, [taskId]);
        if (!task.rows.length) return res.status(404).json({ message: "Task not found" });
        const updated = [...(task.rows[0].photos||[]), { url: photoUrl, uploaded_at: new Date().toISOString() }];
        await pool.query(`UPDATE work_order_area_tasks SET photos=$1 WHERE id=$2`, [JSON.stringify(updated), taskId]);
        await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
        res.json({ url: photoUrl, photos: updated });
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  app.delete("/api/work-orders/:id/areas/:areaId/tasks/:taskId/photos", async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { url } = req.body;
      const task = await pool.query(`SELECT photos FROM work_order_area_tasks WHERE id=$1`, [taskId]);
      if (!task.rows.length) return res.status(404).json({ message: "Not found" });
      const updated = (task.rows[0].photos||[]).filter((p: any) => p.url !== url);
      await pool.query(`UPDATE work_order_area_tasks SET photos=$1 WHERE id=$2`, [JSON.stringify(updated), taskId]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  MATERIALS (WO-level or area-level)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/work-orders/:id/materials", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { item_name, quantity, unit, catalog_item_id, notes, area_id } = req.body;
      if (!item_name) return res.status(400).json({ message: "Item name is required" });
      const result = await pool.query(
        `INSERT INTO work_order_materials
           (work_order_id, item_name, quantity, unit, catalog_item_id, notes, area_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, item_name, quantity||null, unit||null, catalog_item_id||null, notes||null, area_id||null]
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
        [item_name, quantity||null, unit||null, notes||null, status||"needed", materialId]
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
      const valid = ["needed","loaded","used"];
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
      res.status(500).json({ message: "Failed to update status" });
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  CHECKLISTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/work-orders/:id/checklists", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { label, area_id } = req.body;
      if (!label) return res.status(400).json({ message: "Label is required" });
      const maxSort = await pool.query(
        `SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM work_order_checklists WHERE work_order_id=$1`, [id]
      );
      const result = await pool.query(
        `INSERT INTO work_order_checklists (work_order_id, area_id, label, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [id, area_id||null, label, maxSort.rows[0].next]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to add checklist item" });
    }
  });

  app.patch("/api/work-orders/:id/checklists/:checkId/complete", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id, checkId } = req.params;
      const { is_complete } = req.body;
      const result = await pool.query(
        `UPDATE work_order_checklists
         SET is_complete=$1, completed_by=$2,
             completed_at=CASE WHEN $1=true THEN NOW() ELSE NULL END
         WHERE id=$3 RETURNING *`,
        [!!is_complete, is_complete ? (user?.username||"crew") : null, checkId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to toggle checklist item" });
    }
  });

  app.delete("/api/work-orders/:id/checklists/:checkId", async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM work_order_checklists WHERE id=$1`, [req.params.checkId]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete checklist item" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  HOLD POINTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/work-orders/:id/hold-points", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { label, description, area_id } = req.body;
      if (!label) return res.status(400).json({ message: "Label is required" });
      const maxSort = await pool.query(
        `SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM work_order_hold_points WHERE work_order_id=$1`, [id]
      );
      const result = await pool.query(
        `INSERT INTO work_order_hold_points (work_order_id, area_id, label, description, sort_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [id, area_id||null, label, description||null, maxSort.rows[0].next]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to add hold point" });
    }
  });

  app.patch("/api/work-orders/:id/hold-points/:hpId/approve", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id, hpId } = req.params;
      const { is_approved } = req.body;
      const result = await pool.query(
        `UPDATE work_order_hold_points
         SET is_approved=$1, approved_by=$2,
             approved_at=CASE WHEN $1=true THEN NOW() ELSE NULL END
         WHERE id=$3 RETURNING *`,
        [!!is_approved, is_approved ? (user?.username||"manager") : null, hpId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update hold point" });
    }
  });

  app.delete("/api/work-orders/:id/hold-points/:hpId", async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM work_order_hold_points WHERE id=$1`, [req.params.hpId]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete hold point" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  LEGACY STEPS (kept for backward compat)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/work-orders/:id/steps", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title, description, requires_photo, step_number } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });
      let num = step_number;
      if (!num) {
        const max = await pool.query(
          `SELECT COALESCE(MAX(step_number),0)+1 AS next FROM work_order_steps WHERE work_order_id=$1`, [id]
        );
        num = max.rows[0].next;
      }
      const result = await pool.query(
        `INSERT INTO work_order_steps (work_order_id, title, description, requires_photo, step_number)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [id, title, description||null, !!requires_photo, num]
      );
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to add step" });
    }
  });

  app.patch("/api/work-orders/:id/steps/:stepId/complete", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { stepId, id } = req.params;
      const { is_complete, completion_note } = req.body;
      await pool.query(
        `UPDATE work_order_steps
         SET is_complete=$1, completed_by=$2,
             completed_at=CASE WHEN $1=true THEN NOW() ELSE NULL END,
             completion_note=$3
         WHERE id=$4`,
        [!!is_complete, is_complete ? (user?.username||"crew") : null, completion_note||null, stepId]
      );
      await pool.query(`UPDATE work_orders SET updated_at=NOW() WHERE id=$1`, [id]);
      res.json({ ok: true });
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  DAILY LOGS
  // ═══════════════════════════════════════════════════════════════════════════

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
        `SELECT id FROM work_order_daily_logs WHERE work_order_id=$1 AND log_date=$2`, [id, date]
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
           truck_notes, office_update, user?.username||null, existing.rows[0].id]
        );
      } else {
        result = await pool.query(
          `INSERT INTO work_order_daily_logs
             (work_order_id, log_date, work_completed, crew_notes, materials_needed_tomorrow,
              truck_emptied, truck_loaded, truck_fueled, truck_clean, truck_notes, office_update, submitted_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [id, date, work_completed, crew_notes, materials_needed_tomorrow,
           !!truck_emptied, !!truck_loaded, !!truck_fueled, !!truck_clean,
           truck_notes, office_update, user?.username||null]
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
