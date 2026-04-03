-- 🏆 LEADERBOARD REPAIR: Portfolio Value + Wallet Balance
-- Copy and run this in your Supabase SQL Editor to update the rankings!

CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (user_id UUID, username TEXT, total_value NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    COALESCE(p.username, 'Anonymous Trainer') as username,
    (
      COALESCE(p.wallet, 0) + 
      COALESCE(SUM(
        (
          COALESCE((c.api_data->'tcgPrices'->'holofoil'->>'market')::numeric, 0) +
          COALESCE((c.api_data->'tcgPrices'->'reverseHolofoil'->>'market')::numeric, 0) +
          COALESCE((c.api_data->'tcgPrices'->'normal'->>'market')::numeric, 0) +
          COALESCE((c.api_data->'tcgPrices'->'unlimitedHolofoil'->>'market')::numeric, 0)
        ) * 
        CASE 
          WHEN c.psa_grade = 10 THEN 8.0
          WHEN c.psa_grade = 9 THEN 3.0
          WHEN c.psa_grade = 8 THEN 1.6
          WHEN c.psa_grade = 7 THEN 1.15
          WHEN c.psa_grade = 6 THEN 0.9
          WHEN c.psa_grade = 5 THEN 0.7
          WHEN c.psa_grade = 4 THEN 0.5
          WHEN c.psa_grade = 3 THEN 0.35
          WHEN c.psa_grade = 2 THEN 0.25
          WHEN c.psa_grade = 1 THEN 0.15
          ELSE 1.0
        END
      ), 0)
    ) as total_value
  FROM profiles p
  LEFT JOIN cards c ON p.id = c.user_id
  GROUP BY p.id, p.username, p.wallet
  ORDER BY total_value DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
