-- Add agent_source column to distinguish CTO vs SEO proposals
ALTER TABLE public.cto_code_proposals
ADD COLUMN IF NOT EXISTS agent_source text NOT NULL DEFAULT 'cto';

-- Add check constraint
ALTER TABLE public.cto_code_proposals
ADD CONSTRAINT cto_code_proposals_agent_source_check 
CHECK (agent_source IN ('cto', 'seo'));

-- Index for filtering by agent
CREATE INDEX IF NOT EXISTS idx_cto_code_proposals_agent_source 
ON public.cto_code_proposals(agent_source);
