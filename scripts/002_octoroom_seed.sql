-- Octoroom Seed Data
-- Creates 22 rooms with various restant policies

-- Clear existing data (for re-seeding)
DELETE FROM octo_events;
DELETE FROM octo_tasks;
DELETE FROM octo_rooms;

-- Insert 22 rooms with different policies
-- Standard rooms (every 3 days) - Rooms 1-15
INSERT INTO octo_rooms (room_number, name, restant_policy) VALUES
(1, 'Zimmer 1', '{"type":"every_n_days","n_days":3}'),
(2, 'Zimmer 2', '{"type":"every_n_days","n_days":3}'),
(3, 'Zimmer 3', '{"type":"every_n_days","n_days":3}'),
(4, 'Zimmer 4', '{"type":"every_n_days","n_days":3}'),
(5, 'Zimmer 5', '{"type":"every_n_days","n_days":3}'),
(6, 'Zimmer 6', '{"type":"every_n_days","n_days":3}'),
(8, 'Zimmer 8', '{"type":"every_n_days","n_days":3}'),
(9, 'Zimmer 9', '{"type":"every_n_days","n_days":3}'),
(10, 'Zimmer 10', '{"type":"every_n_days","n_days":3}'),
(11, 'Zimmer 11', '{"type":"every_n_days","n_days":3}'),
(12, 'Zimmer 12', '{"type":"every_n_days","n_days":3}'),
(13, 'Zimmer 13', '{"type":"every_n_days","n_days":3}'),
(14, 'Zimmer 14', '{"type":"every_n_days","n_days":3}'),
(15, 'Zimmer 15', '{"type":"every_n_days","n_days":3}');

-- Room 7: Weekly on Friday (day 5)
INSERT INTO octo_rooms (room_number, name, restant_policy) VALUES
(7, 'Zimmer 7', '{"type":"weekly_on_days","days_of_week":[5]}');

-- Longstay rooms (every 7 days) - Rooms 16-22
INSERT INTO octo_rooms (room_number, name, restant_policy) VALUES
(16, 'Zimmer 16 (Longstay)', '{"type":"every_n_days","n_days":7}'),
(17, 'Zimmer 17 (Longstay)', '{"type":"every_n_days","n_days":7}'),
(18, 'Zimmer 18 (Longstay)', '{"type":"every_n_days","n_days":7}'),
(19, 'Zimmer 19 (Longstay)', '{"type":"every_n_days","n_days":7}'),
(20, 'Zimmer 20 (Longstay)', '{"type":"every_n_days","n_days":7}'),
(21, 'Zimmer 21 (Longstay)', '{"type":"every_n_days","n_days":7}'),
(22, 'Zimmer 22 (Longstay)', '{"type":"every_n_days","n_days":7}');
