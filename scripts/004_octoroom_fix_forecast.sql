-- Fix the forecast function to handle the days_of_week array properly
-- PostgreSQL's ? operator checks for key existence in JSONB objects, not arrays

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
  v_days_array INT[];
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
        -- Convert JSONB array to INT array and check if day is included
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_room.restant_policy->'days_of_week')::INT)
        INTO v_days_array;
        
        IF v_day_of_week = ANY(v_days_array) THEN
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

-- Also fix the generate_tasks_for_date function
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
  v_days_array INT[];
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
        -- Convert JSONB array to INT array
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_room.restant_policy->'days_of_week')::INT)
        INTO v_days_array;
        
        IF v_day_of_week = ANY(v_days_array) THEN
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
