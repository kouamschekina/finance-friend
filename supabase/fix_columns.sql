-- Ensure the currency column exists in the profiles table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='currency') THEN
        ALTER TABLE profiles ADD COLUMN currency TEXT DEFAULT 'XAF';
    END IF;
END $$;

-- Ensure other potentially missing columns exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='monthly_income') THEN
        ALTER TABLE profiles ADD COLUMN monthly_income NUMERIC DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='xai_api_key') THEN
        ALTER TABLE profiles ADD COLUMN xai_api_key TEXT;
    END IF;
please make in such a way that teh user sdont need to set the groq api key, we can internally use our groq api key
i said droq not grok, so please implement it sothat they dont ned to set it, we set it internaly and they can just chat with their advisor
this is the api key
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='onboarding_completed') THEN
        ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
