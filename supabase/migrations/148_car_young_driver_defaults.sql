begin;

update public.car_offers
set
  young_driver_fee = true,
  young_driver_cost = coalesce(nullif(young_driver_cost, 0), 10)
where lower(coalesce(location, '')) = 'larnaca'
  and coalesce(young_driver_fee, false) = false
  and coalesce(young_driver_cost, 0) = 0;

update public.car_offers
set
  young_driver_fee = false,
  young_driver_cost = 0
where lower(coalesce(location, '')) = 'paphos';

commit;
