-- speedbikes-catalogue-integrity-verify-v2
-- READ ONLY. Returns exactly one summary row and reads no customer PII.
--
-- This is the durable catalogue-integrity gate. Deliberate operational changes
-- to stock_count, publication state, submission state, availability_mode and
-- either global capability flag are reported for visibility but do not make
-- speedbikes_catalogue_safe false. Run the separate strict draft-state or exact
-- Snipper pilot verify when those operational states must be enforced.
-- Every expected offer must retain its exact Ayia Napa row. Additional cities
-- configured deliberately in Admin are reported for review, but are not a
-- catalogue-integrity failure.

with
expected_offers as (
  select *
  from jsonb_to_recordset($catalogue$
[
  {
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "deposit_override_id": "6ae5563c-7c97-50f7-8646-b5ae007a6960",
    "slug": "snipper-fx-400",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 400,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-snipper-fx-400.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "deposit_override_id": "7aabc0c2-3887-5f05-9dff-5be74ec9e86b",
    "slug": "kymco-uvx-450",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 450,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-uvx-450.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "deposit_override_id": "eb968a57-762c-5c0a-bdab-88fca2c41726",
    "slug": "linhai-t-boss-efi-550",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 550,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-linhai-t-boss-efi-550.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "deposit_override_id": "2016c083-c8ef-5968-8d46-75c4744ac1a6",
    "slug": "polaris-ranger-nordic-pro-570",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 570,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-polaris-ranger-nordic-pro-570.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "deposit_override_id": "c6169a82-a8c8-5259-a7af-95dccfac03fd",
    "slug": "linhai-t-boss-efi-650",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 650,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-linhai-t-boss-efi-650.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "deposit_override_id": "0db5ced8-0869-5b5a-8bce-dcad83c60faa",
    "slug": "cf-moto-efi-800",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 800,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-cf-moto-efi-800.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "deposit_override_id": "8a50d5c6-1bca-50d1-84f6-3f3f438655f3",
    "slug": "cf-moto-z-force-se-800",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 800,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-cf-moto-z-force-se-800.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "deposit_override_id": "7c4117e5-5229-52a9-9f81-97dfd03c8f70",
    "slug": "polaris-rzr-trail-s-1000",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 1000,
    "max_passengers": 3,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-polaris-rzr-trail-s-1000.webp",
    "expected_tier_count": 4
  },
  {
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "deposit_override_id": "7d4c28fc-ffe6-576c-9728-d3fd25631e6b",
    "slug": "polaris-xp-1000",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 1000,
    "max_passengers": 3,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-polaris-xp-1000.webp",
    "expected_tier_count": 4
  },
  {
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "deposit_override_id": "29c4522c-8c2d-5449-8788-cd1e6bb52b09",
    "slug": "polaris-rzr-1000-4-seat",
    "vehicle_kind": "buggy",
    "engine_capacity_cc": 1000,
    "max_passengers": 4,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-polaris-rzr-1000-4-seat.webp",
    "expected_tier_count": 4
  },
  {
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "deposit_override_id": "3f36fcfa-d575-53a4-8068-ecf6facb18d4",
    "slug": "kymco-mxu-50",
    "vehicle_kind": "quad",
    "engine_capacity_cc": 50,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-mxu-50.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "deposit_override_id": "ba5b1ac4-b3cc-5db8-979c-523e3318dd3e",
    "slug": "kymco-mxu-greenline-170",
    "vehicle_kind": "quad",
    "engine_capacity_cc": 170,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-mxu-greenline-170.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "deposit_override_id": "807bafdd-27e5-5a1b-994e-51eef14c5880",
    "slug": "kymco-mxu-250",
    "vehicle_kind": "quad",
    "engine_capacity_cc": 250,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-mxu-250.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "deposit_override_id": "1bd2f066-7b27-59d3-8656-c153a497ee10",
    "slug": "kymco-maxxer-300",
    "vehicle_kind": "quad",
    "engine_capacity_cc": 300,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-maxxer-300.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "deposit_override_id": "7fb496b2-be81-59a5-94ba-e4a37e71aab8",
    "slug": "cf-moto-450",
    "vehicle_kind": "quad",
    "engine_capacity_cc": 450,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-cf-moto-450.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "deposit_override_id": "de755671-8a8c-53a2-962d-5d122742cc3b",
    "slug": "cforce-efi-520",
    "vehicle_kind": "quad",
    "engine_capacity_cc": 520,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-cforce-efi-520.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "deposit_override_id": "82f1e258-9bf7-5947-adcf-bf0a5b05eb2e",
    "slug": "kymco-vitality-50",
    "vehicle_kind": "scooter",
    "engine_capacity_cc": 50,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "AM",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-vitality-50.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "deposit_override_id": "8f5b5617-e28e-526a-802f-c7bcf87de6ce",
    "slug": "kymco-agility-sym-jet-14-125",
    "vehicle_kind": "scooter",
    "engine_capacity_cc": 125,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "A1",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-agility-sym-jet-14-125.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "deposit_override_id": "adaac77e-6112-51fb-b86c-e4020a7c7a55",
    "slug": "kymco-x-town-300",
    "vehicle_kind": "scooter",
    "engine_capacity_cc": 300,
    "max_passengers": 2,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "A",
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-x-town-300.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "deposit_override_id": "ddf0e51c-0d78-501a-b63a-5b02fff14ca9",
    "slug": "bicycle-group-a",
    "vehicle_kind": "bicycle",
    "engine_capacity_cc": null,
    "max_passengers": null,
    "transmission": null,
    "fuel_type": null,
    "required_licence_category": null,
    "insurance_mode": "not_offered",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-bicycle-group-a.webp",
    "expected_tier_count": 7
  },
  {
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "deposit_override_id": "73a19b2c-7170-51a1-ab12-c6d4e699789c",
    "slug": "bicycle-group-b",
    "vehicle_kind": "bicycle",
    "engine_capacity_cc": null,
    "max_passengers": null,
    "transmission": null,
    "fuel_type": null,
    "required_licence_category": null,
    "insurance_mode": "not_offered",
    "image_url": null,
    "expected_tier_count": 7
  },
  {
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "deposit_override_id": "28dadd01-c6b9-5dd2-809e-715b3efca17a",
    "slug": "bicycle-group-c",
    "vehicle_kind": "bicycle",
    "engine_capacity_cc": null,
    "max_passengers": null,
    "transmission": null,
    "fuel_type": null,
    "required_licence_category": null,
    "insurance_mode": "not_offered",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-bicycle-group-c.webp",
    "expected_tier_count": 7
  }
]
$catalogue$::jsonb) as expected(
    offer_id uuid,
    deposit_override_id uuid,
    slug text,
    vehicle_kind text,
    engine_capacity_cc integer,
    max_passengers integer,
    transmission text,
    fuel_type text,
    required_licence_category text,
    insurance_mode text,
    image_url text,
    expected_tier_count integer
  )
),
expected_tiers as (
  select *
  from jsonb_to_recordset($catalogue$
[
  {
    "tier_id": "fd35502d-b51f-586a-ae2d-91f9d81d9193",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 1,
    "daily_rate": "110.000000",
    "source_total": 110
  },
  {
    "tier_id": "2d269821-df05-52cc-ba43-a1a8d6fcc8fe",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 2,
    "daily_rate": "95.000000",
    "source_total": 190
  },
  {
    "tier_id": "75d525c1-d2f2-520a-919d-cd978344c990",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 3,
    "daily_rate": "90.000000",
    "source_total": 270
  },
  {
    "tier_id": "f307bd4e-9b09-5ead-b7ec-1341164abfae",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 4,
    "daily_rate": "85.000000",
    "source_total": 340
  },
  {
    "tier_id": "300da3f7-7cc6-5b3f-a870-1643879f5aed",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 5,
    "daily_rate": "80.000000",
    "source_total": 400
  },
  {
    "tier_id": "6bf87b99-57f9-54a5-9167-9fcb5b7a3362",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 6,
    "daily_rate": "75.000000",
    "source_total": 450
  },
  {
    "tier_id": "9315e769-d8c4-5b99-967f-6d54e4a5b0de",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 7,
    "daily_rate": "70.000000",
    "source_total": 490
  },
  {
    "tier_id": "fa8fbc58-bd22-5bf8-933c-9606dc07a0c5",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 1,
    "daily_rate": "110.000000",
    "source_total": 110
  },
  {
    "tier_id": "1f89cf47-3af6-507a-9c6a-f5dba615f0c8",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 2,
    "daily_rate": "95.000000",
    "source_total": 190
  },
  {
    "tier_id": "177d85ab-4c2d-5eea-bce6-9bd06adc397a",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 3,
    "daily_rate": "90.000000",
    "source_total": 270
  },
  {
    "tier_id": "4a1bfdea-eeb6-508e-92e2-b549b4acc188",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 4,
    "daily_rate": "85.000000",
    "source_total": 340
  },
  {
    "tier_id": "630833e4-a907-5dc8-b963-d987f131b9bf",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 5,
    "daily_rate": "80.000000",
    "source_total": 400
  },
  {
    "tier_id": "1ff423c1-815b-5e79-95c8-f117c2c69aff",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 6,
    "daily_rate": "75.000000",
    "source_total": 450
  },
  {
    "tier_id": "c667e93e-4059-50b7-8672-f5d568c7b980",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 7,
    "daily_rate": "70.000000",
    "source_total": 490
  },
  {
    "tier_id": "c5de320b-0582-5813-960d-86a69d2b4f1d",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 1,
    "daily_rate": "120.000000",
    "source_total": 120
  },
  {
    "tier_id": "6af5da9b-2769-5657-a56b-d6df59575e2a",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 2,
    "daily_rate": "100.000000",
    "source_total": 200
  },
  {
    "tier_id": "49545739-b0a1-5303-b485-c43cdd9a26b9",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 3,
    "daily_rate": "93.333333",
    "source_total": 280
  },
  {
    "tier_id": "f3a86b00-e9f6-50fc-8a86-3402edb49fa6",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 4,
    "daily_rate": "87.500000",
    "source_total": 350
  },
  {
    "tier_id": "5369ae10-7ec7-5c15-a3b6-99ea21480059",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 5,
    "daily_rate": "84.000000",
    "source_total": 420
  },
  {
    "tier_id": "2b2993eb-7adf-5426-9a7f-fbb0983bb0ef",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 6,
    "daily_rate": "80.000000",
    "source_total": 480
  },
  {
    "tier_id": "bb087ae7-db68-5250-8043-352cff0fcb95",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 7,
    "daily_rate": "74.285714",
    "source_total": 520
  },
  {
    "tier_id": "0a5d288d-5f75-5286-a089-a93e8a3d0503",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 1,
    "daily_rate": "140.000000",
    "source_total": 140
  },
  {
    "tier_id": "73c53177-eefb-5102-9452-3b4e8fc77579",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 2,
    "daily_rate": "130.000000",
    "source_total": 260
  },
  {
    "tier_id": "6051883d-de72-5244-8a93-ab294c6200c8",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 3,
    "daily_rate": "120.000000",
    "source_total": 360
  },
  {
    "tier_id": "f37e9beb-b8e9-5aaf-ba00-21ed98a8012a",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 4,
    "daily_rate": "110.000000",
    "source_total": 440
  },
  {
    "tier_id": "5bdd180b-f0c2-5fe5-a0cd-b089d98315a5",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 5,
    "daily_rate": "100.000000",
    "source_total": 500
  },
  {
    "tier_id": "b06b4155-eddd-5ab3-9fb7-3aee40da2187",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 6,
    "daily_rate": "95.000000",
    "source_total": 570
  },
  {
    "tier_id": "df9cfaf0-fea3-5129-813e-bc4e9c0e026f",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 7,
    "daily_rate": "90.000000",
    "source_total": 630
  },
  {
    "tier_id": "cb274773-9eee-5c86-b48a-e13f1a74889f",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 1,
    "daily_rate": "150.000000",
    "source_total": 150
  },
  {
    "tier_id": "665aacd1-17f7-50e4-b08f-54c021d74c14",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 2,
    "daily_rate": "140.000000",
    "source_total": 280
  },
  {
    "tier_id": "7d2021fa-a32c-552f-8e5d-c2079311ec84",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 3,
    "daily_rate": "130.000000",
    "source_total": 390
  },
  {
    "tier_id": "9832908f-90b8-5e8c-9185-3a5139f487c6",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 4,
    "daily_rate": "120.000000",
    "source_total": 480
  },
  {
    "tier_id": "fa82c8f1-7d70-548e-948e-e137a37df6a7",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 5,
    "daily_rate": "110.000000",
    "source_total": 550
  },
  {
    "tier_id": "7f66acb2-7dc6-5c4f-9133-1a7f5dc122f1",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 6,
    "daily_rate": "100.000000",
    "source_total": 600
  },
  {
    "tier_id": "037a2455-c6ec-547d-bfd6-f19b91081171",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 7,
    "daily_rate": "94.285714",
    "source_total": 660
  },
  {
    "tier_id": "ecf3bcff-b01c-5d1d-8eb4-0a75c169b0ab",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 1,
    "daily_rate": "150.000000",
    "source_total": 150
  },
  {
    "tier_id": "f645680a-ef3a-5bd3-8729-89730c147baa",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 2,
    "daily_rate": "135.000000",
    "source_total": 270
  },
  {
    "tier_id": "05ba29ad-353f-554f-9884-f00c677fd468",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 3,
    "daily_rate": "100.000000",
    "source_total": 300
  },
  {
    "tier_id": "9b1983a6-9ff7-5446-8d18-b2c4d9c0278b",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 4,
    "daily_rate": "95.000000",
    "source_total": 380
  },
  {
    "tier_id": "92c2b9de-643d-5dd5-8000-459a7e7da22b",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 5,
    "daily_rate": "90.000000",
    "source_total": 450
  },
  {
    "tier_id": "316d6cb3-30e0-5a8a-ad85-4a2b5c33ae2e",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 6,
    "daily_rate": "85.000000",
    "source_total": 510
  },
  {
    "tier_id": "2afa768d-8b8e-5aad-b010-0f928718776b",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 7,
    "daily_rate": "80.000000",
    "source_total": 560
  },
  {
    "tier_id": "f84d0969-2198-54be-af53-2a5cddd0fd2c",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 1,
    "daily_rate": "160.000000",
    "source_total": 160
  },
  {
    "tier_id": "4f60ece8-d3de-512b-8012-4f4974fb903b",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 2,
    "daily_rate": "145.000000",
    "source_total": 290
  },
  {
    "tier_id": "88028db1-2bd3-5fbd-b074-da7011605a6a",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 3,
    "daily_rate": "123.333333",
    "source_total": 370
  },
  {
    "tier_id": "089dc9fa-f8f2-5134-b2ba-400cd0206b6c",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 4,
    "daily_rate": "115.000000",
    "source_total": 460
  },
  {
    "tier_id": "256a0069-cc9a-5a3b-b70b-b8fe4cb1647a",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 5,
    "daily_rate": "102.000000",
    "source_total": 510
  },
  {
    "tier_id": "91667a76-369a-55db-94d4-19cad7d81027",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 6,
    "daily_rate": "100.000000",
    "source_total": 600
  },
  {
    "tier_id": "71506bc9-72db-5179-878d-327a2d540636",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 7,
    "daily_rate": "97.142857",
    "source_total": 680
  },
  {
    "tier_id": "84eaadb2-79df-5fdf-b3bb-f3bbd35dfcf5",
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "threshold_days": 1,
    "daily_rate": "180.000000",
    "source_total": 180
  },
  {
    "tier_id": "a13ed6df-91d9-5c38-9ac8-0ecc276d6143",
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "threshold_days": 2,
    "daily_rate": "175.000000",
    "source_total": 350
  },
  {
    "tier_id": "b32c8c90-3216-5e22-826a-b5a04af136fd",
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "threshold_days": 3,
    "daily_rate": "170.000000",
    "source_total": 510
  },
  {
    "tier_id": "7c2ba40b-3d8c-51d6-b9dd-41af2e127498",
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "threshold_days": 4,
    "daily_rate": "165.000000",
    "source_total": 660
  },
  {
    "tier_id": "d7bbf456-7bef-5b2c-a12f-6465e3e5a8ea",
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "threshold_days": 1,
    "daily_rate": "180.000000",
    "source_total": 180
  },
  {
    "tier_id": "6f24a52a-156d-5027-ab6b-30ff6a867251",
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "threshold_days": 2,
    "daily_rate": "175.000000",
    "source_total": 350
  },
  {
    "tier_id": "64041fbb-947e-5377-99ee-0243732021f5",
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "threshold_days": 3,
    "daily_rate": "170.000000",
    "source_total": 510
  },
  {
    "tier_id": "5845de3a-adb3-57ca-8d42-fb21abd61968",
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "threshold_days": 4,
    "daily_rate": "165.000000",
    "source_total": 660
  },
  {
    "tier_id": "0785aec3-a495-5695-a8d4-e8fcceabb083",
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "threshold_days": 1,
    "daily_rate": "230.000000",
    "source_total": 230
  },
  {
    "tier_id": "958c8fa2-0a06-51f4-a544-b83943def244",
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "threshold_days": 2,
    "daily_rate": "210.000000",
    "source_total": 420
  },
  {
    "tier_id": "fd77438c-a304-59a7-b5ef-59cb8982b25b",
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "threshold_days": 3,
    "daily_rate": "200.000000",
    "source_total": 600
  },
  {
    "tier_id": "cb5ad5ea-e3ff-53a7-b666-a4efb35488de",
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "threshold_days": 4,
    "daily_rate": "180.000000",
    "source_total": 720
  },
  {
    "tier_id": "0f3e44ee-0ec5-5da1-9c96-3330e559d7dd",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 1,
    "daily_rate": "50.000000",
    "source_total": 50
  },
  {
    "tier_id": "731408d0-9ec9-5f96-8a31-53306c2d7150",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 2,
    "daily_rate": "45.000000",
    "source_total": 90
  },
  {
    "tier_id": "b25eb6cc-5dc0-57a4-a682-d2d941d820ee",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 3,
    "daily_rate": "43.333333",
    "source_total": 130
  },
  {
    "tier_id": "27435fb3-abcd-594f-99e3-52dbb141264c",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 4,
    "daily_rate": "40.000000",
    "source_total": 160
  },
  {
    "tier_id": "02692391-02ac-51e8-8c89-2b61bdf6dba3",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 5,
    "daily_rate": "36.000000",
    "source_total": 180
  },
  {
    "tier_id": "f6ac6ad7-58f0-5d54-8177-852c46cf0c4e",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 6,
    "daily_rate": "33.333333",
    "source_total": 200
  },
  {
    "tier_id": "aadadbfb-7556-5f12-a306-452367e47274",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 7,
    "daily_rate": "31.428571",
    "source_total": 220
  },
  {
    "tier_id": "cf9a457c-d8e0-59dd-8948-7f89696de476",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 1,
    "daily_rate": "60.000000",
    "source_total": 60
  },
  {
    "tier_id": "9ecdc2ad-08f4-5e69-b30e-3752ebef014e",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 2,
    "daily_rate": "55.000000",
    "source_total": 110
  },
  {
    "tier_id": "8ddfe214-bbf1-57c6-9ac2-1a90d8a4d938",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 3,
    "daily_rate": "50.000000",
    "source_total": 150
  },
  {
    "tier_id": "0b681908-7aff-545a-9995-daa9d50b75af",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 4,
    "daily_rate": "47.500000",
    "source_total": 190
  },
  {
    "tier_id": "0728da6d-4058-5523-976e-d054a05a00e0",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 5,
    "daily_rate": "44.000000",
    "source_total": 220
  },
  {
    "tier_id": "e83e3a90-ceda-59bf-b759-bd65e5d024c4",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 6,
    "daily_rate": "40.000000",
    "source_total": 240
  },
  {
    "tier_id": "dbc80889-1314-5923-b83d-a8c1e3d617f9",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 7,
    "daily_rate": "35.714286",
    "source_total": 250
  },
  {
    "tier_id": "b85d6cc2-83d7-5218-b5e8-71da80a8b4cd",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 1,
    "daily_rate": "70.000000",
    "source_total": 70
  },
  {
    "tier_id": "e2077da0-e23e-5731-9e8c-0d862caa04db",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 2,
    "daily_rate": "65.000000",
    "source_total": 130
  },
  {
    "tier_id": "561347b0-996b-5fc7-9aee-4b0f32aa9b79",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 3,
    "daily_rate": "60.000000",
    "source_total": 180
  },
  {
    "tier_id": "cdbf1f19-eb19-5f7f-bff5-2a01618ecf52",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 4,
    "daily_rate": "55.000000",
    "source_total": 220
  },
  {
    "tier_id": "bc116742-c94c-51f7-b03a-9e25131b8827",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 5,
    "daily_rate": "50.000000",
    "source_total": 250
  },
  {
    "tier_id": "3fc90f65-5cde-5093-b3a5-f275f938ac0d",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 6,
    "daily_rate": "46.666667",
    "source_total": 280
  },
  {
    "tier_id": "234e73d3-0a74-5674-9c4e-3be781397f6c",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 7,
    "daily_rate": "44.285714",
    "source_total": 310
  },
  {
    "tier_id": "7f49b1e8-2a4f-5152-99bf-2010d3b03ccc",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 1,
    "daily_rate": "80.000000",
    "source_total": 80
  },
  {
    "tier_id": "21ec315a-bd53-51d5-a33e-91c5fbbe24c7",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 2,
    "daily_rate": "75.000000",
    "source_total": 150
  },
  {
    "tier_id": "62dd7fb4-8080-5098-bd70-000bf7bcb9bf",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 3,
    "daily_rate": "66.666667",
    "source_total": 200
  },
  {
    "tier_id": "8ce56f44-4bb4-5ce0-8ec6-10eadf0101bc",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 4,
    "daily_rate": "57.500000",
    "source_total": 230
  },
  {
    "tier_id": "842d4c46-583a-5f35-bf73-f7dc5299b2ee",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 5,
    "daily_rate": "52.000000",
    "source_total": 260
  },
  {
    "tier_id": "3c510f7e-2cc9-50f8-b07c-fb4a6a7b69bf",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 6,
    "daily_rate": "48.333333",
    "source_total": 290
  },
  {
    "tier_id": "03738eb4-c5ba-5759-800b-da1398537257",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 7,
    "daily_rate": "45.714286",
    "source_total": 320
  },
  {
    "tier_id": "6407bbf2-17b7-5bc0-954b-d1c0701264de",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 1,
    "daily_rate": "90.000000",
    "source_total": 90
  },
  {
    "tier_id": "aebfd690-0d3d-500f-8c51-4eaf64b636d1",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 2,
    "daily_rate": "85.000000",
    "source_total": 170
  },
  {
    "tier_id": "aa3f4757-f886-5947-8cf5-2de3ba0d2495",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 3,
    "daily_rate": "76.666667",
    "source_total": 230
  },
  {
    "tier_id": "528fda8c-0c3f-506a-bf16-4ed5babef45a",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 4,
    "daily_rate": "67.500000",
    "source_total": 270
  },
  {
    "tier_id": "6e6282a2-95de-580b-b78c-75ac304a728a",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 5,
    "daily_rate": "60.000000",
    "source_total": 300
  },
  {
    "tier_id": "11dbb9c7-ecf7-5d11-aa4e-4e5d8b4b241c",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 6,
    "daily_rate": "55.000000",
    "source_total": 330
  },
  {
    "tier_id": "087b3848-ce4d-5554-a858-2099cb8a3809",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 7,
    "daily_rate": "52.857143",
    "source_total": 370
  },
  {
    "tier_id": "4f6c02be-431e-5154-8b6b-7305e9d0ffc9",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 1,
    "daily_rate": "100.000000",
    "source_total": 100
  },
  {
    "tier_id": "bad940ad-de62-542a-b6c6-49f5c65c4e2b",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 2,
    "daily_rate": "90.000000",
    "source_total": 180
  },
  {
    "tier_id": "0b54e62f-3465-5e6e-a0c6-12dc0dd306d0",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 3,
    "daily_rate": "83.333333",
    "source_total": 250
  },
  {
    "tier_id": "d80d6556-1403-55d4-b7e7-123d349a5d1f",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 4,
    "daily_rate": "75.000000",
    "source_total": 300
  },
  {
    "tier_id": "12b18e1a-9515-51f4-ab00-39a4aa004094",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 5,
    "daily_rate": "70.000000",
    "source_total": 350
  },
  {
    "tier_id": "0a3caa10-1c8c-56cd-b6f6-c7f53dcbcbd4",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 6,
    "daily_rate": "66.666667",
    "source_total": 400
  },
  {
    "tier_id": "76d61d44-87ce-52e8-8c4d-c81bf63f9c25",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 7,
    "daily_rate": "64.285714",
    "source_total": 450
  },
  {
    "tier_id": "73ce8c98-73cc-5752-ac81-9ee65d7a81b2",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 1,
    "daily_rate": "40.000000",
    "source_total": 40
  },
  {
    "tier_id": "a66c639d-9da7-5487-a60c-63c935067037",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 2,
    "daily_rate": "35.000000",
    "source_total": 70
  },
  {
    "tier_id": "47983543-8f7f-5d3e-8cb9-219f12757b81",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 3,
    "daily_rate": "30.000000",
    "source_total": 90
  },
  {
    "tier_id": "f0d9307c-03d7-57ea-8ef3-d0ed51ec9a2c",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 4,
    "daily_rate": "27.500000",
    "source_total": 110
  },
  {
    "tier_id": "5a163b70-182d-5509-a035-7beab59de308",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 5,
    "daily_rate": "24.000000",
    "source_total": 120
  },
  {
    "tier_id": "0fcf2304-a546-540e-9e28-0fcd217bc568",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 6,
    "daily_rate": "21.666667",
    "source_total": 130
  },
  {
    "tier_id": "8e82b617-2fa7-514c-9bc4-2b8a12b29265",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 7,
    "daily_rate": "20.000000",
    "source_total": 140
  },
  {
    "tier_id": "5b175308-95e5-549c-b0f3-b87b59aa0411",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 1,
    "daily_rate": "50.000000",
    "source_total": 50
  },
  {
    "tier_id": "d99e5853-950c-5588-abb3-580bb2f52c2d",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 2,
    "daily_rate": "45.000000",
    "source_total": 90
  },
  {
    "tier_id": "d4ccbf69-5216-5c3d-9714-821cf34c5f50",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 3,
    "daily_rate": "40.000000",
    "source_total": 120
  },
  {
    "tier_id": "30fc3c9d-143d-59bd-9d89-225c13ee0e41",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 4,
    "daily_rate": "35.000000",
    "source_total": 140
  },
  {
    "tier_id": "e39e9130-e9b2-53e0-9f65-0e67ad6f9215",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 5,
    "daily_rate": "34.000000",
    "source_total": 170
  },
  {
    "tier_id": "531d2861-b622-53dc-879c-082b849ebd96",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 6,
    "daily_rate": "30.000000",
    "source_total": 180
  },
  {
    "tier_id": "a8779094-3338-5321-a9d2-25c4608b5bd9",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 7,
    "daily_rate": "28.571429",
    "source_total": 200
  },
  {
    "tier_id": "1b2ec86d-0fe4-5c99-99ee-6798f623f18f",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 1,
    "daily_rate": "70.000000",
    "source_total": 70
  },
  {
    "tier_id": "07fad372-f05d-5364-9f5e-30c228088cea",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 2,
    "daily_rate": "65.000000",
    "source_total": 130
  },
  {
    "tier_id": "381e1e34-29f1-5b29-bc9d-c26cab5f0578",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 3,
    "daily_rate": "60.000000",
    "source_total": 180
  },
  {
    "tier_id": "36d81c07-f44c-58bf-b9ba-5f2f880e9205",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 4,
    "daily_rate": "55.000000",
    "source_total": 220
  },
  {
    "tier_id": "bf890a95-26e1-59e2-9c61-3d234cc503b7",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 5,
    "daily_rate": "50.000000",
    "source_total": 250
  },
  {
    "tier_id": "c590ac12-1640-55f2-ac2f-b8df1fabbb5f",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 6,
    "daily_rate": "46.666667",
    "source_total": 280
  },
  {
    "tier_id": "0bae2c79-79d5-5d0b-b554-fc5339aa46f4",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 7,
    "daily_rate": "42.857143",
    "source_total": 300
  },
  {
    "tier_id": "b1fdd6a7-bb3d-5c8c-ba66-3b892e406633",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 1,
    "daily_rate": "10.000000",
    "source_total": 10
  },
  {
    "tier_id": "917cfbc9-8885-5443-841e-de3a569bab14",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 2,
    "daily_rate": "7.500000",
    "source_total": 15
  },
  {
    "tier_id": "4d7ceaae-4d4a-5136-98a5-c287cb5dc3dd",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 3,
    "daily_rate": "6.666667",
    "source_total": 20
  },
  {
    "tier_id": "bb6b2503-fdd7-5b9b-8e2f-fef8cba2c5d4",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 4,
    "daily_rate": "6.250000",
    "source_total": 25
  },
  {
    "tier_id": "d11000c0-36a1-5815-a974-7d07ee7b6e74",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 5,
    "daily_rate": "5.800000",
    "source_total": 29
  },
  {
    "tier_id": "d722da30-75ab-5808-a234-a69bd1c38212",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 6,
    "daily_rate": "5.500000",
    "source_total": 33
  },
  {
    "tier_id": "3a2a9666-4209-5bcf-9aad-c502ac04e374",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 7,
    "daily_rate": "5.285714",
    "source_total": 37
  },
  {
    "tier_id": "e070888d-7916-5184-94ef-0406eb0d40e2",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 1,
    "daily_rate": "15.000000",
    "source_total": 15
  },
  {
    "tier_id": "af74e6ef-97b9-5825-b1b0-6352ee608b35",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 2,
    "daily_rate": "12.500000",
    "source_total": 25
  },
  {
    "tier_id": "c42de672-1241-5fa3-8b86-bd61c3b5e92c",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 3,
    "daily_rate": "10.000000",
    "source_total": 30
  },
  {
    "tier_id": "968bc16f-8d1d-555e-9429-fcd71b4985d9",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 4,
    "daily_rate": "10.000000",
    "source_total": 40
  },
  {
    "tier_id": "80decc8f-44fe-5ff1-a9bf-e5e0a8147531",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 5,
    "daily_rate": "10.000000",
    "source_total": 50
  },
  {
    "tier_id": "6694b196-1376-5c9d-990d-b98b89bdf42e",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 6,
    "daily_rate": "9.166667",
    "source_total": 55
  },
  {
    "tier_id": "7fd9111a-7e27-53d9-8d4c-792c12c8c670",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 7,
    "daily_rate": "8.571429",
    "source_total": 60
  },
  {
    "tier_id": "62a36cb6-4590-588f-9b4b-b68adeb085ff",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 1,
    "daily_rate": "20.000000",
    "source_total": 20
  },
  {
    "tier_id": "7d3a0815-8391-5aa4-b95a-14d8f705d74b",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 2,
    "daily_rate": "17.500000",
    "source_total": 35
  },
  {
    "tier_id": "c9656e74-5627-54d8-9caf-a724af6cb851",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 3,
    "daily_rate": "15.000000",
    "source_total": 45
  },
  {
    "tier_id": "16446e25-ce39-5655-a27f-433b281da7ce",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 4,
    "daily_rate": "13.750000",
    "source_total": 55
  },
  {
    "tier_id": "9f17ce67-5f60-5f08-8c2a-516d79ed0ac5",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 5,
    "daily_rate": "12.600000",
    "source_total": 63
  },
  {
    "tier_id": "533127ae-92e5-51a3-b6e7-eac79bef2d6b",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 6,
    "daily_rate": "11.666667",
    "source_total": 70
  },
  {
    "tier_id": "856f217c-d2df-5f3f-9859-4a03d4e6697d",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 7,
    "daily_rate": "10.714286",
    "source_total": 75
  }
]
$catalogue$::jsonb) as expected(
    offer_id uuid,
    tier_id uuid,
    threshold_days integer,
    daily_rate numeric(12,6),
    source_total numeric(12,2)
  )
),
expected_counts as (
  select
    count(*)::integer as offer_count,
    (count(*) - count(distinct offer_id))::integer as duplicate_offer_id,
    count(*) filter (where vehicle_kind = 'buggy')::integer as buggy_count,
    count(*) filter (where vehicle_kind = 'quad')::integer as quad_count,
    count(*) filter (where vehicle_kind = 'scooter')::integer as scooter_count,
    count(*) filter (where vehicle_kind = 'bicycle')::integer as bicycle_count,
    count(*) filter (where image_url is not null)::integer as image_count
  from expected_offers
),
offer_state as (
  select
    count(offer.id)::integer as offer_count,
    count(*) filter (where kind.code = 'buggy')::integer as buggy_count,
    count(*) filter (where kind.code = 'quad')::integer as quad_count,
    count(*) filter (where kind.code = 'scooter')::integer as scooter_count,
    count(*) filter (where kind.code = 'bicycle')::integer as bicycle_count,
    count(*) filter (where offer.pricing_strategy = 'threshold_daily_rate')::integer as threshold_count,
    count(*) filter (where offer.availability_mode = 'legacy')::integer as legacy_mode_count,
    count(*) filter (where offer.is_published is false)::integer as unpublished_count,
    count(*) filter (where offer.is_available is false)::integer as unavailable_count,
    count(*) filter (where offer.submission_status = 'draft')::integer as draft_count,
    count(*) filter (where offer.min_rental_days = 1)::integer as min_one_count,
    count(*) filter (where offer.max_rental_days is null)::integer as unlimited_max_count,
    count(*) filter (where offer.owner_partner_id = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid)::integer as partner_count,
    count(*) filter (where offer.minimum_driver_age = 18)::integer as age_18_count,
    count(*) filter (where offer.young_driver_fee is false and coalesce(offer.young_driver_cost, 0) = 0)::integer as young_disabled_count,
    count(*) filter (where expected.vehicle_kind <> 'bicycle' and offer.insurance_mode = 'included')::integer as motor_third_party_count,
    count(*) filter (where expected.vehicle_kind = 'bicycle' and offer.insurance_mode = 'not_offered')::integer as bicycle_insurance_na_count,
    count(*) filter (where offer.image_url is not null)::integer as image_count,
    count(*) filter (
      where expected.vehicle_kind = 'bicycle'
        and expected.max_passengers is null
        and offer.max_passengers is null
        and offer.engine_capacity_cc is null
        and offer.transmission is null
        and offer.fuel_type is null
        and offer.required_licence_category is null
    )::integer as bicycle_unknowns_preserved_count,
    count(*) filter (
      where offer.engine_capacity_cc is distinct from expected.engine_capacity_cc
         or offer.max_passengers is distinct from expected.max_passengers
         or offer.transmission is distinct from expected.transmission
         or offer.fuel_type is distinct from expected.fuel_type
         or offer.required_licence_category is distinct from expected.required_licence_category
         or offer.insurance_mode is distinct from expected.insurance_mode
         or offer.image_url is distinct from expected.image_url
         or kind.code is distinct from expected.vehicle_kind
    )::integer as structured_mismatch_count,
    array_agg(offer.id order by offer.id) filter (where offer.id is not null) as exact_offer_ids
  from expected_offers expected
  left join public.car_offers offer on offer.id = expected.offer_id
  left join public.car_vehicle_kinds kind on kind.id = offer.vehicle_kind_id
),
tier_state as (
  select
    count(tier.id)::integer as tier_count,
    count(*) filter (where tier.is_active)::integer as active_tier_count,
    count(*) filter (
      where tier.id is null
         or tier.daily_rate <> expected.daily_rate
         or round(tier.daily_rate * expected.threshold_days, 2) <> expected.source_total
    )::integer as source_total_mismatch_count,
    count(*) filter (where tier.threshold_days = 1 and tier.is_active)::integer as first_day_tier_count
  from expected_tiers expected
  left join public.car_offer_daily_rate_tiers tier
    on tier.id = expected.tier_id
   and tier.offer_id = expected.offer_id
   and tier.threshold_days = expected.threshold_days
),
tier_contract as (
  select
    count(*) filter (where actual.actual_count <> expected.expected_tier_count)::integer as offer_tier_count_mismatch,
    count(*) filter (where actual.duplicate_count > 0)::integer as duplicate_offer_threshold_groups,
    count(*) filter (where actual.unexpected_count > 0)::integer as unexpected_tier_offer_count
  from expected_offers expected
  cross join lateral (
    select
      count(*)::integer as actual_count,
      (count(*) - count(distinct tier.threshold_days))::integer as duplicate_count,
      count(*) filter (
        where not exists (
          select 1 from expected_tiers expected_tier
          where expected_tier.offer_id = tier.offer_id
            and expected_tier.threshold_days = tier.threshold_days
        )
      )::integer as unexpected_count
    from public.car_offer_daily_rate_tiers tier
    where tier.offer_id = expected.offer_id
  ) actual
),
continuation_cases as (
  select expected.offer_id, expected.slug, duration.rental_days
  from expected_offers expected
  cross join (values (8), (10), (14)) duration(rental_days)
  union all
  select expected.offer_id, expected.slug, duration.rental_days
  from expected_offers expected
  cross join (values (5), (7)) duration(rental_days)
  where expected.slug in (
    'polaris-rzr-trail-s-1000',
    'polaris-xp-1000',
    'polaris-rzr-1000-4-seat'
  )
),
continuation_state as (
  select
    count(*)::integer as case_count,
    count(*) filter (
      where expected_selected.daily_rate is null
         or actual_selected.daily_rate is null
         or actual_selected.threshold_days <> expected_selected.threshold_days
         or actual_selected.daily_rate <> expected_selected.daily_rate
         or round(actual_selected.daily_rate * continuation.rental_days, 2)
              <> round(expected_selected.daily_rate * continuation.rental_days, 2)
    )::integer as mismatch_count,
    count(*) filter (
      where continuation.slug in (
        'polaris-rzr-trail-s-1000',
        'polaris-xp-1000',
        'polaris-rzr-1000-4-seat'
      )
        and continuation.rental_days > 4
        and actual_selected.threshold_days = 4
    )::integer as polaris_post_four_continuation_count
  from continuation_cases continuation
  left join lateral (
    select expected.threshold_days, expected.daily_rate
    from expected_tiers expected
    where expected.offer_id = continuation.offer_id
      and expected.threshold_days <= continuation.rental_days
    order by expected.threshold_days desc
    limit 1
  ) expected_selected on true
  left join lateral (
    select tier.threshold_days, tier.daily_rate
    from public.car_offer_daily_rate_tiers tier
    where tier.offer_id = continuation.offer_id
      and tier.is_active
      and tier.threshold_days <= continuation.rental_days
    order by tier.threshold_days desc
    limit 1
  ) actual_selected on true
),
availability_state as (
  select
    count(*) filter (
      where city.code = 'ayia-napa'
        and availability.pickup_enabled
        and availability.return_enabled
        and availability.is_active
        and availability.fee_mode = 'override'
        and availability.fee_per_direction = 0
    )::integer as exact_ayia_napa_count,
    count(*) filter (
      where availability.offer_id is not null
        and city.code is distinct from 'ayia-napa'
    )::integer as additional_configured_city_count
  from expected_offers expected
  left join public.car_offer_city_availability availability on availability.offer_id = expected.offer_id
  left join public.car_rental_cities city on city.id = availability.city_id
),
deposit_state as (
  select
    count(*) filter (
      where override_row.id = expected.deposit_override_id
        and override_row.resource_type = 'cars'
        and override_row.resource_id = expected.offer_id
        and override_row.mode = 'percent_total'
        and override_row.amount = 15
        and override_row.currency = 'EUR'
        and override_row.enabled
    )::integer as valid_override_count,
    count(*) filter (where override_row.id is null)::integer as missing_override_count
  from expected_offers expected
  left join public.service_deposit_overrides override_row
    on override_row.resource_type = 'cars'
   and override_row.resource_id = expected.offer_id
),
flag_state as (
  select
    coalesce(bool_or(setting.car_multi_city_mapped_enabled), false) as mapped_enabled,
    coalesce(bool_or(setting.car_threshold_daily_rates_enabled), false) as threshold_enabled
  from public.site_settings setting
),
partner_state as (
  select
    (
      select count(*)::integer
      from public.partners partner
      where partner.id = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
        and lower(partner.status) = 'active'
        and partner.can_manage_cars
    ) as valid_partner_count,
    (
      select count(*)::integer
      from expected_offers expected
      where public.partner_service_fulfillment_partner_id_for_car_booking(
        expected.offer_id,
        'ayia-napa'
      ) = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
    ) as exact_owner_routing_count
),
legacy_state as (
  select
    count(*)::integer as offer_count,
    count(*) filter (where offer.pricing_strategy = 'legacy_compat')::integer as legacy_pricing_count,
    md5(coalesce(string_agg(
      jsonb_build_array(
        offer.id,
        offer.price_per_day,
        offer.price_3days,
        offer.price_4_6days,
        offer.price_7_10days,
        offer.price_10plus_days,
        offer.currency,
        offer.location,
        offer.owner_partner_id,
        offer.deposit_amount,
        offer.insurance_per_day,
        offer.young_driver_fee,
        offer.young_driver_cost,
        offer.stock_count,
        offer.north_allowed,
        offer.is_available,
        offer.is_published,
        offer.submission_status
      )::text,
      E'\n' order by offer.id
    ), '')) as protected_fingerprint
  from public.car_offers offer
  where not exists (select 1 from expected_offers expected where expected.offer_id = offer.id)
),
legacy_availability_state as (
  select
    count(*)::integer as row_count,
    count(*) filter (where availability.is_active)::integer as active_count,
    count(*) filter (where availability.fee_mode = 'inherit')::integer as inherit_count,
    count(*) filter (where availability.fee_mode = 'override')::integer as override_count
  from public.car_offer_city_availability availability
  where not exists (
    select 1 from expected_offers expected where expected.offer_id = availability.offer_id
  )
),
booking_state as (
  select
    count(*)::integer as speedbikes_booking_count
  from public.car_bookings booking
  where exists (select 1 from expected_offers expected where expected.offer_id = booking.offer_id)
),
fulfillment_state as (
  select
    count(*)::integer as speedbikes_fulfillment_count,
    count(*) filter (where fulfillment.status <> 'pending_acceptance')::integer as non_pending_count
  from public.partner_service_fulfillments fulfillment
  where fulfillment.resource_type = 'cars'
    and exists (select 1 from expected_offers expected where expected.offer_id = fulfillment.resource_id)
),
precision_state as (
  select exists (
    select 1 from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'car_offer_daily_rate_tiers'
      and column_info.column_name = 'daily_rate'
      and column_info.data_type = 'numeric'
      and column_info.numeric_scale >= 6
  ) as six_decimal_daily_rate
),
summary as (
  select
    now() as inspected_at,
    offers.offer_count,
    offers.buggy_count,
    offers.quad_count,
    offers.scooter_count,
    offers.bicycle_count,
    offers.threshold_count,
    offers.legacy_mode_count,
    offers.unpublished_count,
    offers.unavailable_count,
    offers.draft_count,
    offers.min_one_count,
    offers.unlimited_max_count,
    offers.partner_count,
    offers.age_18_count,
    offers.young_disabled_count,
    offers.motor_third_party_count,
    offers.bicycle_insurance_na_count,
    offers.image_count,
    offers.bicycle_unknowns_preserved_count,
    offers.structured_mismatch_count,
    offers.exact_offer_ids,
    tiers.tier_count,
    tiers.active_tier_count,
    tiers.source_total_mismatch_count as speedbikes_source_price_mismatch,
    tiers.first_day_tier_count,
    tier_contract.offer_tier_count_mismatch,
    expected.duplicate_offer_id,
    tier_contract.duplicate_offer_threshold_groups,
    tier_contract.unexpected_tier_offer_count,
    continuation.case_count as continuation_case_count,
    continuation.mismatch_count as continuation_mismatch_count,
    continuation.polaris_post_four_continuation_count,
    availability.exact_ayia_napa_count,
    availability.additional_configured_city_count,
    deposits.valid_override_count,
    deposits.missing_override_count,
    round(490::numeric * 0.15, 2) as example_15_percent_due_now,
    round(490::numeric - round(490::numeric * 0.15, 2), 2) as example_85_percent_remaining,
    partner.valid_partner_count,
    partner.exact_owner_routing_count,
    flags.mapped_enabled as car_multi_city_mapped_enabled,
    flags.threshold_enabled as car_threshold_daily_rates_enabled,
    legacy.offer_count as existing_legacy_offer_count,
    legacy.legacy_pricing_count as existing_legacy_pricing_count,
    legacy.protected_fingerprint as existing_legacy_protected_fingerprint,
    legacy_availability.row_count as existing_availability_rows,
    legacy_availability.active_count as existing_active_availability_rows,
    legacy_availability.inherit_count as existing_inherit_availability_rows,
    legacy_availability.override_count as existing_override_availability_rows,
    case when legacy.offer_count = 27 and legacy.protected_fingerprint = 'ec3e29a35f249c92279d7b15f400ef0f' then 0 else 1 end as legacy_price_mismatch,
    bookings.speedbikes_booking_count,
    fulfillments.speedbikes_fulfillment_count,
    fulfillments.non_pending_count as automatic_acceptance_count,
    precision.six_decimal_daily_rate,
    (
      offers.structured_mismatch_count
      + tiers.source_total_mismatch_count
      + tier_contract.offer_tier_count_mismatch
      + tier_contract.unexpected_tier_offer_count
      + continuation.mismatch_count
      + deposits.missing_override_count
      + case when partner.valid_partner_count = 1 then 0 else 1 end
      + case when partner.exact_owner_routing_count = 22 then 0 else 1 end
    )::integer as unexplained_difference,
    (
      expected.offer_count = 22
      and expected.buggy_count = 10
      and expected.quad_count = 6
      and expected.scooter_count = 3
      and expected.bicycle_count = 3
      and expected.image_count = 21
      and expected.duplicate_offer_id = 0
      and offers.offer_count = 22
      and offers.buggy_count = 10
      and offers.quad_count = 6
      and offers.scooter_count = 3
      and offers.bicycle_count = 3
      and offers.threshold_count = 22
      and offers.min_one_count = 22
      and offers.unlimited_max_count = 22
      and offers.partner_count = 22
      and offers.age_18_count = 22
      and offers.young_disabled_count = 22
      and offers.motor_third_party_count = 19
      and offers.bicycle_insurance_na_count = 3
      and offers.image_count = 21
      and offers.bicycle_unknowns_preserved_count = 3
      and offers.structured_mismatch_count = 0
      and tiers.tier_count = 145
      and tiers.active_tier_count = 145
      and tiers.source_total_mismatch_count = 0
      and tiers.first_day_tier_count = 22
      and tier_contract.offer_tier_count_mismatch = 0
      and tier_contract.duplicate_offer_threshold_groups = 0
      and tier_contract.unexpected_tier_offer_count = 0
      and continuation.case_count = 72
      and continuation.mismatch_count = 0
      and continuation.polaris_post_four_continuation_count = 15
      and availability.exact_ayia_napa_count = 22
      and deposits.valid_override_count = 22
      and deposits.missing_override_count = 0
      and round(490::numeric * 0.15, 2) = 73.50
      and round(490::numeric - round(490::numeric * 0.15, 2), 2) = 416.50
      and partner.valid_partner_count = 1
      and partner.exact_owner_routing_count = 22
      and legacy.offer_count = 27
      and legacy.legacy_pricing_count = 27
      and legacy.protected_fingerprint = 'ec3e29a35f249c92279d7b15f400ef0f'
      and legacy_availability.row_count = 12
      and legacy_availability.active_count = 12
      and legacy_availability.inherit_count = 12
      and legacy_availability.override_count = 0
      and precision.six_decimal_daily_rate
    ) as speedbikes_catalogue_safe
  from expected_counts expected
  cross join offer_state offers
  cross join tier_state tiers
  cross join tier_contract
  cross join continuation_state continuation
  cross join availability_state availability
  cross join deposit_state deposits
  cross join partner_state partner
  cross join flag_state flags
  cross join legacy_state legacy
  cross join legacy_availability_state legacy_availability
  cross join booking_state bookings
  cross join fulfillment_state fulfillments
  cross join precision_state precision
)
select * from summary;
