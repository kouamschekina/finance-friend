-- Sync categories for existing users to have all 15 default categories
-- This script adds any missing categories from the DEFAULT_CATEGORIES list

DO $$
DECLARE
    user_record RECORD;
    missing_category RECORD;
    category_exists BOOLEAN;
BEGIN
    -- Get all users
    FOR user_record IN SELECT id FROM auth.users LOOP
        -- Check each default category and add if missing
        FOR missing_category IN 
            SELECT 
                gen_random_uuid() as id, 'Food & Dining' as name, 'utensils' as icon, 'hsl(25, 95%, 53%)' as color
            UNION ALL SELECT gen_random_uuid(), 'Transport', 'car', 'hsl(210, 90%, 56%)'
            UNION ALL SELECT gen_random_uuid(), 'Housing', 'home', 'hsl(160, 84%, 39%)'
            UNION ALL SELECT gen_random_uuid(), 'Utilities', 'lightbulb', 'hsl(280, 70%, 55%)'
            UNION ALL SELECT gen_random_uuid(), 'Entertainment', 'film', 'hsl(340, 82%, 52%)'
            UNION ALL SELECT gen_random_uuid(), 'Shopping', 'shopping-bag', 'hsl(38, 92%, 50%)'
            UNION ALL SELECT gen_random_uuid(), 'Health', 'heart', 'hsl(0, 72%, 51%)'
            UNION ALL SELECT gen_random_uuid(), 'Business', 'briefcase', 'hsl(220, 60%, 50%)'
            UNION ALL SELECT gen_random_uuid(), 'Investments', 'trending-up', 'hsl(150, 60%, 40%)'
            UNION ALL SELECT gen_random_uuid(), 'Salary', 'wallet', 'hsl(160, 84%, 39%)'
            UNION ALL SELECT gen_random_uuid(), 'Education', 'book', 'hsl(270, 65%, 55%)'
            UNION ALL SELECT gen_random_uuid(), 'Personal Care', 'sparkles', 'hsl(320, 70%, 50%)'
            UNION ALL SELECT gen_random_uuid(), 'Gifts & Donations', 'gift', 'hsl(350, 75%, 55%)'
            UNION ALL SELECT gen_random_uuid(), 'Travel', 'plane', 'hsl(190, 80%, 50%)'
            UNION ALL SELECT gen_random_uuid(), 'Subscriptions', 'credit-card', 'hsl(250, 70%, 55%)'
        LOOP
            -- Check if category already exists for this user
            SELECT EXISTS(
                SELECT 1 FROM categories 
                WHERE user_id = user_record.id AND name = missing_category.name
            ) INTO category_exists;
            
            -- Insert category only if it doesn't exist for this user
            IF NOT category_exists THEN
                INSERT INTO categories (id, user_id, name, icon, color, budget_limit)
                VALUES (
                    missing_category.id,
                    user_record.id,
                    missing_category.name,
                    missing_category.icon,
                    missing_category.color,
                    0
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Verify the count for a sample user
SELECT COUNT(*) as total_categories 
FROM categories 
WHERE user_id = (SELECT id FROM auth.users LIMIT 1);
