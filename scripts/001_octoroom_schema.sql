-- Octoroom Schema: Housekeeping Planner for AAAB
-- This script creates all necessary tables, enums, and RLS policies

-- ============================================
-- ENUMS
-- ============================================

-- Task type enum: depart (checkout), restant (stay-over), qc (quality check)
CREATE TYPE task_type_enum AS ENUM ('depart', 'restant', 'qc');

-- Task status enum
CREATE TYPE task_status_enum AS ENUM ('open', 'done', 'skipped', 'failed');

-- User role enum
CREATE TYPE user_role_enum AS ENUM ('admin', 'vendor');

-- ============================================
-- PROFILES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS octo_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role_enum NOT NULL,
  company TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROOMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS octo_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number INT NOT NULL UNIQUE,
  name TEXT,
  -- Restant policy: {"type":"weekly_on_days","days_of_week":[5]} or {"type":"every_n_days","n_days":3}
  restant_policy JSONB NOT NULL DEFAULT '{"type":"every_n_days","n_days":3}',
  last_restant_at DATE,
  last_depart_at DATE,
  last_qc_at DATE,
  -- Block settings
  blocked_for_cleaning BOOLEAN DEFAULT FALSE,
  blocked_from DATE,
  blocked_to DATE,
  blocked_reason TEXT,
  -- Counters
  count_depart INT DEFAULT 0,
  count_restant INT DEFAULT 0,
  count_qc INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS octo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_date DATE NOT NULL,
  room_id UUID NOT NULL REFERENCES octo_rooms(id) ON DELETE CASCADE,
  type task_type_enum NOT NULL,
  status task_status_enum NOT NULL DEFAULT 'open',
  skip_reason TEXT,
  note TEXT,
  done_at TIMESTAMPTZ,
  done_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint: one task per room per type per day
  UNIQUE (task_date, room_id, type)
);

-- ============================================
-- EVENTS TABLE (Audit Trail - Immutable)
-- ============================================

CREATE TABLE IF NOT EXISTS octo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES octo_tasks(id) ON DELETE SET NULL,
  room_id UUID NOT NULL REFERENCES octo_rooms(id) ON DELETE CASCADE,
  task_date DATE NOT NULL,
  type task_type_enum NOT NULL,
  action task_status_enum NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_by_name TEXT NOT NULL,
  performed_by_company TEXT NOT NULL,
  note TEXT,
  meta JSONB
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_octo_events_task_date ON octo_events(task_date);
CREATE INDEX IF NOT EXISTS idx_octo_events_room_id ON octo_events(room_id);
CREATE INDEX IF NOT EXISTS idx_octo_events_type ON octo_events(type);

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_octo_tasks_task_date ON octo_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_octo_tasks_room_id ON octo_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_octo_tasks_status ON octo_tasks(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE octo_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE octo_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE octo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE octo_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON octo_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update only display_name on their own profile
CREATE POLICY "profiles_update_own" ON octo_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- ROOMS POLICIES
-- ============================================

-- Admin and vendor can read all rooms
CREATE POLICY "rooms_select_all" ON octo_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM octo_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'vendor')
    )
  );

-- Only admin can insert/update/delete rooms
CREATE POLICY "rooms_insert_admin" ON octo_rooms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM octo_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "rooms_update_admin" ON octo_rooms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM octo_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "rooms_delete_admin" ON octo_rooms
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM octo_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- TASKS POLICIES
-- ============================================

-- Admin and vendor can read all tasks
CREATE POLICY "tasks_select_all" ON octo_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM octo_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'vendor')
    )
  );

-- Only admin can insert tasks
CREATE POLICY "tasks_insert_admin" ON octo_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM octo_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can update everything, vendor can only update status/skip_reason/note
-- Note: The actual enforcement is done via RPC function
CREATE POLICY "tasks_update_all" ON octo_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM octo_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'vendor')
    )
  );

-- Only admin can delete tasks
CREATE POLICY "tasks_delete_admin" ON octo_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM octo_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- EVENTS POLICIES
-- ============================================

-- Admin and vendor can read all events
CREATE POLICY "events_select_all" ON octo_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM octo_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'vendor')
    )
  );

-- Insert only via RPC/Server (service role)
-- No update/delete allowed

-- ============================================
-- RPC FUNCTION: mark_task
-- ============================================

CREATE OR REPLACE FUNCTION mark_task(
  p_task_id UUID,
  p_new_status task_status_enum,
  p_skip_reason TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role user_role_enum;
  v_user_name TEXT;
  v_user_company TEXT;
  v_task RECORD;
  v_result JSONB;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get user profile
  SELECT role, display_name, company 
  INTO v_user_role, v_user_name, v_user_company
  FROM octo_profiles 
  WHERE id = v_user_id;
  
  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  
  -- Get the task
  SELECT * INTO v_task FROM octo_tasks WHERE id = p_task_id;
  
  IF v_task IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;
  
  -- Check if task is already processed (prevent double-click)
  IF v_task.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task already processed', 'current_status', v_task.status::text);
  END IF;
  
  -- Vendor restrictions
  IF v_user_role = 'vendor' THEN
    -- Vendor can only set done or skipped
    IF p_new_status NOT IN ('done', 'skipped') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Vendor can only mark tasks as done or skipped');
    END IF;
    
    -- If skipped, skip_reason is mandatory
    IF p_new_status = 'skipped' AND (p_skip_reason IS NULL OR TRIM(p_skip_reason) = '') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Skip reason is required when skipping a task');
    END IF;
  END IF;
  
  -- Update the task
  UPDATE octo_tasks
  SET 
    status = p_new_status,
    skip_reason = CASE WHEN p_new_status = 'skipped' THEN p_skip_reason ELSE NULL END,
    note = p_note,
    done_at = CASE WHEN p_new_status IN ('done', 'skipped') THEN NOW() ELSE NULL END,
    done_by = CASE WHEN p_new_status IN ('done', 'skipped') THEN v_user_id ELSE NULL END
  WHERE id = p_task_id;
  
  -- Insert audit event
  INSERT INTO octo_events (
    task_id, room_id, task_date, type, action,
    performed_by, performed_by_name, performed_by_company, note
  )
  VALUES (
    p_task_id, v_task.room_id, v_task.task_date, v_task.type, p_new_status,
    v_user_id, v_user_name, v_user_company, p_note
  );
  
  -- Update room counters if task is done
  IF p_new_status = 'done' THEN
    IF v_task.type = 'depart' THEN
      UPDATE octo_rooms 
      SET count_depart = count_depart + 1, last_depart_at = v_task.task_date
      WHERE id = v_task.room_id;
      
      -- Auto-create QC task after depart is done
      INSERT INTO octo_tasks (task_date, room_id, type, status, created_by)
      VALUES (v_task.task_date, v_task.room_id, 'qc', 'open', v_user_id)
      ON CONFLICT (task_date, room_id, type) DO NOTHING;
      
    ELSIF v_task.type = 'restant' THEN
      UPDATE octo_rooms 
      SET count_restant = count_restant + 1, last_restant_at = v_task.task_date
      WHERE id = v_task.room_id;
      
    ELSIF v_task.type = 'qc' THEN
      UPDATE octo_rooms 
      SET count_qc = count_qc + 1, last_qc_at = v_task.task_date
      WHERE id = v_task.room_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'task_id', p_task_id,
    'new_status', p_new_status::text,
    'performed_by', v_user_name
  );
END;
$$;

-- ============================================
-- RPC FUNCTION: generate_tasks_for_date
-- ============================================

CREATE OR REPLACE FUNCTION generate_tasks_for_date(p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role user_role_enum;
  v_room RECORD;
  v_task_count INT := 0;
  v_day_of_week INT;
  v_needs_restant BOOLEAN;
  v_has_depart BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Only admin can generate tasks
  SELECT role INTO v_user_role FROM octo_profiles WHERE id = v_user_id;
  
  IF v_user_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admin can generate tasks');
  END IF;
  
  -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  v_day_of_week := EXTRACT(DOW FROM p_date)::INT;
  
  -- Loop through all rooms
  FOR v_room IN SELECT * FROM octo_rooms LOOP
    -- Skip blocked rooms
    IF v_room.blocked_for_cleaning = TRUE AND 
       v_room.blocked_from IS NOT NULL AND 
       v_room.blocked_to IS NOT NULL AND
       p_date BETWEEN v_room.blocked_from AND v_room.blocked_to THEN
      CONTINUE;
    END IF;
    
    -- Check if room has depart task for this date
    SELECT EXISTS (
      SELECT 1 FROM octo_tasks 
      WHERE room_id = v_room.id AND task_date = p_date AND type = 'depart'
    ) INTO v_has_depart;
    
    -- Determine if restant is needed (skip if depart exists)
    v_needs_restant := FALSE;
    
    IF NOT v_has_depart THEN
      -- Check restant policy
      IF v_room.restant_policy->>'type' = 'weekly_on_days' THEN
        -- Weekly on specific days
        IF v_room.restant_policy->'days_of_week' ? v_day_of_week::TEXT THEN
          v_needs_restant := TRUE;
        END IF;
      ELSIF v_room.restant_policy->>'type' = 'every_n_days' THEN
        -- Every N days
        IF v_room.last_restant_at IS NULL OR 
           p_date - v_room.last_restant_at >= (v_room.restant_policy->>'n_days')::INT THEN
          v_needs_restant := TRUE;
        END IF;
      END IF;
    END IF;
    
    -- Create restant task if needed
    IF v_needs_restant THEN
      INSERT INTO octo_tasks (task_date, room_id, type, status, created_by)
      VALUES (p_date, v_room.id, 'restant', 'open', v_user_id)
      ON CONFLICT (task_date, room_id, type) DO NOTHING;
      
      IF FOUND THEN
        v_task_count := v_task_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'date', p_date,
    'tasks_created', v_task_count
  );
END;
$$;

-- ============================================
-- RPC FUNCTION: create_depart_task (Admin only)
-- ============================================

CREATE OR REPLACE FUNCTION create_depart_task(
  p_room_id UUID,
  p_task_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role user_role_enum;
  v_task_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT role INTO v_user_role FROM octo_profiles WHERE id = v_user_id;
  
  IF v_user_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admin can create depart tasks');
  END IF;
  
  INSERT INTO octo_tasks (task_date, room_id, type, status, created_by)
  VALUES (p_task_date, p_room_id, 'depart', 'open', v_user_id)
  ON CONFLICT (task_date, room_id, type) DO NOTHING
  RETURNING id INTO v_task_id;
  
  IF v_task_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Depart task already exists for this room and date');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'task_id', v_task_id
  );
END;
$$;

-- ============================================
-- RPC FUNCTION: forecast (read-only)
-- ============================================

CREATE OR REPLACE FUNCTION forecast_tasks(
  p_from_date DATE,
  p_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB := '[]'::JSONB;
  v_current_date DATE;
  v_room RECORD;
  v_day_of_week INT;
  v_needs_restant BOOLEAN;
  v_has_depart BOOLEAN;
  v_day_tasks JSONB;
  v_simulated_last_restant DATE;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Loop through each day
  FOR i IN 0..(p_days - 1) LOOP
    v_current_date := p_from_date + i;
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::INT;
    v_day_tasks := jsonb_build_object(
      'date', v_current_date,
      'restant_count', 0,
      'depart_count', 0,
      'qc_count', 0,
      'rooms', '[]'::JSONB
    );
    
    FOR v_room IN SELECT * FROM octo_rooms LOOP
      -- Skip blocked rooms
      IF v_room.blocked_for_cleaning = TRUE AND 
         v_room.blocked_from IS NOT NULL AND 
         v_room.blocked_to IS NOT NULL AND
         v_current_date BETWEEN v_room.blocked_from AND v_room.blocked_to THEN
        CONTINUE;
      END IF;
      
      -- Check for existing depart task
      SELECT EXISTS (
        SELECT 1 FROM octo_tasks 
        WHERE room_id = v_room.id AND task_date = v_current_date AND type = 'depart'
      ) INTO v_has_depart;
      
      IF v_has_depart THEN
        v_day_tasks := jsonb_set(
          v_day_tasks, 
          '{depart_count}', 
          to_jsonb((v_day_tasks->>'depart_count')::INT + 1)
        );
        v_day_tasks := jsonb_set(
          v_day_tasks,
          '{rooms}',
          (v_day_tasks->'rooms') || jsonb_build_object('room_number', v_room.room_number, 'type', 'depart')
        );
        CONTINUE;
      END IF;
      
      -- Simulate restant based on policy
      v_needs_restant := FALSE;
      v_simulated_last_restant := v_room.last_restant_at;
      
      IF v_room.restant_policy->>'type' = 'weekly_on_days' THEN
        IF v_room.restant_policy->'days_of_week' ? v_day_of_week::TEXT THEN
          v_needs_restant := TRUE;
        END IF;
      ELSIF v_room.restant_policy->>'type' = 'every_n_days' THEN
        IF v_simulated_last_restant IS NULL OR 
           v_current_date - v_simulated_last_restant >= (v_room.restant_policy->>'n_days')::INT THEN
          v_needs_restant := TRUE;
        END IF;
      END IF;
      
      IF v_needs_restant THEN
        v_day_tasks := jsonb_set(
          v_day_tasks, 
          '{restant_count}', 
          to_jsonb((v_day_tasks->>'restant_count')::INT + 1)
        );
        v_day_tasks := jsonb_set(
          v_day_tasks,
          '{rooms}',
          (v_day_tasks->'rooms') || jsonb_build_object('room_number', v_room.room_number, 'type', 'restant')
        );
      END IF;
    END LOOP;
    
    v_result := v_result || v_day_tasks;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'forecast', v_result);
END;
$$;
