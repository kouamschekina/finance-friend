-- Push subscriptions table for Web Push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can insert push subscriptions" ON push_subscriptions;

-- Allow any authenticated or anonymous user to insert their subscription
CREATE POLICY "Anyone can insert push subscriptions"
    ON push_subscriptions FOR INSERT
    WITH CHECK (true);

-- Allow users to view their own subscriptions (or guest subscriptions with no user_id)
CREATE POLICY "Users can view their own push subscriptions"
    ON push_subscriptions FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

-- Allow users to delete their own subscriptions
CREATE POLICY "Users can delete their own push subscriptions"
    ON push_subscriptions FOR DELETE
    USING (user_id IS NULL OR auth.uid() = user_id);
