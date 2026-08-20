-- Run order for a clean database:
--   mysql -u root -p < database/init_all.sql
-- (this uses `source`, whose paths resolve relative to the mysql client's
-- own working directory — run mysql from inside database/, or use the
-- full-path variant your OS needs)
source schema.sql
source groundwater.sql
source rainfall.sql
source building.sql
source recharge.sql
source prediction.sql
source indexes.sql
source views.sql
source procedures.sql
source scheduler.sql
source seed.sql
