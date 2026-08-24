-- Migration: Add ui_mode and is_beta_tester to profiles table
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Add ui_mode column to store the user's preferred UI ('legacy' | 'modern' | 'glass')
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'ui_mode'
  ) THEN 
    ALTER TABLE profiles ADD COLUMN ui_mode TEXT DEFAULT 'legacy';
  END IF;
END $$;

-- 2. Add is_beta_tester column if not already present
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_beta_tester'
  ) THEN 
    ALTER TABLE profiles ADD COLUMN is_beta_tester BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3. Update existing profiles with new_ui_enabled = true to 'modern' if ui_mode is null/legacy
UPDATE profiles 
SET ui_mode = 'modern' 
WHERE (ui_mode IS NULL OR ui_mode = 'legacy') AND new_ui_enabled = TRUE;

-- 4. Create index for fast profile queries
CREATE INDEX IF NOT EXISTS idx_profiles_ui_mode ON profiles (ui_mode);
CREATE INDEX IF NOT EXISTS idx_profiles_is_beta_tester ON profiles (is_beta_tester);

-- 5. Add helpful table column comment
COMMENT ON COLUMN profiles.ui_mode IS 'Preferred UI Theme: legacy (Default), modern (Warm/Clean), glass (Liquid Refraction Glass - Beta only)';
COMMENT ON COLUMN profiles.is_beta_tester IS 'True if the user has enrolled in SenExam Beta Testing program';
