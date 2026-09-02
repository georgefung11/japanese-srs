-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. BASE ITEM TABLE
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('vocabulary', 'grammar')),
  japanese TEXT NOT NULL,
  reading TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example_sentence TEXT,
  jlpt_level TEXT CHECK (jlpt_level IN ('N5', 'N4', 'N3', 'N2', 'N1')),
  is_custom BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  client_import_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT custom_items_require_owner CHECK (
    (is_custom = false) OR (is_custom = true AND user_id IS NOT NULL)
  ),
  CONSTRAINT unique_import_per_user UNIQUE (user_id, client_import_id)
);

--------------------------------------------------------------------------------
-- 2. SRS PERFORMANCE MATRIX TABLE
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_srs_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.study_items(id) ON DELETE CASCADE NOT NULL,
  interval INT DEFAULT 1 CHECK (interval >= 0),
  repetition_count INT DEFAULT 0 CHECK (repetition_count >= 0),
  ease_factor FLOAT DEFAULT 2.5 CHECK (ease_factor >= 1.3 AND ease_factor <= 5.0),
  next_review_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_id)
);

--------------------------------------------------------------------------------
-- 3. DUE REVIEWS VIEW
--------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.due_reviews_v AS
SELECT
  p.id,
  p.user_id,
  p.item_id,
  p.interval,
  p.repetition_count,
  p.ease_factor,
  p.next_review_date,
  i.type,
  i.japanese,
  i.reading,
  i.meaning,
  i.example_sentence,
  i.jlpt_level
FROM public.user_srs_progress p
JOIN public.study_items i ON i.id = p.item_id
WHERE i.is_deleted = false;

--------------------------------------------------------------------------------
-- 4. REVIEW EVENT LOG TABLE
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_review_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.study_items(id) ON DELETE CASCADE NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 0 AND 5),
  reviewed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  device_id TEXT,
  UNIQUE(user_id, client_review_id)
);

--------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS)
--------------------------------------------------------------------------------
ALTER TABLE public.study_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_srs_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Read global cards or own non-deleted items"
  ON public.study_items FOR SELECT
  USING ((user_id IS NULL OR auth.uid() = user_id) AND is_deleted = false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Manage own custom items"
  ON public.study_items FOR ALL
  USING (auth.uid() = user_id AND is_custom = true)
  WITH CHECK (auth.uid() = user_id AND is_custom = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Read own SRS metrics"
  ON public.user_srs_progress FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Insert own review events"
  ON public.review_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Read own review events"
  ON public.review_log FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

--------------------------------------------------------------------------------
-- 6. TRIGGERS & RPC PROCEDURES
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_server_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_study_items_server_updated_at ON public.study_items;
CREATE TRIGGER trg_study_items_server_updated_at
BEFORE UPDATE ON public.study_items
FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

CREATE OR REPLACE FUNCTION public.submit_review(
  p_item_id UUID,
  p_client_review_id UUID,
  p_rating SMALLINT,
  p_reviewed_at TIMESTAMPTZ
) RETURNS public.user_srs_progress
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.review_log (client_review_id, user_id, item_id, rating, reviewed_at)
  VALUES (p_client_review_id, auth.uid(), p_item_id, p_rating, p_reviewed_at)
  ON CONFLICT (user_id, client_review_id) DO NOTHING;

  RETURN (
    SELECT row_to_json(p)::public.user_srs_progress 
    FROM public.user_srs_progress p 
    WHERE user_id = auth.uid() AND item_id = p_item_id
  );
END;
$$;
