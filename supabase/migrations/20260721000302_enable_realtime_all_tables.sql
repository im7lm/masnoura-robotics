-- Add all application tables to the realtime publication so changes propagate to the client.
-- Views (member_scores) cannot be added directly; we subscribe to their base tables instead.
ALTER PUBLICATION supabase_realtime ADD TABLE public.committees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_grades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.strikes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bonuses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.director_committees;

-- task_submissions is already present but no longer used by the app; leave it.
