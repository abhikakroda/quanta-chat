
-- Table for website builder projects
CREATE TABLE public.website_builder_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_html TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.website_builder_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.website_builder_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.website_builder_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.website_builder_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.website_builder_projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_website_builder_projects_updated_at
  BEFORE UPDATE ON public.website_builder_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
