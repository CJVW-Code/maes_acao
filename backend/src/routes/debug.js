import express from "express";
import { pingSupabase } from "../controllers/debugController.js";

const router = express.Router();

router.get("/supabase", pingSupabase);

export default router;

