-- PlantMoji · Milestone 12 — enable fully sensor-covered classroom crops.
-- Run after milestone10-jember-crop-catalog.sql. Re-runnable.
-- Tobacco and crops with unsupported kit requirements remain unavailable.

update public.crop_profiles
set status = 'active', kit_suitability = 'supported', updated_at = now()
where key in ('soybean', 'cayenne-pepper');

update public.crop_profile_versions
set review_status = 'approved',
    evaluation_policy = case crop_profile_key
      when 'soybean' then '{"mode":"automatic","approved_for_quests":true,"overheating":{"enter_at_or_above":33,"recover_at_or_below":30},"dry_air":{"enter_below":24,"recover_at_or_above":29}}'::jsonb
      when 'cayenne-pepper' then '{"mode":"automatic","approved_for_quests":true,"overheating":{"enter_at_or_above":31,"recover_at_or_below":29},"dry_air":{"enter_below":60,"recover_at_or_above":65}}'::jsonb
      else evaluation_policy
    end
where crop_profile_key in ('soybean', 'cayenne-pepper') and is_current;
