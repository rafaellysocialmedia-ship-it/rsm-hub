REVOKE ALL ON FUNCTION public.close_post_month(uuid, integer, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.close_previous_post_month() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_digital_asset_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_landing_page_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_payable_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_recurring_expense_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_supplier_history() FROM PUBLIC, anon, authenticated;