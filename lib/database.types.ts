// AUTO-GENERATED DATABASE TYPES FROM SUPABASE LIVE SCHEMA
// Version: 2.0.2194023.10599.01
// Generated at: 2026-11-17T17:23:21.293Z

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      "admin_grants_log": {
        Row: {
          "id": string
          "admin_id": string
          "target_user_id": string
          "kind": string
          "amount": number
          "note": string | null
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "admin_id"?: string | null
          "target_user_id"?: string | null
          "kind"?: string | null
          "amount"?: number | null
          "note"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "admin_id"?: string | null
          "target_user_id"?: string | null
          "kind"?: string | null
          "amount"?: number | null
          "note"?: string | null
          "created_at"?: string | null
        }
      }
      "ai_trial_exams": {
        Row: {
          "id": string
          "user_id": string
          "title": string
          "source_file_names": string[]
          "exam_structure": any
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "source_file_names"?: string[] | null
          "exam_structure"?: any | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "source_file_names"?: string[] | null
          "exam_structure"?: any | null
          "created_at"?: string | null
        }
      }
      "announcements": {
        Row: {
          "id": string
          "content": string
          "is_active": boolean | null
          "start_time": string | null
          "end_time": string | null
          "created_at": string | null
          "title": string | null
          "created_by": string | null
        }
        Insert: {
          "id"?: string | null
          "content"?: string | null
          "is_active"?: boolean | null
          "start_time"?: string | null
          "end_time"?: string | null
          "created_at"?: string | null
          "title"?: string | null
          "created_by"?: string | null
        }
        Update: {
          "id"?: string | null
          "content"?: string | null
          "is_active"?: boolean | null
          "start_time"?: string | null
          "end_time"?: string | null
          "created_at"?: string | null
          "title"?: string | null
          "created_by"?: string | null
        }
      }
      "class_announcements": {
        Row: {
          "id": string
          "class_id": string
          "teacher_id": string
          "title": string
          "content": string
          "priority": string | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "class_id"?: string | null
          "teacher_id"?: string | null
          "title"?: string | null
          "content"?: string | null
          "priority"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "class_id"?: string | null
          "teacher_id"?: string | null
          "title"?: string | null
          "content"?: string | null
          "priority"?: string | null
          "created_at"?: string | null
        }
      }
      "class_exams": {
        Row: {
          "id": string
          "class_id": string
          "exam_id": string
          "title": string | null
          "due_date": string | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "class_id"?: string | null
          "exam_id"?: string | null
          "title"?: string | null
          "due_date"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "class_id"?: string | null
          "exam_id"?: string | null
          "title"?: string | null
          "due_date"?: string | null
          "created_at"?: string | null
        }
      }
      "class_fund_payments": {
        Row: {
          "id": string
          "fund_id": string
          "student_id": string
          "student_name": string
          "mssv": string | null
          "order_code": string
          "amount_vnd": number
          "status": string
          "sepay_id": string | null
          "paid_at": string | null
          "raw_webhook": any | null
          "expires_at": string
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "fund_id"?: string | null
          "student_id"?: string | null
          "student_name"?: string | null
          "mssv"?: string | null
          "order_code"?: string | null
          "amount_vnd"?: number | null
          "status"?: string | null
          "sepay_id"?: string | null
          "paid_at"?: string | null
          "raw_webhook"?: any | null
          "expires_at"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "fund_id"?: string | null
          "student_id"?: string | null
          "student_name"?: string | null
          "mssv"?: string | null
          "order_code"?: string | null
          "amount_vnd"?: number | null
          "status"?: string | null
          "sepay_id"?: string | null
          "paid_at"?: string | null
          "raw_webhook"?: any | null
          "expires_at"?: string | null
          "created_at"?: string | null
        }
      }
      "class_funds": {
        Row: {
          "id": string
          "title": string
          "class_name": string
          "amount_per_person": number
          "due_date": string
          "bank_name": string
          "bank_account": string
          "account_name": string
          "description": string | null
          "admin_passcode": string | null
          "students": any
          "created_at": string
          "updated_at": string
        }
        Insert: {
          "id"?: string | null
          "title"?: string | null
          "class_name"?: string | null
          "amount_per_person"?: number | null
          "due_date"?: string | null
          "bank_name"?: string | null
          "bank_account"?: string | null
          "account_name"?: string | null
          "description"?: string | null
          "admin_passcode"?: string | null
          "students"?: any | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "title"?: string | null
          "class_name"?: string | null
          "amount_per_person"?: number | null
          "due_date"?: string | null
          "bank_name"?: string | null
          "bank_account"?: string | null
          "account_name"?: string | null
          "description"?: string | null
          "admin_passcode"?: string | null
          "students"?: any | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "class_invite_codes": {
        Row: {
          "id": string
          "class_id": string
          "teacher_id": string
          "code": string
          "is_used": boolean | null
          "used_by": string | null
          "used_at": string | null
          "created_at": string | null
          "max_uses": number | null
          "used_count": number | null
        }
        Insert: {
          "id"?: string | null
          "class_id"?: string | null
          "teacher_id"?: string | null
          "code"?: string | null
          "is_used"?: boolean | null
          "used_by"?: string | null
          "used_at"?: string | null
          "created_at"?: string | null
          "max_uses"?: number | null
          "used_count"?: number | null
        }
        Update: {
          "id"?: string | null
          "class_id"?: string | null
          "teacher_id"?: string | null
          "code"?: string | null
          "is_used"?: boolean | null
          "used_by"?: string | null
          "used_at"?: string | null
          "created_at"?: string | null
          "max_uses"?: number | null
          "used_count"?: number | null
        }
      }
      "class_materials": {
        Row: {
          "id": string
          "class_id": string
          "teacher_id": string
          "title": string
          "description": string | null
          "file_url": string
          "material_type": string | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "class_id"?: string | null
          "teacher_id"?: string | null
          "title"?: string | null
          "description"?: string | null
          "file_url"?: string | null
          "material_type"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "class_id"?: string | null
          "teacher_id"?: string | null
          "title"?: string | null
          "description"?: string | null
          "file_url"?: string | null
          "material_type"?: string | null
          "created_at"?: string | null
        }
      }
      "class_members": {
        Row: {
          "id": string
          "class_id": string
          "student_id": string
          "joined_at": string | null
        }
        Insert: {
          "id"?: string | null
          "class_id"?: string | null
          "student_id"?: string | null
          "joined_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "class_id"?: string | null
          "student_id"?: string | null
          "joined_at"?: string | null
        }
      }
      "class_proctor_logs": {
        Row: {
          "id": string
          "class_id": string | null
          "exam_id": string
          "student_id": string
          "student_name": string | null
          "violation_type": string | null
          "violation_count": number | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "class_id"?: string | null
          "exam_id"?: string | null
          "student_id"?: string | null
          "student_name"?: string | null
          "violation_type"?: string | null
          "violation_count"?: number | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "class_id"?: string | null
          "exam_id"?: string | null
          "student_id"?: string | null
          "student_name"?: string | null
          "violation_type"?: string | null
          "violation_count"?: number | null
          "created_at"?: string | null
        }
      }
      "classes": {
        Row: {
          "id": string
          "teacher_id": string
          "name": string
          "grade": string | null
          "subject": string | null
          "description": string | null
          "created_at": string | null
          "class_code": string | null
        }
        Insert: {
          "id"?: string | null
          "teacher_id"?: string | null
          "name"?: string | null
          "grade"?: string | null
          "subject"?: string | null
          "description"?: string | null
          "created_at"?: string | null
          "class_code"?: string | null
        }
        Update: {
          "id"?: string | null
          "teacher_id"?: string | null
          "name"?: string | null
          "grade"?: string | null
          "subject"?: string | null
          "description"?: string | null
          "created_at"?: string | null
          "class_code"?: string | null
        }
      }
      "client_error_log": {
        Row: {
          "id": string
          "user_id": string | null
          "message": string
          "stack": string | null
          "url": string | null
          "user_agent": string | null
          "app_version": string | null
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "message"?: string | null
          "stack"?: string | null
          "url"?: string | null
          "user_agent"?: string | null
          "app_version"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "message"?: string | null
          "stack"?: string | null
          "url"?: string | null
          "user_agent"?: string | null
          "app_version"?: string | null
          "created_at"?: string | null
        }
      }
      "client_error_logs": {
        Row: {
          "id": string
          "user_id": string | null
          "user_email": string | null
          "error_message": string
          "error_stack": string | null
          "url": string | null
          "user_agent": string | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "user_email"?: string | null
          "error_message"?: string | null
          "error_stack"?: string | null
          "url"?: string | null
          "user_agent"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "user_email"?: string | null
          "error_message"?: string | null
          "error_stack"?: string | null
          "url"?: string | null
          "user_agent"?: string | null
          "created_at"?: string | null
        }
      }
      "comments": {
        Row: {
          "id": string
          "post_id": string | null
          "user_id": string | null
          "content": string
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "post_id"?: string | null
          "user_id"?: string | null
          "content"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "post_id"?: string | null
          "user_id"?: string | null
          "content"?: string | null
          "created_at"?: string | null
        }
      }
      "daily_checkins": {
        Row: {
          "id": string
          "user_id": string
          "checkin_date": string
          "reward_sc": number
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "checkin_date"?: string | null
          "reward_sc"?: number | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "checkin_date"?: string | null
          "reward_sc"?: number | null
          "created_at"?: string | null
        }
      }
      "exam_collections": {
        Row: {
          "id": string
          "subject": string
          "title": string
          "description": string | null
          "exam_ids": any
          "created_at": string | null
          "updated_at": string | null
        }
        Insert: {
          "id"?: string | null
          "subject"?: string | null
          "title"?: string | null
          "description"?: string | null
          "exam_ids"?: any | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "subject"?: string | null
          "title"?: string | null
          "description"?: string | null
          "exam_ids"?: any | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "exam_proctoring_logs": {
        Row: {
          "id": string
          "exam_id": string
          "user_id": string | null
          "user_name": string | null
          "user_email": string | null
          "school": string | null
          "class_name": string | null
          "province": string | null
          "subject": string | null
          "has_camera": boolean | null
          "is_active": boolean | null
          "violation_type": string
          "severity": string
          "confidence": number | null
          "snapshot_url": string | null
          "details": string | null
          "created_at": string
          "user_phone": string | null
          "is_disqualified": boolean | null
        }
        Insert: {
          "id"?: string | null
          "exam_id"?: string | null
          "user_id"?: string | null
          "user_name"?: string | null
          "user_email"?: string | null
          "school"?: string | null
          "class_name"?: string | null
          "province"?: string | null
          "subject"?: string | null
          "has_camera"?: boolean | null
          "is_active"?: boolean | null
          "violation_type"?: string | null
          "severity"?: string | null
          "confidence"?: number | null
          "snapshot_url"?: string | null
          "details"?: string | null
          "created_at"?: string | null
          "user_phone"?: string | null
          "is_disqualified"?: boolean | null
        }
        Update: {
          "id"?: string | null
          "exam_id"?: string | null
          "user_id"?: string | null
          "user_name"?: string | null
          "user_email"?: string | null
          "school"?: string | null
          "class_name"?: string | null
          "province"?: string | null
          "subject"?: string | null
          "has_camera"?: boolean | null
          "is_active"?: boolean | null
          "violation_type"?: string | null
          "severity"?: string | null
          "confidence"?: number | null
          "snapshot_url"?: string | null
          "details"?: string | null
          "created_at"?: string | null
          "user_phone"?: string | null
          "is_disqualified"?: boolean | null
        }
      }
      "exams": {
        Row: {
          "id": string
          "title": string
          "exam_type": string | null
          "subject_combo": string[] | null
          "created_by": string | null
          "created_at": string
          "drive_file_id": string | null
          "subjects": string[] | null
          "exam_structure": any | null
          "duration": number | null
          "allow_review": boolean | null
          "max_attempts": number | null
          "grading_method": string | null
          "is_hidden": boolean | null
          "access_code": string | null
          "require_proctoring": boolean | null
          "creation_mode": string | null
          "exam_code": string | null
          "folder_id": string | null
          "require_seb": boolean | null
          "seb_config_key": string | null
          "part_instructions": any | null
          "max_score": number | null
          "is_vip": boolean | null
          "format": string | null
          "total_questions": number | null
          "pdf_url": string | null
          "solution_pdf_url": string | null
          "shuffle_questions": boolean | null
          "shuffle_options": boolean | null
          "tags": string[] | null
        }
        Insert: {
          "id"?: string | null
          "title"?: string | null
          "exam_type"?: string | null
          "subject_combo"?: string[] | null
          "created_by"?: string | null
          "created_at"?: string | null
          "drive_file_id"?: string | null
          "subjects"?: string[] | null
          "exam_structure"?: any | null
          "duration"?: number | null
          "allow_review"?: boolean | null
          "max_attempts"?: number | null
          "grading_method"?: string | null
          "is_hidden"?: boolean | null
          "access_code"?: string | null
          "require_proctoring"?: boolean | null
          "creation_mode"?: string | null
          "exam_code"?: string | null
          "folder_id"?: string | null
          "require_seb"?: boolean | null
          "seb_config_key"?: string | null
          "part_instructions"?: any | null
          "max_score"?: number | null
          "is_vip"?: boolean | null
          "format"?: string | null
          "total_questions"?: number | null
          "pdf_url"?: string | null
          "solution_pdf_url"?: string | null
          "shuffle_questions"?: boolean | null
          "shuffle_options"?: boolean | null
          "tags"?: string[] | null
        }
        Update: {
          "id"?: string | null
          "title"?: string | null
          "exam_type"?: string | null
          "subject_combo"?: string[] | null
          "created_by"?: string | null
          "created_at"?: string | null
          "drive_file_id"?: string | null
          "subjects"?: string[] | null
          "exam_structure"?: any | null
          "duration"?: number | null
          "allow_review"?: boolean | null
          "max_attempts"?: number | null
          "grading_method"?: string | null
          "is_hidden"?: boolean | null
          "access_code"?: string | null
          "require_proctoring"?: boolean | null
          "creation_mode"?: string | null
          "exam_code"?: string | null
          "folder_id"?: string | null
          "require_seb"?: boolean | null
          "seb_config_key"?: string | null
          "part_instructions"?: any | null
          "max_score"?: number | null
          "is_vip"?: boolean | null
          "format"?: string | null
          "total_questions"?: number | null
          "pdf_url"?: string | null
          "solution_pdf_url"?: string | null
          "shuffle_questions"?: boolean | null
          "shuffle_options"?: boolean | null
          "tags"?: string[] | null
        }
      }
      "exclusive_deal_claims": {
        Row: {
          "id": string
          "user_id": string
          "deal_code": string
          "claim_year": number
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "deal_code"?: string | null
          "claim_year"?: number | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "deal_code"?: string | null
          "claim_year"?: number | null
          "created_at"?: string | null
        }
      }
      "exclusive_flash_purchases": {
        Row: {
          "id": string
          "user_id": string
          "claim_month": string
          "senai_plan_code": string
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "claim_month"?: string | null
          "senai_plan_code"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "claim_month"?: string | null
          "senai_plan_code"?: string | null
          "created_at"?: string | null
        }
      }
      "feedback": {
        Row: {
          "id": string
          "user_id": string | null
          "content": string
          "mode": string
          "source": string
          "created_at": string
          "category": string | null
          "user_email": string | null
          "user_name": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "content"?: string | null
          "mode"?: string | null
          "source"?: string | null
          "created_at"?: string | null
          "category"?: string | null
          "user_email"?: string | null
          "user_name"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "content"?: string | null
          "mode"?: string | null
          "source"?: string | null
          "created_at"?: string | null
          "category"?: string | null
          "user_email"?: string | null
          "user_name"?: string | null
        }
      }
      "fepn_domain_emails": {
        Row: {
          "id": string
          "email": string
          "username": string
          "domain": string
          "full_name": string
          "initial_password": string | null
          "role": string | null
          "notes": string | null
          "status": string | null
          "created_at": string | null
          "last_login_at": string | null
          "user_id": string | null
        }
        Insert: {
          "id"?: string | null
          "email"?: string | null
          "username"?: string | null
          "domain"?: string | null
          "full_name"?: string | null
          "initial_password"?: string | null
          "role"?: string | null
          "notes"?: string | null
          "status"?: string | null
          "created_at"?: string | null
          "last_login_at"?: string | null
          "user_id"?: string | null
        }
        Update: {
          "id"?: string | null
          "email"?: string | null
          "username"?: string | null
          "domain"?: string | null
          "full_name"?: string | null
          "initial_password"?: string | null
          "role"?: string | null
          "notes"?: string | null
          "status"?: string | null
          "created_at"?: string | null
          "last_login_at"?: string | null
          "user_id"?: string | null
        }
      }
      "fepn_election_candidates": {
        Row: {
          "id": string
          "election_id": string
          "name": string
          "student_id": string
          "phone": string | null
          "email": string | null
          "position_ids": string[]
          "slogan": string | null
          "bio": string | null
          "avatar": string | null
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "election_id"?: string | null
          "name"?: string | null
          "student_id"?: string | null
          "phone"?: string | null
          "email"?: string | null
          "position_ids"?: string[] | null
          "slogan"?: string | null
          "bio"?: string | null
          "avatar"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "election_id"?: string | null
          "name"?: string | null
          "student_id"?: string | null
          "phone"?: string | null
          "email"?: string | null
          "position_ids"?: string[] | null
          "slogan"?: string | null
          "bio"?: string | null
          "avatar"?: string | null
          "created_at"?: string | null
        }
      }
      "fepn_election_settings": {
        Row: {
          "id": string
          "unit": string
          "academic_year": string
          "title": string
          "is_registration_open": boolean
          "is_voting_open": boolean
          "round": number
          "positions": any
          "updated_at": string
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "unit"?: string | null
          "academic_year"?: string | null
          "title"?: string | null
          "is_registration_open"?: boolean | null
          "is_voting_open"?: boolean | null
          "round"?: number | null
          "positions"?: any | null
          "updated_at"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "unit"?: string | null
          "academic_year"?: string | null
          "title"?: string | null
          "is_registration_open"?: boolean | null
          "is_voting_open"?: boolean | null
          "round"?: number | null
          "positions"?: any | null
          "updated_at"?: string | null
          "created_at"?: string | null
        }
      }
      "fepn_election_votes": {
        Row: {
          "id": string
          "election_id": string
          "voter_name": string
          "voter_student_id": string
          "selections": any
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "election_id"?: string | null
          "voter_name"?: string | null
          "voter_student_id"?: string | null
          "selections"?: any | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "election_id"?: string | null
          "voter_name"?: string | null
          "voter_student_id"?: string | null
          "selections"?: any | null
          "created_at"?: string | null
        }
      }
      "fepn_gift_claims": {
        Row: {
          "id": string
          "event_id": string | null
          "user_id": string | null
          "user_mssv": string
          "user_name": string | null
          "gift_id": string | null
          "gift_name": string
          "claim_code": string
          "claimed_at": string | null
          "status": string | null
          "delivered_at": string | null
          "delivered_by": string | null
        }
        Insert: {
          "id"?: string | null
          "event_id"?: string | null
          "user_id"?: string | null
          "user_mssv"?: string | null
          "user_name"?: string | null
          "gift_id"?: string | null
          "gift_name"?: string | null
          "claim_code"?: string | null
          "claimed_at"?: string | null
          "status"?: string | null
          "delivered_at"?: string | null
          "delivered_by"?: string | null
        }
        Update: {
          "id"?: string | null
          "event_id"?: string | null
          "user_id"?: string | null
          "user_mssv"?: string | null
          "user_name"?: string | null
          "gift_id"?: string | null
          "gift_name"?: string | null
          "claim_code"?: string | null
          "claimed_at"?: string | null
          "status"?: string | null
          "delivered_at"?: string | null
          "delivered_by"?: string | null
        }
      }
      "fepn_gift_code_redemptions": {
        Row: {
          "id": string
          "code": string
          "user_id": string | null
          "user_email": string | null
          "user_mssv": string | null
          "redeemed_at": string | null
        }
        Insert: {
          "id"?: string | null
          "code"?: string | null
          "user_id"?: string | null
          "user_email"?: string | null
          "user_mssv"?: string | null
          "redeemed_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "code"?: string | null
          "user_id"?: string | null
          "user_email"?: string | null
          "user_mssv"?: string | null
          "redeemed_at"?: string | null
        }
      }
      "fepn_gift_codes": {
        Row: {
          "id": string
          "event_id": string | null
          "code": string
          "type": string | null
          "spin_count": number | null
          "gift_item_id": string | null
          "max_uses": number | null
          "used_count": number | null
          "is_active": boolean | null
          "created_at": string | null
          "redeemed_users": string[] | null
        }
        Insert: {
          "id"?: string | null
          "event_id"?: string | null
          "code"?: string | null
          "type"?: string | null
          "spin_count"?: number | null
          "gift_item_id"?: string | null
          "max_uses"?: number | null
          "used_count"?: number | null
          "is_active"?: boolean | null
          "created_at"?: string | null
          "redeemed_users"?: string[] | null
        }
        Update: {
          "id"?: string | null
          "event_id"?: string | null
          "code"?: string | null
          "type"?: string | null
          "spin_count"?: number | null
          "gift_item_id"?: string | null
          "max_uses"?: number | null
          "used_count"?: number | null
          "is_active"?: boolean | null
          "created_at"?: string | null
          "redeemed_users"?: string[] | null
        }
      }
      "fepn_gift_events": {
        Row: {
          "id": string
          "title": string
          "description": string | null
          "event_type": string | null
          "is_active": boolean | null
          "default_spins": number | null
          "banner_url": string | null
          "updated_at": string | null
          "location": string | null
          "time": string | null
          "how_to_receive": string | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "title"?: string | null
          "description"?: string | null
          "event_type"?: string | null
          "is_active"?: boolean | null
          "default_spins"?: number | null
          "banner_url"?: string | null
          "updated_at"?: string | null
          "location"?: string | null
          "time"?: string | null
          "how_to_receive"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "title"?: string | null
          "description"?: string | null
          "event_type"?: string | null
          "is_active"?: boolean | null
          "default_spins"?: number | null
          "banner_url"?: string | null
          "updated_at"?: string | null
          "location"?: string | null
          "time"?: string | null
          "how_to_receive"?: string | null
          "created_at"?: string | null
        }
      }
      "fepn_gift_items": {
        Row: {
          "id": string
          "event_id": string | null
          "name": string
          "image_url": string | null
          "total_quantity": number | null
          "remaining_quantity": number | null
          "win_rate": number | null
          "color": string | null
          "is_consolation": boolean | null
          "order_index": number | null
        }
        Insert: {
          "id"?: string | null
          "event_id"?: string | null
          "name"?: string | null
          "image_url"?: string | null
          "total_quantity"?: number | null
          "remaining_quantity"?: number | null
          "win_rate"?: number | null
          "color"?: string | null
          "is_consolation"?: boolean | null
          "order_index"?: number | null
        }
        Update: {
          "id"?: string | null
          "event_id"?: string | null
          "name"?: string | null
          "image_url"?: string | null
          "total_quantity"?: number | null
          "remaining_quantity"?: number | null
          "win_rate"?: number | null
          "color"?: string | null
          "is_consolation"?: boolean | null
          "order_index"?: number | null
        }
      }
      "fepn_login_lockouts": {
        Row: {
          "id": string
          "email": string
          "failed_count": number | null
          "lock_level": number | null
          "locked_until": string | null
          "is_permanent_locked": boolean | null
          "updated_at": string | null
        }
        Insert: {
          "id"?: string | null
          "email"?: string | null
          "failed_count"?: number | null
          "lock_level"?: number | null
          "locked_until"?: string | null
          "is_permanent_locked"?: boolean | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "email"?: string | null
          "failed_count"?: number | null
          "lock_level"?: number | null
          "locked_until"?: string | null
          "is_permanent_locked"?: boolean | null
          "updated_at"?: string | null
        }
      }
      "fepn_mail_messages": {
        Row: {
          "id": string
          "sender_name": string
          "sender_email": string
          "recipient_email": string
          "subject": string
          "content": string | null
          "created_at": string | null
          "is_read": boolean | null
          "is_starred": boolean | null
          "folder": string | null
          "category": string | null
          "priority": string | null
          "has_attachment": boolean | null
          "attachment_name": string | null
        }
        Insert: {
          "id"?: string | null
          "sender_name"?: string | null
          "sender_email"?: string | null
          "recipient_email"?: string | null
          "subject"?: string | null
          "content"?: string | null
          "created_at"?: string | null
          "is_read"?: boolean | null
          "is_starred"?: boolean | null
          "folder"?: string | null
          "category"?: string | null
          "priority"?: string | null
          "has_attachment"?: boolean | null
          "attachment_name"?: string | null
        }
        Update: {
          "id"?: string | null
          "sender_name"?: string | null
          "sender_email"?: string | null
          "recipient_email"?: string | null
          "subject"?: string | null
          "content"?: string | null
          "created_at"?: string | null
          "is_read"?: boolean | null
          "is_starred"?: boolean | null
          "folder"?: string | null
          "category"?: string | null
          "priority"?: string | null
          "has_attachment"?: boolean | null
          "attachment_name"?: string | null
        }
      }
      "fepn_materials": {
        Row: {
          "id": string
          "subject_id": string
          "category": string
          "title": string
          "description": string | null
          "file_url": string
          "file_type": string | null
          "extra_info": string | null
          "created_at": string | null
          "created_by": string | null
        }
        Insert: {
          "id"?: string | null
          "subject_id"?: string | null
          "category"?: string | null
          "title"?: string | null
          "description"?: string | null
          "file_url"?: string | null
          "file_type"?: string | null
          "extra_info"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
        }
        Update: {
          "id"?: string | null
          "subject_id"?: string | null
          "category"?: string | null
          "title"?: string | null
          "description"?: string | null
          "file_url"?: string | null
          "file_type"?: string | null
          "extra_info"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
        }
      }
      "fepn_qr_logins": {
        Row: {
          "id": string
          "qr_token": string
          "short_code": string
          "status": string | null
          "request_device_info": any | null
          "approved_by_user_id": string | null
          "auth_token_hash": string | null
          "expires_at": string
          "created_at": string | null
          "completion_code": string | null
        }
        Insert: {
          "id"?: string | null
          "qr_token"?: string | null
          "short_code"?: string | null
          "status"?: string | null
          "request_device_info"?: any | null
          "approved_by_user_id"?: string | null
          "auth_token_hash"?: string | null
          "expires_at"?: string | null
          "created_at"?: string | null
          "completion_code"?: string | null
        }
        Update: {
          "id"?: string | null
          "qr_token"?: string | null
          "short_code"?: string | null
          "status"?: string | null
          "request_device_info"?: any | null
          "approved_by_user_id"?: string | null
          "auth_token_hash"?: string | null
          "expires_at"?: string | null
          "created_at"?: string | null
          "completion_code"?: string | null
        }
      }
      "fepn_recap_posts": {
        Row: {
          "id": string
          "year": string
          "title": string
          "cover_image": string | null
          "content": string
          "media_items": any | null
          "author_id": string | null
          "author_name": string | null
          "created_at": string | null
          "updated_at": string | null
        }
        Insert: {
          "id"?: string | null
          "year"?: string | null
          "title"?: string | null
          "cover_image"?: string | null
          "content"?: string | null
          "media_items"?: any | null
          "author_id"?: string | null
          "author_name"?: string | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "year"?: string | null
          "title"?: string | null
          "cover_image"?: string | null
          "content"?: string | null
          "media_items"?: any | null
          "author_id"?: string | null
          "author_name"?: string | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "fepn_schedule_sessions_view": {
        Row: {
          "subject_id": string | null
          "user_id": string | null
          "student_email": string | null
          "subject_name": string | null
          "subject_code": string | null
          "color": string | null
          "notify_email": boolean | null
          "day_of_week": number | null
          "shift_name": string | null
          "start_time": string | null
          "end_time": string | null
          "classroom": string | null
          "session_type": string | null
          "lecturer": string | null
          "notes": string | null
        }
        Insert: {
          "subject_id"?: string | null
          "user_id"?: string | null
          "student_email"?: string | null
          "subject_name"?: string | null
          "subject_code"?: string | null
          "color"?: string | null
          "notify_email"?: boolean | null
          "day_of_week"?: number | null
          "shift_name"?: string | null
          "start_time"?: string | null
          "end_time"?: string | null
          "classroom"?: string | null
          "session_type"?: string | null
          "lecturer"?: string | null
          "notes"?: string | null
        }
        Update: {
          "subject_id"?: string | null
          "user_id"?: string | null
          "student_email"?: string | null
          "subject_name"?: string | null
          "subject_code"?: string | null
          "color"?: string | null
          "notify_email"?: boolean | null
          "day_of_week"?: number | null
          "shift_name"?: string | null
          "start_time"?: string | null
          "end_time"?: string | null
          "classroom"?: string | null
          "session_type"?: string | null
          "lecturer"?: string | null
          "notes"?: string | null
        }
      }
      "fepn_schedule_settings": {
        Row: {
          "user_id": string
          "notification_email": string
          "remind_before_minutes": number | null
          "enable_email_reminder": boolean | null
          "created_at": string
          "updated_at": string
        }
        Insert: {
          "user_id"?: string | null
          "notification_email"?: string | null
          "remind_before_minutes"?: number | null
          "enable_email_reminder"?: boolean | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "user_id"?: string | null
          "notification_email"?: string | null
          "remind_before_minutes"?: number | null
          "enable_email_reminder"?: boolean | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "fepn_schedule_shifts": {
        Row: {
          "id": string
          "user_id": string
          "shift_name": string
          "period_label": string | null
          "start_time": string
          "end_time": string
          "order_index": number | null
          "created_at": string
          "updated_at": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "shift_name"?: string | null
          "period_label"?: string | null
          "start_time"?: string | null
          "end_time"?: string | null
          "order_index"?: number | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "shift_name"?: string | null
          "period_label"?: string | null
          "start_time"?: string | null
          "end_time"?: string | null
          "order_index"?: number | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "fepn_schedule_subjects": {
        Row: {
          "id": string
          "user_id": string
          "subject_id": string | null
          "code": string | null
          "name": string
          "credits": number | null
          "color": string | null
          "lecturers": string[] | null
          "default_classroom": string | null
          "sessions": any
          "notify_email": boolean | null
          "student_email": string | null
          "created_at": string
          "updated_at": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "subject_id"?: string | null
          "code"?: string | null
          "name"?: string | null
          "credits"?: number | null
          "color"?: string | null
          "lecturers"?: string[] | null
          "default_classroom"?: string | null
          "sessions"?: any | null
          "notify_email"?: boolean | null
          "student_email"?: string | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "subject_id"?: string | null
          "code"?: string | null
          "name"?: string | null
          "credits"?: number | null
          "color"?: string | null
          "lecturers"?: string[] | null
          "default_classroom"?: string | null
          "sessions"?: any | null
          "notify_email"?: boolean | null
          "student_email"?: string | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "fepn_semester_configs": {
        Row: {
          "user_id": string
          "semester_name": string
          "start_date": string
          "end_date": string
          "auto_prompt_on_end": boolean
          "created_at": string
          "updated_at": string
        }
        Insert: {
          "user_id"?: string | null
          "semester_name"?: string | null
          "start_date"?: string | null
          "end_date"?: string | null
          "auto_prompt_on_end"?: boolean | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "user_id"?: string | null
          "semester_name"?: string | null
          "start_date"?: string | null
          "end_date"?: string | null
          "auto_prompt_on_end"?: boolean | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "fepn_semesters": {
        Row: {
          "id": string
          "name": string
          "order_index": number | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "name"?: string | null
          "order_index"?: number | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "name"?: string | null
          "order_index"?: number | null
          "created_at"?: string | null
        }
      }
      "fepn_student_grades": {
        Row: {
          "id": string
          "user_id": string
          "semester_id": string
          "grades_data": any
          "updated_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "semester_id"?: string | null
          "grades_data"?: any | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "semester_id"?: string | null
          "grades_data"?: any | null
          "updated_at"?: string | null
        }
      }
      "fepn_subjects": {
        Row: {
          "id": string
          "code": string
          "name": string
          "credits": number | null
          "semester": string | null
          "description": string | null
          "icon": string | null
          "created_at": string | null
          "created_by": string | null
          "enable_recordings": boolean | null
        }
        Insert: {
          "id"?: string | null
          "code"?: string | null
          "name"?: string | null
          "credits"?: number | null
          "semester"?: string | null
          "description"?: string | null
          "icon"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "enable_recordings"?: boolean | null
        }
        Update: {
          "id"?: string | null
          "code"?: string | null
          "name"?: string | null
          "credits"?: number | null
          "semester"?: string | null
          "description"?: string | null
          "icon"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "enable_recordings"?: boolean | null
        }
      }
      "fepn_user_sessions": {
        Row: {
          "id": string
          "user_id": string
          "device_id": string
          "device_name": string
          "device_type": string | null
          "browser": string | null
          "os": string | null
          "ip_address": string | null
          "is_active": boolean | null
          "last_active_at": string | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "device_id"?: string | null
          "device_name"?: string | null
          "device_type"?: string | null
          "browser"?: string | null
          "os"?: string | null
          "ip_address"?: string | null
          "is_active"?: boolean | null
          "last_active_at"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "device_id"?: string | null
          "device_name"?: string | null
          "device_type"?: string | null
          "browser"?: string | null
          "os"?: string | null
          "ip_address"?: string | null
          "is_active"?: boolean | null
          "last_active_at"?: string | null
          "created_at"?: string | null
        }
      }
      "gift_code_redemptions": {
        Row: {
          "id": string
          "code_id": string
          "user_id": string
          "redeemed_at": string
          "code": string | null
          "reward_summary": string | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "code_id"?: string | null
          "user_id"?: string | null
          "redeemed_at"?: string | null
          "code"?: string | null
          "reward_summary"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "code_id"?: string | null
          "user_id"?: string | null
          "redeemed_at"?: string | null
          "code"?: string | null
          "reward_summary"?: string | null
          "created_at"?: string | null
        }
      }
      "gift_codes": {
        Row: {
          "id": string
          "code": string
          "reward_type": string
          "reward_vip_days": number | null
          "reward_sencash_amount": number | null
          "reward_senai_tier": string | null
          "reward_senai_duration_days": number | null
          "reward_senai_permanent": boolean
          "batch_id": string
          "note": string | null
          "max_uses": number
          "used_count": number
          "active": boolean
          "expires_at": string | null
          "created_by": string | null
          "created_at": string
          "reward_amount": number | null
          "is_active": boolean | null
          "description": string | null
        }
        Insert: {
          "id"?: string | null
          "code"?: string | null
          "reward_type"?: string | null
          "reward_vip_days"?: number | null
          "reward_sencash_amount"?: number | null
          "reward_senai_tier"?: string | null
          "reward_senai_duration_days"?: number | null
          "reward_senai_permanent"?: boolean | null
          "batch_id"?: string | null
          "note"?: string | null
          "max_uses"?: number | null
          "used_count"?: number | null
          "active"?: boolean | null
          "expires_at"?: string | null
          "created_by"?: string | null
          "created_at"?: string | null
          "reward_amount"?: number | null
          "is_active"?: boolean | null
          "description"?: string | null
        }
        Update: {
          "id"?: string | null
          "code"?: string | null
          "reward_type"?: string | null
          "reward_vip_days"?: number | null
          "reward_sencash_amount"?: number | null
          "reward_senai_tier"?: string | null
          "reward_senai_duration_days"?: number | null
          "reward_senai_permanent"?: boolean | null
          "batch_id"?: string | null
          "note"?: string | null
          "max_uses"?: number | null
          "used_count"?: number | null
          "active"?: boolean | null
          "expires_at"?: string | null
          "created_by"?: string | null
          "created_at"?: string | null
          "reward_amount"?: number | null
          "is_active"?: boolean | null
          "description"?: string | null
        }
      }
      "hidden_system_plans": {
        Row: {
          "code": string
          "name": string
          "badge": string
          "description": string
          "is_public_sale": boolean
          "privileges": any
          "created_at": string
        }
        Insert: {
          "code"?: string | null
          "name"?: string | null
          "badge"?: string | null
          "description"?: string | null
          "is_public_sale"?: boolean | null
          "privileges"?: any | null
          "created_at"?: string | null
        }
        Update: {
          "code"?: string | null
          "name"?: string | null
          "badge"?: string | null
          "description"?: string | null
          "is_public_sale"?: boolean | null
          "privileges"?: any | null
          "created_at"?: string | null
        }
      }
      "library_documents": {
        Row: {
          "id": string
          "folder_id": string | null
          "title": string
          "drive_file_id": string
          "created_at": string | null
          "created_by": string | null
          "is_vip_only": boolean
        }
        Insert: {
          "id"?: string | null
          "folder_id"?: string | null
          "title"?: string | null
          "drive_file_id"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "is_vip_only"?: boolean | null
        }
        Update: {
          "id"?: string | null
          "folder_id"?: string | null
          "title"?: string | null
          "drive_file_id"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "is_vip_only"?: boolean | null
        }
      }
      "library_folders": {
        Row: {
          "id": string
          "name": string
          "created_at": string | null
          "created_by": string | null
          "parent_id": string | null
          "color": string | null
          "icon": string | null
        }
        Insert: {
          "id"?: string | null
          "name"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "parent_id"?: string | null
          "color"?: string | null
          "icon"?: string | null
        }
        Update: {
          "id"?: string | null
          "name"?: string | null
          "created_at"?: string | null
          "created_by"?: string | null
          "parent_id"?: string | null
          "color"?: string | null
          "icon"?: string | null
        }
      }
      "mobile_sencash_transactions": {
        Row: {
          "id": string
          "user_id": string
          "amount": number
          "balance_after": number
          "transaction_type": string
          "description": string | null
          "reference_id": string | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "amount"?: number | null
          "balance_after"?: number | null
          "transaction_type"?: string | null
          "description"?: string | null
          "reference_id"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "amount"?: number | null
          "balance_after"?: number | null
          "transaction_type"?: string | null
          "description"?: string | null
          "reference_id"?: string | null
          "created_at"?: string | null
        }
      }
      "mobile_sync_devices": {
        Row: {
          "id": string
          "user_id": string
          "device_id": string
          "platform": string | null
          "app_version": string | null
          "user_agent": string | null
          "push_token": string | null
          "last_synced_at": string | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "device_id"?: string | null
          "platform"?: string | null
          "app_version"?: string | null
          "user_agent"?: string | null
          "push_token"?: string | null
          "last_synced_at"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "device_id"?: string | null
          "platform"?: string | null
          "app_version"?: string | null
          "user_agent"?: string | null
          "push_token"?: string | null
          "last_synced_at"?: string | null
          "created_at"?: string | null
        }
      }
      "notifications": {
        Row: {
          "id": number
          "content": string | null
          "is_active": boolean | null
          "updated_at": string | null
        }
        Insert: {
          "id"?: number | null
          "content"?: string | null
          "is_active"?: boolean | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: number | null
          "content"?: string | null
          "is_active"?: boolean | null
          "updated_at"?: string | null
        }
      }
      "posts": {
        Row: {
          "id": string
          "user_id": string | null
          "title": string
          "content": string
          "category": string | null
          "created_at": string | null
          "drive_file_id": string | null
          "file_name": string | null
          "file_size": string | null
          "is_pinned": boolean | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "content"?: string | null
          "category"?: string | null
          "created_at"?: string | null
          "drive_file_id"?: string | null
          "file_name"?: string | null
          "file_size"?: string | null
          "is_pinned"?: boolean | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "content"?: string | null
          "category"?: string | null
          "created_at"?: string | null
          "drive_file_id"?: string | null
          "file_name"?: string | null
          "file_size"?: string | null
          "is_pinned"?: boolean | null
        }
      }
      "profiles": {
        Row: {
          "id": string
          "full_name": string | null
          "role": string | null
          "created_at": string
          "dob": string | null
          "cccd": string | null
          "province": string | null
          "school": string | null
          "aspiration": string | null
          "target_exams": string[] | null
          "target_subjects": string[] | null
          "hsa_option": string | null
          "hsa_science_subjects": string[] | null
          "new_ui_enabled": boolean
          "theme_color": string
          "is_beta_tester": boolean
          "vip_expires_at": string | null
          "vip_plan_code": string | null
          "sencash_balance": number
          "senai_tier": string
          "senai_tier_expires_at": string | null
          "senai_tier_permanent": boolean
          "senai_trial_used": boolean
          "plan_tier": string | null
          "ui_mode": string | null
          "phone_number": string | null
          "grade": string | null
          "target_score": string | null
          "updated_at": string | null
          "migrated_to_new_ui": boolean | null
          "admin_key_hash": string | null
          "admin_key_issued_at": string | null
          "email": string | null
          "avatar_url": string | null
          "active_seb_session": string | null
          "last_seb_exam_id": string | null
          "last_seb_exam_at": string | null
          "class_name": string | null
          "phone": string | null
          "mobile_eco_mode": boolean
          "mobile_low_transparency": boolean
          "last_mobile_active_at": string | null
          "streak_days": number | null
          "last_checkin_date": string | null
          "weekend_mission_claimed_date": string | null
          "auto_renew_vip": boolean | null
          "auto_renew_senai": boolean | null
          "senai_expires_at": string | null
          "is_vip_premium_plus": boolean | null
          "flame_motion_disabled": boolean | null
          "chat_bubble_disabled": boolean | null
          "preferred_ui_version": string | null
          "ui_3_0_theme": string | null
          "senheart_protocol": string | null
          "admin_view_perspective": string | null
          "is_vip": boolean | null
          "vip_until": string | null
          "is_banned": boolean
          "banned_at": string | null
          "ban_reason": string | null
          "banned_by": string | null
          "is_sen_unlimited": boolean
          "unlimited_granted_at": string | null
          "unlimited_note": string | null
          "password_change_count": number | null
          "sencash_mobile_balance": number | null
          "scm_balance": number | null
          "mobile_last_active_at": string | null
          "mobile_device_id": string | null
          "mobile_version": string | null
        }
        Insert: {
          "id"?: string | null
          "full_name"?: string | null
          "role"?: string | null
          "created_at"?: string | null
          "dob"?: string | null
          "cccd"?: string | null
          "province"?: string | null
          "school"?: string | null
          "aspiration"?: string | null
          "target_exams"?: string[] | null
          "target_subjects"?: string[] | null
          "hsa_option"?: string | null
          "hsa_science_subjects"?: string[] | null
          "new_ui_enabled"?: boolean | null
          "theme_color"?: string | null
          "is_beta_tester"?: boolean | null
          "vip_expires_at"?: string | null
          "vip_plan_code"?: string | null
          "sencash_balance"?: number | null
          "senai_tier"?: string | null
          "senai_tier_expires_at"?: string | null
          "senai_tier_permanent"?: boolean | null
          "senai_trial_used"?: boolean | null
          "plan_tier"?: string | null
          "ui_mode"?: string | null
          "phone_number"?: string | null
          "grade"?: string | null
          "target_score"?: string | null
          "updated_at"?: string | null
          "migrated_to_new_ui"?: boolean | null
          "admin_key_hash"?: string | null
          "admin_key_issued_at"?: string | null
          "email"?: string | null
          "avatar_url"?: string | null
          "active_seb_session"?: string | null
          "last_seb_exam_id"?: string | null
          "last_seb_exam_at"?: string | null
          "class_name"?: string | null
          "phone"?: string | null
          "mobile_eco_mode"?: boolean | null
          "mobile_low_transparency"?: boolean | null
          "last_mobile_active_at"?: string | null
          "streak_days"?: number | null
          "last_checkin_date"?: string | null
          "weekend_mission_claimed_date"?: string | null
          "auto_renew_vip"?: boolean | null
          "auto_renew_senai"?: boolean | null
          "senai_expires_at"?: string | null
          "is_vip_premium_plus"?: boolean | null
          "flame_motion_disabled"?: boolean | null
          "chat_bubble_disabled"?: boolean | null
          "preferred_ui_version"?: string | null
          "ui_3_0_theme"?: string | null
          "senheart_protocol"?: string | null
          "admin_view_perspective"?: string | null
          "is_vip"?: boolean | null
          "vip_until"?: string | null
          "is_banned"?: boolean | null
          "banned_at"?: string | null
          "ban_reason"?: string | null
          "banned_by"?: string | null
          "is_sen_unlimited"?: boolean | null
          "unlimited_granted_at"?: string | null
          "unlimited_note"?: string | null
          "password_change_count"?: number | null
          "sencash_mobile_balance"?: number | null
          "scm_balance"?: number | null
          "mobile_last_active_at"?: string | null
          "mobile_device_id"?: string | null
          "mobile_version"?: string | null
        }
        Update: {
          "id"?: string | null
          "full_name"?: string | null
          "role"?: string | null
          "created_at"?: string | null
          "dob"?: string | null
          "cccd"?: string | null
          "province"?: string | null
          "school"?: string | null
          "aspiration"?: string | null
          "target_exams"?: string[] | null
          "target_subjects"?: string[] | null
          "hsa_option"?: string | null
          "hsa_science_subjects"?: string[] | null
          "new_ui_enabled"?: boolean | null
          "theme_color"?: string | null
          "is_beta_tester"?: boolean | null
          "vip_expires_at"?: string | null
          "vip_plan_code"?: string | null
          "sencash_balance"?: number | null
          "senai_tier"?: string | null
          "senai_tier_expires_at"?: string | null
          "senai_tier_permanent"?: boolean | null
          "senai_trial_used"?: boolean | null
          "plan_tier"?: string | null
          "ui_mode"?: string | null
          "phone_number"?: string | null
          "grade"?: string | null
          "target_score"?: string | null
          "updated_at"?: string | null
          "migrated_to_new_ui"?: boolean | null
          "admin_key_hash"?: string | null
          "admin_key_issued_at"?: string | null
          "email"?: string | null
          "avatar_url"?: string | null
          "active_seb_session"?: string | null
          "last_seb_exam_id"?: string | null
          "last_seb_exam_at"?: string | null
          "class_name"?: string | null
          "phone"?: string | null
          "mobile_eco_mode"?: boolean | null
          "mobile_low_transparency"?: boolean | null
          "last_mobile_active_at"?: string | null
          "streak_days"?: number | null
          "last_checkin_date"?: string | null
          "weekend_mission_claimed_date"?: string | null
          "auto_renew_vip"?: boolean | null
          "auto_renew_senai"?: boolean | null
          "senai_expires_at"?: string | null
          "is_vip_premium_plus"?: boolean | null
          "flame_motion_disabled"?: boolean | null
          "chat_bubble_disabled"?: boolean | null
          "preferred_ui_version"?: string | null
          "ui_3_0_theme"?: string | null
          "senheart_protocol"?: string | null
          "admin_view_perspective"?: string | null
          "is_vip"?: boolean | null
          "vip_until"?: string | null
          "is_banned"?: boolean | null
          "banned_at"?: string | null
          "ban_reason"?: string | null
          "banned_by"?: string | null
          "is_sen_unlimited"?: boolean | null
          "unlimited_granted_at"?: string | null
          "unlimited_note"?: string | null
          "password_change_count"?: number | null
          "sencash_mobile_balance"?: number | null
          "scm_balance"?: number | null
          "mobile_last_active_at"?: string | null
          "mobile_device_id"?: string | null
          "mobile_version"?: string | null
        }
      }
      "questions": {
        Row: {
          "id": string
          "exam_id": string | null
          "content": string
          "options": any
          "correct_answer": string
          "image_drive_id": string | null
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "exam_id"?: string | null
          "content"?: string | null
          "options"?: any | null
          "correct_answer"?: string | null
          "image_drive_id"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "exam_id"?: string | null
          "content"?: string | null
          "options"?: any | null
          "correct_answer"?: string | null
          "image_drive_id"?: string | null
          "created_at"?: string | null
        }
      }
      "reading_books": {
        Row: {
          "id": string
          "user_id": string | null
          "title": string
          "author": string | null
          "description": string | null
          "cover_url": string | null
          "genre": string | null
          "language": string | null
          "is_public": boolean | null
          "views_count": number | null
          "total_chapters": number | null
          "created_at": string | null
          "updated_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "author"?: string | null
          "description"?: string | null
          "cover_url"?: string | null
          "genre"?: string | null
          "language"?: string | null
          "is_public"?: boolean | null
          "views_count"?: number | null
          "total_chapters"?: number | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "author"?: string | null
          "description"?: string | null
          "cover_url"?: string | null
          "genre"?: string | null
          "language"?: string | null
          "is_public"?: boolean | null
          "views_count"?: number | null
          "total_chapters"?: number | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "reading_chapters": {
        Row: {
          "id": string
          "book_id": string
          "chapter_number": number
          "title": string
          "content": string
          "translation_en": string | null
          "translation_vi": string | null
          "illustrations": any | null
          "created_at": string | null
          "updated_at": string | null
        }
        Insert: {
          "id"?: string | null
          "book_id"?: string | null
          "chapter_number"?: number | null
          "title"?: string | null
          "content"?: string | null
          "translation_en"?: string | null
          "translation_vi"?: string | null
          "illustrations"?: any | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "book_id"?: string | null
          "chapter_number"?: number | null
          "title"?: string | null
          "content"?: string | null
          "translation_en"?: string | null
          "translation_vi"?: string | null
          "illustrations"?: any | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "release_log": {
        Row: {
          "id": string
          "actor_id": string | null
          "action": string
          "version": string | null
          "note": string | null
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "actor_id"?: string | null
          "action"?: string | null
          "version"?: string | null
          "note"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "actor_id"?: string | null
          "action"?: string | null
          "version"?: string | null
          "note"?: string | null
          "created_at"?: string | null
        }
      }
      "seb_access_codes": {
        Row: {
          "id": string
          "code": string
          "user_id": string | null
          "user_email": string | null
          "exam_id": string | null
          "token_hash": string | null
          "action_link": string | null
          "device_id": string | null
          "expires_at": string
          "used": boolean | null
          "used_at": string | null
          "terminated_other_sessions": boolean | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "code"?: string | null
          "user_id"?: string | null
          "user_email"?: string | null
          "exam_id"?: string | null
          "token_hash"?: string | null
          "action_link"?: string | null
          "device_id"?: string | null
          "expires_at"?: string | null
          "used"?: boolean | null
          "used_at"?: string | null
          "terminated_other_sessions"?: boolean | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "code"?: string | null
          "user_id"?: string | null
          "user_email"?: string | null
          "exam_id"?: string | null
          "token_hash"?: string | null
          "action_link"?: string | null
          "device_id"?: string | null
          "expires_at"?: string | null
          "used"?: boolean | null
          "used_at"?: string | null
          "terminated_other_sessions"?: boolean | null
          "created_at"?: string | null
        }
      }
      "seb_folders": {
        Row: {
          "id": string
          "name": string
          "parent_id": string | null
          "icon": string | null
          "sort_order": number | null
          "created_at": string | null
          "description": string | null
        }
        Insert: {
          "id"?: string | null
          "name"?: string | null
          "parent_id"?: string | null
          "icon"?: string | null
          "sort_order"?: number | null
          "created_at"?: string | null
          "description"?: string | null
        }
        Update: {
          "id"?: string | null
          "name"?: string | null
          "parent_id"?: string | null
          "icon"?: string | null
          "sort_order"?: number | null
          "created_at"?: string | null
          "description"?: string | null
        }
      }
      "sen_messages": {
        Row: {
          "id": string
          "user_id": string
          "user_name": string
          "message": string | null
          "attachment_path": string | null
          "attachment_name": string | null
          "attachment_size": number | null
          "attachment_mime": string | null
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "user_name"?: string | null
          "message"?: string | null
          "attachment_path"?: string | null
          "attachment_name"?: string | null
          "attachment_size"?: number | null
          "attachment_mime"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "user_name"?: string | null
          "message"?: string | null
          "attachment_path"?: string | null
          "attachment_name"?: string | null
          "attachment_size"?: number | null
          "attachment_mime"?: string | null
          "created_at"?: string | null
        }
      }
      "senai_messages": {
        Row: {
          "id": string
          "session_id": string | null
          "role": string
          "content": string
          "images": any | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "session_id"?: string | null
          "role"?: string | null
          "content"?: string | null
          "images"?: any | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "session_id"?: string | null
          "role"?: string | null
          "content"?: string | null
          "images"?: any | null
          "created_at"?: string | null
        }
      }
      "senai_question_log": {
        Row: {
          "id": string
          "user_id": string
          "asked_at": string
          "created_at": string | null
          "question_prompt": string | null
          "model": string | null
          "status": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "asked_at"?: string | null
          "created_at"?: string | null
          "question_prompt"?: string | null
          "model"?: string | null
          "status"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "asked_at"?: string | null
          "created_at"?: string | null
          "question_prompt"?: string | null
          "model"?: string | null
          "status"?: string | null
        }
      }
      "senai_sessions": {
        Row: {
          "id": string
          "user_id": string | null
          "title": string
          "created_at": string | null
          "updated_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "senai_studio_messages": {
        Row: {
          "id": string
          "session_id": string
          "user_id": string
          "role": string
          "content": string
          "attachments": any
          "deep_think": boolean
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "session_id"?: string | null
          "user_id"?: string | null
          "role"?: string | null
          "content"?: string | null
          "attachments"?: any | null
          "deep_think"?: boolean | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "session_id"?: string | null
          "user_id"?: string | null
          "role"?: string | null
          "content"?: string | null
          "attachments"?: any | null
          "deep_think"?: boolean | null
          "created_at"?: string | null
        }
      }
      "senai_studio_sessions": {
        Row: {
          "id": string
          "user_id": string
          "title": string
          "created_at": string
          "updated_at": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "created_at"?: string | null
          "updated_at"?: string | null
        }
      }
      "sencash_topup_orders": {
        Row: {
          "id": string
          "user_id": string
          "order_code": string
          "amount_vnd": number
          "sencash_amount": number
          "status": string
          "created_at": string
          "expires_at": string
          "paid_at": string | null
          "sepay_id": string | null
          "raw_webhook": any | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "order_code"?: string | null
          "amount_vnd"?: number | null
          "sencash_amount"?: number | null
          "status"?: string | null
          "created_at"?: string | null
          "expires_at"?: string | null
          "paid_at"?: string | null
          "sepay_id"?: string | null
          "raw_webhook"?: any | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "order_code"?: string | null
          "amount_vnd"?: number | null
          "sencash_amount"?: number | null
          "status"?: string | null
          "created_at"?: string | null
          "expires_at"?: string | null
          "paid_at"?: string | null
          "sepay_id"?: string | null
          "raw_webhook"?: any | null
        }
      }
      "sencash_transactions": {
        Row: {
          "id": string
          "user_id": string
          "delta": number | null
          "reason": string | null
          "reference": string | null
          "created_at": string
          "amount": number | null
          "transaction_type": string | null
          "description": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "delta"?: number | null
          "reason"?: string | null
          "reference"?: string | null
          "created_at"?: string | null
          "amount"?: number | null
          "transaction_type"?: string | null
          "description"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "delta"?: number | null
          "reason"?: string | null
          "reference"?: string | null
          "created_at"?: string | null
          "amount"?: number | null
          "transaction_type"?: string | null
          "description"?: string | null
        }
      }
      "sencash_vouchers": {
        Row: {
          "id": string
          "user_id": string
          "kind": string
          "discount_percent": number
          "used": boolean
          "used_at": string | null
          "source_vip_plan": string | null
          "created_at": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "kind"?: string | null
          "discount_percent"?: number | null
          "used"?: boolean | null
          "used_at"?: string | null
          "source_vip_plan"?: string | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "kind"?: string | null
          "discount_percent"?: number | null
          "used"?: boolean | null
          "used_at"?: string | null
          "source_vip_plan"?: string | null
          "created_at"?: string | null
        }
      }
      "sengraph_ai_log": {
        Row: {
          "id": string
          "user_id": string
          "asked_at": string
          "equation_count": number | null
          "has_image": boolean | null
          "mode": string | null
          "tokens_used": number | null
          "created_at": string | null
          "status": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "asked_at"?: string | null
          "equation_count"?: number | null
          "has_image"?: boolean | null
          "mode"?: string | null
          "tokens_used"?: number | null
          "created_at"?: string | null
          "status"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "asked_at"?: string | null
          "equation_count"?: number | null
          "has_image"?: boolean | null
          "mode"?: string | null
          "tokens_used"?: number | null
          "created_at"?: string | null
          "status"?: string | null
        }
      }
      "senheart_security_logs": {
        Row: {
          "id": string
          "user_id": string | null
          "event_type": string
          "protocol_version": string | null
          "details": string | null
          "metadata": any | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "event_type"?: string | null
          "protocol_version"?: string | null
          "details"?: string | null
          "metadata"?: any | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "event_type"?: string | null
          "protocol_version"?: string | null
          "details"?: string | null
          "metadata"?: any | null
          "created_at"?: string | null
        }
      }
      "submissions": {
        Row: {
          "id": string
          "exam_id": string | null
          "user_id": string | null
          "answers": any | null
          "score": number | null
          "is_graded": boolean | null
          "file_url": string | null
          "created_at": string | null
          "feedback": string | null
          "detailed_scores": any | null
          "tab_switches": number | null
          "blur_count": number | null
          "is_completed": boolean | null
          "submitted_at": string | null
          "time_spent": number | null
          "phone_number": string | null
          "school": string | null
          "class_name": string | null
          "province": string | null
          "has_camera": boolean | null
          "is_disqualified": boolean | null
          "disqualification_reason": string | null
          "violation_count": number | null
          "user_name": string | null
          "user_email": string | null
          "mode": string | null
          "details": any | null
          "earned_points": number | null
          "total_points": number | null
          "correct_count": number | null
          "total_questions": number | null
        }
        Insert: {
          "id"?: string | null
          "exam_id"?: string | null
          "user_id"?: string | null
          "answers"?: any | null
          "score"?: number | null
          "is_graded"?: boolean | null
          "file_url"?: string | null
          "created_at"?: string | null
          "feedback"?: string | null
          "detailed_scores"?: any | null
          "tab_switches"?: number | null
          "blur_count"?: number | null
          "is_completed"?: boolean | null
          "submitted_at"?: string | null
          "time_spent"?: number | null
          "phone_number"?: string | null
          "school"?: string | null
          "class_name"?: string | null
          "province"?: string | null
          "has_camera"?: boolean | null
          "is_disqualified"?: boolean | null
          "disqualification_reason"?: string | null
          "violation_count"?: number | null
          "user_name"?: string | null
          "user_email"?: string | null
          "mode"?: string | null
          "details"?: any | null
          "earned_points"?: number | null
          "total_points"?: number | null
          "correct_count"?: number | null
          "total_questions"?: number | null
        }
        Update: {
          "id"?: string | null
          "exam_id"?: string | null
          "user_id"?: string | null
          "answers"?: any | null
          "score"?: number | null
          "is_graded"?: boolean | null
          "file_url"?: string | null
          "created_at"?: string | null
          "feedback"?: string | null
          "detailed_scores"?: any | null
          "tab_switches"?: number | null
          "blur_count"?: number | null
          "is_completed"?: boolean | null
          "submitted_at"?: string | null
          "time_spent"?: number | null
          "phone_number"?: string | null
          "school"?: string | null
          "class_name"?: string | null
          "province"?: string | null
          "has_camera"?: boolean | null
          "is_disqualified"?: boolean | null
          "disqualification_reason"?: string | null
          "violation_count"?: number | null
          "user_name"?: string | null
          "user_email"?: string | null
          "mode"?: string | null
          "details"?: any | null
          "earned_points"?: number | null
          "total_points"?: number | null
          "correct_count"?: number | null
          "total_questions"?: number | null
        }
      }
      "system_release": {
        Row: {
          "id": number
          "latest_version": string
          "changelog": string
          "is_published": boolean
          "updated_by": string | null
          "updated_at": string
          "stable_version": string
          "stable_changelog": string
          "stable_published": boolean
          "beta_version": string
          "beta_changelog": string
          "beta_published": boolean
        }
        Insert: {
          "id"?: number | null
          "latest_version"?: string | null
          "changelog"?: string | null
          "is_published"?: boolean | null
          "updated_by"?: string | null
          "updated_at"?: string | null
          "stable_version"?: string | null
          "stable_changelog"?: string | null
          "stable_published"?: boolean | null
          "beta_version"?: string | null
          "beta_changelog"?: string | null
          "beta_published"?: boolean | null
        }
        Update: {
          "id"?: number | null
          "latest_version"?: string | null
          "changelog"?: string | null
          "is_published"?: boolean | null
          "updated_by"?: string | null
          "updated_at"?: string | null
          "stable_version"?: string | null
          "stable_changelog"?: string | null
          "stable_published"?: boolean | null
          "beta_version"?: string | null
          "beta_changelog"?: string | null
          "beta_published"?: boolean | null
        }
      }
      "ui_migration_opt_ins": {
        Row: {
          "id": string
          "user_id": string
          "migrated_at": string | null
          "source_path": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "migrated_at"?: string | null
          "source_path"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "migrated_at"?: string | null
          "source_path"?: string | null
        }
      }
      "university_scores": {
        Row: {
          "id": number
          "data": any
        }
        Insert: {
          "id"?: number | null
          "data"?: any | null
        }
        Update: {
          "id"?: number | null
          "data"?: any | null
        }
      }
      "user_schedules": {
        Row: {
          "id": string
          "user_id": string
          "title": string
          "subject": string
          "type": string | null
          "room": string | null
          "date": string
          "start_time": string
          "end_time": string
          "remind_before": number | null
          "repeat": string | null
          "repeat_until": string | null
          "note": string | null
          "color": string | null
          "is_completed": boolean | null
          "created_at": string | null
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "subject"?: string | null
          "type"?: string | null
          "room"?: string | null
          "date"?: string | null
          "start_time"?: string | null
          "end_time"?: string | null
          "remind_before"?: number | null
          "repeat"?: string | null
          "repeat_until"?: string | null
          "note"?: string | null
          "color"?: string | null
          "is_completed"?: boolean | null
          "created_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "title"?: string | null
          "subject"?: string | null
          "type"?: string | null
          "room"?: string | null
          "date"?: string | null
          "start_time"?: string | null
          "end_time"?: string | null
          "remind_before"?: number | null
          "repeat"?: string | null
          "repeat_until"?: string | null
          "note"?: string | null
          "color"?: string | null
          "is_completed"?: boolean | null
          "created_at"?: string | null
        }
      }
      "vip_document_downloads": {
        Row: {
          "id": string
          "user_id": string
          "document_id": string
          "downloaded_at": string
          "paid_with_sencash": boolean
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "document_id"?: string | null
          "downloaded_at"?: string | null
          "paid_with_sencash"?: boolean | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "document_id"?: string | null
          "downloaded_at"?: string | null
          "paid_with_sencash"?: boolean | null
        }
      }
      "vip_orders": {
        Row: {
          "id": string
          "user_id": string
          "plan_code": string
          "order_code": string
          "amount_vnd": number
          "status": string
          "created_at": string
          "expires_at": string
          "paid_at": string | null
          "sepay_id": string | null
          "raw_webhook": any | null
          "plan_group": string
        }
        Insert: {
          "id"?: string | null
          "user_id"?: string | null
          "plan_code"?: string | null
          "order_code"?: string | null
          "amount_vnd"?: number | null
          "status"?: string | null
          "created_at"?: string | null
          "expires_at"?: string | null
          "paid_at"?: string | null
          "sepay_id"?: string | null
          "raw_webhook"?: any | null
          "plan_group"?: string | null
        }
        Update: {
          "id"?: string | null
          "user_id"?: string | null
          "plan_code"?: string | null
          "order_code"?: string | null
          "amount_vnd"?: number | null
          "status"?: string | null
          "created_at"?: string | null
          "expires_at"?: string | null
          "paid_at"?: string | null
          "sepay_id"?: string | null
          "raw_webhook"?: any | null
          "plan_group"?: string | null
        }
      }
      "zalo_sync_queue": {
        Row: {
          "id": string
          "sender_id": string
          "sender_name": string | null
          "receiver_id": string
          "device_id": string
          "payload": any
          "sync_type": string | null
          "created_at": string
          "expires_at": string
        }
        Insert: {
          "id"?: string | null
          "sender_id"?: string | null
          "sender_name"?: string | null
          "receiver_id"?: string | null
          "device_id"?: string | null
          "payload"?: any | null
          "sync_type"?: string | null
          "created_at"?: string | null
          "expires_at"?: string | null
        }
        Update: {
          "id"?: string | null
          "sender_id"?: string | null
          "sender_name"?: string | null
          "receiver_id"?: string | null
          "device_id"?: string | null
          "payload"?: any | null
          "sync_type"?: string | null
          "created_at"?: string | null
          "expires_at"?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
