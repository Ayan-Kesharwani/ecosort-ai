import { pgTable, text, serial, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trashAnalyses = pgTable("trash_analyses", {
  id: serial("id").primaryKey(),
  summary: text("summary").notNull(),
  recyclableZones: text("recyclable_zones").notNull().default(""),
  nonRecyclableZones: text("non_recyclable_zones").notNull().default(""),
  overallRecyclablePercent: real("overall_recyclable_percent").notNull().default(0),
  cleaningDriveGuide: text("cleaning_drive_guide"),
  smartBinGuide: text("smart_bin_guide"),
  imageBase64: text("image_base64"),
  items: jsonb("items").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTrashAnalysisSchema = createInsertSchema(trashAnalyses).omit({ id: true, createdAt: true });
export type InsertTrashAnalysis = z.infer<typeof insertTrashAnalysisSchema>;
export type TrashAnalysis = typeof trashAnalyses.$inferSelect;
