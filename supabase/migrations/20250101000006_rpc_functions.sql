-- ════════════════════════════════════════════════════════════════════
-- EduFlow · Migration 0006 · Callable RPC functions
-- ════════════════════════════════════════════════════════════════════

-- Atomically add a payment to a fee and recompute its status.
-- Called from the Razorpay webhook (service role).
create or replace function public.increment_fee_payment(p_fee_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fees
  set amount_paid = amount_paid + p_amount
  where id = p_fee_id;

  perform public.recompute_fee_status(p_fee_id);
end;
$$;

-- Generate the next sequential, zero-padded receipt number for an institute.
-- Format: RCPT-000001 (per-tenant counter).
create or replace function public.next_receipt_number(p_institute_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_seq integer;
begin
  select count(*) + 1 into next_seq
  from public.receipts
  where institute_id = p_institute_id;

  return 'RCPT-' || lpad(next_seq::text, 6, '0');
end;
$$;
