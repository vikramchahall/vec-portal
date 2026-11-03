-- Sites and units VEC makes salaries for (BRD-01 2.2), and Punjab minimum wages from 01-10-2026.
INSERT INTO "sites" ("code", "name", "client", "state", "billing_model") VALUES
  ('HMEL', 'HMEL Bathinda', 'HPCL-Mittal Energy Ltd (via Aquatech Systems Asia Pvt. Ltd.)', 'Punjab', 'per_employee'),
  ('HZL-CHD', 'HZL Putholi Chanderiya', 'Hindustan Zinc Ltd', 'Rajasthan', 'percent_of_bill'),
  ('HZL-DEB', 'HZL Debari, Udaipur', 'Hindustan Zinc Ltd', 'Rajasthan', 'percent_of_bill')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "units" ("site_id", "code", "name", "work_orders", "mode", "sort_order")
SELECT s."id", u."code", u."name", u."wo"::text[], u."mode", u."ord" FROM (VALUES
  ('HMEL', 'ETP-PET', 'Effluent Treatment Plant — Petchem', '{300005425PET}', 'punch', 1),
  ('HMEL', 'ETP-REF', 'Effluent Treatment Plant — Refinery', '{300005425}', 'punch', 2),
  ('HMEL', 'WB-PET', 'Water Block — Petchem', '{300005424PET}', 'punch', 3),
  ('HMEL', 'WB-REF', 'Water Block — Refinery (incl. REF M&I)', '{300005424,300005834}', 'punch', 4),
  ('HMEL', 'DRIVERS', 'Drivers — ETP-PET / ETP-REF / WB-REF', '{}', 'punch', 5),
  ('HMEL', 'STP', 'Sewage Treatment Plant (CSD Ion Exchange)', '{}', 'file', 6),
  ('HZL-CHD', 'HZL-CHD', 'HZL Putholi Chanderiya — VEC roll', '{}', 'file', 7),
  ('HZL-DEB', 'HZL-DEB', 'HZL Debari — VEC roll', '{}', 'file', 8)
) AS u("site", "code", "name", "wo", "mode", "ord")
JOIN "sites" s ON s."code" = u."site"
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "min_wages" ("state", "category", "effective_from", "daily_rate", "monthly_rate") VALUES
  ('Punjab', 'UNSKILLED', '2026-10-01', 565, 14690),
  ('Punjab', 'SEMI SKILLED', '2026-10-01', 661, 17186),
  ('Punjab', 'SKILLED', '2026-10-01', 794, 20644),
  ('Punjab', 'HIGH SKILLED', '2026-10-01', 933, 24258)
ON CONFLICT DO NOTHING;
