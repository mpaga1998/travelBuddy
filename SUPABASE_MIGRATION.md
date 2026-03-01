# Supabase Migration: Add Date of Birth Field

To support the new Date of Birth feature, you need to add the `dob` column to your `profiles` table in Supabase.

## Migration SQL

Run this SQL in your Supabase SQL Editor (go to your project > SQL Editor > New query):

```sql
-- Add date of birth column to profiles table (if it doesn't exist)
ALTER TABLE profiles
ADD COLUMN dob DATE DEFAULT NULL;

-- Optional: Create a computed column for age (PostgreSQL)
-- This will automatically compute age from dob
ALTER TABLE profiles
ADD COLUMN age INT GENERATED ALWAYS AS (
  CASE 
    WHEN dob IS NULL THEN NULL
    ELSE EXTRACT(YEAR FROM age(dob))
  END
) STORED;
```

## Manual Steps (if needed)

If you prefer to update the schema through the Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to `SQL Editor`
3. Click `New query`
4. Paste the SQL above
5. Click `Run`

## What This Does

- **dob**: Stores the date of birth as an ISO date string (YYYY-MM-DD format)
- **age**: Automatically computed from the DOB (optional, for convenience)

## Notes

- The frontend already validates that users must be 18+ years old
- Users aged 100+ will see a fun warning message when saving
- The age is computed on the frontend using the `calculateAge()` function in `profileApi.ts`
- The `age` computed column is optional - the frontend doesn't rely on it, but it can be useful for queries
