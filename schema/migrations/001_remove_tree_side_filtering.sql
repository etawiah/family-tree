-- Migration: Remove tree_side filtering constraints
-- Date: 2026-01-28
-- Purpose: Enable unified family tree with cross-lineage linking
--
-- This migration:
-- 1. Identifies people with dual lineage (appear in both maternal/paternal relationships)
-- 2. Sets their tree_side to NULL to indicate "both sides"
-- 3. Removes tree_side as a filtering constraint in the application
-- 4. Preserves tree_side column for color-coding hints
--
-- After this migration:
-- - People can have relationships regardless of tree_side
-- - Queries return all relationships without tree_side filtering
-- - Frontend calculates ancestry for color-coding

-- Set tree_side to NULL for dual-lineage people
-- These people have relationships from both maternal and paternal sides
-- Example: You (child) has a maternal parent and a paternal parent
UPDATE people
SET tree_side = NULL
WHERE id IN (
  SELECT DISTINCT r1.person_id
  FROM relationships r1
  WHERE EXISTS (
    SELECT 1 FROM relationships r2
    WHERE r2.person_id = r1.person_id
      AND r2.tree_side != r1.tree_side
      AND r2.tree_side IS NOT NULL
      AND r1.tree_side IS NOT NULL
  )
);
