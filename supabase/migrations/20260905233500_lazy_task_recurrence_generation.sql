create extension if not exists pg_cron;

create or replace function public.task_recurrence_date(
  _anchor timestamptz,
  _frequency text,
  _occurrence integer
)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  anchor_date date;
  target_month date;
  last_day date;
  day_num integer;
begin
  if _anchor is null then
    return null;
  end if;

  anchor_date := (_anchor at time zone 'UTC')::date;

  if coalesce(_occurrence, 1) <= 1 then
    return anchor_date;
  end if;

  case _frequency
    when 'daily' then
      return anchor_date + (_occurrence - 1);
    when 'weekly' then
      return anchor_date + ((_occurrence - 1) * 7);
    when 'biweekly' then
      return anchor_date + ((_occurrence - 1) * 14);
    when 'monthly' then
      target_month := (
        date_trunc('month', anchor_date::timestamp)
        + make_interval(months => _occurrence - 1)
      )::date;
      last_day := (target_month + interval '1 month - 1 day')::date;
      day_num := least(
        extract(day from anchor_date)::integer,
        extract(day from last_day)::integer
      );
      return target_month + (day_num - 1);
    else
      return null;
  end case;
end
$$;

create or replace function public.normalize_task_recurrence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  freq text;
  total_count integer;
  generated_count integer := 1;
begin
  if new.recurrence is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.recurrence is not distinct from old.recurrence
     and new.due_date is not distinct from old.due_date then
    return new;
  end if;

  freq := new.recurrence ->> 'frequency';
  if freq not in ('daily', 'weekly', 'biweekly', 'monthly') or new.due_date is null then
    return new;
  end if;

  total_count := case
    when coalesce(new.recurrence ->> 'count', '') ~ '^[0-9]+$'
      then greatest(2, least(52, (new.recurrence ->> 'count')::integer))
    else 4
  end;

  if new.recurrence ->> 'mode' = 'lazy'
     and coalesce(new.recurrence ->> 'generated', '') ~ '^[0-9]+$' then
    generated_count := greatest(1, least(total_count, (new.recurrence ->> 'generated')::integer));
  elsif tg_op = 'UPDATE'
     and old.recurrence ->> 'mode' = 'lazy'
     and old.recurrence ->> 'frequency' = freq
     and coalesce(old.recurrence ->> 'generated', '') ~ '^[0-9]+$' then
    generated_count := greatest(1, least(total_count, (old.recurrence ->> 'generated')::integer));
  end if;

  new.recurrence := jsonb_build_object(
    'frequency', freq,
    'count', total_count,
    'mode', 'lazy',
    'generated', generated_count
  );

  return new;
end
$$;

drop trigger if exists trg_normalize_task_recurrence on public.tasks;
create trigger trg_normalize_task_recurrence
before insert or update of recurrence, due_date on public.tasks
for each row execute function public.normalize_task_recurrence();

create or replace function public.suppress_eager_task_recurrence_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_task public.tasks%rowtype;
  total_count integer;
  i integer;
  child_date date;
begin
  if current_setting('rsm.recurring_generator', true) = '1' then
    return new;
  end if;

  if new.recurrence is not null or new.due_date is null then
    return new;
  end if;

  select t.*
    into parent_task
  from public.tasks t
  where t.id <> new.id
    and t.recurrence ->> 'mode' = 'lazy'
    and t.created_at >= now() - interval '5 minutes'
    and t.title = new.title
    and t.description is not distinct from new.description
    and t.status = new.status
    and t.priority = new.priority
    and t.client_id is not distinct from new.client_id
    and t.assignee_id is not distinct from new.assignee_id
    and t.created_by is not distinct from new.created_by
    and t.due_date is not null
  order by t.created_at desc
  limit 1;

  if not found then
    return new;
  end if;

  total_count := greatest(
    2,
    least(52, coalesce((parent_task.recurrence ->> 'count')::integer, 4))
  );
  child_date := (new.due_date at time zone 'UTC')::date;

  for i in 2..total_count loop
    if public.task_recurrence_date(
      parent_task.due_date,
      parent_task.recurrence ->> 'frequency',
      i
    ) = child_date then
      delete from public.tasks where id = new.id;
      return new;
    end if;
  end loop;

  return new;
end
$$;

drop trigger if exists trg_suppress_eager_task_recurrence_children on public.tasks;
create trigger trg_suppress_eager_task_recurrence_children
after insert on public.tasks
for each row execute function public.suppress_eager_task_recurrence_children();

create or replace function public.generate_due_recurring_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row public.tasks%rowtype;
  today_date date := (now() at time zone 'America/Sao_Paulo')::date;
  freq text;
  total_count integer;
  generated_count integer;
  next_index integer;
  next_due date;
  new_task_id uuid;
  created_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('rsm.generate_due_recurring_tasks'));

  for task_row in
    select t.*
    from public.tasks t
    where t.recurrence ->> 'mode' = 'lazy'
      and t.due_date is not null
    order by t.created_at
    for update skip locked
  loop
    freq := task_row.recurrence ->> 'frequency';
    if freq not in ('daily', 'weekly', 'biweekly', 'monthly') then
      continue;
    end if;

    total_count := case
      when coalesce(task_row.recurrence ->> 'count', '') ~ '^[0-9]+$'
        then greatest(2, least(52, (task_row.recurrence ->> 'count')::integer))
      else 4
    end;

    generated_count := case
      when coalesce(task_row.recurrence ->> 'generated', '') ~ '^[0-9]+$'
        then greatest(1, least(total_count, (task_row.recurrence ->> 'generated')::integer))
      else 1
    end;

    if generated_count >= total_count then
      continue;
    end if;

    next_index := generated_count + 1;
    next_due := public.task_recurrence_date(task_row.due_date, freq, next_index);

    while next_index <= total_count and next_due < today_date loop
      generated_count := next_index;
      next_index := generated_count + 1;
      exit when next_index > total_count;
      next_due := public.task_recurrence_date(task_row.due_date, freq, next_index);
    end loop;

    if next_index <= total_count and next_due = today_date then
      perform set_config('rsm.recurring_generator', '1', true);

      insert into public.tasks (
        title,
        description,
        status,
        priority,
        client_id,
        assignee_id,
        due_date,
        position,
        created_by,
        recurrence,
        source_post_id
      ) values (
        task_row.title,
        task_row.description,
        'todo'::task_status,
        task_row.priority,
        task_row.client_id,
        task_row.assignee_id,
        (next_due::timestamp at time zone 'UTC'),
        task_row.position,
        task_row.created_by,
        null,
        null
      )
      returning id into new_task_id;

      insert into public.task_checklist (task_id, content, done, position)
      select new_task_id, c.content, false, c.position
      from public.task_checklist c
      where c.task_id = task_row.id
      order by c.position;

      generated_count := next_index;
      created_count := created_count + 1;
    end if;

    if generated_count <> coalesce((task_row.recurrence ->> 'generated')::integer, 1) then
      update public.tasks
      set recurrence = jsonb_set(
            recurrence,
            '{generated}',
            to_jsonb(generated_count),
            true
          ),
          updated_at = now()
      where id = task_row.id;
    end if;
  end loop;

  return created_count;
end
$$;

revoke execute on function public.generate_due_recurring_tasks() from public, anon, authenticated;
revoke execute on function public.suppress_eager_task_recurrence_children() from public, anon, authenticated;

do $$
declare
  j record;
begin
  for j in select jobid from cron.job where jobname = 'rsm-task-recurrence-generator' loop
    perform cron.unschedule(j.jobid);
  end loop;
end
$$;

select cron.schedule(
  'rsm-task-recurrence-generator',
  '5 * * * *',
  $cron$select public.generate_due_recurring_tasks();$cron$
);